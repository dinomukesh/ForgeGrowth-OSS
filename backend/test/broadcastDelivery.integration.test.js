const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const {syncBroadcastReceipt}=require('../src/services/broadcastDelivery');
test('failed, duplicate and out-of-order receipts keep broadcast and chat consistent',{skip:!process.env.DELIVERY_TEST_DB},async()=>{
 assert.equal(process.env.POSTGRES_DB,'delivery_test');const db=require('../src/db');
 try{
 await db.query(`CREATE SCHEMA coexistence; CREATE TABLE coexistence.chat_history(message_id text,status text,error_message text,raw_payload jsonb,wa_number text,contact_number text);
 CREATE TABLE coexistence.broadcast_logs(wa_message_id text,status text,error_message text);
 INSERT INTO coexistence.chat_history VALUES ('wamid.test','sent',NULL,'{}','100','200');
 INSERT INTO coexistence.broadcast_logs VALUES ('wamid.test','sent',NULL);`);
 const source=fs.readFileSync('/app/src/routes/webhook.js','utf8');
 const start=source.indexOf('const upd = await client.query(');const query=source.slice(start).split('`')[1];
 const ranks={sent:1,failed:2,delivered:3,read:4};
 async function apply(status){await db.query(query,[status,'wamid.test',ranks[status],status==='failed'?'[130429] limited':null,JSON.stringify({status})]);await syncBroadcastReceipt(db,'wamid.test');return (await db.query('SELECT status,error_message FROM coexistence.broadcast_logs')).rows[0];}
 assert.equal((await apply('failed')).status,'failed');assert.equal((await apply('sent')).status,'failed');
 assert.equal((await apply('failed')).error_message,'[130429] limited');
 assert.equal((await apply('delivered')).status,'delivered');assert.equal((await apply('delivered')).error_message,null);
 assert.equal((await apply('read')).status,'read');assert.equal((await apply('failed')).status,'read');
 }finally{await db.end();}
});
