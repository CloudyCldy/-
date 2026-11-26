// Asistente de IA (modo local): saludo, redacción con o sin metodología y "¿quién tiene más tareas?".
process.env.NODE_ENV = 'test';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { localAnswer } = require('../server/controllers/assistantController');

const ayer = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
const contexto = (methodology_id = null) => ({
  repositoryName: 'Sakura Coffee',
  project: { name: 'Sakura Coffee', methodology_id },
  tasks: [
    { title: 'Diseño de interfaz', status: 'pendiente', priority: 'alta', due_date: ayer, assignee_name: 'Ana', assignee_id: 2 },
    { title: 'API de pagos', status: 'en_progreso', priority: 'media', due_date: null, assignee_name: 'Ana', assignee_id: 2 },
    { title: 'Pruebas', status: 'completada', priority: 'media', due_date: null, assignee_name: 'Luis', assignee_id: 3 },
  ],
  users: [{ id: 2, name: 'Ana', active: true }, { id: 3, name: 'Luis', active: true }],
  sprints: [], milestones: [], issues: [], risks: [],
});

describe('Asistente de IA en modo local', () => {
  it('responde un saludo corto con lo que puede hacer', () => {
    const r = localAnswer('Hola', contexto());
    assert.match(r, /^¡Hola! Soy el asistente de Sakura Coffee/);
    assert.match(r, /vencidas/);
  });

  it('un saludo con pregunta contesta la pregunta, no el saludo', () => {
    const r = localAnswer('hola, ¿qué tareas están vencidas?', contexto());
    assert.doesNotMatch(r, /^¡Hola!/);
    assert.match(r, /Diseño de interfaz/);
  });

  it('sin metodología no dice "Con metodología sin metodología definida"', () => {
    const r = localAnswer('¿Qué tareas están vencidas?', contexto());
    assert.doesNotMatch(r, /sin metodología definida,/);
    assert.match(r, /^Hay 1 tarea\(s\) vencida\(s\)/);
  });

  it('con metodología la menciona al inicio', () => {
    const r = localAnswer('¿Qué tareas están vencidas?', contexto('SCRUM'));
    assert.match(r, /^Con la metodología SCRUM, hay 1 tarea\(s\) vencida\(s\)/);
  });

  it('"¿Quién tiene más tareas?" muestra la carga por integrante', () => {
    const r = localAnswer('¿Quién tiene más tareas?', contexto());
    assert.match(r, /carga de trabajo/i);
    assert.match(r, /Ana: 2 tarea\(s\) abierta\(s\)/);
  });
});
