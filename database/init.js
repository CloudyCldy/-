require('dotenv').config();
const { pool } = require('../server/database');

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS plans (
      id SERIAL PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      price_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'MXN',
      max_users INTEGER,
      max_projects INTEGER,
      max_storage_mb INTEGER,
      features JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO plans (key, name, price_cents, max_users, max_projects, max_storage_mb, features) VALUES
      ('free', 'Free', 0, 3, 1, 100, '{"github":false,"ai":false,"calls":false,"custom_roles":false}'),
      ('sano', 'Sano', 7000, 10, 5, 2048, '{"github":true,"ai":false,"calls":"audio","custom_roles":false}'),
      ('hanemiya', 'Hanemiya', 10000, 25, NULL, 10240, '{"github":true,"ai":true,"calls":"video","custom_roles":true}'),
      ('matsuno', 'Matsuno', 15000, 75, NULL, 51200, '{"github":true,"ai":true,"calls":"video","custom_roles":true}'),
      ('inui', 'Inui', 20000, NULL, NULL, 204800, '{"github":true,"ai":true,"calls":"video","custom_roles":true}')
    ON CONFLICT (key) DO NOTHING;
    CREATE TABLE IF NOT EXISTS organizations (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
      email TEXT, description TEXT, github_url TEXT, github_owner TEXT,
      github_repository TEXT, status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan_id INTEGER REFERENCES plans(id);
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'active';
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sanzu_project_id TEXT;
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sanzu_token TEXT;
    ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_subscription_status_check;
    ALTER TABLE organizations ADD CONSTRAINT organizations_subscription_status_check
      CHECK (subscription_status IN ('active', 'pending', 'past_due', 'canceled'));
    UPDATE organizations SET plan_id = (SELECT id FROM plans WHERE key = 'free') WHERE plan_id IS NULL;
    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT NOT NULL DEFAULT ''
    );
    INSERT INTO roles (name, description) VALUES
      ('admin', 'Administración completa de la organización'),
      ('project_manager', 'Gestión de proyectos asignados'),
      ('member', 'Trabajo en tareas y proyectos asignados'),
      ('viewer', 'Acceso de solo lectura')
    ON CONFLICT (name) DO NOTHING;
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE, password TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'member')), active INTEGER NOT NULL DEFAULT 1,
      github_username TEXT, profile_photo TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id INTEGER;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
    INSERT INTO organizations (name, slug, email, description)
      VALUES ('Haitani', 'haitani', 'admin@haitani.local', 'Organización inicial de Haitani')
      ON CONFLICT (slug) DO NOTHING;
    UPDATE users SET organization_id = (SELECT id FROM organizations WHERE slug = 'haitani') WHERE organization_id IS NULL;
    UPDATE users SET role_id = roles.id FROM roles WHERE roles.name = users.role AND users.role_id IS NULL;
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL,
      repository_url TEXT, github_owner TEXT, github_repository TEXT,
      start_date DATE, end_date DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS organization_id INTEGER;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS objective TEXT;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS client TEXT;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS manager_id INTEGER;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'planning';
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium';
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS progress INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS technologies TEXT;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS risks TEXT;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
    UPDATE projects SET organization_id = (SELECT id FROM organizations WHERE slug = 'haitani') WHERE organization_id IS NULL;
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en_proceso', 'completada')),
      priority TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('baja', 'media', 'alta')),
      start_date DATE, due_date DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS organization_id INTEGER;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS creator_id INTEGER;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
    UPDATE tasks SET organization_id = projects.organization_id FROM projects WHERE projects.id = tasks.project_id AND tasks.organization_id IS NULL;
    UPDATE tasks SET creator_id = (SELECT id FROM users WHERE organization_id = tasks.organization_id ORDER BY id LIMIT 1) WHERE creator_id IS NULL;
    ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
    ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('pendiente', 'en_proceso', 'en_revision', 'bloqueada', 'completada'));
    ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;
    ALTER TABLE tasks ADD CONSTRAINT tasks_priority_check CHECK (priority IN ('baja', 'media', 'alta', 'critica'));
    CREATE TABLE IF NOT EXISTS project_members (
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (project_id, user_id)
    );
    INSERT INTO project_members (project_id, user_id, organization_id)
      SELECT p.id, u.id, p.organization_id FROM projects p JOIN users u ON u.organization_id = p.organization_id
      ON CONFLICT DO NOTHING;
    CREATE TABLE IF NOT EXISTS activities (
      id SERIAL PRIMARY KEY, organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      action TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY, organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS github_configurations (
      organization_id INTEGER PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
      owner TEXT, repository TEXT, repository_url TEXT, token TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS files (
      id SERIAL PRIMARY KEY, filename TEXT NOT NULL UNIQUE, original_name TEXT NOT NULL,
      path TEXT NOT NULL, mime_type TEXT NOT NULL, size INTEGER NOT NULL, uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE files ADD COLUMN IF NOT EXISTS organization_id INTEGER;
    UPDATE files SET organization_id = (SELECT organization_id FROM users WHERE users.id = files.uploaded_by) WHERE organization_id IS NULL;
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY, sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL, delivery_status TEXT NOT NULL DEFAULT 'enviado' CHECK (delivery_status IN ('enviado', 'entregado', 'leido')),
      read_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS organization_id INTEGER;
    UPDATE messages SET organization_id = (SELECT organization_id FROM users WHERE users.id = messages.sender_id) WHERE organization_id IS NULL;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'enviado';
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages (sender_id, receiver_id, created_at);
    CREATE TABLE IF NOT EXISTS conversation_deletions (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      other_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      deleted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, other_user_id)
    );
    ALTER TABLE conversation_deletions ADD COLUMN IF NOT EXISTS organization_id INTEGER;
    UPDATE conversation_deletions SET organization_id = (SELECT organization_id FROM users WHERE users.id = conversation_deletions.user_id) WHERE organization_id IS NULL;
    CREATE TABLE IF NOT EXISTS calls (
      id SERIAL PRIMARY KEY, caller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      call_type TEXT NOT NULL CHECK (call_type IN ('audio', 'video')),
      status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'answered', 'missed', 'scheduled')),
      scheduled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE calls ADD COLUMN IF NOT EXISTS organization_id INTEGER;
    UPDATE calls SET organization_id = (SELECT organization_id FROM users WHERE users.id = calls.caller_id) WHERE organization_id IS NULL;
    ALTER TABLE calls ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
    ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_status_check;
    ALTER TABLE calls ADD CONSTRAINT calls_status_check CHECK (status IN ('initiated', 'answered', 'missed', 'scheduled'));
    CREATE INDEX IF NOT EXISTS calls_receiver_idx ON calls (receiver_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS absences (
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      absence_date DATE NOT NULL, subject TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE absences ADD COLUMN IF NOT EXISTS organization_id INTEGER;
    UPDATE absences SET organization_id = (SELECT organization_id FROM users WHERE users.id = absences.user_id) WHERE organization_id IS NULL;
    CREATE INDEX IF NOT EXISTS absences_user_date_idx ON absences (user_id, absence_date DESC);
    CREATE INDEX IF NOT EXISTS users_organization_idx ON users (organization_id);
    CREATE INDEX IF NOT EXISTS projects_organization_idx ON projects (organization_id);
    CREATE INDEX IF NOT EXISTS tasks_organization_idx ON tasks (organization_id);
    CREATE INDEX IF NOT EXISTS activities_organization_idx ON activities (organization_id, created_at DESC);
  `);
  console.log('PostgreSQL inicializado correctamente.');
}
init().catch(error => { console.error('No fue posible inicializar PostgreSQL:', error.code || 'ERROR', error.message || error); process.exitCode = 1; }).finally(() => pool.end());
