function userId(req, res) {
  const id = Number(req.query.user_id || req.body.user_id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: 'Selecciona un usuario válido.' });
    return null;
  }
  return id;
}

async function ensureAttachment(database, req, content, mimeType, fileName) {
  if (!req.file && !req.body.attachment_id) return null;
  if (req.body.attachment_id) {
    const file = await database.prepare('SELECT id, original_name, mime_type FROM files WHERE id = ? AND organization_id = ?').get(Number(req.body.attachment_id), req.session.user.organization_id);
    if (!file) throw new Error('El documento adjunto no existe.');
    return { id: file.id, name: file.original_name, mime: file.mime_type };
  }
  const file = req.file;
  const stored = await database.prepare(`INSERT INTO files (filename, original_name, path, mime_type, size, uploaded_by, organization_id, content) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`).run(file.filename || `${Date.now()}-${Math.random().toString(16).slice(2)}`, file.originalname, '', file.mimetype, file.size, req.session.user.id, req.session.user.organization_id, file.buffer);
  return { id: stored.lastInsertRowid, name: file.originalname, mime: file.mimetype };
}

async function list(req, res) {
  const otherId = userId(req, res);
  if (!otherId) return;
  const currentId = req.session.user.id;
  if (otherId === currentId) return res.status(400).json({ error: 'No puedes abrir una conversación contigo mismo.' });
  await req.app.locals.database.prepare("UPDATE messages SET delivery_status = 'leido', read_at = CURRENT_TIMESTAMP WHERE organization_id = ? AND receiver_id = ? AND sender_id = ? AND delivery_status <> 'leido'").run(req.session.user.organization_id, currentId, otherId);
  const messages = await req.app.locals.database.prepare(`SELECT messages.id, messages.content, messages.created_at, messages.sender_id, messages.delivery_status, messages.attachment_id, messages.attachment_name, messages.attachment_mime, users.name AS sender_name, users.profile_photo AS sender_photo FROM messages JOIN users ON users.id = messages.sender_id WHERE messages.organization_id = ? AND messages.conversation_type = 'direct' AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)) AND messages.created_at > COALESCE((SELECT deleted_at FROM conversation_deletions WHERE organization_id = ? AND user_id = ? AND other_user_id = ?), 'epoch') ORDER BY messages.created_at`).all(req.session.user.organization_id, currentId, otherId, otherId, currentId, req.session.user.organization_id, currentId, otherId);
  res.json(messages);
}

async function create(req, res) {
  const receiverId = userId(req, res);
  if (!receiverId) return;
  const content = String(req.body.content || '').trim();
  if (!content && !req.file && !req.body.attachment_id) return res.status(400).json({ error: 'Escribe un mensaje o adjunta un documento.' });
  if (receiverId === req.session.user.id) return res.status(400).json({ error: 'No puedes enviarte mensajes a ti mismo.' });
  const receiver = await req.app.locals.database.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ? AND active = 1').get(receiverId, req.session.user.organization_id);
  if (!receiver) return res.status(404).json({ error: 'El usuario no existe o está inactivo.' });
  const attachment = await ensureAttachment(req.app.locals.database, req, content, req.file?.mimetype, req.file?.originalname).catch(error => { throw error; });
  const result = await req.app.locals.database.prepare('INSERT INTO messages (sender_id, receiver_id, organization_id, content, delivery_status, conversation_type, attachment_id, attachment_name, attachment_mime) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id').run(req.session.user.id, receiverId, req.session.user.organization_id, content.slice(0, 2000) || '', 'enviado', 'direct', attachment?.id || null, attachment?.name || null, attachment?.mime || null);
  res.status(201).json({ id: result.lastInsertRowid, attachment: attachment || null });
}

async function listGroups(req, res) {
  const groups = await req.app.locals.database.prepare(`
    SELECT g.id, g.name, g.created_at,
           COUNT(members.user_id)::integer AS members_count,
           (SELECT COUNT(*)::integer FROM messages WHERE organization_id = ? AND conversation_type = 'group' AND group_id = g.id) AS messages_count,
           (SELECT MAX(created_at) FROM messages WHERE organization_id = ? AND conversation_type = 'group' AND group_id = g.id) AS last_message_at
    FROM chat_groups g
    LEFT JOIN chat_group_members members ON members.group_id = g.id AND members.organization_id = ?
    WHERE g.organization_id = ?
    GROUP BY g.id, g.name, g.created_at
    ORDER BY g.created_at DESC
  `).all(req.session.user.organization_id, req.session.user.organization_id, req.session.user.organization_id, req.session.user.organization_id);
  res.json(groups);
}

