const { detectAndSyncEvents } = require('./eventService');

const PROBABILITY_WEIGHTS = {
  '1': 1, 'muy_baja': 1, 'muy baja': 1,
  '2': 2, 'baja': 2,
  '3': 3, 'media': 3, 'moderada': 3,
  '4': 4, 'alta': 4,
  '5': 5, 'muy_alta': 5, 'muy alta': 5
};

const IMPACT_WEIGHTS = {
  '1': 1, 'muy_bajo': 1, 'muy_baja': 1, 'muy bajo': 1, 'muy baja': 1, 'insignificante': 1,
  '2': 2, 'bajo': 2, 'baja': 2, 'menor': 2,
  '3': 3, 'medio': 3, 'media': 3, 'moderado': 3, 'moderada': 3,
  '4': 4, 'alto': 4, 'alta': 4, 'mayor': 4,
  '5': 5, 'muy_alto': 5, 'muy_alta': 5, 'critico': 5, 'critica': 5
};

const ALLOWED_STATUSES = ['open', 'mitigated', 'accepted', 'closed'];

function parseWeight(val, weightMap, defaultVal = 3) {
  if (val === null || val === undefined) return defaultVal;
  const key = String(val).trim().toLowerCase();
  if (weightMap[key] !== undefined) return weightMap[key];
  const num = Number(key);
  if (Number.isInteger(num) && num >= 1 && num <= 5) return num;
  return defaultVal;
}

/**
 * Calcula automáticamente la severidad y el score a partir de probabilidad e impacto.
 * El cliente NUNCA envía este valor; siempre se calcula en el backend.
 */
function calculateSeverity(probability, impact) {
  const p = parseWeight(probability, PROBABILITY_WEIGHTS, 3);
  const i = parseWeight(impact, IMPACT_WEIGHTS, 3);
  const product = p * i; // Escala 1 a 25
  const score = Math.min(100, Math.round((product / 25) * 100)); // Escala 0 a 100

  let level = 'baja';
  if (score >= 65 || product >= 15) {
    level = 'critica';
  } else if (score >= 45 || product >= 10) {
    level = 'alta';
  } else if (score >= 25 || product >= 5) {
    level = 'media';
  }

  return {
    probabilityWeight: p,
    impactWeight: i,
    product,
    score,
    level
  };
}

function normalizeStatus(status) {
  if (!status) return 'open';
  const s = String(status).trim().toLowerCase();
  // Compatibilidad con términos en español si el frontend envía 'mitigando' o 'cerrado'
  if (s === 'identificado' || s === 'abierto') return 'open';
  if (s === 'mitigando' || s === 'mitigado') return 'mitigated';
  if (s === 'aceptado') return 'accepted';
  if (s === 'cerrado') return 'closed';
  return s;
}

async function listRisks(database, orgId, projectId = null, status = null) {
  const filters = ['project_risks.organization_id = ?'];
  const params = [orgId];

  if (projectId) {
    filters.push('project_risks.project_id = ?');
    params.push(Number(projectId));
  }
  if (status) {
    filters.push('project_risks.status = ?');
    params.push(normalizeStatus(status));
  }

  const query = `
    SELECT project_risks.id, project_risks.organization_id, project_risks.project_id,
           project_risks.title, project_risks.description, project_risks.probability,
           project_risks.impact, project_risks.status, project_risks.mitigation,
           project_risks.severity_score, project_risks.assigned_to, project_risks.created_by,
           project_risks.created_at, project_risks.updated_at,
           projects.name AS project_name,
           u_creator.name AS creator_name,
           u_assigned.name AS assigned_name,
           u_assigned.email AS assigned_email
    FROM project_risks
    JOIN projects ON projects.id = project_risks.project_id AND projects.organization_id = project_risks.organization_id
    LEFT JOIN users u_creator ON u_creator.id = project_risks.created_by
    LEFT JOIN users u_assigned ON u_assigned.id = project_risks.assigned_to
    WHERE ${filters.join(' AND ')}
    ORDER BY project_risks.severity_score DESC, project_risks.created_at DESC
  `;

  const rows = await database.prepare(query).all(...params);
  return rows.map(r => {
    const sev = calculateSeverity(r.probability, r.impact);
    return {
      ...r,
      severity: sev.level,
      severity_score: sev.score
    };
  });
}

