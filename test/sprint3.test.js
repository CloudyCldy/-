// Pruebas del Sprint 3 (QA-02): reglas del Kanban por rol, servicio de GitHub,
// validación de archivos y páginas públicas de privacidad.
process.env.NODE_ENV = 'test';
const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../app');
const github = require('../server/services/githubService');

// Base de datos en memoria con lo mínimo que usan las rutas probadas
function fakeDatabase(tasks) {
  return {
    tasks,
    activities: [],
    prepare(sql) {
      const q = sql.toLowerCase().replace(/\s+/g, ' ');
      const self = this;
      return {
        async get(...p) {
          if (q.includes('from tasks where id = ?')) {
            const t = self.tasks.find(x => x.id === Number(p[0]) && x.organization_id === p[1]);
            return t ? { ...t } : undefined;
          }
          return undefined;
        },
        async all() { return []; },
        async run(...p) {
          if (q.startsWith('update tasks set status')) {
            const t = self.tasks.find(x => x.id === Number(p[2]) && x.organization_id === p[3]);
            if (t) t.status = p[0];
            return { changes: t ? 1 : 0 };
          }
          if (q.startsWith('insert into activities')) self.activities.push(p);
          return { changes: 1 };
        },
      };
    },
  };
}

const ORG = 10;
const admin = { id: 1, username: 'admin', role: 'admin', organization_id: ORG };
const pm = { id: 2, username: 'pm', role: 'project_manager', organization_id: ORG };
const ana = { id: 3, username: 'ana', role: 'member', organization_id: ORG };
const viewer = { id: 4, username: 'lector', role: 'viewer', organization_id: ORG };
const as = user => ({ 'x-test-user': JSON.stringify(user) });

describe('UIT · Kanban: quién puede mover una tarea a qué estado', () => {
  let db;
  beforeEach(() => {
    db = fakeDatabase([
      { id: 1, organization_id: ORG, project_id: 1, assigned_to: ana.id, status: 'en_proceso' },
      { id: 2, organization_id: ORG, project_id: 1, assigned_to: ana.id, status: 'completada' },
      { id: 3, organization_id: ORG, project_id: 1, assigned_to: pm.id, status: 'pendiente' },
    ]);
    app.locals.database = db;
  });

  it('K-01 Un integrante avanza su propia tarea (en proceso → en revisión)', async () => {
    const res = await request(app).patch('/api/tasks/1/status').set(as(ana)).send({ status: 'en_revision' });
    assert.equal(res.status, 200);
    assert.equal(db.tasks[0].status, 'en_revision');
  });

  it('K-02 Un integrante NO puede regresar su tarea (en proceso → pendiente) y recibe 403', async () => {
    const res = await request(app).patch('/api/tasks/1/status').set(as(ana)).send({ status: 'pendiente' });
    assert.equal(res.status, 403);
    assert.match(res.body.error, /administrador o project manager/);
    assert.equal(db.tasks[0].status, 'en_proceso');
  });

  it('K-03 Bloquear una tarea en proceso no cuenta como regresarla', async () => {
    const res = await request(app).patch('/api/tasks/1/status').set(as(ana)).send({ status: 'bloqueada' });
    assert.equal(res.status, 200);
  });

  it('K-04 El administrador sí puede regresar una tarea completada', async () => {
    const res = await request(app).patch('/api/tasks/2/status').set(as(admin)).send({ status: 'en_proceso' });
    assert.equal(res.status, 200);
    assert.equal(db.tasks[1].status, 'en_proceso');
  });

  it('K-05 El project manager también puede regresar tareas', async () => {
    const res = await request(app).patch('/api/tasks/2/status').set(as(pm)).send({ status: 'pendiente' });
    assert.equal(res.status, 200);
  });

  it('K-06 Un integrante no ve ni mueve tareas de otra persona (404)', async () => {
    const res = await request(app).patch('/api/tasks/3/status').set(as(ana)).send({ status: 'en_proceso' });
    assert.equal(res.status, 404);
  });

  it('K-07 El rol lector no puede cambiar estados (403)', async () => {
    const res = await request(app).patch('/api/tasks/3/status').set(as(viewer)).send({ status: 'en_proceso' });
    assert.equal(res.status, 403);
  });

  it('K-08 Un estado que no existe se rechaza (400)', async () => {
    const res = await request(app).patch('/api/tasks/1/status').set(as(admin)).send({ status: 'terminada' });
    assert.equal(res.status, 400);
  });

  it('K-09 Cada cambio de estado queda registrado en la actividad', async () => {
    await request(app).patch('/api/tasks/1/status').set(as(ana)).send({ status: 'completada' });
    assert.equal(db.activities.length, 1);
    assert.match(db.activities[0][4], /completada/);
  });
});

