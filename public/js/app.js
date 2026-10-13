const state = { user: null, plan: null, tasks: [], users: [], files: [], announcements: [], dashboard: null, notifications: { messages: 0, tasks: 0 }, listPages: { files: 1, tasks: 1, members: 1, announcements: 1 }, kanbanTimer: null };
const app = document.querySelector('#app') || document.getElementById('app') || document.body;
const desktopNotificationState = { lastMessages: null, lastTasks: null, permissionRequested: false };
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
function iconAsset(name, alt = '', className = '') { return `<img class="icon-image ${className}" src="/static/img/${name}.png" alt="${esc(alt || name)}">`; }
function brandLogo(className = '') { return `<img class="brand-logo ${className}" src="/static/img/ht.png" alt="Haitani">`; }
const SVG_ICONS = {
  palette: '<path d="M10 2.2C5.7 2.2 2.2 5.8 2.2 10c0 3.4 2.7 6.1 6 6.1h.9c.6 0 1.1-.5 1.1-1.1v-.4c0-.5.4-.9.9-.9h1.4a3.3 3.3 0 0 0 3.3-3.3c0-4.5-3-8.2-5.8-8.2Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="6.1" cy="9" r="1" fill="currentColor"/><circle cx="9.2" cy="5.9" r="1" fill="currentColor"/><circle cx="13" cy="7.4" r="1" fill="currentColor"/>',
  bell: '<path d="M10 3a3.7 3.7 0 0 0-3.7 3.7v2.4c0 .47-.19.93-.52 1.26L4.6 11.5c-.55.55-.16 1.5.62 1.5h9.56c.78 0 1.17-.95.62-1.5l-1.18-1.14a1.78 1.78 0 0 1-.52-1.26V6.7A3.7 3.7 0 0 0 10 3Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M8.3 15.2a1.75 1.75 0 0 0 3.4 0" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  bellOff: '<path d="M10 3a3.7 3.7 0 0 0-3.7 3.7v2.4c0 .47-.19.93-.52 1.26L4.6 11.5c-.55.55-.16 1.5.62 1.5h9.56c.78 0 1.17-.95.62-1.5l-1.18-1.14a1.78 1.78 0 0 1-.52-1.26V6.7A3.7 3.7 0 0 0 10 3Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" opacity=".55"/><path d="M8.3 15.2a1.75 1.75 0 0 0 3.4 0" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity=".55"/><line x1="3.6" y1="3.6" x2="16.4" y2="16.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  block: '<circle cx="10" cy="10" r="6.8" stroke="currentColor" stroke-width="1.3"/><line x1="5.6" y1="5.6" x2="14.4" y2="14.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  close: '<line x1="5.2" y1="5.2" x2="14.8" y2="14.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="14.8" y1="5.2" x2="5.2" y2="14.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  archive: '<rect x="3" y="4" width="14" height="3" rx="1" stroke="currentColor" stroke-width="1.3"/><path d="M4.2 7.6V15a1 1 0 0 0 1 1h9.6a1 1 0 0 0 1-1V7.6" stroke="currentColor" stroke-width="1.3"/><line x1="8.1" y1="10.6" x2="11.9" y2="10.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  clock: '<circle cx="10" cy="10" r="6.8" stroke="currentColor" stroke-width="1.3"/><path d="M10 6.4V10l2.6 1.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
  trash: '<path d="M4 6h12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M8 6V4.6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V6" stroke="currentColor" stroke-width="1.3"/><path d="M5.6 6l.6 8.8a1 1 0 0 0 1 .9h5.6a1 1 0 0 0 1-.9l.6-8.8" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><line x1="8.4" y1="8.6" x2="8.7" y2="13.2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/><line x1="11.6" y1="8.6" x2="11.3" y2="13.2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>',
  check: '<path d="M4.2 10.4l3.8 3.8 7.8-8.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  wallpaper: '<rect x="2.6" y="4" width="14.8" height="11.2" rx="1.4" stroke="currentColor" stroke-width="1.3"/><circle cx="6.9" cy="8" r="1.2" stroke="currentColor" stroke-width="1.1"/><path d="M3.4 13.6l3.6-3.5a1 1 0 0 1 1.4 0l2.1 2.1M9.6 10.4l1.6-1.6a1 1 0 0 1 1.4 0l3.1 3.1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>',
  file: '<path d="M6.2 2.6h5.1L14.8 6v10.5a1 1 0 0 1-1 1H6.2a1 1 0 0 1-1-1V3.6a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M11.3 2.7v3.2a1 1 0 0 0 1 1h3" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
  paperclip: '<path d="M13.2 4.6c1.4 1.4 1.4 3.7 0 5.1L8.4 14.5a3.1 3.1 0 0 1-4.4-4.4l5.6-5.6a1.9 1.9 0 0 1 2.7 2.7l-5.3 5.3a.7.7 0 1 1-1-1l4.9-4.9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
  roller: '<rect x="3" y="3" width="10.4" height="3.4" rx="1.2" stroke="currentColor" stroke-width="1.3"/><line x1="8.2" y1="6.6" x2="8.2" y2="10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><rect x="6.3" y="10" width="3.8" height="5.4" rx="1" stroke="currentColor" stroke-width="1.3"/>',
  arrowUp: '<path d="M10 15V5m0 0L5.5 9.5M10 5l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  menu: '<line x1="3.5" y1="5.5" x2="16.5" y2="5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="3.5" y1="10" x2="16.5" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="3.5" y1="14.5" x2="16.5" y2="14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  dashboard: '<rect x="3" y="3" width="5.5" height="5.5" rx="1.2" stroke="currentColor" stroke-width="1.3"/><rect x="11.5" y="3" width="5.5" height="5.5" rx="1.2" stroke="currentColor" stroke-width="1.3"/><rect x="3" y="11.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" stroke-width="1.3"/><rect x="11.5" y="11.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" stroke-width="1.3"/>',
  announcements: '<path d="M14 5.5l-6 2H4a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h4l6 2V5.5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M16 8a3 3 0 0 1 0 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M6 12.5v3.2a.8.8 0 0 0 .8.8h.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  calendar: '<rect x="3" y="4" width="14" height="13" rx="1.5" stroke="currentColor" stroke-width="1.3"/><line x1="3" y1="8" x2="17" y2="8" stroke="currentColor" stroke-width="1.3"/><line x1="6.8" y1="2.5" x2="6.8" y2="4.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="13.2" y1="2.5" x2="13.2" y2="4.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  sparkles: '<path d="M10 2.8l1.6 4.3 4.4 1.4-4.4 1.4L10 14.2l-1.6-4.3-4.4-1.4 4.4-1.4L10 2.8Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M15.5 13.5l.8 2 2 .7-2 .7-.8 2-.7-2-2-.7 2-.7.7-2Z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>',
  tasks: '<path d="M3.5 5.5h2m-2 4.5h2m-2 4.5h2m3.5-9h7.5m-7.5 4.5h7.5m-7.5 4.5h7.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  kanban: '<rect x="3" y="3.5" width="3.8" height="13" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="8.1" y="3.5" width="3.8" height="8.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="13.2" y="3.5" width="3.8" height="11" rx="1" stroke="currentColor" stroke-width="1.3"/>',
  gantt: '<rect x="3" y="3.5" width="14" height="13" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M6 7.5h4.5M9.5 11h5.5M7 14.5h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  users: '<circle cx="7.5" cy="7" r="2.8" stroke="currentColor" stroke-width="1.3"/><path d="M3.2 15.5a4.3 4.3 0 0 1 8.6 0" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M12.5 4.8a2.5 2.5 0 0 1 0 4.8M14.5 14.5a3.8 3.8 0 0 0-2.8-3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  folder: '<path d="M3 5.5a1.5 1.5 0 0 1 1.5-1.5h3.2a1.5 1.5 0 0 1 1.1.5l1.1 1.2a1.5 1.5 0 0 0 1.1.5H15.5A1.5 1.5 0 0 1 17 7.7v7.8a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 15.5V5.5Z" stroke="currentColor" stroke-width="1.3"/>',
  messages: '<path d="M4 4.5h12a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H7.5l-3.8 2.8a.5.5 0 0 1-.7-.4V6A1.5 1.5 0 0 1 4 4.5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
  music: '<circle cx="6" cy="14" r="2.5" stroke="currentColor" stroke-width="1.3"/><circle cx="14" cy="12" r="2.5" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 14V5.5l8-2V12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><line x1="8.5" y1="8" x2="16.5" y2="6" stroke="currentColor" stroke-width="1.2"/>',
  github: '<path d="M10 2.2C5.7 2.2 2.2 5.7 2.2 10c0 3.4 2.2 6.3 5.3 7.3.4.1.5-.2.5-.4v-1.4c-2.2.5-2.6-.9-2.6-.9-.3-.9-.9-1.1-.9-1.1-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.2 1.8.8 2.3.6.1-.5.3-.8.5-1-1.7-.2-3.6-.9-3.6-3.8 0-.8.3-1.5.8-2-.1-.2-.4-1 .1-2 0 0 .6-.2 2.1.8.6-.2 1.3-.3 1.9-.3.6 0 1.3.1 1.9.3 1.5-1 2.1-.8 2.1-.8.5 1 .2 1.8.1 2 .5.5.8 1.2.8 2 0 3-1.9 3.6-3.6 3.8.3.3.6.8.6 1.6v2.4c0 .2.2.5.6.4 3.1-1 5.3-3.9 5.3-7.3 0-4.3-3.5-7.8-7.8-7.8Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>',
  gitCommit: '<circle cx="10" cy="10" r="3.2" stroke="currentColor" stroke-width="1.3"/><line x1="2.5" y1="10" x2="6.8" y2="10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="13.2" y1="10" x2="17.5" y2="10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  activity: '<path d="M2.5 10.5h3.3l2.2-6.5 3.8 12 2.4-5.5h3.3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
  creditCard: '<rect x="2.8" y="4.5" width="14.4" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/><line x1="2.8" y1="8.5" x2="17.2" y2="8.5" stroke="currentColor" stroke-width="1.3"/><line x1="5.5" y1="12.5" x2="8.5" y2="12.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  settings: '<circle cx="10" cy="10" r="2.7" stroke="currentColor" stroke-width="1.3"/><path d="M10 2.8v1.6m0 11.2v1.6m7.2-7.2h-1.6M4.4 10H2.8m11.6-4.5l-1.1 1.1M6.7 13.3l-1.1 1.1m9.6 0l-1.1-1.1M6.7 6.7L5.6 5.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  shield: '<path d="M10 3.2s4.8 1.4 6 2.3c0 4.5-2.2 8.5-6 11.3-3.8-2.8-6-6.8-6-11.3 1.2-.9 6-2.3 6-2.3Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
  user: '<circle cx="10" cy="7" r="3.3" stroke="currentColor" stroke-width="1.3"/><path d="M4.5 16.5a5.5 5.5 0 0 1 11 0" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  logout: '<path d="M7.5 4.5H4.8A1.3 1.3 0 0 0 3.5 5.8v8.4a1.3 1.3 0 0 0 1.3 1.3h2.7m4.5-8L15.5 10l-3.5 2.5M7 10h8.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
  plus: '<line x1="10" y1="4.5" x2="10" y2="15.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="4.5" y1="10" x2="15.5" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  edit: '<path d="M12.8 4.2l3 3L6.5 16.5H3.5v-3L12.8 4.2Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><line x1="11.2" y1="5.8" x2="14.2" y2="8.8" stroke="currentColor" stroke-width="1.3"/>',
  eye: '<path d="M2.5 10s3-5.5 7.5-5.5 7.5 5.5 7.5 5.5-3 5.5-7.5 5.5S2.5 10 2.5 10Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="10" cy="10" r="2.2" stroke="currentColor" stroke-width="1.3"/>',
  download: '<path d="M10 3.5v9m0 0l-3-3m3 3l3-3M4 16.5h12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
  upload: '<path d="M10 13.5v-9m0 0l-3 3m3-3l3 3M4 16.5h12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
  search: '<circle cx="8.8" cy="8.8" r="5" stroke="currentColor" stroke-width="1.3"/><line x1="12.5" y1="12.5" x2="16.5" y2="16.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  play: '<polygon points="7,5 15,10 7,15" fill="currentColor"/>',
  mic: '<rect x="7" y="3.5" width="6" height="8" rx="3" stroke="currentColor" stroke-width="1.3"/><path d="M4.5 9a5.5 5.5 0 0 0 11 0m-5.5 5.5v2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  micOff: '<rect x="7" y="3.5" width="6" height="8" rx="3" stroke="currentColor" stroke-width="1.3" opacity=".5"/><path d="M4.5 9a5.5 5.5 0 0 0 11 0m-5.5 5.5v2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity=".5"/><line x1="3.5" y1="3.5" x2="16.5" y2="16.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  send: '<path d="M16.5 3.5L3.5 9l5.5 2 2 5.5 5.5-13Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><line x1="9" y1="11" x2="16.5" y2="3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  external: '<path d="M10.5 4.5h5v5m0-5l-7 7M14 11.5v4H4.5v-9.5H9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
  progress: '<circle cx="10" cy="10" r="6.8" stroke="currentColor" stroke-width="1.3" stroke-dasharray="32 12"/><polyline points="10,6.5 10,10 12.5,12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  sun: '<circle cx="10" cy="10" r="3.7" stroke="currentColor" stroke-width="1.3"/><line x1="10" y1="2" x2="10" y2="4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="10" y1="16" x2="10" y2="18" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="2" y1="10" x2="4" y2="10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="16" y1="10" x2="18" y2="10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="4.34" y1="4.34" x2="5.76" y2="5.76" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="14.24" y1="14.24" x2="15.66" y2="15.66" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="4.34" y1="15.66" x2="5.76" y2="14.24" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="14.24" y1="5.76" x2="15.66" y2="4.34" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  moon: '<path d="M15.4 11.2A6.5 6.5 0 0 1 8.8 4.6a6.6 6.6 0 1 0 7.7 7.7c-.3-.4-.7-.8-1.1-1.1Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
  bookOpen: '<path d="M2.5 4.5A2.5 2.5 0 0 1 5 2h4.5v15H5a2.5 2.5 0 0 0-2.5 2.5V4.5Zm15 0A2.5 2.5 0 0 0 15 2h-4.5v15H15a2.5 2.5 0 0 1 2.5 2.5V4.5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
  alertTriangle: '<path d="M10 3.2 2.8 15.8a1.2 1.2 0 0 0 1 1.8h12.4a1.2 1.2 0 0 0 1-1.8L10 3.2Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><line x1="10" y1="8" x2="10" y2="11.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="10" cy="14.2" r="0.9" fill="currentColor"/>',
  pieChart: '<circle cx="10" cy="10" r="7.5" stroke="currentColor" stroke-width="1.3"/><path d="M10 2.5V10l5.3 5.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
};
function icon(name, className = '') { return `<span class="icon-svg ${className}" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">${SVG_ICONS[name] || ''}</svg></span>`; }
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

  const prevPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);
  const prevIcon = '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M12 4.5 6.5 10l5.5 5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const nextIcon = '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M8 4.5 13.5 10 8 15.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ellipsisIcon = '<svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><circle cx="4" cy="10" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="16" cy="10" r="1.5"/></svg>';

  const pages = [];
  if (totalPages <= 5) {
    for (let page = 1; page <= totalPages; page += 1) pages.push(page);
  } else if (currentPage <= 3) {
    pages.push(1, 2, 3, 'ellipsis', totalPages);
  } else if (currentPage >= totalPages - 2) {
    pages.push(1, 'ellipsis', totalPages - 2, totalPages - 1, totalPages);
  } else {
    pages.push(1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages);
  }

  const controls = pages.map(item => {
    if (item === 'ellipsis') {
      return `<li class="pagination-item"><span class="pagination-ellipsis page-btn ellipsis" aria-hidden="true">${ellipsisIcon}</span></li>`;
    }

    const page = Number(item);
    const isActive = page === currentPage;
    return `<li class="pagination-item"><button type="button" class="pagination-link page-btn ${isActive ? 'active is-active' : ''}" data-page-key="${pageKey}" data-page="${page}" data-render="${renderName}" aria-label="Ir a la página ${page}" ${isActive ? 'aria-current="page"' : ''}>${page}</button></li>`;
  }).join('');

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  return `
    <nav class="pagination list-pagination" role="navigation" aria-label="Paginación">
      <div class="pagination-meta list-pagination-meta">
        <span>Mostrando <strong>${startItem}–${endItem}</strong> de <strong>${totalItems}</strong></span>
      </div>
      <ul class="pagination-content page-controls">
        <li class="pagination-item">
          <button type="button" class="pagination-link pagination-prev page-btn nav text" data-page-key="${pageKey}" data-page="${prevPage}" data-render="${renderName}" aria-label="Página anterior" title="Página anterior" ${currentPage === 1 ? 'disabled' : ''}>
            ${prevIcon}
            <span>Anterior</span>
          </button>
        </li>
        ${controls}
        <li class="pagination-item">
          <button type="button" class="pagination-link pagination-next page-btn nav text" data-page-key="${pageKey}" data-page="${nextPage}" data-render="${renderName}" aria-label="Página siguiente" title="Página siguiente" ${currentPage === totalPages ? 'disabled' : ''}>
            <span>Siguiente</span>
            ${nextIcon}
          </button>
        </li>
      </ul>
    </nav>
  `;
}
function bindPaginationControls() {
  document.querySelectorAll('.page-btn[data-page], .pagination-link[data-page]').forEach(button => {
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
let taskSearch = '';
let taskStatusFilter = '';
let taskAssigneeFilter = '';
let fileSearch = '';
let fileTypeFilter = '';
let fileUploaderFilter = '';
let ganttStatusFilter = '';
let ganttAssigneeFilter = '';
let ganttCalendarMonth = (() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d })();
let ganttChartZoom = 32;
let ganttChartMinDate = null;
const GANTT_WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
function startOfWeekMonday(date) { const d = new Date(date); const offset = (d.getDay() + 6) % 7; d.setDate(d.getDate() - offset); d.setHours(0, 0, 0, 0); return d }
function toISODate(date) { return date.toISOString().slice(0, 10) }
function addDays(dateStr, delta) { const base = dateStr || new Date().toISOString().slice(0, 10); const date = new Date(`${base}T00:00:00`); date.setDate(date.getDate() + delta); return date.toISOString().slice(0, 10) }
function themeToggle(){return `<div class="theme-switch" role="group" aria-label="Tema visual"><button class="theme-option ${currentTheme==='steep'?'active':''}" data-theme="steep" type="button" title="Modo claro" aria-label="Modo claro">${icon('sun')}</button><button class="theme-option ${currentTheme==='ran'?'active':''}" data-theme="ran" type="button" title="Modo oscuro" aria-label="Modo oscuro">${icon('moon')}</button></div>`}
function bindTheme(){document.querySelectorAll('[data-theme]').forEach(button=>button.onclick=()=>{currentTheme=button.dataset.theme;localStorage.setItem('haitani-theme',currentTheme);document.documentElement.dataset.theme=currentTheme;document.querySelectorAll('.theme-option').forEach(option=>option.classList.toggle('active',option.dataset.theme===currentTheme))})}
async function api(url, options = {}) { const projectId = localStorage.getItem('haitani-github-project'); const githubUrl = url.startsWith('/github/') && projectId && !url.includes('?') ? `${url}?project_id=${encodeURIComponent(projectId)}` : url; const response = await fetch(`/api${githubUrl}`, { ...options, credentials:'include' }); const data = await response.json().catch(() => ({})); if (response.status === 403 && data.blocked) { blockedView(data.reason || 'Tu dirección IP no puede acceder a esta aplicación.'); throw new Error(data.error); } if (response.status === 401) { state.user = null; clearInterval(notificationTimer); } if (!response.ok) throw new Error(data.error || 'No fue posible completar la operación.'); return data; }
function notificationDot(type){return `<i class="notification-dot" data-type="${type}" ${state.notifications[type]?'':'hidden'} title="${state.notifications[type]||0} notificaciones nuevas"></i>`}
function requestDesktopNotifications(){
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'default' && !desktopNotificationState.permissionRequested) {
    desktopNotificationState.permissionRequested = true;
    Notification.requestPermission().catch(() => {});
  }
  return false;
}
function showDesktopNotification(title, body){
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const notification = new Notification(title, {
    body,
    tag: 'haitani-system',
    icon: '/static/img/favicon.png'
  });
  setTimeout(() => notification.close(), 5000);
}
let isRefreshingNotifications = false;
async function refreshNotifications(){
  if(!state.user || isRefreshingNotifications) return;
  isRefreshingNotifications = true;
  try{
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      state.notifications = await api('/notifications', { signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
    if (desktopNotificationState.lastMessages === null) desktopNotificationState.lastMessages = state.notifications.messages;
    if (desktopNotificationState.lastTasks === null) desktopNotificationState.lastTasks = state.notifications.tasks;
    if (state.notifications.messages > desktopNotificationState.lastMessages) {
      showDesktopNotification('Nuevo mensaje', `Tienes ${state.notifications.messages} mensaje(s) sin leer.`);
    }
    if (state.notifications.tasks > desktopNotificationState.lastTasks) {
      showDesktopNotification('Nueva tarea asignada', `Hay ${state.notifications.tasks} tarea(s) pendientes asignadas a ti.`);
    }
    desktopNotificationState.lastMessages = state.notifications.messages;
    desktopNotificationState.lastTasks = state.notifications.tasks;
    requestDesktopNotifications();
    document.querySelectorAll('.notification-dot').forEach(dot=>{
      const count=state.notifications[dot.dataset.type]||0;
      dot.hidden=!count;
      dot.title=`${count} notificaciones`;
    });
  }catch{}
  finally {
    isRefreshingNotifications = false;
  }
}
function startNotificationPolling(){
  clearInterval(notificationTimer);
  notificationTimer=setInterval(()=>{
    if(document.visibilityState==='visible'){
      refreshNotifications();
    }
  },30000);
}
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&state.user){
    refreshNotifications();
  }
});
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
function loginView(error='') {
  app.innerHTML = `
    <main class="login">
      <div class="auth-theme-bar">
        ${themeToggle()}
      </div>
      <div class="auth-stage">
        <section class="auth-story">
          <div class="brand">${brandLogo()}</div>
          <h2 class="auth-story-headline">
            Control integral para <em>organizaciones de alto nivel</em>
          </h2>
          <p class="auth-story-subhead">
            Planificación ágil de proyectos, analíticas en tiempo real y colaboración técnica unificada en un solo lugar.
          </p>
        </section>

        <form class="login-box" id="login-form">
          <div class="login-box-header">
            <div class="brand auth-box-brand">${brandLogo()}</div>
            <div class="eyebrow">Acceso seguro</div>
            <h1>Iniciar sesión</h1>
            <p class="muted">Ingresa tus credenciales para acceder al espacio de trabajo.</p>
          </div>
          ${error ? `<div class="alert">${esc(error)}</div>` : ''}
          <label>Usuario o correo
            <input class="input" name="username" placeholder="tu.usuario o correo@empresa.com" required autofocus>
          </label>
          <label>Contraseña
            <input class="input" name="password" type="password" placeholder="Tu contraseña" required>
          </label>
          <div class="auth-actions">
            <button class="btn btn-block" type="submit">Entrar al workspace →</button>
            <button type="button" class="btn secondary btn-block" id="show-register">Crear organización</button>
          </div>
          <div class="auth-footer-links">
            <a href="#/" class="auth-link">← Volver al inicio</a>
            <span class="muted">Suscripción gestionada</span>
          </div>
        </form>
      </div>
      ${localStorage.getItem(PRIVACY_NOTICE_KEY) ? '' : privacyNotice()}
    </main>
  `;

  bindTheme();
  document.querySelector('#show-register')?.addEventListener('click', () => registerView());
  document.querySelector('#accept-privacy')?.addEventListener('click', () => {
    localStorage.setItem(PRIVACY_NOTICE_KEY, '1');
    document.querySelector('#privacy-notice')?.remove();
    document.querySelector('#login-form input')?.focus();
  });
  document.querySelector('#login-form').onsubmit = async event => {
    event.preventDefault();
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(event.target)))
      });
      state.user = data.user;
      state.plan = data.plan;
      location.hash = data.redirect;
      render();
    } catch (err) {
      loginView(err.message);
    }
  };
}
function sidebar(){
  const admin=state.user.role==='admin';
  const isNavActive=href=>{
    const h=location.hash||'';
    return h===href || (href!=='/' && (h.startsWith(href+'/') || h.startsWith(href+'?')));
  };
  const sections=admin?[
    {
      title: 'Workspace',
      links: [
        ['/admin/dashboard','Dashboard','dashboard'],
        ['/admin/overview','Project Overview','pieChart'],
        ['/admin/tasks','Tareas','tasks','tasks'],
        ['/admin/sprints','Sprints','progress'],
        ['/admin/backlog','Backlog','archive'],
        ['/admin/kanban','Kanban','kanban'],
        ['/admin/gantt','Gantt','gantt'],
      ]
    },
    {
      title: 'Equipo & Comunicación',
      links: [
        ['/admin/messages','Mensajes','messages','messages'],
        ['/admin/announcements','Anuncios','announcements'],
        ['/admin/absences','Inasistencias','calendar'],
        ['/admin/members','Integrantes','users'],
        ['/admin/files','Archivos','folder'],
      ]
    },
    {
      title: 'Operaciones',
      links: [
        ['/admin/knowledge','Knowledge Center','bookOpen'],
        ['/admin/risks','Risk Center','alertTriangle'],
        ['/admin/assistant','Asistente IA','sparkles'],
        ['/admin/github','GitHub','github'],
        ['/admin/github/commits','Commits','gitCommit'],
        ['/admin/team-activity','Actividad del equipo','activity'],
        ['/admin/relax','Relax 梵天','music'],
      ]
    },
    {
      title: 'Cuenta & Ajustes',
      links: [
        ['/admin/billing','Facturación','creditCard'],
        ['/admin/settings/github','Configuración','settings'],
        ['/admin/settings/sanzu','Sanzu IA (API Key)','sparkles'],
        ['/admin/settings/security','Seguridad','shield'],
        ['/admin/profile','Perfil','user'],
      ]
    }
  ]:[
    {
      title: 'Workspace',
      links: [
        ['/member/dashboard','Dashboard','dashboard'],
        ['/member/overview','Project Overview','pieChart'],
        ['/member/tasks','Mis tareas','tasks','tasks'],
        ['/member/sprints','Sprints','progress'],
        ['/member/backlog','Backlog','archive'],
        ['/member/kanban','Kanban','kanban'],
        ['/member/gantt','Gantt','gantt'],
      ]
    },
    {
      title: 'Equipo & Comunicación',
      links: [
        ['/member/messages','Mensajes','messages','messages'],
        ['/member/announcements','Anuncios','announcements'],
        ['/member/absences','Inasistencias','calendar'],
        ['/member/members','Equipo','users'],
        ['/member/files','Archivos','folder'],
        ['/member/knowledge','Knowledge Center','bookOpen'],
        ['/member/risks','Risk Center','alertTriangle'],
      ]
    },
    {
      title: 'Herramientas & Cuenta',
      links: [
        ['/member/relax','Relax 梵天','music'],
        ['/member/github','GitHub','github'],
        ['/member/profile','Perfil','user'],
      ]
    }
  ];

  const markup = sections.map(sec => `
    <div class="nav-title">${sec.title}</div>
    ${sec.links.map(([href,label,iconName,type])=>`<button class="nav ${isNavActive(href)?'active':''}" data-route="${href}">${icon(iconName)}<span class="nav-label">${label}</span>${type?notificationDot(type):''}</button>`).join('')}
  `).join('');

  return `<aside class="side" id="side"><div class="brand">${brandLogo()}</div><div class="project">${esc(state.user.organization_name||'Organización')}</div>${markup}<div class="nav-title">Sesión</div><button class="nav" id="logout">${icon('logout')}<span class="nav-label">Cerrar sesión</span></button></aside>`;
}
function avatarMarkup(user,size='avatar'){return user.profile_photo?`<img class="${size}" src="${esc(user.profile_photo)}" alt="Foto de ${esc(user.name)}">`:`<span class="${size}">${esc(user.name?.[0]||'?')}</span>`}
function layout(content){
  app.innerHTML=`<div class="shell"><div class="sidebar-backdrop" id="side-backdrop"></div>${sidebar()}<section class="main"><header class="topbar"><button class="mobile-toggle" id="menu" aria-label="Abrir menú de navegación">${icon('menu')}</button><div class="topbar-role-badge"><span class="topbar-role-indicator"></span><span class="topbar-role-text">${state.user.role==='admin'?'Panel administrativo':'Espacio personal'}</span></div><div class="topbar-actions">${themeToggle()}<a class="user-chip" href="#/${state.user.role}/profile" data-route="/${state.user.role}/profile" title="Ver mi perfil" aria-label="Ver perfil de ${esc(state.user.name)}"><span>${esc(state.user.name)}</span>${avatarMarkup(state.user)}</a></div></header><main class="content">${content}</main></section></div>`;
  const side = document.querySelector('#side');
  const backdrop = document.querySelector('#side-backdrop');
  const closeSide = () => { side?.classList.remove('open'); backdrop?.classList.remove('active'); };
  document.querySelectorAll('[data-route]').forEach(node=>node.onclick=()=>{ location.hash=node.dataset.route; closeSide(); });
  document.querySelector('#logout').onclick=async()=>{ closeSide(); await api('/auth/logout',{method:'POST'}); state.user=null; location.hash=''; loginView(); };
  document.querySelector('#menu').onclick=()=>{ side?.classList.toggle('open'); backdrop?.classList.toggle('active'); };
  backdrop.onclick=closeSide;
  bindTheme();
  bindPaginationControls();
}
function heading(title, subtitle, action=''){return `<div class="heading"><div><div class="eyebrow"><img class="brand-logo-inline" src="/static/img/ht.png" alt="Haitani"> / ${esc(state.user.organization_name||'Organización')}</div><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`}
function projectEditor(project){
  if(state.user.role!=='admin')return '';
  const methods=[['AGILE','Agile'],['SCRUM','Scrum'],['KANBAN','Kanban'],['XP','XP'],['LEAN','Lean'],['WATERFALL','Waterfall'],['HYBRID','Híbrida']];
  const statuses=[['planificado','Planificado'],['en_progreso','En progreso'],['completado','Completado'],['pausado','Pausado']];
  const priorities=[['baja','Baja'],['media','Media'],['alta','Alta'],['critica','Crítica']];
  const syncStatus = project?.sanzu_sync_status || 'pending';
  const syncClass = syncStatus === 'synced' ? 'green' : syncStatus === 'error' ? 'pink' : 'yellow';
  const syncLabel = syncStatus === 'synced' ? 'Sincronizado' : syncStatus === 'error' ? 'Error al sincronizar' : 'Pendiente';
  const syncTime = project?.sanzu_synced_at ? new Date(project.sanzu_synced_at).toLocaleString() : 'Nunca';

  return `
    <form id="project-form" class="form-grid mt-4">
      <input type="hidden" name="id" value="${project?.id||''}">
      <label>Nombre del Proyecto<input class="input" name="name" value="${esc(project?.name||'')}" required></label>
      <label>Cliente / Sponsor<input class="input" name="client" value="${esc(project?.client||'')}" placeholder="Empresa o cliente"></label>
      <label>Metodología<select class="select" name="methodology_id" required>${methods.map(([value,label])=>`<option value="${value}" ${project?.methodology_id===value||(!project&&value==='AGILE')?'selected':''}>${label}</option>`).join('')}</select></label>
      <label>Estado<select class="select" name="status">${statuses.map(([v,l])=>`<option value="${v}" ${project?.status===v?'selected':''}>${l}</option>`).join('')}</select></label>
      <label>Prioridad<select class="select" name="priority">${priorities.map(([v,l])=>`<option value="${v}" ${project?.priority===v?'selected':''}>${l}</option>`).join('')}</select></label>
      <label>Presupuesto ($)<input class="input" type="number" step="0.01" name="budget" value="${esc(project?.budget||'0')}" placeholder="0.00"></label>
      <label>Fecha de Inicio<input class="input" type="date" name="start_date" value="${esc((project?.start_date||'').slice(0,10))}"></label>
      <label>Fecha de Finalización<input class="input" type="date" name="end_date" value="${esc((project?.end_date||'').slice(0,10))}"></label>
      <label class="full">Objetivo Estratégico<input class="input" name="objective" value="${esc(project?.objective||'')}" placeholder="Objetivo principal del proyecto"></label>
      <label class="full">Alcance (Scope)<textarea class="textarea" name="scope" rows="2" placeholder="Límites del proyecto, entregables clave y alcance">${esc(project?.scope||'')}</textarea></label>
      <label class="full">Descripción<input class="input" name="description" value="${esc(project?.description||'')}" placeholder="Descripción general"></label>
      <label class="full">Stack y Tecnologías<input class="input" name="technologies" value="${esc(project?.technologies||'')}" placeholder="e.g. Node.js, Express, PostgreSQL, Sanzu AI"></label>
      <label class="full">Riesgos Identificados<textarea class="textarea" name="risks" rows="2" placeholder="Factores de riesgo o restricciones críticas">${esc(project?.risks||'')}</textarea></label>
      <label class="full">Requerimientos<textarea class="textarea" name="requirements" rows="3" placeholder="Alcance detallado, restricciones y criterios de aceptación">${esc(project?.requirements||'')}</textarea></label>
      
      ${project?.id ? `
        <div class="full card p-3" style="background:var(--bg-glass, rgba(255,255,255,0.03));border:1px solid var(--line);border-radius:var(--r-md);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--sp-2)">
          <div>
            <div style="font-weight:600;font-size:0.9rem">Sincronización Haitani ↔ Sanzu</div>
            <div class="muted sub">Estado: <span class="badge ${syncClass}">${syncLabel}</span> · Última: ${syncTime}</div>
            ${project?.sanzu_sync_error ? `<div class="sub" style="color:var(--pink);margin-top:2px">${esc(project.sanzu_sync_error)}</div>` : ''}
          </div>
          <div style="display:flex;gap:var(--sp-2);align-items:center">
            <a class="btn secondary mini" href="#/admin/settings/sanzu" title="Añadir o cambiar API Key">${icon('settings')} Configurar API Key</a>
            <button type="button" class="btn secondary" id="dash-sync-sanzu-btn" data-project-id="${project.id}">
              ${icon('external')} Sincronizar con Sanzu
            </button>
          </div>
        </div>
      ` : ''}

      <div class="actions full">
        <button class="btn" type="submit">${icon('check')}${project?'Guardar proyecto':'Crear proyecto'}</button>
      </div>
    </form>
  `;
}
function methodologyWidgets(project){const method=project?.methodology_id;const links=[];links.push(`<a class="btn secondary" href="#/${state.user.role}/sprints">${icon('gantt')}Ver Sprints</a>`);if(['SCRUM','KANBAN','XP','AGILE'].includes(method))links.push(`<a class="btn secondary" href="#/${state.user.role}/kanban">${icon('kanban')}Abrir tablero</a>`);if(method==='WATERFALL'||method==='LEAN'||method==='HYBRID')links.push(`<a class="btn secondary" href="#/${state.user.role}/gantt">${icon('gantt')}Abrir hitos y Gantt</a>`);if(project?.id)links.push(`<button type="button" class="btn secondary" id="dash-new-project-task" data-project-id="${project.id}">${icon('plus')}Nueva tarea</button>`);return `<div class="actions mt-3"><span class="muted">${method?`Flujo recomendado: ${esc(method)}`:'Define una metodología'}</span>${links.join('')}</div>`}
function projectHealth(health){if(!health)return '';const statusLabel={saludable:'Saludable',atencion:'Requiere atención',riesgo:'En riesgo'}[health.status]||'Sin datos';const workload=health.workload||[];const activity=health.recentActivity||[];return `<section class="card project-health mt-4"><div class="project-health-head"><div><div class="eyebrow">Control operativo</div><h2>Salud del proyecto</h2><p class="muted">Lectura combinada de avance, planificación, riesgos y capacidad del equipo.</p></div><div class="health-score health-${esc(health.status)}"><strong>${health.score}</strong><span>/ 100</span><small>${statusLabel}</small></div></div><div class="health-overview"><div class="health-meter"><div class="health-meter-track"><i style="width:${health.score}%"></i></div><div class="health-meter-labels"><span>Riesgo</span><span>Atención</span><span>Saludable</span></div></div><div class="health-metrics"><div><strong>${health.overdue}</strong><span>Vencidas</span></div><div><strong>${health.dueSoon}</strong><span>Próximas 7 días</span></div><div><strong>${health.critical}</strong><span>Alta prioridad</span></div><div><strong>${health.unassigned}</strong><span>Sin responsable</span></div></div></div><div class="health-detail-grid"><div><h3>Calidad de planificación</h3><div class="health-progress-row"><span>Fechas definidas</span><strong>${health.dateCoverage}%</strong><i><b style="width:${health.dateCoverage}%"></b></i></div><div class="health-progress-row"><span>Responsables asignados</span><strong>${health.assignmentCoverage}%</strong><i><b style="width:${health.assignmentCoverage}%"></b></i></div><h3 class="health-subtitle">Recomendaciones</h3><ul class="health-list">${health.recommendations.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></div><div><h3>Carga del equipo</h3>${workload.length?`<div class="health-workload">${workload.map(item=>{const percentage=item.total?Math.round(item.completed/item.total*100):0;return `<div class="health-workload-row"><span>${esc(item.name)}</span><strong>${item.total} <small>${percentage}% completado</small></strong><i><b style="width:${percentage}%"></b></i></div>`}).join('')}</div>`:'<div class="empty">No hay integrantes activos.</div>'}<h3 class="health-subtitle">Actividad reciente</h3>${activity.length?`<div class="health-activity">${activity.map(item=>`<div><strong>${esc(item.action)}</strong><small>${esc(item.description||'Actualización registrada')}</small></div>`).join('')}</div>`:'<div class="empty">No hay actividad reciente.</div>'}</div></div></section>`}
async function dashboard(){
  state.dashboard=await api('/dashboard');
  const s=state.dashboard.stats;
  const project=state.dashboard.project;
  const isAdmin=state.user.role==='admin';

  let githubStatus='<div class="dash-gh-pill disconnected"><span>No conectado</span> · <a href="#/admin/settings/github">Configurar</a></div>';
  try {
    const github=await api('/github/repository');
    if(github.configured && !github.error && github.data){
      githubStatus=`<div class="dash-gh-pill connected">${icon('github')}<span>${esc(github.data.full_name||'Repositorio')}</span> · Rama: <code>${esc(github.data.default_branch||'main')}</code></div>`;
    } else if(github.error){
      githubStatus=`<div class="dash-gh-pill error">${icon('github')}<span>${esc(github.error)}</span></div>`;
    }
  }catch(e){
    githubStatus='<div class="dash-gh-pill error">GitHub no disponible</div>';
  }

  const pendingCount=s.byStatus?.find(x=>x.status==='pendiente')?.count||0;
  const inProgressCount=s.byStatus?.find(x=>x.status==='en_proceso')?.count||0;
  const completedCount=s.completed||0;
  const totalCount=isAdmin ? (s.totalTasks || (pendingCount+inProgressCount+completedCount)) : s.totalTasks;

  return `
    <div class="dashboard-hero">
      <div class="dash-hero-content">
        <div class="dash-hero-eyebrow">
          <span>${esc(state.user.organization_name||'Organización')}</span>
          <span class="dash-hero-sep">/</span>
          <span>${isAdmin?'Consola Operativa':'Mi Espacio de Trabajo'}</span>
        </div>
        <h1 class="dash-hero-title">Hola, ${esc(state.user.name)}</h1>
        <p class="dash-hero-sub">Control en tiempo real del progreso, tareas activas y estado general del proyecto.</p>
        <div class="dash-hero-meta">
          ${githubStatus}
          <div class="dash-hero-badge">${icon('activity')} ${s.progress}% avance global</div>
        </div>
      </div>
      <div class="dash-quick-actions">
        <a class="btn" href="${isAdmin?'#/admin/tasks':'#/member/tasks'}">${icon('plus')}Nueva tarea</a>
        <a class="btn secondary" href="${isAdmin?'#/admin/kanban':'#/member/kanban'}">${icon('kanban')}Tablero</a>
        ${isAdmin ? `<a class="btn secondary" href="#/admin/announcements">${icon('announcements')}Anuncios</a>` : `<a class="btn secondary" href="#/member/messages">${icon('messages')}Chat</a>`}
      </div>
    </div>

    <div class="grid stats dashboard-stats">
      <div class="card stat stat-primary">
        <div class="stat-header">
          <div class="label">${isAdmin?'Integrantes':'Tareas Asignadas'}</div>
          ${icon(isAdmin?'users':'tasks')}
        </div>
        <div class="num">${isAdmin?s.members:s.totalTasks}</div>
        <div class="stat-footer-sub">${isAdmin?'Equipo colaborando':'Bajo tu responsabilidad'}</div>
      </div>
      <div class="card stat">
        <div class="stat-header">
          <div class="label">Pendientes</div>
          ${icon('clock')}
        </div>
        <div class="num yellow">${pendingCount}</div>
        <div class="stat-footer-sub">Por iniciar</div>
      </div>
      <div class="card stat">
        <div class="stat-header">
          <div class="label">En Proceso</div>
          ${icon('progress')}
        </div>
        <div class="num lilac">${inProgressCount}</div>
        <div class="stat-footer-sub">En desarrollo activo</div>
      </div>
      <div class="card stat">
        <div class="stat-header">
          <div class="label">Completadas</div>
          ${icon('check')}
        </div>
        <div class="num green">${completedCount}</div>
        <div class="stat-footer-sub">Objetivos logrados</div>
      </div>
      <div class="card stat stat-progress">
        <div class="stat-header">
          <div class="label">Eficiencia y Avance</div>
          ${icon('activity')}
        </div>
        <div class="num">${s.progress}%</div>
        <div class="bar"><i style="width:${s.progress}%"></i></div>
        <div class="stat-footer-sub">${completedCount} de ${totalCount} tareas finalizadas</div>
      </div>
    </div>

    <div class="dashboard-main-grid mt-4">
      <section class="card dash-card dash-tasks-card">
        <div class="dash-card-header">
          <div>
            <div class="eyebrow">Flujo Inmediato</div>
            <h2>Próximas Tareas</h2>
          </div>
          <a class="dash-view-all" href="${isAdmin?'#/admin/tasks':'#/member/tasks'}">Ver todas ${icon('external')}</a>
        </div>
        <div id="dashboard-tasks" class="dash-task-list">
          <div class="empty">Cargando tareas prioritarias...</div>
        </div>
      </section>

      <section class="card dash-card dash-project-card">
        <div class="dash-card-header">
          <div>
            <div class="eyebrow">Marco de Trabajo</div>
            <h2>Proyecto Actual</h2>
          </div>
          ${project?`<span class="badge ${project.methodology_id==='AGILE'||project.methodology_id==='SCRUM'?'green':'pink'}">${esc(project.methodology_id||'Ágil')}</span>`:''}
        </div>
        <div class="dash-project-body">
          ${project ? `
            <div class="dash-project-info">
              <strong class="dash-project-name">${esc(project.name)}</strong>
              <p class="dash-project-desc">${esc(project.description||'Sin descripción definida aún.')}</p>
            </div>
            ${methodologyWidgets(project)}
            ${projectEditor(project)}
          ` : `
            <div class="dash-empty-project">
              <p class="muted">No se ha establecido un proyecto principal para esta organización.</p>
              ${projectEditor(null)}
            </div>
          `}
        </div>
      </section>
    </div>
  `;
}
async function renderDashboard(){
  const content=await dashboard();
  layout(content);
  if(state.user.role==='admin'&&state.dashboard?.health){
    document.querySelector('.content')?.insertAdjacentHTML('beforeend',projectHealth(state.dashboard.health));
  }
  const tasks=await api('/tasks');
  const taskContainer=document.querySelector('#dashboard-tasks');
  if(taskContainer){
    taskContainer.innerHTML=tasks.length ? tasks.slice(0,5).map(taskRow).join('') : '<div class="empty">No tienes tareas pendientes por ahora. Buen trabajo.</div>';
  }
  document.querySelector('#project-form')?.addEventListener('submit',async event=>{
    event.preventDefault();
    const values=Object.fromEntries(new FormData(event.target));
    const id=values.id;
    delete values.id;
    try{
      await api(id?`/projects/${id}`:'/projects',{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)});
      notify(id?'Proyecto actualizado correctamente':'Proyecto creado con éxito');
      renderDashboard();
    }catch(error){
      notify(error.message);
    }
  });
  const syncBtn = document.querySelector('#dash-sync-sanzu-btn');
  if(syncBtn){
    syncBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const pId = syncBtn.dataset.projectId;
      syncBtn.disabled = true;
      syncBtn.innerHTML = `${icon('progress')} Sincronizando...`;
      try {
        await api(`/projects/${pId}/sync`, { method: 'POST' });
        notify('Proyecto sincronizado con Sanzu exitosamente');
        renderDashboard();
      } catch(err) {
        notify('Error en sincronización Sanzu: ' + err.message);
        syncBtn.disabled = false;
        syncBtn.innerHTML = `${icon('external')} Reintentar sincronización`;
      }
    });
  }
}
function taskRow(task){
  const statusColor=task.status==='completada'?'green':task.status==='en_proceso'?'pink':'yellow';
  const statusText=task.status==='en_proceso'?'En proceso':task.status==='completada'?'Completada':'Pendiente';
  return `
    <div class="task-list-row">
      <div class="task-list-meta">
        ${task.image_asset_id?`<img class="task-thumb" src="/api/tasks/${task.id}/image" alt="Referencia de ${esc(task.title)}">`:''}
        <div class="task-list-text">
          <strong class="task-list-title">${esc(task.title)}</strong>
          <span class="muted sub">${esc(task.assignee_name||'Sin asignar')} ${task.priority?`· Prioridad ${esc(task.priority)}`:''}</span>
        </div>
      </div>
      <div class="task-list-badges">
        <span class="badge ${statusColor}">${statusText}</span>
      </div>
    </div>
  `;
}
function announcementBadgeClass(accent){return accent==='green'?'green':accent==='yellow'?'yellow':'pink'}
function announcementDate(value,withTime){if(!value)return'';const date=new Date(value);return withTime?date.toLocaleString('es'):date.toLocaleDateString('es',{day:'numeric',month:'short',year:'numeric'})}
function announcementCardMarkup(item,isAdmin){
  const preview=item.body.length>160?`${item.body.slice(0,160)}…`:item.body;
  return `
    <article class="card announcement-card ${item.accent}">
      <div class="announcement-header">
        <span class="badge ${announcementBadgeClass(item.accent)}">${esc(item.tag)}</span>
        <time class="muted">${esc(announcementDate(item.created_at))}</time>
      </div>
      <h2 class="announcement-title">${esc(item.title)}</h2>
      <p class="announcement-body">${esc(preview)}</p>
      <div class="announcement-footer">
        <div class="announcement-author">
          <span class="avatar mini">${esc(item.author_name?.[0]||'A')}</span>
          <span class="muted">${esc(item.author_name||'Administración')}</span>
        </div>
        <div class="actions">
          <button type="button" class="btn secondary mini view-announcement" data-id="${item.id}">${icon('eye')}Ver</button>
          ${isAdmin?`
            <button type="button" class="btn secondary mini edit-announcement" data-id="${item.id}">${icon('edit')}Editar</button>
            <button type="button" class="btn danger mini delete-announcement" data-id="${item.id}">${icon('trash')}Eliminar</button>
          `:''}
        </div>
      </div>
    </article>
  `;
}
function announcementFormMarkup(){
  return `
    <div class="status-overlay" id="announcement-modal" style="display:none" role="dialog" aria-modal="true">
      <div class="status-viewer admin-modal-panel">
        <div class="status-viewer-head">
          <strong id="announcement-form-title">Nuevo anuncio</strong>
          <button type="button" class="icon-btn" id="cancel-announcement" aria-label="Cerrar">${icon('close')}</button>
        </div>
        <form class="admin-modal-form" id="announcement-form-element">
          <input type="hidden" name="id">
          <label>Título del anuncio
            <input class="input" name="title" placeholder="Ej. Actualización del sprint o aviso importante" required>
          </label>
          <div class="form-grid">
            <label>Etiqueta
              <input class="input" name="tag" placeholder="General, Sprint, Release..." value="General">
            </label>
            <label>Color de resalte
              <select class="select" name="accent">
                <option value="pink">Rosa / Destacado</option>
                <option value="yellow">Amarillo / Alerta</option>
                <option value="green">Verde / Positivo</option>
              </select>
            </label>
          </div>
          <label class="full">Mensaje
            <textarea class="textarea" name="body" rows="5" placeholder="Escribe el comunicado aquí..." required></textarea>
          </label>
          <div class="actions mt-3">
            <button class="btn">${icon('check')}Publicar anuncio</button>
            <button class="btn secondary" type="button" id="cancel-announcement-btn">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  `;
}
function announcementsListMarkup(announcements,isAdmin){
  const {items,totalPages,currentPage,totalItems}=paginateItems(announcements,'announcements',6);
  const grid=items.map(item=>announcementCardMarkup(item,isAdmin)).join('')||'<div class="empty">No hay anuncios publicados actualmente.</div>';
  return `
    ${heading('Anuncios','Comunicados oficiales, avisos y novedades del equipo.',isAdmin?`<button class="btn" id="new-announcement">${icon('plus')}Nuevo anuncio</button>`:'')}
    <section class="announcement-grid">${grid}</section>
    ${paginationMarkup('announcements','renderAnnouncements',totalPages,currentPage,totalItems,6)}
    ${isAdmin?announcementFormMarkup():''}
  `;
}
function announcementViewerMarkup(item){
  return `
    <div class="status-overlay" id="announcement-viewer" role="dialog" aria-modal="true">
      <div class="status-viewer announcement-reader">
        <div class="status-viewer-head">
          <div class="announcement-reader-tag">
            <span class="badge ${announcementBadgeClass(item.accent)}">${esc(item.tag)}</span>
          </div>
          <button class="icon-btn" id="close-announcement-viewer" aria-label="Cerrar">${icon('close')}</button>
        </div>
        <div class="status-viewer-body">
          <h1 class="announcement-reader-title">${esc(item.title)}</h1>
          <p class="announcement-reader-text">${esc(item.body)}</p>
        </div>
        <div class="announcement-reader-footer">
          <span class="muted">${esc(item.author_name||'Administración')}</span>
          <time class="muted">${esc(announcementDate(item.created_at,true))}</time>
        </div>
      </div>
    </div>
  `;
}
async function renderAnnouncements(){
  const isAdmin=state.user.role==='admin';
  const announcements=await api('/announcements');
  state.announcements=announcements;
  layout(announcementsListMarkup(announcements,isAdmin));
  bindPaginationControls();
  document.querySelectorAll('.view-announcement').forEach(button=>{
    button.onclick=()=>{
      const item=state.announcements.find(a=>String(a.id)===String(button.dataset.id));
      if(!item)return;
      document.body.insertAdjacentHTML('beforeend',announcementViewerMarkup(item));
      const overlay=document.querySelector('#announcement-viewer');
      const close=()=>overlay.remove();
      overlay.querySelector('#close-announcement-viewer').onclick=close;
      overlay.onclick=event=>{if(event.target===overlay)close()};
    };
  });
  if(!isAdmin)return;
  const modal=document.querySelector('#announcement-modal');
  const form=document.querySelector('#announcement-form-element');
  const openForm=(item=null)=>{
    form.reset();
    modal.style.display='grid';
    document.querySelector('#announcement-form-title').textContent=item?'Editar anuncio':'Nuevo anuncio';
    form.elements.id.value=item?.id||'';
    form.elements.title.value=item?.title||'';
    form.elements.tag.value=item?.tag||'General';
    form.elements.accent.value=item?.accent||'pink';
    form.elements.body.value=item?.body||'';
  };
  const closeModal=()=>modal.style.display='none';
  document.querySelector('#new-announcement').onclick=()=>openForm();
  document.querySelector('#cancel-announcement').onclick=closeModal;
  document.querySelector('#cancel-announcement-btn')?.addEventListener('click',closeModal);
  modal.onclick=e=>{if(e.target===modal)closeModal()};
  form.onsubmit=async event=>{
    event.preventDefault();
    const values=Object.fromEntries(new FormData(form));
    const id=values.id;
    delete values.id;
    try{
      await api(id?`/announcements/${id}`:'/announcements',{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)});
      notify(id?'Anuncio actualizado':'Anuncio publicado con éxito');
      closeModal();
      renderAnnouncements();
    }catch(error){notify(error.message)}
  };
  document.querySelectorAll('.edit-announcement').forEach(button=>button.onclick=()=>{
    const item=state.announcements.find(a=>String(a.id)===String(button.dataset.id));
    if(item)openForm(item);
  });
  document.querySelectorAll('.delete-announcement').forEach(button=>button.onclick=async()=>{
    if(!confirm('¿Eliminar este anuncio permanentemente?'))return;
    try{
      await api(`/announcements/${button.dataset.id}`,{method:'DELETE'});
      notify('Anuncio eliminado');
      renderAnnouncements();
    }catch(error){notify(error.message)}
  });
}
async function githubView(section='repository'){const data=await api(`/github/${section==='pulls'?'pull-requests':section}`);let body='';if(!data.configured)body='<div class="empty">GitHub aún no está configurado.</div>';else if(data.error)body=`<div class="alert">${esc(data.error)}</div>`;else if(section==='repository'){const r=data.data;body=`<div class="grid stats"><div class="card stat"><div class="label">Nombre</div><div class="num">${esc(r.name)}</div></div><div class="card stat"><div class="label">Lenguaje</div><div class="num lilac">${esc(r.language||'No disponible')}</div></div><div class="card stat"><div class="label">Estrellas</div><div class="num yellow">${r.stargazers_count}</div></div><div class="card stat"><div class="label">Última actualización</div><div class="num num-sm">${new Date(r.updated_at).toLocaleDateString('es')}</div></div></div><section class="card mt-4"><h2>${esc(r.full_name)}</h2><p class="muted">${esc(r.description||'No disponible')}</p><a class="btn" href="${esc(r.html_url)}" target="_blank">Abrir en GitHub</a></section>`}else if(section==='commits'){body=`<section class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Commit</th><th>Autor</th><th>Usuario GitHub</th><th>SHA</th><th>Fecha</th><th></th></tr></thead><tbody>${data.data.map(commit=>`<tr><td>${esc(commit.message)}</td><td>${esc(commit.author)}</td><td>${esc(commit.github_username||'No disponible')}</td><td><code>${esc(commit.sha)}</code></td><td>${esc(commit.date||'No disponible')}</td><td><a class="btn secondary" href="${esc(commit.url)}" target="_blank">Ver commit</a></td></tr>`).join('')||'<tr><td colspan="6" class="empty">No hay commits disponibles.</td></tr>'}</tbody></table></div></section>`}else{const rows=data.data;body=`<section class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Actividad</th><th>Usuario</th><th>Fecha</th><th></th></tr></thead><tbody>${rows.map(item=>`<tr><td>${esc(item.message||item.title||item.action||item.name)}</td><td>${esc(item.github_username||item.author||item.user||'No disponible')}</td><td>${esc(item.date||item.updated||'No disponible')}</td><td>${item.url?`<a class="btn secondary" href="${esc(item.url)}" target="_blank">Ver en GitHub</a>`:''}</td></tr>`).join('')}</tbody></table></div></section>`}return `${heading(section==='commits'?'Commits':'GitHub','Información real del repositorio privado de Sakura Coffee.')}<div class="actions" style="margin-bottom:16px"><button class="btn secondary" data-gh="repository">Overview</button><button class="btn secondary" data-gh="commits">Commits</button><button class="btn secondary" data-gh="pulls">Pull Requests</button><button class="btn secondary" data-gh="branches">Branches</button><button class="btn secondary" data-gh="activity">Activity</button></div>${body}`}
async function renderGithub(section='repository'){try{layout(await githubView(section));document.querySelectorAll('[data-gh]').forEach(b=>b.onclick=()=>renderGithub(b.dataset.gh))}catch(error){layout(`${heading('GitHub','La integración de GitHub requiere un plan compatible.')}<section class="card"><div class="alert">${esc(error.message)}</div>${state.user.role==='admin'?'<a class="btn" href="#/admin/billing">Ver planes</a>':''}</section>`)}}
async function tasksView(){
  const tasks=await api('/tasks');
  const users=['admin','project_manager'].includes(state.user.role)?await api('/users'):[];
  const projects=await api('/projects');
  const normalizedSearch = taskSearch.trim().toLowerCase();
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = !normalizedSearch || [task.title, task.description, task.assignee_name, task.status, task.priority].filter(Boolean).some(value => String(value).toLowerCase().includes(normalizedSearch));
    const matchesStatus = !taskStatusFilter || String(task.status) === String(taskStatusFilter);
    const matchesAssignee = !taskAssigneeFilter || String(task.assigned_to ?? '') === String(taskAssigneeFilter);
    return matchesSearch && matchesStatus && matchesAssignee;
  });
  const {items,totalPages,currentPage,totalItems}=paginateItems(filteredTasks,'tasks');
  const canManage=['admin','project_manager','member'].includes(state.user.role);
  const canDelete=['admin','project_manager'].includes(state.user.role);
  const assigneeOptions = [...new Map(
    tasks
      .filter(task => task.assignee_name)
      .map(task => [String(task.assigned_to ?? ''), { id: String(task.assigned_to ?? ''), name: task.assignee_name }])
  ).values()];

  return `
    ${heading(canDelete?'Gestión de Tareas':'Mis Tareas','Supervisa el progreso, fechas límite y asignaciones del equipo.',`
      <div class="actions">
        <button class="btn secondary" id="download-tasks-pdf" type="button" title="Descargar reporte PDF con tus tareas">${icon('download')}Descargar PDF</button>
        ${canManage?`<button class="btn secondary" id="import-tasks" type="button">Importar CSV/XLSX</button><button class="btn" id="new-task" type="button">${icon('plus')}Nueva tarea</button>`:''}
      </div>
    `)}
    <section class="card admin-table-card">
      <div class="task-list-toolbar">
        <div class="task-toolbar-main">
          <div class="task-toolbar-search">
            <span class="task-toolbar-icon">${icon('search')}</span>
            <input id="task-search-input" class="input task-search-field" type="search" value="${esc(taskSearch)}" placeholder="Buscar tareas por título, responsable, descripción..." aria-label="Buscar tareas">
            ${taskSearch ? `<button type="button" class="task-search-clear" id="task-search-clear" aria-label="Limpiar búsqueda" title="Limpiar búsqueda">${icon('close')}</button>` : `<kbd class="task-search-kbd" title="Presiona / para buscar">/</kbd>`}
          </div>
          <span class="task-count-tag">${filteredTasks.length} ${filteredTasks.length === 1 ? 'tarea' : 'tareas'}${filteredTasks.length !== tasks.length ? ` de ${tasks.length}` : ''}</span>
        </div>
        <div class="task-toolbar-filters">
          <select id="task-status-filter" class="select ${taskStatusFilter ? 'has-value' : ''}" aria-label="Filtrar por estado">
            <option value="">Todos los estados</option>
            <option value="pendiente" ${taskStatusFilter === 'pendiente' ? 'selected' : ''}>Pendiente</option>
            <option value="en_proceso" ${taskStatusFilter === 'en_proceso' ? 'selected' : ''}>En proceso</option>
            <option value="completada" ${taskStatusFilter === 'completada' ? 'selected' : ''}>Completada</option>
          </select>
          <select id="task-assignee-filter" class="select ${taskAssigneeFilter ? 'has-value' : ''}" aria-label="Filtrar por responsable">
            <option value="">Todos los responsables</option>
            ${assigneeOptions.map(user => `<option value="${esc(user.id)}" ${taskAssigneeFilter === String(user.id) ? 'selected' : ''}>${esc(user.name)}</option>`).join('')}
          </select>
          ${(taskSearch || taskStatusFilter || taskAssigneeFilter) ? `<button type="button" class="task-reset-btn" id="task-reset-filters" title="Limpiar todos los filtros">${icon('close')}<span>Limpiar</span></button>` : ''}
        </div>
      </div>
      ${canDelete?`<div class="actions task-bulk-actions"><button class="btn danger" id="delete-selected-tasks" disabled>Eliminar seleccionadas (<span id="selected-task-count">0</span>)</button><button class="btn danger secondary" id="delete-all-tasks" data-total="${tasks.length}" ${tasks.length?'':'disabled'}>Eliminar todas (${tasks.length})</button></div>`:''}
      <div class="table-wrap">
        <table class="table task-list-table">
          <thead>
            <tr>
              ${canDelete?'<th><label class="task-checkbox"><input id="select-visible-tasks" type="checkbox" aria-label="Seleccionar tareas visibles"></label></th>':''}
              <th>Tarea</th>
              <th>Asignado</th>
              <th>Importancia</th>
              <th style="text-align:right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(t=>{
              const prioClass=t.priority==='critica'?'pink':t.priority==='alta'?'yellow':'';
              return `
                <tr>
                  ${canDelete?`<td><label class="task-checkbox"><input class="task-row-select" type="checkbox" value="${t.id}" aria-label="Seleccionar ${esc(t.title)}"></label></td>`:''}
                  <td>
                    <strong class="task-title-cell">${esc(t.title)}</strong>
                  </td>
                  <td>
                    <span class="user-chip-mini">${avatarMarkup({name:t.assignee_name||'S'},'avatar mini')}${esc(t.assignee_name||'Sin asignar')}</span>
                  </td>
                  <td><span class="badge ${prioClass}">${esc(t.priority)}</span></td>
                  <td>
                    <div class="actions task-row-actions" style="justify-content:flex-end">
                      <button type="button" class="btn secondary mini task-icon-action move-task-sprint" data-id="${t.id}" data-project-id="${t.project_id}" data-sprint-id="${t.sprint_id||''}" title="Mover a sprint" aria-label="Mover a sprint">${icon('gantt')}</button>
                      <button type="button" class="btn secondary mini task-icon-action view-task-details" data-id="${t.id}" title="Ver detalle" aria-label="Ver detalle">${icon('eye')}</button>
                      ${canManage?`<button type="button" class="btn secondary mini task-icon-action edit-task" data-id="${t.id}" title="Editar tarea" aria-label="Editar tarea">${icon('edit')}</button>`:''}
                      ${canDelete?`<button type="button" class="btn danger mini task-icon-action delete-task" data-id="${t.id}" title="Eliminar tarea" aria-label="Eliminar tarea">${icon('trash')}</button>`:''}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')||`<tr><td colspan="${canDelete?5:4}" class="empty">${filteredTasks.length===0 ? 'No hay tareas que coincidan con los filtros.' : 'No hay tareas registradas todavía.'}</td></tr>`}
          </tbody>
        </table>
        ${paginationMarkup('tasks','renderTasks',totalPages,currentPage,totalItems)}
      </div>
    </section>
    ${canManage?taskForm(users,projects):''}
    ${canManage?taskImportForm(projects):''}
  `;
}
function taskForm(users,projects){
  return `
    <div class="status-overlay" id="task-modal" style="display:none" role="dialog" aria-modal="true">
      <div class="status-viewer admin-modal-panel">
        <div class="status-viewer-head">
          <strong id="task-form-title">Nueva tarea</strong>
          <button type="button" class="icon-btn" id="cancel-task" aria-label="Cerrar">${icon('close')}</button>
        </div>
        <form class="admin-modal-form" id="task-form-element">
          <input type="hidden" name="id">
          <div class="form-grid">
            <label>Proyecto
              <select class="select" name="project_id" id="task-form-project" required>
                <option value="">Selecciona un proyecto</option>
                ${projects.map(project=>`<option value="${project.id}">${esc(project.name)}</option>`).join('')}
              </select>
            </label>
            <label>Sprint (opcional)
              <select class="select" name="sprint_id" id="task-form-sprint">
                <option value="">Sin sprint (Backlog)</option>
              </select>
            </label>
            <label>Responsable
              <select class="select" name="assigned_to" id="task-form-assignee">
                <option value="">Sin asignar</option>
                ${users.filter(u=>u.role==='member').map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('')}
              </select>
            </label>
            <label>Prioridad
              <select class="select" name="priority">
                <option value="baja">Baja</option>
                <option value="media" selected>Media</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </label>
            <label class="full">Título de la tarea
              <input class="input" name="title" placeholder="Ej. Implementar endpoints de autenticación" required>
            </label>
            <label>Estado
              <select class="select" name="status">
                <option value="pendiente">Pendiente</option>
                <option value="en_proceso">En proceso</option>
                <option value="en_revision">En revisión</option>
                <option value="bloqueada">Bloqueada</option>
                <option value="completada">Completada</option>
              </select>
            </label>
            <label>Fecha inicial
              <input class="input" name="start_date" type="date">
            </label>
            <label>Fecha de entrega
              <input class="input" name="due_date" type="date">
            </label>
            <label class="full">Imagen o maqueta de referencia
              <input class="input" name="image" type="file" accept="image/png,image/jpeg,image/webp">
            </label>
            <label class="full">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <span>Descripción y criterios de aceptación</span>
                <button type="button" class="btn secondary mini" id="btn-use-story-template" style="padding:2px 8px;font-size:12px">${icon('file')} Usar plantilla</button>
              </div>
              <textarea class="textarea" name="description" id="task-form-description" rows="5" placeholder="Detalles de la tarea..."></textarea>
            </label>
          </div>
          <div class="actions mt-4">
            <button class="btn">${icon('check')}Guardar tarea</button>
            <button type="button" class="btn secondary" id="cancel-task-btn">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  `;
}
function taskImportForm(projects){
  return `
    <div class="status-overlay" id="task-import-modal" style="display:none" role="dialog" aria-modal="true">
      <div class="status-viewer admin-modal-panel">
        <div class="status-viewer-head">
          <strong>Importar tareas</strong>
          <button type="button" class="icon-btn" id="close-task-import" aria-label="Cerrar">${icon('close')}</button>
        </div>
        <form class="admin-modal-form" id="task-import-form" enctype="multipart/form-data">
          <div class="form-grid">
            <label class="full">Proyecto
              <select class="select" name="project_id" required>
                <option value="">Selecciona un proyecto</option>
                ${projects.map(project=>`<option value="${project.id}">${esc(project.name)}</option>`).join('')}
              </select>
            </label>
            <label class="full">Archivo CSV o Excel
              <input class="input" name="file" type="file" accept=".csv,.xlsx" required>
            </label>
          </div>
          <div class="actions mt-4">
            <button class="btn" type="submit">Importar tareas</button>
            <button class="btn secondary" type="button" id="download-task-template">Descargar plantilla XLSX</button>
            <button class="btn secondary" type="button" id="cancel-task-import">Cancelar</button>
          </div>
          <div class="alert mt-4" id="task-import-results" role="status" hidden></div>
        </form>
      </div>
    </div>
  `;
}
async function renderTasks(focusSearchCursor = null){
  layout(await tasksView());
  const taskSearchInput=document.querySelector('#task-search-input');
  const taskStatusSelect=document.querySelector('#task-status-filter');
  const taskAssigneeSelect=document.querySelector('#task-assignee-filter');
  const taskSearchClear=document.querySelector('#task-search-clear');
  const taskResetFilters=document.querySelector('#task-reset-filters');

  if (focusSearchCursor !== null && taskSearchInput) {
    taskSearchInput.focus();
    const pos = Math.min(focusSearchCursor, taskSearchInput.value.length);
    taskSearchInput.setSelectionRange(pos, pos);
  }

  taskSearchInput?.addEventListener('input', event => {
    taskSearch = event.target.value;
    state.listPages.tasks = 1;
    const cursor = event.target.selectionStart;
    renderTasks(cursor);
  });

  taskSearchClear?.addEventListener('click', () => {
    taskSearch = '';
    state.listPages.tasks = 1;
    renderTasks(0);
  });

  taskResetFilters?.addEventListener('click', () => {
    taskSearch = '';
    taskStatusFilter = '';
    taskAssigneeFilter = '';
    state.listPages.tasks = 1;
    renderTasks();
  });

  taskStatusSelect?.addEventListener('change', event => {
    taskStatusFilter = event.target.value;
    state.listPages.tasks = 1;
    renderTasks();
  });
  taskAssigneeSelect?.addEventListener('change', event => {
    taskAssigneeFilter = event.target.value;
    state.listPages.tasks = 1;
    renderTasks();
  });

  const handleTaskKeydown = (e) => {
    if (e.key === '/' && document.activeElement !== taskSearchInput && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      taskSearchInput?.focus();
      taskSearchInput?.select();
    } else if (e.key === 'Escape' && document.activeElement === taskSearchInput) {
      if (taskSearch) {
        taskSearch = '';
        state.listPages.tasks = 1;
        renderTasks(0);
      } else {
        taskSearchInput.blur();
      }
    }
  };
  window.addEventListener('keydown', handleTaskKeydown, { once: true });
  bindPaginationControls();
  document.querySelector('#download-tasks-pdf')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `${icon('progress')}Generando PDF...`;
    try {
      const params = new URLSearchParams();
      if (taskStatusFilter) params.set('status', taskStatusFilter);
      if (taskAssigneeFilter && ['admin','project_manager'].includes(state.user.role)) params.set('assigned_to', taskAssigneeFilter);
      const url = `/api/tasks/export/pdf${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'No se pudo generar el reporte PDF.');
      }
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `mis-tareas-${new Date().toISOString().slice(0, 10)}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      notify('PDF de tareas descargado con éxito');
    } catch (err) {
      notify(err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  });
  const modal=document.querySelector('#task-modal');
  const form=document.querySelector('#task-form-element');
  const canManage=['admin','project_manager','member'].includes(state.user.role);
  const canDelete=['admin','project_manager'].includes(state.user.role);
  const selectedTaskChecks=[...document.querySelectorAll('.task-row-select')];
  const selectVisibleTasks=document.querySelector('#select-visible-tasks');
  const deleteSelectedTasks=document.querySelector('#delete-selected-tasks');
  const deleteAllTasks=document.querySelector('#delete-all-tasks');
  const totalTasks=Number(deleteAllTasks?.dataset.total||0);
  const updateSelection=()=>{
    const selectedCount=selectedTaskChecks.filter(input=>input.checked).length;
    document.querySelector('#selected-task-count')?.replaceChildren(String(selectedCount));
    if(deleteSelectedTasks)deleteSelectedTasks.disabled=selectedCount===0;
    if(selectVisibleTasks){
      selectVisibleTasks.checked=selectedTaskChecks.length>0&&selectedCount===selectedTaskChecks.length;
      selectVisibleTasks.indeterminate=selectedCount>0&&selectedCount<selectedTaskChecks.length;
    }
  };
  selectVisibleTasks?.addEventListener('change',()=>{
    selectedTaskChecks.forEach(input=>input.checked=selectVisibleTasks.checked);
    updateSelection();
  });
  selectedTaskChecks.forEach(input=>input.addEventListener('change',updateSelection));
  deleteSelectedTasks?.addEventListener('click',async()=>{
    const ids=selectedTaskChecks.filter(input=>input.checked).map(input=>Number(input.value));
    if(!ids.length||!confirm(`¿Eliminar las ${ids.length} tareas seleccionadas?`))return;
    try{
      const result=await api('/tasks/bulk',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids})});
      notify(`${result.deleted} tareas eliminadas.`);
      renderTasks();
    }catch(error){notify(error.message)}
  });
  deleteAllTasks?.addEventListener('click',async()=>{
    if(!confirm(`¿Eliminar permanentemente las ${totalTasks} tareas de esta organización? Esta acción no se puede deshacer.`))return;
    try{
      const result=await api('/tasks/bulk',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({all:true})});
      notify(`${result.deleted} tareas eliminadas.`);
      renderTasks();
    }catch(error){notify(error.message)}
  });
  const importModal=document.querySelector('#task-import-modal');
  const importForm=document.querySelector('#task-import-form');
  const importResults=document.querySelector('#task-import-results');
  let importedTasks=false;

  const loadSprintsForTaskForm = async (projectId, selectedSprintId = null) => {
    const sprintSelect = document.querySelector('#task-form-sprint');
    if (!sprintSelect) return;
    sprintSelect.innerHTML = '<option value="">Sin sprint (Backlog)</option>';
    if (!projectId) return;
    try {
      const sprints = await api(`/projects/${projectId}/sprints`);
      sprintSelect.innerHTML = [
        '<option value="">Sin sprint (Backlog)</option>',
        ...sprints.map(s => `<option value="${s.id}" ${String(s.id) === String(selectedSprintId) ? 'selected' : ''}>${esc(s.name)} (${esc(s.status)})</option>`)
      ].join('');
    } catch {}
  };

  const openForm=async task=>{
    form.reset();
    modal.style.display='grid';
    document.querySelector('#task-form-title').textContent=task?.id?'Editar tarea':'Nueva tarea';
    form.elements.id.value=task?.id||'';
    form.elements.project_id.value=task?.project_id||'';
    form.elements.title.value=task?.title||'';
    form.elements.description.value=task?.description||'';
    form.elements.assigned_to.value=task?.assigned_to||'';
    form.elements.priority.value=task?.priority||'media';
    form.elements.status.value=task?.status||'pendiente';
    form.elements.start_date.value=task?.start_date?String(task.start_date).slice(0,10):'';
    form.elements.due_date.value=task?.due_date?String(task.due_date).slice(0,10):'';
    await loadSprintsForTaskForm(task?.project_id, task?.sprint_id);
  };

  document.querySelector('#task-form-project')?.addEventListener('change', e => {
    loadSprintsForTaskForm(e.target.value);
  });

  document.querySelector('#btn-use-story-template')?.addEventListener('click', async () => {
    try {
      const templates = await api('/templates?type=story');
      const promptText = templates.map((t, i) => `${i + 1}. ${t.name}: ${t.description}`).join('\n');
      const choice = window.prompt(`Selecciona una plantilla de historia (1-${templates.length}):\n\n${promptText}`, '1');
      if (!choice) return;
      const selected = templates[Number(choice) - 1];
      if (selected) {
        const descField = document.querySelector('#task-form-description');
        if (descField) descField.value = selected.content;
      }
    } catch (e) {
      notify(e.message);
    }
  });

  document.querySelectorAll('.move-task-sprint').forEach(btn => {
    btn.onclick = async () => {
      const taskId = btn.dataset.id;
      const projectId = btn.dataset.projectId;
      const currentSprintId = btn.dataset.sprintId;
      try {
        const sprints = await api(`/projects/${projectId}/sprints`);
        if (!sprints.length) {
          notify('Este proyecto aún no tiene sprints creados.');
          return;
        }
        const promptList = sprints.map(s => `ID ${s.id}: ${s.name} [${s.status}]`).join('\n');
        const answer = window.prompt(
          `Mover tarea a un sprint:\n\n${promptList}\n\nIngresa el ID del sprint o déjalo vacío para devolver al Backlog:`,
          currentSprintId || ''
        );
        if (answer === null) return;
        const targetSprintId = answer.trim() === '' || answer.trim() === '0' ? null : Number(answer.trim());
        await api(`/tasks/${taskId}/sprint`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sprint_id: targetSprintId })
        });
        notify(targetSprintId ? 'Tarea asignada al sprint' : 'Tarea devuelta al backlog');
        renderTasks();
      } catch (e) {
        notify(e.message);
      }
    };
  });

  const preselectedProjectId = sessionStorage.getItem('preselected_project_id');
  if (preselectedProjectId) {
    sessionStorage.removeItem('preselected_project_id');
    setTimeout(() => {
      openForm({ project_id: Number(preselectedProjectId) });
    }, 50);
  }

  const closeModal=()=>modal.style.display='none';
  const closeImportModal=()=>{
    importModal.style.display='none';
    if(importedTasks){importedTasks=false;renderTasks()}
  };
  document.querySelector('#new-task')?.addEventListener('click',()=>openForm());
  document.querySelector('#import-tasks')?.addEventListener('click',()=>{
    importForm.reset();
    importResults.hidden=true;
    importResults.textContent='';
    importModal.style.display='grid';
  });
  document.querySelector('#close-task-import')?.addEventListener('click',closeImportModal);
  document.querySelector('#cancel-task-import')?.addEventListener('click',closeImportModal);
  importModal.onclick=e=>{if(e.target===importModal)closeImportModal()};
  document.querySelector('#download-task-template')?.addEventListener('click',async()=>{
    try{
      const response=await fetch('/api/tasks/import-template',{credentials:'include'});
      if(!response.ok){
        const error=await response.json().catch(()=>({}));
        throw new Error(error.error||'No se pudo descargar la plantilla.');
      }
      const link=document.createElement('a');
      link.href=URL.createObjectURL(await response.blob());
      link.download='plantilla-tareas.xlsx';
      link.click();
      setTimeout(()=>URL.revokeObjectURL(link.href),1000);
    }catch(error){notify(error.message)}
  });
  importForm?.addEventListener('submit',async event=>{
    event.preventDefault();
    const button=importForm.querySelector('button[type="submit"]');
    button.disabled=true;
    try{
      const result=await api('/tasks/import',{method:'POST',body:new FormData(importForm)});
      const errors=result.errors||[];
      importResults.innerHTML=`<strong>${result.created} tareas creadas.</strong>${errors.length?`<ul>${errors.slice(0,10).map(item=>`<li>Fila ${item.row}: ${esc(item.error)}</li>`).join('')}</ul>`:''}`;
      importResults.hidden=false;
      importedTasks=result.created>0;
      if(errors.length)notify(`${errors.length} fila(s) no se pudieron importar.`);
    }catch(error){notify(error.message)}
    finally{button.disabled=false}
  });
  document.querySelector('#cancel-task')?.addEventListener('click',closeModal);
  document.querySelector('#cancel-task-btn')?.addEventListener('click',closeModal);
  modal.onclick=e=>{if(e.target===modal)closeModal()};

  form?.addEventListener('submit',async e=>{
    e.preventDefault();
    const values=Object.fromEntries(new FormData(e.target));
    const id=values.id;
    delete values.id;
    try{
      await api(id?`/tasks/${id}`:'/tasks',{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)});
      notify(id?'Tarea actualizada con éxito':'Tarea creada correctamente');
      closeModal();
      renderTasks();
    }catch(error){notify(error.message)}
  });
  document.querySelectorAll('.view-task-details').forEach(button=>button.onclick=async()=>{
    try{
      const task=await api(`/tasks/${button.dataset.id}`);
      const popover=document.createElement('div');
      popover.className='gantt-popover task-detail-popover';
      popover.innerHTML=`
        <div class="task-detail-header">
          <strong>${esc(task.title)}</strong>
          <button type="button" class="icon-btn task-detail-close" aria-label="Cerrar">${icon('close')}</button>
        </div>
        <div class="task-detail-grid">
          <div><span>Estado</span><strong>${esc(task.status.replace('_',' '))}</strong></div>
          <div><span>Prioridad</span><strong>${esc(task.priority)}</strong></div>
          <div><span>Responsable</span><strong>${esc(task.assignee_name || 'Sin asignar')}</strong></div>
          <div><span>Fecha inicial</span><strong>${esc(task.start_date || 'No definida')}</strong></div>
          <div><span>Fecha límite</span><strong>${esc(task.due_date || 'No definida')}</strong></div>
          <div><span>Creada</span><strong>${esc(task.created_at || 'No disponible')}</strong></div>
        </div>
        <div class="task-detail-description">
          <span>Descripción</span>
          <p>${esc(task.description || 'Sin descripción adicional.')}</p>
        </div>
        ${canManage?`<div class="actions task-detail-actions"><button type="button" class="btn secondary edit-task-detail">${icon('edit')}Editar</button>${canDelete?`<button type="button" class="btn danger delete-task-detail">${icon('trash')}Eliminar</button>`:''}</div>`:''}
      `;
      document.body.append(popover);
      const rect=button.getBoundingClientRect();
      const margin=8;
      const left=Math.max(margin,Math.min(rect.left,window.innerWidth-popover.offsetWidth-margin));
      const below=rect.bottom+margin;
      const top=below+popover.offsetHeight<=window.innerHeight-margin
        ?below
        :Math.max(margin,rect.top-popover.offsetHeight-margin);
      popover.style.left=`${left}px`;
      popover.style.top=`${top}px`;
      const close=()=>{
        popover.remove();
        document.removeEventListener('pointerdown',onOutside);
      };
      const onOutside=event=>{
        if(!popover.contains(event.target)&&!button.contains(event.target))close();
      };
      popover.querySelector('.task-detail-close').onclick=close;
      popover.querySelector('.edit-task-detail')?.addEventListener('click',()=>{close();openForm(task)});
      popover.querySelector('.delete-task-detail')?.addEventListener('click',async()=>{
        if(!confirm('¿Deseas eliminar esta tarea permanentemente?'))return;
        try{
          await api(`/tasks/${task.id}`,{method:'DELETE'});
          notify('Tarea eliminada');
          close();
          renderTasks();
        }catch(error){notify(error.message)}
      });
      setTimeout(()=>document.addEventListener('pointerdown',onOutside),0);
    }catch(error){notify(error.message)}
  });
  document.querySelectorAll('.edit-task').forEach(button=>button.onclick=async()=>{
    try{openForm(await api(`/tasks/${button.dataset.id}`))}catch(error){notify(error.message)}
  });
  document.querySelectorAll('.status-select-styled').forEach(select=>select.onchange=async()=>{
    try{
      await api(`/tasks/${select.dataset.id}/status`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:select.value})});
      notify('Estado de la tarea actualizado');
    }catch(error){notify(error.message)}
  });
  document.querySelectorAll('.delete-task').forEach(button=>button.onclick=async()=>{
    if(confirm('¿Deseas eliminar esta tarea permanentemente?')){
      await api(`/tasks/${button.dataset.id}`,{method:'DELETE'});
      notify('Tarea eliminada');
      renderTasks();
    }
  });
}
async function kanban(){
  const tasks=await api('/tasks');
  return `
    ${heading('Kanban','Organización visual del flujo de trabajo por columnas de estado.')}
    <div class="kanban">
      ${[['pendiente','Pendiente'],['en_proceso','En proceso'],['completada','Completada']].map(([status,label])=>`
        <section class="column" data-status="${status}">
          <div class="column-header">
            <h3>${label}</h3>
            <span class="badge ${status==='completada'?'green':status==='en_proceso'?'pink':'yellow'}">${tasks.filter(t=>t.status===status).length}</span>
          </div>
          <div class="column-cards">
            ${tasks.filter(t=>t.status===status).map(t=>`
              <article class="task-card" draggable="true" data-id="${t.id}">
                ${t.image_asset_id?`<img class="task-thumb" src="/api/tasks/${t.id}/image" alt="${esc(t.title)}">`:''}
                <h3>${esc(t.title)}</h3>
                ${t.description?`<p>${esc(t.description)}</p>`:''}
                <div class="meta">
                  <span class="muted">${esc(t.assignee_name||'Sin asignar')}</span>
                  ${t.due_date?`<span class="badge yellow">${esc(String(t.due_date).slice(0,10))}</span>`:''}
                </div>
              </article>
            `).join('')||'<div class="empty">Sin tareas</div>'}
          </div>
        </section>
      `).join('')}
    </div>
  `;
}
async function renderKanban(){
  if(state.kanbanTimer)clearInterval(state.kanbanTimer);
  layout(await kanban());
  let draggedCard=null;
  document.querySelectorAll('.task-card').forEach(card=>{
    card.ondragstart=e=>{
      draggedCard=card;
      card.classList.add('is-dragging');
      e.dataTransfer.effectAllowed='move';
      e.dataTransfer.setData('id',card.dataset.id);
    };
    card.ondragend=()=>card.classList.remove('is-dragging');
  });
  document.querySelectorAll('.column').forEach(column=>{
    column.ondragover=e=>{
      e.preventDefault();
      column.classList.add('is-drag-over');
    };
    column.ondragleave=()=>column.classList.remove('is-drag-over');
    column.ondrop=async e=>{
      e.preventDefault();
      column.classList.remove('is-drag-over');
      const card=draggedCard||document.querySelector(`.task-card[data-id="${e.dataTransfer.getData('id')}"]`);
      if(!card)return;
      const originalColumn=card.closest('.column');
      const originalStatus=originalColumn.dataset.status;
      const nextStatus=column.dataset.status;
      if(originalStatus===nextStatus)return;
      const cardsContainer=column.querySelector('.column-cards')||column;
      cardsContainer.append(card);
      try{
        await api(`/tasks/${card.dataset.id}/status`,{
          method:'PATCH',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({status:nextStatus})
        });
        notify('Estado actualizado');
        renderKanban();
      }catch(error){
        const origContainer=originalColumn.querySelector('.column-cards')||originalColumn;
        origContainer.append(card);
        notify(error.message||'No fue posible mover la tarea.');
      }
    };
  });
  state.kanbanTimer=setInterval(()=>{
    if(document.visibilityState==='visible'&&location.hash.includes('kanban')){
      renderKanban().catch(error=>notify(error.message));
    }
  },30000);
}
function fileTypeInfo(mimeType = '', originalName = '') {
  const mime = String(mimeType || '').toLowerCase();
  const ext = (String(originalName || '').split('.').pop() || '').toLowerCase();

  if (mime.includes('pdf') || ext === 'pdf') {
    return { label: 'PDF', badgeClass: 'pink', category: 'pdf' };
  }
  if (mime.includes('spreadsheetml') || ext === 'xlsx') {
    return { label: 'XLSX', badgeClass: 'green', category: 'spreadsheet' };
  }
  if (mime.includes('excel') || ext === 'xls') {
    return { label: 'XLS', badgeClass: 'green', category: 'spreadsheet' };
  }
  if (mime.includes('csv') || ext === 'csv') {
    return { label: 'CSV', badgeClass: 'green', category: 'spreadsheet' };
  }
  if (mime.includes('wordprocessingml') || ext === 'docx') {
    return { label: 'DOCX', badgeClass: 'blue', category: 'document' };
  }
  if (mime.includes('msword') || ext === 'doc') {
    return { label: 'DOC', badgeClass: 'blue', category: 'document' };
  }
  if (mime.includes('presentationml') || ext === 'pptx') {
    return { label: 'PPTX', badgeClass: 'yellow', category: 'document' };
  }
  if (mime.includes('ms-powerpoint') || ext === 'ppt') {
    return { label: 'PPT', badgeClass: 'yellow', category: 'document' };
  }
  if (mime.includes('text/plain') || ext === 'txt') {
    return { label: 'TXT', badgeClass: 'blue', category: 'document' };
  }
  if (mime.includes('png') || ext === 'png') {
    return { label: 'PNG', badgeClass: 'yellow', category: 'image' };
  }
  if (mime.includes('jpeg') || mime.includes('jpg') || ext === 'jpg' || ext === 'jpeg') {
    return { label: 'JPG', badgeClass: 'yellow', category: 'image' };
  }
  if (mime.includes('webp') || ext === 'webp') {
    return { label: 'WEBP', badgeClass: 'yellow', category: 'image' };
  }
  if (mime.includes('gif') || ext === 'gif') {
    return { label: 'GIF', badgeClass: 'yellow', category: 'image' };
  }
  if (mime.includes('svg') || ext === 'svg') {
    return { label: 'SVG', badgeClass: 'yellow', category: 'image' };
  }
  if (mime.startsWith('image/')) {
    return { label: 'IMG', badgeClass: 'yellow', category: 'image' };
  }
  if (mime.includes('zip') || ext === 'zip') {
    return { label: 'ZIP', badgeClass: 'pink', category: 'archive' };
  }
  if (mime.includes('rar') || ext === 'rar') {
    return { label: 'RAR', badgeClass: 'pink', category: 'archive' };
  }
  if (mime.includes('7z') || ext === '7z') {
    return { label: '7Z', badgeClass: 'pink', category: 'archive' };
  }
  if (mime.includes('tar') || ext === 'tar' || ext === 'gz') {
    return { label: 'TAR', badgeClass: 'pink', category: 'archive' };
  }
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg'].includes(ext)) {
    return { label: 'AUDIO', badgeClass: 'green', category: 'other' };
  }
  if (mime.startsWith('video/') || ['mp4', 'mov', 'webm', 'mkv'].includes(ext)) {
    return { label: 'VIDEO', badgeClass: 'pink', category: 'other' };
  }
  if (mime.includes('json') || ext === 'json') {
    return { label: 'JSON', badgeClass: 'green', category: 'other' };
  }

  const shortExt = (ext && ext.length <= 4 && ext !== originalName) ? ext.toUpperCase() : 'DOC';
  return { label: shortExt, badgeClass: '', category: 'other' };
}

function fileDateShort(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr).slice(0, 10);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

async function filesView(){
  const files=await api('/files');
  const normalizedSearch = fileSearch.trim().toLowerCase();

  const filteredFiles = files.filter(f => {
    const info = fileTypeInfo(f.mime_type, f.original_name);
    const matchesSearch = !normalizedSearch || [
      f.original_name,
      f.uploader_name,
      f.mime_type,
      info.label
    ].filter(Boolean).some(val => String(val).toLowerCase().includes(normalizedSearch));

    let matchesType = true;
    if (fileTypeFilter) {
      if (fileTypeFilter === 'pdf') matchesType = info.label === 'PDF' || info.category === 'pdf';
      else if (fileTypeFilter === 'image') matchesType = info.category === 'image';
      else if (fileTypeFilter === 'document') matchesType = info.category === 'document' || info.category === 'pdf';
      else if (fileTypeFilter === 'spreadsheet') matchesType = info.category === 'spreadsheet';
      else if (fileTypeFilter === 'archive') matchesType = info.category === 'archive';
      else if (fileTypeFilter === 'other') matchesType = !['pdf', 'image', 'document', 'spreadsheet', 'archive'].includes(info.category);
    }

    const matchesUploader = !fileUploaderFilter || String(f.uploaded_by ?? '') === String(fileUploaderFilter);

    return matchesSearch && matchesType && matchesUploader;
  });

  const {items,totalPages,currentPage,totalItems}=paginateItems(filteredFiles,'files');

  const uploaderOptions = [...new Map(
    files
      .filter(f => f.uploader_name)
      .map(f => [String(f.uploaded_by ?? ''), { id: String(f.uploaded_by ?? ''), name: f.uploader_name }])
  ).values()];

  const hasActiveFilters = Boolean(fileSearch || fileTypeFilter || fileUploaderFilter);

  return `
    ${heading('Archivos y Documentos','Documentos compartidos, entregables y evidencias del equipo.',`
      <form id="upload-form" class="actions files-upload-form">
        <label class="btn secondary" style="cursor:pointer">
          ${icon('upload')}Seleccionar archivo
          <input class="input" type="file" name="file" style="display:none" required onchange="this.form.querySelector('#upload-filename').textContent=this.files[0]?.name||''">
        </label>
        <span id="upload-filename" class="muted files-upload-filename"></span>
        <button class="btn">${icon('check')}Subir evidencia</button>
      </form>
    `)}
    <section class="card admin-table-card files-card">
      <div class="task-list-toolbar files-toolbar">
        <div class="task-toolbar-main">
          <div class="task-toolbar-search">
            <span class="task-toolbar-icon">${icon('search')}</span>
            <input id="file-search-input" class="input task-search-field" type="search" value="${esc(fileSearch)}" placeholder="Buscar por nombre, autor o tipo..." aria-label="Buscar archivos">
            ${fileSearch ? `<button type="button" class="task-search-clear" id="file-search-clear" aria-label="Limpiar búsqueda" title="Limpiar búsqueda">${icon('close')}</button>` : `<kbd class="task-search-kbd" title="Presiona / para buscar">/</kbd>`}
          </div>
          <span class="task-count-tag">${filteredFiles.length} ${filteredFiles.length === 1 ? 'archivo' : 'archivos'}${filteredFiles.length !== files.length ? ` de ${files.length}` : ''}</span>
        </div>
        <div class="task-toolbar-filters">
          <select id="file-type-filter" class="select ${fileTypeFilter ? 'has-value' : ''}" aria-label="Filtrar por tipo">
            <option value="">Todos los tipos</option>
            <option value="pdf" ${fileTypeFilter === 'pdf' ? 'selected' : ''}>PDF</option>
            <option value="image" ${fileTypeFilter === 'image' ? 'selected' : ''}>Imágenes</option>
            <option value="document" ${fileTypeFilter === 'document' ? 'selected' : ''}>Documentos</option>
            <option value="spreadsheet" ${fileTypeFilter === 'spreadsheet' ? 'selected' : ''}>Hojas de cálculo</option>
            <option value="archive" ${fileTypeFilter === 'archive' ? 'selected' : ''}>Comprimidos</option>
            <option value="other" ${fileTypeFilter === 'other' ? 'selected' : ''}>Otros</option>
          </select>
          ${uploaderOptions.length > 1 ? `
            <select id="file-uploader-filter" class="select ${fileUploaderFilter ? 'has-value' : ''}" aria-label="Filtrar por autor">
              <option value="">Todos los autores</option>
              ${uploaderOptions.map(u => `<option value="${esc(u.id)}" ${fileUploaderFilter === String(u.id) ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}
            </select>
          ` : ''}
          ${hasActiveFilters ? `<button type="button" class="task-reset-btn" id="file-reset-filters" title="Limpiar todos los filtros">${icon('close')}<span>Limpiar</span></button>` : ''}
        </div>
      </div>
      <div class="table-wrap files-table-wrap">
        <table class="table files-table">
          <thead>
            <tr>
              <th>Archivo</th>
              <th style="width:70px;text-align:center">Tipo</th>
              <th>Subido por</th>
              <th style="width:85px;text-align:center">Fecha</th>
              <th style="width:140px;text-align:right">Acción</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(f => {
              const info = fileTypeInfo(f.mime_type, f.original_name);
              return `
                <tr>
                  <td class="file-name-cell">
                    <strong class="file-title" title="${esc(f.original_name)}">${esc(f.original_name)}</strong>
                  </td>
                  <td style="text-align:center">
                    <span class="badge ${info.badgeClass}" title="${esc(f.mime_type)}">${info.label}</span>
                  </td>
                  <td>${esc(f.uploader_name || 'Desconocido')}</td>
                  <td class="muted file-date-cell" style="text-align:center">
                    <span title="${new Date(f.created_at).toLocaleString('es')}">${fileDateShort(f.created_at)}</span>
                  </td>
                  <td>
                    <div class="actions file-actions">
                      <button class="btn secondary mini view-file" data-id="${f.id}" data-name="${esc(f.original_name)}" data-type="${esc(f.mime_type)}">${icon('eye')}Ver</button>
                      <a class="btn secondary mini" href="/api/files/${f.id}/download" download>${icon('download')}Descargar</a>
                      ${state.user.role === 'admin' ? `<button class="btn danger mini delete-file" data-id="${f.id}">${icon('trash')}Eliminar</button>` : ''}
                    </div>
                  </td>
                </tr>
              `;
            }).join('') || `<tr><td colspan="5" class="empty">${hasActiveFilters ? 'No se encontraron archivos que coincidan con la búsqueda o filtros.' : 'Aún no hay archivos compartidos.'}</td></tr>`}
          </tbody>
        </table>
        ${paginationMarkup('files','renderFiles',totalPages,currentPage,totalItems)}
      </div>
    </section>
    <div id="file-viewer" class="file-viewer status-overlay" style="display:none" role="dialog" aria-modal="true">
      <div class="file-viewer-panel status-viewer admin-modal-panel">
        <div class="file-viewer-head status-viewer-head">
          <strong id="file-viewer-title">Visualizador de archivo</strong>
          <button class="icon-btn" id="close-file-viewer" aria-label="Cerrar">${icon('close')}</button>
        </div>
        <div id="file-viewer-content" class="file-viewer-content" style="padding:16px;text-align:center;max-height:75vh;overflow:auto"></div>
      </div>
    </div>
  `;
}
async function renderFiles(focusSearchCursor = null){
  layout(await filesView());
  bindPaginationControls();

  const fileSearchInput = document.querySelector('#file-search-input');
  const fileSearchClear = document.querySelector('#file-search-clear');
  const fileTypeSelect = document.querySelector('#file-type-filter');
  const fileUploaderSelect = document.querySelector('#file-uploader-filter');
  const fileResetFilters = document.querySelector('#file-reset-filters');

  if (focusSearchCursor !== null && fileSearchInput) {
    fileSearchInput.focus();
    const pos = Math.min(focusSearchCursor, fileSearchInput.value.length);
    fileSearchInput.setSelectionRange(pos, pos);
  }

  fileSearchInput?.addEventListener('input', event => {
    fileSearch = event.target.value;
    state.listPages.files = 1;
    const cursor = event.target.selectionStart;
    renderFiles(cursor);
  });

  fileSearchClear?.addEventListener('click', () => {
    fileSearch = '';
    state.listPages.files = 1;
    renderFiles(0);
  });

  fileTypeSelect?.addEventListener('change', event => {
    fileTypeFilter = event.target.value;
    state.listPages.files = 1;
    renderFiles();
  });

  fileUploaderSelect?.addEventListener('change', event => {
    fileUploaderFilter = event.target.value;
    state.listPages.files = 1;
    renderFiles();
  });

  fileResetFilters?.addEventListener('click', () => {
    fileSearch = '';
    fileTypeFilter = '';
    fileUploaderFilter = '';
    state.listPages.files = 1;
    renderFiles();
  });

  const handleFileKeydown = (e) => {
    if (e.key === '/' && document.activeElement !== fileSearchInput && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      fileSearchInput?.focus();
      fileSearchInput?.select();
    } else if (e.key === 'Escape' && document.activeElement === fileSearchInput) {
      if (fileSearch) {
        fileSearch = '';
        state.listPages.files = 1;
        renderFiles(0);
      } else {
        fileSearchInput.blur();
      }
    }
  };
  window.addEventListener('keydown', handleFileKeydown, { once: true });

  document.querySelector('#upload-form')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const fileInput=e.target.querySelector('input[type="file"]');
    if(!fileInput?.files?.length){notify('Selecciona un archivo para subir.');return;}
    try{
      await api('/files',{method:'POST',body:new FormData(e.target)});
      notify('Archivo subido exitosamente');
      renderFiles();
    }catch(err){notify(err.message)}
  });
  document.querySelectorAll('.view-file').forEach(button=>button.onclick=()=>{
    const viewer=document.querySelector('#file-viewer');
    const type=button.dataset.type;
    const url=`/api/files/${button.dataset.id}/view`;
    document.querySelector('#file-viewer-title').textContent=button.dataset.name;
    document.querySelector('#file-viewer-content').innerHTML=type.startsWith('image/')
      ?`<img class="file-preview-image" src="${url}" alt="${esc(button.dataset.name)}" style="max-width:100%;max-height:70vh;border-radius:12px;box-shadow:var(--shadow-subtle)">`
      :`<iframe class="file-preview-frame" src="${url}" title="${esc(button.dataset.name)}" style="width:100%;height:65vh;border:none;border-radius:12px"></iframe>`;
    viewer.style.display='grid';
  });
  const closeViewer=()=>{
    const viewer=document.querySelector('#file-viewer');
    if(viewer){
      viewer.style.display='none';
      document.querySelector('#file-viewer-content').innerHTML='';
    }
  };
  document.querySelector('#close-file-viewer')?.addEventListener('click',closeViewer);
  document.querySelector('#file-viewer')?.addEventListener('click',e=>{if(e.target.id==='file-viewer')closeViewer();});
  document.querySelectorAll('.delete-file').forEach(b=>b.onclick=async()=>{
    if(confirm('¿Eliminar archivo permanentemente?')){
      try{
        await api(`/files/${b.dataset.id}`,{method:'DELETE'});
        notify('Archivo eliminado');
        renderFiles();
      }catch(err){notify(err.message)}
    }
  });
}
function profile(){
  const photo=state.user.profile_photo
    ?`<img class="profile-photo" src="${esc(state.user.profile_photo)}" alt="Foto de perfil">`
    :`<div class="profile-photo profile-placeholder">${esc(state.user.name[0])}</div>`;
  return `
    ${heading('Mi Perfil','Información de tu cuenta y preferencias en Haitani.')}
    <section class="card profile-card">
      <div class="profile-summary">
        ${photo}
        <div>
          <h2>${esc(state.user.name)}</h2>
          <p class="muted">${esc(state.user.email)}</p>
        </div>
      </div>
      <div class="grid stats mt-4">
        <div><div class="muted">Usuario</div><h2>${esc(state.user.username)}</h2></div>
        <div><div class="muted">Rol</div><h2>${esc(state.user.role)}</h2></div>
        <div><div class="muted">GitHub</div>${state.user.github_username ? `<h2>${esc(state.user.github_username)}</h2>` : `<button id="connect-github" class="btn">Conectar a GitHub</button>`}</div>
        <div><div class="muted">GitLab</div>${state.user.gitlab_username ? `<h2>${esc(state.user.gitlab_username)}</h2>` : `<button id="connect-gitlab" class="btn">Conectar a GitLab</button>`}</div>
      </div>
    </section>
    <section class="card mt-4">
      <h2>Actualizar perfil</h2>
      <p class="muted">Edita tus datos personales, foto de perfil y contraseña.</p>
      <form id="profile-form" class="form-grid" enctype="multipart/form-data">
        <label>Nombre
          <input class="input" name="name" value="${esc(state.user.name)}" required>
        </label>
        <label>Usuario
          <input class="input" name="username" value="${esc(state.user.username)}" required>
        </label>
        <label>Correo electrónico
          <input class="input" name="email" type="email" value="${esc(state.user.email)}" required>
        </label>
        <label>Foto de perfil
          <input class="input" name="photo" type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp">
        </label>
        <label>Contraseña actual
          <input class="input" name="current_password" type="password" autocomplete="current-password">
        </label>
        <label>Nueva contraseña
          <input class="input" name="new_password" type="password" minlength="8" autocomplete="new-password">
        </label>
        <div class="actions full">
          <button class="btn">${icon('check')}Guardar cambios</button>
        </div>
      </form>
    </section>
  `;
}
async function renderProfile(){
  layout(profile());
  document.querySelector('#profile-form').onsubmit=async event=>{
    event.preventDefault();
    try{
      const data=await api('/users/me/profile',{method:'PUT',body:new FormData(event.target)});
      state.user={...state.user,...data};
      notify('Perfil actualizado con éxito');
      renderProfile();
    }catch(error){
      notify(error.message);
    }
  };
   // OAuth button listeners
   document.querySelector('#connect-github')?.addEventListener('click', () => {
     location.href = '/api/oauth/github/init';
   });
   document.querySelector('#connect-gitlab')?.addEventListener('click', () => {
     location.href = '/api/oauth/gitlab/init';
   });
}

