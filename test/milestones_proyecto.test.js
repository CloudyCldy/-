// Pruebas de los hitos por proyecto: cada proyecto ve solo sus hitos,
// fechas imposibles se rechazan y la página de Hitos existe en la interfaz.
process.env.NODE_ENV = 'test';
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../app');

const ORG = 7;
const pm = { id: 1, username: 'pm', role: 'project_manager', organization_id: ORG };
const as = user => ({ 'x-test-user': JSON.stringify(user) });

function fakeDatabase() {
  const rows = [
    { id: 1, organization_id: ORG, project_id: 1, title: 'Entrega A', due_date: '2026-11-05', status: 'pendiente' },
    { id: 2, organization_id: ORG, project_id: 2, title: 'Entrega B', due_date: '2026-11-20', status: 'pendiente' },
    { id: 3, organization_id: 99, project_id: 3, title: 'Otra organización', due_date: '2026-11-01', status: 'pendiente' },
  ];
  return {
    rows,
    prepare(sql) {
      const q = sql.toLowerCase().replace(/\s+/g, ' ');
      return {
        async all(...p) {
          if (q.includes('from project_milestones pm')) {
            let r = rows.filter(x => x.organization_id === p[0]);
            if (q.includes('pm.project_id = ?')) r = r.filter(x => x.project_id === Number(p[1]));
            return r;
          }
          return [];
        },
        async get(...p) {
          if (q.includes('from projects where id = ?')) return [1, 2].includes(Number(p[0])) ? { id: Number(p[0]), name: 'P' } : undefined;
          return undefined;
        },
        async run() { return { changes: 1, lastInsertRowid: 10 }; },
      };
    },
  };
}

describe('Hitos por proyecto', () => {
  beforeEach(() => { app.locals.database = fakeDatabase(); });

  it('H-01 /api/projects/1/milestones muestra solo los hitos del proyecto 1', async () => {
    const res = await request(app).get('/api/projects/1/milestones').set(as(pm));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map(m => m.title), ['Entrega A']);
  });

  it('H-02 /api/projects/2/milestones no incluye hitos de otros proyectos', async () => {
    const res = await request(app).get('/api/projects/2/milestones').set(as(pm));
    assert.deepEqual(res.body.map(m => m.title), ['Entrega B']);
  });

  it('H-03 Se puede crear un hito desde la ruta del proyecto sin repetir el project_id', async () => {
    const res = await request(app).post('/api/projects/1/milestones').set(as(pm)).send({ title: 'Demo', due_date: '2026-11-21' });
    assert.notEqual(res.status, 400);
  });

  it('H-04 Una fecha imposible (31 de febrero) se rechaza con 400 y un mensaje claro', async () => {
    const res = await request(app).post('/api/milestones').set(as(pm)).send({ title: 'Mala fecha', due_date: '2026-02-31', project_id: 1 });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /fecha/i);
  });

  it('H-05 La interfaz tiene la página de Hitos, su formulario y su etiqueta de estado', () => {
    const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
    assert.match(js, /async function renderMilestones\(/);
    assert.match(js, /function openMilestoneModal\(/);
    assert.match(js, /function milestoneStatusBadge\(/);
  });

  it('H-06 Project Overview declara los hitos fuera del try (la página no se rompe)', () => {
    const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
    assert.match(js, /let projectMilestones = \[\];/);
    assert.doesNotMatch(js, /const projectMilestones = await/);
  });

  it('H-07 Los hitos se pintan en el cronograma del Gantt', () => {
    const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
    assert.match(js, /gv-hito-line/);
  });
});
