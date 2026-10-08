const sanzuService = require('../services/sanzuService');

// SB-04: el backlog vive en Sanzu; Haitani lo muestra y lo edita a través de la API de Sanzu.
const TYPES = ['USER_STORY', 'BUG', 'TASK', 'FEATURE', 'IMPROVEMENT'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUSES = ['BACKLOGGED', 'READY', 'IN_PROGRESS', 'DONE'];
const canManage = user => ['admin', 'project_manager'].includes(user.role);

function httpError(status, message) { const error = new Error(message); error.status = status; return error; }

async function loadProject(req) {
  const id = Number(req.query.project_id ?? req.body?.project_id);
  if (!Number.isInteger(id) || id < 1) throw httpError(400, 'Selecciona un proyecto.');
  const project = await req.app.locals.database.prepare('SELECT * FROM projects WHERE id = ? AND organization_id = ?').get(id, req.session.user.organization_id);
  if (!project) throw httpError(404, 'El proyecto no existe.');
  // Proyectos creados antes de la integración: se vinculan con Sanzu la primera vez que se abre su backlog.
  if (!project.sanzu_external_ref) {
    project.sanzu_external_ref = `haitani-proj-${project.id}`;
    await req.app.locals.database.prepare('UPDATE projects SET sanzu_external_ref = ? WHERE id = ? AND organization_id = ?').run(project.sanzu_external_ref, project.id, req.session.user.organization_id);
    await sanzuService.syncProject(project);
  }
  return project;
}

// Si Sanzu aún no conoce el proyecto, lo sincroniza y reintenta una vez.
async function withSync(project, action) {
  try { return await action(); } catch (error) {
    if (error.status !== 404) throw error;
    await sanzuService.syncProject(project);
    return action();
  }
}

// Solo deja pasar los campos que Sanzu acepta, con el tipo correcto.
function cleanItem(body, { partial }) {
  const item = {};
  if (body.title !== undefined) item.title = String(body.title).trim();
  if (body.description !== undefined) item.description = String(body.description);
  if (body.acceptanceCriteria !== undefined) item.acceptanceCriteria = String(body.acceptanceCriteria);
  if (body.type !== undefined) { if (!TYPES.includes(body.type)) throw httpError(400, 'El tipo no es válido.'); item.type = body.type; }
  if (body.priority !== undefined) { if (!PRIORITIES.includes(body.priority)) throw httpError(400, 'La prioridad no es válida.'); item.priority = body.priority; }
  if (body.status !== undefined) { if (!STATUSES.includes(body.status)) throw httpError(400, 'El estado no es válido.'); item.status = body.status; }
  if (body.storyPoints !== undefined && body.storyPoints !== '' && body.storyPoints !== null) {
    const points = Number(body.storyPoints);
    if (!Number.isInteger(points) || points < 0 || points > 100) throw httpError(400, 'Los story points deben ser un número entero entre 0 y 100.');
    item.storyPoints = points;
  }
  if (body.sprintId !== undefined) item.sprintId = body.sprintId ? String(body.sprintId) : null;
  if (!partial && (!item.title || !item.type)) throw httpError(400, 'El título y el tipo son obligatorios.');
  return item;
}

function sendError(res, error) {
  if (error.status && error.status < 500 && !['UNAUTHORIZED'].includes(error.code)) {
    const messages = { CONFLICT: 'Ese cambio de estado no está permitido: el ítem avanza o regresa un paso a la vez.', NOT_FOUND: 'El ítem no existe en este proyecto.' };
    return res.status(error.status === 422 ? 400 : error.status).json({ error: messages[error.code] || error.message });
  }
  console.warn('Backlog de Sanzu no disponible:', error.message);
  return res.status(502).json({ error: `Sanzu no está disponible: ${error.message}` });
}

async function list(req, res) {
  try {
    const project = await loadProject(req);
    const filters = { type: req.query.type, status: req.query.status, priority: req.query.priority, sprintId: req.query.sprint };
    // Los sprints son los de Haitani (vista Sprints); antes de leer el backlog se copian a Sanzu.
    const haitaniSprints = await req.app.locals.database.prepare('SELECT * FROM sprints WHERE project_id = ? AND organization_id = ? ORDER BY start_date ASC').all(project.id, req.session.user.organization_id);
    const sanzuSprints = await withSync(project, () => sanzuService.syncSprints(project, haitaniSprints));
    const items = await sanzuService.listBacklog(project, filters);
    const byRef = new Map(haitaniSprints.map(sprint => [`haitani-sprint-${sprint.id}`, sprint]));
    const sprints = sanzuSprints.filter(sprint => byRef.has(sprint.externalRef)).map(sprint => {
      const local = byRef.get(sprint.externalRef);
      return { id: sprint.id, name: local.name, status: local.status, haitaniId: local.id };
    });
    res.json({ items, sprints, canManage: canManage(req.session.user) });
  } catch (error) { sendError(res, error); }
}

async function create(req, res) {
  try {
    const project = await loadProject(req);
    const item = cleanItem(req.body || {}, { partial: false });
    res.status(201).json(await withSync(project, () => sanzuService.createBacklogItem(project, item)));
  } catch (error) { sendError(res, error); }
}

async function update(req, res) {
  try {
    const project = await loadProject(req);
    let changes = cleanItem(req.body || {}, { partial: true });
    // Los integrantes solo pueden mover el estado; editar el contenido es del admin o del project manager.
    if (!canManage(req.session.user)) {
      if (Object.keys(changes).some(key => key !== 'status')) throw httpError(403, 'Solo el admin o el project manager pueden editar el backlog.');
      changes = { status: changes.status };
    }
    if (!Object.keys(changes).length) throw httpError(400, 'No hay cambios que guardar.');
    res.json(await withSync(project, () => sanzuService.updateBacklogItem(project, req.params.id, changes)));
  } catch (error) { sendError(res, error); }
}

async function remove(req, res) {
  try {
    const project = await loadProject(req);
    await withSync(project, () => sanzuService.deleteBacklogItem(project, req.params.id));
    res.json({ ok: true });
  } catch (error) { sendError(res, error); }
}

module.exports = { list, create, update, remove };