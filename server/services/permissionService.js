/**
 * Granular Permissions and Role-Based Access Control (RBAC)
 * Enterprise Security Framework for Haitani & Sanzu
 */

const ROLES = {
  PLATFORM_ADMIN: 'platform_admin',
  COMPANY_ADMIN: 'company_admin',
  ADMIN: 'admin', // Backward-compatible alias for company_admin
  PROJECT_MANAGER: 'project_manager',
  MEMBER: 'member',
  VIEWER: 'viewer',
  SERVICE_INTEGRATION: 'service_integration',
};

const PERMISSIONS = {
  PROJECTS_READ: 'projects:read',
  PROJECTS_CREATE: 'projects:create',
  PROJECTS_UPDATE: 'projects:update',
  PROJECTS_DELETE: 'projects:delete',
  ANALYSIS_RUN: 'analysis:run',
  CHAT_USE: 'chat:use',
  INTEGRATIONS_MANAGE: 'integrations:manage',
  COMPANY_MANAGE_MEMBERS: 'company:manage_members',
  ADMIN_ORGANIZATIONS: 'admin:organizations',
};

const ROLE_PERMISSIONS = {
  [ROLES.PLATFORM_ADMIN]: Object.values(PERMISSIONS),
  [ROLES.COMPANY_ADMIN]: [
    PERMISSIONS.PROJECTS_READ,
    PERMISSIONS.PROJECTS_CREATE,
    PERMISSIONS.PROJECTS_UPDATE,
    PERMISSIONS.PROJECTS_DELETE,
    PERMISSIONS.ANALYSIS_RUN,
    PERMISSIONS.CHAT_USE,
    PERMISSIONS.INTEGRATIONS_MANAGE,
    PERMISSIONS.COMPANY_MANAGE_MEMBERS,
  ],
  [ROLES.ADMIN]: [
    PERMISSIONS.PROJECTS_READ,
    PERMISSIONS.PROJECTS_CREATE,
    PERMISSIONS.PROJECTS_UPDATE,
    PERMISSIONS.PROJECTS_DELETE,
    PERMISSIONS.ANALYSIS_RUN,
    PERMISSIONS.CHAT_USE,
    PERMISSIONS.INTEGRATIONS_MANAGE,
    PERMISSIONS.COMPANY_MANAGE_MEMBERS,
  ],
  [ROLES.PROJECT_MANAGER]: [
    PERMISSIONS.PROJECTS_READ,
    PERMISSIONS.PROJECTS_CREATE,
    PERMISSIONS.PROJECTS_UPDATE,
    PERMISSIONS.ANALYSIS_RUN,
    PERMISSIONS.CHAT_USE,
  ],
  [ROLES.MEMBER]: [
    PERMISSIONS.PROJECTS_READ,
    PERMISSIONS.CHAT_USE,
  ],
  [ROLES.VIEWER]: [
    PERMISSIONS.PROJECTS_READ,
  ],
  [ROLES.SERVICE_INTEGRATION]: [
    PERMISSIONS.PROJECTS_READ,
    PERMISSIONS.PROJECTS_CREATE,
    PERMISSIONS.PROJECTS_UPDATE,
    PERMISSIONS.ANALYSIS_RUN,
    PERMISSIONS.CHAT_USE,
  ],
};

function normalizeRole(role) {
  if (!role) return ROLES.VIEWER;
  const lower = String(role).trim().toLowerCase();
  if (lower === 'admin') return ROLES.ADMIN;
  return lower;
}

function getRolePermissions(role) {
  const normalized = normalizeRole(role);
  return ROLE_PERMISSIONS[normalized] || [];
}

function isPlatformAdmin(user) {
  if (!user) return false;
  return user.role === ROLES.PLATFORM_ADMIN || Boolean(user.is_platform_admin);
}

function isCompanyAdmin(user) {
  if (!user) return false;
  const role = normalizeRole(user.role);
  return isPlatformAdmin(user) || role === ROLES.COMPANY_ADMIN || role === ROLES.ADMIN;
}

function hasPermission(user, requiredPermission) {
  if (!user) return false;
  if (isPlatformAdmin(user)) return true;
  const perms = getRolePermissions(user.role);
  return perms.includes(requiredPermission);
}

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  normalizeRole,
  getRolePermissions,
  isPlatformAdmin,
  isCompanyAdmin,
  hasPermission,
};
