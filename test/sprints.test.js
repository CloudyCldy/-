process.env.NODE_ENV = 'test';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../app');

function createInMemoryDatabase() {
  let orgIdCounter = 1;
  let projIdCounter = 1;
  let sprintIdCounter = 1;
  let taskIdCounter = 1;

  const organizations = [];
  const users = [];
  const projects = [];
  const projectMembers = [];
  const sprints = [];
  const tasks = [];
  const activities = [];

  return {
    organizations,
    users,
    projects,
    projectMembers,
    sprints,
    tasks,
    activities,
    seed(data = {}) {
      if (data.organizations) organizations.push(...data.organizations);
      if (data.users) users.push(...data.users);
      if (data.projects) projects.push(...data.projects);
      if (data.projectMembers) projectMembers.push(...data.projectMembers);
      if (data.sprints) sprints.push(...data.sprints);
      if (data.tasks) tasks.push(...data.tasks);
    },
    prepare(sql) {
      return {
        async get(...params) {
          const s = sql.toLowerCase().replace(/\s+/g, ' ');
          if (s.includes('from projects') && s.includes('where id = ?') && s.includes('organization_id = ?')) {
            const [id, orgId] = params;
            return projects.find(p => p.id === Number(id) && p.organization_id === Number(orgId)) || null;
          }
          if (s.includes('from project_members') && s.includes('where project_id = ?') && s.includes('user_id = ?')) {
            const [projId, userId, orgId] = params;
            const pm = projectMembers.find(m => m.project_id === Number(projId) && m.user_id === Number(userId) && (!orgId || m.organization_id === Number(orgId)));
            return pm ? { exists: 1 } : null;
          }
          if (s.includes('from sprints') && s.includes('where project_id = ?') && s.includes("status = 'activo'")) {
            const [projId, orgId] = params;
            return sprints.find(sp => sp.project_id === Number(projId) && sp.organization_id === Number(orgId) && sp.status === 'activo') || null;
          }
          if (s.includes('from sprints') && s.includes('join projects') && s.includes('where sprints.id = ?')) {
            const [id, orgId] = params;
            const sprint = sprints.find(sp => sp.id === Number(id) && sp.organization_id === Number(orgId));
            if (!sprint) return null;
            const project = projects.find(p => p.id === sprint.project_id);
            return { ...sprint, project_name: project?.name || 'Proyecto' };
          }
          if (s.includes('from sprints') && s.includes('where id = ?') && s.includes('project_id = ?')) {
            const [id, projId, orgId] = params;
            return sprints.find(sp => sp.id === Number(id) && sp.project_id === Number(projId) && sp.organization_id === Number(orgId)) || null;
          }
          if (s.includes('from sprints') && s.includes('where id = ?') && s.includes('organization_id = ?')) {
            const [id, orgId] = params;
            return sprints.find(sp => sp.id === Number(id) && sp.organization_id === Number(orgId)) || null;
          }
          if (s.includes('from tasks') && s.includes('where tasks.id = ?') && s.includes('tasks.organization_id = ?')) {
            const [id, orgId] = params;
            const t = tasks.find(tk => tk.id === Number(id) && tk.organization_id === Number(orgId));
            if (!t) return null;
            const sprint = sprints.find(sp => sp.id === t.sprint_id);
            const user = users.find(u => u.id === t.assigned_to);
            return { ...t, sprint_name: sprint?.name || null, assignee_name: user?.name || null };
          }
          if (s.includes('from tasks') && s.includes('where id = ?') && s.includes('organization_id = ?')) {
            const [id, orgId] = params;
            return tasks.find(tk => tk.id === Number(id) && tk.organization_id === Number(orgId)) || null;
          }
          if (s.includes('from users') && s.includes('where id = ?')) {
            const [id, orgId] = params;
            return users.find(u => u.id === Number(id) && u.organization_id === Number(orgId)) || null;
          }
          return null;
        },
        async all(...params) {
          const s = sql.toLowerCase().replace(/\s+/g, ' ');
          if (s.includes('from sprints') && s.includes('where sprints.project_id = ?')) {
            const [projId, orgId] = params;
            return sprints
              .filter(sp => sp.project_id === Number(projId) && sp.organization_id === Number(orgId))
              .map(sp => {
                const spTasks = tasks.filter(t => t.sprint_id === sp.id);
                return {
                  ...sp,
                  total_tasks: spTasks.length,
                  completed_tasks: spTasks.filter(t => t.status === 'completada').length
                };
              });
          }
          if (s.includes('from tasks') && s.includes('sprint_id is null')) {
            const [projId, orgId] = params;
            return tasks
              .filter(t => t.project_id === Number(projId) && t.organization_id === Number(orgId) && !t.sprint_id)
              .map(t => {
                const user = users.find(u => u.id === t.assigned_to);
                return { ...t, assignee_name: user?.name || null };
              });
          }
          if (s.includes('from tasks') && s.includes('sprint_id = ?') && s.includes('organization_id = ?')) {
            const [sprintId, orgId] = params;
            return tasks
              .filter(t => t.sprint_id === Number(sprintId) && t.organization_id === Number(orgId))
              .map(t => {
                const user = users.find(u => u.id === t.assigned_to);
                return { ...t, assignee_name: user?.name || null, assignee_username: user?.username || null };
              });
          }
          if (s.includes('from tasks') && s.includes('project_id = ?')) {
            const [orgId, projId] = params;
            return tasks
              .filter(t => t.project_id === Number(projId) && t.organization_id === Number(orgId))
              .map(t => {
                const sprint = sprints.find(sp => sp.id === t.sprint_id);
                const user = users.find(u => u.id === t.assigned_to);
                return { ...t, sprint_name: sprint?.name || null, assignee_name: user?.name || null };
              });
          }
          return [];
        },
        async run(...params) {
          const s = sql.toLowerCase().replace(/\s+/g, ' ');
          if (s.includes('insert into tasks')) {
            const id = taskIdCounter++;
            const [projectId, organizationId, creatorId, title, description, assignedTo, priority, startDate, dueDate, status, sprintId] = params;
            tasks.push({
              id,
              project_id: Number(projectId),
              organization_id: Number(organizationId),
              creator_id: creatorId,
              title,
              description,
              assigned_to: assignedTo,
              priority,
              start_date: startDate,
              due_date: dueDate,
              status,
              sprint_id: sprintId ? Number(sprintId) : null,
              created_at: new Date().toISOString()
            });
            return { changes: 1, lastInsertRowid: id };
          }
          if (s.includes('insert into sprints')) {
            const id = sprintIdCounter++;
            const [organizationId, projectId, name, goal, startDate, endDate, status] = params;
            sprints.push({
              id,
              organization_id: Number(organizationId),
              project_id: Number(projectId),
              name,
              goal,
              start_date: startDate,
              end_date: endDate,
              status: status || 'planificado',
              started_at: null,
              closed_at: null,
              created_at: new Date().toISOString()
            });
            return { changes: 1, lastInsertRowid: id };
          }
          if (s.includes("update sprints set status = 'activo'")) {
            const [id, orgId] = params;
            const sp = sprints.find(s => s.id === Number(id) && s.organization_id === Number(orgId));
            if (sp) {
              sp.status = 'activo';
              sp.started_at = new Date().toISOString();
            }
            return { changes: sp ? 1 : 0 };
          }
          if (s.includes("update sprints set status = 'cerrado'")) {
            const [id, orgId] = params;
            const sp = sprints.find(s => s.id === Number(id) && s.organization_id === Number(orgId));
            if (sp) {
              sp.status = 'cerrado';
              sp.closed_at = new Date().toISOString();
            }
            return { changes: sp ? 1 : 0 };
          }
          if (s.includes('delete from sprints')) {
            const [id, orgId] = params;
            const idx = sprints.findIndex(s => s.id === Number(id) && s.organization_id === Number(orgId));
            if (idx !== -1) sprints.splice(idx, 1);
            return { changes: idx !== -1 ? 1 : 0 };
          }
          if (s.includes('update tasks set sprint_id = null') && s.includes("status != 'completada'")) {
            const [sprintId, orgId] = params;
            tasks.forEach(t => {
              if (t.sprint_id === Number(sprintId) && t.organization_id === Number(orgId) && t.status !== 'completada') {
                t.sprint_id = null;
              }
            });
            return { changes: 1 };
          }
          if (s.includes('update tasks set sprint_id = ?') && s.includes("status != 'completada'")) {
            const [targetSprintId, sprintId, orgId] = params;
            tasks.forEach(t => {
              if (t.sprint_id === Number(sprintId) && t.organization_id === Number(orgId) && t.status !== 'completada') {
                t.sprint_id = Number(targetSprintId);
              }
            });
            return { changes: 1 };
          }
          if (s.includes('update tasks set sprint_id = ?') && s.includes('where id = ? and organization_id = ?')) {
            const [sprintId, id, orgId] = params;
            const t = tasks.find(tk => tk.id === Number(id) && tk.organization_id === Number(orgId));
            if (t) t.sprint_id = sprintId !== null ? Number(sprintId) : null;
            return { changes: t ? 1 : 0 };
          }
          if (s.includes('insert into activities')) {
            activities.push(params);
            return { changes: 1 };
          }
          return { changes: 0 };
        }
      };
    }
  };
}

