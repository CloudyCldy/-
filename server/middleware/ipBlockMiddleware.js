function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.socket.remoteAddress || '';
}

async function requireAllowedIp(req, res, next) {
  try {
    const ip = clientIp(req).replace(/^::ffff:/, '');
    const blocked = await req.app.locals.database.prepare('SELECT id, reason FROM blocked_ips WHERE ip = ?::inet').get(ip);
    if (blocked) return res.status(403).json({ error: 'Tu dirección IP está bloqueada.', reason: blocked.reason });
    next();
  } catch (error) { next(error); }
}

module.exports = { clientIp, requireAllowedIp };
