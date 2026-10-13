const TASK_STATUSES = new Set(['pendiente', 'en_proceso', 'en_revision', 'bloqueada', 'completada']);

/**
 * Calcula la ruta crítica (Critical Path Method - CPM) para un conjunto de tareas y dependencias.
 * Basado en los principios de programación de proyectos y el algoritmo de GanttProject.
 */
function computeCriticalPath(tasks, dependencies) {
  if (!tasks.length) return [];

  const taskMap = new Map();
  const predsMap = new Map();
  const succsMap = new Map();

  tasks.forEach(t => {
    taskMap.set(t.id, t);
    predsMap.set(t.id, []);
    succsMap.set(t.id, []);
  });

  dependencies.forEach(d => {
    if (taskMap.has(d.task_id) && taskMap.has(d.predecessor_id)) {
      predsMap.get(d.task_id).push(d);
      succsMap.get(d.predecessor_id).push(d);
    }
  });

  const dayMs = 86400000;
  const parseDate = str => (str ? new Date(`${str}T00:00:00`).getTime() : null);

  // Duración en días
  const durations = new Map();
  tasks.forEach(t => {
    if (t.is_milestone) {
      durations.set(t.id, 0);
    } else if (t.start_date && t.due_date) {
      const s = parseDate(t.start_date);
      const d = parseDate(t.due_date);
      const days = Math.max(1, Math.round((d - s) / dayMs) + 1);
      durations.set(t.id, days);
    } else {
      durations.set(t.id, 1);
    }
  });

  // Fecha base mínima del proyecto
  let minProjTime = Infinity;
  tasks.forEach(t => {
    const s = parseDate(t.start_date) || parseDate(t.due_date);
    if (s && s < minProjTime) minProjTime = s;
  });
  if (minProjTime === Infinity) minProjTime = Date.now();

  // Forward Pass (ES & EF)
  const ES = new Map();
  const EF = new Map();

  // Orden topológico simplificado
  const inDegree = new Map();
  tasks.forEach(t => inDegree.set(t.id, predsMap.get(t.id).length));
  const queue = tasks.filter(t => inDegree.get(t.id) === 0).map(t => t.id);
  const topoOrder = [];

  while (queue.length > 0) {
    const curr = queue.shift();
    topoOrder.push(curr);
    const currTask = taskMap.get(curr);
    const dur = durations.get(curr);

    // Determinar ES
    const preds = predsMap.get(curr);
    if (!preds || preds.length === 0) {
      const plannedStart = parseDate(currTask.start_date);
      const offsetDays = plannedStart ? Math.max(0, Math.round((plannedStart - minProjTime) / dayMs)) : 0;
      ES.set(curr, offsetDays);
    } else {
      let maxPredEF = 0;
      preds.forEach(p => {
        const predEF = EF.get(p.predecessor_id) ?? 0;
        const lag = Number(p.lag_days || 0);
        if (predEF + lag > maxPredEF) maxPredEF = predEF + lag;
      });
      ES.set(curr, maxPredEF);
    }
    EF.set(curr, ES.get(curr) + dur);

    succsMap.get(curr).forEach(succDep => {
      const succId = succDep.task_id;
      inDegree.set(succId, inDegree.get(succId) - 1);
      if (inDegree.get(succId) === 0) queue.push(succId);
    });
  }

  // Si hubo ciclos o tareas no alcanzadas, completamos ES/EF con su fecha planificada
  tasks.forEach(t => {
    if (!ES.has(t.id)) {
      const s = parseDate(t.start_date);
      const offset = s ? Math.max(0, Math.round((s - minProjTime) / dayMs)) : 0;
      ES.set(t.id, offset);
      EF.set(t.id, offset + durations.get(t.id));
      topoOrder.push(t.id);
    }
  });

  // Determinar fin del proyecto
  let projectFinish = 0;
  tasks.forEach(t => {
    const ef = EF.get(t.id) || 0;
    if (ef > projectFinish) projectFinish = ef;
  });

  // Backward Pass (LF & LS)
  const LF = new Map();
  const LS = new Map();

  for (let i = topoOrder.length - 1; i >= 0; i--) {
    const curr = topoOrder[i];
    const dur = durations.get(curr);
    const succs = succsMap.get(curr);

    if (!succs || succs.length === 0) {
      LF.set(curr, projectFinish);
    } else {
      let minSuccLS = Infinity;
      succs.forEach(s => {
        const succLS = LS.get(s.task_id) ?? projectFinish;
        const lag = Number(s.lag_days || 0);
        if (succLS - lag < minSuccLS) minSuccLS = succLS - lag;
      });
      LF.set(curr, minSuccLS === Infinity ? projectFinish : minSuccLS);
    }
    LS.set(curr, LF.get(curr) - dur);
  }

  // Cálculo de holgura (Slack / Float)
  const criticalTaskIds = [];
  tasks.forEach(t => {
    const es = ES.get(t.id) ?? 0;
    const ls = LS.get(t.id) ?? 0;
    const slack = ls - es;
    if (Math.abs(slack) <= 0.001) {
      criticalTaskIds.push(t.id);
    }
  });

  return criticalTaskIds;
}

