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
  if (req.file) {
    const asset = await database.prepare('INSERT INTO stored_assets (organization_id, uploaded_by, kind, mime_type, content) VALUES (?, ?, ?, ?, ?) RETURNING id').run(req.session.user.organization_id, req.session.user.id, 'task-image', req.file.mimetype, req.file.buffer);
    await database.prepare('UPDATE tasks SET image_asset_id = ? WHERE id = ? AND organization_id = ?').run(asset.lastInsertRowid, result.lastInsertRowid, req.session.user.organization_id);
  }
  await database.prepare('INSERT INTO activities (organization_id, user_id, project_id, action, description) VALUES (?, ?, ?, ?, ?)').run(req.session.user.organization_id, req.session.user.id, project.id, 'task.created', `Tarea creada: ${title.trim()}`);
  res.status(201).json({ id: result.lastInsertRowid });
}
async function importTasks(req, res) {
  const database = req.app.locals.database;
  if (!req.file) return res.status(400).json({ error: 'Archivo requerido.' });
  const ext = req.file.originalname.split('.').pop().toLowerCase();
  let rows = [];
  try {
    if (ext === 'csv') {
      const csv = require('csv-parser');
      const { Readable } = require('stream');
      const stream = Readable.from(req.file.buffer);
      await new Promise((resolve, reject) => {
        stream
          .pipe(csv())
          .on('data', data => rows.push(data))
          .on('end', resolve)
          .on('error', reject);
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const xlsx = require('xlsx');
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const firstSheet = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheet];
      rows = xlsx.utils.sheet_to_json(sheet);
    } else {
      return res.status(400).json({ error: 'Formato de archivo no soportado. Use .csv o .xlsx.' });
    }
  } catch (e) {
    return res.status(500).json({ error: 'Error al procesar el archivo.', details: e.message });
  }

  const results = { created: 0, errors: [] };
  for (const [index, row] of rows.entries()) {
    // Expected keys (case‑insensitive): title, description, assigned_to, priority, start_date, due_date, status, project_id
    const {
      title,
      description = '',
      assigned_to,
      priority = 'media',
      start_date,
      due_date,
      status = 'pendiente',
      project_id
    } = row;
    if (!title || !String(title).trim()) {
      results.errors.push({ row: index + 1, error: 'Título vacío.' });
      continue;
    }
    const projectId = Number(project_id);
    if (!Number.isInteger(projectId) || projectId < 1) {
      results.errors.push({ row: index + 1, error: 'project_id inválido.' });
      continue;
    }
    if (!TASK_PRIORITIES.has(priority)) {
      results.errors.push({ row: index + 1, error: 'Prioridad no válida.' });
      continue;
    }
    if (!TASK_STATUSES.has(status)) {
      results.errors.push({ row: index + 1, error: 'Estado no válido.' });
      continue;
    }
    const project = await database.prepare('SELECT id FROM projects WHERE id = ? AND organization_id = ?').get(projectId, req.session.user.organization_id);
    if (!project) {
      results.errors.push({ row: index + 1, error: 'Proyecto no pertenece a la organización.' });
      continue;
    }
    let assignee = null;
    if (assigned_to) {
      assignee = await database.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ? AND active = 1').get(Number(assigned_to), req.session.user.organization_id);
      if (!assignee) {
        results.errors.push({ row: index + 1, error: 'Responsable no válido.' });
        continue;
      }
    }
    try {
      const result = await database.prepare(`INSERT INTO tasks (project_id, organization_id, creator_id, title, description, assigned_to, priority, start_date, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`).run(
        project.id,
        req.session.user.organization_id,
        req.session.user.id,
        String(title).trim(),
        description,
        assignee ? assignee.id : null,
        priority,
        start_date || null,
        due_date || null,
        status
      );
      await database.prepare('INSERT INTO activities (organization_id, user_id, project_id, action, description) VALUES (?, ?, ?, ?, ?)').run(
        req.session.user.organization_id,
        req.session.user.id,
        project.id,
        'task.created',
        `Tarea importada: ${String(title).trim()}`
      );
      results.created++;
    } catch (e) {
      results.errors.push({ row: index + 1, error: 'Error de base de datos.', details: e.message });
    }
  }
  res.json(results);
}

  const database = req.app.locals.database;
  const id = taskId(req, res);
  if (!id) return;
  const task = await database.prepare('SELECT * FROM tasks WHERE id = ? AND organization_id = ?').get(id, req.session.user.organization_id);
  if (!task) return res.status(404).json({ error: 'La tarea no existe.' });
  if (req.session.user.role === 'member' && task.assigned_to !== req.session.user.id) return res.status(403).json({ error: 'Solo puedes modificar tus tareas.' });
  const fields = ['title', 'description', 'assigned_to', 'priority', 'start_date', 'due_date', 'status'];
  const values = fields.map(field => {
    const value = req.body[field] === undefined ? task[field] : req.body[field];
    return ['assigned_to', 'start_date', 'due_date'].includes(field) && value === '' ? null : value;
  });
  values[0] = String(values[0] || '').trim();
  if (!String(values[0] || '').trim()) return res.status(400).json({ error: 'El título es obligatorio.' });
  if (!TASK_PRIORITIES.has(values[3]) || !TASK_STATUSES.has(values[6])) return res.status(400).json({ error: 'Prioridad o estado no válido.' });
  if ([values[4], values[5]].some(value => value !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(value)))) return res.status(400).json({ error: 'La fecha no es válida.' });
  if (values[2] && !(await database.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ? AND active = 1').get(values[2], req.session.user.organization_id))) return res.status(400).json({ error: 'El responsable no pertenece a tu organización.' });
  await database.prepare(`UPDATE tasks SET title = ?, description = ?, assigned_to = ?, priority = ?, start_date = ?, due_date = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`).run(...values, id, req.session.user.organization_id);
  if (req.file) {
    const asset = await database.prepare('INSERT INTO stored_assets (organization_id, uploaded_by, kind, mime_type, content) VALUES (?, ?, ?, ?, ?) RETURNING id').run(req.session.user.organization_id, req.session.user.id, 'task-image', req.file.mimetype, req.file.buffer);
    await database.prepare('UPDATE tasks SET image_asset_id = ? WHERE id = ? AND organization_id = ?').run(asset.lastInsertRowid, id, req.session.user.organization_id);
  }
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
async function image(req, res) {
  const id = taskId(req, res);
  if (!id) return;
  const asset = await req.app.locals.database.prepare(`SELECT stored_assets.mime_type, stored_assets.content
    FROM tasks JOIN stored_assets ON stored_assets.id = tasks.image_asset_id
    WHERE tasks.id = ? AND tasks.organization_id = ? AND stored_assets.organization_id = ? AND stored_assets.kind = 'task-image'`).get(id, req.session.user.organization_id, req.session.user.organization_id);
  if (!asset) return res.status(404).end();
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  res.setHeader('Content-Type', asset.mime_type);
  res.setHeader('Content-Disposition', 'inline');
  res.send(asset.content);
}
async function remove(req, res) { const id = taskId(req, res); if (!id) return; const database = req.app.locals.database; const task = await database.prepare('SELECT * FROM tasks WHERE id = ? AND organization_id = ?').get(id, req.session.user.organization_id); if (!task) return res.status(404).json({ error: 'La tarea no existe.' }); await database.prepare('DELETE FROM tasks WHERE id = ? AND organization_id = ?').run(id, req.session.user.organization_id); await database.prepare('INSERT INTO activities (organization_id, user_id, project_id, action, description) VALUES (?, ?, ?, ?, ?)').run(req.session.user.organization_id, req.session.user.id, task.project_id, 'task.deleted', `Tarea eliminada: ${task.title}`); res.json({ ok: true }); }
module.exports = { list, get, create, update, status, image, remove, importTasks };