async function members(){
  const users=await api('/users');
  const membersList=users.filter(u=>u.role==='member');
  const {items,totalPages,currentPage,totalItems}=paginateItems(membersList,'members');
  return `
    ${heading('Integrantes del Equipo','Gestiona el acceso, roles y estados de los colaboradores.',`<button class="btn" id="new-member">${icon('plus')}Nuevo integrante</button>`)}
    <section class="card admin-table-card">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Usuario</th>
              <th>Correo Electrónico</th>
              <th>GitHub</th>
              <th>Estado</th>
              <th style="text-align:right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(u=>`
              <tr>
                <td>
                  <div class="member-cell">
                    ${u.profile_photo?`<img class="avatar" src="${esc(u.profile_photo)}" alt="Foto de ${esc(u.name)}">`:`<span class="avatar">${esc(u.name[0])}</span>`}
                    <strong>${esc(u.name)}</strong>
                  </div>
                </td>
                <td><code class="member-username">@${esc(u.username)}</code></td>
                <td><span class="muted">${esc(u.email)}</span></td>
                <td>${u.github_username?`<span class="badge">${icon('github')} ${esc(u.github_username)}</span>`:'<span class="muted">—</span>'}</td>
                <td>
                  <span class="badge ${u.active?'green':'pink'}">${u.active?'Activo':'Inactivo'}</span>
                </td>
                <td style="text-align:right">
                  <div class="actions" style="justify-content:flex-end">
                    <button class="btn secondary mini edit-user" data-user="${encodeURIComponent(JSON.stringify(u))}">${icon('edit')}Editar</button>
                    <button class="btn secondary mini toggle-user" data-id="${u.id}" data-active="${u.active}">${icon(u.active?'block':'check')}${u.active?'Desactivar':'Activar'}</button>
                    <button class="btn danger mini delete-user" data-id="${u.id}">${icon('trash')}Eliminar</button>
                  </div>
                </td>
              </tr>
            `).join('')||'<tr><td colspan="6" class="empty">No hay integrantes registrados en el equipo.</td></tr>'}
          </tbody>
        </table>
        ${paginationMarkup('members','renderMembers',totalPages,currentPage,totalItems)}
      </div>
    </section>
    <div class="status-overlay" id="member-modal" style="display:none" role="dialog" aria-modal="true">
      <div class="status-viewer admin-modal-panel">
        <div class="status-viewer-head">
          <strong id="member-form-title">Nuevo integrante</strong>
          <button type="button" class="icon-btn" id="cancel-member" aria-label="Cerrar">${icon('close')}</button>
        </div>
        <form class="admin-modal-form" id="member-form-element">
          <input type="hidden" name="id">
          <div class="form-grid">
            <label>Nombre completo
              <input class="input" name="name" placeholder="Ej. Alex Vance" required>
            </label>
            <label>Nombre de usuario
              <input class="input" name="username" placeholder="alexvance" required>
            </label>
            <label>Correo electrónico
              <input class="input" name="email" type="email" placeholder="alex@empresa.com" required>
            </label>
            <label>Usuario de GitHub
              <input class="input" name="github_username" placeholder="alexvance">
            </label>
            <label>Contraseña de acceso
              <input class="input" name="password" placeholder="Mínimo 8 caracteres">
            </label>
            <label>Estado de cuenta
              <select class="select" name="active">
                <option value="1">Activo</option>
                <option value="0">Inactivo</option>
              </select>
            </label>
          </div>
          <div class="actions mt-4">
            <button class="btn">${icon('check')}Guardar integrante</button>
            <button class="btn secondary" type="button" id="cancel-member-btn">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  `;
}
async function renderMembers(){
  layout(await members());
  bindPaginationControls();
  const modal=document.querySelector('#member-modal');
  const form=document.querySelector('#member-form-element');
  const openForm=(user=null)=>{
    form.reset();
    modal.style.display='grid';
    document.querySelector('#member-form-title').textContent=user?'Editar integrante':'Nuevo integrante';
    form.elements.id.value=user?.id||'';
    form.elements.name.value=user?.name||'';
    form.elements.username.value=user?.username||'';
    form.elements.email.value=user?.email||'';
    form.elements.github_username.value=user?.github_username||'';
    form.elements.active.value=user?.active?'1':'0';
    form.elements.password.value='';
    form.elements.password.required=!user;
  };
  const closeModal=()=>modal.style.display='none';
  document.querySelector('#new-member').onclick=()=>openForm();
  document.querySelector('#cancel-member').onclick=closeModal;
  document.querySelector('#cancel-member-btn')?.addEventListener('click',closeModal);
  modal.onclick=e=>{if(e.target===modal)closeModal()};

  form.onsubmit=async e=>{
    e.preventDefault();
    const values=Object.fromEntries(new FormData(form));
    const id=values.id;
    delete values.id;
    if(!values.password)delete values.password;
    try{
      await api(id?`/users/${id}`:'/users',{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)});
      notify(id?'Integrante actualizado':'Integrante registrado exitosamente');
      closeModal();
      renderMembers();
    }catch(error){notify(error.message)}
  };
  document.querySelectorAll('.edit-user').forEach(button=>button.onclick=()=>openForm(JSON.parse(decodeURIComponent(button.dataset.user))));
  document.querySelectorAll('.toggle-user').forEach(b=>b.onclick=async()=>{
    try{
      await api(`/users/${b.dataset.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({active:b.dataset.active==='0'})});
      notify('Estado del integrante modificado');
      renderMembers();
    }catch(error){notify(error.message)}
  });
  document.querySelectorAll('.delete-user').forEach(b=>b.onclick=async()=>{
    if(confirm('¿Eliminar integrante del equipo?')){
      await api(`/users/${b.dataset.id}`,{method:'DELETE'});
      notify('Integrante eliminado');
      renderMembers();
    }
  });
}
async function renderTeam(){layout(await team());document.querySelectorAll('.message-user').forEach(button=>button.onclick=()=>{location.hash=`#/${state.user.role}/messages?user=${button.dataset.id}`;renderMessages()})}
const callState={socket:null,peer:null,stream:null,remoteStream:null,peerId:null,callId:null,muted:false};
function signalSocket(){if(callState.socket?.readyState===WebSocket.OPEN)return callState.socket;const protocol=location.protocol==='https:'?'wss':'ws';callState.socket=new WebSocket(`${protocol}://${location.host}`);callState.socket.onopen=()=>callState.socket.send(JSON.stringify({type:'register',userId:state.user.id}));callState.socket.onmessage=event=>handleCallSignal(JSON.parse(event.data));return callState.socket}
function sendSignal(message){const socket=signalSocket();const send=()=>socket.send(JSON.stringify(message));if(socket.readyState===WebSocket.OPEN)send();else socket.addEventListener('open',send,{once:true})}
async function startCall(peerId,video){try{callState.peerId=Number(peerId);const call=await api('/calls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({receiver_id:callState.peerId,call_type:video?'video':'audio'})});callState.callId=call.id;callState.stream=await navigator.mediaDevices.getUserMedia({audio:true,video});callState.peer=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});callState.remoteStream=new MediaStream();document.querySelector('#call-remote').srcObject=callState.remoteStream;document.querySelector('#call-local').srcObject=callState.stream;callState.stream.getTracks().forEach(track=>callState.peer.addTrack(track,callState.stream));callState.peer.ontrack=event=>event.streams[0].getTracks().forEach(track=>callState.remoteStream.addTrack(track));callState.peer.onicecandidate=event=>event.candidate&&sendSignal({type:'ice',to:callState.peerId,candidate:event.candidate});document.querySelector('#call-modal').hidden=false;const offer=await callState.peer.createOffer();await callState.peer.setLocalDescription(offer);sendSignal({type:'offer',to:callState.peerId,offer,video,callId:callState.callId})}catch(error){notify('No fue posible iniciar la llamada. Revisa los permisos de cámara y micrófono.');endCall()}}
async function handleCallSignal(message){if(message.type==='offer'){if(callState.peer)endCall();callState.peerId=message.from;callState.callId=message.callId;callState.stream=await navigator.mediaDevices.getUserMedia({audio:true,video:message.video});callState.peer=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});callState.remoteStream=new MediaStream();document.querySelector('#call-remote').srcObject=callState.remoteStream;document.querySelector('#call-local').srcObject=callState.stream;callState.stream.getTracks().forEach(track=>callState.peer.addTrack(track,callState.stream));callState.peer.ontrack=event=>event.streams[0].getTracks().forEach(track=>callState.remoteStream.addTrack(track));callState.peer.onicecandidate=event=>event.candidate&&sendSignal({type:'ice',to:callState.peerId,candidate:event.candidate});await callState.peer.setRemoteDescription(message.offer);const answer=await callState.peer.createAnswer();await callState.peer.setLocalDescription(answer);document.querySelector('#call-modal').hidden=false;await api(`/calls/${callState.callId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'answered'})});sendSignal({type:'answer',to:callState.peerId,answer})}else if(message.type==='answer'&&callState.peer){await callState.peer.setRemoteDescription(message.answer);if(callState.callId)await api(`/calls/${callState.callId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'answered'})})}else if(message.type==='ice'&&callState.peer)await callState.peer.addIceCandidate(message.candidate)}
function toggleMute(){callState.muted=!callState.muted;callState.stream?.getAudioTracks().forEach(track=>{track.enabled=!callState.muted});const button=document.querySelector('#mute-call');if(button){const label=callState.muted?'Activar micrófono':'Silenciar micrófono';button.innerHTML=`${icon(callState.muted?'micOff':'mic')}<span>${label}</span>`;}}
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
  const list = (users || []).filter(u => u && Number(u.id) !== Number(state.user?.id)).slice(0, 15);
  const others = list.map(u => {
    const rawName = (u.name || u.username || 'Usuario').trim();
    const displayName = rawName.split(/\s+/)[0] || rawName;
    return `<button type="button" class="status-item" data-status-user="${u.id}" data-status-name="${esc(rawName)}"><span class="status-ring no-status"><span class="status-avatar">${avatarMarkup(u,'message-avatar')}</span></span><small title="${esc(rawName)}">${esc(displayName)}</small></button>`;
  }).join('');
  return `<div class="status-strip"><button type="button" class="status-item my-status" id="open-my-status"><span class="status-ring ${mine?'has-status':'no-status'}"><span class="status-avatar">${avatarMarkup(state.user,'message-avatar')}</span>${mine?'':'<span class="status-add">+</span>'}</span><small>Mi estado</small></button>${others}</div>`;
}
function statusViewerMarkup(name, data){
  return `<div class="status-overlay" id="status-overlay" role="dialog" aria-modal="true"><div class="status-viewer"><div class="status-viewer-head"><strong>${esc(name)}</strong><button class="icon-btn" id="close-status-viewer" aria-label="Cerrar">${icon('close')}</button></div><div class="status-viewer-body">${data.image?`<img src="${esc(data.image)}" alt="Estado de ${esc(name)}">`:''}${data.content?`<p>${esc(data.content)}</p>`:''}${!data.image&&!data.content?'<p class="muted">Sin contenido.</p>':''}</div><small class="muted status-viewer-time">${new Date(data.createdAt).toLocaleString('es')}</small></div></div>`;
}
function myStatusEditorMarkup(existing){
  return `<div class="status-overlay" id="status-overlay" role="dialog" aria-modal="true"><div class="status-viewer status-editor"><div class="status-viewer-head"><strong>Mi estado</strong><button class="icon-btn" id="close-status-viewer" aria-label="Cerrar">${icon('close')}</button></div>${existing?`<div class="status-viewer-body">${existing.image?`<img src="${esc(existing.image)}" alt="Mi estado">`:''}${existing.content?`<p>${esc(existing.content)}</p>`:''}</div><small class="muted status-viewer-time">Publicado ${new Date(existing.createdAt).toLocaleString('es')}</small><div class="actions mt-3"><button class="btn danger" id="delete-my-status">Eliminar estado</button></div>`:`<form id="status-form" class="form-grid"><label class="full">Texto<textarea class="textarea" name="content" rows="3" placeholder="¿Qué estás pensando?"></textarea></label><label class="full">Imagen (opcional)<input class="input" type="file" name="image" accept="image/png,image/jpeg,image/webp"></label><div class="actions full"><button class="btn">Publicar estado</button></div></form>`}</div></div>`;
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
          return `<div class="day-divider"><span>${esc(entry.divider)}</span></div>`;
        }
        const message=entry.message;
        const isMine = message.sender_id === state.user.id;
        const hasText = message.content && message.content.trim() && message.content.trim() !== ',';
        return `<div class="message ${isMine ? 'mine' : ''}"><div class="message-bubble">${message.sender_photo || message.sender_name ? `<div class="message-meta"><span class="message-avatar-wrap">${avatarMarkup({name:message.sender_name,profile_photo:message.sender_photo},'message-avatar')}</span><strong>${esc(message.sender_name || 'Usuario')}</strong></div>` : ''}${hasText ? `<p>${esc(message.content)}</p>` : (message.attachment_id ? '' : '<p>Archivo adjunto</p>')}${message.attachment_id ? `<a class="message-attachment" href="/api/files/${message.attachment_id}/download">${icon('file')}<span>${esc(message.attachment_name || 'Archivo adjunto')}</span></a>` : ''}<small>${timeShort(message.created_at)}</small></div></div>`;
      }).join('')
    : '<div class="empty">No hay mensajes en esta conversación.</div>';

  return `
    <section class="messages-shell">
      ${statusStripMarkup(users)}
      <div class="messages-layout">
        <aside class="conversation-list">
          <div class="conversation-list-header">
            <h2>Mensajes</h2>
            <button class="btn secondary mini" id="new-group" type="button">${icon('plus')}Grupo</button>
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
              <button class="icon-btn" id="toggle-chat-bg" type="button" title="Cambiar fondo del chat" aria-label="Cambiar fondo del chat">${icon('roller')}</button>
              <button class="icon-btn ${isConvMuted(conversationKey)?'is-active':''}" id="mute-conversation" type="button" title="${isConvMuted(conversationKey)?'Activar notificaciones':'Silenciar conversación'}" aria-label="Silenciar conversación">${icon(isConvMuted(conversationKey)?'bellOff':'bell')}</button>
              <button class="icon-btn danger ${isConvBlocked(conversationKey)?'is-active':''}" id="block-conversation" type="button" title="${isConvBlocked(conversationKey)?'Desbloquear conversación':'Bloquear conversación'}" aria-label="Bloquear conversación">${icon('block')}</button>
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
            <div class="chat-attachment-preview" id="chat-attachment-preview" hidden>
              <span class="chat-attachment-icon">${icon('check')}</span>
              <div class="chat-attachment-info"><strong id="chat-attachment-name"></strong><small>Archivo listo para enviar</small></div>
              <button type="button" class="icon-btn" id="chat-attachment-remove" title="Quitar archivo" aria-label="Quitar archivo">${icon('close')}</button>
            </div>
            <div class="message-form-row">
              <label class="chat-file-picker" id="chat-file-picker" title="Adjuntar archivo" aria-label="Adjuntar archivo">
                ${icon('paperclip')}
                <input type="file" name="file" class="file-input" hidden>
              </label>
              <textarea class="textarea" name="content" rows="1" placeholder="Escribe un mensaje..."></textarea>
              <button class="send-btn" type="submit" aria-label="Enviar">${icon('arrowUp')}</button>
            </div>
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
  const filePicker=document.querySelector('#chat-file-picker');
  const fileInput=document.querySelector('.message-form .file-input');
  const attachmentPreview=document.querySelector('#chat-attachment-preview');
  const attachmentName=document.querySelector('#chat-attachment-name');
  function updateAttachmentPreview(){
    const file=fileInput?.files[0];
    filePicker?.classList.toggle('is-active',!!file);
    if(filePicker)filePicker.title=file?`Archivo seleccionado: ${file.name}`:'Adjuntar archivo';
    if(attachmentPreview)attachmentPreview.hidden=!file;
    if(attachmentName&&file)attachmentName.textContent=file.name;
  }
  fileInput?.addEventListener('change',updateAttachmentPreview);
  document.querySelector('#chat-attachment-remove')?.addEventListener('click',()=>{
    if(fileInput)fileInput.value='';
    updateAttachmentPreview();
  });
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
      formData.set('content',content);
    } else {
      formData.append('user_id',selectedId||'');
      formData.set('content',content);
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
renderMessages=async function(){await renderMessagesLegacy();const callHead=document.querySelector('.call-head');if(callHead&&!document.querySelector('#mute-call'))callHead.insertAdjacentHTML('beforeend','<button class="btn secondary btn-with-icon" id="mute-call">'+icon('mic')+'<span>Silenciar micrófono</span></button>');document.querySelector('#mute-call')?.addEventListener('click',toggleMute);const calls=await api('/calls').catch(()=>[]);if(calls.length&&!document.querySelector('.missed-calls')){const node=document.createElement('section');node.className='missed-calls';node.innerHTML=`<h2>Llamadas perdidas</h2>${calls.map(call=>`<div class="missed-call">${avatarMarkup({name:call.caller_name,profile_photo:call.caller_photo},'message-avatar')}<span><strong>${esc(call.caller_name)}</strong><small>${call.call_type==='video'?'Videollamada':'Llamada'} · ${new Date(call.created_at).toLocaleString('es')}</small></span></div>`).join('')}`;document.querySelector('.conversation-list')?.prepend(node)}}
const RELAX_SOURCES=[['spotify','Spotify'],['youtube','YouTube'],['soundcloud','SoundCloud']];
let relaxSource='spotify';
function sourceLabel(key){return RELAX_SOURCES.find(([value])=>value===key)?.[1]||key}
function trackImage(track){return track.artwork_url||track.artworkUrl||track.image||track.thumbnail||track.cover||track.cover_url||track.coverUrl||track.album?.images?.[0]?.url||track.album_art||track.thumbnails?.high?.url||track.thumbnails?.default?.url||''}
async function relax(){return `${`<section class="relax-hero"><div class="relax-hero-text"><div class="eyebrow"><img class="brand-logo-inline" src="/static/img/ht.png" alt="Haitani"></div><h1>Relax 梵天</h1><p class="muted">Encuentra tu playlist de enfoque y reprodúcela sin salir del panel.</p></div></section>`}<section class="card relax-search"><form id="music-search" class="relax-search-form"><div class="relax-search-input"><span class="relax-search-icon">${icon('search')}</span><input class="input" name="q" placeholder="Busca una canción, artista o álbum" required></div><div class="source-pills" role="radiogroup" aria-label="Fuente de música">${RELAX_SOURCES.map(([value,label])=>`<button type="button" class="source-pill ${relaxSource===value?'active':''}" data-source="${value}">${label}</button>`).join('')}</div><input type="hidden" name="source" value="${relaxSource}"><button class="btn relax-search-btn">${icon('search')}Buscar</button></form></section><section id="music-results" class="music-results empty"><div class="relax-empty"><div class="relax-empty-icon">${icon('music')}</div><p>Busca una canción para comenzar a relajarte.</p></div></section><section class="card music-player" id="music-player" hidden><div class="music-player-art" id="music-art">${icon('music')}</div><div class="music-player-info"><span class="music-player-eq"><i></i><i></i><i></i><i></i></span><div><strong id="music-title">Selecciona una pista</strong><small id="music-artist" class="muted"></small></div></div><audio id="music-audio" controls preload="none"></audio><a id="music-link" class="btn secondary" target="_blank" rel="noopener">${icon('external')}Abrir servicio</a></section>`}
function musicUrl(track){return track.preview_url||track.previewUrl||track.audio||track.stream_url||track.streamUrl||track.permalink_url||track.permalinkUrl||track.embed_url||track.embedUrl||track.link||track.uri||track.url||track.external_url||track.externalUrl}
function musicEmbed(url){const value=String(url||'');const youtube=value.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^?&/]+)/);if(youtube)return `https://www.youtube.com/embed/${youtube[1]}?autoplay=1`;const spotify=value.match(/open\.spotify\.com\/(track|album|playlist)\/([^?&/]+)/);if(spotify)return `https://open.spotify.com/embed/${spotify[1]}/${spotify[2]}?utm_source=generator`;if(value.includes('soundcloud.com/'))return `https://w.soundcloud.com/player/?url=${encodeURIComponent(value)}&color=%237D9B9F&auto_play=true&hide_related=true&show_comments=false&show_user=true&show_reposts=false&visual=false&show_artwork=true`;return ''}
function loadSoundCloudWidget(){return new Promise(resolve=>{if(window.SC?.Widget){resolve();return}const script=document.createElement('script');script.src='https://w.soundcloud.com/player/api.js';script.onload=resolve;script.onerror=resolve;document.head.append(script)})}
async function playSoundCloud(frame,fallbackUrl){await loadSoundCloudWidget();if(!window.SC?.Widget)return;const widget=window.SC.Widget(frame);widget.bind(window.SC.Widget.Events.READY,()=>widget.play());widget.bind(window.SC.Widget.Events.ERROR,()=>notify('SoundCloud no puede reproducir esta pista (restringida o no disponible). Prueba otra, o ábrela directo en SoundCloud.'))}
async function renderRelax(){layout(await relax());const form=document.querySelector('#music-search');document.querySelectorAll('.source-pill').forEach(pill=>pill.onclick=()=>{relaxSource=pill.dataset.source;form.elements.source.value=relaxSource;document.querySelectorAll('.source-pill').forEach(p=>p.classList.toggle('active',p===pill))});form.onsubmit=async event=>{event.preventDefault();const values=Object.fromEntries(new FormData(event.target));const results=document.querySelector('#music-results');results.className='music-results empty';results.innerHTML=`<div class="relax-empty"><div class="relax-empty-icon">${icon('music')}</div><p>Buscando...</p></div>`;try{const data=await api(`/music/search?q=${encodeURIComponent(values.q)}&source=${encodeURIComponent(values.source)}`);if(!data.configured){results.innerHTML=`<div class="relax-empty"><div class="relax-empty-icon">${icon('block')}</div><p>MusicAPI no está configurada en el servidor.</p></div>`;return}if(!data.tracks.length){results.innerHTML=`<div class="relax-empty"><div class="relax-empty-icon">${icon('search')}</div><p>No encontramos pistas.</p></div>`;return}results.className='music-results';results.innerHTML=data.tracks.map((track,index)=>{const title=track.title||track.name||'Pista sin título';const artist=track.artist?.name||track.artist||track.artistNames?.join(', ')||track.artists?.[0]?.name||'Artista desconocido';const url=musicUrl(track);const img=trackImage(track);return `<article class="music-track" data-index="${index}"><div class="music-track-cover" style="${img?`background-image:url('${esc(img)}')`:''}">${img?'':icon('music')}</div><div class="music-track-info"><strong>${esc(title)}</strong><small class="muted">${esc(artist)}</small><span class="badge music-track-source">${esc(sourceLabel(values.source))}</span></div><button class="btn play-track" data-index="${index}" ${url?'':'disabled'}>${icon('play')}${url?'Reproducir':'Sin preview'}</button></article>`}).join('');results.querySelectorAll('.play-track').forEach(button=>button.onclick=async()=>{document.querySelectorAll('.music-track').forEach(node=>node.classList.toggle('is-playing',node.dataset.index===button.dataset.index));const track=data.tracks[Number(button.dataset.index)];const url=musicUrl(track);const embed=musicEmbed(url);const player=document.querySelector('#music-player');const audio=document.querySelector('#music-audio');const title=track.title||track.name||'Pista';const artist=track.artist?.name||track.artist||track.artistNames?.join(', ')||'';const img=trackImage(track);document.querySelector('#music-title').textContent=title;document.querySelector('#music-artist').textContent=artist;document.querySelector('#music-link').href=url||'#';const art=document.querySelector('#music-art');if(img){art.style.backgroundImage=`url('${img}')`;art.textContent=''}else{art.style.backgroundImage='';art.innerHTML=icon('music')}player.classList.add('is-playing');if(embed){audio.hidden=true;let frame=document.querySelector('#music-embed');if(!frame){frame=document.createElement('iframe');frame.id='music-embed';frame.className='music-embed';frame.allow='autoplay; encrypted-media; clipboard-write';frame.referrerPolicy='strict-origin-when-cross-origin';audio.after(frame)}frame.src=embed;frame.hidden=false;if(embed.includes('soundcloud.com/player'))playSoundCloud(frame,url)}else if(track.previewUrl||track.preview_url||track.audio){document.querySelector('#music-embed')?.remove();audio.hidden=false;audio.src=track.previewUrl||track.preview_url||track.audio;audio.play().catch(()=>notify('Pulsa reproducir para iniciar el audio.'))}else{audio.hidden=true;document.querySelector('#music-embed')?.remove();player.classList.remove('is-playing');notify('Este servicio no entrega preview de audio. Usa el reproductor embebido o abre el servicio.')}player.hidden=false})}catch(error){results.innerHTML=`<div class="relax-empty"><div class="relax-empty-icon">${icon('block')}</div><p>${esc(error.message)}</p></div>`}}}
async function assistant(){return `${heading('Asistente IA','Controla el proyecto con preguntas sobre tareas, responsables y fechas.')}<section class="assistant-shell"><div class="assistant-intro"><div><span class="assistant-kicker">Sanzu / Sakura Coffee</span><h2>Tu copiloto de operaciones</h2><p>Consulta el estado del proyecto y recibe respuestas basadas en la información actual del panel.</p></div><span class="assistant-status"><i></i>Conectado al panel</span></div><div class="assistant-suggestions"><button type="button" class="btn secondary assistant-suggestion">¿Qué tareas están vencidas?</button><button type="button" class="btn secondary assistant-suggestion">¿Cuál es el progreso del proyecto?</button><button type="button" class="btn secondary assistant-suggestion">Dame un resumen para la reunión</button></div><div class="assistant-messages" id="assistant-messages"><article class="assistant-message assistant-bot"><span class="assistant-avatar">S</span><div><strong>Sanzu</strong><p>Hola, ${esc(state.user.name)}. Puedo ayudarte a detectar riesgos y preparar el siguiente paso del proyecto.</p><small>Listo para consultar Sakura Coffee</small></div></article></div><form class="assistant-form" id="assistant-form"><textarea class="textarea" name="message" rows="2" placeholder="Pregunta por el progreso, tareas vencidas o próximos pasos..." required></textarea><button type="submit" class="btn assistant-send" aria-label="Enviar pregunta">${icon('send')} Enviar</button></form></section>`}
async function renderAssistant(){layout(await assistant());const messages=document.querySelector('#assistant-messages');const form=document.querySelector('#assistant-form');const sendBtn=form?.querySelector('.assistant-send');const textarea=form?.querySelector('textarea[name="message"]');const suggestionButtons=document.querySelectorAll('.assistant-suggestion');let isAsking=false;const setBusy=busy=>{isAsking=busy;if(sendBtn)sendBtn.disabled=busy;if(textarea)textarea.disabled=busy;suggestionButtons.forEach(btn=>btn.disabled=busy)};const ask=async rawMessage=>{const message=String(rawMessage||'').trim();if(!message||isAsking)return;setBusy(true);messages?.insertAdjacentHTML('beforeend',`<article class="assistant-message assistant-user"><span class="assistant-avatar">${esc(state.user?.name?.[0]||'U')}</span><div><strong>Tú</strong><p>${esc(message)}</p></div></article>`);if(form)form.reset();messages?.insertAdjacentHTML('beforeend','<div class="assistant-loading" id="assistant-loading">Sanzu está analizando el proyecto...</div>');if(messages)messages.scrollTop=messages.scrollHeight;try{const result=await api('/assistant/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message})});document.querySelector('#assistant-loading')?.remove();const sourceLabel=result.source==='sanzu'?'IA remota':'Modo local';const warningText=result.warning?esc(result.warning):'Contexto actualizado desde el proyecto';messages?.insertAdjacentHTML('beforeend',`<article class="assistant-message assistant-bot"><span class="assistant-avatar">S</span><div><strong>Sanzu <small class="assistant-source">${sourceLabel}</small></strong><p>${esc(result.answer)}</p><small>${warningText}</small></div></article>`);if(messages)messages.scrollTop=messages.scrollHeight}catch(error){document.querySelector('#assistant-loading')?.remove();const errorMsg=error.message||'No fue posible obtener respuesta del asistente.';messages?.insertAdjacentHTML('beforeend',`<article class="assistant-message assistant-bot"><span class="assistant-avatar" style="background:#ef4444;color:#fff">!</span><div><strong style="color:#ef4444">Sanzu</strong><p style="border-color:#ef4444;color:#ef4444">${esc(errorMsg)}</p><small>Error al consultar. Puedes volver a intentarlo.</small></div></article>`);if(messages)messages.scrollTop=messages.scrollHeight;notify(errorMsg)}finally{setBusy(false);if(textarea)textarea.focus()}};if(form){form.onsubmit=event=>{event.preventDefault();const msg=textarea?textarea.value:'';if(msg.trim())ask(msg)}};if(textarea){textarea.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(form){form.requestSubmit?form.requestSubmit():form.dispatchEvent(new Event('submit',{cancelable:true}))}}})};suggestionButtons.forEach(button=>{button.onclick=e=>{e.preventDefault();const q=button.textContent.trim();if(q)ask(q)}})}
async function settings(){
  return `
    ${heading('Configuración & Integraciones', 'Configura las conexiones externas con Sanzu IA y repositorios de GitHub.')}
    
    <section class="card mb-4" id="sanzu-config-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-3);flex-wrap:wrap;gap:var(--sp-2)">
        <div style="display:flex;align-items:center;gap:var(--sp-2)">
          ${icon('sparkles')}
          <div>
            <h2 style="margin:0">Conexión con Sanzu IA (API Key)</h2>
            <p class="muted sub" style="margin:0">El administrador añade manualmente la Sanzu API Key para conectar con Sanzu y habilitar la sincronización y el asistente IA.</p>
          </div>
        </div>
        <span class="badge yellow" id="sanzu-status-badge">Consultando estado...</span>
      </div>
      <form id="sanzu-settings-form" class="form-grid">
        <label class="full">
          Sanzu API Key (Añadir manualmente) *
          <input class="input" type="password" name="sanzu_api_key" id="sanzu-api-key-input" placeholder="Introduce tu clave API de Sanzu (ej: snz_live_...)" autocomplete="off">
          <small class="muted" id="sanzu-key-hint">Cargando...</small>
        </label>
        <label>
          URL del Servicio Sanzu
          <input class="input" name="sanzu_api_url" id="sanzu-api-url-input" value="https://sanzu.onrender.com" required>
        </label>
        <label>
          ID de Proyecto Sanzu (Opcional)
          <input class="input" name="sanzu_project_id" id="sanzu-project-id-input" placeholder="Referencia externa o ID de proyecto">
        </label>
        <div class="actions full" style="display:flex;gap:var(--sp-2);flex-wrap:wrap">
          <button type="submit" class="btn" id="sanzu-save-btn">${icon('check')} Guardar y Conectar Sanzu</button>
          <button type="button" class="btn secondary" id="sanzu-test-btn">${icon('activity')} Probar Conexión</button>
        </div>
      </form>
    </section>

    <section class="card">
      <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-3)">
        ${icon('github')}
        <div>
          <h2 style="margin:0">Configuración de GitHub</h2>
          <p class="muted sub" style="margin:0">El token solo vive en memoria del servidor y nunca se devuelve al navegador.</p>
        </div>
      </div>
      <form id="github-settings" class="form-grid">
        <label>URL del repositorio<input class="input" name="url" placeholder="https://github.com/owner/repository" required></label>
        <label>Owner<input class="input" name="owner" required></label>
        <label>Repository<input class="input" name="repo" placeholder="CoffeeKorea" required></label>
        <label>Token de GitHub<input class="input" name="token" type="password" required></label>
        <div class="actions full"><button class="btn">${icon('check')} Guardar y probar conexión</button></div>
      </form>
    </section>
  `;
}

async function renderSettings(){
  layout(await settings());

  try {
    const sanzuStatus = await api('/sanzu/status');
    const keyHint = document.querySelector('#sanzu-key-hint');
    const statusBadge = document.querySelector('#sanzu-status-badge');
    const urlInput = document.querySelector('#sanzu-api-url-input');
    const projIdInput = document.querySelector('#sanzu-project-id-input');
    if (urlInput && sanzuStatus.sanzu_api_url) urlInput.value = sanzuStatus.sanzu_api_url;
    if (projIdInput && sanzuStatus.sanzu_project_id) projIdInput.value = sanzuStatus.sanzu_project_id;
    if (sanzuStatus.configured) {
      if (keyHint) keyHint.innerHTML = `Clave configurada: <code>${esc(sanzuStatus.masked_key)}</code> (ingresa una nueva solo para reemplazarla)`;
      if (statusBadge) {
        statusBadge.className = sanzuStatus.connected ? 'badge green' : 'badge yellow';
        statusBadge.textContent = sanzuStatus.connected ? 'Conectado a Sanzu' : 'Clave guardada (no verificada)';
      }
    } else {
      if (keyHint) keyHint.textContent = 'Sin clave configurada. Añade manualmente tu Sanzu API Key arriba para conectarte.';
      if (statusBadge) {
        statusBadge.className = 'badge pink';
        statusBadge.textContent = 'API Key no añadida';
      }
    }
  } catch (err) {
    console.warn('Error al consultar estado de Sanzu:', err.message);
  }

  document.querySelector('#sanzu-settings-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.querySelector('#sanzu-save-btn');
    btn.disabled = true;
    btn.innerHTML = `${icon('progress')} Guardando y conectando...`;
    const values = Object.fromEntries(new FormData(e.target));
    try {
      const res = await api('/sanzu/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      notify(res.message);
      renderSettings();
    } catch (err) {
      notify('Error al guardar Sanzu API Key: ' + err.message);
      btn.disabled = false;
      btn.innerHTML = `${icon('check')} Guardar y Conectar Sanzu`;
    }
  });

  document.querySelector('#sanzu-test-btn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.innerHTML = `${icon('progress')} Probando...`;
    try {
      const res = await api('/sanzu/test', { method: 'POST' });
      notify(res.message || 'Conexión con Sanzu exitosa');
      renderSettings();
    } catch (err) {
      notify('Error al probar conexión con Sanzu: ' + err.message);
      btn.disabled = false;
      btn.innerHTML = `${icon('activity')} Probar Conexión`;
    }
  });

  const projects = await api('/projects').catch(() => []);
  const form = document.querySelector('#github-settings');
  if (form && projects.length) {
    form.insertAdjacentHTML('afterbegin', `<label>Proyecto<select class="select" name="project_id" required>${projects.map(project => `<option value="${project.id}" ${String(project.id) === localStorage.getItem('haitani-github-project') ? 'selected' : ''}>${esc(project.name)}</option>`).join('')}</select></label>`);
  }
  form?.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const values = Object.fromEntries(new FormData(e.target));
      if (values.project_id) localStorage.setItem('haitani-github-project', values.project_id);
      await api('/github/configure', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      await api('/github/test');
      notify('Conexión con GitHub establecida correctamente.');
    } catch (error) {
      notify(error.message);
    }
  });
}
async function billing(){const [status,plans]=await Promise.all([api('/billing/status'),api('/plans')]);const money=plan=>plan.price_cents?`${(plan.price_cents/100).toLocaleString('es-MX',{style:'currency',currency:plan.currency})} / mes`:'Gratis';return `${heading('Facturación','Administra el plan y el estado de la suscripción.')}<section class="card"><div class="grid stats"><div><div class="muted">Plan actual</div><h2>${esc(status.plan_name)}</h2></div><div><div class="muted">Estado</div><h2>${esc(status.subscription_status)}</h2></div><div><div class="muted">Próximo periodo</div><h2>${status.current_period_end?new Date(status.current_period_end).toLocaleDateString('es-MX'):'No definido'}</h2></div></div></section><section class="grid two mt-4">${plans.map(plan=>`<article class="card plan-card${plan.key===status.plan_key?' current':''}"><div class="eyebrow">${esc(plan.key)}</div><h2>${esc(plan.name)}</h2><p class="num">${money(plan)}</p><p class="muted">${plan.max_users??'Ilimitados'} usuarios · ${plan.max_projects??'Ilimitados'} proyectos · ${plan.max_storage_mb} MB</p><button class="btn billing-plan" data-plan="${esc(plan.key)}">${plan.key===status.plan_key?'Plan actual':'Elegir plan'}</button></article>`).join('')}</section>`}
async function renderBilling(){layout(await billing());document.querySelectorAll('.billing-plan').forEach(button=>button.onclick=async()=>{const planKey=String(button.dataset.plan||'').trim().toLowerCase();if(!planKey)return notify('El plan seleccionado no es válido.');button.disabled=true;try{const result=await api('/billing/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan_key:planKey})});if(result.redirect)window.location.href=result.redirect;else{notify('Plan actualizado');renderBilling()}}catch(error){button.disabled=false;notify(error.message)}})}
async function enhanceConversation(){const conversation=document.querySelector('.conversation');if(!conversation||conversation.dataset.enhanced)return;conversation.dataset.enhanced='true';const selectedId=new URLSearchParams(location.hash.split('?')[1]||'').get('user');if(!selectedId)return;const key=`${Math.min(state.user.id,Number(selectedId))}-${Math.max(state.user.id,Number(selectedId))}`;const tools=conversation.querySelector('.conversation-tools');tools?.insertAdjacentHTML('beforeend',`<div class="icon-group conversation-actions"><button class="icon-btn" id="archive-conversation" title="Archivar" aria-label="Archivar">${icon('archive')}</button><button class="icon-btn" id="schedule-call" title="Programar llamada" aria-label="Programar llamada">${icon('clock')}</button><button class="icon-btn danger" id="delete-conversation" title="Borrar conversación" aria-label="Borrar conversación">${icon('trash')}</button></div>`);const messages=await api(`/messages?user_id=${selectedId}`).catch(()=>[]);document.querySelectorAll('.message.mine small').forEach((node,index)=>{const message=messages.filter(item=>item.sender_id===state.user.id)[index];if(message)node.textContent=`${node.textContent} · ${message.delivery_status==='leido'?'✓✓ leído':message.delivery_status==='entregado'?'✓✓ entregado':'✓ enviado'}`});document.querySelector('#archive-conversation').onclick=()=>{localStorage.setItem(`haitani-archived-${key}`,'1');notify('Conversación archivada')};document.querySelector('#delete-conversation').onclick=async()=>{if(confirm('¿Borrar toda esta conversación?')){await api(`/messages/conversation/${selectedId}`,{method:'DELETE'});renderMessages()}};document.querySelector('#schedule-call').onclick=async()=>{const date=prompt('Fecha y hora de la llamada (YYYY-MM-DDTHH:mm):');if(!date)return;try{await api('/calls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({receiver_id:selectedId,call_type:'audio',scheduled_at:date})});notify('Llamada programada');}catch(error){notify(error.message)}}}
const conversationObserver=new MutationObserver(()=>enhanceConversation());conversationObserver.observe(app,{childList:true,subtree:true});
async function landingView() {
  let plans = [];
  try { plans = await api('/plans'); } catch {}
  if (!plans.length) {
    plans = [
      { key: 'free', name: 'Starter', price_cents: 0, currency: 'MXN', max_users: 5, max_projects: 3, max_storage_mb: 500 },
      { key: 'pro', name: 'Professional', price_cents: 29900, currency: 'MXN', max_users: 25, max_projects: 50, max_storage_mb: 10000 },
      { key: 'enterprise', name: 'Enterprise', price_cents: 89900, currency: 'MXN', max_users: null, max_projects: null, max_storage_mb: 50000 }
    ];
  }

  const money = plan => plan.price_cents ? `${(plan.price_cents / 100).toLocaleString('es-MX', { style: 'currency', currency: plan.currency || 'MXN' })} <small>/ mes</small>` : 'Gratis <small>/ para siempre</small>';

  app.innerHTML = `
    <div class="landing-page">
      <div class="landing-bg-glow"></div>
      <div class="landing-bg-glow-bottom"></div>

      <!-- Navigation -->
      <header class="landing-nav">
        <div class="landing-container landing-nav-inner">
          <a href="#/" class="landing-brand" aria-label="Haitani">${brandLogo()}</a>
          <ul class="landing-links">
            <li><a class="landing-link" href="#features">Características</a></li>
            <li><a class="landing-link" href="#methodologies">Metodologías</a></li>
            <li><a class="landing-link" href="#sanzu">Copiloto IA</a></li>
            <li><a class="landing-link" href="#pricing">Planes</a></li>
            <li><a class="landing-link" href="#faq">Preguntas</a></li>
          </ul>
          <div class="landing-nav-actions">
            ${themeToggle()}
            <a href="#/login" class="btn secondary landing-auth-desktop">Iniciar sesión</a>
            <a href="#/register" class="btn landing-auth-desktop">Empezar gratis</a>
            <button type="button" class="landing-menu-toggle" id="landing-menu-btn" aria-label="Abrir menú" aria-expanded="false">
              ${icon('menu')}
            </button>
          </div>
        </div>
        <div class="landing-mobile-drawer" id="landing-drawer">
          <div class="landing-mobile-drawer-inner">
            <nav class="landing-mobile-nav">
              <a class="landing-mobile-link" href="#features">Características</a>
              <a class="landing-mobile-link" href="#methodologies">Metodologías</a>
              <a class="landing-mobile-link" href="#sanzu">Copiloto IA</a>
              <a class="landing-mobile-link" href="#pricing">Planes y tarifas</a>
              <a class="landing-mobile-link" href="#faq">Preguntas frecuentes</a>
            </nav>
            <div class="landing-mobile-actions">
              <a href="#/login" class="btn secondary btn-block">Iniciar sesión</a>
              <a href="#/register" class="btn btn-block">Empezar gratis →</a>
            </div>
          </div>
        </div>
      </header>

      <!-- Hero Section -->
      <section class="landing-hero">
        <div class="landing-container">
          <div class="landing-hero-badge">
            <i></i> Plataforma de gestión y operaciones de software
          </div>
          <h1 class="landing-hero-title">
            Potencia y orden para <em>equipos de alto rendimiento</em>
          </h1>
          <p class="landing-hero-subtitle">
            Haitani unifica la planificación ágil de proyectos, trazabilidad de repositorios Git, analítica operativa, mensajería cifrada y asistencia con IA en una plataforma rápida, moderna y sin fricción.
          </p>
          <div class="landing-hero-actions">
            <a href="#/register" class="btn">Crear espacio de trabajo →</a>
            <a href="#/login" class="btn secondary">Ingresar al sistema</a>
          </div>
          <div class="landing-hero-note">
            <span>${icon('check')} Sin tarjeta de crédito</span>
            <span>${icon('shield')} Cifrado integral y control IP</span>
            <span>${icon('github')} Integración directa con GitHub</span>
          </div>

          <!-- Live Interactive Mockup Frame -->
          <div class="landing-mockup-frame">
            <div class="landing-mockup-browser-bar">
              <div class="landing-mockup-dots">
                <span></span><span></span><span></span>
              </div>
              <div class="landing-mockup-address">
                ${icon('shield')} app.haitani.io/workspace/sakura-systems
              </div>
              <div class="muted" style="font-size:11px;">v2.4 LTS</div>
            </div>
            <div class="landing-mockup-body">
              <aside class="landing-mockup-sidebar">
                <div class="brand">${brandLogo('brand-logo-sm')}</div>
                <div class="landing-mockup-sideitem active">${icon('dashboard')} Dashboard</div>
                <div class="landing-mockup-sideitem">${icon('kanban')} Tablero Kanban</div>
                <div class="landing-mockup-sideitem">${icon('gantt')} Diagrama de Gantt</div>
                <div class="landing-mockup-sideitem">${icon('sparkles')} Copiloto Sanzu</div>
                <div class="landing-mockup-sideitem">${icon('github')} Commits y PRs</div>
                <div class="landing-mockup-sideitem">${icon('messages')} Mensajes en vivo</div>
                <div class="landing-mockup-sideitem">${icon('calendar')} Inasistencias</div>
              </aside>
              <main class="landing-mockup-content">
                <div class="landing-mockup-stats">
                  <div class="landing-mockup-stat-card">
                    <div class="label">Salud del Sprint</div>
                    <div class="value">94 / 100</div>
                  </div>
                  <div class="landing-mockup-stat-card">
                    <div class="label">Tareas Activas</div>
                    <div class="value">18</div>
                  </div>
                  <div class="landing-mockup-stat-card">
                    <div class="label">Commits GitHub</div>
                    <div class="value">142 hoy</div>
                  </div>
                  <div class="landing-mockup-stat-card">
                    <div class="label">Tiempo de Entrega</div>
                    <div class="value">-3.2 días</div>
                  </div>
                </div>

                <div class="landing-mockup-board">
                  <div class="landing-mockup-col">
                    <div class="landing-mockup-col-header">
                      <span>Por hacer</span>
                      <small>3</small>
                    </div>
                    <div class="landing-mockup-card">
                      <strong>Refactor del módulo de autenticación MFA</strong>
                      <p>Implementar verificación con tokens TOTP y firmas de sesión seguras.</p>
                      <div class="landing-mockup-card-meta">
                        <span>Alta prioridad</span>
                        <span>DevOps</span>
                      </div>
                    </div>
                    <div class="landing-mockup-card">
                      <strong>Ajuste de estilos responsive en Gantt</strong>
                      <p>Adaptar la visualización del calendario en pantallas menores a 768px.</p>
                      <div class="landing-mockup-card-meta">
                        <span>Frontend</span>
                        <span>Estimado: 4h</span>
                      </div>
                    </div>
                  </div>
                  <div class="landing-mockup-col">
                    <div class="landing-mockup-col-header">
                      <span>En progreso</span>
                      <small>2</small>
                    </div>
                    <div class="landing-mockup-card">
                      <strong>Sincronización de webhooks GitHub</strong>
                      <p>Recepción en tiempo real de eventos push, tags y merges automáticos.</p>
                      <div class="landing-mockup-card-meta">
                        <span>Backend</span>
                        <span>PR #84 abierto</span>
                      </div>
                    </div>
                  </div>
                  <div class="landing-mockup-col">
                    <div class="landing-mockup-col-header">
                      <span>Completadas</span>
                      <small>8</small>
                    </div>
                    <div class="landing-mockup-card">
                      <strong>Despliegue de Sanzu AI Assistant</strong>
                      <p>Asistente contextual conectado a la base de datos de tareas y código.</p>
                      <div class="landing-mockup-card-meta">
                        <span>Producción</span>
                        <span>Cerrado</span>
                      </div>
                    </div>
                  </div>
                </div>
              </main>
            </div>
          </div>
        </div>
      </section>

      <!-- Trust Strip -->
      <section class="landing-trust-strip">
        <div class="landing-container">
          <div class="landing-trust-kicker">Diseñado para soportar estándares de ingeniería exigentes</div>
          <div class="landing-trust-items">
            <span class="landing-trust-item">Sakura Labs</span>
            <span class="landing-trust-item">Bonten Engineering</span>
            <span class="landing-trust-item">Kurokawa Cloud</span>
            <span class="landing-trust-item">Shinjuku Studio</span>
            <span class="landing-trust-item">Tokyo Techworks</span>
          </div>
        </div>
      </section>

      <!-- Pillars Section -->
      <section class="landing-section" id="features">
        <div class="landing-container">
          <div class="landing-section-header">
            <div class="landing-section-eyebrow">Capacidades del Sistema</div>
            <h2 class="landing-section-title">Todo lo que una organización técnica necesita, <em>sin el desorden</em></h2>
            <p class="landing-section-desc">Haitani reúne herramientas que usualmente requieren múltiples suscripciones dispersas en una experiencia fluida y consistente.</p>
          </div>

          <div class="landing-pillars-grid">
            <article class="landing-pillar-card">
              <div class="landing-pillar-icon">${icon('kanban')}</div>
              <h3>Tableros Kanban Dinámicos</h3>
              <p>Arrastra tareas con fluidez milimétrica, filtra por prioridad o etiquetas y visualiza el avance del equipo en tiempo real sin recargar la página.</p>
              <div class="landing-pillar-tag">Flujo Visual</div>
            </article>

            <article class="landing-pillar-card">
              <div class="landing-pillar-icon">${icon('gantt')}</div>
              <h3>Diagramas de Gantt y Cronogramas</h3>
              <p>Proyecta fechas de entrega, gestiona dependencias críticas y calendariza hitos con una línea de tiempo intuitiva diseñada al pixel.</p>
              <div class="landing-pillar-tag">Planificación Temporal</div>
            </article>

            <article class="landing-pillar-card">
              <div class="landing-pillar-icon">${icon('sparkles')}</div>
              <h3>Sanzu AI Copilot</h3>
              <p>Asistente inteligente integrado que analiza la salud del sprint, detecta cuellos de botella y responde preguntas complejas sobre el repositorio.</p>
              <div class="landing-pillar-tag">Inteligencia Asistida</div>
            </article>

            <article class="landing-pillar-card">
              <div class="landing-pillar-icon">${icon('github')}</div>
              <h3>Integración Nativa con GitHub</h3>
              <p>Vincula tus repositorios para inspeccionar commits, ramas activas, colaboradores y pull requests directamente en el contexto de tus tareas.</p>
              <div class="landing-pillar-tag">DevOps Unificado</div>
            </article>

            <article class="landing-pillar-card">
              <div class="landing-pillar-icon">${icon('messages')}</div>
              <h3>Mensajería y Llamadas</h3>
              <p>Chat corporativo con confirmaciones de lectura, estados de actividad al estilo moderno y programación de llamadas de audio uno a uno.</p>
              <div class="landing-pillar-tag">Colaboración Viva</div>
            </article>

            <article class="landing-pillar-card">
              <div class="landing-pillar-icon">${icon('shield')}</div>
              <h3>Gobernanza y Control de IP</h3>
              <p>Módulo de seguridad con bloqueo perimetral de direcciones IP, auditoría de inasistencias con evidencia adjunta y trazabilidad de accesos.</p>
              <div class="landing-pillar-tag">Seguridad y Cumplimiento</div>
            </article>
          </div>
        </div>
      </section>

      <!-- Detailed Showcase Split: GitHub Integration -->
      <section class="landing-section landing-section-alt">
        <div class="landing-container">
          <div class="landing-split">
            <div class="landing-split-copy">
              <div class="landing-section-eyebrow">Desarrollo continuo</div>
              <h3>Trazabilidad de código y entregas en un <em>mismo flujo de trabajo</em></h3>
              <p>Olvídate de alternar entre pestañas para saber qué código respalda una entrega. Haitani lee la API de GitHub de manera segura protegiendo tus credenciales en el servidor.</p>
              <ul class="landing-split-bullets">
                <li class="landing-split-bullet">
                  <span class="landing-split-bullet-icon">${icon('check')}</span>
                  <span>Historial completo de commits con identificador hash SHA y autoría verificada.</span>
                </li>
                <li class="landing-split-bullet">
                  <span class="landing-split-bullet-icon">${icon('check')}</span>
                  <span>Supervisión de ramas principales y secundarias en tiempo real.</span>
                </li>
                <li class="landing-split-bullet">
                  <span class="landing-split-bullet-icon">${icon('check')}</span>
                  <span>Detección automática de colaboradores y actividad de despliegue.</span>
                </li>
              </ul>
            </div>
            <div class="landing-split-card">
              <div class="landing-gh-header">
                <div class="landing-gh-title">
                  ${icon('github')}
                  <strong>Sakura-Coffee / Core-API</strong>
                </div>
                <span class="badge green">Conectado</span>
              </div>
              <div class="landing-gh-list">
                <div class="landing-gh-item">
                  <div>
                    <strong>feat: add automated webhook dispatcher</strong>
                    <small class="muted">carlosdc · commit 8f192b1</small>
                  </div>
                  <span class="muted time">Hace 12 min</span>
                </div>
                <div class="landing-gh-item">
                  <div>
                    <strong>fix: handle ip blocking edge cases</strong>
                    <small class="muted">carlosdc · commit c34d90a</small>
                  </div>
                  <span class="muted time">Hace 45 min</span>
                </div>
                <div class="landing-gh-item">
                  <div>
                    <strong>perf: cache dashboard stats calculation</strong>
                    <small class="muted">carlosdc · commit 7a88e21</small>
                  </div>
                  <span class="muted time">Hace 2 horas</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Methodologies Ribbon -->
      <section class="landing-methodologies" id="methodologies">
        <div class="landing-container">
          <div class="landing-section-header" style="margin-bottom:32px;">
            <div class="landing-section-eyebrow">Flexibilidad Metodológica</div>
            <h2 class="landing-section-title">Elige cómo trabaja tu organización</h2>
            <p class="landing-section-desc">Haitani adapta sus vistas, métricas y controles según la metodología de trabajo seleccionada para cada proyecto.</p>
          </div>

          <div class="landing-method-grid">
            <div class="landing-method-card">
              <strong>Scrum</strong>
              <span>Sprints regulares, estimaciones y retrospectivas estructuradas.</span>
            </div>
            <div class="landing-method-card">
              <strong>Kanban</strong>
              <span>Flujo continuo, límites de trabajo en curso (WIP) y agilidad visual.</span>
            </div>
            <div class="landing-method-card">
              <strong>Agile</strong>
              <span>Iteraciones adaptativas orientadas a la entrega rápida de valor.</span>
            </div>
            <div class="landing-method-card">
              <strong>Extreme Programming</strong>
              <span>Énfasis en calidad de código, refactorización y despliegues seguros.</span>
            </div>
            <div class="landing-method-card">
              <strong>Lean</strong>
              <span>Eliminación de desperdicio y optimización integral de la entrega.</span>
            </div>
            <div class="landing-method-card">
              <strong>Waterfall / Híbrida</strong>
              <span>Hitos lineales y diagramas de Gantt con dependencias temporales estrictas.</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Sanzu AI Feature Callout (Modern AI Cockpit) -->
      <section class="landing-section" id="sanzu">
        <div class="landing-container">
          <div class="landing-sanzu-banner">
            <div class="landing-sanzu-copy">
              <div class="landing-sanzu-pill">
                ${icon('sparkles')}
                <span>Copiloto de ingeniería</span>
              </div>
              <h3 class="landing-sanzu-headline">Conoce a Sanzu: el copiloto que <em>lee tus datos en tiempo real</em></h3>
              <p class="landing-sanzu-lead">
                A diferencia de los chats desconectados de contexto, Sanzu se conecta nativamente a tus tareas vivas, historial de Git, inasistencias y métricas del equipo para ofrecer diagnósticos certeros y accionables al instante.
              </p>
              <div class="landing-sanzu-capabilities">
                <div class="landing-sanzu-cap">
                  ${icon('tasks')}
                  <span>Análisis de riesgos y cuellos de botella</span>
                </div>
                <div class="landing-sanzu-cap">
                  ${icon('github')}
                  <span>Sincronización contextual con Git</span>
                </div>
                <div class="landing-sanzu-cap">
                  ${icon('shield')}
                  <span>Auditoría de seguridad y gobernanza</span>
                </div>
              </div>
              <div class="landing-sanzu-action-row">
                <a href="#/register" class="btn sanzu-cta">Probar Sanzu en tu equipo →</a>
                <span class="landing-sanzu-subtext">Disponible en planes Pro y Enterprise</span>
              </div>
            </div>

            <div class="landing-sanzu-window">
              <div class="sanzu-win-bar">
                <div class="sanzu-win-dots">
                  <span></span><span></span><span></span>
                </div>
                <div class="sanzu-win-title">
                  ${icon('sparkles')}
                  <span>Sanzu Intelligence v2.4</span>
                </div>
                <span class="sanzu-win-status">Activo</span>
              </div>

              <div class="sanzu-win-body">
                <div class="sanzu-msg user">
                  <div class="sanzu-avatar user-av">Tú</div>
                  <div class="sanzu-msg-bubble">
                    ¿Cuál es el estado del sprint actual y qué tareas tienen riesgo de vencerse?
                  </div>
                </div>

                <div class="sanzu-msg bot">
                  <div class="sanzu-avatar bot-av">${icon('sparkles')}</div>
                  <div class="sanzu-msg-bubble">
                    <div class="sanzu-diag-header">
                      <strong>Salud del Sprint: 94/100</strong>
                      <span class="badge green">Estable</span>
                    </div>
                    <p>He analizado las 14 tareas activas contra los últimos 8 commits en GitHub:</p>
                    <ul class="sanzu-diag-list">
                      <li><strong>Autenticación TOTP</strong>: Sin actividad de commits en 48h. Se sugiere reasignar o dividir.</li>
                      <li><strong>Migración Postgres</strong>: En curso por <em>carlosdc</em>, 85% completado.</li>
                    </ul>
                    <div class="sanzu-quick-actions">
                      <span class="sanzu-tag">Reasignar tarea</span>
                      <span class="sanzu-tag">Ver reporte completo</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Pricing Section -->
      <section class="landing-section" id="pricing">
        <div class="landing-container">
          <div class="landing-section-header">
            <div class="landing-section-eyebrow">Tarifas Transparentes</div>
            <h2 class="landing-section-title">Planes diseñados para cada <em>etapa de crecimiento</em></h2>
            <p class="landing-section-desc">Comienza sin costo y escala a medida que tu equipo y almacenamiento aumenten. Cancela o cambia de plan en cualquier momento.</p>
          </div>

          <div class="landing-pricing-grid">
            ${plans.map((plan, idx) => {
              const isFeatured = plan.key === 'pro' || idx === 1;
              return `
                <article class="landing-pricing-card ${isFeatured ? 'featured' : ''}">
                  ${isFeatured ? '<div class="landing-pricing-badge">Más elegido</div>' : ''}
                  <div class="landing-pricing-name">${esc(plan.name)}</div>
                  <div class="landing-pricing-price">${money(plan)}</div>
                  <p class="muted landing-pricing-desc">
                    ${plan.key === 'free' ? 'Ideal para profesionales independientes y equipos pequeños probando Haitani.' : plan.key === 'pro' ? 'Para empresas y agencias que necesitan sincronización continua de Git y Sanzu AI.' : 'Control avanzado, infraestructura dedicada y soporte prioritario sin límites.'}
                  </p>
                  <ul class="landing-pricing-features">
                    <li>${icon('check')} <strong>${plan.max_users ?? 'Ilimitados'}</strong> usuarios</li>
                    <li>${icon('check')} <strong>${plan.max_projects ?? 'Ilimitados'}</strong> proyectos simultáneos</li>
                    <li>${icon('check')} <strong>${plan.max_storage_mb >= 1000 ? `${(plan.max_storage_mb / 1000).toFixed(0)} GB` : `${plan.max_storage_mb} MB`}</strong> almacenamiento seguro</li>
                    <li>${icon('check')} Tableros Kanban y Gantt</li>
                    <li>${icon('check')} Mensajería cifrada y llamadas</li>
                    <li class="${plan.key === 'free' ? 'disabled' : ''}">${icon('check')} Asistente Copiloto Sanzu AI</li>
                    <li class="${plan.key === 'free' ? 'disabled' : ''}">${icon('check')} Auditoría de IPs y accesos</li>
                  </ul>
                  <a href="#/register" class="btn ${isFeatured ? '' : 'secondary'} landing-pricing-btn">
                    ${plan.price_cents === 0 ? 'Comenzar gratis' : 'Elegir plan ' + esc(plan.name)}
                  </a>
                </article>
              `;
            }).join('')}
          </div>
        </div>
      </section>

      <!-- FAQ Section -->
      <section class="landing-section landing-section-alt" id="faq">
        <div class="landing-container">
          <div class="landing-section-header">
            <div class="landing-section-eyebrow">Preguntas Frecuentes</div>
            <h2 class="landing-section-title">Respuestas directas sobre la plataforma</h2>
            <p class="landing-section-desc">Todo lo que necesitas saber antes de dar de alta tu organización en Haitani.</p>
          </div>

          <div class="landing-faq-grid">
            <div class="landing-faq-item">
              <h4>¿Cómo funciona la integración con GitHub?</h4>
              <p>Puedes conectar cualquier repositorio público o privado introduciendo tu Personal Access Token. El token nunca se expone en el navegador y se almacena en memoria segura del servidor para consultar commits, ramas y pull requests.</p>
            </div>
            <div class="landing-faq-item">
              <h4>¿Puedo gestionar inasistencias y apelaciones de mi equipo?</h4>
              <p>Sí. Los administradores pueden registrar inasistencias por fecha y materia. Los integrantes reciben avisos inmediatos y pueden subir evidencia documental (PDFs, capturas) para abrir un proceso de apelación con auditoría.</p>
            </div>
            <div class="landing-faq-item">
              <h4>¿Qué nivel de seguridad ofrece el bloqueo por IP?</h4>
              <p>Haitani inspecciona las direcciones IP de cada solicitud. Puedes bloquear IPs manualmente o por comportamiento inusual detectado en la cabecera User-Agent o peticiones erráticas.</p>
            </div>
            <div class="landing-faq-item">
              <h4>¿Cómo cambio de tema claro a oscuro?</h4>
              <p>El selector de tema visual está disponible en la barra superior tanto de la landing page como dentro de cualquier panel de trabajo, memorizando tu preferencia automáticamente.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Final Call to Action -->
      <section class="landing-section">
        <div class="landing-container">
          <div class="landing-cta-box">
            <h3>Construye software con máxima claridad</h3>
            <p>Únete a las organizaciones que han sustituido el ruido y la fragmentación por un espacio de trabajo limpio, ágil y seguro.</p>
            <div class="landing-hero-actions">
              <a href="#/register" class="btn" style="background:#ffffff;color:var(--color-ink-black);border-color:#ffffff;">Crear organización gratis →</a>
              <a href="#/login" class="btn secondary">Ya tengo una cuenta</a>
            </div>
            <small class="muted" style="color:#8c909b;">Activación inmediata. Sin descargas complejas ni tarjetas requeridas.</small>
          </div>
        </div>
      </section>

      <!-- Footer -->
      <footer class="landing-footer">
        <div class="landing-container">
          <div class="landing-footer-grid">
            <div class="landing-footer-brand">
              <a href="#/" class="landing-brand" aria-label="Haitani">${brandLogo()}</a>
              <p>Plataforma integral de gestión ágil de proyectos, seguimiento técnico con GitHub, analítica y colaboración en tiempo real.</p>
              <div style="margin-top:16px;">
                <span class="muted" style="font-size:12px;">Soporte: <strong>adminpruebassakura@gmail.com</strong></span>
              </div>
            </div>
            <div class="landing-footer-col">
              <h5>Producto</h5>
              <ul>
                <li><a href="#features">Tableros Kanban</a></li>
                <li><a href="#features">Diagramas de Gantt</a></li>
                <li><a href="#sanzu">Copiloto Sanzu AI</a></li>
                <li><a href="#features">GitHub Sync</a></li>
                <li><a href="#pricing">Planes y Tarifas</a></li>
              </ul>
            </div>
            <div class="landing-footer-col">
              <h5>Gobernanza</h5>
              <ul>
                <li><a href="#features">Control de Inasistencias</a></li>
                <li><a href="#features">Seguridad Perimetral IP</a></li>
                <li><a href="#faq">Políticas de Privacidad</a></li>
                <li><a href="#faq">Cifrado de Sesiones</a></li>
              </ul>
            </div>
            <div class="landing-footer-col">
              <h5>Acceso</h5>
              <ul>
                <li><a href="#/login">Iniciar sesión</a></li>
                <li><a href="#/register">Crear organización</a></li>
                <li><a href="#/admin/dashboard">Panel Administrativo</a></li>
                <li><a href="#/member/dashboard">Espacio Personal</a></li>
              </ul>
            </div>
          </div>

          <div class="landing-footer-bottom">
            <span>© 2026 Haitani Systems. Todos los derechos reservados.</span>
            <span>Versión 2.4 LTS · Servidor en línea</span>
          </div>
        </div>
      </footer>
    </div>
  `;

  bindTheme();

  const menuBtn = document.querySelector('#landing-menu-btn');
  const drawer = document.querySelector('#landing-drawer');
  if (menuBtn && drawer) {
    menuBtn.onclick = () => {
      const isOpen = drawer.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', String(isOpen));
    };
    drawer.querySelectorAll('a').forEach(link => {
      link.onclick = () => {
        drawer.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
      };
    });
  }
}

// ===================== Backlog del producto (SB-04, se guarda en Haitani) =====================
const BACKLOG_TYPES={USER_STORY:'Historia de usuario',BUG:'Error',TASK:'Tarea',FEATURE:'Funcionalidad',IMPROVEMENT:'Mejora'};
const BACKLOG_PRIORITIES={CRITICAL:['Crítica','pink'],HIGH:['Alta','yellow'],MEDIUM:['Media',''],LOW:['Baja','']};
const BACKLOG_STATUSES={BACKLOGGED:['Por hacer',''],READY:['Lista','yellow'],IN_PROGRESS:['En proceso','pink'],DONE:['Terminada','green']};
const BACKLOG_FLOW=['BACKLOGGED','READY','IN_PROGRESS','DONE'];
// Plantillas que ayudan a escribir cada ítem con el formato correcto
const BUG_TEMPLATE='Pasos para reproducir:\n1. \n2. \n\nResultado esperado:\n\nResultado actual:\n';
const CRITERIA_TEMPLATE='Dado que \nCuando \nEntonces ';
const STORY_PATTERN=/^Como\s+(.+?),\s*quiero\s+(.+?),\s*para\s+(.+?)\.?$/i;
let backlogFilters={type:'',status:'',priority:'',sprint:''};
let backlogData=null;
function backlogProjectId(projects){const saved=localStorage.getItem('haitani-backlog-project');return projects.some(p=>String(p.id)===saved)?saved:String(projects[0]?.id||'')}
function backlogOptions(map,selected,empty){return `<option value="">${empty}</option>`+Object.entries(map).map(([value,label])=>`<option value="${value}" ${selected===value?'selected':''}>${esc(Array.isArray(label)?label[0]:label)}</option>`).join('')}
const SPRINT_STATUS_LABELS={planificado:'Planificado',activo:'Activo',cerrado:'Cerrado'};
function sprintLabel(s){return SPRINT_STATUS_LABELS[s.status]?`${s.name} (${SPRINT_STATUS_LABELS[s.status]})`:s.name}
function storyTitle(role,want,benefit){return `Como ${role.trim()}, quiero ${want.trim()}, para ${benefit.trim()}`}
function backlogForm(sprints){
  return `
    <div class="status-overlay" id="backlog-modal" style="display:none" role="dialog" aria-modal="true">
      <div class="status-viewer admin-modal-panel">
        <div class="status-viewer-head">
          <strong id="backlog-form-title">Nuevo ítem del backlog</strong>
          <button type="button" class="icon-btn" id="close-backlog-modal" aria-label="Cerrar">${icon('close')}</button>
        </div>
        <form class="admin-modal-form" id="backlog-form">
          <input type="hidden" name="id">
          <div class="form-grid">
            <label>Tipo
              <select class="select" name="type" required>${Object.entries(BACKLOG_TYPES).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select>
            </label>
            <label>Prioridad
              <select class="select" name="priority">${Object.entries(BACKLOG_PRIORITIES).map(([v,[l]])=>`<option value="${v}" ${v==='MEDIUM'?'selected':''}>${l}</option>`).join('')}</select>
            </label>
            <div class="full" id="story-builder" style="display:grid;gap:12px">
              <label>Como… <small class="muted">(¿quién lo necesita?)</small>
                <input class="input" name="storyRole" maxlength="80" placeholder="Ej. integrante del equipo">
              </label>
              <label>quiero… <small class="muted">(¿qué quiere poder hacer?)</small>
                <input class="input" name="storyWant" maxlength="120" placeholder="Ej. ver solo las tareas de mi sprint">
              </label>
              <label>para… <small class="muted">(¿para qué le sirve?)</small>
                <input class="input" name="storyBenefit" maxlength="120" placeholder="Ej. saber qué me toca hacer esta semana">
              </label>
              <small class="muted" id="story-preview"></small>
            </div>
            <label class="full" id="title-field">Título
              <input class="input" name="title" maxlength="200" placeholder="Ej. El login tarda más de 5 segundos">
            </label>
            <label>Story points
              <input class="input" name="storyPoints" type="number" min="0" max="100" step="1" placeholder="Ej. 3">
              <span class="actions" style="gap:6px;margin-top:6px">${[1,2,3,5,8].map(n=>`<button type="button" class="btn secondary mini points-pick" data-points="${n}">${n}</button>`).join('')}</span>
              <small class="muted" id="points-hint"></small>
            </label>
            <label>Sprint
              <select class="select" name="sprintId"><option value="">Sin sprint</option>${sprints.map(s=>`<option value="${esc(s.id)}">${esc(sprintLabel(s))}</option>`).join('')}</select>
              <small class="muted">${sprints.length?'Son los sprints de la vista Sprints.':'Este proyecto no tiene sprints; créalos en la vista <a href="#/'+state.user.role+'/sprints">Sprints</a>.'}</small>
            </label>
            <label class="full">Descripción
              <textarea class="input" name="description" rows="4" placeholder="Qué se necesita y por qué"></textarea>
            </label>
            <label class="full">Criterios de aceptación <small class="muted">(cuándo se considera terminado)</small>
              <textarea class="input" name="acceptanceCriteria" rows="4" placeholder="Dado que… cuando… entonces…"></textarea>
              <span class="actions" style="margin-top:6px"><button type="button" class="btn secondary mini" id="insert-criteria">Insertar formato Dado / Cuando / Entonces</button></span>
            </label>
          </div>
          <div class="actions mt-4">
            <button class="btn" type="submit">Guardar</button>
            <button class="btn secondary" type="button" id="cancel-backlog">Cancelar</button>
          </div>
        </form>
      </div>
    </div>`;
}
async function backlogView(){
  const projects=await api('/projects');
  const intro=heading('Backlog','Lista de todo lo que falta por hacer en el producto: historias, errores, tareas y mejoras.');
  if(!projects.length)return `${intro}<section class="card"><p class="empty">Primero crea un proyecto para empezar su backlog.</p></section>`;
  const projectId=backlogProjectId(projects);
  const query=new URLSearchParams({project_id:projectId});
  Object.entries(backlogFilters).forEach(([key,value])=>{if(value)query.set(key,value)});
  let error='';
  try{backlogData=await api(`/backlog?${query}`)}catch(e){backlogData=null;error=e.message}
  const items=backlogData?.items||[];
  const sprints=backlogData?.sprints||[];
  const manage=Boolean(backlogData?.canManage);
  const sprintName=id=>sprints.find(s=>s.id===id)?.name||'—';
  const points=items.reduce((sum,item)=>sum+(item.storyPoints||0),0);
  const filtered=Object.values(backlogFilters).some(Boolean);
  const {items: pagedItems, totalPages, currentPage, totalItems} = paginateItems(items, 'backlog', 10);
  const action=manage?`<div class="actions"><button class="btn" id="new-backlog-item">${icon('plus')}Nuevo ítem</button></div>`:'';
  return `
    ${heading('Backlog','Lista de todo lo que falta por hacer en el producto: historias, errores, tareas y mejoras.',action)}
    <section class="card admin-table-card">
      <div class="task-list-toolbar">
        <div class="task-toolbar-main">
          <select id="backlog-project" class="select has-value" aria-label="Proyecto" style="max-width:360px">${projects.map(p=>`<option value="${p.id}" ${String(p.id)===projectId?'selected':''}>${esc(p.name)}</option>`).join('')}</select>
          <span class="task-count-tag">${items.length} ${items.length===1?'ítem':'ítems'} · ${points} story points</span>
        </div>
        <div class="task-toolbar-filters">
          <select id="backlog-type" class="select ${backlogFilters.type?'has-value':''}" aria-label="Filtrar por tipo">${backlogOptions(BACKLOG_TYPES,backlogFilters.type,'Todos los tipos')}</select>
          <select id="backlog-status" class="select ${backlogFilters.status?'has-value':''}" aria-label="Filtrar por estado">${backlogOptions(BACKLOG_STATUSES,backlogFilters.status,'Todos los estados')}</select>
          <select id="backlog-priority" class="select ${backlogFilters.priority?'has-value':''}" aria-label="Filtrar por prioridad">${backlogOptions(BACKLOG_PRIORITIES,backlogFilters.priority,'Todas las prioridades')}</select>
          <select id="backlog-sprint" class="select ${backlogFilters.sprint?'has-value':''}" aria-label="Filtrar por sprint"><option value="">Todos los sprints</option><option value="none" ${backlogFilters.sprint==='none'?'selected':''}>Sin sprint</option>${sprints.map(s=>`<option value="${esc(s.id)}" ${backlogFilters.sprint===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select>
          ${filtered?`<button type="button" class="task-reset-btn" id="backlog-reset">${icon('close')}<span>Limpiar</span></button>`:''}
        </div>
      </div>
      ${error?`<div class="alert">${esc(error)}</div>`:`
      <div class="table-wrap">
        <table class="table task-list-table">
          <thead><tr><th>Ítem</th><th>Prioridad</th><th style="text-align:center">Puntos</th><th>Sprint</th><th>Estado</th><th style="text-align:right">Acciones</th></tr></thead>
          <tbody>
            ${pagedItems.map(item=>{
              const [prioLabel,prioClass]=BACKLOG_PRIORITIES[item.priority]||[item.priority,''];
              const [statusLabel,statusClass]=BACKLOG_STATUSES[item.status]||[item.status,''];
              const step=BACKLOG_FLOW.indexOf(item.status);
              const next=BACKLOG_FLOW[step+1], prev=BACKLOG_FLOW[step-1];
              return `<tr>
                <td><strong class="task-title-cell">${esc(item.title)}</strong><br><small class="muted">${esc(BACKLOG_TYPES[item.type]||item.type)}</small></td>
                <td><span class="badge ${prioClass}">${esc(prioLabel)}</span></td>
                <td style="text-align:center">${item.storyPoints??'—'}</td>
                <td>${esc(item.sprintId?sprintName(item.sprintId):'Sin sprint')}</td>
                <td><span class="badge ${statusClass}">${esc(statusLabel)}</span></td>
                <td><div class="actions task-row-actions" style="justify-content:flex-end">
                  ${prev?`<button type="button" class="btn secondary mini backlog-move" data-id="${esc(item.id)}" data-status="${prev}" title="Regresar a ${esc(BACKLOG_STATUSES[prev][0])}">Regresar</button>`:''}
                  ${next?`<button type="button" class="btn mini backlog-move" data-id="${esc(item.id)}" data-status="${next}" title="Avanzar a ${esc(BACKLOG_STATUSES[next][0])}">Avanzar</button>`:''}
                  ${manage?`<button type="button" class="btn secondary mini task-icon-action backlog-edit" data-id="${esc(item.id)}" title="Editar" aria-label="Editar">${icon('edit')}</button><button type="button" class="btn danger mini task-icon-action backlog-delete" data-id="${esc(item.id)}" title="Eliminar" aria-label="Eliminar">${icon('trash')}</button>`:''}
                </div></td>
              </tr>`;
            }).join('')||`<tr><td colspan="6" class="empty">${filtered?'No hay ítems que coincidan con los filtros.':'El backlog está vacío. Agrega la primera historia.'}</td></tr>`}
          </tbody>
        </table>
        ${paginationMarkup('backlog','renderBacklog',totalPages,currentPage,totalItems,10)}
      </div>`}
    </section>
    ${manage?backlogForm(sprints):''}`;
}
async function renderBacklog(){
  layout(await backlogView());
  const projectSelect=document.querySelector('#backlog-project');
  const projectId=()=>projectSelect?.value;
  projectSelect?.addEventListener('change',()=>{localStorage.setItem('haitani-backlog-project',projectSelect.value);backlogFilters={type:'',status:'',priority:'',sprint:''};state.listPages.backlog=1;renderBacklog()});
  [['#backlog-type','type'],['#backlog-status','status'],['#backlog-priority','priority'],['#backlog-sprint','sprint']].forEach(([selector,key])=>document.querySelector(selector)?.addEventListener('change',event=>{backlogFilters[key]=event.target.value;state.listPages.backlog=1;renderBacklog()}));
  document.querySelector('#backlog-reset')?.addEventListener('click',()=>{backlogFilters={type:'',status:'',priority:'',sprint:''};state.listPages.backlog=1;renderBacklog()});
  const send=(path,method,body)=>api(path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify({project_id:projectId(),...body})});
  document.querySelectorAll('.backlog-move').forEach(button=>button.onclick=async()=>{
    button.disabled=true;
    try{await send(`/backlog/${button.dataset.id}`,'PUT',{status:button.dataset.status});notify(`Movido a ${BACKLOG_STATUSES[button.dataset.status][0]}`);renderBacklog()}catch(error){button.disabled=false;notify(error.message)}
  });
  document.querySelectorAll('.backlog-delete').forEach(button=>button.onclick=async()=>{
    if(!confirm('¿Eliminar este ítem del backlog?'))return;
    try{await api(`/backlog/${button.dataset.id}?project_id=${encodeURIComponent(projectId())}`,{method:'DELETE'});notify('Ítem eliminado');renderBacklog()}catch(error){notify(error.message)}
  });
  const modal=document.querySelector('#backlog-modal');
  const form=document.querySelector('#backlog-form');
  if(!modal||!form)return;
  const f=form.elements;
  const isStory=()=>f.type.value==='USER_STORY';
  // Muestra "Como / quiero / para" solo en historias de usuario y una vista previa del título
  const refreshStory=()=>{
    document.querySelector('#story-builder').style.display=isStory()?'grid':'none';
    document.querySelector('#title-field').style.display=isStory()?'none':'';
    const parts=[f.storyRole.value,f.storyWant.value,f.storyBenefit.value];
    document.querySelector('#story-preview').textContent=parts.every(v=>v.trim())?`Así quedará: “${storyTitle(...parts)}”`:'';
  };
  const refreshPoints=()=>{
    const value=Number(f.storyPoints.value);
    document.querySelector('#points-hint').textContent=value>5?'Es una historia grande: conviene dividirla en historias más pequeñas.':'';
  };
  // Plantilla de error: solo se pone si la descripción está vacía, para no borrar lo que ya escribieron
  const applyTypeTemplate=()=>{if(f.type.value==='BUG'&&!f.description.value.trim())f.description.value=BUG_TEMPLATE;if(f.type.value!=='BUG'&&f.description.value===BUG_TEMPLATE)f.description.value=''};
  f.type.addEventListener('change',()=>{applyTypeTemplate();refreshStory()});
  [f.storyRole,f.storyWant,f.storyBenefit].forEach(input=>input.addEventListener('input',refreshStory));
  f.storyPoints.addEventListener('input',refreshPoints);
  document.querySelectorAll('.points-pick').forEach(button=>button.onclick=()=>{f.storyPoints.value=button.dataset.points;refreshPoints()});
  document.querySelector('#insert-criteria').onclick=()=>{f.acceptanceCriteria.value=(f.acceptanceCriteria.value.trim()?f.acceptanceCriteria.value.trimEnd()+'\n\n':'')+CRITERIA_TEMPLATE;f.acceptanceCriteria.focus()};
  const close=()=>{modal.style.display='none'};
  const open=item=>{
    form.reset();
    f.id.value=item?.id||'';
    document.querySelector('#backlog-form-title').textContent=item?'Editar ítem del backlog':'Nuevo ítem del backlog';
    f.type.value=item?.type||'USER_STORY';
    if(item){
      ['title','priority','storyPoints','sprintId','description','acceptanceCriteria'].forEach(name=>{f[name].value=item[name]??''});
      const match=item.type==='USER_STORY'&&String(item.title).match(STORY_PATTERN);
      if(match){[f.storyRole.value,f.storyWant.value,f.storyBenefit.value]=match.slice(1)}
      else if(item.type==='USER_STORY'){f.type.value='USER_STORY';f.storyWant.value=item.title}
    }
    refreshStory();refreshPoints();
    modal.style.display='grid';
    (isStory()?f.storyRole:f.title).focus();
  };
  document.querySelector('#new-backlog-item')?.addEventListener('click',()=>open(null));
  document.querySelectorAll('.backlog-edit').forEach(button=>button.onclick=()=>open(backlogData.items.find(item=>item.id===button.dataset.id)));
  document.querySelector('#close-backlog-modal').onclick=close;
  document.querySelector('#cancel-backlog').onclick=close;
  form.onsubmit=async event=>{
    event.preventDefault();
    const values=Object.fromEntries(new FormData(form));
    const id=values.id;
    if(values.type==='USER_STORY'){
      if(![values.storyRole,values.storyWant,values.storyBenefit].every(v=>v&&v.trim()))return notify('Completa “Como”, “quiero” y “para”.');
      values.title=storyTitle(values.storyRole,values.storyWant,values.storyBenefit);
    }else if(!values.title.trim())return notify('Escribe un título.');
    ['id','storyRole','storyWant','storyBenefit'].forEach(key=>delete values[key]);
    values.sprintId=values.sprintId||null;
    if(values.storyPoints==='')values.storyPoints=null;
    try{
      if(id)await send(`/backlog/${id}`,'PUT',values);else await send('/backlog','POST',values);
      close();notify(id?'Ítem actualizado':'Ítem agregado al backlog');renderBacklog();
    }catch(error){notify(error.message)}
  };
}
async function render(){
  if(!state.user){
    try{
      state.user=(await api('/auth/me')).user;
    }catch{}
    if(!state.user){
      if(location.hash.includes('login')) return loginView();
      if(location.hash.includes('register')) return registerView();
      return landingView();
    }
  }
  if(location.hash === '' || location.hash === '#' || location.hash === '#/' || location.hash === '#/landing'){
    location.hash = `#/${state.user.role}/dashboard`;
    return;
  }
  await refreshNotifications();
  startNotificationPolling();
  const route=location.hash||`#/${state.user.role}/dashboard`;
  try{
    if(route.includes('overview'))return renderOverview();
    if(route.includes('knowledge'))return renderKnowledge();
    if(route.includes('risks'))return renderRisks();
    if(route.includes('announcements'))return renderAnnouncements();
    if(route.includes('absences'))return renderAbsences();
    if(route.includes('assistant'))return state.user.role==='admin'?renderAssistant():renderDashboard();
    if(route.includes('backlog'))return renderBacklog();
    if(route.includes('sprints'))return renderSprints();
    if(route.includes('kanban'))return renderKanban();
    if(route.includes('gantt'))return renderGantt();
    if(route.includes('messages'))return renderMessages();
    if(route.includes('members'))return state.user.role==='admin'?renderMembers():renderTeam();
    if(route.includes('files'))return renderFiles();
    if(route.includes('billing'))return state.user.role==='admin'?renderBilling():renderDashboard();
    if(route.includes('settings'))return renderSettings();
    if(route.includes('profile'))return renderProfile();
    if(route.includes('team-activity'))return renderGithub('activity');
    if(route.includes('github'))return renderGithub(route.includes('commits')?'commits':route.includes('branches')?'branches':route.includes('pull-requests')?'pulls':route.includes('activity')?'activity':'repository');
    if(route.includes('tasks'))return renderTasks();
    return renderDashboard();
  }catch(error){
    layout(`<div class="alert">${esc(error.message)}</div>`);
  }
}

function sprintStatusBadge(status) {
  const map = {
    planificado: ['yellow', 'Planificado'],
    activo: ['green', 'Activo'],
    cerrado: ['pink', 'Cerrado']
  };
  const [cls, label] = map[status] || ['', status];
  return `<span class="badge ${cls}">${esc(label)}</span>`;
}

async function renderSprints() {
  const route = location.hash;
  const match = route.match(/\/sprints\/(\d+)/);
  if (match) {
    return renderSprintDetail(Number(match[1]));
  }
  return renderSprintsList();
}

async function renderSprintsList() {
  const canManage = ['admin', 'project_manager'].includes(state.user.role);
  let projects = [];
  try {
    projects = await api('/projects');
  } catch {}

  if (!projects.length) {
    layout(`${heading('Sprints', 'Ciclos ágiles de desarrollo y planificación')}<div class="card"><p class="muted">No hay proyectos registrados en tu organización. Crea un proyecto primero en el Dashboard.</p></div>`);
    return;
  }

  const selectedProjectId = Number(state.activeSprintProjectId || projects[0].id);
  state.activeSprintProjectId = selectedProjectId;

  let sprints = [];
  try {
    sprints = await api(`/projects/${selectedProjectId}/sprints`);
  } catch (e) {
    notify(e.message);
  }

  const projectOptions = projects.map(p =>
    `<option value="${p.id}" ${p.id === selectedProjectId ? 'selected' : ''}>${esc(p.name)}</option>`
  ).join('');

  const sprintsHtml = `
    ${heading(
      'Sprints',
      'Planificación, ejecución y seguimiento de sprints por proyecto.',
      canManage ? `<button type="button" class="btn" id="open-new-sprint-modal">${icon('plus')}Nuevo sprint</button>` : ''
    )}
    <div class="card mb-4">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <label style="font-weight:600;font-size:13px">Proyecto:</label>
        <select class="select" id="sprints-project-filter" style="max-width:320px">
          ${projectOptions}
        </select>
      </div>
    </div>
    ${sprints.length ? `
      <div class="sprint-cards-grid">
        ${sprints.map(s => {
          const total = Number(s.total_tasks || 0);
          const completed = Number(s.completed_tasks || 0);
          const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
          return `
            <div class="card sprint-card-item">
              <div>
                <div class="sprint-card-header">
                  <div>
                    <h3 style="font-size:16px;margin-bottom:4px">${esc(s.name)}</h3>
                    <span class="muted" style="font-size:12px">${esc(s.start_date)} al ${esc(s.end_date)}</span>
                  </div>
                  ${sprintStatusBadge(s.status)}
                </div>
                ${s.goal ? `<div class="sprint-goal-box mt-3">${esc(s.goal)}</div>` : ''}
                <div class="sprint-progress-wrap">
                  <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
                    <span class="muted">${completed} de ${total} tareas</span>
                    <strong>${pct}%</strong>
                  </div>
                  <div class="sprint-progress-bar">
                    <div class="sprint-progress-fill" style="width:${pct}%"></div>
                  </div>
                </div>
              </div>
              <div class="actions mt-4" style="justify-content:flex-end">
                <a class="btn mini" href="#/${state.user.role}/sprints/${s.id}">${icon('eye')}Abrir sprint</a>
                ${canManage && s.status === 'planificado' ? `<button type="button" class="btn secondary mini start-sprint-btn" data-id="${s.id}">${icon('play')}Iniciar</button>` : ''}
                ${canManage && s.status === 'activo' ? `<button type="button" class="btn secondary mini close-sprint-btn" data-id="${s.id}" data-project="${s.project_id}">${icon('check')}Cerrar</button>` : ''}
                ${canManage && s.status === 'planificado' ? `<button type="button" class="btn danger mini delete-sprint-btn" data-id="${s.id}">${icon('trash')}Eliminar</button>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    ` : `
      <div class="card empty">
        No hay sprints creados en este proyecto todavía.
        ${canManage ? '<br><button type="button" class="btn mt-3" id="empty-new-sprint-btn">Crear primer sprint</button>' : ''}
      </div>
    `}

    ${canManage ? `
      <div class="status-overlay" id="new-sprint-modal" style="display:none" role="dialog" aria-modal="true">
        <div class="status-viewer admin-modal-panel">
          <div class="status-viewer-head">
            <strong>Nuevo Sprint</strong>
            <button type="button" class="icon-btn" id="close-new-sprint" aria-label="Cerrar">${icon('close')}</button>
          </div>
          <form class="admin-modal-form" id="new-sprint-form">
            <input type="hidden" name="project_id" value="${selectedProjectId}">
            <div class="form-grid">
              <label class="full">Nombre del Sprint
                <input class="input" name="name" placeholder="Ej. Sprint 1 - Autenticación y Perfiles" required>
              </label>
              <label>Fecha de inicio
                <input class="input" name="start_date" type="date" required>
              </label>
              <label>Fecha de fin
                <input class="input" name="end_date" type="date" required>
              </label>
              <label class="full">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                  <span>Objetivo y Notas del Sprint</span>
                  <button type="button" class="btn secondary mini" id="btn-use-sprint-template" style="padding:2px 8px;font-size:12px">${icon('file')} Usar plantilla de planificación</button>
                </div>
                <textarea class="textarea" name="goal" id="new-sprint-goal" rows="5" placeholder="Define el objetivo del sprint..."></textarea>
              </label>
            </div>
            <div class="actions mt-4">
              <button class="btn" type="submit">${icon('check')}Crear sprint</button>
              <button type="button" class="btn secondary" id="cancel-new-sprint">Cancelar</button>
            </div>
          </form>
        </div>
      </div>
    ` : ''}
  `;

  layout(sprintsHtml);

  document.querySelector('#sprints-project-filter')?.addEventListener('change', e => {
    state.activeSprintProjectId = Number(e.target.value);
    renderSprintsList();
  });

  const modal = document.querySelector('#new-sprint-modal');
  const openModal = () => { if (modal) modal.style.display = 'grid'; };
  const closeModal = () => { if (modal) modal.style.display = 'none'; };

  document.querySelector('#open-new-sprint-modal')?.addEventListener('click', openModal);
  document.querySelector('#empty-new-sprint-btn')?.addEventListener('click', openModal);
  document.querySelector('#close-new-sprint')?.addEventListener('click', closeModal);
  document.querySelector('#cancel-new-sprint')?.addEventListener('click', closeModal);
  if (modal) modal.onclick = e => { if (e.target === modal) closeModal(); };

  document.querySelector('#btn-use-sprint-template')?.addEventListener('click', async () => {
    try {
      const templates = await api('/templates?type=sprint');
      const promptText = templates.map((t, i) => `${i + 1}. ${t.name}: ${t.description}`).join('\n');
      const choice = window.prompt(`Selecciona plantilla de planificación (1-${templates.length}):\n\n${promptText}`, '1');
      if (!choice) return;
      const selected = templates[Number(choice) - 1];
      if (selected) {
        const goalEl = document.querySelector('#new-sprint-goal');
        if (goalEl) goalEl.value = selected.content;
      }
    } catch (e) {
      notify(e.message);
    }
  });

  document.querySelector('#new-sprint-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.target));
    try {
      await api(`/projects/${selectedProjectId}/sprints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      notify('Sprint creado exitosamente');
      closeModal();
      renderSprintsList();
    } catch (err) {
      notify(err.message);
    }
  });

  document.querySelectorAll('.start-sprint-btn').forEach(btn => {
    btn.onclick = async () => {
      try {
        await api(`/sprints/${btn.dataset.id}/start`, { method: 'POST' });
        notify('Sprint iniciado');
        renderSprintsList();
      } catch (err) {
        notify(err.message);
      }
    };
  });

  document.querySelectorAll('.close-sprint-btn').forEach(btn => {
    btn.onclick = async () => {
      await handleCloseSprint(btn.dataset.id, btn.dataset.project);
      renderSprintsList();
    };
  });

  document.querySelectorAll('.delete-sprint-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('¿Eliminar este sprint planificado? Las tareas quedarán sin sprint.')) return;
      try {
        await api(`/sprints/${btn.dataset.id}`, { method: 'DELETE' });
        notify('Sprint eliminado');
        renderSprintsList();
      } catch (err) {
        notify(err.message);
      }
    };
  });
}

async function handleCloseSprint(sprintId, projectId) {
  try {
    let moveToSprintId = null;
    const sprints = await api(`/projects/${projectId}/sprints`);
    const plannedSprints = sprints.filter(s => s.status === 'planificado' && s.id !== Number(sprintId));
    if (plannedSprints.length) {
      const promptText = plannedSprints.map(s => `ID ${s.id}: ${s.name}`).join('\n');
      const answer = window.prompt(
        `¿Deseas mover las tareas no completadas a otro sprint planificado?\n\n${promptText}\n\nIngresa el ID del sprint destino, o déjalo vacío para devolverlas al Backlog:`,
        ''
      );
      if (answer === null) return;
      if (answer.trim() !== '') {
        moveToSprintId = Number(answer.trim());
      }
    } else {
      if (!confirm('¿Cerrar este sprint? Las tareas no completadas volverán al backlog.')) return;
    }

    const result = await api(`/sprints/${sprintId}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ move_to_sprint_id: moveToSprintId })
    });
    notify(`Sprint cerrado. Completadas: ${result.completed}, Pendientes: ${result.pending}`);
  } catch (err) {
    notify(err.message);
  }
}

async function renderSprintDetail(sprintId) {
  const canManage = ['admin', 'project_manager'].includes(state.user.role);
  let data;
  try {
    data = await api(`/sprints/${sprintId}`);
  } catch (err) {
    layout(`${heading('Sprint no encontrado', '')}<div class="card alert">${esc(err.message)}</div><div class="mt-3"><a href="#/${state.user.role}/sprints" class="btn secondary">Volver a Sprints</a></div>`);
    return;
  }

  const { sprint, tasks, by_status, summary, pending_tasks, backlog } = data;
  const statusColumns = [
    { key: 'pendiente', label: 'Pendiente' },
    { key: 'en_proceso', label: 'En proceso' },
    { key: 'en_revision', label: 'En revisión' },
    { key: 'bloqueada', label: 'Bloqueada' },
    { key: 'completada', label: 'Completada' }
  ];

  const html = `
    <div style="margin-bottom:12px">
      <a href="#/${state.user.role}/sprints" class="btn secondary mini">← Volver al listado de sprints</a>
    </div>
    ${heading(
      `${esc(sprint.name)} ${sprintStatusBadge(sprint.status)}`,
      `Proyecto: ${esc(sprint.project_name)} · Fechas: ${esc(sprint.start_date)} al ${esc(sprint.end_date)}`,
      `<div class="actions">
        ${canManage && sprint.status === 'planificado' ? `<button type="button" class="btn" id="detail-start-sprint">${icon('play')}Iniciar sprint</button>` : ''}
        ${canManage && sprint.status === 'activo' ? `<button type="button" class="btn danger" id="detail-close-sprint">${icon('check')}Cerrar sprint</button>` : ''}
        <button type="button" class="btn secondary" id="detail-new-task-btn">${icon('plus')}Nueva tarea</button>
      </div>`
    )}

    <section class="card mb-4">
      <div class="sprint-summary-grid">
        <div class="sprint-summary-stat">
          <strong>${summary.total}</strong>
          <span>Total tareas</span>
        </div>
        <div class="sprint-summary-stat">
          <strong style="color:#10b981">${summary.completed}</strong>
          <span>Completadas</span>
        </div>
        <div class="sprint-summary-stat">
          <strong style="color:#f59e0b">${summary.pending}</strong>
          <span>Pendientes</span>
        </div>
        <div class="sprint-summary-stat">
          <strong>${summary.progress}%</strong>
          <span>Avance</span>
        </div>
      </div>
      <div class="sprint-progress-wrap">
        <div class="sprint-progress-bar">
          <div class="sprint-progress-fill" style="width:${summary.progress}%"></div>
        </div>
      </div>
      ${sprint.goal ? `<div class="sprint-goal-box mt-3"><strong>Objetivo:</strong>\n${esc(sprint.goal)}</div>` : ''}
    </section>

    <!-- Bandeja rápida de Backlog para arrastrar tareas al Sprint -->
    <section class="card mb-3 sprint-backlog-tray-wrapper" id="sprint-backlog-tray-section">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:8px">
          <strong>${icon('list')} Bandeja de Backlog (${backlog.length})</strong>
          <span class="muted" style="font-size:12px">Arrastra tareas existentes a cualquier columna del tablero para incorporarlas al sprint.</span>
        </div>
        ${backlog.length > 0 ? `
          <button type="button" class="btn secondary mini" id="toggle-backlog-tray-btn">
            ${state.sprintBacklogTrayOpen === false ? 'Mostrar bandeja' : 'Ocultar bandeja'}
          </button>
        ` : ''}
      </div>
      ${backlog.length > 0 ? `
        <div class="sprint-backlog-tray mt-2" id="sprint-backlog-tray" style="${state.sprintBacklogTrayOpen === false ? 'display:none;' : ''}">
          ${backlog.map(t => {
            const prioCls = t.priority === 'critica' ? 'pink' : t.priority === 'alta' ? 'yellow' : '';
            return `
              <div class="sprint-task-card sprint-backlog-card" draggable="true" data-id="${t.id}" data-source="backlog" data-status="${t.status}" data-title="${esc(t.title)}">
                <div style="display:flex;align-items:flex-start;gap:6px">
                  <span class="drag-handle-badge" title="Arrastrar al tablero">⋮⋮</span>
                  <strong style="font-size:12px;line-height:1.2;flex:1">${esc(t.title)}</strong>
                </div>
                <div class="task-meta">
                  <span class="badge mini ${prioCls}">${esc(t.priority)}</span>
                  <span class="muted" style="font-size:11px">${esc(t.assignee_name || 'Sin asignar')}</span>
                </div>
                <div class="task-card-actions" style="margin-top:2px;padding-top:2px">
                  <button type="button" class="btn secondary mini add-to-sprint-btn" data-id="${t.id}" style="font-size:11px;padding:2px 6px;width:100%">${icon('plus')} Añadir</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <div class="muted mt-2" style="font-size:12px">No hay tareas pendientes en el backlog de este proyecto.</div>
      `}
    </section>

    <!-- Tablero del Sprint (SB-05.3) -->
    <div class="section-heading mb-3">
      <div>
        <h2>Tablero del Sprint</h2>
        <p class="muted">Tareas del ciclo agrupadas por estado. Arrastra tarjetas entre columnas o suéltalas en el Backlog para retirarlas.</p>
      </div>
    </div>
    <div class="sprint-board mb-4">
      ${statusColumns.map(col => {
        const colTasks = by_status[col.key] || [];
        return `
          <div class="column" data-status="${col.key}">
            <h3><span>${col.label}</span> <span class="badge mini">${colTasks.length}</span></h3>
            <div class="sprint-column-cards">
              ${colTasks.map(t => {
                const prioCls = t.priority === 'critica' ? 'pink' : t.priority === 'alta' ? 'yellow' : '';
                return `
                  <div class="sprint-task-card" draggable="true" data-id="${t.id}" data-source="sprint" data-status="${t.status}" data-title="${esc(t.title)}">
                    <strong>${esc(t.title)}</strong>
                    <div class="task-meta">
                      <span class="badge mini ${prioCls}">${esc(t.priority)}</span>
                      <span class="muted">${esc(t.assignee_name || 'Sin asignar')}</span>
                    </div>
                    <div class="task-card-actions">
                      <select class="select mini change-task-status-select" data-id="${t.id}" style="font-size:11px;padding:2px 4px">
                        ${statusColumns.map(sc => `<option value="${sc.key}" ${sc.key === t.status ? 'selected' : ''}>${sc.label}</option>`).join('')}
                      </select>
                      <button type="button" class="btn secondary mini remove-from-sprint-btn" data-id="${t.id}" title="Quitar del sprint y devolver al backlog" style="padding:2px 6px">${icon('close')}</button>
                    </div>
                  </div>
                `;
              }).join('') || '<div class="empty mini" style="padding:16px 8px;font-size:12px">Sin tareas</div>'}
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <!-- Sección Pendientes (SB-05.3) -->
    <section class="card mb-4">
      <div class="section-heading">
        <div>
          <h2>Pendientes del Sprint</h2>
          <p class="muted">Tareas en este sprint que aún no han sido completadas (${pending_tasks.length}).</p>
        </div>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Tarea</th>
              <th>Estado</th>
              <th>Prioridad</th>
              <th>Responsable</th>
              <th style="text-align:right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${pending_tasks.map(t => `
              <tr>
                <td><strong>${esc(t.title)}</strong></td>
                <td><span class="badge ${t.status === 'en_proceso' ? 'pink' : 'yellow'}">${esc(t.status.replace('_', ' '))}</span></td>
                <td><span class="badge ${t.priority === 'critica' ? 'pink' : t.priority === 'alta' ? 'yellow' : ''}">${esc(t.priority)}</span></td>
                <td>${esc(t.assignee_name || 'Sin asignar')}</td>
                <td style="text-align:right">
                  <button type="button" class="btn secondary mini mark-task-completed-btn" data-id="${t.id}">${icon('check')}Completar</button>
                  <button type="button" class="btn secondary mini remove-from-sprint-btn" data-id="${t.id}">Devolver a backlog</button>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="5" class="empty">¡Todas las tareas del sprint han sido completadas!</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>

    <!-- Sección Backlog del Proyecto (SB-05.3) -->
    <section class="card sprint-backlog-drop-zone" id="sprint-backlog-section">
      <div class="section-heading">
        <div>
          <h2>Backlog del Proyecto (Sin Sprint)</h2>
          <p class="muted">Tareas disponibles para incorporar a este sprint (${backlog.length}). Arrástralas al tablero o suelta aquí tareas del sprint para devolverlas al backlog.</p>
        </div>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th style="width:36px;text-align:center"></th>
              <th>Tarea</th>
              <th>Estado</th>
              <th>Prioridad</th>
              <th>Responsable</th>
              <th style="text-align:right">Acción</th>
            </tr>
          </thead>
          <tbody>
            ${backlog.map(t => `
              <tr class="backlog-task-row" draggable="true" data-id="${t.id}" data-source="backlog" data-status="${t.status}" data-title="${esc(t.title)}">
                <td style="text-align:center;cursor:grab" class="drag-handle" title="Arrastrar tarea al tablero">
                  <span style="user-select:none;font-size:16px;color:var(--muted)">⋮⋮</span>
                </td>
                <td><strong>${esc(t.title)}</strong></td>
                <td><span class="badge">${esc(t.status.replace('_', ' '))}</span></td>
                <td><span class="badge ${t.priority === 'critica' ? 'pink' : t.priority === 'alta' ? 'yellow' : ''}">${esc(t.priority)}</span></td>
                <td>${esc(t.assignee_name || 'Sin asignar')}</td>
                <td style="text-align:right">
                  <button type="button" class="btn secondary mini add-to-sprint-btn" data-id="${t.id}">${icon('plus')}Agregar al sprint</button>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="6" class="empty">No hay tareas pendientes en el backlog.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;

  layout(html);

  document.querySelector('#detail-start-sprint')?.addEventListener('click', async () => {
    try {
      await api(`/sprints/${sprintId}/start`, { method: 'POST' });
      notify('Sprint iniciado');
      renderSprintDetail(sprintId);
    } catch (err) {
      notify(err.message);
    }
  });

  document.querySelector('#detail-close-sprint')?.addEventListener('click', async () => {
    await handleCloseSprint(sprintId, sprint.project_id);
    renderSprintDetail(sprintId);
  });

  document.querySelector('#detail-new-task-btn')?.addEventListener('click', () => {
    sessionStorage.setItem('preselected_project_id', String(sprint.project_id));
    location.hash = `#/${state.user.role}/tasks`;
  });

  const toggleTrayBtn = document.querySelector('#toggle-backlog-tray-btn');
  if (toggleTrayBtn) {
    toggleTrayBtn.onclick = () => {
      const tray = document.querySelector('#sprint-backlog-tray');
      if (tray) {
        const isHidden = tray.style.display === 'none';
        tray.style.display = isHidden ? 'flex' : 'none';
        state.sprintBacklogTrayOpen = isHidden;
        toggleTrayBtn.textContent = isHidden ? 'Ocultar bandeja' : 'Mostrar bandeja';
      }
    };
  }

  // Soporte de Drag & Drop para tablero del sprint y backlog
  let draggedItem = null;
  document.querySelectorAll('.sprint-task-card[draggable="true"], .backlog-task-row[draggable="true"]').forEach(el => {
    el.addEventListener('dragstart', e => {
      draggedItem = el;
      el.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', el.dataset.id || '');
      e.dataTransfer.setData('id', el.dataset.id || '');
      e.dataTransfer.setData('source', el.dataset.source || 'sprint');
      e.dataTransfer.setData('status', el.dataset.status || 'pendiente');
      e.dataTransfer.setData('title', el.dataset.title || '');
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('is-dragging');
      document.querySelectorAll('.is-drag-over').forEach(over => over.classList.remove('is-drag-over'));
      draggedItem = null;
    });
  });

  document.querySelectorAll('.sprint-board .column').forEach(col => {
    col.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      col.classList.add('is-drag-over');
    });
    col.addEventListener('dragleave', e => {
      if (!col.contains(e.relatedTarget)) {
        col.classList.remove('is-drag-over');
      }
    });
    col.addEventListener('drop', async e => {
      e.preventDefault();
      col.classList.remove('is-drag-over');
      const taskId = e.dataTransfer.getData('id') || (draggedItem && draggedItem.dataset.id);
      const source = e.dataTransfer.getData('source') || (draggedItem && draggedItem.dataset.source) || 'sprint';
      const originalStatus = e.dataTransfer.getData('status') || (draggedItem && draggedItem.dataset.status);
      const targetStatus = col.dataset.status;

      if (!taskId || !targetStatus) return;

      if (source === 'backlog') {
        try {
          await api(`/tasks/${taskId}/sprint`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sprint_id: sprintId })
          });
          if (targetStatus !== originalStatus) {
            await api(`/tasks/${taskId}/status`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: targetStatus })
            });
          }
          notify('Tarea añadida al sprint correctamente');
          renderSprintDetail(sprintId);
        } catch (err) {
          notify(err.message);
        }
      } else if (source === 'sprint') {
        if (originalStatus === targetStatus) return;
        try {
          await api(`/tasks/${taskId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: targetStatus })
          });
          notify('Estado de la tarea actualizado');
          renderSprintDetail(sprintId);
        } catch (err) {
          notify(err.message);
        }
      }
    });
  });

  const backlogDropZones = document.querySelectorAll('.sprint-backlog-drop-zone, .sprint-backlog-tray-wrapper');
  backlogDropZones.forEach(zone => {
    zone.addEventListener('dragover', e => {
      const source = (draggedItem && draggedItem.dataset.source) || e.dataTransfer.getData('source');
      if (source === 'sprint') {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        zone.classList.add('is-drag-over');
      }
    });
    zone.addEventListener('dragleave', e => {
      if (!zone.contains(e.relatedTarget)) {
        zone.classList.remove('is-drag-over');
      }
    });
    zone.addEventListener('drop', async e => {
      zone.classList.remove('is-drag-over');
      const taskId = e.dataTransfer.getData('id') || (draggedItem && draggedItem.dataset.id);
      const source = e.dataTransfer.getData('source') || (draggedItem && draggedItem.dataset.source);
      if (!taskId || source !== 'sprint') return;
      e.preventDefault();
      try {
        await api(`/tasks/${taskId}/sprint`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sprint_id: null })
        });
        notify('Tarea devuelta al backlog');
        renderSprintDetail(sprintId);
      } catch (err) {
        notify(err.message);
      }
    });
  });

  document.querySelectorAll('.change-task-status-select').forEach(sel => {
    sel.addEventListener('change', async e => {
      try {
        await api(`/tasks/${e.target.dataset.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: e.target.value })
        });
        notify('Estado actualizado');
        renderSprintDetail(sprintId);
      } catch (err) {
        notify(err.message);
      }
    });
  });

  document.querySelectorAll('.mark-task-completed-btn').forEach(btn => {
    btn.onclick = async () => {
      try {
        await api(`/tasks/${btn.dataset.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completada' })
        });
        notify('Tarea marcada como completada');
        renderSprintDetail(sprintId);
      } catch (err) {
        notify(err.message);
      }
    };
  });

  document.querySelectorAll('.remove-from-sprint-btn').forEach(btn => {
    btn.onclick = async () => {
      try {
        await api(`/tasks/${btn.dataset.id}/sprint`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sprint_id: null })
        });
        notify('Tarea retirada del sprint');
        renderSprintDetail(sprintId);
      } catch (err) {
        notify(err.message);
      }
    };
  });

  document.querySelectorAll('.add-to-sprint-btn').forEach(btn => {
    btn.onclick = async () => {
      try {
        await api(`/tasks/${btn.dataset.id}/sprint`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sprint_id: sprintId })
        });
        notify('Tarea añadida al sprint');
        renderSprintDetail(sprintId);
      } catch (err) {
        notify(err.message);
      }
    };
  });
}
function absenceStatusBadge(status){const map={ninguna:['','Sin apelación'],pendiente:['yellow','En revisión'],aprobada:['green','Aprobada'],rechazada:['pink','Rechazada']};const [cls,label]=map[status]||['',status];return `<span class="badge ${cls}">${esc(label)}</span>`}
function absenceWarning(absences){return `<div class="alert absence-warning" id="absence-warning"><strong>Cuidado:</strong> ya llevas ${absences.length} inasistencias. Se aplicará una sanción.<div class="absence-warning-actions"><button type="button" class="btn secondary" id="go-to-absences">Ver y apelar mis inasistencias</button><button type="button" class="btn secondary" id="dismiss-absence-warning">Entendido</button></div></div>`}
const renderDashboardBase=renderDashboard;
renderDashboard=async function(){const absences=state.user.role==='member'?await api('/absences'):[];await renderDashboardBase();if(absences.length>=4){document.querySelector('.content')?.insertAdjacentHTML('afterbegin',absenceWarning(absences));document.querySelector('#go-to-absences')?.addEventListener('click',()=>{location.hash='/member/absences'});document.querySelector('#dismiss-absence-warning')?.addEventListener('click',()=>document.querySelector('#absence-warning')?.remove())}}
function absenceAdminPanel(absences, users){const memberOptions=users.filter(user=>user.role==='member').map(user=>`<option value="${user.id}">${esc(user.name)}</option>`).join('');return `<section class="card absence-admin" id="absence-admin"><div class="section-heading"><div><h2>Registro de inasistencias</h2><p class="muted">Registra la fecha y la materia de cada falta.</p></div><strong class="absence-total">${absences.length} registradas</strong></div><form id="absence-form" class="form-grid"><label>Integrante<select class="select" name="user_id" required><option value="">Selecciona un integrante</option>${memberOptions}</select></label><label>Fecha<input class="input" name="absence_date" type="date" required></label><label>Materia<input class="input" name="subject" required></label><div class="actions full"><button class="btn">${icon('plus')}Añadir inasistencia</button></div></form><div class="absence-list">${absences.map(absence=>`<div class="absence-row"><span><strong>${esc(absence.user_name)}</strong><small class="muted">${esc(absence.absence_date)} · ${esc(absence.subject)}</small></span><span class="actions">${absenceStatusBadge(absence.appeal_status)}<button type="button" class="btn danger mini delete-absence" data-id="${absence.id}">${icon('trash')}Eliminar</button></span></div>`).join('')||'<div class="empty">No hay inasistencias registradas.</div>'}</div></section>`}
function absenceAppealRow(item,isAdmin){const evidenceLink=item.appeal_evidence_id?`<a class="btn secondary mini" href="/api/files/${item.appeal_evidence_id}/view" target="_blank" rel="noopener">${icon('eye')}Ver evidencia</a>`:'';const resolveActions=isAdmin&&item.appeal_status==='pendiente'?`<button type="button" class="btn secondary mini approve-appeal" data-id="${item.id}">${icon('check')}Aprobar</button><button type="button" class="btn danger mini reject-appeal" data-id="${item.id}">${icon('close')}Rechazar</button>`:'';return `<div class="absence-row"><span>${isAdmin?`<strong>${esc(item.user_name)}</strong>`:''}<small class="muted">${esc(item.absence_date)} · ${esc(item.subject)}</small><small class="muted">Motivo: ${esc(item.appeal_reason||'Sin motivo')}</small>${item.resolution_note?`<small class="muted">Respuesta: ${esc(item.resolution_note)}</small>`:''}</span><span class="actions">${absenceStatusBadge(item.appeal_status)}${evidenceLink}${resolveActions}</span></div>`}
function absenceAppealsPanel(appeals){const pending=appeals.filter(item=>item.appeal_status==='pendiente').length;return `<section class="card mt-4" id="absence-appeals"><div class="section-heading"><div><h2>Apelaciones</h2><p class="muted">Revisa la evidencia y resuelve las apelaciones enviadas por el equipo.</p></div><strong class="absence-total">${pending} pendiente${pending===1?'':'s'}</strong></div><div class="absence-list">${appeals.map(item=>absenceAppealRow(item,true)).join('')||'<div class="empty">No hay apelaciones registradas.</div>'}</div></section>`}
async function renderAdminAbsences(){
  const [absences,appeals,users]=await Promise.all([api('/absences'),api('/absences/appeals'),api('/users')]);
  layout(`${heading('Inasistencias','Registra faltas y resuelve las apelaciones del equipo.')}${absenceAdminPanel(absences,users)}${absenceAppealsPanel(appeals)}`);
  document.querySelector('#absence-form').onsubmit=async event=>{event.preventDefault();try{await api('/absences',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(event.target)))});notify('Inasistencia añadida');renderAdminAbsences()}catch(error){notify(error.message)}};
  document.querySelectorAll('.delete-absence').forEach(button=>button.onclick=async()=>{if(confirm('¿Eliminar esta inasistencia?')){try{await api(`/absences/${button.dataset.id}`,{method:'DELETE'});renderAdminAbsences()}catch(error){notify(error.message)}}});
  document.querySelectorAll('.approve-appeal').forEach(button=>button.onclick=()=>resolveAbsenceAppeal(button.dataset.id,'aprobada'));
  document.querySelectorAll('.reject-appeal').forEach(button=>button.onclick=()=>resolveAbsenceAppeal(button.dataset.id,'rechazada'));
}
async function resolveAbsenceAppeal(id,status){
  const resolution_note=window.prompt(status==='aprobada'?'Nota para el integrante (opcional):':'Motivo del rechazo (opcional):','');
  if(resolution_note===null)return;
  try{await api(`/absences/${id}/resolve`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({status,resolution_note})});notify(status==='aprobada'?'Apelación aprobada':'Apelación rechazada');renderAdminAbsences()}catch(error){notify(error.message)}
}
function memberAbsenceRow(item){const canAppeal=['ninguna','rechazada'].includes(item.appeal_status);const evidenceLink=item.appeal_evidence_id?`<a class="btn secondary mini" href="/api/files/${item.appeal_evidence_id}/view" target="_blank" rel="noopener">${icon('eye')}Ver evidencia</a>`:'';return `<div class="absence-row"><span><strong>${esc(item.absence_date)}</strong><small class="muted">${esc(item.subject)}</small>${item.appeal_reason?`<small class="muted">Tu motivo: ${esc(item.appeal_reason)}</small>`:''}${item.resolution_note?`<small class="muted">Respuesta del administrador: ${esc(item.resolution_note)}</small>`:''}</span><span class="actions">${absenceStatusBadge(item.appeal_status)}${evidenceLink}${canAppeal?`<button type="button" class="btn secondary mini appeal-absence" data-id="${item.id}">${icon('edit')}Apelar</button>`:''}</span></div>`}
async function renderMemberAbsences(){
  const absences=await api('/absences');
  layout(`${heading('Inasistencias','Consulta tus faltas registradas y apela si consideras que hay un error.')}<section class="card"><div class="absence-list">${absences.map(memberAbsenceRow).join('')||'<div class="empty">No tienes inasistencias registradas.</div>'}</div></section><section class="card mt-4" id="appeal-form-section" style="display:none"><h2>Apelar inasistencia</h2><p class="muted">Explica el motivo y adjunta una evidencia (documento o imagen) que respalde tu apelación.</p><form id="appeal-form" class="form-grid"><input type="hidden" name="absence_id"><label class="full">Motivo de la apelación<textarea class="textarea" name="reason" rows="3" required></textarea></label><label class="full">Evidencia<input class="input" type="file" name="evidence" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" required></label><div class="actions full"><button class="btn">${icon('send')}Enviar apelación</button><button class="btn secondary" type="button" id="cancel-appeal">Cancelar</button></div></form></section>`);
  const section=document.querySelector('#appeal-form-section');
  const form=document.querySelector('#appeal-form');
  document.querySelectorAll('.appeal-absence').forEach(button=>button.onclick=()=>{form.reset();form.elements.absence_id.value=button.dataset.id;section.style.display='block';section.scrollIntoView({behavior:'smooth',block:'start'})});
  document.querySelector('#cancel-appeal')?.addEventListener('click',()=>section.style.display='none');
  form?.addEventListener('submit',async event=>{
    event.preventDefault();
    const absenceId=form.elements.absence_id.value;
    const reason=form.elements.reason.value;
    const fileInput=form.elements.evidence;
    if(!fileInput.files.length){notify('Adjunta un archivo de evidencia.');return}
    try{
      const fileData=new FormData();
      fileData.append('file',fileInput.files[0]);
      const uploaded=await api('/files',{method:'POST',body:fileData});
      await api(`/absences/${absenceId}/appeal`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason,evidence_file_id:uploaded.id})});
      notify('Apelación enviada. Un administrador la revisará.');
      renderMemberAbsences();
    }catch(error){notify(error.message)}
  });
}
async function renderAbsences(){return state.user.role==='admin'?renderAdminAbsences():renderMemberAbsences()}
async function registerView(error=''){
  let plans=[];
  try{plans=await api('/plans')}catch(requestError){error=requestError.message}
  app.innerHTML=`
    <main class="login">
      <div class="auth-theme-bar">
        ${themeToggle()}
      </div>
      <div class="auth-stage is-wide">
        <form class="login-box wide" id="organization-register">
          <div class="login-box-header">
            <div class="brand">${brandLogo()}</div>
            <div class="eyebrow">Crear espacio de trabajo</div>
            <h1>Comienza con Haitani</h1>
            <p class="muted">Configura los datos de tu empresa y el primer administrador de la organización.</p>
          </div>
          ${error ? `<div class="alert">${esc(error)}</div>` : ''}
          <div class="form-grid">
            <label>Empresa
              <input class="input" name="company_name" placeholder="Ej. Sakura Coffee" required>
            </label>
            <label>Slug (identificador)
              <input class="input" name="slug" pattern="[a-z0-9][a-z0-9-]{2,49}" placeholder="sakura-coffee" required>
            </label>
            <label>Correo de empresa
              <input class="input" name="email" type="email" placeholder="contacto@empresa.com" required>
            </label>
            <label>Nombre del administrador
              <input class="input" name="first_name" placeholder="Tu nombre" required>
            </label>
            <label>Apellido
              <input class="input" name="last_name" placeholder="Tu apellido" required>
            </label>
            <label>Correo de acceso
              <input class="input" name="admin_email" type="email" placeholder="admin@empresa.com" required>
            </label>
            <label class="full">Contraseña maestra
              <input class="input" name="password" type="password" minlength="8" placeholder="Mínimo 8 caracteres" required>
            </label>
            <label class="full">Descripción del proyecto
              <textarea class="textarea" name="description" rows="2" placeholder="Objetivo, stack o contexto de la organización"></textarea>
            </label>
            <fieldset class="full">
              <legend>Selecciona un plan para tu equipo</legend>
              <div class="plan-radio-grid">
                ${plans.map((plan, index) => `
                  <label class="plan-radio-card ${index === 0 ? 'selected' : ''}">
                    <input type="radio" name="plan_key" value="${esc(plan.key)}" ${index === 0 ? 'checked' : ''}>
                    <strong>${esc(plan.name)}</strong>
                    <div class="plan-price">${plan.price_cents ? `${(plan.price_cents/100).toLocaleString('es-MX', {style:'currency', currency:plan.currency})} / mes` : 'Gratis'}</div>
                    <span class="plan-limits">${plan.max_users ?? 'Ilimitados'} usuarios · ${plan.max_projects ?? 'Ilimitados'} proyectos · ${plan.max_storage_mb} MB</span>
                  </label>
                `).join('')}
              </div>
            </fieldset>
          </div>
          <div class="auth-actions">
            <button class="btn btn-block" type="submit">Crear organización y continuar →</button>
            <button type="button" class="btn secondary btn-block" id="back-to-login">Volver al inicio de sesión</button>
          </div>
        </form>
      </div>
    </main>
  `;

  document.querySelectorAll('.plan-radio-card input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.plan-radio-card').forEach(card => card.classList.remove('selected'));
      radio.closest('.plan-radio-card')?.classList.add('selected');
    });
  });

  bindTheme();
  document.querySelector('#back-to-login').onclick = () => loginView();
  document.querySelector('#organization-register').onsubmit = async event => {
    event.preventDefault();
    try {
      const data = await api('/organizations/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(event.target)))
      });
      state.user = data.user;
      location.hash = data.redirect;
      render();
    } catch (requestError) {
      registerView(requestError.message);
    }
  };
}
const renderAssistantBase=renderAssistant;
renderAssistant=async function(){await renderAssistantBase();let repositoryName='Repositorio';try{const github=await api('/github/repository');repositoryName=github.data?.name||repositoryName}catch{}document.querySelector('.assistant-kicker')?.replaceChildren(document.createTextNode(`Sanzu / ${repositoryName}`));document.querySelector('.assistant-message small')?.replaceChildren(document.createTextNode(`Listo para consultar ${repositoryName}`))};
const renderGithubBase=renderGithub;
renderGithub=async function(section='repository'){await renderGithubBase(section);if(section!=='repository')return;let repositoryName='Repositorio';try{const github=await api('/github/repository');repositoryName=github.data?.name||repositoryName}catch{}const subtitle=document.querySelector('.heading p');if(subtitle)subtitle.textContent=`Información real del repositorio ${repositoryName}.`};
const renderSettingsBase=renderSettings;
renderSettings=async function(){await renderSettingsBase();let data;try{data=await api('/security/ip-blocks')}catch(error){return}const section=document.createElement('section');section.className='card mt-4';section.innerHTML=`<h2>Bloqueo de IP</h2><p class="muted">IP actual: ${esc(data.current_ip||'No disponible')}</p><form id="ip-block-form" class="form-grid"><label>Dirección IPv4<input class="input" name="ip" placeholder="203.0.113.10" required></label><label>Motivo<input class="input" name="reason" placeholder="Actividad sospechosa"></label><div class="actions full"><button class="btn danger">${icon('block')}Bloquear IP</button></div></form><div class="table-wrap"><table class="table"><thead><tr><th>IP</th><th>Motivo</th><th>Fecha</th><th></th></tr></thead><tbody>${data.blocks.map(block=>`<tr><td>${esc(block.ip)}</td><td>${esc(block.reason||'Sin motivo')}</td><td>${esc(block.created_at)}</td><td><button class="btn secondary mini unblock-ip" data-id="${block.id}">${icon('check')}Desbloquear</button></td></tr>`).join('')||'<tr><td colspan="4" class="empty">No hay IPs bloqueadas.</td></tr>'}</tbody></table></div>`;section.insertAdjacentHTML('beforeend',`<h2 class="mt-4">Actividad reciente</h2><div class="table-wrap"><table class="table"><thead><tr><th>IP</th><th>Usuario</th><th>Navegador</th><th>Ruta</th><th>Estado</th><th>Inusual</th><th>Fecha</th><th></th></tr></thead><tbody>${data.activity.map(event=>`<tr><td>${esc(event.ip)}</td><td>${esc(event.user_name||'No autenticado')}</td><td title="${esc(event.user_agent)}">${esc(event.user_agent||'No disponible').slice(0,60)}</td><td>${esc(event.method)} ${esc(event.path)}</td><td>${event.status}</td><td>${event.unusual?`<span class="badge pink">${esc(event.reason||'Sí')}</span>`:'No'}</td><td>${esc(event.created_at)}</td><td><button class="btn secondary mini block-event-ip" data-ip="${esc(event.ip)}">${icon('block')}Bloquear</button></td></tr>`).join('')||'<tr><td colspan="8" class="empty">No hay actividad registrada.</td></tr>'}</tbody></table></div>`);document.querySelector('.content')?.append(section);section.querySelector('#ip-block-form').onsubmit=async event=>{event.preventDefault();try{await api('/security/ip-blocks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(event.target)))});notify('IP bloqueada');renderSettings()}catch(error){notify(error.message)}};section.querySelectorAll('.unblock-ip').forEach(button=>button.onclick=async()=>{try{await api(`/security/ip-blocks/${button.dataset.id}`,{method:'DELETE'});notify('IP desbloqueada');renderSettings()}catch(error){notify(error.message)}});section.querySelectorAll('.block-event-ip').forEach(button=>button.onclick=async()=>{try{await api('/security/ip-blocks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ip:button.dataset.ip,reason:'Bloqueada desde el registro de actividad'})});notify('IP bloqueada');renderSettings()}catch(error){notify(error.message)}})};
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

