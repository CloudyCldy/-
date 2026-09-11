const { MercadoPagoConfig, PreApproval } = require('mercadopago');

function client() {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) throw new Error('MERCADOPAGO_ACCESS_TOKEN no está configurado.');
  return new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
}

function backUrl() {
  const value = process.env.MERCADOPAGO_BACK_URL || process.env.RENDER_EXTERNAL_URL || 'https://rwq70fnfjj.onrender.com';
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || ['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('MERCADOPAGO_BACK_URL debe ser una URL pública válida.');
  const normalized = url.toString().replace(/\/$/, '');
  return normalized.endsWith('/admin/billing') ? normalized : `${normalized}/admin/billing`;
}

async function createSubscription({ plan, organizationId, payerEmail }) {
  const testPayerEmail = String(process.env.MERCADOPAGO_TEST_PAYER_EMAIL || '').trim();
  const checkoutPayerEmail = testPayerEmail || payerEmail;
  if (!checkoutPayerEmail) throw new Error('Configura MERCADOPAGO_TEST_PAYER_EMAIL con el correo del usuario comprador de prueba de Mercado Pago.');
  const response = await new PreApproval(client()).create({ body: {
    reason: `Haitani - ${plan.name}`,
    external_reference: `${organizationId}:${plan.id}`,
    payer_email: checkoutPayerEmail,
    auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: plan.price_cents / 100, currency_id: plan.currency },
    back_url: backUrl(),
    status: 'pending'
  } });
  return { id: response.id, redirect: response.init_point || response.sandbox_init_point };
}

async function getSubscription(id) { return new PreApproval(client()).get({ id }); }

module.exports = { createSubscription, getSubscription };