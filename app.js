require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const WebSocket = require('ws');
const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');
const cors = require('cors');
const database = require('./server/database');

const app = express();
const port = Number(process.env.PORT || 3000);
const PgSession = connectPgSimple(session);
fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
app.locals.database = database;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(session({
  store: new PgSession({ pool: database.pool, createTableIfMissing: true, tableName: 'user_sessions' }),
  secret: process.env.SESSION_SECRET || 'haitani-local-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax' }
}));
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.css')) res.setHeader('Cache-Control', 'no-store');
  }
}));

app.get('/api/health', (req, res) => res.json({ ok: true, app: 'Haitani', project: 'Sakura Coffee' }));
app.use('/api/auth', require('./server/routes/authRoutes'));
app.use('/api/users', require('./server/routes/userRoutes'));
app.use('/api/tasks', require('./server/routes/taskRoutes'));
app.use('/api/files', require('./server/routes/fileRoutes'));
app.use('/api/dashboard', require('./server/routes/dashboardRoutes'));
app.use('/api/github', require('./server/routes/githubRoutes'));
app.use('/api/messages', require('./server/routes/messageRoutes'));
app.use('/api/chat-backgrounds', require('./server/routes/chatBackgroundRoutes'));
app.use('/api/notifications', require('./server/routes/notificationRoutes'));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use((error, req, res, next) => {
  console.error(error);
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'El archivo supera el tamaño permitido.' });
  res.status(error.status || 500).json({ error: error.message || 'Error interno del servidor.' });
});

const server = http.createServer(app);
const webSocketServer = new WebSocket.Server({ server });
const callClients = new Map();
webSocketServer.on('connection', socket => {
  socket.on('message', raw => {
    try {
      const message = JSON.parse(raw.toString());
      if (message.type === 'register' && Number.isInteger(Number(message.userId))) {
        socket.userId = Number(message.userId);
        callClients.set(socket.userId, socket);
        return;
      }
      const recipient = callClients.get(Number(message.to));
      if (recipient?.readyState === WebSocket.OPEN) recipient.send(JSON.stringify({ ...message, from: socket.userId }));
    } catch {}
  });
  socket.on('close', () => { if (socket.userId && callClients.get(socket.userId) === socket) callClients.delete(socket.userId); });
});
server.listen(port, () => console.log(`Haitani disponible en http://localhost:${port}`));