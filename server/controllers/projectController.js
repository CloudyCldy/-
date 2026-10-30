const sanzuService = require('../services/sanzuService');
const { detectAndSyncEvents } = require('../services/eventService');
const { registry } = require('../services/methodologyRegistry');

function methodology(value) {
  const normalized = String(value || 'AGILE').trim().toUpperCase();
  return registry.has(normalized) ? normalized : null;
}

function syncProject(database, projectId, organizationId) {
  sanzuService.syncProjectFull(database, projectId, organizationId)
    .catch(error => console.warn(`No fue posible sincronizar el proyecto ${projectId} con Sanzu:`, error.message));
}

function projectId(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: 'El identificador del proyecto no es válido.' });
    return null;
  }
  return id;
}

// Avance real del proyecto según sus tareas (promedio del avance de cada tarea; completada = 100)
const PROJECT_PROGRESS_SQL = `
  (SELECT COUNT(*)::integer FROM tasks t WHERE t.project_id = projects.id) AS tasks_total,
  (SELECT COUNT(*)::integer FROM tasks t WHERE t.project_id = projects.id AND t.status = 'completada') AS tasks_done,
  (SELECT COALESCE(ROUND(AVG(CASE WHEN t.status = 'completada' THEN 100 ELSE LEAST(100, GREATEST(0, COALESCE(t.progress, 0))) END))::integer, 0) FROM tasks t WHERE t.project_id = projects.id) AS tasks_progress,
  (SELECT COUNT(*)::integer FROM project_members pm WHERE pm.project_id = projects.id) AS members_count,
  (SELECT COUNT(*)::integer FROM project_milestones m WHERE m.project_id = projects.id) AS milestones_count,
  (SELECT COUNT(*)::integer FROM sprints s WHERE s.project_id = projects.id) AS sprints_count,
  (SELECT COUNT(*)::integer FROM project_risks r WHERE r.project_id = projects.id AND r.status = 'open') AS open_risks_count,
  COALESCE((
    SELECT json_agg(json_build_object('id', u.id, 'name', u.name, 'username', u.username, 'profile_photo', u.profile_photo))
    FROM (
      SELECT u.id, u.name, u.username, u.profile_photo
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = projects.id
      ORDER BY pm.created_at ASC
      LIMIT 6
    ) u
  ), '[]'::json) AS members`;

async function list(req, res) {
  res.json(await req.app.locals.database.prepare(`SELECT projects.*, users.name AS manager_name, ${PROJECT_PROGRESS_SQL} FROM projects LEFT JOIN users ON users.id = projects.manager_id WHERE projects.organization_id = ? ORDER BY projects.created_at DESC`).all(req.session.user.organization_id));
}

async function get(req, res) {
  const id = projectId(req, res);
  if (!id) return;
  const project = await req.app.locals.database.prepare(`SELECT projects.*, users.name AS manager_name, ${PROJECT_PROGRESS_SQL} FROM projects LEFT JOIN users ON users.id = projects.manager_id WHERE projects.id = ? AND projects.organization_id = ?`).get(id, req.session.user.organization_id);
  if (!project) return res.status(404).json({ error: 'El proyecto no existe.' });
  res.json(project);
}

