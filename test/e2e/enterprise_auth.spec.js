const { test, expect } = require('@playwright/test');

const origin = 'http://127.0.0.1:4173';
const browserErrors = new WeakMap();

test.beforeEach(async ({ page }) => {
  const errors = [];
  browserErrors.set(page, errors);
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && message.location().url.startsWith(origin) &&
        !message.text().includes('401 (Unauthorized)') &&
        !message.text().includes('403 (Forbidden)')) {
      errors.push(`Browser console error: ${message.text()}`);
    }
  });
  page.on('requestfailed', request => {
    if (request.url().startsWith(origin)) {
      errors.push(`Local request failed: ${request.url()} (${request.failure()?.errorText})`);
    }
  });

  const response = await page.goto('/#/login', { waitUntil: 'domcontentloaded' });
  expect(response.status()).toBe(200);
  page.on('response', response => {
    const status = response.status();
    const isExpectedAuthError = response.url() === `${origin}/api/auth/login` && (status === 401 || status === 403);
    if (response.url().startsWith(origin) && status >= 400 && !isExpectedAuthError) {
      browserErrors.get(page).push(`Unexpected HTTP ${status}: ${response.url()}`);
    }
  });
});

test.afterEach(async ({ page }) => {
  const errors = browserErrors.get(page);
  if (errors) expect(errors, 'browser errors and failed local requests').toEqual([]);
});

async function acceptPrivacyNotice(page) {
  const acceptButton = page.getByRole('button', { name: 'He leído y acepto' });
  try {
    await acceptButton.waitFor({ state: 'visible', timeout: 3000 });
    await acceptButton.click();
    await expect(page.locator('#privacy-notice')).toHaveCount(0);
  } catch {
    // Si ya fue aceptado previamente en el contexto
  }
}

test.describe('Enterprise Verification & Access Control Flow (E2E)', () => {
  test('1. El formulario de registro contiene los campos de verificación empresarial', async ({ page }) => {
    await acceptPrivacyNotice(page);
    await page.getByRole('button', { name: 'Crear organización' }).click();
    await expect(page.getByRole('heading', { name: 'Comienza con Haitani' })).toBeVisible();

    // Comprobar campos corporativos añadidos
    await expect(page.locator('input[name="company_name"]')).toBeVisible();
    await expect(page.locator('input[name="slug"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="domain"]')).toBeVisible();
    await expect(page.locator('input[name="website"]')).toBeVisible();
    await expect(page.locator('input[name="official_registry_number"]')).toBeVisible();
  });

  test('2. Bloquea el login de una cuenta empresarial en estado pending y muestra el aviso de revisión', async ({ page }) => {
    await acceptPrivacyNotice(page);

    const loginResponse = page.waitForResponse(response =>
      response.url() === `${origin}/api/auth/login` && response.request().method() === 'POST'
    );

    await page.getByLabel('Usuario o correo').fill('pending-user@empresa.com');
    await page.getByLabel('Contraseña').fill('password123');
    await page.getByRole('button', { name: 'Entrar al workspace' }).click();

    const response = await loginResponse;
    expect(response.status()).toBe(403);

    // Debe mostrar el mensaje informativo del servidor de organización pendiente
    await expect(page.getByText(/pendiente de verificación empresarial/i)).toBeVisible();
  });

  test('3. Bloquea el login de una cuenta empresarial en estado suspended y muestra aviso de suspensión', async ({ page }) => {
    await acceptPrivacyNotice(page);

    const loginResponse = page.waitForResponse(response =>
      response.url() === `${origin}/api/auth/login` && response.request().method() === 'POST'
    );

    await page.getByLabel('Usuario o correo').fill('suspended-user@empresa.com');
    await page.getByLabel('Contraseña').fill('password123');
    await page.getByRole('button', { name: 'Entrar al workspace' }).click();

    const response = await loginResponse;
    expect(response.status()).toBe(403);

    // Debe mostrar mensaje de cuenta suspendida
    await expect(page.getByText(/suspendida/i)).toBeVisible();
  });

  test('4. La vista de verificación empresarial pendiente se visualiza correctamente en la interfaz', async ({ page }) => {
    await acceptPrivacyNotice(page);
    await page.goto('/#/pending-verification', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Organización en revisión' })).toBeVisible();
    await expect(page.getByText(/Pendiente de Aprobación/i)).toBeVisible();
    await expect(page.getByText(/un administrador global debe revisar y verificar/i)).toBeVisible();

    const logoutBtn = page.locator('#pending-logout-btn');
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  });
});
