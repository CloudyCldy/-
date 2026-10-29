/**
 * Servicio de detección y gestión de eventos del proyecto (SB-09-ST061, SB-09-ST062)
 */
async function detectAndSyncEvents(database, organizationId, projectId = null) {
  const projectFilter = projectId ? 'AND id = ?' : '';
  const projectParams = projectId ? [organizationId, projectId] : [organizationId];

  const projects = await database.prepare(`SELECT * FROM projects WHERE organization_id = ? ${projectFilter}`).all(...projectParams);
  const detectedEvents = [];

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  for (const proj of projects) {
    const pId = proj.id;

    // 1. Detectar tareas vencidas (task_overdue)
    const overdueTasks = await database.prepare(`
      SELECT id, title, due_date, priority FROM tasks
      WHERE organization_id = ? AND project_id = ? AND status != 'completada' AND due_date IS NOT NULL AND due_date < ?
    `).all(organizationId, pId, todayStr);

    for (const task of overdueTasks) {
      detectedEvents.push({
        organization_id: organizationId,
        project_id: pId,
        event_type: 'task_overdue',
        severity: task.priority === 'alta' || task.priority === 'critica' ? 'high' : 'medium',
        title: `Tarea vencida: ${task.title}`,
        description: `La tarea venció el ${task.due_date ? new Date(task.due_date).toLocaleDateString('es') : 'fecha pasada'}.`,
        payload: { task_id: task.id, due_date: task.due_date }
      });
    }

    // 2. Detectar tareas bloqueadas (task_blocked)
    const blockedTasks = await database.prepare(`
      SELECT id, title, priority FROM tasks
      WHERE organization_id = ? AND project_id = ? AND status = 'bloqueada'
    `).all(organizationId, pId);

    for (const task of blockedTasks) {
      detectedEvents.push({
        organization_id: organizationId,
        project_id: pId,
        event_type: 'task_blocked',
        severity: 'high',
        title: `Tarea bloqueada: ${task.title}`,
        description: `La tarea se encuentra en estado de bloqueo e impide el avance.`,
        payload: { task_id: task.id }
      });
    }

    // 3. Detectar aproximación de fecha límite (deadline_approaching)
    if (proj.end_date && proj.progress < 100) {
      const endDate = new Date(proj.end_date);
      const diffDays = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= 4) {
        detectedEvents.push({
          organization_id: organizationId,
          project_id: pId,
          event_type: 'deadline_approaching',
          severity: diffDays <= 1 ? 'critical' : 'high',
          title: `Fecha límite de proyecto próxima: ${proj.name}`,
          description: `Quedan ${diffDays} día(s) para la entrega final del proyecto (${proj.end_date}).`,
          payload: { days_remaining: diffDays, end_date: proj.end_date }
        });
      }
    }

    // 4. Detectar finalización próxima de sprint (sprint_ending)
    const endingSprints = await database.prepare(`
      SELECT id, name, end_date FROM sprints
      WHERE organization_id = ? AND project_id = ? AND status = 'activo' AND end_date <= ?::date + INTERVAL '3 days'
    `).all(organizationId, pId, todayStr).catch(() => []);

    for (const sprint of endingSprints) {
      detectedEvents.push({
        organization_id: organizationId,
        project_id: pId,
        event_type: 'sprint_ending',
        severity: 'medium',
        title: `Sprint por concluir: ${sprint.name}`,
        description: `El sprint activo finaliza el ${sprint.end_date}. Revisa tareas pendientes para cierre o traspaso.`,
        payload: { sprint_id: sprint.id, end_date: sprint.end_date }
      });
    }

    // 5. Detectar integrantes sobrecargados (member_overloaded)
    const overloadedMembers = await database.prepare(`
      SELECT users.id, users.name, COUNT(tasks.id)::integer AS active_tasks
      FROM users
      JOIN tasks ON tasks.assigned_to = users.id AND tasks.organization_id = ? AND tasks.project_id = ?
      WHERE users.organization_id = ? AND tasks.status IN ('pendiente', 'en_proceso', 'en_revision')
      GROUP BY users.id, users.name
      HAVING COUNT(tasks.id) >= 4
    `).all(organizationId, pId, organizationId);

    for (const member of overloadedMembers) {
      detectedEvents.push({
        organization_id: organizationId,
        project_id: pId,
        event_type: 'member_overloaded',
        severity: member.active_tasks >= 6 ? 'high' : 'medium',
        title: `Integrante con alta carga: ${member.name}`,
        description: `${member.name} tiene ${member.active_tasks} tareas activas asignadas. Considera balancear la carga.`,
        payload: { user_id: member.id, active_tasks: member.active_tasks }
      });
    }

    // 6. Detectar riesgos de alta severidad creados (risk_created)
    const highRisks = await database.prepare(`
      SELECT id, title, impact, probability FROM project_risks
      WHERE organization_id = ? AND project_id = ? AND impact = 'alta' AND status = 'open'
    `).all(organizationId, pId).catch(() => []);

    for (const risk of highRisks) {
      detectedEvents.push({
        organization_id: organizationId,
        project_id: pId,
        event_type: 'risk_created',
        severity: 'high',
        title: `Riesgo crítico detectado: ${risk.title}`,
        description: `Riesgo con impacto alto y probabilidad ${risk.probability}. Requiere plan de mitigación.`,
        payload: { risk_id: risk.id }
      });
    }
  }

  // Guardar en la tabla project_events evitando duplicados abiertos con el mismo título
  for (const evt of detectedEvents) {
    const existing = await database.prepare(`
      SELECT id FROM project_events
      WHERE organization_id = ? AND project_id = ? AND event_type = ? AND title = ? AND resolved = false
    `).get(evt.organization_id, evt.project_id, evt.event_type, evt.title);

    if (!existing) {
      await database.prepare(`
        INSERT INTO project_events (organization_id, project_id, event_type, severity, title, description, payload, resolved)
        VALUES (?, ?, ?, ?, ?, ?, ?, false)
      `).run(evt.organization_id, evt.project_id, evt.event_type, evt.severity, evt.title, evt.description, JSON.stringify(evt.payload));
    }
  }

  return detectedEvents;
}

module.exports = { detectAndSyncEvents };
