function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Debes iniciar sesión.' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'No tienes permisos para realizar esta acción.' });
  next();
}

function requireMember(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'member') return res.status(403).json({ error: 'Esta acción es exclusiva para integrantes.' });
  next();
}

module.exports = { requireAuth, requireAdmin, requireMember };