require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../server/database');

async function seed() {
  const password = await bcrypt.hash('admin123', 12);
  const organizations = await pool.query("SELECT id FROM organizations WHERE slug = 'haitani'");
  if (!organizations.rows[0]) {
    console.log('No existe la organización haitani; se omite el seed automático.');
    return;
  }

  const organization = organizations.rows[0];
  const addUser = `INSERT INTO users (name, username, email, password, role, role_id, organization_id, github_username) VALUES ($1, $2, $3, $4, $5, (SELECT id FROM roles WHERE name = $5), $6, $7) ON CONFLICT (username) DO UPDATE SET name = EXCLUDED.name, organization_id = EXCLUDED.organization_id, role_id = EXCLUDED.role_id RETURNING id`;
  await pool.query(addUser, ['Administrador Haitani', 'admin', 'admin@haitani.local', password, 'admin', organization.id, null]);
  for (const [name, username, email, github] of [['Ana', 'ana', 'ana@haitani.local', 'ana-dev'], ['Carlos', 'carlos', 'carlos@haitani.local', null], ['María', 'maria', 'maria@haitani.local', null], ['Luis', 'luis', 'luis@haitani.local', null]]) await pool.query(addUser, [name, username, email, password, 'member', organization.id, github]);
  const project = await pool.query('SELECT id FROM projects WHERE name = $1 AND organization_id = $2', ['Sakura Coffee', organization.id]);
  const projectId = project.rows[0]?.id || (await pool.query('INSERT INTO projects (organization_id, name, description) VALUES ($1, $2, $3) RETURNING id', [organization.id, 'Sakura Coffee', 'Aplicación web desarrollada por el equipo.'])).rows[0].id;
  const count = await pool.query('SELECT COUNT(*)::integer AS count FROM tasks WHERE organization_id = $1', [organization.id]);
  if (!count.rows[0].count) {
    const users = (await pool.query("SELECT id FROM users WHERE role = 'member' AND organization_id = $1 ORDER BY id", [organization.id])).rows;
    const tasks = [['Diseño de interfaz', 'Definir pantallas principales de Haitani.', users[0]?.id, 'en_proceso', 'alta', '2026-09-01', '2026-09-12'], ['Sistema de login', 'Autenticación y control de roles.', users[1]?.id, 'completada', 'alta', '2026-08-25', '2026-09-08'], ['Base de datos', 'Modelo PostgreSQL para la operación del equipo.', users[2]?.id, 'completada', 'media', '2026-08-26', '2026-09-10'], ['Desarrollo del backend', 'API REST y reglas de negocio.', users[1]?.id, 'pendiente', 'alta', '2026-09-10', '2026-09-22'], ['Documentación', 'Manual de instalación y operación.', users[3]?.id, 'pendiente', 'baja', '2026-09-12', '2026-09-26']];
    const adminId = (await pool.query("SELECT id FROM users WHERE username = 'admin'")).rows[0].id;
    for (const task of tasks) await pool.query('INSERT INTO tasks (project_id, organization_id, creator_id, title, description, assigned_to, status, priority, start_date, due_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [projectId, organization.id, adminId, ...task]);
  }
  console.log('Datos de prueba cargados en PostgreSQL.');
}

if (require.main === module) {
  seed().catch(error => { console.error('No fue posible cargar PostgreSQL:', error.message); process.exitCode = 1; }).finally(() => pool.end());
}

module.exports = { seed };
