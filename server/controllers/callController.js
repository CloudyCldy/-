async function list(req, res) {
  const calls = await req.app.locals.database.prepare(`
    SELECT calls.id, calls.call_type, calls.status, calls.scheduled_at, calls.created_at,
           calls.caller_id, calls.receiver_id, users.name AS caller_name, users.profile_photo AS caller_photo,
           CASE WHEN calls.caller_id = ? THEN 'outgoing' ELSE 'incoming' END AS direction,
           CASE
             WHEN calls.status = 'answered' THEN 'realizada'
             WHEN calls.status = 'missed' THEN 'perdida'
             WHEN calls.status = 'scheduled' THEN 'programada'
             ELSE 'iniciada'
           END AS status_label
    FROM calls
    JOIN users ON users.id = calls.caller_id
    WHERE calls.organization_id = ? AND (calls.caller_id = ? OR calls.receiver_id = ?)
    ORDER BY calls.created_at DESC LIMIT 60
  `).all(req.session.user.id, req.session.user.organization_id, req.session.user.id, req.session.user.id);
  res.json(calls);
}

async function create(req, res) {
  const receiverId = Number(req.body.receiver_id);
  const callType = req.body.call_type === 'video' ? 'video' : 'audio';
  if (!Number.isInteger(receiverId) || receiverId < 1 || receiverId === req.session.user.id) return res.status(400).json({ error: 'El destinatario no es válido.' });
  const scheduledAt = req.body.scheduled_at ? new Date(req.body.scheduled_at) : null;
  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) return res.status(400).json({ error: 'La fecha de llamada no es válida.' });
  const receiver = await req.app.locals.database.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ? AND active = 1').get(receiverId, req.session.user.organization_id);
  if (!receiver) return res.status(404).json({ error: 'El destinatario no existe en tu organización.' });
  const result = await req.app.locals.database.prepare('INSERT INTO calls (caller_id, receiver_id, organization_id, call_type, status, scheduled_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id').run(req.session.user.id, receiverId, req.session.user.organization_id, callType, scheduledAt ? 'scheduled' : 'initiated', scheduledAt);
  res.status(201).json({ id: result.lastInsertRowid });
}

async function update(req, res) {
  const status = ['answered', 'missed'].includes(req.body.status) ? req.body.status : null;
  if (!status) return res.status(400).json({ error: 'Estado de llamada no válido.' });
  const result = await req.app.locals.database.prepare('UPDATE calls SET status = ? WHERE id = ? AND organization_id = ? AND (caller_id = ? OR receiver_id = ?)').run(status, req.params.id, req.session.user.organization_id, req.session.user.id, req.session.user.id);
  if (!result.changes) return res.status(404).json({ error: 'La llamada no existe.' });
  res.json({ ok: true });
}

module.exports = { list, create, update };