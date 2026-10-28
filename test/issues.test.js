process.env.NODE_ENV = 'test';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../app');

describe('Sprint 3 - Funcionalidad 3: Gestión de Incidencias (Issues)', () => {
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
  let memberAId;

  before(async () => {
    db = app.locals.database;
    await app.ensureRuntimeSchema();

    const suffix = Date.now();
    const orgARes = await db.prepare(
      `INSERT INTO organizations (name, slug) VALUES (?, ?) RETURNING id`
    ).run(`Org Issues A ${suffix}`, `org-issues-a-${suffix}`);
    orgAId = orgARes.lastInsertRowid;

    const orgBRes = await db.prepare(
      `INSERT INTO organizations (name, slug) VALUES (?, ?) RETURNING id`
    ).run(`Org Issues B ${suffix}`, `org-issues-b-${suffix}`);
    orgBId = orgBRes.lastInsertRowid;

    const uAdminA = await db.prepare(
      `INSERT INTO users (name, username, email, password, role, organization_id)
       VALUES (?, ?, ?, 'hash', 'admin', ?) RETURNING id`
    ).run('Admin Issues A', `admin_i_${suffix}`, `admin_i_${suffix}@test.local`, orgAId);

    const uPmA = await db.prepare(
      `INSERT INTO users (name, username, email, password, role, organization_id)
       VALUES (?, ?, ?, 'hash', 'project_manager', ?) RETURNING id`
    ).run('PM Issues A', `pm_i_${suffix}`, `pm_i_${suffix}@test.local`, orgAId);

    const uMemberA = await db.prepare(
      `INSERT INTO users (name, username, email, password, role, organization_id)
       VALUES (?, ?, ?, 'hash', 'member', ?) RETURNING id`
    ).run('Member Issues A', `mem_i_${suffix}`, `mem_i_${suffix}@test.local`, orgAId);
    memberAId = uMemberA.lastInsertRowid;

    const uViewerA = await db.prepare(
      `INSERT INTO users (name, username, email, password, role, organization_id)
       VALUES (?, ?, ?, 'hash', 'viewer', ?) RETURNING id`
    ).run('Viewer Issues A', `view_i_${suffix}`, `view_i_${suffix}@test.local`, orgAId);

    const uAdminB = await db.prepare(
      `INSERT INTO users (name, username, email, password, role, organization_id)
       VALUES (?, ?, ?, 'hash', 'admin', ?) RETURNING id`
    ).run('Admin Issues B', `admin_ib_${suffix}`, `admin_ib_${suffix}@test.local`, orgBId);

    adminAUser = JSON.stringify({ id: uAdminA.lastInsertRowid, role: 'admin', organization_id: orgAId, name: 'Admin A' });
    pmAUser = JSON.stringify({ id: uPmA.lastInsertRowid, role: 'project_manager', organization_id: orgAId, name: 'PM A' });
    memberAUser = JSON.stringify({ id: memberAId, role: 'member', organization_id: orgAId, name: 'Member A' });
    viewerAUser = JSON.stringify({ id: uViewerA.lastInsertRowid, role: 'viewer', organization_id: orgAId, name: 'Viewer A' });
    adminBUser = JSON.stringify({ id: uAdminB.lastInsertRowid, role: 'admin', organization_id: orgBId, name: 'Admin B' });

    const projARes = await db.prepare(
      `INSERT INTO projects (name, description, organization_id) VALUES (?, ?, ?) RETURNING id`
    ).run('Proyecto A Incidencias', 'Descripción Proyecto A', orgAId);
    projectAId = projARes.lastInsertRowid;

    const projBRes = await db.prepare(
      `INSERT INTO projects (name, description, organization_id) VALUES (?, ?, ?) RETURNING id`
    ).run('Proyecto B Incidencias', 'Descripción Proyecto B', orgBId);
    projectBId = projBRes.lastInsertRowid;
  });

  after(async () => {
    if (orgAId) {
      await db.prepare('DELETE FROM organizations WHERE id = ?').run(orgAId);
    }
    if (orgBId) {
      await db.prepare('DELETE FROM organizations WHERE id = ?').run(orgBId);
    }
    setTimeout(() => process.exit(0), 100);
  });

  describe('1. CRUD de Incidencias (Issues) y Filtros', () => {
    let createdIssueId;

    it('1.1 Debe permitir a un Member reportar una incidencia en el proyecto', async () => {
      const res = await request(app)
        .post('/api/issues')
        .set('x-test-user', memberAUser)
        .send({
          project_id: projectAId,
          title: 'Error 500 al exportar reporte de ventas',
          description: 'Falla intermitente en el endpoint de exportación en formato XLSX',
          priority: 'high',
          status: 'open',
          assigned_to: memberAId
        });

      assert.equal(res.status, 201);
      assert.ok(res.body.id);
      assert.equal(res.body.title, 'Error 500 al exportar reporte de ventas');
      assert.equal(res.body.priority, 'high');
      assert.equal(res.body.status, 'open');
      assert.equal(res.body.reported_by, memberAId);
      assert.equal(res.body.assigned_to, memberAId);
      createdIssueId = res.body.id;
    });

    it('1.2 Debe listar incidencias con filtros por estado, prioridad y responsable', async () => {
      // Filtro por estado 'open'
      let res = await request(app)
        .get(`/api/projects/${projectAId}/issues?status=open`)
        .set('x-test-user', pmAUser);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
      const found = res.body.find(i => i.id === createdIssueId);
      assert.ok(found, 'Debe encontrarse con filtro de estado open');

      // Filtro por prioridad 'high'
      res = await request(app)
        .get(`/api/issues?project_id=${projectAId}&priority=high`)
        .set('x-test-user', pmAUser);

      assert.equal(res.status, 200);
      const foundPriority = res.body.find(i => i.id === createdIssueId);
      assert.ok(foundPriority, 'Debe encontrarse con filtro de prioridad high');

      // Filtro por responsable
      res = await request(app)
        .get(`/api/issues?project_id=${projectAId}&assigned_to=${memberAId}`)
        .set('x-test-user', pmAUser);

      assert.equal(res.status, 200);
      const foundAssignee = res.body.find(i => i.id === createdIssueId);
      assert.ok(foundAssignee, 'Debe encontrarse con filtro de responsable');
    });

    it('1.3 Debe obtener el detalle de una incidencia específica', async () => {
      const res = await request(app)
        .get(`/api/issues/${createdIssueId}`)
        .set('x-test-user', pmAUser);

      assert.equal(res.status, 200);
      assert.equal(res.body.id, createdIssueId);
      assert.equal(res.body.title, 'Error 500 al exportar reporte de ventas');
    });

    it('1.4 Debe permitir actualizar el estado (in_progress, resolved, closed) y prioridad', async () => {
      // Cambiar a in_progress
      let res = await request(app)
        .put(`/api/issues/${createdIssueId}`)
        .set('x-test-user', pmAUser)
        .send({ status: 'in_progress', priority: 'critical' });

      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'in_progress');
      assert.equal(res.body.priority, 'critical');

      // Cambiar a resolved
      res = await request(app)
        .put(`/api/issues/${createdIssueId}`)
        .set('x-test-user', pmAUser)
        .send({ status: 'resolved' });

      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'resolved');

      // Cambiar a closed
      res = await request(app)
        .put(`/api/issues/${createdIssueId}`)
        .set('x-test-user', pmAUser)
        .send({ status: 'closed' });

      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'closed');
    });

    it('1.5 Debe permitir al admin o PM eliminar una incidencia', async () => {
      const res = await request(app)
        .delete(`/api/issues/${createdIssueId}`)
        .set('x-test-user', adminAUser);

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);

      const check = await request(app)
        .get(`/api/issues/${createdIssueId}`)
        .set('x-test-user', adminAUser);

      assert.equal(check.status, 404);
    });
  });

  describe('2. Aislamiento Multi-Tenant (RNF04)', () => {
    let issueOrgAId;

    before(async () => {
      const res = await request(app)
        .post('/api/issues')
        .set('x-test-user', adminAUser)
        .send({
          project_id: projectAId,
          title: 'Incidencia Confidencial Org A',
          priority: 'medium',
          status: 'open'
        });
      issueOrgAId = res.body.id;
    });

    it('2.1 Usuario de Org B recibe 404 al consultar incidencia de Org A', async () => {
      const res = await request(app)
        .get(`/api/issues/${issueOrgAId}`)
        .set('x-test-user', adminBUser);

      assert.equal(res.status, 404);
    });

    it('2.2 Usuario de Org B recibe 404 al intentar modificar incidencia de Org A', async () => {
      const res = await request(app)
        .put(`/api/issues/${issueOrgAId}`)
        .set('x-test-user', adminBUser)
        .send({ title: 'Ataque cross-tenant incidencia' });

      assert.equal(res.status, 404);
    });

    it('2.3 Usuario de Org B recibe 404 al intentar eliminar incidencia de Org A', async () => {
      const res = await request(app)
        .delete(`/api/issues/${issueOrgAId}`)
        .set('x-test-user', adminBUser);

      assert.equal(res.status, 404);
    });

    it('2.4 Usuario de Org B recibe 404 al intentar crear incidencia en proyecto de Org A', async () => {
      const res = await request(app)
        .post('/api/issues')
        .set('x-test-user', adminBUser)
        .send({
          project_id: projectAId,
          title: 'Incidencia espía'
        });

      assert.equal(res.status, 404);
    });
  });

  describe('3. Control de Acceso por Roles (admin, project_manager, member, viewer)', () => {
    let testIssueId;

    before(async () => {
      const res = await request(app)
        .post('/api/issues')
        .set('x-test-user', adminAUser)
        .send({
          project_id: projectAId,
          title: 'Incidencia prueba roles',
          priority: 'low'
        });
      testIssueId = res.body.id;
    });

    it('3.1 Rol viewer puede consultar incidencias (solo lectura)', async () => {
      const res = await request(app)
        .get(`/api/issues/${testIssueId}`)
        .set('x-test-user', viewerAUser);

      assert.equal(res.status, 200);
      assert.equal(res.body.title, 'Incidencia prueba roles');
    });

    it('3.2 Rol viewer recibe 403 al intentar reportar (crear) una incidencia', async () => {
      const res = await request(app)
        .post('/api/issues')
        .set('x-test-user', viewerAUser)
        .send({
          project_id: projectAId,
          title: 'Incidencia por viewer'
        });

      assert.equal(res.status, 403);
    });

    it('3.3 Rol viewer recibe 403 al intentar actualizar una incidencia', async () => {
      const res = await request(app)
        .put(`/api/issues/${testIssueId}`)
        .set('x-test-user', viewerAUser)
        .send({ title: 'Edición no permitida viewer' });

      assert.equal(res.status, 403);
    });

    it('3.4 Rol viewer recibe 403 al intentar eliminar una incidencia', async () => {
      const res = await request(app)
        .delete(`/api/issues/${testIssueId}`)
        .set('x-test-user', viewerAUser);

      assert.equal(res.status, 403);
    });

    it('3.5 Rol member recibe 403 al intentar eliminar una incidencia (reservado a PM y admin)', async () => {
      const res = await request(app)
        .delete(`/api/issues/${testIssueId}`)
        .set('x-test-user', memberAUser);

      assert.equal(res.status, 403);
    });
  });

  describe('4. Validaciones de Entrada (RNF06)', () => {
    it('4.1 Rechaza incidencia sin título con 400', async () => {
      const res = await request(app)
        .post('/api/issues')
        .set('x-test-user', memberAUser)
        .send({
          project_id: projectAId,
          title: '   '
        });

      assert.equal(res.status, 400);
      assert.ok(res.body.error);
    });

    it('4.2 Rechaza prioridad no válida con 400', async () => {
      const res = await request(app)
        .post('/api/issues')
        .set('x-test-user', memberAUser)
        .send({
          project_id: projectAId,
          title: 'Incidencia prioridad mala',
          priority: 'super_ultra_urgente'
        });

      assert.equal(res.status, 400);
      assert.ok(res.body.error);
    });

    it('4.3 Rechaza estado no válido con 400', async () => {
      const res = await request(app)
        .post('/api/issues')
        .set('x-test-user', memberAUser)
        .send({
          project_id: projectAId,
          title: 'Incidencia estado malo',
          status: 'estado_inexistente'
        });

      assert.equal(res.status, 400);
      assert.ok(res.body.error);
    });

    it('4.4 Rechaza responsable inexistente con 404', async () => {
      const res = await request(app)
        .post('/api/issues')
        .set('x-test-user', memberAUser)
        .send({
          project_id: projectAId,
          title: 'Incidencia responsable malo',
          assigned_to: 999999
        });

      assert.equal(res.status, 404);
      assert.ok(res.body.error);
    });
  });

  describe('5. Auditoría de Actividad (RNF17)', () => {
    it('5.1 Registra en activities al crear y actualizar incidencias', async () => {
      const res = await request(app)
        .post('/api/issues')
        .set('x-test-user', memberAUser)
        .send({
          project_id: projectAId,
          title: 'Incidencia Auditoría Actividad',
          priority: 'critical'
        });

      assert.equal(res.status, 201);

      const activity = await db.prepare(
        `SELECT * FROM activities WHERE organization_id = ? AND project_id = ? AND action = ? ORDER BY id DESC LIMIT 1`
      ).get(orgAId, projectAId, 'issue.created');

      assert.ok(activity, 'Debe registrarse en activities');
      assert.ok(activity.description.includes('Incidencia Auditoría Actividad'));
    });
  });
});
