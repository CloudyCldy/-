// SB-04: backlog del producto. Se guarda en la base de Haitani (tabla backlog_items),
// igual que los sprints, y cada ítem se puede asignar a un sprint del mismo proyecto.
const TYPES = ['USER_STORY', 'BUG', 'TASK', 'FEATURE', 'IMPROVEMENT'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const FLOW = ['BACKLOGGED', 'READY', 'IN_PROGRESS', 'DONE'];
const canManage = user => ['admin', 'project_manager'].includes(user.role);

function httpError(status, message) { const error = new Error(message); error.status = status; return error; }

const db = req => req.app.locals.database;
const orgId = req => req.session.user.organization_id;

// La vista usa ids de texto para comparar con los valores de los <select>.
function toItem(row) {
  return {
    id: String(row.id),
    title: row.title,
    description: row.description || '',
    type: row.type,
    priority: row.priority,
    storyPoints: row.story_points ?? null,
    status: row.status,
    acceptanceCriteria: row.acceptance_criteria || '',
    sprintId: row.sprint_id ? String(row.sprint_id) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function loadProject(req) {
  const id = Number(req.query.project_id ?? req.body?.project_id);
  if (!Number.isInteger(id) || id < 1) throw httpError(400, 'Selecciona un proyecto.');
  const project = await db(req).prepare('SELECT id, name FROM projects WHERE id = ? AND organization_id = ?').get(id, orgId(req));
  if (!project) throw httpError(404, 'El proyecto no existe.');
  return project;
}

async function loadItem(req, project) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw httpError(404, 'El ítem no existe en este proyecto.');
  const row = await db(req).prepare('SELECT * FROM backlog_items WHERE id = ? AND project_id = ? AND organization_id = ?').get(id, project.id, orgId(req));
  if (!row) throw httpError(404, 'El ítem no existe en este proyecto.');
  return row;
}

// Solo deja pasar los campos permitidos, con el tipo correcto.
function cleanItem(body, { partial }) {
  const item = {};
  if (body.title !== undefined) {
    item.title = String(body.title).trim();
    if (!item.title) throw httpError(400, 'El título es obligatorio.');
    if (item.title.length > 300) throw httpError(400, 'El título es demasiado largo.');
  }
  if (body.description !== undefined) item.description = String(body.description ?? '');
  if (body.acceptanceCriteria !== undefined) item.acceptanceCriteria = String(body.acceptanceCriteria ?? '');
  if (body.type !== undefined) { if (!TYPES.includes(body.type)) throw httpError(400, 'El tipo no es válido.'); item.type = body.type; }
  if (body.priority !== undefined) { if (!PRIORITIES.includes(body.priority)) throw httpError(400, 'La prioridad no es válida.'); item.priority = body.priority; }
  if (body.status !== undefined) { if (!FLOW.includes(body.status)) throw httpError(400, 'El estado no es válido.'); item.status = body.status; }
  if (body.storyPoints !== undefined) {
    if (body.storyPoints === '' || body.storyPoints === null) item.storyPoints = null;
    else {
      const points = Number(body.storyPoints);
      if (!Number.isInteger(points) || points < 0 || points > 100) throw httpError(400, 'Los story points deben ser un número entero entre 0 y 100.');
      item.storyPoints = points;
    }
  }
  if (body.sprintId !== undefined) {
    if (body.sprintId === '' || body.sprintId === null) item.sprintId = null;
    else {
      const sprintId = Number(body.sprintId);
      if (!Number.isInteger(sprintId) || sprintId < 1) throw httpError(400, 'El sprint no es válido.');
      item.sprintId = sprintId;
    }
  }
  if (!partial && (!item.title || !item.type)) throw httpError(400, 'El título y el tipo son obligatorios.');
  return item;
}

async function assertSprint(req, project, sprintId) {
  if (!sprintId) return;
  const sprint = await db(req).prepare('SELECT id FROM sprints WHERE id = ? AND project_id = ? AND organization_id = ?').get(sprintId, project.id, orgId(req));
  if (!sprint) throw httpError(400, 'El sprint no pertenece a este proyecto.');
}

function sendError(res, error) {
  if (error.status) return res.status(error.status).json({ error: error.message });
  console.error('Error en el backlog:', error);
  return res.status(500).json({ error: 'No fue posible procesar el backlog.' });
}

async function list(req, res) {
  try {
    const project = await loadProject(req);
    const where = ['backlog_items.project_id = ?', 'backlog_items.organization_id = ?'];
    const params = [project.id, orgId(req)];
    if (TYPES.includes(req.query.type)) { where.push('backlog_items.type = ?'); params.push(req.query.type); }
    if (FLOW.includes(req.query.status)) { where.push('backlog_items.status = ?'); params.push(req.query.status); }
    if (PRIORITIES.includes(req.query.priority)) { where.push('backlog_items.priority = ?'); params.push(req.query.priority); }
    if (req.query.sprint === 'none') where.push('backlog_items.sprint_id IS NULL');
    else if (Number.isInteger(Number(req.query.sprint)) && Number(req.query.sprint) > 0) { where.push('backlog_items.sprint_id = ?'); params.push(Number(req.query.sprint)); }

    // Primero lo más urgente; dentro de la misma prioridad, lo más antiguo.
    const rows = await db(req).prepare(`
      SELECT backlog_items.* FROM backlog_items
      WHERE ${where.join(' AND ')}
      ORDER BY CASE backlog_items.priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END, backlog_items.created_at ASC, backlog_items.id ASC
    `).all(...params);
    const sprints = await db(req).prepare('SELECT id, name, status FROM sprints WHERE project_id = ? AND organization_id = ? ORDER BY start_date ASC, id ASC').all(project.id, orgId(req));

    res.json({
      items: rows.map(toItem),
      sprints: sprints.map(sprint => ({ id: String(sprint.id), name: sprint.name, status: sprint.status })),
      canManage: canManage(req.session.user)
    });
  } catch (error) { sendError(res, error); }
}

async function create(req, res) {
  try {
    const project = await loadProject(req);
    const item = cleanItem(req.body || {}, { partial: false });
    await assertSprint(req, project, item.sprintId);
    const row = await db(req).prepare(`
      INSERT INTO backlog_items (organization_id, project_id, sprint_id, title, description, type, priority, story_points, status, acceptance_criteria, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).get(orgId(req), project.id, item.sprintId ?? null, item.title, item.description ?? '', item.type, item.priority ?? 'MEDIUM', item.storyPoints ?? null, item.status ?? 'BACKLOGGED', item.acceptanceCriteria ?? '', req.session.user.id);

    await db(req).prepare('INSERT INTO activities (organization_id, user_id, project_id, action, description) VALUES (?, ?, ?, ?, ?)')
      .run(orgId(req), req.session.user.id, project.id, 'backlog.created', `Ítem agregado al backlog: ${item.title}`)
      .catch(() => {});
    res.status(201).json(toItem(row));
  } catch (error) { sendError(res, error); }
}

const COLUMNS = { title: 'title', description: 'description', acceptanceCriteria: 'acceptance_criteria', type: 'type', priority: 'priority', status: 'status', storyPoints: 'story_points', sprintId: 'sprint_id' };

async function update(req, res) {
  try {
    const project = await loadProject(req);
    const current = await loadItem(req, project);
    let changes = cleanItem(req.body || {}, { partial: true });
    // Los integrantes solo pueden mover el estado; editar el contenido es del admin o del project manager.
    if (!canManage(req.session.user)) {
      if (Object.keys(changes).some(key => key !== 'status')) throw httpError(403, 'Solo el admin o el project manager pueden editar el backlog.');
      changes = { status: changes.status };
    }
    Object.keys(changes).forEach(key => changes[key] === undefined && delete changes[key]);
    if (!Object.keys(changes).length) throw httpError(400, 'No hay cambios que guardar.');

    // El estado avanza o regresa un paso a la vez: Por hacer → Lista → En proceso → Terminada.
    if (changes.status && changes.status !== current.status) {
      const jump = Math.abs(FLOW.indexOf(changes.status) - FLOW.indexOf(current.status));
      if (jump !== 1) throw httpError(409, 'Ese cambio de estado no está permitido: el ítem avanza o regresa un paso a la vez.');
    }
    if (changes.sprintId !== undefined) await assertSprint(req, project, changes.sprintId);

    const keys = Object.keys(changes);
    const row = await db(req).prepare(`
      UPDATE backlog_items SET ${keys.map(key => `${COLUMNS[key]} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
      RETURNING *
    `).get(...keys.map(key => changes[key]), current.id, orgId(req));
    res.json(toItem(row));
  } catch (error) { sendError(res, error); }
}

async function remove(req, res) {
  try {
    const project = await loadProject(req);
    const current = await loadItem(req, project);
    await db(req).prepare('DELETE FROM backlog_items WHERE id = ? AND organization_id = ?').run(current.id, orgId(req));
    res.json({ ok: true });
  } catch (error) { sendError(res, error); }
}

module.exports = { list, create, update, remove };