const SELECT_FIELDS = `
  a.id, a.user_id, a.absence_date, a.subject, u.name AS user_name,
  a.appeal_status, a.appeal_reason, a.appealed_at, a.resolution_note, a.resolved_at,
  a.appeal_evidence_id, evidence.original_name AS appeal_evidence_name
`;

async function list(req, res) {
  const database = req.app.locals.database;
  const userId = req.session.user.role === 'admin' ? req.query.user_id : req.session.user.id;
  const result = await database.pool.query(`
    SELECT ${SELECT_FIELDS}
    FROM absences a
    JOIN users u ON u.id = a.user_id
    LEFT JOIN files evidence ON evidence.id = a.appeal_evidence_id
    WHERE a.organization_id = $3 AND ($1::integer IS NULL OR a.user_id = $2)
    ORDER BY a.absence_date DESC, a.id DESC
  `, [userId || null, userId || null, req.session.user.organization_id]);
  res.json(result.rows);
}

async function listAppeals(req, res) {
  const database = req.app.locals.database;
  const result = await database.pool.query(`
    SELECT ${SELECT_FIELDS}
    FROM absences a
    JOIN users u ON u.id = a.user_id
    LEFT JOIN files evidence ON evidence.id = a.appeal_evidence_id
    WHERE a.organization_id = $1 AND a.appeal_status != 'ninguna'
    ORDER BY a.appealed_at DESC NULLS LAST, a.id DESC
  `, [req.session.user.organization_id]);
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

async function appeal(req, res) {
  const { reason, evidence_file_id } = req.body;
  if (!String(reason || '').trim()) return res.status(400).json({ error: 'Describe el motivo de tu apelación.' });
  if (!evidence_file_id) return res.status(400).json({ error: 'Adjunta un archivo como evidencia.' });
  const database = req.app.locals.database;
  const absence = await database.prepare('SELECT * FROM absences WHERE id = ? AND organization_id = ?').get(req.params.id, req.session.user.organization_id);
  if (!absence) return res.status(404).json({ error: 'La inasistencia no existe.' });
  if (absence.user_id !== req.session.user.id) return res.status(403).json({ error: 'Solo puedes apelar tus propias inasistencias.' });
  if (['pendiente', 'aprobada'].includes(absence.appeal_status)) return res.status(400).json({ error: 'Esta inasistencia ya tiene una apelación en curso o aprobada.' });
  const evidence = await database.prepare('SELECT id FROM files WHERE id = ? AND organization_id = ?').get(evidence_file_id, req.session.user.organization_id);
  if (!evidence) return res.status(404).json({ error: 'El archivo de evidencia no existe.' });
  const result = await database.prepare(`
    UPDATE absences
    SET appeal_status = 'pendiente', appeal_reason = ?, appeal_evidence_id = ?, appealed_at = CURRENT_TIMESTAMP, resolution_note = NULL, resolved_at = NULL
    WHERE id = ? AND organization_id = ?
  `).run(String(reason).trim(), evidence_file_id, req.params.id, req.session.user.organization_id);
  if (!result.changes) return res.status(404).json({ error: 'La inasistencia no existe.' });
  res.json({ ok: true });
}

async function resolveAppeal(req, res) {
  const { status, resolution_note } = req.body;
  if (!['aprobada', 'rechazada'].includes(status)) return res.status(400).json({ error: 'El estado de la apelación no es válido.' });
  const database = req.app.locals.database;
  const absence = await database.prepare('SELECT * FROM absences WHERE id = ? AND organization_id = ?').get(req.params.id, req.session.user.organization_id);
  if (!absence) return res.status(404).json({ error: 'La inasistencia no existe.' });
  if (absence.appeal_status !== 'pendiente') return res.status(400).json({ error: 'Esta inasistencia no tiene una apelación pendiente.' });
  await database.prepare(`
    UPDATE absences
    SET appeal_status = ?, resolution_note = ?, resolved_at = CURRENT_TIMESTAMP
    WHERE id = ? AND organization_id = ?
  `).run(status, String(resolution_note || '').trim() || null, req.params.id, req.session.user.organization_id);
  res.json({ ok: true });
}

async function remove(req, res) {
  const result = await req.app.locals.database.prepare('DELETE FROM absences WHERE id = ? AND organization_id = ?').run(req.params.id, req.session.user.organization_id);
  if (!result.changes) return res.status(404).json({ error: 'La inasistencia no existe.' });
  res.json({ ok: true });
}

module.exports = { list, listAppeals, create, appeal, resolveAppeal, remove };
