// HB-09.1 · Mensajería: mensajes individuales y de grupo (pruebas UIT con la base de datos real).
// Criterios: conversación individual, conversación de grupo, solo usuarios de la misma organización
// y defecto D-03 (un mensaje enviado con Enter varias veces se guarda una sola vez).
process.env.NODE_ENV = 'test';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../app');

describe('HB-09.1 · Mensajes individuales y de grupo', () => {
  let db;
  let orgA;
  let orgB;
  const users = {};
  const as = (u) => JSON.stringify({ id: u.id, role: u.role, organization_id: u.organization_id, name: u.name });

  async function createUser(name, role, orgId, tag) {
    const suffix = `${tag}_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;
    const res = await db.prepare(
      `INSERT INTO users (name, username, email, password, role, organization_id)
       VALUES (?, ?, ?, 'hash', ?, ?) RETURNING id`
    ).run(name, `u_${suffix}`, `${suffix}@chat.test`, role, orgId);
    return { id: res.lastInsertRowid, name, role, organization_id: orgId };
  }

  before(async () => {
    db = app.locals.database;
    await app.ensureRuntimeSchema();
    const suffix = Date.now();
    orgA = (await db.prepare('INSERT INTO organizations (name, slug) VALUES (?, ?) RETURNING id').run(`Chat A ${suffix}`, `chat-a-${suffix}`)).lastInsertRowid;
    orgB = (await db.prepare('INSERT INTO organizations (name, slug) VALUES (?, ?) RETURNING id').run(`Chat B ${suffix}`, `chat-b-${suffix}`)).lastInsertRowid;
    users.ana = await createUser('Ana Admin', 'admin', orgA, 'ana');
    users.beto = await createUser('Beto Integrante', 'member', orgA, 'beto');
    users.caro = await createUser('Caro Integrante', 'member', orgA, 'caro');
    users.externo = await createUser('Externo Otra Org', 'member', orgB, 'ext');
  });

  after(async () => {
    for (const org of [orgA, orgB]) {
      if (!org) continue;
      await db.prepare('DELETE FROM messages WHERE organization_id = ?').run(org);
      await db.prepare('DELETE FROM chat_group_members WHERE organization_id = ?').run(org);
      await db.prepare('DELETE FROM chat_groups WHERE organization_id = ?').run(org);
      await db.prepare('DELETE FROM organizations WHERE id = ?').run(org);
    }
  });

  describe('Conversación individual', () => {
    it('Ana le escribe a Beto y Beto ve el mensaje en su conversación', async () => {
      const sent = await request(app)
        .post('/api/messages')
        .set('x-test-user', as(users.ana))
        .send({ user_id: users.beto.id, content: 'Hola Beto, ¿cómo vas con la tarea?' });
      assert.ok([200, 201].includes(sent.status), `status ${sent.status}: ${JSON.stringify(sent.body)}`);
      assert.ok(sent.body.id);

      const inbox = await request(app)
        .get('/api/messages')
        .query({ user_id: users.ana.id })
        .set('x-test-user', as(users.beto));
      assert.equal(inbox.status, 200);
      const list = Array.isArray(inbox.body) ? inbox.body : inbox.body.messages;
      const found = list.filter((m) => m.id === sent.body.id);
      assert.equal(found.length, 1);
      assert.equal(found[0].content, 'Hola Beto, ¿cómo vas con la tarea?');
      assert.equal(Number(found[0].sender_id), users.ana.id);
    });

    it('Caro no ve la conversación privada entre Ana y Beto', async () => {
      const res = await request(app)
        .get('/api/messages')
        .query({ user_id: users.ana.id })
        .set('x-test-user', as(users.caro));
      assert.equal(res.status, 200);
      const list = Array.isArray(res.body) ? res.body : res.body.messages;
      assert.ok(!list.some((m) => /Hola Beto/.test(m.content || '')));
    });

    it('No se puede mandar un mensaje vacío ni a uno mismo', async () => {
      const empty = await request(app).post('/api/messages').set('x-test-user', as(users.ana)).send({ user_id: users.beto.id, content: '   ' });
      assert.equal(empty.status, 400);
      const self = await request(app).post('/api/messages').set('x-test-user', as(users.ana)).send({ user_id: users.ana.id, content: 'Hola yo' });
      assert.equal(self.status, 400);
    });
  });

  describe('Conversación de grupo', () => {
    let groupId;

    it('Ana crea un grupo con Beto; los dos ven los mensajes del grupo', async () => {
      const created = await request(app)
        .post('/api/messages/groups')
        .set('x-test-user', as(users.ana))
        .send({ name: 'Equipo Sprint 4', members: [users.beto.id] });
      assert.equal(created.status, 201);
      groupId = created.body.id;

      const sent = await request(app)
        .post(`/api/messages/groups/${groupId}/messages`)
        .set('x-test-user', as(users.beto))
        .send({ content: 'Ya subí mi avance' });
      assert.ok([200, 201].includes(sent.status), `status ${sent.status}`);

      const seenByAna = await request(app)
        .get('/api/messages')
        .query({ group_id: groupId })
        .set('x-test-user', as(users.ana));
      assert.equal(seenByAna.status, 200);
      const list = Array.isArray(seenByAna.body) ? seenByAna.body : seenByAna.body.messages;
      assert.equal(list.filter((m) => m.content === 'Ya subí mi avance').length, 1);
    });

    it('Quien no es miembro del grupo no puede leer ni escribir', async () => {
      const read = await request(app).get('/api/messages').query({ group_id: groupId }).set('x-test-user', as(users.caro));
      assert.equal(read.status, 403);
      const write = await request(app)
        .post(`/api/messages/groups/${groupId}/messages`)
        .set('x-test-user', as(users.caro))
        .send({ content: 'Me cuelo' });
      assert.equal(write.status, 403);
    });
  });

  describe('Solo usuarios de la misma organización', () => {
    it('No se puede escribir a alguien de otra organización', async () => {
      const res = await request(app)
        .post('/api/messages')
        .set('x-test-user', as(users.ana))
        .send({ user_id: users.externo.id, content: 'Hola externo' });
      assert.equal(res.status, 404);
    });

    it('Alguien de otra organización no puede abrir la conversación ni el grupo', async () => {
      const direct = await request(app).get('/api/messages').query({ user_id: users.ana.id }).set('x-test-user', as(users.externo));
      assert.equal(direct.status, 404);
      const groups = await request(app).get('/api/messages/groups').set('x-test-user', as(users.externo));
      assert.equal(groups.status, 200);
      const list = Array.isArray(groups.body) ? groups.body : groups.body.groups || [];
      assert.ok(!list.some((g) => /Equipo Sprint 4/.test(g.name)));
    });

    it('Al crear un grupo, los usuarios de otra organización no quedan como miembros', async () => {
      const created = await request(app)
        .post('/api/messages/groups')
        .set('x-test-user', as(users.ana))
        .send({ name: 'Grupo con intruso', members: [users.beto.id, users.externo.id] });
      assert.equal(created.status, 201);
      const rows = await db.prepare('SELECT user_id FROM chat_group_members WHERE group_id = ?').all(created.body.id);
      const ids = rows.map((r) => Number(r.user_id)).sort((a, b) => a - b);
      assert.deepEqual(ids, [users.ana.id, users.beto.id].sort((a, b) => a - b));
    });

    it('No se puede agregar a un grupo a alguien de otra organización', async () => {
      const created = await request(app)
        .post('/api/messages/groups')
        .set('x-test-user', as(users.ana))
        .send({ name: 'Grupo cerrado', members: [] });
      const res = await request(app)
        .post(`/api/messages/groups/${created.body.id}/members`)
        .set('x-test-user', as(users.ana))
        .send({ user_id: users.externo.id });
      assert.equal(res.status, 404);
    });
  });

  describe('Defecto D-03: Enter varias veces', () => {
    it('El mismo mensaje enviado tres veces seguidas (mismo client_message_id) se guarda una sola vez', async () => {
      const clientId = `enter-${Date.now()}`;
      const send = () => request(app)
        .post('/api/messages')
        .set('x-test-user', as(users.beto))
        .send({ user_id: users.caro.id, content: 'Mensaje con Enter', client_message_id: clientId });
      // Tres envíos al mismo tiempo, como al presionar Enter varias veces muy rápido
      const replies = await Promise.all([send(), send(), send()]);
      replies.forEach((r) => assert.ok([200, 201].includes(r.status), `status ${r.status}: ${JSON.stringify(r.body)}`));
      const ids = new Set(replies.map((r) => r.body.id));
      assert.equal(ids.size, 1, 'las tres respuestas apuntan al mismo mensaje');

      const rows = await db.prepare('SELECT id FROM messages WHERE sender_id = ? AND client_message_id = ?').all(users.beto.id, clientId);
      assert.equal(rows.length, 1);
    });

    it('En grupo también se guarda una sola vez', async () => {
      const created = await request(app)
        .post('/api/messages/groups')
        .set('x-test-user', as(users.ana))
        .send({ name: 'Grupo Enter', members: [users.beto.id] });
      const clientId = `enter-grupo-${Date.now()}`;
      const send = () => request(app)
        .post(`/api/messages/groups/${created.body.id}/messages`)
        .set('x-test-user', as(users.ana))
        .send({ content: 'Hola grupo', client_message_id: clientId });
      const replies = await Promise.all([send(), send(), send()]);
      replies.forEach((r) => assert.ok([200, 201].includes(r.status), `status ${r.status}`));
      const rows = await db.prepare('SELECT id FROM messages WHERE sender_id = ? AND client_message_id = ?').all(users.ana.id, clientId);
      assert.equal(rows.length, 1);
    });
  });

  describe('Fotos de perfil en el chat', () => {
    it('Los mensajes traen la foto del remitente para mostrarla en el chat', async () => {
      await db.prepare('UPDATE users SET profile_photo = ? WHERE id = ?').run(`/api/users/${users.ana.id}/profile-photo?v=1`, users.ana.id);
      const sent = await request(app).post('/api/messages').set('x-test-user', as(users.ana)).send({ user_id: users.caro.id, content: 'Con foto' });
      const res = await request(app).get('/api/messages').query({ user_id: users.ana.id }).set('x-test-user', as(users.caro));
      const list = Array.isArray(res.body) ? res.body : res.body.messages;
      const msg = list.find((m) => m.id === sent.body.id);
      assert.ok(msg, 'el mensaje aparece');
      assert.equal(msg.sender_photo, `/api/users/${users.ana.id}/profile-photo?v=1`);
    });
  });
});
