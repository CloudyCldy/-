async function list(req, res) {
  const calls = await req.app.locals.database.prepare(`SELECT calls.id, calls.call_type, calls.status, calls.created_at, users.id AS caller_id, users.name AS caller_name, users.profile_photo AS caller_photo FROM calls JOIN users ON users.id = calls.caller_id WHERE calls.receiver_id = ? ORDER BY calls.created_at DESC LIMIT 30`).all(req.session.user.id);
  res.json(calls);
}

async function create(req, res) {
  const receiverId = Number(req.body.receiver_id);
  const callType = req.body.call_type === 'video' ? 'video' : 'audio';
  if (!Number.isInteger(receiverId) || receiverId < 1 || receiverId === req.session.user.id) return res.status(400).json({ error: 'El destinatario no es válido.' });
  const result = await req.app.locals.database.prepare('INSERT INTO calls (caller_id, receiver_id, call_type) VALUES (?, ?, ?) RETURNING id').run(req.session.user.id, receiverId, callType);
  res.status(201).json({ id: result.lastInsertRowid });
}

async function update(req, res) {
  const status = ['answered', 'missed'].includes(req.body.status) ? req.body.status : null;
  if (!status) return res.status(400).json({ error: 'Estado de llamada no válido.' });
  const result = await req.app.locals.database.prepare('UPDATE calls SET status = ? WHERE id = ? AND (caller_id = ? OR receiver_id = ?)').run(status, req.params.id, req.session.user.id, req.session.user.id);
  if (!result.changes) return res.status(404).json({ error: 'La llamada no existe.' });
  res.json({ ok: true });
}

module.exports = { list, create, update };