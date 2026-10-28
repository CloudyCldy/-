function parseId(val) {
  const num = Number(val);
  return Number.isInteger(num) && num > 0 ? num : null;
}

async function ensureAttachment(database, req) {
  if (!req.file && !req.body.attachment_id) return null;
  const orgId = req.session.user.organization_id;

  if (req.body.attachment_id) {
    const fileId = Number(req.body.attachment_id);
    const file = await database.prepare(
      'SELECT id, original_name, mime_type, size FROM files WHERE id = ? AND organization_id = ?'
    ).get(fileId, orgId);
    if (!file) throw new Error('El documento adjunto no existe o no pertenece a tu organización.');
    return { id: file.id, name: file.original_name, mime: file.mime_type, size: file.size };
  }

  const file = req.file;
  const filename = file.filename || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const stored = await database.prepare(`
    INSERT INTO files (filename, original_name, path, mime_type, size, uploaded_by, organization_id, content)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id
  `).run(
    filename,
    file.originalname,
    '',
    file.mimetype,
    file.size,
    req.session.user.id,
    orgId,
    file.buffer
  );

  return {
    id: stored.lastInsertRowid,
    name: file.originalname,
    mime: file.mimetype,
    size: file.size
  };
}

function detectMessageType(attachment, requestedType) {
  if (attachment?.mime) {
    if (attachment.mime.startsWith('image/')) return 'image';
    if (attachment.mime.startsWith('audio/')) return 'audio';
    return 'file';
  }
  if (['text', 'image', 'file', 'audio', 'system'].includes(requestedType)) {
    return requestedType;
  }
  return 'text';
}

async function getReactionsMap(database, messageIds) {
  if (!messageIds.length) return new Map();
  const placeholders = messageIds.map(() => '?').join(', ');
  const rows = await database.prepare(`
    SELECT r.message_id, r.reaction, r.user_id, u.name as user_name
    FROM message_reactions r
    JOIN users u ON u.id = r.user_id
    WHERE r.message_id IN (${placeholders})
    ORDER BY r.created_at
  `).all(...messageIds);

  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.message_id)) map.set(row.message_id, []);
    map.get(row.message_id).push({
      reaction: row.reaction,
      user_id: row.user_id,
      user_name: row.user_name
    });
  }
  return map;
}

async function getReplyMap(database, orgId, replyIds) {
  if (!replyIds.length) return new Map();
  const placeholders = replyIds.map(() => '?').join(', ');
  const rows = await database.prepare(`
    SELECT m.id, m.content, m.sender_id, m.is_deleted, m.message_type, u.name as sender_name
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.id IN (${placeholders}) AND m.organization_id = ?
  `).all(...replyIds, orgId);

  const map = new Map();
  for (const row of rows) {
    map.set(row.id, {
      id: row.id,
      sender_id: row.sender_id,
      sender_name: row.sender_name,
      content: row.is_deleted ? 'Mensaje eliminado' : (row.content ? row.content.slice(0, 120) : 'Archivo adjunto'),
      message_type: row.message_type
    });
  }
  return map;
}

