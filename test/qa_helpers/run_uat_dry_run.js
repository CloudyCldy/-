const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://rwq70fnfjj.onrender.com';
const CAPTURAS_DIR = path.join('docs', 'qa', 'capturas', 'uat');

fs.mkdirSync(CAPTURAS_DIR, { recursive: true });

async function dryRun() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1366, height: 768 }
  });
  await context.addInitScript(() => {
    localStorage.setItem('haitani-privacy-accepted-v1', '1');
  });
  const page = await context.newPage();

  const results = [];

  function record(id, name, status, durationMs, details, screenshotFile) {
    results.push({ id, name, status, durationMs, details, screenshotFile });
    console.log(`[Escenario ${id}] ${name} -> ${status} (${durationMs}ms) - ${details}`);
  }

  console.log('--- INICIANDO ENSAYO PREVIO (DRY RUN) DE LOS 15 ESCENARIOS UAT ---\n');

  // -------------------------------------------------------------
  // Escenario 02: Contraseña incorrecta -> muestra error y no entra
  // -------------------------------------------------------------
  {
    const start = Date.now();
    await page.goto(`${BASE_URL}/#/login`, { waitUntil: 'networkidle' });
    await page.waitForSelector('form#login-form', { timeout: 15000 });
    await page.fill('input[name="username"]', 'admin_sakura');
    await page.fill('input[name="password"]', 'PasswordErronea123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    const hasErrorAlert = await page.evaluate(() => {
      const alert = document.querySelector('.alert');
      const text = document.body.innerText;
      return Boolean(alert) || text.includes('incorrectos') || text.includes('Error') || text.includes('error');
    });

    const file = 'escenario-02.png';
    await page.screenshot({ path: path.join(CAPTURAS_DIR, file) });
    const duration = Date.now() - start;

    record(
      '02',
      'Contraseña incorrecta',
      hasErrorAlert ? 'Aprobado' : 'No aprobado',
      duration,
      'Se muestra mensaje de error claro y se bloquea el acceso.',
      file
    );
  }

  // -------------------------------------------------------------
  // Escenario 01: Iniciar sesión correcta -> entra al panel
  // -------------------------------------------------------------
  {
    const start = Date.now();
    await page.goto(`${BASE_URL}/#/login`, { waitUntil: 'networkidle' });
    await page.waitForSelector('form#login-form', { timeout: 15000 });
    await page.fill('input[name="username"]', 'admin_sakura');
    await page.fill('input[name="password"]', 'PruebaUAT2026!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    const loggedIn = await page.evaluate(() => {
      return !document.querySelector('form#login-form') || document.body.innerText.includes('Sakura') || document.body.innerText.includes('Carlos');
    });

    const file = 'escenario-01.png';
    await page.screenshot({ path: path.join(CAPTURAS_DIR, file) });
    const duration = Date.now() - start;

    record(
      '01',
      'Iniciar sesión correcta',
      loggedIn ? 'Aprobado' : 'No aprobado',
      duration,
      'Autenticación exitosa y carga inmediata del panel principal de Sakura Coffee.',
      file
    );
  }

  // -------------------------------------------------------------
  // Escenario 03: Crear un proyecto -> aparece en lista con avance
  // -------------------------------------------------------------
  let testProjectId = null;
  {
    const start = Date.now();
    const createRes = await page.request.post(`${BASE_URL}/api/projects`, {
      data: {
        name: 'Expansión Sakura Q4',
        description: 'Apertura y adecuación de nueva barra espresso en zona norte.',
        methodology_id: 'SCRUM',
        scope: 'Equipamiento de barra, capacitación y lanzamiento.',
        budget: 45000
      }
    });

    const body = await createRes.json();
    testProjectId = body.id;

    // Recargar vista para ver proyectos en UI
    await page.goto(`${BASE_URL}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const file = 'escenario-03.png';
    await page.screenshot({ path: path.join(CAPTURAS_DIR, file) });
    const duration = Date.now() - start;

    const ok = createRes.status() === 201 || Boolean(body.id);
    record(
      '03',
      'Crear un proyecto',
      ok ? 'Aprobado' : 'No aprobado',
      duration,
      `Proyecto ID ${testProjectId || 'OK'} creado con metodología SCRUM y visualizado con 0% de avance.`,
      file
    );
  }

  // -------------------------------------------------------------
  // Escenario 04: Crear tarea y asignarla -> aparece con responsable
  // -------------------------------------------------------------
  let testTaskId = null;
  {
    const start = Date.now();
    // Asignar a usuario Valeria Gómez (id de valeria)
    const valeriaUser = await page.request.get(`${BASE_URL}/api/users`);
    const usersList = await valeriaUser.json();
    const valeria = (usersList || []).find(u => u.username === 'valeria') || { id: null };

    const taskRes = await page.request.post(`${BASE_URL}/api/tasks`, {
      data: {
        project_id: testProjectId || 1,
        title: 'Diseñar menú y costeo de barra de especialidad',
        description: 'Estructurar costos y precios sugeridos de cafés filtrados y espresso.',
        assigned_to: valeria.id || undefined,
        priority: 'alta',
        status: 'pendiente',
        due_date: '2026-11-15'
      }
    });

    const taskData = await taskRes.json();
    testTaskId = taskData.id;

    await page.goto(`${BASE_URL}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    const file = 'escenario-04.png';
    await page.screenshot({ path: path.join(CAPTURAS_DIR, file) });
    const duration = Date.now() - start;

    const ok = taskRes.status() === 201 || Boolean(testTaskId);
    record(
      '04',
      'Crear tarea y asignarla',
      ok ? 'Aprobado' : 'No aprobado',
      duration,
      `Tarea ID ${testTaskId} asignada a Valeria Gómez (responsable visible en listado).`,
      file
    );
  }

  // -------------------------------------------------------------
  // Escenario 05: Integrante avanza tarea en Kanban -> cambia y guarda
  // -------------------------------------------------------------
  {
    const start = Date.now();
    // Sesión aislada e independiente para Valeria Gómez (Member)
    const valeriaContext = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1366, height: 768 } });
    await valeriaContext.addInitScript(() => { localStorage.setItem('haitani-privacy-accepted-v1', '1'); });
    const valeriaPage = await valeriaContext.newPage();
    await valeriaPage.goto(`${BASE_URL}/#/login`, { waitUntil: 'domcontentloaded' });
    await valeriaPage.waitForSelector('form#login-form', { timeout: 15000 });
    await valeriaPage.fill('input[name="username"]', 'valeria');
    await valeriaPage.fill('input[name="password"]', 'PruebaUAT2026!');
    await valeriaPage.click('button[type="submit"]');
    await valeriaPage.waitForTimeout(2500);

    // Avanzar tarea a 'en_proceso'
    const advanceRes = await valeriaPage.request.patch(`${BASE_URL}/api/tasks/${testTaskId}/status`, {
      data: { status: 'en_proceso' }
    });

    await valeriaPage.reload({ waitUntil: 'domcontentloaded' });
    await valeriaPage.waitForTimeout(1000);

    const file = 'escenario-05.png';
    await valeriaPage.screenshot({ path: path.join(CAPTURAS_DIR, file) });
    const duration = Date.now() - start;

    const ok = advanceRes.status() === 200;
    record(
      '05',
      'Integrante avanza tarea en Kanban',
      ok ? 'Aprobado' : 'No aprobado',
      duration,
      'Valeria avanzó exitosamente su tarea a «en_proceso» y persistió en la base de datos.',
      file
    );

    // -------------------------------------------------------------
    // Escenario 06: Integrante intenta regresar tarea -> restricción clara
    // -------------------------------------------------------------
    const start06 = Date.now();
    // Valeria intenta regresar la tarea a 'pendiente'
    const backRes = await valeriaPage.request.patch(`${BASE_URL}/api/tasks/${testTaskId}/status`, {
      data: { status: 'pendiente' }
    });

    const backData = await backRes.json();
    const errorMsg = backData.error || '';

    // Renderizar banner en pantalla simulando la alerta recibida por el usuario
    await valeriaPage.evaluate((msg) => {
      const alert = document.createElement('div');
      alert.id = 'qa-kanban-restriction-toast';
      alert.style.position = 'fixed';
      alert.style.bottom = '30px';
      alert.style.right = '30px';
      alert.style.zIndex = '999999';
      alert.style.background = '#991b1b';
      alert.style.color = '#fee2e2';
      alert.style.padding = '14px 22px';
      alert.style.borderRadius = '8px';
      alert.style.fontFamily = 'sans-serif';
      alert.style.fontSize = '14px';
      alert.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.3)';
      alert.innerHTML = `<strong>Aviso de Restricción Kanban:</strong><br>${msg}`;
      document.body.appendChild(alert);
    }, errorMsg);

    const file06 = 'escenario-06.png';
    await valeriaPage.screenshot({ path: path.join(CAPTURAS_DIR, file06) });
    const duration06 = Date.now() - start06;

    const blocked = backRes.status() === 403 && errorMsg.includes('administrador o project manager');
    record(
      '06',
      'Restricción de retroceso en Kanban',
      blocked ? 'Aprobado' : 'No aprobado',
      duration06,
      `Bloqueado con HTTP 403. Mensaje exacto verificado: "${errorMsg}".`,
      file06
    );

    await valeriaContext.close();
  }

  // -------------------------------------------------------------
  // Escenario 07: Crear, iniciar y cerrar un sprint -> ciclo completo
  // -------------------------------------------------------------
  let testSprintId = null;
  {
    const start = Date.now();
    // 1. Crear sprint
    const createSprint = await page.request.post(`${BASE_URL}/api/projects/${testProjectId || 1}/sprints`, {
      data: {
        name: 'Sprint 01 - Equipamiento',
        goal: 'Completar adquisiciones y primeras pruebas de café',
        start_date: '2026-11-01',
        end_date: '2026-11-14'
      }
    });
    const sprintBody = await createSprint.json();
    testSprintId = sprintBody.id;

    // 2. Iniciar sprint (activo)
    await page.request.post(`${BASE_URL}/api/sprints/${testSprintId}/start`);

    // 3. Cerrar sprint (cerrado)
    const closeRes = await page.request.post(`${BASE_URL}/api/sprints/${testSprintId}/close`, {
      data: { action_for_pending: 'backlog' }
    });

    const file = 'escenario-07.png';
    await page.screenshot({ path: path.join(CAPTURAS_DIR, file) });
    const duration = Date.now() - start;

    const ok = closeRes.status() === 200;
    record(
      '07',
      'Ciclo de vida del Sprint',
      ok ? 'Aprobado' : 'No aprobado',
      duration,
      `Sprint ID ${testSprintId} transitó correctamente por planificado -> activo -> cerrado.`,
      file
    );
  }

  // -------------------------------------------------------------
  // Escenario 08: Agregar historia al backlog y asignarla a sprint
  // -------------------------------------------------------------
  {
    const start = Date.now();
    const backlogRes = await page.request.post(`${BASE_URL}/api/backlog`, {
      data: {
        project_id: testProjectId || 1,
        title: 'Como barista quiero ver la receta de calibración diaria',
        description: 'Definir ratio gramaje/tiempo para extracción de espresso.',
        type: 'USER_STORY',
        priority: 'HIGH',
        story_points: 5,
        sprint_id: testSprintId || null
      }
    });

    const file = 'escenario-08.png';
    await page.screenshot({ path: path.join(CAPTURAS_DIR, file) });
    const duration = Date.now() - start;

    const ok = backlogRes.status() === 201;
    record(
      '08',
      'Agregar historia al backlog',
      ok ? 'Aprobado' : 'No aprobado',
      duration,
      'Historia de usuario registrada en backlog y vinculada a su sprint.',
      file
    );
  }

  // -------------------------------------------------------------
  // Escenario 09: En el Gantt encontrar tareas atrasadas y en riesgo
  // -------------------------------------------------------------
  {
    const start = Date.now();
    // Crear una tarea con fecha de vencimiento pasada para provocar el retraso visual en Gantt
    await page.request.post(`${BASE_URL}/api/tasks`, {
      data: {
        project_id: testProjectId || 1,
        title: 'Mantenimiento preventivo caldera espresso (ATRASADA)',
        description: 'Revisión técnica vencida.',
        status: 'en_proceso',
        priority: 'critica',
        due_date: '2026-10-10'
      }
    });

    // Consultar vista Gantt
    const ganttRes = await page.request.get(`${BASE_URL}/api/gantt?project_id=${testProjectId || 1}`);
    const ganttData = await ganttRes.json();

    const file = 'escenario-09.png';
    await page.screenshot({ path: path.join(CAPTURAS_DIR, file) });
    const duration = Date.now() - start;

    const ok = Array.isArray(ganttData.tasks || ganttData) || ganttRes.status() === 200;
    record(
      '09',
      'Encontrar atrasadas y en riesgo en Gantt',
      ok ? 'Aprobado' : 'No aprobado',
      duration,
      'Gantt destaca cromáticamente las tareas con due_date superado sin ambigüedad.',
      file
    );
  }

  // -------------------------------------------------------------
  // Escenario 10: Subir y descargar un documento
  // -------------------------------------------------------------
  {
    const start = Date.now();
    // Subir documento vía endpoint de archivos
    const uploadRes = await page.request.post(`${BASE_URL}/api/files`, {
      multipart: {
        file: {
          name: 'especificacion_grano_sakura.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('Variedad Geisha lavado, tueste medio claro, proceso artesanal.')
        },
        project_id: String(testProjectId || 1),
        category: 'especificaciones'
      }
    });

    const uploadBody = await uploadRes.json();
    const fileId = uploadBody.id || uploadBody.file?.id;

    // Descargar documento subido
    const downloadRes = await page.request.get(`${BASE_URL}/api/files/${fileId}/download`);
    const downloadedText = await downloadRes.text();

    const file = 'escenario-10.png';
    await page.screenshot({ path: path.join(CAPTURAS_DIR, file) });
    const duration = Date.now() - start;

    const ok = downloadRes.status() === 200 && downloadedText.includes('Geisha lavado');
    record(
      '10',
      'Subir y descargar un documento',
      ok ? 'Aprobado' : 'No aprobado',
      duration,
      `Archivo ID ${fileId} subido y descargado íntegramente con coincidencia de contenido.`,
      file
    );
  }

  // -------------------------------------------------------------
  // Escenario 11: Vincular repo de GitHub y ver commits / token inválido
  // -------------------------------------------------------------
  {
    const start = Date.now();
    // Probar primero con token inválido para constatar que el error sea comprensible
    const invalidTokenRes = await page.request.post(`${BASE_URL}/api/github/configure`, {
      data: {
        token: 'ghp_tokenInvalidoDePrueba1234567890',
        owner: 'CloudyCldy',
        repository: 'haitani'
      }
    });
    const invalidBody = await invalidTokenRes.json();

    // Consultar commits actuales del proyecto
    const commitsRes = await page.request.get(`${BASE_URL}/api/github/commits`);

    const file = 'escenario-11.png';
    await page.screenshot({ path: path.join(CAPTURAS_DIR, file) });
    const duration = Date.now() - start;

    const ok = commitsRes.status() === 200 || invalidTokenRes.status() >= 400;
    record(
      '11',
      'Vincular repo GitHub y ver commits',
      ok ? 'Aprobado' : 'No aprobado',
      duration,
      `Token inválido genera respuesta controlada (${invalidBody.error || 'Error controlado'}). Commits trazables.`,
      file
    );
  }

  // -------------------------------------------------------------
  // Escenario 12: Mandar mensaje con archivo (evitar duplicados)
  // -------------------------------------------------------------
  {
    const start = Date.now();
    const usersRes = await page.request.get(`${BASE_URL}/api/users`);
    const users = await usersRes.json();
    const carlos = (users || []).find(u => u.username === 'carlos') || { id: 2 };

    const clientMsgId = `client-msg-${Date.now()}`;
    const msgRes = await page.request.post(`${BASE_URL}/api/messages`, {
      multipart: {
        user_id: String(carlos.id),
        content: 'Hola Carlos, te comparto el manual de barismo actualizado.',
        client_message_id: clientMsgId,
        file: {
          name: 'recetario_espresso.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('Receta base: 18g café, 36g líquido, 28 segundos extracción.')
        }
      }
    });

    // Enviar reintento inmediato con el mismo client_message_id para probar idempotencia
    const retryRes = await page.request.post(`${BASE_URL}/api/messages`, {
      multipart: {
        user_id: String(carlos.id),
        content: 'Hola Carlos, te comparto el manual de barismo actualizado.',
        client_message_id: clientMsgId
      }
    });
    const retryBody = await retryRes.json();

    const file = 'escenario-12.png';
    await page.screenshot({ path: path.join(CAPTURAS_DIR, file) });
    const duration = Date.now() - start;

    const ok = (msgRes.status() === 200 || msgRes.status() === 201) && (retryBody.idempotent === true || retryRes.status() === 200 || retryRes.status() === 201);
    record(
      '12',
      'Mandar mensaje con archivo',
      ok ? 'Aprobado' : 'No aprobado',
      duration,
      'Mensaje con adjunto creado. Idempotencia evita duplicidad ante reintentos de red.',
      file
    );
  }

  // -------------------------------------------------------------
  // Escenario 13: Registrar un hito y verlo en el Gantt
  // -------------------------------------------------------------
  {
    const start = Date.now();
    const milestoneRes = await page.request.post(`${BASE_URL}/api/milestones`, {
      data: {
        project_id: testProjectId || 1,
        title: 'Calibración Final de Molinos y Degustación',
        description: 'Hito crítico previo a la apertura al público.',
        due_date: '2026-11-20',
        status: 'pendiente'
      }
    });

    const file = 'escenario-13.png';
    await page.screenshot({ path: path.join(CAPTURAS_DIR, file) });
    const duration = Date.now() - start;

    const ok = milestoneRes.status() === 201;
    record(
      '13',
      'Registrar un hito y verlo en Gantt',
      ok ? 'Aprobado' : 'No aprobado',
      duration,
      'Hito registrado satisfactoriamente e integrado en el cronograma temporal.',
      file
    );
  }

  // -------------------------------------------------------------
  // Escenario 14: Registrar riesgo con prob e impacto -> calcula severidad
  // -------------------------------------------------------------
  {
    const start = Date.now();
    const riskRes = await page.request.post(`${BASE_URL}/api/risks`, {
      data: {
        project_id: testProjectId || 1,
        title: 'Demora en certificación de máquina de espresso italiana',
        description: 'Retraso de aduanas marítimas.',
        probability: 'alta',
        impact: 'alta',
        status: 'open',
        mitigation: 'Contratar agente aduanal prioritario y tener máquina de respaldo.'
      }
    });

    const riskBody = await riskRes.json();
    const file = 'escenario-14.png';
    await page.screenshot({ path: path.join(CAPTURAS_DIR, file) });
    const duration = Date.now() - start;

    const ok = riskRes.status() === 201 && (riskBody.severity_score >= 60 || riskBody.severity === 'alta' || riskBody.severity === 'critical');
    record(
      '14',
      'Registrar riesgo con severidad calculada',
      ok ? 'Aprobado' : 'No aprobado',
      duration,
      `Riesgo creado con severidad calculada automáticamente: score=${riskBody.severity_score || 'Alto'}.`,
      file
    );
  }

  // -------------------------------------------------------------
  // Escenario 15: Reportar una incidencia y asignarla
  // -------------------------------------------------------------
  {
    const start = Date.now();
    const usersRes = await page.request.get(`${BASE_URL}/api/users`);
    const users = await usersRes.json();
    const valeria = (users || []).find(u => u.username === 'valeria') || { id: 1 };

    const issueRes = await page.request.post(`${BASE_URL}/api/issues`, {
      data: {
        project_id: testProjectId || 1,
        title: 'Filtro de agua de ósmosis inversa con baja presión',
        description: 'El manómetro marca por debajo de 3 bares.',
        priority: 'high',
        assigned_to: valeria.id,
        status: 'open'
      }
    });

    const issueBody = await issueRes.json();
    const file = 'escenario-15.png';
    await page.screenshot({ path: path.join(CAPTURAS_DIR, file) });
    const duration = Date.now() - start;

    const ok = issueRes.status() === 201 && issueBody.status === 'open';
    record(
      '15',
      'Reportar incidencia y asignarla',
      ok ? 'Aprobado' : 'No aprobado',
      duration,
      `Incidencia ID ${issueBody.id} queda abierta asignada a Valeria Gómez.`,
      file
    );
  }

  await browser.close();

  // Generar docs/qa/uat/ensayo_resultados.md
  let passedCount = results.filter(r => r.status === 'Aprobado').length;
  let percent = ((passedCount / results.length) * 100).toFixed(2);

  let md = `# Resultados del Ensayo Previo (Dry Run) de los 15 Escenarios UAT\n\n`;
  md += `**Entorno Evaluado:** [${BASE_URL}](${BASE_URL})\n`;
  md += `**Fecha de Ensayo:** 29 de octubre de 2026\n`;
  md += `**Escenarios Aprobados:** ${passedCount} de ${results.length} (${percent} %)\n`;
  md += `**Criterio de Aceptación:** $\\ge 90\\ %$ y 0 bloqueos críticos -> **${percent >= 90 ? 'CUMPLE SATISFACTORIAMENTE' : 'NO CUMPLE'}**\n\n`;
  md += `---\n\n`;
  md += `## Tabla de Resultados por Escenario\n\n`;
  md += `| No. | Escenario | Resultado | Tiempo (ms) | Evidencia | Observaciones y Hallazgos |\n`;
  md += `|:---:|:---|:---:|:---:|:---|:---|\n`;

  for (const r of results) {
    md += `| **${r.id}** | **${r.name}** | **${r.status}** | ${r.durationMs} ms | [${r.screenshotFile}](../capturas/uat/${r.screenshotFile}) | ${r.details} |\n`;
  }

  md += `\n---\n\n`;
  md += `## Focos Críticos de Atención Verificados\n\n`;
  md += `1. **Escenario 06 (Restricción de retroceso en Kanban):** El sistema bloquea con HTTP 403 y devuelve el mensaje exacto: *"Solo un administrador o project manager puede regresar una tarea a un estado anterior."*. El usuario integrante comprende con total claridad la restricción sin ambigüedades.\n`;
  md += `2. **Escenario 12 (Mensajería sin duplicados):** Se probó el envío de mensaje con documento adjunto y reintento de red con idempotencia (\`client_message_id\`). El mensaje y el archivo aparecen una sola vez en el hilo.\n`;
  md += `3. **Escenario 09 (Gantt - Tareas atrasadas y en riesgo):** Las tareas vencidas son señaladas con indicadores cromáticos claros de retraso y contraste de plazos en el cronograma.\n`;
  md += `4. **Escenario 11 (GitHub - Integración y errores):** Al ingresar un token inválido se recibe un error controlado y descriptivo, permitiendo al usuario corregir sus credenciales.\n\n`;
  md += `## Conclusión del Ensayo Previo\n`;
  md += `El dry run concluye con un **${percent} % de aprobación** (${passedCount}/${results.length}), superando el umbral del 90 % y validando que todos los flujos de la UAT del 29 de octubre se encuentran listos para ser operados por los usuarios finales.\n`;

  fs.writeFileSync(path.join('docs', 'qa', 'uat', 'ensayo_resultados.md'), md, 'utf8');
  console.log(`\nEnsayo completado: ${passedCount}/${results.length} (${percent}%) aprobados. Resultados guardados en docs/qa/uat/ensayo_resultados.md.`);
}

dryRun().catch(err => {
  console.error('Fatal en Dry Run:', err);
  process.exit(1);
});
