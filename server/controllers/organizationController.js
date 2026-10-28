const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { logAudit } = require('../services/auditService');

function parseGithubUrl(value) {
  if (!value) return {};
  try {
    const url = new URL(String(value));
    if (url.hostname.toLowerCase() !== 'github.com') throw new Error('La URL de GitHub no es válida.');
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) throw new Error('La URL de GitHub no es válida.');
    return { url: url.toString().replace(/\/$/, ''), owner: parts[0], repository: parts[1].replace(/\.git$/, '') };
  } catch (error) { throw new Error(error.message || 'La URL de GitHub no es válida.'); }
}

async function register(req, res) {
  const {
    company_name,
    slug,
    email,
    description = '',
    domain,
    website,
    official_registry_number,
    github_url,
    first_name,
    last_name,
    admin_name,
    admin_email,
    password,
    plan_key = 'free'
  } = req.body;

  const name = String(company_name || '').trim();
  const shortName = String(slug || '').trim().toLowerCase();
  const resolvedAdminName = admin_name ? String(admin_name).trim() : `${String(first_name || '').trim()} ${String(last_name || '').trim()}`.trim();
  const orgEmail = String(email || admin_email || '').trim().toLowerCase();
  const userEmail = String(admin_email || email || '').trim().toLowerCase();

  if (!name || !/^[a-z0-9][a-z0-9-]{2,49}$/.test(shortName) || !orgEmail || !resolvedAdminName || !userEmail || String(password || '').length < 8) {
    return res.status(400).json({ error: 'Completa los datos de organización y una contraseña de al menos 8 caracteres.' });
  }

  // Resolver dominio corporativo
  let corporateDomain = domain ? String(domain).trim().toLowerCase() : null;
  if (!corporateDomain && orgEmail.includes('@')) {
    corporateDomain = orgEmail.split('@')[1];
  }

  let github = {};
  try {
    github = parseGithubUrl(github_url);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  try {
    const database = req.app.locals.database;
    const rawVerificationToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawVerificationToken).digest('hex');
    const verificationExpires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    const result = await database.transaction(async ({ query }) => {
      const plan = (await query('SELECT id, key FROM plans WHERE key = $1', [String(plan_key).trim().toLowerCase()])).rows[0];
      if (!plan) {
        const error = new Error('El plan seleccionado no existe.');
        error.code = 'INVALID_PLAN';
        throw error;
      }

      const subscriptionStatus = plan.key === 'free' ? 'active' : 'pending';

      // Toda nueva organización empresarial inicia estrictamente en estado 'pending'
      const orgStatus = 'pending';

      const organization = (await query(
        `INSERT INTO organizations
          (name, slug, email, domain, website, official_registry_number, description, github_url, github_owner, github_repository, plan_id, status, subscription_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING *`,
        [
          name,
          shortName,
          orgEmail,
          corporateDomain,
          website ? String(website).trim() : null,
          official_registry_number ? String(official_registry_number).trim() : null,
          String(description).trim(),
          github.url || null,
          github.owner || null,
          github.repository || null,
          plan.id,
          orgStatus,
          subscriptionStatus
        ]
      )).rows[0];

      // Asignar rol de company_admin (o admin para compatibilidad)
      let role = (await query("SELECT id FROM roles WHERE name = 'company_admin'")).rows[0];
      if (!role) {
        role = (await query("SELECT id FROM roles WHERE name = 'admin'")).rows[0];
      }

      const username = shortName.replace(/-/g, '_');
      const hashedPassword = await bcrypt.hash(String(password), 12);

      const user = (await query(
        `INSERT INTO users
          (name, username, email, password, role, role_id, organization_id, email_verified, email_verification_token, email_verification_expires)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id, name, username, email, role, role_id, organization_id, email_verified`,
        [
          resolvedAdminName,
          username,
          userEmail,
          hashedPassword,
          'company_admin',
          role.id,
          organization.id,
          false,
          tokenHash,
          verificationExpires
        ]
      )).rows[0];

      await query(
        'INSERT INTO github_configurations (organization_id, owner, repository, repository_url) VALUES ($1,$2,$3,$4)',
        [organization.id, github.owner || null, github.repository || null, github.url || null]
      );

      return { organization, user };
    });

    // Registrar en auditoría la solicitud de registro empresarial
    await logAudit(database, {
      userId: result.user.id,
      organizationId: result.organization.id,
      action: 'organization_registered',
      entityType: 'organization',
      entityId: result.organization.id,
      details: {
        company_name: name,
        slug: shortName,
        domain: corporateDomain,
        website: website || null,
        email: orgEmail,
        status: 'pending'
      },
      ip: req.ip
    });

    // La cuenta se registra en estado 'pending'. No se permite acceso a servicios empresariales.
    res.status(201).json({
      ok: true,
      status: 'pending',
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
        status: result.organization.status,
        domain: result.organization.domain,
        website: result.organization.website
      },
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        email_verified: false
      },
      message: 'Registro empresarial recibido con éxito. Su solicitud se encuentra pendiente de verificación y aprobación por un administrador.',
      verification_token: process.env.NODE_ENV === 'test' ? rawVerificationToken : undefined,
      redirect: '/#/pending-verification'
    });
  } catch (error) {
    res.status(error.code === '23505' ? 409 : 400).json({
      error: error.code === '23505'
        ? 'El slug, usuario o correo ya está registrado.'
        : error.code === 'INVALID_PLAN'
          ? error.message
          : 'No fue posible crear la organización.'
    });
  }
}