/**
 * Comprueba si añadir una arista task_id -> predecessor_id generaría un ciclo.
 */
function wouldFormCycle(existingDependencies, fromPredecessorId, toTaskId) {
  if (fromPredecessorId === toTaskId) return true;
  const adj = new Map();
  existingDependencies.forEach(d => {
    if (!adj.has(d.predecessor_id)) adj.set(d.predecessor_id, []);
    adj.get(d.predecessor_id).push(d.task_id);
  });
  if (!adj.has(fromPredecessorId)) adj.set(fromPredecessorId, []);
  adj.get(fromPredecessorId).push(toTaskId);

  const visited = new Set();
  const recStack = new Set();

  function dfs(u) {
    visited.add(u);
    recStack.add(u);
    const neighbors = adj.get(u) || [];
    for (const v of neighbors) {
      if (!visited.has(v)) {
        if (dfs(v)) return true;
      } else if (recStack.has(v)) {
        return true;
      }
    }
    recStack.delete(u);
    return false;
  }

  return dfs(fromPredecessorId);
}

// -------------------------------------------------------------------------
// Controladores de Gantt
// -------------------------------------------------------------------------

async function getGanttData(req, res) {
  const database = req.app.locals.database;
  const organizationId = req.session.user.organization_id;
  const projectIdQuery = req.query.project_id ? Number(req.query.project_id) : null;

  try {
    // Proyectos accesibles
    const projects = await database.prepare(`
      SELECT id, name, description, start_date, end_date, status, priority, progress
      FROM projects
      WHERE organization_id = ?
      ORDER BY name ASC
    `).all(organizationId);

    // Consulta de tareas
    const taskFilters = ['tasks.organization_id = ?'];
    const taskParams = [organizationId];

    if (projectIdQuery && Number.isInteger(projectIdQuery)) {
      taskFilters.push('tasks.project_id = ?');
      taskParams.push(projectIdQuery);
    }

    const tasks = await database.prepare(`
      SELECT tasks.*,
             users.name AS assignee_name,
             users.username AS assignee_username,
             projects.name AS project_name,
             pt.title AS parent_title
      FROM tasks
      JOIN projects ON projects.id = tasks.project_id
      LEFT JOIN users ON users.id = tasks.assigned_to
      LEFT JOIN tasks pt ON pt.id = tasks.parent_id AND pt.organization_id = tasks.organization_id
      WHERE ${taskFilters.join(' AND ')}
      ORDER BY tasks.project_id, COALESCE(tasks.parent_id, tasks.id), tasks.id
    `).all(...taskParams);

    // Consulta de dependencias
    const depFilters = ['task_dependencies.organization_id = ?'];
    const depParams = [organizationId];
    if (projectIdQuery && Number.isInteger(projectIdQuery)) {
      depFilters.push('task_dependencies.project_id = ?');
      depParams.push(projectIdQuery);
    }

    const dependencies = await database.prepare(`
      SELECT td.*,
             pt.title AS predecessor_title,
             tt.title AS task_title
      FROM task_dependencies td
      JOIN tasks pt ON pt.id = td.predecessor_id
      JOIN tasks tt ON tt.id = td.task_id
      WHERE ${depFilters.join(' AND ')}
    `).all(...depParams);

    // Identificar tareas padre / de resumen y contar subtareas
    const subtasksCountMap = new Map();
    tasks.forEach(t => {
      if (t.parent_id) {
        subtasksCountMap.set(t.parent_id, (subtasksCountMap.get(t.parent_id) || 0) + 1);
      }
    });

    const enrichedTasks = tasks.map(t => ({
      ...t,
      is_summary: (subtasksCountMap.get(t.id) || 0) > 0,
      subtasks_count: subtasksCountMap.get(t.id) || 0
    }));

    // Calcular Ruta Crítica por proyecto
    const criticalPathTaskIds = computeCriticalPath(enrichedTasks, dependencies);

    res.json({
      projects,
      tasks: enrichedTasks,
      dependencies,
      criticalPathTaskIds
    });
  } catch (error) {
    console.error('Error al obtener datos de Gantt:', error);
    res.status(500).json({ error: 'Error al consultar datos del diagrama de Gantt.' });
  }
}