async function renderOverview() {
  const projects = await api('/projects').catch(() => []);
  if (!projects.length) {
    return layout(`
      ${heading('Project Overview', 'Control operativo y ejecutivo')}
      <div class="card p-5 mt-4 text-center">
        <h2>No hay proyectos registrados</h2>
        <p class="muted">Crea un proyecto en el dashboard para ver el resumen ejecutivo y métricas de salud.</p>
        <a class="btn mt-3" href="#/${state.user.role}/dashboard">Ir al Dashboard</a>
      </div>
    `);
  }

  const hashParams = new URLSearchParams((location.hash.split('?')[1]) || '');
  let selectedProjectId = Number(hashParams.get('project')) || projects[0].id;
  if (!projects.some(p => p.id === selectedProjectId)) selectedProjectId = projects[0].id;

  let overviewData = null;
  let intelData = null;
  try {
    overviewData = await api(`/projects/${selectedProjectId}/overview`);
    intelData = await api(`/projects/${selectedProjectId}/intelligence`).catch(() => null);
  } catch (err) {
    return layout(`
      ${heading('Project Overview', 'Control operativo y ejecutivo')}
      <div class="alert mt-4">Error al cargar datos del proyecto: ${esc(err.message)}</div>
    `);
  }

  const p = overviewData.project || {};
  const h = overviewData.health || { score: 100, status: 'saludable', overdue: 0, dueSoon: 0, critical: 0, unassigned: 0, recommendations: [], workload: [] };
  const s = overviewData.summary || {};
  const sync = overviewData.sanzuSync || { status: 'pending' };
  const blocked = overviewData.blockedTasks || [];
  const overdue = overviewData.overdueTasks || [];
  const risks = overviewData.risks || [];
  const workload = overviewData.workload || [];

  const syncClass = sync.status === 'synced' ? 'green' : sync.status === 'error' ? 'pink' : 'yellow';
  const syncLabel = sync.status === 'synced' ? 'Sincronizado' : sync.status === 'error' ? 'Error al sincronizar' : 'Pendiente';
  const syncDate = sync.synced_at ? new Date(sync.synced_at).toLocaleString() : 'Nunca';

  const healthClass = h.status === 'saludable' ? 'green' : h.status === 'atencion' ? 'yellow' : 'pink';
  const healthLabel = h.status === 'saludable' ? 'Saludable' : h.status === 'atencion' ? 'Atención Requerida' : 'En Riesgo';

  const budgetDisplay = p.budget ? `$${Number(p.budget).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN` : 'Sin asignar';
  const datesDisplay = (p.start_date || p.end_date)
    ? `${p.start_date ? p.start_date.slice(0, 10) : '—'} al ${p.end_date ? p.end_date.slice(0, 10) : '—'}`
    : 'No definidas';

  const suggestions = (intelData?.suggestions?.length ? intelData.suggestions : h.recommendations) || [];

  const markup = `
    ${heading('Project Overview', 'Panel ejecutivo de salud, avance, sincronización Sanzu e inteligencia operativa', `
      <div class="actions">
        <select class="select" id="overview-project-select" style="min-width:200px">
          ${projects.map(proj => `<option value="${proj.id}" ${proj.id === selectedProjectId ? 'selected' : ''}>${esc(proj.name)}</option>`).join('')}
        </select>
        <a class="btn secondary" href="#/${state.user.role}/settings/sanzu" title="Añadir o cambiar Sanzu API Key">
          ${icon('settings')} API Key
        </a>
        <button class="btn secondary" id="overview-sync-btn" data-project-id="${p.id}">
          ${icon('external')} Sincronizar Sanzu
        </button>
      </div>
    `)}

    <div class="card p-4 mt-4" style="border-left: 4px solid var(--primary, #0ea5e9);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:var(--sp-3)">
        <div>
          <div class="eyebrow">${esc(p.client ? `Cliente: ${p.client}` : 'Proyecto')}</div>
          <h2 style="margin:4px 0">${esc(p.name)}</h2>
          <p class="muted" style="margin:0 0 var(--sp-2)">${esc(p.description || 'Sin descripción detallada.')}</p>
          ${p.objective ? `<div style="font-size:0.9rem;margin-top:4px"><strong>Objetivo:</strong> ${esc(p.objective)}</div>` : ''}
          ${p.scope ? `<div style="font-size:0.9rem;margin-top:2px"><strong>Alcance:</strong> ${esc(p.scope)}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--sp-1);align-items:flex-end">
          <div style="display:flex;gap:var(--sp-2)">
            <span class="badge ${p.methodology_id === 'SCRUM' || p.methodology_id === 'AGILE' ? 'green' : 'pink'}">${esc(p.methodology_id || 'Ágil')}</span>
            <span class="badge ${syncClass}">Sanzu: ${syncLabel}</span>
          </div>
          <small class="muted">Última sinc: ${syncDate}</small>
          <small class="muted">Plazo: ${datesDisplay}</small>
          <small class="muted">Presupuesto: <strong>${budgetDisplay}</strong></small>
        </div>
      </div>
    </div>

    <div class="grid stats dashboard-stats mt-4">
      <div class="card stat stat-primary">
        <div class="stat-header"><div class="label">Avance Global</div>${icon('activity')}</div>
        <div class="num">${overviewData.progress}%</div>
        <div class="stat-footer-sub">${s.completedTasks || 0} de ${s.totalTasks || 0} tareas finalizadas</div>
      </div>
      <div class="card stat">
        <div class="stat-header"><div class="label">Salud del Proyecto</div>${icon('shield')}</div>
        <div class="num" style="display:flex;align-items:baseline;gap:6px">
          ${h.score} <small style="font-size:14px;color:var(--muted)">/ 100</small>
        </div>
        <div class="stat-footer-sub"><span class="badge ${healthClass}">${healthLabel}</span></div>
      </div>
      <div class="card stat">
        <div class="stat-header"><div class="label">Tareas Atrasadas</div>${icon('clock')}</div>
        <div class="num" style="color:${h.overdue > 0 ? 'var(--pink)' : 'inherit'}">${h.overdue}</div>
        <div class="stat-footer-sub">${h.critical} tareas de alta prioridad</div>
      </div>
      <div class="card stat">
        <div class="stat-header"><div class="label">Riesgos Activos</div>${icon('alertTriangle')}</div>
        <div class="num">${risks.length}</div>
        <div class="stat-footer-sub">${blocked.length} tareas bloqueadas</div>
      </div>
    </div>

    <div class="card p-4 mt-4" style="background:linear-gradient(135deg, var(--panel), var(--bg-glass, rgba(255,255,255,0.02)));border:1px solid var(--line)">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--sp-2);margin-bottom:var(--sp-3)">
        <div style="display:flex;align-items:center;gap:var(--sp-2)">
          ${icon('sparkles')}
          <div>
            <h3 style="margin:0">Sanzu Intelligence & Diagnóstico IA</h3>
            <p class="muted sub" style="margin:0">Análisis continuo de avance, cuellos de botella y recomendaciones accionables.</p>
          </div>
        </div>
        <a class="btn secondary" href="${state.user.role === 'admin' ? '#/admin/assistant' : '#/member/messages'}">
          ${icon('sparkles')} Abrir Asistente IA
        </a>
      </div>
      <div class="grid" style="grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:var(--sp-3)">
        <div style="background:var(--bg, #111);padding:var(--sp-3);border-radius:var(--r-md);border:1px solid var(--line)">
          <strong style="display:block;margin-bottom:6px">Recomendaciones Sanzu</strong>
          ${suggestions.length ? `
            <ul style="margin:0;padding-left:18px;line-height:1.6;font-size:0.9rem">
              ${suggestions.map(rec => `<li>${esc(rec)}</li>`).join('')}
            </ul>
          ` : '<p class="muted sub" style="margin:0">No hay recomendaciones pendientes en este momento.</p>'}
        </div>
        <div style="background:var(--bg, #111);padding:var(--sp-3);border-radius:var(--r-md);border:1px solid var(--line)">
          <strong style="display:block;margin-bottom:6px">Calidad y Cobertura</strong>
          <div class="health-progress-row" style="margin-bottom:8px">
            <span>Fechas planificadas</span>
            <strong>${h.dateCoverage}%</strong>
            <i><b style="width:${h.dateCoverage}%"></b></i>
          </div>
          <div class="health-progress-row">
            <span>Asignación de miembros</span>
            <strong>${h.assignmentCoverage}%</strong>
            <i><b style="width:${h.assignmentCoverage}%"></b></i>
          </div>
          <div style="margin-top:12px;font-size:0.85rem" class="muted">
            Sprint activo: <strong>${esc(overviewData.sprint?.name || 'Ninguno activo')}</strong>
          </div>
        </div>
      </div>
    </div>

    <div class="grid mt-4" style="grid-template-columns:repeat(auto-fit, minmax(360px, 1fr));gap:var(--sp-4)">
      <div style="display:grid;gap:var(--sp-4)">
        <div class="card p-4">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-3)">
            <h3 style="margin:0">Tareas Atrasadas o Críticas</h3>
            <span class="badge pink">${overdue.length + blocked.length}</span>
          </div>
          ${(overdue.length || blocked.length) ? `
            <div style="display:grid;gap:var(--sp-2)">
              ${[...overdue, ...blocked].slice(0, 6).map(t => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--bg-glass);border-radius:var(--r-sm);border:1px solid var(--line)">
                  <div>
                    <strong style="font-size:0.9rem">${esc(t.title)}</strong>
                    <div class="muted sub">${esc(t.assignee_name || 'Sin asignar')} · Vence: ${esc((t.due_date || '').slice(0, 10) || 'Sin fecha')}</div>
                  </div>
                  <span class="badge ${t.priority === 'alta' || t.priority === 'critica' ? 'pink' : 'yellow'}">${esc(t.priority || 'media')}</span>
                </div>
              `).join('')}
            </div>
          ` : '<div class="empty">No hay tareas atrasadas ni bloqueos críticos. ¡Excelente ritmo!</div>'}
        </div>

        <div class="card p-4">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-3)">
            <h3 style="margin:0">Carga del Equipo (Workload)</h3>
            <a class="sub" href="#/${state.user.role}/risks">Ver Risk Center</a>
          </div>
          ${workload.length ? `
            <div style="display:grid;gap:var(--sp-3)">
              ${workload.map(w => {
                const pct = w.total ? Math.round((w.completed / w.total) * 100) : 0;
                return `
                  <div>
                    <div style="display:flex;justify-content:space-between;font-size:0.9rem;margin-bottom:4px">
                      <span><strong>${esc(w.name)}</strong> (${w.active || (w.total - w.completed)} activas)</span>
                      <span>${pct}% completado</span>
                    </div>
                    <div class="health-meter-track" style="height:6px">
                      <i style="width:${pct}%;background:var(--primary, #0ea5e9)"></i>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : '<div class="empty">No hay integrantes asignados a este proyecto.</div>'}
        </div>
      </div>

      <div style="display:grid;gap:var(--sp-4)">
        <div class="card p-4">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-3)">
            <h3 style="margin:0">Riesgos Principales</h3>
            <a class="sub" href="#/${state.user.role}/risks">Gestionar Riesgos</a>
          </div>
          ${risks.length ? `
            <div style="display:grid;gap:var(--sp-2)">
              ${risks.slice(0, 5).map(r => {
                const score = r.severity_score || (r.probability * r.impact) || 1;
                const scoreBadge = score >= 15 ? 'pink' : score >= 8 ? 'yellow' : 'green';
                return `
                  <div style="padding:10px;background:var(--bg-glass);border-radius:var(--r-sm);border:1px solid var(--line)">
                    <div style="display:flex;justify-content:space-between;align-items:center">
                      <strong style="font-size:0.9rem">${esc(r.title)}</strong>
                      <span class="badge ${scoreBadge}">Score: ${score}</span>
                    </div>
                    <div class="muted sub" style="margin-top:2px">${esc(r.category || 'General')} · Estado: ${esc(r.status || 'identificado')}</div>
                    ${r.mitigation ? `<div style="font-size:0.85rem;margin-top:4px"><em>Mitigación:</em> ${esc(r.mitigation)}</div>` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          ` : '<div class="empty">No hay riesgos registrados para este proyecto.</div>'}
        </div>

        <div class="card p-4">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-3)">
            <h3 style="margin:0">Accesos y Documentación</h3>
            <a class="sub" href="#/${state.user.role}/knowledge">Knowledge Center</a>
          </div>
          <div class="actions" style="display:flex;flex-wrap:wrap;gap:var(--sp-2)">
            <a class="btn secondary" href="#/${state.user.role}/kanban">${icon('kanban')} Tablero Kanban</a>
            <a class="btn secondary" href="#/${state.user.role}/gantt">${icon('gantt')} Diagrama Gantt</a>
            <a class="btn secondary" href="#/${state.user.role}/sprints">${icon('progress')} Sprints</a>
            <a class="btn secondary" href="#/${state.user.role}/knowledge">${icon('bookOpen')} Documentos (${s.totalDocuments || 0})</a>
          </div>
        </div>
      </div>
    </div>
  `;

  layout(markup);

  document.querySelector('#overview-project-select')?.addEventListener('change', (e) => {
    location.hash = `#/${state.user.role}/overview?project=${e.target.value}`;
  });

  document.querySelector('#overview-sync-btn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const pId = btn.dataset.projectId;
    btn.disabled = true;
    btn.innerHTML = `${icon('progress')} Sincronizando Sanzu...`;
    try {
      await api(`/projects/${pId}/sync`, { method: 'POST' });
      notify('Sincronización Haitani ↔ Sanzu completada con éxito');
      renderOverview();
    } catch (err) {
      notify('Error en sincronización Sanzu: ' + err.message);
      btn.disabled = false;
      btn.innerHTML = `${icon('external')} Reintentar Sanzu`;
    }
  });
}

