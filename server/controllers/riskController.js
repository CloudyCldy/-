const { detectAndSyncEvents } = require('../services/eventService');

const WEIGHTS = { baja: 1, media: 2, alta: 3 };

function calculateSeverityScore(probability, impact) {
  const p = WEIGHTS[probability] || 2;
  const i = WEIGHTS[impact] || 2;
  return Math.min(100, Math.round((p * i / 9) * 100));
}

async function list(req, res) {
  const database = req.app.locals.database;
  const orgId = req.session.user.organization_id;
  const projectId = req.query.project_id ? Number(req.query.project_id) : null;
  const status = req.query.status ? String(req.query.status).trim() : null;

  const filters = ['project_risks.organization_id = ?'];
  const params = [orgId];

  if (projectId) {
    filters.push('project_risks.project_id = ?');
    params.push(projectId);
  }
  if (status) {
    filters.push('project_risks.status = ?');
    params.push(status);
  }

  const risks = await database.prepare(`
    SELECT project_risks.*, projects.name AS project_name, users.name AS creator_name
    FROM project_risks
    JOIN projects ON projects.id = project_risks.project_id
    LEFT JOIN users ON users.id = project_risks.created_by
    WHERE ${filters.join(' AND ')}
    ORDER BY project_risks.severity_score DESC, project_risks.created_at DESC
  `).all(...params);

  res.json(risks);
}

async function create(req, res) {
  const database = req.app.locals.database;
  const orgId = req.session.user.organization_id;
  const userId = req.session.user.id;
  const { project_id, title, description = '', probability = 'media', impact = 'media', mitigation = '' } = req.body;

  if (!String(title || '').trim()) return res.status(400).json({ error: 'El título del riesgo es obligatorio.' });
  const parsedProjectId = Number(project_id);
  if (!Number.isInteger(parsedProjectId) || parsedProjectId < 1) return res.status(400).json({ error: 'Proyecto no válido.' });

  const project = await database.prepare('SELECT id FROM projects WHERE id = ? AND organization_id = ?').get(parsedProjectId, orgId);
  if (!project) return res.status(404).json({ error: 'El proyecto no existe en tu organización.' });

  const score = calculateSeverityScore(probability, impact);

  const result = await database.prepare(`
    INSERT INTO project_risks (organization_id, project_id, title, description, probability, impact, mitigation, severity_score, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id
  `).run(orgId, parsedProjectId, title.trim(), description, probability, impact, mitigation, score, userId);

  await database.prepare(`INSERT INTO activities (organization_id, user_id, project_id, action, description) VALUES (?, ?, ?, ?, ?)`).run(
    orgId, userId, parsedProjectId, 'risk.created', `Riesgo registrado: ${title.trim()} (severidad: ${score})`
  );

  // Sincronizar eventos si tiene impacto alto
  await detectAndSyncEvents(database, orgId, parsedProjectId).catch(() => {});

  res.status(201).json({ id: result.lastInsertRowid, severity_score: score });
}

async function update(req, res) {
  const database = req.app.locals.database;
  const orgId = req.session.user.organization_id;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Identificador no válido.' });

  const risk = await database.prepare('SELECT * FROM project_risks WHERE id = ? AND organization_id = ?').get(id, orgId);
  if (!risk) return res.status(404).json({ error: 'El riesgo no existe.' });

  const { title = risk.title, description = risk.description, probability = risk.probability, impact = risk.impact, status = risk.status, mitigation = risk.mitigation } = req.body;
  const score = calculateSeverityScore(probability, impact);

  await database.prepare(`
    UPDATE project_risks
    SET title = ?, description = ?, probability = ?, impact = ?, status = ?, mitigation = ?, severity_score = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND organization_id = ?
  `).run(String(title).trim(), description, probability, impact, status, mitigation, score, id, orgId);

  res.json({ ok: true, severity_score: score });
}

async function remove(req, res) {
  const database = req.app.locals.database;
  const orgId = req.session.user.organization_id;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Identificador no válido.' });

  const risk = await database.prepare('SELECT * FROM project_risks WHERE id = ? AND organization_id = ?').get(id, orgId);
  if (!risk) return res.status(404).json({ error: 'El riesgo no existe.' });

  await database.prepare('DELETE FROM project_risks WHERE id = ? AND organization_id = ?').run(id, orgId);
  res.json({ ok: true });
}

/**
 * Cálculo del Team Workload con porcentajes de capacidad (SB-07-ST064)
 */
