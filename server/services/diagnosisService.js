/**
 * SB-09.2 / SB-10.2 / SB-11.2 — Diagnóstico del proyecto para los paneles de Project Overview.
 *
 * Arma el contexto real del proyecto (tareas, equipo, riesgos, sprints, hitos, incidencias y
 * documentos), lo manda a Sanzu (POST /api/v1/projects/:ref/context) y devuelve en español:
 *  - health: puntaje, estado, factores y problemas detectados (SB-09.2)
 *  - compliance: prácticas de la metodología cumplidas y no cumplidas (SB-10.2)
 *  - recommendations: ordenadas por prioridad, con motivo y acción sugerida (SB-11.2)
 *
 * Si Sanzu no está configurado, no responde o pide esperar (429), se calcula lo mismo
 * en modo local con las mismas reglas, para que los paneles nunca se queden vacíos.
 */
const sanzuService = require('./sanzuService');

const CACHE_TTL_MS = 60 * 1000;
const STALE_MAX_MS = 10 * 60 * 1000;
const cache = new Map();

const PRIORITY_RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const PRIORITY_LABEL = { CRITICAL: 'Crítica', HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' };
const STATUS_LABEL = { EXCELLENT: 'Excelente', GOOD: 'Bueno', WARNING: 'Atención', CRITICAL: 'Crítico' };
const FACTOR_LABEL = {
  schedule: 'Cronograma',
  delivery: 'Entrega (atrasos y bloqueos)',
  risks: 'Riesgos',
  issues: 'Incidencias',
  teamWorkload: 'Carga del equipo',
  methodologyCompliance: 'Cumplimiento de la metodología'
};
const HEALTH_WEIGHTS = { schedule: 0.25, delivery: 0.2, risks: 0.15, issues: 0.1, teamWorkload: 0.1, methodologyCompliance: 0.2 };
const SEVERITY_PENALTY = { LOW: 4, MEDIUM: 8, HIGH: 12, CRITICAL: 20 };
const TYPE_LABEL = { SCHEDULE: 'Cronograma', WORKFLOW: 'Flujo de trabajo', WORKLOAD: 'Carga de trabajo', TEAM: 'Equipo', RISK: 'Riesgos', QUALITY: 'Calidad', METHODOLOGY: 'Metodología', PERFORMANCE: 'Rendimiento' };

const scoreStatus = score => (score >= 85 ? 'EXCELLENT' : score >= 70 ? 'GOOD' : score >= 45 ? 'WARNING' : 'CRITICAL');
const clamp = value => Math.max(0, Math.min(100, value));
const dateOnly = value => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);

// ---------- Prácticas que se revisan por metodología (las mismas reglas que usa Sanzu) ----------
const PRACTICES = [
  { id: 'BLOCKED_UNDER_CONTROL', label: 'El trabajo bloqueado se mantiene bajo control (2 tareas bloqueadas o menos)', sanzu: 'Multiple tasks are blocked.' },
  { id: 'RISKS_MITIGATED', label: 'Todos los riesgos abiertos tienen plan de mitigación', sanzu: 'Open risks do not have mitigation plans.' },
  { id: 'NO_CRITICAL_ISSUES', label: 'No hay incidencias críticas sin resolver', sanzu: 'Unresolved critical issues require attention.' },
  { id: 'SPRINT_GOAL', label: 'Cada sprint tiene un objetivo definido', sanzu: 'A Scrum sprint has no goal.', only: ['SCRUM'] }
];

const RULE_ES = {
  'Deliver working software frequently': 'Entregar software funcional con frecuencia',
  'Respond to change': 'Responder al cambio',
  'Sprint must have a goal': 'Cada sprint debe tener un objetivo',
  'Backlog should be prioritized': 'El backlog debe estar priorizado',
  'Definition of Done should be explicit': 'La Definición de Terminado debe ser explícita',
  'Respect WIP limits': 'Respetar los límites de trabajo en curso (WIP)',
  'Make blocked work visible': 'Hacer visible el trabajo bloqueado',
  'Improve bottlenecks': 'Mejorar los cuellos de botella',
  'Keep feedback cycles short': 'Mantener ciclos de retroalimentación cortos',
  'Maintain sustainable pace': 'Mantener un ritmo sostenible',
  'Optimize the whole': 'Optimizar el todo',
  'Improve continuously': 'Mejorar continuamente',
  'Respect phase dependencies': 'Respetar las dependencias entre fases',
  'Document requirements': 'Documentar los requisitos',
  'Plan testing before implementation': 'Planear las pruebas antes de implementar',
  'Follow the configured practice set': 'Seguir el conjunto de prácticas configurado'
};

const LOCAL_RULES = {
  AGILE: ['Deliver working software frequently', 'Respond to change'],
  SCRUM: ['Sprint must have a goal', 'Backlog should be prioritized', 'Definition of Done should be explicit'],
  KANBAN: ['Respect WIP limits', 'Make blocked work visible', 'Improve bottlenecks'],
  XP: ['Keep feedback cycles short', 'Maintain sustainable pace'],
  LEAN: ['Optimize the whole', 'Improve continuously'],
  WATERFALL: ['Respect phase dependencies', 'Document requirements', 'Plan testing before implementation'],
  HYBRID: ['Follow the configured practice set']
};

