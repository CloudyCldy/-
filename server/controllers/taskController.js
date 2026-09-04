async function list(req, res) {
  const database = req.app.locals.database;
  const own = req.session.user.role === 'member';
  const query = `SELECT tasks.*, users.name AS assignee_name, users.username AS assignee_username FROM tasks LEFT JOIN users ON users.id = tasks.assigned_to WHERE ${own ? 'tasks.assigned_to = ?' : '1 = 1'} ORDER BY CASE tasks.status WHEN 'en_proceso' THEN 1 WHEN 'pendiente' THEN 2 ELSE 3 END, tasks.due_date`;
  res.json(await database.prepare(query).all(...(own ? [req.session.user.id] : [])));
}
async function get(req, res) {
  const task = await req.app.locals.database.prepare(`SELECT tasks.*, users.name AS assignee_name FROM tasks LEFT JOIN users ON users.id = tasks.assigned_to WHERE tasks.id = ?`).get(req.params.id);
  if (!task || (req.session.user.role === 'member' && task.assigned_to !== req.session.user.id)) return res.status(404).json({ error: 'La tarea no existe.' });
  res.json(task);
}
async function create(req, res) {
  const { title, description = '', assigned_to, priority = 'media', start_date, due_date, status = 'pendiente' } = req.body;
  if (!title) return res.status(400).json({ error: 'El título es obligatorio.' });
  const project = await req.app.locals.database.prepare('SELECT id FROM projects WHERE name = ?').get('Sakura Coffee');
  const result = await req.app.locals.database.prepare(`INSERT INTO tasks (project_id, title, description, assigned_to, priority, start_date, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`).run(project.id, title.trim(), description, assigned_to || null, priority, start_date || null, due_date || null, status);
  res.status(201).json({ id: result.lastInsertRowid });
}
async function update(req, res) {
  const database = req.app.locals.database;
  const task = await database.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'La tarea no existe.' });
  if (req.session.user.role === 'member') return res.status(403).json({ error: 'No puedes modificar los datos de la tarea.' });
  const fields = ['title', 'description', 'assigned_to', 'priority', 'start_date', 'due_date', 'status'];
  const values = fields.map(field => req.body[field] === undefined ? task[field] : req.body[field]);
  await database.prepare(`UPDATE tasks SET title = ?, description = ?, assigned_to = ?, priority = ?, start_date = ?, due_date = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values, req.params.id);
  res.json({ ok: true });
}
async function status(req, res) {
  const database = req.app.locals.database;
  const task = await database.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task || (req.session.user.role === 'member' && task.assigned_to !== req.session.user.id)) return res.status(404).json({ error: 'La tarea no existe.' });
  if (!['pendiente', 'en_proceso', 'completada'].includes(req.body.status) || (req.session.user.role === 'member' && req.body.status === 'pendiente')) return res.status(400).json({ error: 'Estado no válido.' });
  await database.prepare('UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.body.status, req.params.id);
  res.json({ ok: true });
}
async function remove(req, res) { const result = await req.app.locals.database.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id); if (!result.changes) return res.status(404).json({ error: 'La tarea no existe.' }); res.json({ ok: true }); }
module.exports = { list, get, create, update, status, remove };