// -------------------------------------------------------------
// 1. Listado unificado de conversaciones (panel izquierdo)
// -------------------------------------------------------------
async function listConversations(req, res) {
  const currentId = req.session.user.id;
  const orgId = req.session.user.organization_id;
  const wsHub = req.app.locals.wsHub;

  // Direct conversations: contactos activos de la organización
  const users = await req.app.locals.database.prepare(`
    SELECT u.id, u.name, u.username, u.email, u.profile_photo, u.role, u.last_seen_at,
           cp.is_muted, cp.is_archived, cp.is_pinned
    FROM users u
    LEFT JOIN conversation_preferences cp ON cp.user_id = ? AND cp.organization_id = ? AND cp.conversation_type = 'direct' AND cp.target_id = u.id
    WHERE u.organization_id = ? AND u.active = 1 AND u.id <> ?
    ORDER BY u.name
  `).all(currentId, orgId, orgId, currentId);

  // Unread counts per direct contact
  const directUnreads = await req.app.locals.database.prepare(`
    SELECT sender_id, COUNT(*)::integer AS unread_count
    FROM messages
    WHERE organization_id = ? AND receiver_id = ? AND delivery_status <> 'leido' AND is_deleted = false
      AND created_at > COALESCE((SELECT deleted_at FROM conversation_deletions WHERE organization_id = ? AND user_id = ? AND other_user_id = messages.sender_id), 'epoch')
    GROUP BY sender_id
  `).all(orgId, currentId, orgId, currentId);
  const directUnreadMap = new Map(directUnreads.map(r => [r.sender_id, r.unread_count]));

  // Last messages per direct contact
  const directLastMsgs = await req.app.locals.database.prepare(`
    SELECT DISTINCT ON (partner_id)
      partner_id, id, content, created_at, sender_id, delivery_status, message_type, is_deleted
    FROM (
      SELECT CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS partner_id,
             id, content, created_at, sender_id, delivery_status, message_type, is_deleted
      FROM messages
      WHERE organization_id = ? AND conversation_type = 'direct'
        AND ((sender_id = ? AND receiver_id IS NOT NULL) OR (receiver_id = ? AND sender_id IS NOT NULL))
        AND created_at > COALESCE((SELECT deleted_at FROM conversation_deletions WHERE organization_id = ? AND user_id = ? AND other_user_id = (CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END)), 'epoch')
      ORDER BY partner_id, created_at DESC
    ) sub
  `).all(currentId, orgId, currentId, currentId, orgId, currentId, currentId);
  const directLastMsgMap = new Map(directLastMsgs.map(m => [m.partner_id, m]));

  const directList = users.map(user => {
    const lastMsg = directLastMsgMap.get(user.id);
    const isOnline = wsHub ? wsHub.isUserOnline(user.id) : false;
    return {
      type: 'direct',
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      profile_photo: user.profile_photo,
      role: user.role,
      online: isOnline,
      last_seen_at: user.last_seen_at,
      unread_count: directUnreadMap.get(user.id) || 0,
      is_muted: !!user.is_muted,
      is_archived: !!user.is_archived,
      is_pinned: !!user.is_pinned,
      last_message: lastMsg ? {
        id: lastMsg.id,
        content: lastMsg.is_deleted ? 'Mensaje eliminado' : lastMsg.content,
        created_at: lastMsg.created_at,
        sender_id: lastMsg.sender_id,
        delivery_status: lastMsg.delivery_status,
        message_type: lastMsg.message_type
      } : null
    };
  });

  // Group conversations: grupos donde el usuario es miembro (o todos si platform/company admin)
  const isPlatformOrCompanyAdmin = ['platform_admin', 'company_admin', 'admin'].includes(req.session.user.role);
  let groupsQuery = `
    SELECT g.id, g.name, g.description, g.avatar_url, g.project_id, g.created_at, g.created_by,
           p.name AS project_name,
           gm.role AS my_role, gm.last_read_at,
           COUNT(DISTINCT all_m.user_id)::integer AS members_count,
           cp.is_muted, cp.is_archived, cp.is_pinned
    FROM chat_groups g
    JOIN chat_group_members gm ON gm.group_id = g.id AND gm.user_id = ? AND gm.organization_id = ?
    LEFT JOIN projects p ON p.id = g.project_id AND p.organization_id = ?
    LEFT JOIN chat_group_members all_m ON all_m.group_id = g.id AND all_m.organization_id = ?
    LEFT JOIN conversation_preferences cp ON cp.user_id = ? AND cp.organization_id = ? AND cp.conversation_type = 'group' AND cp.target_id = g.id
    WHERE g.organization_id = ?
    GROUP BY g.id, g.name, g.description, g.avatar_url, g.project_id, g.created_at, g.created_by, p.name, gm.role, gm.last_read_at, cp.is_muted, cp.is_archived, cp.is_pinned
    ORDER BY g.created_at DESC
  `;
  const groups = await req.app.locals.database.prepare(groupsQuery).all(
    currentId, orgId, orgId, orgId, currentId, orgId, orgId
  );

  // Group last messages and unread counts
  const groupIds = groups.map(g => g.id);
  const groupLastMsgMap = new Map();
  const groupUnreadMap = new Map();

  if (groupIds.length) {
    const placeholders = groupIds.map(() => '?').join(', ');
    const lastGroupMsgs = await req.app.locals.database.prepare(`
      SELECT DISTINCT ON (group_id)
        group_id, m.id, m.content, m.created_at, m.sender_id, m.message_type, m.is_deleted, u.name as sender_name
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.organization_id = ? AND m.conversation_type = 'group' AND m.group_id IN (${placeholders})
      ORDER BY group_id, m.created_at DESC
    `).all(orgId, ...groupIds);
    for (const m of lastGroupMsgs) groupLastMsgMap.set(m.group_id, m);

    for (const g of groups) {
      const lastRead = g.last_read_at || 'epoch';
      const unreadRow = await req.app.locals.database.prepare(`
        SELECT COUNT(*)::integer as count FROM messages
        WHERE organization_id = ? AND conversation_type = 'group' AND group_id = ?
          AND created_at > ? AND sender_id <> ? AND is_deleted = false
      `).get(orgId, g.id, lastRead, currentId);
      groupUnreadMap.set(g.id, unreadRow?.count || 0);
    }
  }

  const groupList = groups.map(group => {
    const lastMsg = groupLastMsgMap.get(group.id);
    return {
      type: 'group',
      id: group.id,
      name: group.name,
      description: group.description,
      avatar_url: group.avatar_url,
      project_id: group.project_id,
      project_name: group.project_name,
      members_count: group.members_count,
      my_role: group.my_role,
      unread_count: groupUnreadMap.get(group.id) || 0,
      is_muted: !!group.is_muted,
      is_archived: !!group.is_archived,
      is_pinned: !!group.is_pinned,
      last_message: lastMsg ? {
        id: lastMsg.id,
        content: lastMsg.is_deleted ? 'Mensaje eliminado' : lastMsg.content,
        created_at: lastMsg.created_at,
        sender_id: lastMsg.sender_id,
        sender_name: lastMsg.sender_name,
        message_type: lastMsg.message_type
      } : null
    };
  });

  const totalUnread = [...directUnreadMap.values(), ...groupUnreadMap.values()].reduce((a, b) => a + b, 0);

  res.json({
    direct: directList,
    groups: groupList,
    total_unread: totalUnread
  });
}

// -------------------------------------------------------------
// 2. Historial de mensajes en chat activo con paginación
// -------------------------------------------------------------
async function list(req, res) {
  const currentId = req.session.user.id;
  const orgId = req.session.user.organization_id;
  const wsHub = req.app.locals.wsHub;

  const targetUserId = parseId(req.query.user_id);
  const groupId = parseId(req.query.group_id);
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const beforeId = parseId(req.query.before_id);

  if (!targetUserId && !groupId) {
    return res.status(400).json({ error: 'Especifica user_id o group_id para obtener los mensajes.' });
  }

  let messages = [];

  if (targetUserId) {
    if (targetUserId === currentId) {
      return res.status(400).json({ error: 'No puedes abrir una conversación contigo mismo.' });
    }
    const targetUser = await req.app.locals.database.prepare(
      'SELECT id, name, username, email, profile_photo, last_seen_at FROM users WHERE id = ? AND organization_id = ? AND active = 1'
    ).get(targetUserId, orgId);
    if (!targetUser) return res.status(404).json({ error: 'El usuario no existe o está inactivo.' });

    // Actualizar lectura de mensajes entrantes
    await req.app.locals.database.prepare(`
      UPDATE messages
      SET delivery_status = 'leido', read_at = CURRENT_TIMESTAMP
      WHERE organization_id = ? AND receiver_id = ? AND sender_id = ? AND delivery_status <> 'leido'
    `).run(orgId, currentId, targetUserId);

    if (wsHub) {
      wsHub.broadcastToUser(orgId, targetUserId, {
        type: 'message:read',
        conversationType: 'direct',
        readerId: currentId,
        targetId: currentId
      });
    }

    let query = `
      SELECT m.id, m.content, m.created_at, m.sender_id, m.receiver_id, m.delivery_status, m.read_at,
             m.attachment_id, m.attachment_name, m.attachment_mime, m.conversation_type,
             m.edited_at, m.is_deleted, m.reply_to_id, m.client_message_id, m.message_type,
             m.is_pinned, m.pinned_at, m.pinned_by,
             u.name AS sender_name, u.profile_photo AS sender_photo
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.organization_id = ? AND m.conversation_type = 'direct'
        AND ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))
        AND m.created_at > COALESCE((SELECT deleted_at FROM conversation_deletions WHERE organization_id = ? AND user_id = ? AND other_user_id = ?), 'epoch')
    `;
    const params = [orgId, currentId, targetUserId, targetUserId, currentId, orgId, currentId, targetUserId];

    if (beforeId) {
      query += ` AND m.id < ?`;
      params.push(beforeId);
    }
    query += ` ORDER BY m.created_at DESC, m.id DESC LIMIT ?`;
    params.push(limit);

    messages = await req.app.locals.database.prepare(query).all(...params);
  } else if (groupId) {
    const isMember = await req.app.locals.database.prepare(
      'SELECT role FROM chat_group_members WHERE group_id = ? AND user_id = ? AND organization_id = ?'
    ).get(groupId, currentId, orgId);
    if (!isMember) return res.status(403).json({ error: 'No perteneces a este grupo o no tienes acceso.' });

    // Actualizar última lectura del miembro
    await req.app.locals.database.prepare(
      'UPDATE chat_group_members SET last_read_at = CURRENT_TIMESTAMP WHERE group_id = ? AND user_id = ? AND organization_id = ?'
    ).run(groupId, currentId, orgId);

    let query = `
      SELECT m.id, m.content, m.created_at, m.sender_id, m.group_id, m.delivery_status,
             m.attachment_id, m.attachment_name, m.attachment_mime, m.conversation_type,
             m.edited_at, m.is_deleted, m.reply_to_id, m.client_message_id, m.message_type,
             m.is_pinned, m.pinned_at, m.pinned_by,
             u.name AS sender_name, u.profile_photo AS sender_photo
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.organization_id = ? AND m.conversation_type = 'group' AND m.group_id = ?
    `;
    const params = [orgId, groupId];

    if (beforeId) {
      query += ` AND m.id < ?`;
      params.push(beforeId);
    }
    query += ` ORDER BY m.created_at DESC, m.id DESC LIMIT ?`;
    params.push(limit);

    messages = await req.app.locals.database.prepare(query).all(...params);
  }

  // Orden cronológico (ascendente) para la interfaz
  messages.reverse();

  // Enriquecer con reacciones y citas
  const messageIds = messages.map(m => m.id);
  const replyIds = [...new Set(messages.map(m => m.reply_to_id).filter(Boolean))];

  const [reactionsMap, replyMap] = await Promise.all([
    getReactionsMap(req.app.locals.database, messageIds),
    getReplyMap(req.app.locals.database, orgId, replyIds)
  ]);

  const enriched = messages.map(m => {
    const rawReactions = reactionsMap.get(m.id) || [];
    // Agrupar reacciones por emoji
    const reactionGroups = new Map();
    for (const r of rawReactions) {
      if (!reactionGroups.has(r.reaction)) {
        reactionGroups.set(r.reaction, { reaction: r.reaction, count: 0, users: [], me: false });
      }
      const group = reactionGroups.get(r.reaction);
      group.count++;
      group.users.push(r.user_name);
      if (r.user_id === currentId) group.me = true;
    }

    return {
      ...m,
      is_mine: m.sender_id === currentId,
      content: m.is_deleted ? 'Mensaje eliminado' : m.content,
      attachment_url: m.attachment_id ? `/api/files/${m.attachment_id}/download` : null,
      reactions: Array.from(reactionGroups.values()),
      reply_to: m.reply_to_id ? replyMap.get(m.reply_to_id) || null : null
    };
  });

  res.json({
    messages: enriched,
    has_more: messages.length === limit
  });
}

