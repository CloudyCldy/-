const TASK_STATUSES = new Set(['pendiente', 'en_proceso', 'en_revision', 'bloqueada', 'completada']);
const TASK_PRIORITIES = new Set(['baja', 'media', 'alta', 'critica']);

function valueFromQuery(value) {
  return value === undefined || value === '' ? null : String(value);
}

async function list(req, res) {
  const organizationId = req.session.user.organization_id;
  const status = valueFromQuery(req.query.status);
  const priority = valueFromQuery(req.query.priority);
  const assignedTo = valueFromQuery(req.query.assigned_to);
  if (status && !TASK_STATUSES.has(status)) return res.status(400).json({ error: 'Estado no válido.' });
  if (priority && !TASK_PRIORITIES.has(priority)) return res.status(400).json({ error: 'Prioridad no válida.' });
  if (assignedTo && (!Number.isInteger(Number(assignedTo)) || Number(assignedTo) < 1)) return res.status(400).json({ error: 'El responsable no es válido.' });
  const filters = ['tasks.organization_id = ?'];
  const params = [organizationId];
  if (status) { filters.push('tasks.status = ?'); params.push(status); }
  if (priority) { filters.push('tasks.priority = ?'); params.push(priority); }
  if (assignedTo) { filters.push('tasks.assigned_to = ?'); params.push(Number(assignedTo)); }
  if (req.session.user.role === 'member') { filters.push('tasks.assigned_to = ?'); params.push(req.session.user.id); }
  const query = `SELECT tasks.*, users.name AS assignee_name, users.username AS assignee_username FROM tasks LEFT JOIN users ON users.id = tasks.assigned_to WHERE ${filters.join(' AND ')} ORDER BY CASE tasks.status WHEN 'en_proceso' THEN 1 WHEN 'pendiente' THEN 2 ELSE 3 END, tasks.due_date`;
  res.json(await req.app.locals.database.prepare(query).all(...params));
}
function taskId(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: 'El identificador de la tarea no es válido.' });
    return null;
  }
  return id;
}
async function get(req, res) {
  const id = taskId(req, res);
  if (!id) return;
  const task = await req.app.locals.database.prepare(`SELECT tasks.*, users.name AS assignee_name FROM tasks LEFT JOIN users ON users.id = tasks.assigned_to WHERE tasks.id = ? AND tasks.organization_id = ?`).get(id, req.session.user.organization_id);
  if (!task || (req.session.user.role === 'member' && task.assigned_to !== req.session.user.id)) return res.status(404).json({ error: 'La tarea no existe.' });
  res.json(task);
}
async function create(req, res) {
  const database = req.app.locals.database;
  const { title, description = '', assigned_to, priority = 'media', start_date, due_date, status = 'pendiente' } = req.body;
  const projectId = Number(req.body.project_id);
  if (!String(title || '').trim()) return res.status(400).json({ error: 'El título es obligatorio.' });
  if (!Number.isInteger(projectId) || projectId < 1) return res.status(400).json({ error: 'El proyecto es obligatorio.' });
  if (!TASK_PRIORITIES.has(priority)) return res.status(400).json({ error: 'Prioridad no válida.' });
  if (!TASK_STATUSES.has(status)) return res.status(400).json({ error: 'Estado no válido.' });
  const project = await database.prepare('SELECT id FROM projects WHERE id = ? AND organization_id = ?').get(projectId, req.session.user.organization_id);
  if (!project) return res.status(400).json({ error: 'El proyecto no existe en tu organización.' });
  const assignee = assigned_to ? await database.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ? AND active = 1').get(assigned_to, req.session.user.organization_id) : null;
  if (assigned_to && !assignee) return res.status(400).json({ error: 'El responsable no pertenece a tu organización.' });
  const result = await database.prepare(`INSERT INTO tasks (project_id, organization_id, creator_id, title, description, assigned_to, priority, start_date, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`).run(project.id, req.session.user.organization_id, req.session.user.id, title.trim(), description, assigned_to || null, priority, start_date || null, due_date || null, status);
  await database.prepare('INSERT INTO activities (organization_id, user_id, project_id, action, description) VALUES (?, ?, ?, ?, ?)').run(req.session.user.organization_id, req.session.user.id, project.id, 'task.created', `Tarea creada: ${title.trim()}`);
  res.status(201).json({ id: result.lastInsertRowid });
}
async function update(req, res) {
  const database = req.app.locals.database;
  const id = taskId(req, res);
  if (!id) return;
  const task = await database.prepare('SELECT * FROM tasks WHERE id = ? AND organization_id = ?').get(id, req.session.user.organization_id);
  if (!task) return res.status(404).json({ error: 'La tarea no existe.' });
  if (req.session.user.role === 'member' && task.assigned_to !== req.session.user.id) return res.status(403).json({ error: 'Solo puedes modificar tus tareas.' });
  const fields = ['title', 'description', 'assigned_to', 'priority', 'start_date', 'due_date', 'status'];
  const values = fields.map(field => req.body[field] === undefined ? task[field] : req.body[field]);
  if (!String(values[0] || '').trim()) return res.status(400).json({ error: 'El título es obligatorio.' });
  if (!TASK_PRIORITIES.has(values[3]) || !TASK_STATUSES.has(values[6])) return res.status(400).json({ error: 'Prioridad o estado no válido.' });
  if (values[2] && !(await database.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ? AND active = 1').get(values[2], req.session.user.organization_id))) return res.status(400).json({ error: 'El responsable no pertenece a tu organización.' });
  await database.prepare(`UPDATE tasks SET title = ?, description = ?, assigned_to = ?, priority = ?, start_date = ?, due_date = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`).run(...values, id, req.session.user.organization_id);
  await database.prepare('INSERT INTO activities (organization_id, user_id, project_id, action, description) VALUES (?, ?, ?, ?, ?)').run(req.session.user.organization_id, req.session.user.id, task.project_id, 'task.updated', `Tarea actualizada: ${values[0]}`);
  res.json({ ok: true });
}
async function status(req, res) {
  const database = req.app.locals.database;
  const id = taskId(req, res);
  if (!id) return;
  const task = await database.prepare('SELECT * FROM tasks WHERE id = ? AND organization_id = ?').get(id, req.session.user.organization_id);
  if (!task || (req.session.user.role === 'member' && task.assigned_to !== req.session.user.id)) return res.status(404).json({ error: 'La tarea no existe.' });
  if (!TASK_STATUSES.has(req.body.status)) return res.status(400).json({ error: 'Estado no válido.' });
  await database.prepare('UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP, completed_at = CASE WHEN ? = \'completada\' THEN CURRENT_TIMESTAMP ELSE completed_at END WHERE id = ? AND organization_id = ?').run(req.body.status, req.body.status, id, req.session.user.organization_id);
  await database.prepare('INSERT INTO activities (organization_id, user_id, project_id, action, description) VALUES (?, ?, ?, ?, ?)').run(req.session.user.organization_id, req.session.user.id, task.project_id, 'task.status_changed', `Estado de tarea cambiado a: ${req.body.status}`);
  res.json({ ok: true });
}
async function remove(req, res) { const id = taskId(req, res); if (!id) return; const database = req.app.locals.database; const task = await database.prepare('SELECT * FROM tasks WHERE id = ? AND organization_id = ?').get(id, req.session.user.organization_id); if (!task) return res.status(404).json({ error: 'La tarea no existe.' }); await database.prepare('DELETE FROM tasks WHERE id = ? AND organization_id = ?').run(id, req.session.user.organization_id); await database.prepare('INSERT INTO activities (organization_id, user_id, project_id, action, description) VALUES (?, ?, ?, ?, ?)').run(req.session.user.organization_id, req.session.user.id, task.project_id, 'task.deleted', `Tarea eliminada: ${task.title}`); res.json({ ok: true }); }
module.exports = { list, get, create, update, status, remove };