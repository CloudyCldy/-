const crypto = require('crypto');

const DEFAULT_BASE_URL = 'https://sanzu.onrender.com';

function readableError(value) {
  if (typeof value === 'string' && value.trim()) return value;
  if (value && typeof value === 'object') {
    if (typeof value.message === 'string') return value.message;
    if (typeof value.error === 'string') return value.error;
    try { return JSON.stringify(value); } catch {}
  }
  return '';
}

function baseUrl() {
  return String(process.env.SANZU_API_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
}

function technicalCredentials(organization) {
  return {
    email: `org-${organization.id}@haitani.internal`,
    password: crypto.createHash('sha256').update(`haitani-sanzu-technical-account:${organization.id}:${organization.slug}`).digest('hex')
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...options,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(readableError(data.error || data.message) || `Sanzu respondió con ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function authenticate(organization) {
  const credentials = technicalCredentials(organization);
  try {
    return (await request('/api/auth/login', { method: 'POST', body: JSON.stringify(credentials) })).data.token;
  } catch (error) {
    if (error.status !== 401 && error.status !== 404) throw error;
    try {
      return (await request('/api/auth/register', { method: 'POST', body: JSON.stringify({ name: `Haitani ${organization.name}`, ...credentials }) })).data.token;
    } catch (registerError) {
      if (registerError.status !== 409) throw registerError;
      return (await request('/api/auth/login', { method: 'POST', body: JSON.stringify(credentials) })).data.token;
    }
  }
}

async function ensureSanzuProject(organization, database) {
  if (organization.sanzu_project_id) return organization;
  /* Cuenta técnica de Sanzu por organización; no es un usuario real de Haitani. */
  const token = await authenticate(organization);
  const project = await request('/api/projects', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: organization.name,
      description: organization.description || `Proyecto de ${organization.name}`,
      methodologyId: organization.sanzu_methodology_id || 'default'
    })
  });
  await database.prepare('UPDATE organizations SET sanzu_project_id = ?, sanzu_token = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(project.data.id, token, organization.id);
  organization.sanzu_project_id = project.data.id;
  organization.sanzu_token = token;
  return organization;
}

async function askSanzu(organization, message, conversationId, database) {
  const current = await ensureSanzuProject(organization, database);
  const body = { projectId: current.sanzu_project_id, message };
  if (conversationId) body.conversationId = conversationId;
  try {
    return (await request('/api/chatbot/message', { method: 'POST', headers: { Authorization: `Bearer ${current.sanzu_token}` }, body: JSON.stringify(body) })).data;
  } catch (error) {
    if (error.status !== 401) throw error;
    const token = await authenticate(current);
    await database.prepare('UPDATE organizations SET sanzu_token = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(token, current.id);
    return (await request('/api/chatbot/message', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })).data;
  }
}

module.exports = { ensureSanzuProject, askSanzu };