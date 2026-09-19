const state = { user: null, plan: null, tasks: [], users: [], files: [], dashboard: null, notifications: { messages: 0, tasks: 0 }, listPages: { files: 1, tasks: 1, members: 1 }, kanbanTimer: null };
const app = document.querySelector('#app');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
function iconAsset(name, alt = '', className = '') { return `<img class="icon-image ${className}" src="/static/img/${name}.png" alt="${esc(alt || name)}">`; }
function paginateItems(items, pageKey, pageSize = 8) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(Number(state.listPages[pageKey] || 1), 1), totalPages);
  state.listPages[pageKey] = currentPage;
  const start = (currentPage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    totalPages,
    currentPage,
    totalItems: items.length
  };
}
function paginationMarkup(pageKey, renderName, totalPages, currentPage, totalItems, pageSize = 8) {
  if (totalPages <= 1) return '';
  const startItem = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const endItem = Math.min(currentPage * pageSize, totalItems);
  const controls = Array.from({ length: totalPages }, (_, index) => {
    const page = index + 1;
    return `<button type="button" class="page-btn ${page === currentPage ? 'active' : ''}" data-page-key="${pageKey}" data-page="${page}" data-render="${renderName}">${page}</button>`;
  }).join('');
  return `<div class="list-pagination"><div class="list-pagination-meta">Mostrando ${startItem}-${endItem} de ${totalItems}</div><div class="page-controls"><button type="button" class="page-btn nav" data-page-key="${pageKey}" data-page="${Math.max(1, currentPage - 1)}" data-render="${renderName}" ${currentPage === 1 ? 'disabled' : ''}>Anterior</button>${controls}<button type="button" class="page-btn nav" data-page-key="${pageKey}" data-page="${Math.min(totalPages, currentPage + 1)}" data-render="${renderName}" ${currentPage === totalPages ? 'disabled' : ''}>Siguiente</button></div></div>`;
}
function bindPaginationControls() {
  document.querySelectorAll('.page-btn[data-page]').forEach(button => {
    button.onclick = () => {
      const page = Number(button.dataset.page);
      if (!page || button.disabled) return;
      state.listPages[button.dataset.pageKey] = page;
      const render = button.dataset.render;
      if (typeof window[render] === 'function') window[render]();
    };
  });
}
function blockedView(reason='Tu dirección IP no puede acceder a esta aplicación.') { app.innerHTML=`<main class="login"><section class="login-box blocked-access"><img src="/static/blocked.jpg" alt="Acceso bloqueado"><h1>Acceso bloqueado</h1><p class="muted">${esc(reason)}</p></section></main>`; }
let currentTheme = localStorage.getItem('haitani-theme') || 'ran';
let notificationTimer;
document.documentElement.dataset.theme = currentTheme;
let ganttStatusFilter = '';
let ganttAssigneeFilter = '';
let ganttCalendarMonth = (() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d })();
let ganttChartZoom = 32;
let ganttChartMinDate = null;
const GANTT_WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
function startOfWeekMonday(date) { const d = new Date(date); const offset = (d.getDay() + 6) % 7; d.setDate(d.getDate() - offset); d.setHours(0, 0, 0, 0); return d }
function toISODate(date) { return date.toISOString().slice(0, 10) }
function addDays(dateStr, delta) { const base = dateStr || new Date().toISOString().slice(0, 10); const date = new Date(`${base}T00:00:00`); date.setDate(date.getDate() + delta); return date.toISOString().slice(0, 10) }
function themeToggle(){return `<div class="theme-switch" role="group" aria-label="Tema visual"><button class="theme-option ${currentTheme==='ran'?'active':''}" data-theme="ran">蘭</button><button class="theme-option ${currentTheme==='ryutan'?'active':''}" data-theme="ryutan">竜 胆</button></div>`}
function bindTheme(){document.querySelectorAll('[data-theme]').forEach(button=>button.onclick=()=>{currentTheme=button.dataset.theme;localStorage.setItem('haitani-theme',currentTheme);document.documentElement.dataset.theme=currentTheme;document.querySelectorAll('.theme-option').forEach(option=>option.classList.toggle('active',option.dataset.theme===currentTheme))})}
async function api(url, options = {}) { const projectId = localStorage.getItem('haitani-github-project'); const githubUrl = url.startsWith('/github/') && projectId && !url.includes('?') ? `${url}?project_id=${encodeURIComponent(projectId)}` : url; const response = await fetch(`/api${githubUrl}`, { ...options, credentials:'include' }); const data = await response.json().catch(() => ({})); if (response.status === 403 && data.blocked) { blockedView(data.reason || 'Tu dirección IP no puede acceder a esta aplicación.'); throw new Error(data.error); } if (response.status === 401) { state.user = null; clearInterval(notificationTimer); } if (!response.ok) throw new Error(data.error || 'No fue posible completar la operación.'); return data; }
function notificationDot(type){return `<i class="notification-dot" data-type="${type}" ${state.notifications[type]?'':'hidden'} title="${state.notifications[type]||0} notificaciones nuevas"></i>`}
async function refreshNotifications(){if(!state.user)return;try{state.notifications=await api('/notifications');document.querySelectorAll('.notification-dot').forEach(dot=>{const count=state.notifications[dot.dataset.type]||0;dot.hidden=!count;dot.title=`${count} notificaciones`})}catch{} }
function startNotificationPolling(){clearInterval(notificationTimer);notificationTimer=setInterval(refreshNotifications,30000)}
function notify(message) { const node = document.createElement('div'); node.className='toast'; node.textContent=message; document.body.append(node); setTimeout(() => node.remove(), 3000); }
document.addEventListener('submit', async event => {
  const form = event.target;
  if (!form.closest('#task-form') || !form.querySelector('input[type="file"][name="image"]')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const formData = new FormData(form);
  const id = formData.get('id');
  formData.delete('id');
  try {
    await api(id ? `/tasks/${id}` : '/tasks', { method: id ? 'PUT' : 'POST', body: formData });
    notify(id ? 'Tarea actualizada' : 'Tarea creada');
    renderTasks();
  } catch (error) { notify(error.message); }
}, true);
let slowLoaderTimer = null;
function showSlowLoader(){ if (document.querySelector('#page-slow-loader')) return; const loader=document.createElement('div'); loader.id='page-slow-loader'; loader.className='page-loader'; loader.innerHTML=`<div class="page-loader-card"><div class="page-loader-spinner"></div><div class="page-loader-copy"><strong>Cargando...</strong><span>La página está tardando más de lo habitual.</span></div></div>`; document.body.append(loader); }
function hideSlowLoader(){ const loader=document.querySelector('#page-slow-loader'); if(loader) loader.remove(); if(slowLoaderTimer){ clearTimeout(slowLoaderTimer); slowLoaderTimer=null; } }
const PRIVACY_NOTICE_KEY='haitani-privacy-accepted-v1';
function privacyNotice(){return `<div class="privacy-overlay" id="privacy-notice" role="dialog" aria-modal="true" aria-labelledby="privacy-title"><section class="privacy-notice"><div class="eyebrow">Aviso importante</div><h2 id="privacy-title">Privacidad y acuerdos de uso</h2><div class="privacy-content"><p>Haitani es una plataforma para gestionar organizaciones, proyectos, tareas, archivos, mensajes, llamadas, actividad de GitHub y registros administrativos de inasistencias.</p><p>Usamos estos datos para gestionar el trabajo, mantener la seguridad y cumplir las obligaciones aplicables. El acceso está limitado según el rol de cada usuario y las contraseñas se almacenan de forma protegida. No vendemos datos personales.</p><p>Debes mantener tus credenciales en secreto, usar la aplicación únicamente para fines autorizados y no subir contenido ilegal, dañino o confidencial sin permiso. Puedes solicitar acceso, corrección o eliminación de tus datos escribiendo a <strong>adminpruebassakura@gmail.com</strong>.</p><p class="muted">Lee el documento completo en <strong>POLITICA_PRIVACIDAD_Y_ACUERDOS</strong> antes de continuar.</p></div><button class="btn" id="accept-privacy">He leído y acepto</button></section></div>`}
function loginView(error='') { app.innerHTML=`<main class="login"><form class="login-box" id="login-form"><div class="brand">HAI<span>TANI</span></div><div class="eyebrow">Centro de control</div><h1>Haitani</h1><p class="muted">Organiza el trabajo de tu organización con una vista clara del proyecto.</p>${error?`<div class="alert">${esc(error)}</div>`:''}<label>Usuario o correo<input class="input" name="username" required autofocus></label><label>Contraseña<input class="input" name="password" type="password" required></label><button class="btn btn-block">Iniciar sesión</button></form>${localStorage.getItem(PRIVACY_NOTICE_KEY)?'':privacyNotice()}</main>`;document.querySelector('#accept-privacy')?.addEventListener('click',()=>{localStorage.setItem(PRIVACY_NOTICE_KEY,'1');document.querySelector('#privacy-notice')?.remove();document.querySelector('#login-form input')?.focus()}); document.querySelector('#login-form').onsubmit=async event=>{event.preventDefault();try{const data=await api('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(event.target)))});state.user=data.user;state.plan=data.plan;location.hash=data.redirect;render()}catch(error){loginView(error.message)}}}
function sidebar(){const admin=state.user.role==='admin';const links=admin?[['/admin/dashboard','Dashboard'],['/admin/assistant','Asistente IA'],['/admin/tasks','Tareas','tasks'],['/admin/kanban','Kanban'],['/admin/gantt','Gantt'],['/admin/members','Integrantes'],['/admin/files','Archivos'],['/admin/messages','Mensajes','messages'],['/admin/relax','Relax 梵天'],['/admin/github','GitHub'],['/admin/github/commits','Commits'],['/admin/team-activity','Actividad del equipo'],['/admin/billing','Facturación'],['/admin/settings/github','Configuración'],['/admin/settings/security','Seguridad'],['/admin/profile','Perfil']]:[['/member/dashboard','Dashboard'],['/member/tasks','Mis tareas','tasks'],['/member/kanban','Kanban'],['/member/gantt','Gantt'],['/member/files','Archivos'],['/member/members','Equipo'],['/member/messages','Mensajes','messages'],['/member/relax','Relax 梵天'],['/member/github','GitHub'],['/member/profile','Perfil']];return `<aside class="side" id="side"><div class="brand">HAI<span>TANI</span></div><div class="project">${esc(state.user.organization_name||'Organización')}</div><div class="nav-title">Workspace</div>${links.map(([href,label,type])=>`<button class="nav ${location.hash===href?'active':''}" data-route="${href}">${label}${type?notificationDot(type):''}</button>`).join('')}<div class="nav-title">Cuenta</div><button class="nav" id="logout">Cerrar sesión</button></aside>`}
function avatarMarkup(user,size='avatar'){return user.profile_photo?`<img class="${size}" src="${esc(user.profile_photo)}" alt="Foto de ${esc(user.name)}">`:`<span class="${size}">${esc(user.name?.[0]||'?')}</span>`}
function layout(content){app.innerHTML=`<div class="shell">${sidebar()}<section class="main"><header class="topbar"><button class="mobile-toggle" id="menu">☰</button><span class="muted">${state.user.role==='admin'?'Panel administrativo':'Espacio personal'}</span><div class="topbar-actions">${themeToggle()}<div class="user-chip"><span>${esc(state.user.name)}</span>${avatarMarkup(state.user)}</div></div></header><main class="content">${content}</main></section></div>`;document.querySelectorAll('[data-route]').forEach(node=>node.onclick=()=>{location.hash=node.dataset.route});document.querySelector('#logout').onclick=async()=>{await api('/auth/logout',{method:'POST'});state.user=null;location.hash='';loginView()};document.querySelector('#menu').onclick=()=>document.querySelector('#side').classList.toggle('open');bindTheme()}
function heading(title, subtitle, action=''){return `<div class="heading"><div><div class="eyebrow">Haitani / ${esc(state.user.organization_name||'Organización')}</div><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`}
function projectEditor(project){if(state.user.role!=='admin')return '';const methods=[['AGILE','Agile'],['SCRUM','Scrum'],['KANBAN','Kanban'],['XP','XP'],['LEAN','Lean'],['WATERFALL','Waterfall'],['HYBRID','Híbrida']];return `<form id="project-form" class="form-grid mt-4"><input type="hidden" name="id" value="${project?.id||''}"><label>Nombre<input class="input" name="name" value="${esc(project?.name||'')}" required></label><label>Descripción<input class="input" name="description" value="${esc(project?.description||'')}"></label><label>Metodología<select class="select" name="methodology_id" required>${methods.map(([value,label])=>`<option value="${value}" ${project?.methodology_id===value||(!project&&value==='AGILE')?'selected':''}>${label}</option>`).join('')}</select></label><label class="full">Requerimientos<textarea class="textarea" name="requirements" rows="4" placeholder="Alcance, stack, restricciones y criterios de aceptación">${esc(project?.requirements||'')}</textarea></label><div class="actions full"><button class="btn">${project?'Guardar proyecto':'Crear proyecto'}</button></div></form>`}
function methodologyWidgets(project){const method=project?.methodology_id;const links=[];if(['SCRUM','KANBAN','XP','AGILE'].includes(method))links.push('<a class="btn secondary" href="#/admin/kanban">Abrir tablero</a>');if(method==='WATERFALL'||method==='LEAN'||method==='HYBRID')links.push('<a class="btn secondary" href="#/admin/gantt">Abrir hitos y Gantt</a>');return `<div class="actions mt-3"><span class="muted">${method?`Flujo recomendado: ${esc(method)}`:'Define una metodología'}</span>${links.join('')}</div>`}
function projectHealth(health){if(!health)return '';const statusLabel={saludable:'Saludable',atencion:'Requiere atención',riesgo:'En riesgo'}[health.status]||'Sin datos';const workload=health.workload||[];const activity=health.recentActivity||[];return `<section class="card project-health mt-4"><div class="project-health-head"><div><div class="eyebrow">Control operativo</div><h2>Salud del proyecto</h2><p class="muted">Lectura combinada de avance, planificación, riesgos y capacidad del equipo.</p></div><div class="health-score health-${esc(health.status)}"><strong>${health.score}</strong><span>/ 100</span><small>${statusLabel}</small></div></div><div class="health-overview"><div class="health-meter"><div class="health-meter-track"><i style="width:${health.score}%"></i></div><div class="health-meter-labels"><span>Riesgo</span><span>Atención</span><span>Saludable</span></div></div><div class="health-metrics"><div><strong>${health.overdue}</strong><span>Vencidas</span></div><div><strong>${health.dueSoon}</strong><span>Próximas 7 días</span></div><div><strong>${health.critical}</strong><span>Alta prioridad</span></div><div><strong>${health.unassigned}</strong><span>Sin responsable</span></div></div></div><div class="health-detail-grid"><div><h3>Calidad de planificación</h3><div class="health-progress-row"><span>Fechas definidas</span><strong>${health.dateCoverage}%</strong><i><b style="width:${health.dateCoverage}%"></b></i></div><div class="health-progress-row"><span>Responsables asignados</span><strong>${health.assignmentCoverage}%</strong><i><b style="width:${health.assignmentCoverage}%"></b></i></div><h3 class="health-subtitle">Recomendaciones</h3><ul class="health-list">${health.recommendations.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></div><div><h3>Carga del equipo</h3>${workload.length?`<div class="health-workload">${workload.map(item=>{const percentage=item.total?Math.round(item.completed/item.total*100):0;return `<div class="health-workload-row"><span>${esc(item.name)}</span><strong>${item.total} <small>${percentage}% completado</small></strong><i><b style="width:${percentage}%"></b></i></div>`}).join('')}</div>`:'<div class="empty">No hay integrantes activos.</div>'}<h3 class="health-subtitle">Actividad reciente</h3>${activity.length?`<div class="health-activity">${activity.map(item=>`<div><strong>${esc(item.action)}</strong><small>${esc(item.description||'Actualización registrada')}</small></div>`).join('')}</div>`:'<div class="empty">No hay actividad reciente.</div>'}</div></div></section>`}
async function dashboard(){state.dashboard=await api('/dashboard');const s=state.dashboard.stats;const project=state.dashboard.project;let githubStatus='<div class="alert">Comprobando conexión con GitHub...</div>';try{const github=await api('/github/repository');if(!github.configured){githubStatus='<div class="alert">GitHub aún no está configurado.</div>'}else if(github.error){githubStatus=`<div class="alert">${esc(github.error)}</div>`}else{githubStatus=`<div class="alert"><strong>GitHub conectado</strong><br>${esc(github.data.full_name||'Repositorio configurado')} · Rama principal: ${esc(github.data.default_branch||'No disponible')}</div>`}}catch(error){githubStatus='<div class="alert">No fue posible consultar GitHub en este momento.</div>'}return `${heading(`Hola, ${esc(state.user.name)}`,'Vista general de tu actividad y del proyecto.')}<div class="grid stats"><div class="card stat"><div class="label">${state.user.role==='admin'?'Integrantes':'Mis tareas'}</div><div class="num pink">${state.user.role==='admin'?s.members:s.totalTasks}</div></div><div class="card stat"><div class="label">Pendientes</div><div class="num yellow">${s.byStatus.find(x=>x.status==='pendiente')?.count||0}</div></div><div class="card stat"><div class="label">En proceso</div><div class="num lilac">${s.byStatus.find(x=>x.status==='en_proceso')?.count||0}</div></div><div class="card stat"><div class="label">Completadas</div><div class="num green">${s.completed}</div></div><div class="card stat"><div class="label">Progreso</div><div class="num">${s.progress}%</div><div class="bar"><i style="width:${s.progress}%"></i></div></div></div><div class="grid two mt-4"><section class="card"><h2>Próximas tareas</h2><div id="dashboard-tasks" class="empty">Cargando tareas...</div></section><section class="card"><h2>Proyecto</h2>${project?`<p class="muted">${esc(project.description)}</p><div class="badge">${esc(project.methodology_id||'Sin metodología')}</div>${methodologyWidgets(project)}${projectEditor(project)}`:`<p class="muted">No hay un proyecto configurado.</p>${projectEditor(null)}`}${githubStatus}</section></div>`}
async function renderDashboard(){const content=await dashboard();layout(content);if(state.user.role==='admin'&&state.dashboard?.health)document.querySelector('.content')?.insertAdjacentHTML('beforeend',projectHealth(state.dashboard.health));const tasks=await api('/tasks');document.querySelector('#dashboard-tasks').innerHTML=tasks.slice(0,5).map(taskRow).join('')||'<div class="empty">No hay tareas asignadas.</div>';document.querySelector('#project-form')?.addEventListener('submit',async event=>{event.preventDefault();const values=Object.fromEntries(new FormData(event.target));const id=values.id;delete values.id;try{await api(id?`/projects/${id}`:'/projects',{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)});notify(id?'Proyecto actualizado':'Proyecto creado');renderDashboard()}catch(error){notify(error.message)}})}
function taskRow(task){return `<div class="task-list-row">${task.image_asset_id?`<img class="task-thumb" src="/api/tasks/${task.id}/image" alt="Imagen de referencia de ${esc(task.title)}">`:''}<span>${esc(task.title)}<small class="muted sub">${esc(task.assignee_name||'Sin asignar')}</small></span><span class="badge ${task.status==='completada'?'green':task.status==='en_proceso'?'pink':'yellow'}">${task.status.replace('_',' ')}</span></div>`}
async function tasksView(){const tasks=await api('/tasks');const users=['admin','project_manager'].includes(state.user.role)?await api('/users'):[];const projects=await api('/projects');const {items,totalPages,currentPage,totalItems}=paginateItems(tasks,'tasks');const canManage=['admin','project_manager','member'].includes(state.user.role);return `${heading(state.user.role==='admin'?'Tareas':'Mis tareas','Trabajo almacenado en PostgreSQL.',canManage?'<button class="btn" id="new-task">Nueva tarea</button>':'')}<section class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Tarea</th><th>Responsable</th><th>Prioridad</th><th>Estado</th><th>Fecha límite</th><th></th></tr></thead><tbody>${items.map(t=>`<tr><td>${esc(t.title)}<small class="muted sub">${esc(t.description)}</small></td><td>${esc(t.assignee_name||'Sin asignar')}</td><td><span class="badge ${t.priority==='alta'?'pink':''}">${t.priority}</span></td><td><select class="select status-select" data-id="${t.id}"><option value="pendiente" ${t.status==='pendiente'?'selected':''}>Pendiente</option><option value="en_proceso" ${t.status==='en_proceso'?'selected':''}>En proceso</option><option value="completada" ${t.status==='completada'?'selected':''}>Completada</option></select></td><td>${esc(t.due_date||'No definida')}</td><td><button class="btn secondary view-task-details" data-id="${t.id}">Detalles</button>${canManage?` <button class="btn secondary edit-task" data-id="${t.id}">Editar</button>`:''}${['admin','project_manager'].includes(state.user.role)?` <button class="btn danger delete-task" data-id="${t.id}">Eliminar</button>`:''}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">No hay tareas.</td></tr>'}</tbody></table>${paginationMarkup('tasks','renderTasks',totalPages,currentPage,totalItems)}</div></section>${canManage?taskForm(users,projects):''}`}
function taskForm(users,projects){return `<section class="card mt-4" id="task-form" style="display:none"><h2 id="task-form-title">Nueva tarea</h2><form class="form-grid"><input type="hidden" name="id"><label>Proyecto<select class="select" name="project_id" required><option value="">Selecciona un proyecto</option>${projects.map(project=>`<option value="${project.id}">${esc(project.name)}</option>`).join('')}</select></label><label>Título<input class="input" name="title" required></label><label>Responsable<select class="select" name="assigned_to"><option value="">Sin asignar</option>${users.filter(u=>u.role==='member').map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select></label><label>Prioridad<select class="select" name="priority"><option>baja</option><option selected>media</option><option>alta</option><option>critica</option></select></label><label>Estado<select class="select" name="status"><option>pendiente</option><option>en_proceso</option><option>completada</option></select></label><label>Fecha inicial<input class="input" name="start_date" type="date"></label><label>Fecha límite<input class="input" name="due_date" type="date"></label><label class="full">Imagen de referencia<input class="input" name="image" type="file" accept="image/png,image/jpeg,image/webp"></label><label class="full">Descripción<textarea class="textarea" name="description"></textarea></label><div class="actions full"><button class="btn">Guardar tarea</button><button type="button" class="btn secondary" id="cancel-task">Cancelar</button></div></form></section>`}
async function renderTasks(){layout(await tasksView());bindPaginationControls();const formSection=document.querySelector('#task-form');const form=document.querySelector('#task-form form');const openForm=task=>{form.reset();formSection.style.display='block';document.querySelector('#task-form-title').textContent=task?'Editar tarea':'Nueva tarea';form.elements.id.value=task?.id||'';form.elements.title.value=task?.title||'';form.elements.description.value=task?.description||'';form.elements.assigned_to.value=task?.assigned_to||'';form.elements.priority.value=task?.priority||'media';form.elements.status.value=task?.status||'pendiente';form.elements.start_date.value=task?.start_date||'';form.elements.due_date.value=task?.due_date||''};document.querySelector('#new-task')?.addEventListener('click',()=>openForm());document.querySelector('#cancel-task')?.addEventListener('click',()=>formSection.style.display='none');document.querySelector('#task-form form')?.addEventListener('submit',async e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.target));const id=values.id;delete values.id;try{await api(id?`/tasks/${id}`:'/tasks',{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)});notify(id?'Tarea actualizada':'Tarea creada');renderTasks()}catch(error){notify(error.message)}});document.querySelectorAll('.view-task-details').forEach(button=>button.onclick=async()=>{try{const task=await api(`/tasks/${button.dataset.id}`);const popover=document.createElement('div');popover.className='gantt-popover task-detail-popover';popover.innerHTML=`<div class="task-detail-header"><strong>${esc(task.title)}</strong><button type="button" class="icon-btn task-detail-close" aria-label="Cerrar">✕</button></div><div class="task-detail-grid"><div><span>Estado</span><strong>${esc(task.status.replace('_',' '))}</strong></div><div><span>Prioridad</span><strong>${esc(task.priority)}</strong></div><div><span>Responsable</span><strong>${esc(task.assignee_name || 'Sin asignar')}</strong></div><div><span>Fecha inicial</span><strong>${esc(task.start_date || 'No definida')}</strong></div><div><span>Fecha límite</span><strong>${esc(task.due_date || 'No definida')}</strong></div><div><span>Creada</span><strong>${esc(task.created_at || 'No disponible')}</strong></div></div><div class="task-detail-description"><span>Descripción</span><p>${esc(task.description || 'Sin descripción')}</p></div>`;document.body.append(popover);const close=()=>popover.remove();popover.querySelector('.task-detail-close').onclick=close;document.addEventListener('pointerdown',function onOutside(event){if(!popover.contains(event.target)){close();document.removeEventListener('pointerdown',onOutside)}})}catch(error){notify(error.message)}});document.querySelectorAll('.edit-task').forEach(button=>button.onclick=async()=>{try{openForm(await api(`/tasks/${button.dataset.id}`))}catch(error){notify(error.message)}});document.querySelectorAll('.status-select').forEach(select=>select.onchange=async()=>{try{await api(`/tasks/${select.dataset.id}/status`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:select.value})});notify('Estado actualizado')}catch(error){notify(error.message)}});document.querySelectorAll('.delete-task').forEach(button=>button.onclick=async()=>{if(confirm('¿Eliminar tarea?')){await api(`/tasks/${button.dataset.id}`,{method:'DELETE'});renderTasks()}})}
async function kanban(){const tasks=await api('/tasks');return `${heading('Kanban','Arrastra las tareas para actualizar su estado.') }<div class="kanban">${[['pendiente','Pendiente'],['en_proceso','En proceso'],['completada','Completada']].map(([status,label])=>`<section class="column" data-status="${status}"><h3>${label.toUpperCase()}</h3>${tasks.filter(t=>t.status===status).map(t=>`<article class="task-card" draggable="true" data-id="${t.id}"><h3>${esc(t.title)}</h3><p>${esc(t.description)}</p><div class="meta"><span>${esc(t.assignee_name||'Sin asignar')}</span><span>${esc(t.due_date||'')}</span></div></article>`).join('')}</section>`).join('')}</div>`}
async function renderKanban(){if(state.kanbanTimer)clearInterval(state.kanbanTimer);layout(await kanban());let draggedCard=null;document.querySelectorAll('.task-card').forEach(card=>{card.ondragstart=e=>{draggedCard=card;card.classList.add('is-dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('id',card.dataset.id)};card.ondragend=()=>card.classList.remove('is-dragging')});document.querySelectorAll('.column').forEach(column=>{column.ondragover=e=>{e.preventDefault();column.classList.add('is-drag-over')};column.ondragleave=()=>column.classList.remove('is-drag-over');column.ondrop=async e=>{e.preventDefault();column.classList.remove('is-drag-over');const card=draggedCard||document.querySelector(`.task-card[data-id="${e.dataTransfer.getData('id')}"]`);if(!card)return;const originalColumn=card.parentElement;const originalStatus=originalColumn.dataset.status;const nextStatus=column.dataset.status;if(originalStatus===nextStatus)return;column.append(card);try{await api(`/tasks/${card.dataset.id}/status`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:nextStatus})});notify('Estado actualizado')}catch(error){originalColumn.append(card);notify(error.message||'No fue posible mover la tarea.')}}});state.kanbanTimer=setInterval(()=>renderKanban().catch(error=>notify(error.message)),30000)}
async function filesView(){const files=await api('/files');const {items,totalPages,currentPage,totalItems}=paginateItems(files,'files');return `${heading('Archivos','Documentos compartidos y evidencias del equipo.','<form id="upload-form" class="actions"><input class="input" type="file" name="file" required><button class="btn">Subir evidencia</button></form>')}<section class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Archivo</th><th>Tipo</th><th>Tamaño</th><th>Subido por</th><th>Fecha</th><th>Acción</th></tr></thead><tbody>${items.map(f=>`<tr><td>${esc(f.original_name)}</td><td>${esc(f.mime_type)}</td><td>${Math.ceil(f.size/1024)} KB</td><td>${esc(f.uploader_name)}</td><td>${esc(f.created_at)}</td><td><button class="btn secondary view-file" data-id="${f.id}" data-name="${esc(f.original_name)}" data-type="${esc(f.mime_type)}">Visualizar</button> <a class="btn secondary" href="/api/files/${f.id}/download">Descargar</a>${state.user.role==='admin'?` <button class="btn danger delete-file" data-id="${f.id}">Eliminar</button>`:''}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">Aún no hay archivos compartidos.</td></tr>'}</tbody></table>${paginationMarkup('files','renderFiles',totalPages,currentPage,totalItems)}</div></section><div id="file-viewer" class="file-viewer" hidden><div class="file-viewer-panel"><div class="file-viewer-head"><strong id="file-viewer-title"></strong><button class="btn secondary" id="close-file-viewer">Cerrar</button></div><div id="file-viewer-content" class="file-viewer-content"></div></div></div>`}
async function renderFiles(){layout(await filesView());bindPaginationControls();document.querySelector('#upload-form')?.addEventListener('submit',async e=>{e.preventDefault();await api('/files',{method:'POST',body:new FormData(e.target)});notify('Archivo subido');renderFiles()});document.querySelectorAll('.view-file').forEach(button=>button.onclick=()=>{const viewer=document.querySelector('#file-viewer');const type=button.dataset.type;const url=`/api/files/${button.dataset.id}/view`;document.querySelector('#file-viewer-title').textContent=button.dataset.name;document.querySelector('#file-viewer-content').innerHTML=type.startsWith('image/')?`<img class="file-preview-image" src="${url}" alt="${esc(button.dataset.name)}">`:`<iframe class="file-preview-frame" src="${url}" title="${esc(button.dataset.name)}"></iframe>`;viewer.hidden=false});document.querySelector('#close-file-viewer')?.addEventListener('click',()=>{document.querySelector('#file-viewer').hidden=true;document.querySelector('#file-viewer-content').innerHTML=''});document.querySelectorAll('.delete-file').forEach(b=>b.onclick=async()=>{await api(`/files/${b.dataset.id}`,{method:'DELETE'});renderFiles()})}
async function githubView(section='repository'){const data=await api(`/github/${section==='pulls'?'pull-requests':section}`);let body='';if(!data.configured)body='<div class="empty">GitHub aún no está configurado.</div>';else if(data.error)body=`<div class="alert">${esc(data.error)}</div>`;else if(section==='repository'){const r=data.data;body=`<div class="grid stats"><div class="card stat"><div class="label">Nombre</div><div class="num">${esc(r.name)}</div></div><div class="card stat"><div class="label">Lenguaje</div><div class="num lilac">${esc(r.language||'No disponible')}</div></div><div class="card stat"><div class="label">Estrellas</div><div class="num yellow">${r.stargazers_count}</div></div><div class="card stat"><div class="label">Última actualización</div><div class="num num-sm">${new Date(r.updated_at).toLocaleDateString('es')}</div></div></div><section class="card mt-4"><h2>${esc(r.full_name)}</h2><p class="muted">${esc(r.description||'No disponible')}</p><a class="btn" href="${esc(r.html_url)}" target="_blank">Abrir en GitHub</a></section>`}else if(section==='commits'){body=`<section class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Commit</th><th>Autor</th><th>Usuario GitHub</th><th>SHA</th><th>Fecha</th><th></th></tr></thead><tbody>${data.data.map(commit=>`<tr><td>${esc(commit.message)}</td><td>${esc(commit.author)}</td><td>${esc(commit.github_username||'No disponible')}</td><td><code>${esc(commit.sha)}</code></td><td>${esc(commit.date||'No disponible')}</td><td><a class="btn secondary" href="${esc(commit.url)}" target="_blank">Ver commit</a></td></tr>`).join('')||'<tr><td colspan="6" class="empty">No hay commits disponibles.</td></tr>'}</tbody></table></div></section>`}else{const rows=data.data;body=`<section class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Actividad</th><th>Usuario</th><th>Fecha</th><th></th></tr></thead><tbody>${rows.map(item=>`<tr><td>${esc(item.message||item.title||item.action||item.name)}</td><td>${esc(item.github_username||item.author||item.user||'No disponible')}</td><td>${esc(item.date||item.updated||'No disponible')}</td><td>${item.url?`<a class="btn secondary" href="${esc(item.url)}" target="_blank">Ver en GitHub</a>`:''}</td></tr>`).join('')}</tbody></table></div></section>`}return `${heading(section==='commits'?'Commits':'GitHub','Información real del repositorio privado de Sakura Coffee.')}<div class="actions" style="margin-bottom:16px"><button class="btn secondary" data-gh="repository">Overview</button><button class="btn secondary" data-gh="commits">Commits</button><button class="btn secondary" data-gh="pulls">Pull Requests</button><button class="btn secondary" data-gh="branches">Branches</button><button class="btn secondary" data-gh="activity">Activity</button></div>${body}`}
async function renderGithub(section='repository'){try{layout(await githubView(section));document.querySelectorAll('[data-gh]').forEach(b=>b.onclick=()=>renderGithub(b.dataset.gh))}catch(error){layout(`${heading('GitHub','La integración de GitHub requiere un plan compatible.')}<section class="card"><div class="alert">${esc(error.message)}</div>${state.user.role==='admin'?'<a class="btn" href="#/admin/billing">Ver planes</a>':''}</section>`)}}
function profile(){const photo=state.user.profile_photo?`<img class="profile-photo" src="${esc(state.user.profile_photo)}" alt="Foto de perfil">`:`<div class="profile-photo profile-placeholder">${esc(state.user.name[0])}</div>`;return `${heading('Mi perfil','Información de tu cuenta en Haitani.')}<section class="card profile-card"><div class="profile-summary">${photo}<div><h2>${esc(state.user.name)}</h2><p class="muted">${esc(state.user.email)}</p></div></div><div class="grid stats"><div><div class="muted">Usuario</div><h2>${esc(state.user.username)}</h2></div><div><div class="muted">GitHub</div><h2>${esc(state.user.github_username||'GitHub no configurado')}</h2></div></div></section><section class="card"><h2>Actualizar perfil</h2><p class="muted">Edita tus datos personales, foto y contraseña.</p><form id="profile-form" class="form-grid" enctype="multipart/form-data"><label>Nombre<input class="input" name="name" value="${esc(state.user.name)}" required></label><label>Usuario<input class="input" name="username" value="${esc(state.user.username)}" required></label><label>Correo<input class="input" name="email" type="email" value="${esc(state.user.email)}" required></label><label>Foto de perfil<input class="input" name="photo" type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"></label><label>Contraseña actual<input class="input" name="current_password" type="password" autocomplete="current-password"></label><label>Nueva contraseña<input class="input" name="new_password" type="password" minlength="8" autocomplete="new-password"></label><div class="actions full"><button class="btn">Guardar cambios</button></div></form></section>`}
async function renderProfile(){layout(profile());document.querySelector('#profile-form').onsubmit=async event=>{event.preventDefault();try{const data=await api('/users/me/profile',{method:'PUT',body:new FormData(event.target)});state.user={...state.user,...data};notify('Perfil actualizado');renderProfile()}catch(error){notify(error.message)}}}
async function members(){const users=await api('/users');const membersList=users.filter(u=>u.role==='member');const {items,totalPages,currentPage,totalItems}=paginateItems(membersList,'members');return `${heading('Integrantes','Personas activas en el equipo.','<button class="btn" id="new-member">Nuevo integrante</button>')}<section class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Foto</th><th>Nombre</th><th>Usuario</th><th>Correo</th><th>GitHub</th><th>Estado</th><th></th></tr></thead><tbody>${items.map(u=>`<tr><td>${u.profile_photo?`<img class="avatar" src="${esc(u.profile_photo)}" alt="Foto de ${esc(u.name)}">`:`<span class="avatar">${esc(u.name[0])}</span>`}</td><td>${esc(u.name)}</td><td>${esc(u.username)}</td><td>${esc(u.email)}</td><td>${esc(u.github_username||'No configurado')}</td><td>${u.active?'Activo':'Inactivo'}</td><td><button class="btn secondary edit-user" data-user="${encodeURIComponent(JSON.stringify(u))}">Editar</button> <button class="btn secondary toggle-user" data-id="${u.id}" data-active="${u.active}">${u.active?'Desactivar':'Activar'}</button> <button class="btn danger delete-user" data-id="${u.id}">Eliminar</button></td></tr>`).join('')}</tbody></table>${paginationMarkup('members','renderMembers',totalPages,currentPage,totalItems)}</div></section><section class="card mt-4" id="member-form" style="display:none"><h2 id="member-form-title">Nuevo integrante</h2><form class="form-grid"><input type="hidden" name="id"><label>Nombre<input class="input" name="name" required></label><label>Usuario<input class="input" name="username" required></label><label>Correo<input class="input" name="email" type="email" required></label><label>Contraseña<input class="input" name="password" placeholder="Déjala vacía para conservarla"></label><label>GitHub username<input class="input" name="github_username"></label><label>Estado<select class="select" name="active"><option value="1">Activo</option><option value="0">Inactivo</option></select></label><div class="actions full"><button class="btn">Guardar</button><button class="btn secondary" type="button" id="cancel-member">Cancelar</button></div></form></section>`}
async function renderMembers(){layout(await members());bindPaginationControls();const formSection=document.querySelector('#member-form');const form=document.querySelector('#member-form form');const openForm=(user=null)=>{form.reset();formSection.style.display='block';document.querySelector('#member-form-title').textContent=user?'Editar integrante':'Nuevo integrante';form.elements.id.value=user?.id||'';form.elements.name.value=user?.name||'';form.elements.username.value=user?.username||'';form.elements.email.value=user?.email||'';form.elements.github_username.value=user?.github_username||'';form.elements.active.value=user?.active?'1':'0';form.elements.password.value='';form.elements.password.required=!user};document.querySelector('#new-member').onclick=()=>openForm();document.querySelector('#cancel-member').onclick=()=>formSection.style.display='none';form.onsubmit=async e=>{e.preventDefault();const values=Object.fromEntries(new FormData(form));const id=values.id;delete values.id;if(!values.password)delete values.password;try{await api(id?`/users/${id}`:'/users',{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)});notify(id?'Integrante actualizado':'Integrante creado');renderMembers()}catch(error){notify(error.message)}};document.querySelectorAll('.edit-user').forEach(button=>button.onclick=()=>openForm(JSON.parse(decodeURIComponent(button.dataset.user))));document.querySelectorAll('.toggle-user').forEach(b=>b.onclick=async()=>{try{await api(`/users/${b.dataset.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({active:b.dataset.active==='0'})});renderMembers()}catch(error){notify(error.message)}});document.querySelectorAll('.delete-user').forEach(b=>b.onclick=async()=>{if(confirm('¿Eliminar integrante?')){await api(`/users/${b.dataset.id}`,{method:'DELETE'});renderMembers()}})}
async function team(){const users=(await api('/users')).filter(user=>user.active);return `${heading('Equipo','Conoce a las personas del equipo y sus fotos de perfil.')}<section class="team-grid">${users.map(user=>`<article class="card team-card">${avatarMarkup(user,'team-avatar')}<div><h2>${esc(user.name)}</h2><p class="muted">@${esc(user.username)}</p><p>${esc(user.email)}</p></div><button class="btn secondary message-user" data-id="${user.id}">Enviar mensaje</button></article>`).join('')}</section>`}
async function renderTeam(){layout(await team());document.querySelectorAll('.message-user').forEach(button=>button.onclick=()=>{location.hash=`#/${state.user.role}/messages?user=${button.dataset.id}`;renderMessages()})}
const callState={socket:null,peer:null,stream:null,remoteStream:null,peerId:null,callId:null,muted:false};
function signalSocket(){if(callState.socket?.readyState===WebSocket.OPEN)return callState.socket;const protocol=location.protocol==='https:'?'wss':'ws';callState.socket=new WebSocket(`${protocol}://${location.host}`);callState.socket.onopen=()=>callState.socket.send(JSON.stringify({type:'register',userId:state.user.id}));callState.socket.onmessage=event=>handleCallSignal(JSON.parse(event.data));return callState.socket}
function sendSignal(message){const socket=signalSocket();const send=()=>socket.send(JSON.stringify(message));if(socket.readyState===WebSocket.OPEN)send();else socket.addEventListener('open',send,{once:true})}
async function startCall(peerId,video){try{callState.peerId=Number(peerId);const call=await api('/calls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({receiver_id:callState.peerId,call_type:video?'video':'audio'})});callState.callId=call.id;callState.stream=await navigator.mediaDevices.getUserMedia({audio:true,video});callState.peer=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});callState.remoteStream=new MediaStream();document.querySelector('#call-remote').srcObject=callState.remoteStream;document.querySelector('#call-local').srcObject=callState.stream;callState.stream.getTracks().forEach(track=>callState.peer.addTrack(track,callState.stream));callState.peer.ontrack=event=>event.streams[0].getTracks().forEach(track=>callState.remoteStream.addTrack(track));callState.peer.onicecandidate=event=>event.candidate&&sendSignal({type:'ice',to:callState.peerId,candidate:event.candidate});document.querySelector('#call-modal').hidden=false;const offer=await callState.peer.createOffer();await callState.peer.setLocalDescription(offer);sendSignal({type:'offer',to:callState.peerId,offer,video,callId:callState.callId})}catch(error){notify('No fue posible iniciar la llamada. Revisa los permisos de cámara y micrófono.');endCall()}}
async function handleCallSignal(message){if(message.type==='offer'){if(callState.peer)endCall();callState.peerId=message.from;callState.callId=message.callId;callState.stream=await navigator.mediaDevices.getUserMedia({audio:true,video:message.video});callState.peer=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});callState.remoteStream=new MediaStream();document.querySelector('#call-remote').srcObject=callState.remoteStream;document.querySelector('#call-local').srcObject=callState.stream;callState.stream.getTracks().forEach(track=>callState.peer.addTrack(track,callState.stream));callState.peer.ontrack=event=>event.streams[0].getTracks().forEach(track=>callState.remoteStream.addTrack(track));callState.peer.onicecandidate=event=>event.candidate&&sendSignal({type:'ice',to:callState.peerId,candidate:event.candidate});await callState.peer.setRemoteDescription(message.offer);const answer=await callState.peer.createAnswer();await callState.peer.setLocalDescription(answer);document.querySelector('#call-modal').hidden=false;await api(`/calls/${callState.callId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'answered'})});sendSignal({type:'answer',to:callState.peerId,answer})}else if(message.type==='answer'&&callState.peer){await callState.peer.setRemoteDescription(message.answer);if(callState.callId)await api(`/calls/${callState.callId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'answered'})})}else if(message.type==='ice'&&callState.peer)await callState.peer.addIceCandidate(message.candidate)}
function toggleMute(){callState.muted=!callState.muted;callState.stream?.getAudioTracks().forEach(track=>{track.enabled=!callState.muted});const button=document.querySelector('#mute-call');if(button){const label=callState.muted?'Activar micrófono':'Silenciar micrófono';button.innerHTML=`${iconAsset('mute','Micrófono')}<span>${label}</span>`;}}
function endCall(){callState.peer?.close();callState.stream?.getTracks().forEach(track=>track.stop());callState.peer=null;callState.stream=null;callState.remoteStream=null;callState.peerId=null;callState.callId=null;callState.muted=false;const modal=document.querySelector('#call-modal');if(modal)modal.hidden=true}
function chatBackground(key){return localStorage.getItem(`haitani-chat-bg-${key}`)||'linear-gradient(135deg,#13202B,#2A3541)'}
function chatBackgroundKind(key){const value=chatBackground(key);if(value.startsWith('url('))return 'custom';if(value.includes('C4B5'))return 'lavender';if(value.includes('201B19'))return 'warm';if(value.includes('#13202B,#2A3541'))return 'gradient';return 'solid'}
function timeShort(dateStr){return new Date(dateStr).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})}
function dayDivider(dateStr){const today=new Date();today.setHours(0,0,0,0);const d=new Date(dateStr);d.setHours(0,0,0,0);const diff=Math.round((today-d)/86400000);if(diff===0)return 'Hoy';if(diff===1)return 'Ayer';return d.toLocaleDateString('es',{day:'2-digit',month:'long',year:d.getFullYear()!==today.getFullYear()?'numeric':undefined})}
function messagesForList(messages){const out=[];let lastDay='';messages.forEach(message=>{const label=dayDivider(message.created_at);if(label!==lastDay){out.push({divider:label});lastDay=label}out.push({message})});return out}
/* ============ BLOQUEO Y SILENCIO POR CONVERSACIÓN (estilo WhatsApp) ============ */
function convBlockKey(key){return `haitani-blocked-${key}`}
function convMuteKey(key){return `haitani-muted-${key}`}
function isConvBlocked(key){return localStorage.getItem(convBlockKey(key))==='1'}
function isConvMuted(key){return localStorage.getItem(convMuteKey(key))==='1'}
function setConvBlocked(key,value){value?localStorage.setItem(convBlockKey(key),'1'):localStorage.removeItem(convBlockKey(key))}
function setConvMuted(key,value){value?localStorage.setItem(convMuteKey(key),'1'):localStorage.removeItem(convMuteKey(key))}
function directKey(userId){return `${Math.min(state.user.id,Number(userId))}-${Math.max(state.user.id,Number(userId))}`}
function groupKey(groupId){return `group-${groupId}`}

/* ============ ESTADOS (historias tipo WhatsApp, guardadas localmente) ============ */
const STATUS_TTL_MS = 24 * 60 * 60 * 1000;
function myStatusKey(){return `haitani-status-${state.user.id}`}
function getMyStatus(){
  try{
    const raw = localStorage.getItem(myStatusKey());
    if(!raw) return null;
    const data = JSON.parse(raw);
    if(Date.now() - data.createdAt > STATUS_TTL_MS){ localStorage.removeItem(myStatusKey()); return null }
    return data;
  }catch{ return null }
}
function saveMyStatus(content, image){ localStorage.setItem(myStatusKey(), JSON.stringify({ content: content || '', image: image || '', createdAt: Date.now() })) }
function clearMyStatus(){ localStorage.removeItem(myStatusKey()) }
function fileToDataUrl(file){ return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file) }) }
function statusStripMarkup(users){
  const mine = getMyStatus();
  const others = users.slice(0, 12).map(u => `<button type="button" class="status-item" data-status-user="${u.id}" data-status-name="${esc(u.name)}"><span class="status-ring no-status">${avatarMarkup(u,'message-avatar')}</span><small>${esc((u.name||'').split(' ')[0])}</small></button>`).join('');
  return `<div class="status-strip"><button type="button" class="status-item my-status" id="open-my-status"><span class="status-ring ${mine?'has-status':'no-status'}">${avatarMarkup(state.user,'message-avatar')}${mine?'':'<span class="status-add">+</span>'}</span><small>Mi estado</small></button>${others}</div>`;
}
function statusViewerMarkup(name, data){
  return `<div class="status-overlay" id="status-overlay" role="dialog" aria-modal="true"><div class="status-viewer"><div class="status-viewer-head"><strong>${esc(name)}</strong><button class="icon-btn" id="close-status-viewer" aria-label="Cerrar">✕</button></div><div class="status-viewer-body">${data.image?`<img src="${esc(data.image)}" alt="Estado de ${esc(name)}">`:''}${data.content?`<p>${esc(data.content)}</p>`:''}${!data.image&&!data.content?'<p class="muted">Sin contenido.</p>':''}</div><small class="muted status-viewer-time">${new Date(data.createdAt).toLocaleString('es')}</small></div></div>`;
}
function myStatusEditorMarkup(existing){
  return `<div class="status-overlay" id="status-overlay" role="dialog" aria-modal="true"><div class="status-viewer status-editor"><div class="status-viewer-head"><strong>Mi estado</strong><button class="icon-btn" id="close-status-viewer" aria-label="Cerrar">✕</button></div>${existing?`<div class="status-viewer-body">${existing.image?`<img src="${esc(existing.image)}" alt="Mi estado">`:''}${existing.content?`<p>${esc(existing.content)}</p>`:''}</div><small class="muted status-viewer-time">Publicado ${new Date(existing.createdAt).toLocaleString('es')}</small><div class="actions mt-3"><button class="btn danger" id="delete-my-status">Eliminar estado</button></div>`:`<form id="status-form" class="form-grid"><label class="full">Texto<textarea class="textarea" name="content" rows="3" placeholder="¿Qué estás pensando?"></textarea></label><label class="full">Imagen (opcional)<input class="input" type="file" name="image" accept="image/png,image/jpeg,image/webp"></label><div class="actions full"><button class="btn">Publicar estado</button></div></form>`}</div></div>`;
}
async function messagesView(selectedId = null){
  const params=new URLSearchParams(location.hash.split('?')[1]||'');
  const selectedGroupId=params.get('group');
  const activeId=selectedId || params.get('user') || '';
  const [users, groups]=await Promise.all([
    api('/users').catch(()=>[]),
    api('/messages/groups').catch(()=>[])
  ]);

  let selectedContact=null;
  let selectedGroupDetail=null;
  let selectedMessages=[];

  if(selectedGroupId){
    try{
      selectedGroupDetail=await api(`/messages/groups/${selectedGroupId}`);
    }catch(error){
      selectedGroupDetail=null;
    }
    selectedMessages=selectedGroupDetail?.messages || [];
  }else if(activeId){
    selectedContact=users.find(user=>String(user.id)===String(activeId)) || null;
    try{
      selectedMessages=await api(`/messages?user_id=${activeId}`).catch(()=>[]);
    }catch(error){
      selectedMessages=[];
    }
  }

  const conversationKey = selectedGroupId ? groupKey(selectedGroupId) : (selectedContact ? directKey(selectedContact.id) : 'general');
  const conversationBackground = chatBackground(conversationKey);
  const conversationBgKind = chatBackgroundKind(conversationKey);

  const directConversations = users.filter(user=>user.active && user.id!==state.user.id).map(user=>{
    const active=String(activeId)===String(user.id) ? 'active' : '';
    return `<button type="button" class="conversation-user ${active}" data-id="${user.id}"><div class="conversation-user-main">${avatarMarkup(user,'message-avatar')}<div><strong>${esc(user.name)}</strong><small>${esc(user.username ? '@'+user.username : user.email || '')}</small></div></div><span class="conversation-status">${isConvMuted(directKey(user.id))?'Silenciado':isConvBlocked(directKey(user.id))?'Bloqueado':''}</span></button>`;
  }).join('') || '<div class="empty">No hay contactos activos.</div>';

  const groupConversations = groups.map(group=>{
    const active=String(selectedGroupId)===String(group.id) ? 'active' : '';
    return `<button type="button" class="conversation-user ${active}" data-group-id="${group.id}"><div class="conversation-user-main"><span class="message-avatar group-avatar">G</span><div><strong>${esc(group.name)}</strong><small>${group.members_count ?? 0} miembros</small></div></div><span class="conversation-status">${group.last_message_at ? timeShort(group.last_message_at) : ''}</span></button>`;
  }).join('') || '<div class="empty">No hay grupos.</div>';

  const currentTitle=selectedGroupDetail?.group?.name || selectedContact?.name || 'Mensajes';
  const currentSubtitle=selectedGroupDetail
    ? `${selectedGroupDetail.members.length} miembros${selectedGroupDetail.messages?.length ? ` · Último mensaje ${esc(formatLastSeen(selectedGroupDetail.messages[selectedGroupDetail.messages.length-1]?.created_at))}` : ''}`
    : selectedContact
      ? `@${esc(selectedContact.username || selectedContact.email || '')}${selectedContact.last_seen_at ? ` · Última vez ${esc(formatLastSeen(selectedContact.last_seen_at))}` : ''}`
      : 'Selecciona una conversación';

  const messageMarkup = selectedMessages.length
    ? messagesForList(selectedMessages).map(entry=>{
        if(entry.divider){
          return `<div class="day-divider">${esc(entry.divider)}</div>`;
        }
        const message=entry.message;
        const isMine = message.sender_id === state.user.id;
        return `<div class="message ${isMine ? 'mine' : ''}"><div class="message-bubble">${message.sender_photo || message.sender_name ? `<div class="message-meta"><span class="message-avatar-wrap">${avatarMarkup({name:message.sender_name,profile_photo:message.sender_photo},'message-avatar')}</span><strong>${esc(message.sender_name || 'Usuario')}</strong></div>` : ''}<p>${esc(message.content || 'Archivo adjunto')}</p>${message.attachment_id ? `<a class="message-attachment" href="/api/files/${message.attachment_id}/download">${esc(message.attachment_name || 'Archivo adjunto')}</a>` : ''}<small>${timeShort(message.created_at)}</small></div></div>`;
      }).join('')
    : '<div class="empty">No hay mensajes en esta conversación.</div>';

  return `
    <section class="messages-shell">
      ${statusStripMarkup(users)}
      <div class="messages-layout">
        <aside class="conversation-list">
          <div class="conversation-list-header">
            <h2>Mensajes</h2>
            <button class="btn secondary mini" id="new-group" type="button">+ Grupo</button>
          </div>
          <div class="conversation-section">
            <div class="conversation-label">Contactos</div>
            ${directConversations}
          </div>
          <div class="conversation-section">
            <div class="conversation-label">Grupos</div>
            ${groupConversations}
          </div>
        </aside>
        <div class="conversation">
          <div class="conversation-header">
            <div class="conversation-who">
              ${selectedGroupDetail ? '<span class="message-avatar group-avatar">G</span>' : selectedContact ? avatarMarkup(selectedContact,'message-avatar') : '<span class="message-avatar group-avatar">?</span>'}
              <div>
                <h2>${esc(currentTitle)}</h2>
                <small class="muted">${currentSubtitle}</small>
              </div>
            </div>
            <div class="conversation-tools">
              <button class="btn secondary mini" id="toggle-contact-info" type="button">Info</button>
              <button class="icon-btn" id="toggle-chat-bg" type="button" title="Cambiar fondo del chat" aria-label="Cambiar fondo del chat">🎨</button>
              <button class="icon-btn" id="mute-conversation" type="button" title="Silenciar conversación" aria-label="Silenciar conversación">🔔</button>
              <button class="icon-btn danger" id="block-conversation" type="button" title="Bloquear conversación" aria-label="Bloquear conversación">🚫</button>
            </div>
          </div>
          <div class="bg-swatches" id="chat-bg-panel" hidden>
            <button type="button" class="bg-swatch bg-gradient ${conversationBgKind==='gradient'?'active':''}" data-bg="gradient" title="Fondo degradado" aria-label="Fondo degradado"></button>
            <button type="button" class="bg-swatch bg-solid ${conversationBgKind==='solid'?'active':''}" data-bg="solid" title="Fondo sólido" aria-label="Fondo sólido"></button>
            <button type="button" class="bg-swatch bg-lavender ${conversationBgKind==='lavender'?'active':''}" data-bg="lavender" title="Fondo lavanda" aria-label="Fondo lavanda"></button>
            <button type="button" class="bg-swatch bg-warm ${conversationBgKind==='warm'?'active':''}" data-bg="warm" title="Fondo cálido" aria-label="Fondo cálido"></button>
            <label class="bg-upload-label" title="Subir imagen de fondo" aria-label="Subir imagen de fondo">+<input type="file" accept="image/*" class="chat-bg-upload" data-key="${esc(conversationKey)}" hidden></label>
            <span class="bg-swatches-divider"></span>
            <button type="button" class="btn mini" id="chat-bg-confirm" disabled>Confirmar</button>
            <button type="button" class="btn secondary mini" id="chat-bg-cancel">Cancelar</button>
          </div>
          <div class="message-list" data-bg-key="${esc(conversationKey)}" style="background:${esc(conversationBackground)};">
            ${messageMarkup}
          </div>
          <form id="message-form" class="message-form" data-group-id="${esc(selectedGroupId || '')}">
            <label class="file-pill">
              <input type="file" name="file" class="file-input">
            </label>
            <textarea class="textarea" name="content" rows="1" placeholder="Escribe un mensaje..."></textarea>
            <button class="btn" type="submit">Enviar</button>
          </form>
        </div>
      </div>
    </section>
  `;
}
async function renderMessages(){
  signalSocket();
  const params=new URLSearchParams(location.hash.split('?')[1]||'');
  const selectedId=params.get('user');
  const selectedGroupId=params.get('group');
  layout(await messagesView(selectedId));
  const list=document.querySelector('.message-list');
  if(list)list.scrollTop=list.scrollHeight;
  const conversationKey=list?.dataset.bgKey;

  // ---- Llamadas perdidas + botón de silenciar micrófono (llamada activa) ----
  const callHead=document.querySelector('.call-head');
  if(callHead&&!document.querySelector('#mute-call'))callHead.insertAdjacentHTML('beforeend','<button class="btn secondary btn-with-icon" id="mute-call">'+iconAsset('mute','Silenciar micrófono')+'<span>Silenciar micrófono</span></button>');
  document.querySelector('#mute-call')?.addEventListener('click',toggleMute);
  const calls=await api('/calls').catch(()=>[]);
  if(calls.length){
    const node=document.createElement('section');
    node.className='missed-calls';
    node.innerHTML=`<h2>Llamadas perdidas</h2>${calls.map(call=>`<div class="missed-call">${avatarMarkup({name:call.caller_name,profile_photo:call.caller_photo},'message-avatar')}<span><strong>${esc(call.caller_name)}</strong><small>${call.call_type==='video'?'Videollamada':'Llamada'} · ${new Date(call.created_at).toLocaleString('es')}</small></span></div>`).join('')}`;
    document.querySelector('.conversation-list')?.prepend(node);
  }

  // ---- Navegación entre conversaciones ----
  document.querySelectorAll('.conversation-user').forEach(button=>button.onclick=()=>{
    const query=new URLSearchParams(location.hash.split('?')[1]||'');
    if(button.dataset.groupId){
      query.set('group',button.dataset.groupId);
      query.delete('user');
    }else{
      query.delete('group');
      query.set('user',button.dataset.id);
    }
    location.hash=`#/${state.user.role}/messages?${query.toString()}`;
    renderMessages();
  });

  document.querySelectorAll('.call-user').forEach(button=>button.onclick=()=>startCall(button.dataset.id,button.dataset.video==='true'));
  document.querySelector('#hangup')?.addEventListener('click',endCall);

  document.querySelector('#new-group')?.addEventListener('click',async()=>{
    const name=prompt('Nombre del grupo');
    if(!name||!name.trim())return;
    try{
      await api('/messages/groups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.trim(),members:[]})});
      const query=new URLSearchParams(location.hash.split('?')[1]||'');
      query.delete('user');
      location.hash=`#/${state.user.role}/messages?${query.toString()}`;
      renderMessages();
    }catch(error){notify(error.message)}
  });

  // ---- Fondo del chat ----
  document.querySelector('#toggle-chat-bg')?.addEventListener('click',()=>{
    const panel=document.querySelector('#chat-bg-panel');
    if(panel)panel.hidden=!panel.hidden;
  });
  const swatchGroup=document.querySelector('.bg-swatches');
  const upload=document.querySelector('.chat-bg-upload');
  const bgConfirmButton=document.querySelector('#chat-bg-confirm');
  const bgCancelButton=document.querySelector('#chat-bg-cancel');
  const messageListEl=document.querySelector('.message-list');
  const originalBackground=chatBackground(conversationKey);
  let pendingBackground=null;
  function previewChatBackground(value){
    pendingBackground=value;
    if(messageListEl)messageListEl.style.background=value;
    if(bgConfirmButton)bgConfirmButton.disabled=false;
  }
  if(swatchGroup){
    document.querySelectorAll('.bg-swatch[data-bg]').forEach(swatch=>swatch.onclick=()=>{
      const backgrounds={gradient:'linear-gradient(135deg,#13202B,#2A3541)',solid:'#2A3541',lavender:'linear-gradient(135deg,#767E99,#C4B5C8)',warm:'linear-gradient(135deg,#201B19,#13202B)'};
      document.querySelectorAll('.bg-swatch[data-bg]').forEach(other=>other.classList.toggle('active',other===swatch));
      previewChatBackground(backgrounds[swatch.dataset.bg]);
    })
  }
  upload?.addEventListener('change',async()=>{
    if(!upload.files[0])return;
    try{
      const form=new FormData();
      form.append('background',upload.files[0]);
      const result=await api('/chat-backgrounds',{method:'POST',body:form});
      document.querySelectorAll('.bg-swatch[data-bg]').forEach(swatch=>swatch.classList.remove('active'));
      previewChatBackground(`url(${result.url}) center/cover no-repeat`);
    }catch(error){notify(error.message)}
  });
  bgConfirmButton?.addEventListener('click',()=>{
    if(pendingBackground===null)return;
    localStorage.setItem(`haitani-chat-bg-${conversationKey}`,pendingBackground);
    renderMessages();
  });
  bgCancelButton?.addEventListener('click',()=>{
    if(messageListEl)messageListEl.style.background=originalBackground;
    document.querySelectorAll('.bg-swatch[data-bg]').forEach(swatch=>swatch.classList.toggle('active',swatch.dataset.bg===chatBackgroundKind(conversationKey)));
    pendingBackground=null;
    if(bgConfirmButton)bgConfirmButton.disabled=true;
    const panel=document.querySelector('#chat-bg-panel');
    if(panel)panel.hidden=true;
  });

  // ---- Silenciar / Bloquear conversación ----
  document.querySelector('#mute-conversation')?.addEventListener('click',()=>{
    const nowMuted=!isConvMuted(conversationKey);
    setConvMuted(conversationKey,nowMuted);
    notify(nowMuted?'Notificaciones silenciadas para esta conversación':'Notificaciones activadas');
    renderMessages();
  });
  document.querySelector('#block-conversation')?.addEventListener('click',()=>{
    const nowBlocked=!isConvBlocked(conversationKey);
    if(nowBlocked&&!confirm('¿Bloquear a este contacto? No podrá llamarte ni tú podrás enviarle mensajes hasta desbloquearlo.'))return;
    setConvBlocked(conversationKey,nowBlocked);
    notify(nowBlocked?'Contacto bloqueado':'Contacto desbloqueado');
    endCall();
    renderMessages();
  });

  // ---- Panel de info: SOLO se abre al hacer click en el nombre del contacto/grupo ----
  document.querySelector('#toggle-contact-info')?.addEventListener('click',async()=>{
    const existing=document.querySelector('.conversation-extra');
    if(existing){ existing.remove(); return }
    const conversation=document.querySelector('.conversation');
    if(!conversation)return;
    const details=document.createElement('div');
    details.className='conversation-extra';
    details.innerHTML='<div class="conversation-details"><div class="empty">Cargando información...</div></div>';
    conversation.append(details);
    try{
      if(selectedGroupId){
        const groupDetail=await api(`/messages/groups/${selectedGroupId}`);
        const members=groupDetail.members||[];
        const memberList=members.length?members.map(member=>`<div class="group-member-item">${avatarMarkup(member,'message-avatar')}<div><strong>${esc(member.name)}</strong><small>${esc(member.email||'Sin correo')} · ${esc(formatLastSeen(member.last_seen_at))}</small></div></div>`).join(''):'<div class="empty">No hay miembros en este grupo.</div>';
        details.innerHTML=`<div class="conversation-details"><div class="conversation-details-header"><strong>Miembros del grupo</strong><button class="btn secondary mini" id="add-group-member" type="button">+ Añadir miembro</button></div><div class="group-members">${memberList}</div></div>`;
        document.querySelector('#add-group-member')?.addEventListener('click',async()=>{
          const users=await api('/users').catch(()=>[]);
          const currentMembers=new Set((groupDetail.members||[]).map(member=>member.id));
          const candidates=users.filter(user=>user.active&&user.id!==state.user.id&&!currentMembers.has(user.id));
          if(!candidates.length){notify('Todos los integrantes ya forman parte de este grupo.');return;}
          const query=window.prompt('Escribe el nombre, usuario o correo del integrante a añadir:', '').trim();
          if(!query){return;}
          const match=candidates.find(user=>[user.name,user.username,user.email].some(value=>String(value||'').toLowerCase().includes(query.toLowerCase())));
          if(!match){notify('No se encontró un integrante con ese dato.');return;}
          try{
            await api(`/messages/groups/${selectedGroupId}/members`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:match.id})});
            notify('Miembro añadido al grupo');
            renderMessages();
          }catch(error){notify(error.message)}
        });
      }else if(selectedId){
        const users=await api('/users').catch(()=>[]);
        const user=users.find(item=>String(item.id)===String(selectedId));
        if(user){
          const uKey=directKey(user.id);
          details.innerHTML=`<div class="conversation-details"><strong>Detalles de contacto</strong><div class="contact-details-grid"><div><span class="muted">Correo</span><p>${esc(user.email||'Sin correo')}</p></div><div><span class="muted">Usuario</span><p>@${esc(user.username||'Sin usuario')}</p></div><div><span class="muted">Última vez</span><p>${esc(formatLastSeen(user.last_seen_at))}</p></div></div><div class="actions mt-3"><button class="btn secondary" id="detail-mute">${isConvMuted(uKey)?'Activar notificaciones':'Silenciar notificaciones'}</button><button class="btn danger" id="detail-block">${isConvBlocked(uKey)?'Desbloquear contacto':'Bloquear contacto'}</button></div></div>`;
          document.querySelector('#detail-mute')?.addEventListener('click',()=>{setConvMuted(uKey,!isConvMuted(uKey));renderMessages()});
          document.querySelector('#detail-block')?.addEventListener('click',()=>{
            const nowBlocked=!isConvBlocked(uKey);
            if(nowBlocked&&!confirm('¿Bloquear a este contacto?'))return;
            setConvBlocked(uKey,nowBlocked);renderMessages();
          });
        }else{
          details.innerHTML='<div class="conversation-details"><div class="empty">No se encontró información.</div></div>';
        }
      }
    }catch(error){
      details.innerHTML=`<div class="conversation-details"><div class="empty">${esc(error.message)}</div></div>`;
    }
  });

  // ---- Estados (historias) ----
  document.querySelector('#open-my-status')?.addEventListener('click',()=>{
    const existing=getMyStatus();
    document.body.insertAdjacentHTML('beforeend',myStatusEditorMarkup(existing));
    const overlay=document.querySelector('#status-overlay');
    const close=()=>overlay.remove();
    document.querySelector('#close-status-viewer').onclick=close;
    overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
    document.querySelector('#delete-my-status')?.addEventListener('click',()=>{clearMyStatus();close();notify('Estado eliminado');renderMessages()});
    document.querySelector('#status-form')?.addEventListener('submit',async event=>{
      event.preventDefault();
      const formData=new FormData(event.target);
      const content=String(formData.get('content')||'').trim();
      const file=formData.get('image');
      let image='';
      if(file&&file.size)image=await fileToDataUrl(file);
      if(!content&&!image){notify('Escribe algo o añade una imagen para tu estado.');return}
      saveMyStatus(content,image);
      close();notify('Estado publicado');renderMessages();
    });
  });
  document.querySelectorAll('[data-status-user]').forEach(button=>button.onclick=()=>{
    notify(`${button.dataset.statusName} no tiene actualizaciones de estado recientes.`);
  });

  // ---- Composición de mensajes ----
  const textarea=document.querySelector('#message-form textarea');
  if(textarea){
    textarea.addEventListener('input',()=>{
      textarea.style.height='auto';
      textarea.style.height=`${Math.min(textarea.scrollHeight,140)}px`;
    });
    textarea.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();document.querySelector('#message-form').requestSubmit()}})
  }
  document.querySelector('#message-form')?.addEventListener('submit',async event=>{
    event.preventDefault();
    const form=event.target;
    const formData=new FormData(form);
    const content=String(formData.get('content')||'').trim();
    if(!content && !(formData.get('file')&&formData.get('file').size))return;
    const groupId=form.dataset.groupId;
    if(groupId){
      formData.append('content',content);
    } else {
      formData.append('user_id',selectedId||'');
      formData.append('content',content);
    }
    try{
      await api(groupId?`/messages/groups/${groupId}/messages`:'/messages',{method:'POST',body:formData});
      renderMessages();
    }catch(error){notify(error.message)}
  });
}

