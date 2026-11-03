require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const res = await pool.query("SELECT id, username, password FROM users WHERE username IN ('admin', 'carlos', 'ana', 'maria', 'luis')");
  console.log('Found users:', res.rows.map(r => r.username));
  const candidates = ['admin123', 'admin', 'password', 'password123', '123456', 'Haitani2026!', 'PruebaUAT2026!', 'carlos123', 'sakura123'];
  for (const u of res.rows) {
    for (const c of candidates) {
      if (bcrypt.compareSync(c, u.password)) {
        console.log('Match found for', u.username, '->', c);
      }
    }
  }
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
