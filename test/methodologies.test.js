process.env.NODE_ENV = 'test';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../app');
const { registry } = require('../server/services/methodologyRegistry');

describe('Sprint 3 - Funcionalidad 4: Catálogo de Metodologías Extensible', () => {
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

    const suffix = Date.now();
    const orgARes = await db.prepare(
      `INSERT INTO organizations (name, slug) VALUES (?, ?) RETURNING id`
    ).run(`Org Method A ${suffix}`, `org-method-a-${suffix}`);
    orgAId = orgARes.lastInsertRowid;

    const orgBRes = await db.prepare(
      `INSERT INTO organizations (name, slug) VALUES (?, ?) RETURNING id`
    ).run(`Org Method B ${suffix}`, `org-method-b-${suffix}`);
    orgBId = orgBRes.lastInsertRowid;

    const uAdminA = await db.prepare(
      `INSERT INTO users (name, username, email, password, role, organization_id)
       VALUES (?, ?, ?, 'hash', 'admin', ?) RETURNING id`
    ).run('Admin Method A', `admin_m_${suffix}`, `admin_m_${suffix}@test.local`, orgAId);

    const uPmA = await db.prepare(
      `INSERT INTO users (name, username, email, password, role, organization_id)
       VALUES (?, ?, ?, 'hash', 'project_manager', ?) RETURNING id`
    ).run('PM Method A', `pm_m_${suffix}`, `pm_m_${suffix}@test.local`, orgAId);

    const uMemberA = await db.prepare(
      `INSERT INTO users (name, username, email, password, role, organization_id)
       VALUES (?, ?, ?, 'hash', 'member', ?) RETURNING id`
    ).run('Member Method A', `mem_m_${suffix}`, `mem_m_${suffix}@test.local`, orgAId);

    const uViewerA = await db.prepare(
      `INSERT INTO users (name, username, email, password, role, organization_id)
       VALUES (?, ?, ?, 'hash', 'viewer', ?) RETURNING id`
    ).run('Viewer Method A', `view_m_${suffix}`, `view_m_${suffix}@test.local`, orgAId);

    const uAdminB = await db.prepare(
      `INSERT INTO users (name, username, email, password, role, organization_id)
       VALUES (?, ?, ?, 'hash', 'admin', ?) RETURNING id`
    ).run('Admin Method B', `admin_mb_${suffix}`, `admin_mb_${suffix}@test.local`, orgBId);

    adminAUser = JSON.stringify({ id: uAdminA.lastInsertRowid, role: 'admin', organization_id: orgAId, name: 'Admin A' });
    pmAUser = JSON.stringify({ id: uPmA.lastInsertRowid, role: 'project_manager', organization_id: orgAId, name: 'PM A' });
    memberAUser = JSON.stringify({ id: uMemberA.lastInsertRowid, role: 'member', organization_id: orgAId, name: 'Member A' });
    viewerAUser = JSON.stringify({ id: uViewerA.lastInsertRowid, role: 'viewer', organization_id: orgAId, name: 'Viewer A' });
    adminBUser = JSON.stringify({ id: uAdminB.lastInsertRowid, role: 'admin', organization_id: orgBId, name: 'Admin B' });

    const projARes = await db.prepare(
      `INSERT INTO projects (name, description, organization_id, methodology_id) VALUES (?, ?, ?, ?) RETURNING id`
    ).run('Proyecto A Metodologías', 'Descripción Proyecto A', orgAId, 'AGILE');
    projectAId = projARes.lastInsertRowid;

    const projBRes = await db.prepare(
      `INSERT INTO projects (name, description, organization_id, methodology_id) VALUES (?, ?, ?, ?) RETURNING id`
    ).run('Proyecto B Metodologías', 'Descripción Proyecto B', orgBId, 'WATERFALL');
    projectBId = projBRes.lastInsertRowid;
  });

  after(() => {
    setTimeout(() => {
      process.exit(0);
    }, 200);
  });

  it('1. Debe requerir sesión autenticada para listar metodologías (RNF02)', async () => {
    const res = await request(app).get('/api/methodologies');
    assert.equal(res.status, 401);
  });

  it('2. Debe listar el catálogo completo con las 7 metodologías estándar', async () => {
    const res = await request(app)
      .get('/api/methodologies')
      .set('x-test-user', viewerAUser);

    assert.equal(res.status, 200);
    assert(Array.isArray(res.body));
    assert(res.body.length >= 7);

    const ids = res.body.map(m => m.id.toUpperCase());
    assert(ids.includes('SCRUM'), 'Debe incluir Scrum');
    assert(ids.includes('KANBAN'), 'Debe incluir Kanban');
    assert(ids.includes('XP'), 'Debe incluir Extreme Programming');
    assert(ids.includes('LEAN'), 'Debe incluir Lean');
    assert(ids.includes('WATERFALL'), 'Debe incluir Waterfall');
    assert(ids.includes('AGILE'), 'Debe incluir Ágil');
    assert(ids.includes('HYBRID'), 'Debe incluir Híbrida');
  });

  it('3. Debe consultar una metodología específica y devolver sus detalles, principios y prácticas', async () => {
    const res = await request(app)
      .get('/api/methodologies/SCRUM')
      .set('x-test-user', memberAUser);

    assert.equal(res.status, 200);
    assert.equal(res.body.id, 'SCRUM');
    assert.equal(res.body.name, 'Scrum');
    assert(res.body.description.length > 10);
    assert(Array.isArray(res.body.principles));
    assert(Array.isArray(res.body.practices));
    assert(res.body.practices.some(p => p.toLowerCase().includes('sprint')));
  });

  it('4. Debe consultar Extreme Programming (XP) y contener sus prácticas técnicas', async () => {
    const res = await request(app)
      .get('/api/methodologies/XP')
      .set('x-test-user', viewerAUser);

    assert.equal(res.status, 200);
    assert.equal(res.body.id, 'XP');
    assert.equal(res.body.name, 'Extreme Programming');
    assert(res.body.practices.some(p => p.includes('TDD') || p.includes('Pair Programming')));
  });

  it('5. Debe retornar 404 al consultar una metodología inexistente', async () => {
    const res = await request(app)
      .get('/api/methodologies/INVENTADA_XYZ')
      .set('x-test-user', pmAUser);

    assert.equal(res.status, 404);
  });

  it('6. Extensibilidad del registro: registrar una metodología vía API o Registry no requiere modificar rutas existentes', async () => {
    const customSuffix = Date.now();
    const customId = `CUSTOM_${customSuffix}`;
    const res = await request(app)
      .post('/api/methodologies')
      .set('x-test-user', adminAUser)
      .send({
        id: customId,
        name: `Metodología Dinámica ${customSuffix}`,
        description: 'Metodología añadida en tiempo de ejecución sin cambiar rutas.',
        category: 'agile',
        principles: ['Principio Alpha', 'Principio Beta'],
        practices: ['Práctica 1', 'Práctica 2']
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.id, customId);
    assert.equal(res.body.is_custom, true);

    // Debe ser consultable inmediatamente a través de las rutas existentes
    const getRes = await request(app)
      .get(`/api/methodologies/${customId}`)
      .set('x-test-user', memberAUser);

    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.name, `Metodología Dinámica ${customSuffix}`);
  });

  it('7. Registro extensible en memoria directo: registry.register permite incorporar frameworks al vuelo', () => {
    const runtimeKey = `DEVSECOPS_${Date.now()}`;
    const added = registry.register({
      id: runtimeKey,
      name: 'DevSecOps Flow',
      description: 'Integración continua de seguridad en el pipeline de desarrollo.',
      category: 'agile',
      principles: ['Seguridad como código'],
      practices: ['SAST continuo']
    });

    assert.equal(added.id, runtimeKey);
    assert.equal(registry.has(runtimeKey), true);
    assert.equal(registry.get(runtimeKey).name, 'DevSecOps Flow');
  });

  it('8. Project Manager puede asignar una metodología al proyecto (PUT /api/projects/:id/methodology)', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectAId}/methodology`)
      .set('x-test-user', pmAUser)
      .send({ methodology_id: 'SCRUM' });

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.assigned_methodology.id, 'SCRUM');

    // Comprobamos en BD
    const proj = await db.prepare('SELECT methodology_id FROM projects WHERE id = ?').get(projectAId);
    assert.equal(proj.methodology_id, 'SCRUM');
  });

  it('9. Admin puede asignar una metodología al proyecto mediante la ruta de metodologías', async () => {
    const res = await request(app)
      .put(`/api/methodologies/projects/${projectAId}/assign`)
      .set('x-test-user', adminAUser)
      .send({ methodology_id: 'XP' });

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.assigned_methodology.id, 'XP');

    const proj = await db.prepare('SELECT methodology_id FROM projects WHERE id = ?').get(projectAId);
    assert.equal(proj.methodology_id, 'XP');
  });

  it('10. Rol Viewer no puede asignar metodologías (403 Forbidden)', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectAId}/methodology`)
      .set('x-test-user', viewerAUser)
      .send({ methodology_id: 'KANBAN' });

    assert.equal(res.status, 403);
  });

  it('11. Rol Member no puede asignar metodologías al proyecto (403 Forbidden)', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectAId}/methodology`)
      .set('x-test-user', memberAUser)
      .send({ methodology_id: 'KANBAN' });

    assert.equal(res.status, 403);
  });

  it('12. Aislamiento multi-tenant: Admin de Org B no puede asignar metodología a proyecto de Org A (404)', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectAId}/methodology`)
      .set('x-test-user', adminBUser)
      .send({ methodology_id: 'WATERFALL' });

    assert.equal(res.status, 404);
  });

  it('13. No se puede asignar una metodología inexistente (404)', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectAId}/methodology`)
      .set('x-test-user', adminAUser)
      .send({ methodology_id: 'METODOLOGIA_FANTASMA' });

    assert.equal(res.status, 404);
  });

  it('14. La asignación de metodología registra una actividad de auditoría (RNF17)', async () => {
    await request(app)
      .put(`/api/projects/${projectAId}/methodology`)
      .set('x-test-user', adminAUser)
      .send({ methodology_id: 'KANBAN' });

    const activity = await db.prepare(`
      SELECT * FROM activities
      WHERE project_id = ? AND action = 'project.methodology_assigned'
      ORDER BY id DESC LIMIT 1
    `).get(projectAId);

    assert(activity, 'Debe existir registro en activities');
    assert(activity.description.includes('KANBAN') || activity.description.includes('Kanban'));
    assert.equal(activity.organization_id, orgAId);
  });
});
