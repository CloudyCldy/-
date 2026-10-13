process.env.NODE_ENV = 'test';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const fs = require('fs');
const app = require('../app');

describe('Pruebas funcionales de Exportación de Tareas a PDF para Usuarios Normales', () => {
  let originalDatabase = null;

  const orgA = { id: 1, name: 'Sakura Coffee', slug: 'sakura' };
  const memberA = { id: 102, username: 'carlos_mendoza', name: 'Carlos Mendoza', email: 'carlos@sakura.io', role: 'member', organization_id: orgA.id };
  const memberB = { id: 103, username: 'alberto_garcia', name: 'Alberto Garcia', email: 'alberto@sakura.io', role: 'member', organization_id: orgA.id };

  const projectA = {
    id: 1,
    organization_id: orgA.id,
    name: 'Sakura Web IT'
  };

  const tasksData = [
    {
      id: 1,
      organization_id: orgA.id,
      project_id: projectA.id,
      title: 'Crear componentes UI',
      description: 'Implementar vistas accesibles y responsivas',
      assigned_to: memberA.id,
      status: 'en_proceso',
      priority: 'alta',
      due_date: '2026-10-25'
    },
    {
      id: 2,
      organization_id: orgA.id,
      project_id: projectA.id,
      title: 'Documentar APIs de integración',
      description: 'Generar especificaciones OpenAPI',
      assigned_to: memberA.id,
      status: 'completada',
      priority: 'media',
      due_date: '2026-10-18'
    },
    {
      id: 3,
      organization_id: orgA.id,
      project_id: projectA.id,
      title: 'Tarea asignada a otro miembro',
      description: 'Esta tarea no debe salir en el PDF de Carlos',
      assigned_to: memberB.id,
      status: 'pendiente',
      priority: 'critica',
      due_date: '2026-10-30'
    }
  ];

  function createMockDb() {
    return {
      prepare(sql) {
        return {
          async get(...params) {
            const s = sql.toLowerCase().replace(/\s+/g, ' ');
            if (s.includes('from users') && s.includes('where id = ?')) {
              const [id] = params;
              if (id === memberA.id) return { ...memberA, active: 1 };
              if (id === memberB.id) return { ...memberB, active: 1 };
              return null;
            }
            if (s.includes('from organizations') && s.includes('where id = ?')) {
              return orgA;
            }
            return null;
          },
          async all(...params) {
            const s = sql.toLowerCase().replace(/\s+/g, ' ');
            if (s.includes('from tasks') && s.includes('tasks.organization_id = ?') && s.includes('tasks.assigned_to = ?')) {
              const [, assignedTo] = params;
              return tasksData
                .filter(t => t.assigned_to === assignedTo)
                .map(t => ({
                  ...t,
                  project_name: projectA.name,
                  assignee_name: memberA.name,
                  assignee_username: memberA.username,
                  sprint_name: 'Sprint 1'
                }));
            }
            return [];
          },
          async run() {
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

  it('1. Rechaza descargar PDF sin autenticación (401)', async () => {
    const res = await request(app).get('/api/tasks/export/pdf');
    assert.strictEqual(res.status, 401);
  });

  it('2. Permite al usuario normal (member) descargar el PDF con sus tareas', async () => {
    const res = await request(app)
      .get('/api/tasks/export/pdf')
      .set('x-test-user', JSON.stringify(memberA));

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['content-type'], 'application/pdf');
    assert.match(res.headers['content-disposition'], /attachment;\s*filename="mis-tareas-.*\.pdf"/i);
    assert.ok(res.body instanceof Buffer);

    // Verify valid PDF header
    const pdfHeader = res.body.slice(0, 5).toString('ascii');
    assert.strictEqual(pdfHeader, '%PDF-');
    assert.ok(res.body.length > 500, 'El PDF debe contener contenido renderizado');
  });

  it('3. Multi-tenancy & rol: el usuario normal solo recibe sus propias tareas asignadas', async () => {
    // Member A attempts to pass assigned_to=103 (Member B)
    const res = await request(app)
      .get(`/api/tasks/export/pdf?assigned_to=${memberB.id}`)
      .set('x-test-user', JSON.stringify(memberA));

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['content-type'], 'application/pdf');
    // Filename should still be for Member A (carlos_mendoza)
    assert.match(res.headers['content-disposition'], /carlos_mendoza/);
  });

  it('4. La interfaz de usuario en app.js incluye el botón "Descargar PDF" y su evento para usuarios normales', () => {
    const appJs = fs.readFileSync('public/js/app.js', 'utf8');
    assert.ok(appJs.includes('id="download-tasks-pdf"'), 'El botón download-tasks-pdf debe existir en app.js');
    assert.ok(appJs.includes('/api/tasks/export/pdf'), 'app.js debe llamar al endpoint /api/tasks/export/pdf');
    assert.ok(appJs.includes('Descargar PDF'), 'El texto del botón debe ser visible');
  });
});
