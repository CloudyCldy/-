process.env.NODE_ENV = 'test';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../app');

describe('Pruebas funcionales de Sanzu Asistente y Acceso a Perfil', () => {
  let isLivePostgres = false;
  let memDb = null;
  let originalDatabase = null;

  const orgA = { id: 1, name: 'Organización Sakura', slug: 'sakura' };
  const adminA = { id: 101, username: 'admin_sakura', name: 'Administrador Haitani', role: 'admin', organization_id: orgA.id };
  const memberA = { id: 102, username: 'member_sakura', name: 'Miembro Sakura', role: 'member', organization_id: orgA.id };

  const projectA = {
    id: 1,
    organization_id: orgA.id,
    name: 'Sakura Coffee',
    methodology_id: 'SCRUM',
    description: 'Sistema principal de cafeterías',
    requirements: 'Entregables quincenales'
  };

  const tasksData = [
    { id: 1, organization_id: orgA.id, project_id: projectA.id, title: 'Diseño de arquitectura', status: 'completada', priority: 'alta', due_date: '2026-09-01' },
    { id: 2, organization_id: orgA.id, project_id: projectA.id, title: 'Migración de base de datos', status: 'en_proceso', priority: 'critica', due_date: '2026-09-10' }, // Vencida
    { id: 3, organization_id: orgA.id, project_id: projectA.id, title: 'Pruebas de pasarela de pago', status: 'pendiente', priority: 'media', due_date: '2026-11-01' } // Futura
  ];

  function createMockDb() {
    return {
      prepare(sql) {
        return {
          async get(...params) {
            const s = sql.toLowerCase().replace(/\s+/g, ' ');
            if (s.includes('from projects') && s.includes('where organization_id = ?')) {
              return projectA;
            }
            if (s.includes('from github_project_configurations')) {
              return { repository: 'SakuraCoffeeRepo' };
            }
            if (s.includes('from users') && (s.includes('where users.id = ?') || s.includes('where id = ?'))) {
              const [id] = params;
              return id === adminA.id ? { ...adminA, password: 'hashed_password' } : { ...memberA, password: 'hashed_password' };
            }
            if (s.includes('from users') && s.includes('id <> ?')) {
              return null; // no duplicates
            }
            return null;
          },
          async all(...params) {
            const s = sql.toLowerCase().replace(/\s+/g, ' ');
            if (s.includes('from tasks') && s.includes('where tasks.organization_id = ?')) {
              return tasksData.map(t => ({
                title: t.title,
                status: t.status,
                priority: t.priority,
                due_date: t.due_date,
                assignee_name: 'Carlos'
              }));
            }
            if (s.includes('from users') && s.includes('where organization_id = ?')) {
              return [
                { name: adminA.name, role: adminA.role, active: 1 },
                { name: memberA.name, role: memberA.role, active: 1 }
              ];
            }
            return [];
          },
          async run(...params) {
            return { changes: 1 };
          }
        };
      }
    };
  }

  before(() => {
    originalDatabase = app.locals.database;
    memDb = createMockDb();
    app.locals.database = memDb;
  });

  after(() => {
    app.locals.database = originalDatabase;
  });

  describe('ERROR 1: Asistente Sanzu - Preguntas Rápidas y Envío de Mensajes', () => {
    it('1.1 Rechaza solicitud sin autenticación (401)', async () => {
      const res = await request(app)
        .post('/api/assistant/chat')
        .send({ message: '¿Qué tareas están vencidas?' });

      assert.strictEqual(res.status, 401);
    });

    it('1.2 Rechaza solicitud para usuarios no administradores (403)', async () => {
      const res = await request(app)
        .post('/api/assistant/chat')
        .set('x-test-user', JSON.stringify(memberA))
        .send({ message: '¿Qué tareas están vencidas?' });

      assert.strictEqual(res.status, 403);
    });

    it('1.3 Rechaza mensaje vacío con 400', async () => {
      const res = await request(app)
        .post('/api/assistant/chat')
        .set('x-test-user', JSON.stringify(adminA))
        .send({ message: '   ' });

      assert.strictEqual(res.status, 400);
      assert.ok(res.body.error);
    });

    it('1.4 Botón rápido: «¿Qué tareas están vencidas?» distingue vencidas de completadas', async () => {
      const res = await request(app)
        .post('/api/assistant/chat')
        .set('x-test-user', JSON.stringify(adminA))
        .send({ message: '¿Qué tareas están vencidas?' });

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.answer);
      // La tarea completada con fecha de septiembre NO debe ser reportada como vencida
      assert.ok(!res.body.answer.includes('Diseño de arquitectura'), 'No debe reportar tareas completadas como vencidas');
      // La tarea en_proceso con fecha de septiembre SÍ debe reportarse
      assert.ok(res.body.answer.includes('Migración de base de datos'), 'Debe reportar tareas abiertas con fecha pasada');
      assert.ok(res.body.answer.includes('1 tarea(s) vencida(s)'));
    });

    it('1.5 Botón rápido: «¿Cuál es el progreso del proyecto?» calcula porcentaje y conteos reales', async () => {
      const res = await request(app)
        .post('/api/assistant/chat')
        .set('x-test-user', JSON.stringify(adminA))
        .send({ message: '¿Cuál es el progreso del proyecto?' });

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.answer);
      // 1 de 3 tareas completadas = 33%
      assert.ok(res.body.answer.includes('33%') || res.body.answer.includes('avance'));
      assert.ok(res.body.answer.includes('1 de 3 tareas completadas'));
      assert.ok(res.body.answer.includes('2 pendientes'));
    });

    it('1.6 Botón rápido: «Dame un resumen para la reunión» genera resumen estructurado', async () => {
      const res = await request(app)
        .post('/api/assistant/chat')
        .set('x-test-user', JSON.stringify(adminA))
        .send({ message: 'Dame un resumen para la reunión' });

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.answer);
      assert.ok(res.body.answer.includes('Resumen para la reunión'));
      assert.ok(res.body.answer.includes('Sakura Coffee') || res.body.answer.includes('SCRUM'));
      assert.ok(res.body.answer.includes('Avance general'));
      assert.ok(res.body.answer.includes('Tareas abiertas'));
      assert.ok(res.body.answer.includes('Equipo: 2 integrante(s)'));
    });

    it('1.7 Consulta general: responde con contexto operativo coherente', async () => {
      const res = await request(app)
        .post('/api/assistant/chat')
        .set('x-test-user', JSON.stringify(adminA))
        .send({ message: 'Hola, ¿cómo está el equipo?' });

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.answer);
      assert.ok(res.body.answer.includes('SCRUM') || res.body.answer.includes('SakuraCoffeeRepo'));
    });

    it('1.8 Envío manual de mensajes continúa funcionando correctamente', async () => {
      const res = await request(app)
        .post('/api/assistant/chat')
        .set('x-test-user', JSON.stringify(adminA))
        .send({ message: '¿Cuáles son los requerimientos del proyecto?' });

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.answer);
      assert.ok(res.body.context);
      assert.strictEqual(res.body.context.project.name, 'Sakura Coffee');
    });
  });

  describe('ERROR 2: Acceso al Perfil de Usuario', () => {
    it('2.1 Rechaza actualizar perfil sin autenticación (401)', async () => {
      const res = await request(app)
        .put('/api/users/me/profile')
        .send({ name: 'Nuevo Nombre' });

      assert.strictEqual(res.status, 401);
    });

    it('2.2 Permite actualizar datos del perfil al usuario autenticado', async () => {
      const res = await request(app)
        .put('/api/users/me/profile')
        .set('x-test-user', JSON.stringify(adminA))
        .send({ name: 'Administrador Actualizado', email: 'admin@sakura.io' });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.name, 'Administrador Actualizado');
      assert.strictEqual(res.body.email, 'admin@sakura.io');
    });

    it('2.3 La barra superior genera un elemento interactivo accesible (<a class="user-chip">) hacia el perfil', () => {
      const fs = require('fs');
      const appJs = fs.readFileSync('public/js/app.js', 'utf8');

      assert.ok(
        appJs.includes('<a class="user-chip" href="#/${state.user.role}/profile"'),
        'El chip del usuario en la barra superior debe ser un enlace interactivo <a> vinculado a la ruta del perfil'
      );
      assert.ok(
        appJs.includes('title="Ver mi perfil"') || appJs.includes('aria-label='),
        'Debe incluir atributos accesibles de título o aria-label'
      );
    });

    it('2.4 Los botones de preguntas rápidas tienen type="button" y conservan la clase assistant-suggestion', () => {
      const fs = require('fs');
      const appJs = fs.readFileSync('public/js/app.js', 'utf8');

      assert.ok(appJs.includes('<button type="button" class="btn secondary assistant-suggestion">¿Qué tareas están vencidas?</button>'));
      assert.ok(appJs.includes('<button type="button" class="btn secondary assistant-suggestion">¿Cuál es el progreso del proyecto?</button>'));
      assert.ok(appJs.includes('<button type="button" class="btn secondary assistant-suggestion">Dame un resumen para la reunión</button>'));
    });
  });
});
