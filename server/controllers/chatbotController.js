const { projectContext, localAnswer, normalizeText } = require('./assistantController');
const sanzuService = require('../services/sanzuService');

// Fallback en memoria si la base de datos se encuentra en entorno de test simulado
const memoryStore = {
  conversations: new Map(),
  messages: new Map()
};

async function ensureTables(database) {
  if (!database?.prepare) return;
  try {
    await database.prepare(`
      CREATE TABLE IF NOT EXISTS chatbot_conversations (
        id TEXT PRIMARY KEY,
        organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
        title TEXT NOT NULL DEFAULT 'Nueva conversación',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).run().catch(() => {});
    await database.prepare(`
      CREATE TABLE IF NOT EXISTS chatbot_messages (
        id SERIAL PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES chatbot_conversations(id) ON DELETE CASCADE,
        organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        sender TEXT NOT NULL CHECK (sender IN ('user', 'bot', 'system')),
        message TEXT NOT NULL,
        source TEXT DEFAULT 'local',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).run().catch(() => {});
  } catch {}
}

/**
 * Genera un título conciso a partir del primer mensaje
 */
function generateTitle(message) {
  const clean = String(message || '').trim().replace(/\s+/g, ' ');
  if (!clean) return 'Nueva conversación';
  return clean.length > 45 ? `${clean.slice(0, 45)}...` : clean;
}

/**
 * POST /chatbot/message & POST /api/chatbot/message
 * Procesa un mensaje contextual, guarda historial y responde considerando
 * el contexto real del proyecto (tareas, métricas, metodología).
 */
async function sendMessage(req, res) {
  const message = String(req.body.message || '').trim();
  if (!message) {
    return res.status(400).json({ error: 'Escribe una pregunta o mensaje.' });
  }

  const database = req.app.locals.database;
  await ensureTables(database);

  const orgId = req.session?.user?.organization_id;
  const userId = req.session?.user?.id;
  const projectId = req.body.projectId || null;
  let conversationId = req.body.conversationId || `conv-${orgId || 1}-${userId || 1}-${Date.now()}`;

  // 1. Cargar contexto real del proyecto
  const context = await projectContext(database, orgId, projectId);

  // 2. Gestionar o crear registro de conversación
  let convTitle = 'Nueva conversación';
  let conversationExists = false;

  try {
    const existing = await database.prepare(`
      SELECT id, title, organization_id FROM chatbot_conversations
      WHERE id = ? AND organization_id = ?
    `).get(conversationId, orgId);

    if (existing) {
      conversationExists = true;
      convTitle = existing.title;
      // Si la conversación tenía el título por defecto, actualizar con la pregunta
      if (convTitle === 'Nueva conversación' && message.length > 2) {
        convTitle = generateTitle(message);
        await database.prepare(`
          UPDATE chatbot_conversations SET title = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND organization_id = ?
        `).run(convTitle, conversationId, orgId).catch(() => {});
      } else {
        await database.prepare(`
          UPDATE chatbot_conversations SET updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND organization_id = ?
        `).run(conversationId, orgId).catch(() => {});
      }
    } else {
      convTitle = generateTitle(message);
      await database.prepare(`
        INSERT INTO chatbot_conversations (id, organization_id, user_id, project_id, title, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(conversationId, orgId, userId, context.project?.id || projectId || null).catch(() => {});
      conversationExists = true;
    }
  } catch {
    // Soporte memoria si BD es mock
    if (!memoryStore.conversations.has(conversationId)) {
      convTitle = generateTitle(message);
      memoryStore.conversations.set(conversationId, {
        id: conversationId,
        organization_id: orgId,
        user_id: userId,
        project_id: context.project?.id || projectId || null,
        title: convTitle,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    } else {
      const conv = memoryStore.conversations.get(conversationId);
      conv.updated_at = new Date().toISOString();
      convTitle = conv.title;
    }
  }

  // 3. Guardar mensaje del usuario en el historial
  try {
    await database.prepare(`
      INSERT INTO chatbot_messages (conversation_id, organization_id, sender, message, source, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(conversationId, orgId, 'user', message, 'user');
  } catch {
    if (!memoryStore.messages.has(conversationId)) memoryStore.messages.set(conversationId, []);
    memoryStore.messages.get(conversationId).push({
      id: Date.now() + Math.random(),
      conversation_id: conversationId,
      organization_id: orgId,
      sender: 'user',
      message,
      source: 'user',
      created_at: new Date().toISOString()
    });
  }

  // 4. Generar respuesta considerando el contexto real (tareas, métricas, metodología)
  let answer = '';
  let source = 'local';
  let warning = undefined;
  let sources = [];
  let suggestions = [];

  // El motor determinístico propio NO requiere claves externas.
  // Si Sanzu IA remota está configurada y habilitada en el plan, se puede consultar de forma opcional.
  const hasAiPlan = req.plan?.features?.ai === true;
  let triedRemote = false;

  if (hasAiPlan && context.project) {
    try {
      const creds = await sanzuService.resolveOrganizationCredentials(database, orgId);
      if (creds?.apiKey) {
        triedRemote = true;
        const result = await sanzuService.askSanzu(
          context.project,
          message,
          conversationId,
          {
            methodology_id: context.project.methodology_id,
            requirements: context.project.requirements,
            tasks: context.tasks,
            users: context.users,
            risks: context.risks,
            sprints: context.sprints,
            activeSprint: context.activeSprint,
            milestones: context.milestones,
            issues: context.issues
          },
          creds
        );
        const remoteAnswer = result.response || result.answer || result.reply || result.message;
        if (remoteAnswer) {
          answer = remoteAnswer;
          source = 'sanzu';
          sources = result.sources || [];
          suggestions = result.suggestions || [];
        }
      }
    } catch (remoteErr) {
      console.warn('Sanzu remoto no disponible, usando motor local determinístico:', remoteErr.message);
      warning = `Modo local activo: ${remoteErr.message}`;
    }
  }

  // Si no se usó o falló Sanzu remoto, usar motor local determinístico propio
  if (!answer) {
    answer = localAnswer(message, context);
    source = 'local';
  }

  // 5. Guardar respuesta del bot en el historial
  try {
    await database.prepare(`
      INSERT INTO chatbot_messages (conversation_id, organization_id, sender, message, source, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(conversationId, orgId, 'bot', answer, source);
  } catch {
    if (!memoryStore.messages.has(conversationId)) memoryStore.messages.set(conversationId, []);
    memoryStore.messages.get(conversationId).push({
      id: Date.now() + Math.random(),
      conversation_id: conversationId,
      organization_id: orgId,
      sender: 'bot',
      message: answer,
      source,
      created_at: new Date().toISOString()
    });
  }

  return res.json({
    success: true,
    answer,
    source,
    conversationId,
    conversationTitle: convTitle,
    warning,
    sources,
    suggestions,
    context
  });
}

/**
 * GET /api/chatbot/conversations
 * Lista las conversaciones del usuario en la organización con métricas de mensajes
 */
async function listConversations(req, res) {
  const database = req.app.locals.database;
  await ensureTables(database);

  const orgId = req.session?.user?.organization_id;
  const userId = req.session?.user?.id;

  try {
    const rows = await database.prepare(`
      SELECT c.id, c.title, c.project_id, c.created_at, c.updated_at,
             COUNT(m.id)::int AS message_count,
             (SELECT message FROM chatbot_messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1) AS last_message
      FROM chatbot_conversations c
      LEFT JOIN chatbot_messages m ON m.conversation_id = c.id
      WHERE c.organization_id = ? AND c.user_id = ?
      GROUP BY c.id, c.title, c.project_id, c.created_at, c.updated_at
      ORDER BY c.updated_at DESC
    `).all(orgId, userId);

    if (rows && rows.length > 0) {
      return res.json({ success: true, conversations: rows });
    }
  } catch {}

  // Fallback en memoria si la BD es mock
  const list = Array.from(memoryStore.conversations.values())
    .filter(c => c.organization_id === orgId && (c.user_id === userId || !c.user_id))
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .map(c => {
      const msgs = memoryStore.messages.get(c.id) || [];
      return {
        ...c,
        message_count: msgs.length,
        last_message: msgs.length ? msgs[msgs.length - 1].message : ''
      };
    });

  return res.json({ success: true, conversations: list });
}

/**
 * GET /api/chatbot/conversations/:id
 * Obtiene el detalle de una conversación y su historial completo de mensajes
 */
async function getConversation(req, res) {
  const database = req.app.locals.database;
  await ensureTables(database);

  const orgId = req.session?.user?.organization_id;
  const conversationId = req.params.id;

  try {
    const conversation = await database.prepare(`
      SELECT id, title, project_id, user_id, organization_id, created_at, updated_at
      FROM chatbot_conversations
      WHERE id = ? AND organization_id = ?
    `).get(conversationId, orgId);

    if (conversation) {
      const messages = await database.prepare(`
        SELECT id, sender, message, source, created_at
        FROM chatbot_messages
        WHERE conversation_id = ? AND organization_id = ?
        ORDER BY id ASC
      `).all(conversationId, orgId);

      return res.json({
        success: true,
        conversation,
        messages: messages || []
      });
    }
  } catch {}

  // Fallback en memoria
  if (memoryStore.conversations.has(conversationId)) {
    const c = memoryStore.conversations.get(conversationId);
    if (c.organization_id === orgId) {
      const msgs = memoryStore.messages.get(conversationId) || [];
      return res.json({
        success: true,
        conversation: c,
        messages: msgs
      });
    }
  }

  return res.status(404).json({ error: 'Conversación no encontrada.' });
}

/**
 * DELETE /api/chatbot/conversations/:id
 * Elimina una conversación y sus mensajes asociados (historial)
 */
async function deleteConversation(req, res) {
  const database = req.app.locals.database;
  await ensureTables(database);

  const orgId = req.session?.user?.organization_id;
  const userId = req.session?.user?.id;
  const userRole = req.session?.user?.role;
  const conversationId = req.params.id;

  let found = false;

  try {
    const existing = await database.prepare(`
      SELECT id, user_id, organization_id FROM chatbot_conversations
      WHERE id = ? AND organization_id = ?
    `).get(conversationId, orgId);

    if (existing) {
      // Verificar permisos: el creador o un admin
      if (existing.user_id === userId || userRole === 'admin' || userRole === 'platform_admin' || userRole === 'company_admin') {
        await database.prepare(`DELETE FROM chatbot_conversations WHERE id = ? AND organization_id = ?`).run(conversationId, orgId);
        found = true;
      } else {
        return res.status(403).json({ error: 'No tienes permiso para eliminar esta conversación.' });
      }
    }
  } catch {}

  if (!found && memoryStore.conversations.has(conversationId)) {
    const c = memoryStore.conversations.get(conversationId);
    if (c.organization_id === orgId) {
      if (c.user_id === userId || userRole === 'admin' || userRole === 'platform_admin' || userRole === 'company_admin') {
        memoryStore.conversations.delete(conversationId);
        memoryStore.messages.delete(conversationId);
        found = true;
      } else {
        return res.status(403).json({ error: 'No tienes permiso para eliminar esta conversación.' });
      }
    }
  }

  if (!found) {
    return res.status(404).json({ error: 'Conversación no encontrada.' });
  }

  return res.json({ success: true, message: 'Conversación eliminada correctamente.' });
}

/**
 * POST /api/chatbot/conversations
 * Crea una nueva conversación vacía
 */
async function createConversation(req, res) {
  const database = req.app.locals.database;
  await ensureTables(database);

  const orgId = req.session?.user?.organization_id;
  const userId = req.session?.user?.id;
  const title = String(req.body.title || 'Nueva conversación').trim() || 'Nueva conversación';
  const projectId = req.body.projectId || null;
  const id = `conv-${orgId || 1}-${userId || 1}-${Date.now()}`;

  try {
    await database.prepare(`
      INSERT INTO chatbot_conversations (id, organization_id, user_id, project_id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(id, orgId, userId, projectId);
  } catch {
    memoryStore.conversations.set(id, {
      id,
      organization_id: orgId,
      user_id: userId,
      project_id: projectId,
      title,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    memoryStore.messages.set(id, []);
  }

  return res.status(201).json({
    success: true,
    conversation: {
      id,
      title,
      project_id: projectId,
      created_at: new Date().toISOString()
    }
  });
}

module.exports = {
  sendMessage,
  listConversations,
  getConversation,
  deleteConversation,
  createConversation,
  memoryStore
};