describe('UT · Servicio de GitHub', () => {
  let calls;
  before(() => {
    calls = 0;
    class FakeOctokit {
      constructor(options) {
        this.auth = options.auth;
        this.repos = {
          get: async ({ owner, repo }) => {
            calls++;
            if (repo === 'privado' && !this.auth) { const e = new Error('Not Found'); e.status = 404; throw e; }
            if (repo === 'token-vencido') { const e = new Error('Bad credentials'); e.status = 401; throw e; }
            return { data: { name: repo, full_name: `${owner}/${repo}` } };
          },
        };
      }
    }
    github.setOctokitForTests(FakeOctokit);
  });

  it('G-01 Obtiene dueño y repositorio de distintas formas de URL', () => {
    assert.deepEqual(github.parseRepoUrl('https://github.com/CloudyCldy/CoffeeKorea.git'), { owner: 'CloudyCldy', repo: 'CoffeeKorea' });
    assert.deepEqual(github.parseRepoUrl('github.com/equipo/haitani/'), { owner: 'equipo', repo: 'haitani' });
    assert.deepEqual(github.parseRepoUrl('equipo/haitani'), { owner: 'equipo', repo: 'haitani' });
    assert.equal(github.parseRepoUrl('no es una url'), null);
  });

  it('G-02 Un repositorio público funciona sin token', async () => {
    const r = await github.repository({ url: 'https://github.com/equipo/publico' });
    assert.equal(r.configured, true);
    assert.equal(r.data.data.full_name, 'equipo/publico');
  });

  it('G-03 Las consultas repetidas usan la caché (no gastan el límite de GitHub)', async () => {
    const before = calls;
    await github.repository({ url: 'https://github.com/equipo/publico' });
    assert.equal(calls, before);
  });

  it('G-04 Un repositorio privado sin token da un mensaje claro', async () => {
    const r = await github.repository({ url: 'https://github.com/equipo/privado' });
    assert.match(r.error, /privado.*token/);
  });

  it('G-05 Con token el repositorio privado sí se lee', async () => {
    const r = await github.repository({ url: 'https://github.com/equipo/privado', token: 'ghp_prueba123' });
    assert.equal(r.data.data.name, 'privado');
  });

  it('G-06 Un token vencido o inválido se reporta como tal', async () => {
    const r = await github.repository({ url: 'https://github.com/equipo/token-vencido', token: 'ghp_viejo' });
    assert.match(r.error, /token.*no es válido/);
  });

  it('G-07 Sin repositorio configurado responde "no configurado"', async () => {
    const r = await github.repository(null);
    assert.equal(r.configured, false);
  });
});

describe('UIT · Archivos y páginas públicas', () => {
  it('F-01 Un archivo con extensión no permitida se rechaza con un mensaje claro', async () => {
    const original = console.error;
    console.error = () => {}; // el servidor registra el rechazo; aquí no hace falta mostrarlo
    const res = await request(app)
      .post('/api/files')
      .set(as(admin))
      .attach('file', Buffer.from('MZ'), 'programa.exe');
    console.error = original;
    assert.equal(res.status, 400);
    assert.match(res.body.error, /\.exe/);
  });

  it('F-02 La política de privacidad es pública', async () => {
    const res = await request(app).get('/privacidad');
    assert.equal(res.status, 200);
    assert.match(res.text, /Política de privacidad/);
  });

  it('F-03 La página para eliminar la cuenta es pública', async () => {
    const res = await request(app).get('/eliminar-cuenta');
    assert.equal(res.status, 200);
    assert.match(res.text, /Eliminar tu cuenta/);
  });
});
