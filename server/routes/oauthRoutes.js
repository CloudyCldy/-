const router = require('express').Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { exchangeToken, storeToken, listRepos } = require('../services/oauthService');

// Initiate OAuth flow
router.get('/:provider/init', requireAuth, (req, res) => {
  const { provider } = req.params;
  const clientId = process.env[`${provider.toUpperCase()}_CLIENT_ID`];
  const redirectUri = encodeURIComponent(`${process.env.BASE_URL}/api/oauth/${provider}/callback`);
  const authUrl = provider === 'github'
    ? `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=repo`
    : `https://gitlab.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=read_user+read_api`;
  res.redirect(authUrl);
});

// OAuth callback
router.get('/:provider/callback', requireAuth, async (req, res) => {
  const { provider } = req.params;
  const { code } = req.query;
  try {
    const token = await exchangeToken(provider, code);
    if (!token) throw new Error('Token not received');
    // Get username for GitHub (optional for GitLab)
    let username = null;
    if (provider === 'github') {
      const { Octokit } = await import('@octokit/rest');
      const octokit = new Octokit({ auth: token });
      const { data } = await octokit.users.getAuthenticated();
      username = data.login;
    }
    await storeToken(req.session.user.id, provider, token, username);
    res.redirect('/#profile');
  } catch (e) {
    console.error(e);
    res.status(500).send('OAuth error');
  }
});

// List repositories for the authenticated user
router.get('/:provider/repos', requireAuth, async (req, res) => {
  const { provider } = req.params;
  try {
    const conn = await req.app.locals.database.prepare(
      `SELECT access_token, username FROM oauth_connections WHERE user_id = ? AND provider = ?`
    ).get(req.session.user.id, provider);
    if (!conn) return res.status(401).json({ error: 'No token stored' });
    const repos = await listRepos(provider, conn.access_token);
    const simplified = repos.map(r => ({ name: r.name || r.path, url: r.html_url || r.web_url }));
    res.json(simplified);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch repos' });
  }
});

module.exports = router;
