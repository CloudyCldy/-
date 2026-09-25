let blockedIpsCache = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 30000; // 30 segundos de cache

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.socket.remoteAddress || '';
}

function invalidateBlockedIpsCache() {
  blockedIpsCache = null;
  cacheExpiresAt = 0;
}

async function getBlockedIpsMap(database) {
  const now = Date.now();
  if (blockedIpsCache && now < cacheExpiresAt) {
    return blockedIpsCache;
  }
  const rows = await database.prepare('SELECT ip::text AS ip, reason FROM blocked_ips').all();
  const map = new Map();
  for (const row of rows) {
    map.set(row.ip, row.reason);
  }
  blockedIpsCache = map;
  cacheExpiresAt = now + CACHE_TTL_MS;
  return map;
}

async function requireAllowedIp(req, res, next) {
  if (req.path === '/static/blocked.jpg' || req.path === '/css/style.css' || req.path === '/js/app.js') return next();
  try {
    const ip = clientIp(req).replace(/^::ffff:/, '');
    const blockedMap = await getBlockedIpsMap(req.app.locals.database);
    const reason = blockedMap.get(ip);
    if (reason !== undefined) {
      if (req.path.startsWith('/api/')) return res.status(403).json({ error: 'Tu dirección IP está bloqueada.', reason, blocked: true });
      return res.status(403).send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Acceso bloqueado</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111;color:#f4f1ed;font-family:system-ui,sans-serif;text-align:center}.blocked{max-width:560px;padding:24px}.blocked img{display:block;max-width:100%;max-height:55vh;margin:0 auto 24px;border-radius:12px}.blocked h1{margin:0 0 12px}.blocked p{color:#b8b4b0}</style></head><body><main class="blocked"><img src="/static/blocked.jpg" alt="Acceso bloqueado"><h1>Acceso bloqueado</h1><p>Tu dirección IP no puede acceder a esta aplicación.</p></main></body></html>`);
    }
    next();
  } catch (error) { next(error); }
}

module.exports = { clientIp, requireAllowedIp, invalidateBlockedIpsCache };
