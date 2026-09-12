const github = require('../services/githubService');
async function projectFor(req, projectId = req.query.project_id || req.body?.project_id) {
	const database = req.app.locals.database;
	const id = projectId ? Number(projectId) : null;
	if (id && Number.isInteger(id)) return database.prepare('SELECT id, organization_id FROM projects WHERE id = ? AND organization_id = ?').get(id, req.session.user.organization_id);
	return database.prepare('SELECT id, organization_id FROM projects WHERE organization_id = ? ORDER BY created_at ASC, id ASC LIMIT 1').get(req.session.user.organization_id);
}
async function configFor(req) {
	const project = await projectFor(req);
	if (!project) return null;
	return req.app.locals.database.prepare('SELECT owner, repository AS repo, repository_url AS url, token, project_id FROM github_project_configurations WHERE project_id = ? AND organization_id = ?').get(project.id, req.session.user.organization_id);
}
async function configure(req, res) {
	const project = await projectFor(req, req.body.project_id);
	if (!project) return res.status(404).json({ error: 'El proyecto seleccionado no existe.' });
	if (!req.body.owner || !req.body.repo || !req.body.token) return res.status(400).json({ error: 'Owner, repositorio y token son obligatorios.' });
	const owner = req.body.owner.trim();
	const repository = req.body.repo.trim();
	await req.app.locals.database.prepare(`INSERT INTO github_project_configurations (project_id, organization_id, owner, repository, repository_url, token) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (project_id) DO UPDATE SET owner = EXCLUDED.owner, repository = EXCLUDED.repository, repository_url = EXCLUDED.repository_url, token = EXCLUDED.token, updated_at = CURRENT_TIMESTAMP`).run(project.id, req.session.user.organization_id, owner, repository, req.body.url || `https://github.com/${owner}/${repository}`, req.body.token);
	res.json({ ok: true, project_id: project.id, message: 'Configuración de GitHub guardada de forma privada para este proyecto.' });
}
async function send(operation, req, res, transform = value => value) { try { const result = await operation(await configFor(req)); if (!result.configured) return res.json({ configured: false, message: 'GitHub aún no está configurado.' }); if (result.error) return res.status(502).json({ configured: true, error: result.error }); res.json({ configured: true, data: transform(result.data) }); } catch (error) { res.status(502).json({ configured: true, error: 'No fue posible conectarse con GitHub.' }); } }
const repository = (req, res) => send(github.repository, req, res, result => result.data);
const commits = (req, res) => send(github.commits, req, res, result => result.data.map(commit => ({ author: commit.commit.author?.name || 'No disponible', github_username: commit.author?.login || null, message: commit.commit.message, date: commit.commit.author?.date, sha: commit.sha.slice(0, 7), url: commit.html_url })));
const branches = (req, res) => send(github.branches, req, res, result => result.data.map(branch => ({ name: branch.name, sha: branch.commit.sha, url: branch.commit.url })));
const pulls = (req, res) => send(github.pulls, req, res, result => result.data.map(pr => ({ number: pr.number, title: pr.title, author: pr.user?.login, state: pr.merged_at ? 'merged' : pr.state, source: pr.head.ref, target: pr.base.ref, date: pr.created_at, updated: pr.updated_at, url: pr.html_url })));
const activity = (req, res) => send(github.activity, req, res, result => result.data.map(event => ({ user: event.actor?.login, action: event.type, date: event.created_at, url: event.repo?.url })));
const test = (req, res) => send(github.repository, req, res, () => ({ message: 'Conexión con GitHub establecida correctamente.' }));
module.exports = { repository, commits, branches, activity, pulls, test, configure };