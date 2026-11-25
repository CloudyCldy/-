require('dotenv').config();
const { Pool } = require('pg');

const connectionString = (process.env.NODE_ENV === 'test' && process.env.TEST_DATABASE_URL)
  ? process.env.TEST_DATABASE_URL
  : (process.env.DATABASE_URL || process.env.TEST_DATABASE_URL);

const isLocalhost = connectionString && (connectionString.includes('localhost') || connectionString.includes('127.0.0.1'));
const sslConfig = isLocalhost || process.env.PGSSLMODE === 'disable'
  ? undefined
  : { rejectUnauthorized: false };

const pool = connectionString
  ? new Pool({
      connectionString,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 20,
      ...(sslConfig ? { ssl: sslConfig } : {})
    })
  : new Pool({
      host: process.env.PGHOST,
      port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 20,
      ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined
    });

pool.on('error', (err) => {
  console.error('Error imprevisto en cliente inactivo de PostgreSQL:', err.message);
});

function replaceSqlPlaceholders(text) {
  let index = 0;
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;
  let result = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inString) {
      if (char === "'") {
        if (nextChar === "'") {
          result += "''";
          i++;
          continue;
        }
        inString = false;
      }
      result += char;
    } else if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
      }
      result += char;
    } else if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        result += '*/';
        i++;
        continue;
      }
      result += char;
    } else {
      if (char === "'") {
        inString = true;
        result += char;
      } else if (char === '-' && nextChar === '-') {
        inLineComment = true;
        result += '--';
        i++;
      } else if (char === '/' && nextChar === '*') {
        inBlockComment = true;
        result += '/*';
        i++;
      } else if (char === '?') {
        result += `$${++index}`;
      } else {
        result += char;
      }
    }
  }
  return result;
}

function prepare(text) {
  const query = replaceSqlPlaceholders(text);
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

module.exports = { prepare, pool, transaction, replaceSqlPlaceholders };