async function createDependency(req, res) {
  const database = req.app.locals.database;
  const organizationId = req.session.user.organization_id;
  const { task_id, predecessor_id, dependency_type = 'FS', lag_days = 0 } = req.body;

  const taskIdNum = Number(task_id);
  const predIdNum = Number(predecessor_id);

  if (!Number.isInteger(taskIdNum) || !Number.isInteger(predIdNum)) {
    return res.status(400).json({ error: 'Identificadores de tarea no válidos.' });
  }
  if (taskIdNum === predIdNum) {
    return res.status(400).json({ error: 'Una tarea no puede depender de sí misma.' });
  }
  if (!['FS', 'SS', 'FF', 'SF'].includes(dependency_type)) {
    return res.status(400).json({ error: 'Tipo de dependencia no válido (FS, SS, FF, SF).' });
  }

  try {
    const task = await database.prepare('SELECT id, project_id FROM tasks WHERE id = ? AND organization_id = ?').get(taskIdNum, organizationId);
    const pred = await database.prepare('SELECT id, project_id FROM tasks WHERE id = ? AND organization_id = ?').get(predIdNum, organizationId);

    if (!task || !pred) {
      return res.status(404).json({ error: 'Una o ambas tareas no existen.' });
    }
    if (task.project_id !== pred.project_id) {
      return res.status(400).json({ error: 'Ambas tareas deben pertenecer al mismo proyecto.' });
    }

    // Verificar si ya existe
    const existing = await database.prepare(`
      SELECT id FROM task_dependencies
      WHERE organization_id = ? AND task_id = ? AND predecessor_id = ?
    `).get(organizationId, taskIdNum, predIdNum);
    if (existing) {
      return res.status(409).json({ error: 'Esta dependencia ya existe.' });
    }

    // Comprobar detección de ciclos
    const allDeps = await database.prepare(`
      SELECT task_id, predecessor_id FROM task_dependencies
      WHERE organization_id = ? AND project_id = ?
    `).all(organizationId, task.project_id);

    if (wouldFormCycle(allDeps, predIdNum, taskIdNum)) {
      return res.status(400).json({ error: 'No se puede crear la dependencia: generaría una dependencia circular (bucle).' });
    }

    const result = await database.prepare(`
      INSERT INTO task_dependencies (organization_id, project_id, task_id, predecessor_id, dependency_type, lag_days)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING id
    `).run(organizationId, task.project_id, taskIdNum, predIdNum, dependency_type, Number(lag_days || 0));

    res.status(201).json({
      ok: true,
      id: result.lastInsertRowid,
      message: 'Dependencia creada correctamente.'
    });
  } catch (error) {
    console.error('Error al crear dependencia:', error);
    res.status(500).json({ error: 'Error al registrar la dependencia.' });
  }
}

