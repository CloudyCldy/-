const { askSanzu } = require('../services/sanzuService');

async function projectContext(database, organizationId) {
  const [project, tasks, users] = await Promise.all([
    database.prepare('SELECT * FROM projects WHERE organization_id = ? ORDER BY id LIMIT 1').get(organizationId),
    database.prepare(`SELECT tasks.title, tasks.status, tasks.priority, tasks.due_date, users.name AS assignee_name FROM tasks LEFT JOIN users ON users.id = tasks.assigned_to WHERE tasks.organization_id = ? ORDER BY tasks.due_date`).all(organizationId),
    database.prepare('SELECT name, role, active FROM users WHERE organization_id = ? ORDER BY name').all(organizationId)
  ]);
  return { project, tasks, users };
}

function localAnswer(message, context) {
  const openTasks = context.tasks.filter(task => task.status !== 'completada');
  const overdue = openTasks.filter(task => task.due_date && new Date(`${task.due_date}T23:59:59`) < new Date());
  const normalized = message.toLowerCase();
  if (normalized.includes('venc') || normalized.includes('retras')) return overdue.length ? `Hay ${overdue.length} tarea(s) vencida(s): ${overdue.map(task => task.title).join(', ')}.` : 'No hay tareas vencidas registradas.';
  if (normalized.includes('progreso') || normalized.includes('avance')) {
    const completed = context.tasks.filter(task => task.status === 'completada').length;
    const progress = context.tasks.length ? Math.round(completed / context.tasks.length * 100) : 0;
    return `El proyecto tiene un avance estimado del ${progress}% (${completed} de ${context.tasks.length} tareas completadas) y ${openTasks.length} pendientes.`;
  }
  return `Puedo ayudarte a revisar Sakura Coffee. Ahora hay ${openTasks.length} tarea(s) abiertas, ${overdue.length} vencida(s) y ${context.users.filter(user => user.active).length} integrante(s) activo(s). La API remota no respondió, así que esta es una lectura local del proyecto.`;
}

async function chat(req, res) {
  const message = String(req.body.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Escribe una pregunta.' });
  const context = await projectContext(req.app.locals.database, req.session.user.organization_id);
  if (req.plan?.features?.ai !== true) return res.json({ answer: localAnswer(message, context), source: 'local', context });
  try {
    const result = await askSanzu({ message, context });
    const answer = result.answer || result.response || result.reply || result.message || result.data?.answer || result.data?.response || result.data?.reply || result.data?.message || result.data?.content;
    if (!answer) throw new Error('La respuesta de Sanzu no tiene un formato compatible.');
    return res.json({ answer, source: 'sanzu', context });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`Sanzu no disponible: ${reason}`);
    return res.json({ answer: localAnswer(message, context), source: 'local', warning: `Sanzu no está disponible: ${reason}`, context });
  }
}

module.exports = { chat };