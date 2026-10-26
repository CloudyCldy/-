process.env.NODE_ENV = 'test';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../app');
const { hasPermission, ROLES, PERMISSIONS } = require('../server/services/permissionService');

describe('Pruebas de Seguridad Empresarial y Autorización Granular (Haitani)', () => {
  let originalDatabase;
  let mockDb;

  // Datos simulados en memoria para pruebas de aislamiento
  const orgAlpha = {
    id: 10,
    name: 'Corporación Alpha',
    slug: 'alpha-corp',
    email: 'contacto@alpha.com',
    domain: 'alpha.com',
    website: 'https://alpha.com',
    status: 'approved',
    official_registry_number: 'RFC-ALP-123456',
    official_verified: true
  };

  const orgBeta = {
    id: 20,
    name: 'Empresa Beta',
    slug: 'beta-empresa',
    email: 'contacto@beta.com',
    domain: 'beta.com',
    website: 'https://beta.com',
    status: 'approved',
    official_registry_number: 'RFC-BET-654321',
    official_verified: true
  };

  const orgPending = {
    id: 30,
    name: 'Empresa Pendiente',
    slug: 'pending-corp',
    email: 'admin@pending.com',
    domain: 'pending.com',
    status: 'pending',
  };

  const orgSuspended = {
    id: 40,
    name: 'Empresa Suspendida',
    slug: 'suspended-corp',
    email: 'admin@suspended.com',
    domain: 'suspended.com',
    status: 'suspended',
  };

  const orgRejected = {
    id: 50,
    name: 'Empresa Rechazada',
    slug: 'rejected-corp',
    email: 'admin@rejected.com',
    domain: 'rejected.com',
    status: 'rejected',
  };

  const hashedPassword = bcrypt.hashSync('securePassword123', 8);

  const platformAdmin = {
    id: 1,
    username: 'super_platform_admin',
    name: 'Platform Administrator',
    email: 'platform@haitani.local',
    password: hashedPassword,
    role: 'platform_admin',
    is_platform_admin: true,
    email_verified: true,
    active: 1,
    organization_id: orgAlpha.id
  };

  const companyAdminAlpha = {
    id: 101,
    username: 'admin_alpha',
    name: 'Admin Alpha',
    email: 'admin@alpha.com',
    password: hashedPassword,
    role: 'company_admin',
    is_platform_admin: false,
    email_verified: true,
    active: 1,
    organization_id: orgAlpha.id
  };

  const memberAlpha = {
    id: 102,
    username: 'member_alpha',
    name: 'Member Alpha',
    email: 'member@alpha.com',
    password: hashedPassword,
    role: 'member',
    is_platform_admin: false,
    email_verified: true,
    active: 1,
    organization_id: orgAlpha.id
  };

  const companyAdminBeta = {
    id: 201,
    username: 'admin_beta',
    name: 'Admin Beta',
    email: 'admin@beta.com',
    password: hashedPassword,
    role: 'company_admin',
    is_platform_admin: false,
    email_verified: true,
    active: 1,
    organization_id: orgBeta.id
  };

  const pendingUser = {
    id: 301,
    username: 'user_pending',
    name: 'User Pending',
    email: 'user@pending.com',
    password: hashedPassword,
    role: 'company_admin',
    is_platform_admin: false,
    email_verified: false,
    active: 1,
    organization_id: orgPending.id
  };

  const suspendedUser = {
    id: 401,
    username: 'user_suspended',
    name: 'User Suspended',
    email: 'user@suspended.com',
    password: hashedPassword,
    role: 'company_admin',
    is_platform_admin: false,
    email_verified: true,
    active: 1,
    organization_id: orgSuspended.id
  };

  const projectAlpha = {
    id: 1001,
    name: 'Proyecto Confidencial Alpha',
    organization_id: orgAlpha.id,
    manager_id: companyAdminAlpha.id,
    status: 'planning',
    methodology_id: 'SCRUM',
    sanzu_external_ref: 'haitani-proj-1001'
  };

  const projectBeta = {
    id: 2001,
    name: 'Proyecto Confidencial Beta',
    organization_id: orgBeta.id,
    manager_id: companyAdminBeta.id,
    status: 'planning',
    methodology_id: 'SCRUM',
    sanzu_external_ref: 'haitani-proj-2001'
  };

  const auditRecords = [];

  function buildMockDb() {
    return {
      async transaction(fn) {
        return fn({
          async query(sql, params) {
            const s = sql.toLowerCase();
            if (s.includes('select id, key from plans')) {
              return { rows: [{ id: 1, key: params[0] || 'free' }] };
            }
            if (s.includes('insert into organizations')) {
              const newOrg = {
                id: 999,
                name: params[0],
                slug: params[1],
                email: params[2],
                domain: params[3],
                website: params[4],
                official_registry_number: params[5],
                status: params[11] || 'pending',
                subscription_status: params[12] || 'active'
              };
              return { rows: [newOrg] };
            }
            if (s.includes('select id from roles')) {
              return { rows: [{ id: 2 }] };
            }
            if (s.includes('insert into users')) {
              const newUser = {
                id: 9991,
                name: params[0],
                username: params[1],
                email: params[2],
                role: params[4],
                role_id: params[5],
                organization_id: params[6],
                email_verified: params[7]
              };
              return { rows: [newUser] };
            }
            if (s.includes('insert into github_configurations')) {
              return { rows: [] };
            }
            return { rows: [] };
          }
        });
      },
      prepare(sql) {
        const s = sql.toLowerCase().replace(/\s+/g, ' ');
        return {
          async get(...params) {
            if (s.includes('from users') && s.includes('where (username = ? or email = ?)')) {
              const [val] = params;
              if (val === 'super_platform_admin') return platformAdmin;
              if (val === 'admin_alpha' || val === 'admin@alpha.com') return companyAdminAlpha;
              if (val === 'member_alpha' || val === 'member@alpha.com') return memberAlpha;
              if (val === 'admin_beta' || val === 'admin@beta.com') return companyAdminBeta;
              if (val === 'user_pending' || val === 'user@pending.com') return pendingUser;
              if (val === 'user_suspended' || val === 'user@suspended.com') return suspendedUser;
              return null;
            }
            if (s.includes('from users') && (s.includes('where users.id = ?') || s.includes('where id = ?'))) {
              const [id] = params;
              if (id === platformAdmin.id) return { ...platformAdmin, organization_name: orgAlpha.name, organization_slug: orgAlpha.slug, organization_status: orgAlpha.status };
              if (id === companyAdminAlpha.id) return { ...companyAdminAlpha, organization_name: orgAlpha.name, organization_slug: orgAlpha.slug, organization_status: orgAlpha.status };
              if (id === memberAlpha.id) return { ...memberAlpha, organization_name: orgAlpha.name, organization_slug: orgAlpha.slug, organization_status: orgAlpha.status };
              if (id === companyAdminBeta.id) return { ...companyAdminBeta, organization_name: orgBeta.name, organization_slug: orgBeta.slug, organization_status: orgBeta.status };
              if (id === pendingUser.id) return { ...pendingUser, organization_name: orgPending.name, organization_slug: orgPending.slug, organization_status: orgPending.status };
              if (id === suspendedUser.id) return { ...suspendedUser, organization_name: orgSuspended.name, organization_slug: orgSuspended.slug, organization_status: orgSuspended.status };
              return null;
            }
            if (s.includes('from organizations') && s.includes('where id = ?')) {
              const [id] = params;
              if (id === orgAlpha.id) return orgAlpha;
              if (id === orgBeta.id) return orgBeta;
              if (id === orgPending.id) return orgPending;
              if (id === orgSuspended.id) return orgSuspended;
              if (id === orgRejected.id) return orgRejected;
              return null;
            }
            if (s.includes('from projects') && s.includes('where projects.id = ? and projects.organization_id = ?')) {
              const [id, orgId] = params;
              if (id === projectAlpha.id && orgId === orgAlpha.id) return projectAlpha;
              if (id === projectBeta.id && orgId === orgBeta.id) return projectBeta;
              return null;
            }
            if (s.includes('from plans') && s.includes('join organizations')) {
              return { key: 'free', name: 'Free', max_users: 10, max_projects: 5, max_storage_mb: 1024, features: {}, subscription_status: 'active' };
            }
            if (s.includes('where password_reset_token = ?')) {
              return { id: companyAdminAlpha.id, organization_id: orgAlpha.id, password_reset_expires: new Date(Date.now() + 3600000).toISOString() };
            }
            if (s.includes('where email_verification_token = ?')) {
              return { id: pendingUser.id, organization_id: orgPending.id, email_verification_expires: new Date(Date.now() + 3600000).toISOString() };
            }
            return null;
          },
          async all(...params) {
            if (s.includes('from organizations')) {
              return [orgAlpha, orgBeta, orgPending, orgSuspended, orgRejected];
            }
            if (s.includes('from audit_logs')) {
              return auditRecords;
            }
            if (s.includes('from projects') && s.includes('where projects.organization_id = ?')) {
              const [orgId] = params;
              if (orgId === orgAlpha.id) return [projectAlpha];
              if (orgId === orgBeta.id) return [projectBeta];
              return [];
            }
            return [];
          },
          async run(...params) {
            if (s.includes('insert into audit_logs')) {
              auditRecords.push({ action: params[2], entity_type: params[3], details: params[5], created_at: new Date() });
            }
            return { changes: 1, lastInsertRowid: 1 };
          }
        };
      }
    };
  }

  before(() => {
    originalDatabase = app.locals.database;
    mockDb = buildMockDb();
    app.locals.database = mockDb;
  });

  after(() => {
    app.locals.database = originalDatabase;
  });

  // Requisito 1: Registro empresarial con estados y solicitud de datos corporativos
  it('1. Registro empresarial crea organizaciones en estado pending con datos corporativos', async () => {
    const res = await request(app)
      .post('/api/organizations/register')
      .send({
        company_name: 'Soluciones Tecnológicas S.A.',
        slug: 'soluciones-tech',
        email: 'contacto@solucionestech.com',
        domain: 'solucionestech.com',
        website: 'https://solucionestech.com',
        official_registry_number: 'RFC-SOL-2026',
        admin_name: 'Director General',
        admin_email: 'director@solucionestech.com',
        password: 'PasswordRobusto2026',
        plan_key: 'free'
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.status, 'pending');
    assert.strictEqual(res.body.organization.status, 'pending');
    assert.strictEqual(res.body.organization.domain, 'solucionestech.com');
    assert.ok(res.body.message.includes('pendiente de verificación'));
  });

  // Requisito 2: Rechazo de cuentas pendientes, rechazadas y suspendidas
  it('2.1 Rechaza login de usuario con organización pending (403)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'user_pending', password: 'securePassword123' });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.code, 'ORGANIZATION_PENDING');
  });

  it('2.2 Rechaza login de usuario con organización suspended (403)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'user_suspended', password: 'securePassword123' });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.code, 'ORGANIZATION_SUSPENDED');
  });

  it('2.3 Rechaza peticiones de cuentas pending a endpoints protegidos (403)', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set('x-test-user', JSON.stringify({ ...pendingUser, organization_status: 'pending' }));

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.code, 'ORGANIZATION_PENDING');
  });

  it('2.4 Rechaza peticiones de cuentas suspended a endpoints protegidos (403)', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set('x-test-user', JSON.stringify({ ...suspendedUser, organization_status: 'suspended' }));

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.code, 'ORGANIZATION_SUSPENDED');
  });

  // Requisito 3: Aprobación exclusiva por Platform Admin y registro en auditoría
  it('3.1 Rechaza intento de verificación empresarial por usuario normal o company admin (403)', async () => {
    const res = await request(app)
      .post(`/api/admin/organizations/${orgPending.id}/verify`)
      .set('x-test-user', JSON.stringify(companyAdminAlpha))
      .send({ status: 'approved', notes: 'Auto-aprobación no autorizada' });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.code, 'PLATFORM_ADMIN_REQUIRED');
  });

  it('3.2 Permite a Platform Admin aprobar la empresa y registra en auditoría', async () => {
    const res = await request(app)
      .post(`/api/admin/organizations/${orgPending.id}/verify`)
      .set('x-test-user', JSON.stringify(platformAdmin))
      .send({ status: 'approved', notes: 'Validación de existencia legal conforme.' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'approved');
    assert.ok(auditRecords.some(r => r.action === 'organization_approved'));
  });

  it('3.3 Permite verificación oficial ante registros mercantiles / DNS', async () => {
    const res = await request(app)
      .post(`/api/admin/organizations/${orgAlpha.id}/official-check`)
      .set('x-test-user', JSON.stringify(platformAdmin))
      .send({ official_registry_number: 'RFC-ALP-123456' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.verified, true);
    assert.ok(auditRecords.some(r => r.action === 'official_verification_verified'));
  });

  // Requisito 4: Rechazo de endpoints privados sin credenciales (401)
  it('4. Rechaza acceso a proyectos sin autenticación (401)', async () => {
    const res = await request(app).get('/api/projects');
    assert.strictEqual(res.status, 401);
  });

  // Requisito 5: Recuperación de contraseña y verificación de correo segura
  it('5.1 Flujo de recuperación de contraseña genera token temporal', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'admin@alpha.com' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
  });

  it('5.2 Restablece contraseña validando longitud mínima', async () => {
    const badRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'test-token', password: '123' });

    assert.strictEqual(badRes.status, 400);

    const goodRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'test-token', password: 'NuevaPasswordSegura2026' });

    assert.strictEqual(goodRes.status, 200);
    assert.strictEqual(goodRes.body.ok, true);
  });

  it('5.3 Verificación de correo con token criptográfico', async () => {
    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({ token: 'test-email-token' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
  });

  // Requisito 7 & 8: Aislamiento IDOR entre organizaciones (Alpha vs Beta)
  it('8.1 Usuario de Org Beta recibe 404 al intentar consultar proyecto de Org Alpha (IDOR)', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectAlpha.id}`)
      .set('x-test-user', JSON.stringify(companyAdminBeta));

    assert.strictEqual(res.status, 404);
  });

  it('8.2 Usuario de Org Alpha consulta exitosamente su propio proyecto', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectAlpha.id}`)
      .set('x-test-user', JSON.stringify(companyAdminAlpha));

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.id, projectAlpha.id);
  });

  // Requisito 9: Imposibilidad de escalar privilegios modificando el cuerpo HTTP
  it('9.1 Bloquea intento de auto-aprobación modificando status en PUT /api/organizations/current (403)', async () => {
    const res = await request(app)
      .put('/api/organizations/current')
      .set('x-test-user', JSON.stringify(companyAdminAlpha))
      .send({ status: 'approved', official_verified: true });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.code, 'PRIVILEGE_ESCALATION_BLOCKED');
  });

  // Requisito 10: Permisos granulares (hasPermission)
  it('10. Matriz de permisos granulares opera según el rol', () => {
    assert.strictEqual(hasPermission(companyAdminAlpha, PERMISSIONS.PROJECTS_CREATE), true);
    assert.strictEqual(hasPermission(companyAdminAlpha, PERMISSIONS.COMPANY_MANAGE_MEMBERS), true);
    assert.strictEqual(hasPermission(companyAdminAlpha, PERMISSIONS.ADMIN_ORGANIZATIONS), false);

    assert.strictEqual(hasPermission(memberAlpha, PERMISSIONS.PROJECTS_READ), true);
    assert.strictEqual(hasPermission(memberAlpha, PERMISSIONS.PROJECTS_CREATE), false);
    assert.strictEqual(hasPermission(memberAlpha, PERMISSIONS.COMPANY_MANAGE_MEMBERS), false);

    assert.strictEqual(hasPermission(platformAdmin, PERMISSIONS.ADMIN_ORGANIZATIONS), true);
  });
});
