process.env.NODE_ENV = 'test';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const fs = require('fs');
const app = require('../app');

describe('SB-12: Chatbot contextual con historial de conversaciones', () => {
  let originalDatabase = null;

  const orgA = { id: 1, name: 'Organización Sakura Alpha', slug: 'sakura-alpha' };
  const orgB = { id: 2, name: 'Organización Beta Corp', slug: 'beta-corp' };

  const adminA = { id: 101, username: 'admin_sakura', name: 'Carlos Daniel', role: 'admin', organization_id: orgA.id };
  const memberA = { id: 102, username: 'member_sakura', name: 'Alberto Jiménez', role: 'member', organization_id: orgA.id };
  const adminB = { id: 201, username: 'admin_beta', name: 'Usuario Beta', role: 'admin', organization_id: orgB.id };

  const projectA = {
    id: 1,
    organization_id: orgA.id,
    name: 'Sakura Coffee System',
    methodology_id: 'SCRUM',
    description: 'Plataforma integral de gestión de cafeterías',
    requirements: 'Requerimientos de alta disponibilidad y gestión de pedidos',
    budget: 50000.00
  };

  const tasksData = [
    { id: 1, organization_id: orgA.id, project_id: projectA.id, title: 'Diseño de arquitectura y base de datos', status: 'completada', priority: 'alta', due_date: '2026-09-01', assignee_name: 'Carlos Daniel' },
    { id: 2, organization_id: orgA.id, project_id: projectA.id, title: 'Implementación de pasarela de pagos', status: 'en_proceso', priority: 'critica', due_date: '2026-09-10', assignee_name: 'Alberto Jiménez' }, // Vencida
    { id: 3, organization_id: orgA.id, project_id: projectA.id, title: 'Desarrollo de módulo de reportes', status: 'bloqueada', priority: 'alta', due_date: '2026-12-15', assignee_name: 'Carlos Daniel' },
    { id: 4, organization_id: orgA.id, project_id: projectA.id, title: 'Pruebas E2E de chat', status: 'pendiente', priority: 'media', due_date: '2026-12-31', assignee_name: null }
  ];

  const risksData = [
    { id: 1, title: 'Retraso en homologación de pagos', probability: 'alta', impact: 'alta', status: 'open', mitigation: 'Plan de contingencia con pasarela secundaria', severity_score: 80 }
  ];

  const methodologyScrum = {
    id: 'SCRUM',
    name: 'Scrum',
    description: 'Framework ágil iterativo basado en sprints de 1 a 4 semanas con entregas continuas de valor.',
    category: 'agile',
    principles: JSON.stringify(['Transparencia', 'Inspección', 'Adaptación']),
    practices: JSON.stringify(['Sprint Planning', 'Daily Standup', 'Sprint Review', 'Sprint Retrospective'])
  };

  const inMemoryDb = {
    conversations: [],
    messages: []
  };

  function createMockDb() {
    return {
      prepare(sql) {
        const s = sql.toLowerCase().replace(/\s+/g, ' ');
        return {
          async get(...params) {
            if (s.includes('from projects') && s.includes('where id = ? and organization_id = ?')) {
              const [pId, orgId] = params;
              return (pId === projectA.id && orgId === orgA.id) ? projectA : null;
            }
            if (s.includes('from projects') && s.includes('where organization_id = ?')) {
              const [orgId] = params;
              return orgId === orgA.id ? projectA : null;
            }
            if (s.includes('from methodologies') && s.includes('where id = ?')) {
              const [mId] = params;
              return mId === 'SCRUM' ? methodologyScrum : null;
            }
            if (s.includes('from github_project_configurations')) {
              return { repository: 'SakuraCoffeeRepo' };
            }
            if (s.includes('from users') && (s.includes('where users.id = ?') || s.includes('where id = ?'))) {
              const [id] = params;
              if (id === adminA.id) return { ...adminA, password: 'hashed' };
              if (id === memberA.id) return { ...memberA, password: 'hashed' };
              if (id === adminB.id) return { ...adminB, password: 'hashed' };
              return null;
            }
            if (s.includes('from chatbot_conversations') && s.includes('where id = ? and organization_id = ?')) {
              const [cId, orgId] = params;
              return inMemoryDb.conversations.find(c => c.id === cId && c.organization_id === orgId) || null;
            }
            return null;
          },
          async all(...params) {
            if (s.includes('from tasks') && s.includes('where tasks.organization_id = ?')) {
              const [orgId] = params;
              if (orgId !== orgA.id) return [];
              return tasksData.map(t => ({
                id: t.id,
                title: t.title,
                description: 'Tarea de desarrollo',
                status: t.status,
                priority: t.priority,
                due_date: t.due_date,
                assignee_name: t.assignee_name
              }));
            }
            if (s.includes('from users') && s.includes('where organization_id = ?')) {
              const [orgId] = params;
              if (orgId !== orgA.id) return [];
              return [
                { id: adminA.id, name: adminA.name, role: adminA.role, active: 1 },
                { id: memberA.id, name: memberA.name, role: memberA.role, active: 1 }
              ];
            }
            if (s.includes('from project_risks') && s.includes('where organization_id = ?')) {
              const [orgId] = params;
              return orgId === orgA.id ? risksData : [];
            }
            if (s.includes('from sprints')) {
              return [
                { id: 1, name: 'Sprint 2 - Pasarela y Chat', goal: 'Completar integración y chatbot', start_date: '2026-10-20', end_date: '2026-11-10', status: 'activo' }
              ];
            }
            if (s.includes('from project_milestones')) {
              return [
                { id: 1, title: 'Hito MVP', description: 'Primer release funcional', due_date: '2026-11-20', status: 'pendiente' }
              ];
            }
            if (s.includes('from project_issues')) {
              return [
                { id: 1, title: 'Incompatibilidad de webhook', status: 'abierto', priority: 'alta', severity: 'alta' }
              ];
            }
            if (s.includes('from chatbot_conversations') && s.includes('where c.organization_id = ? and c.user_id = ?')) {
              const [orgId, uId] = params;
              return inMemoryDb.conversations
                .filter(c => c.organization_id === orgId && c.user_id === uId)
                .map(c => {
                  const msgs = inMemoryDb.messages.filter(m => m.conversation_id === c.id);
                  return {
                    id: c.id,
                    title: c.title,
                    project_id: c.project_id,
                    created_at: c.created_at,
                    updated_at: c.updated_at,
                    message_count: msgs.length,
                    last_message: msgs.length ? msgs[msgs.length - 1].message : ''
                  };
                });
            }
            if (s.includes('from chatbot_messages') && s.includes('where conversation_id = ? and organization_id = ?')) {
              const [cId, orgId] = params;
              return inMemoryDb.messages
                .filter(m => m.conversation_id === cId && m.organization_id === orgId)
                .map(m => ({
                  id: m.id,
                  sender: m.sender,
                  message: m.message,
                  source: m.source,
                  created_at: m.created_at
                }));
            }
            return [];
          },
          async run(...params) {
            if (s.includes('insert into chatbot_conversations')) {
              const [id, orgId, userId, projectId, title] = params;
              const conv = {
                id,
                organization_id: orgId,
                user_id: userId,
                project_id: projectId,
                title,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
              inMemoryDb.conversations.push(conv);
              return { changes: 1 };
            }
            if (s.includes('insert into chatbot_messages')) {
              const [cId, orgId, sender, message, source] = params;
              const msg = {
                id: inMemoryDb.messages.length + 1,
                conversation_id: cId,
                organization_id: orgId,
                sender,
                message,
                source,
                created_at: new Date().toISOString()
              };
              inMemoryDb.messages.push(msg);
              return { changes: 1 };
            }
            if (s.includes('delete from chatbot_conversations') && s.includes('where id = ? and organization_id = ?')) {
              const [cId, orgId] = params;
              const idx = inMemoryDb.conversations.findIndex(c => c.id === cId && c.organization_id === orgId);
              if (idx !== -1) {
                inMemoryDb.conversations.splice(idx, 1);
                inMemoryDb.messages = inMemoryDb.messages.filter(m => m.conversation_id !== cId);
                return { changes: 1 };
              }
              return { changes: 0 };
            }
            if (s.includes('update chatbot_conversations set title =')) {
              const [title, cId, orgId] = params;
              const conv = inMemoryDb.conversations.find(c => c.id === cId && c.organization_id === orgId);
              if (conv) {
                conv.title = title;
                conv.updated_at = new Date().toISOString();
              }
              return { changes: 1 };
            }
            if (s.includes('update chatbot_conversations set updated_at =')) {
              const [cId, orgId] = params;
              const conv = inMemoryDb.conversations.find(c => c.id === cId && c.organization_id === orgId);
              if (conv) conv.updated_at = new Date().toISOString();
              return { changes: 1 };
            }
            return { changes: 1 };
          }
        };
      }
    };
  }

  before(() => {
    originalDatabase = app.locals.database;
    app.locals.database = createMockDb();
    inMemoryDb.conversations = [];
    inMemoryDb.messages = [];
  });

  after(() => {
    app.locals.database = originalDatabase;
  });

  describe('Criterio 1: POST /chatbot/message responde considerando el contexto real (tareas, métricas, metodología)', () => {
    it('1.1 Rechaza peticiones sin autenticación (401)', async () => {
      const res = await request(app)
        .post('/chatbot/message')
        .send({ message: 'Hola' });
      assert.strictEqual(res.status, 401);
    });

    it('1.2 Rechaza mensajes vacíos con error 400', async () => {
      const res = await request(app)
        .post('/chatbot/message')
        .set('x-test-user', JSON.stringify(adminA))
        .send({ message: '   ' });
      assert.strictEqual(res.status, 400);
      assert.ok(res.body.error);
    });

    it('1.3 Responde considerando el estado real de las tareas del proyecto', async () => {
      const res = await request(app)
        .post('/chatbot/message')
        .set('x-test-user', JSON.stringify(adminA))
        .send({ message: '¿Cuáles son las tareas y cuál es su estado actual?' });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.source, 'local');
      assert.ok(res.body.answer);

      // Valida que reconozca el proyecto, metodología y desglose de tareas
      assert.ok(res.body.answer.includes('Sakura Coffee System'));
      assert.ok(res.body.answer.includes('Total registradas: 4'));
      assert.ok(res.body.answer.includes('Abiertas: 3'));
      assert.ok(res.body.answer.includes('Completadas: 1'));
      assert.ok(res.body.answer.includes('Con retraso: 1'));
    });

    it('1.4 Responde considerando las métricas y KPIs reales del proyecto', async () => {
      const res = await request(app)
        .post('/chatbot/message')
        .set('x-test-user', JSON.stringify(adminA))
        .send({ message: '¿Cuáles son las métricas de rendimiento y salud del proyecto?' });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.answer);

      // 1 de 4 tareas = 25%
      assert.ok(res.body.answer.includes('Métricas y KPIs clave'));
      assert.ok(res.body.answer.includes('Tasa de avance (Completion Rate): 25%'));
      assert.ok(res.body.answer.includes('Cumplimiento de plazos (On-Time Delivery): 67%'));
      assert.ok(res.body.answer.includes('Tareas críticas en cola: 2'));
      assert.ok(res.body.answer.includes('Estado de Salud del Proyecto:'));
    });

    it('1.5 Responde considerando la metodología real asignada al proyecto (Scrum, principios y prácticas)', async () => {
      const res = await request(app)
        .post('/chatbot/message')
        .set('x-test-user', JSON.stringify(adminA))
        .send({ message: '¿Cómo funciona la metodología Scrum adoptada en este proyecto?' });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.answer);

      assert.ok(res.body.answer.includes('Metodología del proyecto'));
      assert.ok(res.body.answer.includes('Scrum'));
      assert.ok(res.body.answer.includes('Transparencia, Inspección, Adaptación'));
      assert.ok(res.body.answer.includes('Sprint Planning, Daily Standup'));
      assert.ok(res.body.answer.includes('Sprint 2 - Pasarela y Chat'));
    });

    it('1.6 POST /api/chatbot/message funciona de forma idéntica a /chatbot/message', async () => {
      const res = await request(app)
        .post('/api/chatbot/message')
        .set('x-test-user', JSON.stringify(memberA))
        .send({ message: '¿Cuáles son las tareas críticas?' });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.answer.includes('tarea(s) crítica(s)'));
      assert.ok(res.body.answer.includes('Implementación de pasarela de pagos'));
    });
  });

  describe('Criterio 2: El historial de conversaciones se puede consultar y eliminar por conversación', () => {
    let convId1 = 'conv-test-101';
    let convId2 = 'conv-test-102';

    it('2.1 Guarda y asocia los mensajes a una conversación persistente', async () => {
      const res1 = await request(app)
        .post('/chatbot/message')
        .set('x-test-user', JSON.stringify(adminA))
        .send({ message: '¿Qué tareas están vencidas en el proyecto?', conversationId: convId1 });

      assert.strictEqual(res1.status, 200);
      assert.strictEqual(res1.body.conversationId, convId1);

      const res2 = await request(app)
        .post('/chatbot/message')
        .set('x-test-user', JSON.stringify(adminA))
        .send({ message: 'Dame un resumen para la reunión de hoy', conversationId: convId1 });

      assert.strictEqual(res2.status, 200);
      assert.strictEqual(res2.body.conversationId, convId1);

      // Crear segunda conversación
      const res3 = await request(app)
        .post('/chatbot/message')
        .set('x-test-user', JSON.stringify(adminA))
        .send({ message: '¿Cuáles son los riesgos identificados?', conversationId: convId2 });

      assert.strictEqual(res3.status, 200);
      assert.strictEqual(res3.body.conversationId, convId2);
    });

    it('2.2 Consulta la lista de conversaciones del usuario (GET /api/chatbot/conversations)', async () => {
      const res = await request(app)
        .get('/api/chatbot/conversations')
        .set('x-test-user', JSON.stringify(adminA));

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.conversations));
      assert.ok(res.body.conversations.length >= 2);

      const c1 = res.body.conversations.find(c => c.id === convId1);
      assert.ok(c1, 'Debe encontrar la conversación 1 en el historial');
      assert.ok(c1.message_count >= 4, 'La conversación 1 debe tener 2 preguntas y 2 respuestas');

      const c2 = res.body.conversations.find(c => c.id === convId2);
      assert.ok(c2, 'Debe encontrar la conversación 2 en el historial');
    });

    it('2.3 Consulta el detalle y mensajes de una conversación específica (GET /api/chatbot/conversations/:id)', async () => {
      const res = await request(app)
        .get(`/api/chatbot/conversations/${convId1}`)
        .set('x-test-user', JSON.stringify(adminA));

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.conversation.id, convId1);
      assert.ok(Array.isArray(res.body.messages));
      assert.strictEqual(res.body.messages.length, 4);

      // Verifica orden cronológico y remitentes
      assert.strictEqual(res.body.messages[0].sender, 'user');
      assert.strictEqual(res.body.messages[1].sender, 'bot');
      assert.strictEqual(res.body.messages[2].sender, 'user');
      assert.strictEqual(res.body.messages[3].sender, 'bot');
    });

    it('2.4 Elimina una conversación específica por su ID (DELETE /api/chatbot/conversations/:id)', async () => {
      const resDelete = await request(app)
        .delete(`/api/chatbot/conversations/${convId1}`)
        .set('x-test-user', JSON.stringify(adminA));

      assert.strictEqual(resDelete.status, 200);
      assert.strictEqual(resDelete.body.success, true);

      // Comprobar que convId1 ya no existe
      const resGet = await request(app)
        .get(`/api/chatbot/conversations/${convId1}`)
        .set('x-test-user', JSON.stringify(adminA));

      assert.strictEqual(resGet.status, 404);

      // Comprobar que convId2 permanece intacta
      const resList = await request(app)
        .get('/api/chatbot/conversations')
        .set('x-test-user', JSON.stringify(adminA));

      const ids = resList.body.conversations.map(c => c.id);
      assert.ok(!ids.includes(convId1), 'La conversación 1 ya no debe figurar en la lista');
      assert.ok(ids.includes(convId2), 'La conversación 2 debe conservarse');
    });

    it('2.5 Permite crear una nueva conversación explícita (POST /api/chatbot/conversations)', async () => {
      const res = await request(app)
        .post('/api/chatbot/conversations')
        .set('x-test-user', JSON.stringify(adminA))
        .send({ title: 'Planificación Q1 2027' });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.conversation.title, 'Planificación Q1 2027');
      assert.ok(res.body.conversation.id);
    });
  });

  describe('Criterio 3: Seguridad Multi-Tenant y funcionamiento autónomo sin claves externas', () => {
    it('3.1 Aislamiento Multi-Tenant: Usuario de Organización B no puede ver ni consultar conversaciones de Org A', async () => {
      const res = await request(app)
        .get(`/api/chatbot/conversations/conv-test-102`)
        .set('x-test-user', JSON.stringify(adminB));

      assert.strictEqual(res.status, 404, 'No debe permitir acceso entre organizaciones distintas');
    });

    it('3.2 Aislamiento Multi-Tenant: Usuario de Organización B no puede eliminar conversaciones de Org A', async () => {
      const res = await request(app)
        .delete(`/api/chatbot/conversations/conv-test-102`)
        .set('x-test-user', JSON.stringify(adminB));

      assert.strictEqual(res.status, 404);
    });

    it('3.3 El motor determinístico funciona sin requerir claves de proveedores de IA externos', async () => {
      const res = await request(app)
        .post('/chatbot/message')
        .set('x-test-user', JSON.stringify(memberA))
        .send({ message: '¿Cómo está la carga de trabajo (workload)?' });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.source, 'local', 'Debe operar con motor local propio');
      assert.ok(res.body.answer.includes('Distribución de carga de trabajo (Workload)'));
      assert.ok(res.body.answer.includes('Carlos Daniel'));
      assert.ok(res.body.answer.includes('Alberto Jiménez'));
    });
  });

  describe('Criterio 4: Verificación de Integración en Frontend (app.js y style.css)', () => {
    it('4.1 La interfaz en app.js incluye el contenedor y panel lateral de historial de conversaciones', () => {
      const appJs = fs.readFileSync('public/js/app.js', 'utf8');

      assert.ok(appJs.includes('assistant-container'), 'Debe incluir el contenedor assistant-container');
      assert.ok(appJs.includes('assistant-history-sidebar'), 'Debe incluir la barra lateral de historial');
      assert.ok(appJs.includes('btn-new-chat'), 'Debe incluir el botón para crear nueva conversación');
      assert.ok(appJs.includes('btn-delete-conv'), 'Debe incluir el disparador para eliminar conversación');
      assert.ok(appJs.includes('/chatbot/conversations'), 'Debe invocar los endpoints de conversaciones del chatbot');
    });

    it('4.2 app.js incluye preguntas rápidas para tareas, métricas y metodología', () => {
      const appJs = fs.readFileSync('public/js/app.js', 'utf8');

      assert.ok(appJs.includes('¿Cuáles son las métricas del proyecto?'), 'Debe incluir sugerencia de métricas');
      assert.ok(appJs.includes('¿Cómo funciona la metodología del proyecto?'), 'Debe incluir sugerencia de metodología');
      assert.ok(appJs.includes('¿Cuáles son las tareas críticas?'), 'Debe incluir sugerencia de tareas');
    });

    it('4.3 style.css contiene las reglas de diseño para el historial y diseño responsivo', () => {
      const styleCss = fs.readFileSync('public/css/style.css', 'utf8');

      assert.ok(styleCss.includes('.assistant-container'), 'Debe contener la clase .assistant-container');
      assert.ok(styleCss.includes('.assistant-history-sidebar'), 'Debe contener la clase .assistant-history-sidebar');
      assert.ok(styleCss.includes('.assistant-conv-item'), 'Debe contener la clase .assistant-conv-item');
      assert.ok(styleCss.includes('.btn-delete-conv'), 'Debe contener la clase .btn-delete-conv');
    });
  });
});