async function workload(req, res) {
  const database = req.app.locals.database;
  const orgId = req.session.user.organization_id;
  const projectId = req.query.project_id ? Number(req.query.project_id) : null;

  const projectFilter = projectId ? 'AND tasks.project_id = ?' : '';
  const params = projectId ? [orgId, projectId, orgId] : [orgId, orgId];

  const members = await database.prepare(`
    SELECT users.id, users.name, users.username, users.role,
           COUNT(tasks.id)::integer AS total_tasks,
           COUNT(tasks.id) FILTER (WHERE tasks.status = 'completada')::integer AS completed_tasks,
           COUNT(tasks.id) FILTER (WHERE tasks.status = 'en_proceso')::integer AS in_progress_tasks,
           COUNT(tasks.id) FILTER (WHERE tasks.status = 'pendiente')::integer AS pending_tasks,
           COUNT(tasks.id) FILTER (WHERE tasks.status = 'bloqueada')::integer AS blocked_tasks
    FROM users
    LEFT JOIN tasks ON tasks.assigned_to = users.id AND tasks.organization_id = ? ${projectFilter}
    WHERE users.organization_id = ? AND users.active = 1
    GROUP BY users.id, users.name, users.username, users.role
    ORDER BY total_tasks DESC, users.name ASC
  `).all(...params);

  const MAX_RECOMMENDED_TASKS = 5;

  const workloadData = members.map(m => {
    const activeTasks = m.in_progress_tasks + m.pending_tasks + m.blocked_tasks;
    const capacityPercent = Math.min(100, Math.round((activeTasks / MAX_RECOMMENDED_TASKS) * 100));
    const workloadLevel = capacityPercent > 90 ? 'sobrecargado' : capacityPercent >= 60 ? 'optimo' : 'disponible';

    return {
      userId: m.id,
      name: m.name,
      username: m.username,
      role: m.role,
      totalTasks: m.total_tasks,
      completedTasks: m.completed_tasks,
      activeTasks,
      inProgressTasks: m.in_progress_tasks,
      pendingTasks: m.pending_tasks,
      blockedTasks: m.blocked_tasks,
      capacityPercent,
      workloadLevel
    };
  });

  res.json(workloadData);
}

/**
 * Resumen del Risk Center con alertas y recomendaciones accionables (SB-07-ST063, SB-07-ST065)
 */
async function overview(req, res) {
  const database = req.app.locals.database;
  const orgId = req.session.user.organization_id;

  // Detectar y refrescar eventos automáticamente
  await detectAndSyncEvents(database, orgId).catch(() => {});

  const [risks, events, projects] = await Promise.all([
    database.prepare(`SELECT * FROM project_risks WHERE organization_id = ? AND status = 'open' ORDER BY severity_score DESC`).all(orgId),
    database.prepare(`SELECT * FROM project_events WHERE organization_id = ? AND resolved = false ORDER BY created_at DESC LIMIT 15`).all(orgId),
    database.prepare(`SELECT id, name, status, progress FROM projects WHERE organization_id = ?`).all(orgId)
  ]);

  const highSeverityRisks = risks.filter(r => r.severity_score >= 65);
  const mediumSeverityRisks = risks.filter(r => r.severity_score >= 40 && r.severity_score < 65);
  const lowSeverityRisks = risks.filter(r => r.severity_score < 40);

  // Alertas y recomendaciones accionables (SB-07-ST065)
  const alerts = [];
  const recommendations = [];

  if (highSeverityRisks.length > 0) {
    alerts.push({
      type: 'critical',
      message: `Existen ${highSeverityRisks.length} riesgo(s) de severidad alta que requieren mitigación inmediata.`
    });
    recommendations.push({
      action: 'Crear plan de contingencia',
      detail: `Priorizar mitigación para: ${highSeverityRisks.map(r => r.title).slice(0, 2).join(', ')}.`
    });
  }

  const overdueEvents = events.filter(e => e.event_type === 'task_overdue');
  if (overdueEvents.length > 0) {
    alerts.push({
      type: 'warning',
      message: `Hay ${overdueEvents.length} tarea(s) vencida(s) detectadas por el sistema.`
    });
    recommendations.push({
      action: 'Replanificar tareas vencidas',
      detail: 'Ajustar fechas límite o reasignar tareas para descongestionar el flujo.'
    });
  }

  const blockedEvents = events.filter(e => e.event_type === 'task_blocked');
  if (blockedEvents.length > 0) {
    alerts.push({
      type: 'warning',
      message: `${blockedEvents.length} tarea(s) están bloqueadas actualmente.`
    });
    recommendations.push({
      action: 'Desbloquear dependencias',
      detail: 'Revisar recursos o permisos técnicos que detienen las tareas bloqueadas.'
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      action: 'Mantener seguimiento continuo',
      detail: 'El proyecto se encuentra dentro de los parámetros de riesgo aceptables.'
    });
  }

  res.json({
    stats: {
      totalOpenRisks: risks.length,
      highSeverity: highSeverityRisks.length,
      mediumSeverity: mediumSeverityRisks.length,
      lowSeverity: lowSeverityRisks.length
    },
    topRisks: risks.slice(0, 5),
    activeEvents: events,
    alerts,
    recommendations,
    projects
  });
}

module.exports = { list, create, update, remove, workload, overview };
