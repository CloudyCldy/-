require('dotenv').config();
const { pool } = require('../server/database');

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE, password TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'member')), active INTEGER NOT NULL DEFAULT 1,
      github_username TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
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
  `);
  console.log('PostgreSQL inicializado correctamente.');
}
init().catch(error => { console.error('No fue posible inicializar PostgreSQL:', error.code || 'ERROR', error.message || error); process.exitCode = 1; }).finally(() => pool.end());
