// Pruebas: SB-09.2 (salud), SB-10.2 (cumplimiento), SB-11.2 (recomendaciones) y manejo del 429 de Sanzu.
// Sanzu se simula con un servidor HTTP local; no se llama al Sanzu real.
process.env.NODE_ENV = 'test';
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const request = require('supertest');
const app = require('../app');
const sanzuService = require('../server/services/sanzuService');
const diagnosis = require('../server/services/diagnosisService');

const day = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

// Respuesta con la forma de POST /api/v1/projects/:ref/context de Sanzu (textos en inglés, como los genera Sanzu)
const sanzuContextResult = {
  projectId: 'haitani-proj-5',
  analyzedAt: '2026-11-26T10:00:00.000Z',
  methodology: 'SCRUM',
  health: { score: 52, status: 'WARNING', factors: { schedule: 40, delivery: 55, risks: 77, issues: 70, teamWorkload: 85, methodologyCompliance: 76, progress: 30 } },
  problems: [
    { type: 'WORKFLOW', severity: 'HIGH', description: 'Multiple tasks are blocked.' },
    { code: 'OVERDUE_TASKS', type: 'SCHEDULE', severity: 'MEDIUM', description: '2 task(s) are overdue.' }
  ],
  compliance: {
    methodology: 'SCRUM', score: 76, status: 'GOOD',
    problems: [{ type: 'WORKFLOW', severity: 'HIGH', description: 'Multiple tasks are blocked.' }],
    warnings: ['2 task(s) are overdue.'],
    recommendations: [],
    rules: ['Sprint must have a goal', 'Backlog should be prioritized', 'Definition of Done should be explicit']
  },
  recommendations: [
    { type: 'SCHEDULE', priority: 'MEDIUM', title: 'Recover overdue work', description: '2 task(s) are overdue (avg. 3 day(s)).', reason: 'Overdue tasks threaten the delivery schedule.', suggestedAction: 'Re-plan overdue work and address its dependencies.' },
    { type: 'WORKLOAD', priority: 'HIGH', title: 'Unblock active work', description: '3 task(s) are blocked.', reason: 'Blocked work reduces flow and delays delivery.', suggestedAction: 'Review blockers with owners and resolve or re-plan them.' },
    { type: 'METHODOLOGY', priority: 'HIGH', title: 'Methodology: Multiple tasks are blocked.', description: 'Multiple tasks are blocked.', reason: 'Required by SCRUM practices.', suggestedAction: 'Apply the corresponding methodology rule (see /methodologies/:id/rules).' }
  ]
};

