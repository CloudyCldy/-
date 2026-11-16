async function dashboard(req, res) {
  const database = req.app.locals.database;
  const orgId = req.session.user.organization_id;
  // Un integrante (member) ve solo sus tareas: sus totales, sus vencidas y su salud.
  // El administrador y el project manager ven los números de toda la organización.
  const isMember = req.session.user.role === 'member';
  const projectId = req.query.project_id && Number.isInteger(Number(req.query.project_id)) ? Number(req.query.project_id) : null;

  const taskWhere = projectId
    ? (isMember ? 'WHERE organization_id = ? AND assigned_to = ? AND project_id = ?' : 'WHERE organization_id = ? AND project_id = ?')
    : (isMember ? 'WHERE organization_id = ? AND assigned_to = ?' : 'WHERE organization_id = ?');
  const args = projectId
    ? (isMember ? [orgId, req.session.user.id, projectId] : [orgId, projectId])
    : (isMember ? [orgId, req.session.user.id] : [orgId]);

  const now = new Date();
  const todayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
  const nextWeekDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 7));
  const nextWeekStr = `${nextWeekDate.getUTCFullYear()}-${String(nextWeekDate.getUTCMonth() + 1).padStart(2, '0')}-${String(nextWeekDate.getUTCDate()).padStart(2, '0')}`;

  const healthWhere = `WHERE organization_id = $1${isMember ? ' AND assigned_to = $4' : ''}${projectId ? (isMember ? ' AND project_id = $5' : ' AND project_id = $4') : ''}`;
  const healthArgs = isMember
    ? (projectId ? [orgId, todayStr, nextWeekStr, req.session.user.id, projectId] : [orgId, todayStr, nextWeekStr, req.session.user.id])
    : (projectId ? [orgId, todayStr, nextWeekStr, projectId] : [orgId, todayStr, nextWeekStr]);

  const [
    tasksByStatus,
    healthAggregates,
    workload,
    recentActivity,
    membersCountResult,
    filesCountResult,
    firstProject,
    allProjects
  ] = await Promise.all([
    database.prepare(`SELECT status, COUNT(*)::integer AS count FROM tasks ${taskWhere} GROUP BY status`).all(...args),
    database.prepare(`
      SELECT
        COUNT(*)::integer AS total_tasks,
        COUNT(*) FILTER (WHERE status = 'completada')::integer AS completed_tasks,
        COUNT(*) FILTER (WHERE status <> 'completada' AND due_date IS NOT NULL AND due_date < $2::date)::integer AS overdue_count,
        COUNT(*) FILTER (WHERE status <> 'completada' AND due_date IS NOT NULL AND due_date >= $2::date AND due_date <= $3::date)::integer AS due_soon_count,
        COUNT(*) FILTER (WHERE assigned_to IS NULL)::integer AS unassigned_count,
        COUNT(*) FILTER (WHERE start_date IS NULL OR due_date IS NULL)::integer AS unscheduled_count,
        COUNT(*) FILTER (WHERE status <> 'completada' AND priority IN ('alta', 'critica'))::integer AS critical_count
      FROM tasks
      ${healthWhere}
    `).all(...healthArgs),
    database.prepare(`
      SELECT users.name,
             COUNT(tasks.id)::integer AS total,
             COUNT(tasks.id) FILTER (WHERE tasks.status = 'completada')::integer AS completed
      FROM users
      LEFT JOIN tasks ON tasks.assigned_to = users.id AND tasks.organization_id = ?${projectId ? ' AND tasks.project_id = ?' : ''}
      WHERE users.organization_id = ? AND users.role <> 'admin' AND users.active = 1
      GROUP BY users.id, users.name
      ORDER BY total DESC, users.name
    `).all(...(projectId ? [orgId, projectId, orgId] : [orgId, orgId])),
    database.prepare(`SELECT action, description, created_at FROM activities WHERE organization_id = ?${projectId ? ' AND project_id = ?' : ''} ORDER BY created_at DESC LIMIT 5`).all(...(projectId ? [orgId, projectId] : [orgId])),
    database.prepare("SELECT COUNT(*)::integer AS count FROM users WHERE organization_id = ? AND role <> 'admin' AND active = 1").get(orgId),
    database.prepare('SELECT COUNT(*)::integer AS count FROM files WHERE organization_id = ?').get(orgId),
    projectId
      ? database.prepare(`SELECT projects.*,
          (SELECT COUNT(*)::integer FROM tasks t WHERE t.project_id = projects.id) AS tasks_total,
          (SELECT COUNT(*)::integer FROM tasks t WHERE t.project_id = projects.id AND t.status = 'completada') AS tasks_done,
          (SELECT COALESCE(ROUND(AVG(CASE WHEN t.status = 'completada' THEN 100 ELSE LEAST(100, GREATEST(0, COALESCE(t.progress, 0))) END))::integer, 0) FROM tasks t WHERE t.project_id = projects.id) AS tasks_progress
        FROM projects WHERE organization_id = ? AND id = ?`).get(orgId, projectId)
      : database.prepare(`SELECT projects.*,
          (SELECT COUNT(*)::integer FROM tasks t WHERE t.project_id = projects.id) AS tasks_total,
          (SELECT COUNT(*)::integer FROM tasks t WHERE t.project_id = projects.id AND t.status = 'completada') AS tasks_done,
          (SELECT COALESCE(ROUND(AVG(CASE WHEN t.status = 'completada' THEN 100 ELSE LEAST(100, GREATEST(0, COALESCE(t.progress, 0))) END))::integer, 0) FROM tasks t WHERE t.project_id = projects.id) AS tasks_progress
        FROM projects WHERE organization_id = ?
        ORDER BY (SELECT COUNT(*) FROM tasks t WHERE t.project_id = projects.id AND t.status <> 'completada') DESC, projects.created_at DESC
        LIMIT 1`).get(orgId),
    database.prepare('SELECT id, name, description, methodology_id FROM projects WHERE organization_id = ? ORDER BY name ASC').all(orgId)
  ]);

  const total = tasksByStatus.reduce((sum, item) => sum + item.count, 0);
  const completed = tasksByStatus.find(item => item.status === 'completada')?.count || 0;

  const agg = healthAggregates[0] || {
    total_tasks: 0,
    completed_tasks: 0,
    overdue_count: 0,
    due_soon_count: 0,
    unassigned_count: 0,
    unscheduled_count: 0,
    critical_count: 0
  };

  const overdueCount = agg.overdue_count;
  const dueSoonCount = agg.due_soon_count;
  const unassignedCount = agg.unassigned_count;
  const unscheduledCount = agg.unscheduled_count;
  const criticalCount = agg.critical_count;

  const completionRate = total ? Math.round((completed / total) * 100) : 0;
  const dateCoverage = total ? Math.round(((total - unscheduledCount) / total) * 100) : 100;
  const assignmentCoverage = total ? Math.round(((total - unassignedCount) / total) * 100) : 100;
  const riskPoints = Math.min(100, overdueCount * 18 + criticalCount * 7 + unassignedCount * 5 + unscheduledCount * 3);
  const healthScore = total
    ? Math.max(0, Math.min(100, Math.round(completionRate * 0.45 + dateCoverage * 0.2 + assignmentCoverage * 0.2 + (100 - riskPoints) * 0.15)))
    : 100;
  const healthStatus = healthScore >= 80 ? 'saludable' : healthScore >= 60 ? 'atencion' : 'riesgo';

  const recommendations = [];
  if (overdueCount) recommendations.push(`${overdueCount} tarea${overdueCount === 1 ? '' : 's'} vencida${overdueCount === 1 ? '' : 's'} requiere${overdueCount === 1 ? '' : 'n'} atención.`);
  if (unassignedCount) recommendations.push(`Asigna responsable a ${unassignedCount} tarea${unassignedCount === 1 ? '' : 's'} para evitar bloqueos.`);
  if (unscheduledCount) recommendations.push(`Completa las fechas de ${unscheduledCount} tarea${unscheduledCount === 1 ? '' : 's'} para mejorar la planificación.`);
  if (!recommendations.length) recommendations.push('No hay alertas críticas. Mantén actualizados los estados y las fechas.');

  res.json({
    user: req.session.user,
    organization: req.organization,
    project: firstProject,
    projects: allProjects,
    stats: {
      totalTasks: total,
      completed,
      progress: completionRate,
      byStatus: tasksByStatus,
      members: membersCountResult?.count || 0,
      files: filesCountResult?.count || 0
    },
    health: {
      score: healthScore,
      status: healthStatus,
      overdue: overdueCount,
      dueSoon: dueSoonCount,
      critical: criticalCount,
      unassigned: unassignedCount,
      unscheduled: unscheduledCount,
      dateCoverage,
      assignmentCoverage,
      workload,
      recommendations,
      recentActivity
    }
  });
}
module.exports = { dashboard };