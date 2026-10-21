/**
 * Registro extensible de Metodologías de Desarrollo de Software.
 * Cumple con el requisito de diseño extensible: registrar una nueva metodología
 * no requiere modificar ninguna ruta existente ni controlador base.
 */
class MethodologyRegistry {
  constructor() {
    this.coreMethodologies = new Map();
    this.initDefaults();
  }

  initDefaults() {
    const defaults = [
      {
        id: 'SCRUM',
        name: 'Scrum',
        description: 'Framework ágil iterativo e incremental basado en sprints (1-4 semanas), roles estructurados (Product Owner, Scrum Master, Developers), ceremonias y artefactos para entrega rápida de valor.',
        category: 'agile',
        principles: ['Transparencia', 'Inspección', 'Adaptación'],
        practices: ['Sprint Planning', 'Daily Standup', 'Sprint Review', 'Sprint Retrospective', 'Gestión de Sprint Backlog'],
        is_custom: false
      },
      {
        id: 'KANBAN',
        name: 'Kanban',
        description: 'Método visual para gestionar y optimizar el flujo de trabajo continuo, enfocado en limitar el trabajo en curso (WIP) y maximizar el rendimiento del equipo.',
        category: 'agile',
        principles: ['Empezar con lo que haces ahora', 'Perseguir el cambio evolutivo incremental', 'Fomentar el liderazgo en todos los niveles'],
        practices: ['Visualizar el flujo', 'Limitar el trabajo en curso (WIP)', 'Gestionar y medir el flujo', 'Políticas explícitas'],
        is_custom: false
      },
      {
        id: 'XP',
        name: 'Extreme Programming',
        description: 'Metodología ágil orientada a la ingeniería de software con altos estándares técnicos, releases frecuentes, refactorización y pruebas automatizadas.',
        category: 'agile',
        principles: ['Comunicación', 'Simplicidad', 'Retroalimentación continua', 'Coraje', 'Respeto'],
        practices: ['TDD (Desarrollo guiado por pruebas)', 'Pair Programming', 'Integración Continua', 'Refactorización', 'Propiedad colectiva del código'],
        is_custom: false
      },
      {
        id: 'LEAN',
        name: 'Lean Software Development',
        description: 'Filosofía ágil derivada de la manufactura esbelta orientada a maximizar el valor entregado al cliente minimizando el desperdicio y optimizando el flujo de valor.',
        category: 'agile',
        principles: ['Eliminar desperdicios', 'Amplificar el aprendizaje', 'Decidir lo más tarde posible', 'Entregar lo más rápido posible', 'Empoderar al equipo'],
        practices: ['Mapeo del flujo de valor (VSM)', 'Sistemas Pull', 'Mejora continua (Kaizen)', 'Ciclos de entrega cortos'],
        is_custom: false
      },
      {
        id: 'WATERFALL',
        name: 'Waterfall (Cascada)',
        description: 'Modelo secuencial tradicional dividido en fases claramente delimitadas (Requerimientos, Diseño, Implementación, Verificación y Mantenimiento), ideal para proyectos con especificaciones fijas.',
        category: 'traditional',
        principles: ['Planificación rigurosa previa', 'Secuencia estricta entre fases', 'Documentación formal exhaustiva'],
        practices: ['Cronograma Gantt detallado', 'Aprobaciones formales por fase', 'Gestión estricta de cambios'],
        is_custom: false
      },
      {
        id: 'AGILE',
        name: 'Ágil Genérico',
        description: 'Enfoque ágil flexible y colaborativo basado en los valores del Manifiesto Ágil: personas e interacciones sobre procesos, y respuesta al cambio sobre planes rígidos.',
        category: 'agile',
        principles: ['Individuos e interacciones sobre procesos y herramientas', 'Software funcionando sobre documentación extensiva', 'Colaboración con el cliente', 'Respuesta ante el cambio'],
        practices: ['Iteraciones cortas', 'Historias de usuario', 'Revisión y retroalimentación frecuente'],
        is_custom: false
      },
      {
        id: 'HYBRID',
        name: 'Metodología Híbrida',
        description: 'Enfoque adaptativo que combina la estructura de planificación y control de Waterfall con la flexibilidad y velocidad de entrega iterativa de Scrum y Kanban.',
        category: 'hybrid',
        principles: ['Gobernanza estructurada a nivel macro', 'Ejecución ágil a nivel micro', 'Equilibrio entre previsibilidad y adaptabilidad'],
        practices: ['Hitos globales y fases con sprints ágiles', 'Líneas base presupuestales combinadas con backlog iterativo'],
        is_custom: false
      }
    ];

    for (const m of defaults) {
      this.coreMethodologies.set(m.id.toUpperCase(), m);
    }
  }

  /**
   * Registra una nueva metodología en el registro en memoria.
   * Extensible: No altera rutas ni requiere reiniciar controladores.
   */
  register(methodology) {
    if (!methodology || !methodology.id || !methodology.name) {
      throw new Error('La metodología debe contener al menos un identificador (id) y un nombre (name).');
    }
    const id = String(methodology.id).trim().toUpperCase();
    const item = {
      id,
      name: String(methodology.name).trim(),
      description: String(methodology.description || '').trim(),
      category: String(methodology.category || 'agile').trim().toLowerCase(),
      principles: Array.isArray(methodology.principles) ? methodology.principles : [],
      practices: Array.isArray(methodology.practices) ? methodology.practices : [],
      is_custom: methodology.is_custom !== undefined ? Boolean(methodology.is_custom) : true
    };
    this.coreMethodologies.set(id, item);
    return item;
  }

  has(id) {
    if (!id) return false;
    return this.coreMethodologies.has(String(id).trim().toUpperCase());
  }

  get(id) {
    if (!id) return null;
    return this.coreMethodologies.get(String(id).trim().toUpperCase()) || null;
  }

  getAll() {
    return Array.from(this.coreMethodologies.values());
  }
}

// Instancia singleton del registro de metodologías
const registry = new MethodologyRegistry();

module.exports = {
  MethodologyRegistry,
  registry
};
