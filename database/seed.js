const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');

const database = new Database(path.join(__dirname, 'haitani.db'));
const password = bcrypt.hashSync('admin123', 12);
const addUser = database.prepare(`INSERT OR IGNORE INTO users (name, username, email, password, role, github_username) VALUES (?, ?, ?, ?, ?, ?)`);
addUser.run('Administrador Haitani', 'admin', 'admin@haitani.local', password, 'admin', null);
[
  ['Ana', 'ana', 'ana@haitani.local', 'ana-dev'],
  ['Carlos', 'carlos', 'carlos@haitani.local', ''],
  ['María', 'maria', 'maria@haitani.local', ''],
  ['Luis', 'luis', 'luis@haitani.local', '']
].forEach(([name, username, email, github]) => addUser.run(name, username, email, password, 'member', github || null));

const project = database.prepare('SELECT id FROM projects WHERE name = ?').get('Sakura Coffee');
const projectId = project ? project.id : database.prepare(`INSERT INTO projects (name, description) VALUES (?, ?)`).run('Sakura Coffee', 'Aplicación web desarrollada por el equipo.').lastInsertRowid;
const taskCount = database.prepare('SELECT COUNT(*) AS count FROM tasks').get().count;
if (!taskCount) {
  const users = database.prepare("SELECT id FROM users WHERE role = 'member' ORDER BY id").all();
  const addTask = database.prepare(`INSERT INTO tasks (project_id, title, description, assigned_to, status, priority, start_date, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  [
    ['Diseño de interfaz', 'Definir pantallas principales de Haitani.', users[0]?.id, 'en_proceso', 'alta', '2026-09-01', '2026-09-12'],
    ['Sistema de login', 'Autenticación y control de roles.', users[1]?.id, 'completada', 'alta', '2026-08-25', '2026-09-08'],
    ['Base de datos', 'Modelo SQLite para la operación del equipo.', users[2]?.id, 'completada', 'media', '2026-08-26', '2026-09-10'],
    ['Desarrollo del backend', 'API REST y reglas de negocio.', users[1]?.id, 'pendiente', 'alta', '2026-09-10', '2026-09-22'],
    ['Documentación', 'Manual de instalación y operación.', users[3]?.id, 'pendiente', 'baja', '2026-09-12', '2026-09-26']
  ].forEach(task => addTask.run(projectId, ...task));
}
database.close();
console.log('Datos de prueba cargados. Usuario admin: admin / admin123');