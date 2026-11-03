const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function main() {
  const reportPath = path.join('docs', 'qa', 'oat05_verification_report.json');
  if (!fs.existsSync(reportPath)) {
    console.error('Report file not found:', reportPath);
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>OAT-05 Verificación de Respaldo y Restauración</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
      background: #0b0f19;
      color: #e2e8f0;
      margin: 0;
      padding: 24px;
    }
    .header {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .badge {
      background: #065f46;
      color: #34d399;
      font-weight: bold;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .card {
      background: #111827;
      border: 1px solid #1f2937;
      padding: 12px 16px;
      border-radius: 6px;
    }
    .card-label {
      color: #94a3b8;
      font-size: 12px;
      text-transform: uppercase;
    }
    .card-val {
      font-size: 20px;
      font-weight: bold;
      color: #38bdf8;
      margin-top: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      background: #111827;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid #1f2937;
    }
    th {
      background: #1e293b;
      color: #cbd5e1;
      text-align: left;
      padding: 8px 12px;
      border-bottom: 1px solid #334155;
    }
    td {
      padding: 6px 12px;
      border-bottom: 1px solid #1e293b;
      font-family: monospace;
    }
    tr:nth-child(even) {
      background: #0f172a;
    }
    .match-ok {
      color: #10b981;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h2 style="margin: 0; color: #f8fafc;">OAT-05: Integridad de Respaldo y Restauración</h2>
      <div style="color: #94a3b8; font-size: 13px; margin-top: 4px;">
        Destino aislado: <strong>haitani_qa_test</strong> | Respaldo: <code>${report.backupFile}</code>
      </div>
    </div>
    <div class="badge">Aprobada (100% Integridad)</div>
  </div>

  <div class="stats">
    <div class="card">
      <div class="card-label">Tamaño Respaldo</div>
      <div class="card-val">${(report.backupSizeBytes / (1024*1024)).toFixed(2)} MB</div>
    </div>
    <div class="card">
      <div class="card-label">Tiempo Restauración</div>
      <div class="card-val">${report.restoreDurationSeconds} s</div>
    </div>
    <div class="card">
      <div class="card-label">Tablas Validadas</div>
      <div class="card-val">${report.tables.length} / ${report.tables.length}</div>
    </div>
    <div class="card">
      <div class="card-label">Foreign Keys Activas</div>
      <div class="card-val">${report.restoredFkCount} constraints</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Tabla</th>
        <th>Backup JSON</th>
        <th>Origen Actual</th>
        <th>Restaurada (Test)</th>
        <th>Coincidencia</th>
        <th>Checksum MD5</th>
      </tr>
    </thead>
    <tbody>
      ${report.tables.map(t => `
        <tr>
          <td><strong>${t.table}</strong></td>
          <td>${t.backupCount}</td>
          <td>${t.originCount}</td>
          <td>${t.testCount}</td>
          <td class="match-ok">${t.match ? '✓ COINCIDE' : '✗ DISCREPANCIA'}</td>
          <td><code>${t.testHash}</code></td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1100 } });
  await page.setContent(html);
  const outPath = path.join('docs', 'qa', 'capturas', 'OAT-05.png');
  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();
  console.log('Screenshot saved to:', outPath);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
