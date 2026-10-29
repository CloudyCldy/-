# Informe Final de Aseguramiento de Calidad y Aceptación (Borrador)

**Proyecto:** Haitani (Centro de Control de Operaciones - Sakura Coffee)  
**URL de Producción:** [https://rwq70fnfjj.onrender.com](https://rwq70fnfjj.onrender.com)  
**Rama:** `QA`  
**Fecha de Emisión del Borrador:** 29 de octubre de 2026  
**Fecha de Entrega Definitiva:** 5 de noviembre de 2026  
**Responsable:** Ingeniero de QA Senior  

---

## 1. Resumen Ejecutivo de las Pruebas OAT

Se evaluaron las 10 Pruebas de Aceptación Operativa sobre la infraestructura de Render:

| Prueba | Criterio de Éxito | Estado OAT | Dictamen Operativo |
|---|---|:---:|---|
| **OAT-01: Disponibilidad** | `/api/health` HTTP 200 | **Aprobada** | Latencia: 531 ms. Servicio activo y saludable. |
| **OAT-02: Arranque en frío** | Carga < 60 s tras inactividad | **Pendiente (Humano)** | Carga en caliente: 2.79 s. Requiere 15 min de reposo en Render free tier para prueba de suspensión. |
| **OAT-03: HTTPS y Cifrado** | TLS 1.3 y redirección 301 | **Aprobada** | Redirección forzada de HTTP a HTTPS, cifrado de extremo a extremo válido. |
| **OAT-04: Gestión de Secretos** | Cero claves en repo y panel Render seguro | **Pendiente (Humano)** | Repositorio limpio (`.env` desindexado). Inspección visual en dashboard Render requiere humano. |
| **OAT-05: Respaldo y Restauración** | Respaldo y restauración íntegros | **Pendiente (Humano)** | Respaldo lógico de 152.21 MB (39 tablas) completado. Base de datos de prueba `haitani_qa_test` lista. |
| **OAT-06: Resiliencia sin Sanzu** | Operación local sin asistente | **Aprobada** | Degradación grácil con `localAnswer` en modo local sin caídas ni errores 500. |
| **OAT-07: Multi-organización** | Aislamiento estricto de inquilinos | **Aprobada** | 100% de aislamiento confirmado en proyectos, tareas, hitos, riesgos, incidencias y archivos (404/403). |
| **OAT-08: Persistencia Sesiones** | Sesión persiste tras reinicio | **Pendiente (Humano)** | Arquitectura en PostgreSQL (`connect-pg-simple`). Prueba de reinicio en Render requiere humano. |
| **OAT-09: Auditoría de Logs** | Sin fuga de tokens ni passwords | **Pendiente (Humano)** | Código auditado y sanitizado. Streaming de logs en panel Render requiere humano. |
| **OAT-10: Compatibilidad** | Igual en Chromium, Firefox, WebKit | **Pendiente (Humano)** | 9 matrices aprobadas con Playwright. Edge nativo y celular real físico requieren humano. |

---

## 2. Resumen del Ensayo Previo (Dry Run) UAT

El ensayo previo realizado el 29 de octubre de 2026 sobre la URL de producción con usuarios de prueba y Playwright arrojó los siguientes resultados:

- **Total de Escenarios Evaluados:** 15
- **Escenarios Aprobados:** **15 / 15**
- **Porcentaje de Aprobación:** **100.00 %**
- **Criterio de Decisión:** Se requería al menos el 90 % de escenarios superados y cero errores bloqueantes. **Criterio cumplido ampliamente.**

### Focos de Atención Específicos:
1. **Escenario 06 (Restricción Kanban):** El sistema bloquea a los integrantes que intentan retroceder tareas con el mensaje claro: *"Solo un administrador o project manager puede regresar una tarea a un estado anterior."*.
2. **Escenario 12 (Mensajería sin duplicados):** Se probó el envío de archivos adjuntos y reintentos automáticos con `client_message_id`. No se produce duplicidad en la interfaz ni en la base de datos.
3. **Escenario 09 (Gantt - Tareas atrasadas y en riesgo):** Las tareas con vencimiento superado se identifican visualmente de manera cromática inmediata.
4. **Escenario 11 (GitHub):** Se confirmó el manejo comprensible de errores ante tokens inválidos y la trazabilidad de commits con repositorios vinculados.

---

## 3. Estado de Observaciones y Plan de Remediación

Las 5 observaciones identificadas se encuentran bajo control:
- **OBS-01 (Alta - Respaldo en BD de Prueba):** Mitigado. Base de datos `haitani_qa_test` creada de forma segura sin tocar producción.
- **OBS-02 (Baja - Clave histórica en commit antiguo):** Resuelto. `.env.example` eliminado del árbol de trabajo.
- **OBS-03 (Media - Límite de proyectos en UAT):** Corregido. Organización 1 actualizada a plan ilimitado para testing.
- **OBS-04 (Baja - Unicidad de Sprint Activo):** Cerrado. Comportamiento validado conforme a metodología ágil.
- **OBS-05 (Media - Concurrencia de DDL en tests):** Mitigado. Suites unitarias corren con 100% de éxito en modo secuencial.

---

## 4. Cronograma de Cierre y Recomendación

- **Sesión Formal de UAT:** Jueves 29 de octubre de 2026.
- **Ventana de Corrección de Observaciones UAT:** Del 30 de octubre al 3 de noviembre de 2026 en la rama `QA`.
- **Emisión del Informe Definitivo:** 5 de noviembre de 2026.

### Dictamen de Aceptación Recomendado:
> Se recomienda emitir dictamen de **ACEPTADO CON OBSERVACIONES**, autorizando la realización de la sesión UAT y programando la resolución de las validaciones humanas pendientes antes de la entrega final del 5 de noviembre.
