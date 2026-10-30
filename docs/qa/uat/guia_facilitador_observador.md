# Guía Metodológica para Facilitador y Observador - UAT

**Proyecto:** Haitani (Centro de Control de Operaciones - Sakura Coffee)  
**Fecha de Aplicación:** Jueves 29 de octubre de 2026  
**Objetivo:** Garantizar una ejecución estandarizada, neutra y objetiva de las pruebas de aceptación de usuario sin sesgos inducidos.

---

## 1. El Rol del Facilitador (Neutralidad y Enunciación Funcional)

### Principio Fundamental:
> **El Facilitador explica el OBJETIVO del escenario, NUNCA cómo hacerlo ni dónde hacer clic.**

### Reglas de Oro para el Facilitador:
1. **No guiar la navegación:** No use frases como *"Haz clic en el botón rosa de arriba a la derecha"* ni *"Ve a la pestaña de Proyectos"*.
2. **Formulación basada en necesidades de negocio:**
   - *Correcto:* «Tu objetivo ahora es registrar el nuevo proyecto de la sucursal Centro utilizando la metodología Scrum».
   - *Incorrecto:* «Abre el menú, dale a Nuevo Proyecto, llena el formulario y dale a Guardar».
3. **Manejo de bloqueos o dudas del usuario:**
   - Si el participante pregunta: *«¿Dónde creo la tarea?»*, responder neutramente: *«¿Dónde esperarías encontrar la opción para crear una tarea en tu día a día?»*.
   - Si el participante se encuentra bloqueado por más de 3 minutos, registrar el hallazgo de usabilidad antes de brindar una orientación mínima.
4. **Validación de mensajes del sistema:**
   - En el **Escenario 6 (Restricción de retroceso en Kanban)**, pregunte: *«¿Qué te indica la pantalla y qué entiendes con ese mensaje?»*, asegurando que el mensaje de restricción sea comprendido de forma natural.

---

## 2. El Rol del Observador (Medición y Registro de Evidencia)

### Principio Fundamental:
> **El Observador no interviene verbalmente; mide tiempos, registra fricciones visuales, gestos y comentarios espontáneos.**

### Métricas y Puntos de Observación Obligatorios:
1. **Medición del Tiempo de Ejecución ($T$):** Iniciar cronómetro cuando el facilitador termina de enunciar el objetivo y detenerlo cuando el usuario completa la acción o se declara bloqueado.
2. **Registro de Vacilaciones y Desorientación:** Anotar si el usuario realiza clics erráticos, si busca repetidamente en menús equivocados o si ignora elementos gráficos evidentes.
3. **Escenarios de Atención Especial:**
   - **Escenario 9 (Gantt - Tareas atrasadas y en riesgo):** Anotar si el usuario distingue los colores o iconos de atraso de inmediato o si requiere explorar la pantalla detenidamente.
   - **Escenario 11 (GitHub - Integración y errores):** Anotar la reacción del usuario ante la vinculación del repositorio y si comprende los mensajes de error en caso de credenciales inválidas.
   - **Escenario 12 (Mensajería instantánea):** Verificar si el mensaje con documento adjunto aparece de inmediato y que **no** se duplique visualmente en el hilo de conversación.
4. **Consignación de Hallazgos:** Cada incidente debe categorizarse inmediatamente en:
   - *Fricción de Usabilidad (UX):* La acción se logró pero requirió esfuerzo excesivo o causó confusión.
   - *Error Funcional (Bug):* El sistema falló, mostró un error inesperado o no guardó la información.

---

## 3. Guion de Instrucción Escenario por Escenario (Facilitador)

| Escenario | Enunciado Oral del Facilitador al Participante | Qué Debe Observar y Medir el Observador |
|:---:|:---|:---|
| **01** | «Por favor, ingresa al sistema utilizando las credenciales asignadas para tu rol». | Tiempo hasta el primer render del panel principal. Ausencia de recargas forzadas. |
| **02** | «Intenta ingresar con tu usuario pero con una contraseña incorrecta». | Claridad y tono del mensaje de advertencia. El usuario no debe ingresar bajo ninguna circunstancia. |
| **03** | «Imagina que hoy arranca un nuevo proyecto. Regístralo en la plataforma». | Facilidad para encontrar la creación de proyecto y visualización inmediata del avance en 0%. |
| **04** | «Crea una nueva tarea operativa y asígnala a uno de tus compañeros de equipo». | Claridad del selector de responsables y confirmación en el listado. |
| **05** | «Como integrante del equipo, actualiza tu tarea pasándola a la siguiente fase en el tablero». | Fluidez del drag-and-drop o cambio de estado; persistencia del cambio en base de datos. |
| **06** | «Intenta devolver esa misma tarea a una columna o estado anterior». | Reacción del usuario ante la restricción. Comprensión del mensaje de permisos. |
| **07** | «Configura un sprint para tu equipo, inícialo y posteriormente realiza su cierre». | Claridad de los estados planificado, activo y cerrado y del resumen presentado. |
| **08** | «Registra una nueva historia en el backlog y vincúlala a tu sprint activo». | Facilidad de priorización y asignación al sprint en ejecución. |
| **09** | «Abre el diagrama de Gantt y dime cuáles tareas presentan retraso o riesgo». | Facilidad de interpretación visual sin necesidad de manuales ni leyendas complejas. |
| **10** | «Sube un documento de especificación a la plataforma y vuelve a descargarlo». | Integridad del archivo descargado, coincidencia de tamaño y nombre. |
| **11** | «Conecta el repositorio de código del proyecto y revisa la actividad reciente». | Aparición clara de ramas y commits recientes. |
| **12** | «Envía un mensaje a un compañero adjuntando un archivo en el chat». | Verificación estricta de que el mensaje y archivo no salgan duplicados en el chat. |
| **13** | «Programa una fecha límite o hito clave y corrobora su posición en el cronograma». | Visibilidad del hito tanto en la lista como en la barra temporal del Gantt. |
| **14** | «Registra un posible riesgo para el proyecto indicando su probabilidad e impacto». | Comprensión del cálculo automático de severidad asignado por el sistema. |
| **15** | «Reporta un problema o incidencia técnica y colócalo a cargo de un responsable». | Registro en estado abierto y notificación al responsable asignado. |
