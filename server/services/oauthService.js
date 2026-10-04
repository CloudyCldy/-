const fetch = globalThis.fetch;

/**
 * Exchange the OAuth authorization code for an access token.
 * @param {string} provider - 'github' or 'gitlab'
 * @param {string} code - The authorization code received from the provider.
 * @returns {Promise<string>} Access token.
 */
async function exchangeToken(provider, code) {
  const redirectUri = `${process.env.BASE_URL}/api/oauth/${provider}/callback`;
  if (provider === 'github') {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri })
    });
    const data = await response.json();
    return data.access_token;
  }
  if (provider === 'gitlab') {
    const clientId = process.env.GITLAB_CLIENT_ID;
    const clientSecret = process.env.GITLAB_CLIENT_SECRET;
    const response = await fetch('https://gitlab.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, grant_type: 'authorization_code', redirect_uri: redirectUri })
    });
    const data = await response.json();
    return data.access_token;
  }
  throw new Error(`Unsupported provider: ${provider}`);
}

/**
 * Store or update an OAuth token for a user.
 * @param {number} userId - The internal user ID.
 * @param {string} provider - 'github' or 'gitlab'.
 * @param {string} token - Access token.
 * @param {string|null} username - Optional username (GitHub only).
 */
async function storeToken(userId, provider, token, username) {
  const sql = `
    INSERT INTO oauth_connections (user_id, provider, access_token, username)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id, provider)
    DO UPDATE SET access_token = EXCLUDED.access_token, username = EXCLUDED.username, created_at = now();
  `;
  await require('../database').pool.query(sql, [userId, provider, token, username]);
}

/**
 * Fetch the list of repositories for a user from the given provider.
 * @param {string} provider - 'github' or 'gitlab'.
 * @param {string} token - Access token.
 * @returns {Promise<Array<{name:string,url:string}>>}
 */
async function listRepos(provider, token) {
  if (provider === 'github') {
    const resp = await fetch('https://api.github.com/user/repos?per_page=100', {
      headers: { Authorization: `token ${token}` }
    });
    const repos = await resp.json();
    return repos;
  }
  if (provider === 'gitlab') {
    const resp = await fetch('https://gitlab.com/api/v4/projects?membership=true&per_page=100', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const projects = await resp.json();
    return projects;
  }
  throw new Error(`Unsupported provider: ${provider}`);
}

module.exports = { exchangeToken, storeToken, listRepos };
