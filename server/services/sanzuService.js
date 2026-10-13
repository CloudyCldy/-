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

/**
 * Petición HTTP con manejo de errores y reintentos automáticos (INT-01-ST038)
 */
async function request(path, options = {}, retries = 3) {
  const apiKey = process.env.SANZU_API_KEY;
  if (!apiKey) throw new Error('SANZU_API_KEY no está configurada.');
  let attempt = 0;
  let lastError = null;

  while (attempt < retries) {
    attempt++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(`${baseUrl()}${path}`, {
        ...options,
        signal: controller.signal,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Api-Key': apiKey, ...(options.headers || {}) }
      });
      clearTimeout(timer);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(readableError(data.error || data.message) || `Sanzu respondió con ${response.status}.`);
        error.status = response.status;
        error.code = data?.error?.code;
        // No reintentar errores 4xx salvo 408 y 429
        if (response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status)) {
          throw error;
        }
        lastError = error;
        if (attempt < retries) {
          await new Promise(res => setTimeout(res, 300 * Math.pow(2, attempt - 1)));
          continue;
        }
        throw error;
      }
      return data;
    } catch (cause) {
      clearTimeout(timer);
      if (cause.status && cause.status >= 400 && cause.status < 500 && ![408, 429].includes(cause.status)) {
        throw cause;
      }
      const error = new Error(cause?.name === 'AbortError' ? `Sanzu no respondió en ${REQUEST_TIMEOUT_MS} ms.` : `No se pudo conectar con Sanzu: ${cause?.message || cause}`);
      error.code = 'NETWORK_ERROR';
      lastError = error;
      if (attempt < retries) {
        await new Promise(res => setTimeout(res, 300 * Math.pow(2, attempt - 1)));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

const dateOnly = value => (value ? new Date(value).toISOString().slice(0, 10) : undefined);

async function syncProject(project) {
  const payload = {
    externalRef: project.sanzu_external_ref,
    name: project.name,
    description: project.description || undefined,
    methodologyId: project.methodology_id || 'AGILE',
    requirements: project.requirements,
    status: project.status,
    priority: project.priority,
    budget: Number(project.budget || 0),
    startDate: dateOnly(project.start_date),
    endDate: dateOnly(project.end_date)
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

/**
 * Arma el payload de contexto (INT-01-ST043 / INT-01-ST037) a partir de filas de Haitani.
 * Sincroniza nombre, descripción, metodología, fechas, miembros, tareas, riesgos y milestones.
 */
function buildContextPayload(project, { tasks = [], members = [], risks = [], milestones = [], sprint = null, incidences = [], documentation = [] } = {}) {
  return {
    project: {
      name: project.name,
      description: project.description || undefined,
      methodology: project.methodology_id || undefined,
      status: project.status || undefined,
      startDate: dateOnly(project.start_date),
      endDate: dateOnly(project.end_date),
      budget: Number(project.budget || 0),
      scope: project.scope || project.requirements || undefined
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
    risks: risks.map(risk => ({
      title: risk.title,
      probability: risk.probability || 'media',
      impact: risk.impact || 'media',
      status: risk.status || 'open',
      mitigation: risk.mitigation || null,
      severityScore: risk.severity_score || 50
    })),
    milestones,
    sprint: sprint || undefined,
    issues: incidences.map(item => ({ id: item.id, title: item.title, status: item.status, priority: item.priority })),
    documentation: documentation.map(file => ({ id: file.id, title: file.original_name || file.title, type: file.mime_type || file.category }))
  };
}

/** INT-01: envía el contexto real del proyecto y recibe health, riesgos, problemas, recomendaciones y documentos requeridos. */
async function analyzeContext(project, payload) {
  return (await request(contextPath(project.sanzu_external_ref), { method: 'POST', body: JSON.stringify(payload) })).data;
}

/**
 * Sincronización completa de Haitani Project → Sanzu Project (INT-01-ST036, INT-01-ST037, INT-01-ST038)
 * Sincroniza nombre, descripción, metodología, fechas, miembros, tareas, riesgos y milestones con reintentos.
 */
async function syncProjectFull(database, projectId, organizationId) {
  const project = await database.prepare('SELECT * FROM projects WHERE id = ? AND organization_id = ?').get(projectId, organizationId);
  if (!project) throw new Error('El proyecto no existe.');

  const [members, tasks, risks, sprints, docs] = await Promise.all([
    database.prepare(`SELECT users.id, users.name, users.role FROM project_members JOIN users ON users.id = project_members.user_id WHERE project_members.project_id = ? AND project_members.organization_id = ?`).all(projectId, organizationId),
    database.prepare(`SELECT * FROM tasks WHERE project_id = ? AND organization_id = ?`).all(projectId, organizationId),
    database.prepare(`SELECT * FROM project_risks WHERE project_id = ? AND organization_id = ?`).all(projectId, organizationId).catch(() => []),
    database.prepare(`SELECT * FROM sprints WHERE project_id = ? AND organization_id = ?`).all(projectId, organizationId).catch(() => []),
    database.prepare(`SELECT files.id, files.original_name, files.mime_type, files.category FROM project_documents JOIN files ON files.id = project_documents.file_id WHERE project_documents.project_id = ? AND project_documents.organization_id = ?`).all(projectId, organizationId).catch(() => [])
  ]);

  const activeSprint = sprints.find(s => s.status === 'activo') || null;

  try {
    const partnerResult = await syncProject(project);

    if (sprints.length > 0) {
      await syncSprints(project, sprints).catch(e => console.warn('Sync sprints note:', e.message));
    }

    const contextPayload = buildContextPayload(project, {
      tasks,
      members,
      risks,
      milestones: project.end_date ? [{ name: 'Fecha límite del proyecto', dueDate: dateOnly(project.end_date), status: project.progress >= 100 ? 'completed' : 'pending' }] : [],
      sprint: activeSprint ? { name: activeSprint.name, goal: activeSprint.goal, startDate: dateOnly(activeSprint.start_date), endDate: dateOnly(activeSprint.end_date), status: activeSprint.status } : null,
      documentation: docs
    });

    let contextResult = null;
    try {
      contextResult = await analyzeContext(project, contextPayload);
    } catch (analysisErr) {
      console.warn('Análisis de contexto Sanzu:', analysisErr.message);
    }

    await database.prepare(`UPDATE projects SET sanzu_synced_at = CURRENT_TIMESTAMP, sanzu_sync_status = 'synced', sanzu_sync_error = NULL WHERE id = ? AND organization_id = ?`).run(projectId, organizationId);

    return {
      success: true,
      project: partnerResult,
      analysis: contextResult,
      syncedCounts: {
        members: members.length,
        tasks: tasks.length,
        risks: risks.length,
        sprints: sprints.length,
        documents: docs.length
      }
    };
  } catch (error) {
    const errorMsg = error.message || String(error);
    await database.prepare(`UPDATE projects SET sanzu_sync_status = 'error', sanzu_sync_error = ? WHERE id = ? AND organization_id = ?`).run(errorMsg, projectId, organizationId).catch(() => {});
    throw error;
  }
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

const SPRINT_STATUS = { planificado: 'PLANNED', activo: 'ACTIVE', cerrado: 'COMPLETED' };
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

module.exports = {
  syncProject,
  syncProjectFull,
  askSanzu,
  analyzeContext,
  buildContextPayload,
  listBacklog,
  createBacklogItem,
  updateBacklogItem,
  deleteBacklogItem,
  listSprints,
  syncSprints
};