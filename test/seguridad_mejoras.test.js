process.env.NODE_ENV = 'test';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../app');
const { replaceSqlPlaceholders } = require('../server/database');

describe('Mejoras de Seguridad, Hardening HTTP y Base de Datos', () => {
  describe('1. Cabeceras de Seguridad HTTP y Ocultación de Servidor', () => {
    it('1.1 Oculta la cabecera X-Powered-By para mitigar fingerprinting', async () => {
      const res = await request(app).get('/api/health');
      assert.equal(res.status, 200);
      assert.equal(res.headers['x-powered-by'], undefined, 'No debe exponer X-Powered-By');
    });

    it('1.2 Incluye cabeceras de seguridad X-Content-Type-Options y X-Frame-Options', async () => {
      const res = await request(app).get('/api/health');
      assert.equal(res.status, 200);
      assert.equal(res.headers['x-content-type-options'], 'nosniff');
      assert.equal(res.headers['x-frame-options'], 'SAMEORIGIN');
      assert.equal(res.headers['x-xss-protection'], '0');
      assert.equal(res.headers['referrer-policy'], 'strict-origin-when-cross-origin');
    });

    it('1.3 En endpoints de API protegidos añade directivas Cache-Control no-store', async () => {
      const res = await request(app).get('/api/projects');
      assert.equal(res.status, 401);
      assert.ok(res.headers['cache-control']?.includes('no-store'), 'Debe incluir no-store en rutas API');
    });
  });

  describe('2. Auditoría y Medición Dinámica de Latencia', () => {
    it('2.1 X-Request-Duration-Ms retorna un valor numérico válido de tiempo transcurrido', async () => {
      const res = await request(app).get('/api/health');
      assert.equal(res.status, 200);
      const durationHeader = res.headers['x-request-duration-ms'];
      assert.ok(durationHeader !== undefined, 'Debe incluir la cabecera X-Request-Duration-Ms');
      const duration = Number(durationHeader);
      assert.ok(!isNaN(duration) && duration >= 0, `Duracion valida: ${duration}`);
    });
  });

  describe('3. Rate Limiting en Autenticación', () => {
    it('3.1 Añade cabeceras X-RateLimit cuando se evalúa el limitador', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('x-test-rate-limit', '1')
        .send({ username: 'invalid_user', password: 'wrong_password' });

      assert.ok([400, 401].includes(res.status));
      assert.ok(res.headers['x-ratelimit-limit'] !== undefined, 'Debe incluir X-RateLimit-Limit');
      assert.ok(res.headers['x-ratelimit-remaining'] !== undefined, 'Debe incluir X-RateLimit-Remaining');
    });

    it('3.2 Bloquea con 429 cuando se supera la cuota permitida en x-test-rate-limit', async () => {
      const uniqueIp = `192.168.100.${Math.floor(Math.random() * 200) + 10}`;
      let lastRes = null;
      for (let i = 0; i < 12; i++) {
        lastRes = await request(app)
          .post('/api/auth/login')
          .set('x-test-rate-limit', '1')
          .set('x-forwarded-for', uniqueIp)
          .send({ username: 'brute_user', password: 'wrong_password' });
      }
      assert.equal(lastRes.status, 429);
      assert.equal(lastRes.body.code, 'TOO_MANY_REQUESTS');
      assert.ok(lastRes.headers['retry-after'] !== undefined);
    });
  });

  describe('4. Parser de Parámetros Posicionales en Base de Datos (SQL)', () => {
    it('4.1 Reemplaza signos de interrogación fuera de cadenas por $1, $2...', () => {
      const sql = 'SELECT * FROM users WHERE organization_id = ? AND active = ?';
      const parsed = replaceSqlPlaceholders(sql);
      assert.equal(parsed, 'SELECT * FROM users WHERE organization_id = $1 AND active = $2');
    });

    it('4.2 Respeta y no altera signos de interrogación dentro de cadenas literales', () => {
      const sql = "SELECT * FROM chatbot_messages WHERE message = '¿Qué tareas están vencidas?' AND org_id = ?";
      const parsed = replaceSqlPlaceholders(sql);
      assert.equal(parsed, "SELECT * FROM chatbot_messages WHERE message = '¿Qué tareas están vencidas?' AND org_id = $1");
    });

    it('4.3 Maneja cadenas con comillas simples escapadas correctamente', () => {
      const sql = "SELECT * FROM notes WHERE title = 'It''s a question? Yes' AND id = ?";
      const parsed = replaceSqlPlaceholders(sql);
      assert.equal(parsed, "SELECT * FROM notes WHERE title = 'It''s a question? Yes' AND id = $1");
    });

    it('4.4 No altera signos de interrogacion dentro de comentarios de linea o bloque', () => {
      const sql = "SELECT * FROM users WHERE org_id = ? -- ¿Filtro por org?\n AND /* comentario? */ active = ?";
      const parsed = replaceSqlPlaceholders(sql);
      assert.equal(parsed, "SELECT * FROM users WHERE org_id = $1 -- ¿Filtro por org?\n AND /* comentario? */ active = $2");
    });
  });

  describe('5. Health Check Profundo (/api/health?check=db)', () => {
    it('5.1 /api/health básico responde rápidamente sin consultar base', async () => {
      const res = await request(app).get('/api/health');
      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.app, 'Haitani');
    });

    it('5.2 /api/health?check=db valida la conectividad a PostgreSQL', async () => {
      const res = await request(app).get('/api/health?check=db');
      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.database, 'connected');
    });
  });
});
