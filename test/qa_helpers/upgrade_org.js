require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pool.query("UPDATE organizations SET plan_id = 3, subscription_status = 'active' WHERE id = 1");
  await pool.query("DELETE FROM projects WHERE id IN (130, 131, 132)");
  console.log('Org 1 upgraded to plan 3 (unlimited) and test projects cleaned up.');
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
