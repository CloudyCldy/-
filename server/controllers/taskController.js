async function list(req, res) {
  const database = req.app.locals.database;
  const own = ['member'].includes(req.session.user.role);
  const query = `SELECT tasks.*, users.name AS assignee_name, users.username AS assignee_username FROM tasks LEFT JOIN users ON users.id = tasks.assigned_to WHERE tasks.organization_id = ? AND ${own ? 'tasks.assigned_to = ?' : '1 = 1'} ORDER BY CASE tasks.status WHEN 'en_proceso' THEN 1 WHEN 'pendiente' THEN 2 ELSE 3 END, tasks.due_date`;
  res.json(await database.prepare(query).all(req.session.user.organization_id, ...(own ? [req.session.user.id] : [])));
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
  const { title, description = '', assigned_to, priority = 'media', start_date, due_date, status = 'pendiente' } = req.body;
  if (!title) return res.status(400).json({ error: 'El título es obligatorio.' });
  const project = await req.app.locals.database.prepare('SELECT id FROM projects WHERE organization_id = ? AND (?::integer IS NULL OR id = ?) ORDER BY id LIMIT 1').get(req.session.user.organization_id, req.body.project_id || null, req.body.project_id || null);
  if (!project) return res.status(400).json({ error: 'El proyecto no existe en tu organización.' });
  const assignee = assigned_to ? await req.app.locals.database.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ? AND active = 1').get(assigned_to, req.session.user.organization_id) : null;
  if (assigned_to && !assignee) return res.status(400).json({ error: 'El responsable no pertenece a tu organización.' });
  const result = await req.app.locals.database.prepare(`INSERT INTO tasks (project_id, organization_id, creator_id, title, description, assigned_to, priority, start_date, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`).run(project.id, req.session.user.organization_id, req.session.user.id, title.trim(), description, assigned_to || null, priority, start_date || null, due_date || null, status);
  res.status(201).json({ id: result.lastInsertRowid });
}
async function update(req, res) {
  const database = req.app.locals.database;
  const id = taskId(req, res);
  if (!id) return;
  const task = await database.prepare('SELECT * FROM tasks WHERE id = ? AND organization_id = ?').get(id, req.session.user.organization_id);
  if (!task) return res.status(404).json({ error: 'La tarea no existe.' });
  if (req.session.user.role === 'member') return res.status(403).json({ error: 'No puedes modificar los datos de la tarea.' });
  const fields = ['title', 'description', 'assigned_to', 'priority', 'start_date', 'due_date', 'status'];
  const values = fields.map(field => req.body[field] === undefined ? task[field] : req.body[field]);
  if (values[2] && !(await database.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ? AND active = 1').get(values[2], req.session.user.organization_id))) return res.status(400).json({ error: 'El responsable no pertenece a tu organización.' });
  await database.prepare(`UPDATE tasks SET title = ?, description = ?, assigned_to = ?, priority = ?, start_date = ?, due_date = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`).run(...values, id, req.session.user.organization_id);
  res.json({ ok: true });
}
async function status(req, res) {
  const database = req.app.locals.database;
  const id = taskId(req, res);
  if (!id) return;
  const task = await database.prepare('SELECT * FROM tasks WHERE id = ? AND organization_id = ?').get(id, req.session.user.organization_id);
  if (!task || (req.session.user.role === 'member' && task.assigned_to !== req.session.user.id)) return res.status(404).json({ error: 'La tarea no existe.' });
  if (!['pendiente', 'en_proceso', 'completada'].includes(req.body.status) || (req.session.user.role === 'member' && req.body.status === 'pendiente')) return res.status(400).json({ error: 'Estado no válido.' });
  await database.prepare('UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP, completed_at = CASE WHEN ? = \'completada\' THEN CURRENT_TIMESTAMP ELSE completed_at END WHERE id = ? AND organization_id = ?').run(req.body.status, req.body.status, id, req.session.user.organization_id);
  res.json({ ok: true });
}
async function remove(req, res) { const id = taskId(req, res); if (!id) return; const result = await req.app.locals.database.prepare('DELETE FROM tasks WHERE id = ? AND organization_id = ?').run(id, req.session.user.organization_id); if (!result.changes) return res.status(404).json({ error: 'La tarea no existe.' }); res.json({ ok: true }); }
module.exports = { list, get, create, update, status, remove };