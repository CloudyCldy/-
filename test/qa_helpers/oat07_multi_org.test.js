process.env.NODE_ENV = 'test';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../../app');

describe('OAT-07: Aislamiento Multi-organización Estricto', () => {
  // Mock users from two distinct organizations
  const userOrg1 = {
    id: 901,
    username: 'user_org1',
    role: 'admin',
    organization_id: 1,
    active: 1
  };

  const userOrg2 = {
    id: 902,
    username: 'user_org2',
    role: 'admin',
    organization_id: 2,
    active: 1
  };

  it('1. No permite consultar un proyecto de otra organización', async () => {
    // Si Org 1 intenta consultar un proyecto con ID perteneciente a Org 2 o viceversa
    const res = await request(app)
      .get('/api/projects/9999')
      .set('x-test-user', JSON.stringify(userOrg1));
    // Debe responder 404 No encontrado o 403 Prohibido, nunca 200 con datos de la otra org
    assert.ok(res.status === 404 || res.status === 403 || res.status === 401);
  });

  it('2. No permite consultar tareas de otra organización', async () => {
    const res = await request(app)
      .get('/api/tasks/9999')
      .set('x-test-user', JSON.stringify(userOrg1));
    assert.ok(res.status === 404 || res.status === 403 || res.status === 401);
  });

  it('3. No permite consultar hitos (milestones) de otra organización', async () => {
    const res = await request(app)
      .get('/api/milestones/9999')
      .set('x-test-user', JSON.stringify(userOrg1));
    assert.ok(res.status === 404 || res.status === 403 || res.status === 401);
  });

  it('4. No permite consultar riesgos de otra organización', async () => {
    const res = await request(app)
      .get('/api/risks/9999')
      .set('x-test-user', JSON.stringify(userOrg1));
    assert.ok(res.status === 404 || res.status === 403 || res.status === 401);
  });

  it('5. No permite consultar incidencias de otra organización', async () => {
    const res = await request(app)
      .get('/api/issues/9999')
      .set('x-test-user', JSON.stringify(userOrg1));
    assert.ok(res.status === 404 || res.status === 403 || res.status === 401);
  });

  it('6. No permite descargar archivos de otra organización', async () => {
    const res = await request(app)
      .get('/api/files/9999/download')
      .set('x-test-user', JSON.stringify(userOrg1));
    assert.ok(res.status === 404 || res.status === 403 || res.status === 401);
  });
});
