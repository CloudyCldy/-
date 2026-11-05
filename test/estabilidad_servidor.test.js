// D-14 · Estabilidad del servidor, duración de la sesión y panel del integrante.
// - Un error dentro de una ruta async ya no apaga el servidor: responde 500 y sigue atendiendo.
// - Una organización sin plan_id ya no tumba /api/organizations/usage.
// - La sesión dura 30 días desde el último uso (rolling) para que la app móvil no saque a la persona.
// - En el panel, un integrante ve solo sus tareas vencidas; el administrador ve las de todos.
process.env.NODE_ENV = 'test';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../app');

describe('D-14 · Estabilidad del servidor, sesión y panel', () => {
  let db;
  let orgId;
  let projectId;
  const users = {};
  const as = (u) => JSON.stringify({ id: u.id, role: u.role, organization_id: u.organization_id, name: u.name });

  async function createUser(name, role, tag, password = 'hash') {
    const suffix = `${tag}_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;
    const res = await db.prepare(
      `INSERT INTO users (name, username, email, password, role, organization_id)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING id`
    ).run(name, `e_${suffix}`, `${suffix}@estabilidad.test`, password, role, orgId);
    return { id: res.lastInsertRowid, name, role, organization_id: orgId, username: `e_${suffix}` };
  }

  async function createTask(title, assignedTo, status, dueDate) {
    await db.prepare(
      `INSERT INTO tasks (title, status, priority, assigned_to, organization_id, project_id, start_date, due_date)
       VALUES (?, ?, 'media', ?, ?, ?, ?, ?)`
    ).run(title, status, assignedTo, orgId, projectId, '2026-01-01', dueDate);
  }

  before(async () => {
    db = app.locals.database;
    await app.ensureRuntimeSchema();
    const suffix = Date.now();
    orgId = (await db.prepare('INSERT INTO organizations (name, slug) VALUES (?, ?) RETURNING id').run(`Estabilidad ${suffix}`, `estabilidad-${suffix}`)).lastInsertRowid;
    users.admin = await createUser('Ana Admin', 'admin', 'adm', bcrypt.hashSync('Clave-Segura-123', 4));
    users.beto = await createUser('Beto Integrante', 'member', 'beto');
    users.caro = await createUser('Caro Integrante', 'member', 'caro');
    projectId = (await db.prepare('INSERT INTO projects (name, description, organization_id) VALUES (?, ?, ?) RETURNING id').run(`Proyecto ${suffix}`, 'Prueba de estabilidad', orgId)).lastInsertRowid;
    // Beto tiene todo completado (aunque con fechas pasadas); Caro tiene dos vencidas.
    await createTask('Beto 1', users.beto.id, 'completada', '2026-01-10');
    await createTask('Beto 2', users.beto.id, 'completada', '2026-01-11');
    await createTask('Caro 1', users.caro.id, 'pendiente', '2026-01-12');
    await createTask('Caro 2', users.caro.id, 'en_proceso', '2026-01-13');
  });

  after(async () => {
    if (!orgId) return;
    await db.prepare('DELETE FROM tasks WHERE organization_id = ?').run(orgId);
    await db.prepare('DELETE FROM projects WHERE organization_id = ?').run(orgId);
    await db.prepare('DELETE FROM organizations WHERE id = ?').run(orgId);
  });

  describe('Errores dentro de rutas async', () => {
    it('Un error en una ruta async responde 500 en lugar de apagar el servidor', async () => {
      const mini = express();
      mini.get('/falla', async () => { throw new Error('falla a propósito'); });
      mini.get('/bien', (req, res) => res.json({ ok: true }));
      mini.use((error, req, res, next) => res.status(500).json({ error: error.message }));
      const res = await request(mini).get('/falla');
      assert.equal(res.status, 500);
      assert.equal(res.body.error, 'falla a propósito');
      const after = await request(mini).get('/bien');
      assert.equal(after.status, 200);
    });

    it('El uso de una organización sin plan responde sin límites (igual que planMiddleware) en lugar de tumbar el servidor', async () => {
      await db.prepare('UPDATE organizations SET plan_id = NULL WHERE id = ?').run(orgId);
      const res = await request(app).get('/api/organizations/usage').set('x-test-user', as(users.admin));
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.plan.name, 'Sin plan asignado');
      assert.equal(res.body.limits.max_projects, null);
      assert.ok(res.body.usage.users >= 3);
      const health = await request(app).get('/api/health');
      assert.equal(health.status, 200, 'el servidor sigue respondiendo');
    });
  });

  describe('Duración de la sesión', () => {
    it('Al iniciar sesión, la cookie dura 30 días', async () => {
      const res = await request(app).post('/api/auth/login').send({ username: users.admin.username, password: 'Clave-Segura-123' });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      const cookie = (res.headers['set-cookie'] || []).find((c) => c.startsWith('connect.sid='));
      assert.ok(cookie, 'se envía la cookie de sesión');
      const expires = new Date(/Expires=([^;]+)/i.exec(cookie)[1]).getTime();
      const days = (expires - Date.now()) / (1000 * 60 * 60 * 24);
      assert.ok(days > 29 && days <= 30.01, `la cookie dura ${days.toFixed(2)} días`);
    });

    it('Cada petición renueva la sesión (rolling), así quien usa la app no tiene que volver a entrar', async () => {
      const agent = request.agent(app);
      const login = await agent.post('/api/auth/login').send({ username: users.admin.username, password: 'Clave-Segura-123' });
      assert.equal(login.status, 200);
      const me = await agent.get('/api/auth/me');
      assert.equal(me.status, 200);
      assert.equal(Number(me.body.user.id), users.admin.id);
      const renewed = (me.headers['set-cookie'] || []).find((c) => c.startsWith('connect.sid='));
      assert.ok(renewed, 'la respuesta renueva la cookie');
    });
  });

  describe('Panel según el rol', () => {
    it('Un integrante con todo completado no ve tareas vencidas de otros', async () => {
      const res = await request(app).get('/api/dashboard').set('x-test-user', as(users.beto));
      assert.equal(res.status, 200);
      assert.equal(res.body.stats.totalTasks, 2);
      assert.equal(res.body.stats.completed, 2);
      assert.equal(res.body.health.overdue, 0);
      assert.ok(!res.body.health.recommendations.some((r) => /vencida/.test(r)));
    });

    it('Cada integrante ve solo sus propias vencidas', async () => {
      const res = await request(app).get('/api/dashboard').set('x-test-user', as(users.caro));
      assert.equal(res.status, 200);
      assert.equal(res.body.stats.totalTasks, 2);
      assert.equal(res.body.health.overdue, 2);
    });

    it('El administrador ve las vencidas de toda la organización', async () => {
      const res = await request(app).get('/api/dashboard').set('x-test-user', as(users.admin));
      assert.equal(res.status, 200);
      assert.equal(res.body.stats.totalTasks, 4);
      assert.equal(res.body.health.overdue, 2);
    });
  });
});
