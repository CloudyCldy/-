process.env.NODE_ENV = 'test';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const fs = require('fs');
const app = require('../app');
const { computeCriticalPath } = require('../server/controllers/ganttController');

describe('Pruebas funcionales de GanttProject Suite (Gantt, WBS, CPM, Dependencias, Import/Export .GAN)', () => {
  let originalDatabase = null;

  const org = { id: 1, name: 'Haitani', slug: 'haitani' };
  const adminUser = { id: 1, username: 'admin', name: 'Administrador', role: 'admin', organization_id: org.id };
  const memberUser = { id: 2, username: 'dev', name: 'Desarrollador', role: 'member', organization_id: org.id };

  const project = { id: 10, organization_id: org.id, name: 'Proyecto de Prueba Gantt' };

  let tasksDb = [
    {
      id: 101,
      project_id: project.id,
      organization_id: org.id,
      title: 'Diseño de Arquitectura',
      start_date: '2026-10-01',
      due_date: '2026-10-05',
      status: 'completada',
      is_milestone: false,
      progress: 100,
      parent_id: null,
      baseline_start_date: null,
      baseline_due_date: null,
      assigned_to: memberUser.id
    },
    {
      id: 102,
      project_id: project.id,
      organization_id: org.id,
      title: 'Desarrollo de Backend',
      start_date: '2026-10-06',
      due_date: '2026-10-15',
      status: 'en_proceso',
      is_milestone: false,
      progress: 50,
      parent_id: null,
      baseline_start_date: null,
      baseline_due_date: null,
      assigned_to: memberUser.id
    },
    {
      id: 103,
      project_id: project.id,
      organization_id: org.id,
      title: 'Hito Entrega Fase 1',
      start_date: '2026-10-16',
      due_date: '2026-10-16',
      status: 'pendiente',
      is_milestone: true,
      progress: 0,
      parent_id: null,
      baseline_start_date: null,
      baseline_due_date: null,
      assigned_to: adminUser.id
    }
  ];

  let depsDb = [
    {
      id: 1,
      organization_id: org.id,
      project_id: project.id,
      task_id: 102,
      predecessor_id: 101,
      dependency_type: 'FS',
      lag_days: 0
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
              if (id === adminUser.id) return { ...adminUser, active: 1 };
              if (id === memberUser.id) return { ...memberUser, active: 1 };
              return null;
            }
            if (s.includes('from projects') && s.includes('where id = ?')) {
              return project;
            }
            if (s.includes('from tasks') && s.includes('where id = ?')) {
              const [id] = params;
              return tasksDb.find(t => t.id === Number(id)) || null;
            }
            if (s.includes('from task_dependencies') && s.includes('task_id = ?') && s.includes('predecessor_id = ?')) {
              const [, taskId, predId] = params;
              return depsDb.find(d => d.task_id === Number(taskId) && d.predecessor_id === Number(predId)) || null;
            }
            return null;
          },
          async all(...params) {
            const s = sql.toLowerCase().replace(/\s+/g, ' ');
            if (s.includes('from projects') && s.includes('organization_id = ?')) {
              return [project];
            }
            if (s.includes('from tasks') && s.includes('organization_id = ?')) {
              return tasksDb.map(t => ({
                ...t,
                assignee_name: t.assigned_to === memberUser.id ? memberUser.name : adminUser.name,
                project_name: project.name,
                parent_title: null
              }));
            }
            if (s.includes('from task_dependencies') && s.includes('organization_id = ?')) {
              return depsDb.map(d => {
                const pred = tasksDb.find(t => t.id === d.predecessor_id);
                const succ = tasksDb.find(t => t.id === d.task_id);
                return {
                  ...d,
                  predecessor_title: pred ? pred.title : '',
                  task_title: succ ? succ.title : ''
                };
              });
            }
            return [];
          },
          async run(...params) {
            const s = sql.toLowerCase().replace(/\s+/g, ' ');
            if (s.includes('insert into task_dependencies')) {
              const newId = depsDb.length + 1;
              const [, projId, taskId, predId, type, lag] = params;
              depsDb.push({
                id: newId,
                organization_id: org.id,
                project_id: projId,
                task_id: taskId,
                predecessor_id: predId,
                dependency_type: type || 'FS',
                lag_days: lag || 0
              });
              return { lastInsertRowid: newId, changes: 1 };
            }
            if (s.includes('delete from task_dependencies')) {
              const [id] = params;
              depsDb = depsDb.filter(d => d.id !== Number(id));
              return { changes: 1 };
            }
            if (s.includes('update tasks set baseline_start_date = start_date')) {
              tasksDb.forEach(t => {
                t.baseline_start_date = t.start_date;
                t.baseline_due_date = t.due_date;
              });
              return { changes: tasksDb.length };
            }
            if (s.includes('update tasks') && s.includes('start_date = ?') && s.includes('due_date = ?')) {
              const [newStart, newDue, id] = params;
              const target = tasksDb.find(t => t.id === Number(id));
              if (target) {
                target.start_date = newStart;
                target.due_date = newDue;
              }
              return { changes: 1 };
            }
            if (s.includes('insert into tasks')) {
              const newId = tasksDb.length + 100;
              return { lastInsertRowid: newId, changes: 1 };
            }
            if (s.includes('insert into projects')) {
              return { lastInsertRowid: 11, changes: 1 };
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

  it('1. Algoritmo CPM: calcula correctamente la ruta crítica para dependencias lineales', () => {
    const tasks = [
      { id: 1, start_date: '2026-10-01', due_date: '2026-10-05', is_milestone: false },
      { id: 2, start_date: '2026-10-06', due_date: '2026-10-10', is_milestone: false },
      { id: 3, start_date: '2026-10-01', due_date: '2026-10-02', is_milestone: false } // tarea corta sin dependencias sucesoras
    ];
    const dependencies = [
      { task_id: 2, predecessor_id: 1, dependency_type: 'FS', lag_days: 0 }
    ];

    const criticalPath = computeCriticalPath(tasks, dependencies);
    assert.ok(Array.isArray(criticalPath));
    assert.ok(criticalPath.includes(1), 'La tarea 1 debe ser parte de la ruta crítica');
    assert.ok(criticalPath.includes(2), 'La tarea 2 debe ser parte de la ruta crítica');
    assert.ok(!criticalPath.includes(3), 'La tarea 3 con holgura no debe ser parte de la ruta crítica');
  });

  it('2. GET /api/gantt retorna tareas enriquecidas con WBS, dependencias y ruta crítica CPM', async () => {
    const res = await request(app)
      .get('/api/gantt?project_id=10')
      .set('x-test-user', JSON.stringify(adminUser));

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.tasks));
    assert.ok(Array.isArray(res.body.dependencies));
    assert.ok(Array.isArray(res.body.criticalPathTaskIds));
    assert.ok(Array.isArray(res.body.projects));

    const task101 = res.body.tasks.find(t => t.id === 101);
    assert.ok(task101);
    assert.strictEqual(task101.title, 'Diseño de Arquitectura');
    assert.strictEqual(task101.progress, 100);

    const task103 = res.body.tasks.find(t => t.id === 103);
    assert.ok(task103);
    assert.strictEqual(task103.is_milestone, true);
  });

  it('3. POST /api/gantt/dependencies crea dependencia Fin-a-Inicio (FS)', async () => {
    const res = await request(app)
      .post('/api/gantt/dependencies')
      .set('x-test-user', JSON.stringify(adminUser))
      .send({
        task_id: 103,
        predecessor_id: 102,
        dependency_type: 'FS',
        lag_days: 0
      });

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.ok);
  });

  it('4. POST /api/gantt/dependencies previene dependencias circulares (bucles)', async () => {
    // 101 -> 102 -> 103, intentar 103 -> 101 debe ser rechazado
    const res = await request(app)
      .post('/api/gantt/dependencies')
      .set('x-test-user', JSON.stringify(adminUser))
      .send({
        task_id: 101,
        predecessor_id: 103,
        dependency_type: 'FS'
      });

    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /circular/i);
  });

  it('5. POST /api/gantt/baseline guarda la línea base para comparar la planificación', async () => {
    const res = await request(app)
      .post('/api/gantt/baseline')
      .set('x-test-user', JSON.stringify(adminUser))
      .send({ project_id: 10 });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.ok);
  });

  it('6. POST /api/gantt/auto-schedule auto-programa tareas según dependencias FS', async () => {
    const res = await request(app)
      .post('/api/gantt/auto-schedule')
      .set('x-test-user', JSON.stringify(adminUser))
      .send({ project_id: 10 });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.ok);
  });

  it('7. GET /api/gantt/export/gan genera archivo XML nativo compatible con GanttProject', async () => {
    const res = await request(app)
      .get('/api/gantt/export/gan?project_id=10')
      .set('x-test-user', JSON.stringify(adminUser));

    assert.strictEqual(res.status, 200);
    assert.match(res.headers['content-type'], /xml/i);
    assert.match(res.headers['content-disposition'], /attachment;\s*filename="ganttproject-.*\.gan"/i);

    const xml = res.text;
    assert.ok(xml.includes('<project'), 'Debe incluir elemento <project>');
    assert.ok(xml.includes('<tasks'), 'Debe incluir contenedor <tasks>');
    assert.ok(xml.includes('name="Diseño de Arquitectura"'), 'Debe incluir las tareas exportadas');
    assert.ok(xml.includes('<depend'), 'Debe incluir las dependencias exportadas');
  });

  it('8. GET /api/gantt/export/csv exporta cronograma a formato CSV', async () => {
    const res = await request(app)
      .get('/api/gantt/export/csv?project_id=10')
      .set('x-test-user', JSON.stringify(adminUser));

    assert.strictEqual(res.status, 200);
    assert.match(res.headers['content-type'], /csv/i);
    assert.ok(res.text.includes('ID,Proyecto,Título,Tipo'));
    assert.ok(res.text.includes('Diseño de Arquitectura'));
  });

  it('9. POST /api/gantt/import/gan importa archivo .gan de GanttProject', async () => {
    const sampleGanXml = `<?xml version="1.0" encoding="UTF-8"?>
<project name="Proyecto Importado" company="" webLink="" view-date="2026-10-01" view-index="0" version="3.3.3300" locale="es">
  <tasks>
    <task id="1" name="Tarea Importada 1" meeting="false" start="2026-10-01" duration="4" complete="50" expand="true">
      <depend id="2" type="2" difference="0"/>
    </task>
    <task id="2" name="Hito Importado" meeting="true" start="2026-10-05" duration="0" complete="0" expand="true"/>
  </tasks>
</project>`;

    const res = await request(app)
      .post('/api/gantt/import/gan')
      .set('x-test-user', JSON.stringify(adminUser))
      .attach('file', Buffer.from(sampleGanXml, 'utf-8'), 'proyecto-test.gan');

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.ok);
    assert.strictEqual(res.body.taskCount, 2);
  });

  it('10. DELETE /api/gantt/dependencies/:id elimina la dependencia', async () => {
    const res = await request(app)
      .delete('/api/gantt/dependencies/1')
      .set('x-test-user', JSON.stringify(adminUser));

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.ok);
  });

  it('11. Frontend en public/js/app.js y public/css/style.css contienen componentes de GanttProject', () => {
    const appJs = fs.readFileSync('public/js/app.js', 'utf8');
    const styleCss = fs.readFileSync('public/css/style.css', 'utf8');

    assert.ok(appJs.includes('buildGanttWbsTree'), 'Debe existir constructor WBS en app.js');
    assert.ok(appJs.includes('gtc-toggle-critical'), 'Debe existir control de Ruta Crítica');
    assert.ok(appJs.includes('gtc-toggle-baseline'), 'Debe existir control de Línea Base');
    assert.ok(appJs.includes('gtc-dep-svg'), 'Debe existir capa SVG de dependencias');
    assert.ok(appJs.includes('openGanttImportModal'), 'Debe existir modal de importación GanttProject');

    assert.ok(styleCss.includes('.gantt-gp-toolbar'), 'style.css debe contener estilos de toolbar');
    assert.ok(styleCss.includes('.gtc-summary-bar'), 'style.css debe contener barra de resumen');
    assert.ok(styleCss.includes('.gtc-milestone-diamond'), 'style.css debe contener diamante de hito');
    assert.ok(styleCss.includes('.gtc-dep-path'), 'style.css debe contener estilo de flechas SVG');
  });
});
