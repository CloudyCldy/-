const bcrypt = require('bcryptjs');

async function list(req, res) {
  const users = await req.app.locals.database.prepare(`SELECT id, name, username, email, role, role_id, active, github_username, gitlab_username, profile_photo, last_seen_at, created_at FROM users WHERE organization_id = ? ORDER BY name`).all(req.session.user.organization_id);
  res.json(users);
}
async function create(req, res) {
  const { name, username, email, password, github_username, gitlab_username, active = 1 } = req.body;
  if (!name || !username || !email || !password) return res.status(400).json({ error: 'Nombre, usuario, correo y contraseña son obligatorios.' });
  try {
    const role = await req.app.locals.database.prepare("SELECT id FROM roles WHERE name = 'member'").get();
    const result = await req.app.locals.database.prepare(`INSERT INTO users (name, username, email, password, role, role_id, organization_id, active, github_username, gitlab_username) VALUES (?, ?, ?, ?, 'member', ?, ?, ?, ?, ?) RETURNING id`).run(name.trim(), username.trim(), email.trim(), await bcrypt.hash(password, 12), role.id, req.session.user.organization_id, active ? 1 : 0, github_username || null, gitlab_username || null);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (error) { res.status(400).json({ error: error.code === '23505' ? 'El usuario o correo ya existe.' : error.message }); }
}
async function update(req, res) {
  const database = req.app.locals.database;
  const user = await database.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ? AND role <> ?').get(req.params.id, req.session.user.organization_id, 'admin');
  if (!user) return res.status(404).json({ error: 'El integrante no existe.' });
  const { name, username, email, password, github_username, gitlab_username, active } = req.body;
  const duplicate = await database.prepare('SELECT username, email FROM users WHERE id != ? AND organization_id = ? AND (username = ? OR email = ?)').get(req.params.id, req.session.user.organization_id, username ?? '', email ?? '');
  if (duplicate) {
    if (duplicate.username === username) return res.status(409).json({ error: 'El nombre de usuario ya está registrado.' });
    return res.status(409).json({ error: 'El correo electrónico ya está registrado.' });
  }
  try {
    await database.prepare(`UPDATE users SET name = COALESCE(?, name), username = COALESCE(?, username), email = COALESCE(?, email), github_username = COALESCE(?, github_username), gitlab_username = COALESCE(?, gitlab_username), active = COALESCE(?, active), password = COALESCE(?, password), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`).run(name ?? null, username ?? null, email ?? null, github_username ?? null, gitlab_username ?? null, active === undefined ? null : (active ? 1 : 0), password ? await bcrypt.hash(password, 12) : null, req.params.id, req.session.user.organization_id);
    res.json({ ok: true });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'El usuario o correo electrónico ya está registrado.' });
    throw error;
  }
}
async function profile(req, res) {
  const database = req.app.locals.database;
  const user = await database.prepare('SELECT id, name, username, email, password, profile_photo, profile_asset_id FROM users WHERE id = ? AND organization_id = ?').get(req.session.user.id, req.session.user.organization_id);
  if (!user) return res.status(404).json({ error: 'El usuario no existe.' });
  const { name, username, email, current_password, new_password, gitlab_username, gitlab_token } = req.body;
  const nextName = name === undefined ? user.name : String(name).trim();
  const nextUsername = username === undefined ? user.username : String(username).trim();
  const nextEmail = email === undefined ? user.email : String(email).trim().toLowerCase();
  if (!nextName || !nextUsername || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) return res.status(400).json({ error: 'Nombre, usuario y correo son obligatorios y válidos.' });
  const duplicate = await database.prepare('SELECT id FROM users WHERE organization_id = ? AND id <> ? AND (username = ? OR email = ?)').get(req.session.user.organization_id, user.id, nextUsername, nextEmail);
  if (duplicate) return res.status(409).json({ error: 'El usuario o correo ya está registrado en tu organización.' });
  if (new_password) {
    if (!current_password || !bcrypt.compareSync(String(current_password), user.password)) return res.status(400).json({ error: 'La contraseña actual no es correcta.' });
    if (String(new_password).length < 8) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
  }
  let profilePhoto = user.profile_photo;
  let profileAssetId = user.profile_asset_id;
  if (req.file) {
    const asset = await database.prepare('INSERT INTO stored_assets (organization_id, uploaded_by, kind, mime_type, content) VALUES (?, ?, ?, ?, ?) RETURNING id').run(req.session.user.organization_id, req.session.user.id, 'profile-photo', req.file.mimetype, req.file.buffer);
    profileAssetId = asset.lastInsertRowid;
    profilePhoto = `/api/users/${req.session.user.id}/profile-photo?v=${encodeURIComponent(profileAssetId)}`;
  }
  await database.prepare('UPDATE users SET name = ?, username = ?, email = ?, password = COALESCE(?, password), profile_photo = COALESCE(?, profile_photo), profile_asset_id = COALESCE(?, profile_asset_id), gitlab_username = COALESCE(?, gitlab_username), gitlab_token = COALESCE(?, gitlab_token), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?').run(nextName, nextUsername, nextEmail, new_password ? await bcrypt.hash(String(new_password), 12) : null, req.file ? profilePhoto : null, req.file ? profileAssetId : null, gitlab_username !== undefined ? String(gitlab_username || '').trim() || null : null, gitlab_token !== undefined ? String(gitlab_token || '').trim() || null : null, user.id, req.session.user.organization_id);
  req.session.user.name = nextName;
  req.session.user.username = nextUsername;
  req.session.user.email = nextEmail;
  req.session.user.profile_photo = profilePhoto;
  req.session.user.gitlab_username = gitlab_username !== undefined ? String(gitlab_username || '').trim() || null : req.session.user.gitlab_username;
  res.json({ ok: true, name: nextName, username: nextUsername, email: nextEmail, profile_photo: profilePhoto, gitlab_username: req.session.user.gitlab_username });
}
async function profilePhoto(req, res) {
  const asset = await req.app.locals.database.prepare('SELECT stored_assets.mime_type, stored_assets.content FROM stored_assets JOIN users ON users.profile_asset_id = stored_assets.id WHERE users.id = ? AND users.organization_id = ? AND stored_assets.kind = ?').get(req.params.id, req.session.user.organization_id, 'profile-photo');
  if (!asset) return res.status(404).end();
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  res.type(asset.mime_type).send(asset.content);
}
async function remove(req, res) {
  const result = await req.app.locals.database.prepare("DELETE FROM users WHERE id = ? AND organization_id = ? AND role <> 'admin'").run(req.params.id, req.session.user.organization_id);
  if (!result.changes) return res.status(404).json({ error: 'El integrante no existe.' });
  res.json({ ok: true });
}
module.exports = { list, create, update, profile, profilePhoto, remove };