// -------------------------------------------------------------
// 3. Envío de mensaje directo (con idempotencia y WebSockets)
// -------------------------------------------------------------
async function create(req, res) {
  const currentId = req.session.user.id;
  const orgId = req.session.user.organization_id;
  const wsHub = req.app.locals.wsHub;

  const receiverId = parseId(req.body.user_id || req.body.receiver_id || req.query.user_id);
  if (!receiverId) return res.status(400).json({ error: 'Selecciona un usuario válido.' });
  if (receiverId === currentId) return res.status(400).json({ error: 'No puedes enviarte mensajes a ti mismo.' });

  const receiver = await req.app.locals.database.prepare(
    'SELECT id, name FROM users WHERE id = ? AND organization_id = ? AND active = 1'
  ).get(receiverId, orgId);
  if (!receiver) return res.status(404).json({ error: 'El usuario no existe o está inactivo.' });

  const clientMsgId = req.body.client_message_id ? String(req.body.client_message_id).slice(0, 100) : null;

  // Idempotencia: evitar duplicados por reintentos
  if (clientMsgId) {
    const existing = await req.app.locals.database.prepare(
      'SELECT id FROM messages WHERE organization_id = ? AND sender_id = ? AND client_message_id = ?'
    ).get(orgId, currentId, clientMsgId);
    if (existing) {
      return res.status(200).json({ id: existing.id, idempotent: true, message: existing });
    }
  }

  let content = String(req.body.content || '').trim();
  const attachment = await ensureAttachment(req.app.locals.database, req).catch(err => {
    res.status(400).json({ error: err.message });
    return null;
  });
  if (res.headersSent) return;

  if (!content && !attachment) {
    return res.status(400).json({ error: 'Escribe un mensaje o adjunta un archivo.' });
  }

  const replyToId = parseId(req.body.reply_to_id);
  const messageType = detectMessageType(attachment, req.body.message_type);

  // Determinar estado inicial según presencia real
  const isReceiverOnline = wsHub ? wsHub.isUserOnline(receiverId) : false;
  const deliveryStatus = isReceiverOnline ? 'entregado' : 'enviado';

  const result = await req.app.locals.database.prepare(`
    INSERT INTO messages (
      sender_id, receiver_id, organization_id, content, delivery_status,
      conversation_type, attachment_id, attachment_name, attachment_mime,
      reply_to_id, client_message_id, message_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id, created_at
  `).run(
    currentId,
    receiverId,
    orgId,
    content.slice(0, 4000),
    deliveryStatus,
    'direct',
    attachment?.id || null,
    attachment?.name || null,
    attachment?.mime || null,
    replyToId,
    clientMsgId,
    messageType
  );

  const messageId = result.lastInsertRowid;

  // Construir mensaje enriquecido para respuesta y emisión
  let replyObj = null;
  if (replyToId) {
    const replyMap = await getReplyMap(req.app.locals.database, orgId, [replyToId]);
    replyObj = replyMap.get(replyToId) || null;
  }

  const fullMessage = {
    id: messageId,
    sender_id: currentId,
    receiver_id: receiverId,
    sender_name: req.session.user.name,
    sender_photo: req.session.user.profile_photo || null,
    content,
    delivery_status: deliveryStatus,
    conversation_type: 'direct',
    attachment_id: attachment?.id || null,
    attachment_name: attachment?.name || null,
    attachment_mime: attachment?.mime || null,
    attachment_url: attachment?.id ? `/api/files/${attachment.id}/download` : null,
    created_at: new Date().toISOString(),
    is_mine: false,
    reactions: [],
    reply_to_id: replyToId,
    reply_to: replyObj,
    client_message_id: clientMsgId,
    message_type: messageType
  };

  // Notificar al destinatario y a otras sesiones del remitente
  if (wsHub) {
    wsHub.broadcastToUser(orgId, receiverId, { type: 'message:new', message: fullMessage });
    wsHub.broadcastToUser(orgId, currentId, { type: 'message:new', message: { ...fullMessage, is_mine: true } });
  }

  res.status(201).json({ ...fullMessage, message: fullMessage, is_mine: true });
}

