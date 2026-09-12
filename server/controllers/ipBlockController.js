const net = require('net');
const { clientIp } = require('../middleware/ipBlockMiddleware');

async function list(req, res) {
  const blocks = await req.app.locals.database.prepare(`
    SELECT blocked_ips.id, blocked_ips.ip::text AS ip, blocked_ips.reason, blocked_ips.created_at,
           users.name AS blocked_by_name
    FROM blocked_ips LEFT JOIN users ON users.id = blocked_ips.blocked_by
    ORDER BY blocked_ips.created_at DESC
  `).all();
  res.json({ current_ip: clientIp(req).replace(/^::ffff:/, ''), blocks });
}

async function create(req, res) {
  const ip = String(req.body.ip || '').trim().replace(/^::ffff:/, '');
  const reason = String(req.body.reason || '').trim().slice(0, 255);
  if (!ip || net.isIP(ip) !== 4) return res.status(400).json({ error: 'Introduce una dirección IPv4 válida.' });
  try {
    const result = await req.app.locals.database.prepare('INSERT INTO blocked_ips (ip, reason, blocked_by) VALUES (?::inet, ?, ?) RETURNING id').run(ip, reason, req.session.user.id);
    res.status(201).json({ ok: true, id: result.lastInsertRowid });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Esa IP ya está bloqueada.' });
    throw error;
  }
}

async function remove(req, res) {
  const result = await req.app.locals.database.prepare('DELETE FROM blocked_ips WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'El bloqueo no existe.' });
  res.json({ ok: true });
}

module.exports = { list, create, remove };