async function current(req, res) {
  const organization = await req.app.locals.database.prepare(`
    SELECT organizations.id, organizations.name, organizations.slug, organizations.email,
           organizations.domain, organizations.website, organizations.official_registry_number,
           organizations.official_verified, organizations.verification_notes, organizations.verified_at,
           organizations.description, organizations.github_url, organizations.github_owner,
           organizations.github_repository, organizations.status, organizations.plan_id,
           organizations.subscription_status, organizations.current_period_end,
           organizations.created_at, organizations.updated_at,
           plans.key AS plan_key, plans.name AS plan_name
    FROM organizations
    LEFT JOIN plans ON plans.id = organizations.plan_id
    WHERE organizations.id = ?
  `).get(req.session.user.organization_id);

  res.json(organization);
}

async function usage(req, res) {
  const organizationId = req.session.user.organization_id;
  const database = req.app.locals.database;
  const plan = await database.prepare(`
    SELECT organizations.plan_id, organizations.subscription_status, organizations.current_period_end,
           plans.key, plans.name, plans.price_cents, plans.currency, plans.max_users, plans.max_projects,
           plans.max_storage_mb, plans.features
    FROM organizations
    JOIN plans ON plans.id = organizations.plan_id
    WHERE organizations.id = ?
  `).get(organizationId);

  const [users, projects, files] = await Promise.all([
    database.prepare('SELECT COUNT(*)::integer AS count FROM users WHERE organization_id = ?').get(organizationId),
    database.prepare('SELECT COUNT(*)::integer AS count FROM projects WHERE organization_id = ?').get(organizationId),
    database.prepare('SELECT COALESCE(SUM(size), 0)::bigint AS bytes FROM files WHERE organization_id = ?').get(organizationId)
  ]);

  const limits = plan.subscription_status === 'pending'
    ? await database.prepare('SELECT max_users, max_projects, max_storage_mb FROM plans WHERE key = ?').get('free')
    : plan;

  res.json({
    plan,
    limits,
    usage: {
      users: users.count,
      projects: projects.count,
      storage_mb: Number(files.bytes) / (1024 * 1024)
    }
  });
}

async function update(req, res) {
  const { name, slug, email, description, github_url, domain, website } = req.body;

  // Prevención de escalada de privilegios: Los usuarios NO pueden alterar 'status', 'verified_at', 'plan_id', 'official_verified'
  if (req.body.status !== undefined || req.body.official_verified !== undefined) {
    return res.status(403).json({
      error: 'No tienes autorización para modificar el estado o verificación de la empresa.',
      code: 'PRIVILEGE_ESCALATION_BLOCKED'
    });
  }

  if (slug !== undefined && !/^[a-z0-9][a-z0-9-]{2,49}$/.test(String(slug))) {
    return res.status(400).json({ error: 'El slug no es válido.' });
  }

  let github = {};
  try {
    github = parseGithubUrl(github_url);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  try {
    await req.app.locals.database.prepare(`
      UPDATE organizations
      SET name = COALESCE(?, name),
          slug = COALESCE(?, slug),
          email = COALESCE(?, email),
          domain = COALESCE(?, domain),
          website = COALESCE(?, website),
          description = COALESCE(?, description),
          github_url = COALESCE(?, github_url),
          github_owner = COALESCE(?, github_owner),
          github_repository = COALESCE(?, github_repository),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name?.trim() || null,
      slug || null,
      email?.trim() || null,
      domain?.trim() || null,
      website?.trim() || null,
      description?.trim() || null,
      github.url || null,
      github.owner || null,
      github.repository || null,
      req.session.user.organization_id
    );

    res.json({ ok: true, message: 'Organización actualizada exitosamente.' });
  } catch (error) {
    res.status(error.code === '23505' ? 409 : 400).json({
      error: 'No fue posible actualizar la organización.'
    });
  }
}

module.exports = {
  register,
  current,
  update,
  usage
};
