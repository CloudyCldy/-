const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

function createBasePdf(title, subtitle) {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 40, bottom: 40, left: 45, right: 45 }
  });

  // Header
  doc.rect(45, 35, 522, 4).fill('#ec4899'); // Sakura pink bar
  doc.moveDown(0.8);
  doc.fillColor('#0f172a').fontSize(18).font('Helvetica-Bold').text(title, { align: 'left' });
  if (subtitle) {
    doc.fillColor('#64748b').fontSize(10).font('Helvetica').text(subtitle, { align: 'left' });
  }
  doc.moveDown(0.5);
  doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(45, doc.y).lineTo(567, doc.y).stroke();
  doc.moveDown(0.8);
  return doc;
}

// 1. Registro de Participantes PDF
function generateRegistroParticipantes(outPath) {
  const doc = createBasePdf(
    'Registro de Participantes - Pruebas UAT',
    'Proyecto Haitani (Sakura Coffee) | Sesión de Aceptación: Jueves 29 de octubre de 2026'
  );
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  doc.fillColor('#334155').fontSize(9).font('Helvetica').text(
    'Instrucciones: Cada participante convocado debe registrar sus datos completos al inicio de la jornada, confirmando el rol operativo asignado y firmando al concluir su evaluación en https://rwq70fnfjj.onrender.com.'
  );
  doc.moveDown(1);

  // Table header
  const tableTop = doc.y;
  const colX = [45, 70, 210, 310, 390, 440, 490];
  const rowHeight = 32;

  doc.rect(45, tableTop, 522, 20).fill('#f1f5f9');
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8);
  doc.text('No.', colX[0] + 5, tableTop + 6);
  doc.text('Nombre Completo', colX[1] + 5, tableTop + 6);
  doc.text('Organización / Área', colX[2] + 5, tableTop + 6);
  doc.text('Rol Asignado', colX[3] + 5, tableTop + 6);
  doc.text('Entrada', colX[4] + 5, tableTop + 6);
  doc.text('Salida', colX[5] + 5, tableTop + 6);
  doc.text('Firma', colX[6] + 5, tableTop + 6);

  const rows = [
    { no: '01', org: 'Dirección Operativa', role: 'Administrador' },
    { no: '02', org: 'Gestión de Proyectos', role: 'Project Manager' },
    { no: '03', org: 'Equipo Desarrollo / Baristas', role: 'Integrante (Member)' },
    { no: '04', org: 'Aseguramiento Calidad', role: 'Observador / QA' },
    { no: '05', org: 'Auditoría / Stakeholder', role: 'Consultor (Viewer)' },
    { no: '06', org: 'Operaciones Sucursales', role: 'Integrante (Member)' },
    { no: '07', org: 'Logística y Abasto', role: 'Integrante (Member)' },
    { no: '08', org: 'Facilitación de Sesión', role: 'Facilitador / Lead' }
  ];

  let currentY = tableTop + 20;
  doc.font('Helvetica').fontSize(8).fillColor('#1e293b');
  rows.forEach((r, idx) => {
    doc.rect(45, currentY, 522, rowHeight).strokeColor('#e2e8f0').stroke();
    doc.text(r.no, colX[0] + 5, currentY + 10);
    doc.text('_______________________', colX[1] + 5, currentY + 10);
    doc.text(r.org, colX[2] + 5, currentY + 10);
    doc.text(r.role, colX[3] + 5, currentY + 10);
    doc.text('___:___', colX[4] + 5, currentY + 10);
    doc.text('___:___', colX[5] + 5, currentY + 10);
    doc.text('_______________', colX[6] + 5, currentY + 10);
    currentY += rowHeight;
  });

  doc.y = currentY + 25;
  doc.rect(45, doc.y, 522, 65).fillAndStroke('#f8fafc', '#cbd5e1');
  const boxY = doc.y + 10;
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9).text('Declaración de Conformidad:', 55, boxY);
  doc.fillColor('#475569').font('Helvetica').fontSize(8).text(
    'Los participantes firmantes confirman haber realizado de manera autónoma los 15 escenarios de prueba indicados en sus respectivas hojas individuales, registrando sus observaciones objetivas sobre la estabilidad, usabilidad y completitud funcional de Haitani.',
    55, boxY + 15, { width: 500 }
  );

  doc.moveDown(3);
  doc.strokeColor('#94a3b8').moveTo(180, doc.y).lineTo(380, doc.y).stroke();
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9).text('Firma del Facilitador Responsable', 45, doc.y + 5, { align: 'center' });

  doc.end();
}

