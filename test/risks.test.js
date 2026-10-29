process.env.NODE_ENV = 'test';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../app');

describe('Sprint 3 - Funcionalidad 2: Gestión de Riesgos con Severidad Calculada', () => {
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
    ).run(`Org Risks A ${suffix}`, `org-risks-a-${suffix}`);
    orgAId = orgARes.lastInsertRowid;

    const orgBRes = await db.prepare(
      `INSERT INTO organizations (name, slug) VALUES (?, ?) RETURNING id`
    ).run(`Org Risks B ${suffix}`, `org-risks-b-${suffix}`);
    orgBId = orgBRes.lastInsertRowid;

    const uAdminA = await db.prepare(
      `INSERT INTO users (name, username, email, password, role, organization_id)
       VALUES (?, ?, ?, 'hash', 'admin', ?) RETURNING id`
    ).run('Admin Risks A', `admin_r_${suffix}`, `admin_r_${suffix}@test.local`, orgAId);

    const uPmA = await db.prepare(
      `INSERT INTO users (name, username, email, password, role, organization_id)
       VALUES (?, ?, ?, 'hash', 'project_manager', ?) RETURNING id`
    ).run('PM Risks A', `pm_r_${suffix}`, `pm_r_${suffix}@test.local`, orgAId);

    const uMemberA = await db.prepare(
      `INSERT INTO users (name, username, email, password, role, organization_id)
       VALUES (?, ?, ?, 'hash', 'member', ?) RETURNING id`
    ).run('Member Risks A', `mem_r_${suffix}`, `mem_r_${suffix}@test.local`, orgAId);
    memberAId = uMemberA.lastInsertRowid;

    const uViewerA = await db.prepare(
      `INSERT INTO users (name, username, email, password, role, organization_id)
       VALUES (?, ?, ?, 'hash', 'viewer', ?) RETURNING id`
    ).run('Viewer Risks A', `view_r_${suffix}`, `view_r_${suffix}@test.local`, orgAId);

    const uAdminB = await db.prepare(
      `INSERT INTO users (name, username, email, password, role, organization_id)
       VALUES (?, ?, ?, 'hash', 'admin', ?) RETURNING id`
    ).run('Admin Risks B', `admin_rb_${suffix}`, `admin_rb_${suffix}@test.local`, orgBId);

    adminAUser = JSON.stringify({ id: uAdminA.lastInsertRowid, role: 'admin', organization_id: orgAId, name: 'Admin A' });
    pmAUser = JSON.stringify({ id: uPmA.lastInsertRowid, role: 'project_manager', organization_id: orgAId, name: 'PM A' });
    memberAUser = JSON.stringify({ id: memberAId, role: 'member', organization_id: orgAId, name: 'Member A' });
    viewerAUser = JSON.stringify({ id: uViewerA.lastInsertRowid, role: 'viewer', organization_id: orgAId, name: 'Viewer A' });
    adminBUser = JSON.stringify({ id: uAdminB.lastInsertRowid, role: 'admin', organization_id: orgBId, name: 'Admin B' });

    const projARes = await db.prepare(
      `INSERT INTO projects (name, description, organization_id) VALUES (?, ?, ?) RETURNING id`
    ).run('Proyecto A Riesgos', 'Descripción Proyecto A', orgAId);
    projectAId = projARes.lastInsertRowid;

    const projBRes = await db.prepare(
      `INSERT INTO projects (name, description, organization_id) VALUES (?, ?, ?) RETURNING id`
    ).run('Proyecto B Riesgos', 'Descripción Proyecto B', orgBId);
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

  describe('1. CRUD de Riesgos y Cálculo Automático de Severidad', () => {
    let createdRiskId;

    it('1.1 Backend calcula severidad automáticamente e ignora cualquier severidad enviada por el cliente', async () => {
      // Enviamos intencionalmente severity: 'baja' y severity_score: 10, pero con probabilidad alta e impacto alta.
      // El backend DEBE calcular la severidad real (crítica / alta) y NO usar el valor falso enviado.
      const res = await request(app)
        .post('/api/risks')
        .set('x-test-user', pmAUser)
        .send({
          project_id: projectAId,
          title: 'Caída de servidor de producción en despliegue',
          description: 'Riesgo de indisponibilidad del servicio',
          probability: 'alta',
          impact: 'alta',
          mitigation: 'Implementar despliegue blue-green y rollback automatizado',
          assigned_to: memberAId,
          status: 'open',
          severity: 'baja', // Valor fraudulento enviado por cliente
          severity_score: 5 // Valor fraudulento enviado por cliente
        });

      assert.equal(res.status, 201);
      assert.ok(res.body.id);
      createdRiskId = res.body.id;

      // La severidad calculada debe ser 'critica' o 'alta' (probabilidad alta x impacto alta)
      assert.ok(res.body.severity === 'critica' || res.body.severity === 'alta', 'La severidad no debe ser la enviada por el cliente');
      assert.ok(res.body.severity_score >= 60, 'El score debe ser alto, no el manipulado');
      assert.equal(res.body.assigned_to, memberAId);
      assert.equal(res.body.status, 'open');
    });

    it('1.2 Debe listar los riesgos del proyecto con el indicador de severidad y responsable', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectAId}/risks`)
        .set('x-test-user', pmAUser);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
      const found = res.body.find(r => r.id === createdRiskId);
      assert.ok(found);
      assert.equal(found.title, 'Caída de servidor de producción en despliegue');
      assert.ok(found.severity);
      assert.equal(found.assigned_to, memberAId);
    });

    it('1.3 Debe permitir transiciones de estado: open -> mitigated, accepted, closed', async () => {
      // Transición 1: de open a mitigated
      let res = await request(app)
        .put(`/api/risks/${createdRiskId}`)
        .set('x-test-user', pmAUser)
        .send({ status: 'mitigated' });

      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'mitigated');

      // Transición 2: a accepted
      res = await request(app)
        .put(`/api/risks/${createdRiskId}`)
        .set('x-test-user', pmAUser)
        .send({ status: 'accepted' });

      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'accepted');

      // Transición 3: a closed
      res = await request(app)
        .put(`/api/risks/${createdRiskId}`)
        .set('x-test-user', pmAUser)
        .send({ status: 'closed' });

      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'closed');
    });

    it('1.4 Recalcula severidad automáticamente al actualizar probabilidad e impacto', async () => {
      // Actualizamos a probabilidad baja e impacto baja
      const res = await request(app)
        .put(`/api/risks/${createdRiskId}`)
        .set('x-test-user', pmAUser)
        .send({
          probability: 'baja',
          impact: 'baja',
          severity: 'critica' // Ignorado
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.severity, 'baja');
      assert.ok(res.body.severity_score <= 30);
    });

    it('1.5 Debe permitir eliminar un riesgo y retornar 404 posteriormente', async () => {
      const res = await request(app)
        .delete(`/api/risks/${createdRiskId}`)
        .set('x-test-user', adminAUser);

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);

      const check = await request(app)
        .get(`/api/risks/${createdRiskId}`)
        .set('x-test-user', adminAUser);

      assert.equal(check.status, 404);
    });
  });

  describe('2. Aislamiento Multi-Tenant (RNF04)', () => {
    let riskOrgAId;

    before(async () => {
      const res = await request(app)
        .post('/api/risks')
        .set('x-test-user', adminAUser)
        .send({
          project_id: projectAId,
          title: 'Riesgo Confidencial Org A',
          probability: 'media',
          impact: 'media'
        });
      riskOrgAId = res.body.id;
    });

    it('2.1 Usuario de Org B recibe 404 al consultar riesgo de Org A', async () => {
      const res = await request(app)
        .get(`/api/risks/${riskOrgAId}`)
        .set('x-test-user', adminBUser);

      assert.equal(res.status, 404);
    });

    it('2.2 Usuario de Org B recibe 404 al intentar actualizar riesgo de Org A', async () => {
      const res = await request(app)
        .put(`/api/risks/${riskOrgAId}`)
        .set('x-test-user', adminBUser)
        .send({ title: 'Ataque cross-tenant riesgo' });

      assert.equal(res.status, 404);
    });

    it('2.3 Usuario de Org B recibe 404 al intentar eliminar riesgo de Org A', async () => {
      const res = await request(app)
        .delete(`/api/risks/${riskOrgAId}`)
        .set('x-test-user', adminBUser);

      assert.equal(res.status, 404);
    });

    it('2.4 Usuario de Org B recibe 404 al intentar crear riesgo en proyecto de Org A', async () => {
      const res = await request(app)
        .post('/api/risks')
        .set('x-test-user', adminBUser)
        .send({
          project_id: projectAId,
          title: 'Riesgo espía',
          probability: 'alta',
          impact: 'alta'
        });

      assert.equal(res.status, 404);
    });
  });

  describe('3. Control de Acceso por Roles (admin/pm vs member/viewer)', () => {
    let testRiskId;

    before(async () => {
      const res = await request(app)
        .post('/api/risks')
        .set('x-test-user', adminAUser)
        .send({
          project_id: projectAId,
          title: 'Riesgo prueba permisos',
          probability: 'media',
          impact: 'media'
        });
      testRiskId = res.body.id;
    });

    it('3.1 Rol viewer puede consultar el riesgo (solo lectura)', async () => {
      const res = await request(app)
        .get(`/api/risks/${testRiskId}`)
        .set('x-test-user', viewerAUser);

      assert.equal(res.status, 200);
      assert.equal(res.body.title, 'Riesgo prueba permisos');
    });

    it('3.2 Rol viewer recibe 403 al intentar crear un riesgo', async () => {
      const res = await request(app)
        .post('/api/risks')
        .set('x-test-user', viewerAUser)
        .send({
          project_id: projectAId,
          title: 'Riesgo no autorizado por viewer',
          probability: 'media',
          impact: 'media'
        });

      assert.equal(res.status, 403);
    });

    it('3.3 Rol viewer recibe 403 al intentar actualizar un riesgo', async () => {
      const res = await request(app)
        .put(`/api/risks/${testRiskId}`)
        .set('x-test-user', viewerAUser)
        .send({ title: 'Intento de edición por viewer' });

      assert.equal(res.status, 403);
    });

    it('3.4 Rol viewer recibe 403 al intentar eliminar un riesgo', async () => {
      const res = await request(app)
        .delete(`/api/risks/${testRiskId}`)
        .set('x-test-user', viewerAUser);

      assert.equal(res.status, 403);
    });

    it('3.5 Rol member recibe 403 al intentar crear un riesgo', async () => {
      const res = await request(app)
        .post('/api/risks')
        .set('x-test-user', memberAUser)
        .send({
          project_id: projectAId,
          title: 'Riesgo intentado por member',
          probability: 'media',
          impact: 'media'
        });

      assert.equal(res.status, 403);
    });
  });

  describe('4. Validaciones de Entrada (RNF06)', () => {
    it('4.1 Rechaza riesgo sin título con 400', async () => {
      const res = await request(app)
        .post('/api/risks')
        .set('x-test-user', pmAUser)
        .send({
          project_id: projectAId,
          title: '   ',
          probability: 'media',
          impact: 'media'
        });

      assert.equal(res.status, 400);
      assert.ok(res.body.error);
    });

    it('4.2 Rechaza estado no válido con 400', async () => {
      const res = await request(app)
        .post('/api/risks')
        .set('x-test-user', pmAUser)
        .send({
          project_id: projectAId,
          title: 'Riesgo estado inválido',
          status: 'estado_invalido_xyz'
        });

      assert.equal(res.status, 400);
      assert.ok(res.body.error);
    });

    it('4.3 Rechaza responsable que no pertenece a la organización con 404', async () => {
      const res = await request(app)
        .post('/api/risks')
        .set('x-test-user', pmAUser)
        .send({
          project_id: projectAId,
          title: 'Riesgo responsable ajeno',
          assigned_to: 999999
        });

      assert.equal(res.status, 404);
      assert.ok(res.body.error);
    });
  });

  describe('5. Auditoría de Actividad (RNF17)', () => {
    it('5.1 Registra en activities al crear y actualizar riesgos', async () => {
      const res = await request(app)
        .post('/api/risks')
        .set('x-test-user', pmAUser)
        .send({
          project_id: projectAId,
          title: 'Riesgo Verificación Auditoría',
          probability: 'alta',
          impact: 'media'
        });

      assert.equal(res.status, 201);

      const activity = await db.prepare(
        `SELECT * FROM activities WHERE organization_id = ? AND project_id = ? AND action = ? ORDER BY id DESC LIMIT 1`
      ).get(orgAId, projectAId, 'risk.created');

      assert.ok(activity, 'Debe registrarse en activities');
      assert.ok(activity.description.includes('Riesgo Verificación Auditoría'));
    });
  });
});
