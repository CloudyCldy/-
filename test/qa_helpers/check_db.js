require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const u = new URL(process.env.DATABASE_URL);
  // Supabase direct connection is usually db.<ref>.supabase.co:5432
  // Or pooler in session mode (port 5432 on aws-0-us-west-2.pooler.supabase.com)
  const sessionUrl = process.env.DATABASE_URL.replace(':6543/', ':5432/');
  console.log('Testing session connection on port 5432...');
  const client = new Client({ connectionString: sessionUrl, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('Connected to port 5432 successfully!');
    await client.query('CREATE DATABASE haitani_qa_test');
    console.log('Database haitani_qa_test created successfully!');
  } catch (err) {
    console.error('Port 5432 error:', err.message);
  } finally {
    try { await client.end(); } catch {}
  }
}

main();
