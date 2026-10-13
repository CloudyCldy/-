const sanzuService = require('../services/sanzuService');

async function projectContext(database, organizationId) {
  const [project, tasks, users, github] = await Promise.all([
    database.prepare('SELECT * FROM projects WHERE organization_id = ? ORDER BY id LIMIT 1').get(organizationId),
    database.prepare(`SELECT tasks.title, tasks.status, tasks.priority, tasks.due_date, users.name AS assignee_name FROM tasks LEFT JOIN users ON users.id = tasks.assigned_to WHERE tasks.organization_id = ? ORDER BY tasks.due_date`).all(organizationId),
    database.prepare('SELECT name, role, active FROM users WHERE organization_id = ? ORDER BY name').all(organizationId),
    database.prepare('SELECT repository FROM github_project_configurations WHERE organization_id = ? ORDER BY updated_at DESC LIMIT 1').get(organizationId)
  ]);
  return { project, tasks, users, repositoryName: github?.repository || project?.name || 'Repositorio' };
}

function localAnswer(message, context) {
  const methodology = context.project?.methodology_id || 'sin metodología definida';
  const openTasks = context.tasks.filter(task => task.status !== 'completada');
  const overdue = openTasks.filter(task => task.due_date && new Date(`${task.due_date}T23:59:59`) < new Date());
  const normalized = message.toLowerCase();
  if (normalized.includes('venc') || normalized.includes('retras')) {
    return overdue.length
      ? `Con metodología ${methodology}, hay ${overdue.length} tarea(s) vencida(s): ${overdue.map(task => task.title).join(', ')}.`
      : `Con metodología ${methodology}, no hay tareas vencidas registradas.`;
  }
  if (normalized.includes('progreso') || normalized.includes('avance')) {
    const completed = context.tasks.filter(task => task.status === 'completada').length;
    const progress = context.tasks.length ? Math.round(completed / context.tasks.length * 100) : 0;
    return `Con metodología ${methodology}, el proyecto tiene un avance estimado del ${progress}% (${completed} de ${context.tasks.length} tareas completadas) y ${openTasks.length} pendientes.`;
  }
  if (normalized.includes('resumen') || normalized.includes('reuni')) {
    const completed = context.tasks.filter(task => task.status === 'completada').length;
    const progress = context.tasks.length ? Math.round(completed / context.tasks.length * 100) : 0;
    const activeUsers = context.users.filter(user => user.active);
    const criticalTasks = openTasks.filter(task => task.priority === 'critica' || task.priority === 'alta');
    const projectName = context.project?.name || context.repositoryName || 'Proyecto';
    const overdueText = overdue.length
      ? `• Atención inmediata: ${overdue.length} tarea(s) vencida(s) (${overdue.slice(0, 3).map(t => t.title).join(', ')}${overdue.length > 3 ? '...' : ''}).`
      : '• Plazos: sin tareas vencidas.';
    return `Resumen para la reunión (${projectName}):\n` +
      `• Metodología: ${methodology}.\n` +
      `• Avance general: ${progress}% (${completed} de ${context.tasks.length} tareas completadas).\n` +
      `• Tareas abiertas: ${openTasks.length} pendientes (${overdue.length} vencidas, ${criticalTasks.length} de alta prioridad).\n` +
      `• Equipo: ${activeUsers.length} integrante(s) activo(s).\n` +
      overdueText;
  }
  return `Puedo ayudarte a revisar ${context.repositoryName}. La metodología actual es ${methodology}. Ahora hay ${openTasks.length} tarea(s) abiertas, ${overdue.length} vencida(s) y ${context.users.filter(user => user.active).length} integrante(s) activo(s).`;
}

async function chat(req, res) {
  const message = String(req.body.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Escribe una pregunta.' });
  const database = req.app.locals.database;
  const context = await projectContext(database, req.session.user.organization_id);
  if (req.plan?.features?.ai !== true) return res.json({ answer: localAnswer(message, context), source: 'local', context });
  try {
    const project = context.project;
    if (!project) throw new Error('La organización no tiene un proyecto activo.');
    const creds = await sanzuService.resolveOrganizationCredentials(database, req.session.user.organization_id);
    if (!creds.apiKey) {
      return res.json({
        answer: localAnswer(message, context),
        source: 'local',
        warning: 'La Sanzu API Key no está configurada. El administrador debe añadirla en Configuración > Sanzu IA para conectar con Sanzu.',
        context
      });
    }
    await sanzuService.syncProject(project, creds);
    const result = await sanzuService.askSanzu(project, message, req.body.conversationId, { methodology_id: project.methodology_id, requirements: project.requirements }, creds);
    const answer = result.response || result.answer || result.reply || result.message;
    if (!answer) throw new Error('La respuesta de Sanzu no tiene un formato compatible.');
    return res.json({ answer, source: 'sanzu', context });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`Sanzu no disponible: ${reason}`);
    return res.json({ answer: localAnswer(message, context), source: 'local', warning: `Sanzu no está disponible: ${reason}`, context });
  }
}

module.exports = { chat };