async function renderKnowledge() {
  const hash = location.hash;
  const params = new URLSearchParams(hash.split('?')[1] || '');
  const search = params.get('search') || '';
  const category = params.get('category') || '';
  const phase = params.get('phase') || '';
  const methodology = params.get('methodology') || '';
  const projectId = params.get('project_id') || '';

  const queryParts = [];
  if (search) queryParts.push(`search=${encodeURIComponent(search)}`);
  if (category) queryParts.push(`category=${encodeURIComponent(category)}`);
  if (phase) queryParts.push(`phase=${encodeURIComponent(phase)}`);
  if (methodology) queryParts.push(`methodology=${encodeURIComponent(methodology)}`);
  if (projectId) queryParts.push(`project_id=${encodeURIComponent(projectId)}`);
  const queryStr = queryParts.length ? `?${queryParts.join('&')}` : '';

  let docs = [];
  let projects = [];
  let tasks = [];
  try {
    docs = await api(`/knowledge${queryStr}`);
    projects = await api('/projects').catch(() => []);
    tasks = await api('/tasks').catch(() => []);
  } catch (err) {
    return layout(`
      ${heading('Knowledge Center', 'Documentación y Metodología')}
      <div class="alert mt-4">Error al cargar documentación: ${esc(err.message)}</div>
    `);
  }

  const categories = ['arquitectura', 'requerimientos', 'guias', 'actas', 'diseno', 'plantillas', 'general'];
  const phases = ['inicio', 'planificacion', 'ejecucion', 'cierre'];
  const methods = ['AGILE', 'SCRUM', 'KANBAN', 'XP', 'LEAN', 'WATERFALL', 'HYBRID'];

  const markup = `
    ${heading('Knowledge Center', 'Repositorio centralizado de documentación, metodologías, arquitectura y plantillas', `
      <button class="btn" id="open-upload-modal">${icon('upload')} Subir Documento</button>
    `)}

    <div class="card p-3 mt-4">
      <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:var(--sp-2); align-items:end">
        <label>
          Búsqueda
          <input class="input" id="knowledge-search" placeholder="Nombre, descripción..." value="${esc(search)}">
        </label>
        <label>
          Categoría
          <select class="select" id="filter-category">
            <option value="">Todas</option>
            ${categories.map(c => `<option value="${c}" ${c === category ? 'selected' : ''}>${c.charAt(0).toUpperCase() + c.slice(1)}</option>`).join('')}
          </select>
        </label>
        <label>
          Fase
          <select class="select" id="filter-phase">
            <option value="">Todas</option>
            ${phases.map(ph => `<option value="${ph}" ${ph === phase ? 'selected' : ''}>${ph.charAt(0).toUpperCase() + ph.slice(1)}</option>`).join('')}
          </select>
        </label>
        <label>
          Metodología
          <select class="select" id="filter-method">
            <option value="">Todas</option>
            ${methods.map(m => `<option value="${m}" ${m === methodology ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
        </label>
        <label>
          Proyecto
          <select class="select" id="filter-project">
            <option value="">Todos</option>
            ${projects.map(pr => `<option value="${pr.id}" ${String(pr.id) === projectId ? 'selected' : ''}>${esc(pr.name)}</option>`).join('')}
          </select>
        </label>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:var(--sp-2);margin-top:var(--sp-2)">
        <button class="btn secondary" id="knowledge-reset-filters">Limpiar Filtros</button>
        <button class="btn" id="knowledge-apply-filters">${icon('search')} Buscar</button>
      </div>
    </div>

    <div class="card mt-4 p-4">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-3)">
        <h3 style="margin:0">Documentos Disponibles (${docs.length})</h3>
      </div>
      ${docs.length ? `
        <div style="display:grid;gap:var(--sp-3)">
          ${docs.map(doc => {
            const sizeKb = doc.size ? Math.round(doc.size / 1024) : 0;
            return `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--bg-glass);border-radius:var(--r-md);border:1px solid var(--line);flex-wrap:wrap;gap:var(--sp-2)">
                <div style="display:flex;align-items:center;gap:var(--sp-3)">
                  ${icon('file')}
                  <div>
                    <div style="display:flex;align-items:center;gap:var(--sp-2);flex-wrap:wrap">
                      <strong style="font-size:0.95rem">${esc(doc.title || doc.filename)}</strong>
                      <span class="badge green">v${esc(doc.version || '1.0')}</span>
                      ${doc.category ? `<span class="badge yellow">${esc(doc.category)}</span>` : ''}
                      ${doc.phase ? `<span class="badge pink">${esc(doc.phase)}</span>` : ''}
                      ${doc.methodology ? `<span class="badge">${esc(doc.methodology)}</span>` : ''}
                    </div>
                    <div class="muted sub" style="margin-top:2px">
                      ${esc(doc.filename)} · ${sizeKb} KB · Subido por ${esc(doc.uploader_name || 'Usuario')} el ${esc((doc.created_at || '').slice(0, 10))}
                      ${doc.project_name ? ` · Proyecto: <strong>${esc(doc.project_name)}</strong>` : ''}
                      ${doc.task_title ? ` · Tarea: <strong>${esc(doc.task_title)}</strong>` : ''}
                      ${doc.tags ? ` · Tags: <em>${esc(doc.tags)}</em>` : ''}
                    </div>
                  </div>
                </div>
                <div class="actions" style="display:flex;gap:var(--sp-2)">
                  <a class="btn secondary" href="/api/knowledge/${doc.id}/download" download="${esc(doc.filename)}">
                    ${icon('download')} Descargar
                  </a>
                  <button class="btn secondary associate-btn" data-doc-id="${doc.id}">
                    ${icon('paperclip')} Asociar
                  </button>
                  <button class="btn secondary delete-doc-btn" data-doc-id="${doc.id}" style="color:var(--pink)">
                    ${icon('trash')}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : '<div class="empty">No se encontraron documentos con los filtros seleccionados.</div>'}
    </div>

    <div class="status-overlay" id="knowledge-upload-modal" style="display:none" role="dialog" aria-modal="true">
      <div class="status-viewer admin-modal-panel">
        <div class="status-viewer-head">
          <h3>Subir Documento al Knowledge Center</h3>
          <button type="button" class="btn secondary mini close-upload-modal">${icon('close')}</button>
        </div>
        <form class="p-4" id="upload-doc-form" style="display:grid;gap:var(--sp-3)">
          <label>
            Archivo (PDF, Word, Excel, Markdown, ZIP ≤ 10 MB) *
            <input class="input" type="file" name="file" required>
          </label>
          <label>
            Título Descriptivo
            <input class="input" name="title" placeholder="e.g. Arquitectura del Sistema Haitani Core">
          </label>
          <div class="grid" style="grid-template-columns:1fr 1fr;gap:var(--sp-2)">
            <label>
              Categoría
              <select class="select" name="category">
                ${categories.map(c => `<option value="${c}">${c.charAt(0).toUpperCase() + c.slice(1)}</option>`).join('')}
              </select>
            </label>
            <label>
              Fase
              <select class="select" name="phase">
                ${phases.map(ph => `<option value="${ph}">${ph.charAt(0).toUpperCase() + ph.slice(1)}</option>`).join('')}
              </select>
            </label>
          </div>
          <div class="grid" style="grid-template-columns:1fr 1fr;gap:var(--sp-2)">
            <label>
              Metodología
              <select class="select" name="methodology">
                <option value="">Ninguna</option>
                ${methods.map(m => `<option value="${m}">${m}</option>`).join('')}
              </select>
            </label>
            <label>
              Versión
              <input class="input" name="version" value="1.0" placeholder="1.0">
            </label>
          </div>
          <div class="grid" style="grid-template-columns:1fr 1fr;gap:var(--sp-2)">
            <label>
              Asociar a Proyecto
              <select class="select" name="project_id">
                <option value="">Sin proyecto</option>
                ${projects.map(pr => `<option value="${pr.id}">${esc(pr.name)}</option>`).join('')}
              </select>
            </label>
            <label>
              Asociar a Tarea
              <select class="select" name="task_id">
                <option value="">Sin tarea</option>
                ${tasks.map(t => `<option value="${t.id}">${esc(t.title.slice(0, 45))}</option>`).join('')}
              </select>
            </label>
          </div>
          <label>
            Etiquetas (separadas por coma)
            <input class="input" name="tags" placeholder="e.g. backend, database, specs, sanzu">
          </label>
          <div class="actions" style="display:flex;justify-content:flex-end;gap:var(--sp-2);margin-top:var(--sp-2)">
            <button type="button" class="btn secondary close-upload-modal">Cancelar</button>
            <button type="submit" class="btn" id="upload-submit-btn">${icon('upload')} Subir Documento</button>
          </div>
        </form>
      </div>
    </div>

    <div class="status-overlay" id="knowledge-associate-modal" style="display:none" role="dialog" aria-modal="true">
      <div class="status-viewer admin-modal-panel">
        <div class="status-viewer-head">
          <h3>Asociar Documento</h3>
          <button type="button" class="btn secondary mini close-associate-modal">${icon('close')}</button>
        </div>
        <form class="p-4" id="associate-doc-form" style="display:grid;gap:var(--sp-3)">
          <input type="hidden" name="file_id" id="associate-file-id">
          <label>
            Tipo de Asociación
            <select class="select" name="target_type" id="associate-target-type" required>
              <option value="project">Proyecto</option>
              <option value="task">Tarea</option>
              <option value="methodology">Metodología</option>
            </select>
          </label>
          <div id="associate-target-selector">
            <label>
              Seleccionar Proyecto
              <select class="select" name="target_id" id="associate-target-id" required>
                ${projects.map(pr => `<option value="${pr.id}">${esc(pr.name)}</option>`).join('')}
              </select>
            </label>
          </div>
          <div class="actions" style="display:flex;justify-content:flex-end;gap:var(--sp-2);margin-top:var(--sp-2)">
            <button type="button" class="btn secondary close-associate-modal">Cancelar</button>
            <button type="submit" class="btn">${icon('check')} Guardar Asociación</button>
          </div>
        </form>
      </div>
    </div>
  `;

  layout(markup);

  const applyFilters = () => {
    const sVal = document.querySelector('#knowledge-search').value.trim();
    const cVal = document.querySelector('#filter-category').value;
    const phVal = document.querySelector('#filter-phase').value;
    const mVal = document.querySelector('#filter-method').value;
    const prVal = document.querySelector('#filter-project').value;
    const pms = new URLSearchParams();
    if (sVal) pms.set('search', sVal);
    if (cVal) pms.set('category', cVal);
    if (phVal) pms.set('phase', phVal);
    if (mVal) pms.set('methodology', mVal);
    if (prVal) pms.set('project_id', prVal);
    location.hash = `#/${state.user.role}/knowledge?${pms.toString()}`;
  };

  document.querySelector('#knowledge-apply-filters')?.addEventListener('click', applyFilters);
  document.querySelector('#knowledge-search')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyFilters();
  });
  document.querySelector('#knowledge-reset-filters')?.addEventListener('click', () => {
    location.hash = `#/${state.user.role}/knowledge`;
  });

  const uploadModal = document.querySelector('#knowledge-upload-modal');
  document.querySelector('#open-upload-modal')?.addEventListener('click', () => {
    uploadModal.style.display = 'grid';
  });
  document.querySelectorAll('.close-upload-modal').forEach(btn => {
    btn.onclick = () => uploadModal.style.display = 'none';
  });

  document.querySelector('#upload-doc-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const submitBtn = document.querySelector('#upload-submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `${icon('progress')} Subiendo...`;
    try {
      await api('/knowledge/upload', { method: 'POST', body: formData });
      notify('Documento subido y catalogado exitosamente');
      uploadModal.style.display = 'none';
      renderKnowledge();
    } catch (err) {
      notify('Error al subir documento: ' + err.message);
      submitBtn.disabled = false;
      submitBtn.innerHTML = `${icon('upload')} Subir Documento`;
    }
  });

  const associateModal = document.querySelector('#knowledge-associate-modal');
  const targetTypeSelect = document.querySelector('#associate-target-type');
  const targetSelectorContainer = document.querySelector('#associate-target-selector');

  const updateTargetOptions = () => {
    const type = targetTypeSelect.value;
    if (type === 'project') {
      targetSelectorContainer.innerHTML = `
        <label>
          Seleccionar Proyecto
          <select class="select" name="target_id" required>
            ${projects.map(pr => `<option value="${pr.id}">${esc(pr.name)}</option>`).join('')}
          </select>
        </label>
      `;
    } else if (type === 'task') {
      targetSelectorContainer.innerHTML = `
        <label>
          Seleccionar Tarea
          <select class="select" name="target_id" required>
            ${tasks.map(t => `<option value="${t.id}">${esc(t.title)}</option>`).join('')}
          </select>
        </label>
      `;
    } else if (type === 'methodology') {
      targetSelectorContainer.innerHTML = `
        <label>
          Seleccionar Metodología
          <select class="select" name="target_id" required>
            ${methods.map(m => `<option value="${m}">${m}</option>`).join('')}
          </select>
        </label>
      `;
    }
  };

  targetTypeSelect?.addEventListener('change', updateTargetOptions);

  document.querySelectorAll('.associate-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelector('#associate-file-id').value = btn.dataset.docId;
      targetTypeSelect.value = 'project';
      updateTargetOptions();
      associateModal.style.display = 'grid';
    };
  });

  document.querySelectorAll('.close-associate-modal').forEach(btn => {
    btn.onclick = () => associateModal.style.display = 'none';
  });

  document.querySelector('#associate-doc-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.target));
    try {
      await api('/knowledge/associate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      notify('Asociación guardada exitosamente');
      associateModal.style.display = 'none';
      renderKnowledge();
    } catch (err) {
      notify('Error al asociar documento: ' + err.message);
    }
  });

  document.querySelectorAll('.delete-doc-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('¿Seguro que deseas eliminar este documento del repositorio?')) return;
      try {
        await api(`/knowledge/${btn.dataset.docId}`, { method: 'DELETE' });
        notify('Documento eliminado');
        renderKnowledge();
      } catch (err) {
        notify('Error al eliminar: ' + err.message);
      }
    };
  });
}

