const STORY_TEMPLATES = [
  {
    id: 'historia_usuario',
    name: 'Historia de Usuario (Estándar)',
    type: 'story',
    description: 'Estructura ágil con rol, necesidad, beneficio y criterios Given/When/Then.',
    content: `### Historia de Usuario
**Como** [tipo de usuario o rol],
**Quiero** [funcionalidad o acción deseada],
**Para** [valor de negocio o beneficio obtenido].

### Criterios de Aceptación (Gherkin)
- **Escenario 1:** Flujo principal exitoso
  - **Dado que** [contexto inicial o precondición]
  - **Cuando** [acción ejecutada por el usuario]
  - **Entonces** [resultado observable y esperado]

- **Escenario 2:** Flujo alternativo o validación de error
  - **Dado que** [condición de entrada inválida o caso borde]
  - **Cuando** [el usuario intenta la acción]
  - **Entonces** [se muestra mensaje descriptivo y se bloquea la operación]

### Criterios de Terminado (DoD)
- [ ] Pruebas unitarias y de integración pasando.
- [ ] Revisión de código (Code Review) aprobada.
- [ ] Documentación técnica actualizada.`
  },
  {
    id: 'reporte_bug',
    name: 'Reporte de Error (Bug Report)',
    type: 'story',
    description: 'Documentación estructurada de fallos con pasos para reproducir.',
    content: `### Descripción del Problema
[Resumen conciso y claro del fallo o comportamiento anómalo]

### Pasos para Reproducir
1. Ir a la vista [...]
2. Hacer clic en [...]
3. Ingresar los datos de prueba [...]
4. Confirmar la acción.

### Comportamiento Esperado vs. Obtenido
- **Esperado:** [Lo que el sistema debería hacer según los requerimientos]
- **Obtenido:** [Lo que realmente ocurre, incluyendo logs, códigos de error o capturas]

### Entorno y Severidad
- **Navegador / Sistema:** [Ej. Chrome 120 / Windows 11]
- **Severidad:** [Crítica | Alta | Media | Baja]
- **Datos afectados:** [IDs de registros o cuentas de prueba]`
  },
  {
    id: 'tarea_tecnica_spike',
    name: 'Tarea Técnica / Spike (Investigación)',
    type: 'story',
    description: 'Investigación técnica, refactor o prueba de concepto con timebox.',
    content: `### Objetivo del Spike / Tarea Técnica
[Hipótesis arquitectónica, librería o desafío técnico a investigar]

### Alcance y Entregables
- [ ] Análisis comparativo de alternativas técnicas.
- [ ] Prueba de concepto (PoC) funcional y reproducible.
- [ ] Registro de Decisión Arquitectónica (ADR) o propuesta de solución.

### Criterios de Salida (Timebox)
- **Tiempo límite estimado:** [Ej. 1 día / 8 horas]
- **Definición de Terminado:** Presentación de conclusiones y recomendación formal al equipo.`
  }
];

const SPRINT_TEMPLATES = [
  {
    id: 'sprint_estandar',
    name: 'Planificación de Sprint Estándar',
    type: 'sprint',
    description: 'Sprint regular enfocado en incremento de valor, capacidad y mitigación de riesgos.',
    content: `### Objetivo del Sprint (Sprint Goal)
[Definición clara y medible del incremento de valor a entregar en este ciclo]

### Capacidad y Disponibilidad del Equipo
- **Integrantes activos:** [Número de desarrolladores / diseñadores]
- **Días hábiles:** [Días laborables en el rango del sprint]
- **Capacidad estimada:** [Puntos de historia / Horas disponibles]

### Entregables Clave
1. [Épica o hito prioritario 1]
2. [Épica o hito prioritario 2]
3. [Épica o hito prioritario 3]

### Riesgos y Mitigación
- **Riesgo:** [Dependencias externas, bloqueos potenciales]
  - **Mitigación:** [Acción preventiva acordada]`
  },
  {
    id: 'sprint_estabilizacion',
    name: 'Sprint de Estabilización y Calidad (Bugfix / Hardening)',
    type: 'sprint',
    description: 'Ciclo enfocado en resolución de deuda técnica, pruebas y preparación de release.',
    content: `### Objetivo del Sprint (Sprint Goal)
[Estabilizar la versión, abatir deuda técnica acumulada y asegurar release con cero defectos críticos]

### Enfoque de Calidad y Criterios
- [ ] Resolución del 100% de bugs bloqueantes y críticos.
- [ ] Refactorización de módulos de alto acoplamiento.
- [ ] Incremento de cobertura de pruebas automatizadas (>80%).
- [ ] Auditoría de seguridad y verificación de permisos.

### Criterios de Aceptación del Release
- Pruebas E2E y de regresión ejecutadas con éxito en entorno de staging.
- Plan de rollback y ventana de despliegue documentados.`
  }
];

function getTemplates(type) {
  if (type === 'story') return STORY_TEMPLATES;
  if (type === 'sprint') return SPRINT_TEMPLATES;
  return {
    story: STORY_TEMPLATES,
    sprint: SPRINT_TEMPLATES
  };
}

module.exports = {
  STORY_TEMPLATES,
  SPRINT_TEMPLATES,
  getTemplates
};
