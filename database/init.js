require('dotenv').config();
const { pool } = require('../server/database');

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE, password TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'member')), active INTEGER NOT NULL DEFAULT 1,
      github_username TEXT, profile_photo TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT;
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL,
      repository_url TEXT, github_owner TEXT, github_repository TEXT,
      start_date DATE, end_date DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en_proceso', 'completada')),
      priority TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('baja', 'media', 'alta')),
      start_date DATE, due_date DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS files (
      id SERIAL PRIMARY KEY, filename TEXT NOT NULL UNIQUE, original_name TEXT NOT NULL,
      path TEXT NOT NULL, mime_type TEXT NOT NULL, size INTEGER NOT NULL, uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY, sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL, delivery_status TEXT NOT NULL DEFAULT 'enviado' CHECK (delivery_status IN ('enviado', 'entregado', 'leido')),
      read_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'enviado';
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages (sender_id, receiver_id, created_at);
    CREATE TABLE IF NOT EXISTS conversation_deletions (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      other_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      deleted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, other_user_id)
    );
    CREATE TABLE IF NOT EXISTS calls (
      id SERIAL PRIMARY KEY, caller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      call_type TEXT NOT NULL CHECK (call_type IN ('audio', 'video')),
      status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'answered', 'missed', 'scheduled')),
      scheduled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE calls ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
    ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_status_check;
    ALTER TABLE calls ADD CONSTRAINT calls_status_check CHECK (status IN ('initiated', 'answered', 'missed', 'scheduled'));
    CREATE INDEX IF NOT EXISTS calls_receiver_idx ON calls (receiver_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS absences (
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      absence_date DATE NOT NULL, subject TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS absences_user_date_idx ON absences (user_id, absence_date DESC);
  `);
  console.log('PostgreSQL inicializado correctamente.');
}
init().catch(error => { console.error('No fue posible inicializar PostgreSQL:', error.code || 'ERROR', error.message || error); process.exitCode = 1; }).finally(() => pool.end());
