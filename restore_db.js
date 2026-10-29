/**
 * restore_db.js
 *
 * Script de restauracion y migracion para la base de datos PostgreSQL de Haitani.
 * Disenado para restaurar backups generados por backup_db.js hacia cualquier
 * entorno PostgreSQL (local, Render, Neon, Supabase, VPS, etc.).
 *
 * CARACTERISTICAS PRINCIPALES:
 * 1. Inicializacion automatica del esquema: invoca database/init.js para crear tablas,
 *    indices y constraints base si no existen.
 * 2. Soporte para connect-pg-simple: crea la tabla 'user_sessions' si no esta creada.
 * 3. Manejo de Foreign Keys y dependencias circulares:
 *    - Deshabilita temporalmente constraints de clave foranea antes de truncar e insertar.
 *    - Reestablece y valida las restricciones al concluir la restauracion.
 * 4. Normalizacion de tipos:
 *    - Decodifica objetos binarios (BYTEA) guardados como Buffer JSON (imagenes, assets, adjuntos).
 *    - Corrige y sanitiza fechas ISO con anomalias de prefijo (ej: "+092026-08-19").
 * 5. Sincronizacion de secuencias autonumericas:
 *    - Ajusta el valor maximo de setval() para secuencias SERIAL/BIGSERIAL en todas las tablas
 *      para evitar errores de colision de IDs en futuras inserciones.
 * 6. Soporte SSL flexible:
 *    - Acepta conexiones remotas con SSL (requerido para Supabase / Render / Neon).
 *
 * REQUISITOS PREVIOS:
 * - Tener configurado el archivo de variables de entorno (.env o el indicado en --env)
 *   con DATABASE_URL valida o credenciales equivalentes (PGHOST, PGDATABASE, PGUSER, PGPASSWORD).
 * - Archivo de backup JSON valido en backups/ o ruta personalizada en --file.
 *
 * FORMAS DE USO:
 *   # 1. Restaurar el backup mas reciente encontrado en la carpeta backups/:
 *   node restore_db.js
 *   npm run db:restore
 *
 *   # 2. Restaurar un archivo de backup especifico:
 *   node restore_db.js --file="backups/haitani_backup_2026-09-25T05-10-30-612Z.json"
 *
 *   # 3. Usar un archivo de entorno diferente (por ejemplo, para migrar a Supabase o Staging):
 *   node restore_db.js --env=".env.supabase" --file="backups/mi_backup.json"
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// ---------------------------------------------------------------------------
// 1. Parseo de argumentos de linea de comandos (--file= y --env=)
// ---------------------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    return [key, value ?? true];
  })
);

const envPath = args.env || '.env';
let backupFile = args.file;

// Si no se proporciono archivo por parametro, detectar el mas reciente en backups/
if (!backupFile) {
  const backupsDir = path.join(__dirname, 'backups');
  if (fs.existsSync(backupsDir)) {
    const files = fs
      .readdirSync(backupsDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse();
    if (files.length > 0) {
      backupFile = path.join(backupsDir, files[0]);
    }
  }
}

if (!backupFile || !fs.existsSync(backupFile)) {
  console.error('Error: No se encontro el archivo de backup especificado.');
  console.error('Uso: node restore_db.js [--file="backups/archivo.json"] [--env=".env"]');
  process.exit(1);
}

if (!fs.existsSync(envPath)) {
  console.error(`Error: No se encontro el archivo de entorno en: ${envPath}`);
  process.exit(1);
}

require('dotenv').config({ path: envPath });

// ---------------------------------------------------------------------------
// 2. Configuracion del Pool de conexion PostgreSQL
// ---------------------------------------------------------------------------
const connectionString =
  process.env.DATABASE_URL ||
  (process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER && process.env.PGPASSWORD
    ? `postgresql://${process.env.PGUSER}:${encodeURIComponent(process.env.PGPASSWORD)}@${process.env.PGHOST}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE}`
    : undefined);

if (!connectionString) {
  console.error('Error: No se encontraron credenciales de base de datos en el archivo de entorno.');
  console.error('Define DATABASE_URL o las variables PGHOST, PGDATABASE, PGUSER y PGPASSWORD.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

// ---------------------------------------------------------------------------
// 3. Orden preferencial de tablas para restauracion
// ---------------------------------------------------------------------------
const INSERT_ORDER = [
  'plans',
  'organizations',
  'roles',
  'users',
  'stored_assets',
  'files',
  'projects',
  'project_members',
  'tasks',
  'activities',
  'comments',
  'github_configurations',
  'github_project_configurations',
  'chat_groups',
  'chat_group_members',
  'messages',
  'conversation_deletions',
  'calls',
  'absences',
  'incidences',
  'announcements',
  'blocked_ips',
  'security_events',
  'user_sessions'
];

/**
 * Normaliza los valores leidos del backup JSON antes de enviarlos a PostgreSQL.
 * - Convierte estructuras { type: 'Buffer', data: [...] } a Buffer nativo de Node.js.
 * - Corrige fechas malformadas con prefijo de anomalia de anio.
 * - Serializa objetos JSON a strings para campos JSON/JSONB.
 */