// 2. Hoja de Escenarios PDF
function generateHojaEscenarios(outPath) {
  const doc = createBasePdf(
    'Hoja Individual de Escenarios - UAT',
    'Participante: ___________________________________ | Rol: [ ] Admin  [ ] PM  [ ] Member  [ ] Viewer'
  );
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  const escenarios = [
    { id: '01', desc: 'Iniciar sesión correcta', pass: 'Entra correctamente al panel principal' },
    { id: '02', desc: 'Contraseña incorrecta', pass: 'Muestra mensaje de error y no entra' },
    { id: '03', desc: 'Crear un proyecto', pass: 'Aparece en la lista con su porcentaje de avance' },
    { id: '04', desc: 'Crear tarea y asignarla', pass: 'Aparece en la lista con su responsable' },
    { id: '05', desc: 'Avanzar tarea en Kanban', pass: 'Cambia de columna y se guarda en el sistema' },
    { id: '06', desc: 'Restricción retroceso Kanban', pass: 'No lo permite y explica por qué (requiere PM/Admin)' },
    { id: '07', desc: 'Ciclo de vida Sprint', pass: 'Pasa por planificado, activo y cerrado con resumen' },
    { id: '08', desc: 'Historia Backlog a Sprint', pass: 'Aparece asociada a su sprint correspondiente' },
    { id: '09', desc: 'Gantt atrasadas y en riesgo', pass: 'Se identifican visualmente sin necesidad de ayuda' },
    { id: '10', desc: 'Subir y descargar documento', pass: 'Se sube y descarga íntegro sin alteraciones' },
    { id: '11', desc: 'Vincular repo GitHub', pass: 'Salen commits y ramas (error claro con token inválido)' },
    { id: '12', desc: 'Mensaje con archivo adjunto', pass: 'Aparece una sola vez en el chat (sin duplicarse)' },
    { id: '13', desc: 'Registrar hito en Gantt', pass: 'Aparece en lista de hitos y en el cronograma' },
    { id: '14', desc: 'Riesgo con prob. e impacto', pass: 'Calcula automáticamente la severidad del riesgo' },
    { id: '15', desc: 'Reportar incidencia y asignar', pass: 'Queda abierta con su responsable asignado' }
  ];

  doc.fontSize(8).fillColor('#475569').text('Marque con una cruz [X] en Aprobado o No aprobado y anote el tiempo y comentarios.');
  doc.moveDown(0.5);

  let curY = doc.y;
  const colX = [45, 70, 280, 370, 420];

  doc.rect(45, curY, 522, 16).fill('#f1f5f9');
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7.5);
  doc.text('No.', colX[0] + 3, curY + 4);
  doc.text('Escenario y Criterio de Éxito', colX[1] + 5, curY + 4);
  doc.text('Resultado', colX[2] + 5, curY + 4);
  doc.text('Tiempo', colX[3] + 5, curY + 4);
  doc.text('Comentarios / Fricciones', colX[4] + 5, curY + 4);
  curY += 16;

  escenarios.forEach((e) => {
    const rowH = 34;
    doc.rect(45, curY, 522, rowH).strokeColor('#e2e8f0').stroke();
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8).text(e.id, colX[0] + 3, curY + 4);
    doc.text(e.desc, colX[1] + 5, curY + 4);
    doc.font('Helvetica').fontSize(7).fillColor('#64748b').text('-> ' + e.pass, colX[1] + 5, curY + 16, { width: 200 });

    doc.font('Helvetica').fontSize(7.5).fillColor('#1e293b');
    doc.text('[  ] Aprobado', colX[2] + 5, curY + 6);
    doc.text('[  ] No aprobado', colX[2] + 5, curY + 18);

    doc.text('____ min', colX[3] + 5, curY + 11);
    doc.text('________________________', colX[4] + 5, curY + 11);
    curY += rowH;
  });

  doc.rect(45, curY + 8, 522, 35).fillAndStroke('#f8fafc', '#94a3b8');
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8.5).text('Resumen del Participante:', 55, curY + 14);
  doc.font('Helvetica').fontSize(8).fillColor('#334155').text(
    'Total Aprobados: [   ] / 15    |    % Aprobación: ______ %    |    Firma: ___________________________',
    55, curY + 28
  );

  doc.end();
}

