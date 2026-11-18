// Pruebas del Sprint 5 (QA-02): HB-18 eliminar mi cuenta y política de privacidad.
process.env.NODE_ENV = 'test';
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../app');

const ORG = 7;
const admin = { id: 1, name: 'Ana Admin', role: 'admin', organization_id: ORG };
const member = { id: 2, name: 'Mario Integrante', role: 'member', organization_id: ORG };
const member2 = { id: 3, name: 'Lucía Integrante', role: 'member', organization_id: ORG };
const outsider = { id: 9, name: 'Otra Org', role: 'member', organization_id: 99 };
const HASH = bcrypt.hashSync('clave1234', 4);
const as = user => JSON.stringify(user);

function fakeDatabase() {
  const db = {
    users: [
      { ...admin, password: HASH, active: 1 },
      { ...member, password: HASH, active: 1 },
      { ...member2, password: HASH, active: 1 },
      { ...outsider, password: HASH, active: 1 },
    ],
    absences: [],
    txQueries: [],
    prepare(sql) {
      const q = sql.toLowerCase().replace(/\s+/g, ' ').trim();
      return {
        async get(...p) {
          if (q.startsWith('select id, role, password from users')) return db.users.find(u => u.id === p[0] && u.organization_id === p[1]);
          if (q.includes("role = 'admin' and id <> ?")) return db.users.find(u => u.organization_id === p[0] && u.role === 'admin' && u.id !== p[1]);
          if (q.startsWith('select id from users where organization_id = ? and id <> ?')) return db.users.find(u => u.organization_id === p[0] && u.id !== p[1]);
          if (q.includes("from users where id = ? and organization_id = ? and role = 'member'")) return db.users.find(u => u.id === Number(p[0]) && u.organization_id === p[1] && u.role === 'member');
          return undefined;
        },
        async all(...p) {
          if (q.startsWith('select id, name from users')) return db.users.filter(u => u.organization_id === p[0] && u.role === 'member').sort((a, b) => a.name.localeCompare(b.name));
          if (q.includes('from absences')) {
            return db.absences
              .filter(a => a.organization_id === p[0] && a.absence_date <= p[1] && (a.end_date || a.absence_date) >= p[2])
              .map(a => ({ user_id: a.user_id, start_date: a.absence_date, end_date: a.end_date || a.absence_date, reason: a.reason }));
          }
          return [];
        },
        async run(...p) {
          if (q.startsWith('insert into absences')) {
            const row = { id: db.absences.length + 1, user_id: Number(p[0]), organization_id: p[1], absence_date: p[2], end_date: p[3], reason: p[4], subject: p[5] };
            db.absences.push(row);
            return { changes: 1, lastInsertRowid: row.id };
          }
          return { changes: 0 };
        },
      };
    },
    async transaction(work) {
      await work({ query: async (text, params) => { db.txQueries.push({ text, params }); return { rows: [], rowCount: 1 }; } });
    },
  };
  return db;
}

let original;
let db;
before(() => { original = app.locals.database; });
after(() => { app.locals.database = original; });
beforeEach(() => { db = fakeDatabase(); app.locals.database = db; });

describe('HB-18 · Eliminar mi cuenta', () => {
  it('pide iniciar sesión', async () => {
    const res = await request(app).delete('/api/users/me').send({ password: 'clave1234' });
    assert.equal(res.status, 401);
  });

  it('rechaza la eliminación sin contraseña o con una contraseña incorrecta', async () => {
    const sin = await request(app).delete('/api/users/me').set('x-test-user', as(member)).send({});
    assert.equal(sin.status, 400);
    const mala = await request(app).delete('/api/users/me').set('x-test-user', as(member)).send({ password: 'otra-clave' });
    assert.equal(mala.status, 400);
    assert.match(mala.body.error, /contraseña/);
    assert.equal(db.txQueries.length, 0, 'no debe borrar nada');
  });

  it('elimina la cuenta de un integrante y pasa sus archivos a un administrador', async () => {
    const res = await request(app).delete('/api/users/me').set('x-test-user', as(member)).send({ password: 'clave1234' });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.ok(db.txQueries.some(t => /UPDATE files SET uploaded_by/.test(t.text) && t.params[0] === admin.id && t.params[1] === member.id));
    assert.ok(db.txQueries.some(t => /DELETE FROM users WHERE id = \$1/.test(t.text) && t.params[0] === member.id));
  });

  it('si es el único administrador pide confirmar que también se borra la organización', async () => {
    const res = await request(app).delete('/api/users/me').set('x-test-user', as(admin)).send({ password: 'clave1234' });
    assert.equal(res.status, 409);
    assert.equal(res.body.requires_organization_delete, true);
    assert.equal(db.txQueries.length, 0);
  });

  it('con la segunda confirmación borra la organización completa', async () => {
    const res = await request(app).delete('/api/users/me').set('x-test-user', as(admin)).send({ password: 'clave1234', delete_organization: true });
    assert.equal(res.status, 200);
    assert.ok(db.txQueries.some(t => /DELETE FROM organizations WHERE id = \$1/.test(t.text) && t.params[0] === ORG));
  });

  it('la política de privacidad es pública', async () => {
    const res = await request(app).get('/privacidad');
    assert.equal(res.status, 200);
    assert.match(res.text, /privacidad/i);
  });
});

