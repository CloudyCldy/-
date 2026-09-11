const bcrypt = require('bcrypt');

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
  const { company_name, slug, email, description = '', github_url, first_name, last_name, admin_email, password } = req.body;
  const name = String(company_name || '').trim();
  const shortName = String(slug || '').trim().toLowerCase();
  const adminName = `${String(first_name || '').trim()} ${String(last_name || '').trim()}`.trim();
  if (!name || !/^[a-z0-9][a-z0-9-]{2,49}$/.test(shortName) || !email || !adminName || !admin_email || String(password || '').length < 8) return res.status(400).json({ error: 'Completa los datos de organización y una contraseña de al menos 8 caracteres.' });
  let github = {};
  try { github = parseGithubUrl(github_url); } catch (error) { return res.status(400).json({ error: error.message }); }
  try {
    const database = req.app.locals.database;
    const result = await database.transaction(async ({ query }) => {
      const organization = (await query('INSERT INTO organizations (name, slug, email, description, github_url, github_owner, github_repository) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [name, shortName, String(email).trim(), String(description).trim(), github.url || null, github.owner || null, github.repository || null])).rows[0];
      const role = (await query("SELECT id FROM roles WHERE name = 'admin'")).rows[0];
      const username = shortName.replace(/-/g, '_');
      const user = (await query('INSERT INTO users (name, username, email, password, role, role_id, organization_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, name, username, email, role, role_id, organization_id', [adminName, username, String(admin_email).trim(), await bcrypt.hash(String(password), 12), 'admin', role.id, organization.id])).rows[0];
      await query('INSERT INTO github_configurations (organization_id, owner, repository, repository_url) VALUES ($1,$2,$3,$4)', [organization.id, github.owner || null, github.repository || null, github.url || null]);
      return { organization, user };
    });
    req.session.user = result.user;
    res.status(201).json({ organization: result.organization, user: result.user, redirect: '/admin/dashboard' });
  } catch (error) {
    res.status(error.code === '23505' ? 409 : 400).json({ error: error.code === '23505' ? 'El slug, usuario o correo ya está registrado.' : 'No fue posible crear la organización.' });
  }
}

async function current(req, res) {
  const organization = await req.app.locals.database.prepare('SELECT id, name, slug, email, description, github_url, github_owner, github_repository, status, created_at, updated_at FROM organizations WHERE id = ?').get(req.session.user.organization_id);
  res.json(organization);
}

async function update(req, res) {
  const { name, slug, email, description, github_url } = req.body;
  if (slug !== undefined && !/^[a-z0-9][a-z0-9-]{2,49}$/.test(String(slug))) return res.status(400).json({ error: 'El slug no es válido.' });
  let github = {};
  try { github = parseGithubUrl(github_url); } catch (error) { return res.status(400).json({ error: error.message }); }
  try {
    await req.app.locals.database.prepare('UPDATE organizations SET name = COALESCE(?, name), slug = COALESCE(?, slug), email = COALESCE(?, email), description = COALESCE(?, description), github_url = COALESCE(?, github_url), github_owner = COALESCE(?, github_owner), github_repository = COALESCE(?, github_repository), updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(name?.trim() || null, slug || null, email?.trim() || null, description?.trim() || null, github.url || null, github.owner || null, github.repository || null, req.session.user.organization_id);
    res.json({ ok: true });
  } catch (error) { res.status(error.code === '23505' ? 409 : 400).json({ error: 'No fue posible actualizar la organización.' }); }
}

module.exports = { register, current, update };