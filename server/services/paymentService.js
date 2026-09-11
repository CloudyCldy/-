const { MercadoPagoConfig, PreApproval } = require('mercadopago');

function client() {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) throw new Error('MERCADOPAGO_ACCESS_TOKEN no está configurado.');
  return new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
}

async function createSubscription({ plan, organizationId, payerEmail }) {
  const response = await new PreApproval(client()).create({ body: {
    reason: `Haitani - ${plan.name}`,
    external_reference: `${organizationId}:${plan.id}`,
    payer_email: payerEmail,
    auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: plan.price_cents / 100, currency_id: plan.currency },
    back_url: process.env.MERCADOPAGO_BACK_URL || 'http://localhost:3000/admin/billing',
    status: 'pending'
  } });
  return { id: response.id, redirect: response.init_point || response.sandbox_init_point };
}

async function getSubscription(id) { return new PreApproval(client()).get({ id }); }

module.exports = { createSubscription, getSubscription };