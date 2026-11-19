// Pruebas de aceptación: TAREA #282 - [HB-16] Panel de asistente de IA (integración con Sanzu)
process.env.NODE_ENV = 'test';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../app');
const { sanitize, maskApiKey } = require('../server/services/sanzuClient');
const sanzuService = require('../server/services/sanzuService');
const { localAnswer, projectContext } = require('../server/controllers/assistantController');

describe('[HB-16] Panel de asistente de IA (integración con Sanzu)', () => {
  let originalDatabase = null;

  // Organizaciones independientes
  const orgAlpha = {
    id: 10,
    name: 'Organización Sakura Alpha',
    slug: 'sakura-alpha',
    sanzu_api_key: 'sz_live_alpha_tech_account_secret_12345',
    sanzu_token: 'sz_live_alpha_tech_account_secret_12345',
    sanzu_api_url: 'https://sanzu-alpha.internal',
    sanzu_project_id: 'sanzu_proj_alpha_999',
    sanzu_connected: true
  };

  const orgBeta = {
    id: 20,
    name: 'Organización Beta Corp',
    slug: 'beta-corp',
    sanzu_api_key: 'sz_live_beta_tech_account_secret_67890',
    sanzu_token: 'sz_live_beta_tech_account_secret_67890',
    sanzu_api_url: 'https://sanzu-beta.internal',
    sanzu_project_id: 'sanzu_proj_beta_888',
    sanzu_connected: true
  };

  const adminAlpha = { id: 1001, username: 'admin_alpha', name: 'Admin Alpha', role: 'admin', organization_id: orgAlpha.id };
  const memberAlpha = { id: 1002, username: 'member_alpha', name: 'Carlos Dev', role: 'member', organization_id: orgAlpha.id };
  const adminBeta = { id: 2001, username: 'admin_beta', name: 'Admin Beta', role: 'admin', organization_id: orgBeta.id };

  const projectAlpha = {
    id: 101,
    organization_id: orgAlpha.id,
    name: 'Sakura Operations Hub',
    methodology_id: 'SCRUM',
    description: 'Gestión integral de pedidos y operaciones de café',
    requirements: 'Alta resiliencia ante caídas de servicios externos',
    budget: 80000.00,
    sanzu_external_ref: 'haitani-proj-101',
    sanzu_api_key: orgAlpha.sanzu_api_key
  };

  // Tareas almacenadas en Haitani: 2 completadas, 1 vencida (Date object), 1 en proceso futura
  const today = new Date();
  const pastDateObj = new Date(today.getTime() - 4 * 24 * 60 * 60 * 1000); // Vencida hace 4 días (objeto Date de Postgres)
  const futureDateStr = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const tasksAlpha = [
    { id: 1, organization_id: orgAlpha.id, project_id: projectAlpha.id, title: 'Configuración inicial y DB', status: 'completada', priority: 'alta', due_date: '2026-09-01', assignee_name: 'Carlos Dev', progress: 100 },
    { id: 2, organization_id: orgAlpha.id, project_id: projectAlpha.id, title: 'Integración pasarela de pagos', status: 'completada', priority: 'critica', due_date: '2026-09-15', assignee_name: 'Admin Alpha', progress: 100 },
    { id: 3, organization_id: orgAlpha.id, project_id: projectAlpha.id, title: 'Módulo de resiliencia Sanzu', status: 'en_proceso', priority: 'critica', due_date: pastDateObj, assignee_name: 'Carlos Dev', progress: 50 }, // Vencida
    { id: 4, organization_id: orgAlpha.id, project_id: projectAlpha.id, title: 'Despliegue y pruebas E2E', status: 'pendiente', priority: 'media', due_date: futureDateStr, assignee_name: null, progress: 0 }
  ];

  const dbState = {
    orgs: [ { ...orgAlpha }, { ...orgBeta } ],
    projects: [ { ...projectAlpha } ],
    tasks: [ ...tasksAlpha ],
    conversations: [],
    messages: []
  };

  function createMockDb() {
    return {
      prepare(sql) {
        const s = sql.toLowerCase().replace(/\s+/g, ' ').trim();
        return {
          async get(...params) {
            // Organizations
            if (s.includes('from organizations where id = ?')) {
              const id = Number(params[0]);
              return dbState.orgs.find(o => o.id === id) || null;
            }
            // Projects
            if (s.includes('from projects') && (s.includes('where id = ?') || s.includes('projects.id = ?'))) {
              const [pId, orgId] = params;
              return dbState.projects.find(p => p.id === Number(pId) && p.organization_id === Number(orgId)) || null;
            }
            if (s.includes('from projects where organization_id = ?') || s.includes('from projects') && s.includes('projects.organization_id = ?')) {
              const orgId = Number(params[0]);
              return dbState.projects.find(p => p.organization_id === orgId) || null;
            }
            // Users
            if (s.includes('from users where users.id = ?') || s.includes('from users where id = ?')) {
              const id = Number(params[0]);
              if (id === adminAlpha.id) return { ...adminAlpha, password: 'hashed' };
              if (id === memberAlpha.id) return { ...memberAlpha, password: 'hashed' };
              if (id === adminBeta.id) return { ...adminBeta, password: 'hashed' };
              return null;
            }
            // Methodologies
            if (s.includes('from methodologies where id = ?')) {
              return { id: 'SCRUM', name: 'Scrum', description: 'Framework ágil iterativo', category: 'agile' };
            }
            if (s.includes('from github_project_configurations')) {
              return { repository: 'SakuraCoffee' };
            }
            if (s.includes('from chatbot_conversations where id = ? and organization_id = ?')) {
              const [cId, orgId] = params;
              return dbState.conversations.find(c => c.id === cId && c.organization_id === Number(orgId)) || null;
            }
            return null;
          },
          async all(...params) {
            // Tasks
            if (s.includes('from tasks') && s.includes('organization_id = ?')) {
              const orgId = Number(params[0]);
              return dbState.tasks.filter(t => t.organization_id === orgId);
            }
            // Users
            if (s.includes('from users where organization_id = ?')) {
              const orgId = Number(params[0]);
              return [adminAlpha, memberAlpha].filter(u => u.organization_id === orgId).map(u => ({ id: u.id, name: u.name, role: u.role, active: 1 }));
            }
            // Projects
            if (s.includes('from projects') && s.includes('organization_id = ?')) {
              const orgId = Number(params[0]);
              return dbState.projects.filter(p => p.organization_id === orgId);
            }
            // Chatbot conversations
            if (s.includes('from chatbot_conversations c')) {
              const [orgId, userId] = params;
              return dbState.conversations.filter(c => c.organization_id === Number(orgId) && c.user_id === Number(userId));
            }
            return [];
          },
          async run(...params) {
            // Update organizations sanzu config
            if (s.startsWith('update organizations set sanzu_api_key = ?')) {
              const [key, token, url, projId, connected, orgId] = params;
              const org = dbState.orgs.find(o => o.id === Number(orgId));
              if (org) {
                org.sanzu_api_key = key;
                org.sanzu_token = token;
                org.sanzu_api_url = url;
                org.sanzu_project_id = projId;
                org.sanzu_connected = Boolean(connected);
              }
              return { changes: 1 };
            }
            // Update organizations sanzu_project_id
            if (s.includes('update organizations set sanzu_project_id = ?')) {
              const [projId, orgId] = params;
              const org = dbState.orgs.find(o => o.id === Number(orgId));
              if (org) org.sanzu_project_id = projId;
              return { changes: 1 };
            }
            // Insert chatbot conversation
            if (s.startsWith('insert into chatbot_conversations')) {
              const [id, orgId, userId, projectId, title] = params;
              dbState.conversations.push({ id, organization_id: Number(orgId), user_id: Number(userId), project_id: projectId, title });
              return { changes: 1 };
            }
            // Insert chatbot message
            if (s.startsWith('insert into chatbot_messages')) {
              const [cId, orgId, sender, message, source] = params;
              dbState.messages.push({ conversation_id: cId, organization_id: Number(orgId), sender, message, source });
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
  });

  after(() => {
    app.locals.database = originalDatabase;
  });

  describe('Criterio 1: Cada organización cuenta con una cuenta técnica y un proyecto propios dentro de Sanzu', () => {
    it('1.1 Las credenciales de la cuenta técnica y el proyecto de Sanzu están aislados por organización', async () => {
      const credsAlpha = await sanzuService.resolveOrganizationCredentials(app.locals.database, orgAlpha.id);
      const credsBeta = await sanzuService.resolveOrganizationCredentials(app.locals.database, orgBeta.id);

      assert.strictEqual(credsAlpha.apiKey, orgAlpha.sanzu_api_key);
      assert.strictEqual(credsBeta.apiKey, orgBeta.sanzu_api_key);
      assert.notStrictEqual(credsAlpha.apiKey, credsBeta.apiKey, 'Org Alpha y Org Beta deben tener claves técnicas distintas');

      assert.strictEqual(credsAlpha.projectId, orgAlpha.sanzu_project_id);
      assert.strictEqual(credsBeta.projectId, orgBeta.sanzu_project_id);
      assert.notStrictEqual(credsAlpha.projectId, credsBeta.projectId, 'Cada organización debe tener su propio ID de proyecto en Sanzu');
    });

    it('1.2 Cada proyecto en Haitani cuenta con su propio identificador externo (sanzu_external_ref) para Sanzu', async () => {
      const proj = dbState.projects.find(p => p.id === projectAlpha.id);
      assert.ok(proj.sanzu_external_ref);
      assert.strictEqual(proj.sanzu_external_ref, `haitani-proj-${projectAlpha.id}`);
    });

    it('1.3 La configuración técnica de Sanzu (/api/sanzu/configure) solo afecta a la organización que la realiza', async () => {
      const res = await request(app)
        .post('/api/sanzu/configure')
        .set('x-test-user', JSON.stringify(adminBeta))
        .send({
          sanzu_api_key: 'sz_live_new_beta_isolated_key_99999',
          sanzu_api_url: 'https://beta-custom.sanzu.internal',
          sanzu_project_id: 'sanzu_proj_beta_new'
        });

      assert.strictEqual(res.status, 200);

      // Verificar que Beta se actualizó pero Alpha permanece intacta
      const updatedBeta = await sanzuService.resolveOrganizationCredentials(app.locals.database, orgBeta.id);
      const intactAlpha = await sanzuService.resolveOrganizationCredentials(app.locals.database, orgAlpha.id);

      assert.strictEqual(updatedBeta.apiKey, 'sz_live_new_beta_isolated_key_99999');
      assert.strictEqual(updatedBeta.projectId, 'sanzu_proj_beta_new');
      assert.strictEqual(intactAlpha.apiKey, orgAlpha.sanzu_api_key, 'Org Alpha no debe ser modificada por cambios en Org Beta');
    });
  });

  describe('Criterio 2: Si Sanzu no está disponible, el asistente responde en modo local usando datos de tareas vencidas y avance almacenados en Haitani', () => {
    it('2.1 Cuando Sanzu está inaccesible o no disponible, responde en modo local con source="local"', async () => {
      // Petición al endpoint del chatbot cuando la URL de Sanzu no está disponible
      const res = await request(app)
        .post('/api/chatbot/message')
        .set('x-test-user', JSON.stringify(memberAlpha))
        .send({
          message: '¿Cuál es el estado del proyecto?'
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.source, 'local', 'Debe responder con source: local al no estar disponible Sanzu');
      assert.ok(res.body.answer, 'Debe incluir respuesta calculada');
    });

    it('2.2 Responde con datos reales de tareas vencidas (detectando fechas tipo Date y string) en modo local', async () => {
      const context = await projectContext(app.locals.database, orgAlpha.id);
      const answer = localAnswer('¿Qué tareas están vencidas?', context);

      assert.ok(answer.includes('1 tarea(s) vencida(s)'), 'Debe detectar exactamente la tarea vencida en tareasAlpha');
      assert.ok(answer.includes('Módulo de resiliencia Sanzu'), 'Debe listar el título de la tarea vencida');
      assert.ok(answer.includes('Carlos Dev'), 'Debe incluir al responsable de la tarea vencida');
      assert.ok(answer.includes('hace') && !answer.includes('NaN'), 'El cálculo de días vencidos no debe ser NaN');
    });

    it('2.3 Responde con datos reales del avance del proyecto (% completado y conteo de tareas) en modo local', async () => {
      const context = await projectContext(app.locals.database, orgAlpha.id);
      const answer = localAnswer('¿Cuál es el progreso del proyecto?', context);

      // En tasksAlpha: 2 completadas de 4 totales = 50% de avance
      assert.ok(answer.includes('50%'), 'Debe calcular el 50% de avance según las 2 tareas completadas de 4');
      assert.ok(answer.includes('2 de 4 tareas completadas'), 'Debe reflejar el conteo real almacenado en Haitani');
      assert.ok(answer.includes('2 pendientes'), 'Debe indicar que hay 2 tareas pendientes');
    });

    it('2.4 Genera resumen para la reunión combinando avance general y plazos de tareas vencidas', async () => {
      const context = await projectContext(app.locals.database, orgAlpha.id);
      const answer = localAnswer('Dame un resumen para la reunión', context);

      assert.ok(answer.includes('Resumen para la reunión'));
      assert.ok(answer.includes('Avance general: 50%'));
      assert.ok(answer.includes('1 tarea(s) vencida(s)'));
      assert.ok(answer.includes('Módulo de resiliencia Sanzu'));
    });

    it('2.5 En cualquier consulta general no reconocida cuando Sanzu está offline, la respuesta local incluye avance y vencidas', async () => {
      const context = await projectContext(app.locals.database, orgAlpha.id);
      const answer = localAnswer('Consulta general sin clasificar', context);

      assert.ok(answer.includes('avance del proyecto es del 50%'), 'Debe incluir el avance calculado');
      assert.ok(answer.includes('1 vencida(s)'), 'Debe incluir el número de tareas vencidas');
      assert.ok(answer.includes('2 tarea(s) abiertas'), 'Debe incluir tareas abiertas');
    });
  });

  describe('Criterio 3: Las credenciales de la cuenta técnica de Sanzu se guardan en PostgreSQL y no se exponen al navegador', () => {
    it('3.1 /api/sanzu/status enmascara la clave técnica y nunca expone la API Key completa', async () => {
      const res = await request(app)
        .get('/api/sanzu/status')
        .set('x-test-user', JSON.stringify(adminAlpha));

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.configured, true);
      assert.ok(res.body.masked_key, 'Debe devolver una clave enmascarada');
      assert.strictEqual(res.body.masked_key.includes('••••••••') || res.body.masked_key.includes('...'), true);
      assert.ok(!res.body.masked_key.includes('alpha_tech_account_secret'), 'No debe contener el secreto de la clave');
      assert.strictEqual(res.body.sanzu_api_key, undefined, 'sanzu_api_key cruda no debe existir en el JSON');
    });

    it('3.2 El listado y detalle de proyectos (/api/projects) no exponen credenciales de Sanzu', async () => {
      const resList = await request(app)
        .get('/api/projects')
        .set('x-test-user', JSON.stringify(adminAlpha));

      assert.strictEqual(resList.status, 200);
      for (const proj of resList.body) {
        assert.strictEqual(proj.sanzu_api_key, undefined, 'No debe filtrar sanzu_api_key en /api/projects');
        assert.strictEqual(proj.sanzu_token, undefined, 'No debe filtrar sanzu_token en /api/projects');
      }

      const resGet = await request(app)
        .get(`/api/projects/${projectAlpha.id}`)
        .set('x-test-user', JSON.stringify(adminAlpha));

      assert.strictEqual(resGet.status, 200);
      assert.strictEqual(resGet.body.sanzu_api_key, undefined, 'No debe filtrar sanzu_api_key en /api/projects/:id');
      assert.strictEqual(resGet.body.sanzu_token, undefined, 'No debe filtrar sanzu_token en /api/projects/:id');
    });

    it('3.3 Las respuestas del asistente y del chatbot limpian las credenciales del objeto context', async () => {
      const res = await request(app)
        .post('/api/chatbot/message')
        .set('x-test-user', JSON.stringify(memberAlpha))
        .send({ message: '¿Cómo va el proyecto?' });

      assert.strictEqual(res.status, 200);
      if (res.body.context?.project) {
        assert.strictEqual(res.body.context.project.sanzu_api_key, undefined, 'El context del bot no debe contener sanzu_api_key');
        assert.strictEqual(res.body.context.project.sanzu_token, undefined, 'El context del bot no debe contener sanzu_token');
      }
    });

    it('3.4 La función sanitize oculta secretos y tokens ante errores de red o excepciones', () => {
      const errorMsg = 'Error al consultar https://sanzu.internal con key sz_live_super_secret_org_key_99999 y Bearer eyJhbGciOiJIUzI1Ni...';
      const clean = sanitize(errorMsg);

      assert.ok(!clean.includes('super_secret_org_key_99999'), 'sanitize debe remover la clave');
      assert.ok(clean.includes('sz_live_••••••••'), 'sanitize debe colocar la máscara de clave');
      assert.ok(!clean.includes('eyJhbGciOiJIUzI1Ni'), 'sanitize debe remover el token Bearer');
    });
  });
});
