const github = require('../services/githubService');

// Proyecto seleccionado (?project_id=) o el primero de la organización.
async function projectFor(req, projectId = req.query.project_id || req.body?.project_id) {
	const database = req.app.locals.database;
	const id = projectId ? Number(projectId) : null;
	if (id && Number.isInteger(id)) return database.prepare('SELECT id, organization_id, repository_url FROM projects WHERE id = ? AND organization_id = ?').get(id, req.session.user.organization_id);
	return database.prepare('SELECT id, organization_id, repository_url FROM projects WHERE organization_id = ? ORDER BY created_at ASC, id ASC LIMIT 1').get(req.session.user.organization_id);
}

// Configuración guardada del proyecto; si no hay, se usa la URL de repositorio capturada en el proyecto.
async function configFor(req) {
	const project = await projectFor(req);
	if (!project) return null;
	const saved = await req.app.locals.database.prepare('SELECT owner, repository AS repo, repository_url AS url, token, project_id FROM github_project_configurations WHERE project_id = ? AND organization_id = ?').get(project.id, req.session.user.organization_id);
	if (saved) return saved;
	if (project.repository_url && github.parseRepoUrl(project.repository_url)) return { url: project.repository_url, project_id: project.id };
	return null;
}

async function config(req, res) {
	const project = await projectFor(req);
	if (!project) return res.json({ configured: false });
	const current = await configFor(req);
	if (!current) return res.json({ configured: false, project_id: project.id });
	const parsed = github.settings(current);
	res.json({ configured: true, project_id: project.id, owner: parsed.owner, repo: parsed.repo, url: parsed.url, has_token: Boolean(current.token) });
}

async function configure(req, res) {
	const database = req.app.locals.database;
	const project = await projectFor(req, req.body.project_id);
	if (!project) return res.status(404).json({ error: 'El proyecto seleccionado no existe.' });
	const fromUrl = github.parseRepoUrl(req.body.url) || {};
	const owner = String(req.body.owner || fromUrl.owner || '').trim();
	const repository = String(req.body.repo || fromUrl.repo || '').trim();
	if (!owner || !repository) return res.status(400).json({ error: 'Escribe la URL del repositorio, por ejemplo https://github.com/usuario/proyecto' });
	const previous = await database.prepare('SELECT owner, repository, token FROM github_project_configurations WHERE project_id = ? AND organization_id = ?').get(project.id, req.session.user.organization_id);
	// Si no se escribe un token nuevo y es el mismo repositorio, se conserva el que ya estaba
	let token = String(req.body.token || '').trim();
	if (!token && previous && previous.owner === owner && previous.repository === repository) token = previous.token || '';
	const url = `https://github.com/${owner}/${repository}`;
	await database.prepare(`INSERT INTO github_project_configurations (project_id, organization_id, owner, repository, repository_url, token) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (project_id) DO UPDATE SET owner = EXCLUDED.owner, repository = EXCLUDED.repository, repository_url = EXCLUDED.repository_url, token = EXCLUDED.token, updated_at = CURRENT_TIMESTAMP`).run(project.id, req.session.user.organization_id, owner, repository, url, token);
	await database.prepare('UPDATE projects SET repository_url = ? WHERE id = ? AND organization_id = ?').run(url, project.id, req.session.user.organization_id).catch(() => {});
	github.clearCache();
	const check = await github.repository({ owner, repo: repository, token });
	if (check.error) return res.json({ ok: true, project_id: project.id, warning: check.error, message: `Se guardó el repositorio, pero: ${check.error}` });
	res.json({ ok: true, project_id: project.id, message: 'Repositorio vinculado y sincronizado correctamente.' });
}

async function send(operation, req, res, transform = value => value) {
	try {
		const result = await operation(await configFor(req));
		if (!result.configured) return res.json({ configured: false, message: 'Este proyecto aún no tiene un repositorio de GitHub vinculado.' });
		if (result.error) return res.json({ configured: true, error: result.error });
		res.json({ configured: true, data: transform(result.data) });
	} catch (error) {
		res.json({ configured: true, error: 'No fue posible conectarse con GitHub.' });
	}
}

const repository = (req, res) => send(github.repository, req, res, result => result.data);
const commits = (req, res) => send(github.commits, req, res, result => result.data.map(commit => ({ author: commit.commit.author?.name || 'No disponible', github_username: commit.author?.login || null, message: commit.commit.message, date: commit.commit.author?.date, sha: commit.sha.slice(0, 7), url: commit.html_url })));
const branches = (req, res) => send(github.branches, req, res, result => result.data.map(branch => ({ name: branch.name, sha: branch.commit.sha, url: branch.commit.url })));
const pulls = (req, res) => send(github.pulls, req, res, result => result.data.map(pr => ({ number: pr.number, title: pr.title, author: pr.user?.login, state: pr.merged_at ? 'merged' : pr.state, source: pr.head.ref, target: pr.base.ref, date: pr.created_at, updated: pr.updated_at, url: pr.html_url })));
const activity = (req, res) => send(github.activity, req, res, result => result.data.map(event => ({ user: event.actor?.login, action: event.type, date: event.created_at, url: event.repo?.url })));
const test = (req, res) => send(github.repository, req, res, () => ({ message: 'Conexión con GitHub establecida correctamente.' }));

module.exports = { repository, commits, branches, activity, pulls, test, configure, config };
