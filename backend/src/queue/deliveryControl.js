const crypto=require('node:crypto');
const RETRY_DELAYS=[60000,120000,300000];
const key=id=>'send-receipt:'+crypto.createHash('sha256').update(id).digest('hex');
const cooldownKey=id=>'send-cooldown:'+id;
// Redis TIME and a single Lua operation keep workers/processes from bursting.
const RESERVE=`local t=redis.call('TIME'); local now=t[1]*1000+math.floor(t[2]/1000)
local cooldown=tonumber(redis.call('GET',KEYS[2]) or '0')
local next=tonumber(redis.call('GET',KEYS[1]) or '0')
local wait=math.max(cooldown,next)-now
if wait>0 then return wait end
redis.call('SET',KEYS[1],now+tonumber(ARGV[1]),'PX',math.max(tonumber(ARGV[1]),1000)+60000)
return 0`;
async function reserve(redis,accountId,gap){return Number(await redis.eval(RESERVE,2,'send-pace:'+accountId,cooldownKey(accountId),gap));}
async function coolDown(redis,accountId,ms=60000){
 await redis.eval(`local t=redis.call('TIME'); local untilAt=t[1]*1000+math.floor(t[2]/1000)+tonumber(ARGV[1]); local old=tonumber(redis.call('GET',KEYS[1]) or '0'); if untilAt>old then redis.call('SET',KEYS[1],untilAt,'PX',ARGV[1]) end`,1,cooldownKey(accountId),ms);
}
async function remember(redis,wamid,data){
 if(data.originRef?.kind==='broadcast_log' && data.kind==='template') await redis.set(key(wamid),JSON.stringify(data),'EX',86400);
}
async function retryReceipt({redis,db,enqueue,wamid}) {
 const saved=await redis.get(key(wamid));if(!saved)return false;
 const data=JSON.parse(saved);
 const {rows}=await db.query('SELECT status,error_message FROM coexistence.chat_history WHERE message_id=$1',[wamid]);
 if(rows[0]?.status!=='failed'||!String(rows[0].error_message||'').startsWith('[130429]'))return false;
 await coolDown(redis,data.accountId);
 const attempt=Number(data.deliveryRetryCount||0);
 if(attempt>=RETRY_DELAYS.length)return false;
 // Deterministic queue id deduplicates webhook repeats. Recheck before sending.
 await enqueue({...data,localMessageId:wamid,retryOf:wamid,deliveryRetryCount:attempt+1},
   {delayMs:RETRY_DELAYS[attempt],jobId:'delivery-retry-'+crypto.createHash('sha256').update(wamid).digest('hex')});
 await db.query(`UPDATE coexistence.chat_history SET error_message = split_part(error_message, ' [Automatic retry', 1) || $2
   WHERE message_id=$1 AND status='failed'`, [wamid, ` [Automatic retry ${attempt+1}/${RETRY_DELAYS.length} scheduled in ${RETRY_DELAYS[attempt]/1000}s; do not resend manually.]`]);
 await require('../services/broadcastDelivery').syncBroadcastReceipt(db,wamid);
 return true;
}
module.exports={reserve,coolDown,remember,retryReceipt,RETRY_DELAYS};
