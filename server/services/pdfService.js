const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generates an executive-grade PDF report containing the user's assigned tasks.
 * Includes official Haitani logo, KPI metric cards, status badges, and structured tables.
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
          Subject: 'Listado oficial de tareas asignadas'
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

      // Top brand accent bar
      doc.rect(margin, margin, contentWidth, 3.5).fill('#767E99');

      let y = margin + 10;

      // 1. BRAND HEADER WITH LOGO
      const candidatePaths = [
        path.join(__dirname, '../../public/static/img/ht.png'),
        path.resolve('public/static/img/ht.png')
      ];
      const logoPath = candidatePaths.find(p => fs.existsSync(p));

      let textStartX = margin;
      if (logoPath) {
        try {
          doc.image(logoPath, margin, y, { width: 34, height: 34 });
          textStartX = margin + 42;
        } catch {
          textStartX = margin;
        }
      }

      // Brand Title & Tagline
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#0F172A').text('HAITANI', textStartX, y + 2);
      doc.font('Helvetica').fontSize(7.5).fillColor('#64748B').text('SaaS · Gestión de Proyectos & Operaciones TI', textStartX, y + 18);

      // Header Right: Organization pill badge & date
      const headerDateStr = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
      const headerTimeStr = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

      const orgText = String(orgName || 'Haitani').trim();
      const orgBadgeWidth = Math.max(100, Math.min(180, doc.widthOfString(orgText) + 24));
      const orgBadgeX = margin + contentWidth - orgBadgeWidth;

      doc.roundedRect(orgBadgeX, y, orgBadgeWidth, 18, 4).fillAndStroke('#F1F5F9', '#CBD5E1');
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#1E293B').text(orgText, orgBadgeX, y + 4.5, {
        align: 'center',
        width: orgBadgeWidth
      });

      doc.font('Helvetica').fontSize(7.5).fillColor('#64748B').text(`Emisión: ${headerDateStr} · ${headerTimeStr}`, margin, y + 22, {
        align: 'right',
        width: contentWidth
      });

      y += 42;
      doc.moveTo(margin, y).lineTo(margin + contentWidth, y).strokeColor('#E2E8F0').lineWidth(0.75).stroke();

      // 2. DOCUMENT TITLE SECTION
      y += 12;
      doc.font('Helvetica-Bold').fontSize(17).fillColor('#0F172A').text('Reporte de Tareas Asignadas', margin, y);
      y += 20;
      doc.font('Helvetica').fontSize(8.5).fillColor('#64748B').text('Control individual de compromisos, entregables y fechas límite del integrante.', margin, y);

      // 3. USER PROFILE CARD
      y += 15;
      const userCardHeight = 44;
      doc.roundedRect(margin, y, contentWidth, userCardHeight, 6).fillAndStroke('#F8FAFC', '#E2E8F0');

      // Left: User info
      const uY = y + 8;
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#0F172A').text(user.name || 'Usuario', margin + 12, uY);
      doc.font('Helvetica').fontSize(8).fillColor('#475569').text(
        `Usuario: @${user.username || 'usuario'}   ·   Correo: ${user.email || 'N/A'}`,
        margin + 12,
        uY + 14
      );

      // Right: Role pill
      const roleName = user.role === 'admin'
        ? 'ADMINISTRADOR'
        : (user.role === 'project_manager' ? 'PROJECT MANAGER' : 'INTEGRANTE');
      const roleBadgeW = 105;
      const roleBadgeX = margin + contentWidth - roleBadgeW - 12;

      doc.roundedRect(roleBadgeX, uY + 3, roleBadgeW, 18, 9).fillAndStroke('#EEF2FF', '#C7D2FE');
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#4338CA').text(roleName, roleBadgeX, uY + 7.5, {
        align: 'center',
        width: roleBadgeW
      });

      // 4. KPI SUMMARY DASHBOARD
      y += userCardHeight + 12;
      const totalCount = tasks.length;
      const inProgressCount = tasks.filter(t => t.status === 'en_proceso').length;
      const pendingCount = tasks.filter(t => t.status === 'pendiente').length;
      const completedCount = tasks.filter(t => t.status === 'completada').length;
      const urgentCount = tasks.filter(t => ['critica', 'alta'].includes(t.priority)).length;

      const kpiData = [
        { label: 'TOTAL ASIGNADAS', val: totalCount, color: '#0F172A', bg: '#FFFFFF', border: '#CBD5E1' },
        { label: 'EN PROCESO', val: inProgressCount, color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
        { label: 'PENDIENTES', val: pendingCount, color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
        { label: 'COMPLETADAS', val: completedCount, color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
        { label: 'ALTA / CRÍTICA', val: urgentCount, color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' }
      ];

      const kpiGap = 7;
      const kpiWidth = (contentWidth - (kpiGap * (kpiData.length - 1))) / kpiData.length;
      const kpiHeight = 38;

      kpiData.forEach((kpi, idx) => {
        const kX = margin + idx * (kpiWidth + kpiGap);
        doc.roundedRect(kX, y, kpiWidth, kpiHeight, 5).fillAndStroke(kpi.bg, kpi.border);
        doc.font('Helvetica-Bold').fontSize(14).fillColor(kpi.color).text(String(kpi.val), kX, y + 6, {
          align: 'center',
          width: kpiWidth
        });
        doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#64748B').text(kpi.label, kX, y + 23, {
          align: 'center',
          width: kpiWidth
        });
      });

      // 5. TABLE SECTION
      y += kpiHeight + 16;
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#0F172A').text(`Detalle de Actividades (${tasks.length})`, margin, y);
      y += 14;

      // Table columns (edge-to-edge total: 523pt)
      const cols = [
        { name: 'Tarea y Descripción', x: margin, w: 195 },
        { name: 'Proyecto / Sprint', x: margin + 195, w: 110 },
        { name: 'Estado', x: margin + 305, w: 78 },
        { name: 'Prioridad', x: margin + 383, w: 65 },
        { name: 'Fecha Límite', x: margin + 448, w: 75 }
      ];

      function drawTableHeader(curY) {
        doc.rect(margin, curY, contentWidth, 20).fill('#1E293B');
        cols.forEach(col => {
          doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#FFFFFF').text(col.name.toUpperCase(), col.x + 6, curY + 6, {
            width: col.w - 10
          });
        });
        return curY + 20;
      }

      y = drawTableHeader(y);

      const statusConfig = {
        pendiente: { text: 'Pendiente', color: '#B45309', bg: '#FEF3C7', border: '#FDE68A' },
        en_proceso: { text: 'En proceso', color: '#1D4ED8', bg: '#DBEAFE', border: '#BFDBFE' },
        en_revision: { text: 'En revisión', color: '#6D28D9', bg: '#EDE9FE', border: '#DDD6FE' },
        bloqueada: { text: 'Bloqueada', color: '#B91C1C', bg: '#FEE2E2', border: '#FECACA' },
        completada: { text: 'Completada', color: '#047857', bg: '#D1FAE5', border: '#A7F3D0' }
      };

      const priorityConfig = {
        baja: { text: 'Baja', color: '#0F766E' },
        media: { text: 'Media', color: '#1D4ED8' },
        alta: { text: 'Alta', color: '#C2410C' },
        critica: { text: 'Crítica', color: '#B91C1C' }
      };

      if (tasks.length === 0) {
        doc.rect(margin, y, contentWidth, 48).fillAndStroke('#FFFFFF', '#E2E8F0');
        doc.font('Helvetica').fontSize(9).fillColor('#64748B').text('Actualmente no tienes tareas asignadas en esta organización.', margin, y + 18, {
          align: 'center',
          width: contentWidth
        });
        y += 48;
      } else {
        const todayStr = new Date().toISOString().slice(0, 10);

        tasks.forEach((task, index) => {
          const hasDesc = Boolean(task.description && String(task.description).trim());
          const rowHeight = hasDesc ? 34 : 26;

          // Check for page break
          if (y + rowHeight > pageHeight - margin - 32) {
            doc.addPage();
            doc.rect(margin, margin, contentWidth, 3.5).fill('#767E99');
            y = margin + 14;
            y = drawTableHeader(y);
          }

          // Row background
          const rowBg = index % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
          doc.rect(margin, y, contentWidth, rowHeight).fillAndStroke(rowBg, '#F1F5F9');

          // Col 1: Title & description
          doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0F172A').text(task.title || 'Sin título', cols[0].x + 6, y + 5, {
            width: cols[0].w - 12,
            height: 12,
            ellipsis: true
          });
          if (hasDesc) {
            doc.font('Helvetica').fontSize(7).fillColor('#64748B').text(task.description.replace(/[\r\n]+/g, ' '), cols[0].x + 6, y + 18, {
              width: cols[0].w - 12,
              height: 10,
              ellipsis: true
            });
          }

          // Col 2: Project & Sprint
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#334155').text(task.project_name || 'Sin proyecto', cols[1].x + 6, y + 5, {
            width: cols[1].w - 12,
            height: 12,
            ellipsis: true
          });
          if (task.sprint_name) {
            doc.font('Helvetica-Oblique').fontSize(7).fillColor('#64748B').text(task.sprint_name, cols[1].x + 6, y + 17, {
              width: cols[1].w - 12,
              height: 10,
              ellipsis: true
            });
          }

          // Col 3: Status Badge
          const st = statusConfig[task.status] || { text: task.status || 'Pendiente', color: '#475569', bg: '#F1F5F9', border: '#CBD5E1' };
          const badgeW = 66;
          const badgeH = 14;
          const badgeX = cols[2].x + 4;
          const badgeY = y + (rowHeight - badgeH) / 2;

          doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 3).fillAndStroke(st.bg, st.border);
          doc.font('Helvetica-Bold').fontSize(7).fillColor(st.color).text(st.text, badgeX, badgeY + 3.5, {
            align: 'center',
            width: badgeW
          });

          // Col 4: Priority
          const pr = priorityConfig[task.priority] || { text: task.priority || 'Media', color: '#334155' };
          doc.font('Helvetica-Bold').fontSize(8).fillColor(pr.color).text(pr.text, cols[3].x + 6, y + (rowHeight / 2) - 4, {
            width: cols[3].w - 10
          });

          // Col 5: Due Date
          let dateStr = '—';
          let isOverdue = false;
          if (task.due_date) {
            const rawDue = String(task.due_date).slice(0, 10);
            isOverdue = task.status !== 'completada' && rawDue < todayStr;
            const d = new Date(task.due_date);
            if (!isNaN(d.getTime())) {
              const dd = String(d.getDate()).padStart(2, '0');
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const yy = d.getFullYear();
              dateStr = `${dd}/${mm}/${yy}`;
            }
          }

          const dateColor = isOverdue ? '#DC2626' : '#334155';
          doc.font(isOverdue ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5).fillColor(dateColor).text(dateStr, cols[4].x + 6, y + (rowHeight / 2) - 4, {
            width: cols[4].w - 10
          });

          y += rowHeight;
        });
      }

      // 6. PAGE NUMBERS & FOOTER
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);

        // Footer divider
        doc.moveTo(margin, pageHeight - 30).lineTo(margin + contentWidth, pageHeight - 30).strokeColor('#E2E8F0').lineWidth(0.5).stroke();

        doc.font('Helvetica').fontSize(7).fillColor('#94A3B8').text(
          'Haitani SaaS · Centro de Control Operativo',
          margin,
          pageHeight - 22,
          { width: 180 }
        );

        doc.font('Helvetica').fontSize(7.5).fillColor('#64748B').text(
          `Página ${i + 1} de ${range.count}`,
          margin,
          pageHeight - 22,
          { align: 'center', width: contentWidth }
        );

        doc.font('Helvetica').fontSize(7).fillColor('#94A3B8').text(
          `Documento emitido para ${user.name || 'usuario'}`,
          margin,
          pageHeight - 22,
          { align: 'right', width: contentWidth }
        );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateTasksPdf };
