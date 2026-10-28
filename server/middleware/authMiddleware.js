const { hasPermission, isPlatformAdmin, isCompanyAdmin, normalizeRole } = require('../services/permissionService');

/**
 * Validates authentication session or token and enforces enterprise company status.
 */
async function requireAuth(req, res, next) {
  // Manejo de usuario simulado en pruebas automatizadas
  if (process.env.NODE_ENV === 'test' && req.headers['x-test-user']) {
    try {
      const parsed = JSON.parse(req.headers['x-test-user']);
      const orgStatus = parsed.organization_status || 'active';
      req.session = req.session || {};
      req.session.user = parsed;
      req.organization = {
        id: parsed.organization_id,
        name: parsed.organization_name || 'Test Org',
        slug: parsed.organization_slug || 'test-org',
        status: orgStatus,
      };

      // Si no es platform_admin, validar estado de la organización en modo test también
      if (!parsed.is_platform_admin && parsed.role !== 'platform_admin') {
        if (orgStatus === 'pending') {
          return res.status(403).json({
            error: 'Tu organización se encuentra pendiente de verificación empresarial. Contacta al administrador del sistema.',
            code: 'ORGANIZATION_PENDING',
            status: 'pending'
          });
        }
        if (orgStatus === 'rejected') {
          return res.status(403).json({
            error: 'La solicitud de tu organización fue rechazada.',
            code: 'ORGANIZATION_REJECTED',
            status: 'rejected'
          });
        }
        if (orgStatus === 'suspended') {
          return res.status(403).json({
            error: 'Tu organización ha sido suspendida por incumplimiento de políticas de seguridad.',
            code: 'ORGANIZATION_SUSPENDED',
            status: 'suspended'
          });
        }
      }

      return next();
    } catch {}
  }

  if (!req.session?.user?.id) {
    return res.status(401).json({ error: 'Debes iniciar sesión.' });
  }

  try {
    const user = await req.app.locals.database.prepare(`
      SELECT users.id, users.name, users.username, users.email, users.role, users.role_id,
             users.organization_id, users.active, users.is_platform_admin, users.email_verified,
             users.github_username, users.gitlab_username, users.profile_photo, users.last_seen_at,
             organizations.name AS organization_name, organizations.slug AS organization_slug,
             organizations.status AS organization_status
      FROM users
      JOIN organizations ON organizations.id = users.organization_id
      WHERE users.id = ? AND users.active = 1
    `).get(req.session.user.id);

    if (!user) {
      return req.session.destroy(() => res.status(401).json({ error: 'La sesión ya no es válida.' }));
    }

    // Los administradores de plataforma pueden acceder a funciones de plataforma independientemente del estado
    const isPlatform = isPlatformAdmin(user);
    if (!isPlatform) {
      const orgStatus = user.organization_status;
      if (orgStatus === 'pending') {
        return res.status(403).json({
          error: 'Tu organización se encuentra pendiente de verificación empresarial. Contacta al administrador del sistema.',
          code: 'ORGANIZATION_PENDING',
          status: 'pending'
        });
      }
      if (orgStatus === 'rejected') {
        return res.status(403).json({
          error: 'La solicitud de tu organización fue rechazada.',
          code: 'ORGANIZATION_REJECTED',
          status: 'rejected'
        });
      }
      if (orgStatus === 'suspended') {
        return res.status(403).json({
          error: 'Tu organización ha sido suspendida por incumplimiento de políticas de seguridad.',
          code: 'ORGANIZATION_SUSPENDED',
          status: 'suspended'
        });
      }
    }

    await req.app.locals.database.prepare('UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
    user.last_seen_at = new Date().toISOString();
    req.session.user = user;
    req.organization = {
      id: user.organization_id,
      name: user.organization_name,
      slug: user.organization_slug,
      status: user.organization_status,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware para requerir un estado empresarial específico ('approved', 'active').
 */
function requireCompanyStatus(...allowedStatuses) {
  const allowed = allowedStatuses.length ? allowedStatuses : ['approved', 'active'];
  return (req, res, next) => {
    if (!req.organization || !allowed.includes(req.organization.status)) {
      return res.status(403).json({
        error: 'Tu organización no cuenta con la verificación empresarial requerida para este servicio.',
        code: 'FORBIDDEN_COMPANY_STATUS',
        current_status: req.organization?.status || 'unknown'
      });
    }
    next();
  };
}

/**
 * Middleware para autorización basada en permisos granulares (RBAC).
 */
function requirePermission(requiredPermission) {
  return (req, res, next) => {
    if (!req.session?.user) {
      return res.status(401).json({ error: 'Debes iniciar sesión.' });
    }
    if (!hasPermission(req.session.user, requiredPermission)) {
      return res.status(403).json({
        error: 'No tienes permisos suficientes para realizar esta acción.',
        code: 'INSUFFICIENT_PERMISSIONS',
        required_permission: requiredPermission
      });
    }
    next();
  };
}

/**
 * Middleware exclusivo para administradores globales de la plataforma.
 */
function requirePlatformAdmin(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Debes iniciar sesión.' });
  }
  if (!isPlatformAdmin(req.session.user)) {
    return res.status(403).json({
      error: 'Esta acción es exclusiva para administradores de la plataforma.',
      code: 'PLATFORM_ADMIN_REQUIRED'
    });
  }
  next();
}

/**
 * Middleware para administradores de la empresa (o platform_admin).
 */
function requireAdmin(req, res, next) {
  if (!req.session?.user || !isCompanyAdmin(req.session.user)) {
    return res.status(403).json({
      error: 'No tienes permisos para realizar esta acción.',
      code: 'ADMIN_REQUIRED'
    });
  }
  next();
}

/**
 * Middleware para verificar uno o varios roles específicos.
 */
function requireRole(...roles) {
  const normalizedAllowed = roles.map(r => normalizeRole(r));
  return (req, res, next) => {
    if (!req.session?.user) {
      return res.status(401).json({ error: 'Debes iniciar sesión.' });
    }
    const userRole = normalizeRole(req.session.user.role);
    if (isPlatformAdmin(req.session.user)) {
      return next();
    }
    // 'admin' y 'company_admin' son equivalentes
    const isAllowed = normalizedAllowed.includes(userRole) ||
      (userRole === 'admin' && normalizedAllowed.includes('company_admin')) ||
      (userRole === 'company_admin' && normalizedAllowed.includes('admin'));

    if (!isAllowed) {
      return res.status(403).json({
        error: 'No tienes permisos para realizar esta acción.',
        code: 'FORBIDDEN_ROLE'
      });
    }
    next();
  };
}

/**
 * Middleware para miembros y roles de mayor jerarquía.
 */
function requireMember(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Debes iniciar sesión.' });
  }
  const role = normalizeRole(req.session.user.role);
  if (['member', 'project_manager', 'company_admin', 'admin', 'platform_admin'].includes(role) || isPlatformAdmin(req.session.user)) {
    return next();
  }
  return res.status(403).json({
    error: 'Esta acción es exclusiva para integrantes.',
    code: 'MEMBER_REQUIRED'
  });
}

module.exports = {
  requireAuth,
  requireCompanyStatus,
  requirePermission,
  requirePlatformAdmin,
  requireAdmin,
  requireMember,
  requireRole,
};
