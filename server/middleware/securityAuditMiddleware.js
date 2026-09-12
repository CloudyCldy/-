const { clientIp } = require('./ipBlockMiddleware');

function securityAudit(req, res, next) {
  if (!req.path.startsWith('/api/')) return next();
  const startedAt = Date.now();
  res.on('finish', async () => {
    const ip = clientIp(req).replace(/^::ffff:/, '');
    const userAgent = String(req.get('user-agent') || '').slice(0, 500);
    const failed = [401, 403].includes(res.statusCode);
    let unusual = failed;
    let reason = failed ? `Respuesta HTTP ${res.statusCode}` : '';
    try {
      const recent = await req.app.locals.database.prepare("SELECT COUNT(*)::integer AS count FROM security_events WHERE ip = ?::inet AND created_at > CURRENT_TIMESTAMP - INTERVAL '10 minutes'").get(ip);
      if (recent.count >= 60) {
        unusual = true;
        reason = 'Muchas solicitudes desde la misma IP en 10 minutos.';
      }
      await req.app.locals.database.prepare(`INSERT INTO security_events (ip, user_id, organization_id, user_agent, method, path, status, event_type, unusual, reason) VALUES (?::inet, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(ip, req.session?.user?.id || null, req.session?.user?.organization_id || null, userAgent, req.method, req.path, res.statusCode, req.path === '/api/auth/login' && res.statusCode === 401 ? 'login_failed' : 'request', unusual, reason);
    } catch (error) { console.warn('No fue posible registrar el evento de seguridad:', error.message); }
  });
  res.setHeader('X-Request-Duration-Ms', String(Date.now() - startedAt));
  next();
}

module.exports = securityAudit;