describe('Diagnóstico del proyecto con Sanzu (SB-09.2, SB-10.2, SB-11.2) y manejo del 429', () => {
  let server;
  let sanzuUrl;
  let mode = 'ok';
  let hits = [];
  let lastBody = null;
  let originalDatabase;

  const org = { id: 7, sanzu_api_key: 'sz_test_diagnostico', sanzu_api_url: '' };
  const admin = { id: 70, username: 'admin_diag', name: 'Admin Diagnóstico', role: 'admin', organization_id: org.id };
  const project = { id: 5, organization_id: org.id, name: 'Proyecto Diagnóstico', methodology_id: 'SCRUM', status: 'active', start_date: day(-30), end_date: day(30), sanzu_external_ref: null };
  const data = {
    members: [{ id: 70, name: 'Admin Diagnóstico', role: 'admin' }, { id: 71, name: 'Ana', role: 'member' }],
    tasks: [
      { id: 1, title: 'Login', status: 'completada', priority: 'alta', assigned_to: 70, due_date: day(-20) },
      { id: 2, title: 'API', status: 'bloqueada', priority: 'alta', assigned_to: 71, due_date: day(-2) },
      { id: 3, title: 'Pagos', status: 'bloqueada', priority: 'media', assigned_to: 71, due_date: null },
      { id: 4, title: 'Reportes', status: 'bloqueada', priority: 'media', assigned_to: 70, due_date: day(-1), estimated_hours: '6.50' },
      { id: 5, title: 'QA', status: 'en_revision', priority: 'baja', assigned_to: null, due_date: day(4) }
    ],
    risks: [{ id: 1, title: 'Caída de Render', probability: 'alta', impact: 'alta', status: 'open', mitigation: '' }],
    sprints: [{ id: 1, name: 'Sprint 6', goal: '', start_date: day(-5), end_date: day(9), status: 'activo' }, { id: 2, name: 'Sprint 5', goal: 'Asistente', start_date: day(-19), end_date: day(-6), status: 'cerrado' }],
    milestones: [{ id: 1, title: 'Entrega final', due_date: day(-1), status: 'en_progreso' }],
    issues: [{ id: 1, title: 'Error al pagar', priority: 'critica', status: 'open' }],
    documents: []
  };

  function fakeDatabase() {
    return {
      prepare(sql) {
        const s = sql.toLowerCase().replace(/\s+/g, ' ');
        return {
          async get(...params) {
            if (s.includes('from organizations where id = ?')) return Number(params[0]) === org.id ? { ...org, sanzu_api_url: sanzuUrl, sanzu_api_key: org.sanzu_api_key } : null;
            if (s.includes('from projects where id = ? and organization_id = ?')) return Number(params[0]) === project.id && Number(params[1]) === org.id ? { ...project } : null;
            return null;
          },
          async all() {
            if (s.includes('from project_members')) return data.members;
            if (s.includes('from tasks')) return data.tasks;
            if (s.includes('from project_risks')) return data.risks;
            if (s.includes('from sprints')) return data.sprints;
            if (s.includes('from project_milestones')) return data.milestones;
            if (s.includes('from project_issues')) return data.issues;
            if (s.includes('from project_documents')) return data.documents;
            return [];
          },
          async run() { return { changes: 0 }; }
        };
      }
    };
  }

  before(async () => {
    server = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        hits.push(`${req.method} ${req.url}`);
        try { lastBody = JSON.parse(body); } catch { lastBody = body; }
        res.setHeader('Content-Type', 'application/json');
        if (mode === '429') {
          res.writeHead(429, { 'Retry-After': '30' });
          return res.end(JSON.stringify({ success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Límite de peticiones excedido.' } }));
        }
        if (mode === '500') {
          res.writeHead(500);
          return res.end(JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Fallo simulado' } }));
        }
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: sanzuContextResult }));
      });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    sanzuUrl = `http://127.0.0.1:${server.address().port}`;
    originalDatabase = app.locals.database;
    app.locals.database = fakeDatabase();
  });

  after(async () => {
    app.locals.database = originalDatabase;
    sanzuService.clearRateLimitPauses();
    diagnosis.clearDiagnosisCache();
    await new Promise(resolve => server.close(resolve));
  });

  beforeEach(() => {
    mode = 'ok';
    hits = [];
    lastBody = null;
    sanzuService.clearRateLimitPauses();
    diagnosis.clearDiagnosisCache();
  });

  describe('429 de Sanzu', () => {
    it('no reintenta un 429: hace una sola petición y respeta Retry-After', async () => {
      mode = '429';
      await assert.rejects(
        sanzuService.analyzeContext(project, { project: { name: 'x' } }, { apiKey: org.sanzu_api_key, apiUrl: sanzuUrl }),
        error => error.code === 'RATE_LIMITED' && error.status === 429 && error.retryAfter === 30
      );
      assert.equal(hits.length, 1, 'Antes se mandaban 3 peticiones seguidas al recibir 429');
    });

    it('mientras dura la pausa no vuelve a llamar a Sanzu', async () => {
      mode = '429';
      await assert.rejects(sanzuService.analyzeContext(project, {}, { apiKey: org.sanzu_api_key, apiUrl: sanzuUrl }));
      mode = 'ok';
      await assert.rejects(
        sanzuService.analyzeContext(project, {}, { apiKey: org.sanzu_api_key, apiUrl: sanzuUrl }),
        error => error.code === 'RATE_LIMITED'
      );
      assert.equal(hits.length, 1);
      assert.ok(sanzuService.rateLimitRemaining(sanzuUrl) > 0);
    });

    it('un error 500 sí se sigue reintentando', async () => {
      mode = '500';
      await assert.rejects(sanzuService.analyzeContext(project, {}, { apiKey: org.sanzu_api_key, apiUrl: sanzuUrl }));
      assert.equal(hits.length, 3);
    });

    it('usa haitani-proj-<id> cuando el proyecto no tiene sanzu_external_ref', async () => {
      await sanzuService.analyzeContext(project, {}, { apiKey: org.sanzu_api_key, apiUrl: sanzuUrl });
      assert.deepEqual(hits, ['POST /api/v1/projects/haitani-proj-5/context']);
    });
  });

  describe('Contexto que se manda a Sanzu', () => {
    it('manda los estados en el formato que Sanzu acepta y omite las fechas vacías', () => {
      const payload = diagnosis.buildPayload({ project, ...data });
      assert.deepEqual(payload.tasks.map(t => t.status), ['DONE', 'BLOCKED', 'BLOCKED', 'BLOCKED', 'IN_PROGRESS']);
      assert.equal(payload.tasks[2].dueDate, undefined, 'null se convierte en 1970 en Sanzu, por eso no se manda');
      assert.equal(payload.tasks[3].estimatedHours, 6.5);
      assert.deepEqual(payload.sprints.map(s => s.status), ['ACTIVE', 'COMPLETED']);
      assert.equal(payload.milestones[0].status, 'IN_PROGRESS');
      assert.equal(payload.issues[0].priority, 'CRITICAL');
    });
  });

  describe('Respuesta de Sanzu en los paneles', () => {
    it('traduce al español, ordena las recomendaciones y quita la repetida de metodología', async () => {
      const result = await diagnosis.getDiagnosis(fakeDatabase(), project.id, org.id);
      assert.equal(result.source, 'sanzu');
      assert.equal(result.health.score, 52);
      assert.equal(result.health.statusLabel, 'Atención');
      assert.ok(result.health.factors.some(f => f.label === 'Cronograma' && f.value === 40));
      assert.deepEqual(result.health.problems.map(p => p.description), ['Hay varias tareas bloqueadas.', '2 tarea(s) están vencidas.']);
      assert.deepEqual(result.recommendations.map(r => r.title), ['Desbloquear el trabajo activo', 'Recuperar el trabajo vencido']);
      assert.deepEqual(result.recommendations.map(r => r.priorityLabel), ['Alta', 'Media']);
      assert.equal(result.recommendations[0].reason, 'El trabajo bloqueado frena el flujo y retrasa la entrega.');
      assert.equal(result.recommendations[0].suggestedAction, 'Revisar los bloqueos con los responsables y resolverlos o replanearlos.');
    });

    it('marca las prácticas cumplidas y no cumplidas según los problemas de Sanzu', async () => {
      const { compliance } = await diagnosis.getDiagnosis(fakeDatabase(), project.id, org.id);
      assert.equal(compliance.score, 76);
      assert.deepEqual(compliance.unmet.map(p => p.id), ['BLOCKED_UNDER_CONTROL']);
      assert.deepEqual(compliance.met.map(p => p.id), ['RISKS_MITIGATED', 'NO_CRITICAL_ISSUES', 'SPRINT_GOAL']);
      assert.ok(compliance.rules.includes('Cada sprint debe tener un objetivo'));
    });

    it('guarda el análisis 60 s para no gastar el límite de Sanzu', async () => {
      await diagnosis.getDiagnosis(fakeDatabase(), project.id, org.id);
      const second = await diagnosis.getDiagnosis(fakeDatabase(), project.id, org.id);
      assert.equal(hits.length, 1);
      assert.equal(second.cached, true);
    });

    it('si Sanzu responde 429 después, muestra el último análisis de Sanzu con aviso', async () => {
      await diagnosis.getDiagnosis(fakeDatabase(), project.id, org.id);
      mode = '429';
      const result = await diagnosis.getDiagnosis(fakeDatabase(), project.id, org.id, { refresh: true });
      assert.equal(result.source, 'sanzu');
      assert.match(result.warning, /límite de peticiones/);
      assert.match(result.warning, /último análisis de Sanzu/);
    });
  });

  describe('Modo local (respaldo)', () => {
    it('con 429 y sin análisis previo calcula en modo local', async () => {
      mode = '429';
      const result = await diagnosis.getDiagnosis(fakeDatabase(), project.id, org.id);
      assert.equal(result.source, 'local');
      assert.match(result.warning, /pidió esperar 30 s/);
      assert.ok(result.health.score >= 0 && result.health.score <= 100);
    });

    it('detecta las prácticas no cumplidas con las mismas reglas que Sanzu', () => {
      const local = diagnosis.present(diagnosis.localDiagnosis({ project, ...data }), {});
      assert.deepEqual(local.compliance.unmet.map(p => p.id).sort(), ['BLOCKED_UNDER_CONTROL', 'NO_CRITICAL_ISSUES', 'RISKS_MITIGATED', 'SPRINT_GOAL']);
      const priorities = local.recommendations.map(r => r.priority);
      const rank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      assert.deepEqual(priorities, [...priorities].sort((a, b) => rank[a] - rank[b]), 'Las recomendaciones van de mayor a menor prioridad');
      assert.ok(local.recommendations.every(r => r.reason && r.suggestedAction));
    });

    it('un proyecto sano cumple todas las prácticas y no tiene recomendaciones', () => {
      const healthy = {
        project, members: data.members, documents: [], milestones: [], issues: [],
        tasks: [{ id: 1, title: 'A', status: 'completada', priority: 'media', assigned_to: 70 }, { id: 2, title: 'B', status: 'en_proceso', priority: 'media', assigned_to: 71, due_date: day(5) }],
        risks: [{ id: 1, title: 'R', probability: 'baja', impact: 'media', status: 'open', mitigation: 'Plan B' }],
        sprints: [{ id: 1, name: 'S1', goal: 'Meta', start_date: day(-3), end_date: day(10), status: 'activo' }]
      };
      const local = diagnosis.present(diagnosis.localDiagnosis(healthy), {});
      assert.equal(local.compliance.unmet.length, 0);
      assert.equal(local.compliance.score, 100);
      assert.equal(local.recommendations.length, 0);
    });

    it('sin API Key no llama a Sanzu', async () => {
      const db = fakeDatabase();
      const noKey = { prepare(sql) { const q = db.prepare(sql); return { ...q, async get(...p) { const row = await q.get(...p); return row && 'sanzu_api_key' in row ? { ...row, sanzu_api_key: null, sanzu_token: null } : row; } }; } };
      const previous = process.env.SANZU_API_KEY;
      delete process.env.SANZU_API_KEY;
      try {
        const result = await diagnosis.getDiagnosis(noKey, project.id, org.id);
        assert.equal(result.source, 'local');
        assert.equal(hits.length, 0);
      } finally {
        if (previous !== undefined) process.env.SANZU_API_KEY = previous;
      }
    });
  });

  describe('Ruta GET /api/projects/:id/diagnosis', () => {
    it('pide sesión', async () => {
      const res = await request(app).get('/api/projects/5/diagnosis');
      assert.equal(res.status, 401);
    });

    it('regresa los tres paneles para el administrador', async () => {
      const res = await request(app).get('/api/projects/5/diagnosis').set('x-test-user', JSON.stringify(admin));
      assert.equal(res.status, 200);
      assert.equal(res.body.source, 'sanzu');
      assert.ok(res.body.health && res.body.compliance && Array.isArray(res.body.recommendations));
      assert.equal(lastBody.project.name, 'Proyecto Diagnóstico');
    });

    it('responde 404 con un proyecto de otra organización', async () => {
      const res = await request(app).get('/api/projects/99/diagnosis').set('x-test-user', JSON.stringify(admin));
      assert.equal(res.status, 404);
    });
  });
});
