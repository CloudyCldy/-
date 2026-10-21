const ALLOWED_STATUSES = ['pendiente', 'en_progreso', 'completado'];

function normalizeStatus(status) {
  if (!status) return 'pendiente';
  const s = String(status).trim().toLowerCase().replace(/\s+/g, '_');
  return s;
}

function isValidDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

async function listMilestones(database, orgId, projectId = null, status = null) {
  const filters = ['pm.organization_id = ?'];
  const params = [orgId];

  if (projectId) {
    filters.push('pm.project_id = ?');
    params.push(Number(projectId));
  }
  if (status) {
    const norm = normalizeStatus(status);
    filters.push('pm.status = ?');
    params.push(norm);
  }

  const query = `
    SELECT pm.id, pm.organization_id, pm.project_id, pm.title, pm.description,
           pm.due_date, pm.status, pm.created_by, pm.created_at, pm.updated_at,
           p.name AS project_name,
           u.name AS creator_name
    FROM project_milestones pm
    JOIN projects p ON p.id = pm.project_id AND p.organization_id = pm.organization_id
    LEFT JOIN users u ON u.id = pm.created_by
    WHERE ${filters.join(' AND ')}
    ORDER BY pm.due_date ASC, pm.id ASC
  `;

  return database.prepare(query).all(...params);
}

async function getMilestoneById(database, orgId, id) {
  const parsedId = Number(id);
  if (!Number.isInteger(parsedId) || parsedId < 1) return null;

  const query = `
    SELECT pm.id, pm.organization_id, pm.project_id, pm.title, pm.description,
           pm.due_date, pm.status, pm.created_by, pm.created_at, pm.updated_at,
           p.name AS project_name,
           u.name AS creator_name
    FROM project_milestones pm
    JOIN projects p ON p.id = pm.project_id AND p.organization_id = pm.organization_id
    LEFT JOIN users u ON u.id = pm.created_by
    WHERE pm.id = ? AND pm.organization_id = ?
  `;

  return database.prepare(query).get(parsedId, orgId);
}

async function createMilestone(database, orgId, userId, data) {
  const title = String(data.title || '').trim();
  if (!title) {
    const error = new Error('El título del hito es obligatorio.');
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

  const dueDate = String(data.due_date || '').trim();
  if (!isValidDate(dueDate)) {
    const error = new Error('La fecha objetivo no es válida. Usa el formato AAAA-MM-DD.');
    error.status = 400;
    throw error;
  }

  const rawStatus = data.status || 'pendiente';
  const status = normalizeStatus(rawStatus);
  if (!ALLOWED_STATUSES.includes(status)) {
    const error = new Error(`Estado no válido. Opciones permitidas: ${ALLOWED_STATUSES.join(', ')}.`);
    error.status = 400;
    throw error;
  }

  const description = String(data.description || '').trim();

  const result = await database.prepare(`
    INSERT INTO project_milestones (organization_id, project_id, title, description, due_date, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).run(orgId, projectId, title, description, dueDate, status, userId || null);

  const newId = result.lastInsertRowid;

  // Registrar auditoría en activities (RNF17)
  try {
    await database.prepare(`
      INSERT INTO activities (organization_id, user_id, project_id, action, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(orgId, userId || null, projectId, 'milestone.created', `Hito creado: "${title}" (fecha objetivo: ${dueDate})`);
  } catch {}

  return getMilestoneById(database, orgId, newId);
}

async function updateMilestone(database, orgId, userId, id, data) {
  const milestone = await getMilestoneById(database, orgId, id);
  if (!milestone) {
    const error = new Error('El hito no existe.');
    error.status = 404;
    throw error;
  }

  const title = data.title !== undefined ? String(data.title).trim() : milestone.title;
  if (!title) {
    const error = new Error('El título del hito no puede estar vacío.');
    error.status = 400;
    throw error;
  }

  const description = data.description !== undefined ? String(data.description).trim() : milestone.description;

  let dueDate = milestone.due_date;
  if (data.due_date !== undefined) {
    dueDate = String(data.due_date).trim();
    if (!isValidDate(dueDate)) {
      const error = new Error('La fecha objetivo no es válida. Usa el formato AAAA-MM-DD.');
      error.status = 400;
      throw error;
    }
  }

  let status = milestone.status;
  if (data.status !== undefined) {
    status = normalizeStatus(data.status);
    if (!ALLOWED_STATUSES.includes(status)) {
      const error = new Error(`Estado no válido. Opciones permitidas: ${ALLOWED_STATUSES.join(', ')}.`);
      error.status = 400;
      throw error;
    }
  }

  await database.prepare(`
    UPDATE project_milestones
    SET title = ?, description = ?, due_date = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND organization_id = ?
  `).run(title, description, dueDate, status, milestone.id, orgId);

  // Registrar auditoría en activities (RNF17)
  try {
    await database.prepare(`
      INSERT INTO activities (organization_id, user_id, project_id, action, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(orgId, userId || null, milestone.project_id, 'milestone.updated', `Hito actualizado: "${title}" (estado: ${status})`);
  } catch {}

  return getMilestoneById(database, orgId, milestone.id);
}

async function deleteMilestone(database, orgId, userId, id) {
  const milestone = await getMilestoneById(database, orgId, id);
  if (!milestone) {
    const error = new Error('El hito no existe.');
    error.status = 404;
    throw error;
  }

  await database.prepare(
    'DELETE FROM project_milestones WHERE id = ? AND organization_id = ?'
  ).run(milestone.id, orgId);

  // Registrar auditoría en activities (RNF17)
  try {
    await database.prepare(`
      INSERT INTO activities (organization_id, user_id, project_id, action, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(orgId, userId || null, milestone.project_id, 'milestone.deleted', `Hito eliminado: "${milestone.title}"`);
  } catch {}

  return { ok: true, id: milestone.id };
}

module.exports = {
  ALLOWED_STATUSES,
  normalizeStatus,
  isValidDate,
  listMilestones,
  getMilestoneById,
  createMilestone,
  updateMilestone,
  deleteMilestone
};