async function deleteDependency(req, res) {
  const database = req.app.locals.database;
  const organizationId = req.session.user.organization_id;
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'ID de dependencia no válido.' });
  }

  try {
    const deleted = await database.prepare(`
      DELETE FROM task_dependencies
      WHERE id = ? AND organization_id = ?
    `).run(id, organizationId);

    if (!deleted || deleted.changes === 0) {
      return res.status(404).json({ error: 'La dependencia no existe o ya fue eliminada.' });
    }

    res.json({ ok: true, message: 'Dependencia eliminada con éxito.' });
  } catch (error) {
    console.error('Error al eliminar dependencia:', error);
    res.status(500).json({ error: 'Error al eliminar la dependencia.' });
  }
}

async function saveBaseline(req, res) {
  const database = req.app.locals.database;
  const organizationId = req.session.user.organization_id;
  const { project_id, task_id } = req.body;

  try {
    if (task_id) {
      await database.prepare(`
        UPDATE tasks
        SET baseline_start_date = start_date,
            baseline_due_date = due_date,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND organization_id = ?
      `).run(Number(task_id), organizationId);
      return res.json({ ok: true, message: 'Línea base guardada para la tarea.' });
    }

    if (project_id) {
      const result = await database.prepare(`
        UPDATE tasks
        SET baseline_start_date = start_date,
            baseline_due_date = due_date,
            updated_at = CURRENT_TIMESTAMP
        WHERE project_id = ? AND organization_id = ?
      `).run(Number(project_id), organizationId);
      return res.json({ ok: true, message: `Línea base guardada para el proyecto (${result.changes || 0} tareas).` });
    }

    // Todas las tareas de la organización
    const result = await database.prepare(`
      UPDATE tasks
      SET baseline_start_date = start_date,
          baseline_due_date = due_date,
          updated_at = CURRENT_TIMESTAMP
      WHERE organization_id = ?
    `).run(organizationId);

    res.json({ ok: true, message: `Línea base global actualizada (${result.changes || 0} tareas).` });
  } catch (error) {
    console.error('Error al guardar línea base:', error);
    res.status(500).json({ error: 'Error al guardar la línea base.' });
  }
}

async function autoSchedule(req, res) {
  const database = req.app.locals.database;
  const organizationId = req.session.user.organization_id;
  const projectId = req.body.project_id ? Number(req.body.project_id) : null;

  if (!projectId) {
    return res.status(400).json({ error: 'Debes indicar el proyecto a programar automáticamente.' });
  }

  try {
    const tasks = await database.prepare(`
      SELECT id, start_date, due_date, is_milestone
      FROM tasks
      WHERE project_id = ? AND organization_id = ?
    `).all(projectId, organizationId);

    const dependencies = await database.prepare(`
      SELECT task_id, predecessor_id, dependency_type, lag_days
      FROM task_dependencies
      WHERE project_id = ? AND organization_id = ?
    `).all(projectId, organizationId);

    const taskMap = new Map();
    tasks.forEach(t => taskMap.set(t.id, { ...t }));

    const dayMs = 86400000;
    const addDays = (iso, d) => {
      const dt = new Date(`${iso}T00:00:00`);
      dt.setDate(dt.getDate() + d);
      return dt.toISOString().slice(0, 10);
    };

    let updatedCount = 0;
    // Hasta N pasadas de propagación
    for (let pass = 0; pass < tasks.length; pass++) {
      let changed = false;
      dependencies.forEach(dep => {
        if (dep.dependency_type !== 'FS') return;
        const pred = taskMap.get(dep.predecessor_id);
        const succ = taskMap.get(dep.task_id);
        if (!pred || !succ || !pred.due_date) return;

        const minStartDate = addDays(pred.due_date, 1 + Number(dep.lag_days || 0));
        if (!succ.start_date || succ.start_date < minStartDate) {
          const durationDays = succ.is_milestone
            ? 0
            : (succ.start_date && succ.due_date
                ? Math.max(0, Math.round((new Date(`${succ.due_date}T00:00:00`) - new Date(`${succ.start_date}T00:00:00`)) / dayMs))
                : 1);

          succ.start_date = minStartDate;
          succ.due_date = succ.is_milestone ? minStartDate : addDays(minStartDate, durationDays);
          changed = true;
          updatedCount++;
        }
      });
      if (!changed) break;
    }

    for (const t of taskMap.values()) {
      await database.prepare(`
        UPDATE tasks
        SET start_date = ?, due_date = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND organization_id = ?
      `).run(t.start_date, t.due_date, t.id, organizationId);
    }

    res.json({
      ok: true,
      message: `Programación automática completada (${updatedCount} tareas alineadas según dependencias).`
    });
  } catch (error) {
    console.error('Error en autoSchedule:', error);
    res.status(500).json({ error: 'Error al reprogramar tareas.' });
  }
}

