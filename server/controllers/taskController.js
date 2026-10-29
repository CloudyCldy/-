const pdfService = require('../services/pdfService');
const TASK_STATUSES = new Set(['pendiente', 'en_proceso', 'en_revision', 'bloqueada', 'completada']);
// Orden del flujo de una tarea. Un integrante solo puede avanzarla; regresarla a un estado
// anterior queda reservado para administradores y project managers.
const TASK_STATUS_ORDER = { pendiente: 0, en_proceso: 1, bloqueada: 1, en_revision: 2, completada: 3 };
const canMoveTaskBack = role => role === 'admin' || role === 'project_manager';
function isBackwardMove(from, to) {
  return (TASK_STATUS_ORDER[to] ?? 0) < (TASK_STATUS_ORDER[from] ?? 0);
}
const TASK_PRIORITIES = new Set(['baja', 'media', 'alta', 'critica']);

function valueFromQuery(value) {
  return value === undefined || value === '' ? null : String(value);
}

async function list(req, res) {
  const organizationId = req.session.user.organization_id;
  const status = valueFromQuery(req.query.status);
  const priority = valueFromQuery(req.query.priority);
  const assignedTo = valueFromQuery(req.query.assigned_to);
  const projectId = valueFromQuery(req.query.project_id);
  const sprintId = valueFromQuery(req.query.sprint_id);
  if (status && !TASK_STATUSES.has(status)) return res.status(400).json({ error: 'Estado no válido.' });
  if (priority && !TASK_PRIORITIES.has(priority)) return res.status(400).json({ error: 'Prioridad no válida.' });
  if (assignedTo && (!Number.isInteger(Number(assignedTo)) || Number(assignedTo) < 1)) return res.status(400).json({ error: 'El responsable no es válido.' });
  const filters = ['tasks.organization_id = ?'];
  const params = [organizationId];
  if (status) { filters.push('tasks.status = ?'); params.push(status); }
  if (priority) { filters.push('tasks.priority = ?'); params.push(priority); }
  if (assignedTo) { filters.push('tasks.assigned_to = ?'); params.push(Number(assignedTo)); }
  if (projectId) { filters.push('tasks.project_id = ?'); params.push(Number(projectId)); }
  if (sprintId) { filters.push('tasks.sprint_id = ?'); params.push(Number(sprintId)); }
  if (req.session.user.role === 'member') { filters.push('tasks.assigned_to = ?'); params.push(req.session.user.id); }
  const query = `
    SELECT tasks.*, users.name AS assignee_name, users.username AS assignee_username, sprints.name AS sprint_name
    FROM tasks
    LEFT JOIN users ON users.id = tasks.assigned_to
    LEFT JOIN sprints ON sprints.id = tasks.sprint_id AND sprints.organization_id = tasks.organization_id
    WHERE ${filters.join(' AND ')}
    ORDER BY CASE tasks.status WHEN 'en_proceso' THEN 1 WHEN 'pendiente' THEN 2 ELSE 3 END, tasks.due_date`;
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
  const task = await req.app.locals.database.prepare(`
    SELECT tasks.*, users.name AS assignee_name, sprints.name AS sprint_name
    FROM tasks
    LEFT JOIN users ON users.id = tasks.assigned_to
    LEFT JOIN sprints ON sprints.id = tasks.sprint_id AND sprints.organization_id = tasks.organization_id
    WHERE tasks.id = ? AND tasks.organization_id = ?
  `).get(id, req.session.user.organization_id);
  if (!task || (req.session.user.role === 'member' && task.assigned_to !== req.session.user.id)) return res.status(404).json({ error: 'La tarea no existe.' });
  res.json(task);
}

