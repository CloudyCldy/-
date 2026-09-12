async function upload(req, res) {
  if (!req.file) return res.status(400).json({ error: 'Selecciona una imagen para el fondo.' });
  const result = await req.app.locals.database.prepare('INSERT INTO stored_assets (organization_id, uploaded_by, kind, mime_type, content) VALUES (?, ?, ?, ?, ?) RETURNING id').run(req.session.user.organization_id, req.session.user.id, 'chat-background', req.file.mimetype, req.file.buffer);
  res.status(201).json({ url: `/api/chat-backgrounds/${result.lastInsertRowid}` });
}

async function get(req, res) {
  const asset = await req.app.locals.database.prepare('SELECT mime_type, content FROM stored_assets WHERE id = ? AND organization_id = ? AND kind = ?').get(req.params.id, req.session.user.organization_id, 'chat-background');
  if (!asset) return res.status(404).json({ error: 'El fondo no existe.' });
  res.type(asset.mime_type).send(asset.content);
}

module.exports = { upload, get };