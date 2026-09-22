const VALID_ACCENTS = ['pink', 'yellow', 'green'];

async function list(req, res) {
  const database = req.app.locals.database;
  const result = await database.pool.query(`
    SELECT a.id, a.title, a.body, a.tag, a.accent, a.created_at, a.updated_at,
           a.author_id, COALESCE(u.name, 'Administración') AS author_name
    FROM announcements a
    LEFT JOIN users u ON u.id = a.author_id
    WHERE a.organization_id = $1
    ORDER BY a.created_at DESC
  `, [req.session.user.organization_id]);
  res.json(result.rows);
}

async function create(req, res) {
  const { title, body, tag, accent } = req.body;
  if (!String(title || '').trim() || !String(body || '').trim()) {
    return res.status(400).json({ error: 'El título y el contenido son obligatorios.' });
  }
  const database = req.app.locals.database;
  const result = await database.prepare(`
    INSERT INTO announcements (organization_id, author_id, title, body, tag, accent)
    VALUES (?, ?, ?, ?, ?, ?) RETURNING id
  `).run(
    req.session.user.organization_id,
    req.session.user.id,
    String(title).trim(),
    String(body).trim(),
    String(tag || 'General').trim() || 'General',
    VALID_ACCENTS.includes(accent) ? accent : 'pink'
  );
  res.status(201).json({ id: result.lastInsertRowid });
}

async function update(req, res) {
  const { title, body, tag, accent } = req.body;
  if (!String(title || '').trim() || !String(body || '').trim()) {
    return res.status(400).json({ error: 'El título y el contenido son obligatorios.' });
  }
  const database = req.app.locals.database;
  const result = await database.prepare(`
    UPDATE announcements
    SET title = ?, body = ?, tag = ?, accent = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND organization_id = ?
  `).run(
    String(title).trim(),
    String(body).trim(),
    String(tag || 'General').trim() || 'General',
    VALID_ACCENTS.includes(accent) ? accent : 'pink',
    req.params.id,
    req.session.user.organization_id
  );
  if (!result.changes) return res.status(404).json({ error: 'El anuncio no existe.' });
  res.json({ ok: true });
}

async function remove(req, res) {
  const result = await req.app.locals.database
    .prepare('DELETE FROM announcements WHERE id = ? AND organization_id = ?')
    .run(req.params.id, req.session.user.organization_id);
  if (!result.changes) return res.status(404).json({ error: 'El anuncio no existe.' });
  res.json({ ok: true });
}

module.exports = { list, create, update, remove };
