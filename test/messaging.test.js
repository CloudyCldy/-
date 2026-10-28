process.env.NODE_ENV = 'test';
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../app');

describe('Pruebas funcionales de Mensajería en Tiempo Real y Multi-Tenant (Haitani)', () => {
  let originalDatabase;

  // Organizaciones de prueba
  const orgAlpha = { id: 10, name: 'Corporación Alpha', status: 'approved' };
  const orgBeta = { id: 20, name: 'Empresa Beta', status: 'approved' };

  // Usuarios de Org Alpha
  const userAlphaAdmin = {
    id: 101,
    name: 'Admin Alpha',
    username: 'admin_alpha',
    email: 'admin@alpha.com',
    role: 'company_admin',
    organization_id: orgAlpha.id,
    active: 1
  };
  const userAlphaMember1 = {
    id: 102,
    name: 'Valeria Gómez',
    username: 'valeria_alpha',
    email: 'valeria@alpha.com',
    role: 'member',
    organization_id: orgAlpha.id,
    active: 1
  };
  const userAlphaMember2 = {
    id: 103,
    name: 'Carlos Mendoza',
    username: 'carlos_alpha',
    email: 'carlos@alpha.com',
    role: 'member',
    organization_id: orgAlpha.id,
    active: 1
  };

  // Usuario de Org Beta (para pruebas de aislamiento multi-tenant)
  const userBetaMember = {
    id: 201,
    name: 'Usuario Beta',
    username: 'user_beta',
    email: 'user@beta.com',
    role: 'member',
    organization_id: orgBeta.id,
    active: 1
  };

  const allUsers = [userAlphaAdmin, userAlphaMember1, userAlphaMember2, userBetaMember];

  // Estado en memoria para la suite de pruebas
  let messages = [];
  let chatGroups = [];
  let chatGroupMembers = [];
  let messageReactions = [];
  let conversationPreferences = [];
  let files = [];
  let idCounter = 1000;

  function buildMessagingMockDb() {
    return {
      prepare(query) {
        const s = query.toLowerCase().replace(/\s+/g, ' ');
        return {
          async get(...params) {
            // Usuario en requireAuth
            if (s.includes('from users') && (s.includes('where users.id = ?') || s.includes('where id = ?')) && s.includes('organizations.status')) {
              const id = params[0];
              const u = allUsers.find(x => x.id === Number(id));
              if (u) {
                return {
                  ...u,
                  organization_name: u.organization_id === orgAlpha.id ? orgAlpha.name : orgBeta.name,
                  organization_slug: 'org-' + u.organization_id,
                  organization_status: 'approved'
                };
              }
              return null;
            }

            // Destinatario o usuario de la org
            if (s.includes('from users') && s.includes('where id = ? and organization_id = ? and active = 1')) {
              const [uid, orgId] = params;
              const u = allUsers.find(x => x.id === Number(uid) && x.organization_id === Number(orgId));
              return u || null;
            }

            // Proyecto existente en la org
            if (s.includes('from projects where id = ? and organization_id = ?')) {
              const [pid, orgId] = params;
              return { id: Number(pid), name: 'Proyecto Alpha Demo', organization_id: Number(orgId) };
            }

            // Idempotencia por client_message_id
            if (s.includes('from messages where organization_id = ? and sender_id = ? and client_message_id = ?')) {
              const [orgId, senderId, clientMsgId] = params;
              return messages.find(m => m.client_message_id === clientMsgId && m.sender_id === Number(senderId) && m.organization_id === Number(orgId)) || null;
            }

            // Membresía en chat_group_members
            if (s.includes('from chat_group_members where group_id = ? and user_id = ?')) {
              const [gid, uid] = params;
              return chatGroupMembers.find(m => m.group_id === Number(gid) && m.user_id === Number(uid)) || null;
            }

            // Grupo por id y org
            if (s.includes('from chat_groups where id = ? and organization_id = ?')) {
              const [gid, orgId] = params;
              return chatGroups.find(g => g.id === Number(gid) && g.organization_id === Number(orgId)) || null;
            }

            // Detalle de grupo con proyecto y conteo de miembros
            if (s.includes('from chat_groups g') && s.includes('join chat_group_members gm')) {
              const [gid, currentId, orgId] = params;
              const g = chatGroups.find(item => item.id === Number(gid) && item.organization_id === Number(orgId));
              if (!g) return null;
              const myMembership = chatGroupMembers.find(m => m.group_id === Number(gid) && m.user_id === Number(currentId));
              const membersCount = chatGroupMembers.filter(m => m.group_id === Number(gid)).length;
              return {
                id: g.id,
                name: g.name,
                description: g.description,
                avatar_url: g.avatar_url,
                project_id: g.project_id,
                project_name: g.project_id ? 'Proyecto Alfa Demo' : null,
                created_at: g.created_at,
                created_by: g.created_by,
                my_role: myMembership?.role || 'member',
                members_count: membersCount
              };
            }

            // Mensaje por id y org
            if (s.includes('from messages where id = ? and organization_id = ?')) {
              const [mid, orgId] = params;
              return messages.find(m => m.id === Number(mid) && m.organization_id === Number(orgId)) || null;
            }

            // Mensaje por id
            if (s.includes('from messages where id = ?')) {
              const [mid] = params;
              return messages.find(m => m.id === Number(mid)) || null;
            }

            // Reacción existente
            if (s.includes('from message_reactions where message_id = ? and user_id = ? and reaction = ?')) {
              const [mid, uid, reaction] = params;
              const r = messageReactions.find(item => item.message_id === Number(mid) && item.user_id === Number(uid) && item.reaction === reaction);
              return r ? { id: r.id } : null;
            }

            // Archivo adjunto
            if (s.includes('from files where id = ? and organization_id = ?')) {
              const [fid, orgId] = params;
              return files.find(f => f.id === Number(fid) && f.organization_id === Number(orgId)) || null;
            }

            // Conteo de mensajes no leídos en grupo
            if (s.includes('select count(*)::integer as count from messages') && s.includes("conversation_type = 'group'")) {
              return { count: 0 };
            }

            return null;
          },

          async all(...params) {
            // Conversaciones directas: usuarios de la organización
            if (s.includes('from users u') && s.includes('conversation_preferences cp') && s.includes("conversation_type = 'direct'")) {
              const [currentId, orgId] = params;
              return allUsers
                .filter(u => u.organization_id === Number(orgId) && u.id !== Number(currentId))
                .map(u => ({
                  id: u.id,
                  name: u.name,
                  username: u.username,
                  email: u.email,
                  profile_photo: null,
                  role: u.role,
                  last_seen_at: new Date().toISOString(),
                  is_muted: false,
                  is_archived: false,
                  is_pinned: false
                }));
            }

            // Conteo de no leídos directos
            if (s.includes('select sender_id, count(*)::integer as unread_count from messages')) {
              const [orgId, currentId] = params;
              const unreads = {};
              for (const m of messages) {
                if (m.organization_id === Number(orgId) && m.receiver_id === Number(currentId) && m.delivery_status !== 'leido' && !m.is_deleted) {
                  unreads[m.sender_id] = (unreads[m.sender_id] || 0) + 1;
                }
              }
              return Object.entries(unreads).map(([sender_id, unread_count]) => ({
                sender_id: Number(sender_id),
                unread_count
              }));
            }

            // Últimos mensajes directos
            if (s.includes('select distinct on (partner_id)')) {
              const [currentId, orgId] = params;
              const partnerLastMsg = new Map();
              for (const m of messages) {
                if (m.organization_id === Number(orgId) && m.conversation_type === 'direct') {
                  const partner = m.sender_id === Number(currentId) ? m.receiver_id : (m.receiver_id === Number(currentId) ? m.sender_id : null);
                  if (partner) {
                    if (!partnerLastMsg.has(partner) || new Date(m.created_at) > new Date(partnerLastMsg.get(partner).created_at)) {
                      partnerLastMsg.set(partner, {
                        partner_id: partner,
                        id: m.id,
                        content: m.content,
                        created_at: m.created_at,
                        sender_id: m.sender_id,
                        delivery_status: m.delivery_status,
                        message_type: m.message_type,
                        is_deleted: m.is_deleted
                      });
                    }
                  }
                }
              }
              return Array.from(partnerLastMsg.values());
            }

            // Grupos del usuario
            if (s.includes('from chat_groups g') && s.includes('join chat_group_members gm') && s.includes('group by g.id')) {
              const [currentId, orgId] = params;
              const userMemberships = chatGroupMembers.filter(m => m.user_id === Number(currentId) && m.organization_id === Number(orgId));
              const myGroupIds = new Set(userMemberships.map(m => m.group_id));

              return chatGroups
                .filter(g => g.organization_id === Number(orgId) && myGroupIds.has(g.id))
                .map(g => {
                  const myMem = userMemberships.find(m => m.group_id === g.id);
                  const count = chatGroupMembers.filter(m => m.group_id === g.id).length;
                  return {
                    id: g.id,
                    name: g.name,
                    description: g.description,
                    avatar_url: g.avatar_url,
                    project_id: g.project_id,
                    created_at: g.created_at,
                    created_by: g.created_by,
                    project_name: g.project_id ? 'Proyecto Demo' : null,
                    my_role: myMem?.role || 'member',
                    last_read_at: myMem?.last_read_at || null,
                    members_count: count,
                    is_muted: false,
                    is_archived: false,
                    is_pinned: false
                  };
                });
            }

            // Búsqueda de mensajes
            if (s.includes('from messages m') && s.includes('m.content ilike ?')) {
              const [orgId, queryParam] = params;
              const term = (queryParam || '').replace(/%/g, '').toLowerCase();
              return messages
                .filter(m => m.organization_id === Number(orgId) && (m.content || '').toLowerCase().includes(term))
                .map(m => ({
                  id: m.id,
                  conversation_type: m.conversation_type,
                  sender_id: m.sender_id,
                  receiver_id: m.receiver_id,
                  group_id: m.group_id,
                  content: m.content,
                  message_type: m.message_type,
                  created_at: m.created_at,
                  sender_name: 'Valeria Gómez'
                }));
            }

            // Historial de mensajes en chat activo (direct o group)
            if (s.includes('from messages m') && s.includes('join users u on u.id = m.sender_id') && s.includes('m.organization_id = ?')) {
              const [orgId] = params;
              let filtered = messages.filter(m => m.organization_id === Number(orgId));

              // Directo
              if (s.includes("m.conversation_type = 'direct'") || s.includes("m.conversation_type = ?")) {
                if (params.length >= 5) {
                  const [, s1, r1, s2, r2] = params;
                  filtered = filtered.filter(m =>
                    m.conversation_type === 'direct' &&
                    ((m.sender_id === Number(s1) && m.receiver_id === Number(r1)) ||
                     (m.sender_id === Number(s2) && m.receiver_id === Number(r2)))
                  );
                }
              }
              // Grupo
              else if (s.includes("m.conversation_type = 'group'")) {
                const [, gid] = params;
                filtered = filtered.filter(m => m.conversation_type === 'group' && m.group_id === Number(gid));
              }

              return filtered.map(m => {
                const sender = allUsers.find(u => u.id === m.sender_id);
                return {
                  id: m.id,
                  sender_id: m.sender_id,
                  receiver_id: m.receiver_id,
                  group_id: m.group_id,
                  conversation_type: m.conversation_type,
                  content: m.content,
                  message_type: m.message_type || 'text',
                  attachment_id: m.attachment_id || null,
                  delivery_status: m.delivery_status || 'enviado',
                  reply_to_id: m.reply_to_id || null,
                  is_pinned: !!m.is_pinned,
                  is_deleted: !!m.is_deleted,
                  edited_at: m.edited_at || null,
                  created_at: m.created_at,
                  sender_name: sender ? sender.name : 'Desconocido',
                  sender_photo: null
                };
              });
            }

            return [];
          },

          async run(...params) {
            // INSERT INTO messages
            if (s.includes('insert into messages')) {
              const newMsg = {
                id: ++idCounter,
                sender_id: params[0],
                receiver_id: params[1],
                organization_id: params[2],
                content: params[3],
                delivery_status: params[4],
                conversation_type: params[5],
                group_id: s.includes('group_id') ? params[6] : null,
                attachment_id: params[6] || null,
                reply_to_id: params[9] || null,
                client_message_id: params[10] || null,
                message_type: params[11] || 'text',
                is_pinned: false,
                is_deleted: false,
                edited_at: null,
                created_at: new Date().toISOString()
              };
              messages.push(newMsg);
              return { changes: 1, lastInsertRowid: newMsg.id, rows: [newMsg] };
            }

            // UPDATE messages SET delivery_status = 'leido'
            if (s.includes("update messages set delivery_status = 'leido'")) {
              const [orgId, currentId, otherId] = params;
              let changes = 0;
              for (const m of messages) {
                if (m.organization_id === Number(orgId) && m.receiver_id === Number(currentId) && m.sender_id === Number(otherId) && m.delivery_status !== 'leido') {
                  m.delivery_status = 'leido';
                  changes++;
                }
              }
              return { changes };
            }

            // UPDATE messages (Editar mensaje)
            if (s.includes('update messages set content = ?, edited_at = now() where id = ? and organization_id = ?')) {
              const [newContent, mid, orgId] = params;
              const msg = messages.find(m => m.id === Number(mid) && m.organization_id === Number(orgId));
              if (msg) {
                msg.content = newContent;
                msg.edited_at = new Date().toISOString();
                return { changes: 1 };
              }
              return { changes: 0 };
            }

            // UPDATE messages (Soft delete)
            if (s.includes('update messages set is_deleted = true')) {
              const mid = params[params.length - 1];
              const msg = messages.find(m => m.id === Number(mid));
              if (msg) {
                msg.is_deleted = true;
                msg.content = '[Mensaje eliminado]';
                msg.attachment_id = null;
                return { changes: 1 };
              }
              return { changes: 0 };
            }

            // UPDATE messages (Pin / Unpin)
            if (s.includes('update messages set is_pinned = ?, pinned_at = ?, pinned_by = ? where id = ?')) {
              const [pinVal, pinnedAt, pinnedBy, mid] = params;
              const msg = messages.find(m => m.id === Number(mid));
              if (msg) {
                msg.is_pinned = pinVal;
                msg.pinned_at = pinnedAt;
                msg.pinned_by = pinnedBy;
                return { changes: 1 };
              }
              return { changes: 0 };
            }

            // INSERT INTO chat_groups
            if (s.includes('insert into chat_groups')) {
              const newGroup = {
                id: ++idCounter,
                organization_id: params[0],
                name: params[1],
                description: params[2],
                avatar_url: params[3],
                project_id: params[4],
                created_by: params[5],
                created_at: new Date().toISOString()
              };
              chatGroups.push(newGroup);
              return { changes: 1, lastInsertRowid: newGroup.id, rows: [newGroup] };
            }

            // INSERT INTO chat_group_members
            if (s.includes('insert into chat_group_members')) {
              const newMember = {
                group_id: params[0],
                user_id: params[1],
                organization_id: params[2],
                role: params[3] || 'member',
                joined_at: new Date().toISOString()
              };
              chatGroupMembers.push(newMember);
              return { changes: 1 };
            }

            // UPDATE chat_group_members (Rol)
            if (s.includes('update chat_group_members set role = ? where group_id = ? and user_id = ? and organization_id = ?')) {
              const [role, gid, uid, orgId] = params;
              const m = chatGroupMembers.find(item => item.group_id === Number(gid) && item.user_id === Number(uid) && item.organization_id === Number(orgId));
              if (m) {
                m.role = role;
                return { changes: 1 };
              }
              return { changes: 0 };
            }

            // DELETE FROM chat_group_members
            if (s.includes('delete from chat_group_members where group_id = ? and user_id = ? and organization_id = ?')) {
              const [gid, uid, orgId] = params;
              const idx = chatGroupMembers.findIndex(item => item.group_id === Number(gid) && item.user_id === Number(uid) && item.organization_id === Number(orgId));
              if (idx !== -1) {
                chatGroupMembers.splice(idx, 1);
                return { changes: 1 };
              }
              return { changes: 0 };
            }

            // INSERT INTO message_reactions
            if (s.includes('insert into message_reactions')) {
              const [mid, uid, reaction] = params;
              messageReactions.push({ id: ++idCounter, message_id: Number(mid), user_id: Number(uid), reaction, created_at: new Date() });
              return { changes: 1 };
            }

            // DELETE FROM message_reactions WHERE id = ?
            if (s.includes('delete from message_reactions where id = ?')) {
              const [rid] = params;
              const idx = messageReactions.findIndex(r => r.id === Number(rid));
              if (idx !== -1) {
                messageReactions.splice(idx, 1);
                return { changes: 1 };
              }
              return { changes: 0 };
            }

            // Preferences
            if (s.includes('insert into conversation_preferences')) {
              return { changes: 1 };
            }

            return { changes: 1, lastInsertRowid: 1 };
          }
        };
      }
    };
  }

  before(() => {
    originalDatabase = app.locals.database;
    app.locals.database = buildMessagingMockDb();
  });

  after(() => {
    app.locals.database = originalDatabase;
  });

  beforeEach(() => {
    messages = [];
    chatGroups = [];
    chatGroupMembers = [];
    messageReactions = [];
    conversationPreferences = [];
    files = [];
    idCounter = 1000;
  });

  // -------------------------------------------------------------
  // REQUISITO 1: Mensajería Directa e Idempotencia
  // -------------------------------------------------------------
  it('1.1 Envía mensaje directo con éxito e inicializa delivery_status', async () => {
    const res = await request(app)
      .post('/api/messages')
      .set('x-test-user', JSON.stringify(userAlphaMember1))
      .send({
        receiver_id: userAlphaMember2.id,
        content: 'Hola Carlos, ¿cómo vas con los entregables?'
      });

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.id);
    assert.strictEqual(res.body.sender_id, userAlphaMember1.id);
    assert.strictEqual(res.body.receiver_id, userAlphaMember2.id);
    assert.strictEqual(res.body.conversation_type, 'direct');
    assert.strictEqual(res.body.content, 'Hola Carlos, ¿cómo vas con los entregables?');
    assert.ok(['enviado', 'entregado'].includes(res.body.delivery_status));
  });

  it('1.2 Previene duplicados en reintentos con el mismo client_message_id (idempotencia)', async () => {
    const clientMsgId = 'uuid-client-12345';

    // Primer intento
    const res1 = await request(app)
      .post('/api/messages')
      .set('x-test-user', JSON.stringify(userAlphaMember1))
      .send({
        receiver_id: userAlphaMember2.id,
        content: 'Mensaje con client_id',
        client_message_id: clientMsgId
      });
    assert.strictEqual(res1.status, 201);
    const originalId = res1.body.id;

    // Segundo intento idéntico (reintento por timeout de red)
    const res2 = await request(app)
      .post('/api/messages')
      .set('x-test-user', JSON.stringify(userAlphaMember1))
      .send({
        receiver_id: userAlphaMember2.id,
        content: 'Mensaje con client_id',
        client_message_id: clientMsgId
      });
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.body.id, originalId);
    assert.strictEqual(messages.length, 1, 'No debe crear una segunda fila en la base de datos');
  });

  // -------------------------------------------------------------
  // REQUISITO 2: Historial, Paginación y Auto-lectura
  // -------------------------------------------------------------
  it('2.1 Consulta historial de conversación directa y marca como leídos', async () => {
    // Insertar mensaje previo de Member 2 hacia Member 1
    messages.push({
      id: 501,
      sender_id: userAlphaMember2.id,
      receiver_id: userAlphaMember1.id,
      conversation_type: 'direct',
      content: '¿Tienes tiempo para una llamada?',
      delivery_status: 'entregado',
      organization_id: orgAlpha.id,
      is_pinned: false,
      is_deleted: false,
      created_at: new Date().toISOString()
    });

    const res = await request(app)
      .get(`/api/messages?user_id=${userAlphaMember2.id}`)
      .set('x-test-user', JSON.stringify(userAlphaMember1));

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.messages));
    assert.strictEqual(res.body.messages.length, 1);
    assert.strictEqual(res.body.messages[0].id, 501);

    // Verificar que el estado del mensaje cambió a 'leido'
    const stored = messages.find(m => m.id === 501);
    assert.strictEqual(stored.delivery_status, 'leido');
  });

  // -------------------------------------------------------------
  // REQUISITO 3: Grupos — Ciclo de vida completo
  // -------------------------------------------------------------
  it('3.1 Crea grupo con proyecto asociado y asigna creador como admin', async () => {
    const res = await request(app)
      .post('/api/messages/groups')
      .set('x-test-user', JSON.stringify(userAlphaAdmin))
      .send({
        name: 'Sprint Alpha Q4',
        description: 'Coordinación estratégica',
        project_id: 1001,
        member_ids: [userAlphaMember1.id]
      });

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.id);
    assert.strictEqual(res.body.name, 'Sprint Alpha Q4');

    const groupId = res.body.id;
    // Creador debe tener rol admin en el grupo
    const adminMem = chatGroupMembers.find(m => m.group_id === groupId && m.user_id === userAlphaAdmin.id);
    assert.ok(adminMem);
    assert.strictEqual(adminMem.role, 'admin');

    // Miembro invitado debe tener rol member
    const invitedMem = chatGroupMembers.find(m => m.group_id === groupId && m.user_id === userAlphaMember1.id);
    assert.ok(invitedMem);
    assert.strictEqual(invitedMem.role, 'member');
  });

  it('3.2 Admin del grupo puede añadir nuevos miembros y cambiar roles', async () => {
    // Setup grupo existente con Admin
    const group = {
      id: 701,
      organization_id: orgAlpha.id,
      name: 'Grupo Frontend',
      created_by: userAlphaAdmin.id,
      created_at: new Date().toISOString()
    };
    chatGroups.push(group);
    chatGroupMembers.push({ group_id: group.id, user_id: userAlphaAdmin.id, organization_id: orgAlpha.id, role: 'admin' });

    // Añadir a Member 2
    const addRes = await request(app)
      .post(`/api/messages/groups/${group.id}/members`)
      .set('x-test-user', JSON.stringify(userAlphaAdmin))
      .send({ user_id: userAlphaMember2.id, role: 'member' });

    assert.strictEqual(addRes.status, 201);
    assert.ok(chatGroupMembers.some(m => m.group_id === group.id && m.user_id === userAlphaMember2.id));

    // Promover a Member 2 a admin del grupo
    const roleRes = await request(app)
      .put(`/api/messages/groups/${group.id}/members/${userAlphaMember2.id}`)
      .set('x-test-user', JSON.stringify(userAlphaAdmin))
      .send({ role: 'admin' });

    assert.strictEqual(roleRes.status, 200);
    const updatedMem = chatGroupMembers.find(m => m.group_id === group.id && m.user_id === userAlphaMember2.id);
    assert.strictEqual(updatedMem.role, 'admin');
  });

  // -------------------------------------------------------------
  // REQUISITO 4: Autorización en Grupos y Aislamiento Multi-Tenant
  // -------------------------------------------------------------
  it('4.1 Rechaza enviar mensaje a un grupo si el usuario NO es miembro (403)', async () => {
    const group = {
      id: 702,
      organization_id: orgAlpha.id,
      name: 'Grupo Privado Directores',
      created_by: userAlphaAdmin.id,
      created_at: new Date().toISOString()
    };
    chatGroups.push(group);
    chatGroupMembers.push({ group_id: group.id, user_id: userAlphaAdmin.id, organization_id: orgAlpha.id, role: 'admin' });

    // Member 1 intenta enviar mensaje a un grupo donde no está
    const res = await request(app)
      .post(`/api/messages/groups/${group.id}/messages`)
      .set('x-test-user', JSON.stringify(userAlphaMember1))
      .send({ content: 'Intrusión no autorizada' });

    assert.strictEqual(res.status, 403);
    assert.ok(res.body.error.includes('No perteneces a este grupo') || res.body.error.includes('No tienes acceso'));
  });

  it('4.2 Aislamiento multi-tenant: Usuario de Org Beta no puede acceder a chat ni usuarios de Org Alpha (404)', async () => {
    // Usuario de Beta intenta enviar mensaje directo a Valeria de Alpha
    const res = await request(app)
      .post('/api/messages')
      .set('x-test-user', JSON.stringify(userBetaMember))
      .send({
        receiver_id: userAlphaMember1.id,
        content: 'Ataque cross-tenant'
      });

    assert.strictEqual(res.status, 404);
    assert.ok(res.body.error.includes('no existe') || res.body.error.includes('inactivo'));
  });

  // -------------------------------------------------------------
  // REQUISITO 5: Edición de Mensajes (Solo autor)
  // -------------------------------------------------------------
  it('5.1 Permite editar mensaje al autor y actualiza edited_at', async () => {
    const originalMsg = {
      id: 801,
      sender_id: userAlphaMember1.id,
      receiver_id: userAlphaMember2.id,
      organization_id: orgAlpha.id,
      conversation_type: 'direct',
      content: 'Texto original con typo',
      is_deleted: false,
      edited_at: null,
      created_at: new Date().toISOString()
    };
    messages.push(originalMsg);

    const res = await request(app)
      .put(`/api/messages/${originalMsg.id}`)
      .set('x-test-user', JSON.stringify(userAlphaMember1))
      .send({ content: 'Texto corregido sin errores' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.message.content, 'Texto corregido sin errores');
    assert.ok(res.body.message.edited_at);
  });

  it('5.2 Rechaza editar mensaje por un usuario que no es el autor (403)', async () => {
    const originalMsg = {
      id: 802,
      sender_id: userAlphaMember1.id,
      receiver_id: userAlphaMember2.id,
      organization_id: orgAlpha.id,
      conversation_type: 'direct',
      content: 'Mensaje de Valeria',
      is_deleted: false,
      edited_at: null,
      created_at: new Date().toISOString()
    };
    messages.push(originalMsg);

    // Carlos intenta editar el mensaje de Valeria
    const res = await request(app)
      .put(`/api/messages/${originalMsg.id}`)
      .set('x-test-user', JSON.stringify(userAlphaMember2))
      .send({ content: 'Modificación maliciosa' });

    assert.strictEqual(res.status, 403);
    assert.ok(res.body.error.includes('editar tus propios mensajes'));
  });

  // -------------------------------------------------------------
  // REQUISITO 6: Soft Delete de Mensajes
  // -------------------------------------------------------------
  it('6.1 Autor o Admin puede eliminar mensaje (soft delete)', async () => {
    const msg = {
      id: 901,
      sender_id: userAlphaMember1.id,
      receiver_id: userAlphaMember2.id,
      organization_id: orgAlpha.id,
      conversation_type: 'direct',
      content: 'Mensaje a ser borrado',
      is_deleted: false,
      created_at: new Date().toISOString()
    };
    messages.push(msg);

    const res = await request(app)
      .delete(`/api/messages/${msg.id}`)
      .set('x-test-user', JSON.stringify(userAlphaMember1));

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.is_deleted, true);

    const stored = messages.find(m => m.id === 901);
    assert.strictEqual(stored.is_deleted, true);
    assert.strictEqual(stored.content, '[Mensaje eliminado]');
  });

  // -------------------------------------------------------------
  // REQUISITO 7: Reacciones con Emojis
  // -------------------------------------------------------------
  it('7.1 Agrega y remueve (toggle) reacciones con emojis', async () => {
    const msg = {
      id: 950,
      sender_id: userAlphaMember1.id,
      receiver_id: userAlphaMember2.id,
      organization_id: orgAlpha.id,
      conversation_type: 'direct',
      content: '¡Gran trabajo equipo!',
      is_deleted: false,
      created_at: new Date().toISOString()
    };
    messages.push(msg);

    // 1. Agregar reacción 👍
    const res1 = await request(app)
      .post(`/api/messages/${msg.id}/reactions`)
      .set('x-test-user', JSON.stringify(userAlphaMember2))
      .send({ reaction: '👍' });

    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res1.body.action, 'added');
    assert.strictEqual(messageReactions.length, 1);

    // 2. Enviar la misma reacción de nuevo (toggle off)
    const res2 = await request(app)
      .post(`/api/messages/${msg.id}/reactions`)
      .set('x-test-user', JSON.stringify(userAlphaMember2))
      .send({ reaction: '👍' });

    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.body.action, 'removed');
    assert.strictEqual(messageReactions.length, 0);
  });

  // -------------------------------------------------------------
  // REQUISITO 8: Fijar Mensajes (Pinning)
  // -------------------------------------------------------------
  it('8.1 Permite fijar y desfijar mensajes en una conversación', async () => {
    const msg = {
      id: 960,
      sender_id: userAlphaMember1.id,
      receiver_id: userAlphaMember2.id,
      organization_id: orgAlpha.id,
      conversation_type: 'direct',
      content: 'Acuerdo clave del sprint',
      is_pinned: false,
      is_deleted: false,
      created_at: new Date().toISOString()
    };
    messages.push(msg);

    // 1. Fijar
    const resPin = await request(app)
      .post(`/api/messages/${msg.id}/pin`)
      .set('x-test-user', JSON.stringify(userAlphaMember1));

    assert.strictEqual(resPin.status, 200);
    assert.strictEqual(resPin.body.is_pinned, true);
    assert.strictEqual(msg.is_pinned, true);

    // 2. Desfijar
    const resUnpin = await request(app)
      .post(`/api/messages/${msg.id}/pin`)
      .set('x-test-user', JSON.stringify(userAlphaMember1));

    assert.strictEqual(resUnpin.status, 200);
    assert.strictEqual(resUnpin.body.is_pinned, false);
    assert.strictEqual(msg.is_pinned, false);
  });

  // -------------------------------------------------------------
  // REQUISITO 9: Preferencias de Conversación (Silenciar / Archivar)
  // -------------------------------------------------------------
  it('9.1 Guarda preferencias de conversación (silenciar, archivar)', async () => {
    const res = await request(app)
      .put('/api/messages/preferences')
      .set('x-test-user', JSON.stringify(userAlphaMember1))
      .send({
        conversation_type: 'direct',
        target_id: userAlphaMember2.id,
        is_muted: true,
        is_archived: false
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
    assert.strictEqual(res.body.is_muted, true);
  });

  // -------------------------------------------------------------
  // REQUISITO 10: Búsqueda de Mensajes
  // -------------------------------------------------------------
  it('10.1 Permite buscar mensajes por texto', async () => {
    messages.push({
      id: 970,
      sender_id: userAlphaMember1.id,
      receiver_id: userAlphaMember2.id,
      organization_id: orgAlpha.id,
      conversation_type: 'direct',
      content: 'Presupuesto final aprobado',
      is_pinned: false,
      is_deleted: false,
      created_at: new Date().toISOString()
    });

    const res = await request(app)
      .get('/api/messages/search?q=presupuesto')
      .set('x-test-user', JSON.stringify(userAlphaMember1));

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.strictEqual(res.body.length, 1);
    assert.strictEqual(res.body[0].id, 970);
  });
});
