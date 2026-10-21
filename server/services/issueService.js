const ALLOWED_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const ALLOWED_PRIORITIES = ['low', 'medium', 'high', 'critical'];

function normalizePriority(val) {
  if (!val) return 'medium';
  const s = String(val).trim().toLowerCase();
  if (s === 'baja') return 'low';
  if (s === 'media' || s === 'moderada') return 'medium';
  if (s === 'alta') return 'high';
  if (s === 'critica' || s === 'crítica') return 'critical';
  return s;
}

function normalizeStatus(val) {
  if (!val) return 'open';
  const s = String(val).trim().toLowerCase().replace(/\s+/g, '_');
  if (s === 'abierta' || s === 'abierto') return 'open';
  if (s === 'en_proceso' || s === 'en_progreso') return 'in_progress';
  if (s === 'resuelta' || s === 'resuelto') return 'resolved';
  if (s === 'cerrada' || s === 'cerrado') return 'closed';
  return s;
}

async function listIssues(database, orgId, filters = {}) {
  const where = ['pi.organization_id = ?'];
  const params = [orgId];

  if (filters.projectId) {
    where.push('pi.project_id = ?');
    params.push(Number(filters.projectId));
  }
  if (filters.status) {
    where.push('pi.status = ?');
    params.push(normalizeStatus(filters.status));
  }
  if (filters.priority) {
    where.push('pi.priority = ?');
    params.push(normalizePriority(filters.priority));
  }
  if (filters.assignedTo) {
    where.push('pi.assigned_to = ?');
    params.push(Number(filters.assignedTo));
  }

  const query = `
    SELECT pi.id, pi.organization_id, pi.project_id, pi.title, pi.description,
           pi.priority, pi.status, pi.reported_by, pi.assigned_to,
           pi.created_at, pi.updated_at,
           p.name AS project_name,
           u_rep.name AS reporter_name,
           u_rep.email AS reporter_email,
           u_ass.name AS assigned_name,
           u_ass.email AS assigned_email
    FROM project_issues pi
    JOIN projects p ON p.id = pi.project_id AND p.organization_id = pi.organization_id
    LEFT JOIN users u_rep ON u_rep.id = pi.reported_by
    LEFT JOIN users u_ass ON u_ass.id = pi.assigned_to
    WHERE ${where.join(' AND ')}
    ORDER BY pi.created_at DESC, pi.id DESC
  `;

  return database.prepare(query).all(...params);
}

async function getIssueById(database, orgId, id) {
  const parsedId = Number(id);
  if (!Number.isInteger(parsedId) || parsedId < 1) return null;

  const query = `
    SELECT pi.id, pi.organization_id, pi.project_id, pi.title, pi.description,
           pi.priority, pi.status, pi.reported_by, pi.assigned_to,
           pi.created_at, pi.updated_at,
           p.name AS project_name,
           u_rep.name AS reporter_name,
           u_rep.email AS reporter_email,
           u_ass.name AS assigned_name,
           u_ass.email AS assigned_email
    FROM project_issues pi
    JOIN projects p ON p.id = pi.project_id AND p.organization_id = pi.organization_id
    LEFT JOIN users u_rep ON u_rep.id = pi.reported_by
    LEFT JOIN users u_ass ON u_ass.id = pi.assigned_to
    WHERE pi.id = ? AND pi.organization_id = ?
  `;

  return database.prepare(query).get(parsedId, orgId);
}

async function createIssue(database, orgId, userId, data) {
  const title = String(data.title || '').trim();
  if (!title) {
    const error = new Error('El título de la incidencia es obligatorio.');
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

  const priority = normalizePriority(data.priority);
  if (!ALLOWED_PRIORITIES.includes(priority)) {
    const error = new Error(`Prioridad no válida. Opciones permitidas: ${ALLOWED_PRIORITIES.join(', ')}.`);
    error.status = 400;
    throw error;
  }

  const status = normalizeStatus(data.status);
  if (!ALLOWED_STATUSES.includes(status)) {
    const error = new Error(`Estado no válido. Opciones permitidas: ${ALLOWED_STATUSES.join(', ')}.`);
    error.status = 400;
    throw error;
  }

  let assignedTo = data.assigned_to !== undefined ? data.assigned_to : null;
  if (assignedTo !== null && String(assignedTo).trim() !== '') {
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

  const description = String(data.description || '').trim();

  const result = await database.prepare(`
    INSERT INTO project_issues (
      organization_id, project_id, title, description, priority, status, reported_by, assigned_to
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).run(orgId, projectId, title, description, priority, status, userId || null, assignedTo);

  const newId = result.lastInsertRowid;

  // Auditoría en activities (RNF17)
  try {
    await database.prepare(`
      INSERT INTO activities (organization_id, user_id, project_id, action, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      orgId, userId || null, projectId, 'issue.created',
      `Incidencia registrada: "${title}" (prioridad: ${priority}, estado: ${status})`
    );
  } catch {}

  return getIssueById(database, orgId, newId);
}

async function updateIssue(database, orgId, userId, id, data) {
  const existing = await getIssueById(database, orgId, id);
  if (!existing) {
    const error = new Error('La incidencia no existe.');
    error.status = 404;
    throw error;
  }

  const title = data.title !== undefined ? String(data.title).trim() : existing.title;
  if (!title) {
    const error = new Error('El título de la incidencia no puede estar vacío.');
    error.status = 400;
    throw error;
  }

  const description = data.description !== undefined ? String(data.description).trim() : existing.description;

  let priority = existing.priority;
  if (data.priority !== undefined) {
    priority = normalizePriority(data.priority);
    if (!ALLOWED_PRIORITIES.includes(priority)) {
      const error = new Error(`Prioridad no válida. Opciones permitidas: ${ALLOWED_PRIORITIES.join(', ')}.`);
      error.status = 400;
      throw error;
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

  let assignedTo = existing.assigned_to;
  if (data.assigned_to !== undefined) {
    if (data.assigned_to === null || String(data.assigned_to).trim() === '') {
      assignedTo = null;
    } else {
      const parsedAssigned = Number(data.assigned_to);
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

  await database.prepare(`
    UPDATE project_issues
    SET title = ?, description = ?, priority = ?, status = ?, assigned_to = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND organization_id = ?
  `).run(title, description, priority, status, assignedTo, existing.id, orgId);

  // Auditoría en activities (RNF17)
  try {
    await database.prepare(`
      INSERT INTO activities (organization_id, user_id, project_id, action, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      orgId, userId || null, existing.project_id, 'issue.updated',
      `Incidencia actualizada: "${title}" (estado: ${status}, prioridad: ${priority})`
    );
  } catch {}

  return getIssueById(database, orgId, existing.id);
}

async function deleteIssue(database, orgId, userId, id) {
  const existing = await getIssueById(database, orgId, id);
  if (!existing) {
    const error = new Error('La incidencia no existe.');
    error.status = 404;
    throw error;
  }

  await database.prepare(
    'DELETE FROM project_issues WHERE id = ? AND organization_id = ?'
  ).run(existing.id, orgId);

  // Auditoría en activities (RNF17)
  try {
    await database.prepare(`
      INSERT INTO activities (organization_id, user_id, project_id, action, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      orgId, userId || null, existing.project_id, 'issue.deleted',
      `Incidencia eliminada: "${existing.title}"`
    );
  } catch {}

  return { ok: true, id: existing.id };
}

module.exports = {
  ALLOWED_STATUSES,
  ALLOWED_PRIORITIES,
  normalizePriority,
  normalizeStatus,
  listIssues,
  getIssueById,
  createIssue,
  updateIssue,
  deleteIssue
};
