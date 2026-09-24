/**
 * backup_db.js
 *
 * Backup "logico" de la base de datos PostgreSQL del proyecto Haitani,
 * usando el mismo paquete "pg" que ya usa el proyecto (server/database.js).
 * No requiere instalar pg_dump ni herramientas externas: solo Node.js.
 *
 * Exporta todas las tablas del esquema "public" a un unico archivo JSON,
 * con la estructura:
 *   {
 *     "_meta": { "database": "...", "generatedAt": "..." },
 *     "nombre_tabla": [ {fila1}, {fila2}, ... ],
 *     ...
 *   }
 *
 * USO (desde la raiz del proyecto, donde esta el .env):
 *   node backup_db.js
 *   node backup_db.js --env=".env" --out="backups"
 *
 * Para restaurarlo despues necesitarias un script complementario que lea
 * el JSON e inserte los datos (dimelo si lo quieres, te lo preparo).
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// --- Leer argumentos simples --env= y --out= ---
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    return [key, value ?? true];
  })
);

const envPath = args.env || '.env';
const outDir = args.out || 'backups';

if (!fs.existsSync(envPath)) {
  console.error(`No se encontro el archivo .env en: ${envPath}`);
  console.error('Indica la ruta correcta con --env="C:\\ruta\\a\\.env"');
  process.exit(1);
}

require('dotenv').config({ path: envPath });

// Misma logica de conexion que server/database.js
const connectionString =
  process.env.DATABASE_URL ||
  (process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER && process.env.PGPASSWORD
    ? `postgresql://${process.env.PGUSER}:${encodeURIComponent(process.env.PGPASSWORD)}@${process.env.PGHOST}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE}`
    : undefined);

if (!connectionString) {
  console.error('No se encontraron credenciales de base de datos en el .env.');
  console.error('Se requiere DATABASE_URL, o bien PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('Conectado a la base de datos. Listando tablas...');

    const { rows: tables } = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    if (tables.length === 0) {
      console.warn('No se encontraron tablas en el esquema "public".');
    }

    const backup = {
      _meta: {
        database: process.env.PGDATABASE || '(desde DATABASE_URL)',
        generatedAt: new Date().toISOString(),
        tableCount: tables.length
      }
    };

    for (const { table_name: tableName } of tables) {
      process.stdout.write(`  - Exportando "${tableName}"... `);
      // Nombre de tabla viene de information_schema, no de input externo,
      // pero igual se sanea con comillas dobles por seguridad.
      const safeName = tableName.replace(/"/g, '""');
      const { rows } = await client.query(`SELECT * FROM "${safeName}";`);
      backup[tableName] = rows;
      console.log(`${rows.length} filas`);
    }

    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outFile = path.join(outDir, `${backup._meta.database}_backup_${timestamp}.json`);

    fs.writeFileSync(outFile, JSON.stringify(backup, null, 2), 'utf8');

    console.log('');
    console.log(`Backup completado: ${outFile}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Error durante el backup:', err.message);
  process.exit(1);
});
