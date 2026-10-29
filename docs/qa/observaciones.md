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
| **OBS-06** | Fallo DDL en `init.js` por orden de `ALTER TABLE projects` | **Alta** | OAT-05 | **Corregido** | QA / Dev |
| **OBS-07** | Pérdida de FKs y mutación de `project_members` en `restore_db.js` | **Crítica** | OAT-05 | **Corregido** | QA / Dev |

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


---

### OBS-06: Fallo DDL en `database/init.js` al aprovisionar bases de datos limpias
- **Descripción:** Al inicializar una base de datos nueva o vacía mediante `node database/init.js` o durante el primer paso de `restore_db.js`, el proceso abortaba con el error `relation "projects" does not exist`.
- **Severidad:** **Alta**.
- **Pasos para reproducir:**
  1. Conectarse a una base de datos PostgreSQL vacía.
  2. Ejecutar `node database/init.js`.
- **Causa raíz:** En `database/init.js`, la línea 44 ejecutaba `ALTER TABLE projects ADD COLUMN IF NOT EXISTS sanzu_api_key TEXT;` dentro del bloque de configuración de la tabla `organizations`, 76 líneas antes de que `CREATE TABLE IF NOT EXISTS projects` se ejecutara en la línea 120. En bases de datos existentes la sentencia pasaba desapercibida, pero en cualquier base de datos limpia provocaba fallo inmediato.
- **Estado:** **Corregido**. Se reubicó la sentencia `ALTER TABLE projects ADD COLUMN IF NOT EXISTS sanzu_api_key TEXT;` inmediatamente después de la creación y configuración de la tabla `projects` (línea 140). Commit asociado en la rama `QA`.

---

### OBS-07: Pérdida permanente de Foreign Keys y mutación de datos en `restore_db.js`
- **Descripción:** Durante la ejecución de `restore_db.js`, el script eliminaba todas las restricciones Foreign Key en el paso 4.3 (`DROP CONSTRAINT`), pero al terminar invocaba `init()`, el cual no re-crea restricciones en tablas existentes por el uso de `CREATE TABLE IF NOT EXISTS`. Además, `init()` ejecutaba una migración retroactiva (`INSERT INTO project_members ... SELECT p.id, u.id ...`) que inflaba la tabla de 74 a 304 registros no auténticos.
- **Severidad:** **Crítica**.
- **Pasos para reproducir:**
  1. Ejecutar `restore_db.js` sobre una base de datos con restricciones relacionales.
  2. Comprobar `pg_constraint` tras finalizar la restauración.
- **Causa raíz:**
  1. Falta de almacenamiento de la definición DDL de cada Foreign Key antes de su eliminación temporal.
  2. Invocación redundante a `init()` al final de la restauración, ejecutando sentencias de migración que alteran los datos reales restaurados.
- **Estado:** **Corregido**.
  1. Se modificó el paso 4.3 para consultar `pg_get_constraintdef(oid)` preservando la definición exacta de cada Foreign Key.
  2. Se actualizó el paso 4.7 para reestablecer individualmente cada restricción mediante `ALTER TABLE <tabla> ADD CONSTRAINT <nombre> <definicion>`.
  3. Se eliminó la invocación mutativa a `init()` al término de la carga, logrando una restauración 100% fiel con 86 restricciones Foreign Key activas y los 74 registros legítimos de miembros de proyecto.
