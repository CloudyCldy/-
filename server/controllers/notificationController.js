async function list(req, res) {
  const database = req.app.locals.database;
  const userId = req.session.user.id;
  await database.prepare("UPDATE messages SET delivery_status = 'entregado' WHERE receiver_id = ? AND organization_id = ? AND delivery_status = 'enviado'").run(userId, req.session.user.organization_id);
  const messages = await database.prepare('SELECT COUNT(*)::integer AS count FROM messages WHERE receiver_id = ? AND organization_id = ?').get(userId, req.session.user.organization_id);
  const tasks = req.session.user.role === 'member'
    ? await database.prepare("SELECT COUNT(*)::integer AS count FROM tasks WHERE assigned_to = ? AND organization_id = ? AND status <> 'completada'").get(userId, req.session.user.organization_id)
    : await database.prepare("SELECT COUNT(*)::integer AS count FROM tasks WHERE organization_id = ? AND status <> 'completada'").get(req.session.user.organization_id);
  res.json({ messages: messages.count, tasks: tasks.count });
}

module.exports = { list };