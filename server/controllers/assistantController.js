const sanzuService = require('../services/sanzuService');

async function projectContext(database, organizationId) {
  const [project, tasks, users, github, risks, files] = await Promise.all([
    database.prepare('SELECT * FROM projects WHERE organization_id = ? ORDER BY id LIMIT 1').get(organizationId),
    database.prepare(`SELECT tasks.id, tasks.title, tasks.description, tasks.status, tasks.priority, tasks.due_date, tasks.assigned_to, users.name AS assignee_name FROM tasks LEFT JOIN users ON users.id = tasks.assigned_to WHERE tasks.organization_id = ? ORDER BY tasks.due_date`).all(organizationId),
    database.prepare('SELECT id, name, role, active FROM users WHERE organization_id = ? ORDER BY name').all(organizationId),
    database.prepare('SELECT repository FROM github_project_configurations WHERE organization_id = ? ORDER BY updated_at DESC LIMIT 1').get(organizationId),
    database.prepare(`SELECT id, title, probability, impact, status, mitigation, severity_score FROM project_risks WHERE organization_id = ? ORDER BY severity_score DESC`).all(organizationId).catch(() => []),
    database.prepare(`SELECT id, filename, category, mime_type FROM files WHERE organization_id = ? ORDER BY id DESC`).all(organizationId).catch(() => [])
  ]);
  return { project, tasks, users, github, risks: risks || [], files: files || [], repositoryName: github?.repository || project?.name || 'Repositorio' };
}

