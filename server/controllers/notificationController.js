async function list(req, res) {
  const database = req.app.locals.database;
  const userId = req.session.user.id;
  const orgId = req.session.user.organization_id;

  const [messages, tasks] = await Promise.all([
    database.prepare('SELECT COUNT(*)::integer AS count FROM messages WHERE receiver_id = ? AND organization_id = ?').get(userId, orgId),
    req.session.user.role === 'member'
      ? database.prepare("SELECT COUNT(*)::integer AS count FROM tasks WHERE assigned_to = ? AND organization_id = ? AND status <> 'completada'").get(userId, orgId)
      : database.prepare("SELECT COUNT(*)::integer AS count FROM tasks WHERE organization_id = ? AND status <> 'completada'").get(orgId)
  ]);

  // Marcar como entregados de fondo sin retrasar la respuesta de conteo
  setImmediate(async () => {
    try {
      await database.prepare("UPDATE messages SET delivery_status = 'entregado' WHERE receiver_id = ? AND organization_id = ? AND delivery_status = 'enviado'").run(userId, orgId);
    } catch {}
  });

  res.json({ messages: messages.count, tasks: tasks.count });
}

module.exports = { list };