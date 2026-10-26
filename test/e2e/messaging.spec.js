const { test, expect } = require('@playwright/test');

const origin = 'http://127.0.0.1:4173';
const browserErrors = new WeakMap();

const adminUser = {
  id: 101,
  username: 'admin_test',
  name: 'Admin Playwright',
  role: 'admin',
  organization_id: 1
};

test.beforeEach(async ({ page }) => {
  const errors = [];
  browserErrors.set(page, errors);
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && message.location().url.startsWith(origin) &&
        !message.text().includes('401 (Unauthorized)') &&
        !message.text().includes('403 (Forbidden)') &&
        !message.text().includes('WebSocket')) {
      errors.push(`Browser console error: ${message.text()}`);
    }
  });
});

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

  // Esperar a que cargue la interfaz autenticada
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

test.describe('Haitani — Mensajería Profesional en Tiempo Real (E2E & UI)', () => {
  test('1. Endpoints de mensajería requieren autenticación (401)', async ({ page }) => {
    const convRes = await page.request.get(`${origin}/api/messages/conversations`);
    expect(convRes.status()).toBe(401);

    const msgRes = await page.request.get(`${origin}/api/messages?user_id=102`);
    expect(msgRes.status()).toBe(401);
  });

  test('2. Consulta unificada de conversaciones devuelve contactos y grupos para usuario autenticado', async ({ page }) => {
    const res = await page.request.get(`${origin}/api/messages/conversations`, {
      headers: {
        'x-test-user': JSON.stringify(adminUser)
      }
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('direct');
    expect(body).toHaveProperty('groups');
    expect(Array.isArray(body.direct)).toBeTruthy();
    expect(Array.isArray(body.groups)).toBeTruthy();
    expect(body.direct.length).toBeGreaterThan(0);
    expect(body.groups.length).toBeGreaterThan(0);

    const valeria = body.direct.find(u => u.name === 'Valeria Gómez');
    expect(valeria).toBeDefined();
    expect(valeria.id).toBe(102);
  });

  test('3. Carga y renderizado del diseño de 3 paneles en escritorio', async ({ page }) => {
    await loginAsAdmin(page);
    await navigateTo(page, '#/admin/messages?user=102');

    // 1. Panel Izquierdo: Conversaciones
    await expect(page.locator('.conversation-list')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#chat-conversation-search')).toBeVisible();
    await expect(page.locator('.chat-filter-tabs')).toBeVisible();
    await expect(page.locator('.conversation-user').first()).toBeVisible();

    // 2. Panel Central: Chat Activo
    await expect(page.locator('#active-conversation-panel')).toBeVisible();
    await expect(page.locator('.conversation-header')).toBeVisible();
    await expect(page.locator('#active-message-form')).toBeVisible();
    await expect(page.locator('#chat-textarea')).toBeVisible();
    await expect(page.locator('#btn-send-message')).toBeVisible();

    // 3. Burbujas de mensajes con estados
    await expect(page.locator('.message-bubble').first()).toBeVisible();
  });

  test('4. Filtros de conversación operan fluidamente (Todas, Directas, Grupos)', async ({ page }) => {
    await loginAsAdmin(page);
    await navigateTo(page, '#/admin/messages');

    await expect(page.locator('.conversation-list')).toBeVisible({ timeout: 10000 });

    // Filtrar por grupos
    await page.click('button.chat-filter-tab[data-filter="groups"]');
    await expect(page.locator('button.chat-filter-tab[data-filter="groups"]')).toHaveClass(/active/);
    await expect(page.locator('.conversation-user[data-conv-type="group"]')).toBeVisible();
    await expect(page.locator('.conversation-user[data-conv-type="direct"]')).toHaveCount(0);

    // Filtrar por directas
    await page.click('button.chat-filter-tab[data-filter="direct"]');
    await expect(page.locator('button.chat-filter-tab[data-filter="direct"]')).toHaveClass(/active/);
    await expect(page.locator('.conversation-user[data-conv-type="direct"]').first()).toBeVisible();
    await expect(page.locator('.conversation-user[data-conv-type="group"]')).toHaveCount(0);

    // Volver a Todas
    await page.click('button.chat-filter-tab[data-filter="all"]');
    await expect(page.locator('button.chat-filter-tab[data-filter="all"]')).toHaveClass(/active/);
    await expect(page.locator('.conversation-user[data-conv-type="direct"]').first()).toBeVisible();
    await expect(page.locator('.conversation-user[data-conv-type="group"]').first()).toBeVisible();
  });

  test('5. Envío de mensaje desde el compositor activo', async ({ page }) => {
    await loginAsAdmin(page);
    await navigateTo(page, '#/admin/messages?user=102');

    await expect(page.locator('#active-message-form')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#chat-textarea')).toBeVisible({ timeout: 10000 });

    const testContent = `Mensaje de prueba E2E ${Date.now()}`;
    await page.fill('#chat-textarea', testContent);
    await page.click('#btn-send-message');

    // El mensaje debe aparecer en el flujo de la conversación
    await expect(page.locator('.message-bubble', { hasText: testContent })).toBeVisible({ timeout: 10000 });
  });

  test('6. Apertura y visualización del panel derecho de información (Drawer)', async ({ page }) => {
    await loginAsAdmin(page);
    await navigateTo(page, '#/admin/messages?user=102');

    await expect(page.locator('#toggle-chat-drawer')).toBeVisible({ timeout: 10000 });

    // Abrir Drawer de información
    await page.click('#toggle-chat-drawer');
    await expect(page.locator('#chat-drawer-panel')).toBeVisible();
    await expect(page.locator('#chat-drawer-panel')).toContainText('Valeria Gómez');

    // Cerrar Drawer
    await page.click('#btn-close-drawer');
    await expect(page.locator('#chat-drawer-panel')).toBeHidden();
  });

  test('7. Diseño Responsive en Móvil (Transición Lista <-> Chat con botón Atrás)', async ({ page }) => {
    // Configurar viewport móvil (iPhone standard)
    await page.setViewportSize({ width: 390, height: 844 });

    await loginAsAdmin(page);
    await navigateTo(page, '#/admin/messages');

    // En móvil, la lista de conversaciones es visible
    await expect(page.locator('.conversation-list')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.conversation-user[data-conv-type="direct"]').first()).toBeVisible({ timeout: 10000 });

    // Al seleccionar una conversación, se abre a pantalla completa con botón atrás
    await page.locator('.conversation-user[data-conv-type="direct"]').first().click();

    await expect(page.locator('#btn-chat-back')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#active-message-form')).toBeVisible({ timeout: 10000 });

    // Pulsar botón volver regresa a la lista de conversaciones
    await page.click('#btn-chat-back');
    await expect(page.locator('.conversation-list')).toBeVisible({ timeout: 10000 });
  });
});
