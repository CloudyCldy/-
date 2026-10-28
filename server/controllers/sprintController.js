function sprintId(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: 'El identificador del sprint no es válido.' });
    return null;
  }
  return id;
}

function projectId(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: 'El identificador del proyecto no es válido.' });
    return null;
  }
  return id;
}

function isValidDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

async function listByProject(req, res) {
  const pId = projectId(req, res);
  if (!pId) return;
  const database = req.app.locals.database;
  const organizationId = req.session.user.organization_id;

  const project = await database.prepare('SELECT id FROM projects WHERE id = ? AND organization_id = ?').get(pId, organizationId);
  if (!project) return res.status(404).json({ error: 'El proyecto no existe.' });

  const sprints = await database.prepare(`
    SELECT sprints.*,
           COUNT(tasks.id)::int AS total_tasks,
           COUNT(CASE WHEN tasks.status = 'completada' THEN 1 END)::int AS completed_tasks
    FROM sprints
    LEFT JOIN tasks ON tasks.sprint_id = sprints.id AND tasks.organization_id = sprints.organization_id
    WHERE sprints.project_id = ? AND sprints.organization_id = ?
    GROUP BY sprints.id
    ORDER BY sprints.created_at DESC
  `).all(pId, organizationId);

  res.json(sprints);
}

async function create(req, res) {
  const pId = projectId(req, res);
  if (!pId) return;
  const database = req.app.locals.database;
  const organizationId = req.session.user.organization_id;
  const { name, goal = '', start_date, end_date } = req.body;

  if (!String(name || '').trim()) {
    return res.status(400).json({ error: 'El nombre del sprint es obligatorio.' });
  }

  if (!isValidDate(start_date) || !isValidDate(end_date)) {
    return res.status(400).json({ error: 'Las fechas de inicio y fin son obligatorias y deben tener formato YYYY-MM-DD.' });
  }

  if (end_date < start_date) {
    return res.status(400).json({ error: 'La fecha de fin no puede ser anterior a la fecha de inicio.' });
  }

  const project = await database.prepare('SELECT id FROM projects WHERE id = ? AND organization_id = ?').get(pId, organizationId);
  if (!project) return res.status(404).json({ error: 'El proyecto no existe.' });

  const result = await database.prepare(`
    INSERT INTO sprints (organization_id, project_id, name, goal, start_date, end_date, status)
    VALUES (?, ?, ?, ?, ?, ?, 'planificado')
    RETURNING id
  `).run(organizationId, pId, name.trim(), String(goal || '').trim(), start_date, end_date);

  await database.prepare(`
    INSERT INTO activities (organization_id, user_id, project_id, action, description)
    VALUES (?, ?, ?, ?, ?)
  `).run(organizationId, req.session.user.id, pId, 'sprint.created', `Sprint creado: ${name.trim()}`);

  res.status(201).json({
    id: result.lastInsertRowid,
    project_id: pId,
    name: name.trim(),
    goal: String(goal || '').trim(),
    start_date,
    end_date,
    status: 'planificado'
  });
}

async function get(req, res) {
  const id = sprintId(req, res);
  if (!id) return;
  const database = req.app.locals.database;
  const organizationId = req.session.user.organization_id;

  const sprint = await database.prepare(`
    SELECT sprints.*, projects.name AS project_name
    FROM sprints
    JOIN projects ON projects.id = sprints.project_id AND projects.organization_id = sprints.organization_id
    WHERE sprints.id = ? AND sprints.organization_id = ?
  `).get(id, organizationId);

  if (!sprint) return res.status(404).json({ error: 'El sprint no existe.' });

  const tasks = await database.prepare(`
    SELECT tasks.*, users.name AS assignee_name, users.username AS assignee_username
    FROM tasks
    LEFT JOIN users ON users.id = tasks.assigned_to
    WHERE tasks.sprint_id = ? AND tasks.organization_id = ?
    ORDER BY CASE tasks.status WHEN 'en_proceso' THEN 1 WHEN 'pendiente' THEN 2 ELSE 3 END, tasks.created_at
  `).all(id, organizationId);

  const backlog = await database.prepare(`
    SELECT tasks.*, users.name AS assignee_name
    FROM tasks
    LEFT JOIN users ON users.id = tasks.assigned_to
    WHERE tasks.project_id = ? AND tasks.organization_id = ? AND tasks.sprint_id IS NULL
    ORDER BY tasks.created_at DESC
  `).all(sprint.project_id, organizationId);

  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'completada').length;
  const pending = total - completed;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  const by_status = {
    pendiente: tasks.filter(t => t.status === 'pendiente'),
    en_proceso: tasks.filter(t => t.status === 'en_proceso'),
    en_revision: tasks.filter(t => t.status === 'en_revision'),
    bloqueada: tasks.filter(t => t.status === 'bloqueada'),
    completada: tasks.filter(t => t.status === 'completada')
  };

  const pending_tasks = tasks.filter(t => t.status !== 'completada');

  res.json({
    sprint,
    tasks,
    by_status,
    summary: { total, completed, pending, progress },
    pending_tasks,
    backlog
  });
}

