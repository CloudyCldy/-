async function requireAuth(req, res, next) {
  if (!req.session.user?.id) return res.status(401).json({ error: 'Debes iniciar sesión.' });
  try {
    const user = await req.app.locals.database.prepare(`
      SELECT users.id, users.name, users.username, users.email, users.role, users.role_id,
             users.organization_id, users.active, users.github_username, users.profile_photo,
             organizations.name AS organization_name, organizations.slug AS organization_slug
      FROM users JOIN organizations ON organizations.id = users.organization_id
      WHERE users.id = ? AND users.active = 1 AND organizations.status = 'active'
    `).get(req.session.user.id);
    if (!user) return req.session.destroy(() => res.status(401).json({ error: 'La sesión ya no es válida.' }));
    req.session.user = user;
    req.organization = { id: user.organization_id, name: user.organization_name, slug: user.organization_slug };
    next();
  } catch (error) { next(error); }
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'No tienes permisos para realizar esta acción.' });
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user || !roles.includes(req.session.user.role)) return res.status(403).json({ error: 'No tienes permisos para realizar esta acción.' });
    next();
  };
}

function requireMember(req, res, next) {
  if (!req.session.user || !['member', 'project_manager'].includes(req.session.user.role)) return res.status(403).json({ error: 'Esta acción es exclusiva para integrantes.' });
  next();
}

module.exports = { requireAuth, requireAdmin, requireMember, requireRole };