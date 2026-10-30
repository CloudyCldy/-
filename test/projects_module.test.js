// Pruebas del Módulo de Gestión de Proyectos y Creador Visual
process.env.NODE_ENV = 'test';
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../app');

const ORG_A = 10;
const ORG_B = 20;

const adminA = { id: 1, username: 'admin_a', role: 'admin', organization_id: ORG_A };
const pmA = { id: 2, username: 'pm_a', role: 'project_manager', organization_id: ORG_A };
const memberA = { id: 3, username: 'mem_a', role: 'member', organization_id: ORG_A };
const adminB = { id: 4, username: 'admin_b', role: 'admin', organization_id: ORG_B };

const as = user => ({ 'x-test-user': JSON.stringify(user) });

function fakeProjectsDatabase() {
  const projects = [
    {
      id: 101,
      organization_id: ORG_A,
      name: 'Plataforma Sakura',
      description: 'Sistema principal de comercio',
      methodology_id: 'SCRUM',
      status: 'in_progress',
      priority: 'high',
      budget: '150000.00',
      client: 'Sakura Retail',
      manager_id: pmA.id,
      manager_name: 'pm_a',
      tasks_total: 5,
      tasks_done: 2,
      tasks_progress: 40,
      members_count: 2,
      milestones_count: 3,
      sprints_count: 2,
      open_risks_count: 1,
      members: [{ id: 1, name: 'admin_a' }, { id: 2, name: 'pm_a' }]
    },
    {
      id: 102,
      organization_id: ORG_A,
      name: 'App Móvil Sakura',
      description: 'Aplicación cliente',
      methodology_id: 'KANBAN',
      status: 'planning',
      priority: 'medium',
      budget: '80000.00',
      client: 'Sakura Delivery',
      manager_id: null,
      manager_name: null,
      tasks_total: 0,
      tasks_done: 0,
      tasks_progress: 0,
      members_count: 1,
      milestones_count: 0,
      sprints_count: 0,
      open_risks_count: 0,
      members: [{ id: 1, name: 'admin_a' }]
    },
    {
      id: 201,
      organization_id: ORG_B,
      name: 'Proyecto de otra Org',
      description: 'No visible para Org A',
      methodology_id: 'WATERFALL',
      status: 'planning',
      priority: 'low',
      budget: '50000.00',
      client: 'Cliente B',
      manager_id: null,
      manager_name: null,
      tasks_total: 0,
      tasks_done: 0,
      tasks_progress: 0,
      members_count: 1,
      milestones_count: 0,
      sprints_count: 0,
      open_risks_count: 0,
      members: []
    }
  ];

  const activities = [];
  const projectMembers = [];
  const tasks = [];
  const milestones = [];
  const sprints = [];

  return {
    projects,
    activities,
    projectMembers,
    tasks,
    milestones,
    sprints,
    prepare(sql) {
      const q = sql.toLowerCase().replace(/\s+/g, ' ').trim();
      const self = this;
      return {
        async get(...p) {
          if (q.includes('from users where id = ? and organization_id = ?')) {
            const userId = Number(p[0]);
            const orgId = Number(p[1]);
            const foundUser = [adminA, pmA, memberA, adminB].find(u => u.id === userId && u.organization_id === orgId);
            return foundUser ? { id: foundUser.id } : undefined;
          }
          if (q.includes('from projects') && q.includes('where id = ? and organization_id = ?')) {
            const pId = Number(p[0]);
            const orgId = Number(p[1]);
            return self.projects.find(x => x.id === pId && x.organization_id === orgId);
          }
          if (q.includes('from projects') && q.includes('where projects.id = ? and projects.organization_id = ?')) {
            const pId = Number(p[0]);
            const orgId = Number(p[1]);
            return self.projects.find(x => x.id === pId && x.organization_id === orgId);
          }
          return undefined;
        },
        async all(...p) {
          if (q.includes('from projects') && q.includes('where projects.organization_id = ?')) {
            const orgId = Number(p[0]);
            return self.projects.filter(x => x.organization_id === orgId);
          }
          if (q.includes('from project_members') && q.includes('where project_members.project_id = ?')) {
            return [{ id: 1, name: 'Admin' }];
          }
          return [];
        },
        async run(...p) {
          if (q.startsWith('insert into projects')) {
            const newId = 100 + self.projects.length + 1;
            const newProject = {
              id: newId,
              organization_id: p[0],
              name: p[1],
              description: p[2],
              objective: p[3],
              scope: p[4],
              client: p[5],
              manager_id: p[6],
              start_date: p[7],
              end_date: p[8],
              status: p[9],
              priority: p[10],
              budget: p[11],
              repository_url: p[12],
              technologies: p[13],
              risks: p[14],
              methodology_id: p[15],
              requirements: p[16],
            };
            self.projects.push(newProject);
            return { changes: 1, lastInsertRowid: newId };
          }
          if (q.startsWith('update projects set sanzu_external_ref = ?')) {
            return { changes: 1 };
          }
          if (q.startsWith('insert into project_members')) {
            self.projectMembers.push({ project_id: p[0], user_id: p[1], org_id: p[2] });
            return { changes: 1 };
          }
          if (q.startsWith('insert into tasks')) {
            self.tasks.push(p);
            return { changes: 1, lastInsertRowid: 50 };
          }
          if (q.startsWith('insert into project_milestones')) {
            self.milestones.push(p);
            return { changes: 1, lastInsertRowid: 60 };
          }
          if (q.startsWith('insert into sprints')) {
            self.sprints.push(p);
            return { changes: 1, lastInsertRowid: 70 };
          }
          if (q.startsWith('insert into activities')) {
            self.activities.push(p);
            return { changes: 1 };
          }
          if (q.startsWith('update projects set status = ?')) {
            const status = p[0];
            const pId = Number(p[1]);
            const orgId = Number(p[2]);
            const proj = self.projects.find(x => x.id === pId && x.organization_id === orgId);
            if (proj) proj.status = status;
            return { changes: proj ? 1 : 0 };
          }
          if (q.startsWith('delete from projects where id = ?')) {
            const pId = Number(p[0]);
            const orgId = Number(p[1]);
            const idx = self.projects.findIndex(x => x.id === pId && x.organization_id === orgId);
            if (idx >= 0) {
              self.projects.splice(idx, 1);
              return { changes: 1 };
            }
            return { changes: 0 };
          }
          return { changes: 1 };
        }
      };
    }
  };
}

