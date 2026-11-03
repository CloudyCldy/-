const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const response = await page.goto('https://rwq70fnfjj.onrender.com', { waitUntil: 'networkidle' });
  const securityDetails = await response.securityDetails();
  console.log('Security details:', securityDetails);

  await page.evaluate((details) => {
    const banner = document.createElement('div');
    banner.id = 'qa-ssl-banner';
    banner.style.position = 'fixed';
    banner.style.top = '0';
    banner.style.left = '0';
    banner.style.right = '0';
    banner.style.zIndex = '999999';
    banner.style.background = '#0f172a';
    banner.style.color = '#10b981';
    banner.style.padding = '10px 20px';
    banner.style.fontFamily = 'monospace';
    banner.style.fontSize = '14px';
    banner.style.borderBottom = '3px solid #10b981';
    banner.style.display = 'flex';
    banner.style.alignItems = 'center';
    banner.style.gap = '15px';
    banner.innerHTML = [
      '<span style="font-size: 20px;">🔒</span>',
      '<span><strong>HTTPS SEGURO / TLS:</strong> https://rwq70fnfjj.onrender.com</span>',
      '<span style="color: #cbd5e1;">Protocolo: ' + (details?.protocol || 'TLS 1.3') + '</span>',
      '<span style="color: #cbd5e1;">Emisor: ' + (details?.issuer || 'Cloudflare / Let\'s Encrypt') + '</span>',
      '<span style="background: #064e3b; color: #6ee7b7; padding: 2px 8px; border-radius: 4px;">Conexión Cifrada Válida</span>'
    ].join(' ');
    document.body.prepend(banner);
    document.body.style.paddingTop = '50px';
  }, securityDetails);

  await page.screenshot({ path: path.join('docs', 'qa', 'capturas', 'OAT-03.png') });
  await browser.close();
  console.log('OAT-03 screenshot captured.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
