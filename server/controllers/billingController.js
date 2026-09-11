const crypto = require('crypto');
const paymentService = require('../services/paymentService');

function parseReference(value) {
  const match = String(value || '').match(/^(\d+):(\d+)$/);
  return match ? { organizationId: Number(match[1]), planId: Number(match[2]) } : null;
}

function signatureIsValid(req, dataId) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  const signature = req.get('x-signature');
  const requestId = req.get('x-request-id');
  if (!secret || !signature || !requestId || !dataId) return false;
  const values = Object.fromEntries(signature.split(',').map(value => value.trim().split('=')));
  const expected = crypto.createHmac('sha256', secret).update(`id:${dataId};request-id:${requestId};ts:${values.ts};`).digest('hex');
  const received = Buffer.from(values.v || '');
  const expectedBuffer = Buffer.from(expected);
  return received.length === expectedBuffer.length && crypto.timingSafeEqual(expectedBuffer, received);
}

async function checkout(req, res) {
  const database = req.app.locals.database;
  const organizationId = req.session.user.organization_id;
  const plan = await database.prepare('SELECT id, key, name, price_cents, currency FROM plans WHERE key = ?').get(String(req.body.plan_key || '').trim().toLowerCase());
  if (!plan) return res.status(400).json({ error: 'El plan seleccionado no existe.' });
  if (plan.key === 'free') {
    await database.prepare("UPDATE organizations SET plan_id = ?, subscription_status = 'active', current_period_end = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(plan.id, organizationId);
    return res.json({ redirect: null, ok: true });
  }
  const checkoutData = await paymentService.createSubscription({ plan, organizationId, payerEmail: req.session.user.email });
  if (!checkoutData.redirect) throw new Error('Mercado Pago no devolvió una URL de checkout.');
  await database.prepare("UPDATE organizations SET plan_id = ?, subscription_status = 'pending', current_period_end = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(plan.id, organizationId);
  res.json({ redirect: checkoutData.redirect, ok: true });
}

async function webhook(req, res) {
  let body;
  try { body = JSON.parse(req.body.toString('utf8')); } catch { return res.status(400).json({ error: 'El webhook no contiene JSON válido.' }); }
  const type = req.query.type || body.type || body.topic;
  const dataId = req.query['data.id'] || body.data?.id || body.id;
  if (!['preapproval', 'subscription_preapproval'].includes(type)) return res.status(400).json({ error: 'Tipo de notificación no soportado.' });
  if (!signatureIsValid(req, dataId)) return res.status(401).json({ error: 'Firma de webhook inválida.' });
  const details = await paymentService.getSubscription(dataId);
  const reference = parseReference(details.external_reference);
  if (!reference) return res.status(400).json({ error: 'Referencia externa inválida.' });
  let status = 'pending';
  let periodEnd = null;
  if (details.status === 'authorized') { status = 'active'; periodEnd = details.next_payment_date || null; }
  else if (details.status === 'cancelled') status = 'canceled';
  else if (['paused', 'rejected'].includes(details.status)) status = 'past_due';
  await req.app.locals.database.prepare('UPDATE organizations SET plan_id = ?, subscription_status = ?, current_period_end = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(reference.planId, status, periodEnd, reference.organizationId);
  res.sendStatus(200);
}

async function status(req, res) {
  const result = await req.app.locals.database.prepare(`SELECT plans.key AS plan_key, plans.name AS plan_name, plans.price_cents, plans.currency, organizations.subscription_status, organizations.current_period_end FROM organizations JOIN plans ON plans.id = organizations.plan_id WHERE organizations.id = ?`).get(req.session.user.organization_id);
  res.json(result);
}

module.exports = { checkout, webhook, status };