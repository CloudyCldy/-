/**
 * Centralized Audit Service
 * Records administrative and security decisions in compliance with Enterprise Security Standards.
 */

async function logAudit(database, {
  userId = null,
  organizationId = null,
  action,
  entityType = 'organization',
  entityId = null,
  details = {},
  ip = null
}) {
  try {
    if (!database?.prepare) return;
    await database.prepare(`
      INSERT INTO audit_logs (user_id, organization_id, action, entity_type, entity_id, details, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      organizationId,
      action,
      entityType,
      entityId ? String(entityId) : null,
      JSON.stringify(details || {}),
      ip
    );
  } catch (err) {
    console.warn(`[AuditService] No fue posible registrar log de auditoría (${action}):`, err.message);
  }
}

async function getAuditLogs(database, { organizationId = null, limit = 50, offset = 0 } = {}) {
  try {
    if (organizationId) {
      return await database.prepare(`
        SELECT audit_logs.*, users.username AS actor_username, users.name AS actor_name
        FROM audit_logs
        LEFT JOIN users ON users.id = audit_logs.user_id
        WHERE audit_logs.organization_id = ?
        ORDER BY audit_logs.created_at DESC
        LIMIT ? OFFSET ?
      `).all(organizationId, limit, offset);
    }
    return await database.prepare(`
      SELECT audit_logs.*, users.username AS actor_username, users.name AS actor_name,
             organizations.name AS organization_name, organizations.slug AS organization_slug
      FROM audit_logs
      LEFT JOIN users ON users.id = audit_logs.user_id
      LEFT JOIN organizations ON organizations.id = audit_logs.organization_id
      ORDER BY audit_logs.created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
  } catch (err) {
    console.warn('[AuditService] Error al consultar logs de auditoría:', err.message);
    return [];
  }
}

module.exports = {
  logAudit,
  getAuditLogs,
};