// -------------------------------------------------------------
// 4. Envío de mensaje en grupo
// -------------------------------------------------------------
async function sendGroupMessage(req, res) {
  const currentId = req.session.user.id;
  const orgId = req.session.user.organization_id;
  const wsHub = req.app.locals.wsHub;

  const groupId = parseId(req.params.groupId);
  if (!groupId) return res.status(400).json({ error: 'Grupo inválido.' });

  const isMember = await req.app.locals.database.prepare(
    'SELECT role FROM chat_group_members WHERE group_id = ? AND user_id = ? AND organization_id = ?'
  ).get(groupId, currentId, orgId);
  if (!isMember) return res.status(403).json({ error: 'No perteneces a este grupo o no tienes acceso.' });

  const clientMsgId = req.body.client_message_id ? String(req.body.client_message_id).slice(0, 100) : null;
  if (clientMsgId) {
    const existing = await req.app.locals.database.prepare(
      'SELECT id FROM messages WHERE organization_id = ? AND sender_id = ? AND client_message_id = ?'
    ).get(orgId, currentId, clientMsgId);
    if (existing) {
      return res.status(200).json({ id: existing.id, idempotent: true });
    }
  }

  let content = String(req.body.content || '').trim();
  const attachment = await ensureAttachment(req.app.locals.database, req).catch(err => {
    res.status(400).json({ error: err.message });
    return null;
  });
  if (res.headersSent) return;

  if (!content && !attachment) {
    return res.status(400).json({ error: 'Escribe un mensaje o adjunta un archivo.' });
  }

  const replyToId = parseId(req.body.reply_to_id);
  const messageType = detectMessageType(attachment, req.body.message_type);

  const result = await req.app.locals.database.prepare(`
    INSERT INTO messages (
      sender_id, receiver_id, organization_id, content, delivery_status,
      conversation_type, group_id, attachment_id, attachment_name, attachment_mime,
      reply_to_id, client_message_id, message_type
    ) VALUES (?, NULL, ?, ?, 'enviado', 'group', ?, ?, ?, ?, ?, ?, ?) RETURNING id, created_at
  `).run(
    currentId,
    orgId,
    content.slice(0, 4000),
    groupId,
    attachment?.id || null,
    attachment?.name || null,
    attachment?.mime || null,
    replyToId,
    clientMsgId,
    messageType
  );

  const messageId = result.lastInsertRowid;

  // Actualizar última lectura del autor
  await req.app.locals.database.prepare(
    'UPDATE chat_group_members SET last_read_at = CURRENT_TIMESTAMP WHERE group_id = ? AND user_id = ?'
  ).run(groupId, currentId);

  let replyObj = null;
  if (replyToId) {
    const replyMap = await getReplyMap(req.app.locals.database, orgId, [replyToId]);
    replyObj = replyMap.get(replyToId) || null;
  }

  const fullMessage = {
    id: messageId,
    sender_id: currentId,
    sender_name: req.session.user.name,
    sender_photo: req.session.user.profile_photo || null,
    group_id: groupId,
    content,
    delivery_status: 'enviado',
    conversation_type: 'group',
    attachment_id: attachment?.id || null,
    attachment_name: attachment?.name || null,
    attachment_mime: attachment?.mime || null,
    attachment_url: attachment?.id ? `/api/files/${attachment.id}/download` : null,
    created_at: new Date().toISOString(),
    is_mine: false,
    reactions: [],
    reply_to_id: replyToId,
    reply_to: replyObj,
    client_message_id: clientMsgId,
    message_type: messageType
  };

  if (wsHub) {
    wsHub.broadcastToGroup(orgId, groupId, { type: 'message:new', message: fullMessage });
  }

  res.status(201).json({ ...fullMessage, message: fullMessage, is_mine: true });
}