async function update(req, res) {
  const id = sprintId(req, res);
  if (!id) return;
  const database = req.app.locals.database;
  const organizationId = req.session.user.organization_id;

  const sprint = await database.prepare('SELECT * FROM sprints WHERE id = ? AND organization_id = ?').get(id, organizationId);
  if (!sprint) return res.status(404).json({ error: 'El sprint no existe.' });

  const name = req.body.name === undefined ? sprint.name : String(req.body.name || '').trim();
  const goal = req.body.goal === undefined ? sprint.goal : String(req.body.goal || '').trim();
  const start_date = req.body.start_date === undefined ? String(sprint.start_date).slice(0, 10) : req.body.start_date;
  const end_date = req.body.end_date === undefined ? String(sprint.end_date).slice(0, 10) : req.body.end_date;

  if (!name) return res.status(400).json({ error: 'El nombre del sprint es obligatorio.' });
  if (!isValidDate(start_date) || !isValidDate(end_date)) {
    return res.status(400).json({ error: 'Las fechas deben tener un formato válido (YYYY-MM-DD).' });
  }
  if (end_date < start_date) {
    return res.status(400).json({ error: 'La fecha de fin no puede ser anterior a la fecha de inicio.' });
  }

  await database.prepare(`
    UPDATE sprints
    SET name = ?, goal = ?, start_date = ?, end_date = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND organization_id = ?
  `).run(name, goal, start_date, end_date, id, organizationId);

  await database.prepare(`
    INSERT INTO activities (organization_id, user_id, project_id, action, description)
    VALUES (?, ?, ?, ?, ?)
  `).run(organizationId, req.session.user.id, sprint.project_id, 'sprint.updated', `Sprint actualizado: ${name}`);

  res.json({ ok: true });
}

async function remove(req, res) {
  const id = sprintId(req, res);
  if (!id) return;
  const database = req.app.locals.database;
  const organizationId = req.session.user.organization_id;

  const sprint = await database.prepare('SELECT * FROM sprints WHERE id = ? AND organization_id = ?').get(id, organizationId);
  if (!sprint) return res.status(404).json({ error: 'El sprint no existe.' });

  if (sprint.status !== 'planificado') {
    return res.status(409).json({ error: 'Solo se pueden eliminar sprints en estado planificado.' });
  }

  await database.prepare('UPDATE tasks SET sprint_id = NULL WHERE sprint_id = ? AND organization_id = ?').run(id, organizationId);
  await database.prepare('DELETE FROM sprints WHERE id = ? AND organization_id = ?').run(id, organizationId);

  await database.prepare(`
    INSERT INTO activities (organization_id, user_id, project_id, action, description)
    VALUES (?, ?, ?, ?, ?)
  `).run(organizationId, req.session.user.id, sprint.project_id, 'sprint.deleted', `Sprint eliminado: ${sprint.name}`);

  res.json({ ok: true });
}

