const { clientIp } = require('./ipBlockMiddleware');

function securityAudit(req, res, next) {
  if (!req.path.startsWith('/api/')) return next();
  const startedAt = Date.now();
  res.on('finish', () => {
    const ip = clientIp(req).replace(/^::ffff:/, '');
    const userAgent = String(req.get('user-agent') || '').slice(0, 500);
    const failed = [401, 403].includes(res.statusCode);
    const unusual = failed;
    const reason = failed ? `Respuesta HTTP ${res.statusCode}` : '';
    const eventType = req.path === '/api/auth/login' && res.statusCode === 401 ? 'login_failed' : 'request';

    // Insertar de manera asíncrona sin bloquear el event loop ni acumular latencia
    setImmediate(async () => {
      try {
        await req.app.locals.database.prepare(
          `INSERT INTO security_events (ip, user_id, organization_id, user_agent, method, path, status, event_type, unusual, reason) VALUES (?::inet, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          ip,
          req.session?.user?.id || null,
          req.session?.user?.organization_id || null,
          userAgent,
          req.method,
          req.path,
          res.statusCode,
          eventType,
          unusual,
          reason
        );
      } catch (error) {
        // Ignorar fallos de logging para no afectar la experiencia de usuario
      }
    });
  });
  res.setHeader('X-Request-Duration-Ms', String(Date.now() - startedAt));
  next();
}

module.exports = securityAudit;
