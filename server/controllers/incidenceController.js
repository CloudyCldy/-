async function list(req, res) {
  const database = req.app.locals.database;
  const user = req.session.user;

  if (user.role === 'admin') {
    const rows = await database.prepare(`
      SELECT i.id, i.user_id, i.title, i.description, i.status, i.assigned_to,
             i.appeal_reason, i.appealed_at, i.created_at, i.updated_at,
             u.name AS user_name,
             assigned.name AS assigned_name
      FROM incidences i
      JOIN users u ON u.id = i.user_id
      LEFT JOIN users assigned ON assigned.id = i.assigned_to
      WHERE i.organization_id = ?
      ORDER BY i.created_at DESC
    `).all(user.organization_id);
    return res.json(rows);
  }

  const rows = await database.prepare(`
    SELECT i.id, i.user_id, i.title, i.description, i.status, i.assigned_to,
           i.appeal_reason, i.appealed_at, i.created_at, i.updated_at,
           u.name AS user_name,
           assigned.name AS assigned_name
    FROM incidences i
    JOIN users u ON u.id = i.user_id
    LEFT JOIN users assigned ON assigned.id = i.assigned_to
    WHERE i.organization_id = ? AND i.user_id = ?
    ORDER BY i.created_at DESC
  `).all(user.organization_id, user.id);

  res.json(rows);
}

async function get(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'El identificador de incidencia no es válido.' });
  }

  const incidence = await req.app.locals.database.prepare(`
    SELECT i.id, i.user_id, i.title, i.description, i.status, i.assigned_to,
           i.appeal_reason, i.appealed_at, i.created_at, i.updated_at,
           u.name AS user_name,
           assigned.name AS assigned_name
    FROM incidences i
    JOIN users u ON u.id = i.user_id
    LEFT JOIN users assigned ON assigned.id = i.assigned_to
    WHERE i.id = ? AND i.organization_id = ?
  `).get(id, req.session.user.organization_id);

  if (!incidence) {
    return res.status(404).json({ error: 'La incidencia no existe.' });
  }

  if (req.session.user.role !== 'admin' && incidence.user_id !== req.session.user.id) {
    return res.status(403).json({ error: 'No tienes permisos para consultar esta incidencia.' });
  }

  res.json(incidence);
}

async function create(req, res) {
  const title = String(req.body.title || '').trim();
  const description = String(req.body.description || '').trim();

  if (!title) {
    return res.status(400).json({ error: 'El título de la incidencia es obligatorio.' });
  }

  if (!description) {
    return res.status(400).json({ error: 'La descripción de la incidencia es obligatoria.' });
  }

  const assignedTo = req.body.assigned_to ? Number(req.body.assigned_to) : null;
  if (assignedTo !== null && (!Number.isInteger(assignedTo) || assignedTo < 1)) {
    return res.status(400).json({ error: 'El responsable indicado no es válido.' });
  }

  if (assignedTo) {
    const assignee = await req.app.locals.database.prepare(
      'SELECT id FROM users WHERE id = ? AND organization_id = ? AND active = 1'
    ).get(assignedTo, req.session.user.organization_id);

    if (!assignee) {
      return res.status(404).json({ error: 'El responsable indicado no pertenece a tu organización.' });
    }
  }

  const result = await req.app.locals.database.prepare(`
    INSERT INTO incidences (organization_id, user_id, title, description, status, assigned_to)
    VALUES (?, ?, ?, ?, ?, ?)
    RETURNING id
  `).run(
    req.session.user.organization_id,
    req.session.user.id,
    title,
    description,
    'open',
    assignedTo
  );

  res.status(201).json({ id: result.lastInsertRowid, status: 'open' });
}

async function updateStatus(req, res) {
  const id = Number(req.params.id);
  const status = String(req.body.status || '').trim();

  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'El identificador de incidencia no es válido.' });
  }

  const allowed = ['open', 'in_review', 'resolved', 'appealed'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'El estado indicado no es válido.' });
  }

  const incidence = await req.app.locals.database.prepare(
    'SELECT id, user_id FROM incidences WHERE id = ? AND organization_id = ?'
  ).get(id, req.session.user.organization_id);

  if (!incidence) {
    return res.status(404).json({ error: 'La incidencia no existe.' });
  }

  if (req.session.user.role !== 'admin' && incidence.user_id !== req.session.user.id) {
    return res.status(403).json({ error: 'No tienes permisos para actualizar esta incidencia.' });
  }

  await req.app.locals.database.prepare(`
    UPDATE incidences
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND organization_id = ?
  `).run(status, id, req.session.user.organization_id);

  res.json({ ok: true, status });
}

async function appeal(req, res) {
  const id = Number(req.params.id);
  const appealReason = String(req.body.appeal_reason || '').trim();

  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'El identificador de incidencia no es válido.' });
  }

  if (!appealReason) {
    return res.status(400).json({ error: 'Debes indicar el motivo de la apelación.' });
  }

  const incidence = await req.app.locals.database.prepare(
    'SELECT id, user_id FROM incidences WHERE id = ? AND organization_id = ?'
  ).get(id, req.session.user.organization_id);

  if (!incidence) {
    return res.status(404).json({ error: 'La incidencia no existe.' });
  }

  if (incidence.user_id !== req.session.user.id) {
    return res.status(403).json({ error: 'Solo el autor puede apelar una incidencia.' });
  }

  await req.app.locals.database.prepare(`
    UPDATE incidences
    SET status = 'appealed', appeal_reason = ?, appealed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND organization_id = ?
  `).run(appealReason, id, req.session.user.organization_id);

  res.json({ ok: true, status: 'appealed' });
}

module.exports = { list, get, create, updateStatus, appeal };
