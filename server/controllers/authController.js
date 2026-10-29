const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getRolePermissions, isPlatformAdmin } = require('../services/permissionService');
const { logAudit } = require('../services/auditService');

async function planFor(database, organizationId) {
  const plan = await database.prepare(`
    SELECT plans.key, plans.name, plans.max_users, plans.max_projects,
           plans.max_storage_mb, plans.features, organizations.subscription_status
    FROM organizations JOIN plans ON plans.id = organizations.plan_id
    WHERE organizations.id = ?
  `).get(organizationId);
  const sandboxMode = String(process.env.SANDBOX_MODE || '').trim().toLowerCase() === 'true';
  if (!sandboxMode && ['pending', 'past_due'].includes(plan?.subscription_status)) return database.prepare(`
    SELECT plans.key, plans.name, plans.max_users, plans.max_projects,
           plans.max_storage_mb, plans.features, organizations.subscription_status
    FROM organizations JOIN plans ON plans.key = 'free'
    WHERE organizations.id = ?
  `).get(organizationId);
  return plan;
}

async function login(req, res) {
  const database = req.app.locals.database;
  const value = String(req.body.username || req.body.email || '').trim();
  const password = String(req.body.password || '');

  if (!value || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos.' });
  }

  const user = await database.prepare('SELECT * FROM users WHERE (username = ? OR email = ?) AND active = 1').get(value, value);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  }

  // Verificar estado de la organización (salvo si es plataforma admin)
  if (user.organization_id && !user.is_platform_admin && user.role !== 'platform_admin') {
    const org = await database.prepare('SELECT id, status, name FROM organizations WHERE id = ?').get(user.organization_id);
    if (org) {
      if (org.status === 'pending') {
        return res.status(403).json({
          error: 'Tu organización se encuentra pendiente de verificación empresarial. Contacta al administrador del sistema.',
          code: 'ORGANIZATION_PENDING',
          status: 'pending'
        });
      }
      if (org.status === 'rejected') {
        return res.status(403).json({
          error: 'La solicitud de tu organización fue rechazada.',
          code: 'ORGANIZATION_REJECTED',
          status: 'rejected'
        });
      }
      if (org.status === 'suspended') {
        return res.status(403).json({
          error: 'Tu organización ha sido suspendida por incumplimiento de políticas de seguridad.',
          code: 'ORGANIZATION_SUSPENDED',
          status: 'suspended'
        });
      }
    }
  }

  const { password: _, password_reset_token: _prt, email_verification_token: _evt, ...safeUser } = user;
  safeUser.permissions = getRolePermissions(safeUser.role);
  req.session.user = safeUser;

  res.json({
    user: safeUser,
    plan: await planFor(database, safeUser.organization_id),
    redirect: ['admin', 'company_admin', 'platform_admin'].includes(safeUser.role) ? '/admin/dashboard' : '/member/dashboard'
  });
}

async function me(req, res) {
  if (!req.session.user) return res.json({ user: null, plan: null });
  const permissions = getRolePermissions(req.session.user.role);
  res.json({
    user: { ...req.session.user, permissions },
    plan: await planFor(req.app.locals.database, req.session.user.organization_id),
    organization: req.organization || null
  });
}

function logout(req, res) {
  req.session.destroy(() => res.json({ ok: true }));
}

async function forgotPassword(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Ingresa un correo electrónico válido.' });
  }

  const database = req.app.locals.database;
  const user = await database.prepare('SELECT id, email, organization_id FROM users WHERE email = ? AND active = 1').get(email);

  if (!user) {
    // Respuesta ambigua para mitigar enumeración de cuentas
    return res.json({ ok: true, message: 'Si el correo está registrado, se enviaron las instrucciones para restablecer la contraseña.' });
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString(); // 1 hora

  await database.prepare(`
    UPDATE users
    SET password_reset_token = ?, password_reset_expires = ?
    WHERE id = ?
  `).run(tokenHash, expiresAt, user.id);

  await logAudit(database, {
    userId: user.id,
    organizationId: user.organization_id,
    action: 'password_reset_requested',
    entityType: 'user',
    entityId: user.id,
    ip: req.ip
  });

  const responsePayload = {
    ok: true,
    message: 'Si el correo está registrado, se enviaron las instrucciones para restablecer la contraseña.'
  };

  if (process.env.NODE_ENV === 'test') {
    responsePayload.reset_token = rawToken;
  }

  res.json(responsePayload);
}

async function resetPassword(req, res) {
  const { token, password } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Token de recuperación requerido.' });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
  }

  const database = req.app.locals.database;
  const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

  const user = await database.prepare(`
    SELECT id, organization_id, password_reset_expires
    FROM users
    WHERE password_reset_token = ?
  `).get(tokenHash);

  if (!user) {
    return res.status(400).json({ error: 'El token de recuperación es inválido o ha expirado.' });
  }

  if (user.password_reset_expires && new Date(user.password_reset_expires) < new Date()) {
    return res.status(400).json({ error: 'El token de recuperación ha expirado.' });
  }

  const hashedPassword = await bcrypt.hash(String(password), 12);
  await database.prepare(`
    UPDATE users
    SET password = ?, password_reset_token = NULL, password_reset_expires = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(hashedPassword, user.id);

  await logAudit(database, {
    userId: user.id,
    organizationId: user.organization_id,
    action: 'password_reset_completed',
    entityType: 'user',
    entityId: user.id,
    ip: req.ip
  });

  res.json({ ok: true, message: 'Contraseña actualizada exitosamente.' });
}

async function verifyEmail(req, res) {
  const token = String(req.body.token || '').trim();
  if (!token) {
    return res.status(400).json({ error: 'Token de verificación de correo requerido.' });
  }

  const database = req.app.locals.database;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const user = await database.prepare(`
    SELECT id, organization_id, email_verification_expires
    FROM users
    WHERE email_verification_token = ?
  `).get(tokenHash);

  if (!user) {
    return res.status(400).json({ error: 'El token de verificación es inválido o ha expirado.' });
  }

  if (user.email_verification_expires && new Date(user.email_verification_expires) < new Date()) {
    return res.status(400).json({ error: 'El token de verificación ha expirado.' });
  }

  await database.prepare(`
    UPDATE users
    SET email_verified = true, email_verification_token = NULL, email_verification_expires = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(user.id);

  await logAudit(database, {
    userId: user.id,
    organizationId: user.organization_id,
    action: 'email_verified',
    entityType: 'user',
    entityId: user.id,
    ip: req.ip
  });

  res.json({ ok: true, message: 'Correo electrónico verificado exitosamente.' });
}

module.exports = {
  login,
  me,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
};