/**
 * Exportador a formato nativo de GanttProject (.gan - XML).
 * Totalmente compatible con la aplicación oficial de GanttProject (bardsoftware/ganttproject).
 */
async function exportGanttProjectGan(req, res) {
  const database = req.app.locals.database;
  const organizationId = req.session.user.organization_id;
  const projectId = req.query.project_id ? Number(req.query.project_id) : null;

  try {
    let project = null;
    if (projectId) {
      project = await database.prepare('SELECT * FROM projects WHERE id = ? AND organization_id = ?').get(projectId, organizationId);
    }
    const projectName = project ? project.name : 'Proyecto Haitani';
    const safeSlug = (project ? project.name : 'haitani').toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const tasks = await database.prepare(`
      SELECT tasks.*, users.name AS assignee_name, users.email AS assignee_email
      FROM tasks
      LEFT JOIN users ON users.id = tasks.assigned_to
      WHERE tasks.organization_id = ? ${projectId ? 'AND tasks.project_id = ?' : ''}
      ORDER BY tasks.project_id, COALESCE(tasks.parent_id, tasks.id), tasks.id
    `).all(...(projectId ? [organizationId, projectId] : [organizationId]));

    const dependencies = await database.prepare(`
      SELECT td.*
      FROM task_dependencies td
      WHERE td.organization_id = ? ${projectId ? 'AND td.project_id = ?' : ''}
    `).all(...(projectId ? [organizationId, projectId] : [organizationId]));

    const depsByTaskId = new Map();
    dependencies.forEach(d => {
      if (!depsByTaskId.has(d.task_id)) depsByTaskId.set(d.task_id, []);
      depsByTaskId.get(d.task_id).push(d);
    });

    const dayMs = 86400000;
    const calcDuration = t => {
      if (t.is_milestone) return 0;
      if (!t.start_date || !t.due_date) return 1;
      return Math.max(1, Math.round((new Date(`${t.due_date}T00:00:00`) - new Date(`${t.start_date}T00:00:00`)) / dayMs) + 1);
    };

    const xmlEscape = str => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // Construir estructura jerárquica
    const topTasks = tasks.filter(t => !t.parent_id);
    const childrenMap = new Map();
    tasks.forEach(t => {
      if (t.parent_id) {
        if (!childrenMap.has(t.parent_id)) childrenMap.set(t.parent_id, []);
        childrenMap.get(t.parent_id).push(t);
      }
    });

    function renderTaskXml(t) {
      const dur = calcDuration(t);
      const isMilestone = Boolean(t.is_milestone);
      const start = t.start_date || new Date().toISOString().slice(0, 10);
      const progress = Number(t.progress || 0);
      const deps = depsByTaskId.get(t.id) || [];
      const children = childrenMap.get(t.id) || [];

      let xml = `    <task id="${t.id}" name="${xmlEscape(t.title)}" meeting="${isMilestone}" start="${start}" duration="${dur}" complete="${progress}" expand="true">\n`;
      if (t.description) {
        xml += `      <notes><![CDATA[${t.description}]]></notes>\n`;
      }
      deps.forEach(d => {
        // En GanttProject: type="2" es Finish-to-Start (FS)
        xml += `      <depend id="${d.predecessor_id}" type="2" difference="${d.lag_days || 0}" hardness="Strong"/>\n`;
      });
      children.forEach(c => {
        xml += renderTaskXml(c);
      });
      xml += `    </task>\n`;
      return xml;
    }

    // Recursos únicos
    const resourceMap = new Map();
    tasks.forEach(t => {
      if (t.assigned_to && t.assignee_name) {
        resourceMap.set(t.assigned_to, { id: t.assigned_to, name: t.assignee_name, email: t.assignee_email || '' });
      }
    });

    let resourcesXml = '';
    let allocationsXml = '';
    resourceMap.forEach(r => {
      resourcesXml += `    <resource id="${r.id}" name="${xmlEscape(r.name)}" function="Default:0" contacts="${xmlEscape(r.email)}" phone=""/>\n`;
    });
    tasks.forEach(t => {
      if (t.assigned_to) {
        allocationsXml += `    <allocation task-id="${t.id}" resource-id="${t.assigned_to}" function="Default:0" responsible="true" load="100.0"/>\n`;
      }
    });

    const ganXml = `<?xml version="1.0" encoding="UTF-8"?><project name="${xmlEscape(projectName)}" company="Haitani" webLink="https://haitani.local" view-date="${new Date().toISOString().slice(0, 10)}" view-index="0" gantt-divider-location="380" resource-divider-location="300" version="3.3.3300" locale="es">
  <description><![CDATA[Exportado desde Haitani Project Management con compatibilidad completa para GanttProject.]]></description>
  <view zooming-state="default:2" id="gantt-chart"/>
  <calendars>
    <day-types>
      <day-type id="0"/>
      <day-type id="1"/>
      <default-week id="1" name="default" sun="1" mon="0" tue="0" wed="0" thu="0" fri="0" sat="1"/>
    </day-types>
  </calendars>
  <tasks empty-milestones="true">
    <taskproperties>
      <taskproperty id="tpd0" name="type" type="default" valuetype="icon"/>
      <taskproperty id="tpd1" name="priority" type="default" valuetype="icon"/>
      <taskproperty id="tpd2" name="info" type="default" valuetype="icon"/>
      <taskproperty id="tpd3" name="name" type="default" valuetype="text"/>
      <taskproperty id="tpd4" name="begindate" type="default" valuetype="date"/>
      <taskproperty id="tpd5" name="enddate" type="default" valuetype="date"/>
      <taskproperty id="tpd6" name="duration" type="default" valuetype="int"/>
      <taskproperty id="tpd7" name="completion" type="default" valuetype="int"/>
      <taskproperty id="tpd8" name="coordinator" type="default" valuetype="text"/>
      <taskproperty id="tpd9" name="predecessorsr" type="default" valuetype="text"/>
    </taskproperties>
${topTasks.map(renderTaskXml).join('')}  </tasks>
  <resources>
${resourcesXml}  </resources>
  <allocations>
${allocationsXml}  </allocations>
</project>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ganttproject-${safeSlug}.gan"`);
    res.send(ganXml);
  } catch (error) {
    console.error('Error al exportar a .gan:', error);
    res.status(500).json({ error: 'Error al exportar archivo GanttProject.' });
  }
}

