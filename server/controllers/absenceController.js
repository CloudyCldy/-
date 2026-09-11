async function list(req, res) {
  const database = req.app.locals.database;
  const userId = req.session.user.role === 'admin' ? req.query.user_id : req.session.user.id;
  const result = await database.pool.query(`
    SELECT a.id, a.user_id, a.absence_date, a.subject, u.name AS user_name
    FROM absences a JOIN users u ON u.id = a.user_id
    WHERE a.organization_id = $3 AND ($1::integer IS NULL OR a.user_id = $2)
    ORDER BY a.absence_date DESC, a.id DESC
  `, [userId || null, userId || null, req.session.user.organization_id]);
  res.json(result.rows);
}

async function create(req, res) {
  const { user_id, absence_date, subject } = req.body;
  if (!user_id || !absence_date || !String(subject || '').trim()) return res.status(400).json({ error: 'Integrante, fecha y materia son obligatorios.' });
  const database = req.app.locals.database;
  const user = await database.prepare("SELECT id FROM users WHERE id = ? AND organization_id = ? AND role = 'member'").get(user_id, req.session.user.organization_id);
  if (!user) return res.status(404).json({ error: 'El integrante no existe.' });
  const result = await database.prepare('INSERT INTO absences (user_id, organization_id, absence_date, subject) VALUES (?, ?, ?, ?) RETURNING id').run(user_id, req.session.user.organization_id, absence_date, String(subject).trim());
  res.status(201).json({ id: result.lastInsertRowid });
}

async function remove(req, res) {
  const result = await req.app.locals.database.prepare('DELETE FROM absences WHERE id = ? AND organization_id = ?').run(req.params.id, req.session.user.organization_id);
  if (!result.changes) return res.status(404).json({ error: 'La inasistencia no existe.' });
  res.json({ ok: true });
}

module.exports = { list, create, remove };