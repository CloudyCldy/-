process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'playwright-isolated-test-secret';
process.env.DATABASE_URL = 'postgresql://playwright:playwright@127.0.0.1:1/haitani_e2e';
process.env.PGHOST = '127.0.0.1';
process.env.PGPORT = '1';
process.env.PGDATABASE = 'haitani_e2e';
process.env.PGUSER = 'playwright';
process.env.PGPASSWORD = 'playwright';
delete process.env.TEST_DATABASE_URL;

const app = require('../../app');
const bcrypt = require('bcryptjs');

const testPasswordHash = bcrypt.hashSync('password123', 4);

// Entidades base de prueba para E2E
const e2eUsers = [
  {
    id: 101,
    username: 'admin_test',
    email: 'admin@test.local',
    name: 'Admin Playwright',
    password: testPasswordHash,
    role: 'admin',
    organization_id: 1,
    active: 1,
    email_verified: true,
    last_seen_at: new Date().toISOString()
  },
  {
    id: 102,
    username: 'valeria',
    email: 'valeria@empresa.com',
    name: 'Valeria Gómez',
    password: testPasswordHash,
    role: 'member',
    organization_id: 1,
    active: 1,
    email_verified: true,
    last_seen_at: new Date().toISOString()
  },
  {
    id: 103,
    username: 'carlos',
    email: 'carlos@empresa.com',
    name: 'Carlos Mendoza',
    password: testPasswordHash,
    role: 'member',
    organization_id: 1,
    active: 1,
    email_verified: true,
    last_seen_at: new Date().toISOString()
  },
  {
    id: 991,
    username: 'pending-user',
    email: 'pending-user@empresa.com',
    name: 'Pending User',
    password: testPasswordHash,
    role: 'admin',
    organization_id: 881,
    active: 1
  },
  {
    id: 992,
    username: 'suspended-user',
    email: 'suspended-user@empresa.com',
    name: 'Suspended User',
    password: testPasswordHash,
    role: 'admin',
    organization_id: 882,
    active: 1
  }
];

const e2eGroups = [
  {
    id: 1,
    organization_id: 1,
    name: 'Lanzamiento Q4',
    description: 'Coordinación del lanzamiento',
    project_id: 1,
    avatar_url: null,
    created_by: 101,
    created_at: new Date(Date.now() - 86400000).toISOString()
  }
];

const e2eGroupMembers = [
  { group_id: 1, user_id: 101, organization_id: 1, role: 'admin', last_read_at: new Date().toISOString() },
  { group_id: 1, user_id: 102, organization_id: 1, role: 'member', last_read_at: new Date().toISOString() },
  { group_id: 1, user_id: 103, organization_id: 1, role: 'member', last_read_at: new Date().toISOString() }
];

let e2eMessages = [
  {
    id: 1,
    sender_id: 102,
    receiver_id: 101,
    organization_id: 1,
    conversation_type: 'direct',
    content: 'Hola, ¿revisaste el avance del sprint?',
    delivery_status: 'leido',
    message_type: 'text',
    is_pinned: false,
    is_deleted: false,
    edited_at: null,
    created_at: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 2,
    sender_id: 101,
    receiver_id: 102,
    organization_id: 1,
    conversation_type: 'direct',
    content: 'Sí, todo aprobado para producción.',
    delivery_status: 'leido',
    message_type: 'text',
    is_pinned: false,
    is_deleted: false,
    edited_at: null,
    created_at: new Date(Date.now() - 1800000).toISOString()
  },
  {
    id: 3,
    sender_id: 102,
    receiver_id: 101,
    organization_id: 1,
    conversation_type: 'direct',
    content: 'Excelente, notifico al cliente.',
    delivery_status: 'entregado',
    message_type: 'text',
    is_pinned: false,
    is_deleted: false,
    edited_at: null,
    created_at: new Date(Date.now() - 120000).toISOString()
  },
  {
    id: 4,
    sender_id: 103,
    receiver_id: null,
    group_id: 1,
    organization_id: 1,
    conversation_type: 'group',
    content: 'Reunión de sincronización a las 4 PM',
    delivery_status: 'enviado',
    message_type: 'text',
    is_pinned: false,
    is_deleted: false,
    edited_at: null,
    created_at: new Date(Date.now() - 60000).toISOString()
  }
];

let e2eReactions = [];
let e2eMsgIdCounter = 100;

