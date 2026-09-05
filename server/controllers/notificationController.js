async function list(req, res) {
  const database = req.app.locals.database;
  const userId = req.session.user.id;
  await database.prepare("UPDATE messages SET delivery_status = 'entregado' WHERE receiver_id = ? AND delivery_status = 'enviado'").run(userId);
  const messages = await database.prepare('SELECT COUNT(*)::integer AS count FROM messages WHERE receiver_id = ?').get(userId);
  const tasks = req.session.user.role === 'member'
    ? await database.prepare("SELECT COUNT(*)::integer AS count FROM tasks WHERE assigned_to = ? AND status <> 'completada'").get(userId)
    : await database.prepare("SELECT COUNT(*)::integer AS count FROM tasks WHERE status <> 'completada'").get();
  res.json({ messages: messages.count, tasks: tasks.count });
}

module.exports = { list };