// 3. Acta de Aceptación PDF
function generateActaAceptacion(outPath) {
  const doc = createBasePdf(
    'Acta Formal de Aceptación de Usuario (UAT)',
    'Proyecto Haitani v1.0.0 | Entorno Producción Render | Fecha: 29 de octubre de 2026'
  );
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  // Box Criterio
  doc.rect(45, doc.y, 522, 45).fillAndStroke('#fdf2f8', '#f472b6');
  doc.fillColor('#9d174d').font('Helvetica-Bold').fontSize(9).text('CRITERIO DE DECISIÓN OBLIGATORIO:', 55, doc.y + 8);
  doc.fillColor('#831843').font('Helvetica').fontSize(8.5).text(
    'Se acepta el sistema si se aprueba al menos el 90 % de los escenarios evaluados (mínimo 14 de 15) y ningún error crítico o bloqueante impide la culminación de una tarea principal.',
    55, doc.y + 22, { width: 500 }
  );

  doc.moveDown(3);
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11).text('Consolidado de Evaluación UAT:');
  doc.moveDown(0.5);

  const metrics = [
    { label: 'Total de Escenarios Evaluados', val: '15' },
    { label: 'Escenarios Aprobados Satisfactoriamente', val: '____' },
    { label: 'Escenarios Aprobados con Observaciones Menores', val: '____' },
    { label: 'Escenarios Bloqueantes / No Aprobados', val: '____ (Cero requerido)' },
    { label: 'Porcentaje Final de Aprobación', val: '____.__ %' }
  ];

  let mY = doc.y;
  metrics.forEach(m => {
    doc.rect(45, mY, 522, 22).strokeColor('#e2e8f0').stroke();
    doc.fillColor('#334155').font('Helvetica').fontSize(8.5).text(m.label, 55, mY + 6);
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8.5).text(m.val, 420, mY + 6);
    mY += 22;
  });

  doc.y = mY + 15;
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11).text('Dictamen Final del Comité Evaluador:');
  doc.moveDown(0.5);

  doc.rect(45, doc.y, 522, 70).fillAndStroke('#f8fafc', '#cbd5e1');
  const dY = doc.y + 8;
  doc.font('Helvetica').fontSize(8.5).fillColor('#1e293b');
  doc.text('[   ] ACEPTADO: Cumple requerimientos operativos (>= 90%) sin incidencias bloqueantes.', 55, dY);
  doc.text('[   ] ACEPTADO CON OBSERVACIONES: Cumple >= 90%, con detalles menores a corregir del 30 oct al 3 nov.', 55, dY + 18);
  doc.text('[   ] NO ACEPTADO: Menor al 90% o presencia de fallos que impiden tareas críticas.', 55, dY + 36);

  doc.moveDown(3.5);
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10).text('Firmas de Aprobación Colegiada:');
  doc.moveDown(1.5);

  const signY = doc.y;
  doc.strokeColor('#94a3b8');
  doc.moveTo(45, signY).lineTo(165, signY).stroke();
  doc.moveTo(175, signY).lineTo(295, signY).stroke();
  doc.moveTo(305, signY).lineTo(425, signY).stroke();
  doc.moveTo(435, signY).lineTo(565, signY).stroke();

  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0f172a');
  doc.text('Product Owner', 45, signY + 4, { width: 120, align: 'center' });
  doc.text('QA Lead Senior', 175, signY + 4, { width: 120, align: 'center' });
  doc.text('Líder Técnico', 305, signY + 4, { width: 120, align: 'center' });
  doc.text('Dirección Sakura Coffee', 435, signY + 4, { width: 130, align: 'center' });

  doc.end();
}