// -------------------------------------------------------------
// 5. Edición de mensaje propio
// -------------------------------------------------------------
async function editMessage(req, res) {
  const currentId = req.session.user.id;
  const orgId = req.session.user.organization_id;
  const messageId = parseId(req.params.id);
  const content = String(req.body.content || '').trim();

  if (!messageId || !content) {
    return res.status(400).json({ error: 'Mensaje o contenido inválido.' });
  }

  const msg = await req.app.locals.database.prepare(
    'SELECT * FROM messages WHERE id = ? AND organization_id = ?'
  ).get(messageId, orgId);

  if (!msg) return res.status(404).json({ error: 'Mensaje no encontrado.' });
  if (msg.sender_id !== currentId) {
    return res.status(403).json({ error: 'Solo puedes editar tus propios mensajes.' });
  }
  if (msg.is_deleted) {
    return res.status(400).json({ error: 'No es posible editar un mensaje eliminado.' });
  }

  await req.app.locals.database.prepare(
    'UPDATE messages SET content = ?, edited_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(content.slice(0, 4000), messageId);

  const editedAt = new Date().toISOString();
  const payload = {
    type: 'message:edit',
    messageId,
    content,
    edited_at: editedAt,
    conversationType: msg.conversation_type,
    targetId: msg.conversation_type === 'direct' ? msg.receiver_id : msg.group_id
  };

  const wsHub = req.app.locals.wsHub;
  if (wsHub) {
    if (msg.conversation_type === 'direct') {
      wsHub.broadcastToUser(orgId, msg.receiver_id, payload);
      wsHub.broadcastToUser(orgId, msg.sender_id, payload);
    } else {
      wsHub.broadcastToGroup(orgId, msg.group_id, payload);
    }
  }

  res.json({ ok: true, id: messageId, content, edited_at: editedAt, message: { id: messageId, content, edited_at: editedAt } });
}

// -------------------------------------------------------------
// 6. Eliminación de mensaje (Soft delete)
// -------------------------------------------------------------
async function deleteMessage(req, res) {
  const currentId = req.session.user.id;
  const orgId = req.session.user.organization_id;
  const messageId = parseId(req.params.id);

  if (!messageId) return res.status(400).json({ error: 'Mensaje inválido.' });

  const msg = await req.app.locals.database.prepare(
    'SELECT * FROM messages WHERE id = ? AND organization_id = ?'
  ).get(messageId, orgId);

  if (!msg) return res.status(404).json({ error: 'Mensaje no encontrado.' });

  const isPlatformOrCompanyAdmin = ['platform_admin', 'company_admin', 'admin'].includes(req.session.user.role);
  let canDelete = msg.sender_id === currentId || isPlatformOrCompanyAdmin;

  if (!canDelete && msg.conversation_type === 'group') {
    const myGroupRole = await req.app.locals.database.prepare(
      'SELECT role FROM chat_group_members WHERE group_id = ? AND user_id = ?'
    ).get(msg.group_id, currentId);
    if (myGroupRole?.role === 'admin') canDelete = true;
  }

  if (!canDelete) {
    return res.status(403).json({ error: 'No tienes permiso para eliminar este mensaje.' });
  }

  await req.app.locals.database.prepare(`
    UPDATE messages
    SET is_deleted = true, content = '[Mensaje eliminado]', attachment_id = NULL
    WHERE id = ?
  `).run(messageId);

  const payload = {
    type: 'message:delete',
    messageId,
    conversationType: msg.conversation_type,
    targetId: msg.conversation_type === 'direct' ? msg.receiver_id : msg.group_id
  };

  const wsHub = req.app.locals.wsHub;
  if (wsHub) {
    if (msg.conversation_type === 'direct') {
      wsHub.broadcastToUser(orgId, msg.receiver_id, payload);
      wsHub.broadcastToUser(orgId, msg.sender_id, payload);
    } else {
      wsHub.broadcastToGroup(orgId, msg.group_id, payload);
    }
  }

  res.json({ ok: true, id: messageId, is_deleted: true });
}

// -------------------------------------------------------------
// 7. Reacciones con emojis (toggle)
// -------------------------------------------------------------
async function toggleReaction(req, res) {
  const currentId = req.session.user.id;
  const orgId = req.session.user.organization_id;
  const messageId = parseId(req.params.id);
  const reaction = String(req.body.reaction || '').trim();

  if (!messageId || !reaction || reaction.length > 10) {
    return res.status(400).json({ error: 'Reacción o mensaje inválido.' });
  }

  const msg = await req.app.locals.database.prepare(
    'SELECT id, conversation_type, receiver_id, sender_id, group_id FROM messages WHERE id = ? AND organization_id = ?'
  ).get(messageId, orgId);

  if (!msg) return res.status(404).json({ error: 'Mensaje no encontrado.' });

  // Validar pertenencia a la conversación
  if (msg.conversation_type === 'direct' && msg.sender_id !== currentId && msg.receiver_id !== currentId) {
    return res.status(403).json({ error: 'No puedes reaccionar a este mensaje.' });
  }
  if (msg.conversation_type === 'group') {
    const isMember = await req.app.locals.database.prepare(
      'SELECT 1 FROM chat_group_members WHERE group_id = ? AND user_id = ?'
    ).get(msg.group_id, currentId);
    if (!isMember) return res.status(403).json({ error: 'No eres miembro de este grupo.' });
  }

  // Comprobar si ya reaccionó con este emoji
  const existing = await req.app.locals.database.prepare(
    'SELECT id FROM message_reactions WHERE message_id = ? AND user_id = ? AND reaction = ?'
  ).get(messageId, currentId, reaction);

  let action = 'added';
  if (existing) {
    await req.app.locals.database.prepare(
      'DELETE FROM message_reactions WHERE id = ?'
    ).run(existing.id);
    action = 'removed';
  } else {
    await req.app.locals.database.prepare(
      'INSERT INTO message_reactions (message_id, user_id, reaction) VALUES (?, ?, ?)'
    ).run(messageId, currentId, reaction);
  }

  // Obtener reacciones actualizadas para el mensaje
  const reactionsMap = await getReactionsMap(req.app.locals.database, [messageId]);
  const rawReactions = reactionsMap.get(messageId) || [];
  const reactionGroups = new Map();
  for (const r of rawReactions) {
    if (!reactionGroups.has(r.reaction)) {
      reactionGroups.set(r.reaction, { reaction: r.reaction, count: 0, users: [], me: false });
    }
    const g = reactionGroups.get(r.reaction);
    g.count++;
    g.users.push(r.user_name);
    if (r.user_id === currentId) g.me = true;
  }
  const updatedReactions = Array.from(reactionGroups.values());

  const payload = {
    type: 'message:reaction',
    messageId,
    action,
    reaction,
    reactions: updatedReactions
  };

  const wsHub = req.app.locals.wsHub;
  if (wsHub) {
    if (msg.conversation_type === 'direct') {
      wsHub.broadcastToUser(orgId, msg.receiver_id, payload);
      wsHub.broadcastToUser(orgId, msg.sender_id, payload);
    } else {
      wsHub.broadcastToGroup(orgId, msg.group_id, payload);
    }
  }

  res.json({ ok: true, action, reactions: updatedReactions });
}

// -------------------------------------------------------------
// 8. Fijar / Desfijar mensaje (Pin)
// -------------------------------------------------------------
async function togglePin(req, res) {
  const currentId = req.session.user.id;
  const orgId = req.session.user.organization_id;
  const messageId = parseId(req.params.id);

  if (!messageId) return res.status(400).json({ error: 'Mensaje inválido.' });

  const msg = await req.app.locals.database.prepare(
    'SELECT id, is_pinned, conversation_type, receiver_id, sender_id, group_id FROM messages WHERE id = ? AND organization_id = ?'
  ).get(messageId, orgId);

  if (!msg) return res.status(404).json({ error: 'Mensaje no encontrado.' });

  const newPinned = !msg.is_pinned;
  await req.app.locals.database.prepare(`
    UPDATE messages
    SET is_pinned = ?, pinned_at = ?, pinned_by = ?
    WHERE id = ?
  `).run(
    newPinned,
    newPinned ? new Date().toISOString() : null,
    newPinned ? currentId : null,
    messageId
  );

  const payload = {
    type: 'message:pin',
    messageId,
    is_pinned: newPinned,
    pinned_by: newPinned ? currentId : null
  };

  const wsHub = req.app.locals.wsHub;
  if (wsHub) {
    if (msg.conversation_type === 'direct') {
      wsHub.broadcastToUser(orgId, msg.receiver_id, payload);
      wsHub.broadcastToUser(orgId, msg.sender_id, payload);
    } else {
      wsHub.broadcastToGroup(orgId, msg.group_id, payload);
    }
  }

  res.json({ ok: true, is_pinned: newPinned });
}

// -------------------------------------------------------------
// 9. Mensajes fijados de una conversación
// -------------------------------------------------------------
async function getPinnedMessages(req, res) {
  const currentId = req.session.user.id;
  const orgId = req.session.user.organization_id;
  const targetUserId = parseId(req.query.user_id);
  const groupId = parseId(req.query.group_id);

  let query = '';
  let params = [];

  if (targetUserId) {
    query = `
      SELECT m.id, m.content, m.created_at, m.sender_id, m.is_pinned, m.pinned_at,
             u.name as sender_name, u.profile_photo as sender_photo
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.organization_id = ? AND m.conversation_type = 'direct'
        AND ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))
        AND m.is_pinned = true AND m.is_deleted = false
      ORDER BY m.pinned_at DESC
    `;
    params = [orgId, currentId, targetUserId, targetUserId, currentId];
  } else if (groupId) {
    query = `
      SELECT m.id, m.content, m.created_at, m.sender_id, m.is_pinned, m.pinned_at,
             u.name as sender_name, u.profile_photo as sender_photo
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.organization_id = ? AND m.conversation_type = 'group' AND m.group_id = ?
        AND m.is_pinned = true AND m.is_deleted = false
      ORDER BY m.pinned_at DESC
    `;
    params = [orgId, groupId];
  } else {
    return res.status(400).json({ error: 'Especifica user_id o group_id.' });
  }

  const pinned = await req.app.locals.database.prepare(query).all(...params);
  res.json(pinned);
}

// -------------------------------------------------------------
// 10. Búsqueda de mensajes dentro de la organización
// -------------------------------------------------------------
async function search(req, res) {
  const currentId = req.session.user.id;
  const orgId = req.session.user.organization_id;
  const term = String(req.query.q || '').trim();
  const targetUserId = parseId(req.query.user_id);
  const groupId = parseId(req.query.group_id);

  if (!term || term.length < 2) {
    return res.status(400).json({ error: 'Ingresa al menos 2 caracteres para buscar.' });
  }

  const searchPattern = `%${term}%`;
  let query = `
    SELECT m.id, m.content, m.created_at, m.sender_id, m.receiver_id, m.group_id,
           m.conversation_type, u.name as sender_name, u.profile_photo as sender_photo
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.organization_id = ? AND m.is_deleted = false AND m.content ILIKE ?
  `;
  const params = [orgId, searchPattern];

  if (targetUserId) {
    query += ` AND m.conversation_type = 'direct' AND ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))`;
    params.push(currentId, targetUserId, targetUserId, currentId);
  } else if (groupId) {
    query += ` AND m.conversation_type = 'group' AND m.group_id = ?`;
    params.push(groupId);
  } else {
    // Búsqueda global del usuario en chats donde participa
    query += `
      AND (
        (m.conversation_type = 'direct' AND (m.sender_id = ? OR m.receiver_id = ?))
        OR (m.conversation_type = 'group' AND m.group_id IN (SELECT group_id FROM chat_group_members WHERE user_id = ?))
      )
    `;
    params.push(currentId, currentId, currentId);
  }

  query += ` ORDER BY m.created_at DESC LIMIT 30`;

  const results = await req.app.locals.database.prepare(query).all(...params);
  res.json(results);
}

// -------------------------------------------------------------
// 11. Preferencias de conversación (silenciar, archivar, fijar)
// -------------------------------------------------------------
async function updatePreferences(req, res) {
  const currentId = req.session.user.id;
  const orgId = req.session.user.organization_id;

  const conversationType = req.body.conversation_type === 'group' ? 'group' : 'direct';
  const targetId = parseId(req.body.target_id);

  if (!targetId) return res.status(400).json({ error: 'Identificador de conversación inválido.' });

  const isMuted = Boolean(req.body.is_muted);
  const isArchived = Boolean(req.body.is_archived);
  const isPinned = Boolean(req.body.is_pinned);

  await req.app.locals.database.prepare(`
    INSERT INTO conversation_preferences (user_id, organization_id, conversation_type, target_id, is_muted, is_archived, is_pinned, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id, conversation_type, target_id)
    DO UPDATE SET is_muted = EXCLUDED.is_muted, is_archived = EXCLUDED.is_archived, is_pinned = EXCLUDED.is_pinned, updated_at = CURRENT_TIMESTAMP
  `).run(currentId, orgId, conversationType, targetId, isMuted, isArchived, isPinned);

  res.json({ ok: true, conversation_type: conversationType, target_id: targetId, is_muted: isMuted, is_archived: isArchived, is_pinned: isPinned });
}

// -------------------------------------------------------------
// 12. Archivos compartidos en la conversación
// -------------------------------------------------------------
async function getSharedFiles(req, res) {
  const currentId = req.session.user.id;
  const orgId = req.session.user.organization_id;
  const targetUserId = parseId(req.query.user_id);
  const groupId = parseId(req.query.group_id);

  let query = '';
  let params = [];

  if (targetUserId) {
    query = `
      SELECT m.id, m.attachment_id, m.attachment_name, m.attachment_mime, m.created_at, m.message_type,
             f.size, u.name as sender_name
      FROM messages m
      JOIN files f ON f.id = m.attachment_id
      JOIN users u ON u.id = m.sender_id
      WHERE m.organization_id = ? AND m.conversation_type = 'direct'
        AND ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))
        AND m.attachment_id IS NOT NULL AND m.is_deleted = false
      ORDER BY m.created_at DESC
    `;
    params = [orgId, currentId, targetUserId, targetUserId, currentId];
  } else if (groupId) {
    query = `
      SELECT m.id, m.attachment_id, m.attachment_name, m.attachment_mime, m.created_at, m.message_type,
             f.size, u.name as sender_name
      FROM messages m
      JOIN files f ON f.id = m.attachment_id
      JOIN users u ON u.id = m.sender_id
      WHERE m.organization_id = ? AND m.conversation_type = 'group' AND m.group_id = ?
        AND m.attachment_id IS NOT NULL AND m.is_deleted = false
      ORDER BY m.created_at DESC
    `;
    params = [orgId, groupId];
  } else {
    return res.status(400).json({ error: 'Especifica user_id o group_id.' });
  }

  const files = await req.app.locals.database.prepare(query).all(...params);
  const formatted = files.map(f => ({
    ...f,
    download_url: `/api/files/${f.attachment_id}/download`
  }));
  res.json(formatted);
}

// -------------------------------------------------------------
// 13. Gestión avanzada de Grupos
// -------------------------------------------------------------
async function listGroups(req, res) {
  const currentId = req.session.user.id;
  const orgId = req.session.user.organization_id;

  const groups = await req.app.locals.database.prepare(`
    SELECT g.id, g.name, g.description, g.avatar_url, g.project_id, g.created_at, g.created_by,
           p.name AS project_name,
           COUNT(DISTINCT m.user_id)::integer AS members_count,
           (SELECT COUNT(*)::integer FROM messages WHERE organization_id = ? AND conversation_type = 'group' AND group_id = g.id AND is_deleted = false) AS messages_count,
           (SELECT MAX(created_at) FROM messages WHERE organization_id = ? AND conversation_type = 'group' AND group_id = g.id) AS last_message_at
    FROM chat_groups g
    JOIN chat_group_members gm ON gm.group_id = g.id AND gm.user_id = ? AND gm.organization_id = ?
    LEFT JOIN projects p ON p.id = g.project_id AND p.organization_id = ?
    LEFT JOIN chat_group_members m ON m.group_id = g.id AND m.organization_id = ?
    WHERE g.organization_id = ?
    GROUP BY g.id, g.name, g.description, g.avatar_url, g.project_id, g.created_at, g.created_by, p.name
    ORDER BY g.created_at DESC
  `).all(orgId, orgId, currentId, orgId, orgId, orgId, orgId);

  res.json(groups);
}

async function getGroup(req, res) {
  const currentId = req.session.user.id;
  const orgId = req.session.user.organization_id;
  const groupId = parseId(req.params.groupId);

  if (!groupId) return res.status(400).json({ error: 'Grupo inválido.' });

  const group = await req.app.locals.database.prepare(`
    SELECT g.*, p.name AS project_name, p.status AS project_status
    FROM chat_groups g
    LEFT JOIN projects p ON p.id = g.project_id AND p.organization_id = ?
    WHERE g.id = ? AND g.organization_id = ?
  `).get(orgId, groupId, orgId);

  if (!group) return res.status(404).json({ error: 'El grupo no existe.' });

  // Validar pertenencia
  const isMember = await req.app.locals.database.prepare(
    'SELECT role FROM chat_group_members WHERE group_id = ? AND user_id = ?'
  ).get(groupId, currentId);
  if (!isMember) return res.status(403).json({ error: 'No perteneces a este grupo o no tienes acceso.' });

  const wsHub = req.app.locals.wsHub;
  const members = await req.app.locals.database.prepare(`
    SELECT u.id, u.name, u.username, u.email, u.profile_photo, u.last_seen_at, gm.role, gm.created_at as joined_at
    FROM chat_group_members gm
    JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id = ? AND gm.organization_id = ?
    ORDER BY CASE WHEN gm.role = 'admin' THEN 1 ELSE 2 END, u.name
  `).all(groupId, orgId);

  const enrichedMembers = members.map(m => ({
    ...m,
    online: wsHub ? wsHub.isUserOnline(m.id) : false
  }));

  const messages = await req.app.locals.database.prepare(`
    SELECT m.id, m.content, m.created_at, m.sender_id, m.delivery_status, m.message_type,
           m.attachment_id, m.attachment_name, m.attachment_mime, m.is_pinned, m.is_deleted, m.reply_to_id,
           u.name AS sender_name, u.profile_photo AS sender_photo
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.organization_id = ? AND m.conversation_type = 'group' AND m.group_id = ?
    ORDER BY m.created_at ASC
    LIMIT 100
  `).all(orgId, groupId);

  res.json({
    group,
    my_role: isMember.role,
    members: enrichedMembers,
    messages
  });
}

async function createGroup(req, res) {
  const currentId = req.session.user.id;
  const orgId = req.session.user.organization_id;

  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'El nombre del grupo es obligatorio.' });

  const description = String(req.body.description || '').trim();
  const avatarUrl = req.body.avatar_url ? String(req.body.avatar_url).trim() : null;
  const projectId = parseId(req.body.project_id);

  if (projectId) {
    const project = await req.app.locals.database.prepare(
      'SELECT id FROM projects WHERE id = ? AND organization_id = ?'
    ).get(projectId, orgId);
    if (!project) return res.status(400).json({ error: 'El proyecto asociado no existe en tu organización.' });
  }

  const rawMembers = req.body.members || req.body.member_ids;
  const memberIds = Array.isArray(rawMembers)
    ? rawMembers.map(Number).filter(v => Number.isInteger(v) && v > 0)
    : [];
  const uniqueMemberIds = [...new Set([...memberIds, currentId])];

  const result = await req.app.locals.database.prepare(`
    INSERT INTO chat_groups (organization_id, name, description, avatar_url, project_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?) RETURNING id
  `).run(orgId, name.slice(0, 80), description || null, avatarUrl, projectId, currentId);

  const groupId = result.lastInsertRowid;

  // Insertar miembros
  for (const uid of uniqueMemberIds) {
    const role = uid === currentId ? 'admin' : 'member';
    await req.app.locals.database.prepare(`
      INSERT INTO chat_group_members (group_id, user_id, organization_id, role, last_read_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT (group_id, user_id) DO NOTHING
    `).run(groupId, uid, orgId, role);
  }

  // Notificar por WebSocket a miembros invitados
  const wsHub = req.app.locals.wsHub;
  if (wsHub) {
    for (const uid of uniqueMemberIds) {
      wsHub.broadcastToUser(orgId, uid, {
        type: 'group:created',
        group: { id: groupId, name, description, project_id: projectId }
      });
    }
  }

  res.status(201).json({ group: { id: groupId, name, description, project_id: projectId }, id: groupId, name, description, project_id: projectId });
}

