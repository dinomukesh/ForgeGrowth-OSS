const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {fromMeta}=require('../src/services/templateImport');
const {listTemplates}=require('../src/integrations/metaTemplates');
const remote={id:'meta1',name:'welcome',language:'en',category:'MARKETING',status:'APPROVED',components:[{type:'BODY',text:'Hi {{1}}',example:{body_text:[['Customer']]}},{type:'BUTTONS',buttons:[{type:'URL',text:'Visit',url:'https://example.com/{{1}}',example:['https://example.com/test']}]}]};
test('maps body, variable samples and URL button values',()=>{
 const d=fromMeta(remote);assert.equal(d.body,'Hi {{1}}');assert.equal(d.samples['1'],'Customer');assert.equal(d.buttons[0].value,'https://example.com/{{1}}');assert.equal(d.buttons[0].urlSample,'https://example.com/test');
});
test('fetches components and follows pagination without trusting next URLs',async()=>{
 const original=global.fetch;let calls=0;
 global.fetch=async url=>{calls++;assert.match(url,/components/);if(calls===2)assert.match(url,/after=cursor2/);return {ok:true,json:async()=>calls===1?{data:[remote],paging:{next:'https://ignored.invalid',cursors:{after:'cursor2'}}}:{data:[{...remote,id:'meta2'}]}};};
 try{assert.equal((await listTemplates('waba','token')).length,2);assert.equal(calls,2);}finally{global.fetch=original;}
});
test('transactional import is repeatable, account scoped and rolls back failures', {skip:!process.env.TEMPLATE_IMPORT_TEST},async()=>{
 assert.equal(process.env.POSTGRES_DB,'template_import_test');
 const pool=require('../src/db');
 try{
 await pool.query('DROP SCHEMA IF EXISTS coexistence CASCADE; CREATE SCHEMA coexistence');
 await pool.query(fs.readFileSync('/migrations/005_message_templates.sql','utf8'));
 await pool.query(fs.readFileSync('/migrations/018_template_full_lifecycle.sql','utf8'));
 await pool.query('ALTER TABLE coexistence.message_templates ADD COLUMN whatsapp_account_id bigint');
 let fixtures=[remote];
 const source=fs.readFileSync('/app/src/routes/templates.js','utf8');const start=source.indexOf('async function syncAccountTemplates');const end=source.indexOf('\n/**',start);
 const sync=vm.runInNewContext('('+source.slice(start,end).trim()+')',{pool,metaListTemplates:async()=>fixtures,require:()=>require('../src/services/templateImport')});
 const a={id:1};
 const results=await Promise.all([sync(a),sync(a)]);
 assert.equal(results.reduce((n,r)=>n+r.imported,0),1);
 assert.equal((await pool.query('SELECT count(*)::int n FROM coexistence.message_templates')).rows[0].n,1);
 await pool.query("UPDATE coexistence.message_templates SET body='Local editing preserved'");
 assert.equal((await sync(a)).imported,0);
 assert.equal((await pool.query('SELECT body FROM coexistence.message_templates')).rows[0].body,'Local editing preserved');
 assert.equal((await sync({id:2})).imported,1);
 fixtures=[{...remote,name:'valid_new'},{...remote,name:'broken',components:null}];
 await assert.rejects(sync(a),/missing components/);
 assert.equal((await pool.query('SELECT count(*)::int n FROM coexistence.message_templates')).rows[0].n,2);
 }finally{await pool.end();}
});