// 4. Guía Facilitador / Observador PDF
function generateGuiaFacilitador(outPath) {
  const doc = createBasePdf(
    'Guía Metodológica - Facilitador y Observador UAT',
    'Protocolo de Evaluación Sin Sesgo | Jueves 29 de octubre de 2026'
  );
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11).text('1. El Rol del Facilitador (Neutralidad Absoluta):');
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(8.5).fillColor('#334155').text(
    'Regla de Oro: El facilitador explica el OBJETIVO del escenario, NUNCA cómo hacerlo ni dónde hacer clic.\n' +
    '• Formule las consignas desde el negocio: "Tu objetivo es crear un nuevo sprint para tu equipo", no "Haz clic en la pestaña Sprints y dale al botón azul".\n' +
    '• Ante preguntas como "¿dónde pico?", responda: "¿Dónde esperarías encontrar esa acción?".\n' +
    '• En el Escenario 6 (Restricción Kanban), pregunte: "¿Qué te indica la pantalla y qué comprendes con ese aviso?".'
  );

  doc.moveDown(1);
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11).text('2. El Rol del Observador (Medición y Registro):');
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(8.5).fillColor('#334155').text(
    'Regla de Oro: El observador no interviene ni asiste al participante; anota tiempos y fricciones en silencio.\n' +
    '• Tome el tiempo exacto con cronómetro desde que el facilitador termina el enunciado hasta el resultado final.\n' +
    '• Foco crítico Escenario 9 (Gantt): Anotar si distingue tareas vencidas y en riesgo por color/icono sin pedir ayuda.\n' +
    '• Foco crítico Escenario 11 (GitHub): Verificar claridad del mensaje si el token es inválido.\n' +
    '• Foco crítico Escenario 12 (Mensajería): Confirmar que el mensaje con archivo no se duplique visualmente en el hilo.'
  );

  doc.moveDown(1);
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11).text('3. Cuadro Rápido de Enunciados Orales (Facilitador):');
  doc.moveDown(0.5);

  const scripts = [
    { esc: 'E01 - Login', text: 'Por favor, ingresa al sistema con tus credenciales asignadas.' },
    { esc: 'E02 - Password errónea', text: 'Intenta entrar con tu usuario pero ingresando una clave incorrecta.' },
    { esc: 'E03 - Nuevo Proyecto', text: 'Registra un nuevo proyecto para la sucursal de Sakura Coffee.' },
    { esc: 'E04 - Tarea & Responsable', text: 'Crea una tarea operativa y asígnala a un compañero de equipo.' },
    { esc: 'E05 - Avanzar Kanban', text: 'Como integrante, actualiza tu tarea pasándola a la siguiente fase.' },
    { esc: 'E06 - Regresar Tarea', text: 'Intenta devolver esa misma tarea a una fase o columna anterior.' },
    { esc: 'E07 - Ciclo de Sprint', text: 'Configura un sprint para tu equipo, inícialo y conclúyelo.' },
    { esc: 'E08 - Backlog a Sprint', text: 'Agrega una historia en el backlog y asígnala a tu sprint activo.' },
    { esc: 'E09 - Diagnóstico Gantt', text: 'Abre el Gantt y dime qué tareas presentan retraso o alerta de riesgo.' },
    { esc: 'E10 - Archivos', text: 'Sube un documento a la plataforma y vuélvelo a descargar.' },
    { esc: 'E11 - GitHub', text: 'Conecta el repositorio del proyecto y revisa los últimos commits.' },
    { esc: 'E12 - Chat con Adjunto', text: 'Manda un mensaje en el chat adjuntando un documento.' },
    { esc: 'E13 - Hitos', text: 'Registra una fecha clave o hito y revísala en el cronograma Gantt.' },
    { esc: 'E14 - Riesgos', text: 'Registra un riesgo indicando su probabilidad e impacto.' },
    { esc: 'E15 - Incidencias', text: 'Reporta un problema técnico y déjalo asignado a un responsable.' }
  ];

  let sY = doc.y;
  scripts.forEach(s => {
    doc.rect(45, sY, 522, 17).strokeColor('#e2e8f0').stroke();
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7.5).text(s.esc, 50, sY + 4, { width: 110 });
    doc.fillColor('#334155').font('Helvetica').fontSize(7.5).text(s.text, 165, sY + 4, { width: 395 });
    sY += 17;
  });

  doc.end();
}