async function updateGroup(req, res) {
  const currentId = req.session.user.id;
  const orgId = req.session.user.organization_id;
  const groupId = parseId(req.params.groupId);

  if (!groupId) return res.status(400).json({ error: 'Grupo inválido.' });

  const group = await req.app.locals.database.prepare(
    'SELECT * FROM chat_groups WHERE id = ? AND organization_id = ?'
  ).get(groupId, orgId);
  if (!group) return res.status(404).json({ error: 'El grupo no existe.' });

  const isPlatformOrCompanyAdmin = ['platform_admin', 'company_admin', 'admin'].includes(req.session.user.role);
  const myMember = await req.app.locals.database.prepare(
    'SELECT role FROM chat_group_members WHERE group_id = ? AND user_id = ?'
  ).get(groupId, currentId);

  if (!isPlatformOrCompanyAdmin && myMember?.role !== 'admin') {
    return res.status(403).json({ error: 'Solo los administradores del grupo pueden modificarlo.' });
  }

  const name = req.body.name ? String(req.body.name).trim().slice(0, 80) : group.name;
  const description = req.body.description !== undefined ? String(req.body.description).trim() : group.description;
  const avatarUrl = req.body.avatar_url !== undefined ? String(req.body.avatar_url).trim() : group.avatar_url;
  const projectId = req.body.project_id !== undefined ? parseId(req.body.project_id) : group.project_id;

  if (projectId) {
    const project = await req.app.locals.database.prepare(
      'SELECT id FROM projects WHERE id = ? AND organization_id = ?'
    ).get(projectId, orgId);
    if (!project) return res.status(400).json({ error: 'El proyecto asociado no existe.' });
  }

  await req.app.locals.database.prepare(`
    UPDATE chat_groups
    SET name = ?, description = ?, avatar_url = ?, project_id = ?
    WHERE id = ?
  `).run(name, description || null, avatarUrl || null, projectId || null, groupId);

  const wsHub = req.app.locals.wsHub;
  if (wsHub) {
    wsHub.broadcastToGroup(orgId, groupId, {
      type: 'group:updated',
      groupId,
      name,
      description,
      project_id: projectId
    });
  }

  res.json({ ok: true, id: groupId, name, description, project_id: projectId });
}

