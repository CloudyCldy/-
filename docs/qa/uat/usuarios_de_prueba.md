# Catálogo de Usuarios de Prueba - UAT

**Proyecto:** Haitani (Centro de Control - Sakura Coffee)  
**Fecha de Emisión:** Jueves 29 de octubre de 2026  
**Ambiente:** [https://rwq70fnfjj.onrender.com](https://rwq70fnfjj.onrender.com)  

---

## 1. Consideraciones de Seguridad y Uso
> [!IMPORTANT]
> - Todos los usuarios listados a continuación son cuentas de prueba sintéticas destinadas exclusivamente a la evaluación de la UAT.
> - Ninguna cuenta posee contraseñas reales ni accesos a servicios bancarios, llaves de producción ni información personal identificable (PII).
> - La contraseña estándar de prueba para todos los usuarios en este entorno es: `PruebaUAT2026!` (o `password123` en el entorno mock local de Playwright).

---

## 2. Matriz de Usuarios de Prueba por Rol y Organización

### Organización Principal: Sakura Coffee (Org ID: 1)

| No. | Rol Operativo | Nombre Completo | Nombre de Usuario | Correo Electrónico | Contraseña Ficticia | Escenarios UAT Asociados |
|:---:|:---|:---|:---|:---|:---|:---|
| **01** | **Administrador** | Carlos Administrador | `admin_sakura` | `admin@sakuracoffee.test` | `PruebaUAT2026!` | Escenarios 01, 02, 03, 04, 07, 11, 13, 14 |
| **02** | **Project Manager** | Mariana Project Manager | `pm_mariana` | `mariana.pm@sakuracoffee.test` | `PruebaUAT2026!` | Escenarios 03, 04, 07, 08, 09, 13, 14, 15 |
| **03** | **Integrante (Member)** | Valeria Gómez | `valeria` | `valeria@sakuracoffee.test` | `PruebaUAT2026!` | Escenarios 04, 05, 06, 10, 12, 15 |
| **04** | **Integrante (Member)** | Carlos Mendoza | `carlos` | `carlos@sakuracoffee.test` | `PruebaUAT2026!` | Escenarios 04, 05, 10, 12 |
| **05** | **Consultor (Viewer)** | Roberto Observador | `viewer_roberto` | `roberto.viewer@sakuracoffee.test` | `PruebaUAT2026!` | Escenario 09 (Gantt solo lectura) |

### Organización Secundaria para Aislamiento (Org ID: 2 - Empresa Beta)

| No. | Rol Operativo | Nombre Completo | Nombre de Usuario | Correo Electrónico | Contraseña Ficticia | Propósito en Pruebas |
|:---:|:---|:---|:---|:---|:---|:---|
| **06** | **Administrador Org B** | Rodrigo Rival | `admin_beta` | `admin@empresabeta.test` | `PruebaUAT2026!` | Verificación de aislamiento multi-tenant |
| **07** | **Integrante Org B** | Sandra Beta | `sandra_beta` | `sandra@empresabeta.test` | `PruebaUAT2026!` | Verificación de aislamiento de chat y tareas |

---

## 3. Mapeo de Escenarios vs. Usuarios Asignados

| Escenario | Rol Mínimo Requerido | Usuario Sugerido | Criterio de Verificación |
|:---|:---|:---|:---|
| **01. Iniciar sesión correcta** | Cualquier rol | `admin_sakura` / `valeria` | Autenticación y acceso al panel de control |
| **02. Contraseña incorrecta** | Cualquier rol | `admin_sakura` (con clave errónea) | Rechazo con 401 y mensaje de error |
| **03. Crear proyecto** | Admin / PM | `admin_sakura` / `pm_mariana` | Alta de proyecto con metodología ágil |
| **04. Crear y asignar tarea** | Admin / PM | `admin_sakura` | Tarea asignada a `valeria` visible en su bandeja |
| **05. Avanzar tarea en Kanban** | Integrante (Member) | `valeria` | Mover su propia tarea de Pendiente a En Proceso |
| **06. Restricción retroceso** | Integrante (Member) | `valeria` | Intento de mover de En Proceso a Pendiente (Bloqueado con 403) |
| **07. Ciclo Sprint** | Admin / PM | `pm_mariana` | Transición planificado -> activo -> cerrado |
| **08. Backlog a Sprint** | Admin / PM | `pm_mariana` | Asignación de historia de usuario |
| **09. Tareas atrasadas Gantt** | Cualquier rol | `valeria` / `viewer_roberto` | Detección visual cromática |
| **10. Subir y bajar doc** | Member / PM | `carlos` | Subida y descarga íntegra |
| **11. GitHub Commits** | Admin / PM | `admin_sakura` | Vinculación y lectura de historial |
| **12. Mensaje con archivo** | Member | `valeria` (a `carlos`) | Envío único sin duplicidad |
| **13. Registrar hito** | Admin / PM | `pm_mariana` | Visualización en Gantt |
| **14. Matriz de riesgo** | Admin / PM | `pm_mariana` | Cálculo automático de severidad |
| **15. Reportar incidencia** | Member | `carlos` (asignada a `valeria`) | Creación de issue y notificación |