app.locals.database = {
  prepare(query) {
    const s = query.toLowerCase().replace(/\s+/g, ' ');
    return {
      async all(...params) {
        if (s.includes('from blocked_ips')) return [];

        // Direct conversations (contactos de la organización)
        if (s.includes('from users u') && s.includes('conversation_preferences cp') && s.includes("conversation_type = 'direct'")) {
          const currentId = params[0] || 101;
          const orgId = params[1] || 1;
          return e2eUsers
            .filter(u => u.organization_id === Number(orgId) && u.id !== Number(currentId))
            .map(u => ({
              id: u.id,
              name: u.name,
              username: u.username,
              email: u.email,
              profile_photo: null,
              role: u.role,
              last_seen_at: u.last_seen_at || new Date().toISOString(),
              is_muted: false,
              is_archived: false,
              is_pinned: false
            }));
        }

        // Conteo de no leídos directos
        if (s.includes('select sender_id, count(*)::integer as unread_count from messages')) {
          const currentId = params[1] || 101;
          const orgId = params[0] || 1;
          const unreads = {};
          for (const m of e2eMessages) {
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
          const currentId = params[0] || 101;
          const orgId = params[1] || 1;
          const partnerLastMsg = new Map();
          for (const m of e2eMessages) {
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
          const currentId = params[0] || 101;
          const orgId = params[1] || 1;
          const userMemberships = e2eGroupMembers.filter(m => m.user_id === Number(currentId) && m.organization_id === Number(orgId));
          const myGroupIds = new Set(userMemberships.map(m => m.group_id));

          return e2eGroups
            .filter(g => g.organization_id === Number(orgId) && myGroupIds.has(g.id))
            .map(g => {
              const myMem = userMemberships.find(m => m.group_id === g.id);
              const count = e2eGroupMembers.filter(m => m.group_id === g.id).length;
              return {
                id: g.id,
                name: g.name,
                description: g.description,
                avatar_url: g.avatar_url,
                project_id: g.project_id,
                created_at: g.created_at,
                created_by: g.created_by,
                project_name: 'Proyecto Alpha',
                my_role: myMem?.role || 'admin',
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
          const term = (params[1] || '').replace(/%/g, '').toLowerCase();
          return e2eMessages
            .filter(m => (m.content || '').toLowerCase().includes(term))
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

        // Historial de mensajes en chat activo
        if (s.includes('from messages m') && s.includes('join users u on u.id = m.sender_id') && s.includes('m.organization_id = ?')) {
          const orgId = params[0] || 1;
          let filtered = e2eMessages.filter(m => m.organization_id === Number(orgId));

          if (s.includes("m.conversation_type = 'direct'")) {
            if (params.length >= 5) {
              const [, s1, r1, s2, r2] = params;
              filtered = filtered.filter(m =>
                m.conversation_type === 'direct' &&
                ((m.sender_id === Number(s1) && m.receiver_id === Number(r1)) ||
                 (m.sender_id === Number(s2) && m.receiver_id === Number(r2)))
              );
            }
          } else if (s.includes("m.conversation_type = 'group'")) {
            const gid = params[1] || 1;
            filtered = filtered.filter(m => m.conversation_type === 'group' && m.group_id === Number(gid));
          }

          return filtered.map(m => {
            const sender = e2eUsers.find(u => u.id === m.sender_id);
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
              sender_name: sender ? sender.name : 'Usuario',
              sender_photo: null
            };
          });
        }

        // Reacciones de mensajes
        if (s.includes('from message_reactions r') && s.includes('join users u on u.id = r.user_id')) {
          return e2eReactions.map(r => {
            const u = e2eUsers.find(x => x.id === r.user_id);
            return {
              message_id: r.message_id,
              reaction: r.reaction,
              user_id: r.user_id,
              user_name: u ? u.name : 'Usuario'
            };
          });
        }

        // Miembros de un grupo
        if (s.includes('from chat_group_members gm join users u on u.id = gm.user_id')) {
          const gid = params[0] || 1;
          return e2eGroupMembers
            .filter(m => m.group_id === Number(gid))
            .map(m => {
              const u = e2eUsers.find(x => x.id === m.user_id);
              return {
                id: u.id,
                name: u.name,
                username: u.username,
                email: u.email,
                profile_photo: null,
                group_role: m.role,
                joined_at: new Date().toISOString(),
                last_seen_at: u.last_seen_at || new Date().toISOString()
              };
            });
        }

        // Mensajes fijados
        if (s.includes('where m.organization_id = ? and m.is_pinned = true')) {
          return e2eMessages.filter(m => m.is_pinned).map(m => ({ ...m, sender_name: 'Valeria Gómez', pinned_by_name: 'Admin' }));
        }

        // Usuarios activos
        if (s.includes('from users') && s.includes('active = 1')) {
          return e2eUsers.filter(u => u.organization_id === 1);
        }

        // Proyectos
        if (s.includes('from projects')) {
          return [{ id: 1, name: 'Proyecto Alpha', organization_id: 1, status: 'planning', methodology_id: 'SCRUM' }];
        }

        return [];
      },

      async get(...params) {
        // Conteos generales
        if (s.includes('select count(*)::integer as count')) {
          return { count: 0 };
        }

        // Login por usuario o email
        if (s.includes('from users') && s.includes('where (username = ? or email = ?)')) {
          const val = params[0];
          return e2eUsers.find(u => u.username === val || u.email === val) || null;
        }

        // Usuario por id
        if (s.includes('from users') && (s.includes('where users.id = ?') || s.includes('where id = ?'))) {
          const id = params[0];
          const u = e2eUsers.find(x => x.id === Number(id));
          if (u) {
            return {
              ...u,
              organization_name: 'Haitani Enterprise',
              organization_slug: 'haitani-ent',
              organization_status: u.organization_id === 881 ? 'pending' : (u.organization_id === 882 ? 'suspended' : 'approved')
            };
          }
          return null;
        }

        // Organizaciones
        if (s.includes('from organizations where id = ?')) {
          const orgId = params[0];
          if (orgId === 881) return { id: 881, status: 'pending', name: 'Pending Enterprise Inc.' };
          if (orgId === 882) return { id: 882, status: 'suspended', name: 'Suspended Corp.' };
          return { id: orgId, status: 'approved', name: 'Haitani Enterprise', plan_id: 1, subscription_status: 'active' };
        }

        // Planes
        if (s.includes('from plans')) {
          return { id: 1, key: 'pro', name: 'Pro Enterprise', max_users: 100, max_projects: 50, max_storage_mb: 10240, features: {}, subscription_status: 'active' };
        }

        // Proyectos
        if (s.includes('from projects where id = ?')) {
          return { id: 1, name: 'Proyecto Alpha', organization_id: 1 };
        }

        // Membresía en grupo
        if (s.includes('from chat_group_members where group_id = ? and user_id = ?')) {
          const [gid, uid] = params;
          return e2eGroupMembers.find(m => m.group_id === Number(gid) && m.user_id === Number(uid)) || null;
        }

        // Detalle de grupo
        if (s.includes('from chat_groups') && (s.includes('where id = ?') || s.includes('g.id = ?'))) {
          const gid = params[0] || 1;
          const g = e2eGroups.find(item => item.id === Number(gid));
          if (!g) return null;
          return {
            id: g.id,
            name: g.name,
            description: g.description,
            avatar_url: g.avatar_url,
            project_id: g.project_id,
            project_name: 'Proyecto Alpha',
            created_at: g.created_at,
            created_by: g.created_by,
            my_role: 'admin',
            members_count: 3
          };
        }

        // Mensaje por id
        if (s.includes('from messages where id = ?')) {
          const mid = params[0];
          return e2eMessages.find(m => m.id === Number(mid)) || null;
        }

        // Reacción existente
        if (s.includes('from message_reactions where message_id = ? and user_id = ? and reaction = ?')) {
          const [mid, uid, reaction] = params;
          const r = e2eReactions.find(item => item.message_id === Number(mid) && item.user_id === Number(uid) && item.reaction === reaction);
          return r ? { id: r.id } : null;
        }

        return null;
      },

      async run(...params) {
        // Enviar mensaje
        if (s.includes('insert into messages')) {
          const newMsg = {
            id: ++e2eMsgIdCounter,
            sender_id: params[0],
            receiver_id: params[1],
            organization_id: params[2],
            content: params[3],
            delivery_status: params[4] || 'enviado',
            conversation_type: params[5] || 'direct',
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
          e2eMessages.push(newMsg);
          return { changes: 1, lastInsertRowid: newMsg.id, rows: [newMsg] };
        }

        // Marcar leídos
        if (s.includes("update messages set delivery_status = 'leido'")) {
          return { changes: 1 };
        }

        // Soft delete
        if (s.includes('update messages set is_deleted = true')) {
          const mid = params[params.length - 1];
          const m = e2eMessages.find(x => x.id === Number(mid));
          if (m) {
            m.is_deleted = true;
            m.content = '[Mensaje eliminado]';
          }
          return { changes: 1 };
        }

        // Editar
        if (s.includes('update messages set content = ?')) {
          const mid = params[1];
          const m = e2eMessages.find(x => x.id === Number(mid));
          if (m) {
            m.content = params[0];
            m.edited_at = new Date().toISOString();
          }
          return { changes: 1 };
        }

        // Pin
        if (s.includes('update messages set is_pinned = ?')) {
          const mid = params[params.length - 1];
          const m = e2eMessages.find(x => x.id === Number(mid));
          if (m) {
            m.is_pinned = params[0];
          }
          return { changes: 1 };
        }

        // Reacciones
        if (s.includes('insert into message_reactions')) {
          e2eReactions.push({ id: ++e2eMsgIdCounter, message_id: Number(params[0]), user_id: Number(params[1]), reaction: params[2] });
          return { changes: 1 };
        }

        if (s.includes('delete from message_reactions where id = ?')) {
          const idx = e2eReactions.findIndex(r => r.id === Number(params[0]));
          if (idx !== -1) e2eReactions.splice(idx, 1);
          return { changes: 1 };
        }

        return { changes: 1, lastInsertRowid: 1 };
      }
    };
  }
};

const port = Number(process.env.PLAYWRIGHT_PORT || 4173);
app.server.listen(port, '127.0.0.1', () => {
  console.log(`Playwright test server listening on http://127.0.0.1:${port}`);
});

app.server.on('error', error => {
  console.error('Playwright test server failed to start:', error);
  process.exitCode = 1;
});