async function getRiskById(database, orgId, id) {
  const parsedId = Number(id);
  if (!Number.isInteger(parsedId) || parsedId < 1) return null;

  const query = `
    SELECT project_risks.id, project_risks.organization_id, project_risks.project_id,
           project_risks.title, project_risks.description, project_risks.probability,
           project_risks.impact, project_risks.status, project_risks.mitigation,
           project_risks.severity_score, project_risks.assigned_to, project_risks.created_by,
           project_risks.created_at, project_risks.updated_at,
           projects.name AS project_name,
           u_creator.name AS creator_name,
           u_assigned.name AS assigned_name,
           u_assigned.email AS assigned_email
    FROM project_risks
    JOIN projects ON projects.id = project_risks.project_id AND projects.organization_id = project_risks.organization_id
    LEFT JOIN users u_creator ON u_creator.id = project_risks.created_by
    LEFT JOIN users u_assigned ON u_assigned.id = project_risks.assigned_to
    WHERE project_risks.id = ? AND project_risks.organization_id = ?
  `;

  const row = await database.prepare(query).get(parsedId, orgId);
  if (!row) return null;

  const sev = calculateSeverity(row.probability, row.impact);
  return {
    ...row,
    severity: sev.level,
    severity_score: sev.score
  };
}

async function createRisk(database, orgId, userId, data) {
  const title = String(data.title || '').trim();
  if (!title) {
    const error = new Error('El título del riesgo es obligatorio.');
    error.status = 400;
    throw error;
  }

  const projectId = Number(data.project_id);
  if (!Number.isInteger(projectId) || projectId < 1) {
    const error = new Error('El ID de proyecto no es válido.');
    error.status = 400;
    throw error;
  }

  const project = await database.prepare(
    'SELECT id, name FROM projects WHERE id = ? AND organization_id = ?'
  ).get(projectId, orgId);

  if (!project) {
    const error = new Error('El proyecto no existe en tu organización.');
    error.status = 404;
    throw error;
  }

  // Validación de responsable si se suministra
  let assignedTo = data.assigned_to !== undefined ? data.assigned_to : data.responsible_id;
  if (assignedTo !== null && assignedTo !== undefined && String(assignedTo).trim() !== '') {
    assignedTo = Number(assignedTo);
    if (!Number.isInteger(assignedTo) || assignedTo < 1) {
      const error = new Error('El responsable asignado no es válido.');
      error.status = 400;
      throw error;
    }
    const user = await database.prepare(
      'SELECT id FROM users WHERE id = ? AND organization_id = ? AND active = 1'
    ).get(assignedTo, orgId);
    if (!user) {
      const error = new Error('El responsable indicado no pertenece a la organización.');
      error.status = 404;
      throw error;
    }
  } else {
    assignedTo = null;
  }

  const rawProbability = data.probability !== undefined ? data.probability : 'media';
  const rawImpact = data.impact !== undefined ? data.impact : 'media';
  const rawStatus = data.status || 'open';
  const status = normalizeStatus(rawStatus);

  if (!ALLOWED_STATUSES.includes(status)) {
    const error = new Error(`Estado no válido. Opciones permitidas: ${ALLOWED_STATUSES.join(', ')}.`);
    error.status = 400;
    throw error;
  }

  // CÁLCULO ESTRICTO DE SEVERIDAD EN EL BACKEND:
  // Se ignora cualquier valor enviado por el cliente en req.body.severity o req.body.severity_score
  const calculated = calculateSeverity(rawProbability, rawImpact);
  const severityScore = calculated.score;
  const description = String(data.description || '').trim();
  const mitigation = String(data.mitigation || data.mitigation_plan || '').trim();

  // Guardamos la probabilidad e impacto como texto normalizado
  const normProb = String(rawProbability).trim().toLowerCase();
  const normImpact = String(rawImpact).trim().toLowerCase();

  const result = await database.prepare(`
    INSERT INTO project_risks (
      organization_id, project_id, title, description, probability, impact,
      mitigation, severity_score, assigned_to, created_by, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).run(
    orgId, projectId, title, description, normProb, normImpact,
    mitigation, severityScore, assignedTo, userId || null, status
  );

  const newId = result.lastInsertRowid;

  // Registrar auditoría en activities (RNF17)
  try {
    await database.prepare(`
      INSERT INTO activities (organization_id, user_id, project_id, action, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      orgId, userId || null, projectId, 'risk.created',
      `Riesgo registrado: "${title}" (Severidad calculada: ${calculated.level}, Score: ${severityScore})`
    );
  } catch {}

  // Sincronizar eventos si tiene impacto alto
  await detectAndSyncEvents(database, orgId, projectId).catch(() => {});

  return getRiskById(database, orgId, newId);
}