async function create(req, res) {
  const { name, description = '', objective, scope, client, manager_id, start_date, end_date, status = 'planning', priority = 'medium', budget = 0, repository_url, technologies, risks, requirements, initial_members, create_kickoff_items } = req.body;
  const methodologyId = methodology(req.body.methodology_id);

  if (!String(name || '').trim()) return res.status(400).json({ error: 'El nombre del proyecto es obligatorio.' });
  if (!methodologyId) return res.status(400).json({ error: 'La metodología del proyecto no es válida.' });
  if (manager_id && !(await req.app.locals.database.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ? AND active = 1').get(manager_id, req.session.user.organization_id))) {
    return res.status(400).json({ error: 'El responsable no pertenece a tu organización.' });
  }

  const database = req.app.locals.database;
  const result = await database.prepare(`
    INSERT INTO projects (organization_id, name, description, objective, scope, client, manager_id, start_date, end_date, status, priority, budget, repository_url, technologies, risks, methodology_id, requirements)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id
  `).run(
    req.session.user.organization_id,
    name.trim(),
    description,
    objective || null,
    scope || null,
    client || null,
    manager_id || null,
    start_date || null,
    end_date || null,
    status,
    priority,
    Number(budget) || 0,
    repository_url || null,
    technologies || null,
    risks || null,
    methodologyId,
    requirements || null
  );

  const newId = result.lastInsertRowid;
  const externalRef = `haitani-proj-${newId}`;
  await database.prepare('UPDATE projects SET sanzu_external_ref = ? WHERE id = ? AND organization_id = ?').run(externalRef, newId, req.session.user.organization_id);
  
  // Agregar creador y responsable como miembros iniciales
  await database.prepare('INSERT INTO project_members (project_id, user_id, organization_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING').run(newId, req.session.user.id, req.session.user.organization_id);
  if (manager_id && manager_id !== req.session.user.id) {
    await database.prepare('INSERT INTO project_members (project_id, user_id, organization_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING').run(newId, manager_id, req.session.user.organization_id);
  }

  // Agregar miembros adicionales seleccionados en el asistente visual
  if (Array.isArray(initial_members) && initial_members.length) {
    for (const memId of initial_members) {
      const numId = Number(memId);
      if (Number.isInteger(numId) && numId > 0 && numId !== req.session.user.id && numId !== manager_id) {
        await database.prepare('INSERT INTO project_members (project_id, user_id, organization_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING').run(newId, numId, req.session.user.organization_id).catch(() => {});
      }
    }
  }

  // Generar kit de arranque inicial si se solicitó en el creador visual
  if (create_kickoff_items) {
    const kickoffOwner = manager_id || req.session.user.id;
    const taskStartDate = start_date || new Date().toISOString().slice(0, 10);
    const taskDueDate = end_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Tarea inicial de kickoff
    await database.prepare(`
      INSERT INTO tasks (organization_id, project_id, title, description, assigned_to, creator_id, status, priority, start_date, due_date)
      VALUES (?, ?, ?, ?, ?, ?, 'pendiente', 'alta', ?, ?)
    `).run(
      req.session.user.organization_id,
      newId,
      'Reunión de kickoff y alineación de objetivos',
      'Definición de alcance, arquitectura técnica y asignación de responsabilidades.',
      kickoffOwner,
      req.session.user.id,
      taskStartDate,
      taskDueDate
    ).catch(() => {});

    // Hito inicial de arranque
    await database.prepare(`
      INSERT INTO project_milestones (organization_id, project_id, title, description, due_date, status, created_by)
      VALUES (?, ?, ?, ?, ?, 'pendiente', ?)
    `).run(
      req.session.user.organization_id,
      newId,
      'Kickoff y Aprobación de Arquitectura',
      'Alineación formal del equipo y entrega de bases técnicas del proyecto.',
      taskDueDate,
      req.session.user.id
    ).catch(() => {});

    // Sprint 1 si la metodología es ágil/iterativa
    if (['SCRUM', 'HYBRID', 'AGILE'].includes(methodologyId)) {
      const sprintEndDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      await database.prepare(`
        INSERT INTO sprints (organization_id, project_id, name, goal, start_date, end_date, status)
        VALUES (?, ?, ?, ?, ?, ?, 'planificado')
      `).run(
        req.session.user.organization_id,
        newId,
        'Sprint 1 - Fundamentos',
        'Configuración inicial de entornos, arquitectura base y primer incremento de valor.',
        taskStartDate,
        sprintEndDate
      ).catch(() => {});
    }
  }

  await database.prepare('INSERT INTO activities (organization_id, user_id, project_id, action, description) VALUES (?, ?, ?, ?, ?)').run(
    req.session.user.organization_id, req.session.user.id, newId, 'project.created', `Proyecto creado: ${name.trim()}`
  );

  syncProject(database, newId, req.session.user.organization_id);
  res.status(201).json({ id: newId, sanzu_external_ref: externalRef });
}

async function update(req, res) {
  const id = projectId(req, res);
  if (!id) return;
  const database = req.app.locals.database;
  const project = await database.prepare('SELECT * FROM projects WHERE id = ? AND organization_id = ?').get(id, req.session.user.organization_id);
  if (!project) return res.status(404).json({ error: 'El proyecto no existe.' });

  const fields = ['name', 'description', 'objective', 'scope', 'client', 'manager_id', 'start_date', 'end_date', 'status', 'priority', 'progress', 'budget', 'repository_url', 'technologies', 'risks', 'methodology_id', 'requirements'];
  const values = fields.map(field => {
    if (field === 'methodology_id') return methodology(req.body[field] === undefined ? project[field] : req.body[field]);
    if (field === 'budget') return req.body[field] === undefined ? project[field] : Number(req.body[field] || 0);
    return req.body[field] === undefined ? project[field] : req.body[field];
  });

  if (!values[15]) return res.status(400).json({ error: 'La metodología del proyecto no es válida.' });
  if (values[5] && !(await database.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ? AND active = 1').get(values[5], req.session.user.organization_id))) {
    return res.status(400).json({ error: 'El responsable no pertenece a tu organización.' });
  }

  await database.prepare(`
    UPDATE projects
    SET ${fields.map((field, index) => `${field} = $${index + 1}`).join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = $${fields.length + 1} AND organization_id = $${fields.length + 2}
  `).run(...values, id, req.session.user.organization_id);

  syncProject(database, id, req.session.user.organization_id);
  res.json({ ok: true });
}

async function members(req, res) {
  const id = projectId(req, res);
  if (!id) return;
  res.json(await req.app.locals.database.prepare('SELECT users.id, users.name, users.username, users.email, project_members.created_at FROM project_members JOIN users ON users.id = project_members.user_id WHERE project_members.project_id = ? AND project_members.organization_id = ? ORDER BY users.name').all(id, req.session.user.organization_id));
}

async function addMember(req, res) {
  const id = projectId(req, res);
  if (!id) return;
  const userId = Number(req.body.user_id);
  if (!Number.isInteger(userId) || userId < 1) return res.status(400).json({ error: 'El usuario no es válido.' });
  const database = req.app.locals.database;
  const user = await database.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ? AND active = true').get(userId, req.session.user.organization_id);
  const project = await database.prepare('SELECT id FROM projects WHERE id = ? AND organization_id = ?').get(id, req.session.user.organization_id);
  if (!user || !project) return res.status(404).json({ error: 'El proyecto o usuario no existe en tu organización.' });
  const result = await database.prepare('INSERT INTO project_members (project_id, user_id, organization_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING').run(id, user.id, req.session.user.organization_id);
  if (!result.changes) return res.status(409).json({ error: 'El usuario ya pertenece al proyecto.' });
  await database.prepare('INSERT INTO activities (organization_id, user_id, project_id, action, description) VALUES (?, ?, ?, ?, ?)').run(req.session.user.organization_id, req.session.user.id, id, 'project.member_added', `Miembro añadido al proyecto: ${user.id}`);
  res.status(201).json({ ok: true });
}

async function removeMember(req, res) {
  const id = projectId(req, res);
  if (!id) return;
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId < 1) return res.status(400).json({ error: 'El usuario no es válido.' });
  const database = req.app.locals.database;
  const result = await database.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ? AND organization_id = ?').run(id, userId, req.session.user.organization_id);
  if (!result.changes) return res.status(404).json({ error: 'El miembro no pertenece al proyecto.' });
  await database.prepare('INSERT INTO activities (organization_id, user_id, project_id, action, description) VALUES (?, ?, ?, ?, ?)').run(req.session.user.organization_id, req.session.user.id, id, 'project.member_removed', `Miembro retirado del proyecto: ${userId}`);
  res.json({ ok: true });
}

/**
 * Consolidación de relaciones y Project Overview (HB-03-ST020, HB-06-ST021)
 */
// Fecha AAAA-MM-DD aunque PostgreSQL la regrese como objeto Date
const isoDay = value => String(value instanceof Date ? value.toISOString() : value).slice(0, 10);

async function overview(req, res) {
  const id = projectId(req, res);
  if (!id) return;
  const database = req.app.locals.database;
  const orgId = req.session.user.organization_id;

  const project = await database.prepare(`
    SELECT projects.*, users.name AS manager_name, users.email AS manager_email
    FROM projects
    LEFT JOIN users ON users.id = projects.manager_id
    WHERE projects.id = ? AND projects.organization_id = ?
  `).get(id, orgId);

  if (!project) return res.status(404).json({ error: 'El proyecto no existe.' });

  // Sincronizar eventos para detección fresca
  await detectAndSyncEvents(database, orgId, id).catch(() => {});

  const todayStr = new Date().toISOString().split('T')[0];

  const [tasks, membersList, sprints, backlog, risks, documents, events] = await Promise.all([
    database.prepare(`SELECT tasks.*, users.name AS assignee_name FROM tasks LEFT JOIN users ON users.id = tasks.assigned_to WHERE tasks.project_id = ? AND tasks.organization_id = ? ORDER BY tasks.due_date ASC`).all(id, orgId),
    database.prepare(`SELECT users.id, users.name, users.username, users.role FROM project_members JOIN users ON users.id = project_members.user_id WHERE project_members.project_id = ? AND project_members.organization_id = ?`).all(id, orgId),
    database.prepare(`SELECT * FROM sprints WHERE project_id = ? AND organization_id = ? ORDER BY start_date DESC`).all(id, orgId).catch(() => []),
    database.prepare(`SELECT * FROM backlog_items WHERE project_id = ? AND organization_id = ? ORDER BY created_at DESC`).all(id, orgId).catch(() => []),
    database.prepare(`SELECT * FROM project_risks WHERE project_id = ? AND organization_id = ? ORDER BY severity_score DESC`).all(id, orgId).catch(() => []),
    database.prepare(`SELECT files.id, files.original_name, files.mime_type, files.size, files.category, files.created_at FROM project_documents JOIN files ON files.id = project_documents.file_id WHERE project_documents.project_id = ? AND project_documents.organization_id = ?`).all(id, orgId).catch(() => []),
    database.prepare(`SELECT * FROM project_events WHERE project_id = ? AND organization_id = ? AND resolved = false ORDER BY created_at DESC LIMIT 10`).all(id, orgId).catch(() => [])
  ]);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completada').length;
  const inProgressTasks = tasks.filter(t => t.status === 'en_proceso').length;
  const pendingTasks = tasks.filter(t => t.status === 'pendiente').length;
  const blockedTasks = tasks.filter(t => t.status === 'bloqueada');
  const overdueTasks = tasks.filter(t => t.status !== 'completada' && t.due_date && isoDay(t.due_date) < todayStr);

  const completionRate = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const riskPenalty = Math.min(60, overdueTasks.length * 15 + blockedTasks.length * 20 + risks.filter(r => r.severity_score >= 65).length * 10);
  const healthScore = Math.max(0, Math.min(100, Math.round(completionRate * 0.5 + (100 - riskPenalty) * 0.5)));
  const healthStatus = healthScore >= 80 ? 'saludable' : healthScore >= 55 ? 'atencion' : 'riesgo';

  // Team Workload
  const workload = membersList.map(m => {
    const memberTasks = tasks.filter(t => t.assigned_to === m.id && t.status !== 'completada');
    const cap = Math.min(100, Math.round((memberTasks.length / 5) * 100));
    return {
      userId: m.id,
      name: m.name,
      role: m.role,
      activeTasks: memberTasks.length,
      capacityPercent: cap
    };
  });

  // Deadline calculation
  let daysRemaining = null;
  if (project.end_date) {
    const end = new Date(project.end_date);
    daysRemaining = Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24));
  }

  res.json({
    project,
    health: {
      score: healthScore,
      status: healthStatus,
      progress: completionRate
    },
    tasks: {
      total: totalTasks,
      completed: completedTasks,
      inProgress: inProgressTasks,
      pending: pendingTasks,
      blockedCount: blockedTasks.length,
      overdueCount: overdueTasks.length,
      blockedList: blockedTasks.slice(0, 5),
      overdueList: overdueTasks.slice(0, 5)
    },
    workload,
    risks: {
      total: risks.length,
      highSeverity: risks.filter(r => r.severity_score >= 65).length,
      items: risks.slice(0, 5)
    },
    sprints: {
      total: sprints.length,
      active: sprints.find(s => s.status === 'activo') || null
    },
    backlogCount: backlog.length,
    documentsCount: documents.length,
    documents: documents.slice(0, 5),
    activeEvents: events,
    deadline: {
      endDate: project.end_date,
      daysRemaining
    }
  });
}

