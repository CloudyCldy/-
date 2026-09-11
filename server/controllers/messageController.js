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
  await req.app.locals.database.prepare("UPDATE messages SET delivery_status = 'leido', read_at = CURRENT_TIMESTAMP WHERE organization_id = ? AND receiver_id = ? AND sender_id = ? AND delivery_status <> 'leido'").run(req.session.user.organization_id, currentId, otherId);
  const messages = await req.app.locals.database.prepare(`SELECT messages.id, messages.content, messages.created_at, messages.sender_id, messages.delivery_status, users.name AS sender_name, users.profile_photo AS sender_photo FROM messages JOIN users ON users.id = messages.sender_id WHERE messages.organization_id = ? AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)) AND messages.created_at > COALESCE((SELECT deleted_at FROM conversation_deletions WHERE organization_id = ? AND user_id = ? AND other_user_id = ?), 'epoch') ORDER BY messages.created_at`).all(req.session.user.organization_id, currentId, otherId, otherId, currentId, req.session.user.organization_id, currentId, otherId);
  res.json(messages);
}

async function create(req, res) {
  const receiverId = userId(req, res);
  if (!receiverId) return;
  const content = String(req.body.content || '').trim();
  if (!content) return res.status(400).json({ error: 'Escribe un mensaje.' });
  if (receiverId === req.session.user.id) return res.status(400).json({ error: 'No puedes enviarte mensajes a ti mismo.' });
  const receiver = await req.app.locals.database.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ? AND active = 1').get(receiverId, req.session.user.organization_id);
  if (!receiver) return res.status(404).json({ error: 'El usuario no existe o está inactivo.' });
  const result = await req.app.locals.database.prepare('INSERT INTO messages (sender_id, receiver_id, organization_id, content, delivery_status) VALUES (?, ?, ?, ?, ?) RETURNING id').run(req.session.user.id, receiverId, req.session.user.organization_id, content.slice(0, 2000), 'enviado');
  res.status(201).json({ id: result.lastInsertRowid });
}

async function removeConversation(req, res) {
  const otherId = Number(req.params.userId);
  if (!Number.isInteger(otherId) || otherId < 1) return res.status(400).json({ error: 'La conversación no es válida.' });
  await req.app.locals.database.prepare(`INSERT INTO conversation_deletions (organization_id, user_id, other_user_id) VALUES (?, ?, ?) ON CONFLICT (user_id, other_user_id) DO UPDATE SET deleted_at = CURRENT_TIMESTAMP`).run(req.session.user.organization_id, req.session.user.id, otherId);
  res.json({ ok: true });
}

module.exports = { list, create, removeConversation };