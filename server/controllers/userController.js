const bcrypt = require('bcrypt');

async function list(req, res) {
  const users = await req.app.locals.database.prepare(`SELECT id, name, username, email, role, active, github_username, created_at FROM users ORDER BY name`).all();
  res.json(users);
}
async function create(req, res) {
  const { name, username, email, password, github_username, active = 1 } = req.body;
  if (!name || !username || !email || !password) return res.status(400).json({ error: 'Nombre, usuario, correo y contraseña son obligatorios.' });
  try {
    const result = await req.app.locals.database.prepare(`INSERT INTO users (name, username, email, password, role, active, github_username) VALUES (?, ?, ?, ?, 'member', ?, ?) RETURNING id`).run(name.trim(), username.trim(), email.trim(), await bcrypt.hash(password, 12), active ? 1 : 0, github_username || null);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (error) { res.status(400).json({ error: error.code === '23505' ? 'El usuario o correo ya existe.' : error.message }); }
}
async function update(req, res) {
  const database = req.app.locals.database;
  const user = await database.prepare('SELECT id FROM users WHERE id = ? AND role = ?').get(req.params.id, 'member');
  if (!user) return res.status(404).json({ error: 'El integrante no existe.' });
  const { name, username, email, password, github_username, active } = req.body;
  const duplicate = await database.prepare('SELECT username, email FROM users WHERE id != ? AND (username = ? OR email = ?)').get(req.params.id, username ?? '', email ?? '');
  if (duplicate) {
    if (duplicate.username === username) return res.status(409).json({ error: 'El nombre de usuario ya está registrado.' });
    return res.status(409).json({ error: 'El correo electrónico ya está registrado.' });
  }
  try {
    await database.prepare(`UPDATE users SET name = COALESCE(?, name), username = COALESCE(?, username), email = COALESCE(?, email), github_username = COALESCE(?, github_username), active = COALESCE(?, active), password = COALESCE(?, password) WHERE id = ?`).run(name ?? null, username ?? null, email ?? null, github_username ?? null, active === undefined ? null : (active ? 1 : 0), password ? await bcrypt.hash(password, 12) : null, req.params.id);
    res.json({ ok: true });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'El usuario o correo electrónico ya está registrado.' });
    throw error;
  }
}
async function remove(req, res) {
  const result = await req.app.locals.database.prepare("DELETE FROM users WHERE id = ? AND role = 'member'").run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'El integrante no existe.' });
  res.json({ ok: true });
}
module.exports = { list, create, update, remove };