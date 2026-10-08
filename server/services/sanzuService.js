const DEFAULT_BASE_URL = 'https://sanzu.onrender.com';
// Contrato Haitani ↔ Sanzu v1 (ver docs/CONTRATO_HAITANI_SANZU.md en Sanzu).
const API_PREFIX = '/api/v1';
const PARTNER_PROJECTS_PATH = `${API_PREFIX}/partner/projects`;
// El chatbot para integraciones usa API key; /api/chatbot/message requiere JWT de usuario.
const CHAT_PATH = `${API_PREFIX}/partner/chatbot/message`;
const contextPath = externalRef => `${API_PREFIX}/projects/${encodeURIComponent(externalRef)}/context`;
const REQUEST_TIMEOUT_MS = Number(process.env.SANZU_TIMEOUT_MS || 8000);

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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Api-Key': apiKey, ...(options.headers || {}) }
    });
  } catch (cause) {
    const error = new Error(cause?.name === 'AbortError' ? `Sanzu no respondió en ${REQUEST_TIMEOUT_MS} ms.` : `No se pudo conectar con Sanzu: ${cause?.message || cause}`);
    error.code = 'NETWORK_ERROR';
    throw error;
  } finally {
    clearTimeout(timer);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(readableError(data.error || data.message) || `Sanzu respondió con ${response.status}.`);
    error.status = response.status;
    error.code = data?.error?.code;
    throw error;
  }
  return data;
}

async function syncProject(project) {
  const payload = {
    externalRef: project.sanzu_external_ref,
    name: project.name,
    methodologyId: project.methodology_id || 'AGILE', // proyectos antiguos no tienen metodología
    requirements: project.requirements
  };
  const result = await request(PARTNER_PROJECTS_PATH, { method: 'POST', body: JSON.stringify(payload) });
  return result.data || result;
}

async function askSanzu(project, message, conversationId, context = {}) {
  const body = {
    externalRef: project.sanzu_external_ref,
    message,
    requirements: context.requirements ?? project.requirements ?? undefined
  };
  if (conversationId) body.conversationId = conversationId;
  return (await request(CHAT_PATH, { method: 'POST', body: JSON.stringify(body) })).data;
}

const dateOnly = value => (value ? new Date(value).toISOString().slice(0, 10) : undefined);

/**
 * Arma el payload de contexto (INT-01-ST043) a partir de filas de Haitani.
 * tasks: filas de `tasks`; members: [{ id, name, role }]; documentation: [{ id, original_name }].
 */
function buildContextPayload(project, { tasks = [], members = [], risks = [], milestones = [], sprint = null, incidences = [], documentation = [] } = {}) {
  return {
    project: {
      name: project.name,
      description: project.description || undefined,
      methodology: project.methodology_id || undefined,
      status: project.status || undefined,
      startDate: dateOnly(project.start_date),
      endDate: dateOnly(project.end_date)
    },
    tasks: tasks.map(task => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      assignedTo: task.assigned_to ?? null,
      estimatedHours: task.estimated_hours ?? undefined,
      dueDate: dateOnly(task.due_date) ?? null
    })),
    team: members.map(member => ({ userId: member.id ?? member.user_id, name: member.name, role: member.role })),
    risks,
    milestones,
    sprint: sprint || undefined,
    issues: incidences.map(item => ({ id: item.id, title: item.title, status: item.status, priority: item.priority })),
    documentation: documentation.map(file => ({ id: file.id, title: file.original_name || file.title, type: file.mime_type }))
  };
}

/** INT-01: envía el contexto real del proyecto y recibe health, riesgos, problemas, recomendaciones y documentos requeridos. */
async function analyzeContext(project, payload) {
  return (await request(contextPath(project.sanzu_external_ref), { method: 'POST', body: JSON.stringify(payload) })).data;
}

// ---------- Backlog del producto (SB-04) ----------
const backlogPath = externalRef => `${API_PREFIX}/partner/projects/${encodeURIComponent(externalRef)}/backlog`;
const BACKLOG_FILTERS = ['type', 'status', 'priority', 'sprintId'];

async function listBacklog(project, filters = {}) {
  const query = new URLSearchParams();
  for (const key of BACKLOG_FILTERS) if (filters[key]) query.set(key, filters[key]);
  const suffix = query.toString() ? `?${query}` : '';
  return (await request(`${backlogPath(project.sanzu_external_ref)}${suffix}`)).data || [];
}

async function createBacklogItem(project, item) {
  return (await request(backlogPath(project.sanzu_external_ref), { method: 'POST', body: JSON.stringify(item) })).data;
}

async function updateBacklogItem(project, itemId, changes) {
  return (await request(`${backlogPath(project.sanzu_external_ref)}/${encodeURIComponent(itemId)}`, { method: 'PUT', body: JSON.stringify(changes) })).data;
}

async function deleteBacklogItem(project, itemId) {
  await request(`${backlogPath(project.sanzu_external_ref)}/${encodeURIComponent(itemId)}`, { method: 'DELETE' });
}

async function listSprints(project) {
  return (await request(`${API_PREFIX}/partner/projects/${encodeURIComponent(project.sanzu_external_ref)}/sprints`)).data || [];
}

// Los sprints se crean en Haitani; Sanzu guarda una copia para poder asignarles ítems del backlog.
const SPRINT_STATUS = { planificado: 'PLANNED', activo: 'ACTIVE', cerrado: 'COMPLETED' };
// pg entrega las columnas DATE como fecha local a medianoche; se arma YYYY-MM-DD sin pasar por UTC.
const sprintDate = value => value instanceof Date
  ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  : String(value).slice(0, 10);

async function syncSprints(project, sprints) {
  const body = {
    sprints: sprints.map(sprint => ({
      externalRef: `haitani-sprint-${sprint.id}`,
      name: sprint.name,
      goal: sprint.goal || undefined,
      startDate: sprintDate(sprint.start_date),
      endDate: sprintDate(sprint.end_date),
      status: SPRINT_STATUS[sprint.status] || 'PLANNED'
    }))
  };
  return (await request(`${API_PREFIX}/partner/projects/${encodeURIComponent(project.sanzu_external_ref)}/sprints`, { method: 'PUT', body: JSON.stringify(body) })).data || [];
}

module.exports = { syncProject, askSanzu, analyzeContext, buildContextPayload, listBacklog, createBacklogItem, updateBacklogItem, deleteBacklogItem, listSprints, syncSprints };