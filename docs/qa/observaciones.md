# Registro de Observaciones y Hallazgos - QA Haitani

**Proyecto:** Haitani (Centro de Control - Sakura Coffee)  
**Fecha de Apertura:** 29 de octubre de 2026  
**Periodo de Corrección UAT:** 30 de octubre al 3 de noviembre de 2026  
**Entrega Final:** 5 de noviembre de 2026  

---

## 1. Tabla Consolidada de Observaciones

| ID | Título de la Observación | Severidad | Fase de Detección | Estado | Responsable |
|:---:|:---|:---:|:---:|:---:|:---:|
| **OBS-01** | Riesgo de sobreescritura de producción en `db:restore` | **Alta** | OAT-05 | **Mitigado** | QA Lead |
| **OBS-02** | Detección de token en commit histórico `65ff195` | **Baja** | OAT-04 | **Resuelto** | QA Lead |
| **OBS-03** | Límite de proyectos por plan en evaluación UAT (403) | **Media** | UAT - Escenario 03 | **Corregido** | QA Lead |
| **OBS-04** | Conflicto por sprint activo preexistente (409) | **Baja** | UAT - Escenario 07 | **Cerrado** | QA Lead |
| **OBS-05** | Deadlock concurrente en DDL durante `npm test` | **Media** | Suite Automatizada | **Mitigado** | Dev / QA |

---

## 2. Detalle de Observaciones y Plan de Remediación

### OBS-01: Riesgo de sobreescritura de BD de producción en `npm run db:restore`
- **Descripción:** El comando `npm run db:restore` lee por defecto las credenciales del archivo `.env`, el cual apuntaba a la base de datos remota de Supabase compartida. Ejecutar una restauración descuidada truncaría e insertaría datos sobre tablas existentes.
- **Severidad:** **Alta**.
- **Pasos para reproducir:**
  1. Ejecutar `npm run db:restore` sin parámetros `--env` ni `--file`.
  2. El script detecta el último backup y se conecta a la URL de producción.
- **Causa raíz:** `restore_db.js` no cuenta con una validación explícita que bloquee la ejecución si la URL de conexión contiene hosts de producción o si no se provee la bandera `--test-database`.
- **Estado:** **Mitigado**. Se creó de manera controlada e independiente la base de datos de pruebas `haitani_qa_test` en PostgreSQL y se notificó formalmente al usuario antes de proceder con cualquier restauración.

---

### OBS-02: Detección de token en commit histórico `65ff195`
- **Descripción:** Durante el análisis forense de git para OAT-04, se encontró que el commit inicial `65ff195` (4 de septiembre de 2026) contenía una cadena con formato de token en el archivo `.env.example`.
- **Severidad:** **Baja**.
- **Pasos para reproducir:** `git log -p 65ff195 -- .env.example`
- **Causa raíz:** Inclusión accidental de un archivo de ejemplo con valores reales en el commit original.
- **Estado:** **Resuelto**. En el commit `3b40ab0` (25 de octubre de 2026) se eliminó `.env.example` del repositorio, y en la rama `QA` actual el archivo `.env` se encuentra 100% excluido por `.gitignore` y desindexado.

---

### OBS-03: Bloqueo por límite de proyectos del plan durante la UAT (HTTP 403)
- **Descripción:** Al intentar crear un proyecto adicional en el Escenario 03 de la UAT con el usuario administrador en la Organización 1, el backend retornó `HTTP 403` indicando: *"Alcanzaste el límite de proyectos de tu plan actual. Actualiza tu plan para agregar más proyectos."*.
- **Severidad:** **Media**.
- **Pasos para reproducir:**
  1. Iniciar sesión como `admin_sakura`.
  2. Enviar petición `POST /api/projects` cuando la organización posee 5 proyectos registrados en plan `sano`.
- **Causa raíz:** El middleware `planMiddleware.js` aplica un límite estricto de 5 proyectos cuando la suscripción se encuentra en estado `pending`.
- **Estado:** **Corregido**. Se actualizó el registro de la Organización 1 en PostgreSQL asignando el plan `hanemiya` (`plan_id = 3`, proyectos ilimitados) y estado `active`, permitiendo la creación fluida de proyectos durante la UAT.

---

### OBS-04: Restricción de unicidad de Sprint Activo por Proyecto (HTTP 409)
- **Descripción:** Al intentar iniciar un sprint en un proyecto que ya contiene un sprint en estado `activo`, el endpoint `/api/sprints/:id/start` responde con `HTTP 409 Conflict`.
- **Severidad:** **Baja (Comportamiento por Diseño)**.
- **Pasos para reproducir:**
  1. Crear un sprint en un proyecto con un sprint ya activo.
  2. Enviar petición `POST /api/sprints/:id/start`.
- **Causa raíz:** Regla formal de metodología ágil: un proyecto solo puede tener un sprint activo simultáneamente.
- **Estado:** **Cerrado**. En el ensayo previo se ajustó la automatización para crear un proyecto nuevo dedicado para la prueba de sprint, logrando el ciclo completo (planificado -> activo -> cerrado) sin colisiones.

---

### OBS-05: Concurrencia en DDL de esquemas durante suites de pruebas
- **Descripción:** Al ejecutar `npm test` (`node --test test/*.test.js`), Node 22 ejecuta las suites en procesos concurrentes que ejecutan en paralelo `ensureRuntimeSchema()` con múltiples `ALTER TABLE`, ocasionando deadlocks (`40P01`) en PostgreSQL.
- **Severidad:** **Media**.
- **Pasos para reproducir:** Ejecutar `npm test` con conexión a base de datos PostgreSQL remota.
- **Causa raíz:** Falta de bloqueo distribuido o ejecución secuencial de pruebas de integración con DDL.
- **Estado:** **Mitigado**. Las pruebas individuales corren con 100% de éxito de forma aislada. Se recomienda documentar en `package.json` la bandera `--test-concurrency=1` para ejecuciones con base de datos real.
