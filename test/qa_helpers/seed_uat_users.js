require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function seedUatUsers() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    const passwordHash = await bcrypt.hash('PruebaUAT2026!', 10);

    // Ensure Org 1 (Haitani / Sakura Coffee) exists and is active
    let org1 = (await pool.query("SELECT id FROM organizations WHERE slug = 'haitani' OR id = 1 LIMIT 1")).rows[0];
    if (!org1) {
      const res = await pool.query(
        "INSERT INTO organizations (name, slug, email, status) VALUES ('Sakura Coffee', 'haitani', 'contacto@sakuracoffee.test', 'active') RETURNING id"
      );
      org1 = res.rows[0];
    } else {
      await pool.query("UPDATE organizations SET status = 'active' WHERE id = $1", [org1.id]);
    }

    // Ensure Org 2 (Empresa Beta) exists and is active
    let org2 = (await pool.query("SELECT id FROM organizations WHERE slug = 'empresa-beta' LIMIT 1")).rows[0];
    if (!org2) {
      const res = await pool.query(
        "INSERT INTO organizations (name, slug, email, status) VALUES ('Empresa Beta', 'empresa-beta', 'contacto@empresabeta.test', 'active') RETURNING id"
      );
      org2 = res.rows[0];
    } else {
      await pool.query("UPDATE organizations SET status = 'active' WHERE id = $1", [org2.id]);
    }

    // Ensure Roles exist
    const rolesList = ['admin', 'project_manager', 'member', 'viewer', 'company_admin', 'platform_admin'];
    for (const r of rolesList) {
      await pool.query("INSERT INTO roles (name, description) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING", [r, `Rol ${r}`]);
    }

    // Test users to seed
    const users = [
      { name: 'Carlos Administrador', username: 'admin_sakura', email: 'admin@sakuracoffee.test', role: 'admin', orgId: org1.id },
      { name: 'Mariana Project Manager', username: 'pm_mariana', email: 'mariana.pm@sakuracoffee.test', role: 'project_manager', orgId: org1.id },
      { name: 'Valeria Gómez', username: 'valeria', email: 'valeria@sakuracoffee.test', role: 'member', orgId: org1.id },
      { name: 'Carlos Mendoza', username: 'carlos', email: 'carlos@sakuracoffee.test', role: 'member', orgId: org1.id },
      { name: 'Roberto Observador', username: 'viewer_roberto', email: 'roberto.viewer@sakuracoffee.test', role: 'viewer', orgId: org1.id },
      { name: 'Rodrigo Rival', username: 'admin_beta', email: 'admin@empresabeta.test', role: 'admin', orgId: org2.id },
      { name: 'Sandra Beta', username: 'sandra_beta', email: 'sandra@empresabeta.test', role: 'member', orgId: org2.id }
    ];

    for (const u of users) {
      await pool.query(
        `INSERT INTO users (name, username, email, password, role, role_id, organization_id, active, email_verified)
         VALUES ($1, $2, $3, $4, $5, (SELECT id FROM roles WHERE name = $5 LIMIT 1), $6, 1, true)
         ON CONFLICT (username) DO UPDATE
         SET name = EXCLUDED.name, email = EXCLUDED.email, password = EXCLUDED.password,
             role = EXCLUDED.role, role_id = EXCLUDED.role_id, organization_id = EXCLUDED.organization_id,
             active = 1, email_verified = true`,
        [u.name, u.username, u.email, passwordHash, u.role, u.orgId]
      );
      console.log(`Usuario de prueba asegurado: ${u.username} (${u.role}) en Org ${u.orgId}`);
    }

    console.log('Todos los usuarios de prueba fueron creados/actualizados exitosamente.');
  } finally {
    await pool.end();
  }
}

seedUatUsers().catch(err => {
  console.error('Error al asegurar usuarios de prueba:', err);
  process.exit(1);
});
