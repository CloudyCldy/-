async function dashboard(req, res) {
  const database = req.app.locals.database;
  const taskWhere = req.session.user.role === 'member' ? 'WHERE assigned_to = ?' : '';
  const args = req.session.user.role === 'member' ? [req.session.user.id] : [];
  const tasks = await database.prepare(`SELECT status, COUNT(*)::integer AS count FROM tasks ${taskWhere} GROUP BY status`).all(...args);
  const total = tasks.reduce((sum, item) => sum + item.count, 0);
  const completed = tasks.find(item => item.status === 'completada')?.count || 0;
  res.json({ user: req.session.user, project: await database.prepare('SELECT * FROM projects WHERE name = ?').get('Sakura Coffee'), stats: { totalTasks: total, completed, progress: total ? Math.round(completed / total * 100) : 0, byStatus: tasks, members: (await database.prepare("SELECT COUNT(*)::integer AS count FROM users WHERE role = 'member' AND active = 1").get()).count, files: (await database.prepare('SELECT COUNT(*)::integer AS count FROM files').get()).count } });
}
module.exports = { dashboard };