// 5. Usuarios de Prueba PDF
function generateUsuariosPrueba(outPath) {
  const doc = createBasePdf(
    'Catálogo de Credenciales de Prueba - UAT',
    'Entorno Evaluado: https://rwq70fnfjj.onrender.com | Jueves 29 de octubre de 2026'
  );
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  doc.rect(45, doc.y, 522, 35).fillAndStroke('#eff6ff', '#3b82f6');
  doc.fillColor('#1e40af').font('Helvetica-Bold').fontSize(8.5).text('AVISO DE SEGURIDAD:', 55, doc.y + 6);
  doc.fillColor('#1e3a8a').font('Helvetica').fontSize(8).text(
    'Todas las credenciales son sintéticas para pruebas. Contraseña estándar: PruebaUAT2026! (o password123 en mocks). No utilizar credenciales personales ni información sensible.',
    55, doc.y + 18, { width: 500 }
  );

  doc.moveDown(2);
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11).text('Organización Principal: Sakura Coffee (Org ID: 1)');
  doc.moveDown(0.5);

  const usersA = [
    { rol: 'Administrador', name: 'Carlos Administrador', user: 'admin_sakura', email: 'admin@sakuracoffee.test', esc: 'E01, 02, 03, 04, 07, 11, 13, 14' },
    { rol: 'Project Manager', name: 'Mariana PM', user: 'pm_mariana', email: 'mariana.pm@sakuracoffee.test', esc: 'E03, 04, 07, 08, 09, 13, 14, 15' },
    { rol: 'Integrante (Member)', name: 'Valeria Gómez', user: 'valeria', email: 'valeria@sakuracoffee.test', esc: 'E04, 05, 06, 10, 12, 15' },
    { rol: 'Integrante (Member)', name: 'Carlos Mendoza', user: 'carlos', email: 'carlos@sakuracoffee.test', esc: 'E04, 05, 10, 12' },
    { rol: 'Consultor (Viewer)', name: 'Roberto Observador', user: 'viewer_roberto', email: 'roberto.viewer@sakuracoffee.test', esc: 'E09 (Gantt solo lectura)' }
  ];

  let uY = doc.y;
  doc.rect(45, uY, 522, 18).fill('#f1f5f9');
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8);
  doc.text('Rol', 50, uY + 5);
  doc.text('Nombre', 140, uY + 5);
  doc.text('Usuario / Correo', 260, uY + 5);
  doc.text('Escenarios Asignados', 430, uY + 5);
  uY += 18;

  usersA.forEach(u => {
    doc.rect(45, uY, 522, 26).strokeColor('#e2e8f0').stroke();
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8).text(u.rol, 50, uY + 5);
    doc.fillColor('#334155').font('Helvetica').fontSize(8).text(u.name, 140, uY + 5);
    doc.text(u.user + '\n' + u.email, 260, uY + 5);
    doc.text(u.esc, 430, uY + 5, { width: 130 });
    uY += 26;
  });

  doc.y = uY + 15;
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11).text('Organización Secundaria para Aislamiento: Empresa Beta (Org ID: 2)');
  doc.moveDown(0.5);

  const usersB = [
    { rol: 'Administrador Org B', name: 'Rodrigo Rival', user: 'admin_beta', email: 'admin@empresabeta.test', esc: 'Aislamiento multi-org (OAT-07)' },
    { rol: 'Integrante Org B', name: 'Sandra Beta', user: 'sandra_beta', email: 'sandra@empresabeta.test', esc: 'Aislamiento de chat y tareas' }
  ];

  uY = doc.y;
  doc.rect(45, uY, 522, 18).fill('#f1f5f9');
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8);
  doc.text('Rol', 50, uY + 5);
  doc.text('Nombre', 140, uY + 5);
  doc.text('Usuario / Correo', 260, uY + 5);
  doc.text('Propósito en Pruebas', 430, uY + 5);
  uY += 18;

  usersB.forEach(u => {
    doc.rect(45, uY, 522, 26).strokeColor('#e2e8f0').stroke();
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8).text(u.rol, 50, uY + 5);
    doc.fillColor('#334155').font('Helvetica').fontSize(8).text(u.name, 140, uY + 5);
    doc.text(u.user + '\n' + u.email, 260, uY + 5);
    doc.text(u.esc, 430, uY + 5, { width: 130 });
    uY += 26;
  });

  doc.end();
}

// Generar todos los PDFs
const uatDir = path.join('docs', 'qa', 'uat');
fs.mkdirSync(uatDir, { recursive: true });

generateRegistroParticipantes(path.join(uatDir, 'registro_participantes.pdf'));
generateHojaEscenarios(path.join(uatDir, 'hoja_escenarios.pdf'));
generateActaAceptacion(path.join(uatDir, 'acta_aceptacion.pdf'));
generateGuiaFacilitador(path.join(uatDir, 'guia_facilitador_observador.pdf'));
generateUsuariosPrueba(path.join(uatDir, 'usuarios_de_prueba.pdf'));

console.log('Todos los documentos PDF de la UAT fueron generados exitosamente en docs/qa/uat/.');