/**
 * Sincronización explícita con Sanzu y reporte de estado (INT-01-ST036, ST037, ST038)
 */
async function sync(req, res) {
  const id = projectId(req, res);
  if (!id) return;
  const database = req.app.locals.database;
  const orgId = req.session.user.organization_id;

  try {
    const report = await sanzuService.syncProjectFull(database, id, orgId);
    res.json({
      ok: true,
      report,
      warning: report.warning || null,
      message: report.warning || 'Sincronización con Sanzu completada con éxito.'
    });
  } catch (error) {
    res.status(502).json({
      error: 'Error de sincronización con Sanzu.',
      details: error.message
    });
  }
}

/**
 * Métricas e inteligencia Sanzu para el proyecto (HB-16-ST039, HB-16-ST040, HB-16-ST041)
 */
async function intelligence(req, res) {
  const id = projectId(req, res);
  if (!id) return;
  const database = req.app.locals.database;
  const orgId = req.session.user.organization_id;

  const project = await database.prepare('SELECT * FROM projects WHERE id = ? AND organization_id = ?').get(id, orgId);
  if (!project) return res.status(404).json({ error: 'El proyecto no existe.' });

  const [tasks, risks, events] = await Promise.all([
    database.prepare(`SELECT id, title, status, priority, due_date FROM tasks WHERE project_id = ? AND organization_id = ?`).all(id, orgId),
    database.prepare(`SELECT * FROM project_risks WHERE project_id = ? AND organization_id = ? AND status = 'open'`).all(id, orgId).catch(() => []),
    database.prepare(`SELECT * FROM project_events WHERE project_id = ? AND organization_id = ? AND resolved = false`).all(id, orgId).catch(() => [])
  ]);

  const blocked = tasks.filter(t => t.status === 'bloqueada');
  const todayStr = new Date().toISOString().split('T')[0];
  const overdue = tasks.filter(t => t.status !== 'completada' && t.due_date && isoDay(t.due_date) < todayStr);

  const completed = tasks.filter(t => t.status === 'completada').length;
  const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  const healthScore = Math.max(0, 100 - (overdue.length * 15 + blocked.length * 20 + risks.length * 10));
  const healthStatus = healthScore >= 80 ? 'saludable' : healthScore >= 60 ? 'atencion' : 'riesgo';

  const recommendations = [];
  if (blocked.length) recommendations.push(`Atiende ${blocked.length} tarea(s) bloqueada(s) para restablecer la velocidad del equipo.`);
  if (overdue.length) recommendations.push(`Hay ${overdue.length} tarea(s) vencida(s). Reajusta prioridades y cronograma.`);
  if (risks.length) recommendations.push(`Revisa los ${risks.length} riesgo(s) abiertos y sus medidas de mitigación.`);
  if (!recommendations.length) recommendations.push('El proyecto mantiene un avance saludable y sin impedimentos críticos.');

  res.json({
    externalRef: project.sanzu_external_ref,
    health: {
      score: healthScore,
      status: healthStatus,
      progress
    },
    blockedTasks: blocked,
    overdueTasks: overdue,
    risks,
    events,
    recommendations,
    sanzuSync: {
      syncedAt: project.sanzu_synced_at,
      status: project.sanzu_sync_status || 'pending',
      error: project.sanzu_sync_error
    }
  });
}