/**
 * Exportador de Gantt a formato CSV estándar.
 */
async function exportGanttCsv(req, res) {
  const database = req.app.locals.database;
  const organizationId = req.session.user.organization_id;
  const projectId = req.query.project_id ? Number(req.query.project_id) : null;

  try {
    const tasks = await database.prepare(`
      SELECT tasks.*, users.name AS assignee_name, projects.name AS project_name
      FROM tasks
      JOIN projects ON projects.id = tasks.project_id
      LEFT JOIN users ON users.id = tasks.assigned_to
      WHERE tasks.organization_id = ? ${projectId ? 'AND tasks.project_id = ?' : ''}
      ORDER BY tasks.project_id, COALESCE(tasks.parent_id, tasks.id), tasks.id
    `).all(...(projectId ? [organizationId, projectId] : [organizationId]));

    const deps = await database.prepare(`
      SELECT task_id, predecessor_id, dependency_type
      FROM task_dependencies
      WHERE organization_id = ?
    `).all(organizationId);

    const depsMap = new Map();
    deps.forEach(d => {
      if (!depsMap.has(d.task_id)) depsMap.set(d.task_id, []);
      depsMap.get(d.task_id).push(d.predecessor_id);
    });

    const dayMs = 86400000;
    const rows = [
      ['ID', 'Proyecto', 'Título', 'Tipo', 'Inicio', 'Fin', 'Duración (días)', 'Progreso (%)', 'Predecesoras', 'Responsable', 'Prioridad', 'Estado']
    ];

    tasks.forEach(t => {
      const type = t.is_milestone ? 'Hito' : (t.parent_id ? 'Subtarea' : 'Tarea');
      const dur = t.is_milestone
        ? 0
        : (t.start_date && t.due_date
            ? Math.max(1, Math.round((new Date(`${t.due_date}T00:00:00`) - new Date(`${t.start_date}T00:00:00`)) / dayMs) + 1)
            : 1);
      const preds = (depsMap.get(t.id) || []).join(';');

      rows.push([
        t.id,
        `"${String(t.project_name || '').replace(/"/g, '""')}"`,
        `"${String(t.title || '').replace(/"/g, '""')}"`,
        type,
        t.start_date || '',
        t.due_date || '',
        dur,
        t.progress || 0,
        `"${preds}"`,
        `"${String(t.assignee_name || 'Sin asignar').replace(/"/g, '""')}"`,
        t.priority,
        t.status
      ]);
    });

    const csvContent = rows.map(r => r.join(',')).join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="diagrama-gantt.csv"');
    res.send(csvContent);
  } catch (error) {
    console.error('Error al exportar CSV de Gantt:', error);
    res.status(500).json({ error: 'Error al exportar CSV.' });
  }
}

