const DEFAULT_BASE_URL = 'https://sanzu.onrender.com';

async function askSanzu({ message, context }) {
  const baseUrl = String(process.env.SANZU_API_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  const chatPath = process.env.SANZU_CHAT_PATH || '/api/chat';
  const endpoint = /^https?:\/\//i.test(chatPath) ? chatPath : `${baseUrl}${chatPath.startsWith('/') ? '' : '/'}${chatPath}`;
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (process.env.SANZU_API_TOKEN) headers.Authorization = `Bearer ${process.env.SANZU_API_TOKEN}`;
  const projectId = process.env.SANZU_PROJECT_ID || context.project?.id;
  const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ message, projectId, context, project: 'Sakura Coffee' }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Sanzu respondió con ${response.status}.`);
  return data;
}

module.exports = { askSanzu };