async function listByProject(req, res) {
  const projectId = Number(req.params.id);
  if (!Number.isInteger(projectId) || projectId < 1) {
    return res.status(400).json({ error: 'El identificador del proyecto no es válido.' });
  }
  const organizationId = req.session.user.organization_id;
  const database = req.app.locals.database;
  const project = await database.prepare('SELECT id FROM projects WHERE id = ? AND organization_id = ?').get(projectId, organizationId);
  if (!project) return res.status(404).json({ error: 'El proyecto no existe en tu organización.' });

  const filters = ['tasks.organization_id = ?', 'tasks.project_id = ?'];
  const params = [organizationId, projectId];
  if (req.session.user.role === 'member') {
    filters.push('tasks.assigned_to = ?');
    params.push(req.session.user.id);
  }
  const query = `
    SELECT tasks.*, users.name AS assignee_name, users.username AS assignee_username, sprints.name AS sprint_name
    FROM tasks
    LEFT JOIN users ON users.id = tasks.assigned_to
    LEFT JOIN sprints ON sprints.id = tasks.sprint_id AND sprints.organization_id = tasks.organization_id
    WHERE ${filters.join(' AND ')}
    ORDER BY CASE tasks.status WHEN 'en_proceso' THEN 1 WHEN 'pendiente' THEN 2 ELSE 3 END, tasks.due_date`;
  res.json(await database.prepare(query).all(...params));
}

