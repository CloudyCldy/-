const { chromium, firefox, webkit } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const URL = 'https://rwq70fnfjj.onrender.com';

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 }
];

const browsers = [
  { name: 'chromium', engine: chromium },
  { name: 'firefox', engine: firefox },
  { name: 'webkit', engine: webkit }
];

async function run() {
  const results = [];
  const outDir = path.join('docs', 'qa', 'capturas');
  fs.mkdirSync(outDir, { recursive: true });

  for (const b of browsers) {
    console.log(`Testing browser engine: ${b.name}...`);
    let browserInstance;
    try {
      browserInstance = await b.engine.launch({ headless: true });
    } catch (err) {
      console.error(`Failed to launch ${b.name}:`, err.message);
      results.push({ browser: b.name, status: 'ERROR', error: err.message });
      continue;
    }

    for (const vp of viewports) {
      console.log(`  Viewport: ${vp.name} (${vp.width}x${vp.height})...`);
      const context = await browserInstance.newContext({
        viewport: { width: vp.width, height: vp.height },
        userAgent: vp.name === 'mobile'
          ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
          : undefined
      });
      const page = await context.newPage();
      try {
        const start = Date.now();
        const res = await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
        const duration = Date.now() - start;
        const status = res.status();
        const title = await page.title();
        const filename = `OAT-10-${b.name}-${vp.name}.png`;
        const filePath = path.join(outDir, filename);
        await page.screenshot({ path: filePath, fullPage: false });

        results.push({
          browser: b.name,
          viewport: `${vp.name} (${vp.width}x${vp.height})`,
          status,
          title,
          durationMs: duration,
          screenshot: filename
        });
        console.log(`    OK: HTTP ${status}, title: "${title}", ${duration}ms -> ${filename}`);
      } catch (err) {
        console.error(`    FAILED for ${b.name} ${vp.name}:`, err.message);
        results.push({
          browser: b.name,
          viewport: `${vp.name} (${vp.width}x${vp.height})`,
          status: 'FAIL',
          error: err.message
        });
      } finally {
        await context.close();
      }
    }
    await browserInstance.close();
  }

  // Create primary OAT-10.png copy (Chromium Desktop or Mobile)
  const defaultCapture = path.join(outDir, 'OAT-10-chromium-desktop.png');
  const mainTarget = path.join(outDir, 'OAT-10.png');
  if (fs.existsSync(defaultCapture)) {
    fs.copyFileSync(defaultCapture, mainTarget);
  }

  console.log('\n--- COMPATIBILITY RESULTS ---');
  console.table(results);
}

run().catch(err => {
  console.error('Fatal in compatibility run:', err);
  process.exit(1);
});
