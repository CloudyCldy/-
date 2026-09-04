require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();
const port = Number(process.env.PORT || 3000);
const database = new Database(path.join(__dirname, 'database', 'haitani.db'));
database.pragma('foreign_keys = ON');
fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
app.locals.database = database;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: process.env.SESSION_SECRET || 'haitani-local-secret', resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax' } }));
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
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use((error, req, res, next) => {
  console.error(error);
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'El archivo supera el tamaño permitido.' });
  res.status(error.status || 500).json({ error: error.message || 'Error interno del servidor.' });
});

app.listen(port, () => console.log(`Haitani disponible en http://localhost:${port}`));