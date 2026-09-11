const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

async function list(req, res) {
  const users = await req.app.locals.database.prepare(`SELECT id, name, username, email, role, role_id, active, github_username, profile_photo, created_at FROM users WHERE organization_id = ? ORDER BY name`).all(req.session.user.organization_id);
  res.json(users);
}
async function create(req, res) {
  const { name, username, email, password, github_username, active = 1 } = req.body;
  if (!name || !username || !email || !password) return res.status(400).json({ error: 'Nombre, usuario, correo y contraseña son obligatorios.' });
  try {
    const role = await req.app.locals.database.prepare("SELECT id FROM roles WHERE name = 'member'").get();
    const result = await req.app.locals.database.prepare(`INSERT INTO users (name, username, email, password, role, role_id, organization_id, active, github_username) VALUES (?, ?, ?, ?, 'member', ?, ?, ?, ?) RETURNING id`).run(name.trim(), username.trim(), email.trim(), await bcrypt.hash(password, 12), role.id, req.session.user.organization_id, active ? 1 : 0, github_username || null);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (error) { res.status(400).json({ error: error.code === '23505' ? 'El usuario o correo ya existe.' : error.message }); }
}
async function update(req, res) {
  const database = req.app.locals.database;
  const user = await database.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ? AND role <> ?').get(req.params.id, req.session.user.organization_id, 'admin');
  if (!user) return res.status(404).json({ error: 'El integrante no existe.' });
  const { name, username, email, password, github_username, active } = req.body;
  const duplicate = await database.prepare('SELECT username, email FROM users WHERE id != ? AND organization_id = ? AND (username = ? OR email = ?)').get(req.params.id, req.session.user.organization_id, username ?? '', email ?? '');
  if (duplicate) {
    if (duplicate.username === username) return res.status(409).json({ error: 'El nombre de usuario ya está registrado.' });
    return res.status(409).json({ error: 'El correo electrónico ya está registrado.' });
  }
  try {
    await database.prepare(`UPDATE users SET name = COALESCE(?, name), username = COALESCE(?, username), email = COALESCE(?, email), github_username = COALESCE(?, github_username), active = COALESCE(?, active), password = COALESCE(?, password), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`).run(name ?? null, username ?? null, email ?? null, github_username ?? null, active === undefined ? null : (active ? 1 : 0), password ? await bcrypt.hash(password, 12) : null, req.params.id, req.session.user.organization_id);
    res.json({ ok: true });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'El usuario o correo electrónico ya está registrado.' });
    throw error;
  }
}
async function profile(req, res) {
  const database = req.app.locals.database;
  const user = await database.prepare('SELECT id, password, profile_photo FROM users WHERE id = ?').get(req.session.user.id);
  if (!user) return res.status(404).json({ error: 'El usuario no existe.' });
  const { current_password, new_password } = req.body;
  if (new_password) {
    if (!current_password || !bcrypt.compareSync(String(current_password), user.password)) return res.status(400).json({ error: 'La contraseña actual no es correcta.' });
    if (String(new_password).length < 8) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
  }
  let profilePhoto = user.profile_photo;
  if (req.file) {
    profilePhoto = `/uploads/${req.file.filename}`;
    if (user.profile_photo) fs.unlink(path.join(__dirname, '..', '..', user.profile_photo.replace(/^\//, '')), () => {});
  }
  await database.prepare('UPDATE users SET password = COALESCE(?, password), profile_photo = COALESCE(?, profile_photo) WHERE id = ?').run(new_password ? await bcrypt.hash(String(new_password), 12) : null, req.file ? profilePhoto : null, user.id);
  req.session.user.profile_photo = profilePhoto;
  res.json({ ok: true, profile_photo: profilePhoto });
}
async function remove(req, res) {
  const result = await req.app.locals.database.prepare("DELETE FROM users WHERE id = ? AND organization_id = ? AND role <> 'admin'").run(req.params.id, req.session.user.organization_id);
  if (!result.changes) return res.status(404).json({ error: 'El integrante no existe.' });
  res.json({ ok: true });
}
module.exports = { list, create, update, profile, remove };