async function create(req, res) {
  const database = req.app.locals.database;
  const { title, description = '', assigned_to, priority = 'media', start_date, due_date, status = 'pendiente' } = req.body;
  const projectId = Number(req.params.id || req.body.project_id);
  if (!String(title || '').trim()) return res.status(400).json({ error: 'El título es obligatorio.' });
  if (!Number.isInteger(projectId) || projectId < 1) return res.status(400).json({ error: 'El proyecto es obligatorio.' });
  if (!TASK_PRIORITIES.has(priority)) return res.status(400).json({ error: 'Prioridad no válida.' });
  if (!TASK_STATUSES.has(status)) return res.status(400).json({ error: 'Estado no válido.' });
  const project = await database.prepare('SELECT id, manager_id FROM projects WHERE id = ? AND organization_id = ?').get(projectId, req.session.user.organization_id);
  if (!project) return res.status(404).json({ error: 'El proyecto no existe en tu organización.' });

  if (req.session.user.role !== 'admin') {
    const isMember = await database.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ? AND organization_id = ?').get(projectId, req.session.user.id, req.session.user.organization_id);
    const isManager = project.manager_id === req.session.user.id;
    if (!isMember && !isManager) {
      return res.status(403).json({ error: 'No tienes permiso para crear tareas en este proyecto.' });
    }
  }

  let sprintId = req.body.sprint_id !== undefined && req.body.sprint_id !== '' && req.body.sprint_id !== null ? Number(req.body.sprint_id) : null;
  if (sprintId !== null) {
    if (!Number.isInteger(sprintId) || sprintId < 1) {
      return res.status(400).json({ error: 'El identificador del sprint no es válido.' });
    }
    const sprint = await database.prepare('SELECT id, project_id FROM sprints WHERE id = ? AND organization_id = ?').get(sprintId, req.session.user.organization_id);
    if (!sprint || sprint.project_id !== projectId) {
      return res.status(400).json({ error: 'El sprint no pertenece al mismo proyecto u organización.' });
    }
  }

  let parentId = req.body.parent_id !== undefined && req.body.parent_id !== '' && req.body.parent_id !== null ? Number(req.body.parent_id) : null;
  if (parentId !== null) {
    if (!Number.isInteger(parentId) || parentId < 1) {
      return res.status(400).json({ error: 'La tarea padre no es válida.' });
    }
    const parentTask = await database.prepare('SELECT id, project_id FROM tasks WHERE id = ? AND organization_id = ?').get(parentId, req.session.user.organization_id);
    if (!parentTask || parentTask.project_id !== project.id) {
      return res.status(400).json({ error: 'La tarea padre debe pertenecer al mismo proyecto.' });
    }
  }

  const isMilestone = Boolean(req.body.is_milestone === true || req.body.is_milestone === 'true' || req.body.is_milestone === 1 || req.body.is_milestone === '1');
  const progressVal = Number.isInteger(Number(req.body.progress)) ? Math.max(0, Math.min(100, Number(req.body.progress))) : (status === 'completada' ? 100 : (status === 'en_proceso' ? 50 : 0));
  const color = req.body.color ? String(req.body.color).slice(0, 32) : null;

  const assignee = assigned_to ? await database.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ? AND active = 1').get(assigned_to, req.session.user.organization_id) : null;
  if (assigned_to && !assignee) return res.status(400).json({ error: 'El responsable no pertenece a tu organización.' });
  const result = await database.prepare(`INSERT INTO tasks (project_id, organization_id, creator_id, title, description, assigned_to, priority, start_date, due_date, status, sprint_id, parent_id, is_milestone, progress, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`).run(project.id, req.session.user.organization_id, req.session.user.id, title.trim(), description, assigned_to || null, priority, start_date || null, due_date || null, status, sprintId, parentId, isMilestone, progressVal, color);
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
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer', cellDates: true });
      const firstSheet = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheet];
      rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    } else {
      return res.status(400).json({ error: 'Formato de archivo no soportado. Use .csv o .xlsx.' });
    }
  } catch (e) {
    return res.status(500).json({ error: 'Error al procesar el archivo.', details: e.message });
  }

  if (!rows.length) return res.status(400).json({ error: 'El archivo no contiene filas de datos.' });
  const results = { created: 0, errors: [] };
  for (const [index, row] of rows.entries()) {
    const fields = Object.fromEntries(Object.entries(row).map(([key, value]) => [
      String(key).replace(/^\uFEFF/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[\s-]+/g, '_'),
      value
    ]));
    const title = fields.title ?? fields.titulo;
    const description = fields.description ?? fields.descripcion ?? '';
    const assignedTo = fields.assigned_to ?? fields.responsable_id ?? fields.responsable ?? fields.assignee;
    const priority = String(fields.priority ?? fields.prioridad ?? 'media').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    const status = String(fields.status ?? fields.estado ?? 'pendiente').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, '_');
    const projectId = Number(fields.project_id || req.body.project_id);
    const startDate = fields.start_date ?? fields.fecha_inicio ?? '';
    const dueDate = fields.due_date ?? fields.fecha_entrega ?? '';
    const formatDate = value => value instanceof Date ? value.toISOString().slice(0, 10) : (String(value || '').trim() || null);
    const normalizedStartDate = formatDate(startDate);
    const normalizedDueDate = formatDate(dueDate);
    if (!title || !String(title).trim()) {
      results.errors.push({ row: index + 2, error: 'Título vacío.' });
      continue;
    }
    if (!Number.isInteger(projectId) || projectId < 1) {
      results.errors.push({ row: index + 2, error: 'Proyecto no válido.' });
      continue;
    }
    if (!TASK_PRIORITIES.has(priority)) {
      results.errors.push({ row: index + 2, error: 'Prioridad no válida.' });
      continue;
    }
    if (!TASK_STATUSES.has(status)) {
      results.errors.push({ row: index + 2, error: 'Estado no válido.' });
      continue;
    }
    if ([normalizedStartDate, normalizedDueDate].some(date => date && !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
      results.errors.push({ row: index + 2, error: 'Las fechas deben tener formato AAAA-MM-DD.' });
      continue;
    }
    const project = await database.prepare('SELECT id FROM projects WHERE id = ? AND organization_id = ?').get(projectId, req.session.user.organization_id);
    if (!project) {
      results.errors.push({ row: index + 2, error: 'Proyecto no pertenece a la organización.' });
      continue;
    }
    let assignee = null;
    const assigneeValue = String(assignedTo ?? '').trim();
    if (assigneeValue) {
      if (/^\d+$/.test(assigneeValue)) {
        assignee = await database.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ? AND active = 1').get(Number(assigneeValue), req.session.user.organization_id);
      } else {
        const matches = await database.prepare('SELECT id FROM users WHERE organization_id = ? AND active = 1 AND (LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?) OR LOWER(name) = LOWER(?))').all(req.session.user.organization_id, assigneeValue, assigneeValue, assigneeValue);
        if (matches.length === 1) assignee = matches[0];
      }
      if (!assignee) {
        results.errors.push({ row: index + 2, error: 'Responsable no válido o ambiguo; usa ID, usuario, correo o nombre exacto.' });
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
        normalizedStartDate,
        normalizedDueDate,
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
      results.errors.push({ row: index + 2, error: 'Error de base de datos.', details: e.message });
    }
  }
  res.json(results);
}