// ---------- Traducción de los textos que genera Sanzu (vienen en inglés) ----------
const TEXT_ES = [
  [/^The project passed its end date with (\d+) task\(s\) still open\.$/, 'El proyecto pasó su fecha de fin con $1 tarea(s) abiertas.'],
  [/^At the current pace the project will finish about (\d+) day\(s\) late\.$/, 'Al ritmo actual el proyecto terminará unos $1 día(s) tarde.'],
  [/^Progress \((\d+)%\) is behind the plan \((\d+)%\)\.$/, 'El avance ($1%) va detrás de lo planeado ($2%).'],
  [/^(\d+) task\(s\) are overdue\.$/, '$1 tarea(s) están vencidas.'],
  [/^(\d+) task\(s\) are overdue \(avg\. ([\d.]+) day\(s\)\)\.$/, '$1 tarea(s) están vencidas (promedio de $2 día(s)).'],
  [/^Overdue work is growing: most overdue tasks became late in the last 14 days\.$/, 'El trabajo vencido va en aumento: la mayoría de las tareas vencidas se atrasaron en los últimos 14 días.'],
  [/^Milestone "(.+)" is delayed\.$/, 'El hito "$1" está retrasado.'],
  [/^(\d+) task\(s\) are blocked\.$/, '$1 tarea(s) están bloqueadas.'],
  [/^(.+) is at (\d+)% of capacity\.$/, '$1 está al $2% de su capacidad.'],
  [/^(\d+)% of open work is concentrated on one person\.$/, 'El $1% del trabajo abierto está concentrado en una sola persona.'],
  [/^(\d+) open task\(s\) have no owner\.$/, '$1 tarea(s) abiertas no tienen responsable.'],
  [/^(\d+) open risk\(s\) have critical severity\.$/, '$1 riesgo(s) abiertos tienen severidad crítica.'],
  [/^Multiple tasks are blocked\.$/, 'Hay varias tareas bloqueadas.'],
  [/^Open risks do not have mitigation plans\.$/, 'Hay riesgos abiertos sin plan de mitigación.'],
  [/^Unresolved critical issues require attention\.$/, 'Hay incidencias críticas sin resolver que requieren atención.'],
  [/^A Scrum sprint has no goal\.$/, 'Hay un sprint de Scrum sin objetivo.'],
  // Recomendaciones
  [/^Re-baseline the delivery date$/, 'Replantear la fecha de entrega'],
  [/^The end date has passed with (\d+) open task\(s\)\.$/, 'La fecha de fin ya pasó y quedan $1 tarea(s) abiertas.'],
  [/^The committed deadline is no longer achievable with the current scope\.$/, 'Con el alcance actual ya no se puede cumplir la fecha comprometida.'],
  [/^Agree a new date with stakeholders or cut scope to the must-have items\.$/, 'Acordar una nueva fecha con los interesados o recortar el alcance a lo indispensable.'],
  [/^Recover schedule slippage$/, 'Recuperar el retraso del cronograma'],
  [/^Forecast: (\d+) day\(s\) late \(predicted (.+)\)\.$/, 'Pronóstico: $1 día(s) de retraso (fin estimado $2).'],
  [/^Actual progress (\d+)% vs planned (\d+)%\.$/, 'Avance real $1% contra $2% planeado.'],
  [/^The current throughput does not reach the end date\.$/, 'Con el ritmo actual no se alcanza la fecha de fin.'],
  [/^Prioritize critical-path tasks, remove blockers and consider reducing scope\.$/, 'Priorizar las tareas de la ruta crítica, quitar bloqueos y considerar reducir el alcance.'],
  [/^Unblock active work$/, 'Desbloquear el trabajo activo'],
  [/^Blocked work reduces flow and delays delivery\.$/, 'El trabajo bloqueado frena el flujo y retrasa la entrega.'],
  [/^Review blockers with owners and resolve or re-plan them\.$/, 'Revisar los bloqueos con los responsables y resolverlos o replanearlos.'],
  [/^Recover overdue work$/, 'Recuperar el trabajo vencido'],
  [/^Overdue tasks threaten the delivery schedule\.$/, 'Las tareas vencidas ponen en riesgo el calendario de entrega.'],
  [/^Re-plan overdue work and address its dependencies\.$/, 'Replanear el trabajo vencido y atender sus dependencias.'],
  [/^Stop the delay trend$/, 'Frenar la tendencia de retrasos'],
  [/^(\d+) task\(s\) became overdue in the last 14 days\.$/, '$1 tarea(s) se vencieron en los últimos 14 días.'],
  [/^Delays are accumulating faster than they are being resolved\.$/, 'Los retrasos se acumulan más rápido de lo que se resuelven.'],
  [/^Review estimates in the next planning session and limit new work in progress\.$/, 'Revisar las estimaciones en la próxima planeación y limitar el trabajo nuevo en curso.'],
  [/^Recover milestone: (.+)$/, 'Recuperar el hito: $1'],
  [/^Milestone due (.+) is not completed\.$/, 'El hito con fecha $1 no está completado.'],
  [/^Missed milestones usually shift every dependent delivery\.$/, 'Un hito incumplido suele mover todas las entregas que dependen de él.'],
  [/^Identify the remaining work for this milestone and update its date if needed\.$/, 'Identificar el trabajo que falta para este hito y actualizar su fecha si hace falta.'],
  [/^Rebalance workload of (.+)$/, 'Equilibrar la carga de $1'],
  [/^([\d.]+) h assigned \((\d+)% of ([\d.]+) h\)\.$/, '$1 h asignadas ($2% de $3 h).'],
  [/^Overloaded people become bottlenecks and burn out\.$/, 'Las personas sobrecargadas se vuelven cuellos de botella y se desgastan.'],
  [/^Reassign or postpone part of this person's open tasks\.$/, 'Reasignar o posponer parte de las tareas abiertas de esta persona.'],
  [/^Reduce work concentration$/, 'Reducir la concentración del trabajo'],
  [/^(\d+)% of open tasks belong to one person\.$/, 'El $1% de las tareas abiertas son de una sola persona.'],
  [/^Concentrated work creates a single point of failure\.$/, 'Concentrar el trabajo crea un único punto de falla.'],
  [/^Distribute tasks and pair on the most critical ones to share knowledge\.$/, 'Repartir las tareas y trabajar en pareja las más críticas para compartir conocimiento.'],
  [/^Assign owners to open tasks$/, 'Asignar responsables a las tareas abiertas'],
  [/^(\d+) open task\(s\) have no assignee\.$/, '$1 tarea(s) abiertas no tienen responsable.'],
  [/^Work without an owner tends to be forgotten\.$/, 'El trabajo sin responsable tiende a olvidarse.'],
  [/^Assign an owner to every open task in the next stand-up\.$/, 'Asignar un responsable a cada tarea abierta en la próxima reunión diaria.'],
  [/^Mitigate risk: (.+)$/, 'Mitigar el riesgo: $1'],
  [/^Open risk with severity (.+)\/12 has no mitigation plan\.$/, 'Riesgo abierto con severidad $1/12 sin plan de mitigación.'],
  [/^Unmitigated risks can become schedule or quality incidents\.$/, 'Un riesgo sin mitigar puede volverse un problema de calendario o de calidad.'],
  [/^Ask the risk owner to record a concrete mitigation plan\.$/, 'Pedir al responsable del riesgo que registre un plan de mitigación concreto.'],
  [/^Assign an owner and record a concrete mitigation plan\.$/, 'Asignar un responsable y registrar un plan de mitigación concreto.'],
  [/^Resolve critical issues$/, 'Resolver las incidencias críticas'],
  [/^(\d+) critical issue\(s\) are unresolved\.$/, '$1 incidencia(s) críticas sin resolver.'],
  [/^Critical issues directly affect users or the release\.$/, 'Las incidencias críticas afectan directamente a los usuarios o a la entrega.'],
  [/^Assign each critical issue today and track it daily until closed\.$/, 'Asignar hoy cada incidencia crítica y darle seguimiento diario hasta cerrarla.'],
  [/^Reduce Kanban WIP$/, 'Reducir el trabajo en curso (WIP) de Kanban'],
  [/^Work in progress is (\d+)\.$/, 'El trabajo en curso es de $1 tareas.'],
  [/^High WIP increases cycle time and hides bottlenecks\.$/, 'Mucho trabajo en curso alarga el tiempo de ciclo y esconde los cuellos de botella.'],
  [/^Pause new work and finish the oldest active items first\.$/, 'Pausar el trabajo nuevo y terminar primero lo más antiguo.'],
  [/^Investigate falling velocity$/, 'Revisar la caída de la velocidad'],
  [/^Velocity is trending down \(avg\. ([\d.]+) points\)\.$/, 'La velocidad va a la baja (promedio de $1 puntos).'],
  [/^A falling velocity signals impediments or over-commitment\.$/, 'Una velocidad a la baja indica impedimentos o compromisos de más.'],
  [/^Discuss causes in the retrospective and adjust sprint commitment\.$/, 'Platicar las causas en la retrospectiva y ajustar el compromiso del sprint.'],
  [/^Required by (.+) practices\.$/, 'Lo piden las prácticas de $1.'],
  [/^Apply the corresponding methodology rule \(see \/methodologies\/:id\/rules\)\.$/, 'Aplicar la regla correspondiente de la metodología (ver Metodologías).']
];

function toSpanish(text) {
  if (typeof text !== 'string' || !text) return text || '';
  const methodology = text.match(/^Methodology: (.+)$/);
  if (methodology) return `Metodología: ${toSpanish(methodology[1])}`;
  for (const [pattern, replacement] of TEXT_ES) {
    if (pattern.test(text)) return text.replace(pattern, replacement);
  }
  return text;
}

// ---------- Contexto del proyecto desde la base de Haitani ----------
const TASK_STATUS = { pendiente: 'TODO', en_proceso: 'IN_PROGRESS', en_revision: 'IN_PROGRESS', bloqueada: 'BLOCKED', completada: 'DONE', cancelada: 'CANCELLED' };
const PRIORITY = { baja: 'LOW', low: 'LOW', media: 'MEDIUM', medium: 'MEDIUM', alta: 'HIGH', high: 'HIGH', urgente: 'CRITICAL', critica: 'CRITICAL', 'crítica': 'CRITICAL', critical: 'CRITICAL' };
const LEVEL3 = { baja: 'LOW', low: 'LOW', media: 'MEDIUM', medium: 'MEDIUM', alta: 'HIGH', high: 'HIGH' };
const RISK_STATUS = { open: 'OPEN', abierto: 'OPEN', mitigated: 'MITIGATED', mitigado: 'MITIGATED', accepted: 'ACCEPTED', closed: 'CLOSED', cerrado: 'CLOSED' };
const SPRINT_STATUS = { planificado: 'PLANNED', activo: 'ACTIVE', cerrado: 'COMPLETED', completado: 'COMPLETED' };
const MILESTONE_STATUS = { pendiente: 'PENDING', en_progreso: 'IN_PROGRESS', en_proceso: 'IN_PROGRESS', completado: 'COMPLETED', completada: 'COMPLETED', retrasado: 'DELAYED', cancelado: 'CANCELLED' };
const ISSUE_STATUS = { open: 'OPEN', in_progress: 'IN_PROGRESS', in_review: 'IN_PROGRESS', resolved: 'RESOLVED', closed: 'CLOSED', appealed: 'OPEN' };
const pick = (table, value, fallback) => table[String(value || '').trim().toLowerCase()] || fallback;
const optionalNumber = value => {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

async function loadProjectData(database, projectId, organizationId) {
  const project = await database.prepare('SELECT * FROM projects WHERE id = ? AND organization_id = ?').get(projectId, organizationId);
  if (!project) return null;
  const safe = promise => Promise.resolve(promise).catch(() => []);
  const [members, tasks, risks, sprints, milestones, issues, documents] = await Promise.all([
    safe(database.prepare('SELECT users.id, users.name, users.role FROM project_members JOIN users ON users.id = project_members.user_id WHERE project_members.project_id = ? AND project_members.organization_id = ?').all(projectId, organizationId)),
    safe(database.prepare('SELECT * FROM tasks WHERE project_id = ? AND organization_id = ?').all(projectId, organizationId)),
    safe(database.prepare('SELECT * FROM project_risks WHERE project_id = ? AND organization_id = ?').all(projectId, organizationId)),
    safe(database.prepare('SELECT * FROM sprints WHERE project_id = ? AND organization_id = ?').all(projectId, organizationId)),
    safe(database.prepare('SELECT * FROM project_milestones WHERE project_id = ? AND organization_id = ?').all(projectId, organizationId)),
    safe(database.prepare('SELECT * FROM project_issues WHERE project_id = ? AND organization_id = ?').all(projectId, organizationId)),
    safe(database.prepare('SELECT files.id, files.original_name, files.mime_type, files.category FROM project_documents JOIN files ON files.id = project_documents.file_id WHERE project_documents.project_id = ? AND project_documents.organization_id = ?').all(projectId, organizationId))
  ]);
  return { project, members: members || [], tasks: tasks || [], risks: risks || [], sprints: sprints || [], milestones: milestones || [], issues: issues || [], documents: documents || [] };
}

/** Payload para POST /api/v1/projects/:ref/context con valores que el esquema de Sanzu acepta. */
function buildPayload(data) {
  const { project } = data;
  const sprintRows = data.sprints
    .filter(s => s.name && dateOnly(s.start_date) && dateOnly(s.end_date))
    .map(s => ({ id: s.id, name: s.name, goal: s.goal || null, startDate: dateOnly(s.start_date), endDate: dateOnly(s.end_date), status: pick(SPRINT_STATUS, s.status, 'PLANNED') }));
  return {
    project: {
      name: project.name,
      description: project.description || null,
      methodology: project.methodology_id || 'AGILE',
      status: project.status || undefined,
      // Sanzu convierte null en 1970-01-01, así que una fecha vacía se manda como undefined
      startDate: dateOnly(project.start_date) || undefined,
      endDate: dateOnly(project.end_date) || undefined
    },
    tasks: data.tasks.filter(t => t.title).map(t => ({
      id: t.id,
      title: t.title,
      status: pick(TASK_STATUS, t.status, 'TODO'),
      priority: pick(PRIORITY, t.priority, 'MEDIUM'),
      assignedTo: t.assigned_to ?? null,
      estimatedHours: optionalNumber(t.estimated_hours),
      dueDate: dateOnly(t.due_date) || undefined,
      sprintId: t.sprint_id ?? null
    })),
    team: data.members.filter(m => m.id ?? m.user_id).map(m => ({ userId: m.id ?? m.user_id, name: m.name || undefined, role: m.role || undefined })),
    risks: data.risks.filter(r => r.title).map(r => ({
      id: r.id,
      title: r.title,
      description: r.description || null,
      probability: pick(LEVEL3, r.probability, 'MEDIUM'),
      impact: pick(PRIORITY, r.impact, 'MEDIUM'),
      status: pick(RISK_STATUS, r.status, 'OPEN'),
      mitigation: r.mitigation || null,
      ownerId: r.assigned_to ?? null
    })),
    sprints: sprintRows,
    milestones: data.milestones.filter(m => (m.title || m.name) && dateOnly(m.due_date)).map(m => ({ id: m.id, name: m.title || m.name, dueDate: dateOnly(m.due_date), status: pick(MILESTONE_STATUS, m.status, 'PENDING') })),
    issues: data.issues.filter(i => i.title).map(i => ({ id: i.id, title: i.title, priority: pick(PRIORITY, i.priority, 'MEDIUM'), status: pick(ISSUE_STATUS, i.status, 'OPEN'), assignedTo: i.assigned_to ?? null })),
    documentation: data.documents.map(d => ({ id: d.id, title: d.original_name || d.title || 'Documento', type: d.mime_type || d.category || undefined }))
  };
}

// ---------- Cumplimiento: cumplidas / no cumplidas ----------
function practiceChecklist(methodology, failedIds) {
  return PRACTICES
    .filter(p => !p.only || p.only.includes(methodology))
    .map(p => ({ id: p.id, label: p.label, met: !failedIds.has(p.id) }));
}

// ---------- Modo local (mismas reglas que Sanzu, sin llamar a la red) ----------
function localDiagnosis(data) {
  const payload = buildPayload(data);
  const methodology = String(payload.project.methodology || 'AGILE').toUpperCase();
  const now = today();
  const tasks = payload.tasks.filter(t => t.status !== 'CANCELLED');
  const open = tasks.filter(t => t.status !== 'DONE');
  const done = tasks.length - open.length;
  const blocked = open.filter(t => t.status === 'BLOCKED');
  const overdue = open.filter(t => t.dueDate && t.dueDate < now);
  const unassigned = open.filter(t => t.assignedTo === null || t.assignedTo === undefined);
  const progress = tasks.length ? Math.round(done * 100 / tasks.length) : 0;
  const openRisks = payload.risks.filter(r => r.status === 'OPEN');
  const riskNoPlan = openRisks.filter(r => !r.mitigation);
  const criticalRisks = openRisks.filter(r => r.probability === 'HIGH' && (r.impact === 'HIGH' || r.impact === 'CRITICAL'));
  const openIssues = payload.issues.filter(i => ['OPEN', 'IN_PROGRESS'].includes(i.status));
  const criticalIssues = openIssues.filter(i => i.priority === 'CRITICAL');
  const sprintsNoGoal = payload.sprints.filter(s => !s.goal);
  const delayedMilestones = payload.milestones.filter(m => m.status !== 'COMPLETED' && m.status !== 'CANCELLED' && m.dueDate < now);
  const names = new Map(payload.team.map(m => [String(m.userId), m.name]));
  const byPerson = new Map();
  open.filter(t => t.assignedTo !== null && t.assignedTo !== undefined).forEach(t => byPerson.set(String(t.assignedTo), (byPerson.get(String(t.assignedTo)) || 0) + 1));
  const top = [...byPerson.entries()].sort((a, b) => b[1] - a[1])[0];
  const concentration = top && open.length >= 4 ? Math.round(top[1] * 100 / open.length) : 0;
  const isConcentrated = concentration >= 60;

  // Cronograma según fechas del proyecto
  let schedule = { status: 'ON_TRACK', planned: null };
  const start = payload.project.startDate;
  const end = payload.project.endDate;
  if (end && end < now && open.length) schedule = { status: 'LATE' };
  else if (start && end && end > start) {
    const total = Date.parse(end) - Date.parse(start);
    const planned = clamp(Math.round((Date.now() - Date.parse(start)) * 100 / total));
    schedule = { status: progress + 15 < planned ? 'AT_RISK' : 'ON_TRACK', planned };
  }

  const methodologyProblems = [];
  const failed = new Set();
  if (blocked.length > 2) { failed.add('BLOCKED_UNDER_CONTROL'); methodologyProblems.push({ type: 'WORKFLOW', severity: 'HIGH', description: 'Hay varias tareas bloqueadas.' }); }
  if (riskNoPlan.length) { failed.add('RISKS_MITIGATED'); methodologyProblems.push({ type: 'RISK', severity: 'HIGH', description: 'Hay riesgos abiertos sin plan de mitigación.' }); }
  if (criticalIssues.length) { failed.add('NO_CRITICAL_ISSUES'); methodologyProblems.push({ type: 'QUALITY', severity: 'CRITICAL', description: 'Hay incidencias críticas sin resolver que requieren atención.' }); }
  if (methodology === 'SCRUM' && sprintsNoGoal.length) { failed.add('SPRINT_GOAL'); methodologyProblems.push({ type: 'METHODOLOGY', severity: 'MEDIUM', description: 'Hay un sprint de Scrum sin objetivo.' }); }

  const general = [];
  if (schedule.status === 'LATE') general.push({ type: 'SCHEDULE', severity: 'CRITICAL', description: `El proyecto pasó su fecha de fin con ${open.length} tarea(s) abiertas.` });
  else if (schedule.status === 'AT_RISK') general.push({ type: 'SCHEDULE', severity: 'HIGH', description: `El avance (${progress}%) va detrás de lo planeado (${schedule.planned}%).` });
  if (overdue.length) general.push({ type: 'SCHEDULE', severity: overdue.length >= 5 ? 'HIGH' : 'MEDIUM', description: `${overdue.length} tarea(s) están vencidas.` });
  delayedMilestones.forEach(m => general.push({ type: 'SCHEDULE', severity: 'HIGH', description: `El hito "${m.name}" está retrasado.` }));
  if (blocked.length) general.push({ type: 'WORKFLOW', severity: blocked.length > 2 ? 'HIGH' : 'MEDIUM', description: `${blocked.length} tarea(s) están bloqueadas.` });
  if (isConcentrated) general.push({ type: 'WORKLOAD', severity: 'MEDIUM', description: `El ${concentration}% del trabajo abierto está concentrado en una sola persona.` });
  if (unassigned.length >= 3) general.push({ type: 'WORKLOAD', severity: 'LOW', description: `${unassigned.length} tarea(s) abiertas no tienen responsable.` });
  if (criticalRisks.length) general.push({ type: 'RISK', severity: 'CRITICAL', description: `${criticalRisks.length} riesgo(s) abiertos tienen severidad crítica.` });

  const seen = new Set();
  const problems = [...methodologyProblems, ...general]
    .filter(p => (seen.has(p.description) ? false : (seen.add(p.description), true)))
    .sort((a, b) => PRIORITY_RANK[a.severity] - PRIORITY_RANK[b.severity]);

  const complianceScore = Math.max(0, 100 - methodologyProblems.reduce((sum, p) => sum + SEVERITY_PENALTY[p.severity], 0));
  const total = Math.max(1, tasks.length);
  const factors = {
    schedule: Math.round(schedule.status === 'LATE' ? 20 : schedule.status === 'AT_RISK' ? clamp(100 - (schedule.planned - progress) * 1.5) : 100),
    delivery: Math.round(clamp(100 - (overdue.length / total) * 150 - (blocked.length / total) * 100)),
    risks: Math.round(clamp(100 - openRisks.length * 8 - criticalRisks.length * 15)),
    issues: Math.round(clamp(100 - openIssues.length * 10 - criticalIssues.length * 20)),
    teamWorkload: Math.round(clamp(100 - (isConcentrated ? 15 : 0))),
    methodologyCompliance: complianceScore
  };
  const score = Math.round(Object.entries(HEALTH_WEIGHTS).reduce((sum, [key, weight]) => sum + factors[key] * weight, 0));

  const recs = [];
  const add = r => recs.push(r);
  if (schedule.status === 'LATE') add({ type: 'SCHEDULE', priority: 'CRITICAL', title: 'Replantear la fecha de entrega', description: `La fecha de fin ya pasó y quedan ${open.length} tarea(s) abiertas.`, reason: 'Con el alcance actual ya no se puede cumplir la fecha comprometida.', suggestedAction: 'Acordar una nueva fecha con los interesados o recortar el alcance a lo indispensable.' });
  else if (schedule.status === 'AT_RISK') add({ type: 'SCHEDULE', priority: 'HIGH', title: 'Recuperar el retraso del cronograma', description: `Avance real ${progress}% contra ${schedule.planned}% planeado.`, reason: 'Con el ritmo actual no se alcanza la fecha de fin.', suggestedAction: 'Priorizar las tareas de la ruta crítica, quitar bloqueos y considerar reducir el alcance.' });
  if (blocked.length) add({ type: 'WORKLOAD', priority: 'HIGH', title: 'Desbloquear el trabajo activo', description: `${blocked.length} tarea(s) están bloqueadas.`, reason: 'El trabajo bloqueado frena el flujo y retrasa la entrega.', suggestedAction: 'Revisar los bloqueos con los responsables y resolverlos o replanearlos.' });
  if (overdue.length) add({ type: 'SCHEDULE', priority: overdue.length >= 5 ? 'HIGH' : 'MEDIUM', title: 'Recuperar el trabajo vencido', description: `${overdue.length} tarea(s) están vencidas.`, reason: 'Las tareas vencidas ponen en riesgo el calendario de entrega.', suggestedAction: 'Replanear el trabajo vencido y atender sus dependencias.' });
  delayedMilestones.forEach(m => add({ type: 'SCHEDULE', priority: 'HIGH', title: `Recuperar el hito: ${m.name}`, description: `El hito con fecha ${m.dueDate} no está completado.`, reason: 'Un hito incumplido suele mover todas las entregas que dependen de él.', suggestedAction: 'Identificar el trabajo que falta para este hito y actualizar su fecha si hace falta.' }));
  if (isConcentrated) add({ type: 'TEAM', priority: 'MEDIUM', title: 'Reducir la concentración del trabajo', description: `El ${concentration}% de las tareas abiertas son de ${names.get(top[0]) || 'una sola persona'}.`, reason: 'Concentrar el trabajo crea un único punto de falla.', suggestedAction: 'Repartir las tareas y trabajar en pareja las más críticas para compartir conocimiento.' });
  if (unassigned.length >= 3) add({ type: 'TEAM', priority: 'LOW', title: 'Asignar responsables a las tareas abiertas', description: `${unassigned.length} tarea(s) abiertas no tienen responsable.`, reason: 'El trabajo sin responsable tiende a olvidarse.', suggestedAction: 'Asignar un responsable a cada tarea abierta en la próxima reunión diaria.' });
  riskNoPlan.forEach(r => add({ type: 'RISK', priority: criticalRisks.includes(r) ? 'CRITICAL' : r.probability === 'HIGH' || r.impact === 'HIGH' ? 'HIGH' : 'MEDIUM', title: `Mitigar el riesgo: ${r.title}`, description: 'Riesgo abierto sin plan de mitigación.', reason: 'Un riesgo sin mitigar puede volverse un problema de calendario o de calidad.', suggestedAction: r.ownerId ? 'Pedir al responsable del riesgo que registre un plan de mitigación concreto.' : 'Asignar un responsable y registrar un plan de mitigación concreto.' }));
  if (criticalIssues.length) add({ type: 'QUALITY', priority: 'CRITICAL', title: 'Resolver las incidencias críticas', description: `${criticalIssues.length} incidencia(s) críticas sin resolver.`, reason: 'Las incidencias críticas afectan directamente a los usuarios o a la entrega.', suggestedAction: 'Asignar hoy cada incidencia crítica y darle seguimiento diario hasta cerrarla.' });
  if (methodology === 'SCRUM' && sprintsNoGoal.length) add({ type: 'METHODOLOGY', priority: 'MEDIUM', title: 'Definir el objetivo de cada sprint', description: `${sprintsNoGoal.length} sprint(s) no tienen objetivo.`, reason: 'Lo piden las prácticas de SCRUM.', suggestedAction: 'Escribir el objetivo del sprint en la planeación y revisarlo en la review.' });

  return {
    methodology,
    health: { score, status: scoreStatus(score), factors, problems },
    compliance: {
      methodology,
      score: complianceScore,
      status: scoreStatus(complianceScore),
      practices: practiceChecklist(methodology, failed),
      problems: methodologyProblems,
      warnings: general.filter(p => p.severity === 'LOW' || p.severity === 'MEDIUM').map(p => p.description),
      rules: (LOCAL_RULES[methodology] || LOCAL_RULES.AGILE).map(rule => RULE_ES[rule] || rule)
    },
    recommendations: recs
  };
}

// ---------- Respuesta de Sanzu → forma de los paneles ----------
function fromSanzu(result) {
  const methodology = String(result?.methodology || result?.compliance?.methodology || 'AGILE').toUpperCase();
  const health = result?.health || {};
  const compliance = result?.compliance || {};
  const translateProblem = p => ({ type: p.type, severity: PRIORITY_RANK[p.severity] !== undefined ? p.severity : 'MEDIUM', description: toSpanish(p.description) });
  const failed = new Set();
  const extraUnmet = [];
  for (const p of compliance.problems || []) {
    const practice = PRACTICES.find(item => item.sanzu === p.description);
    if (practice) failed.add(practice.id);
    else extraUnmet.push({ id: p.code || p.description, label: toSpanish(p.description), met: false });
  }
  const factors = {};
  for (const key of Object.keys(HEALTH_WEIGHTS)) {
    if (typeof health.factors?.[key] === 'number') factors[key] = Math.round(health.factors[key]);
  }
  const score = Math.round(Number(health.score) || 0);
  const complianceScore = Math.round(Number(compliance.score ?? 100));
  return {
    methodology,
    health: { score, status: STATUS_LABEL[health.status] ? health.status : scoreStatus(score), factors, problems: (result?.problems || []).map(translateProblem) },
    compliance: {
      methodology,
      score: complianceScore,
      status: STATUS_LABEL[compliance.status] ? compliance.status : scoreStatus(complianceScore),
      practices: [...practiceChecklist(methodology, failed), ...extraUnmet],
      problems: (compliance.problems || []).map(translateProblem),
      warnings: (compliance.warnings || []).map(toSpanish),
      rules: (compliance.rules || []).map(rule => RULE_ES[rule] || rule)
    },
    recommendations: cleanMethodologyRecommendations(result?.recommendations || []).map(r => ({
      type: r.type,
      priority: PRIORITY_RANK[r.priority] !== undefined ? r.priority : 'MEDIUM',
      title: toSpanish(r.title),
      description: toSpanish(r.description),
      reason: toSpanish(r.reason),
      suggestedAction: toSpanish(r.suggestedAction)
    }))
  };
}

// Sanzu agrega "Methodology: <problema>" aunque ya exista una recomendación concreta para lo mismo.
// Se quitan las repetidas y la del sprint sin objetivo se cambia por una acción concreta.
const COVERED_BY = {
  'Multiple tasks are blocked.': list => list.some(r => r.title === 'Unblock active work'),
  'Open risks do not have mitigation plans.': list => list.some(r => /^Mitigate risk: /.test(r.title || '')),
  'Unresolved critical issues require attention.': list => list.some(r => r.title === 'Resolve critical issues')
};
function cleanMethodologyRecommendations(list) {
  return list.flatMap(r => {
    const match = String(r.title || '').match(/^Methodology: (.+)$/);
    if (!match) return [r];
    if (COVERED_BY[match[1]]?.(list)) return [];
    if (match[1] === 'A Scrum sprint has no goal.') {
      return [{ ...r, title: 'Definir el objetivo de cada sprint', description: 'Hay un sprint de Scrum sin objetivo.', suggestedAction: 'Escribir el objetivo del sprint en la planeación y revisarlo en la review.' }];
    }
    return [r];
  });
}

/** Agrega etiquetas en español y deja todo ordenado para la vista. */
function present(diagnosis, meta) {
  const recommendations = [...diagnosis.recommendations]
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
    .map(r => ({ ...r, priorityLabel: PRIORITY_LABEL[r.priority], typeLabel: TYPE_LABEL[r.type] || r.type || 'General' }));
  const practices = diagnosis.compliance.practices;
  return {
    ...meta,
    methodology: diagnosis.methodology,
    health: {
      ...diagnosis.health,
      statusLabel: STATUS_LABEL[diagnosis.health.status],
      factors: Object.entries(diagnosis.health.factors).map(([key, value]) => ({ key, label: FACTOR_LABEL[key] || key, value, weight: HEALTH_WEIGHTS[key] })),
      problems: diagnosis.health.problems.map(p => ({ ...p, severityLabel: PRIORITY_LABEL[p.severity], typeLabel: TYPE_LABEL[p.type] || p.type || 'General' }))
    },
    compliance: {
      ...diagnosis.compliance,
      statusLabel: STATUS_LABEL[diagnosis.compliance.status],
      met: practices.filter(p => p.met),
      unmet: practices.filter(p => !p.met)
    },
    recommendations
  };
}

/**
 * Diagnóstico de un proyecto. Usa Sanzu si se puede; si no, el modo local.
 * Guarda el último análisis de Sanzu 60 s para no gastar su límite de peticiones.
 */
async function getDiagnosis(database, projectId, organizationId, { refresh = false } = {}) {
  const data = await loadProjectData(database, projectId, organizationId);
  if (!data) return null;
  const key = `${organizationId}:${projectId}`;
  const cached = cache.get(key);
  const age = cached ? Date.now() - cached.at : Infinity;
  if (!refresh && cached && age < CACHE_TTL_MS) return { ...cached.value, cached: true };

  const local = reason => present(localDiagnosis(data), { source: 'local', analyzedAt: new Date().toISOString(), warning: reason });
  const creds = await sanzuService.resolveOrganizationCredentials(database, organizationId).catch(() => ({}));
  const apiKey = data.project.sanzu_api_key || creds.apiKey;
  if (!apiKey) return local('Sanzu no está configurado; el diagnóstico se calculó en modo local con las mismas reglas.');

  try {
    const result = await sanzuService.analyzeContext(data.project, buildPayload(data), { apiKey, apiUrl: creds.apiUrl });
    if (!result || !result.health) throw new Error('La respuesta de Sanzu no tiene el formato esperado.');
    const value = present(fromSanzu(result), { source: 'sanzu', analyzedAt: result.analyzedAt || new Date().toISOString(), warning: null });
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (error) {
    const cause = error.code === 'RATE_LIMITED'
      ? `Sanzu alcanzó su límite de peticiones y pidió esperar ${error.retryAfter || 60} s`
      : `Sanzu no está disponible (${String(error.message || error).slice(0, 120)})`;
    if (cached && age < STALE_MAX_MS) {
      return { ...cached.value, cached: true, warning: `${cause}. Se muestra el último análisis de Sanzu (hace ${Math.max(1, Math.round(age / 60000))} min).` };
    }
    return local(`${cause}. El diagnóstico se calculó en modo local con las mismas reglas.`);
  }
}

/** Borra el análisis guardado de un proyecto (o todos si no se indica). */
function clearDiagnosisCache(organizationId, projectId) {
  if (organizationId && projectId) cache.delete(`${organizationId}:${projectId}`);
  else cache.clear();
}

module.exports = { getDiagnosis, localDiagnosis, fromSanzu, buildPayload, toSpanish, present, clearDiagnosisCache };
