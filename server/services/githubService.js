let runtimeSettings = {};
function settings(overrides = {}) {
  const url = overrides.url || runtimeSettings.url || process.env.GITHUB_REPOSITORY_URL;
  const configuredRepo = overrides.repo || runtimeSettings.repo || process.env.GITHUB_REPOSITORY;
  const repoFromUrl = url?.match(/github\.com\/[^/]+\/([^/#]+?)(?:\.git)?$/i)?.[1];
  return { owner: overrides.owner || runtimeSettings.owner || process.env.GITHUB_OWNER, repo: configuredRepo || repoFromUrl, url, token: overrides.token || runtimeSettings.token || process.env.GITHUB_TOKEN };
}
function configure(values) { runtimeSettings = { owner: values.owner, repo: values.repo, url: values.url, token: values.token }; }
async function client(overrides) {
  const config = settings(overrides);
  if (!config.owner || !config.repo || !config.token) return null;
  const { Octokit } = await import('@octokit/rest');
  return { api: new Octokit({ auth: config.token }), config };
}
async function request(work, overrides) {
  const connection = await client(overrides);
  if (!connection) return { configured: false };
  try { return { configured: true, data: await work(connection.api, connection.config) }; } catch (error) { return { configured: true, error: error.status === 404 ? 'El repositorio no existe o no tienes permisos.' : 'No fue posible conectarse con GitHub.' }; }
}
const repository = overrides => request((api, config) => api.repos.get({ owner: config.owner, repo: config.repo }), overrides);
const commits = overrides => request((api, config) => api.repos.listCommits({ owner: config.owner, repo: config.repo, per_page: 30 }), overrides);
const branches = overrides => request((api, config) => api.repos.listBranches({ owner: config.owner, repo: config.repo, per_page: 100 }), overrides);
const pulls = overrides => request((api, config) => api.pulls.list({ owner: config.owner, repo: config.repo, state: 'all', per_page: 30 }), overrides);
const activity = overrides => request((api, config) => api.repos.listEvents({ owner: config.owner, repo: config.repo, per_page: 30 }), overrides);
module.exports = { settings, configure, repository, commits, branches, pulls, activity };