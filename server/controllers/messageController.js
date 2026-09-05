function userId(req, res) {
  const id = Number(req.query.user_id || req.body.user_id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: 'Selecciona un usuario válido.' });
    return null;
  }
  return id;
}

async function list(req, res) {
  const otherId = userId(req, res);
  if (!otherId) return;
  const currentId = req.session.user.id;
  if (otherId === currentId) return res.status(400).json({ error: 'No puedes abrir una conversación contigo mismo.' });
  const messages = await req.app.locals.database.prepare(`SELECT messages.id, messages.content, messages.created_at, messages.sender_id, users.name AS sender_name, users.profile_photo AS sender_photo FROM messages JOIN users ON users.id = messages.sender_id WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) ORDER BY messages.created_at`).all(currentId, otherId, otherId, currentId);
  res.json(messages);
}

async function create(req, res) {
  const receiverId = userId(req, res);
  if (!receiverId) return;
  const content = String(req.body.content || '').trim();
  if (!content) return res.status(400).json({ error: 'Escribe un mensaje.' });
  if (receiverId === req.session.user.id) return res.status(400).json({ error: 'No puedes enviarte mensajes a ti mismo.' });
  const receiver = await req.app.locals.database.prepare('SELECT id FROM users WHERE id = ? AND active = 1').get(receiverId);
  if (!receiver) return res.status(404).json({ error: 'El usuario no existe o está inactivo.' });
  const result = await req.app.locals.database.prepare('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?) RETURNING id').run(req.session.user.id, receiverId, content.slice(0, 2000));
  res.status(201).json({ id: result.lastInsertRowid });
}

module.exports = { list, create };