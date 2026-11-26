/**
 * Rate Limiter en memoria con ventana deslizante para protección contra ataques de fuerza bruta.
 */
const requestMap = new Map();

/**
 * Limpieza periódica de registros vencidos para evitar fugas de memoria.
 */
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestMap.entries()) {
    if (now > record.resetTime) {
      requestMap.delete(key);
    }
  }
}, 60000);

if (cleanupTimer.unref) {
  cleanupTimer.unref();
}

/**
 * Crea un middleware limitador de peticiones.
 * @param {Object} options
 * @param {number} options.windowMs - Ventana de tiempo en milisegundos (por defecto 5 min)
 * @param {number} options.max - Cantidad máxima de solicitudes permitidas en la ventana
 * @param {string} options.message - Mensaje de error al superar el límite
 * @param {boolean} options.skipInTest - Si se omite en entorno de test salvo bandera explícita
 */
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 5 * 60 * 1000;
  const max = options.max || 10;
  const message = options.message || 'Demasiadas solicitudes. Por favor, intenta nuevamente más tarde.';
  const skipInTest = options.skipInTest !== false;

  return (req, res, next) => {
    // En pruebas se omite salvo que se active explícitamente con la cabecera x-test-rate-limit
    if (skipInTest && process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
      return next();
    }

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const key = `${req.baseUrl || ''}${req.path}:${ip}`;
    const now = Date.now();

    let record = requestMap.get(key);
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      requestMap.set(key, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > max) {
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        error: message,
        retryAfterSeconds: retryAfter,
        code: 'TOO_MANY_REQUESTS'
      });
    }

    next();
  };
}

module.exports = { createRateLimiter, requestMap };