async function start(req, res) {
  const id = sprintId(req, res);
  if (!id) return;
  const database = req.app.locals.database;
  const organizationId = req.session.user.organization_id;

  const sprint = await database.prepare('SELECT * FROM sprints WHERE id = ? AND organization_id = ?').get(id, organizationId);
  if (!sprint) return res.status(404).json({ error: 'El sprint no existe.' });

  if (sprint.status !== 'planificado') {
    return res.status(409).json({ error: `No se puede iniciar un sprint en estado '${sprint.status}'. Solo se pueden iniciar sprints planificados.` });
  }

  const existingActive = await database.prepare(`
    SELECT id, name FROM sprints
    WHERE project_id = ? AND organization_id = ? AND status = 'activo'
  `).get(sprint.project_id, organizationId);

  if (existingActive) {
    return res.status(409).json({ error: `Ya existe un sprint activo en este proyecto (${existingActive.name}). Debe cerrarse antes de iniciar uno nuevo.` });
  }

  await database.prepare(`
    UPDATE sprints
    SET status = 'activo', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND organization_id = ?
  `).run(id, organizationId);

  await database.prepare(`
    INSERT INTO activities (organization_id, user_id, project_id, action, description)
    VALUES (?, ?, ?, ?, ?)
  `).run(organizationId, req.session.user.id, sprint.project_id, 'sprint.started', `Sprint iniciado: ${sprint.name}`);

  res.json({ ok: true, status: 'activo' });
}

async function close(req, res) {
  const id = sprintId(req, res);
  if (!id) return;
  const database = req.app.locals.database;
  const organizationId = req.session.user.organization_id;

  const sprint = await database.prepare('SELECT * FROM sprints WHERE id = ? AND organization_id = ?').get(id, organizationId);
  if (!sprint) return res.status(404).json({ error: 'El sprint no existe.' });

  if (sprint.status !== 'activo') {
    return res.status(409).json({ error: `No se puede cerrar un sprint en estado '${sprint.status}'. Solo se pueden cerrar sprints activos.` });
  }

  const moveToSprintId = req.body.move_to_sprint_id ? Number(req.body.move_to_sprint_id) : null;
  if (moveToSprintId) {
    if (!Number.isInteger(moveToSprintId) || moveToSprintId === id) {
      return res.status(400).json({ error: 'El sprint de destino no es válido.' });
    }
    const targetSprint = await database.prepare(`
      SELECT id, status FROM sprints
      WHERE id = ? AND project_id = ? AND organization_id = ?
    `).get(moveToSprintId, sprint.project_id, organizationId);

    if (!targetSprint || targetSprint.status !== 'planificado') {
      return res.status(400).json({ error: 'El sprint de destino debe pertenecer al mismo proyecto y estar planificado.' });
    }
  }

  const sprintTasks = await database.prepare(`
    SELECT id, status FROM tasks
    WHERE sprint_id = ? AND organization_id = ?
  `).all(id, organizationId);

  const completed = sprintTasks.filter(t => t.status === 'completada').length;
  const pending = sprintTasks.filter(t => t.status !== 'completada').length;

  if (moveToSprintId) {
    await database.prepare(`
      UPDATE tasks
      SET sprint_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE sprint_id = ? AND organization_id = ? AND status != 'completada'
    `).run(moveToSprintId, id, organizationId);
  } else {
    await database.prepare(`
      UPDATE tasks
      SET sprint_id = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE sprint_id = ? AND organization_id = ? AND status != 'completada'
    `).run(id, organizationId);
  }

  await database.prepare(`
    UPDATE sprints
    SET status = 'cerrado', closed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND organization_id = ?
  `).run(id, organizationId);

  await database.prepare(`
    INSERT INTO activities (organization_id, user_id, project_id, action, description)
    VALUES (?, ?, ?, ?, ?)
  `).run(organizationId, req.session.user.id, sprint.project_id, 'sprint.closed', `Sprint cerrado: ${sprint.name}. (${completed} completadas, ${pending} pendientes)`);

  res.json({
    ok: true,
    status: 'cerrado',
    completed,
    pending,
    move_to_sprint_id: moveToSprintId
  });
}

module.exports = {
  listByProject,
  create,
  get,
  update,
  remove,
  start,
  close
};