async function deleteProject(req, res) {
  const id = projectId(req, res);
  if (!id) return;
  const database = req.app.locals.database;
  const orgId = req.session.user.organization_id;

  const project = await database.prepare('SELECT id, name FROM projects WHERE id = ? AND organization_id = ?').get(id, orgId);
  if (!project) return res.status(404).json({ error: 'El proyecto no existe.' });

  await database.prepare('DELETE FROM projects WHERE id = ? AND organization_id = ?').run(id, orgId);
  await database.prepare('INSERT INTO activities (organization_id, user_id, project_id, action, description) VALUES (?, ?, ?, ?, ?)').run(
    orgId, req.session.user.id, null, 'project.deleted', `Proyecto eliminado: ${project.name}`
  ).catch(() => {});

  res.json({ ok: true, message: 'Proyecto eliminado correctamente.' });
}

async function updateStatus(req, res) {
  const id = projectId(req, res);
  if (!id) return;
  const { status } = req.body;
  const allowed = ['planning', 'planificado', 'in_progress', 'en_progreso', 'completed', 'completado', 'paused', 'pausado', 'canceled', 'cancelado'];
  if (!status || !allowed.includes(status)) {
    return res.status(400).json({ error: 'Estado de proyecto no válido.' });
  }

  const database = req.app.locals.database;
  const orgId = req.session.user.organization_id;
  const project = await database.prepare('SELECT id, name FROM projects WHERE id = ? AND organization_id = ?').get(id, orgId);
  if (!project) return res.status(404).json({ error: 'El proyecto no existe.' });

  await database.prepare('UPDATE projects SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?').run(status, id, orgId);
  await database.prepare('INSERT INTO activities (organization_id, user_id, project_id, action, description) VALUES (?, ?, ?, ?, ?)').run(
    orgId, req.session.user.id, id, 'project.status_updated', `Estado del proyecto ${project.name} actualizado a: ${status}`
  ).catch(() => {});

  syncProject(database, id, orgId);
  res.json({ ok: true, status });
}

module.exports = {
  list,
  get,
  create,
  update,
  deleteProject,
  updateStatus,
  members,
  addMember,
  removeMember,
  overview,
  sync,
  intelligence
};