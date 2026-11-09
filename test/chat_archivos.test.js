// HB-09.2 · Mensajería: archivos en el chat (pruebas UIT con la base de datos real).
// Criterios: enviar imagen y documento, que el archivo se guarde y aparezca una sola vez,
// y que un tipo de archivo no permitido se rechace.
process.env.NODE_ENV = 'test';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../app');

// PNG de 1x1 píxel y un PDF mínimo, suficientes para probar la subida
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const PDF_MIN = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

describe('HB-09.2 · Archivos en el chat', () => {
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
    ).run(name, `f_${suffix}`, `${suffix}@archivos.test`, role, orgId);
    return { id: res.lastInsertRowid, name, role, organization_id: orgId };
  }

  async function conversation(viewer, other) {
    const res = await request(app).get('/api/messages').query({ user_id: other.id }).set('x-test-user', as(viewer));
    assert.equal(res.status, 200);
    return Array.isArray(res.body) ? res.body : res.body.messages;
  }

  before(async () => {
    db = app.locals.database;
    await app.ensureRuntimeSchema();
    const suffix = Date.now();
    orgA = (await db.prepare('INSERT INTO organizations (name, slug) VALUES (?, ?) RETURNING id').run(`Archivos A ${suffix}`, `archivos-a-${suffix}`)).lastInsertRowid;
    orgB = (await db.prepare('INSERT INTO organizations (name, slug) VALUES (?, ?) RETURNING id').run(`Archivos B ${suffix}`, `archivos-b-${suffix}`)).lastInsertRowid;
    users.ana = await createUser('Ana Admin', 'admin', orgA, 'ana');
    users.beto = await createUser('Beto Integrante', 'member', orgA, 'beto');
    users.externo = await createUser('Externo', 'admin', orgB, 'ext');
  });

  after(async () => {
    for (const org of [orgA, orgB]) {
      if (!org) continue;
      await db.prepare('DELETE FROM messages WHERE organization_id = ?').run(org);
      await db.prepare('DELETE FROM chat_group_members WHERE organization_id = ?').run(org);
      await db.prepare('DELETE FROM chat_groups WHERE organization_id = ?').run(org);
      await db.prepare('DELETE FROM files WHERE organization_id = ?').run(org);
      await db.prepare('DELETE FROM organizations WHERE id = ?').run(org);
    }
  });

  it('Envía una imagen: se guarda el archivo y el mensaje aparece una sola vez', async () => {
    const res = await request(app)
      .post('/api/messages')
      .set('x-test-user', as(users.ana))
      .field('user_id', String(users.beto.id))
      .field('content', 'Mira el diseño')
      .attach('file', PNG_1PX, { filename: 'diseno.png', contentType: 'image/png' });
    assert.ok([200, 201].includes(res.status), `status ${res.status}: ${JSON.stringify(res.body)}`);

    const list = await conversation(users.beto, users.ana);
    const withImage = list.filter((m) => m.attachment_name === 'diseno.png');
    assert.equal(withImage.length, 1, 'el mensaje con la imagen aparece una vez');
    assert.equal(withImage[0].attachment_mime, 'image/png');

    const stored = await db.prepare('SELECT size, mime_type FROM files WHERE id = ? AND organization_id = ?').get(withImage[0].attachment_id, orgA);
    assert.ok(stored, 'el archivo quedó guardado');
    assert.equal(Number(stored.size), PNG_1PX.length);
    const copies = await db.prepare("SELECT COUNT(*)::int AS n FROM files WHERE organization_id = ? AND original_name = 'diseno.png'").get(orgA);
    assert.equal(copies.n, 1, 'el archivo se guardó una sola vez');
  });

  it('Envía un documento y quien lo recibe lo puede descargar igual que se subió', async () => {
    const res = await request(app)
      .post('/api/messages')
      .set('x-test-user', as(users.ana))
      .field('user_id', String(users.beto.id))
      .attach('file', PDF_MIN, { filename: 'minuta.pdf', contentType: 'application/pdf' });
    assert.ok([200, 201].includes(res.status), `status ${res.status}`);

    const list = await conversation(users.beto, users.ana);
    const doc = list.find((m) => m.attachment_name === 'minuta.pdf');
    assert.ok(doc, 'el documento aparece en la conversación');

    const download = await request(app)
      .get(`/api/files/${doc.attachment_id}/download`)
      .set('x-test-user', as(users.beto))
      .buffer(true)
      .parse((r, cb) => { const parts = []; r.on('data', (c) => parts.push(c)); r.on('end', () => cb(null, Buffer.concat(parts))); });
    assert.equal(download.status, 200);
    assert.match(String(download.headers['content-disposition']), /minuta\.pdf/);
    assert.ok(Buffer.compare(download.body, PDF_MIN) === 0, 'el contenido es el mismo');
  });

  it('Un archivo enviado varias veces con el mismo client_message_id se guarda una sola vez', async () => {
    const clientId = `adjunto-${Date.now()}`;
    const send = () => request(app)
      .post('/api/messages')
      .set('x-test-user', as(users.ana))
      .field('user_id', String(users.beto.id))
      .field('client_message_id', clientId)
      .attach('file', PNG_1PX, { filename: 'captura-unica.png', contentType: 'image/png' });
    const replies = await Promise.all([send(), send()]);
    replies.forEach((r) => assert.ok([200, 201].includes(r.status), `status ${r.status}`));
    const msgs = await db.prepare('SELECT id FROM messages WHERE sender_id = ? AND client_message_id = ?').all(users.ana.id, clientId);
    assert.equal(msgs.length, 1);
    const files = await db.prepare("SELECT COUNT(*)::int AS n FROM files WHERE organization_id = ? AND original_name = 'captura-unica.png'").get(orgA);
    assert.equal(files.n, 1);
  });

  it('Envía una imagen a un grupo y los miembros la ven', async () => {
    const group = await request(app)
      .post('/api/messages/groups')
      .set('x-test-user', as(users.ana))
      .send({ name: 'Diseño', members: [users.beto.id] });
    const res = await request(app)
      .post(`/api/messages/groups/${group.body.id}/messages`)
      .set('x-test-user', as(users.beto))
      .attach('file', PNG_1PX, { filename: 'boceto.png', contentType: 'image/png' });
    assert.ok([200, 201].includes(res.status), `status ${res.status}`);
    const seen = await request(app).get('/api/messages').query({ group_id: group.body.id }).set('x-test-user', as(users.ana));
    const list = Array.isArray(seen.body) ? seen.body : seen.body.messages;
    assert.equal(list.filter((m) => m.attachment_name === 'boceto.png').length, 1);
  });

  it('Rechaza un tipo de archivo no permitido y no guarda nada', async () => {
    const before = await db.prepare('SELECT COUNT(*)::int AS n FROM files WHERE organization_id = ?').get(orgA);
    const res = await request(app)
      .post('/api/messages')
      .set('x-test-user', as(users.ana))
      .field('user_id', String(users.beto.id))
      .attach('file', Buffer.from('MZ ejecutable falso'), { filename: 'programa.exe', contentType: 'application/octet-stream' });
    assert.equal(res.status, 400);
    assert.match(res.body.error || '', /\.exe/);
    const after = await db.prepare('SELECT COUNT(*)::int AS n FROM files WHERE organization_id = ?').get(orgA);
    assert.equal(after.n, before.n);
    const list = await conversation(users.beto, users.ana);
    assert.ok(!list.some((m) => m.attachment_name === 'programa.exe'));
  });

  it('Rechaza archivos de más de 10 MB', async () => {
    const big = Buffer.alloc(10 * 1024 * 1024 + 1, 0);
    const res = await request(app)
      .post('/api/messages')
      .set('x-test-user', as(users.ana))
      .field('user_id', String(users.beto.id))
      .attach('file', big, { filename: 'enorme.pdf', contentType: 'application/pdf' });
    assert.ok([400, 413].includes(res.status), `status ${res.status}`);
  });

  it('Alguien de otra organización no puede descargar el adjunto', async () => {
    const list = await conversation(users.beto, users.ana);
    const doc = list.find((m) => m.attachment_name === 'minuta.pdf');
    const res = await request(app).get(`/api/files/${doc.attachment_id}/download`).set('x-test-user', as(users.externo));
    assert.equal(res.status, 404);
  });
});
