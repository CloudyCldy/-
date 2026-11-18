// HB-11: cada ausencia tiene un rango de fechas (absence_date a end_date) y un motivo.
const REASONS = ['falta', 'vacaciones', 'permiso', 'incapacidad', 'curso', 'otro'];
const MAX_RANGE_DAYS = 90;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const SELECT_FIELDS = `
  a.id, a.user_id, to_char(a.absence_date, 'YYYY-MM-DD') AS absence_date,
  to_char(COALESCE(a.end_date, a.absence_date), 'YYYY-MM-DD') AS end_date,
  a.reason, a.subject, u.name AS user_name,
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

function parseDate(value) {
  if (!DATE_RE.test(String(value || ''))) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

const DAY = 24 * 60 * 60 * 1000;
const toKey = date => date.toISOString().slice(0, 10);

/** Días hábiles (lunes a viernes) entre dos fechas, incluidas ambas. */
function businessDays(from, to) {
  const days = [];
  for (let t = from.getTime(); t <= to.getTime(); t += DAY) {
    const day = new Date(t);
    const weekday = day.getUTCDay();
    if (weekday !== 0 && weekday !== 6) days.push(toKey(day));
  }
  return days;
}

async function create(req, res) {
  const { user_id, absence_date, end_date, reason, subject } = req.body;
  const start = parseDate(absence_date);
  const end = end_date ? parseDate(end_date) : start;
  if (!user_id || !start) return res.status(400).json({ error: 'Integrante y fecha de inicio son obligatorios.' });
  if (!end) return res.status(400).json({ error: 'La fecha de fin no es válida.' });
  if (end < start) return res.status(400).json({ error: 'La fecha de fin no puede ser anterior a la de inicio.' });
  if ((end - start) / DAY + 1 > MAX_RANGE_DAYS) return res.status(400).json({ error: `Una ausencia no puede durar más de ${MAX_RANGE_DAYS} días.` });
  if (!REASONS.includes(reason)) return res.status(400).json({ error: 'Elige el motivo de la ausencia.' });
  const detail = String(subject || '').trim().slice(0, 200);
  if (reason === 'otro' && !detail) return res.status(400).json({ error: 'Describe el motivo de la ausencia.' });
  const database = req.app.locals.database;
  const user = await database.prepare("SELECT id FROM users WHERE id = ? AND organization_id = ? AND role = 'member'").get(user_id, req.session.user.organization_id);
  if (!user) return res.status(404).json({ error: 'El integrante no existe.' });
  const result = await database.prepare('INSERT INTO absences (user_id, organization_id, absence_date, end_date, reason, subject) VALUES (?, ?, ?, ?, ?, ?) RETURNING id')
    .run(user_id, req.session.user.organization_id, toKey(start), toKey(end), reason, detail);
  res.status(201).json({ id: result.lastInsertRowid });
}

/**
 * Capacidad real del equipo en un periodo (por defecto, los próximos 14 días):
 * días hábiles, días de ausencia y porcentaje disponible por integrante.
 */
async function capacity(req, res) {
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const from = req.query.from ? parseDate(req.query.from) : today;
  const to = req.query.to ? parseDate(req.query.to) : new Date(today.getTime() + 13 * DAY);
  if (!from || !to || to < from) return res.status(400).json({ error: 'El periodo no es válido.' });
  if ((to - from) / DAY + 1 > MAX_RANGE_DAYS) return res.status(400).json({ error: `El periodo no puede ser mayor a ${MAX_RANGE_DAYS} días.` });
  const database = req.app.locals.database;
  const organizationId = req.session.user.organization_id;
  const members = await database.prepare("SELECT id, name FROM users WHERE organization_id = ? AND role = 'member' AND active = 1 ORDER BY name").all(organizationId);
  const absences = await database.prepare(`
    SELECT user_id, to_char(absence_date, 'YYYY-MM-DD') AS start_date,
           to_char(COALESCE(end_date, absence_date), 'YYYY-MM-DD') AS end_date, reason
    FROM absences
    WHERE organization_id = ? AND absence_date <= ? AND COALESCE(end_date, absence_date) >= ?
  `).all(organizationId, toKey(to), toKey(from));
  const workdays = businessDays(from, to);
  const team = members.map(member => {
    const absentDays = new Set();
    for (const absence of absences.filter(item => Number(item.user_id) === Number(member.id))) {
      const start = parseDate(absence.start_date) || from;
      const end = parseDate(absence.end_date) || start;
      for (const day of businessDays(start < from ? from : start, end > to ? to : end)) absentDays.add(day);
    }
    const available = workdays.length - absentDays.size;
    return {
      user_id: member.id,
      name: member.name,
      workdays: workdays.length,
      absent_days: absentDays.size,
      available_days: available,
      availability: workdays.length ? Math.round((available / workdays.length) * 100) : 100,
    };
  });
  const total = team.reduce((sum, item) => sum + item.workdays, 0);
  const availableTotal = team.reduce((sum, item) => sum + item.available_days, 0);
  res.json({
    from: toKey(from),
    to: toKey(to),
    workdays: workdays.length,
    team,
    team_availability: total ? Math.round((availableTotal / total) * 100) : 100,
  });
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

module.exports = { list, listAppeals, create, capacity, appeal, resolveAppeal, remove, REASONS, businessDays };