function downloadImportTemplate(req, res) {
  const xlsx = require('xlsx');
  const headers = ['title', 'description', 'assigned_to', 'priority', 'status', 'start_date', 'due_date'];
  const sheet = xlsx.utils.aoa_to_sheet([headers]);
  sheet['!cols'] = [{ wch: 24 }, { wch: 48 }, { wch: 24 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }];
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, sheet, 'Tareas');
  xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet([
    ['Columna', 'Instrucciones'],
    ['assigned_to', 'ID, nombre de usuario, correo o nombre exacto de un usuario activo. Déjalo vacío para no asignar la tarea.']
  ]), 'Guia');
  const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla-tareas.xlsx"');
  res.send(buffer);
}

async function update(req, res) {
  const database = req.app.locals.database;
  const id = taskId(req, res);
  if (!id) return;
  const task = await database.prepare('SELECT * FROM tasks WHERE id = ? AND organization_id = ?').get(id, req.session.user.organization_id);
  if (!task) return res.status(404).json({ error: 'La tarea no existe.' });
  if (req.session.user.role === 'member' && task.assigned_to !== req.session.user.id) return res.status(403).json({ error: 'Solo puedes modificar tus tareas.' });
  if (req.body.status !== undefined && !canMoveTaskBack(req.session.user.role) && isBackwardMove(task.status, req.body.status)) return res.status(403).json({ error: 'Solo un administrador o project manager puede regresar una tarea a un estado anterior.' });

  let sprintId = task.sprint_id;
  if (req.body.sprint_id !== undefined) {
    if (req.body.sprint_id === '' || req.body.sprint_id === null) {
      sprintId = null;
    } else {
      const parsedSprintId = Number(req.body.sprint_id);
      if (!Number.isInteger(parsedSprintId) || parsedSprintId < 1) {
        return res.status(400).json({ error: 'El identificador del sprint no es válido.' });
      }
      const sprint = await database.prepare('SELECT id, project_id FROM sprints WHERE id = ? AND organization_id = ?').get(parsedSprintId, req.session.user.organization_id);
      if (!sprint || sprint.project_id !== task.project_id) {
        return res.status(400).json({ error: 'El sprint no pertenece al mismo proyecto u organización.' });
      }
      sprintId = parsedSprintId;
    }
  }

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
  let parentId = task.parent_id;
  if (req.body.parent_id !== undefined) {
    if (req.body.parent_id === '' || req.body.parent_id === null) {
      parentId = null;
    } else {
      const parsedParentId = Number(req.body.parent_id);
      if (parsedParentId === id) {
        return res.status(400).json({ error: 'Una tarea no puede ser su propio padre.' });
      }
      const parentTask = await database.prepare('SELECT id, project_id FROM tasks WHERE id = ? AND organization_id = ?').get(parsedParentId, req.session.user.organization_id);
      if (!parentTask || parentTask.project_id !== task.project_id) {
        return res.status(400).json({ error: 'La tarea padre debe pertenecer al mismo proyecto.' });
      }
      parentId = parsedParentId;
    }
  }

  let isMilestone = task.is_milestone;
  if (req.body.is_milestone !== undefined) {
    isMilestone = Boolean(req.body.is_milestone === true || req.body.is_milestone === 'true' || req.body.is_milestone === 1 || req.body.is_milestone === '1');
  }

  let progress = task.progress ?? 0;
  if (req.body.progress !== undefined && req.body.progress !== '') {
    progress = Math.max(0, Math.min(100, Number(req.body.progress) || 0));
  } else if (req.body.status !== undefined) {
    progress = req.body.status === 'completada' ? 100 : (req.body.status === 'en_proceso' ? 50 : 0);
  }

  let color = req.body.color !== undefined ? (req.body.color || null) : task.color;
  let baselineStartDate = req.body.baseline_start_date !== undefined ? (req.body.baseline_start_date || null) : task.baseline_start_date;
  let baselineDueDate = req.body.baseline_due_date !== undefined ? (req.body.baseline_due_date || null) : task.baseline_due_date;

  await database.prepare(`UPDATE tasks SET title = ?, description = ?, assigned_to = ?, priority = ?, start_date = ?, due_date = ?, status = ?, sprint_id = ?, parent_id = ?, is_milestone = ?, progress = ?, color = ?, baseline_start_date = ?, baseline_due_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`).run(...values, sprintId, parentId, isMilestone, progress, color, baselineStartDate, baselineDueDate, id, req.session.user.organization_id);
  if (req.file) {
    const asset = await database.prepare('INSERT INTO stored_assets (organization_id, uploaded_by, kind, mime_type, content) VALUES (?, ?, ?, ?, ?) RETURNING id').run(req.session.user.organization_id, req.session.user.id, 'task-image', req.file.mimetype, req.file.buffer);
    await database.prepare('UPDATE tasks SET image_asset_id = ? WHERE id = ? AND organization_id = ?').run(asset.lastInsertRowid, id, req.session.user.organization_id);
  }
  await database.prepare('INSERT INTO activities (organization_id, user_id, project_id, action, description) VALUES (?, ?, ?, ?, ?)').run(req.session.user.organization_id, req.session.user.id, task.project_id, 'task.updated', `Tarea actualizada: ${values[0]}`);
  res.json({ ok: true });
}

