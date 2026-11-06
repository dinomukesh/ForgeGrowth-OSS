// Reconcile from the authoritative chat receipt, including late failures.
async function syncBroadcastReceipt(db, wamid) {
  await db.query(`UPDATE coexistence.broadcast_logs b
    SET status=c.status, error_message=c.error_message
    FROM coexistence.chat_history c
    WHERE b.wa_message_id=$1 AND c.message_id=b.wa_message_id
      AND c.status IN ('sent','delivered','read','failed')`, [wamid]);
}
module.exports={syncBroadcastReceipt};
