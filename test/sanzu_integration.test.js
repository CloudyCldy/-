process.env.NODE_ENV = 'test';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const request = require('supertest');
const { SanzuClient, sanitize } = require('../server/services/sanzuClient');
const app = require('../app');

describe('Pruebas de Integración Haitani ↔ Sanzu API (Requirement 9)', () => {
  let mockSanzuServer;
  let mockSanzuPort;
  let mockSanzuUrl;
  let receivedApiKey;
  let receivedHeaders;
  let receivedBody;
  let handlerMode = 'normal';

  const VALID_KEY = 'sz_live_integration_test_key_12345';
  const orgA = { id: 1, name: 'Organización Sakura', slug: 'sakura' };
  const adminA = { id: 101, username: 'admin_sakura', name: 'Administrador Haitani', role: 'admin', organization_id: orgA.id };
  const memberA = { id: 102, username: 'member_sakura', name: 'Miembro Normal', role: 'member', organization_id: orgA.id };
  const adminB = { id: 201, username: 'admin_rival', name: 'Admin Rival', role: 'admin', organization_id: 2 };

  before(async () => {
    // Iniciar servidor simulado de Sanzu para pruebas de integración controladas
    mockSanzuServer = http.createServer((req, res) => {
      receivedApiKey = req.headers['x-api-key'];
      receivedHeaders = req.headers;

      let bodyData = '';
      req.on('data', chunk => { bodyData += chunk; });
      req.on('end', () => {
        try { receivedBody = JSON.parse(bodyData); } catch { receivedBody = bodyData; }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-API-Version', 'v1');

        if (handlerMode === 'timeout') {
          // No responder para provocar timeout
          return;
        }

        if (handlerMode === 'server_error') {
          res.writeHead(500);
          return res.end(JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Fallo interno simulado en Sanzu' } }));
        }

        if (handlerMode === 'malformed') {
          res.writeHead(200);
          return res.end('{"success": true, invalid_json_here}');
        }

        // 1. Health check
        if (req.url === '/api/v1/health' && req.method === 'GET') {
          res.writeHead(200);
          return res.end(JSON.stringify({ success: true, data: { name: 'Sanzu', status: 'healthy', timestamp: new Date().toISOString() } }));
        }

        // 2. Auth verification / partner projects
        if (req.url.startsWith('/api/v1/partner/projects') && req.method === 'GET') {
          if (receivedApiKey !== VALID_KEY) {
            res.writeHead(401);
            return res.end(JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'API key required or invalid' } }));
          }
          res.writeHead(200);
          return res.end(JSON.stringify({ success: true, data: [] }));
        }

        // 3. Dictionary search
        if (req.url.startsWith('/api/v1/dictionary') && req.method === 'GET') {
          const url = new URL(req.url, `http://localhost:${mockSanzuPort}`);
          const q = url.searchParams.get('q');
          if (q === 'quemado' || q === 'burndown') {
            res.writeHead(200);
            return res.end(JSON.stringify({
              success: true,
              data: {
                total: 1,
                page: 1,
                items: [{
                  id: 'burndown-chart',
                  term: 'Gráfico Burndown (Burndown Chart)',
                  synonyms: ['Gráfico de Quemado'],
                  definition: 'Representación gráfica del trabajo restante.',
                  beginnerExplanation: 'Línea que baja mostrando tareas pendientes.',
                  category: 'metricas_analisis'
                }]
              }
            }));
          }
          res.writeHead(200);
          return res.end(JSON.stringify({ success: true, data: { total: 0, items: [] } }));
        }

        // 4. Partner chatbot message
        if (req.url === '/api/v1/partner/chatbot/message' && req.method === 'POST') {
          if (receivedApiKey !== VALID_KEY) {
            res.writeHead(401);
            return res.end(JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'Clave de integración inválida' } }));
          }

          const q = String(receivedBody.message || '').toLowerCase();
          let answer = 'Respuesta general de Sanzu';
          if (q.includes('riesgo') || q.includes('sprint')) {
            answer = 'El sprint presenta riesgos debido a 1 tarea bloqueada y 1 tarea vencida.';
          } else if (q.includes('hoy') || q.includes('priorizar')) {
            answer = 'Prioriza la tarea bloqueada de autenticación y luego atiende las tareas críticas del sprint.';
          } else if (q.includes('scrum') || q.includes('kanban')) {
            answer = 'Scrum se basa en iteraciones fijas (sprints) y roles definidos, mientras que Kanban optimiza el flujo continuo.';
          }

          res.writeHead(200);
          return res.end(JSON.stringify({
            success: true,
            answer,
            response: answer,
            sources: ['Base de conocimiento Sanzu (Scrum Guide)'],
            suggestions: ['¿Cuáles son los riesgos?', '¿Qué debería hacer hoy?'],
            metadata: { provider: 'sanzu', version: 'v1' }
          }));
        }

        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }));
      });
    });

    await new Promise(resolve => {
      mockSanzuServer.listen(0, () => {
        mockSanzuPort = mockSanzuServer.address().port;
        mockSanzuUrl = `http://localhost:${mockSanzuPort}`;
        resolve();
      });
    });
  });

  after(() => {
    if (mockSanzuServer) mockSanzuServer.close();
  });

  describe('Escenario 1: Comprobación de estado y disponibilidad (Health Check)', () => {
    it('Haitani consulta correctamente el estado de Sanzu mediante sanzuClient.checkHealth', async () => {
      const client = new SanzuClient({ apiUrl: mockSanzuUrl });
      const health = await client.checkHealth();

      assert.strictEqual(health.online, true);
      assert.strictEqual(health.status, 'healthy');
      assert.ok(health.timestamp);
    });

    it('Informa de forma limpia cuando Sanzu está fuera de servicio', async () => {
      const client = new SanzuClient({ apiUrl: 'http://127.0.0.1:59999' }); // puerto cerrado
      const health = await client.checkHealth({ timeoutMs: 500 });

      assert.strictEqual(health.online, false);
      assert.strictEqual(health.status, 'unreachable');
    });
  });

  describe('Escenario 2, 3, 5: Preguntas y Respuestas Especializadas', () => {
    it('Envía pregunta autenticada con API key y recibe respuesta estructurada', async () => {
      const client = new SanzuClient({ apiUrl: mockSanzuUrl, apiKey: VALID_KEY });
      const res = await client.askAssistant('¿Qué tareas ponen en riesgo el sprint?', {
        project: { id: 1, name: 'Sakura Coffee', methodology: 'SCRUM' },
        tasks: [{ id: 10, title: 'Auth Bug', status: 'bloqueada' }]
      });

      assert.strictEqual(res.success, true);
      assert.ok(res.answer.includes('El sprint presenta riesgos'));
      assert.ok(res.sources.length > 0);
      assert.ok(res.suggestions.length > 0);
      assert.strictEqual(receivedApiKey, VALID_KEY);
    });

    it('Sanzu responde consultas sobre metodologías ágiles (Scrum vs Kanban)', async () => {
      const client = new SanzuClient({ apiUrl: mockSanzuUrl, apiKey: VALID_KEY });
      const res = await client.askAssistant('Diferencia entre Scrum y Kanban');

      assert.strictEqual(res.success, true);
      assert.ok(res.answer.includes('Scrum') && res.answer.includes('Kanban'));
    });
  });

  describe('Escenario 4: Búsqueda en el Diccionario', () => {
    it('Encuentra conceptos mediante sinónimos y búsqueda parcial', async () => {
      const client = new SanzuClient({ apiUrl: mockSanzuUrl, apiKey: VALID_KEY });
      const result = await client.searchDictionary({ q: 'quemado' });

      assert.strictEqual(result.total, 1);
      assert.strictEqual(result.items[0].id, 'burndown-chart');
      assert.strictEqual(result.items[0].category, 'metricas_analisis');
    });
  });

  describe('Escenario 8, 9, 10: Seguridad, Errores 401/403, Timeouts y 500', () => {
    it('Rechaza solicitudes sin API key válida (401)', async () => {
      const client = new SanzuClient({ apiUrl: mockSanzuUrl, apiKey: 'clave_invalida' });

      await assert.rejects(
        async () => client.askAssistant('Hola'),
        err => err.status === 401 && err.code === 'UNAUTHORIZED'
      );
    });

    it('Gestiona timeout adecuadamente y cancela solicitud', async () => {
      handlerMode = 'timeout';
      const client = new SanzuClient({ apiUrl: mockSanzuUrl, apiKey: VALID_KEY, timeoutMs: 400, retries: 0 });

      await assert.rejects(
        async () => client.askAssistant('¿Qué debería hacer hoy?'),
        err => err.code === 'TIMEOUT_ERROR' || err.status === 504
      );
      handlerMode = 'normal';
    });

    it('Gestiona errores 500 con reintentos controlados', async () => {
      handlerMode = 'server_error';
      const client = new SanzuClient({ apiUrl: mockSanzuUrl, apiKey: VALID_KEY, timeoutMs: 500, retries: 1 });

      await assert.rejects(
        async () => client.askAssistant('Hola'),
        err => err.status === 500 && err.message.includes('Fallo interno simulado')
      );
      handlerMode = 'normal';
    });

    it('Protege secretos y claves privadas frente a filtraciones en errores y logs', () => {
      const rawError = `Error connecting with sz_live_super_secret_private_token_491024 to http://localhost`;
      const clean = sanitize(rawError);

      assert.ok(!clean.includes('super_secret_private_token_491024'), 'No debe contener la clave cruda');
      assert.ok(clean.includes('sz_live_••••••••'), 'Debe enmascarar la API key');
    });
  });

  describe('Escenario 11: Aislamiento Multi-tenant', () => {
    it('Impide a usuarios no autenticados o miembros sin permiso acceder al chat o alterar credenciales', async () => {
      const res = await request(app)
        .post('/api/assistant/chat')
        .send({ message: '¿Qué tareas están vencidas?' });

      assert.strictEqual(res.status, 401);
    });

    it('Miembro normal recibe 403 al intentar usar chat de asistente restringido', async () => {
      const res = await request(app)
        .post('/api/assistant/chat')
        .set('x-test-user', JSON.stringify(memberA))
        .send({ message: '¿Qué tareas están vencidas?' });

      assert.strictEqual(res.status, 403);
    });
  });
});
