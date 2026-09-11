const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || (
  process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER && process.env.PGPASSWORD
    ? `postgresql://${process.env.PGUSER}:${encodeURIComponent(process.env.PGPASSWORD)}@${process.env.PGHOST}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE}`
    : undefined
);

const pool = new Pool({
  connectionString,
  host: process.env.PGHOST,
  port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined
});

function prepare(text) {
  let index = 0;
  const query = text.replace(/\?/g, () => `$${++index}`);
  return {
    async get(...params) {
      const result = await pool.query(query, params);
      return result.rows[0];
    },
    async all(...params) {
      const result = await pool.query(query, params);
      return result.rows;
    },
    async run(...params) {
      const result = await pool.query(query, params);
      return { changes: result.rowCount, lastInsertRowid: result.rows[0]?.id };
    }
  };
}

async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work({ query: (text, params) => client.query(text, params) });
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { prepare, pool, transaction };