async function gantt(){
  const allTasksRaw = await api('/tasks');
  const users = state.user.role === 'admin' ? await api('/users') : [];
  const dayMs = 86400000;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const monthDate = ganttCalendarMonth;
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const gridStart = startOfWeekMonday(monthStart);
  const gridEndOffset = 6 - ((monthEnd.getDay() + 6) % 7);
  const gridEnd = new Date(monthEnd); gridEnd.setDate(gridEnd.getDate() + gridEndOffset);
  const totalGridDays = Math.round((gridEnd - gridStart) / dayMs) + 1;
  const weeksCount = totalGridDays / 7;

  const progress = { pendiente: 0, en_proceso: 50, completada: 100 };
  const parsedTasks = allTasksRaw
    .filter(t => (!ganttStatusFilter || t.status === ganttStatusFilter) && (!ganttAssigneeFilter || String(t.assigned_to || '') === ganttAssigneeFilter))
    .map(t => {
      const start = t.start_date ? new Date(`${t.start_date}T00:00:00`) : (t.due_date ? new Date(`${t.due_date}T00:00:00`) : null);
      const due = t.due_date ? new Date(`${t.due_date}T00:00:00`) : start;
      return { ...t, startDate: start, dueDate: due };
    });
  const scheduledTasks = parsedTasks.filter(t => t.startDate);
  const unscheduledTasks = parsedTasks.filter(t => !t.startDate);

  const MAX_LANES = 4;
  const weeksHtml = [];
  for (let w = 0; w < weeksCount; w++) {
    const weekStart = new Date(gridStart.getTime() + w * 7 * dayMs);
    const weekEnd = new Date(weekStart.getTime() + 6 * dayMs);
    const weekTasks = scheduledTasks.filter(t => t.startDate <= weekEnd && t.dueDate >= weekStart)
      .sort((a, b) => (a.startDate - b.startDate) || ((b.dueDate - b.startDate) - (a.dueDate - a.startDate)));
    const lanesOccupied = [];
    const bars = []; let overflow = 0;
    weekTasks.forEach(task => {
      const segStart = task.startDate < weekStart ? weekStart : task.startDate;
      const segEnd = task.dueDate > weekEnd ? weekEnd : task.dueDate;
      const colStart = Math.round((segStart - weekStart) / dayMs);
      const colSpan = Math.round((segEnd - segStart) / dayMs) + 1;
      let lane = 0;
      while (lane < MAX_LANES) {
        const occ = lanesOccupied[lane] || (lanesOccupied[lane] = []);
        const clash = occ.some(range => colStart < range.end && (colStart + colSpan) > range.start);
        if (!clash) { occ.push({ start: colStart, end: colStart + colSpan }); break }
        lane++;
      }
      if (lane >= MAX_LANES) { overflow++; return }
      bars.push({ task, colStart, colSpan, lane, continuesLeft: task.startDate < weekStart, continuesRight: task.dueDate > weekEnd });
    });
    const lanesUsed = Math.min(MAX_LANES, Math.max(1, bars.reduce((m, b) => Math.max(m, b.lane + 1), 0)));
    const dayBoxes = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(weekStart.getTime() + d * dayMs);
      const outside = date.getMonth() !== monthDate.getMonth();
      const isToday = date.getTime() === today.getTime();
      dayBoxes.push(`<div class="gantt-cal-day ${outside ? 'is-out' : ''} ${isToday ? 'is-today' : ''}" data-date="${toISODate(date)}"><span class="gantt-cal-daynum">${date.getDate()}</span></div>`);
    }
    const barsHtml = bars.map(bar => {
      const percent = progress[bar.task.status] ?? 0;
      return `<div class="gantt-cal-bar ${bar.task.status}" draggable="true" data-id="${bar.task.id}" data-start="${bar.task.start_date || ''}" data-due="${bar.task.due_date || ''}" style="--col-start:${bar.colStart};--col-span:${bar.colSpan};--lane:${bar.lane}" title="${esc(bar.task.title)} · ${esc(bar.task.assignee_name || 'Sin asignar')} · ${percent}%">${bar.continuesLeft ? '<span class="gantt-cal-bar-arrow">‹</span>' : ''}<span class="gantt-cal-bar-label">${esc(bar.task.title)}</span>${bar.continuesRight ? '<span class="gantt-cal-bar-arrow">›</span>' : ''}</div>`;
    }).join('');
    const overflowHtml = overflow ? `<div class="gantt-cal-more" style="--lane:${MAX_LANES}">+${overflow} más</div>` : '';
    weeksHtml.push(`<div class="gantt-cal-week"><div class="gantt-cal-days" style="--lanes:${lanesUsed + (overflow ? 1 : 0)}">${dayBoxes.join('')}</div><div class="gantt-cal-bars">${barsHtml}${overflowHtml}</div></div>`);
  }

  const monthLabel = monthDate.toLocaleDateString('es', { month: 'long', year: 'numeric' });
  const assigneeOptions = users.filter(u => u.role === 'member').map(u => `<option value="${u.id}" ${ganttAssigneeFilter === String(u.id) ? 'selected' : ''}>${esc(u.name)}</option>`).join('');
  const unscheduledHtml = unscheduledTasks.length ? `<section class="card mt-4"><h3>Tareas sin fecha</h3><div class="grid stats">${unscheduledTasks.map(t => `<div class="gantt-unscheduled-item"><strong>${esc(t.title)}</strong><small class="muted">${esc(t.assignee_name || 'Sin asignar')}</small></div>`).join('')}</div></section>` : '';

  return `${heading('Gantt', 'Calendario del proyecto. Cambia de mes, arrastra una tarea a otro día para moverla y haz clic sobre ella para editar su estado o sus fechas.')}<section class="card gantt-card"><div class="gantt-controls"><div class="actions"><button class="btn secondary" id="gantt-prev-month" aria-label="Mes anterior">‹</button><strong class="gantt-month-label">${monthLabel}</strong><button class="btn secondary" id="gantt-next-month" aria-label="Mes siguiente">›</button><button class="btn secondary" id="gantt-today-btn">Hoy</button></div><div class="actions"><label class="inline"><span class="muted gantt-controls-label">Fecha</span><input class="input gantt-date-picker" id="gantt-date-picker" type="date" value="${toISODate(monthStart)}"></label><label class="inline"><span class="muted gantt-controls-label">Estado</span><select class="select" id="gantt-status-filter"><option value="">Todos</option><option value="pendiente" ${ganttStatusFilter === 'pendiente' ? 'selected' : ''}>Pendiente</option><option value="en_proceso" ${ganttStatusFilter === 'en_proceso' ? 'selected' : ''}>En proceso</option><option value="completada" ${ganttStatusFilter === 'completada' ? 'selected' : ''}>Completada</option></select></label>${assigneeOptions ? `<label class="inline"><span class="muted gantt-controls-label">Integrante</span><select class="select" id="gantt-assignee-filter"><option value="">Todos</option>${assigneeOptions}</select></label>` : ''}</div></div><div class="gantt-cal-weekdays">${GANTT_WEEKDAY_LABELS.map(l => `<span>${l}</span>`).join('')}</div><div class="gantt-cal-grid">${weeksHtml.join('')}</div><div class="gantt-legend"><span><i class="gantt-dot pendiente"></i>Pendiente 0%</span><span><i class="gantt-dot en_proceso"></i>En proceso 50%</span><span><i class="gantt-dot completada"></i>Completada 100%</span></div></section>${unscheduledHtml}${ganttChartMarkup(scheduledTasks, unscheduledTasks)}`
}
function ganttChartMarkup(scheduledTasks, unscheduledTasks) {
  const dayMs = 86400000;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let min = null, max = null;
  scheduledTasks.forEach(t => {
    if (!min || t.startDate < min) min = t.startDate;
    if (!max || t.dueDate > max) max = t.dueDate;
  });
  if (!min) { min = new Date(today); max = new Date(today) }
  min = new Date(min); min.setDate(min.getDate() - 2);
  max = new Date(max); max.setDate(max.getDate() + 5);
  if (max < today) { max = new Date(today); max.setDate(max.getDate() + 14) }
  if (min > today) { min = new Date(today); min.setDate(min.getDate() - 2) }
  ganttChartMinDate = min;
  const totalDays = Math.round((max - min) / dayMs) + 1;
  const dayWidth = ganttChartZoom;
  const todayOffset = Math.round((today - min) / dayMs);

  const months = [];
  let cursor = new Date(min);
  while (cursor <= max) {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    const nextMonth = new Date(y, m + 1, 1);
    const segEnd = nextMonth <= max ? new Date(nextMonth.getTime() - dayMs) : new Date(max);
    const days = Math.round((segEnd - cursor) / dayMs) + 1;
    months.push({ label: cursor.toLocaleDateString('es', { month: 'long', year: 'numeric' }), days });
    cursor = nextMonth;
  }
  const dayCells = [];
  for (let i = 0; i < totalDays; i++) {
    const date = new Date(min.getTime() + i * dayMs);
    const isToday = date.getTime() === today.getTime();
    const isWeekend = [0, 6].includes(date.getDay());
    dayCells.push(`<div class="gtc-day ${isToday ? 'is-today' : ''} ${isWeekend ? 'is-weekend' : ''}" style="width:${dayWidth}px">${date.getDate()}</div>`);
  }

  const progress = { pendiente: 0, en_proceso: 50, completada: 100 };
  const rows = [...scheduledTasks].sort((a, b) => a.startDate - b.startDate);
  const labelsHtml = rows.map(t => `<div class="gtc-row-label-fixed"><span title="${esc(t.title)}">${esc(t.title)}</span><small class="muted">${esc(t.assignee_name || 'Sin asignar')}</small></div>`).join('');
  const tracksHtml = rows.map(t => {
    const offset = Math.round((t.startDate - min) / dayMs);
    const span = Math.max(1, Math.round((t.dueDate - t.startDate) / dayMs) + 1);
    const percent = progress[t.status] ?? 0;
    return `<div class="gtc-row"><div class="gtc-bar ${t.status}" data-id="${t.id}" data-start="${t.start_date || ''}" data-due="${t.due_date || ''}" style="left:${offset * dayWidth}px;width:${Math.max(dayWidth - 4, span * dayWidth - 4)}px" title="${esc(t.title)} · ${esc(t.assignee_name || 'Sin asignar')} · ${percent}%"><span class="gtc-bar-fill" style="width:${percent}%"></span><button type="button" class="gtc-bar-handle left" data-edge="start" aria-label="Ajustar inicio"></button><span class="gtc-bar-label">${esc(t.title)}</span><button type="button" class="gtc-bar-handle right" data-edge="due" aria-label="Ajustar fin"></button></div></div>`;
  }).join('');
  const emptyState = rows.length ? '' : '<div class="empty">No hay tareas programadas para mostrar en el diagrama.</div>';
  const unscheduledNote = unscheduledTasks.length ? `<p class="muted gtc-note">${unscheduledTasks.length} tarea(s) sin fecha no se muestran aquí; asígnales fecha inicial y límite para incluirlas.</p>` : '';

  return `<section class="card gantt-chart-card mt-4">
    <div class="gantt-chart-head">
      <div><h2>Diagrama de Gantt</h2><p class="muted">Arrastra una barra para mover la tarea, o sus extremos para ajustar la duración. Haz clic sin arrastrar para editar.</p></div>
      <div class="actions"><button class="btn secondary" id="gtc-zoom-out" aria-label="Alejar">−</button><button class="btn secondary" id="gtc-zoom-in" aria-label="Acercar">+</button></div>
    </div>
    ${rows.length ? `<div class="gtc-wrap"><div class="gtc-labels"><div class="gtc-labels-head">Tarea</div>${labelsHtml}</div><div class="gtc-scroll" id="gtc-scroll"><div class="gtc-timeline" style="width:${totalDays * dayWidth}px"><div class="gtc-months">${months.map(m => `<div class="gtc-month" style="width:${m.days * dayWidth}px">${esc(m.label)}</div>`).join('')}</div><div class="gtc-days">${dayCells.join('')}</div><div class="gtc-rows-area" style="height:${rows.length * 46}px">${todayOffset >= 0 && todayOffset < totalDays ? `<div class="gtc-today-line" style="left:${todayOffset * dayWidth}px"></div>` : ''}${tracksHtml}</div></div></div></div>` : emptyState}
    ${unscheduledNote}
    <div class="gantt-legend"><span><i class="gantt-dot pendiente"></i>Pendiente 0%</span><span><i class="gantt-dot en_proceso"></i>En proceso 50%</span><span><i class="gantt-dot completada"></i>Completada 100%</span></div>
  </section>`;
}
async function renderGantt(){layout(await gantt());bindGanttEvents();bindGanttChartEvents()}
function bindGanttChartEvents() {
  const dayWidth = ganttChartZoom;
  const dayMs = 86400000;
  document.querySelector('#gtc-zoom-in')?.addEventListener('click', () => { ganttChartZoom = Math.min(64, ganttChartZoom + 8); renderGantt() });
  document.querySelector('#gtc-zoom-out')?.addEventListener('click', () => { ganttChartZoom = Math.max(12, ganttChartZoom - 8); renderGantt() });

  document.querySelectorAll('.gtc-bar').forEach(bar => {
    let drag = null;
    const startDrag = (event, mode) => {
      event.preventDefault();
      drag = { mode, startX: event.clientX, originLeft: bar.offsetLeft, originWidth: bar.offsetWidth, moved: false };
      bar.classList.add('is-dragging');
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp, { once: true });
    };
    const onMove = event => {
      if (!drag) return;
      const deltaX = event.clientX - drag.startX;
      if (Math.abs(deltaX) > 3) drag.moved = true;
      if (drag.mode === 'move') {
        bar.style.left = `${Math.max(0, drag.originLeft + deltaX)}px`;
      } else if (drag.mode === 'resize-start') {
        const maxLeft = drag.originLeft + drag.originWidth - dayWidth;
        const newLeft = Math.max(0, Math.min(maxLeft, drag.originLeft + deltaX));
        bar.style.left = `${newLeft}px`;
        bar.style.width = `${drag.originLeft + drag.originWidth - newLeft}px`;
      } else if (drag.mode === 'resize-due') {
        const newWidth = Math.max(dayWidth - 4, drag.originWidth + deltaX);
        bar.style.width = `${newWidth}px`;
      }
    };
    const onUp = async () => {
      document.removeEventListener('pointermove', onMove);
      bar.classList.remove('is-dragging');
      if (!drag) return;
      const { mode, moved } = drag;
      drag = null;
      if (!moved) { openGanttQuickEdit(bar.dataset.id); return }
      const leftPx = parseFloat(bar.style.left);
      const widthPx = parseFloat(bar.style.width);
      const offsetDays = Math.round(leftPx / dayWidth);
      const spanDays = Math.max(1, Math.round((widthPx + 4) / dayWidth));
      const newStart = new Date(ganttChartMinDate.getTime() + offsetDays * dayMs);
      let start_date = bar.dataset.start || toISODate(newStart);
      let due_date = bar.dataset.due || start_date;
      if (mode === 'move') {
        start_date = toISODate(newStart);
        due_date = toISODate(new Date(newStart.getTime() + (spanDays - 1) * dayMs));
      } else if (mode === 'resize-start') {
        start_date = toISODate(newStart);
      } else if (mode === 'resize-due') {
        due_date = toISODate(new Date(newStart.getTime() + (spanDays - 1) * dayMs));
      }
      try {
        const task = await api(`/tasks/${bar.dataset.id}`);
        await api(`/tasks/${bar.dataset.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: task.title, description: task.description || '', assigned_to: task.assigned_to || '', priority: task.priority, status: task.status, start_date, due_date }) });
        notify('Fechas actualizadas');
      } catch (error) { notify(error.message) }
      renderGantt();
    };
    bar.addEventListener('pointerdown', event => {
      if (event.target.closest('.gtc-bar-handle')) return;
      startDrag(event, 'move');
    });
    bar.querySelector('.gtc-bar-handle.left')?.addEventListener('pointerdown', event => { event.stopPropagation(); startDrag(event, 'resize-start') });
    bar.querySelector('.gtc-bar-handle.right')?.addEventListener('pointerdown', event => { event.stopPropagation(); startDrag(event, 'resize-due') });
  });
}
function bindGanttEvents(){
  document.querySelector('#gantt-prev-month')?.addEventListener('click',()=>{ganttCalendarMonth=new Date(ganttCalendarMonth.getFullYear(),ganttCalendarMonth.getMonth()-1,1);renderGantt()});
  document.querySelector('#gantt-next-month')?.addEventListener('click',()=>{ganttCalendarMonth=new Date(ganttCalendarMonth.getFullYear(),ganttCalendarMonth.getMonth()+1,1);renderGantt()});
  document.querySelector('#gantt-today-btn')?.addEventListener('click',()=>{const d=new Date();ganttCalendarMonth=new Date(d.getFullYear(),d.getMonth(),1);renderGantt()});
  document.querySelector('#gantt-date-picker')?.addEventListener('input', e => {
    const picked = e.target.value;
    if (!picked) return;
    const date = new Date(`${picked}T00:00:00`);
    ganttCalendarMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    renderGantt();
  });
  document.querySelector('#gantt-status-filter')?.addEventListener('change',e=>{ganttStatusFilter=e.target.value;renderGantt()});
  document.querySelector('#gantt-assignee-filter')?.addEventListener('change',e=>{ganttAssigneeFilter=e.target.value;renderGantt()});
  document.querySelectorAll('.gantt-cal-bar').forEach(bar=>{
    bar.addEventListener('click',()=>{if(bar.dataset.dragging==='1')return;openGanttQuickEdit(bar.dataset.id)});
    bar.addEventListener('dragstart',event=>{bar.dataset.dragging='1';event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('id',bar.dataset.id);event.dataTransfer.setData('start',bar.dataset.start);event.dataTransfer.setData('due',bar.dataset.due)});
    bar.addEventListener('dragend',()=>{setTimeout(()=>{bar.dataset.dragging='0'},0)});
  });
  document.querySelectorAll('.gantt-cal-day').forEach(day=>{
    day.addEventListener('dragover',event=>{event.preventDefault();day.classList.add('drop-target')});
    day.addEventListener('dragleave',()=>day.classList.remove('drop-target'));
    day.addEventListener('drop',async event=>{
      event.preventDefault();day.classList.remove('drop-target');
      const id=event.dataTransfer.getData('id');const originalStart=event.dataTransfer.getData('start');const originalDue=event.dataTransfer.getData('due');
      if(!id||!originalStart)return;
      const targetDate=day.dataset.date;
      const deltaDays=Math.round((new Date(`${targetDate}T00:00:00`)-new Date(`${originalStart}T00:00:00`))/86400000);
      if(!deltaDays)return;
      const newStart=addDays(originalStart,deltaDays);
      const newDue=originalDue?addDays(originalDue,deltaDays):newStart;
      try{
        const task=await api(`/tasks/${id}`);
        await api(`/tasks/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:task.title,description:task.description||'',assigned_to:task.assigned_to||'',priority:task.priority,status:task.status,start_date:newStart,due_date:newDue})});
        notify('Fechas actualizadas');
      }catch(error){notify(error.message)}
      renderGantt();
    });
  });
  document.querySelectorAll('.gantt-cal-more').forEach(more=>more.addEventListener('click',()=>notify('Hay más tareas esta semana de las que caben. Filtra por integrante o estado para verlas todas.')));
}
async function openGanttQuickEdit(id){
  let task;try{task=await api(`/tasks/${id}`)}catch(error){notify(error.message);return}
  document.querySelectorAll('.gantt-popover').forEach(node=>node.remove());
  const popover=document.createElement('div');
  popover.className='gantt-popover';
  popover.innerHTML=`<strong>${esc(task.title)}</strong><label>Estado<select class="select" id="gp-status"><option value="pendiente" ${task.status==='pendiente'?'selected':''}>Pendiente</option><option value="en_proceso" ${task.status==='en_proceso'?'selected':''}>En proceso</option><option value="completada" ${task.status==='completada'?'selected':''}>Completada</option></select></label><label>Fecha inicial<input class="input" type="date" id="gp-start" value="${task.start_date||''}"></label><label>Fecha límite<input class="input" type="date" id="gp-due" value="${task.due_date||''}"></label><div class="actions"><button class="btn" id="gp-save">Guardar</button><button type="button" class="btn secondary" id="gp-close">Cerrar</button></div>`;
  document.body.append(popover);
  const anchor=document.querySelector(`.gantt-cal-bar[data-id="${id}"]`)||document.querySelector(`.gtc-bar[data-id="${id}"]`)||document.body;
  const rect=anchor.getBoundingClientRect();
  popover.style.left=`${Math.max(8,Math.min(rect.left,window.innerWidth-280))}px`;
  popover.style.top=`${Math.min(rect.bottom+8,window.innerHeight-260)}px`;
  const close=()=>{popover.remove();document.removeEventListener('pointerdown',onOutside)};
  const onOutside=e=>{if(!popover.contains(e.target))close()};
  setTimeout(()=>document.addEventListener('pointerdown',onOutside),0);
  document.querySelector('#gp-close').onclick=close;
  document.querySelector('#gp-save').onclick=async()=>{
    try{
      const start=document.querySelector('#gp-start').value;
      const due=document.querySelector('#gp-due').value;
      await api(`/tasks/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:task.title,description:task.description||'',assigned_to:task.assigned_to||'',priority:task.priority,status:document.querySelector('#gp-status').value,start_date:start,due_date:due})});
      notify('Tarea actualizada');close();renderGantt()
    }catch(error){notify(error.message)}
  }
}
const renderMessagesLegacy=renderMessages;
renderMessages=async function(){await renderMessagesLegacy();const callHead=document.querySelector('.call-head');if(callHead&&!document.querySelector('#mute-call'))callHead.insertAdjacentHTML('beforeend','<button class="btn secondary btn-with-icon" id="mute-call">'+iconAsset('mute','Silenciar micrófono')+'<span>Silenciar micrófono</span></button>');document.querySelector('#mute-call')?.addEventListener('click',toggleMute);const calls=await api('/calls').catch(()=>[]);if(calls.length&&!document.querySelector('.missed-calls')){const node=document.createElement('section');node.className='missed-calls';node.innerHTML=`<h2>Llamadas perdidas</h2>${calls.map(call=>`<div class="missed-call">${avatarMarkup({name:call.caller_name,profile_photo:call.caller_photo},'message-avatar')}<span><strong>${esc(call.caller_name)}</strong><small>${call.call_type==='video'?'Videollamada':'Llamada'} · ${new Date(call.created_at).toLocaleString('es')}</small></span></div>`).join('')}`;document.querySelector('.conversation-list')?.prepend(node)}}
const RELAX_SOURCES=[['spotify','Spotify'],['youtube','YouTube'],['soundcloud','SoundCloud']];
let relaxSource='spotify';
function sourceLabel(key){return RELAX_SOURCES.find(([value])=>value===key)?.[1]||key}
function trackImage(track){return track.artwork_url||track.artworkUrl||track.image||track.thumbnail||track.cover||track.cover_url||track.coverUrl||track.album?.images?.[0]?.url||track.album_art||track.thumbnails?.high?.url||track.thumbnails?.default?.url||''}
async function relax(){return `${`<section class="relax-hero"><div class="relax-hero-text"><div class="eyebrow">Haitani </div><h1>Relax 梵天</h1><p class="muted">Encuentra tu playlist de enfoque y reprodúcela sin salir del panel.</p></div></section>`}<section class="card relax-search"><form id="music-search" class="relax-search-form"><div class="relax-search-input"><span class="relax-search-icon">♪</span><input class="input" name="q" placeholder="Busca una canción, artista o álbum" required></div><div class="source-pills" role="radiogroup" aria-label="Fuente de música">${RELAX_SOURCES.map(([value,label])=>`<button type="button" class="source-pill ${relaxSource===value?'active':''}" data-source="${value}">${label}</button>`).join('')}</div><input type="hidden" name="source" value="${relaxSource}"><button class="btn relax-search-btn">Buscar</button></form></section><section id="music-results" class="music-results empty"><div class="relax-empty"><div class="relax-empty-icon">♫</div><p>Busca una canción para comenzar a relajarte.</p></div></section><section class="card music-player" id="music-player" hidden><div class="music-player-art" id="music-art">♪</div><div class="music-player-info"><span class="music-player-eq"><i></i><i></i><i></i><i></i></span><div><strong id="music-title">Selecciona una pista</strong><small id="music-artist" class="muted"></small></div></div><audio id="music-audio" controls preload="none"></audio><a id="music-link" class="btn secondary" target="_blank" rel="noopener">Abrir servicio</a></section>`}
function musicUrl(track){return track.preview_url||track.previewUrl||track.audio||track.stream_url||track.streamUrl||track.permalink_url||track.permalinkUrl||track.embed_url||track.embedUrl||track.link||track.uri||track.url||track.external_url||track.externalUrl}
function musicEmbed(url){const value=String(url||'');const youtube=value.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^?&/]+)/);if(youtube)return `https://www.youtube.com/embed/${youtube[1]}?autoplay=1`;const spotify=value.match(/open\.spotify\.com\/(track|album|playlist)\/([^?&/]+)/);if(spotify)return `https://open.spotify.com/embed/${spotify[1]}/${spotify[2]}?utm_source=generator`;if(value.includes('soundcloud.com/'))return `https://w.soundcloud.com/player/?url=${encodeURIComponent(value)}&color=%237D9B9F&auto_play=true&hide_related=true&show_comments=false&show_user=true&show_reposts=false&visual=false&show_artwork=true`;return ''}
function loadSoundCloudWidget(){return new Promise(resolve=>{if(window.SC?.Widget){resolve();return}const script=document.createElement('script');script.src='https://w.soundcloud.com/player/api.js';script.onload=resolve;script.onerror=resolve;document.head.append(script)})}
async function playSoundCloud(frame,fallbackUrl){await loadSoundCloudWidget();if(!window.SC?.Widget)return;const widget=window.SC.Widget(frame);widget.bind(window.SC.Widget.Events.READY,()=>widget.play());widget.bind(window.SC.Widget.Events.ERROR,()=>notify('SoundCloud no puede reproducir esta pista (restringida o no disponible). Prueba otra, o ábrela directo en SoundCloud.'))}
async function renderRelax(){layout(await relax());const form=document.querySelector('#music-search');document.querySelectorAll('.source-pill').forEach(pill=>pill.onclick=()=>{relaxSource=pill.dataset.source;form.elements.source.value=relaxSource;document.querySelectorAll('.source-pill').forEach(p=>p.classList.toggle('active',p===pill))});form.onsubmit=async event=>{event.preventDefault();const values=Object.fromEntries(new FormData(event.target));const results=document.querySelector('#music-results');results.className='music-results empty';results.innerHTML='<div class="relax-empty"><div class="relax-empty-icon">♪</div><p>Buscando...</p></div>';try{const data=await api(`/music/search?q=${encodeURIComponent(values.q)}&source=${encodeURIComponent(values.source)}`);if(!data.configured){results.innerHTML='<div class="relax-empty"><div class="relax-empty-icon">⚠</div><p>MusicAPI no está configurada en el servidor.</p></div>';return}if(!data.tracks.length){results.innerHTML='<div class="relax-empty"><div class="relax-empty-icon">🔍</div><p>No encontramos pistas.</p></div>';return}results.className='music-results';results.innerHTML=data.tracks.map((track,index)=>{const title=track.title||track.name||'Pista sin título';const artist=track.artist?.name||track.artist||track.artistNames?.join(', ')||track.artists?.[0]?.name||'Artista desconocido';const url=musicUrl(track);const img=trackImage(track);return `<article class="music-track" data-index="${index}"><div class="music-track-cover" style="${img?`background-image:url('${esc(img)}')`:''}">${img?'':'♪'}</div><div class="music-track-info"><strong>${esc(title)}</strong><small class="muted">${esc(artist)}</small><span class="badge music-track-source">${esc(sourceLabel(values.source))}</span></div><button class="btn play-track" data-index="${index}" ${url?'':'disabled'}>${url?'Reproducir':'Sin preview'}</button></article>`}).join('');results.querySelectorAll('.play-track').forEach(button=>button.onclick=async()=>{document.querySelectorAll('.music-track').forEach(node=>node.classList.toggle('is-playing',node.dataset.index===button.dataset.index));const track=data.tracks[Number(button.dataset.index)];const url=musicUrl(track);const embed=musicEmbed(url);const player=document.querySelector('#music-player');const audio=document.querySelector('#music-audio');const title=track.title||track.name||'Pista';const artist=track.artist?.name||track.artist||track.artistNames?.join(', ')||'';const img=trackImage(track);document.querySelector('#music-title').textContent=title;document.querySelector('#music-artist').textContent=artist;document.querySelector('#music-link').href=url||'#';const art=document.querySelector('#music-art');if(img){art.style.backgroundImage=`url('${img}')`;art.textContent=''}else{art.style.backgroundImage='';art.textContent='♪'}player.classList.add('is-playing');if(embed){audio.hidden=true;let frame=document.querySelector('#music-embed');if(!frame){frame=document.createElement('iframe');frame.id='music-embed';frame.className='music-embed';frame.allow='autoplay; encrypted-media; clipboard-write';frame.referrerPolicy='strict-origin-when-cross-origin';audio.after(frame)}frame.src=embed;frame.hidden=false;if(embed.includes('soundcloud.com/player'))playSoundCloud(frame,url)}else if(track.previewUrl||track.preview_url||track.audio){document.querySelector('#music-embed')?.remove();audio.hidden=false;audio.src=track.previewUrl||track.preview_url||track.audio;audio.play().catch(()=>notify('Pulsa reproducir para iniciar el audio.'))}else{audio.hidden=true;document.querySelector('#music-embed')?.remove();player.classList.remove('is-playing');notify('Este servicio no entrega preview de audio. Usa el reproductor embebido o abre el servicio.')}player.hidden=false})}catch(error){results.innerHTML=`<div class="relax-empty"><div class="relax-empty-icon">⚠</div><p>${esc(error.message)}</p></div>`}}}
async function assistant(){return `${heading('Asistente IA','Controla el proyecto con preguntas sobre tareas, responsables y fechas.')}<section class="assistant-shell"><div class="assistant-intro"><div><span class="assistant-kicker">Sanzu / Sakura Coffee</span><h2>Tu copiloto de operaciones</h2><p>Consulta el estado del proyecto y recibe respuestas basadas en la información actual del panel.</p></div><span class="assistant-status"><i></i>Conectado al panel</span></div><div class="assistant-suggestions"><button class="btn secondary assistant-suggestion">¿Qué tareas están vencidas?</button><button class="btn secondary assistant-suggestion">¿Cuál es el progreso del proyecto?</button><button class="btn secondary assistant-suggestion">Dame un resumen para la reunión</button></div><div class="assistant-messages" id="assistant-messages"><article class="assistant-message assistant-bot"><span class="assistant-avatar">S</span><div><strong>Sanzu</strong><p>Hola, ${esc(state.user.name)}. Puedo ayudarte a detectar riesgos y preparar el siguiente paso del proyecto.</p><small>Listo para consultar Sakura Coffee</small></div></article></div><form class="assistant-form" id="assistant-form"><textarea class="textarea" name="message" rows="2" placeholder="Pregunta por el progreso, tareas vencidas o próximos pasos..." required></textarea><button class="btn assistant-send" aria-label="Enviar pregunta">Enviar <span>↗</span></button></form></section>`}
async function renderAssistant(){layout(await assistant());const messages=document.querySelector('#assistant-messages');const form=document.querySelector('#assistant-form');const ask=async message=>{if(!message.trim())return;messages.insertAdjacentHTML('beforeend',`<article class="assistant-message assistant-user"><span class="assistant-avatar">${esc(state.user.name[0])}</span><div><strong>Tú</strong><p>${esc(message)}</p></div></article>`);form.reset();messages.insertAdjacentHTML('beforeend','<div class="assistant-loading" id="assistant-loading">Sanzu está analizando el proyecto...</div>');messages.scrollTop=messages.scrollHeight;try{const result=await api('/assistant/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message})});document.querySelector('#assistant-loading')?.remove();messages.insertAdjacentHTML('beforeend',`<article class="assistant-message assistant-bot"><span class="assistant-avatar">S</span><div><strong>Sanzu <small class="assistant-source">${result.source==='sanzu'?'IA remota':'Modo local'}</small></strong><p>${esc(result.answer)}</p><small>${result.warning?esc(result.warning):'Contexto actualizado desde el proyecto'}</small></div></article>`);messages.scrollTop=messages.scrollHeight}catch(error){document.querySelector('#assistant-loading')?.remove();notify(error.message)}};form.onsubmit=event=>{event.preventDefault();ask(new FormData(form).get('message'))};document.querySelectorAll('.assistant-suggestion').forEach(button=>button.onclick=()=>ask(button.textContent))}
async function settings(){return `${heading('Configuración','El token solo vive en memoria del servidor y nunca se devuelve al navegador.')}<section class="card"><form id="github-settings" class="form-grid"><label>URL del repositorio<input class="input" name="url" placeholder="https://github.com/owner/repository" required></label><label>Owner<input class="input" name="owner" required></label><label>Repository<input class="input" name="repo" placeholder="CoffeeKorea" required></label><label>Token de GitHub<input class="input" name="token" type="password" required></label><div class="actions full"><button class="btn">Guardar y probar conexión</button></div></form></section>`}
async function renderSettings(){layout(await settings());const projects=await api('/projects');const form=document.querySelector('#github-settings');form.insertAdjacentHTML('afterbegin',`<label>Proyecto<select class="select" name="project_id" required>${projects.map(project=>`<option value="${project.id}" ${String(project.id)===localStorage.getItem('haitani-github-project')?'selected':''}>${esc(project.name)}</option>`).join('')}</select></label>`);form.onsubmit=async e=>{e.preventDefault();try{const values=Object.fromEntries(new FormData(e.target));localStorage.setItem('haitani-github-project',values.project_id);await api('/github/configure',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)});await api('/github/test');notify('Conexión con GitHub establecida correctamente.')}catch(error){notify(error.message)}}}
async function billing(){const [status,plans]=await Promise.all([api('/billing/status'),api('/plans')]);const money=plan=>plan.price_cents?`${(plan.price_cents/100).toLocaleString('es-MX',{style:'currency',currency:plan.currency})} / mes`:'Gratis';return `${heading('Facturación','Administra el plan y el estado de la suscripción.')}<section class="card"><div class="grid stats"><div><div class="muted">Plan actual</div><h2>${esc(status.plan_name)}</h2></div><div><div class="muted">Estado</div><h2>${esc(status.subscription_status)}</h2></div><div><div class="muted">Próximo periodo</div><h2>${status.current_period_end?new Date(status.current_period_end).toLocaleDateString('es-MX'):'No definido'}</h2></div></div></section><section class="grid two mt-4">${plans.map(plan=>`<article class="card plan-card${plan.key===status.plan_key?' current':''}"><div class="eyebrow">${esc(plan.key)}</div><h2>${esc(plan.name)}</h2><p class="num">${money(plan)}</p><p class="muted">${plan.max_users??'Ilimitados'} usuarios · ${plan.max_projects??'Ilimitados'} proyectos · ${plan.max_storage_mb} MB</p><button class="btn billing-plan" data-plan="${esc(plan.key)}">${plan.key===status.plan_key?'Plan actual':'Elegir plan'}</button></article>`).join('')}</section>`}
async function renderBilling(){layout(await billing());document.querySelectorAll('.billing-plan').forEach(button=>button.onclick=async()=>{const planKey=String(button.dataset.plan||'').trim().toLowerCase();if(!planKey)return notify('El plan seleccionado no es válido.');button.disabled=true;try{const result=await api('/billing/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan_key:planKey})});if(result.redirect)window.location.href=result.redirect;else{notify('Plan actualizado');renderBilling()}}catch(error){button.disabled=false;notify(error.message)}})}
async function enhanceConversation(){const conversation=document.querySelector('.conversation');if(!conversation||conversation.dataset.enhanced)return;conversation.dataset.enhanced='true';const selectedId=new URLSearchParams(location.hash.split('?')[1]||'').get('user');if(!selectedId)return;const key=`${Math.min(state.user.id,Number(selectedId))}-${Math.max(state.user.id,Number(selectedId))}`;const tools=conversation.querySelector('.conversation-tools');tools?.insertAdjacentHTML('beforeend','<div class="icon-group conversation-actions"><button class="icon-btn" id="archive-conversation" title="Archivar" aria-label="Archivar">🗂</button><button class="icon-btn" id="schedule-call" title="Programar llamada" aria-label="Programar llamada">🕑</button><button class="icon-btn danger" id="delete-conversation" title="Borrar conversación" aria-label="Borrar conversación">🗑</button></div>');const messages=await api(`/messages?user_id=${selectedId}`).catch(()=>[]);document.querySelectorAll('.message.mine small').forEach((node,index)=>{const message=messages.filter(item=>item.sender_id===state.user.id)[index];if(message)node.textContent=`${node.textContent} · ${message.delivery_status==='leido'?'✓✓ leído':message.delivery_status==='entregado'?'✓✓ entregado':'✓ enviado'}`});document.querySelector('#archive-conversation').onclick=()=>{localStorage.setItem(`haitani-archived-${key}`,'1');notify('Conversación archivada')};document.querySelector('#delete-conversation').onclick=async()=>{if(confirm('¿Borrar toda esta conversación?')){await api(`/messages/conversation/${selectedId}`,{method:'DELETE'});renderMessages()}};document.querySelector('#schedule-call').onclick=async()=>{const date=prompt('Fecha y hora de la llamada (YYYY-MM-DDTHH:mm):');if(!date)return;try{await api('/calls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({receiver_id:selectedId,call_type:'audio',scheduled_at:date})});notify('Llamada programada');}catch(error){notify(error.message)}}}
const conversationObserver=new MutationObserver(()=>enhanceConversation());conversationObserver.observe(app,{childList:true,subtree:true});
async function render(){if(!state.user){try{state.user=(await api('/auth/me')).user}catch{}if(!state.user)return loginView()}await refreshNotifications();startNotificationPolling();const route=location.hash||`#/${state.user.role}/dashboard`;try{if(route.includes('assistant'))return state.user.role==='admin'?renderAssistant():renderDashboard();if(route.includes('kanban'))return renderKanban();if(route.includes('gantt'))return renderGantt();if(route.includes('messages'))return renderMessages();if(route.includes('members'))return state.user.role==='admin'?renderMembers():renderTeam();if(route.includes('files'))return renderFiles();if(route.includes('billing'))return state.user.role==='admin'?renderBilling():renderDashboard();if(route.includes('settings'))return renderSettings();if(route.includes('profile'))return renderProfile();if(route.includes('team-activity'))return renderGithub('activity');if(route.includes('github'))return renderGithub(route.includes('commits')?'commits':route.includes('branches')?'branches':route.includes('pull-requests')?'pulls':route.includes('activity')?'activity':'repository');if(route.includes('tasks'))return renderTasks();return renderDashboard()}catch(error){layout(`<div class="alert">${esc(error.message)}</div>`)}}
function absenceWarning(absences){return `<div class="alert absence-warning" id="absence-warning"><strong>Cuidado:</strong> ya llevas ${absences.length} inasistencias. Se aplicará una sanción.<div class="absence-warning-actions"><button class="btn secondary absence-action" data-action="justified">Ya justifiqué mi inasistencia</button><button class="btn secondary absence-action" data-action="understood">Entendido</button></div></div>`}
const renderDashboardBase=renderDashboard;
renderDashboard=async function(){const absences=state.user.role==='member'?await api('/absences'):[];await renderDashboardBase();if(absences.length>=4){document.querySelector('.content')?.insertAdjacentHTML('afterbegin',absenceWarning(absences));document.querySelectorAll('.absence-action').forEach(button=>button.onclick=()=>{document.querySelector('#absence-warning')?.remove();notify(button.dataset.action==='justified'?'Se registró que ya justificaste tu inasistencia.':'Aviso entendido.')})}}
function absenceAdminPanel(absences, users){const memberOptions=users.filter(user=>user.role==='member').map(user=>`<option value="${user.id}">${esc(user.name)}</option>`).join('');return `<section class="card absence-admin" id="absence-admin"><div class="section-heading"><div><h2>Inasistencias</h2><p class="muted">Registra la fecha y la materia de cada falta.</p></div><strong class="absence-total">${absences.length} registradas</strong></div><form id="absence-form" class="form-grid"><label>Integrante<select class="select" name="user_id" required><option value="">Selecciona un integrante</option>${memberOptions}</select></label><label>Fecha<input class="input" name="absence_date" type="date" required></label><label>Materia<input class="input" name="subject" required></label><div class="actions full"><button class="btn">Añadir inasistencia</button></div></form><div class="absence-list">${absences.map(absence=>`<div class="absence-row"><span><strong>${esc(absence.user_name)}</strong><small class="muted">${esc(absence.absence_date)} · ${esc(absence.subject)}</small></span><button class="btn danger delete-absence" data-id="${absence.id}">Eliminar</button></div>`).join('')||'<div class="empty">No hay inasistencias registradas.</div>'}</div></section>`}
async function renderAbsenceAdmin(){const [absences,users]=await Promise.all([api('/absences'),api('/users')]);document.querySelector('.content').insertAdjacentHTML('beforeend',absenceAdminPanel(absences,users));document.querySelector('#absence-form').onsubmit=async event=>{event.preventDefault();try{await api('/absences',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(event.target)))});notify('Inasistencia añadida');renderMembers()}catch(error){notify(error.message)}};document.querySelectorAll('.delete-absence').forEach(button=>button.onclick=async()=>{if(confirm('¿Eliminar esta inasistencia?')){await api(`/absences/${button.dataset.id}`,{method:'DELETE'});renderMembers()}})}
const renderMembersBase=renderMembers;
renderMembers=async function(){await renderMembersBase();await renderAbsenceAdmin()}
async function registerView(error=''){
  let plans=[];
  try{plans=await api('/plans')}catch(requestError){error=requestError.message}
  app.innerHTML=`<main class="login"><form class="login-box wide" id="organization-register"><div class="brand">HAI<span>TANI</span></div><div class="eyebrow">Crear organización</div><h1>Comienza con Haitani</h1>${error?`<div class="alert">${esc(error)}</div>`:''}<div class="form-grid"><label>Empresa<input class="input" name="company_name" required></label><label>Slug<input class="input" name="slug" pattern="[a-z0-9][a-z0-9-]{2,49}" required></label><label>Correo de empresa<input class="input" name="email" type="email" required></label><label>Nombre<input class="input" name="first_name" required></label><label>Apellido<input class="input" name="last_name" required></label><label>Correo del administrador<input class="input" name="admin_email" type="email" required></label><label>Contraseña<input class="input" name="password" type="password" minlength="8" required></label><label class="full">Descripción<textarea class="textarea" name="description"></textarea></label><fieldset class="full"><legend>Selecciona un plan</legend><div class="grid two">${plans.map((plan,index)=>`<label class="card"><input type="radio" name="plan_key" value="${esc(plan.key)}" ${index===0?'checked':''}><strong>${esc(plan.name)}</strong><span class="muted">${plan.price_cents?`${(plan.price_cents/100).toLocaleString('es-MX',{style:'currency',currency:plan.currency})} / mes · `:'Gratis · '}${plan.max_users??'Ilimitados'} usuarios · ${plan.max_projects??'Ilimitados'} proyectos · ${plan.max_storage_mb} MB</span></label>`).join('')}</div></fieldset></div><button class="btn btn-block">Crear organización</button><button type="button" class="btn secondary btn-block" id="back-to-login">Volver al inicio de sesión</button></form></main>`;
  document.querySelector('#back-to-login').onclick=()=>loginView();
  document.querySelector('#organization-register').onsubmit=async event=>{event.preventDefault();try{const data=await api('/organizations/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(event.target)))});state.user=data.user;location.hash=data.redirect;render()}catch(requestError){registerView(requestError.message)}}
}
const loginViewBase=loginView;
loginView=function(error=''){loginViewBase(error);const button=document.createElement('button');button.type='button';button.className='btn secondary btn-block';button.id='show-register';button.textContent='Crear organización';document.querySelector('.login-box')?.append(button);button.onclick=()=>registerView()};
renderAssistant=async function(){layout(await assistant());let repositoryName='Repositorio';try{const github=await api('/github/repository');repositoryName=github.data?.name||repositoryName}catch{}document.querySelector('.assistant-kicker')?.replaceChildren(document.createTextNode(`Sanzu / ${repositoryName}`));document.querySelector('.assistant-message small')?.replaceChildren(document.createTextNode(`Listo para consultar ${repositoryName}`))};
const renderGithubBase=renderGithub;
renderGithub=async function(section='repository'){await renderGithubBase(section);if(section!=='repository')return;let repositoryName='Repositorio';try{const github=await api('/github/repository');repositoryName=github.data?.name||repositoryName}catch{}const subtitle=document.querySelector('.heading p');if(subtitle)subtitle.textContent=`Información real del repositorio ${repositoryName}.`};
const renderSettingsBase=renderSettings;
renderSettings=async function(){await renderSettingsBase();let data;try{data=await api('/security/ip-blocks')}catch(error){return}const section=document.createElement('section');section.className='card mt-4';section.innerHTML=`<h2>Bloqueo de IP</h2><p class="muted">IP actual: ${esc(data.current_ip||'No disponible')}</p><form id="ip-block-form" class="form-grid"><label>Dirección IPv4<input class="input" name="ip" placeholder="203.0.113.10" required></label><label>Motivo<input class="input" name="reason" placeholder="Actividad sospechosa"></label><div class="actions full"><button class="btn danger">Bloquear IP</button></div></form><div class="table-wrap"><table class="table"><thead><tr><th>IP</th><th>Motivo</th><th>Fecha</th><th></th></tr></thead><tbody>${data.blocks.map(block=>`<tr><td>${esc(block.ip)}</td><td>${esc(block.reason||'Sin motivo')}</td><td>${esc(block.created_at)}</td><td><button class="btn secondary unblock-ip" data-id="${block.id}">Desbloquear</button></td></tr>`).join('')||'<tr><td colspan="4" class="empty">No hay IPs bloqueadas.</td></tr>'}</tbody></table></div>`;section.insertAdjacentHTML('beforeend',`<h2 class="mt-4">Actividad reciente</h2><div class="table-wrap"><table class="table"><thead><tr><th>IP</th><th>Usuario</th><th>Navegador</th><th>Ruta</th><th>Estado</th><th>Inusual</th><th>Fecha</th><th></th></tr></thead><tbody>${data.activity.map(event=>`<tr><td>${esc(event.ip)}</td><td>${esc(event.user_name||'No autenticado')}</td><td title="${esc(event.user_agent)}">${esc(event.user_agent||'No disponible').slice(0,60)}</td><td>${esc(event.method)} ${esc(event.path)}</td><td>${event.status}</td><td>${event.unusual?`<span class="badge pink">${esc(event.reason||'Sí')}</span>`:'No'}</td><td>${esc(event.created_at)}</td><td><button class="btn secondary block-event-ip" data-ip="${esc(event.ip)}">Bloquear</button></td></tr>`).join('')||'<tr><td colspan="8" class="empty">No hay actividad registrada.</td></tr>'}</tbody></table></div>`);document.querySelector('.content')?.append(section);section.querySelector('#ip-block-form').onsubmit=async event=>{event.preventDefault();try{await api('/security/ip-blocks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(event.target)))});notify('IP bloqueada');renderSettings()}catch(error){notify(error.message)}};section.querySelectorAll('.unblock-ip').forEach(button=>button.onclick=async()=>{try{await api(`/security/ip-blocks/${button.dataset.id}`,{method:'DELETE'});notify('IP desbloqueada');renderSettings()}catch(error){notify(error.message)}});section.querySelectorAll('.block-event-ip').forEach(button=>button.onclick=async()=>{try{await api('/security/ip-blocks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ip:button.dataset.ip,reason:'Bloqueada desde el registro de actividad'})});notify('IP bloqueada');renderSettings()}catch(error){notify(error.message)}})};
function formatLastSeen(dateStr){
  if (!dateStr) return 'Nunca';
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  if (Number.isNaN(date.getTime())) return 'Sin información';
  if (diffMs < 60000) return 'Ahora mismo';
  if (diffMs < 3600000) return `${Math.max(1, Math.floor(diffMs / 60000))} min atrás`;
  if (diffMs < 86400000) return `${Math.max(1, Math.floor(diffMs / 3600000))} h atrás`;
  const days = Math.max(1, Math.floor(diffMs / 86400000));
  return `${days} día${days === 1 ? '' : 's'} atrás`;
}
const renderMessagesBase2=renderMessages;
renderMessages=async function(){
  await renderMessagesBase2();
  const params=new URLSearchParams(location.hash.split('?')[1]||'');
  const selectedId=params.get('user');
  const selectedGroupId=params.get('group');
  const conversation=document.querySelector('.conversation');
  if(!conversation)return;
  const extra=document.querySelector('.conversation-extra');
  if(extra)extra.remove();
  const details=document.createElement('div');
  details.className='conversation-extra';
  try {
    if(selectedGroupId){
      const groupDetail=await api(`/messages/groups/${selectedGroupId}`);
      const members=groupDetail.members || [];
      const memberList=members.length?members.map(member=>`<div class="group-member-item">${avatarMarkup(member,'message-avatar')}<div><strong>${esc(member.name)}</strong><small>${esc(member.email||'Sin correo')} · ${esc(formatLastSeen(member.last_seen_at))}</small></div></div>`).join(''):'<div class="empty">No hay miembros en este grupo.</div>';
      details.innerHTML=`<div class="conversation-details"><div class="conversation-details-header"><strong>Miembros del grupo</strong><button class="btn secondary mini" id="add-group-member" type="button">+ Añadir miembro</button></div><div class="group-members">${memberList}</div></div>`;
      conversation.append(details);
      document.querySelector('#add-group-member')?.addEventListener('click',async()=>{
        const users=await api('/users').catch(()=>[]);
        const currentMembers=new Set((groupDetail.members||[]).map(member=>member.id));
        const candidates=users.filter(user=>user.active&&user.id!==state.user.id&&!currentMembers.has(user.id));
        if(!candidates.length){notify('Todos los integrantes ya forman parte de este grupo.');return;}
        const query=window.prompt('Escribe el nombre, usuario o correo del integrante a añadir:', '').trim();
        if(!query){return;}
        const match=candidates.find(user=>[user.name,user.username,user.email].some(value=>String(value||'').toLowerCase().includes(query.toLowerCase())));
        if(!match){notify('No se encontró un integrante con ese dato.');return;}
        try{
          await api(`/messages/groups/${selectedGroupId}/members`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:match.id})});
          notify('Miembro añadido al grupo');
          renderMessages();
        }catch(error){notify(error.message)}
      });
      return;
    }
    if(selectedId){
      const users=await api('/users').catch(()=>[]);
      const user=users.find(item=>String(item.id)===String(selectedId));
      if(user){
        const detailsHtml=`<div class="conversation-details"><strong>Detalles de contacto</strong><div class="contact-details-grid"><div><span class="muted">Correo</span><p>${esc(user.email||'Sin correo')}</p></div><div><span class="muted">Usuario</span><p>@${esc(user.username||'Sin usuario')}</p></div><div><span class="muted">Última vez</span><p>${esc(formatLastSeen(user.last_seen_at))}</p></div></div></div>`;
        details.innerHTML=detailsHtml;
        conversation.append(details);
      }
    }
  }catch(error){
    console.warn('No fue posible cargar detalles adicionales del chat:', error.message);
  }
};
const renderSettingsBase2=renderSettings;
renderSettings=async function(){
  await renderSettingsBase2();
  const section=document.querySelector('.card.mt-4');
  if(!section)return;
  try {
    const data=await api('/security/ip-blocks');
    const tables=section.querySelectorAll('table.table');
    const blocksTable=tables[0];
    const activityTable=tables[1];
    if(blocksTable){
      const blocksPage=paginateItems(data.blocks||[], 'securityBlocks', 5);
      const blocksContainer=blocksTable.closest('.table-wrap');
      blocksContainer?.querySelector('.security-blocks-pagination')?.remove();
      blocksTable.querySelector('tbody').innerHTML=blocksPage.items.map(block=>`<tr><td>${esc(block.ip)}</td><td>${esc(block.reason||'Sin motivo')}</td><td>${esc(block.created_at)}</td><td><button class="btn secondary unblock-ip" data-id="${block.id}">Desbloquear</button></td></tr>`).join('')||'<tr><td colspan="4" class="empty">No hay IPs bloqueadas.</td></tr>';
      blocksContainer?.insertAdjacentHTML('afterend', paginationMarkup('securityBlocks', 'renderSettings', blocksPage.totalPages, blocksPage.currentPage, blocksPage.totalItems, 5));
    }
    if(activityTable){
      const activityPage=paginateItems(data.activity||[], 'securityActivity', 8);
      const activityContainer=activityTable.closest('.table-wrap');
      activityContainer?.querySelector('.security-activity-pagination')?.remove();
      activityTable.querySelector('tbody').innerHTML=activityPage.items.map(event=>`<tr><td>${esc(event.ip)}</td><td>${esc(event.user_name||'No autenticado')}</td><td title="${esc(event.user_agent)}">${esc(event.user_agent||'No disponible').slice(0,60)}</td><td>${esc(event.method)} ${esc(event.path)}</td><td>${event.status}</td><td>${event.unusual?`<span class="badge pink">${esc(event.reason||'Sí')}</span>`:'No'}</td><td>${esc(event.created_at)}</td><td><button class="btn secondary block-event-ip" data-ip="${esc(event.ip)}">Bloquear</button></td></tr>`).join('')||'<tr><td colspan="8" class="empty">No hay actividad registrada.</td></tr>';
      activityContainer?.insertAdjacentHTML('afterend', paginationMarkup('securityActivity', 'renderSettings', activityPage.totalPages, activityPage.currentPage, activityPage.totalItems, 8));
    }
    bindPaginationControls();
  }catch(error){
    console.warn('No fue posible recargar la seguridad paginada:', error.message);
  }
};
const appRender=render;
render=async function(){
  if(slowLoaderTimer) clearTimeout(slowLoaderTimer);
  slowLoaderTimer=setTimeout(showSlowLoader,10000);
  try{
    if(location.hash.includes('relax'))return await renderRelax();
    return await appRender();
  } finally {
    hideSlowLoader();
  }
};
window.addEventListener('hashchange',render);render();