// Convert Meta components into the representation used by the composer/sender.
function fromMeta(r) {
  const components = r.components;
  if (!Array.isArray(components)) throw new Error(`Template ${r.name}: missing components`);
  const find = type => components.find(c => c.type === type);
  const header = find('HEADER');
  const body = find('BODY');
  const footer = find('FOOTER');
  const carousel = find('CAROUSEL');
  if (!body) throw new Error(`Template ${r.name}: missing body`);
  function buttons(items = []) {
    return items.map(b => ({ ...b, value: b.url || b.phone_number || b.example?.[0] || '',
      urlSample: b.type === 'URL' ? b.example?.[0] || '' : '',
      otpType: b.otp_type, packageName: b.package_name, signatureHash: b.signature_hash }));
  }
  const samples = {};
  (body.example?.body_text?.[0] || []).forEach((value, i) => { samples[String(i + 1)] = value; });
  for (const item of body.example?.body_text_named_params || []) samples[item.param_name] = item.example;
  const headerType = header?.format || 'NONE';
  if (!['NONE','TEXT','IMAGE','VIDEO','DOCUMENT'].includes(headerType)) throw new Error(`Template ${r.name}: unsupported header ${headerType}`);
  return {
    headerType, headerText: header?.text || null, mediaHandle: header?.example?.header_handle?.[0] || null,
    body: body.text || '', footer: footer?.text || null, buttons: buttons(find('BUTTONS')?.buttons), samples,
    security: !!body.add_security_recommendation, expiry: footer?.code_expiration_minutes || null,
    type: carousel ? 'CAROUSEL' : 'STANDARD', cards: (carousel?.cards || []).map(card => {
      const h = card.components?.find(c => c.type === 'HEADER');
      return { header_type: h?.format, header_handle: h?.example?.header_handle?.[0] || null,
        body: card.components?.find(c => c.type === 'BODY')?.text || '',
        buttons: buttons(card.components?.find(c => c.type === 'BUTTONS')?.buttons) };
    }),
  };
}

async function importMissing(client, accountId, r, status) {
  const d = fromMeta(r);
  await client.query(`INSERT INTO coexistence.message_templates
    (name,category,language,whatsapp_account_id,status,meta_template_id,header_type,header_text,
     media_handle,body,footer,buttons,samples,security_recommendation,code_expiry_minutes,
     template_type,carousel_cards,template_group_key,quality_score,rejection_reason,last_synced_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW())`,
  [r.name,r.category,r.language,accountId,status,r.id,d.headerType,d.headerText,d.mediaHandle,
    d.body,d.footer,JSON.stringify(d.buttons),JSON.stringify(d.samples),d.security,d.expiry,d.type,
    JSON.stringify(d.cards),r.name.toLowerCase(),typeof r.quality_score === 'object' ? r.quality_score?.score : r.quality_score || null,r.rejected_reason || null]);
}
module.exports = { fromMeta, importMissing };