async function addGroupMember(req, res) {
  const currentId = req.session.user.id;
  const orgId = req.session.user.organization_id;
  const groupId = parseId(req.params.groupId);
  const targetUserId = parseId(req.body.user_id);

  if (!groupId || !targetUserId) return res.status(400).json({ error: 'Parámetros inválidos.' });

  const group = await req.app.locals.database.prepare(
    'SELECT * FROM chat_groups WHERE id = ? AND organization_id = ?'
  ).get(groupId, orgId);
  if (!group) return res.status(404).json({ error: 'El grupo no existe.' });

  const isPlatformOrCompanyAdmin = ['platform_admin', 'company_admin', 'admin'].includes(req.session.user.role);
  const myMember = await req.app.locals.database.prepare(
    'SELECT role FROM chat_group_members WHERE group_id = ? AND user_id = ?'
  ).get(groupId, currentId);

  if (!isPlatformOrCompanyAdmin && myMember?.role !== 'admin') {
    return res.status(403).json({ error: 'Solo los administradores del grupo pueden añadir miembros.' });
  }

  const targetUser = await req.app.locals.database.prepare(
    'SELECT id, name FROM users WHERE id = ? AND organization_id = ? AND active = 1'
  ).get(targetUserId, orgId);
  if (!targetUser) return res.status(404).json({ error: 'El usuario no existe o está inactivo.' });

  await req.app.locals.database.prepare(`
    INSERT INTO chat_group_members (group_id, user_id, organization_id, role, last_read_at)
    VALUES (?, ?, ?, 'member', CURRENT_TIMESTAMP)
    ON CONFLICT (group_id, user_id) DO NOTHING
  `).run(groupId, targetUserId, orgId);

  const wsHub = req.app.locals.wsHub;
  if (wsHub) {
    wsHub.broadcastToGroup(orgId, groupId, {
      type: 'group:member_added',
      groupId,
      user: { id: targetUser.id, name: targetUser.name }
    });
    wsHub.broadcastToUser(orgId, targetUserId, {
      type: 'group:created',
      group: { id: groupId, name: group.name }
    });
  }

  res.status(201).json({ ok: true, member_id: targetUserId });
}