async function updateSprint(req, res) {
  const id = taskId(req, res);
  if (!id) return;
  if (req.session.user.role === 'viewer') {
    return res.status(403).json({ error: 'No tienes permisos de edición.' });
  }
  const database = req.app.locals.database;
  const task = await database.prepare('SELECT * FROM tasks WHERE id = ? AND organization_id = ?').get(id, req.session.user.organization_id);
  if (!task) return res.status(404).json({ error: 'La tarea no existe.' });
  if (req.session.user.role === 'member' && task.assigned_to !== req.session.user.id) {
    return res.status(403).json({ error: 'Solo puedes modificar tus tareas.' });
  }

  let sprintId = req.body.sprint_id;
  if (sprintId === '' || sprintId === null || sprintId === undefined) {
    sprintId = null;
  } else {
    sprintId = Number(sprintId);
    if (!Number.isInteger(sprintId) || sprintId < 1) {
      return res.status(400).json({ error: 'El identificador del sprint no es válido.' });
    }
    const sprint = await database.prepare('SELECT id, project_id FROM sprints WHERE id = ? AND organization_id = ?').get(sprintId, req.session.user.organization_id);
    if (!sprint || sprint.project_id !== task.project_id) {
      return res.status(400).json({ error: 'El sprint no pertenece al mismo proyecto u organización.' });
    }
  }

  await database.prepare('UPDATE tasks SET sprint_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?').run(sprintId, id, req.session.user.organization_id);
  await database.prepare('INSERT INTO activities (organization_id, user_id, project_id, action, description) VALUES (?, ?, ?, ?, ?)').run(
    req.session.user.organization_id,
    req.session.user.id,
    task.project_id,
    'task.sprint_changed',
    sprintId ? `Tarea asignada a sprint ${sprintId}: ${task.title}` : `Tarea retirada de sprint: ${task.title}`
  );
  res.json({ ok: true, sprint_id: sprintId });
}
async function status(req, res) {
  const database = req.app.locals.database;
  const id = taskId(req, res);
  if (!id) return;
  const task = await database.prepare('SELECT * FROM tasks WHERE id = ? AND organization_id = ?').get(id, req.session.user.organization_id);
  if (!task || (req.session.user.role === 'member' && task.assigned_to !== req.session.user.id)) return res.status(404).json({ error: 'La tarea no existe.' });
  if (req.session.user.role === 'viewer') return res.status(403).json({ error: 'Tu rol solo permite consultar las tareas.' });
  if (!TASK_STATUSES.has(req.body.status)) return res.status(400).json({ error: 'Estado no válido.' });
  if (!canMoveTaskBack(req.session.user.role) && isBackwardMove(task.status, req.body.status)) return res.status(403).json({ error: 'Solo un administrador o project manager puede regresar una tarea a un estado anterior.' });
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
async function removeMany(req, res) {
  const database = req.app.locals.database;
  const organizationId = req.session.user.organization_id;
  let tasks;
  if (req.body?.all === true) {
    tasks = await database.prepare('SELECT id, project_id, title FROM tasks WHERE organization_id = ?').all(organizationId);
  } else {
    if (!Array.isArray(req.body?.ids) || !req.body.ids.length) return res.status(400).json({ error: 'Selecciona al menos una tarea.' });
    const ids = [...new Set(req.body.ids.map(Number))];
    if (ids.some(id => !Number.isInteger(id) || id < 1)) return res.status(400).json({ error: 'La selección contiene identificadores no válidos.' });
    const placeholders = ids.map(() => '?').join(', ');
    tasks = await database.prepare(`SELECT id, project_id, title FROM tasks WHERE organization_id = ? AND id IN (${placeholders})`).all(organizationId, ...ids);
  }
  for (const task of tasks) {
    await database.prepare('DELETE FROM tasks WHERE id = ? AND organization_id = ?').run(task.id, organizationId);
    await database.prepare('INSERT INTO activities (organization_id, user_id, project_id, action, description) VALUES (?, ?, ?, ?, ?)').run(organizationId, req.session.user.id, task.project_id, 'task.deleted', `Tarea eliminada: ${task.title}`);
  }
  res.json({ deleted: tasks.length });
}

async function exportPdf(req, res) {
  const organizationId = req.session.user.organization_id;
  const currentUser = req.session.user;
  const database = req.app.locals.database;

  // Multi-tenant & role security:
  // Regular members and viewers can only ever download their own tasks.
  let targetUserId = currentUser.id;
  if (['admin', 'project_manager'].includes(currentUser.role) && req.query.assigned_to) {
    const requestedId = Number(req.query.assigned_to);
    if (Number.isInteger(requestedId) && requestedId > 0) {
      targetUserId = requestedId;
    }
  }

  const user = await database.prepare('SELECT id, name, username, email, role FROM users WHERE id = ? AND organization_id = ?').get(targetUserId, organizationId);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

  const org = await database.prepare('SELECT name FROM organizations WHERE id = ?').get(organizationId);
  const orgName = org?.name || 'Haitani';

  const filters = ['tasks.organization_id = ?', 'tasks.assigned_to = ?'];
  const params = [organizationId, targetUserId];

  if (req.query.status && TASK_STATUSES.has(req.query.status)) {
    filters.push('tasks.status = ?');
    params.push(req.query.status);
  }
  if (req.query.priority && TASK_PRIORITIES.has(req.query.priority)) {
    filters.push('tasks.priority = ?');
    params.push(req.query.priority);
  }
  if (req.query.project_id && Number.isInteger(Number(req.query.project_id))) {
    filters.push('tasks.project_id = ?');
    params.push(Number(req.query.project_id));
  }

  const query = `
    SELECT tasks.*, 
           projects.name AS project_name, 
           users.name AS assignee_name, 
           users.username AS assignee_username, 
           sprints.name AS sprint_name
    FROM tasks
    LEFT JOIN projects ON projects.id = tasks.project_id AND projects.organization_id = tasks.organization_id
    LEFT JOIN users ON users.id = tasks.assigned_to
    LEFT JOIN sprints ON sprints.id = tasks.sprint_id AND sprints.organization_id = tasks.organization_id
    WHERE ${filters.join(' AND ')}
    ORDER BY 
      CASE tasks.status 
        WHEN 'en_proceso' THEN 1 
        WHEN 'pendiente' THEN 2 
        WHEN 'en_revision' THEN 3
        WHEN 'bloqueada' THEN 4
        ELSE 5 
      END, 
      CASE tasks.priority 
        WHEN 'critica' THEN 1 
        WHEN 'alta' THEN 2 
        WHEN 'media' THEN 3 
        ELSE 4 
      END, 
      tasks.due_date ASC NULLS LAST`;

  const tasks = await database.prepare(query).all(...params);

  try {
    const pdfBuffer = await pdfService.generateTasksPdf(user, orgName, tasks);
    const sanitizedUsername = (user.username || 'usuario').replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `mis-tareas-${sanitizedUsername}-${dateStamp}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: 'Error al generar el documento PDF.' });
  }
}

module.exports = { list, get, listByProject, create, update, updateSprint, status, image, remove, removeMany, importTasks, downloadImportTemplate, exportPdf };