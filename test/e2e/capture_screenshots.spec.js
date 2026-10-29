const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const dimensions = [
  { name: 'desktop_1440x900', width: 1440, height: 900 },
  { name: 'laptop_1280x720', width: 1280, height: 720 },
  { name: 'tablet_768x1024', width: 768, height: 1024 },
  { name: 'mobile_390x844', width: 390, height: 844 }
];

async function acceptPrivacyNotice(page) {
  const acceptButton = page.getByRole('button', { name: 'He leído y acepto' });
  try {
    await acceptButton.waitFor({ state: 'visible', timeout: 3000 });
    await acceptButton.click();
    await expect(page.locator('#privacy-notice')).toHaveCount(0);
  } catch {}
}

async function loginAsAdmin(page) {
  await page.goto('/#/login', { waitUntil: 'domcontentloaded' });
  await acceptPrivacyNotice(page);

  await page.fill('input[name="username"]', 'admin_test');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  await page.waitForURL(/#\/(admin|dashboard)/, { timeout: 10000 });
  await expect(page.locator('.topbar')).toBeVisible({ timeout: 10000 });
}

async function navigateTo(page, hash) {
  await page.evaluate(h => {
    if (location.hash === h) {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } else {
      location.hash = h;
    }
  }, hash);
  await page.waitForTimeout(300);
}

test.describe('Captura comparativa de interfaces de mensajería', () => {
  for (const dim of dimensions) {
    test(`Captura "before" en ${dim.name} (${dim.width}x${dim.height})`, async ({ page }) => {
      await page.setViewportSize({ width: dim.width, height: dim.height });
      await loginAsAdmin(page);
      await navigateTo(page, '#/admin/messages?user=102');

      await expect(page.locator('.messages-layout')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);

      const dir = path.join(__dirname, '../screenshots/before');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: path.join(dir, `${dim.name}.png`), fullPage: false });
    });
  }
});
