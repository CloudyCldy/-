require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const signature = require('cookie-signature');
const express = require('express');
const WebSocket = require('ws');
const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');
const compression = require('compression');
const cors = require('cors');
const database = require('./server/database');
const { init: initDatabase } = require('./database/init');
const { seed } = require('./database/seed');
const billingRoutes = require('./server/routes/billingRoutes');
const oauthRoutes = require('./server/routes/oauthRoutes');
const { requireAllowedIp } = require('./server/middleware/ipBlockMiddleware');
const securityAudit = require('./server/middleware/securityAuditMiddleware');

const app = express();
app.set('trust proxy', 1);
const port = Number(process.env.PORT || 3000);
const PgSession = connectPgSimple(session);
fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
app.locals.database = database;

async function ensureRuntimeSchema() {
  try {
    const usersExists = await database.pool.query(`SELECT to_regclass('public.users') AS table_name;`);
    const usersCount = await database.pool.query(`SELECT COUNT(*)::int AS count FROM users;`);

    if (!usersExists.rows[0]?.table_name) {
      console.log('La base de datos está vacía; inicializando esquema de Haitani...');
      await initDatabase();
    }

    if ((usersCount.rows[0]?.count ?? 0) === 0) {
      console.log('No hay usuarios activos; cargando seed inicial con admin por defecto...');
      await seed();
    }

    await database.pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id INTEGER;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS gitlab_username TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS gitlab_token TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
      CREATE TABLE IF NOT EXISTS stored_assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL, kind TEXT NOT NULL, mime_type TEXT NOT NULL,
        content BYTEA NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS image_asset_id UUID REFERENCES stored_assets(id) ON DELETE SET NULL;

      ALTER TABLE messages ALTER COLUMN receiver_id DROP NOT NULL;
      UPDATE messages SET receiver_id = NULL WHERE receiver_id = 0;
      ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_group_id_fkey;
      ALTER TABLE messages ADD CONSTRAINT messages_group_id_fkey FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE;

      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        tag TEXT NOT NULL DEFAULT 'General',
        accent TEXT NOT NULL DEFAULT 'pink' CHECK (accent IN ('pink', 'yellow', 'green')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS announcements_organization_idx ON announcements (organization_id, created_at DESC);

      ALTER TABLE absences ADD COLUMN IF NOT EXISTS appeal_status TEXT NOT NULL DEFAULT 'ninguna';
      ALTER TABLE absences DROP CONSTRAINT IF EXISTS absences_appeal_status_check;
      ALTER TABLE absences ADD CONSTRAINT absences_appeal_status_check CHECK (appeal_status IN ('ninguna', 'pendiente', 'aprobada', 'rechazada'));
      ALTER TABLE absences ADD COLUMN IF NOT EXISTS appeal_reason TEXT;
      ALTER TABLE absences ADD COLUMN IF NOT EXISTS appeal_evidence_id INTEGER REFERENCES files(id) ON DELETE SET NULL;
      ALTER TABLE absences ADD COLUMN IF NOT EXISTS appealed_at TIMESTAMPTZ;
      ALTER TABLE absences ADD COLUMN IF NOT EXISTS resolution_note TEXT;
      ALTER TABLE absences ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
      CREATE INDEX IF NOT EXISTS absences_appeal_status_idx ON absences (organization_id, appeal_status);
      CREATE INDEX IF NOT EXISTS tasks_org_assigned_status_idx ON tasks (organization_id, assigned_to, status);
      CREATE INDEX IF NOT EXISTS tasks_org_status_due_idx ON tasks (organization_id, status, due_date);
      CREATE INDEX IF NOT EXISTS messages_org_receiver_status_idx ON messages (organization_id, receiver_id, delivery_status);
      CREATE INDEX IF NOT EXISTS messages_org_group_idx ON messages (organization_id, conversation_type, group_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS incidences_org_user_idx ON incidences (organization_id, user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS files_org_created_idx ON files (organization_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS sprints (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        goal TEXT NOT NULL DEFAULT '',
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'planificado' CHECK (status IN ('planificado', 'activo', 'cerrado')),
        started_at TIMESTAMPTZ,
        closed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK (end_date >= start_date)
      );
      CREATE INDEX IF NOT EXISTS sprints_org_project_idx ON sprints (organization_id, project_id, status);
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sprint_id INTEGER REFERENCES sprints(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS tasks_org_sprint_idx ON tasks (organization_id, sprint_id);
      CREATE TABLE IF NOT EXISTS backlog_items (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        sprint_id INTEGER REFERENCES sprints(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        type TEXT NOT NULL CHECK (type IN ('USER_STORY', 'BUG', 'TASK', 'FEATURE', 'IMPROVEMENT')),
        priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
        story_points INTEGER CHECK (story_points BETWEEN 0 AND 100),
        status TEXT NOT NULL DEFAULT 'BACKLOGGED' CHECK (status IN ('BACKLOGGED', 'READY', 'IN_PROGRESS', 'DONE')),
        acceptance_criteria TEXT NOT NULL DEFAULT '',
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS backlog_items_org_project_idx ON backlog_items (organization_id, project_id, status);

      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sanzu_project_id TEXT;
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sanzu_token TEXT;
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sanzu_api_key TEXT;
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sanzu_api_url TEXT DEFAULT 'https://sanzu.onrender.com';
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sanzu_connected BOOLEAN DEFAULT false;
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sanzu_last_tested_at TIMESTAMPTZ;

      ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget NUMERIC(14, 2) DEFAULT 0;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS scope TEXT;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS sanzu_synced_at TIMESTAMPTZ;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS sanzu_sync_status TEXT DEFAULT 'pending';
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS sanzu_sync_error TEXT;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS sanzu_api_key TEXT;

      ALTER TABLE files ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';
      ALTER TABLE files ADD COLUMN IF NOT EXISTS phase TEXT DEFAULT 'execution';
      ALTER TABLE files ADD COLUMN IF NOT EXISTS methodology TEXT DEFAULT 'AGILE';
      ALTER TABLE files ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
      ALTER TABLE files ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE;
      ALTER TABLE files ADD COLUMN IF NOT EXISTS task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE;
      ALTER TABLE files ADD COLUMN IF NOT EXISTS tags TEXT;

      CREATE TABLE IF NOT EXISTS project_documents (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
        organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(project_id, file_id)
      );

      CREATE TABLE IF NOT EXISTS task_documents (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
        organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(task_id, file_id)
      );

      CREATE TABLE IF NOT EXISTS methodology_documents (
        id SERIAL PRIMARY KEY,
        methodology TEXT NOT NULL,
        file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
        organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(methodology, file_id)
      );

      CREATE TABLE IF NOT EXISTS project_risks (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        probability TEXT NOT NULL DEFAULT 'media' CHECK (probability IN ('baja', 'media', 'alta')),
        impact TEXT NOT NULL DEFAULT 'media' CHECK (impact IN ('baja', 'media', 'alta')),
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'mitigated', 'closed')),
        mitigation TEXT NOT NULL DEFAULT '',
        severity_score INTEGER NOT NULL DEFAULT 50,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS project_risks_org_project_idx ON project_risks (organization_id, project_id, status);
      ALTER TABLE project_risks ADD COLUMN IF NOT EXISTS assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS project_risks_assigned_to_idx ON project_risks (assigned_to);
      ALTER TABLE project_risks DROP CONSTRAINT IF EXISTS project_risks_status_check;
      ALTER TABLE project_risks ADD CONSTRAINT project_risks_status_check
        CHECK (status IN ('open', 'mitigated', 'accepted', 'closed'));
      ALTER TABLE project_risks DROP CONSTRAINT IF EXISTS project_risks_probability_check;
      ALTER TABLE project_risks ADD CONSTRAINT project_risks_probability_check
        CHECK (probability IN ('muy_baja', 'baja', 'media', 'alta', 'muy_alta', '1', '2', '3', '4', '5'));
      ALTER TABLE project_risks DROP CONSTRAINT IF EXISTS project_risks_impact_check;
      ALTER TABLE project_risks ADD CONSTRAINT project_risks_impact_check
        CHECK (impact IN ('muy_bajo', 'bajo', 'baja', 'medio', 'media', 'alto', 'alta', 'muy_alto', 'muy_alta', 'critico', 'critica', '1', '2', '3', '4', '5'));

      CREATE TABLE IF NOT EXISTS project_events (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL CHECK (event_type IN ('task_overdue', 'task_blocked', 'milestone_delayed', 'sprint_ending', 'member_overloaded', 'risk_created', 'deadline_approaching')),
        severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        payload JSONB DEFAULT '{}',
        resolved BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS project_events_org_proj_idx ON project_events (organization_id, project_id, resolved);

      -- GanttProject enhancements: WBS hierarchy, milestones, baselines & dependencies
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_milestone BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS baseline_start_date DATE;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS baseline_due_date DATE;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS color TEXT;

      CREATE TABLE IF NOT EXISTS task_dependencies (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        predecessor_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        dependency_type TEXT NOT NULL DEFAULT 'FS' CHECK (dependency_type IN ('FS', 'SS', 'FF', 'SF')),
        lag_days INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (task_id, predecessor_id)
      );
      CREATE INDEX IF NOT EXISTS task_dep_task_idx ON task_dependencies (task_id);
      CREATE INDEX IF NOT EXISTS task_dep_pred_idx ON task_dependencies (predecessor_id);
      CREATE INDEX IF NOT EXISTS task_dep_org_proj_idx ON task_dependencies (organization_id, project_id);

      -- Sprint 3: Gestión de Hitos (Milestones) del Proyecto
      CREATE TABLE IF NOT EXISTS project_milestones (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        due_date DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en_progreso', 'completado')),
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS project_milestones_org_project_idx ON project_milestones (organization_id, project_id, status);
      CREATE INDEX IF NOT EXISTS project_milestones_due_date_idx ON project_milestones (due_date);

      -- Sprint 3: Gestión de Incidencias (Issues) del Proyecto
      CREATE TABLE IF NOT EXISTS project_issues (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical', 'baja', 'media', 'alta', 'critica')),
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
        reported_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS project_issues_org_proj_status_idx ON project_issues (organization_id, project_id, status);
      CREATE INDEX IF NOT EXISTS project_issues_assigned_idx ON project_issues (assigned_to);
      CREATE INDEX IF NOT EXISTS project_issues_reported_idx ON project_issues (reported_by);

      -- Sprint 3: Catálogo de Metodologías Extensible
      CREATE TABLE IF NOT EXISTS methodologies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'agile',
        principles JSONB DEFAULT '[]',
        practices JSONB DEFAULT '[]',
        is_custom BOOLEAN NOT NULL DEFAULT false,
        organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS methodologies_org_idx ON methodologies (organization_id);

      INSERT INTO methodologies (id, name, description, category, principles, practices, is_custom) VALUES
        ('SCRUM', 'Scrum', 'Framework ágil iterativo basado en sprints de 1 a 4 semanas, con roles definidos (Scrum Master, Product Owner, Equipo de Desarrollo) y ceremonias estructuradas para entrega continua de valor.', 'agile', '["Transparencia", "Inspección", "Adaptación"]', '["Sprint Planning", "Daily Standup", "Sprint Review", "Sprint Retrospective"]', false),
        ('KANBAN', 'Kanban', 'Método visual para gestionar y optimizar el flujo de trabajo continuo, enfocado en limitar el trabajo en curso (WIP) y maximizar la eficiencia y entrega rápida.', 'agile', '["Empezar con lo que haces ahora", "Perseguir el cambio evolutivo", "Respetar los procesos y roles actuales"]', '["Visualizar el flujo", "Limitar el WIP", "Gestionar el flujo", "Hacer políticas explícitas"]', false),
        ('XP', 'Extreme Programming', 'Metodología ágil centrada en la excelencia técnica y las mejores prácticas de ingeniería de software para responder a requerimientos cambiantes con alta calidad.', 'agile', '["Comunicación", "Simplicidad", "Retroalimentación", "Coraje", "Respeto"]', '["TDD (Test-Driven Development)", "Pair Programming", "Integración Continua", "Refactorización constante"]', false),
        ('LEAN', 'Lean Software Development', 'Filosofía orientada a la optimización del valor eliminando desperdicios (muda), acelerando tiempos de entrega y empoderando al equipo.', 'agile', '["Eliminar desperdicio", "Amplificar el aprendizaje", "Decidir lo más tarde posible", "Entregar lo más rápido posible"]', '["Mapeo del flujo de valor", "Sistemas pull", "Mejora continua (Kaizen)"]', false),
        ('WATERFALL', 'Waterfall (Cascada)', 'Modelo secuencial tradicional dividido en fases claramente delimitadas: requerimientos, diseño, implementación, pruebas y despliegue, ideal para proyectos con especificaciones fijas.', 'traditional', '["Planificación rigurosa", "Secuencia estricta", "Documentación exhaustiva"]', '["Gantt estricto", "Firmas de aprobación por fase", "Gestión formal del cambio"]', false),
        ('AGILE', 'Ágil Genérico', 'Enfoque centrado en la flexibilidad, colaboración activa con el cliente, entregas frecuentes de software funcional y adaptación ante el cambio.', 'agile', '["Individuos sobre procesos", "Software funcionando sobre documentación extensiva", "Colaboración con el cliente", "Respuesta ante el cambio"]', '["Iteraciones cortas", "Historias de usuario", "Feedback continuo"]', false),
        ('HYBRID', 'Metodología Híbrida', 'Enfoque adaptativo que combina la estructura de planificación y control de Waterfall con la flexibilidad y velocidad de entrega iterativa de Scrum y Kanban.', 'hybrid', '["Gobernanza estructurada", "Ejecución flexible", "Adaptabilidad al contexto"]', '["Hitos y fases globales con sprints ágiles en desarrollo", "Control presupuestal con backlog iterativo"]', false)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        principles = EXCLUDED.principles,
        practices = EXCLUDED.practices;
    `);
  } catch (error) {
    console.error('No fue posible asegurar el esquema de usuarios:', error);
    throw error;
  }
}

const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(value => value.trim()) : [];
app.use(compression());
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : false, credentials: true }));
app.use('/api/billing/webhook', billingRoutes.webhookRouter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';
app.use(session({
  store: (isTest && !process.env.TEST_DATABASE_URL)
    ? new session.MemoryStore()
    : new PgSession({ pool: database.pool, createTableIfMissing: true, tableName: 'user_sessions' }),
  secret: process.env.SESSION_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: false,
  // 'none' permite peticiones cross-origin; los navegadores exigen secure: true en ese caso.
  cookie: { httpOnly: true, sameSite: isProd ? 'none' : 'lax', secure: isProd, maxAge: 1000 * 60 * 60 * 12 }
}));
app.use(securityAudit);
app.use(requireAllowedIp);
app.use(express.static(path.join(__dirname, 'public'), {
  index: false,
  maxAge: isProd ? '1d' : 0,
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (!isProd) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      } else if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
        res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
      }
    }
  }
}));

app.get('/api/health', (req, res) => res.json({ ok: true, app: 'Haitani', project: 'Sakura Coffee' }));
app.use('/api/billing', billingRoutes.router);
app.use('/api/plans', require('./server/routes/planRoutes'));
app.use('/api/organizations', require('./server/routes/organizationRoutes'));
app.use('/api/projects', require('./server/routes/projectRoutes'));
app.use('/api/backlog', require('./server/routes/backlogRoutes'));
app.use('/api/auth', require('./server/routes/authRoutes'));
app.use('/api/users', require('./server/routes/userRoutes'));
app.use('/api/tasks', require('./server/routes/taskRoutes'));
app.use('/api/sprints', require('./server/routes/sprintRoutes'));
app.use('/api/milestones', require('./server/routes/milestoneRoutes'));
app.use('/api/templates', require('./server/routes/templateRoutes'));
app.use('/api/files', require('./server/routes/fileRoutes'));
app.use('/api/dashboard', require('./server/routes/dashboardRoutes'));
app.use('/api/github', require('./server/routes/githubRoutes'));
app.use('/api/messages', require('./server/routes/messageRoutes'));
app.use('/api/incidences', require('./server/routes/incidenceRoutes'));
app.use('/api/issues', require('./server/routes/issueRoutes'));
app.use('/api/chat-backgrounds', require('./server/routes/chatBackgroundRoutes'));
app.use('/api/calls', require('./server/routes/callRoutes'));
app.use('/api/music', require('./server/routes/musicRoutes'));
app.use('/api/notifications', require('./server/routes/notificationRoutes'));
app.use('/api/oauth', oauthRoutes);
app.use('/api/absences', require('./server/routes/absenceRoutes'));
app.use('/api/announcements', require('./server/routes/announcementRoutes'));
app.use('/api/security/ip-blocks', require('./server/routes/ipBlockRoutes'));
app.use('/api/assistant', require('./server/routes/assistantRoutes'));
app.use('/api/sanzu', require('./server/routes/sanzuRoutes'));
app.use('/api/knowledge', require('./server/routes/knowledgeRoutes'));
app.use('/api/risks', require('./server/routes/riskRoutes'));
app.use('/api/events', require('./server/routes/eventRoutes'));
app.use('/api/gantt', require('./server/routes/ganttRoutes'));
app.use('/api/methodologies', require('./server/routes/methodologyRoutes'));
const legalPages = require('./server/legalPages');
app.get(['/privacidad', '/privacy'], legalPages.privacy);
app.get(['/eliminar-cuenta', '/delete-account'], legalPages.deletion);
app.get('*', (req, res) => {
  try {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    let html = fs.readFileSync(indexPath, 'utf8');
    const cssPath = path.join(__dirname, 'public', 'css', 'style.css');
    const jsPath = path.join(__dirname, 'public', 'js', 'app.js');
    const cssMtime = fs.existsSync(cssPath) ? fs.statSync(cssPath).mtimeMs : Date.now();
    const jsMtime = fs.existsSync(jsPath) ? fs.statSync(jsPath).mtimeMs : Date.now();
    html = html.replace(/\/css\/style\.css(?:\?v=[^"'\s>]*)?/, `/css/style.css?v=${cssMtime}`);
    html = html.replace(/\/js\/app\.js(?:\?v=[^"'\s>]*)?/, `/js/app.js?v=${jsMtime}`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(html);
  } catch {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});
app.use((error, req, res, next) => {
  console.error(error);
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'El archivo supera el tamaño permitido.' });
  res.status(error.status || 500).json({ error: error.message || 'Error interno del servidor.' });
});

const server = http.createServer(app);
const webSocketServer = new WebSocket.Server({ server });
const callClients = new Map();
function sessionIdFromRequest(request) {
  const value = request.headers.cookie?.split(';').map(item => item.trim()).find(item => item.startsWith('connect.sid='))?.split('=').slice(1).join('=');
  if (!value?.startsWith('s:')) return null;
  return signature.unsign(decodeURIComponent(value.slice(2)), process.env.SESSION_SECRET || 'change-this-secret');
}
webSocketServer.on('connection', (socket, request) => {
  const sessionId = sessionIdFromRequest(request);
  if (!sessionId) return socket.close(1008, 'Sesión requerida');
  database.pool.query('SELECT sess FROM user_sessions WHERE sid = $1', [sessionId]).then(result => {
    try { socket.session = JSON.parse(result.rows[0]?.sess || '{}'); } catch { socket.session = {}; }
    if (!socket.session.user?.id) socket.close(1008, 'Sesión requerida');
  }).catch(() => socket.close(1011, 'No fue posible validar la sesión'));
  socket.on('message', raw => {
    try {
      const message = JSON.parse(raw.toString());
      if (message.type === 'register' && Number.isInteger(Number(message.userId)) && socket.session?.user?.id === Number(message.userId)) {
        socket.userId = Number(message.userId);
        callClients.set(socket.userId, socket);
        return;
      }
      if (!socket.userId) return;
      const recipient = callClients.get(Number(message.to));
      if (recipient?.readyState === WebSocket.OPEN) recipient.send(JSON.stringify({ ...message, from: socket.userId }));
      else if (message.type === 'offer') database.prepare('UPDATE calls SET status = ? WHERE id = ? AND status = ?').run('missed', message.callId, 'initiated').catch(() => {});
    } catch {}
  });
  socket.on('close', () => { if (socket.userId && callClients.get(socket.userId) === socket) callClients.delete(socket.userId); });
});
async function start() {
  await ensureRuntimeSchema();
  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`Haitani disponible en http://localhost:${port}`);
      resolve(server);
    });
  });
}

if (require.main === module) {
  start().catch(error => {
    console.error('Fallo al iniciar Haitani:', error);
    process.exit(1);
  });
}

module.exports = app;
app.app = app;
app.server = server;
app.start = start;
app.ensureRuntimeSchema = ensureRuntimeSchema;