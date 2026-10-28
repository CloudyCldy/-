require('dotenv').config();
const { pool } = require('../server/database');

async function init() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
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
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sanzu_api_key TEXT;
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sanzu_api_url TEXT DEFAULT 'https://sanzu.onrender.com';
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sanzu_connected BOOLEAN DEFAULT false;
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sanzu_last_tested_at TIMESTAMPTZ;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS sanzu_api_key TEXT;
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
      role TEXT NOT NULL CHECK (role IN ('admin', 'member', 'project_manager', 'viewer')), active INTEGER NOT NULL DEFAULT 1,
      github_username TEXT, gitlab_username TEXT, gitlab_token TEXT, profile_photo TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);

      -- OAuth connections table for GitHub and GitLab tokens
      CREATE TABLE IF NOT EXISTS oauth_connections (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL CHECK (provider IN ('github','gitlab')),
        access_token TEXT NOT NULL,
        username TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE (user_id, provider)
      );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id INTEGER;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS gitlab_username TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS gitlab_token TEXT;
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
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS methodology_id TEXT;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS requirements TEXT;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget NUMERIC(14, 2) DEFAULT 0;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS scope TEXT;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS sanzu_synced_at TIMESTAMPTZ;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS sanzu_sync_status TEXT DEFAULT 'pending';
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS sanzu_sync_error TEXT;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS sanzu_external_ref TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS projects_sanzu_external_ref_idx ON projects (sanzu_external_ref) WHERE sanzu_external_ref IS NOT NULL;
    UPDATE projects SET methodology_id = 'AGILE' WHERE methodology_id IS NULL;
    UPDATE projects SET sanzu_external_ref = 'haitani-proj-' || id WHERE sanzu_external_ref IS NULL;
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
    CREATE TABLE IF NOT EXISTS github_project_configurations (
      project_id INTEGER PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      owner TEXT NOT NULL, repository TEXT NOT NULL, repository_url TEXT, token TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO github_project_configurations (project_id, organization_id, owner, repository, repository_url, token)
      SELECT p.id, p.organization_id, legacy.owner, legacy.repository, legacy.repository_url, legacy.token
      FROM github_configurations legacy
      JOIN projects p ON p.organization_id = legacy.organization_id
      WHERE legacy.owner IS NOT NULL AND legacy.repository IS NOT NULL AND legacy.token IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM github_project_configurations current_config WHERE current_config.project_id = p.id);
    CREATE TABLE IF NOT EXISTS files (
      id SERIAL PRIMARY KEY, filename TEXT NOT NULL UNIQUE, original_name TEXT NOT NULL,
      path TEXT NOT NULL, mime_type TEXT NOT NULL, size INTEGER NOT NULL, uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE files ADD COLUMN IF NOT EXISTS organization_id INTEGER;
    ALTER TABLE files ADD COLUMN IF NOT EXISTS content BYTEA;
    UPDATE files SET organization_id = (SELECT organization_id FROM users WHERE users.id = files.uploaded_by) WHERE organization_id IS NULL;
    CREATE TABLE IF NOT EXISTS stored_assets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL, kind TEXT NOT NULL, mime_type TEXT NOT NULL,
      content BYTEA NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS image_asset_id UUID REFERENCES stored_assets(id) ON DELETE SET NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_asset_id UUID REFERENCES stored_assets(id) ON DELETE SET NULL;
    CREATE TABLE IF NOT EXISTS blocked_ips (
      id SERIAL PRIMARY KEY, ip INET NOT NULL UNIQUE, reason TEXT NOT NULL DEFAULT '', blocked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS security_events (
      id BIGSERIAL PRIMARY KEY, ip INET NOT NULL, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL, user_agent TEXT NOT NULL DEFAULT '',
      method TEXT NOT NULL, path TEXT NOT NULL, status INTEGER NOT NULL, event_type TEXT NOT NULL DEFAULT 'request',
      unusual BOOLEAN NOT NULL DEFAULT FALSE, reason TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS security_events_ip_created_idx ON security_events (ip, created_at DESC);
    CREATE INDEX IF NOT EXISTS security_events_created_idx ON security_events (created_at DESC);
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY, sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL, delivery_status TEXT NOT NULL DEFAULT 'enviado' CHECK (delivery_status IN ('enviado', 'entregado', 'leido')),
      read_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS organization_id INTEGER;
    UPDATE messages SET organization_id = (SELECT organization_id FROM users WHERE users.id = messages.sender_id) WHERE organization_id IS NULL;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'enviado';
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS group_id INTEGER;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_id INTEGER REFERENCES files(id) ON DELETE SET NULL;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_name TEXT;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_mime TEXT;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS conversation_type TEXT NOT NULL DEFAULT 'direct' CHECK (conversation_type IN ('direct', 'group'));
    CREATE TABLE IF NOT EXISTS chat_groups (
      id SERIAL PRIMARY KEY,
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_group_id_fkey;
    ALTER TABLE messages ADD CONSTRAINT messages_group_id_fkey FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE;
    CREATE TABLE IF NOT EXISTS chat_group_members (
      group_id INTEGER NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (group_id, user_id)
    );
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
    ALTER TABLE absences ADD COLUMN IF NOT EXISTS appeal_status TEXT NOT NULL DEFAULT 'ninguna';
    ALTER TABLE absences DROP CONSTRAINT IF EXISTS absences_appeal_status_check;
    ALTER TABLE absences ADD CONSTRAINT absences_appeal_status_check CHECK (appeal_status IN ('ninguna', 'pendiente', 'aprobada', 'rechazada'));
    ALTER TABLE absences ADD COLUMN IF NOT EXISTS appeal_reason TEXT;
    ALTER TABLE absences ADD COLUMN IF NOT EXISTS appeal_evidence_id INTEGER REFERENCES files(id) ON DELETE SET NULL;
    ALTER TABLE absences ADD COLUMN IF NOT EXISTS appealed_at TIMESTAMPTZ;
    ALTER TABLE absences ADD COLUMN IF NOT EXISTS resolution_note TEXT;
    ALTER TABLE absences ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS absences_appeal_status_idx ON absences (organization_id, appeal_status);
    CREATE TABLE IF NOT EXISTS incidences (
      id SERIAL PRIMARY KEY,
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved', 'appealed')),
      assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      appeal_reason TEXT,
      appealed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
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
    CREATE INDEX IF NOT EXISTS absences_user_date_idx ON absences (user_id, absence_date DESC);
    CREATE INDEX IF NOT EXISTS users_organization_idx ON users (organization_id);
    CREATE INDEX IF NOT EXISTS projects_organization_idx ON projects (organization_id);
    CREATE INDEX IF NOT EXISTS tasks_organization_idx ON tasks (organization_id);
    CREATE INDEX IF NOT EXISTS tasks_org_assigned_status_idx ON tasks (organization_id, assigned_to, status);
    CREATE INDEX IF NOT EXISTS tasks_org_status_due_idx ON tasks (organization_id, status, due_date);
    CREATE INDEX IF NOT EXISTS messages_org_receiver_status_idx ON messages (organization_id, receiver_id, delivery_status);
    CREATE INDEX IF NOT EXISTS messages_org_group_idx ON messages (organization_id, conversation_type, group_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS incidences_org_user_idx ON incidences (organization_id, user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS files_org_created_idx ON files (organization_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS activities_organization_idx ON activities (organization_id, created_at DESC);

    -- Knowledge Center & Relaciones Documentales (HB-08-ST051, ST052, ST053, SB-13-ST049, ST050)
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

    -- Risk Center (SB-07-ST063, ST064, ST065)
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

    -- Sistema de Eventos (SB-09-ST061, SB-09-ST062)
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
  console.log('PostgreSQL inicializado correctamente.');
}

if (require.main === module) {
  init().catch(error => {
    console.error('No fue posible inicializar PostgreSQL:', error.code || 'ERROR', error.message || error);
    process.exitCode = 1;
  }).finally(() => pool.end());
}

module.exports = { init };