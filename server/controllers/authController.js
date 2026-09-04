const bcrypt = require('bcrypt');

async function login(req, res) {
  const database = req.app.locals.database;
  const value = String(req.body.username || req.body.email || '').trim();
  const user = await database.prepare('SELECT * FROM users WHERE (username = ? OR email = ?) AND active = 1').get(value, value);
  if (!user || !bcrypt.compareSync(String(req.body.password || ''), user.password)) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  const { password, ...safeUser } = user;
  req.session.user = safeUser;
  res.json({ user: safeUser, redirect: safeUser.role === 'admin' ? '/admin/dashboard' : '/member/dashboard' });
}

function me(req, res) { res.json({ user: req.session.user || null }); }
function logout(req, res) { req.session.destroy(() => res.json({ ok: true })); }
module.exports = { login, me, logout };