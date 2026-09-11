const DEFAULT_BASE_URL = 'https://sanzu.onrender.com';
const PARTNER_PROJECTS_PATH = '/api/partner/projects';
const CHAT_PATH = '/api/chatbot/message';

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

async function request(path, options = {}) {
  const apiKey = process.env.SANZU_API_KEY;
  if (!apiKey) throw new Error('SANZU_API_KEY no está configurada.');
  const response = await fetch(`${baseUrl()}${path}`, {
    ...options,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Api-Key': apiKey, ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(readableError(data.error || data.message) || `Sanzu respondió con ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function syncProject(project) {
  const payload = {
    externalRef: project.sanzu_external_ref,
    name: project.name,
    methodologyId: project.methodology_id,
    requirements: project.requirements
  };
  const result = await request(PARTNER_PROJECTS_PATH, { method: 'POST', body: JSON.stringify(payload) });
  return result.data || result;
}

async function askSanzu(project, message, conversationId, context = {}) {
  const body = {
    externalRef: project.sanzu_external_ref,
    message,
    context: { methodology_id: project.methodology_id, requirements: project.requirements, ...context }
  };
  if (conversationId) body.conversationId = conversationId;
  return (await request(CHAT_PATH, { method: 'POST', body: JSON.stringify(body) })).data;
}

module.exports = { syncProject, askSanzu };