describe('Pruebas automatizadas de Sprints, Tareas y Multi-tenancy (QA-01)', () => {
  let memDb;
  let isLivePostgres = false;

  const orgA = { id: 10, name: 'Organizacion A' };
  const orgB = { id: 20, name: 'Organizacion B' };

  const adminA = { id: 101, username: 'adminA', role: 'admin', organization_id: orgA.id };
  const pmA = { id: 102, username: 'pmA', role: 'project_manager', organization_id: orgA.id };
  const memberA = { id: 103, username: 'memberA', role: 'member', organization_id: orgA.id };
  const viewerA = { id: 104, username: 'viewerA', role: 'viewer', organization_id: orgA.id };

  const adminB = { id: 201, username: 'adminB', role: 'admin', organization_id: orgB.id };

  const projectA1 = { id: 1, organization_id: orgA.id, name: 'Proyecto Alpha', manager_id: pmA.id };
  const projectA2 = { id: 2, organization_id: orgA.id, name: 'Proyecto Beta', manager_id: pmA.id };
  const projectB1 = { id: 9, organization_id: orgB.id, name: 'Proyecto B-Gamma', manager_id: adminB.id };

  before(async () => {
    if (process.env.TEST_DATABASE_URL) {
      try {
        const { Pool } = require('pg');
        const testPool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
        await testPool.query('SELECT 1');
        isLivePostgres = true;
        await testPool.end();
      } catch (err) {
        console.warn('TEST_DATABASE_URL no disponible; usando entorno de pruebas en memoria aislado.');
      }
    }

    if (!isLivePostgres) {
      memDb = createInMemoryDatabase();
      memDb.seed({
        organizations: [orgA, orgB],
        users: [adminA, pmA, memberA, viewerA, adminB],
        projects: [projectA1, projectA2, projectB1],
        projectMembers: [
          { project_id: projectA1.id, user_id: adminA.id, organization_id: orgA.id },
          { project_id: projectA1.id, user_id: pmA.id, organization_id: orgA.id },
          { project_id: projectA1.id, user_id: memberA.id, organization_id: orgA.id },
          { project_id: projectA2.id, user_id: pmA.id, organization_id: orgA.id }
        ]
      });
      app.locals.database = memDb;
    }
  });

  // 1. Crear tarea dentro de un proyecto; rechazo si el proyecto es de otra organización
  describe('1. Crear tarea dentro de un proyecto', () => {
    it('Crea tarea exitosamente si el proyecto pertenece a la organización', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectA1.id}/tasks`)
        .set('x-test-user', JSON.stringify(adminA))
        .send({ title: 'Tarea inicial de sprint', priority: 'alta' });

      assert.strictEqual(res.status, 201);
      assert.ok(res.body.id);
    });

    it('Rechaza creación si el proyecto pertenece a otra organización', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectB1.id}/tasks`)
        .set('x-test-user', JSON.stringify(adminA))
        .send({ title: 'Intento ilegítimo', priority: 'alta' });

      assert.strictEqual(res.status, 404);
      assert.ok(res.body.error);
    });
  });

  // 2. Crear sprint con fechas válidas; rechazo con fin < inicio
  describe('2. Crear sprint y validación de fechas', () => {
    it('Crea sprint exitosamente con fechas válidas (fin >= inicio)', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectA1.id}/sprints`)
        .set('x-test-user', JSON.stringify(adminA))
        .send({
          name: 'Sprint 1 - Autenticación',
          goal: 'Completar login y roles',
          start_date: '2026-10-01',
          end_date: '2026-10-15'
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.name, 'Sprint 1 - Autenticación');
      assert.strictEqual(res.body.status, 'planificado');
    });

    it('Rechaza creación de sprint si fin < inicio', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectA1.id}/sprints`)
        .set('x-test-user', JSON.stringify(adminA))
        .send({
          name: 'Sprint Fechas Inválidas',
          start_date: '2026-10-15',
          end_date: '2026-10-01'
        });

      assert.strictEqual(res.status, 400);
      assert.ok(res.body.error);
    });
  });

  // 3. Asignar tarea a sprint del mismo proyecto; rechazo (400) si el sprint es de otro proyecto
  describe('3. Asignación de tarea a sprint', () => {
    let sprintProj1;
    let sprintProj2;
    let taskProj1;

    before(async () => {
      const resS1 = await request(app)
        .post(`/api/projects/${projectA1.id}/sprints`)
        .set('x-test-user', JSON.stringify(adminA))
        .send({ name: 'Sprint Proj 1', start_date: '2026-10-01', end_date: '2026-10-15' });
      sprintProj1 = resS1.body.id;

      const resS2 = await request(app)
        .post(`/api/projects/${projectA2.id}/sprints`)
        .set('x-test-user', JSON.stringify(adminA))
        .send({ name: 'Sprint Proj 2', start_date: '2026-10-01', end_date: '2026-10-15' });
      sprintProj2 = resS2.body.id;

      const resT = await request(app)
        .post(`/api/projects/${projectA1.id}/tasks`)
        .set('x-test-user', JSON.stringify(adminA))
        .send({ title: 'Tarea Proyecto 1' });
      taskProj1 = resT.body.id;
    });

    it('Asigna tarea a sprint del mismo proyecto correctamente', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${taskProj1}/sprint`)
        .set('x-test-user', JSON.stringify(adminA))
        .send({ sprint_id: sprintProj1 });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.ok, true);
      assert.strictEqual(res.body.sprint_id, sprintProj1);
    });

    it('Rechaza (400) asignar tarea si el sprint pertenece a otro proyecto', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${taskProj1}/sprint`)
        .set('x-test-user', JSON.stringify(adminA))
        .send({ sprint_id: sprintProj2 });

      assert.strictEqual(res.status, 400);
      assert.ok(res.body.error);
    });
  });

  // 4. Iniciar sprint; rechazo (409) si ya hay otro activo en el proyecto; rechazo al iniciar uno ya cerrado
  describe('4. Iniciar sprint y restricciones de estado', () => {
    let sprintActive;
    let sprintSecond;

    before(async () => {
      const res1 = await request(app)
        .post(`/api/projects/${projectA1.id}/sprints`)
        .set('x-test-user', JSON.stringify(adminA))
        .send({ name: 'Sprint Para Iniciar', start_date: '2026-10-01', end_date: '2026-10-15' });
      sprintActive = res1.body.id;

      const res2 = await request(app)
        .post(`/api/projects/${projectA1.id}/sprints`)
        .set('x-test-user', JSON.stringify(adminA))
        .send({ name: 'Sprint Segundo', start_date: '2026-10-16', end_date: '2026-10-30' });
      sprintSecond = res2.body.id;
    });

    it('Inicia sprint planificado correctamente', async () => {
      const res = await request(app)
        .post(`/api/sprints/${sprintActive}/start`)
        .set('x-test-user', JSON.stringify(adminA));

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'activo');
    });

    it('Rechaza (409) iniciar otro sprint si ya hay uno activo en el proyecto', async () => {
      const res = await request(app)
        .post(`/api/sprints/${sprintSecond}/start`)
        .set('x-test-user', JSON.stringify(adminA));

      assert.strictEqual(res.status, 409);
      assert.ok(res.body.error);
    });

    it('Rechaza (409) al intentar iniciar un sprint ya cerrado', async () => {
      await request(app)
        .post(`/api/sprints/${sprintActive}/close`)
        .set('x-test-user', JSON.stringify(adminA));

      const res = await request(app)
        .post(`/api/sprints/${sprintActive}/start`)
        .set('x-test-user', JSON.stringify(adminA));

      assert.strictEqual(res.status, 409);
      assert.ok(res.body.error);
    });
  });

  // 5. Cerrar sprint: las tareas no completadas vuelven al backlog (o al sprint destino) y el resumen es correcto
  describe('5. Cerrar sprint y redistribución de pendientes', () => {
    let sprintToClose;
    let plannedNextSprint;
    let taskDone;
    let taskPending;

    before(async () => {
      const resS = await request(app)
        .post(`/api/projects/${projectA2.id}/sprints`)
        .set('x-test-user', JSON.stringify(adminA))
        .send({ name: 'Sprint Cerrar Test', start_date: '2026-10-01', end_date: '2026-10-15' });
      sprintToClose = resS.body.id;

      const resNext = await request(app)
        .post(`/api/projects/${projectA2.id}/sprints`)
        .set('x-test-user', JSON.stringify(adminA))
        .send({ name: 'Sprint Futuro', start_date: '2026-10-16', end_date: '2026-10-31' });
      plannedNextSprint = resNext.body.id;

      await request(app).post(`/api/sprints/${sprintToClose}/start`).set('x-test-user', JSON.stringify(adminA));

      const resT1 = await request(app)
        .post(`/api/projects/${projectA2.id}/tasks`)
        .set('x-test-user', JSON.stringify(adminA))
        .send({ title: 'Tarea Terminada', status: 'completada', sprint_id: sprintToClose });
      taskDone = resT1.body.id;

      const resT2 = await request(app)
        .post(`/api/projects/${projectA2.id}/tasks`)
        .set('x-test-user', JSON.stringify(adminA))
        .send({ title: 'Tarea Incompleta', status: 'en_proceso', sprint_id: sprintToClose });
      taskPending = resT2.body.id;
    });

    it('Cierra sprint, devuelve resumen correcto y mueve pendientes al sprint destino', async () => {
      const res = await request(app)
        .post(`/api/sprints/${sprintToClose}/close`)
        .set('x-test-user', JSON.stringify(adminA))
        .send({ move_to_sprint_id: plannedNextSprint });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'cerrado');
      assert.strictEqual(res.body.completed, 1);
      assert.strictEqual(res.body.pending, 1);

      // Verificamos que la tarea pendiente ahora pertenece al siguiente sprint
      const taskCheck = await request(app)
        .get(`/api/tasks/${taskPending}`)
        .set('x-test-user', JSON.stringify(adminA));

      assert.strictEqual(taskCheck.body.sprint_id, plannedNextSprint);
    });
  });

  // 6. GET /api/sprints/:id devuelve tareas y pendientes correctos
  describe('6. GET /api/sprints/:id y cálculo de resumen', () => {
    let sprintId;

    before(async () => {
      const resS = await request(app)
        .post(`/api/projects/${projectA1.id}/sprints`)
        .set('x-test-user', JSON.stringify(adminA))
        .send({ name: 'Sprint Detalle Test', start_date: '2026-10-01', end_date: '2026-10-15' });
      sprintId = resS.body.id;

      await request(app)
        .post(`/api/projects/${projectA1.id}/tasks`)
        .set('x-test-user', JSON.stringify(adminA))
        .send({ title: 'Tarea T1', status: 'completada', sprint_id: sprintId });

      await request(app)
        .post(`/api/projects/${projectA1.id}/tasks`)
        .set('x-test-user', JSON.stringify(adminA))
        .send({ title: 'Tarea T2', status: 'pendiente', sprint_id: sprintId });
    });

    it('Devuelve sprint con agrupación por estado, resumen y backlog', async () => {
      const res = await request(app)
        .get(`/api/sprints/${sprintId}`)
        .set('x-test-user', JSON.stringify(adminA));

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.sprint);
      assert.ok(res.body.by_status);
      assert.strictEqual(res.body.summary.total, 2);
      assert.strictEqual(res.body.summary.completed, 1);
      assert.strictEqual(res.body.summary.pending, 1);
      assert.strictEqual(res.body.summary.progress, 50);
      assert.strictEqual(res.body.pending_tasks.length, 1);
      assert.ok(Array.isArray(res.body.backlog));
    });
  });

  // 7. Aislamiento multi-tenant: un usuario de otra organización recibe 404 en sprints/tareas ajenos
  describe('7. Aislamiento multi-tenant', () => {
    let sprintA;
    let taskA;

    before(async () => {
      const resS = await request(app)
        .post(`/api/projects/${projectA1.id}/sprints`)
        .set('x-test-user', JSON.stringify(adminA))
        .send({ name: 'Sprint Org A', start_date: '2026-10-01', end_date: '2026-10-15' });
      sprintA = resS.body.id;

      const resT = await request(app)
        .post(`/api/projects/${projectA1.id}/tasks`)
        .set('x-test-user', JSON.stringify(adminA))
        .send({ title: 'Tarea Org A' });
      taskA = resT.body.id;
    });

    it('Usuario de Organización B recibe 404 al consultar sprint de Organización A', async () => {
      const res = await request(app)
        .get(`/api/sprints/${sprintA}`)
        .set('x-test-user', JSON.stringify(adminB));

      assert.strictEqual(res.status, 404);
      assert.ok(res.body.error);
    });

    it('Usuario de Organización B recibe 404 al consultar tarea de Organización A', async () => {
      const res = await request(app)
        .get(`/api/tasks/${taskA}`)
        .set('x-test-user', JSON.stringify(adminB));

      assert.strictEqual(res.status, 404);
      assert.ok(res.body.error);
    });
  });

  // 8. Permisos por rol: viewer y member no pueden crear/iniciar/cerrar sprints
  describe('8. Permisos por rol en sprints', () => {
    let sprintId;

    before(async () => {
      const resS = await request(app)
        .post(`/api/projects/${projectA1.id}/sprints`)
        .set('x-test-user', JSON.stringify(adminA))
        .send({ name: 'Sprint Permisos', start_date: '2026-10-01', end_date: '2026-10-15' });
      sprintId = resS.body.id;
    });

    it('Viewer recibe 403 al intentar crear sprint', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectA1.id}/sprints`)
        .set('x-test-user', JSON.stringify(viewerA))
        .send({ name: 'Sprint Viewer', start_date: '2026-10-01', end_date: '2026-10-15' });

      assert.strictEqual(res.status, 403);
    });

    it('Member recibe 403 al intentar crear sprint', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectA1.id}/sprints`)
        .set('x-test-user', JSON.stringify(memberA))
        .send({ name: 'Sprint Member', start_date: '2026-10-01', end_date: '2026-10-15' });

      assert.strictEqual(res.status, 403);
    });

    it('Viewer y Member reciben 403 al intentar iniciar sprint', async () => {
      const resV = await request(app).post(`/api/sprints/${sprintId}/start`).set('x-test-user', JSON.stringify(viewerA));
      assert.strictEqual(resV.status, 403);

      const resM = await request(app).post(`/api/sprints/${sprintId}/start`).set('x-test-user', JSON.stringify(memberA));
      assert.strictEqual(resM.status, 403);
    });

    it('Viewer y Member reciben 403 al intentar cerrar sprint', async () => {
      const resV = await request(app).post(`/api/sprints/${sprintId}/close`).set('x-test-user', JSON.stringify(viewerA));
      assert.strictEqual(resV.status, 403);

      const resM = await request(app).post(`/api/sprints/${sprintId}/close`).set('x-test-user', JSON.stringify(memberA));
      assert.strictEqual(resM.status, 403);
    });
  });

  // 9. GET /api/templates devuelve plantillas de ambos tipos
  describe('9. Plantillas de historias y sprints (KB-01)', () => {
    it('Devuelve al menos 3 plantillas de historias de usuario', async () => {
      const res = await request(app)
        .get('/api/templates?type=story')
        .set('x-test-user', JSON.stringify(memberA));

      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.ok(res.body.length >= 3);
      const ids = res.body.map(t => t.id);
      assert.ok(ids.includes('historia_usuario'));
      assert.ok(ids.includes('reporte_bug'));
      assert.ok(ids.includes('tarea_tecnica_spike'));
    });

    it('Devuelve al menos 2 plantillas de planificación de sprint', async () => {
      const res = await request(app)
        .get('/api/templates?type=sprint')
        .set('x-test-user', JSON.stringify(adminA));

      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.ok(res.body.length >= 2);
      const ids = res.body.map(t => t.id);
      assert.ok(ids.includes('sprint_estandar'));
      assert.ok(ids.includes('sprint_estabilizacion'));
    });

    it('Devuelve ambas colecciones si no se pasa parámetro type', async () => {
      const res = await request(app)
        .get('/api/templates')
        .set('x-test-user', JSON.stringify(adminA));

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.story);
      assert.ok(res.body.sprint);
    });
  });
});