describe('Módulo de Gestión de Proyectos - API y Lógica de Negocio', () => {
  let db;

  beforeEach(() => {
    db = fakeProjectsDatabase();
    app.locals.database = db;
  });

  it('P-01 GET /api/projects retorna la lista enriquecida de proyectos de la organización', async () => {
    const res = await request(app).get('/api/projects').set(as(adminA));
    assert.equal(res.status, 200);
    assert.equal(Array.isArray(res.body), true);
    assert.equal(res.body.length, 2);
    assert.equal(res.body[0].name, 'Plataforma Sakura');
    assert.equal(res.body[0].tasks_progress, 40);
  });

  it('P-02 GET /api/projects aísla los proyectos por organización (no ve proyectos de Org B)', async () => {
    const res = await request(app).get('/api/projects').set(as(adminA));
    const ids = res.body.map(p => p.id);
    assert.equal(ids.includes(201), false);
  });

  it('P-03 POST /api/projects crea un nuevo proyecto con datos visuales y valida metodología', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set(as(pmA))
      .send({
        name: 'Nuevo Portal de Clientes',
        description: 'Portal autoservicio',
        methodology_id: 'SCRUM',
        client: 'Sakura Holding',
        manager_id: pmA.id,
        priority: 'high',
        budget: 120000,
        start_date: '2026-11-01',
        end_date: '2026-12-31'
      });

    assert.equal(res.status, 201);
    assert.ok(res.body.id);
    assert.ok(res.body.sanzu_external_ref);
  });

  it('P-04 POST /api/projects rechaza metodología no soportada con 400', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set(as(pmA))
      .send({
        name: 'Proyecto Invalido',
        methodology_id: 'METODOLOGIA_FANTASMA'
      });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /metodología/i);
  });

  it('P-05 POST /api/projects con create_kickoff_items genera tarea, hito y sprint inicial', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set(as(adminA))
      .send({
        name: 'Proyecto con Kit de Arranque',
        methodology_id: 'SCRUM',
        create_kickoff_items: true,
        initial_members: [pmA.id, memberA.id]
      });

    assert.equal(res.status, 201);
    assert.ok(db.tasks.length >= 1);
    assert.ok(db.milestones.length >= 1);
    assert.ok(db.sprints.length >= 1);
    assert.ok(db.projectMembers.length >= 2);
  });

  it('P-06 PATCH /api/projects/:id/status actualiza el estado de forma inmediata', async () => {
    const res = await request(app)
      .patch('/api/projects/101/status')
      .set(as(pmA))
      .send({ status: 'completed' });

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.status, 'completed');
  });

  it('P-07 PATCH /api/projects/:id/status rechaza estados inválidos con 400', async () => {
    const res = await request(app)
      .patch('/api/projects/101/status')
      .set(as(pmA))
      .send({ status: 'estado_inexistente' });

    assert.equal(res.status, 400);
  });

  it('P-08 DELETE /api/projects/:id permite a Project Manager y Admin eliminar proyecto', async () => {
    const res = await request(app)
      .delete('/api/projects/102')
      .set(as(pmA));

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(db.projects.some(p => p.id === 102), false);
  });

  it('P-09 DELETE /api/projects/:id impide a un Member normal eliminar un proyecto (403)', async () => {
    const res = await request(app)
      .delete('/api/projects/101')
      .set(as(memberA));

    assert.equal(res.status, 403);
    assert.equal(db.projects.some(p => p.id === 101), true);
  });

  it('P-10 DELETE /api/projects/:id protege contra IDOR entre organizaciones (404)', async () => {
    const res = await request(app)
      .delete('/api/projects/201')
      .set(as(adminA));

    assert.equal(res.status, 404);
  });

  it('P-11 La interfaz cliente (app.js) incluye el módulo renderProjects, openNewProjectWizard y los enlaces en el sidebar', () => {
    const appJs = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf-8');
    assert.ok(appJs.includes('function renderProjects()'));
    assert.ok(appJs.includes('function openNewProjectWizard('));
    assert.ok(appJs.includes('function openProjectEditModal('));
    assert.ok(appJs.includes('function openProjectTeamModal('));
    assert.ok(appJs.includes('function confirmDeleteProject('));
    assert.ok(appJs.includes("['/admin/projects','Proyectos','briefcase']"));
    assert.ok(appJs.includes("['/member/projects','Proyectos','briefcase']"));
    assert.ok(appJs.includes("if(route.includes('projects'))return renderProjects();"));
  });

  it('P-12 El asistente visual declara el stepper de 6 pasos y catálogo metodológico', () => {
    const appJs = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf-8');
    assert.ok(appJs.includes('SCRUM'));
    assert.ok(appJs.includes('KANBAN'));
    assert.ok(appJs.includes('WATERFALL'));
    assert.ok(appJs.includes('HYBRID'));
    assert.ok(appJs.includes('XP'));
    assert.ok(appJs.includes('LEAN'));
    assert.ok(appJs.includes('AGILE'));
    assert.ok(appJs.includes('Kit de Arranque Automático (Kickoff)'));
    assert.ok(appJs.includes('wizard-team-picker'));
    assert.ok(appJs.includes('calculateDurationText'));
  });

  it('P-13 La hoja de estilos (style.css) contiene las clases para cuadrícula, tarjetas, stepper y wizard', () => {
    const styleCss = fs.readFileSync(path.join(__dirname, '../public/css/style.css'), 'utf-8');
    assert.ok(styleCss.includes('.project-cards-grid'));
    assert.ok(styleCss.includes('.project-card'));
    assert.ok(styleCss.includes('.project-wizard-stepper'));
    assert.ok(styleCss.includes('.methodology-cards-grid'));
    assert.ok(styleCss.includes('.wizard-team-picker'));
    assert.ok(styleCss.includes('.kickoff-kit-box'));
  });
});