async function getGroup(req, res) {
  const groupId = Number(req.params.groupId);
  const group = await req.app.locals.database.prepare('SELECT * FROM chat_groups WHERE id = ? AND organization_id = ?').get(groupId, req.session.user.organization_id);
  if (!group) return res.status(404).json({ error: 'El grupo no existe.' });
  const members = await req.app.locals.database.prepare('SELECT u.id, u.name, u.username, u.email, u.profile_photo, u.last_seen_at, gm.role FROM chat_group_members gm JOIN users u ON u.id = gm.user_id WHERE gm.group_id = ? AND gm.organization_id = ? ORDER BY u.name').all(groupId, req.session.user.organization_id);
  const messages = await req.app.locals.database.prepare(`SELECT m.id, m.content, m.created_at, m.sender_id, m.delivery_status, m.attachment_id, m.attachment_name, m.attachment_mime, u.name AS sender_name, u.profile_photo AS sender_photo FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.organization_id = ? AND m.conversation_type = 'group' AND m.group_id = ? ORDER BY m.created_at`).all(req.session.user.organization_id, groupId);
  res.json({ group, members, messages });
}

async function createGroup(req, res) {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'El nombre del grupo es obligatorio.' });
  const memberIds = Array.isArray(req.body.members) ? req.body.members.map(Number).filter(value => Number.isInteger(value) && value > 0) : [];
  const uniqueIds = [...new Set(memberIds)];
  const result = await req.app.locals.database.prepare('INSERT INTO chat_groups (organization_id, name, created_by) VALUES (?, ?, ?) RETURNING id').run(req.session.user.organization_id, name.slice(0, 80), req.session.user.id);
  const groupId = result.lastInsertRowid;
  const membersToInsert = uniqueIds.includes(req.session.user.id) ? uniqueIds : [...uniqueIds, req.session.user.id];
  if (membersToInsert.length) {
    const values = membersToInsert.map(id => `(${groupId}, ${id}, ${req.session.user.organization_id}, 'member')`).join(', ');
    await req.app.locals.database.prepare(`INSERT INTO chat_group_members (group_id, user_id, organization_id, role) VALUES ${values} ON CONFLICT (group_id, user_id) DO NOTHING`).run();
  }
  await req.app.locals.database.prepare('INSERT INTO chat_group_members (group_id, user_id, organization_id, role) VALUES (?, ?, ?, ?) ON CONFLICT (group_id, user_id) DO NOTHING').run(groupId, req.session.user.id, req.session.user.organization_id, 'admin');
  res.status(201).json({ id: groupId, name });
}

async function addGroupMember(req, res) {
  const groupId = Number(req.params.groupId);
  const userId = Number(req.body.user_id);
  if (!groupId || !userId) return res.status(400).json({ error: 'Selecciona un usuario válido.' });
  const member = await req.app.locals.database.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ? AND active = 1').get(userId, req.session.user.organization_id);
  if (!member) return res.status(404).json({ error: 'El usuario no existe o está inactivo.' });
  await req.app.locals.database.prepare('INSERT INTO chat_group_members (group_id, user_id, organization_id, role) VALUES (?, ?, ?, ?) ON CONFLICT (group_id, user_id) DO NOTHING').run(groupId, userId, req.session.user.organization_id, 'member');
  res.status(201).json({ ok: true });
}

async function sendGroupMessage(req, res) {
  const groupId = Number(req.params.groupId);
  const group = await req.app.locals.database.prepare('SELECT id FROM chat_groups WHERE id = ? AND organization_id = ?').get(groupId, req.session.user.organization_id);
  if (!group) return res.status(404).json({ error: 'El grupo no existe.' });
  const isMember = await req.app.locals.database.prepare('SELECT 1 FROM chat_group_members WHERE group_id = ? AND user_id = ? AND organization_id = ?').get(groupId, req.session.user.id, req.session.user.organization_id);
  if (!isMember) return res.status(403).json({ error: 'No tienes acceso a este grupo.' });
  const content = String(req.body.content || '').trim();
  if (!content && !req.file && !req.body.attachment_id) return res.status(400).json({ error: 'Escribe un mensaje o adjunta un documento.' });
  const attachment = await ensureAttachment(req.app.locals.database, req, content, req.file?.mimetype, req.file?.originalname).catch(error => { throw error; });
  const result = await req.app.locals.database.prepare('INSERT INTO messages (sender_id, receiver_id, organization_id, content, delivery_status, conversation_type, group_id, attachment_id, attachment_name, attachment_mime) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id').run(req.session.user.id, 0, req.session.user.organization_id, content.slice(0, 2000) || '', 'enviado', 'group', groupId, attachment?.id || null, attachment?.name || null, attachment?.mime || null);
  res.status(201).json({ id: result.lastInsertRowid, attachment: attachment || null });
}

async function removeConversation(req, res) {
  const otherId = Number(req.params.userId);
  if (!Number.isInteger(otherId) || otherId < 1) return res.status(400).json({ error: 'La conversación no es válida.' });
  await req.app.locals.database.prepare(`INSERT INTO conversation_deletions (organization_id, user_id, other_user_id) VALUES (?, ?, ?) ON CONFLICT (user_id, other_user_id) DO UPDATE SET deleted_at = CURRENT_TIMESTAMP`).run(req.session.user.organization_id, req.session.user.id, otherId);
  res.json({ ok: true });
}

module.exports = { list, create, listGroups, getGroup, createGroup, addGroupMember, sendGroupMessage, removeConversation };