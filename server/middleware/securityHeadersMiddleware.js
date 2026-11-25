/**
 * Middleware para cabeceras de seguridad HTTP y protección de caché en APIs.
 */
function securityHeaders(req, res, next) {
  // Prevenir confusión de tipos MIME
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Mitigar ataques de clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Desactivar filtro XSS obsoleto para evitar vulnerabilidades de comportamiento heredado
  res.setHeader('X-XSS-Protection', '0');

  // Controlar información en la cabecera Referer
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Restricción de permisos de navegador por defecto
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // En rutas de API autenticadas, impedir almacenamiento en caché de proxies o navegadores
  if (req.path.startsWith('/api') && !req.path.startsWith('/api/health')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
  }

  next();
}

module.exports = securityHeaders;
