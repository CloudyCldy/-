const fs = require('fs');
const path = require('path');

async function list(req, res) { res.json(await req.app.locals.database.prepare(`SELECT files.*, users.name AS uploader_name FROM files JOIN users ON users.id = files.uploaded_by WHERE files.organization_id = ? ORDER BY files.created_at DESC`).all(req.session.user.organization_id)); }
async function upload(req, res) {
  if (!req.file) return res.status(400).json({ error: 'Selecciona un archivo.' });
  const result = await req.app.locals.database.prepare(`INSERT INTO files (filename, original_name, path, mime_type, size, uploaded_by, organization_id) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`).run(req.file.filename, req.file.originalname, req.file.path, req.file.mimetype, req.file.size, req.session.user.id, req.session.user.organization_id);
  res.status(201).json({ id: result.lastInsertRowid });
}
async function download(req, res) {
  const file = await req.app.locals.database.prepare('SELECT * FROM files WHERE id = ? AND organization_id = ?').get(req.params.id, req.session.user.organization_id);
  if (!file || !fs.existsSync(file.path)) return res.status(404).json({ error: 'El archivo no existe.' });
  res.download(file.path, file.original_name);
}
async function view(req, res) {
  const file = await req.app.locals.database.prepare('SELECT * FROM files WHERE id = ? AND organization_id = ?').get(req.params.id, req.session.user.organization_id);
  if (!file || !fs.existsSync(file.path)) return res.status(404).json({ error: 'El archivo no existe.' });
  res.type(file.mime_type);
  res.setHeader('Content-Disposition', `inline; filename="${file.original_name.replace(/["\r\n]/g, '')}"`);
  res.sendFile(path.resolve(file.path));
}
async function remove(req, res) {
  const database = req.app.locals.database;
  const file = await database.prepare('SELECT * FROM files WHERE id = ? AND organization_id = ?').get(req.params.id, req.session.user.organization_id);
  if (!file) return res.status(404).json({ error: 'El archivo no existe.' });
  if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
  await database.prepare('DELETE FROM files WHERE id = ? AND organization_id = ?').run(req.params.id, req.session.user.organization_id);
  res.json({ ok: true });
}
module.exports = { list, upload, download, view, remove };