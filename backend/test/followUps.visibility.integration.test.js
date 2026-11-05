const { test } = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/db');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const fu = require('../src/services/followUps');

test('assigned follow-ups appear without personal pins and remain permission scoped', { skip: !process.env.FOLLOWUP_TEST_DATABASE }, async () => {
  assert.equal(process.env.POSTGRES_DB, 'followup_test');
  try {
    await pool.query(`DROP SCHEMA IF EXISTS coexistence CASCADE; CREATE SCHEMA coexistence;
      CREATE TABLE coexistence.leads (id bigint, whatsapp_number text, name text, stage text, source text, email text, city text, profession text, paid_course text, created_at timestamptz);
      CREATE TABLE coexistence.contacts (wa_number text, contact_number text, assigned_user_id bigint, name text);
      CREATE TABLE coexistence.lead_pins (user_id bigint, contact_key text, wa_number text, contact_number text, pinned_at timestamptz, note text);
      CREATE TABLE coexistence.lead_follow_ups (id bigint, contact_key text, wa_number text, contact_number text, owner_user_id bigint, due_date date, due_time time, note text, status text);
      CREATE TABLE coexistence.chat_history (wa_number text, contact_number text, message_body text, message_type text, direction text, timestamp timestamptz);
      INSERT INTO coexistence.contacts VALUES ('100', '919999999999', 2, 'Assigned customer');
      INSERT INTO coexistence.leads (id,whatsapp_number,name) VALUES (1,'919999999999','Assigned customer');
      INSERT INTO coexistence.lead_follow_ups VALUES (1,'9999999999','100','919999999999',1,'2026-11-04','10:00','Call','open');`);
    await pool.query(`ALTER TABLE coexistence.contacts ADD COLUMN tags jsonb DEFAULT '[]', ADD COLUMN updated_at timestamptz;
      ALTER TABLE coexistence.contacts ADD UNIQUE (wa_number,contact_number);
      ALTER TABLE coexistence.leads ADD COLUMN assigned_user_id bigint, ADD COLUMN assigned_bda text, ADD COLUMN updated_at timestamptz;`);
    // Execute the actual assignment handlers against isolated PostgreSQL fixtures.
    function handler(file, marker, endMarker, extras = {}) {
      const source = fs.readFileSync(path.join(__dirname, '../src/routes', file), 'utf8');
      const start = source.indexOf(marker) + marker.length;
      const body = source.slice(start, source.indexOf(endMarker, start));
      return vm.runInNewContext('(async (req,res) => {' + body + '})', {
        pool, console, isAdmin: u => (u.user || u).role === 'admin',
        bus: { emit() {} }, MANAGED_TAG_CATEGORIES: [], emitLeadChanged() {}, ...extras,
      });
    }
    const save = handler('messages.js', "router.post('/contacts/save', async (req, res) => {", '\n});');
    const bulk = handler('leads.js', "router.post('/leads/bulk-assign', async (req, res) => {", '\n});');
    const response = { status(code) { throw new Error('Unexpected HTTP ' + code); }, json() {} };
    for (const assignedUserId of [2, null, 2]) {
      await save({ user: { role: 'admin' }, body: { waNumber: '100', contactNumber: '919999999999', assignedUserId } }, response);
      assert.equal(Number((await pool.query('SELECT assigned_user_id FROM coexistence.leads')).rows[0].assigned_user_id) || null, assignedUserId);
    }
    for (const assignedUserId of [3, null, 2]) {
      await bulk({ user: { role: 'admin' }, body: { leadIds: [1], assignedUserId } }, response);
      assert.equal(Number((await pool.query('SELECT assigned_user_id FROM coexistence.contacts')).rows[0].assigned_user_id) || null, assignedUserId);
    }
    const rep = { id: 2, role: 'sales' };
    let items = await fu.myList(rep);
    assert.equal(items.length, 1);
    assert.equal(items[0].nextFollowUp.id, 1);
    assert.equal(items[0].pinnedAt, null);
    assert.equal((await fu.myList({ id: 3, role: 'sales' })).length, 0);
    await pool.query(`INSERT INTO coexistence.lead_pins VALUES (2,'9999999999','100','919999999999',NOW(),'');`);
    assert.equal((await fu.myList(rep)).length, 1, 'pin and reminder must not duplicate the customer');
    await pool.query(`UPDATE coexistence.lead_follow_ups SET status='done'`);
    items = await fu.myList(rep);
    assert.equal(items.length, 1, 'a personal pin remains after completion');
    assert.equal(items[0].nextFollowUp, null);
    await pool.query(`DELETE FROM coexistence.lead_pins`);
    assert.equal((await fu.myList(rep)).length, 0, 'completed reminders do not remain in the active list');
  } finally {
    await pool.end();
  }
});
