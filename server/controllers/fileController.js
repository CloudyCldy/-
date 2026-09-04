const fs = require('fs');
const path = require('path');

function list(req, res) { res.json(req.app.locals.database.prepare(`SELECT files.*, users.name AS uploader_name FROM files JOIN users ON users.id = files.uploaded_by ORDER BY files.created_at DESC`).all()); }
function upload(req, res) {
  if (!req.file) return res.status(400).json({ error: 'Selecciona un archivo.' });
  const result = req.app.locals.database.prepare(`INSERT INTO files (filename, original_name, path, mime_type, size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)`).run(req.file.filename, req.file.originalname, req.file.path, req.file.mimetype, req.file.size, req.session.user.id);
  res.status(201).json({ id: result.lastInsertRowid });
}
function download(req, res) {
  const file = req.app.locals.database.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (!file || !fs.existsSync(file.path)) return res.status(404).json({ error: 'El archivo no existe.' });
  res.download(file.path, file.original_name);
}
function remove(req, res) {
  const database = req.app.locals.database;
  const file = database.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (!file) return res.status(404).json({ error: 'El archivo no existe.' });
  if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
  database.prepare('DELETE FROM files WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}
module.exports = { list, upload, download, remove };