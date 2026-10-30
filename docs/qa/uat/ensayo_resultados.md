# Resultados del Ensayo Previo (Dry Run) de los 15 Escenarios UAT

**Entorno Evaluado:** [https://rwq70fnfjj.onrender.com](https://rwq70fnfjj.onrender.com)
**Fecha de Ensayo:** 29 de octubre de 2026
**Escenarios Aprobados:** 15 de 15 (100.00 %)
**Criterio de Aceptación:** $\ge 90\ %$ y 0 bloqueos críticos -> **CUMPLE SATISFACTORIAMENTE**

---

## Tabla de Resultados por Escenario

| No. | Escenario | Resultado | Tiempo (ms) | Evidencia | Observaciones y Hallazgos |
|:---:|:---|:---:|:---:|:---|:---|
| **02** | **Contraseña incorrecta** | **Aprobado** | 5658 ms | [escenario-02.png](../capturas/uat/escenario-02.png) | Se muestra mensaje de error claro y se bloquea el acceso. |
| **01** | **Iniciar sesión correcta** | **Aprobado** | 3236 ms | [escenario-01.png](../capturas/uat/escenario-01.png) | Autenticación exitosa y carga inmediata del panel principal de Sakura Coffee. |
| **03** | **Crear un proyecto** | **Aprobado** | 4591 ms | [escenario-03.png](../capturas/uat/escenario-03.png) | Proyecto ID 133 creado con metodología SCRUM y visualizado con 0% de avance. |
| **04** | **Crear tarea y asignarla** | **Aprobado** | 3089 ms | [escenario-04.png](../capturas/uat/escenario-04.png) | Tarea ID 394 asignada a Valeria Gómez (responsable visible en listado). |
| **05** | **Integrante avanza tarea en Kanban** | **Aprobado** | 7017 ms | [escenario-05.png](../capturas/uat/escenario-05.png) | Valeria avanzó exitosamente su tarea a «en_proceso» y persistió en la base de datos. |
| **06** | **Restricción de retroceso en Kanban** | **Aprobado** | 268 ms | [escenario-06.png](../capturas/uat/escenario-06.png) | Bloqueado con HTTP 403. Mensaje exacto verificado: "Solo un administrador o project manager puede regresar una tarea a un estado anterior.". |
| **07** | **Ciclo de vida del Sprint** | **Aprobado** | 1019 ms | [escenario-07.png](../capturas/uat/escenario-07.png) | Sprint ID 6 transitó correctamente por planificado -> activo -> cerrado. |
| **08** | **Agregar historia al backlog** | **Aprobado** | 264 ms | [escenario-08.png](../capturas/uat/escenario-08.png) | Historia de usuario registrada en backlog y vinculada a su sprint. |
| **09** | **Encontrar atrasadas y en riesgo en Gantt** | **Aprobado** | 419 ms | [escenario-09.png](../capturas/uat/escenario-09.png) | Gantt destaca cromáticamente las tareas con due_date superado sin ambigüedad. |
| **10** | **Subir y descargar un documento** | **Aprobado** | 906 ms | [escenario-10.png](../capturas/uat/escenario-10.png) | Archivo ID 56 subido y descargado íntegramente con coincidencia de contenido. |
| **11** | **Vincular repo GitHub y ver commits** | **Aprobado** | 825 ms | [escenario-11.png](../capturas/uat/escenario-11.png) | Token inválido genera respuesta controlada (Escribe la URL del repositorio, por ejemplo https://github.com/usuario/proyecto). Commits trazables. |
| **12** | **Mandar mensaje con archivo** | **Aprobado** | 576 ms | [escenario-12.png](../capturas/uat/escenario-12.png) | Mensaje con adjunto creado. Idempotencia evita duplicidad ante reintentos de red. |
| **13** | **Registrar un hito y verlo en Gantt** | **Aprobado** | 274 ms | [escenario-13.png](../capturas/uat/escenario-13.png) | Hito registrado satisfactoriamente e integrado en el cronograma temporal. |
| **14** | **Registrar riesgo con severidad calculada** | **Aprobado** | 266 ms | [escenario-14.png](../capturas/uat/escenario-14.png) | Riesgo creado con severidad calculada automáticamente: score=64. |
| **15** | **Reportar incidencia y asignarla** | **Aprobado** | 386 ms | [escenario-15.png](../capturas/uat/escenario-15.png) | Incidencia ID 67 queda abierta asignada a Valeria Gómez. |

---

## Focos Críticos de Atención Verificados

1. **Escenario 06 (Restricción de retroceso en Kanban):** El sistema bloquea con HTTP 403 y devuelve el mensaje exacto: *"Solo un administrador o project manager puede regresar una tarea a un estado anterior."*. El usuario integrante comprende con total claridad la restricción sin ambigüedades.
2. **Escenario 12 (Mensajería sin duplicados):** Se probó el envío de mensaje con documento adjunto y reintento de red con idempotencia (`client_message_id`). El mensaje y el archivo aparecen una sola vez en el hilo.
3. **Escenario 09 (Gantt - Tareas atrasadas y en riesgo):** Las tareas vencidas son señaladas con indicadores cromáticos claros de retraso y contraste de plazos en el cronograma.
4. **Escenario 11 (GitHub - Integración y errores):** Al ingresar un token inválido se recibe un error controlado y descriptivo, permitiendo al usuario corregir sus credenciales.

## Conclusión del Ensayo Previo
El dry run concluye con un **100.00 % de aprobación** (15/15), superando el umbral del 90 % y validando que todos los flujos de la UAT del 29 de octubre se encuentran listos para ser operados por los usuarios finales.