async function updateRisk(database, orgId, userId, id, data) {
  const existing = await getRiskById(database, orgId, id);
  if (!existing) {
    const error = new Error('El riesgo no existe.');
    error.status = 404;
    throw error;
  }

  const title = data.title !== undefined ? String(data.title).trim() : existing.title;
  if (!title) {
    const error = new Error('El título del riesgo no puede estar vacío.');
    error.status = 400;
    throw error;
  }

  const description = data.description !== undefined ? String(data.description).trim() : existing.description;
  const mitigation = (data.mitigation !== undefined || data.mitigation_plan !== undefined)
    ? String(data.mitigation !== undefined ? data.mitigation : data.mitigation_plan).trim()
    : existing.mitigation;

  let assignedTo = existing.assigned_to;
  if (data.assigned_to !== undefined || data.responsible_id !== undefined) {
    const rawAssigned = data.assigned_to !== undefined ? data.assigned_to : data.responsible_id;
    if (rawAssigned === null || String(rawAssigned).trim() === '') {
      assignedTo = null;
    } else {
      const parsedAssigned = Number(rawAssigned);
      if (!Number.isInteger(parsedAssigned) || parsedAssigned < 1) {
        const error = new Error('El responsable asignado no es válido.');
        error.status = 400;
        throw error;
      }
      const user = await database.prepare(
        'SELECT id FROM users WHERE id = ? AND organization_id = ? AND active = 1'
      ).get(parsedAssigned, orgId);
      if (!user) {
        const error = new Error('El responsable indicado no pertenece a la organización.');
        error.status = 404;
        throw error;
      }
      assignedTo = parsedAssigned;
    }
  }

  let status = existing.status;
  if (data.status !== undefined) {
    status = normalizeStatus(data.status);
    if (!ALLOWED_STATUSES.includes(status)) {
      const error = new Error(`Estado no válido. Opciones permitidas: ${ALLOWED_STATUSES.join(', ')}.`);
      error.status = 400;
      throw error;
    }
  }

  const probability = data.probability !== undefined ? String(data.probability).trim().toLowerCase() : existing.probability;
  const impact = data.impact !== undefined ? String(data.impact).trim().toLowerCase() : existing.impact;

  // CÁLCULO ESTRICTO DE SEVERIDAD EN EL BACKEND:
  // Se ignora cualquier valor enviado por el cliente en req.body.severity o req.body.severity_score
  const calculated = calculateSeverity(probability, impact);
  const severityScore = calculated.score;

  await database.prepare(`
    UPDATE project_risks
    SET title = ?, description = ?, probability = ?, impact = ?, status = ?,
        mitigation = ?, severity_score = ?, assigned_to = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND organization_id = ?
  `).run(
    title, description, probability, impact, status,
    mitigation, severityScore, assignedTo, existing.id, orgId
  );

  // Registrar auditoría en activities (RNF17)
  try {
    await database.prepare(`
      INSERT INTO activities (organization_id, user_id, project_id, action, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      orgId, userId || null, existing.project_id, 'risk.updated',
      `Riesgo actualizado: "${title}" (Estado: ${status}, Severidad calculada: ${calculated.level})`
    );
  } catch {}

  return getRiskById(database, orgId, existing.id);
}

async function deleteRisk(database, orgId, userId, id) {
  const existing = await getRiskById(database, orgId, id);
  if (!existing) {
    const error = new Error('El riesgo no existe.');
    error.status = 404;
    throw error;
  }

  await database.prepare(
    'DELETE FROM project_risks WHERE id = ? AND organization_id = ?'
  ).run(existing.id, orgId);

  // Registrar auditoría en activities (RNF17)
  try {
    await database.prepare(`
      INSERT INTO activities (organization_id, user_id, project_id, action, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      orgId, userId || null, existing.project_id, 'risk.deleted',
      `Riesgo eliminado: "${existing.title}"`
    );
  } catch {}

  return { ok: true, id: existing.id };
}

async function getWorkload(database, orgId, projectId = null) {
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

  return members.map(m => {
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
}

async function getOverview(database, orgId) {
  await detectAndSyncEvents(database, orgId).catch(() => {});

  const [risks, events, projects] = await Promise.all([
    listRisks(database, orgId, null, 'open'),
    database.prepare(`SELECT * FROM project_events WHERE organization_id = ? AND resolved = false ORDER BY created_at DESC LIMIT 15`).all(orgId),
    database.prepare(`SELECT id, name, status, progress FROM projects WHERE organization_id = ?`).all(orgId)
  ]);

  const highSeverityRisks = risks.filter(r => r.severity_score >= 65);
  const mediumSeverityRisks = risks.filter(r => r.severity_score >= 40 && r.severity_score < 65);
  const lowSeverityRisks = risks.filter(r => r.severity_score < 40);

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

  return {
    stats: {
      totalOpenRisks: risks.length,
      highSeverity: highSeverityRisks.length,
      mediumSeverity: mediumSeverityRisks.length,
      lowSeverity: lowSeverityRisks.length
    },
    topRisks: risks.slice(0, 5),
    risks,
    activeEvents: events,
    events,
    alerts,
    recommendations,
    projects
  };
}

module.exports = {
  PROBABILITY_WEIGHTS,
  IMPACT_WEIGHTS,
  ALLOWED_STATUSES,
  calculateSeverity,
  normalizeStatus,
  listRisks,
  getRiskById,
  createRisk,
  updateRisk,
  deleteRisk,
  getWorkload,
  getOverview
};
