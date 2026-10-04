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
app.use(session({
  store: new PgSession({ pool: database.pool, createTableIfMissing: true, tableName: 'user_sessions' }),
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
app.use('/api/auth', require('./server/routes/authRoutes'));
app.use('/api/users', require('./server/routes/userRoutes'));
app.use('/api/tasks', require('./server/routes/taskRoutes'));
app.use('/api/files', require('./server/routes/fileRoutes'));
app.use('/api/dashboard', require('./server/routes/dashboardRoutes'));
app.use('/api/github', require('./server/routes/githubRoutes'));
app.use('/api/messages', require('./server/routes/messageRoutes'));
app.use('/api/incidences', require('./server/routes/incidenceRoutes'));
app.use('/api/chat-backgrounds', require('./server/routes/chatBackgroundRoutes'));
app.use('/api/calls', require('./server/routes/callRoutes'));
app.use('/api/music', require('./server/routes/musicRoutes'));
app.use('/api/notifications', require('./server/routes/notificationRoutes'));
app.use('/api/oauth', oauthRoutes);
app.use('/api/absences', require('./server/routes/absenceRoutes'));
app.use('/api/announcements', require('./server/routes/announcementRoutes'));
app.use('/api/security/ip-blocks', require('./server/routes/ipBlockRoutes'));
app.use('/api/assistant', require('./server/routes/assistantRoutes'));
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
  server.listen(port, () => console.log(`Haitani disponible en http://localhost:${port}`));
}

start().catch(error => {
  console.error('Fallo al iniciar Haitani:', error);
  process.exit(1);
});