function formatValue(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object' && val.type === 'Buffer' && Array.isArray(val.data)) {
    return Buffer.from(val.data);
  }
  if (typeof val === 'object' && !(val instanceof Date)) {
    return JSON.stringify(val);
  }
  if (typeof val === 'string') {
    // Normalizar fechas con anomalias de prefijo como "+092026-08-19"
    if (/^\+\d{2}(\d{4}-\d{2}-\d{2}.*)$/.test(val)) {
      return val.replace(/^\+\d{2}/, '');
    }
  }
  return val;
}

// ---------------------------------------------------------------------------
// 4. Proceso principal de restauracion
// ---------------------------------------------------------------------------
async function restore() {
  console.log(`Leyendo backup: ${backupFile}...`);
  const rawData = fs.readFileSync(backupFile, 'utf8');
  const backup = JSON.parse(rawData);

  console.log(`Conectando a la base de datos de destino...`);
  const client = await pool.connect();

  try {
    // 4.1. Asegurar esquema ejecutando database/init.js
    console.log('Inicializando esquema de tablas...');
    const { init } = require('./database/init');
    await init();

    // 4.2. Asegurar existencia de la tabla de sesiones (connect-pg-simple)
    await client.query(`
      CREATE TABLE IF NOT EXISTS "user_sessions" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("sid")
      );
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "user_sessions" ("expire");
    `);

    // 4.3. Desactivar temporalmente Foreign Keys para permitir truncado y carga limpia
    console.log('Desactivando temporalmente Foreign Keys...');
    const fkQuery = `
      SELECT conname, conrelid::regclass::text AS tablename, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE contype = 'f' AND connamespace = 'public'::regnamespace;
    `;
    const { rows: fks } = await client.query(fkQuery);
    for (const fk of fks) {
      await client.query(`ALTER TABLE ${fk.tablename} DROP CONSTRAINT IF EXISTS "${fk.conname}";`);
    }

    // 4.4. Limpiar tablas existentes antes de poblar datos
    console.log('Limpiando tablas existentes...');
    const tablesToRestore = Object.keys(backup).filter((k) => k !== '_meta');
    const orderedTables = [
      ...INSERT_ORDER.filter((t) => tablesToRestore.includes(t)),
      ...tablesToRestore.filter((t) => !INSERT_ORDER.includes(t))
    ];

    for (const tableName of orderedTables) {
      try {
        await client.query(`TRUNCATE TABLE "${tableName.replace(/"/g, '""')}" CASCADE;`);
      } catch (e) {
        // Ignorar si la tabla no existe en este esquema
      }
    }

    // 4.5. Cargar registros por lotes (batching de 100 en 100)
    console.log('Iniciando carga de datos...');
    for (const tableName of orderedTables) {
      const rows = backup[tableName];
      if (!rows || rows.length === 0) {
        console.log(`- Tabla "${tableName}": 0 registros (omitida)`);
        continue;
      }

      const safeTableName = `"${tableName.replace(/"/g, '""')}"`;
      process.stdout.write(`- Restaurando "${tableName}" (${rows.length} registros)... `);

      const columns = Object.keys(rows[0]);
      const quotedCols = columns.map((col) => `"${col.replace(/"/g, '""')}"`).join(', ');

      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const valueClauses = [];
        const params = [];

        batch.forEach((row, rowIndex) => {
          const rowPlaceholders = columns.map((col, colIndex) => {
            const paramIdx = rowIndex * columns.length + colIndex + 1;
            params.push(formatValue(row[col]));
            return `$${paramIdx}`;
          });
          valueClauses.push(`(${rowPlaceholders.join(', ')})`);
        });

        const insertQuery = `INSERT INTO ${safeTableName} (${quotedCols}) VALUES ${valueClauses.join(', ')};`;
        await client.query(insertQuery, params);
      }

      // 4.6. Sincronizar secuencias autonumericas (SERIAL / BIGSERIAL)
      try {
        const seqRes = await client.query(`SELECT pg_get_serial_sequence('${tableName}', 'id') as seq;`);
        const seq = seqRes.rows[0]?.seq;
        if (seq) {
          const maxRes = await client.query(`SELECT MAX(id) as max_id FROM ${safeTableName};`);
          const maxId = maxRes.rows[0]?.max_id;
          if (maxId !== null && maxId !== undefined) {
            await client.query(`SELECT setval($1, $2);`, [seq, Number(maxId)]);
          }
        }
      } catch (e) {
        // Tablas intermedias o compuestas pueden no tener columna serial 'id'
      }

      console.log('OK');
    }

    // 4.7. Reconstruir restricciones y validaciones de Foreign Keys
    console.log('Restableciendo constraints e indices...');
    for (const fk of fks) {
      try {
        await client.query(`ALTER TABLE ${fk.tablename} ADD CONSTRAINT "${fk.conname}" ${fk.def};`);
      } catch (e) {
        // Ignorar si ya fue anadida o no aplica
      }
    }
    console.log('\nRestauracion completada con exito.');
  } catch (err) {
    console.error('\nError durante la restauracion:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

restore().catch((err) => {
  console.error('Fallo el proceso:', err.message);
  process.exit(1);
});
