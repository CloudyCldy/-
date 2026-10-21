process.env.NODE_ENV = 'test';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../app');

describe('Sprint 3 - Funcionalidad 1: Gestión de Hitos (Milestones)', () => {
  let db;
  let orgAId;
  let orgBId;
  let projectAId;
  let projectBId;
  let adminAUser;
  let pmAUser;
  let memberAUser;
  let viewerAUser;
  let adminBUser;

  before(async () => {
    db = app.locals.database;
    await app.ensureRuntimeSchema();

    // Crear organizaciones de prueba
    const suffix = Date.now();
    const orgARes = await db.prepare(
      `INSERT INTO organizations (name, slug) VALUES (?, ?) RETURNING id`
    ).run(`Org Milestones A ${suffix}`, `org-ms-a-${suffix}`);
    orgAId = orgARes.lastInsertRowid;

    const orgBRes = await db.prepare(
      `INSERT INTO organizations (name, slug) VALUES (?, ?) RETURNING id`
    ).run(`Org Milestones B ${suffix}`, `org-ms-b-${suffix}`);
    orgBId = orgBRes.lastInsertRowid;

    // Crear usuarios de prueba con roles
    const uAdminA = await db.prepare(
      `INSERT INTO users (name, username, email, password, role, organization_id)
       VALUES (?, ?, ?, 'hash', 'admin', ?) RETURNING id`
    ).run('Admin A', `admin_a_${suffix}`, `admin_a_${suffix}@test.local`, orgAId);

    const uPmA = await db.prepare(
      `INSERT INTO users (name, username, email, password, role, organization_id)
       VALUES (?, ?, ?, 'hash', 'project_manager', ?) RETURNING id`
    ).run('PM A', `pm_a_${suffix}`, `pm_a_${suffix}@test.local`, orgAId);

    const uMemberA = await db.prepare(
      `INSERT INTO users (name, username, email, password, role, organization_id)
       VALUES (?, ?, ?, 'hash', 'member', ?) RETURNING id`
    ).run('Member A', `mem_a_${suffix}`, `mem_a_${suffix}@test.local`, orgAId);

    const uViewerA = await db.prepare(
      `INSERT INTO users (name, username, email, password, role, organization_id)
       VALUES (?, ?, ?, 'hash', 'viewer', ?) RETURNING id`
    ).run('Viewer A', `view_a_${suffix}`, `view_a_${suffix}@test.local`, orgAId);

    const uAdminB = await db.prepare(
      `INSERT INTO users (name, username, email, password, role, organization_id)
       VALUES (?, ?, ?, 'hash', 'admin', ?) RETURNING id`
    ).run('Admin B', `admin_b_${suffix}`, `admin_b_${suffix}@test.local`, orgBId);

    adminAUser = JSON.stringify({ id: uAdminA.lastInsertRowid, role: 'admin', organization_id: orgAId, name: 'Admin A' });
    pmAUser = JSON.stringify({ id: uPmA.lastInsertRowid, role: 'project_manager', organization_id: orgAId, name: 'PM A' });
    memberAUser = JSON.stringify({ id: uMemberA.lastInsertRowid, role: 'member', organization_id: orgAId, name: 'Member A' });
    viewerAUser = JSON.stringify({ id: uViewerA.lastInsertRowid, role: 'viewer', organization_id: orgAId, name: 'Viewer A' });
    adminBUser = JSON.stringify({ id: uAdminB.lastInsertRowid, role: 'admin', organization_id: orgBId, name: 'Admin B' });

    // Crear proyectos de prueba
    const projARes = await db.prepare(
      `INSERT INTO projects (name, description, organization_id) VALUES (?, ?, ?) RETURNING id`
    ).run('Proyecto A Hitos', 'Descripción Proyecto A', orgAId);
    projectAId = projARes.lastInsertRowid;

    const projBRes = await db.prepare(
      `INSERT INTO projects (name, description, organization_id) VALUES (?, ?, ?) RETURNING id`
    ).run('Proyecto B Hitos', 'Descripción Proyecto B', orgBId);
    projectBId = projBRes.lastInsertRowid;
  });

  after(async () => {
    // Limpieza de datos de prueba
    if (orgAId) {
      await db.prepare('DELETE FROM organizations WHERE id = ?').run(orgAId);
    }
    if (orgBId) {
      await db.prepare('DELETE FROM organizations WHERE id = ?').run(orgBId);
    }
    setTimeout(() => process.exit(0), 100);
  });

  describe('1. CRUD de Hitos (Milestones)', () => {
    let createdMilestoneId;

    it('1.1 Debe permitir a un Project Manager crear un hito con datos válidos', async () => {
      const res = await request(app)
        .post('/api/milestones')
        .set('x-test-user', pmAUser)
        .send({
          project_id: projectAId,
          title: 'Entrega Fase 1 - Prototipo MVP',
          description: 'Aprobación del prototipo funcional con el cliente',
          due_date: '2026-11-15',
          status: 'pendiente'
        });

      assert.equal(res.status, 201);
      assert.ok(res.body.id);
      assert.equal(res.body.title, 'Entrega Fase 1 - Prototipo MVP');
      assert.equal(res.body.status, 'pendiente');
      assert.equal(res.body.project_id, projectAId);
      createdMilestoneId = res.body.id;
    });

    it('1.2 Debe listar los hitos asociados al proyecto', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectAId}/milestones`)
        .set('x-test-user', pmAUser);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
      const found = res.body.find(m => m.id === createdMilestoneId);
      assert.ok(found, 'El hito recién creado debe encontrarse en la lista del proyecto');
      assert.equal(found.title, 'Entrega Fase 1 - Prototipo MVP');
    });

    it('1.3 Debe obtener un hito específico por su ID', async () => {
      const res = await request(app)
        .get(`/api/milestones/${createdMilestoneId}`)
        .set('x-test-user', pmAUser);

      assert.equal(res.status, 200);
      assert.equal(res.body.id, createdMilestoneId);
      assert.equal(res.body.title, 'Entrega Fase 1 - Prototipo MVP');
    });

    it('1.4 Debe permitir actualizar el estado y fecha del hito', async () => {
      const res = await request(app)
        .put(`/api/milestones/${createdMilestoneId}`)
        .set('x-test-user', pmAUser)
        .send({
          status: 'en_progreso',
          due_date: '2026-11-20',
          title: 'Entrega Fase 1 - Prototipo MVP Actualizado'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'en_progreso');
      assert.equal(res.body.title, 'Entrega Fase 1 - Prototipo MVP Actualizado');
    });

    it('1.5 Debe permitir al admin eliminar un hito y devolver 404 al intentar consultarlo nuevamente', async () => {
      const res = await request(app)
        .delete(`/api/milestones/${createdMilestoneId}`)
        .set('x-test-user', adminAUser);

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);

      const check = await request(app)
        .get(`/api/milestones/${createdMilestoneId}`)
        .set('x-test-user', adminAUser);

      assert.equal(check.status, 404);
    });
  });

  describe('2. Aislamiento Multi-Tenant (RNF04)', () => {
    let milestoneOrgAId;

    before(async () => {
      const res = await request(app)
        .post('/api/milestones')
        .set('x-test-user', adminAUser)
        .send({
          project_id: projectAId,
          title: 'Hito Secreto Org A',
          due_date: '2026-12-01',
          status: 'pendiente'
        });
      milestoneOrgAId = res.body.id;
    });

    it('2.1 Usuario de Org B recibe 404 al consultar un hito de Org A', async () => {
      const res = await request(app)
        .get(`/api/milestones/${milestoneOrgAId}`)
        .set('x-test-user', adminBUser);

      assert.equal(res.status, 404);
    });

    it('2.2 Usuario de Org B recibe 404 al intentar modificar un hito de Org A', async () => {
      const res = await request(app)
        .put(`/api/milestones/${milestoneOrgAId}`)
        .set('x-test-user', adminBUser)
        .send({ title: 'Ataque de edición cross-tenant' });

      assert.equal(res.status, 404);
    });

    it('2.3 Usuario de Org B recibe 404 al intentar eliminar un hito de Org A', async () => {
      const res = await request(app)
        .delete(`/api/milestones/${milestoneOrgAId}`)
        .set('x-test-user', adminBUser);

      assert.equal(res.status, 404);
    });

    it('2.4 Usuario de Org B no puede crear un hito en un proyecto de Org A', async () => {
      const res = await request(app)
        .post('/api/milestones')
        .set('x-test-user', adminBUser)
        .send({
          project_id: projectAId,
          title: 'Hito espía',
          due_date: '2026-12-01'
        });

      assert.equal(res.status, 404);
    });
  });

  describe('3. Control de Acceso por Roles (admin, project_manager, member, viewer)', () => {
    let testMilestoneId;

    before(async () => {
      const res = await request(app)
        .post('/api/milestones')
        .set('x-test-user', adminAUser)
        .send({
          project_id: projectAId,
          title: 'Hito para prueba de roles',
          due_date: '2026-12-10',
          status: 'pendiente'
        });
      testMilestoneId = res.body.id;
    });

    it('3.1 Rol viewer puede consultar hitos (solo lectura)', async () => {
      const res = await request(app)
        .get(`/api/milestones/${testMilestoneId}`)
        .set('x-test-user', viewerAUser);

      assert.equal(res.status, 200);
      assert.equal(res.body.title, 'Hito para prueba de roles');
    });

    it('3.2 Rol viewer recibe 403 al intentar crear un hito', async () => {
      const res = await request(app)
        .post('/api/milestones')
        .set('x-test-user', viewerAUser)
        .send({
          project_id: projectAId,
          title: 'Hito no autorizado por viewer',
          due_date: '2026-12-15'
        });

      assert.equal(res.status, 403);
    });

    it('3.3 Rol viewer recibe 403 al intentar actualizar un hito', async () => {
      const res = await request(app)
        .put(`/api/milestones/${testMilestoneId}`)
        .set('x-test-user', viewerAUser)
        .send({ title: 'Intento de cambio por viewer' });

      assert.equal(res.status, 403);
    });

    it('3.4 Rol viewer recibe 403 al intentar eliminar un hito', async () => {
      const res = await request(app)
        .delete(`/api/milestones/${testMilestoneId}`)
        .set('x-test-user', viewerAUser);

      assert.equal(res.status, 403);
    });

    it('3.5 Rol member recibe 403 al intentar crear hito (reservado a PM y admin)', async () => {
      const res = await request(app)
        .post('/api/milestones')
        .set('x-test-user', memberAUser)
        .send({
          project_id: projectAId,
          title: 'Hito intentado por member',
          due_date: '2026-12-15'
        });

      assert.equal(res.status, 403);
    });
  });

  describe('4. Validaciones de Entrada (RNF06)', () => {
    it('4.1 Rechaza petición sin título con 400', async () => {
      const res = await request(app)
        .post('/api/milestones')
        .set('x-test-user', pmAUser)
        .send({
          project_id: projectAId,
          title: '   ',
          due_date: '2026-12-01'
        });

      assert.equal(res.status, 400);
      assert.ok(res.body.error);
    });

    it('4.2 Rechaza fecha objetivo no válida con 400', async () => {
      const res = await request(app)
        .post('/api/milestones')
        .set('x-test-user', pmAUser)
        .send({
          project_id: projectAId,
          title: 'Hito fecha mala',
          due_date: 'no-es-una-fecha'
        });

      assert.equal(res.status, 400);
      assert.ok(res.body.error);
    });

    it('4.3 Rechaza estado no permitido con 400', async () => {
      const res = await request(app)
        .post('/api/milestones')
        .set('x-test-user', pmAUser)
        .send({
          project_id: projectAId,
          title: 'Hito estado malo',
          due_date: '2026-12-01',
          status: 'estado_invalido'
        });

      assert.equal(res.status, 400);
      assert.ok(res.body.error);
    });
  });

  describe('5. Auditoría de Actividad (RNF17)', () => {
    it('5.1 Debe registrar la actividad en la tabla activities al crear un hito', async () => {
      const res = await request(app)
        .post('/api/milestones')
        .set('x-test-user', pmAUser)
        .send({
          project_id: projectAId,
          title: 'Hito Auditoría Verificación',
          due_date: '2026-12-24',
          status: 'pendiente'
        });

      assert.equal(res.status, 201);

      const activity = await db.prepare(
        `SELECT * FROM activities WHERE organization_id = ? AND project_id = ? AND action = ? ORDER BY id DESC LIMIT 1`
      ).get(orgAId, projectAId, 'milestone.created');

      assert.ok(activity, 'Debe existir registro en activities');
      assert.ok(activity.description.includes('Hito Auditoría Verificación'));
    });
  });
});
