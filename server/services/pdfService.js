const PDFDocument = require('pdfkit');

/**
 * Generates an executive PDF report containing the user's assigned tasks.
 * Uses standard PDF fonts (Helvetica) to ensure offline reliability and high performance.
 *
 * @param {object} user - User object { name, username, email, role }
 * @param {string} orgName - Organization name
 * @param {Array<object>} tasks - List of tasks with project_name, sprint_name, status, priority, due_date
 * @returns {Promise<Buffer>}
 */
function generateTasksPdf(user, orgName, tasks = []) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 36,
        size: 'A4',
        bufferPages: true,
        info: {
          Title: `Reporte de Tareas - ${user.name || 'Usuario'}`,
          Author: 'Haitani',
          Subject: 'Listado de tareas asignadas'
        }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 36;
      const contentWidth = pageWidth - (margin * 2);

      // Top decorative brand bar
      doc.rect(margin, margin, contentWidth, 3.5).fill('#767E99');

      // Header top
      let y = margin + 12;
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#767E99').text('HAITANI · GESTIÓN DE PROYECTOS IT', margin, y);
      y += 12;
      doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text('Reporte de Tareas Asignadas', margin, y);

      const headerDateStr = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
      const headerTimeStr = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#111827').text(orgName || 'Haitani', margin, y - 10, { align: 'right', width: contentWidth });
      doc.font('Helvetica').fontSize(8).fillColor('#6B7280').text(`Emisión: ${headerDateStr} · ${headerTimeStr}`, margin, y + 4, { align: 'right', width: contentWidth });

      y += 24;
      doc.font('Helvetica').fontSize(8.5).fillColor('#6B7280').text('Control operativo de entregables y compromisos asignados al integrante.', margin, y);

      // User Information Box
      y += 16;
      doc.roundedRect(margin, y, contentWidth, 42, 4).fillAndStroke('#F9FAFB', '#E5E7EB');
      const uY = y + 8;
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#111827').text(`Integrante: ${user.name || 'Usuario'}`, margin + 10, uY);
      doc.font('Helvetica').fontSize(8).fillColor('#4B5563').text(`Usuario: @${user.username || 'usuario'}   |   Correo: ${user.email || 'N/A'}`, margin + 10, uY + 14);
      const roleStr = user.role === 'admin' ? 'Administrador' : (user.role === 'project_manager' ? 'Project Manager' : 'Miembro / Integrante');
      doc.font('Helvetica').fontSize(8).fillColor('#6B7280').text(`Rol: ${roleStr}`, margin + 300, uY + 14, { align: 'right', width: contentWidth - 310 });

      // KPI Metrics Cards
      y += 50;
      const totalCount = tasks.length;
      const inProgressCount = tasks.filter(t => t.status === 'en_proceso').length;
      const pendingCount = tasks.filter(t => t.status === 'pendiente').length;
      const completedCount = tasks.filter(t => t.status === 'completada').length;
      const urgentCount = tasks.filter(t => ['critica', 'alta'].includes(t.priority)).length;

      const kpiData = [
        { label: 'TOTAL TAREAS', val: totalCount, color: '#111827' },
        { label: 'EN PROCESO', val: inProgressCount, color: '#2563EB' },
        { label: 'PENDIENTES', val: pendingCount, color: '#D97706' },
        { label: 'COMPLETADAS', val: completedCount, color: '#059669' },
        { label: 'ALTA / CRÍTICA', val: urgentCount, color: '#DC2626' }
      ];

      const kpiGap = 8;
      const kpiWidth = (contentWidth - (kpiGap * (kpiData.length - 1))) / kpiData.length;
      kpiData.forEach((kpi, idx) => {
        const kX = margin + idx * (kpiWidth + kpiGap);
        doc.roundedRect(kX, y, kpiWidth, 38, 4).fillAndStroke('#FFFFFF', '#E5E7EB');
        doc.font('Helvetica-Bold').fontSize(14).fillColor(kpi.color).text(String(kpi.val), kX, y + 6, { align: 'center', width: kpiWidth });
        doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#6B7280').text(kpi.label, kX, y + 23, { align: 'center', width: kpiWidth });
      });

      // Section title
      y += 48;
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text(`Detalle de Tareas (${tasks.length})`, margin, y);
      y += 14;

      // Table column definitions
      const cols = [
        { name: 'Tarea', x: margin, w: 200 },
        { name: 'Proyecto / Sprint', x: margin + 200, w: 110 },
        { name: 'Estado', x: margin + 310, w: 75 },
        { name: 'Prioridad', x: margin + 385, w: 60 },
        { name: 'Fecha Límite', x: margin + 445, w: 78 }
      ];

      function drawTableHeader(curY) {
        doc.rect(margin, curY, contentWidth, 18).fill('#F3F4F6');
        doc.rect(margin, curY, contentWidth, 18).stroke('#E5E7EB');
        cols.forEach(col => {
          doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#4B5563').text(col.name.toUpperCase(), col.x + 4, curY + 5, { width: col.w - 8 });
        });
        return curY + 18;
      }

      y = drawTableHeader(y);

      const statusMap = {
        pendiente: { text: 'Pendiente', color: '#D97706' },
        en_proceso: { text: 'En proceso', color: '#2563EB' },
        en_revision: { text: 'En revisión', color: '#7C3AED' },
        bloqueada: { text: 'Bloqueada', color: '#DC2626' },
        completada: { text: 'Completada', color: '#059669' }
      };

      const priorityMap = {
        baja: { text: 'Baja', color: '#059669' },
        media: { text: 'Media', color: '#2563EB' },
        alta: { text: 'Alta', color: '#D97706' },
        critica: { text: 'Crítica', color: '#DC2626' }
      };

      if (tasks.length === 0) {
        doc.rect(margin, y, contentWidth, 42).fillAndStroke('#FFFFFF', '#E5E7EB');
        doc.font('Helvetica').fontSize(9).fillColor('#6B7280').text('No tienes tareas asignadas actualmente.', margin, y + 16, { align: 'center', width: contentWidth });
        y += 42;
      } else {
        tasks.forEach((task, index) => {
          const rowHeight = task.description ? 34 : 26;
          // Check if space is needed for a new page
          if (y + rowHeight > pageHeight - margin - 30) {
            doc.addPage();
            doc.rect(margin, margin, contentWidth, 3.5).fill('#767E99');
            y = margin + 14;
            y = drawTableHeader(y);
          }

          const bg = index % 2 === 0 ? '#FFFFFF' : '#FAFAFA';
          doc.rect(margin, y, contentWidth, rowHeight).fillAndStroke(bg, '#F3F4F6');

          // Title & description
          doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111827').text(task.title || 'Sin título', cols[0].x + 4, y + 5, {
            width: cols[0].w - 8,
            height: 12,
            ellipsis: true
          });
          if (task.description) {
            doc.font('Helvetica').fontSize(7).fillColor('#6B7280').text(task.description.replace(/[\r\n]+/g, ' '), cols[0].x + 4, y + 17, {
              width: cols[0].w - 8,
              height: 10,
              ellipsis: true
            });
          }

          // Project & Sprint
          doc.font('Helvetica').fontSize(8).fillColor('#374151').text(task.project_name || 'Sin proyecto', cols[1].x + 4, y + 5, {
            width: cols[1].w - 8,
            height: 12,
            ellipsis: true
          });
          if (task.sprint_name) {
            doc.font('Helvetica-Oblique').fontSize(7).fillColor('#6B7280').text(task.sprint_name, cols[1].x + 4, y + 16, {
              width: cols[1].w - 8,
              height: 10,
              ellipsis: true
            });
          }

          // Status
          const st = statusMap[task.status] || { text: task.status || 'Pendiente', color: '#4B5563' };
          doc.font('Helvetica-Bold').fontSize(8).fillColor(st.color).text(st.text, cols[2].x + 4, y + 7, {
            width: cols[2].w - 8
          });

          // Priority
          const pr = priorityMap[task.priority] || { text: task.priority || 'Media', color: '#4B5563' };
          doc.font('Helvetica-Bold').fontSize(8).fillColor(pr.color).text(pr.text, cols[3].x + 4, y + 7, {
            width: cols[3].w - 8
          });

          // Due date
          let dateStr = '—';
          if (task.due_date) {
            const d = new Date(task.due_date);
            if (!isNaN(d.getTime())) {
              const dd = String(d.getDate()).padStart(2, '0');
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const yy = d.getFullYear();
              dateStr = `${dd}/${mm}/${yy}`;
            }
          }
          doc.font('Helvetica').fontSize(8).fillColor('#374151').text(dateStr, cols[4].x + 4, y + 7, {
            width: cols[4].w - 8
          });

          y += rowHeight;
        });
      }

      // Add page numbers on all pages
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        doc.font('Helvetica').fontSize(7.5).fillColor('#9CA3AF').text(
          `Haitani · ${orgName || 'Organización'}   |   Generado para ${user.name || 'usuario'}   |   Página ${i + 1} de ${range.count}`,
          margin,
          pageHeight - 24,
          { align: 'center', width: contentWidth }
        );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateTasksPdf };
