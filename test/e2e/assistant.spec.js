const { test, expect } = require('@playwright/test');

const origin = 'http://127.0.0.1:4173';
const adminUser = {
  id: 101,
  username: 'admin_test',
  name: 'Admin Playwright',
  role: 'admin',
  organization_id: 1
};

test.describe('Asistente IA y Sanzu (E2E & UI)', () => {
  test('1. Rechaza llamadas a la API del asistente sin autenticación (401)', async ({ page }) => {
    const chatRes = await page.request.post(`${origin}/api/assistant/chat`, {
      data: { message: '¿Cuáles son las prioridades?' }
    });
    expect(chatRes.status()).toBe(401);

    const dictRes = await page.request.get(`${origin}/api/assistant/dictionary`);
    expect(dictRes.status()).toBe(401);
  });

  test('2. Permite consultar el asistente con autenticación administrativa y responde estructuradamente', async ({ page }) => {
    const res = await page.request.post(`${origin}/api/assistant/chat`, {
      headers: {
        'x-test-user': JSON.stringify(adminUser),
        'Content-Type': 'application/json'
      },
      data: { message: '¿Qué tareas están vencidas?' }
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.answer).toBeTruthy();
    expect(body.source).toMatch(/sanzu|local/);
    expect(body.context).toBeDefined();
  });

  test('3. Valida que el mensaje no esté vacío (400)', async ({ page }) => {
    const res = await page.request.post(`${origin}/api/assistant/chat`, {
      headers: {
        'x-test-user': JSON.stringify(adminUser),
        'Content-Type': 'application/json'
      },
      data: { message: '   ' }
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('pregunta');
  });

  test('4. Carga de interfaz del asistente y sugerencias rápidas', async ({ page }) => {
    // Verificar que los recursos estáticos del asistente estén servidos correctamente
    const appScript = await page.request.get(`${origin}/js/app.js`);
    expect(appScript.status()).toBe(200);
    const text = await appScript.text();

    // Comprobar presencia de componentes clave del asistente
    expect(text).toContain('Tu copiloto de operaciones');
    expect(text).toContain('assistant-suggestion');
    expect(text).toContain('¿Qué tareas están vencidas?');
    expect(text).toContain('¿Cuál es el progreso del proyecto?');
    expect(text).toContain('Dame un resumen para la reunión');
    expect(text).toContain('Sanzu está analizando el proyecto...');
  });
});
