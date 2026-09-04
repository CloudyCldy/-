const github = require('../services/githubService');
function configure(req, res) {
	if (!req.body.owner || !req.body.repo || !req.body.token) return res.status(400).json({ error: 'Owner, repositorio y token son obligatorios.' });
	github.configure(req.body);
	res.json({ ok: true, message: 'Configuración de GitHub guardada en memoria del servidor.' });
}
function send(operation, res, transform = value => value) { operation().then(result => { if (!result.configured) return res.json({ configured: false, message: 'GitHub aún no está configurado.' }); if (result.error) return res.status(502).json({ configured: true, error: result.error }); res.json({ configured: true, data: transform(result.data) }); }); }
const repository = (req, res) => send(github.repository, res, result => result.data);
const commits = (req, res) => send(github.commits, res, result => result.data.map(commit => ({ author: commit.commit.author?.name || 'No disponible', github_username: commit.author?.login || null, message: commit.commit.message, date: commit.commit.author?.date, sha: commit.sha.slice(0, 7), url: commit.html_url })));
const branches = (req, res) => send(github.branches, res, result => result.data.map(branch => ({ name: branch.name, sha: branch.commit.sha, url: branch.commit.url })));
const pulls = (req, res) => send(github.pulls, res, result => result.data.map(pr => ({ number: pr.number, title: pr.title, author: pr.user?.login, state: pr.merged_at ? 'merged' : pr.state, source: pr.head.ref, target: pr.base.ref, date: pr.created_at, updated: pr.updated_at, url: pr.html_url })));
const activity = (req, res) => send(github.activity, res, result => result.data.map(event => ({ user: event.actor?.login, action: event.type, date: event.created_at, url: event.repo?.url })));
const test = (req, res) => send(github.repository, res, () => ({ message: 'Conexión con GitHub establecida correctamente.' }));
module.exports = { repository, commits, branches, activity, pulls, test, configure };