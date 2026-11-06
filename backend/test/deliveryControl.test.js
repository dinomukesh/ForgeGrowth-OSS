const {test}=require('node:test');
const assert=require('node:assert/strict');
const {retryReceipt,RETRY_DELAYS,reserve}=require('../src/queue/deliveryControl');
const data={accountId:1,kind:'template',originRef:{kind:'broadcast_log',id:1}};
test('only explicit throughput failures retry, with bounded attempts and deterministic IDs',async()=>{
 let row={status:'failed',error_message:'[130429] limit'};let saved=data;const jobs=[];
 const redis={get:async()=>JSON.stringify(saved),eval:async()=>0};
 const db={query:async()=>({rows:[row]})};const enqueue=async(d,o)=>jobs.push({d,o});
 const call=()=>retryReceipt({redis,db,enqueue,wamid:'wamid.test'});
 assert.equal(await call(),true);assert.equal(jobs[0].o.delayMs,60000);
 await call();assert.equal(jobs[0].o.jobId,jobs[1].o.jobId);
 for(const status of ['sent','delivered','read']){row={status,error_message:'[130429] limit'};assert.equal(await call(),false);}
 row={status:'failed',error_message:'[131049] not eligible'};assert.equal(await call(),false);
 row={status:'failed',error_message:'[130429] limit'};saved={...data,deliveryRetryCount:RETRY_DELAYS.length};assert.equal(await call(),false);
});
test('Redis enforces one slot per second across concurrent workers', {skip:!process.env.DELIVERY_TEST_REDIS},async()=>{
 const Redis=require('ioredis');const r=new Redis(process.env.DELIVERY_TEST_REDIS);
 try{await r.del('send-pace:test','send-cooldown:test');const waits=await Promise.all(Array.from({length:5},()=>reserve(r,'test',1000)));assert.equal(waits.filter(n=>n===0).length,1);assert.ok(waits.filter(n=>n>0).every(n=>n<=1000));}finally{await r.quit();}
});
