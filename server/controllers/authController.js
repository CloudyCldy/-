const bcrypt = require('bcryptjs');

async function planFor(database, organizationId) {
  const plan = await database.prepare(`
    SELECT plans.key, plans.name, plans.max_users, plans.max_projects,
           plans.max_storage_mb, plans.features, organizations.subscription_status
    FROM organizations JOIN plans ON plans.id = organizations.plan_id
    WHERE organizations.id = ?
  `).get(organizationId);
  const sandboxMode = String(process.env.SANDBOX_MODE || '').trim().toLowerCase() === 'true';
  if (!sandboxMode && ['pending', 'past_due'].includes(plan?.subscription_status)) return database.prepare(`
    SELECT plans.key, plans.name, plans.max_users, plans.max_projects,
           plans.max_storage_mb, plans.features, organizations.subscription_status
    FROM organizations JOIN plans ON plans.key = 'free'
    WHERE organizations.id = ?
  `).get(organizationId);
  return plan;
}

async function login(req, res) {
  const database = req.app.locals.database;
  const value = String(req.body.username || req.body.email || '').trim();
  const user = await database.prepare('SELECT * FROM users WHERE (username = ? OR email = ?) AND active = 1').get(value, value);
  if (!user || !bcrypt.compareSync(String(req.body.password || ''), user.password)) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  const { password, ...safeUser } = user;
  req.session.user = safeUser;
  res.json({ user: safeUser, plan: await planFor(database, safeUser.organization_id), redirect: safeUser.role === 'admin' ? '/admin/dashboard' : '/member/dashboard' });
}

async function me(req, res) {
  if (!req.session.user) return res.json({ user: null, plan: null });
  res.json({ user: req.session.user, plan: await planFor(req.app.locals.database, req.session.user.organization_id) });
}
function logout(req, res) { req.session.destroy(() => res.json({ ok: true })); }
module.exports = { login, me, logout };