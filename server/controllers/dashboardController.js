async function dashboard(req, res) {
  const database = req.app.locals.database;
  const taskWhere = req.session.user.role === 'member' ? 'WHERE organization_id = ? AND assigned_to = ?' : 'WHERE organization_id = ?';
  const args = req.session.user.role === 'member' ? [req.session.user.organization_id, req.session.user.id] : [req.session.user.organization_id];
  const tasks = await database.prepare(`SELECT status, COUNT(*)::integer AS count FROM tasks ${taskWhere} GROUP BY status`).all(...args);
  const total = tasks.reduce((sum, item) => sum + item.count, 0);
  const completed = tasks.find(item => item.status === 'completada')?.count || 0;
  res.json({ user: req.session.user, organization: req.organization, project: await database.prepare('SELECT * FROM projects WHERE organization_id = ? ORDER BY id LIMIT 1').get(req.session.user.organization_id), stats: { totalTasks: total, completed, progress: total ? Math.round(completed / total * 100) : 0, byStatus: tasks, members: (await database.prepare("SELECT COUNT(*)::integer AS count FROM users WHERE organization_id = ? AND role <> 'admin' AND active = 1").get(req.session.user.organization_id)).count, files: (await database.prepare('SELECT COUNT(*)::integer AS count FROM files WHERE organization_id = ?').get(req.session.user.organization_id)).count } });
}
module.exports = { dashboard };