async function renderRisks() {
  let overview = null;
  let projects = [];
  try {
    overview = await api('/risks/overview');
    projects = await api('/projects').catch(() => []);
  } catch (err) {
    return layout(`
      ${heading('Risk Center & Eventos', 'Monitoreo de riesgos y eventos')}
      <div class="alert mt-4">Error al cargar Risk Center: ${esc(err.message)}</div>
    `);
  }

  const s = overview.summary || { totalRisks: 0, criticalRisks: 0, overloadedMembers: 0, activeEvents: 0 };
  const risks = overview.risks || [];
  const workload = overview.workload || [];
  const events = overview.events || [];

  const markup = `
    ${heading('Risk Center & Eventos', 'Monitoreo proactivo de riesgos de proyecto, eventos del sistema y capacidad del equipo', `
      <div class="actions">
        <button class="btn secondary" id="detect-events-btn">
          ${icon('activity')} Detectar Eventos del Sistema
        </button>
        <button class="btn" id="open-risk-modal">
          ${icon('plus')} Registrar Riesgo
        </button>
      </div>
    `)}

    <div class="grid stats dashboard-stats mt-4">
      <div class="card stat stat-primary">
        <div class="stat-header"><div class="label">Riesgos Activos</div>${icon('alertTriangle')}</div>
        <div class="num">${s.totalRisks}</div>
        <div class="stat-footer-sub">En todos los proyectos</div>
      </div>
      <div class="card stat">
        <div class="stat-header"><div class="label">Riesgos Críticos</div>${icon('shield')}</div>
        <div class="num" style="color:${s.criticalRisks > 0 ? 'var(--pink)' : 'inherit'}">${s.criticalRisks}</div>
        <div class="stat-footer-sub">Severidad ≥ 15 (Prob x Imp)</div>
      </div>
      <div class="card stat">
        <div class="stat-header"><div class="label">Eventos del Sistema</div>${icon('bell')}</div>
        <div class="num" style="color:${events.length > 0 ? 'var(--pink)' : 'inherit'}">${events.length}</div>
        <div class="stat-footer-sub">Alertas operativas pendientes</div>
      </div>
      <div class="card stat">
        <div class="stat-header"><div class="label">Integrantes en Sobrecarga</div>${icon('users')}</div>
        <div class="num" style="color:${s.overloadedMembers > 0 ? 'var(--pink)' : 'inherit'}">${s.overloadedMembers}</div>
        <div class="stat-footer-sub">Capacidad asignada > 100%</div>
      </div>
    </div>

    <div class="card p-4 mt-4">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-3)">
        <div style="display:flex;align-items:center;gap:var(--sp-2)">
          ${icon('activity')}
          <div>
            <h3 style="margin:0">Eventos Automáticos del Sistema Haitani</h3>
            <p class="muted sub" style="margin:0">Detección continua de tareas vencidas, bloqueos, sobrecargas y plazos límite.</p>
          </div>
        </div>
        <span class="badge ${events.length > 0 ? 'pink' : 'green'}">${events.length} Activos</span>
      </div>
      ${events.length ? `
        <div style="display:grid;gap:var(--sp-2)">
          ${events.map(ev => {
            const sevBadge = ev.severity === 'critical' || ev.severity === 'high' ? 'pink' : ev.severity === 'medium' ? 'yellow' : 'green';
            return `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--bg-glass);border-radius:var(--r-md);border:1px solid var(--line);flex-wrap:wrap;gap:var(--sp-2)">
                <div style="display:flex;align-items:center;gap:var(--sp-3)">
                  <span class="badge ${sevBadge}">${esc(ev.severity.toUpperCase())}</span>
                  <div>
                    <strong style="font-size:0.95rem">${esc(ev.title)}</strong>
                    <div class="muted sub">${esc(ev.description || '')} · Detectado: ${esc(new Date(ev.created_at).toLocaleString())}</div>
                  </div>
                </div>
                <button class="btn secondary resolve-event-btn" data-event-id="${ev.id}">
                  ${icon('check')} Resolver
                </button>
              </div>
            `;
          }).join('')}
        </div>
      ` : '<div class="empty">No hay eventos pendientes. El sistema no detecta anomalías operativas.</div>'}
    </div>

    <div class="card p-4 mt-4">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-3)">
        <div>
          <h3 style="margin:0">Team Workload & Capacidad Asignada</h3>
          <p class="muted sub" style="margin:0">Distribución de tareas y porcentaje de capacidad operativa por integrante.</p>
        </div>
      </div>
      ${workload.length ? `
        <div class="grid" style="grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:var(--sp-3)">
          ${workload.map(mem => {
            const pct = mem.capacity_percentage || 0;
            const barColor = pct > 100 ? 'var(--pink)' : pct >= 70 ? 'var(--yellow)' : 'var(--green)';
            const statusBadge = mem.workload_status === 'overloaded' ? 'badge pink' : mem.workload_status === 'high' ? 'badge yellow' : 'badge green';
            const statusText = mem.workload_status === 'overloaded' ? 'Sobrecargado' : mem.workload_status === 'high' ? 'Carga Alta' : 'Normal';
            return `
              <div style="padding:14px;background:var(--bg-glass);border-radius:var(--r-md);border:1px solid var(--line)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                  <strong style="font-size:0.95rem">${esc(mem.name)}</strong>
                  <span class="${statusBadge}">${statusText}</span>
                </div>
                <div class="muted sub" style="margin-bottom:8px">${esc(mem.email)} · ${mem.active_tasks} tareas activas</div>
                <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:4px">
                  <span>Capacidad Utilizada</span>
                  <strong>${pct}%</strong>
                </div>
                <div class="health-meter-track" style="height:8px">
                  <i style="width:min(100%, ${pct}%);background:${barColor}"></i>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : '<div class="empty">No hay integrantes registrados.</div>'}
    </div>

    <div class="card p-4 mt-4">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-3)">
        <h3 style="margin:0">Matriz de Riesgos Identificados (${risks.length})</h3>
      </div>
      ${risks.length ? `
        <div style="display:grid;gap:var(--sp-3)">
          ${risks.map(r => {
            const score = r.severity_score || (r.probability * r.impact) || 1;
            const scoreBadge = score >= 15 ? 'badge pink' : score >= 8 ? 'badge yellow' : 'badge green';
            const statusClass = r.status === 'cerrado' ? 'badge green' : r.status === 'mitigando' ? 'badge yellow' : 'badge';
            return `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:14px;background:var(--bg-glass);border-radius:var(--r-md);border:1px solid var(--line);flex-wrap:wrap;gap:var(--sp-2)">
                <div style="max-width:70%">
                  <div style="display:flex;align-items:center;gap:var(--sp-2);flex-wrap:wrap">
                    <strong style="font-size:1rem">${esc(r.title)}</strong>
                    <span class="${scoreBadge}">Score: ${score}</span>
                    <span class="${statusClass}">${esc(r.status.toUpperCase())}</span>
                    <span class="badge">${esc(r.category)}</span>
                  </div>
                  <p class="muted" style="margin:4px 0">${esc(r.description || 'Sin descripción.')}</p>
                  <div style="font-size:0.88rem;margin-top:4px">
                    <span><strong>Probabilidad:</strong> ${r.probability}/5</span> ·
                    <span><strong>Impacto:</strong> ${r.impact}/5</span>
                    ${r.project_name ? ` · Proyecto: <strong>${esc(r.project_name)}</strong>` : ''}
                  </div>
                  ${r.mitigation ? `<div style="font-size:0.88rem;margin-top:4px;color:var(--text)"><strong>Plan de Mitigación:</strong> ${esc(r.mitigation)}</div>` : ''}
                </div>
                <div class="actions" style="display:flex;gap:var(--sp-2)">
                  <button class="btn secondary toggle-risk-btn" data-risk-id="${r.id}" data-current-status="${r.status}">
                    ${r.status === 'cerrado' ? 'Reabrir' : 'Mitigar/Cerrar'}
                  </button>
                  <button class="btn secondary delete-risk-btn" data-risk-id="${r.id}" style="color:var(--pink)">
                    ${icon('trash')}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : '<div class="empty">No hay riesgos registrados en la matriz.</div>'}
    </div>

    <div class="status-overlay" id="risk-modal" style="display:none" role="dialog" aria-modal="true">
      <div class="status-viewer admin-modal-panel">
        <div class="status-viewer-head">
          <h3>Registrar Nuevo Riesgo</h3>
          <button type="button" class="btn secondary mini close-risk-modal">${icon('close')}</button>
        </div>
        <form class="p-4" id="create-risk-form" style="display:grid;gap:var(--sp-3)">
          <label>
            Título del Riesgo *
            <input class="input" name="title" required placeholder="e.g. Demora en aprobación de requerimientos">
          </label>
          <label>
            Descripción
            <textarea class="textarea" name="description" rows="2" placeholder="Detalle y contexto del riesgo..."></textarea>
          </label>
          <div class="grid" style="grid-template-columns:1fr 1fr;gap:var(--sp-2)">
            <label>
              Categoría
              <select class="select" name="category">
                <option value="tecnico">Técnico</option>
                <option value="alcance">Alcance</option>
                <option value="tiempo">Tiempo / Cronograma</option>
                <option value="recursos">Recursos / Equipo</option>
                <option value="externo">Externo</option>
              </select>
            </label>
            <label>
              Proyecto
              <select class="select" name="project_id">
                <option value="">General / Ninguno</option>
                ${projects.map(pr => `<option value="${pr.id}">${esc(pr.name)}</option>`).join('')}
              </select>
            </label>
          </div>
          <div class="grid" style="grid-template-columns:1fr 1fr;gap:var(--sp-2)">
            <label>
              Probabilidad (1 = Rara, 5 = Casi segura)
              <select class="select" name="probability">
                <option value="1">1 - Muy Baja</option>
                <option value="2">2 - Baja</option>
                <option value="3" selected>3 - Media</option>
                <option value="4">4 - Alta</option>
                <option value="5">5 - Muy Alta</option>
              </select>
            </label>
            <label>
              Impacto (1 = Mínimo, 5 = Crítico)
              <select class="select" name="impact">
                <option value="1">1 - Insignificante</option>
                <option value="2">2 - Menor</option>
                <option value="3" selected>3 - Moderado</option>
                <option value="4">4 - Mayor</option>
                <option value="5">5 - Crítico</option>
              </select>
            </label>
          </div>
          <label>
            Estrategia de Mitigación / Contingencia
            <textarea class="textarea" name="mitigation" rows="3" placeholder="Acciones preventivas y correctivas..."></textarea>
          </label>
          <div class="actions" style="display:flex;justify-content:flex-end;gap:var(--sp-2);margin-top:var(--sp-2)">
            <button type="button" class="btn secondary close-risk-modal">Cancelar</button>
            <button type="submit" class="btn">${icon('check')} Guardar Riesgo</button>
          </div>
        </form>
      </div>
    </div>
  `;

  layout(markup);

  const riskModal = document.querySelector('#risk-modal');
  document.querySelector('#open-risk-modal')?.addEventListener('click', () => {
    riskModal.style.display = 'grid';
  });
  document.querySelectorAll('.close-risk-modal').forEach(btn => {
    btn.onclick = () => riskModal.style.display = 'none';
  });

  document.querySelector('#detect-events-btn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.innerHTML = `${icon('progress')} Detectando anomalías...`;
    try {
      const res = await api('/events/detect', { method: 'POST' });
      notify(`Detección completada: ${res.detected} eventos analizados`);
      renderRisks();
    } catch (err) {
      notify('Error al ejecutar detección: ' + err.message);
      btn.disabled = false;
      btn.innerHTML = `${icon('activity')} Detectar Eventos del Sistema`;
    }
  });

  document.querySelectorAll('.resolve-event-btn').forEach(btn => {
    btn.onclick = async () => {
      try {
        await api(`/events/${btn.dataset.eventId}/resolve`, { method: 'POST' });
        notify('Evento marcado como resuelto');
        renderRisks();
      } catch (err) {
        notify('Error al resolver evento: ' + err.message);
      }
    };
  });

  document.querySelector('#create-risk-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.target));
    values.probability = Number(values.probability);
    values.impact = Number(values.impact);
    if (!values.project_id) delete values.project_id;
    try {
      await api('/risks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      notify('Riesgo registrado en la matriz');
      riskModal.style.display = 'none';
      renderRisks();
    } catch (err) {
      notify('Error al guardar riesgo: ' + err.message);
    }
  });

  document.querySelectorAll('.toggle-risk-btn').forEach(btn => {
    btn.onclick = async () => {
      const current = btn.dataset.currentStatus;
      const next = current === 'identificado' ? 'mitigando' : current === 'mitigando' ? 'cerrado' : 'identificado';
      try {
        await api(`/risks/${btn.dataset.riskId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: next })
        });
        notify(`Estado de riesgo actualizado a: ${next}`);
        renderRisks();
      } catch (err) {
        notify('Error al actualizar estado: ' + err.message);
      }
    };
  });

  document.querySelectorAll('.delete-risk-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('¿Seguro que deseas eliminar este riesgo?')) return;
      try {
        await api(`/risks/${btn.dataset.riskId}`, { method: 'DELETE' });
        notify('Riesgo eliminado');
        renderRisks();
      } catch (err) {
        notify('Error al eliminar: ' + err.message);
      }
    };
  });
}

const appRender=render;
render=async function(){
  if(slowLoaderTimer) clearTimeout(slowLoaderTimer);
  slowLoaderTimer=setTimeout(showSlowLoader,10000);
  try{
    if(location.hash.includes('relax'))return await renderRelax();
    return await appRender();
  } catch(error){
    console.error('Error al renderizar vista:', error);
    if(app && (!app.children || !app.children.length || !app.innerHTML.trim())){
      app.innerHTML = `<div class="login"><div class="login-box"><div class="eyebrow">Recuperación de vista</div><h2>No fue posible cargar esta vista</h2><p class="muted">${esc(error.message || 'Ocurrió un error inesperado al inicializar la pantalla.')}</p><div class="actions"><a class="btn" href="#/">Ir al inicio</a><button class="btn secondary" onclick="location.reload()">Reintentar</button></div></div></div>`;
    }
  } finally {
    hideSlowLoader();
  }
};
window.addEventListener('hashchange',render);render();