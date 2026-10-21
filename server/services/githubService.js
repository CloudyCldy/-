// Conexión con la API de GitHub.
// - Los repositorios públicos funcionan sin token.
// - Para repositorios privados se usa el token guardado en la configuración del proyecto.
// - Las respuestas se guardan 2 minutos en memoria para no gastar el límite de consultas de GitHub.
const cache = new Map();
const CACHE_MS = 2 * 60 * 1000;
let OctokitClass = null;

/** "https://github.com/dueño/repo(.git)" o "dueño/repo" -> { owner, repo } */
function parseRepoUrl(value) {
  const text = String(value || '').trim();
  const fromUrl = text.match(/github\.com[/:]([^/\s]+)\/([^/#?\s]+?)(?:\.git)?\/?(?:[#?].*)?$/i);
  if (fromUrl) return { owner: fromUrl[1], repo: fromUrl[2] };
  const short = text.match(/^([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  return short ? { owner: short[1], repo: short[2] } : null;
}

function settings(overrides = {}) {
  const fromUrl = parseRepoUrl(overrides.url) || {};
  const owner = String(overrides.owner || fromUrl.owner || '').trim();
  const repo = String(overrides.repo || fromUrl.repo || '').trim();
  const token = String(overrides.token || '').trim();
  return { owner, repo, url: owner && repo ? `https://github.com/${owner}/${repo}` : overrides.url || null, token };
}

async function client(overrides) {
  const config = settings(overrides || {});
  if (!config.owner || !config.repo) return null;
  if (!OctokitClass) OctokitClass = (await import('@octokit/rest')).Octokit;
  return { api: new OctokitClass(config.token ? { auth: config.token } : {}), config };
}

function friendlyError(error, config) {
  if (error.status === 404) {
    return config.token
      ? 'No se encontró el repositorio o el token no tiene acceso a él.'
      : 'No se encontró el repositorio. Si es privado, agrega un token de GitHub en la configuración.';
  }
  if (error.status === 401) return 'El token de GitHub no es válido o ya expiró.';
  if (error.status === 403 || error.status === 429) return 'GitHub limitó las consultas por ahora. Intenta en unos minutos o agrega un token.';
  return 'No fue posible conectarse con GitHub.';
}

async function request(name, work, overrides) {
  const connection = await client(overrides);
  if (!connection) return { configured: false };
  const { owner, repo, token } = connection.config;
  const key = `${name}:${owner}/${repo}:${token ? token.slice(-6) : 'public'}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  try {
    const value = { configured: true, data: await work(connection.api, connection.config) };
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (error) {
    return { configured: true, error: friendlyError(error, connection.config) };
  }
}

function clearCache() {
  cache.clear();
}

// Solo para pruebas: permite usar un cliente simulado.
function setOctokitForTests(fake) {
  OctokitClass = fake;
  cache.clear();
}

const repository = overrides => request('repo', (api, c) => api.repos.get({ owner: c.owner, repo: c.repo }), overrides);
const commits = overrides => request('commits', (api, c) => api.repos.listCommits({ owner: c.owner, repo: c.repo, per_page: 30 }), overrides);
const branches = overrides => request('branches', (api, c) => api.repos.listBranches({ owner: c.owner, repo: c.repo, per_page: 100 }), overrides);
const pulls = overrides => request('pulls', (api, c) => api.pulls.list({ owner: c.owner, repo: c.repo, state: 'all', per_page: 30 }), overrides);
const activity = overrides => request('activity', (api, c) => api.repos.listEvents({ owner: c.owner, repo: c.repo, per_page: 30 }), overrides);

module.exports = { settings, parseRepoUrl, repository, commits, branches, pulls, activity, clearCache, setOctokitForTests };
