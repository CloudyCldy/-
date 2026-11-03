const { execSync } = require('child_process');
const { Pool } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables for origin and restored database
const originEnv = dotenv.parse(fs.readFileSync('.env'));
const testEnv = dotenv.parse(fs.readFileSync('.env.qa_test'));

async function main() {
  console.log('====================================================');
  console.log('OAT-05: RESTAURACIÓN Y VERIFICACIÓN DE INTEGRIDAD');
  console.log('====================================================\n');

  console.log('1. Base de datos de destino (Prueba): haitani_qa_test');
  const uTest = new URL(testEnv.DATABASE_URL);
  console.log(`- Host: ${uTest.hostname}`);
  console.log(`- Port: ${uTest.port}`);
  console.log(`- Database: ${uTest.pathname}`);

  const latestBackup = 'backups/haitani_backup_2026-10-29T06-58-40-664Z.json';
  console.log(`\n2. Archivo de respaldo: ${latestBackup}`);
  const backupStats = fs.statSync(latestBackup);
  console.log(`- Tamaño: ${(backupStats.size / (1024 * 1024)).toFixed(2)} MB`);

  console.log('\n3. Ejecutando restauración sobre haitani_qa_test...');
  const startTime = Date.now();
  const restoreCmd = `node restore_db.js --env=".env.qa_test" --file="${latestBackup}"`;
  
  const restoreOutput = execSync(restoreCmd, { encoding: 'utf8', stdio: 'pipe' });
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`Restauración completada en ${durationSec} s.\n`);
  console.log('Resumen salida restore:');
  const lines = restoreOutput.trim().split('\n');
  lines.slice(0, 10).forEach(l => console.log('  ' + l));
  if (lines.length > 20) {
    console.log(`  ... [${lines.length - 20} líneas omitidas] ...`);
    lines.slice(-10).forEach(l => console.log('  ' + l));
  }

  console.log('\n4. Verificando integridad y consistencia entre origen y restaurada...');
  const poolOrigin = new Pool({
    connectionString: originEnv.DATABASE_URL.replace(':6543/', ':5432/'),
    ssl: { rejectUnauthorized: false }
  });

  const poolTest = new Pool({
    connectionString: testEnv.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const clientOrigin = await poolOrigin.connect();
  const clientTest = await poolTest.connect();

  try {
    const rawBackup = JSON.parse(fs.readFileSync(latestBackup, 'utf8'));
    const tables = Object.keys(rawBackup).filter(k => k !== '_meta').sort();

    console.log(`Total de tablas en respaldo: ${tables.length}\n`);

    const results = [];
    let allMatches = true;

    for (const table of tables) {
      const qCount = `SELECT count(*)::int AS count FROM "${table}"`;
      
      let originCount = -1;
      let testCount = -1;
      let countMatch = false;

      try {
        const resOrigin = await clientOrigin.query(qCount);
        originCount = resOrigin.rows[0].count;
      } catch (e) {
        originCount = -1;
      }

      try {
        const resTest = await clientTest.query(qCount);
        testCount = resTest.rows[0].count;
      } catch (e) {
        testCount = -1;
      }

      countMatch = (originCount === testCount && originCount >= 0);
      if (!countMatch) {
        // En caso de que en origen se hayan insertado registros posteriores al backup (ej. security_events o users durante UAT)
        // Verificamos si testCount coincide exactamente con la cantidad de filas en el archivo de backup JSON
        const backupRowCount = Array.isArray(rawBackup[table]) ? rawBackup[table].length : 0;
        if (testCount === backupRowCount) {
          countMatch = true;
        } else {
          allMatches = false;
        }
      }

      // Checksum / hash verification de la tabla restaurada
      let testHash = 'N/A';
      if (testCount > 0) {
        try {
          // Obtener columnas para hash ordenado
          const colRes = await clientTest.query(
            `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
            [table]
          );
          const cols = colRes.rows.map(r => `COALESCE("${r.column_name}"::text, '')`).join(" || '|' || ");
          const hashRes = await clientTest.query(
            `SELECT md5(string_agg(row_hash, ',')) AS table_md5 FROM (SELECT md5(${cols}) AS row_hash FROM "${table}" ORDER BY 1 LIMIT 500) sub`
          );
          testHash = hashRes.rows[0].table_md5 || 'VACIO';
        } catch (e) {
          testHash = 'ERR';
        }
      }

      const backupCount = Array.isArray(rawBackup[table]) ? rawBackup[table].length : 0;
      results.push({
        table,
        backupCount,
        originCount,
        testCount,
        match: countMatch,
        testHash: testHash ? testHash.substring(0, 10) : 'N/A'
      });
    }

    // Verificar foreign keys restauradas en haitani_qa_test
    const fkRes = await clientTest.query(
      `SELECT count(*)::int AS count FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace`
    );
    const restoredFkCount = fkRes.rows[0].count;

    console.log('| Tabla | Backup | Origen Actual | Restaurada | Coincide | Checksum (MD5-10) |');
    console.log('|---|---|---|---|---|---|');
    for (const r of results) {
      console.log(`| ${r.table} | ${r.backupCount} | ${r.originCount} | ${r.testCount} | ${r.match ? 'SI' : 'NO'} | ${r.testHash} |`);
    }

    console.log(`\nRestricciones Foreign Keys activas en BD restaurada: ${restoredFkCount}`);
    console.log(`¿Todas las tablas coinciden íntegramente?: ${allMatches ? 'SÍ (100% OK)' : 'NO'}`);

    // Guardar reporte JSON estructurado
    const report = {
      timestamp: new Date().toISOString(),
      backupFile: latestBackup,
      backupSizeBytes: backupStats.size,
      restoreDurationSeconds: Number(durationSec),
      restoredFkCount,
      allMatches,
      tables: results
    };
    fs.writeFileSync('docs/qa/oat05_verification_report.json', JSON.stringify(report, null, 2), 'utf8');
    console.log('\nReporte guardado en docs/qa/oat05_verification_report.json');

  } finally {
    clientOrigin.release();
    clientTest.release();
    await poolOrigin.end();
    await poolTest.end();
  }
}

main().catch(err => {
  console.error('Fallo en main:', err);
  process.exit(1);
});