async function removeGroupMember(req, res) {
  const currentId = req.session.user.id;
  const orgId = req.session.user.organization_id;
  const groupId = parseId(req.params.groupId);
  const targetUserId = parseId(req.params.userId);

  if (!groupId || !targetUserId) return res.status(400).json({ error: 'Parámetros inválidos.' });

  const group = await req.app.locals.database.prepare(
    'SELECT * FROM chat_groups WHERE id = ? AND organization_id = ?'
  ).get(groupId, orgId);
  if (!group) return res.status(404).json({ error: 'El grupo no existe.' });

  const isLeaving = targetUserId === currentId;
  const isPlatformOrCompanyAdmin = ['platform_admin', 'company_admin', 'admin'].includes(req.session.user.role);
  const myMember = await req.app.locals.database.prepare(
    'SELECT role FROM chat_group_members WHERE group_id = ? AND user_id = ?'
  ).get(groupId, currentId);

  if (!isLeaving && !isPlatformOrCompanyAdmin && myMember?.role !== 'admin') {
    return res.status(403).json({ error: 'Solo los administradores del grupo pueden expulsar miembros.' });
  }

  await req.app.locals.database.prepare(
    'DELETE FROM chat_group_members WHERE group_id = ? AND user_id = ? AND organization_id = ?'
  ).run(groupId, targetUserId, orgId);

  const wsHub = req.app.locals.wsHub;
  if (wsHub) {
    wsHub.broadcastToGroup(orgId, groupId, {
      type: 'group:member_removed',
      groupId,
      userId: targetUserId
    });
    wsHub.broadcastToUser(orgId, targetUserId, {
      type: 'group:removed',
      groupId
    });
  }

  res.json({ ok: true, removed_id: targetUserId, left: isLeaving });
}

async function updateGroupMemberRole(req, res) {
  const currentId = req.session.user.id;
  const orgId = req.session.user.organization_id;
  const groupId = parseId(req.params.groupId);
  const targetUserId = parseId(req.params.userId);
  const newRole = req.body.role === 'admin' ? 'admin' : 'member';

  if (!groupId || !targetUserId) return res.status(400).json({ error: 'Parámetros inválidos.' });

  const isPlatformOrCompanyAdmin = ['platform_admin', 'company_admin', 'admin'].includes(req.session.user.role);
  const myMember = await req.app.locals.database.prepare(
    'SELECT role FROM chat_group_members WHERE group_id = ? AND user_id = ?'
  ).get(groupId, currentId);

  if (!isPlatformOrCompanyAdmin && myMember?.role !== 'admin') {
    return res.status(403).json({ error: 'Solo los administradores del grupo pueden cambiar roles.' });
  }

  await req.app.locals.database.prepare(
    'UPDATE chat_group_members SET role = ? WHERE group_id = ? AND user_id = ? AND organization_id = ?'
  ).run(newRole, groupId, targetUserId, orgId);

  res.json({ ok: true, user_id: targetUserId, role: newRole });
}

async function removeConversation(req, res) {
  const otherId = Number(req.params.userId);
  if (!Number.isInteger(otherId) || otherId < 1) return res.status(400).json({ error: 'La conversación no es válida.' });
  await req.app.locals.database.prepare(`
    INSERT INTO conversation_deletions (organization_id, user_id, other_user_id)
    VALUES (?, ?, ?)
    ON CONFLICT (user_id, other_user_id) DO UPDATE SET deleted_at = CURRENT_TIMESTAMP
  `).run(req.session.user.organization_id, req.session.user.id, otherId);
  res.json({ ok: true });
}

module.exports = {
  listConversations,
  list,
  create,
  sendGroupMessage,
  editMessage,
  deleteMessage,
  toggleReaction,
  togglePin,
  getPinnedMessages,
  search,
  updatePreferences,
  getSharedFiles,
  listGroups,
  getGroup,
  createGroup,
  updateGroup,
  addGroupMember,
  removeGroupMember,
  updateGroupMemberRole,
  removeConversation
};
