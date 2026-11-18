// Pruebas del Sprint 5 (QA-02): HB-11 ausencias con rango de fechas, motivo y capacidad real del equipo.
process.env.NODE_ENV = 'test';
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../app');
const { businessDays } = require('../server/controllers/absenceController');

const ORG = 7;
const admin = { id: 1, name: 'Ana Admin', role: 'admin', organization_id: ORG };
const member = { id: 2, name: 'Mario Integrante', role: 'member', organization_id: ORG };
const member2 = { id: 3, name: 'Lucía Integrante', role: 'member', organization_id: ORG };
const outsider = { id: 9, name: 'Otra Org', role: 'member', organization_id: 99 };
const as = user => JSON.stringify(user);

function fakeDatabase() {
  const db = {
    users: [
      { ...admin, active: 1 },
      { ...member, active: 1 },
      { ...member2, active: 1 },
      { ...outsider, active: 1 },
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

describe('HB-11 · Registro de ausencias', () => {
  const post = (user, body) => request(app).post('/api/absences').set('x-test-user', as(user)).send(body);

  it('registra una ausencia con rango de fechas y motivo', async () => {
    const res = await post(admin, { user_id: member.id, absence_date: '2026-11-23', end_date: '2026-11-25', reason: 'vacaciones', subject: 'Viaje familiar' });
    assert.equal(res.status, 201);
    assert.deepEqual(
      { inicio: db.absences[0].absence_date, fin: db.absences[0].end_date, motivo: db.absences[0].reason },
      { inicio: '2026-11-23', fin: '2026-11-25', motivo: 'vacaciones' },
    );
  });

  it('una ausencia de un solo día usa la misma fecha como fin', async () => {
    const res = await post(admin, { user_id: member.id, absence_date: '2026-11-24', reason: 'falta', subject: 'Programación web' });
    assert.equal(res.status, 201);
    assert.equal(db.absences[0].end_date, '2026-11-24');
  });

  it('pide el motivo y lo valida', async () => {
    const sin = await post(admin, { user_id: member.id, absence_date: '2026-11-23' });
    assert.equal(sin.status, 400);
    assert.match(sin.body.error, /motivo/);
    const otro = await post(admin, { user_id: member.id, absence_date: '2026-11-23', reason: 'otro', subject: '  ' });
    assert.equal(otro.status, 400);
    assert.match(otro.body.error, /Describe/);
  });

  it('rechaza fechas inválidas, fin anterior al inicio y periodos muy largos', async () => {
    assert.equal((await post(admin, { user_id: member.id, absence_date: '2026-02-30', reason: 'permiso' })).status, 400);
    const alReves = await post(admin, { user_id: member.id, absence_date: '2026-11-25', end_date: '2026-11-23', reason: 'permiso' });
    assert.equal(alReves.status, 400);
    assert.match(alReves.body.error, /anterior/);
    assert.equal((await post(admin, { user_id: member.id, absence_date: '2026-01-01', end_date: '2026-06-30', reason: 'incapacidad' })).status, 400);
    assert.equal(db.absences.length, 0);
  });

  it('solo el administrador registra ausencias y solo de integrantes de su organización', async () => {
    assert.equal((await post(member, { user_id: member2.id, absence_date: '2026-11-23', reason: 'permiso' })).status, 403);
    assert.equal((await post(admin, { user_id: outsider.id, absence_date: '2026-11-23', reason: 'permiso' })).status, 404);
  });
});

describe('HB-11 · Capacidad real del equipo', () => {
  it('cuenta solo días hábiles', () => {
    // 23 al 29 de noviembre de 2026: lunes a domingo
    assert.equal(businessDays(new Date('2026-11-23T00:00:00Z'), new Date('2026-11-29T00:00:00Z')).length, 5);
  });

  it('descuenta las ausencias de cada integrante en el periodo', async () => {
    db.absences.push(
      { id: 1, user_id: member.id, organization_id: ORG, absence_date: '2026-11-20', end_date: '2026-11-24', reason: 'vacaciones' },
      { id: 2, user_id: member.id, organization_id: ORG, absence_date: '2026-11-24', end_date: '2026-11-24', reason: 'permiso' },
      { id: 3, user_id: outsider.id, organization_id: 99, absence_date: '2026-11-23', end_date: '2026-11-27', reason: 'vacaciones' },
    );
    const res = await request(app).get('/api/absences/capacity?from=2026-11-23&to=2026-11-27').set('x-test-user', as(admin));
    assert.equal(res.status, 200);
    assert.equal(res.body.workdays, 5);
    const mario = res.body.team.find(t => t.user_id === member.id);
    const lucia = res.body.team.find(t => t.user_id === member2.id);
    // Mario falta 23 y 24 (el 24 se repite y cuenta una sola vez)
    assert.deepEqual([mario.absent_days, mario.available_days, mario.availability], [2, 3, 60]);
    assert.deepEqual([lucia.absent_days, lucia.availability], [0, 100]);
    assert.equal(res.body.team.length, 2, 'no incluye integrantes de otra organización');
    assert.equal(res.body.team_availability, 80);
  });

  it('valida el periodo y es solo para administradores', async () => {
    assert.equal((await request(app).get('/api/absences/capacity?from=2026-11-27&to=2026-11-23').set('x-test-user', as(admin))).status, 400);
    assert.equal((await request(app).get('/api/absences/capacity').set('x-test-user', as(member))).status, 403);
  });
});
