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
        !message.text().includes('401 (Unauthorized)')) {
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
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  page.on('response', response => {
    const status = response.status();
    const expectedInvalidCredentials = response.url() === `${origin}/api/auth/login` && status === 401;
    if (response.url().startsWith(origin) && status >= 400 && !expectedInvalidCredentials) {
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
  if (await acceptButton.isVisible().catch(() => false)) {
    await acceptButton.click();
  }
}

test('muestra el acceso, requiere aceptar privacidad y carga sus recursos', async ({ page }) => {
  await expect(page.getByRole('dialog', { name: 'Privacidad y acuerdos de uso' })).toBeVisible();
  await expect(page.getByLabel('Usuario o correo')).toBeVisible();
  await expect(page.getByLabel('Contraseña')).toHaveAttribute('type', 'password');

  const health = await page.request.get(`${origin}/api/health`);
  expect(health.ok()).toBeTruthy();
  await expect(page.locator('#privacy-notice')).toBeVisible();
  await page.getByRole('button', { name: 'He leído y acepto' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('haitani-privacy-accepted-v1'))).toBe('1');

  const stylesheet = await page.request.get(`${origin}/css/style.css`);
  const script = await page.request.get(`${origin}/js/app.js`);
  expect(stylesheet.status()).toBe(200);
  expect(script.status()).toBe(200);
});

test('la página pública conduce al formulario de acceso', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Potencia y orden para equipos de alto rendimiento' })).toBeVisible();
  await page.getByRole('link', { name: 'Ingresar al sistema' }).click();
  await expect(page).toHaveURL(/#\/login$/);
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
});

test('bloquea el envío del formulario cuando faltan las credenciales', async ({ page }) => {
  await acceptPrivacyNotice(page);
  const loginRequests = [];
  page.on('request', request => {
    if (request.url() === `${origin}/api/auth/login`) loginRequests.push(request);
  });

  const username = page.getByLabel('Usuario o correo');
  const password = page.getByLabel('Contraseña');
  await expect(username).toHaveAttribute('required', '');
  await expect(password).toHaveAttribute('required', '');
  await page.getByRole('button', { name: 'Entrar al workspace' }).click();

  await expect(username).toBeFocused();
  expect(loginRequests).toHaveLength(0);
});

test('valida campos de registro y permite volver al acceso', async ({ page }) => {
  await acceptPrivacyNotice(page);
  await page.getByRole('button', { name: 'Crear organización' }).click();
  await expect(page.getByRole('heading', { name: 'Comienza con Haitani' })).toBeVisible();

  const registration = page.locator('#organization-register');
  const company = page.getByLabel('Empresa', { exact: true });
  const slug = page.getByLabel('Slug (identificador)');
  await expect(registration.locator('input[required]')).toHaveCount(7);

  const registrationRequests = [];
  page.on('request', request => {
    if (request.url() === `${origin}/api/organizations/register`) registrationRequests.push(request);
  });
  await page.getByRole('button', { name: 'Crear organización y continuar' }).click();
  await expect(company).toBeFocused();
  expect(registrationRequests).toHaveLength(0);

  await slug.fill('INVALID slug');
  expect(await slug.evaluate(input => input.checkValidity())).toBe(false);

  await page.getByRole('button', { name: 'Volver al inicio de sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
});

test('rechaza credenciales desconocidas y muestra el error del servidor', async ({ page }) => {
  await acceptPrivacyNotice(page);
  const loginResponse = page.waitForResponse(response =>
    response.url() === `${origin}/api/auth/login` && response.request().method() === 'POST'
  );

  await page.getByLabel('Usuario o correo').fill('usuario-inexistente@example.test');
  await page.getByLabel('Contraseña').fill('credencial-invalida');
  await page.getByRole('button', { name: 'Entrar al workspace' }).click();

  expect((await loginResponse).status()).toBe(401);
  await expect(page.getByText('Usuario o contraseña incorrectos.', { exact: true })).toBeVisible();
});

test('mantiene el formulario dentro del viewport en escritorio, tablet y móvil', async ({ page }, testInfo) => {
  await acceptPrivacyNotice(page);
  const viewports = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const dimensions = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      form: document.querySelector('#login-form').getBoundingClientRect().toJSON()
    }));

    expect(dimensions.documentWidth, `horizontal overflow at ${viewport.name}`).toBeLessThanOrEqual(dimensions.viewportWidth);
    expect(dimensions.form.left, `form starts off-screen at ${viewport.name}`).toBeGreaterThanOrEqual(0);
    expect(dimensions.form.right, `form extends off-screen at ${viewport.name}`).toBeLessThanOrEqual(dimensions.viewportWidth);
    await expect(page.getByLabel('Usuario o correo')).toBeVisible();

    if (viewport.name === 'mobile') {
      await page.screenshot({ path: testInfo.outputPath('login-mobile.png'), fullPage: true });
    }
  }

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  for (const viewport of viewports.slice(1)) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const dimensions = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth
    }));
    expect(dimensions.documentWidth, `public landing overflow at ${viewport.name}`)
      .toBeLessThanOrEqual(dimensions.viewportWidth);
  }
});

test('permite recorrer los campos y acciones de acceso con el teclado', async ({ page }) => {
  await acceptPrivacyNotice(page);
  const username = page.getByLabel('Usuario o correo');
  const password = page.getByLabel('Contraseña');
  const submit = page.getByRole('button', { name: 'Entrar al workspace' });

  await expect(username).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(password).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(submit).toBeFocused();
});
