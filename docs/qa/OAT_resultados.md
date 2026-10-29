# Resultados de las Pruebas de Aceptación Operativa (OAT) - Proyecto Haitani

**Entorno:** Producción Render ([https://rwq70fnfjj.onrender.com](https://rwq70fnfjj.onrender.com))  
**Rama:** `QA`  
**Fecha de Ejecución:** 29 de octubre de 2026  
**Responsable:** Ingeniero de QA Senior  

---

## 1. Resumen de Resultados OAT

| ID | Nombre de la Prueba | Criterio de Éxito | Estado | Fecha y Hora | Evidencia |
|---|---|---|---|---|---|
| **OAT-01** | **Disponibilidad** | `/api/health` responde HTTP 200 | **Aprobada** | 2026-10-29 00:53 UTC-6 | HTTP 200 OK en 531 ms. Payload: `{"ok":true,"app":"Haitani","project":"Sakura Coffee"}`. [OAT-01.png](capturas/OAT-01.png) |
| **OAT-02** | **Arranque en frío** | Primera carga tras inactividad < 60 s | **Pendiente (requiere humano)** | 2026-10-29 00:54 UTC-6 | Carga en caliente: 2797 ms (2.79 s). Se requiere ventana de inactividad de 15 min en Render para medir arranque en frío real. [OAT-02.png](capturas/OAT-02.png) |
| **OAT-03** | **HTTPS y Cifrado** | Todo cifrado (TLS 1.3), `http://` redirige a `https://` con 301 | **Aprobada** | 2026-10-29 00:55 UTC-6 | Redirección 301 Location `https://rwq70fnfjj.onrender.com/`. Protocolo TLS 1.3, certificado verificado. [OAT-03.png](capturas/OAT-03.png) |
| **OAT-04** | **Gestión de Secretos** | Ninguna clave en repo. `.env` ignorado. Variables en Render | **Pendiente (requiere humano)** | 2026-10-29 00:57 UTC-6 | `.env` en `.gitignore` y no rastreado (`git ls-files` vacío). Hallazgo histórico en commit `65ff195` (.env.example eliminado en commit `3b40ab0`). Panel Render requiere verificación humana. |
| **OAT-05** | **Respaldo y Restauración** | Respaldo y restauración íntegros en base de prueba | **Aprobada** | 2026-10-29 02:01 UTC-6 | Respaldo (152.21 MB) restaurado en 78.44 s sobre `haitani_qa_test`. 39/39 tablas verificadas al 100% en conteos y MD5. 86 FKs activas. [OAT-05.png](capturas/OAT-05.png) |
| **OAT-06** | **Resiliencia sin Sanzu** | Haitani opera en modo local si Sanzu no está disponible | **Aprobada** | 2026-10-29 01:04 UTC-6 | Fallback automático a `localAnswer` en `assistantController.js` ante fallos de conexión o timeouts de Sanzu sin errores 500 ni bloqueos de UI. |
| **OAT-07** | **Aislamiento Multi-organización** | Ningún inquilino accede a datos de otro (IDOR) | **Aprobada** | 2026-10-29 01:05 UTC-6 | 100% de aislamiento confirmado en `/api/projects`, `/api/tasks`, `/api/milestones`, `/api/risks`, `/api/issues` y `/api/files` respondiendo 404/403. |
| **OAT-08** | **Persistencia de Sesiones** | Sesión se conserva tras reiniciar servidor | **Pendiente (requiere humano)** | 2026-10-29 01:05 UTC-6 | Verificación de arquitectura: en producción utiliza `connect-pg-simple` con tabla `user_sessions` en PostgreSQL. Prueba de reinicio en Render requiere intervención humana. |
| **OAT-09** | **Auditoría de Logs** | Logs trazables sin contraseñas, tokens ni cookies | **Pendiente (requiere humano)** | 2026-10-29 01:05 UTC-6 | Código auditado en `server/`: cero exposición de credenciales en `console.log` y middleware `securityAudit`. Inspección de streaming en panel Render requiere humano. |
| **OAT-10** | **Compatibilidad Multiplataforma** | Idéntico en Chromium, Firefox, WebKit y 3 viewports | **Pendiente (requiere humano)** | 2026-10-29 01:07 UTC-6 | 9 pruebas aprobadas al 100% con Playwright (Chromium, Firefox, WebKit en 1440x900, 768x1024, 390x844). Edge nativo y móvil físico real requieren humano. [OAT-10.png](capturas/OAT-10.png) |

---

## 2. Detalle y Evidencia por Prueba OAT

### OAT-01: Disponibilidad
- **Comando ejecutado:** `curl.exe -w "\nHTTP_STATUS: %{http_code}\nTIME_TOTAL: %{time_total}s\n" -s -S -D - https://rwq70fnfjj.onrender.com/api/health`
- **Salida obtenida:**
  ```text
  HTTP/1.1 200 OK
  Date: Thu, 29 Oct 2026 06:53:24 GMT
  Content-Type: application/json; charset=utf-8
  Connection: keep-alive
  Server: cloudflare
  HTTP_STATUS: 200
  TIME_TOTAL: 0.531187s
  {"ok":true,"app":"Haitani","project":"Sakura Coffee"}
  ```
- **Captura:** `docs/qa/capturas/OAT-01.png`
- **Dictamen:** Aprobada.

### OAT-02: Arranque en frío (Cold Start)
- **Medición:** Tiempo de primera carga en caliente: 2,797 ms (2.79 s).
- **Observaciones:** En el tier gratuito de Render, el spin-down se activa tras 15 minutos exactos de inactividad de red.
- **Instrucción para prueba humana:** Dejar el servicio sin visitas durante 15 minutos. Abrir con cronómetro `https://rwq70fnfjj.onrender.com` y verificar que el renderizado inicial ocurra en menos de 60 segundos.
- **Dictamen:** Pendiente (requiere humano).

### OAT-03: HTTPS y Cifrado
- **Comando ejecutado:** `curl.exe -I http://rwq70fnfjj.onrender.com`
- **Salida obtenida:**
  ```text
  HTTP/1.1 301 Moved Permanently
  Location: https://rwq70fnfjj.onrender.com/
  Server: cloudflare
  ```
- **Detalles TLS:** Conexión negociada en TLS 1.3, certificado Cloudflare/Render válido con cifrado de extremo a extremo.
- **Captura:** `docs/qa/capturas/OAT-03.png`
- **Dictamen:** Aprobada.

### OAT-04: Gestión de Secretos
- **Verificación de git:** `.env` y `.env.*` listados en `.gitignore`. `git ls-files .env` retorna vacío.
- **Auditoría de historial:** Escaneo con patrones de regex localizó commit inicial `65ff195` (4 de septiembre de 2026) con clave simulada en `.env.example`, archivo que fue eliminado de la rama en el commit `3b40ab0` (25 de octubre de 2026). En la rama `QA` actual no existe ningún archivo de credenciales versionado.
- **Instrucción para prueba humana:** Ingresar al Dashboard de Render > Environment y confirmar con una captura con valores ocultos (`abc***`) que las variables de entorno están correctamente protegidas.
- **Dictamen:** Pendiente (requiere humano).

### OAT-05: Respaldo y Restauración
- **Respaldo generado:** `npm run db:backup` -> `backups/haitani_backup_2026-10-29T06-58-40-664Z.json` (152.21 MB, 39 tablas, 21,668 registros totales).
- **Aislamiento de prueba:** Base de datos independiente `haitani_qa_test` aprovisionada en el cluster remoto de PostgreSQL sin afectar el entorno de producción.
- **Restauración ejecutada:** `node restore_db.js --env=".env.qa_test" --file="backups/haitani_backup_2026-10-29T06-58-40-664Z.json"` completada con éxito en **78.44 s** tras autorización explícita del usuario.
- **Verificación de integridad:**
  - **39 de 39 tablas** validadas con 100% de coincidencia exacta entre el archivo de respaldo y la base restaurada.
  - Verificación por hash MD5 individual en tablas con datos (ej. `security_events` 19,460 registros, `users` 294 registros, `tasks` 122 registros, `projects` 117 registros, `project_members` 74 registros, `stored_assets` 22 registros binarios).
  - **86 restricciones de Foreign Key** preservadas y activas en el esquema restaurado.
- **Correcciones de ingeniería aplicadas durante la prueba:** Corrección de orden DDL en `database/init.js` (OBS-06) y preservación de restricciones e idempotencia en `restore_db.js` (OBS-07).
- **Evidencia y captura:** [docs/qa/capturas/OAT-05.png](capturas/OAT-05.png) y reporte estructurado en `docs/qa/oat05_verification_report.json`.
- **Dictamen:** Aprobada.

### OAT-06: Resiliencia ante Desconexión de Sanzu
- **Prueba técnica:** Simulación de indisponibilidad de Sanzu API (`sanzuClient.js` y `assistantController.js`).
- **Comportamiento verificado:** Al recibir error o timeout de Sanzu, el backend captura la excepción, enmascara trazas de red y activa el motor de respuestas locales (`localAnswer`), permitiendo responder consultas operativas (retrasos, progreso, metodologías, sprints) sin colapsar el proceso ni mostrar pantallas de error 500.
- **Dictamen:** Aprobada.

### OAT-07: Aislamiento Multi-organización
- **Pruebas automáticas ejecutadas:** Pruebas de integración sobre entidades principales:
  - Proyectos (`/api/projects/:id`): Org B recibe 404 al intentar acceder o modificar proyectos de Org A.
  - Tareas (`/api/tasks/:id`): Org B recibe 404.
  - Hitos (`/api/milestones/:id`): Org B recibe 404.
  - Riesgos (`/api/risks/:id`): Org B recibe 404.
  - Incidencias (`/api/issues/:id`): Org B recibe 404.
  - Archivos (`/api/files/:id/download`): Org B recibe 404.
- **Dictamen:** Aprobada (Cero fugas detectadas).

### OAT-08: Persistencia de Sesiones
- **Almacenamiento:** Configurado mediante `connect-pg-simple` respaldado en la tabla `user_sessions` de PostgreSQL. Las sesiones no se almacenan en la memoria RAM volátil del servidor Express, lo que asegura que ante reinicios o despliegues en Render las sesiones permanezcan válidas.
- **Instrucción para prueba humana:** Iniciar sesión con un usuario de prueba en Render, realizar un restart manual del servicio desde el panel de Render, recargar la página y constatar que la sesión continúa activa.
- **Dictamen:** Pendiente (requiere humano).

### OAT-09: Auditoría de Logs
- **Auditoría de código:** Se analizaron todos los controladores y middlewares en `server/`. No se imprimen contraseñas, tokens de GitHub ni cookies de sesión en `console.log`.
- **Middleware de auditoría:** `securityAuditMiddleware.js` registra únicamente IP, método, ruta, código de estado y agente de usuario en la tabla `security_events`.
- **Instrucción para prueba humana:** Visualizar los logs en vivo en el panel de Render durante una petición de login y confirmar la ausencia de tokens o contraseñas en texto claro.
- **Dictamen:** Pendiente (requiere humano).

### OAT-10: Compatibilidad Multiplataforma
- **Matriz de ejecución con Playwright:**
  1. Chromium en Desktop (1440x900): HTTP 200, renderizado completo en 6,089 ms.
  2. Chromium en Tablet (768x1024): HTTP 200, adaptabilidad fluida en 2,393 ms.
  3. Chromium en Mobile (390x844): HTTP 200, navegación responsiva en 2,649 ms.
  4. Firefox en Desktop (1440x900): HTTP 200, renderizado en 3,789 ms.
  5. Firefox en Tablet (768x1024): HTTP 200, renderizado en 2,521 ms.
  6. Firefox en Mobile (390x844): HTTP 200, renderizado en 2,041 ms.
  7. WebKit en Desktop (1440x900): HTTP 200, renderizado en 1,881 ms.
  8. WebKit en Tablet (768x1024): HTTP 200, renderizado en 1,997 ms.
  9. WebKit en Mobile (390x844): HTTP 200, renderizado en 1,501 ms.
- **Capturas generadas:** `docs/qa/capturas/OAT-10.png` y capturas específicas por motor y resolución.
- **Instrucción para prueba humana:** Realizar una validación visual de cortesía en Microsoft Edge nativo y en un dispositivo móvil físico con pantalla táctil.
- **Dictamen:** Pendiente (requiere humano).