function normalizeText(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function localAnswer(message, context) {
  const methodology = context.project?.methodology_id || 'sin metodología definida';
  const openTasks = (context.tasks || []).filter(task => task.status !== 'completada');
  const now = new Date();
  const overdue = openTasks.filter(task => task.due_date && new Date(`${task.due_date}T23:59:59`) < now);
  const normalized = normalizeText(message);

  // 1. RETRASOS / VENCIDAS
  if (normalized.includes('venc') || normalized.includes('retras') || normalized.includes('atras') || normalized.includes('demor')) {
    if (!overdue.length) {
      return `Con metodología ${methodology}, no hay tareas vencidas ni con retraso registradas actualmente. Todas las tareas abiertas están dentro de sus plazos programados.`;
    }
    const delayDetails = overdue.map(t => {
      const due = new Date(`${t.due_date}T23:59:59`);
      const diffDays = Math.max(1, Math.floor((now - due) / (1000 * 60 * 60 * 24)));
      const resp = t.assignee_name ? ` (responsable: ${t.assignee_name})` : ' (sin asignar)';
      return `• "${t.title}" - vencida hace ${diffDays} día(s)${resp}`;
    }).join('\n');
    return `Con metodología ${methodology}, hay ${overdue.length} tarea(s) vencida(s):\n${delayDetails}\nSe recomienda reasignar recursos o ajustar la planificación de inmediato.`;
  }

  // 2. TAREAS CRÍTICAS
  if (normalized.includes('critic') || normalized.includes('urgente') || normalized.includes('bloquea') || normalized.includes('tarea crítica') || normalized.includes('tareas criticas')) {
    const criticals = openTasks.filter(t => t.priority === 'critica' || t.priority === 'alta' || t.status === 'bloqueada');
    if (!criticals.length) {
      return `Con metodología ${methodology}, no hay tareas críticas ni bloqueadas pendientes en este momento.`;
    }
    const list = criticals.map(t => {
      const resp = t.assignee_name ? ` (asignada a: ${t.assignee_name})` : ' (sin asignar)';
      const statusText = t.status === 'bloqueada' ? ' [BLOQUEADA]' : ` [prioridad ${t.priority}]`;
      const dueText = t.due_date ? ` - Límite: ${t.due_date}` : '';
      return `• "${t.title}"${statusText}${resp}${dueText}`;
    }).join('\n');
    return `Se identificaron ${criticals.length} tarea(s) crítica(s) o prioritarias abiertas:\n${list}\nEstas tareas deben tener foco prioritario en el ciclo de trabajo actual.`;
  }

  // 3. DOCUMENTACIÓN FALTANTE
  if (normalized.includes('document') || normalized.includes('doc') || normalized.includes('especific') || normalized.includes('faltante') || normalized.includes('requisito')) {
    const findings = [];
    if (!context.project?.requirements || context.project.requirements.trim().length < 10) {
      findings.push('• Requisitos del proyecto: No se han definido formalmente los requerimientos o el alcance del proyecto.');
    }
    if (!context.project?.description || context.project.description.trim().length < 5) {
      findings.push('• Descripción del proyecto: El proyecto no cuenta con una descripción detallada.');
    }
    const tasksWithoutDesc = openTasks.filter(t => !t.description || t.description.trim().length === 0);
    if (tasksWithoutDesc.length > 0) {
      findings.push(`• Tareas sin descripción detallada: ${tasksWithoutDesc.length} tarea(s) no tienen descripción de criterios o alcance (${tasksWithoutDesc.slice(0, 3).map(t => t.title).join(', ')}${tasksWithoutDesc.length > 3 ? '...' : ''}).`);
    }
    const filesCount = context.files?.length || 0;
    if (filesCount === 0) {
      findings.push('• Archivos y entregables: No se han subido documentos o especificaciones adjuntas al repositorio/archivos del proyecto.');
    }
    if (!findings.length) {
      return `La documentación del proyecto ${context.project?.name || ''} está al día: cuenta con requisitos registrados, descripciones en sus tareas y ${filesCount} archivo(s) documentales vinculados.`;
    }
    return `Diagnóstico de documentación faltante en el proyecto (${methodology}):\n${findings.join('\n')}\nSe sugiere completar estas especificaciones para reducir incertidumbre técnica.`;
  }

  // 4. WORKLOAD / CARGA DE TRABAJO
  if (normalized.includes('workload') || normalized.includes('carga') || normalized.includes('distribuci') || normalized.includes('asignaci')) {
    const userWorkload = {};
    const activeUsers = (context.users || []).filter(u => u.active);
    activeUsers.forEach(u => {
      userWorkload[u.name] = { total: 0, critical: 0, overdue: 0 };
    });
    let unassigned = 0;
    openTasks.forEach(t => {
      if (!t.assignee_name) {
        unassigned++;
      } else {
        if (!userWorkload[t.assignee_name]) {
          userWorkload[t.assignee_name] = { total: 0, critical: 0, overdue: 0 };
        }
        userWorkload[t.assignee_name].total++;
        if (t.priority === 'alta' || t.priority === 'critica') userWorkload[t.assignee_name].critical++;
        if (t.due_date && new Date(`${t.due_date}T23:59:59`) < now) userWorkload[t.assignee_name].overdue++;
      }
    });

    const entries = Object.entries(userWorkload);
    const breakdown = entries.map(([name, data]) => {
      const alerts = [];
      if (data.critical > 0) alerts.push(`${data.critical} crítica(s)`);
      if (data.overdue > 0) alerts.push(`${data.overdue} vencida(s)`);
      const alertStr = alerts.length ? ` (${alerts.join(', ')})` : '';
      return `• ${name}: ${data.total} tarea(s) abierta(s)${alertStr}`;
    }).join('\n');

    const unassignedStr = unassigned > 0 ? `\n• Sin asignar: ${unassigned} tarea(s) pendiente(s).` : '';
    return `Distribución de carga de trabajo (Workload) - ${openTasks.length} tareas abiertas en total:\n${breakdown}${unassignedStr}`;
  }

  // 5. RIESGOS
  if (normalized.includes('riesgo') || normalized.includes('amenaza') || normalized.includes('risk')) {
    const projectRisks = (context.risks || []).filter(r => r.status === 'open' || r.status === 'activo');
    const riskFindings = [];

    if (projectRisks.length > 0) {
      projectRisks.forEach(r => {
        riskFindings.push(`• Riesgo registrado: "${r.title}" (Probabilidad: ${r.probability}, Impacto: ${r.impact})${r.mitigation ? ` - Mitigación: ${r.mitigation}` : ''}`);
      });
    }

    // Análisis heurístico de riesgos operativos
    if (overdue.length > 0) {
      riskFindings.push(`• Riesgo de cronograma: ${overdue.length} tarea(s) ya han superado su fecha límite.`);
    }
    const unassignedCriticals = openTasks.filter(t => !t.assignee_name && (t.priority === 'alta' || t.priority === 'critica'));
    if (unassignedCriticals.length > 0) {
      riskFindings.push(`• Riesgo de ejecución: ${unassignedCriticals.length} tarea(s) de alta prioridad no tienen responsable asignado.`);
    }

    if (!riskFindings.length) {
      return `No se detectan riesgos críticos abiertos en el proyecto. El cronograma y las tareas prioritarias se encuentran bajo control.`;
    }
    return `Evaluación de riesgos del proyecto (${context.project?.name || 'General'}):\n${riskFindings.join('\n')}\nSe recomienda revisar las medidas de contingencia.`;
  }

  // 6. PRIORIDADES
  if (normalized.includes('prioridad') || normalized.includes('prioritari') || normalized.includes('orden')) {
    const high = openTasks.filter(t => t.priority === 'alta' || t.priority === 'critica');
    const medium = openTasks.filter(t => t.priority === 'media');
    const low = openTasks.filter(t => t.priority === 'baja');

    const nextActions = [...high, ...medium].slice(0, 4).map(t => {
      const resp = t.assignee_name ? ` [${t.assignee_name}]` : ' [Sin asignar]';
      const due = t.due_date ? ` (Vence: ${t.due_date})` : '';
      return `• [Prioridad ${t.priority.toUpperCase()}] ${t.title}${resp}${due}`;
    }).join('\n');

    return `Desglose de prioridades en tareas abiertas:\n` +
      `• Alta / Crítica: ${high.length} tarea(s)\n` +
      `• Media: ${medium.length} tarea(s)\n` +
      `• Baja: ${low.length} tarea(s)\n\n` +
      `Tareas clave a priorizar:\n${nextActions || 'No hay tareas activas en cola.'}`;
  }

  // PROGRESO / AVANCE
  if (normalized.includes('progreso') || normalized.includes('avance')) {
    const completed = (context.tasks || []).filter(task => task.status === 'completada').length;
    const progress = context.tasks?.length ? Math.round(completed / context.tasks.length * 100) : 0;
    return `Con metodología ${methodology}, el proyecto tiene un avance estimado del ${progress}% (${completed} de ${context.tasks?.length || 0} tareas completadas) y ${openTasks.length} pendientes.`;
  }

  // RESUMEN / REUNION
  if (normalized.includes('resumen') || normalized.includes('reuni')) {
    const completed = (context.tasks || []).filter(task => task.status === 'completada').length;
    const progress = context.tasks?.length ? Math.round(completed / context.tasks.length * 100) : 0;
    const activeUsers = (context.users || []).filter(user => user.active);
    const criticalTasks = openTasks.filter(task => task.priority === 'critica' || task.priority === 'alta');
    const projectName = context.project?.name || context.repositoryName || 'Proyecto';
    const overdueText = overdue.length
      ? `• Atención inmediata: ${overdue.length} tarea(s) vencida(s) (${overdue.slice(0, 3).map(t => t.title).join(', ')}${overdue.length > 3 ? '...' : ''}).`
      : '• Plazos: sin tareas vencidas.';
    return `Resumen para la reunión (${projectName}):\n` +
      `• Metodología: ${methodology}.\n` +
      `• Avance general: ${progress}% (${completed} de ${(context.tasks || []).length} tareas completadas).\n` +
      `• Tareas abiertas: ${openTasks.length} pendientes (${overdue.length} vencidas, ${criticalTasks.length} de alta prioridad).\n` +
      `• Equipo: ${activeUsers.length} integrante(s) activo(s).\n` +
      overdueText;
  }

  return `Puedo ayudarte a revisar ${context.repositoryName}. La metodología actual es ${methodology}. Ahora hay ${openTasks.length} tarea(s) abiertas, ${overdue.length} vencida(s) y ${(context.users || []).filter(user => user.active).length} integrante(s) activo(s). Puedes preguntarme sobre retrasos, tareas críticas, documentación faltante, workload, riesgos y prioridades.`;
}

async function chat(req, res) {
  const message = String(req.body.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Escribe una pregunta.' });
  const database = req.app.locals.database;
  const context = await projectContext(database, req.session.user.organization_id);
  const conversationId = req.body.conversationId || `conv-${req.session.user.organization_id}-${req.session.user.id}`;
  if (req.plan?.features?.ai !== true) {
    return res.json({ answer: localAnswer(message, context), source: 'local', conversationId, context });
  }
  try {
    const project = context.project;
    if (!project) throw new Error('La organización no tiene un proyecto activo.');
    const creds = await sanzuService.resolveOrganizationCredentials(database, req.session.user.organization_id);
    if (!creds.apiKey) {
      return res.json({
        answer: localAnswer(message, context),
        source: 'local',
        warning: 'La Sanzu API Key no está configurada. El administrador debe añadirla en Configuración > Sanzu IA para conectar con Sanzu.',
        conversationId,
        context
      });
    }
    await sanzuService.syncProject(project, creds);
    const result = await sanzuService.askSanzu(
      project,
      message,
      conversationId,
      {
        methodology_id: project.methodology_id,
        requirements: project.requirements,
        tasks: context.tasks,
        users: context.users,
        risks: context.risks,
        files: context.files
      },
      creds
    );
    const answer = result.response || result.answer || result.reply || result.message;
    if (!answer) throw new Error('La respuesta de Sanzu no tiene un formato compatible.');
    return res.json({
      answer,
      source: 'sanzu',
      conversationId: result.conversationId || conversationId,
      sources: result.sources || [],
      suggestions: result.suggestions || [],
      metadata: result.metadata,
      context
    });
  } catch (error) {
    const rawReason = error instanceof Error ? error.message : String(error);
    const { sanitize } = require('../services/sanzuClient');
    const reason = sanitize(rawReason);
    console.warn(`Sanzu no disponible: ${reason}`);
    return res.json({ answer: localAnswer(message, context), source: 'local', warning: `Sanzu no está disponible: ${reason}`, conversationId, context });
  }
}


async function searchDictionary(req, res) {
  try {
    const database = req.app.locals.database;
    const creds = await sanzuService.resolveOrganizationCredentials(database, req.session?.user?.organization_id);
    const { defaultClient } = require('../services/sanzuClient');
    const data = await defaultClient.searchDictionary(req.query, { apiUrl: creds.apiUrl });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(502).json({ success: false, error: 'No fue posible consultar el diccionario en Sanzu.', details: error.message });
  }
}

async function getDictionaryTerm(req, res) {
  try {
    const database = req.app.locals.database;
    const creds = await sanzuService.resolveOrganizationCredentials(database, req.session?.user?.organization_id);
    const { defaultClient } = require('../services/sanzuClient');
    const data = await defaultClient.getDictionaryTerm(req.params.term, { apiUrl: creds.apiUrl });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(502).json({ success: false, error: 'No fue posible obtener el término de Sanzu.', details: error.message });
  }
}

module.exports = { chat, searchDictionary, getDictionaryTerm, localAnswer, projectContext };