/**
 * Importador de proyectos GanttProject (.gan - XML).
 * Lee el archivo XML y recrea las tareas, duraciones, fechas, hitos y dependencias.
 */
async function importGanttProjectGan(req, res) {
  const database = req.app.locals.database;
  const organizationId = req.session.user.organization_id;

  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ error: 'Debes subir un archivo .gan (GanttProject XML).' });
  }

  const xml = req.file.buffer.toString('utf-8');
  let projectId = req.body.project_id ? Number(req.body.project_id) : null;

  try {
    // Si no se proporcionó un proyecto, se busca o crea según el atributo name del proyecto XML
    if (!projectId) {
      const projMatch = xml.match(/<project\s+[^>]*name="([^"]+)"/i);
      const projName = projMatch ? projMatch[1] : 'Proyecto Importado GanttProject';
      const createdProj = await database.prepare(`
        INSERT INTO projects (name, description, organization_id)
        VALUES (?, 'Importado desde archivo GanttProject', ?)
        RETURNING id
      `).run(projName, organizationId);
      projectId = createdProj.lastInsertRowid;
    }

    // Parser regex de tareas en XML de GanttProject
    const taskRegex = /<task\s+([^>]+?)(?:\/>|>([\s\S]*?)<\/task>)/gi;
    let match;
    const parsedTasks = [];
    const idMap = new Map(); // ganId -> haitaniTaskId
    const dependenciesToCreate = [];

    const dayMs = 86400000;
    const addDays = (iso, d) => {
      const dt = new Date(`${iso}T00:00:00`);
      dt.setDate(dt.getDate() + d);
      return dt.toISOString().slice(0, 10);
    };

    while ((match = taskRegex.exec(xml)) !== null) {
      const attrString = match[1];
      const innerContent = match[2] || '';

      const getAttr = name => {
        const m = attrString.match(new RegExp(`${name}="([^"]*)"`, 'i'));
        return m ? m[1] : null;
      };

      const ganId = getAttr('id');
      const name = getAttr('name');
      const start = getAttr('start');
      const duration = parseInt(getAttr('duration') || '1', 10);
      const complete = parseInt(getAttr('complete') || '0', 10);
      const meeting = getAttr('meeting') === 'true';

      if (!name) continue;

      let due = start;
      if (!meeting && start && duration > 1) {
        due = addDays(start, duration - 1);
      }

      parsedTasks.push({
        ganId,
        name,
        start,
        due,
        meeting,
        complete,
        innerContent
      });
    }

    // Insertar tareas en base de datos
    for (const pt of parsedTasks) {
      const status = pt.complete >= 100 ? 'completada' : (pt.complete > 0 ? 'en_proceso' : 'pendiente');
      const result = await database.prepare(`
        INSERT INTO tasks (
          project_id, organization_id, creator_id, title, description,
          start_date, due_date, status, is_milestone, progress
        )
        VALUES (?, ?, ?, ?, 'Importada de GanttProject', ?, ?, ?, ?, ?)
        RETURNING id
      `).run(
        projectId,
        organizationId,
        req.session.user.id,
        pt.name,
        pt.start || null,
        pt.due || null,
        status,
        pt.meeting,
        pt.complete
      );

      const newId = result.lastInsertRowid;
      if (pt.ganId) {
        idMap.set(pt.ganId, newId);
      }

      // Buscar <depend id="X" .../> dentro de innerContent
      const depRegex = /<depend\s+[^>]*id="([^"]+)"[^>]*>/gi;
      let depMatch;
      while ((depMatch = depRegex.exec(pt.innerContent)) !== null) {
        dependenciesToCreate.push({
          task_gan_id: pt.ganId,
          pred_gan_id: depMatch[1]
        });
      }
    }

    // Insertar dependencias mapeadas
    let depCount = 0;
    for (const dep of dependenciesToCreate) {
      const haitaniTaskId = idMap.get(dep.task_gan_id);
      const haitaniPredId = idMap.get(dep.pred_gan_id);

      if (haitaniTaskId && haitaniPredId && haitaniTaskId !== haitaniPredId) {
        try {
          await database.prepare(`
            INSERT INTO task_dependencies (organization_id, project_id, task_id, predecessor_id, dependency_type)
            VALUES (?, ?, ?, ?, 'FS')
            ON CONFLICT (task_id, predecessor_id) DO NOTHING
          `).run(organizationId, projectId, haitaniTaskId, haitaniPredId);
          depCount++;
        } catch (e) {
          // Ignorar dependencias duplicadas o cíclicas
        }
      }
    }

    res.json({
      ok: true,
      message: `Proyecto importado con éxito: ${parsedTasks.length} tareas e hitos creados, ${depCount} dependencias vinculadas.`,
      projectId,
      taskCount: parsedTasks.length,
      dependencyCount: depCount
    });
  } catch (error) {
    console.error('Error al importar archivo .gan:', error);
    res.status(500).json({ error: 'Error al procesar el archivo GanttProject.' });
  }
}

module.exports = {
  getGanttData,
  createDependency,
  deleteDependency,
  saveBaseline,
  autoSchedule,
  exportGanttProjectGan,
  exportGanttCsv,
  importGanttProjectGan,
  computeCriticalPath
};
