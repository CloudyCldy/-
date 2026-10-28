const router = require('express').Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { detectAndSyncEvents } = require('../services/eventService');

router.use(requireAuth);

router.get('/', async (req, res) => {
  const database = req.app.locals.database;
  const orgId = req.session.user.organization_id;
  const projectId = req.query.project_id ? Number(req.query.project_id) : null;
  const resolved = req.query.resolved !== undefined ? req.query.resolved === 'true' : false;

  await detectAndSyncEvents(database, orgId, projectId).catch(() => {});

  const filters = ['organization_id = ?', 'resolved = ?'];
  const params = [orgId, resolved];

  if (projectId) {
    filters.push('project_id = ?');
    params.push(projectId);
  }

  const events = await database.prepare(`
    SELECT * FROM project_events
    WHERE ${filters.join(' AND ')}
    ORDER BY created_at DESC
  `).all(...params);

  res.json(events);
});

router.post('/:id/resolve', async (req, res) => {
  const database = req.app.locals.database;
  const id = Number(req.params.id);
  const orgId = req.session.user.organization_id;

  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Identificador no válido.' });

  await database.prepare(`UPDATE project_events SET resolved = true WHERE id = ? AND organization_id = ?`).run(id, orgId);
  res.json({ ok: true });
});

router.post('/detect', async (req, res) => {
  const database = req.app.locals.database;
  const orgId = req.session.user.organization_id;
  const projectId = req.body.project_id ? Number(req.body.project_id) : null;

  const detected = await detectAndSyncEvents(database, orgId, projectId);
  res.json({ ok: true, detected_count: detected.length, events: detected });
});

module.exports = router;
