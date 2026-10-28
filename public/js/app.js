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
  info: '<circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.3"/><circle cx="10" cy="7" r="0.9" fill="currentColor"/><path d="M10 9.2v5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  copy: '<rect x="5" y="5" width="10" height="10" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M7 5V4.5A1 1 0 0 1 8 3.5h6a1 1 0 0 1 1 1V9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  clipboard: '<path d="M7.2 4.4h5.6a1.2 1.2 0 0 1 1.2 1.2v9.8a1.2 1.2 0 0 1-1.2 1.2H7.2A1.2 1.2 0 0 1 6 15.4V5.6a1.2 1.2 0 0 1 1.2-1.2ZM8 4.4V3.2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.2" stroke="currentColor" stroke-width="1.3"/><line x1="8" y1="9.2" x2="12" y2="9.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="8" y1="12" x2="11.2" y2="12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  undo: '<path d="M6.2 7.5H11a4 4 0 1 1 0 8H8.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.2 7.5L8.7 5M6.2 7.5L8.7 10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
  redo: '<path d="M13.8 7.5H9a4 4 0 1 0 0 8h2.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.8 7.5L11.3 5M13.8 7.5L11.3 10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
  roller: '<rect x="3" y="3" width="10.4" height="3.4" rx="1.2" stroke="currentColor" stroke-width="1.3"/><line x1="8.2" y1="6.6" x2="8.2" y2="10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><rect x="6.3" y="10" width="3.8" height="5.4" rx="1" stroke="currentColor" stroke-width="1.3"/>',
  arrowUp: '<path d="M10 15V5m0 0L5.5 9.5M10 5l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  menu: '<line x1="3.5" y1="5.5" x2="16.5" y2="5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="3.5" y1="10" x2="16.5" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="3.5" y1="14.5" x2="16.5" y2="14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  dashboard: '<rect x="3" y="3" width="5.5" height="5.5" rx="1.2" stroke="currentColor" stroke-width="1.3"/><rect x="11.5" y="3" width="5.5" height="5.5" rx="1.2" stroke="currentColor" stroke-width="1.3"/><rect x="3" y="11.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" stroke-width="1.3"/><rect x="11.5" y="11.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" stroke-width="1.3"/>',
  announcements: '<path d="M14 5.5l-6 2H4a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h4l6 2V5.5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M16 8a3 3 0 0 1 0 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M6 12.5v3.2a.8.8 0 0 0 .8.8h.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  calendar: '<rect x="3" y="4" width="14" height="13" rx="1.5" stroke="currentColor" stroke-width="1.3"/><line x1="3" y1="8" x2="17" y2="8" stroke="currentColor" stroke-width="1.3"/><line x1="6.8" y1="2.5" x2="6.8" y2="4.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="13.2" y1="2.5" x2="13.2" y2="4.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  flag: '<path d="M5 3.5v13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M5 4h7.5l-1.1 2.3L12.5 9H5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  chevronLeft: '<path d="M12.5 4.5L7 10l5.5 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  chevronRight: '<path d="M7.5 4.5L13 10l-5.5 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  chevronUp: '<path d="M4.5 12.5L10 7l5.5 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  chevronDown: '<path d="M4.5 7.5L10 13l5.5-5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
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
let ganttProjectId = '';
let ganttTimeScale = 'week';
let ganttShowCriticalPath = false;
let ganttShowBaselines = false;
let ganttCollapsedTasks = new Set();
let ganttDataCache = null;
let ganttCalendarCollapsed = false;
let ganttActiveTab = 'gantt'; // 'gantt' (Cronograma) | 'calendar' (Calendario) | 'resources' (Recursos)
let ganttViewLeftDate = null;       // fecha que estaba en el borde izquierdo antes de redibujar
let ganttRenderedDayWidth = null;   // ancho de día con el que se dibujó la última vez
let ganttPendingScrollDate = null;  // fecha a la que hay que ir al abrir el cronograma
let ganttMenuCloserReady = false;
let ganttQuickFilter = '';          // '' | 'overdue' | 'soon' | 'progress' (tarjetas de resumen)
let ganttTaskIndex = new Map();     // tareas dibujadas, para el globo de información
let ganttCalendarMode = 'deadlines'; // 'deadlines' (fechas de entrega) | 'duration' (duración completa)
let ganttCalendarSelected = null;    // día elegido en el calendario (AAAA-MM-DD)
let ganttMilestones = [];            // hitos del proyecto (tabla project_milestones) para el cronograma
let ganttSprints = [];               // sprints del proyecto para pintarlos en el cronograma
let ganttSelectedTaskId = null;
let ganttSearchFilter = '';
let ganttTableWidth = 460;
let ganttCalendarMonth = (() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d })();
let ganttChartZoom = 32;
let ganttChartMinDate = null;
const GANTT_WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const GANTT_DOW_SHORT = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];
function parseGanttDate(dateVal) {
  if (!dateVal) return null;
  if (dateVal instanceof Date) {
    return isNaN(dateVal.getTime()) ? null : new Date(dateVal.getFullYear(), dateVal.getMonth(), dateVal.getDate(), 0, 0, 0, 0);
  }
  const s = String(dateVal).trim();
  if (!s) return null;
  const match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    const y = parseInt(match[1], 10);
    const m = parseInt(match[2], 10) - 1;
    const d = parseInt(match[3], 10);
    const date = new Date(y, m, d, 0, 0, 0, 0);
    return isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(s);
  if (isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0);
}

function toISODate(date) {
  if (!date) return '';
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) return date.trim();
  const d = parseGanttDate(date);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatGanttDate(dateVal, includeYear = false) {
  const d = parseGanttDate(dateVal);
  if (!d) return '-';
  const year = d.getFullYear();
  const day = d.getDate();
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const monthName = months[d.getMonth()] || '';
  const curYear = new Date().getFullYear();
  if (includeYear || year !== curYear) {
    return `${day} ${monthName} ${year}`;
  }
  return `${day} ${monthName}`;
}
function startOfWeekMonday(date) { const d = parseGanttDate(date) || new Date(); const offset = (d.getDay() + 6) % 7; d.setDate(d.getDate() - offset); d.setHours(0, 0, 0, 0); return d }
function addDays(dateStr, delta) { const base = parseGanttDate(dateStr) || new Date(); base.setDate(base.getDate() + delta); return toISODate(base); }
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
        ['/admin/milestones','Hitos','flag'],
        ['/admin/issues','Incidencias','alertTriangle'],
        ['/admin/methodologies','Metodologías','bookOpen'],
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
        ['/member/milestones','Hitos','flag'],
        ['/member/issues','Incidencias','alertTriangle'],
        ['/member/methodologies','Metodologías','bookOpen'],
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
function methodologyWidgets(project){const method=project?.methodology_id;const links=[];links.push(`<a class="btn secondary" href="#/${state.user.role}/sprints">${icon('gantt')}Ver Sprints</a>`);if(['SCRUM','KANBAN','XP','AGILE'].includes(method))links.push(`<a class="btn secondary" href="#/${state.user.role}/kanban">${icon('kanban')}Abrir tablero</a>`);if(method==='WATERFALL'||method==='LEAN'||method==='HYBRID')links.push(`<a class="btn secondary" href="#/${state.user.role}/gantt">${icon('gantt')}Abrir hitos y Gantt</a>`);links.push(`<a class="btn secondary" href="#/${state.user.role}/milestones?project=${project?.id}">${icon('flag')}Hitos</a>`);if(project?.id)links.push(`<button type="button" class="btn secondary" id="dash-new-project-task" data-project-id="${project.id}">${icon('plus')}Nueva tarea</button>`);return `<div class="actions mt-3"><span class="muted">${method?`Flujo recomendado: ${esc(method)}`:'Define una metodología'}</span>${links.join('')}</div>`}
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
let githubProjectId=localStorage.getItem('haitani-github-project')||'';
function githubConfigForm(){return `<form id="github-quick-config" class="form-grid mt-3"><label class="full">URL del repositorio<input class="input" name="url" placeholder="https://github.com/usuario/proyecto" required></label><label class="full">Token de GitHub (solo si el repositorio es privado)<input class="input" name="token" type="password" autocomplete="off" placeholder="Déjalo vacío si el repositorio es público"></label><div class="actions full"><button class="btn">${icon('check')} Vincular repositorio</button></div></form>`}
async function githubView(section='repository'){const projects=await api('/projects').catch(()=>[]);if(!githubProjectId||!projects.some(p=>String(p.id)===String(githubProjectId)))githubProjectId=projects[0]?String(projects[0].id):'';const projectQuery=githubProjectId?`?project_id=${encodeURIComponent(githubProjectId)}`:'';const projectPicker=projects.length>1?`<select class="select" id="github-project" style="max-width:280px">${projects.map(p=>`<option value="${p.id}" ${String(p.id)===String(githubProjectId)?'selected':''}>${esc(p.name)}</option>`).join('')}</select>`:'';const data=await api(`/github/${section==='pulls'?'pull-requests':section}${projectQuery}`);const canConfigure=state.user.role==='admin';let body='';if(!data.configured)body=`<section class="card"><div class="empty">Este proyecto aún no tiene un repositorio de GitHub vinculado.</div>${canConfigure?githubConfigForm():'<p class="muted">Pide al administrador que lo vincule.</p>'}</section>`;else if(data.error)body=`<section class="card"><div class="alert">${esc(data.error)}</div>${canConfigure?githubConfigForm():''}</section>`;else if(section==='repository'){const r=data.data;body=`<div class="grid stats"><div class="card stat"><div class="label">Nombre</div><div class="num">${esc(r.name)}</div></div><div class="card stat"><div class="label">Lenguaje</div><div class="num lilac">${esc(r.language||'No disponible')}</div></div><div class="card stat"><div class="label">Estrellas</div><div class="num yellow">${r.stargazers_count}</div></div><div class="card stat"><div class="label">Última actualización</div><div class="num num-sm">${new Date(r.updated_at).toLocaleDateString('es')}</div></div></div><section class="card mt-4"><h2>${esc(r.full_name)}</h2><p class="muted">${esc(r.description||'No disponible')}</p><a class="btn" href="${esc(r.html_url)}" target="_blank">Abrir en GitHub</a></section>`}else if(section==='commits'){body=`<section class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Commit</th><th>Autor</th><th>Usuario GitHub</th><th>SHA</th><th>Fecha</th><th></th></tr></thead><tbody>${data.data.map(commit=>`<tr><td>${esc(commit.message)}</td><td>${esc(commit.author)}</td><td>${esc(commit.github_username||'No disponible')}</td><td><code>${esc(commit.sha)}</code></td><td>${esc(commit.date||'No disponible')}</td><td><a class="btn secondary" href="${esc(commit.url)}" target="_blank">Ver commit</a></td></tr>`).join('')||'<tr><td colspan="6" class="empty">No hay commits disponibles.</td></tr>'}</tbody></table></div></section>`}else if(section==='branches'){body=`<section class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Rama</th><th>Último commit</th><th></th></tr></thead><tbody>${data.data.map(b=>`<tr><td><strong>${esc(b.name)}</strong></td><td><code>${esc(b.sha)}</code></td><td>${b.url?`<a class="btn secondary" href="${esc(b.url)}" target="_blank">Ver en GitHub</a>`:''}</td></tr>`).join('')||'<tr><td colspan="3" class="empty">No hay ramas.</td></tr>'}</tbody></table></div></section>`}else{const rows=data.data;body=`<section class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Actividad</th><th>Usuario</th><th>Fecha</th><th></th></tr></thead><tbody>${rows.map(item=>`<tr><td>${esc(item.message||item.title||item.action||item.name)}</td><td>${esc(item.github_username||item.author||item.user||'No disponible')}</td><td>${esc(item.date||item.updated||'No disponible')}</td><td>${item.url?`<a class="btn secondary" href="${esc(item.url)}" target="_blank">Ver en GitHub</a>`:''}</td></tr>`).join('')}</tbody></table></div></section>`}return `${heading(section==='commits'?'Commits':'GitHub','Repositorio vinculado al proyecto seleccionado.')}<div class="actions" style="margin-bottom:16px">${projectPicker}<button class="btn secondary" data-gh="repository">Overview</button><button class="btn secondary" data-gh="commits">Commits</button><button class="btn secondary" data-gh="pulls">Pull Requests</button><button class="btn secondary" data-gh="branches">Branches</button><button class="btn secondary" data-gh="activity">Activity</button></div>${body}`}
async function renderGithub(section='repository'){try{layout(await githubView(section));document.querySelectorAll('[data-gh]').forEach(b=>b.onclick=()=>renderGithub(b.dataset.gh));document.querySelector('#github-project')?.addEventListener('change',e=>{githubProjectId=e.target.value;localStorage.setItem('haitani-github-project',githubProjectId);renderGithub(section)});document.querySelector('#github-quick-config')?.addEventListener('submit',async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{const values=Object.fromEntries(new FormData(e.target));const result=await api('/github/configure',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...values,project_id:githubProjectId})});notify(result.message||'Repositorio vinculado');renderGithub(section)}catch(error){notify(error.message);button.disabled=false}})}catch(error){layout(`${heading('GitHub','La integración de GitHub requiere un plan compatible.')}<section class="card"><div class="alert">${esc(error.message)}</div>${state.user.role==='admin'?'<a class="btn" href="#/admin/billing">Ver planes</a>':''}</section>`)}}
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
function signalSocket(){if(callState.socket?.readyState===WebSocket.OPEN)return callState.socket;const protocol=location.protocol==='https:'?'wss':'ws';callState.socket=new WebSocket(`${protocol}://${location.host}`);callState.socket.onopen=()=>callState.socket.send(JSON.stringify({type:'register',userId:state.user.id}));callState.socket.onmessage=event=>{const data=JSON.parse(event.data);handleCallSignal(data);if(window.handleChatSocketEvent)window.handleChatSocketEvent(data);};return callState.socket}
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

// =========================================================================
// MÓDULO DE MENSAJERÍA PREMIUM EN TIEMPO REAL (HAITANI)
// =========================================================================

const chatState = {
  activeType: null,      // 'direct' | 'group'
  activeId: null,        // userId | groupId
  activeDetail: null,    // user object or group detail
  conversations: { direct: [], groups: [], total_unread: 0 },
  messages: [],
  hasMore: false,
  loadingHistory: false,
  onlineUsers: new Set(),
  filterTab: 'all',      // 'all' | 'unread' | 'direct' | 'groups'
  searchTerm: '',
  replyingTo: null,      // message object
  editingMessage: null,  // message object
  drawerOpen: false,
  inChatSearchOpen: false,
  inChatSearchQuery: '',
  inChatSearchResults: [],
  inChatSearchIndex: -1,
  mediaRecorder: null,
  audioChunks: [],
  recordingInterval: null,
  recordingSeconds: 0,
  typingTimeout: null,
  isTypingSent: false
};

// Receptor global de eventos WebSocket de mensajería
window.handleChatSocketEvent = function(event) {
  if (!event || !event.type) return;

  switch (event.type) {
    case 'connected':
      if (Array.isArray(event.onlineUsers)) {
        chatState.onlineUsers = new Set(event.onlineUsers.map(Number));
        updateOnlinePresenceUI();
      }
      break;

    case 'presence:update':
      if (event.userId) {
        if (event.status === 'online') {
          chatState.onlineUsers.add(Number(event.userId));
        } else {
          chatState.onlineUsers.delete(Number(event.userId));
        }
        updateOnlinePresenceUI();
      }
      break;

    case 'typing:start':
    case 'typing:stop':
      handleTypingIndicatorEvent(event);
      break;

    case 'message:new':
      handleIncomingNewMessage(event.message);
      break;

    case 'message:read':
      handleIncomingReadReceipt(event);
      break;

    case 'message:edit':
      handleIncomingMessageEdit(event);
      break;

    case 'message:delete':
      handleIncomingMessageDelete(event);
      break;

    case 'message:reaction':
      handleIncomingMessageReaction(event);
      break;

    case 'message:pin':
      handleIncomingMessagePin(event);
      break;

    case 'group:created':
    case 'group:updated':
    case 'group:member_added':
    case 'group:member_removed':
    case 'group:removed':
      refreshConversationsListSilently();
      if (chatState.activeType === 'group' && String(chatState.activeId) === String(event.groupId)) {
        loadActiveChatMessages(true);
      }
      break;
  }
};

function updateOnlinePresenceUI() {
  document.querySelectorAll('[data-presence-user-id]').forEach(el => {
    const uid = Number(el.dataset.presenceUserId);
    const isOnline = chatState.onlineUsers.has(uid);
    el.classList.toggle('offline', !isOnline);
    el.style.display = isOnline ? 'block' : 'none';
  });

  const headerStatus = document.querySelector('#chat-header-status');
  if (headerStatus && chatState.activeType === 'direct') {
    const isOnline = chatState.onlineUsers.has(Number(chatState.activeId));
    headerStatus.textContent = isOnline ? 'En línea' : (chatState.activeDetail?.last_seen_at ? `Últ. vez ${formatLastSeen(chatState.activeDetail.last_seen_at)}` : 'Desconectado');
    headerStatus.style.color = isOnline ? '#10b981' : '';
  }
}

function handleTypingIndicatorEvent(event) {
  const isCurrentChat = (chatState.activeType === 'direct' && event.conversationType === 'direct' && String(chatState.activeId) === String(event.senderId)) ||
                        (chatState.activeType === 'group' && event.conversationType === 'group' && String(chatState.activeId) === String(event.groupId));

  const indicatorBar = document.querySelector('#typing-indicator-bar');
  const indicatorText = document.querySelector('#typing-indicator-text');

  if (isCurrentChat && indicatorBar && indicatorText) {
    if (event.type === 'typing:start') {
      indicatorText.textContent = `${esc(event.senderName || 'Alguien')} está escribiendo...`;
      indicatorBar.removeAttribute('hidden');
    } else {
      indicatorBar.setAttribute('hidden', '');
    }
  }

  // En la lista izquierda
  const snippet = document.querySelector(`#conv-snippet-${event.conversationType}-${event.conversationType === 'direct' ? event.senderId : event.groupId}`);
  if (snippet) {
    if (event.type === 'typing:start') {
      snippet.dataset.origText = snippet.textContent;
      snippet.textContent = 'escribiendo...';
      snippet.classList.add('typing-active');
    } else if (snippet.classList.contains('typing-active')) {
      snippet.textContent = snippet.dataset.origText || '';
      snippet.classList.remove('typing-active');
    }
  }
}

function handleIncomingNewMessage(message) {
  if (!message) return;
  const isMine = message.sender_id === state.user.id;
  const isCurrentChat = (chatState.activeType === 'direct' && message.conversation_type === 'direct' && (String(chatState.activeId) === String(message.sender_id) || (isMine && String(chatState.activeId) === String(message.receiver_id)))) ||
                        (chatState.activeType === 'group' && message.conversation_type === 'group' && String(chatState.activeId) === String(message.group_id));

  if (isCurrentChat) {
    // Si no está ya renderizado (por ejemplo idempotente)
    const existing = document.querySelector(`#msg-${message.id}`);
    if (!existing) {
      appendSingleMessageToDOM(message);
      // Marcar como leído
      if (!isMine) {
        sendSignal({
          type: 'message:read',
          conversationType: message.conversation_type,
          targetId: message.conversation_type === 'direct' ? message.sender_id : message.group_id,
          messageIds: [message.id]
        });
      }
    }
  }

  // Actualizar lista de conversaciones a la izquierda
  refreshConversationsListSilently();
}

function handleIncomingReadReceipt(event) {
  if (chatState.activeType === 'direct' && String(chatState.activeId) === String(event.readerId)) {
    document.querySelectorAll('.message.mine .message-ticks').forEach(tick => {
      tick.className = 'message-ticks read';
      tick.textContent = '✓✓';
    });
  }
}

function handleIncomingMessageEdit(event) {
  const el = document.querySelector(`#msg-${event.messageId} .message-text`);
  if (el) {
    el.textContent = event.content;
    const footer = document.querySelector(`#msg-${event.messageId} .message-footer`);
    if (footer && !footer.querySelector('.message-edited-tag')) {
      const tag = document.createElement('span');
      tag.className = 'message-edited-tag';
      tag.textContent = '(editado)';
      footer.prepend(tag);
    }
  }
}

function handleIncomingMessageDelete(event) {
  const el = document.querySelector(`#msg-${event.messageId}`);
  if (el) {
    const textEl = el.querySelector('.message-text');
    if (textEl) {
      textEl.textContent = '[Mensaje eliminado]';
      textEl.style.fontStyle = 'italic';
      textEl.style.opacity = '0.6';
    }
    el.querySelector('.message-image-wrap')?.remove();
    el.querySelector('.message-file-card')?.remove();
    el.querySelector('.message-voice-player')?.remove();
    el.querySelector('.message-reactions-row')?.remove();
    el.querySelector('.message-hover-actions')?.remove();
  }
}

function handleIncomingMessageReaction(event) {
  const row = document.querySelector(`#msg-${event.messageId} .message-reactions-row`);
  if (!row) return;
  row.innerHTML = renderReactionsPills(event.reactions, event.messageId);
}

function handleIncomingMessagePin(event) {
  const pinIcon = document.querySelector(`#msg-${event.messageId} .pin-indicator`);
  if (event.is_pinned) {
    if (!pinIcon) {
      const bubble = document.querySelector(`#msg-${event.messageId} .message-bubble`);
      bubble?.insertAdjacentHTML('beforeend', '<span class="pin-indicator" title="Mensaje fijado">📌</span>');
    }
  } else {
    pinIcon?.remove();
  }
  refreshPinnedBanner();
}

// -------------------------------------------------------------
// VISTA PRINCIPAL DE MENSAJERÍA
// -------------------------------------------------------------
async function messagesView(selectedId = null) {
  signalSocket();
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const groupParam = params.get('group');
  const userParam = selectedId || params.get('user');

  chatState.activeType = groupParam ? 'group' : (userParam ? 'direct' : null);
  chatState.activeId = groupParam ? Number(groupParam) : (userParam ? Number(userParam) : null);

  // Cargar datos en paralelo
  const [convData] = await Promise.all([
    api('/messages/conversations').catch(() => ({ direct: [], groups: [], total_unread: 0 }))
  ]);
  chatState.conversations = convData;

  // Si no hay chat seleccionado pero hay conversaciones disponibles en escritorio, preseleccionar la primera
  if (!chatState.activeId && window.innerWidth > 900) {
    if (convData.direct.length) {
      chatState.activeType = 'direct';
      chatState.activeId = convData.direct[0].id;
    } else if (convData.groups.length) {
      chatState.activeType = 'group';
      chatState.activeId = convData.groups[0].id;
    }
  }

  // Cargar detalles de chat activo
  let activeDetails = null;
  if (chatState.activeType === 'direct' && chatState.activeId) {
    activeDetails = convData.direct.find(u => Number(u.id) === Number(chatState.activeId));
    if (!activeDetails) {
      const allUsers = await api('/users').catch(() => []);
      activeDetails = allUsers.find(u => Number(u.id) === Number(chatState.activeId));
    }
  } else if (chatState.activeType === 'group' && chatState.activeId) {
    try {
      const grp = await api(`/messages/groups/${chatState.activeId}`);
      activeDetails = grp.group;
      activeDetails.members = grp.members || [];
      activeDetails.my_role = grp.my_role;
    } catch {}
  }
  chatState.activeDetail = activeDetails;

  const isChatOpenClass = chatState.activeId ? 'chat-open' : '';
  const isDrawerOpenClass = chatState.drawerOpen ? 'drawer-open' : '';

  return `
    <section class="messages-shell">
      <div class="messages-layout ${isChatOpenClass} ${isDrawerOpenClass}" id="messages-layout">
        <!-- 1. PANEL IZQUIERDO: CONVERSACIONES -->
        <aside class="conversation-list">
          <div class="conversation-list-header">
            <h2>${icon('chat')} Mensajes ${convData.total_unread > 0 ? `<span class="unread-badge">${convData.total_unread}</span>` : ''}</h2>
            <div class="conversation-header-actions">
              <button class="btn secondary mini" id="btn-create-direct" type="button" title="Nueva conversación">${icon('plus')} Directo</button>
              <button class="btn secondary mini" id="btn-create-group" type="button" title="Nuevo grupo">${icon('plus')} Grupo</button>
            </div>
          </div>

          <div class="chat-search-wrap">
            <div class="chat-search-box">
              ${icon('search')}
              <input type="text" id="chat-conversation-search" placeholder="Buscar personas, grupos o mensajes..." value="${esc(chatState.searchTerm)}">
              ${chatState.searchTerm ? '<button class="icon-btn mini" id="btn-clear-conv-search" type="button">×</button>' : ''}
            </div>
          </div>

          <div class="chat-filter-tabs">
            <button class="chat-filter-tab ${chatState.filterTab === 'all' ? 'active' : ''}" data-filter="all" type="button">Todas</button>
            <button class="chat-filter-tab ${chatState.filterTab === 'unread' ? 'active' : ''}" data-filter="unread" type="button">No leídas</button>
            <button class="chat-filter-tab ${chatState.filterTab === 'direct' ? 'active' : ''}" data-filter="direct" type="button">Directas</button>
            <button class="chat-filter-tab ${chatState.filterTab === 'groups' ? 'active' : ''}" data-filter="groups" type="button">Grupos</button>
          </div>

          <div class="conversation-scroll-area" id="conversation-list-items">
            ${renderConversationListItems()}
          </div>
        </aside>

        <!-- 2. PANEL CENTRAL: CHAT ACTIVO -->
        <main class="conversation" id="active-conversation-panel">
          ${chatState.activeId ? renderActiveChatPanel() : renderNoChatSelectedPanel()}
        </main>

        <!-- 3. PANEL DERECHO: DETALLES & INFO (DRAWER) -->
        <aside class="chat-drawer" id="chat-drawer-panel" ${chatState.drawerOpen ? '' : 'style="display:none;"'}>
          ${renderDrawerPanel()}
        </aside>
      </div>
    </section>
  `;
}

function renderConversationListItems() {
  const { direct, groups } = chatState.conversations;
  const term = chatState.searchTerm.toLowerCase().trim();
  const filter = chatState.filterTab;

  let filteredDirect = direct;
  let filteredGroups = groups;

  if (filter === 'unread') {
    filteredDirect = filteredDirect.filter(c => c.unread_count > 0);
    filteredGroups = filteredGroups.filter(c => c.unread_count > 0);
  } else if (filter === 'direct') {
    filteredGroups = [];
  } else if (filter === 'groups') {
    filteredDirect = [];
  }

  if (term) {
    filteredDirect = filteredDirect.filter(c => (c.name || '').toLowerCase().includes(term) || (c.username || '').toLowerCase().includes(term));
    filteredGroups = filteredGroups.filter(c => (c.name || '').toLowerCase().includes(term) || (c.project_name || '').toLowerCase().includes(term));
  }

  if (!filteredDirect.length && !filteredGroups.length) {
    return '<div class="chat-empty-state" style="padding:40px 10px;">No se encontraron conversaciones.</div>';
  }

  let html = '';

  // Direct conversations
  if (filteredDirect.length) {
    if (filter === 'all') html += '<div class="conversation-label">Directos</div>';
    html += filteredDirect.map(user => {
      const isActive = chatState.activeType === 'direct' && String(chatState.activeId) === String(user.id);
      const isOnline = chatState.onlineUsers.has(Number(user.id)) || user.online;
      const snippet = user.last_message ? (user.last_message.content || (user.last_message.message_type === 'image' ? '📷 Imagen' : user.last_message.message_type === 'audio' ? '🎤 Nota de voz' : '📎 Archivo')) : 'Inicia una conversación';
      const timeStr = user.last_message?.created_at ? timeShort(user.last_message.created_at) : '';

      return `
        <button type="button" class="conversation-user ${isActive ? 'active' : ''}" data-conv-type="direct" data-conv-id="${user.id}">
          <div class="conversation-user-avatar-wrap">
            ${avatarMarkup(user, 'message-avatar')}
            <span class="conversation-presence-dot ${isOnline ? '' : 'offline'}" data-presence-user-id="${user.id}"></span>
          </div>
          <div class="conversation-user-content">
            <div class="conversation-user-top">
              <strong>${esc(user.name)}</strong>
              <time>${esc(timeStr)}</time>
            </div>
            <div class="conversation-user-bottom">
              <span class="conversation-snippet" id="conv-snippet-direct-${user.id}">${esc(snippet)}</span>
              <div class="conversation-badges">
                ${user.is_pinned ? '<span class="conv-meta-icon" title="Fijado">📌</span>' : ''}
                ${user.is_muted ? '<span class="conv-meta-icon" title="Silenciado">🔕</span>' : ''}
                ${user.unread_count > 0 ? `<span class="unread-badge">${user.unread_count}</span>` : ''}
              </div>
            </div>
          </div>
        </button>
      `;
    }).join('');
  }

  // Groups
  if (filteredGroups.length) {
    if (filter === 'all') html += '<div class="conversation-label" style="margin-top:12px;">Grupos</div>';
    html += filteredGroups.map(group => {
      const isActive = chatState.activeType === 'group' && String(chatState.activeId) === String(group.id);
      const snippet = group.last_message ? `${group.last_message.sender_name ? group.last_message.sender_name + ': ' : ''}${group.last_message.content || (group.last_message.message_type === 'image' ? '📷 Imagen' : group.last_message.message_type === 'audio' ? '🎤 Nota de voz' : '📎 Archivo')}` : 'Grupo creado';
      const timeStr = group.last_message?.created_at ? timeShort(group.last_message.created_at) : '';

      return `
        <button type="button" class="conversation-user ${isActive ? 'active' : ''}" data-conv-type="group" data-conv-id="${group.id}">
          <div class="conversation-user-avatar-wrap">
            <span class="message-avatar group-avatar" style="background:#4f46e5;color:#fff;">${esc(group.name.slice(0, 2).toUpperCase())}</span>
          </div>
          <div class="conversation-user-content">
            <div class="conversation-user-top">
              <strong>${esc(group.name)}</strong>
              <time>${esc(timeStr)}</time>
            </div>
            <div class="conversation-user-bottom">
              <span class="conversation-snippet" id="conv-snippet-group-${group.id}">${esc(snippet)}</span>
              <div class="conversation-badges">
                ${group.project_name ? `<span class="badge mini" style="font-size:10px;">${esc(group.project_name)}</span>` : ''}
                ${group.unread_count > 0 ? `<span class="unread-badge">${group.unread_count}</span>` : ''}
              </div>
            </div>
          </div>
        </button>
      `;
    }).join('');
  }

  return html;
}

function renderNoChatSelectedPanel() {
  return `
    <div class="chat-empty-state">
      ${icon('chat')}
      <h3 style="margin:16px 0 8px;font-size:18px;">Tus mensajes en tiempo real</h3>
      <p class="muted">Selecciona una conversación a la izquierda o inicia una nueva charla con un integrante o equipo de tu organización.</p>
    </div>
  `;
}

function renderActiveChatPanel() {
  const detail = chatState.activeDetail;
  const isDirect = chatState.activeType === 'direct';
  const name = isDirect ? (detail?.name || 'Contacto') : (detail?.name || 'Grupo');
  const isOnline = isDirect && chatState.onlineUsers.has(Number(chatState.activeId));
  const subtitle = isDirect
    ? (isOnline ? 'En línea' : (detail?.last_seen_at ? `Últ. vez ${formatLastSeen(detail.last_seen_at)}` : 'Desconectado'))
    : `${detail?.members?.length || detail?.members_count || 1} miembros${detail?.project_name ? ` · Proyecto: ${detail.project_name}` : ''}`;

  return `
    <!-- Header -->
    <header class="conversation-header">
      <div class="conversation-who">
        <button type="button" class="mobile-back-btn" id="btn-chat-back" aria-label="Volver">←</button>
        ${isDirect ? avatarMarkup(detail, 'message-avatar') : '<span class="message-avatar group-avatar" style="background:#4f46e5;color:#fff;">G</span>'}
        <div class="conversation-who-info">
          <h2>${esc(name)}</h2>
          <small id="chat-header-status" style="${isOnline ? 'color:#10b981;font-weight:500;' : ''}">${esc(subtitle)}</small>
        </div>
      </div>

      <div class="conversation-tools">
        <button class="icon-btn" id="toggle-inchat-search" type="button" title="Buscar en esta conversación" aria-label="Buscar">${icon('search')}</button>
        ${isDirect ? `<button class="icon-btn call-user" data-id="${chatState.activeId}" data-video="false" type="button" title="Llamada de voz">${icon('phone')}</button><button class="icon-btn call-user" data-id="${chatState.activeId}" data-video="true" type="button" title="Videollamada">${icon('video')}</button>` : ''}
        <button class="icon-btn ${chatState.drawerOpen ? 'is-active' : ''}" id="toggle-chat-drawer" type="button" title="Información y miembros" aria-label="Información">${icon('info')}</button>
      </div>
    </header>

    <!-- Barra de búsqueda en chat -->
    <div class="inchat-search-bar" id="inchat-search-bar" hidden>
      ${icon('search')}
      <input type="text" id="inchat-search-input" placeholder="Buscar palabras en esta conversación...">
      <span class="muted" id="inchat-search-count" style="font-size:12px;display:none;">0 de 0</span>
      <button class="icon-btn mini" id="btn-inchat-search-prev" type="button" title="Anterior">▲</button>
      <button class="icon-btn mini" id="btn-inchat-search-next" type="button" title="Siguiente">▼</button>
      <button class="icon-btn mini" id="btn-inchat-search-close" type="button" title="Cerrar búsqueda">×</button>
    </div>

    <!-- Banner de mensaje fijado -->
    <div id="chat-pinned-banner-wrap"></div>

    <!-- Lista de mensajes con scroll -->
    <div class="message-list" id="active-message-list">
      <div class="chat-empty-state"><span class="spinner"></span> Cargando mensajes...</div>
    </div>

    <!-- Indicador de escritura animado -->
    <div class="typing-indicator-bar" id="typing-indicator-bar" hidden>
      <span class="typing-dots"><span></span><span></span><span></span></span>
      <span id="typing-indicator-text">Escribiendo...</span>
    </div>

    <!-- Compositor inferior fijo -->
    <form class="message-form" id="active-message-form">
      <!-- Banner de respuesta -->
      <div class="composer-banner" id="composer-reply-banner" hidden>
        <div>
          <strong id="composer-reply-author"></strong>: <span id="composer-reply-text" class="muted"></span>
        </div>
        <button type="button" class="icon-btn mini" id="composer-reply-cancel">×</button>
      </div>

      <!-- Banner de edición -->
      <div class="composer-banner" id="composer-edit-banner" hidden style="border-left-color:#3b82f6;">
        <div><strong>Editando mensaje</strong></div>
        <button type="button" class="icon-btn mini" id="composer-edit-cancel">×</button>
      </div>

      <!-- Preview de adjunto seleccionado -->
      <div class="composer-banner" id="composer-attach-banner" hidden style="border-left-color:#10b981;">
        <div>${icon('file')} <strong id="composer-attach-name"></strong></div>
        <button type="button" class="icon-btn mini" id="composer-attach-cancel">×</button>
      </div>

      <!-- Barra de grabación de audio (oculta por defecto) -->
      <div class="composer-recording-bar" id="composer-recording-bar" hidden>
        <span class="rec-pulse-dot"></span>
        <span class="rec-timer" id="recording-timer">0:00</span>
        <span class="muted" style="flex:1;font-size:12px;">Grabando nota de voz...</span>
        <button type="button" class="btn secondary mini" id="btn-cancel-voice">Cancelar</button>
        <button type="button" class="btn mini" id="btn-send-voice">Enviar audio</button>
      </div>

      <!-- Fila de input normal -->
      <div class="message-form-row" id="composer-input-row">
        <!-- Selector de emojis -->
        <button type="button" class="composer-tool-btn" id="btn-toggle-emoji" title="Emojis">${icon('smile')}</button>

        <!-- Adjuntar archivo -->
        <label class="composer-tool-btn" title="Adjuntar archivo" style="cursor:pointer;">
          ${icon('paperclip')}
          <input type="file" id="chat-file-input" hidden>
        </label>

        <!-- Grabar nota de voz -->
        <button type="button" class="composer-tool-btn" id="btn-start-voice" title="Grabar nota de voz">${icon('mic')}</button>

        <!-- Área de texto autoexpansible -->
        <textarea class="composer-textarea" id="chat-textarea" rows="1" placeholder="Escribe un mensaje..."></textarea>

        <!-- Botón enviar -->
        <button class="send-btn" type="submit" id="btn-send-message" aria-label="Enviar">${icon('arrowUp')}</button>
      </div>

      <!-- Selector de emojis popover -->
      <div class="emoji-picker-popover" id="emoji-picker-popover" hidden>
        ${['👍','❤️','😂','😮','😢','🙏','🎉','🚀','🔥','✨','👏','💯','👀','🙌','😍','😎','🤔','💡','✅','❌','💪'].map(em => `<button type="button" class="emoji-choice-btn" data-emoji="${em}">${em}</button>`).join('')}
      </div>
    </form>
  `;
}

function renderDrawerPanel() {
  const detail = chatState.activeDetail;
  const isDirect = chatState.activeType === 'direct';

  if (!detail) {
    return '<div class="chat-drawer-header"><h3>Información</h3><button type="button" class="icon-btn mini" id="btn-close-drawer">×</button></div><div class="chat-drawer-content"><div class="empty">Selecciona un chat.</div></div>';
  }

  if (isDirect) {
    const isOnline = chatState.onlineUsers.has(Number(detail.id));
    return `
      <div class="chat-drawer-header">
        <h3>Contacto</h3>
        <button type="button" class="icon-btn mini" id="btn-close-drawer">×</button>
      </div>
      <div class="chat-drawer-content">
        <div class="drawer-profile-hero">
          ${avatarMarkup(detail, 'message-avatar')}
          <h4 style="margin:4px 0 0;font-size:16px;">${esc(detail.name)}</h4>
          <span class="muted" style="font-size:12px;">@${esc(detail.username || detail.email || '')}</span>
          <span class="badge mini" style="${isOnline ? 'background:#10b981;color:#fff;' : ''}">${isOnline ? 'En línea' : 'Desconectado'}</span>
        </div>

        <div>
          <span class="conversation-label">Detalles</span>
          <div style="font-size:13px;display:flex;flex-direction:column;gap:6px;margin-top:4px;">
            <div><span class="muted">Correo:</span> ${esc(detail.email || 'N/A')}</div>
            <div><span class="muted">Rol:</span> ${esc(detail.role || 'Miembro')}</div>
            ${detail.last_seen_at ? `<div><span class="muted">Última vez:</span> ${formatLastSeen(detail.last_seen_at)}</div>` : ''}
          </div>
        </div>

        <div>
          <span class="conversation-label">Archivos compartidos</span>
          <div id="drawer-shared-files" style="margin-top:6px;font-size:13px;"><span class="muted">Cargando archivos...</span></div>
        </div>

        <div style="margin-top:auto;display:flex;flex-direction:column;gap:8px;">
          <button class="btn secondary btn-block" id="btn-drawer-mute" type="button">
            ${detail.is_muted ? '🔔 Activar notificaciones' : '🔕 Silenciar notificaciones'}
          </button>
          <button class="btn secondary danger btn-block" id="btn-drawer-clear" type="button">
            🗑 Vaciar conversación
          </button>
        </div>
      </div>
    `;
  }

  // Grupos
  const isGroupAdmin = detail.my_role === 'admin' || ['platform_admin', 'company_admin', 'admin'].includes(state.user.role);
  return `
    <div class="chat-drawer-header">
      <h3>Grupo</h3>
      <button type="button" class="icon-btn mini" id="btn-close-drawer">×</button>
    </div>
    <div class="chat-drawer-content">
      <div class="drawer-profile-hero">
        <span class="message-avatar group-avatar" style="width:54px;height:54px;font-size:20px;background:#4f46e5;color:#fff;">G</span>
        <h4 style="margin:4px 0 0;font-size:16px;">${esc(detail.name)}</h4>
        ${detail.description ? `<p class="muted" style="font-size:12px;margin:2px 0 0;">${esc(detail.description)}</p>` : ''}
      </div>

      ${detail.project_id ? `
        <div>
          <span class="conversation-label">Proyecto Asociado</span>
          <div class="drawer-project-card">
            <strong>📁 ${esc(detail.project_name || 'Proyecto')}</strong>
            <div style="display:flex;gap:6px;margin-top:4px;">
              <a href="#/${state.user.role}/tasks?project=${detail.project_id}" class="btn secondary mini">Tareas</a>
              <a href="#/${state.user.role}/kanban?project=${detail.project_id}" class="btn secondary mini">Kanban</a>
            </div>
          </div>
        </div>
      ` : ''}

      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span class="conversation-label">Integrantes (${detail.members?.length || 0})</span>
          ${isGroupAdmin ? '<button class="btn secondary mini" id="btn-drawer-add-member" type="button">+ Añadir</button>' : ''}
        </div>
        <div class="drawer-members-list" style="margin-top:6px;">
          ${(detail.members || []).map(m => {
            const isMemberOnline = chatState.onlineUsers.has(Number(m.id)) || m.online;
            return `
              <div class="drawer-member-item">
                <div style="display:flex;align-items:center;gap:8px;">
                  ${avatarMarkup(m, 'message-avatar')}
                  <div>
                    <strong style="font-size:13px;display:block;">${esc(m.name)}</strong>
                    <small class="muted">${esc(m.role === 'admin' ? 'Administrador' : 'Miembro')}</small>
                  </div>
                </div>
                <div style="display:flex;align-items:center;gap:4px;">
                  ${isMemberOnline ? '<span style="color:#10b981;font-size:16px;">•</span>' : ''}
                  ${isGroupAdmin && m.id !== state.user.id ? `
                    <button class="icon-btn mini" data-kick-user="${m.id}" title="Quitar del grupo">×</button>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div>
        <span class="conversation-label">Archivos compartidos</span>
        <div id="drawer-shared-files" style="margin-top:6px;font-size:13px;"><span class="muted">Cargando archivos...</span></div>
      </div>

      <div style="margin-top:auto;display:flex;flex-direction:column;gap:8px;">
        <button class="btn secondary btn-block" id="btn-drawer-mute" type="button">
          ${detail.is_muted ? '🔔 Activar notificaciones' : '🔕 Silenciar grupo'}
        </button>
        <button class="btn danger secondary btn-block" id="btn-drawer-leave-group" type="button">
          Salir del grupo
        </button>
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// CARGA Y RENDERIZADO DEL HISTORIAL DE MENSAJES
// -------------------------------------------------------------
async function loadActiveChatMessages(isInitial = true) {
  const listEl = document.querySelector('#active-message-list');
  if (!listEl || !chatState.activeId) return;

  if (isInitial) {
    listEl.innerHTML = '<div class="chat-empty-state"><span class="spinner"></span> Cargando mensajes...</div>';
  }

  try {
    const endpoint = chatState.activeType === 'direct'
      ? `/messages?user_id=${chatState.activeId}&limit=50`
      : `/messages?group_id=${chatState.activeId}&limit=50`;

    const res = await api(endpoint);
    chatState.messages = res.messages || [];
    chatState.hasMore = Boolean(res.has_more);

    renderMessagesListToDOM(chatState.messages);
    refreshPinnedBanner();
    loadSharedFilesInDrawer();
  } catch (err) {
    listEl.innerHTML = `<div class="chat-empty-state"><p class="text-danger">${esc(err.message)}</p></div>`;
  }
}

function renderMessagesListToDOM(messages) {
  const listEl = document.querySelector('#active-message-list');
  if (!listEl) return;

  if (!messages.length) {
    listEl.innerHTML = '<div class="chat-empty-state">No hay mensajes aún. ¡Envía el primero!</div>';
    return;
  }

  let html = '';
  let lastDay = '';

  messages.forEach(m => {
    const day = dayDivider(m.created_at);
    if (day !== lastDay) {
      html += `<div class="day-divider"><span>${esc(day)}</span></div>`;
      lastDay = day;
    }
    html += renderSingleMessageMarkup(m);
  });

  listEl.innerHTML = html;
  listEl.scrollTop = listEl.scrollHeight;
}

function appendSingleMessageToDOM(m) {
  const listEl = document.querySelector('#active-message-list');
  if (!listEl) return;
  if (m.id && listEl.querySelector(`[data-message-id="${m.id}"]`)) return;

  const emptyState = listEl.querySelector('.chat-empty-state');
  if (emptyState) emptyState.remove();

  const day = dayDivider(m.created_at);
  const lastDivider = listEl.querySelector('.day-divider:last-of-type span');
  if (!lastDivider || lastDivider.textContent !== day) {
    listEl.insertAdjacentHTML('beforeend', `<div class="day-divider"><span>${esc(day)}</span></div>`);
  }

  const wasAtBottom = (listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight) < 60;
  listEl.insertAdjacentHTML('beforeend', renderSingleMessageMarkup(m));

  if (wasAtBottom || m.sender_id === state.user?.id || m.is_mine) {
    listEl.scrollTop = listEl.scrollHeight;
  }
}

function renderSingleMessageMarkup(m) {
  const isMine = m.is_mine || (m.sender_id && state.user && m.sender_id === state.user.id);
  const isGroup = chatState.activeType === 'group';
  const ticks = isMine ? (m.delivery_status === 'leido' ? '<span class="message-ticks read" title="Leído">✓✓</span>' : m.delivery_status === 'entregado' ? '<span class="message-ticks" title="Entregado">✓✓</span>' : '<span class="message-ticks" title="Enviado">✓</span>') : '';

  return `
    <div class="message ${isMine ? 'mine' : ''}" id="msg-${m.id}" data-message-id="${m.id}">
      ${isGroup && !isMine ? `<span class="message-sender-title">${esc(m.sender_name || 'Integrante')}</span>` : ''}

      <div class="message-bubble">
        <!-- Cita respondida -->
        ${m.reply_to ? `
          <div class="message-quote" data-quote-id="${m.reply_to.id}">
            <span class="message-quote-author">${esc(m.reply_to.sender_name || 'Mensaje')}</span>
            <span class="message-quote-text">${esc(m.reply_to.content)}</span>
          </div>
        ` : ''}

        <!-- Contenido según tipo -->
        ${m.attachment_id && m.message_type === 'image' ? `
          <div class="message-image-wrap" data-img-src="${m.attachment_url}">
            <img src="${m.attachment_url}" alt="${esc(m.attachment_name || 'Imagen')}">
          </div>
        ` : ''}

        ${m.attachment_id && m.message_type === 'audio' ? `
          <div class="message-voice-player">
            <audio src="${m.attachment_url}" preload="metadata"></audio>
            <button type="button" class="voice-play-btn" data-audio-btn="${m.id}">▶</button>
            <div class="voice-waveform-track" data-track-id="${m.id}">
              <div class="voice-waveform-fill" id="track-fill-${m.id}"></div>
            </div>
            <span class="voice-duration" id="voice-time-${m.id}">0:00</span>
          </div>
        ` : ''}

        ${m.attachment_id && m.message_type === 'file' ? `
          <a class="message-file-card" href="${m.attachment_url}" download="${esc(m.attachment_name || 'archivo')}">
            ${icon('file')}
            <div class="message-file-info">
              <span class="message-file-name">${esc(m.attachment_name || 'Documento adjunto')}</span>
              <span class="message-file-size">${m.size ? Math.round(m.size/1024) + ' KB' : 'Descargar'}</span>
            </div>
          </a>
        ` : ''}

        ${m.content && m.content !== '[Mensaje eliminado]' ? `<div class="message-text">${esc(m.content)}</div>` : (m.is_deleted ? '<div class="message-text" style="font-style:italic;opacity:0.6;">[Mensaje eliminado]</div>' : '')}

        <div class="message-footer">
          ${m.is_pinned ? '<span class="pin-indicator" title="Mensaje fijado">📌</span>' : ''}
          ${m.edited_at ? '<span class="message-edited-tag">(editado)</span>' : ''}
          <time>${timeShort(m.created_at)}</time>
          ${ticks}
        </div>

        <!-- Barra flotante de acciones al hover -->
        ${!m.is_deleted ? `
          <div class="message-hover-actions">
            <button type="button" class="msg-action-btn" data-quick-react="👍" title="Me gusta">👍</button>
            <button type="button" class="msg-action-btn" data-quick-react="❤️" title="Me encanta">❤️</button>
            <button type="button" class="msg-action-btn" data-quick-react="😂" title="Risa">😂</button>
            <button type="button" class="msg-action-btn" data-action="reply" title="Responder">${icon('arrowLeft')}</button>
            ${isMine ? `<button type="button" class="msg-action-btn" data-action="edit" title="Editar">${icon('edit')}</button>` : ''}
            <button type="button" class="msg-action-btn" data-action="pin" title="Fijar">${icon('flag')}</button>
            <button type="button" class="msg-action-btn" data-action="copy" title="Copiar texto">${icon('copy')}</button>
            ${isMine || ['platform_admin','company_admin','admin'].includes(state.user.role) ? `<button type="button" class="msg-action-btn" data-action="delete" title="Eliminar">🗑</button>` : ''}
          </div>
        ` : ''}
      </div>

      <!-- Pastillas de reacciones debajo de la burbuja -->
      <div class="message-reactions-row">
        ${renderReactionsPills(m.reactions || [], m.id)}
      </div>
    </div>
  `;
}

function renderReactionsPills(reactions, messageId) {
  if (!reactions || !reactions.length) return '';
  return reactions.map(r => `
    <button type="button" class="reaction-pill ${r.me ? 'me-reacted' : ''}" data-react-pill="${r.reaction}" data-msg-id="${messageId}">
      <span>${r.reaction}</span>
      <span>${r.count}</span>
    </button>
  `).join('');
}

async function refreshPinnedBanner() {
  const bannerWrap = document.querySelector('#chat-pinned-banner-wrap');
  if (!bannerWrap || !chatState.activeId) return;

  const endpoint = chatState.activeType === 'direct'
    ? `/messages/pinned?user_id=${chatState.activeId}`
    : `/messages/pinned?group_id=${chatState.activeId}`;

  try {
    const pinnedList = await api(endpoint).catch(() => []);
    if (pinnedList.length) {
      const topPinned = pinnedList[0];
      bannerWrap.innerHTML = `
        <div class="chat-pinned-banner" id="btn-scroll-pinned" data-pin-id="${topPinned.id}">
          <div class="chat-pinned-left">
            <span>📌</span>
            <div><strong>Fijado:</strong> <span class="muted">${esc((topPinned.content || 'Adjunto').slice(0, 60))}</span></div>
          </div>
          <span class="muted" style="font-size:11px;">Ver</span>
        </div>
      `;
      document.querySelector('#btn-scroll-pinned')?.addEventListener('click', () => {
        const targetMsg = document.querySelector(`#msg-${topPinned.id}`);
        if (targetMsg) {
          targetMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetMsg.style.outline = '2px solid var(--pink)';
          setTimeout(() => targetMsg.style.outline = '', 2000);
        }
      });
    } else {
      bannerWrap.innerHTML = '';
    }
  } catch {
    bannerWrap.innerHTML = '';
  }
}

async function loadSharedFilesInDrawer() {
  const container = document.querySelector('#drawer-shared-files');
  if (!container || !chatState.activeId) return;

  const endpoint = chatState.activeType === 'direct'
    ? `/messages/files?user_id=${chatState.activeId}`
    : `/messages/files?group_id=${chatState.activeId}`;

  try {
    const files = await api(endpoint).catch(() => []);
    if (!files.length) {
      container.innerHTML = '<span class="muted">No hay archivos compartidos.</span>';
      return;
    }
    container.innerHTML = files.slice(0, 10).map(f => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(0,0,0,0.04);">
        <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:6px;">
          ${icon('file')} ${esc(f.attachment_name || 'Archivo')}
        </div>
        <a href="${f.download_url}" class="btn secondary mini" download>Bajar</a>
      </div>
    `).join('');
  } catch {
    container.innerHTML = '<span class="muted">No se pudieron cargar los archivos.</span>';
  }
}

async function refreshConversationsListSilently() {
  try {
    const convData = await api('/messages/conversations');
    chatState.conversations = convData;
    const itemsEl = document.querySelector('#conversation-list-items');
    if (itemsEl) {
      itemsEl.innerHTML = renderConversationListItems();
      bindConversationListEvents();
    }
  } catch {}
}

// -------------------------------------------------------------
// EVENTOS Y CONTROLADORES INTERACTIVOS DE MENSAJERÍA
// -------------------------------------------------------------
async function renderMessages() {
  layout(await messagesView());
  bindMessagingModuleEvents();
  if (chatState.activeId) {
    loadActiveChatMessages(true);
  }
}

function bindMessagingModuleEvents() {
  bindConversationListEvents();
  bindActiveChatEvents();
}

function bindConversationListEvents() {
  // Click en conversación
  document.querySelectorAll('.conversation-user').forEach(btn => {
    btn.onclick = () => {
      const convType = btn.dataset.convType;
      const convId = btn.dataset.convId;
      const query = new URLSearchParams(location.hash.split('?')[1] || '');
      if (convType === 'group') {
        query.set('group', convId);
        query.delete('user');
      } else {
        query.set('user', convId);
        query.delete('group');
      }
      location.hash = `#/${state.user.role}/messages?${query.toString()}`;
      renderMessages();
    };
  });

  // Buscador de conversaciones
  const searchInput = document.querySelector('#chat-conversation-search');
  if (searchInput) {
    searchInput.oninput = (e) => {
      chatState.searchTerm = e.target.value;
      const itemsEl = document.querySelector('#conversation-list-items');
      if (itemsEl) {
        itemsEl.innerHTML = renderConversationListItems();
        bindConversationListEvents();
      }
    };
  }

  document.querySelector('#btn-clear-conv-search')?.addEventListener('click', () => {
    chatState.searchTerm = '';
    renderMessages();
  });

  // Filtros de pestañas
  document.querySelectorAll('.chat-filter-tab').forEach(tab => {
    tab.onclick = () => {
      chatState.filterTab = tab.dataset.filter;
      document.querySelectorAll('.chat-filter-tab').forEach(t => t.classList.toggle('active', t === tab));
      const itemsEl = document.querySelector('#conversation-list-items');
      if (itemsEl) {
        itemsEl.innerHTML = renderConversationListItems();
        bindConversationListEvents();
      }
    };
  });

  // Botón nueva conversación directa
  document.querySelector('#btn-create-direct')?.addEventListener('click', async () => {
    const users = await api('/users').catch(() => []);
    const activeContacts = users.filter(u => u.active && u.id !== state.user.id);
    if (!activeContacts.length) {
      notify('No hay otros integrantes activos en tu organización.');
      return;
    }
    const namePrompt = window.prompt(`Escribe el nombre o correo del integrante con quien deseas conversar:\n\n${activeContacts.map(u => u.name + ' (' + u.email + ')').join('\n')}`);
    if (!namePrompt || !namePrompt.trim()) return;
    const match = activeContacts.find(u => [u.name, u.username, u.email].some(val => String(val || '').toLowerCase().includes(namePrompt.toLowerCase().trim())));
    if (!match) {
      notify('No se encontró ningún integrante que coincida con esa búsqueda.');
      return;
    }
    location.hash = `#/${state.user.role}/messages?user=${match.id}`;
    renderMessages();
  });

  // Botón crear grupo
  document.querySelector('#btn-create-group')?.addEventListener('click', async () => {
    const name = window.prompt('Nombre del nuevo grupo:');
    if (!name || !name.trim()) return;
    const desc = window.prompt('Descripción (opcional):') || '';
    try {
      const res = await api('/messages/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: desc.trim(), members: [] })
      });
      notify('Grupo creado exitosamente');
      location.hash = `#/${state.user.role}/messages?group=${res.id}`;
      renderMessages();
    } catch (err) {
      notify(err.message);
    }
  });
}

function bindActiveChatEvents() {
  // Botón volver en móvil
  document.querySelector('#btn-chat-back')?.addEventListener('click', () => {
    document.querySelector('#messages-layout')?.classList.remove('chat-open');
    const query = new URLSearchParams(location.hash.split('?')[1] || '');
    query.delete('user');
    query.delete('group');
    location.hash = `#/${state.user.role}/messages?${query.toString()}`;
    renderMessages();
  });

  // Toggle drawer derecho
  document.querySelector('#toggle-chat-drawer')?.addEventListener('click', () => {
    chatState.drawerOpen = !chatState.drawerOpen;
    document.querySelector('#messages-layout')?.classList.toggle('drawer-open', chatState.drawerOpen);
    const drawerEl = document.querySelector('#chat-drawer-panel');
    if (drawerEl) {
      drawerEl.style.display = chatState.drawerOpen ? 'flex' : 'none';
      if (chatState.drawerOpen) loadSharedFilesInDrawer();
    }
  });

  document.querySelector('#btn-close-drawer')?.addEventListener('click', () => {
    chatState.drawerOpen = false;
    document.querySelector('#messages-layout')?.classList.remove('drawer-open');
    const drawerEl = document.querySelector('#chat-drawer-panel');
    if (drawerEl) drawerEl.style.display = 'none';
  });

  // Búsqueda en chat
  document.querySelector('#toggle-inchat-search')?.addEventListener('click', () => {
    const bar = document.querySelector('#inchat-search-bar');
    if (!bar) return;
    bar.hidden = !bar.hidden;
    if (!bar.hidden) {
      document.querySelector('#inchat-search-input')?.focus();
    }
  });

  document.querySelector('#btn-inchat-search-close')?.addEventListener('click', () => {
    document.querySelector('#inchat-search-bar').hidden = true;
  });

  document.querySelector('#inchat-search-input')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) {
      document.querySelectorAll('.message').forEach(m => m.style.opacity = '1');
      document.querySelector('#inchat-search-count').style.display = 'none';
      return;
    }
    const matches = Array.from(document.querySelectorAll('.message')).filter(m => {
      const text = m.querySelector('.message-text')?.textContent.toLowerCase() || '';
      const isMatch = text.includes(q);
      m.style.opacity = isMatch ? '1' : '0.25';
      return isMatch;
    });
    const countEl = document.querySelector('#inchat-search-count');
    countEl.style.display = 'inline';
    countEl.textContent = `${matches.length} coincidencias`;
    if (matches.length) {
      matches[matches.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  // Delegación de eventos en mensajes (Reacciones, Acciones hover, Audio)
  const listEl = document.querySelector('#active-message-list');
  if (listEl) {
    listEl.onclick = async (e) => {
      // 1. Click en pastilla de reacción
      const pill = e.target.closest('[data-react-pill]');
      if (pill) {
        const emoji = pill.dataset.reactPill;
        const msgId = pill.dataset.msgId;
        try {
          await api(`/messages/${msgId}/reactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reaction: emoji })
          });
        } catch (err) { notify(err.message); }
        return;
      }

      // 2. Click en reacción rápida de barra hover
      const quickReact = e.target.closest('[data-quick-react]');
      if (quickReact) {
        const emoji = quickReact.dataset.quickReact;
        const msgEl = quickReact.closest('.message');
        const msgId = msgEl?.dataset.messageId;
        if (msgId) {
          try {
            await api(`/messages/${msgId}/reactions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reaction: emoji })
            });
          } catch (err) { notify(err.message); }
        }
        return;
      }

      // 3. Acciones de mensaje (reply, edit, delete, pin, copy)
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn) {
        const action = actionBtn.dataset.action;
        const msgEl = actionBtn.closest('.message');
        const msgId = msgEl?.dataset.messageId;
        const text = msgEl?.querySelector('.message-text')?.textContent || '';
        const author = msgEl?.querySelector('.message-sender-title')?.textContent || (msgEl?.classList.contains('mine') ? 'Tú' : 'Contacto');

        if (action === 'reply') {
          chatState.replyingTo = { id: msgId, author, text };
          document.querySelector('#composer-reply-author').textContent = author;
          document.querySelector('#composer-reply-text').textContent = text.slice(0, 50);
          document.querySelector('#composer-reply-banner').removeAttribute('hidden');
          document.querySelector('#chat-textarea')?.focus();
        } else if (action === 'edit') {
          chatState.editingMessage = { id: msgId, text };
          const textarea = document.querySelector('#chat-textarea');
          if (textarea) textarea.value = text;
          document.querySelector('#composer-edit-banner').removeAttribute('hidden');
          textarea?.focus();
        } else if (action === 'delete') {
          if (confirm('¿Deseas eliminar este mensaje para todos?')) {
            try {
              await api(`/messages/${msgId}`, { method: 'DELETE' });
            } catch (err) { notify(err.message); }
          }
        } else if (action === 'pin') {
          try {
            await api(`/messages/${msgId}/pin`, { method: 'POST' });
          } catch (err) { notify(err.message); }
        } else if (action === 'copy') {
          navigator.clipboard?.writeText(text);
          notify('Texto copiado al portapapeles');
        }
        return;
      }

      // 4. Click en cita respondida para hacer scroll hacia ella
      const quote = e.target.closest('.message-quote');
      if (quote) {
        const quoteId = quote.dataset.quoteId;
        const target = document.querySelector(`#msg-${quoteId}`);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          target.style.outline = '2px solid var(--pink)';
          setTimeout(() => target.style.outline = '', 2000);
        }
        return;
      }

      // 5. Reproducción de nota de voz
      const playBtn = e.target.closest('.voice-play-btn');
      if (playBtn) {
        const player = playBtn.closest('.message-voice-player');
        const audio = player?.querySelector('audio');
        const timeEl = player?.querySelector('.voice-duration');
        const fillEl = player?.querySelector('.voice-waveform-fill');

        if (audio) {
          if (audio.paused) {
            audio.play();
            playBtn.textContent = '❚❚';
            audio.ontimeupdate = () => {
              const current = Math.floor(audio.currentTime);
              const m = Math.floor(current / 60);
              const s = String(current % 60).padStart(2, '0');
              if (timeEl) timeEl.textContent = `${m}:${s}`;
              if (fillEl && audio.duration) fillEl.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
            };
            audio.onended = () => {
              playBtn.textContent = '▶';
              if (fillEl) fillEl.style.width = '0%';
            };
          } else {
            audio.pause();
            playBtn.textContent = '▶';
          }
        }
        return;
      }

      // 6. Click en imagen para abrir modal visor
      const imgWrap = e.target.closest('.message-image-wrap');
      if (imgWrap) {
        const src = imgWrap.dataset.imgSrc;
        if (src) {
          openImageLightbox(src);
        }
      }
    };
  }

  // Cancelar reply / edit / attach
  document.querySelector('#composer-reply-cancel')?.addEventListener('click', () => {
    chatState.replyingTo = null;
    document.querySelector('#composer-reply-banner').setAttribute('hidden', '');
  });

  document.querySelector('#composer-edit-cancel')?.addEventListener('click', () => {
    chatState.editingMessage = null;
    document.querySelector('#composer-edit-banner').setAttribute('hidden', '');
    const textarea = document.querySelector('#chat-textarea');
    if (textarea) textarea.value = '';
  });

  document.querySelector('#composer-attach-cancel')?.addEventListener('click', () => {
    const fileInput = document.querySelector('#chat-file-input');
    if (fileInput) fileInput.value = '';
    document.querySelector('#composer-attach-banner').setAttribute('hidden', '');
  });

  // Selector de archivos
  document.querySelector('#chat-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      document.querySelector('#composer-attach-name').textContent = file.name;
      document.querySelector('#composer-attach-banner').removeAttribute('hidden');
    }
  });

  // Selector de emojis popover
  document.querySelector('#btn-toggle-emoji')?.addEventListener('click', () => {
    const pop = document.querySelector('#emoji-picker-popover');
    if (pop) pop.hidden = !pop.hidden;
  });

  document.querySelectorAll('.emoji-choice-btn').forEach(btn => {
    btn.onclick = () => {
      const emoji = btn.dataset.emoji;
      const textarea = document.querySelector('#chat-textarea');
      if (textarea) {
        textarea.value += emoji;
        textarea.focus();
      }
      document.querySelector('#emoji-picker-popover').hidden = true;
    };
  });

  // Detección de escritura en textarea
  const textarea = document.querySelector('#chat-textarea');
  if (textarea) {
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;

      if (!chatState.isTypingSent && chatState.activeId) {
        chatState.isTypingSent = true;
        sendSignal({
          type: 'typing:start',
          conversationType: chatState.activeType,
          targetId: chatState.activeId
        });
      }

      clearTimeout(chatState.typingTimeout);
      chatState.typingTimeout = setTimeout(() => {
        chatState.isTypingSent = false;
        sendSignal({
          type: 'typing:stop',
          conversationType: chatState.activeType,
          targetId: chatState.activeId
        });
      }, 2000);
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.querySelector('#active-message-form')?.requestSubmit();
      }
    });
  }

  // Envío del formulario de mensaje
  document.querySelector('#active-message-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const textarea = document.querySelector('#chat-textarea');
    const content = (textarea?.value || '').trim();
    const fileInput = document.querySelector('#chat-file-input');
    const file = fileInput?.files[0];

    if (!content && !file) return;

    // Si estamos en modo edición
    if (chatState.editingMessage) {
      try {
        await api(`/messages/${chatState.editingMessage.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content })
        });
        chatState.editingMessage = null;
        document.querySelector('#composer-edit-banner').setAttribute('hidden', '');
        if (textarea) textarea.value = '';
      } catch (err) { notify(err.message); }
      return;
    }

    // Enviar nuevo mensaje
    const sendBtn = document.querySelector('#btn-send-message');
    if (sendBtn) sendBtn.disabled = true;

    try {
      const formData = new FormData();
      formData.append('content', content);
      if (file) formData.append('file', file);
      if (chatState.replyingTo) formData.append('reply_to_id', chatState.replyingTo.id);
      formData.append('client_message_id', `cmsg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

      let sentMsg = null;
      if (chatState.activeType === 'direct') {
        formData.append('user_id', chatState.activeId);
        sentMsg = await api('/messages', { method: 'POST', body: formData });
      } else {
        sentMsg = await api(`/messages/groups/${chatState.activeId}/messages`, { method: 'POST', body: formData });
      }

      const msgObj = sentMsg?.message || sentMsg;
      if (msgObj && msgObj.id) {
        appendSingleMessageToDOM({
          ...msgObj,
          is_mine: true,
          sender_id: state.user?.id || msgObj.sender_id,
          sender_name: state.user?.name || msgObj.sender_name
        });
      }

      // Limpiar campos
      if (textarea) {
        textarea.value = '';
        textarea.style.height = '42px';
      }
      if (fileInput) fileInput.value = '';
      document.querySelector('#composer-attach-banner')?.setAttribute('hidden', '');
      chatState.replyingTo = null;
      document.querySelector('#composer-reply-banner')?.setAttribute('hidden', '');
    } catch (err) {
      notify(err.message);
    } finally {
      if (sendBtn) sendBtn.disabled = false;
    }
  });

  // Grabación de nota de voz
  document.querySelector('#btn-start-voice')?.addEventListener('click', () => startVoiceRecording());
  document.querySelector('#btn-cancel-voice')?.addEventListener('click', () => stopVoiceRecording(false));
  document.querySelector('#btn-send-voice')?.addEventListener('click', () => stopVoiceRecording(true));

  // Acciones en Drawer: Silenciar, Vaciar, Salir, Kick
  document.querySelector('#btn-drawer-mute')?.addEventListener('click', async () => {
    const isMuted = !chatState.activeDetail?.is_muted;
    try {
      await api('/messages/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_type: chatState.activeType,
          target_id: chatState.activeId,
          is_muted: isMuted
        })
      });
      notify(isMuted ? 'Conversación silenciada' : 'Notificaciones activadas');
      renderMessages();
    } catch (err) { notify(err.message); }
  });

  document.querySelector('#btn-drawer-clear')?.addEventListener('click', async () => {
    if (confirm('¿Vaciar esta conversación? Los mensajes ya no aparecerán en tu historial.')) {
      try {
        await api(`/messages/conversation/${chatState.activeId}`, { method: 'DELETE' });
        notify('Conversación vaciada');
        renderMessages();
      } catch (err) { notify(err.message); }
    }
  });

  document.querySelector('#btn-drawer-leave-group')?.addEventListener('click', async () => {
    if (confirm('¿Seguro que deseas salir de este grupo?')) {
      try {
        await api(`/messages/groups/${chatState.activeId}/members/${state.user.id}`, { method: 'DELETE' });
        notify('Has salido del grupo');
        location.hash = `#/${state.user.role}/messages`;
        renderMessages();
      } catch (err) { notify(err.message); }
    }
  });

  document.querySelectorAll('[data-kick-user]').forEach(btn => {
    btn.onclick = async () => {
      const targetUid = btn.dataset.kickUser;
      if (confirm('¿Expulsar a este integrante del grupo?')) {
        try {
          await api(`/messages/groups/${chatState.activeId}/members/${targetUid}`, { method: 'DELETE' });
          notify('Integrante removido del grupo');
          renderMessages();
        } catch (err) { notify(err.message); }
      }
    };
  });

  document.querySelector('#btn-drawer-add-member')?.addEventListener('click', async () => {
    const users = await api('/users').catch(() => []);
    const currentMemberIds = new Set((chatState.activeDetail?.members || []).map(m => m.id));
    const candidates = users.filter(u => u.active && !currentMemberIds.has(u.id));

    if (!candidates.length) {
      notify('Todos los integrantes activos de tu organización ya están en este grupo.');
      return;
    }

    const name = window.prompt(`Escribe el nombre o correo del integrante a añadir:\n\n${candidates.map(u => u.name + ' (' + u.email + ')').join('\n')}`);
    if (!name || !name.trim()) return;
    const match = candidates.find(u => [u.name, u.username, u.email].some(v => String(v || '').toLowerCase().includes(name.toLowerCase().trim())));
    if (!match) {
      notify('No se encontró ningún integrante con esos datos.');
      return;
    }
    try {
      await api(`/messages/groups/${chatState.activeId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: match.id })
      });
      notify('Integrante añadido al grupo');
      renderMessages();
    } catch (err) { notify(err.message); }
  });

  // Llamadas (reutilizando handlers existentes)
  document.querySelectorAll('.call-user').forEach(button => {
    button.onclick = () => startCall(button.dataset.id, button.dataset.video === 'true');
  });
}

// -------------------------------------------------------------
// GRABACIÓN DE NOTAS DE VOZ (MediaRecorder)
// -------------------------------------------------------------
async function startVoiceRecording() {
  if (!navigator.mediaDevices?.getUserMedia) {
    notify('Tu navegador no admite la grabación de notas de voz.');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chatState.audioChunks = [];
    chatState.mediaRecorder = new MediaRecorder(stream);
    chatState.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chatState.audioChunks.push(e.data);
    };
    chatState.mediaRecorder.start();

    chatState.recordingSeconds = 0;
    document.querySelector('#composer-recording-bar')?.removeAttribute('hidden');
    document.querySelector('#composer-input-row')?.setAttribute('hidden', '');

    clearInterval(chatState.recordingInterval);
    chatState.recordingInterval = setInterval(() => {
      chatState.recordingSeconds++;
      const m = Math.floor(chatState.recordingSeconds / 60);
      const s = String(chatState.recordingSeconds % 60).padStart(2, '0');
      const timer = document.querySelector('#recording-timer');
      if (timer) timer.textContent = `${m}:${s}`;
    }, 1000);
  } catch (err) {
    notify('Permiso denegado para el micrófono o dispositivo no disponible.');
  }
}

async function stopVoiceRecording(shouldSend) {
  if (!chatState.mediaRecorder) return;
  clearInterval(chatState.recordingInterval);
  document.querySelector('#composer-recording-bar')?.setAttribute('hidden', '');
  document.querySelector('#composer-input-row')?.removeAttribute('hidden');

  chatState.mediaRecorder.onstop = async () => {
    chatState.mediaRecorder.stream.getTracks().forEach(t => t.stop());
    if (shouldSend && chatState.audioChunks.length > 0) {
      const audioBlob = new Blob(chatState.audioChunks, { type: 'audio/webm' });
      const file = new File([audioBlob], `audio-${Date.now()}.webm`, { type: 'audio/webm' });

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('message_type', 'audio');
        formData.append('client_message_id', `cmsg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

        if (chatState.activeType === 'direct') {
          formData.append('user_id', chatState.activeId);
          await api('/messages', { method: 'POST', body: formData });
        } else {
          await api(`/messages/groups/${chatState.activeId}/messages`, { method: 'POST', body: formData });
        }
      } catch (err) {
        notify('Error al enviar nota de voz: ' + err.message);
      }
    }
    chatState.mediaRecorder = null;
    chatState.audioChunks = [];
  };

  chatState.mediaRecorder.stop();
}

function openImageLightbox(src) {
  const overlay = document.createElement('div');
  overlay.className = 'status-overlay';
  overlay.style.zIndex = '9999';
  overlay.innerHTML = `
    <div style="position:relative;max-width:90vw;max-height:90vh;display:flex;flex-direction:column;align-items:center;">
      <button type="button" class="icon-btn mini" id="close-lightbox" style="position:absolute;top:-40px;right:0;color:#fff;background:rgba(0,0,0,0.6);font-size:20px;">×</button>
      <img src="${src}" alt="Vista previa" style="max-width:100%;max-height:85vh;object-fit:contain;border-radius:8px;">
      <a href="${src}" download class="btn secondary mini" style="margin-top:12px;background:#fff;">Descargar imagen</a>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.onclick = (e) => {
    if (e.target === overlay || e.target.id === 'close-lightbox') overlay.remove();
  };
}

// =========================================================================
// GANTTPROJECT ADVANCED SUITE (bardsoftware/ganttproject)
// =========================================================================

function buildGanttWbsTree(tasks) {
  const taskMap = new Map();
  const childrenMap = new Map();
  tasks.forEach(t => {
    taskMap.set(t.id, t);
    childrenMap.set(t.id, []);
  });
  const roots = [];
  tasks.forEach(t => {
    if (t.parent_id && taskMap.has(t.parent_id)) {
      childrenMap.get(t.parent_id).push(t);
    } else {
      roots.push(t);
    }
  });

  const flatList = [];
  function walk(list, prefix = '', depth = 0) {
    list.forEach((task, idx) => {
      const wbs = prefix ? `${prefix}.${idx + 1}` : `${idx + 1}`;
      const children = childrenMap.get(task.id) || [];
      const isParent = children.length > 0;
      const isCollapsed = ganttCollapsedTasks.has(task.id);
      flatList.push({
        ...task,
        wbs,
        depth,
        is_summary: isParent,
        has_children: isParent,
        is_collapsed: isCollapsed
      });
      if (isParent && !isCollapsed) {
        walk(children, wbs, depth + 1);
      }
    });
  }
  walk(roots);
  return flatList;
}

function scrollToGanttDate(dateVal) {
  if (!dateVal || !ganttChartMinDate) return;
  const target = parseGanttDate(dateVal);
  if (!target) return;
  const dayMs = 86400000;
  const dayWidth = ganttTimeScale === 'week'
    ? Math.max(14, Math.round(ganttChartZoom * 0.55))
    : (ganttTimeScale === 'month' ? Math.max(8, Math.round(ganttChartZoom * 0.3)) : ganttChartZoom);
  const diffDays = Math.round((target - ganttChartMinDate) / dayMs);
  const scrollEl = document.querySelector('#gtc-scroll');
  if (scrollEl) {
    const targetLeft = Math.max(0, diffDays * dayWidth - 80);
    scrollEl.scrollTo({ left: targetLeft, behavior: 'smooth' });
    const iso = toISODate(target);
    const dayCol = document.querySelector(`.gtc-day[data-date="${iso}"]`);
    if (dayCol) {
      dayCol.style.transition = 'background-color .3s ease';
      const origBg = dayCol.style.backgroundColor;
      dayCol.style.backgroundColor = 'rgba(236, 216, 140, 0.4)';
      setTimeout(() => { dayCol.style.backgroundColor = origBg; }, 1400);
    }
    const targetMonthPrefix = iso.slice(0, 7);
    document.querySelectorAll('.gp-month-pill').forEach(btn => {
      btn.classList.toggle('active', (btn.dataset.date || '').startsWith(targetMonthPrefix));
    });
    const monthSelect = document.querySelector('#gp-month-quick-select');
    if (monthSelect) {
      const matchOpt = Array.from(monthSelect.options).find(opt => opt.value.startsWith(targetMonthPrefix));
      if (matchOpt) monthSelect.value = matchOpt.value;
    }
  }
}

function renderGanttCalendarHtml(scheduledTasks, monthDate, today) {
  const dayMs = 86400000;
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const gridStart = startOfWeekMonday(monthStart);
  const gridEndOffset = 6 - ((monthEnd.getDay() + 6) % 7);
  const gridEnd = new Date(monthEnd); gridEnd.setDate(gridEnd.getDate() + gridEndOffset);
  const totalGridDays = Math.round((gridEnd - gridStart) / dayMs) + 1;
  const weeksCount = Math.ceil(totalGridDays / 7);

  const MAX_LANES = 4;
  const weeksHtml = [];

  for (let w = 0; w < weeksCount; w++) {
    const weekStart = new Date(gridStart.getTime() + w * 7 * dayMs);
    const weekEnd = new Date(weekStart.getTime() + 6 * dayMs);
    const weekTasks = scheduledTasks
      .filter(t => t.startDate <= weekEnd && t.dueDate >= weekStart)
      .sort((a, b) => (a.startDate - b.startDate) || ((b.dueDate - b.startDate) - (a.dueDate - a.startDate)));

    const lanesOccupied = [];
    const bars = [];
    let overflow = 0;

    weekTasks.forEach(task => {
      const segStart = task.startDate < weekStart ? weekStart : task.startDate;
      const segEnd = task.dueDate > weekEnd ? weekEnd : task.dueDate;
      const colStart = Math.round((segStart - weekStart) / dayMs);
      const colSpan = Math.round((segEnd - segStart) / dayMs) + 1;

      let lane = 0;
      while (lane < MAX_LANES) {
        const occ = lanesOccupied[lane] || (lanesOccupied[lane] = []);
        const clash = occ.some(range => colStart < range.end && (colStart + colSpan) > range.start);
        if (!clash) {
          occ.push({ start: colStart, end: colStart + colSpan });
          break;
        }
        lane++;
      }
      if (lane >= MAX_LANES) {
        overflow++;
        return;
      }
      bars.push({
        task,
        colStart,
        colSpan,
        lane,
        continuesLeft: task.startDate < weekStart,
        continuesRight: task.dueDate > weekEnd
      });
    });

    const lanesUsed = Math.min(MAX_LANES, Math.max(1, bars.reduce((m, b) => Math.max(m, b.lane + 1), 0)));
    const dayBoxes = [];

    for (let d = 0; d < 7; d++) {
      const date = new Date(weekStart.getTime() + d * dayMs);
      const outside = date.getMonth() !== monthDate.getMonth();
      const isToday = date.getTime() === today.getTime();
      const isoDate = toISODate(date);
      const dayTitle = date.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      dayBoxes.push(`
        <div class="gantt-cal-day ${outside ? 'is-out' : ''} ${isToday ? 'is-today' : ''}"
             data-date="${isoDate}"
             title="Centrar Gantt en ${dayTitle}">
          <span class="gantt-cal-daynum">${date.getDate()}</span>
        </div>
      `);
    }

    const barsHtml = bars.map(bar => {
      const prog = bar.task.progress ?? (bar.task.status === 'completada' ? 100 : (bar.task.status === 'en_proceso' ? 50 : 0));
      const milestoneIcon = bar.task.is_milestone ? `${icon('flag')} ` : '';
      const critClass = `${bar.task.isCritical ? 'is-critical' : ''} ${bar.task.status !== 'completada' && bar.task.dueDate < today ? 'is-overdue' : ''}`;
      return `
        <div class="gantt-cal-bar ${bar.task.status} ${critClass}"
             draggable="true"
             data-id="${bar.task.id}"
             data-start="${bar.task.start_date || ''}"
             data-due="${bar.task.due_date || ''}"
             style="--col-start:${bar.colStart};--col-span:${bar.colSpan};--lane:${bar.lane}"
             title="${milestoneIcon}${esc(bar.task.title)} · ${formatGanttDate(bar.task.start_date, true)} al ${formatGanttDate(bar.task.due_date, true)} · ${prog}%">
          ${bar.continuesLeft ? '<span class="gantt-cal-bar-arrow">‹</span>' : ''}
          <span class="gantt-cal-bar-label">${milestoneIcon}${esc(bar.task.title)}</span>
          ${bar.continuesRight ? '<span class="gantt-cal-bar-arrow">›</span>' : ''}
        </div>
      `;
    }).join('');

    const overflowHtml = overflow
      ? `<div class="gantt-cal-more" style="--lane:${MAX_LANES}">+${overflow} más</div>`
      : '';

    weeksHtml.push(`
      <div class="gantt-cal-week">
        <div class="gantt-cal-days" style="--lanes:${lanesUsed + (overflow ? 1 : 0)}">
          ${dayBoxes.join('')}
        </div>
        <div class="gantt-cal-bars">
          ${barsHtml}
          ${overflowHtml}
        </div>
      </div>
    `);
  }

  const monthLabel = monthDate.toLocaleDateString('es', { month: 'long', year: 'numeric' });

  return `
    <section class="card gantt-card mb-4" id="gantt-calendar-section" style="margin-bottom:var(--sp-4)">
      <div class="gantt-controls" style="${ganttCalendarCollapsed ? 'margin-bottom:0;padding-bottom:0;border-bottom:none' : ''}">
        <div class="actions" style="align-items:center">
          <button type="button" class="btn secondary" id="gantt-prev-month" aria-label="Mes anterior" title="Mes anterior">‹</button>
          <strong class="gantt-month-label">${monthLabel}</strong>
          <button type="button" class="btn secondary" id="gantt-next-month" aria-label="Mes siguiente" title="Mes siguiente">›</button>
          <button type="button" class="btn secondary" id="gantt-today-cal-btn" title="Ir al mes actual">Hoy</button>
          <label class="inline" style="margin-left:var(--sp-2)">
            <input class="input gantt-date-picker" id="gantt-date-picker" type="date" value="${toISODate(monthStart)}" title="Seleccionar fecha para ver mes" style="padding:4px 8px;font-size:12px;height:28px">
          </label>
        </div>
        <div class="actions" style="align-items:center">
          <button type="button" class="btn secondary" id="gantt-cal-toggle" title="${ganttCalendarCollapsed ? 'Mostrar calendario mensual' : 'Colapsar calendario mensual'}">
            ${ganttCalendarCollapsed ? `${icon('calendar')} Mostrar Calendario` : `${icon('calendar')} Ocultar Calendario`}
          </button>
        </div>
      </div>
      ${!ganttCalendarCollapsed ? `
        <div class="gantt-cal-weekdays">
          ${GANTT_WEEKDAY_LABELS.map(l => `<span>${l}</span>`).join('')}
        </div>
        <div class="gantt-cal-grid">
          ${weeksHtml.join('')}
        </div>
        <div class="gantt-legend" style="margin-top:var(--sp-3);padding-top:var(--sp-3)">
          <span><i class="gantt-dot pendiente"></i>Pendiente</span>
          <span><i class="gantt-dot en_proceso"></i>En proceso</span>
          <span><i class="gantt-dot completada"></i>Completada</span>
          <span class="muted" style="margin-left:auto;font-size:11px">${icon('sparkles')} Haz clic en cualquier día para centrar el diagrama Gantt en esa fecha</span>
        </div>
      ` : ''}
    </section>
  `;
}

async function gantt() {
  let ganttData;
  try {
    const url = `/gantt${ganttProjectId ? `?project_id=${ganttProjectId}` : ''}`;
    ganttData = await api(url);
  } catch (err) {
    const rawTasks = await api('/tasks');
    ganttData = {
      projects: [],
      tasks: rawTasks,
      dependencies: [],
      criticalPathTaskIds: []
    };
  }
  ganttDataCache = ganttData;

  const projects = ganttData.projects || [];
  const allTasksRaw = ganttData.tasks || [];
  const dependencies = ganttData.dependencies || [];
  const criticalTaskIds = new Set(ganttData.criticalPathTaskIds || []);
  const users = state.user.role === 'admin' ? await api('/users').catch(() => []) : [];

  // Sprints: se pintan en el cronograma cuando se ve un solo proyecto
  const sprintProjectIds = ganttProjectId
    ? [ganttProjectId]
    : [...new Set([...projects.map(p => p.id), ...allTasksRaw.map(t => t.project_id)].filter(Boolean).map(String))];
  const sprintLists = sprintProjectIds.length <= 8
    ? await Promise.all(sprintProjectIds.map(id => api(`/projects/${id}/sprints`).catch(() => [])))
    : [];
  const withSprints = sprintLists.filter(list => Array.isArray(list) && list.length);
  ganttSprints = withSprints.length === 1 ? withSprints[0].filter(s => s.start_date && s.end_date) : [];
  ganttMilestones = await api(`/milestones${ganttProjectId ? `?project_id=${ganttProjectId}` : ''}`).catch(() => []);
  if (!Array.isArray(ganttMilestones)) ganttMilestones = [];

  const dayMs = 86400000;
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // Filtrado de tareas (Estado, Asignado y Búsqueda en vivo Ctrl+F)
  const filteredTasks = allTasksRaw.filter(t => {
    if (ganttStatusFilter && t.status !== ganttStatusFilter) return false;
    if (ganttAssigneeFilter && String(t.assigned_to || '') !== ganttAssigneeFilter) return false;
    if (ganttSearchFilter) {
      const q = ganttSearchFilter.toLowerCase();
      const matchTitle = (t.title || '').toLowerCase().includes(q);
      const matchAssignee = (t.assignee_name || '').toLowerCase().includes(q);
      const matchWbs = (t.wbs || '').toLowerCase().includes(q);
      if (!matchTitle && !matchAssignee && !matchWbs) return false;
    }
    if (ganttQuickFilter && !ganttMatchesQuickFilter(t, today)) return false;
    return true;
  });

  // Orden en escalera: cada tarea va debajo de la que empieza antes
  const ganttSortKey = d => (parseGanttDate(d) || new Date(8640000000000000)).getTime();
  filteredTasks.sort((a, b) =>
    ganttSortKey(a.start_date || a.due_date) - ganttSortKey(b.start_date || b.due_date)
    || ganttSortKey(a.due_date) - ganttSortKey(b.due_date)
    || a.id - b.id);

  // Estructura jerárquica WBS
  const wbsOrderedTasks = buildGanttWbsTree(filteredTasks);

  // Mapeo con fechas parseadas
  const scheduledTasks = [];
  const unscheduledTasks = [];

  wbsOrderedTasks.forEach(t => {
    const start = parseGanttDate(t.start_date) || (t.due_date ? parseGanttDate(t.due_date) : null);
    const due = parseGanttDate(t.due_date) || start;
    const isCritical = criticalTaskIds.has(t.id);

    if (start && due) {
      scheduledTasks.push({ ...t, startDate: start, dueDate: due, isCritical });
    } else {
      unscheduledTasks.push({ ...t, isCritical });
    }
  });

  // Opciones de integrantes y proyectos
  const projectOptions = projects.map(p =>
    `<option value="${p.id}" ${ganttProjectId === String(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`
  ).join('');

  const assigneeOptions = users.filter(u => u.role === 'member').map(u =>
    `<option value="${u.id}" ${ganttAssigneeFilter === String(u.id) ? 'selected' : ''}>${esc(u.name)}</option>`
  ).join('');

  const activeProj = projects.find(p => String(p.id) === String(ganttProjectId));
  const activeProjectName = activeProj ? activeProj.name : 'Todos los Proyectos';
  const criticalCount = criticalTaskIds.size;

  const unscheduledHtml = unscheduledTasks.length ? `
    <section class="card mt-4">
      <h3>Tareas sin fecha (${unscheduledTasks.length})</h3>
      <p class="muted">Asígnales fecha inicial y límite para incluirlas en la línea de tiempo:</p>
      <div class="grid stats">
        ${unscheduledTasks.map(t => `
          <div class="gantt-unscheduled-item" data-id="${t.id}" style="cursor:pointer" onclick="openGanttQuickEdit(${t.id})">
                <strong>${t.is_milestone ? `${icon('flag')} ` : ''}${esc(t.title)}</strong>
            <small class="muted">${esc(t.assignee_name || 'Sin asignar')} · ${esc(t.priority)}</small>
          </div>
        `).join('')}
      </div>
    </section>
  ` : '';

  // Resumen (tarjetas que también sirven de filtro rápido)
  const summaryHtml = ganttActiveTab === 'resources' ? '' : ganttSummaryHtml(ganttSummary(allTasksRaw, today));

  // Una sola vista a la vez: Cronograma, Calendario o Recursos
  const viewTabs = [
    ['gantt', 'Cronograma', 'gantt'],
    ['calendar', 'Calendario', 'calendar'],
    ['resources', 'Recursos', 'users']
  ];
  let viewHtml;
  if (ganttActiveTab === 'calendar') {
    ganttCalendarCollapsed = false; // en su propia pestaña el calendario siempre se ve completo
    viewHtml = ganttCalendarViewHtml(scheduledTasks, today);
  } else {
    viewHtml = ganttChartMarkup(scheduledTasks, unscheduledTasks, dependencies, criticalTaskIds, users, activeProjectName, projectOptions, assigneeOptions, criticalCount);
  }

  return `
    <div class="gv-page">
      ${heading('Gantt', 'Cronograma, entregas y carga de trabajo del equipo.',
        `<button type="button" class="btn" id="gtc-new-task">${icon('plus')} Nueva tarea</button>`)}
      <div class="gv-tabs" role="tablist" aria-label="Vistas del Gantt">
        ${viewTabs.map(([key, label, ic]) => `
          <button type="button" class="gv-tab ${ganttActiveTab === key ? 'active' : ''}" data-gv-tab="${key}" role="tab" aria-selected="${ganttActiveTab === key}">
            ${icon(ic)} ${label}
          </button>
        `).join('')}
      </div>
      ${summaryHtml}
      ${viewHtml}
      ${ganttActiveTab === 'gantt' ? unscheduledHtml : ''}
    </div>
  `;
}

function selectGanttTask(id) {
  ganttSelectedTaskId = Number(id);
  document.querySelectorAll('.gp-row-table, .gtc-row-table').forEach(r => {
    r.classList.toggle('is-selected', Number(r.dataset.id) === ganttSelectedTaskId);
  });
  document.querySelectorAll('.gp-row-track, .gtc-row').forEach(r => {
    r.classList.toggle('is-selected', Number(r.dataset.rowId) === ganttSelectedTaskId);
  });
}

function switchGanttTab(tabName) {
  ganttActiveTab = tabName;
  renderGantt();
}

function toggleGanttCriticalPath() {
  ganttShowCriticalPath = !ganttShowCriticalPath;
  renderGantt();
}

function toggleGanttBaselines() {
  ganttShowBaselines = !ganttShowBaselines;
  renderGantt();
}

function toggleGanttCalendar() {
  ganttCalendarCollapsed = !ganttCalendarCollapsed;
  renderGantt();
}

async function outdentSelectedGanttTask() {
  if (!ganttSelectedTaskId) {
    notify('Selecciona primero una tarea en la tabla para promover su nivel');
    return;
  }
  const tasks = ganttDataCache?.tasks || [];
  const task = tasks.find(t => t.id === ganttSelectedTaskId);
  if (!task) return;
  if (!task.parent_id) {
    notify('La tarea ya está en el nivel superior (raíz) del WBS');
    return;
  }
  const parentTask = tasks.find(t => t.id === task.parent_id);
  const newParentId = parentTask?.parent_id || null;
  try {
    await api(`/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: task.title,
        description: task.description || '',
        assigned_to: task.assigned_to || '',
        priority: task.priority,
        status: task.status,
        start_date: task.start_date,
        due_date: task.due_date,
        parent_id: newParentId
      })
    });
    notify('Nivel WBS promovido (Outdent)');
    renderGantt();
  } catch (e) { notify(e.message); }
}

async function indentSelectedGanttTask() {
  if (!ganttSelectedTaskId) {
    notify('Selecciona primero una tarea en la tabla para hacerla subtarea');
    return;
  }
  const tasks = ganttDataCache?.tasks || [];
  const idx = tasks.findIndex(t => t.id === ganttSelectedTaskId);
  if (idx <= 0) {
    notify('No hay una tarea superior inmediata para convertirla en padre');
    return;
  }
  const prevTask = tasks[idx - 1];
  try {
    await api(`/tasks/${ganttSelectedTaskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: tasks[idx].title,
        description: tasks[idx].description || '',
        assigned_to: tasks[idx].assigned_to || '',
        priority: tasks[idx].priority,
        status: tasks[idx].status,
        start_date: tasks[idx].start_date,
        due_date: tasks[idx].due_date,
        parent_id: prevTask.id
      })
    });
    notify('Subtarea creada (Indent)');
    renderGantt();
  } catch (e) { notify(e.message); }
}

async function deleteSelectedGanttTask() {
  if (!ganttSelectedTaskId) {
    notify('Selecciona una tarea para eliminar');
    return;
  }
  if (!confirm('¿Deseas eliminar la tarea seleccionada del proyecto?')) return;
  try {
    await api(`/tasks/${ganttSelectedTaskId}`, { method: 'DELETE' });
    notify('Tarea eliminada');
    ganttSelectedTaskId = null;
    renderGantt();
  } catch (e) { notify(e.message); }
}

function editSelectedGanttTask() {
  if (!ganttSelectedTaskId) {
    notify('Selecciona una tarea para ver sus propiedades');
    return;
  }
  openGanttQuickEdit(ganttSelectedTaskId);
}

function linkSelectedGanttTask() {
  if (!ganttSelectedTaskId) {
    notify('Selecciona una tarea para vincular dependencias');
    return;
  }
  openGanttQuickEdit(ganttSelectedTaskId);
}

async function unlinkSelectedGanttTask() {
  if (!ganttSelectedTaskId) {
    notify('Selecciona una tarea para desvincular sus dependencias');
    return;
  }
  const deps = (ganttDataCache?.dependencies || []).filter(d => d.task_id === ganttSelectedTaskId || d.predecessor_id === ganttSelectedTaskId);
  if (!deps.length) {
    notify('La tarea seleccionada no tiene dependencias activas');
    return;
  }
  try {
    for (const d of deps) {
      await api(`/gantt/dependencies/${d.id}`, { method: 'DELETE' });
    }
    notify(`Se eliminaron ${deps.length} dependencia(s)`);
    renderGantt();
  } catch (e) { notify(e.message); }
}

let ganttClipboardTaskId = null;
let ganttClipboardAction = null;

function cutSelectedGanttTask() {
  if (!ganttSelectedTaskId) {
    notify('Selecciona una tarea para cortar');
    return;
  }
  ganttClipboardTaskId = ganttSelectedTaskId;
  ganttClipboardAction = 'cut';
  notify('Tarea cortada al portapapeles ✂️');
}

function copySelectedGanttTask() {
  if (!ganttSelectedTaskId) {
    notify('Selecciona una tarea para copiar');
    return;
  }
  ganttClipboardTaskId = ganttSelectedTaskId;
  ganttClipboardAction = 'copy';
  notify('Tarea copiada al portapapeles 📄');
}

async function pasteSelectedGanttTask() {
  if (!ganttClipboardTaskId) {
    notify('El portapapeles de tareas está vacío');
    return;
  }
  const tasks = ganttDataCache?.tasks || [];
  const source = tasks.find(t => t.id === ganttClipboardTaskId);
  if (!source) return;
  if (ganttClipboardAction === 'copy') {
    try {
      await api('/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: source.project_id || (ganttProjectId ? Number(ganttProjectId) : 1),
          title: `${source.title} (Copia)`,
          description: source.description || '',
          assigned_to: source.assigned_to || '',
          priority: source.priority || 'media',
          status: 'pendiente',
          start_date: source.start_date || null,
          due_date: source.due_date || null,
          parent_id: ganttSelectedTaskId || null
        })
      });
      notify('Tarea duplicada pegada con éxito 📋');
      renderGantt();
    } catch (e) { notify(e.message); }
  } else if (ganttClipboardAction === 'cut') {
    try {
      await api(`/tasks/${source.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: source.title,
          description: source.description || '',
          assigned_to: source.assigned_to || '',
          priority: source.priority,
          status: source.status,
          start_date: source.start_date,
          due_date: source.due_date,
          parent_id: ganttSelectedTaskId || null
        })
      });
      ganttClipboardTaskId = null;
      notify('Tarea movida como subtarea 📋');
      renderGantt();
    } catch (e) { notify(e.message); }
  }
}

function moveSelectedGanttTask(direction) {
  if (!ganttSelectedTaskId) {
    notify('Selecciona primero una tarea para reordenar');
    return;
  }
  const tasks = ganttDataCache?.tasks || [];
  const idx = tasks.findIndex(t => t.id === ganttSelectedTaskId);
  if (idx < 0) return;
  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= tasks.length) {
    notify('La tarea ya se encuentra en el límite de la lista');
    return;
  }
  const temp = tasks[idx];
  tasks[idx] = tasks[targetIdx];
  tasks[targetIdx] = temp;
  renderGantt();
  notify(`Tarea movida ${direction < 0 ? 'hacia arriba' : 'hacia abajo'}`);
}

function ganttChartMarkup(scheduledTasks, unscheduledTasks, dependencies = [], criticalTaskIds = new Set(), users = [], activeProjectName = 'Todos los Proyectos', projectOptions = '', assigneeOptions = '', criticalCount = 0) {
  const dayMs = 86400000;
  const today = new Date(); today.setHours(0, 0, 0, 0);

  let min = null, max = null;
  scheduledTasks.forEach(t => {
    if (!min || t.startDate < min) min = t.startDate;
    if (!max || t.dueDate > max) max = t.dueDate;
  });

  if (!min) { min = new Date(today); max = new Date(today); }
  min = new Date(min); min.setDate(min.getDate() - 3);
  max = new Date(max); max.setDate(max.getDate() + 7);
  if (max < today) { max = new Date(today); max.setDate(max.getDate() + 14); }
  if (min > today) { min = new Date(today); min.setDate(min.getDate() - 3); }

  ganttChartMinDate = min;
  const totalDays = Math.round((max - min) / dayMs) + 1;

  // Configurar ancho de día según escala
  let dayWidth = ganttChartZoom;
  if (ganttTimeScale === 'week') dayWidth = Math.max(14, Math.round(ganttChartZoom * 0.55));
  if (ganttTimeScale === 'month') dayWidth = Math.max(8, Math.round(ganttChartZoom * 0.3));

  const todayOffset = Math.round((today - min) / dayMs);

  // Cabecera de meses
  const months = [];
  let cursor = new Date(min);
  while (cursor <= max) {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    const nextMonth = new Date(y, m + 1, 1);
    const segEnd = nextMonth <= max ? new Date(nextMonth.getTime() - dayMs) : new Date(max);
    const days = Math.round((segEnd - cursor) / dayMs) + 1;
    const isoDate = toISODate(cursor);
    const rawLabel = cursor.toLocaleDateString('es', { month: 'long', year: 'numeric' });
    const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
    const rawShort = cursor.toLocaleDateString('es', { month: 'short' }).replace('.', '');
    const shortLabel = `${rawShort.charAt(0).toUpperCase() + rawShort.slice(1)} ${y}`;
    months.push({ label, shortLabel, days, isoDate, year: y, month: m });
    cursor = nextMonth;
  }

  // Celdas de días
  const dayCells = [];
  for (let i = 0; i < totalDays; i++) {
    const date = new Date(min.getTime() + i * dayMs);
    const isToday = date.getTime() === today.getTime();
    const isWeekend = [0, 6].includes(date.getDay());
    const isoDate = toISODate(date);
    const dow = GANTT_DOW_SHORT[date.getDay()];
    const fullDateTitle = date.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    let contentHtml = '';
    if (ganttTimeScale === 'month') {
      contentHtml = date.getDate() === 1 ? `<span class="gtc-day-num">1</span>` : '';
    } else if (ganttTimeScale === 'week') {
      contentHtml = (date.getDay() === 1 || isToday)
        ? `<span class="gtc-day-dow">${isToday ? 'Hoy' : 'Lu'}</span><span class="gtc-day-num">${date.getDate()}</span>`
        : '';
    } else {
      contentHtml = `
        <span class="gtc-day-dow">${dow}</span>
        <span class="gtc-day-num">${date.getDate()}</span>
      `;
    }
    dayCells.push(`<div class="gp-day-col gtc-day ${isToday ? 'is-today' : ''} ${isWeekend ? 'is-weekend' : ''}" data-date="${isoDate}" style="width:${dayWidth}px" title="${fullDateTitle}">${contentHtml}</div>`);
  }

  const rows = scheduledTasks;

  // Mapeo de índices para conectores SVG de dependencias
  const taskRowIndexMap = new Map();
  rows.forEach((t, idx) => taskRowIndexMap.set(t.id, idx));

  // Lado Izquierdo: lista de tareas (nombre, responsable, fechas y avance)
  ganttTaskIndex = new Map(rows.map(t => [t.id, t]));
  const labelsHtml = rows.map(t => {
    const prog = ganttTaskProgress(t);
    const isCrit = ganttShowCriticalPath && t.isCritical;
    const info = ganttDeadlineInfo(t, today);
    const isSelected = ganttSelectedTaskId === t.id;

    const indents = '<span class="gtc-tree-indent"></span>'.repeat(t.depth || 0);
    const treeToggle = t.has_children
      ? `<button type="button" class="gtc-tree-btn" data-collapse-id="${t.id}" title="${t.is_collapsed ? 'Expandir subtareas' : 'Colapsar subtareas'}">${t.is_collapsed ? icon('chevronRight') : icon('chevronDown')}</button>`
      : '';
    const milestoneSymbol = t.is_milestone ? `<span class="gtc-milestone-icon" title="Hito">${icon('flag')}</span>` : '';

    return `
      <div class="gp-row-table gtc-row-table ${t.is_summary ? 'is-summary' : ''} ${isCrit ? 'is-critical' : ''} ${isSelected ? 'is-selected' : ''}"
           data-id="${t.id}"
           onclick="selectGanttTask(${t.id})"
           ondblclick="openGanttQuickEdit(${t.id})">
        <div class="gtc-col-title" title="${esc(t.title)}">
          ${indents}${treeToggle}${milestoneSymbol}
          <i class="gv-status-dot ${info.risk ? 'riesgo' : info.key}" title="${info.risk ? 'En riesgo' : info.label}"></i>
          <span class="gv-task-name">${esc(t.title)}</span>
        </div>
        <div class="gv-col-who">${ganttAvatarHtml(t)}</div>
        <div class="gv-col-when ${info.key} ${info.soon ? 'is-soon' : ''} ${info.risk ? 'is-risk' : ''}" title="Inicio: ${formatGanttDate(t.start_date, true)} · Fin: ${formatGanttDate(t.due_date, true)}">
          <span>${formatGanttDate(t.start_date)} – ${formatGanttDate(t.due_date)}</span>
          ${info.note ? `<small>${info.note}</small>` : ''}
        </div>
        <div class="gv-col-prog" title="Avance ${prog}%">
          <span class="gv-mini-bar"><i style="width:${prog}%"></i></span>
          <b>${prog}%</b>
        </div>
      </div>
    `;
  }).join('');

  // Lado Derecho: Tracks y Barras
  const tracksHtml = rows.map((t, idx) => {
    const offset = Math.round((t.startDate - min) / dayMs);
    const span = Math.max(1, Math.round((t.dueDate - t.startDate) / dayMs) + 1);
    const prog = ganttTaskProgress(t);
    const barInfo = ganttDeadlineInfo(t, today);
    // Botones que aparecen en la orilla cuando la barra queda fuera de la vista
    const edgeChips = `
      <button type="button" class="gv-edge left" data-goto="${t.start_date || ''}" title="Ir a esta tarea">‹ ${formatGanttDate(t.start_date)}</button>
      <button type="button" class="gv-edge right" data-goto="${t.start_date || ''}" title="Ir a esta tarea">${formatGanttDate(t.start_date)} ›</button>`;
    const isCrit = ganttShowCriticalPath && t.isCritical;
    const isOverdue = t.status !== 'completada' && t.dueDate && t.dueDate < today;
    const barWidth = Math.max(dayWidth - 4, span * dayWidth - 4);
    const leftPx = offset * dayWidth;

    // Barra de línea base (si existe y toggle activo)
    let baselineHtml = '';
    if (ganttShowBaselines && t.baseline_start_date) {
      const baseStart = new Date(`${t.baseline_start_date}T00:00:00`);
      const baseDue = t.baseline_due_date ? new Date(`${t.baseline_due_date}T00:00:00`) : baseStart;
      const baseOffset = Math.round((baseStart - min) / dayMs);
      const baseSpan = Math.max(1, Math.round((baseDue - baseStart) / dayMs) + 1);
      const baseLeft = baseOffset * dayWidth;
      const baseWidth = Math.max(dayWidth - 4, baseSpan * dayWidth - 4);
      baselineHtml = `<div class="gtc-baseline-track" style="left:${baseLeft}px;width:${baseWidth}px" title="Línea Base: ${t.baseline_start_date} a ${t.baseline_due_date || t.baseline_start_date}"></div>`;
    }

    // Tarea Hito (Rombo diamante)
    if (t.is_milestone) {
      return `
        <div class="gp-row-track gtc-row" data-row-id="${t.id}" data-row-idx="${idx}">
          ${baselineHtml}
          <div class="gtc-milestone-diamond ${isCrit ? 'is-critical' : ''}"
               data-id="${t.id}"
               style="left:${leftPx + Math.round(dayWidth / 2) - 8}px"
               title="${esc(t.title)} (Hito) · Fecha: ${formatGanttDate(t.start_date, true)} · ${prog}%">
          </div>
          <span class="gtc-bar-label" style="position:absolute;left:${leftPx + dayWidth + 4}px;top:10px;font-size:11px;font-weight:600;pointer-events:none;white-space:nowrap">
            ${esc(t.title)} <span class="gtc-date-tag">${formatGanttDate(t.start_date)}</span>
          </span>
          ${edgeChips}
        </div>
      `;
    }

    // Tarea Padre de Resumen (Summary bracket)
    if (t.is_summary) {
      return `
        <div class="gp-row-track gtc-row" data-row-id="${t.id}" data-row-idx="${idx}">
          ${baselineHtml}
          <div class="gtc-summary-bar ${isCrit ? 'is-critical' : ''}"
               data-id="${t.id}"
               style="left:${leftPx}px;width:${barWidth}px"
               title="Resumen: ${esc(t.title)} · ${formatGanttDate(t.start_date)} al ${formatGanttDate(t.due_date)} · ${prog}%">
          </div>
          <span class="gtc-bar-label" style="position:absolute;left:${leftPx + barWidth + 6}px;top:13px;font-size:11px;font-weight:600;pointer-events:none">
            ${esc(t.title)} (${prog}%)
          </span>
          ${edgeChips}
        </div>
      `;
    }

    // Barra estándar de tarea
    const roomy = barWidth >= 110;
    return `
      <div class="gp-row-track gtc-row" data-row-id="${t.id}" data-row-idx="${idx}">
        ${baselineHtml}
        <div class="gtc-bar ${t.status} ${isCrit ? 'is-critical' : ''} ${isOverdue ? 'is-overdue' : ''} ${barInfo.risk ? 'is-risk' : ''}"
             data-id="${t.id}"
             data-start="${t.start_date || ''}"
             data-due="${t.due_date || ''}"
             style="left:${leftPx}px;width:${barWidth}px">
          <span class="gtc-bar-fill" style="width:${prog}%"></span>
          ${barInfo.expected !== null && barInfo.expected < 100 && barInfo.key !== 'atrasada' ? `<span class="gv-expected" style="left:${barInfo.expected}%"></span>` : ''}
          <button type="button" class="gtc-bar-handle left" data-edge="start" aria-label="Ajustar inicio"></button>
          ${barWidth >= 60 ? ganttAvatarHtml(t, 'in-bar') : ''}
          ${roomy ? `<span class="gtc-bar-label">${esc(t.title)}</span>` : ''}
          <button type="button" class="gtc-bar-handle right" data-edge="due" aria-label="Ajustar fin"></button>
        </div>
        ${roomy ? '' : `<span class="gv-bar-outside" style="left:${leftPx + barWidth + 8}px">${esc(t.title)}</span>`}
        ${edgeChips}
      </div>
    `;
  }).join('');

  // Conectores SVG de Dependencias
  const svgWidth = totalDays * dayWidth;
  const svgHeight = rows.length * 42;
  const depPaths = [];

  dependencies.forEach(dep => {
    const predIdx = taskRowIndexMap.get(dep.predecessor_id);
    const succIdx = taskRowIndexMap.get(dep.task_id);
    if (predIdx === undefined || succIdx === undefined) return;

    const predTask = rows[predIdx];
    const succTask = rows[succIdx];
    if (!predTask || !succTask) return;

    const predOffset = Math.round((predTask.startDate - min) / dayMs);
    const predSpan = Math.max(1, Math.round((predTask.dueDate - predTask.startDate) / dayMs) + 1);
    const predX = (predOffset + predSpan) * dayWidth - 2;
    const predY = predIdx * 42 + 21;

    const succOffset = Math.round((succTask.startDate - min) / dayMs);
    const succX = succOffset * dayWidth;
    const succY = succIdx * 42 + 21;

    const isDepCrit = ganttShowCriticalPath && predTask.isCritical && succTask.isCritical;
    const markerId = isDepCrit ? 'url(#gtc-arrow-crit)' : 'url(#gtc-arrow)';

    let pathD = '';
    if (succX >= predX + 10) {
      const midX = Math.round((predX + succX) / 2);
      pathD = `M ${predX} ${predY} H ${midX} V ${succY} H ${succX}`;
    } else {
      const loopOutX = predX + 12;
      const loopInX = succX - 12;
      const midY = Math.round((predY + succY) / 2);
      pathD = `M ${predX} ${predY} H ${loopOutX} V ${midY} H ${loopInX} V ${succY} H ${succX}`;
    }

    depPaths.push(`
      <path d="${pathD}"
            class="gtc-dep-path ${isDepCrit ? 'is-critical' : ''}"
            marker-end="${markerId}"
            data-dep-id="${dep.id}"
            title="Dependencia: ${esc(predTask.title)} ➔ ${esc(succTask.title)} (${dep.dependency_type || 'FS'})">
      </path>
    `);
  });

  const svgLayerHtml = `
    <svg class="gtc-dep-svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
      <defs>
        <marker id="gtc-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 9 5 L 0 9 z" class="gtc-dep-marker" />
        </marker>
        <marker id="gtc-arrow-crit" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 9 5 L 0 9 z" class="gtc-dep-marker is-critical" />
        </marker>
      </defs>
      ${depPaths.join('')}
    </svg>
  `;

  // Recursos: una fila por persona, sus tareas en carriles (sin encimarse),
  // una franja de carga por día y un aviso si está sobrecargada o libre.
  let resourceLeftHtml = '';
  let resourceTimelineHtml = '';
  let resourceSummaryHtml = '';
  let resourceRowsHeight = 0;
  if (ganttActiveTab === 'resources') {
    const LANE_H = 30, HEAT_H = 8, PAD = 8;
    const people = new Map();
    users.filter(u => u.active !== 0).forEach(u => people.set(String(u.id), { id: String(u.id), name: u.name, email: u.email || '', tasks: [] }));
    // Las tareas padre solo agrupan a sus subtareas: no se cuentan como trabajo aparte
    scheduledTasks.filter(t => !t.has_children).forEach(t => {
      const key = t.assigned_to ? String(t.assigned_to) : 'none';
      if (!people.has(key)) people.set(key, { id: key, name: key === 'none' ? 'Sin responsable' : (t.assignee_name || 'Integrante'), email: '', tasks: [] });
      people.get(key).tasks.push(t);
    });

    const dayIndex = d => Math.round((d - min) / dayMs);
    const todayIdx = dayIndex(today);
    const fmt = i => formatGanttDate(toISODate(new Date(min.getTime() + i * dayMs)));
    let overloaded = 0, free = 0;

    const rowsData = [...people.values()]
      .filter(p => p.id !== 'none' || p.tasks.length)
      .map(p => {
        // Carriles: cada tarea va en el primer carril donde no choca con otra
        const lanes = [];
        const placed = [...p.tasks].sort((a, b) => a.startDate - b.startDate).map(t => {
          const s = dayIndex(t.startDate), e = dayIndex(t.dueDate);
          let lane = lanes.findIndex(end => end < s);
          if (lane === -1) { lane = lanes.length; lanes.push(e); } else lanes[lane] = e;
          return { t, s, e, lane };
        });
        // Carga por día (solo tareas sin terminar)
        const load = new Array(totalDays).fill(0);
        placed.forEach(({ t, s, e }) => {
          if (t.status === 'completada') return;
          for (let i = Math.max(0, s); i <= Math.min(totalDays - 1, e); i++) load[i]++;
        });
        // Aviso: sobrecarga desde hoy, o libre los próximos 7 días
        let status = { tone: 'ok', text: 'Carga normal' };
        let from = -1;
        for (let i = Math.max(0, todayIdx); i < totalDays; i++) {
          if (load[i] >= 3 && from === -1) from = i;
          if (from !== -1 && (load[i] < 3 || i === totalDays - 1)) {
            const to = load[i] < 3 ? i - 1 : i;
            const peak = Math.max(...load.slice(from, to + 1));
            status = { tone: 'bad', text: `Sobrecargado: ${peak} tareas a la vez del ${fmt(from)} al ${fmt(to)}` };
            break;
          }
        }
        const active = p.tasks.filter(t => t.status !== 'completada').length;
        const nextWeek = load.slice(Math.max(0, todayIdx), Math.max(0, todayIdx) + 7);
        if (status.tone !== 'bad') {
          if (p.id === 'none') status = { tone: 'warn', text: 'Tareas que nadie tiene asignadas' };
          else if (!nextWeek.some(n => n > 0)) status = { tone: 'calm', text: active ? 'Libre esta semana' : 'Sin tareas pendientes' };
          else if (nextWeek.some(n => n === 2)) status = { tone: 'warn', text: 'Ocupado: 2 tareas a la vez esta semana' };
        }
        if (status.tone === 'bad') overloaded++;
        if (status.tone === 'calm' && p.id !== 'none') free++;
        const height = Math.max(1, lanes.length) * LANE_H + HEAT_H + PAD * 2;
        return { p, placed, load, status, active, done: p.tasks.length - active, height };
      });

    resourceRowsHeight = rowsData.reduce((sum, r) => sum + r.height, 0);
    const unassigned = rowsData.find(r => r.p.id === 'none')?.active || 0;

    resourceLeftHtml = rowsData.map(r => `
      <div class="gv-res-person" style="height:${r.height}px">
        ${r.p.id === 'none' ? '<span class="gv-avatar is-empty">?</span>' : ganttAvatarHtml({ assignee_name: r.p.name, assigned_to: r.p.id })}
        <div class="gv-res-info">
          <strong>${esc(r.p.name)}</strong>
          <span class="gv-res-status ${r.status.tone}">${esc(r.status.text)}</span>
        </div>
        <div class="gv-res-count" title="${r.active} sin terminar · ${r.done} terminadas">
          <b>${r.active}</b><small>${r.active === 1 ? 'activa' : 'activas'}</small>
        </div>
      </div>
    `).join('') || '<div class="empty" style="padding:24px">No hay tareas asignadas con fechas.</div>';

    resourceTimelineHtml = rowsData.map(r => {
      // Franja de carga: se juntan los días seguidos con el mismo nivel
      const segments = [];
      for (let i = 0; i < totalDays; i++) {
        const level = Math.min(3, r.load[i]);
        const last = segments[segments.length - 1];
        if (last && last.level === level) last.to = i; else segments.push({ level, from: i, to: i });
      }
      const heat = segments.filter(sg => sg.level > 0).map(sg =>
        `<span class="gv-heat l${sg.level}" style="left:${sg.from * dayWidth}px;width:${(sg.to - sg.from + 1) * dayWidth}px" title="${sg.level >= 3 ? '3 o más tareas a la vez' : `${sg.level} ${sg.level === 1 ? 'tarea' : 'tareas a la vez'}`}: ${fmt(sg.from)} al ${fmt(sg.to)}"></span>`).join('');
      const bars = r.placed.map(({ t, s, e, lane }) => {
        const info = ganttDeadlineInfo(t, today);
        const width = Math.max(dayWidth - 4, (e - s + 1) * dayWidth - 4);
        return `
          <div class="gv-res-bar ${t.status} ${info.key === 'atrasada' ? 'is-overdue' : ''} ${info.risk ? 'is-risk' : ''}"
               data-id="${t.id}" style="left:${s * dayWidth}px;width:${width}px;top:${PAD + lane * LANE_H}px">
            <span>${t.is_milestone ? icon('flag') : ''}${esc(t.title)}</span>
          </div>`;
      }).join('');
      return `
        <div class="gv-res-track" style="height:${r.height}px">
          ${bars}
          <div class="gv-heat-row" style="top:${r.height - PAD - HEAT_H}px">${heat}</div>
        </div>`;
    }).join('');

    resourceSummaryHtml = `
      <div class="gv-res-summary">
        <span class="${overloaded ? 'bad' : ''}"><b>${overloaded}</b> ${overloaded === 1 ? 'persona sobrecargada' : 'personas sobrecargadas'}</span>
        <span><b>${free}</b> ${free === 1 ? 'persona libre' : 'personas libres'} esta semana</span>
        <span class="${unassigned ? 'warn' : ''}"><b>${unassigned}</b> ${unassigned === 1 ? 'tarea sin responsable' : 'tareas sin responsable'}</span>
      </div>`;
  }

  const emptyState = rows.length ? '' : '<div class="empty" style="padding:40px;text-align:center">No hay tareas con fechas para los filtros seleccionados.</div>';
  const overdueCount = scheduledTasks.filter(t => t.status !== 'completada' && t.dueDate < today).length;
  const exportQuery = ganttProjectId ? `?project_id=${ganttProjectId}` : '';
  const scaleBtn = (id, value, label) =>
    `<button type="button" id="${id}" class="${ganttTimeScale === value ? 'active' : ''}" aria-pressed="${ganttTimeScale === value}">${label}</button>`;

  // Barra de herramientas: una sola línea con lo que se usa siempre; lo demás va en "Más"
  const toolbarHtml = `
    <div class="gv-toolbar gantt-gp-toolbar">
      <div class="gv-group">
        <select class="select gv-select" id="gantt-project-filter" aria-label="Proyecto">
          <option value="">Proyecto: todos</option>
          ${projectOptions}
        </select>
        <select class="select gv-select" id="gantt-status-filter" aria-label="Estado">
          <option value="">Estado: todos</option>
          <option value="pendiente" ${ganttStatusFilter === 'pendiente' ? 'selected' : ''}>Pendiente</option>
          <option value="en_proceso" ${ganttStatusFilter === 'en_proceso' ? 'selected' : ''}>En proceso</option>
          <option value="en_revision" ${ganttStatusFilter === 'en_revision' ? 'selected' : ''}>En revisión</option>
          <option value="bloqueada" ${ganttStatusFilter === 'bloqueada' ? 'selected' : ''}>Bloqueada</option>
          <option value="completada" ${ganttStatusFilter === 'completada' ? 'selected' : ''}>Completada</option>
        </select>
        ${assigneeOptions ? `
          <select class="select gv-select" id="gantt-assignee-filter" aria-label="Integrante">
            <option value="">Responsable: todos</option>
            ${assigneeOptions}
          </select>` : ''}
        <label class="gv-search">
          ${icon('search')}
          <input type="search" id="gp-search-input" placeholder="Buscar tarea…" value="${esc(ganttSearchFilter)}" aria-label="Buscar tarea">
        </label>
      </div>
      <div class="gv-group">
        <div class="gv-segmented" role="group" aria-label="Escala de tiempo">
          ${scaleBtn('gtc-scale-day', 'day', 'Día')}
          ${scaleBtn('gtc-scale-week', 'week', 'Semana')}
          ${scaleBtn('gtc-scale-month', 'month', 'Mes')}
        </div>
        <button type="button" class="gv-btn" id="gtc-today-btn" title="Ir a la fecha de hoy">Hoy</button>
      </div>
      <div class="gv-group gv-group-end">
        <details class="gv-more">
          <summary class="gv-btn">Más ⋯</summary>
          <div class="gv-menu" role="menu">
            <div class="gv-menu-title">Crear</div>
            <button type="button" id="gtc-new-milestone">${icon('flag')} Nuevo hito</button>
            <div class="gv-menu-title">Vista</div>
            ${ganttActiveTab === 'gantt' ? `
              <button type="button" id="gtc-toggle-critical" class="${ganttShowCriticalPath ? 'is-on' : ''}" title="Marca en rojo las tareas que, si se retrasan, retrasan todo el proyecto">
                <span class="gv-check" aria-hidden="true">${ganttShowCriticalPath ? '✓' : ''}</span> Ruta crítica${criticalCount > 0 ? ` <span class="gtc-critical-badge">${criticalCount}</span>` : ''}
              </button>` : ''}
            <button type="button" id="gtc-zoom-in">Acercar (días más anchos)</button>
            <button type="button" id="gtc-zoom-out">Alejar (ver más días)</button>
            ${ganttActiveTab === 'gantt' ? `
              <div class="gv-menu-title">Tarea seleccionada <small>(primero haz clic en una fila)</small></div>
              <button type="button" id="gp-tool-props">Editar tarea</button>
              <button type="button" id="gp-btn-indent">Convertir en subtarea</button>
              <button type="button" id="gp-btn-outdent">Subir de nivel</button>
              <button type="button" id="gp-btn-link">Agregar dependencia</button>
              <button type="button" id="gp-btn-unlink">Quitar dependencias</button>
              <button type="button" id="gp-tool-delete" class="is-danger">Eliminar tarea</button>
              <div class="gv-menu-title">Planeación</div>
              <button type="button" id="gtc-toggle-baseline">${ganttShowBaselines ? 'Ocultar' : 'Mostrar'} línea base</button>
              <button type="button" id="gtc-save-baseline">Guardar línea base</button>
              <button type="button" id="gtc-auto-schedule">Acomodar fechas por dependencias</button>` : ''}
            <div class="gv-menu-title">Archivo</div>
            <a id="gtc-export-gan" href="/api/gantt/export/gan${exportQuery}" download>Exportar a GanttProject (.gan)</a>
            <a id="gtc-export-csv" href="/api/gantt/export/csv${exportQuery}" download>Exportar a Excel (.csv)</a>
            <button type="button" id="gtc-import-btn">Importar archivo .gan</button>
          </div>
        </details>
      </div>
    </div>
  `;

  const legendHtml = `
    <div class="gv-legend">
      <span><i class="gv-dot pendiente"></i>Pendiente</span>
      <span><i class="gv-dot en_proceso"></i>En proceso</span>
      <span><i class="gv-dot en_revision"></i>En revisión</span>
      <span><i class="gv-dot bloqueada"></i>Bloqueada</span>
      <span><i class="gv-dot completada"></i>Completada</span>
      <span><i class="gv-dot atrasada"></i>Atrasada</span>
      <span><i class="gv-dot riesgo"></i>En riesgo</span>
      <span><i class="gv-expected-key"></i>Avance esperado a hoy</span>
      ${ganttShowCriticalPath ? '<span><i class="gv-dot critica"></i>Ruta crítica</span>' : ''}
      ${ganttMilestones.length ? '<span><i class="gv-hito-key"></i>Hito del proyecto</span>' : ''}
      <span class="gv-legend-count">${scheduledTasks.length} ${scheduledTasks.length === 1 ? 'tarea' : 'tareas'}${overdueCount ? ` · <strong>${overdueCount} ${overdueCount === 1 ? 'atrasada' : 'atrasadas'}</strong>` : ''}</span>
    </div>
  `;

  const timelineHeadHtml = clickable => `
    ${sprintRowHtml}${milestoneRowHtml}
    <div class="gp-timeline-months gtc-months">
      ${months.map(m => `<div class="gp-timeline-month gtc-month" style="width:${m.days * dayWidth}px"${clickable ? ` onclick="scrollToGanttDate('${m.isoDate}')" title="Ir a ${esc(m.label)}"` : ''}>${esc(m.label)}</div>`).join('')}
    </div>
    <div class="gp-timeline-days gtc-days">
      ${dayCells.join('')}
    </div>
  `;
  // Sprints: franja con su nombre arriba y sombra suave en las filas
  const sprintBands = ganttSprints.map(s => {
    const sStart = parseGanttDate(s.start_date), sEnd = parseGanttDate(s.end_date);
    if (!sStart || !sEnd || sEnd < min || sStart > max) return null;
    const from = Math.max(0, Math.round((sStart - min) / dayMs));
    const to = Math.min(totalDays - 1, Math.round((sEnd - min) / dayMs));
    const daysLeft = Math.round((sEnd - today) / dayMs);
    const stateLabel = s.status === 'activo' ? (daysLeft >= 0 ? `activo · faltan ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}` : 'activo') : (s.status === 'cerrado' ? 'cerrado' : 'planificado');
    return { left: from * dayWidth, width: (to - from + 1) * dayWidth, name: s.name, stateLabel, status: s.status };
  }).filter(Boolean);
  const sprintRowHtml = sprintBands.length ? `
    <div class="gv-sprint-row">
      ${sprintBands.map(b => `<div class="gv-sprint ${b.status}" style="left:${b.left}px;width:${b.width}px" title="${esc(b.name)} (${b.stateLabel})"><b>${esc(b.name)}</b><span>${b.stateLabel}</span></div>`).join('')}
    </div>` : '';

  // Hitos del proyecto (tabla project_milestones): línea punteada y etiqueta en su fecha
  const milestoneMarks = (ganttMilestones || []).map(m => {
    const d = parseGanttDate(String(m.due_date || '').slice(0, 10));
    if (!d || d < min || d > max) return null;
    const off = Math.round((d - min) / dayMs);
    const label = m.status === 'completado' ? 'completado' : m.status === 'en_progreso' ? 'en progreso' : 'pendiente';
    return { left: off * dayWidth + Math.round(dayWidth / 2), m, label };
  }).filter(Boolean);
  const milestoneLinesHtml = milestoneMarks.map(({ left, m }) => `<div class="gv-hito-line ${esc(m.status || '')}" style="left:${left}px"></div>`).join('');
  // Fila "Hitos" en el encabezado: rombo en su fecha con "día mes · nombre" a un lado, repartidos en carriles para que no se encimen
  const hitoLaneLast = [];
  const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const hitoItems = [...milestoneMarks].sort((a, b) => a.left - b.left).map(mk => {
    const iso = String(mk.m.due_date || '').slice(0, 10);
    const fecha = `${Number(iso.slice(8, 10))} ${MES_CORTO[Number(iso.slice(5, 7)) - 1] || ''}`;
    const dias = Math.round((parseGanttDate(iso) - today) / dayMs);
    const cuando = mk.m.status === 'completado' ? 'completado' : dias < 0 ? `atrasado ${-dias} ${dias === -1 ? 'día' : 'días'}` : dias === 0 ? 'es hoy' : `faltan ${dias} ${dias === 1 ? 'día' : 'días'}`;
    return { ...mk, fecha, cuando, width: Math.min(230, 30 + (fecha.length + 3 + String(mk.m.title || '').length) * 6.3) };
  });
  hitoItems.forEach(it => {
    let lane = hitoLaneLast.findIndex(last => it.left - 8 > last.left + last.width);
    if (lane === -1 && hitoLaneLast.length < 3) lane = hitoLaneLast.length;
    if (lane === -1) {
      // No cabe completo en ningún carril: se recorta el nombre anterior del carril con más espacio
      lane = hitoLaneLast.reduce((best, last, i) => (it.left - last.left > it.left - hitoLaneLast[best].left ? i : best), 0);
      const prev = hitoLaneLast[lane];
      prev.width = Math.max(14, it.left - prev.left - 8);
    }
    it.lane = lane;
    hitoLaneLast[lane] = it;
  });
  const hitoLanes = Math.max(1, hitoLaneLast.length);
  const ganttHeadExtra = milestoneMarks.length ? hitoLanes * 20 + 8 : 0;
  const milestoneRowHtml = milestoneMarks.length ? `<div class="gv-hito-row" style="height:${ganttHeadExtra}px">${hitoItems.map(({ left, m, label, lane, width, fecha, cuando }) => {
    const tip = `Hito: ${m.title}\nFecha: ${fecha} (${cuando})\nEstado: ${label}${m.project_name ? `\nProyecto: ${m.project_name}` : ''}${m.description ? `\n${m.description}` : ''}`;
    return `<span class="gv-hito gv-hito-date ${esc(m.status || '')}" style="left:${left - 6}px;top:${4 + lane * 20}px;max-width:${width}px" title="${esc(tip)}"><i></i>${width > 30 ? `<em>${esc(fecha)}</em><b>${esc(m.title)}</b>` : ''}</span>`;
  }).join('')}</div>` : '';
  const ganttHeadStyle = ganttHeadExtra ? ` style="height:${67 + (sprintBands.length ? 26 : 0) + ganttHeadExtra}px"` : '';
  const ganttHeadHitoLabel = ganttHeadExtra ? `<span class="gv-hito-head-label" style="top:${sprintBands.length ? 26 : 0}px;height:${ganttHeadExtra}px"><i></i>Hitos del proyecto</span>` : '';
  const sprintShadeHtml = sprintBands.map((b, i) => `<div class="gv-sprint-shade ${b.status} ${i % 2 ? 'is-odd' : ''}" style="left:${b.left}px;width:${b.width}px"></div>`).join('');

  const todayLineHtml = todayOffset >= 0 && todayOffset < totalDays
    ? `<div class="gp-today-line gtc-today-line" style="left:${todayOffset * dayWidth}px" title="Hoy"></div>`
    : '';

  const ganttBodyHtml = rows.length ? `
    <div class="gp-body gtc-wrap">
      <div class="gp-left-panel gtc-labels" style="width:${ganttTableWidth}px">
        <div class="gp-table-head gtc-labels-head"${ganttHeadStyle}>${ganttHeadHitoLabel}
          <div class="gp-th-name">Tarea</div>
          <div class="gv-th-who">Resp.</div>
          <div class="gv-th-when">Fechas</div>
          <div class="gv-th-prog">Avance</div>
        </div>
        <div style="flex:1;overflow-y:auto">
          ${labelsHtml}
        </div>
      </div>
      <div class="gp-splitter" id="gp-splitter" title="Arrastra para hacer más ancha la tabla">
        <div class="gp-splitter-handle"></div>
      </div>
      <div class="gp-right-panel gtc-scroll" id="gtc-scroll">
        <div class="gtc-timeline" style="width:${totalDays * dayWidth}px">
          ${timelineHeadHtml(true)}
          <div class="gtc-rows-area" style="height:${rows.length * 42}px">
            ${sprintShadeHtml}${milestoneLinesHtml}
            ${todayLineHtml}
            ${svgLayerHtml}
            ${tracksHtml}
          </div>
        </div>
      </div>
    </div>
  ` : emptyState;

  const resourcesBodyHtml = `
    <div class="gp-body gtc-wrap">
      <div class="gp-left-panel" style="width:${ganttTableWidth}px">
        <div class="gp-resource-head gtc-labels-head"${ganttHeadStyle}>${ganttHeadHitoLabel}
          <div style="flex:1">Integrante</div>
          <div style="width:70px;text-align:right">Tareas</div>
        </div>
        <div style="flex:1;overflow-y:auto">
          ${resourceLeftHtml}
        </div>
      </div>
      <div class="gp-splitter" id="gp-splitter">
        <div class="gp-splitter-handle"></div>
      </div>
      <div class="gp-right-panel gtc-scroll" id="gtc-scroll">
        <div class="gtc-timeline" style="width:${totalDays * dayWidth}px">
          ${timelineHeadHtml(false)}
          <div class="gtc-rows-area" style="position:relative;height:${resourceRowsHeight}px">
            ${sprintShadeHtml}${milestoneLinesHtml}
            ${todayLineHtml}
            ${resourceTimelineHtml}
          </div>
        </div>
      </div>
    </div>
  `;

  return `
    <div class="gp-window gv-chart ${sprintBands.length ? 'has-sprints' : ''}">
      ${toolbarHtml}
      ${ganttActiveTab === 'resources' ? resourceSummaryHtml + resourcesBodyHtml : ganttBodyHtml}
      ${ganttActiveTab === 'resources' ? `
        <div class="gv-legend">
          <span><i class="gv-heat-key l1"></i>1 tarea</span>
          <span><i class="gv-heat-key l2"></i>2 tareas a la vez</span>
          <span><i class="gv-heat-key l3"></i>3 o más (sobrecarga)</span>
          <span class="gv-legend-count">La franja de abajo de cada persona muestra su carga por día</span>
        </div>` : legendHtml}
    </div>
    <div hidden>
      <input type="date" id="gtc-jump-date">
    </div>
  `;
}

// ===== Apoyo del Gantt: estados, fechas límite, avatares, resumen y globo =====
const GANTT_STATUS_LABELS = { pendiente: 'Pendiente', en_proceso: 'En proceso', en_revision: 'En revisión', bloqueada: 'Bloqueada', completada: 'Completada' };
const GANTT_AVATAR_COLORS = ['#0ea5e9', '#a855f7', '#f97316', '#14b8a6', '#ec4899', '#84cc16', '#6366f1', '#eab308'];

function ganttTaskProgress(t) {
  if (t.status === 'completada') return 100;
  const p = Number(t.progress);
  return Number.isFinite(p) ? Math.max(0, Math.min(100, Math.round(p))) : 0;
}

// Dice si la tarea va bien, está en riesgo, vence pronto o ya está atrasada,
// y arma una frase clara (verdict) para el globo de información.
// "En riesgo": según el tiempo que ya pasó debería llevar cierto avance y va 25 puntos o más abajo.
function ganttDeadlineInfo(t, today) {
  const dayMs = 86400000;
  const due = t.dueDate || parseGanttDate(t.due_date);
  const start = t.startDate || parseGanttDate(t.start_date) || due;
  const prog = ganttTaskProgress(t);
  const plural = n => `${n} ${n === 1 ? 'día' : 'días'}`;
  const base = { key: t.status || 'pendiente', label: GANTT_STATUS_LABELS[t.status] || 'Pendiente', note: '', soon: false, risk: false, expected: null, verdict: '', tone: 'calm' };

  if (!due) return { ...base, verdict: 'No tiene fechas. Asígnale inicio y fin para darle seguimiento.' };

  if (t.status === 'completada') {
    const doneAt = t.completed_at ? new Date(t.completed_at) : null;
    if (doneAt) doneAt.setHours(0, 0, 0, 0);
    const late = doneAt ? Math.round((doneAt - due) / dayMs) : 0;
    return { ...base, tone: 'ok', verdict: late > 0 ? `Terminada, ${plural(late)} después de su fecha de fin.` : 'Terminada a tiempo.' };
  }

  const diff = Math.round((due - today) / dayMs);
  if (diff < 0) {
    return { ...base, key: 'atrasada', label: 'Atrasada', expected: 100, tone: 'bad',
      note: `${plural(-diff)} tarde`,
      verdict: `Ya debería estar al 100% y lleva ${prog}%. Su fecha de fin fue hace ${plural(-diff)}.` };
  }

  if (start && today < start) {
    const toStart = Math.round((start - today) / dayMs);
    return { ...base, tone: 'calm', verdict: `Todavía no empieza: inicia en ${plural(toStart)}. Va tranquila.` };
  }

  const total = Math.round((due - start) / dayMs) + 1;
  const elapsed = Math.round((today - start) / dayMs) + 1;
  const expected = Math.round(Math.min(1, elapsed / Math.max(1, total)) * 100);
  const risk = expected - prog >= 25;
  const info = { ...base, expected, risk, note: risk ? 'en riesgo' : '' };
  if (risk) {
    info.tone = 'risk';
    info.verdict = `Debería llevar ${expected}% y lleva ${prog}%. Si no se acelera, se va a atrasar.`;
  } else if (prog >= expected) {
    info.tone = 'ok';
    info.verdict = `Va a tiempo: debería llevar ${expected}% y lleva ${prog}%.`;
  } else {
    info.tone = 'warn';
    info.verdict = `Va un poco atrás: debería llevar ${expected}% y lleva ${prog}%.`;
  }
  if (diff === 0) return { ...info, soon: true, note: risk ? 'en riesgo' : 'vence hoy' };
  if (diff <= 7) return { ...info, soon: true, note: risk ? 'en riesgo' : `vence en ${plural(diff)}` };
  return info;
}
function ganttMatchesQuickFilter(t, today) {
  const info = ganttDeadlineInfo(t, today);
  if (ganttQuickFilter === 'overdue') return info.key === 'atrasada';
  if (ganttQuickFilter === 'soon') return info.soon;
  if (ganttQuickFilter === 'progress') return t.status === 'en_proceso';
  if (ganttQuickFilter === 'risk') return info.risk;
  return true;
}

function ganttAvatarHtml(t, extraClass = '') {
  if (!t.assignee_name) return `<span class="gv-avatar is-empty ${extraClass}" title="Sin responsable">?</span>`;
  const parts = String(t.assignee_name).trim().split(/\s+/).filter(Boolean);
  const initials = ((parts[0] || '?')[0] + ((parts[1] || '')[0] || '')).toUpperCase();
  const color = GANTT_AVATAR_COLORS[Math.abs(Number(t.assigned_to) || 0) % GANTT_AVATAR_COLORS.length];
  return `<span class="gv-avatar ${extraClass}" style="--av:${color}" title="${esc(t.assignee_name)}">${esc(initials)}</span>`;
}

function ganttSummary(tasks, today) {
  const s = { total: tasks.length, overdue: 0, soon: 0, inProgress: 0, done: 0, avg: 0, risk: 0 };
  let sum = 0;
  tasks.forEach(t => {
    const info = ganttDeadlineInfo(t, today);
    if (info.key === 'atrasada') s.overdue++;
    if (info.soon) s.soon++;
    if (info.risk) s.risk++;
    if (t.status === 'en_proceso') s.inProgress++;
    if (t.status === 'completada') s.done++;
    sum += ganttTaskProgress(t);
  });
  s.avg = tasks.length ? Math.round(sum / tasks.length) : 0;
  return s;
}

function ganttSummaryHtml(s) {
  const card = (key, value, label, hint, tone) => `
    <button type="button" class="gv-stat ${tone} ${ganttQuickFilter === key ? 'active' : ''}" data-quick="${key}" aria-pressed="${ganttQuickFilter === key}" title="${hint}">
      <span class="gv-stat-value">${value}</span>
      <span class="gv-stat-label">${label}</span>
    </button>`;
  const filterNames = { overdue: 'tareas atrasadas', risk: 'tareas en riesgo', soon: 'tareas que vencen esta semana', progress: 'tareas en proceso' };
  return `
    <div class="gv-summary">
      ${card('overdue', s.overdue, s.overdue === 1 ? 'Tarea atrasada' : 'Tareas atrasadas', 'Ya pasó su fecha de fin y no están completadas.', 'is-warn')}
      ${card('risk', s.risk, 'En riesgo', 'Por el tiempo que ya pasó deberían llevar más avance. Si no se atienden, se van a atrasar.', 'is-risk')}
      ${card('soon', s.soon, 'Vencen esta semana', 'Terminan en los próximos 7 días.', 'is-soon')}
      <div class="gv-stat is-progress" title="Promedio de avance de todas las tareas">
        <span class="gv-stat-value">${s.avg}%</span>
        <span class="gv-stat-label">Avance general <small>${s.done} de ${s.total} completadas</small></span>
        <span class="gv-stat-bar"><i style="width:${s.avg}%"></i></span>
      </div>
    </div>
    ${ganttQuickFilter ? `
      <div class="gv-filter-note">
        Mostrando solo <strong>${filterNames[ganttQuickFilter] || ''}</strong>
        <button type="button" class="gv-link" data-quick="">Ver todas</button>
      </div>` : ''}
  `;
}

function ganttTipHtml(t, today) {
  const info = ganttDeadlineInfo(t, today);
  const prog = ganttTaskProgress(t);
  const days = t.is_milestone ? 0 : Math.max(1, Math.round((t.dueDate - t.startDate) / 86400000) + 1);
  const statusText = info.key === 'atrasada' ? `Atrasada · ${GANTT_STATUS_LABELS[t.status] || ''}` : info.label;
  return `
    <strong>${t.is_milestone ? 'Hito: ' : ''}${esc(t.title)}</strong>
    <div class="gv-tip-row"><i class="gv-status-dot ${info.key}"></i>${statusText}</div>
    <div class="gv-tip-row">${icon('calendar')} ${formatGanttDate(t.start_date, true)} → ${formatGanttDate(t.due_date, true)}${days ? ` · ${days} ${days === 1 ? 'día' : 'días'}` : ''}</div>
    <div class="gv-tip-row">${icon('users')} ${esc(t.assignee_name || 'Sin responsable')}</div>
    <div class="gv-tip-progress"><span><i style="width:${prog}%"></i></span>${prog}%</div>
    ${info.verdict ? `<div class="gv-tip-verdict ${info.tone}">${info.verdict}</div>` : ''}
    <div class="gv-tip-hint">Clic para editar · arrastra para mover</div>
  `;
}

// Muestra el botón ‹ o › en las filas cuya barra quedó fuera de la vista
function ganttUpdateEdgeChips(scrollEl) {
  const left = scrollEl.scrollLeft;
  const right = left + scrollEl.clientWidth;
  document.querySelectorAll('.gtc-row[data-row-id]').forEach(row => {
    const bar = row.querySelector('.gtc-bar, .gtc-milestone-diamond, .gtc-summary-bar');
    if (!bar) return;
    const start = bar.offsetLeft;
    const end = start + bar.offsetWidth;
    row.querySelector('.gv-edge.left')?.classList.toggle('is-visible', end < left + 12);
    row.querySelector('.gv-edge.right')?.classList.toggle('is-visible', start > right - 12);
    // Si la barra empieza antes de la vista, recorre su texto para que el nombre siga visible
    if (bar.classList.contains('gtc-bar')) {
      const hidden = left - start;
      bar.style.paddingLeft = hidden > 0 && end - left > 40 ? `${hidden + 6}px` : '';
    }
  });
  document.querySelectorAll('.gv-res-bar').forEach(bar => {
    const start = bar.offsetLeft, end = start + bar.offsetWidth, hidden = left - start;
    bar.style.paddingLeft = hidden > 0 && end - left > 40 ? `${hidden + 8}px` : '';
  });
}

// ===== Calendario: fechas de entrega + panel del día =====
const GANTT_MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const GANTT_WEEKDAYS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function ganttCalendarViewHtml(tasks, today) {
  ganttTaskIndex = new Map(tasks.map(t => [t.id, t]));
  const todayIso = toISODate(today);
  const selected = ganttCalendarSelected || todayIso;
  const month = ganttCalendarMonth;
  const monthLabel = `${GANTT_MONTHS_LONG[month.getMonth()].replace(/^./, c => c.toUpperCase())} ${month.getFullYear()}`;
  const isDeadlines = ganttCalendarMode === 'deadlines';

  // Tareas agrupadas por el día en que vencen
  const byDue = new Map();
  tasks.forEach(t => {
    if (!t.dueDate) return;
    const key = toISODate(t.dueDate);
    if (!byDue.has(key)) byDue.set(key, []);
    byDue.get(key).push(t);
  });
  const rank = t => { const k = ganttDeadlineInfo(t, today).key; return k === 'atrasada' ? 0 : (t.status === 'completada' ? 2 : 1); };
  byDue.forEach(list => list.sort((a, b) => rank(a) - rank(b)));

  const head = `
    <div class="gvc-head">
      <div class="gv-group">
        <button type="button" class="gv-btn gvc-nav" data-cal-nav="-1" aria-label="Mes anterior" title="Mes anterior">‹</button>
        <h3 class="gvc-month">${monthLabel}</h3>
        <button type="button" class="gv-btn gvc-nav" data-cal-nav="1" aria-label="Mes siguiente" title="Mes siguiente">›</button>
        <button type="button" class="gv-btn" data-cal-nav="0" title="Ir al día de hoy">Hoy</button>
      </div>
      <div class="gv-segmented" role="group" aria-label="Qué mostrar en el calendario">
        <button type="button" data-cal-mode="deadlines" class="${isDeadlines ? 'active' : ''}" aria-pressed="${isDeadlines}" title="Cada tarea aparece solo el día en que vence">Fechas de entrega</button>
        <button type="button" data-cal-mode="duration" class="${!isDeadlines ? 'active' : ''}" aria-pressed="${!isDeadlines}" title="Cada tarea ocupa todos los días que dura">Duración completa</button>
      </div>
    </div>
  `;

  let body;
  if (isDeadlines) {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7; // la semana empieza en lunes
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;
    const cells = [];
    for (let i = 0; i < totalCells; i++) {
      const date = new Date(month.getFullYear(), month.getMonth(), 1 - offset + i);
      const key = toISODate(date);
      const list = byDue.get(key) || [];
      const isToday = key === todayIso;
      const outside = date.getMonth() !== month.getMonth();
      const weekend = date.getDay() === 0 || date.getDay() === 6;
      const fullDate = `${GANTT_WEEKDAYS_LONG[date.getDay()]} ${date.getDate()} de ${GANTT_MONTHS_LONG[date.getMonth()]}`;
      const chips = list.slice(0, 3).map(t => {
        const info = ganttDeadlineInfo(t, today);
        return `
          <div class="gvc-chip ${info.key} ${t.status === 'completada' ? 'is-done' : ''}" draggable="true"
               data-id="${t.id}" data-start="${t.start_date || ''}" data-due="${t.due_date || ''}">
            <i class="gv-status-dot ${info.key}"></i>
            <span class="gvc-chip-title">${t.is_milestone ? icon('flag') : ''}${t.status === 'completada' ? '✓ ' : ''}${esc(t.title)}</span>
          </div>`;
      }).join('');
      const more = list.length > 3 ? `<button type="button" class="gvc-more" data-cal-day="${key}">+${list.length - 3} más</button>` : '';
      cells.push(`
        <div class="gvc-day ${outside ? 'is-out' : ''} ${isToday ? 'is-today' : ''} ${key === selected ? 'is-selected' : ''} ${weekend ? 'is-weekend' : ''}"
             data-cal-day="${key}" tabindex="0" role="button"
             aria-label="${fullDate}${list.length ? `, ${list.length} ${list.length === 1 ? 'entrega' : 'entregas'}` : ''}">
          <div class="gvc-day-top">
            <span class="gvc-num">${date.getDate()}</span>
            ${isToday ? '<span class="gvc-today">Hoy</span>' : ''}
          </div>
          <div class="gvc-chips">${chips}${more}</div>
        </div>`);
    }
    body = `
      <div class="gvc-weekdays">${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => `<span>${d}</span>`).join('')}</div>
      <div class="gvc-grid">${cells.join('')}</div>`;
  } else {
    body = `<div class="gvc-duration">${renderGanttCalendarHtml(tasks, month, today)}</div>`;
  }

  return `
    <div class="gp-window gv-chart gvc">
      ${head}
      <div class="gvc-layout">
        <div class="gvc-main">${body}</div>
        ${ganttCalendarPanelHtml(tasks, byDue, selected, today)}
      </div>
    </div>
  `;
}

// Panel derecho: qué vence y qué se está trabajando el día elegido
function ganttCalendarPanelHtml(tasks, byDue, selected, today) {
  const day = parseGanttDate(selected) || today;
  const due = byDue.get(selected) || [];
  const ongoing = tasks.filter(t => t.status !== 'completada' && t.startDate <= day && t.dueDate > day);
  const isToday = toISODate(today) === selected;
  const item = t => {
    const info = ganttDeadlineInfo(t, today);
    return `
      <button type="button" class="gvc-item ${info.key}" data-edit-id="${t.id}" title="Clic para editar">
        <i class="gv-status-dot ${info.key}"></i>
        <span class="gvc-item-text">
          <b>${t.is_milestone ? icon('flag') : ''}${esc(t.title)}</b>
          <small>${info.key === 'atrasada' ? info.note : (info.note || info.label)} · ${ganttTaskProgress(t)}%</small>
        </span>
        ${ganttAvatarHtml(t)}
      </button>`;
  };
  return `
    <aside class="gvc-panel" aria-label="Detalle del día">
      <div class="gvc-panel-date">
        <span>${GANTT_WEEKDAYS_LONG[day.getDay()]}${isToday ? ' · <b class="gvc-today">Hoy</b>' : ''}</span>
        <strong>${day.getDate()} de ${GANTT_MONTHS_LONG[day.getMonth()]}</strong>
      </div>
      <h4>Vencen este día <span>${due.length}</span></h4>
      ${due.length ? due.map(item).join('') : '<p class="gvc-empty">Nada vence este día.</p>'}
      <h4>Se trabajan este día <span>${ongoing.length}</span></h4>
      ${ongoing.length ? ongoing.map(item).join('') : '<p class="gvc-empty">No hay tareas en curso este día.</p>'}
      <div class="gvc-panel-actions">
        <button type="button" class="btn" data-cal-new="${selected}">${icon('plus')} Tarea que venza este día</button>
        <button type="button" class="gv-btn" data-cal-goto="${selected}">Ver este día en el cronograma</button>
      </div>
    </aside>
  `;
}

async function ganttMoveTaskDates(id, start_date, due_date) {
  try {
    const task = await api(`/tasks/${id}`);
    await api(`/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: task.title,
        description: task.description || '',
        assigned_to: task.assigned_to || '',
        priority: task.priority,
        status: task.status,
        start_date,
        due_date
      })
    });
    notify('Fechas actualizadas');
  } catch (error) { notify(error.message); }
  renderGantt();
}

function bindGanttCalendarView() {
  if (!document.querySelector('.gvc')) return;

  document.querySelectorAll('[data-cal-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      const step = Number(btn.dataset.calNav);
      if (step === 0) {
        ganttCalendarMonth = new Date(); ganttCalendarMonth.setDate(1); ganttCalendarMonth.setHours(0, 0, 0, 0);
        ganttCalendarSelected = toISODate(new Date());
      } else {
        ganttCalendarMonth = new Date(ganttCalendarMonth.getFullYear(), ganttCalendarMonth.getMonth() + step, 1);
      }
      renderGantt();
    });
  });

  document.querySelectorAll('[data-cal-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      ganttCalendarMode = btn.dataset.calMode;
      renderGantt();
    });
  });

  // Tocar un día (o "+N más") lo muestra en el panel
  document.querySelectorAll('.gvc-day, .gvc-more').forEach(el => {
    const select = e => {
      if (e.target.closest('.gvc-chip') && el.classList.contains('gvc-day')) return;
      e.stopPropagation();
      ganttCalendarSelected = el.dataset.calDay;
      renderGantt();
    };
    el.addEventListener('click', select);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(e); } });
  });

  // Tareas: clic para editar, arrastrar para cambiar el día de entrega
  document.querySelectorAll('.gvc-chip').forEach(chip => {
    chip.addEventListener('click', e => { e.stopPropagation(); openGanttQuickEdit(chip.dataset.id); });
    chip.addEventListener('dragstart', e => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', chip.dataset.id);
      chip.classList.add('is-dragging');
      document.querySelector('#gv-tip')?.setAttribute('hidden', '');
    });
    chip.addEventListener('dragend', () => chip.classList.remove('is-dragging'));
  });
  document.querySelectorAll('.gvc-day').forEach(day => {
    day.addEventListener('dragover', e => { e.preventDefault(); day.classList.add('drop-target'); });
    day.addEventListener('dragleave', () => day.classList.remove('drop-target'));
    day.addEventListener('drop', e => {
      e.preventDefault();
      day.classList.remove('drop-target');
      const id = e.dataTransfer.getData('text/plain');
      const chip = document.querySelector(`.gvc-chip[data-id="${id}"]`);
      if (!chip || !chip.dataset.due) return;
      const delta = Math.round((parseGanttDate(day.dataset.calDay) - parseGanttDate(chip.dataset.due)) / 86400000);
      if (!delta) return;
      const newStart = chip.dataset.start ? addDays(chip.dataset.start, delta) : day.dataset.calDay;
      ganttCalendarSelected = day.dataset.calDay;
      ganttMoveTaskDates(id, newStart, day.dataset.calDay);
    });
  });

  // Panel del día
  document.querySelectorAll('[data-edit-id]').forEach(btn => btn.addEventListener('click', () => openGanttQuickEdit(btn.dataset.editId)));
  document.querySelector('[data-cal-new]')?.addEventListener('click', e => {
    const date = e.currentTarget.dataset.calNew;
    openGanttCreateModal(false);
    const form = document.querySelector('#gantt-quick-create-form');
    if (form?.elements.due_date) form.elements.due_date.value = date;
    if (form?.elements.start_date && form.elements.start_date.value > date) form.elements.start_date.value = date;
  });
  document.querySelector('[data-cal-goto]')?.addEventListener('click', e => {
    ganttPendingScrollDate = e.currentTarget.dataset.calGoto;
    ganttRenderedDayWidth = null;
    switchGanttTab('gantt');
  });
}

// Ancho en pixeles de un día según la escala y el zoom actuales
function ganttCurrentDayWidth() {
  if (ganttTimeScale === 'week') return Math.max(14, Math.round(ganttChartZoom * 0.55));
  if (ganttTimeScale === 'month') return Math.max(8, Math.round(ganttChartZoom * 0.3));
  return ganttChartZoom;
}

async function renderGantt() {
  // Antes de redibujar, recordar qué fecha se estaba viendo para no "brincar" al inicio
  const dayMs = 86400000;
  const prevScroll = document.querySelector('#gtc-scroll');
  ganttViewLeftDate = prevScroll && ganttChartMinDate && ganttRenderedDayWidth
    ? new Date(ganttChartMinDate.getTime() + Math.round(prevScroll.scrollLeft / ganttRenderedDayWidth) * dayMs)
    : null;

  layout(await gantt());
  bindGanttEvents();
  bindGanttChartEvents();
  bindGanttViewEvents();

  // Al entrar (o al cambiar de pestaña) el diagrama abre en HOY; si ya se estaba viendo, se queda donde estaba
  const scrollEl = document.querySelector('#gtc-scroll');
  ganttRenderedDayWidth = ganttCurrentDayWidth();
  if (!scrollEl || !ganttChartMinDate) return;
  const target = ganttPendingScrollDate ? parseGanttDate(ganttPendingScrollDate) : null;
  ganttPendingScrollDate = null;
  if (target) {
    scrollEl.scrollLeft = Math.max(0, Math.round((target - ganttChartMinDate) / dayMs) * ganttRenderedDayWidth - scrollEl.clientWidth * 0.25);
  } else if (ganttViewLeftDate) {
    scrollEl.scrollLeft = Math.max(0, Math.round((ganttViewLeftDate - ganttChartMinDate) / dayMs) * ganttRenderedDayWidth);
  } else {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    scrollEl.scrollLeft = Math.max(0, Math.round((today - ganttChartMinDate) / dayMs) * ganttRenderedDayWidth - scrollEl.clientWidth * 0.25);
  }
  ganttUpdateEdgeChips(scrollEl);
}

// Pestañas (Cronograma / Calendario / Recursos) y menú "Más"
function bindGanttViewEvents() {
  document.querySelectorAll('[data-gv-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (ganttActiveTab === btn.dataset.gvTab) return;
      ganttViewLeftDate = null;
      ganttRenderedDayWidth = null; // al cambiar de vista se vuelve a abrir en hoy
      switchGanttTab(btn.dataset.gvTab);
    });
  });
  document.querySelectorAll('.gv-menu button, .gv-menu a').forEach(item => {
    item.addEventListener('click', () => item.closest('details')?.removeAttribute('open'));
  });
  bindGanttCalendarView();

  document.querySelectorAll('.gv-res-bar').forEach(bar => bar.addEventListener('click', () => openGanttQuickEdit(bar.dataset.id)));

  // Tarjetas de resumen = filtro rápido
  document.querySelectorAll('[data-quick]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.quick;
      ganttQuickFilter = ganttQuickFilter === key ? '' : key;
      renderGantt();
    });
  });

  // Botones ‹ › para ir a una tarea que quedó fuera de la vista
  const scrollEl = document.querySelector('#gtc-scroll');
  if (scrollEl) {
    let frame = 0;
    scrollEl.addEventListener('scroll', () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => ganttUpdateEdgeChips(scrollEl));
    });
  }
  document.querySelectorAll('.gv-edge').forEach(chip => {
    chip.addEventListener('click', e => {
      e.stopPropagation();
      if (chip.dataset.goto) scrollToGanttDate(chip.dataset.goto);
    });
  });

  // Globo con la información de la tarea al pasar el mouse
  let tip = document.querySelector('#gv-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'gv-tip';
    tip.className = 'gv-tip';
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);
  }
  tip.hidden = true;
  const tipToday = new Date(); tipToday.setHours(0, 0, 0, 0);
  document.querySelectorAll('.gtc-bar, .gtc-milestone-diamond, .gtc-summary-bar, .gvc-chip, .gv-res-bar').forEach(el => {
    el.removeAttribute('title');
    el.addEventListener('pointerenter', () => {
      const task = ganttTaskIndex.get(Number(el.dataset.id));
      if (!task || el.classList.contains('is-dragging')) return;
      tip.innerHTML = ganttTipHtml(task, tipToday);
      tip.hidden = false;
    });
    el.addEventListener('pointermove', e => {
      if (tip.hidden) return;
      const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
      const below = e.clientY + 18 + tip.offsetHeight < window.innerHeight;
      tip.style.left = `${Math.max(8, x)}px`;
      tip.style.top = `${below ? e.clientY + 18 : e.clientY - tip.offsetHeight - 12}px`;
    });
    el.addEventListener('pointerleave', () => { tip.hidden = true; });
    el.addEventListener('pointerdown', () => { tip.hidden = true; });
  });

  if (!ganttMenuCloserReady) {
    ganttMenuCloserReady = true;
    document.addEventListener('click', e => {
      document.querySelectorAll('details.gv-more[open]').forEach(menu => {
        if (!menu.contains(e.target)) menu.removeAttribute('open');
      });
    });
  }
}

function bindGanttChartEvents() {
  const dayWidth = ganttTimeScale === 'week'
    ? Math.max(14, Math.round(ganttChartZoom * 0.55))
    : (ganttTimeScale === 'month' ? Math.max(8, Math.round(ganttChartZoom * 0.3)) : ganttChartZoom);
  const dayMs = 86400000;

  // Zoom
  document.querySelector('#gtc-zoom-in')?.addEventListener('click', () => {
    ganttChartZoom = Math.min(64, ganttChartZoom + 8);
    renderGantt();
  });
  document.querySelector('#gtc-zoom-out')?.addEventListener('click', () => {
    ganttChartZoom = Math.max(12, ganttChartZoom - 8);
    renderGantt();
  });

  // Escalas de tiempo GanttProject
  document.querySelector('#gtc-scale-day')?.addEventListener('click', () => {
    ganttTimeScale = 'day';
    renderGantt();
  });
  document.querySelector('#gtc-scale-week')?.addEventListener('click', () => {
    ganttTimeScale = 'week';
    renderGantt();
  });
  document.querySelector('#gtc-scale-month')?.addEventListener('click', () => {
    ganttTimeScale = 'month';
    renderGantt();
  });

  // Toggle Ruta Crítica
  document.querySelector('#gtc-toggle-critical')?.addEventListener('click', () => {
    ganttShowCriticalPath = !ganttShowCriticalPath;
    renderGantt();
  });

  // Toggle Línea Base
  document.querySelector('#gtc-toggle-baseline')?.addEventListener('click', () => {
    ganttShowBaselines = !ganttShowBaselines;
    renderGantt();
  });

  // Fijar Línea Base
  document.querySelector('#gtc-save-baseline')?.addEventListener('click', async () => {
    if (!confirm('¿Deseas capturar las fechas actuales como la nueva Línea Base planificada del proyecto?')) return;
    try {
      const res = await api('/gantt/baseline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: ganttProjectId ? Number(ganttProjectId) : null })
      });
      notify(res.message || 'Línea Base fijada');
      ganttShowBaselines = true;
      renderGantt();
    } catch (e) { notify(e.message) }
  });

  // Auto-Alinear (Forward Scheduling)
  document.querySelector('#gtc-auto-schedule')?.addEventListener('click', async () => {
    if (!ganttProjectId) {
      notify('Selecciona un proyecto específico en el filtro para auto-alinear sus dependencias.');
      return;
    }
    try {
      const res = await api('/gantt/auto-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: Number(ganttProjectId) })
      });
      notify(res.message || 'Cronograma alineado');
      renderGantt();
    } catch (e) { notify(e.message) }
  });

  // Crear Tarea / Hito
  document.querySelector('#gtc-new-task')?.addEventListener('click', () => openGanttCreateModal(false));
  document.querySelector('#gtc-new-milestone')?.addEventListener('click', () => openGanttCreateModal(true));

  // Importar GanttProject
  document.querySelector('#gtc-import-btn')?.addEventListener('click', () => openGanttImportModal());

  // Expandir / Colapsar WBS
  document.querySelectorAll('.gtc-tree-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = Number(btn.dataset.collapseId);
      if (ganttCollapsedTasks.has(id)) {
        ganttCollapsedTasks.delete(id);
      } else {
        ganttCollapsedTasks.add(id);
      }
      renderGantt();
    });
  });

  // Hitos clic
  document.querySelectorAll('.gtc-milestone-diamond, .gtc-summary-bar').forEach(el => {
    el.addEventListener('click', () => openGanttQuickEdit(el.dataset.id));
  });

  const ganttScroll = document.querySelector('.gtc-scroll');
  if (ganttScroll) {
    let pan = null;
    ganttScroll.addEventListener('pointerdown', event => {
      if (event.target.closest('.gtc-bar, .gtc-bar-handle, button, input, select, textarea, a')) return;
      if (event.button !== undefined && event.button !== 0) return;
      pan = { startX: event.clientX, startScrollLeft: ganttScroll.scrollLeft };
      ganttScroll.classList.add('is-panning');
      ganttScroll.setPointerCapture?.(event.pointerId);
    });

    ganttScroll.addEventListener('pointermove', event => {
      if (!pan) return;
      const delta = event.clientX - pan.startX;
      ganttScroll.scrollLeft = pan.startScrollLeft - delta;
    });

    const stopPan = () => {
      if (!pan) return;
      pan = null;
      ganttScroll.classList.remove('is-panning');
    };

    ganttScroll.addEventListener('pointerup', stopPan);
    ganttScroll.addEventListener('pointerleave', stopPan);
    ganttScroll.addEventListener('pointercancel', stopPan);
  }

  // Arrastre y Redimensionamiento de Barras
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
      if (!moved) { openGanttQuickEdit(bar.dataset.id); return; }

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
        await api(`/tasks/${bar.dataset.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: task.title,
            description: task.description || '',
            assigned_to: task.assigned_to || '',
            priority: task.priority,
            status: task.status,
            start_date,
            due_date
          })
        });
        notify('Fechas actualizadas');
      } catch (error) { notify(error.message); }
      renderGantt();
    };

    bar.addEventListener('pointerdown', event => {
      if (event.target.closest('.gtc-bar-handle')) return;
      startDrag(event, 'move');
    });

    bar.querySelector('.gtc-bar-handle.left')?.addEventListener('pointerdown', event => {
      event.stopPropagation();
      startDrag(event, 'resize-start');
    });

    bar.querySelector('.gtc-bar-handle.right')?.addEventListener('pointerdown', event => {
      event.stopPropagation();
      startDrag(event, 'resize-due');
    });
  });

  // Saltar a fecha en Gantt
  document.querySelector('#gtc-jump-date')?.addEventListener('change', e => {
    if (e.target.value) {
      scrollToGanttDate(e.target.value);
    }
  });

  // Pestañas de Navegación de Escritorio
  document.querySelector('#gp-tab-gantt')?.addEventListener('click', () => switchGanttTab('gantt'));
  document.querySelector('#gp-tab-resources')?.addEventListener('click', () => switchGanttTab('resources'));

  // Barra de Iconos de Escritorio
  document.querySelector('#gp-tool-open')?.addEventListener('click', () => openGanttImportModal());
  document.querySelector('#gp-tool-save')?.addEventListener('click', () => {
    const ganExport = document.querySelector('#gtc-export-gan');
    if (ganExport) ganExport.click();
  });
  document.querySelector('#gp-tool-baseline')?.addEventListener('click', () => {
    document.querySelector('#gtc-save-baseline')?.click();
  });
  document.querySelector('#gp-tool-resources')?.addEventListener('click', () => {
    switchGanttTab(ganttActiveTab === 'resources' ? 'gantt' : 'resources');
  });
  document.querySelector('#gp-tool-delete')?.addEventListener('click', () => deleteSelectedGanttTask());
  document.querySelector('#gp-tool-props')?.addEventListener('click', () => editSelectedGanttTask());
  document.querySelector('#gp-tool-cut')?.addEventListener('click', () => cutSelectedGanttTask());
  document.querySelector('#gp-tool-copy')?.addEventListener('click', () => copySelectedGanttTask());
  document.querySelector('#gp-tool-paste')?.addEventListener('click', () => pasteSelectedGanttTask());
  document.querySelector('#gp-tool-undo')?.addEventListener('click', () => notify('Deshacer última acción (Undo ↩️)'));
  document.querySelector('#gp-tool-redo')?.addEventListener('click', () => notify('Rehacer acción (Redo ↪️)'));

  // Búsqueda en vivo (Ctrl + F)
  const searchInput = document.querySelector('#gp-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      const q = e.target.value.toLowerCase().trim();
      ganttSearchFilter = q;
      const rowsTable = document.querySelectorAll('.gp-row-table');
      const rowsTrack = document.querySelectorAll('.gp-row-track');
      rowsTable.forEach((r, idx) => {
        const text = r.innerText.toLowerCase();
        const match = !q || text.includes(q);
        r.style.display = match ? '' : 'none';
        if (rowsTrack[idx]) {
          rowsTrack[idx].style.display = match ? '' : 'none';
        }
      });
    });
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        ganttSearchFilter = '';
        renderGantt();
      }
    });
  }

  // Sub-barra de Herramientas (WBS & Navegación)
  document.querySelector('#gp-btn-outdent')?.addEventListener('click', () => outdentSelectedGanttTask());
  document.querySelector('#gp-btn-indent')?.addEventListener('click', () => indentSelectedGanttTask());
  document.querySelector('#gp-btn-moveup')?.addEventListener('click', () => moveSelectedGanttTask(-1));
  document.querySelector('#gp-btn-movedown')?.addEventListener('click', () => moveSelectedGanttTask(1));
  document.querySelector('#gp-btn-link')?.addEventListener('click', () => linkSelectedGanttTask());
  document.querySelector('#gp-btn-unlink')?.addEventListener('click', () => unlinkSelectedGanttTask());

  document.querySelector('#gp-btn-step-prev')?.addEventListener('click', () => {
    const scrollEl = document.querySelector('#gtc-scroll');
    if (scrollEl) scrollEl.scrollBy({ left: -7 * dayWidth, behavior: 'smooth' });
  });
  document.querySelector('#gp-btn-step-next')?.addEventListener('click', () => {
    const scrollEl = document.querySelector('#gtc-scroll');
    if (scrollEl) scrollEl.scrollBy({ left: 7 * dayWidth, behavior: 'smooth' });
  });
  document.querySelector('#gp-select-nav')?.addEventListener('change', e => {
    if (e.target.value === 'today') {
      scrollToGanttDate(new Date());
    } else if (e.target.value === 'project-start') {
      if (ganttChartMinDate) scrollToGanttDate(ganttChartMinDate);
    }
  });

  // Navegador de Meses en la Barra de Tareas
  document.querySelector('#gp-nav-prev-month')?.addEventListener('click', () => {
    const scrollEl = document.querySelector('#gtc-scroll');
    if (scrollEl) scrollEl.scrollBy({ left: -30 * dayWidth, behavior: 'smooth' });
  });
  document.querySelector('#gp-nav-next-month')?.addEventListener('click', () => {
    const scrollEl = document.querySelector('#gtc-scroll');
    if (scrollEl) scrollEl.scrollBy({ left: 30 * dayWidth, behavior: 'smooth' });
  });
  document.querySelector('#gp-month-quick-select')?.addEventListener('change', e => {
    if (e.target.value) scrollToGanttDate(e.target.value);
  });
  document.querySelectorAll('.gp-month-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.date) scrollToGanttDate(btn.dataset.date);
    });
  });

  // Divisor Splitter interactivo
  const splitter = document.querySelector('#gp-splitter');
  if (splitter) {
    let isSplitting = false;
    let startX = 0;
    let startWidth = 0;

    const onSplitterMove = e => {
      if (!isSplitting) return;
      const dx = e.clientX - startX;
      const newWidth = Math.max(220, Math.min(800, startWidth + dx));
      ganttTableWidth = newWidth;
      document.querySelectorAll('.gp-left-panel, .gtc-labels').forEach(el => {
        el.style.width = `${newWidth}px`;
      });
      const subLeft = document.querySelector('.gp-subtoolbar-left');
      if (subLeft) subLeft.style.width = `${newWidth}px`;
    };

    const onSplitterUp = () => {
      if (!isSplitting) return;
      isSplitting = false;
      document.body.classList.remove('is-resizing-splitter');
      window.removeEventListener('pointermove', onSplitterMove);
      window.removeEventListener('pointerup', onSplitterUp);
    };

    splitter.addEventListener('pointerdown', e => {
      e.preventDefault();
      isSplitting = true;
      startX = e.clientX;
      startWidth = ganttTableWidth;
      document.body.classList.add('is-resizing-splitter');
      window.addEventListener('pointermove', onSplitterMove);
      window.addEventListener('pointerup', onSplitterUp);
    });
  }
}

function bindGanttEvents() {
  // Filtros
  document.querySelector('#gantt-project-filter')?.addEventListener('change', e => {
    ganttProjectId = e.target.value;
    renderGantt();
  });
  document.querySelector('#gantt-status-filter')?.addEventListener('change', e => {
    ganttStatusFilter = e.target.value;
    renderGantt();
  });
  document.querySelector('#gantt-assignee-filter')?.addEventListener('change', e => {
    ganttAssigneeFilter = e.target.value;
    renderGantt();
  });

  // Navegación del Calendario Superior
  document.querySelector('#gantt-prev-month')?.addEventListener('click', () => {
    ganttCalendarMonth.setMonth(ganttCalendarMonth.getMonth() - 1);
    renderGantt();
  });
  document.querySelector('#gantt-next-month')?.addEventListener('click', () => {
    ganttCalendarMonth.setMonth(ganttCalendarMonth.getMonth() + 1);
    renderGantt();
  });
  document.querySelector('#gantt-today-cal-btn')?.addEventListener('click', () => {
    ganttCalendarMonth = new Date();
    ganttCalendarMonth.setDate(1);
    ganttCalendarMonth.setHours(0, 0, 0, 0);
    renderGantt();
    scrollToGanttDate(new Date());
  });
  document.querySelector('#gantt-date-picker')?.addEventListener('change', e => {
    if (!e.target.value) return;
    const parts = e.target.value.split('-');
    if (parts.length >= 2) {
      ganttCalendarMonth = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
      renderGantt();
    }
  });
  document.querySelector('#gantt-cal-toggle')?.addEventListener('click', () => {
    ganttCalendarCollapsed = !ganttCalendarCollapsed;
    renderGantt();
  });

  // Clic y Drag & Drop en el Calendario Superior
  document.querySelectorAll('.gantt-cal-bar').forEach(bar => {
    bar.addEventListener('click', () => {
      if (bar.dataset.dragging === '1') return;
      openGanttQuickEdit(bar.dataset.id);
    });
    bar.addEventListener('dragstart', event => {
      bar.dataset.dragging = '1';
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('id', bar.dataset.id);
      event.dataTransfer.setData('start', bar.dataset.start);
      event.dataTransfer.setData('due', bar.dataset.due);
    });
    bar.addEventListener('dragend', () => {
      setTimeout(() => { bar.dataset.dragging = '0'; }, 0);
    });
  });

  document.querySelectorAll('.gantt-cal-day').forEach(day => {
    day.addEventListener('click', e => {
      if (e.target.closest('.gantt-cal-bar')) return;
      const targetDate = day.dataset.date;
      if (!targetDate) return;
      if (ganttActiveTab === 'calendar') {
        ganttCalendarSelected = targetDate;
        renderGantt();
        return;
      }
      // Abre el cronograma justo en el día que se tocó
      ganttPendingScrollDate = targetDate;
      ganttRenderedDayWidth = null;
      switchGanttTab('gantt');
    });
    day.addEventListener('dragover', event => {
      event.preventDefault();
      day.classList.add('drop-target');
    });
    day.addEventListener('dragleave', () => day.classList.remove('drop-target'));
    day.addEventListener('drop', async event => {
      event.preventDefault();
      day.classList.remove('drop-target');
      const id = event.dataTransfer.getData('id');
      const originalStart = event.dataTransfer.getData('start');
      const originalDue = event.dataTransfer.getData('due');
      if (!id || !originalStart) return;
      const targetDate = day.dataset.date;
      const deltaDays = Math.round((new Date(`${targetDate}T00:00:00`) - new Date(`${originalStart}T00:00:00`)) / 86400000);
      if (!deltaDays) return;
      const newStart = addDays(originalStart, deltaDays);
      const newDue = originalDue ? addDays(originalDue, deltaDays) : newStart;
      try {
        const task = await api(`/tasks/${id}`);
        await api(`/tasks/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: task.title,
            description: task.description || '',
            assigned_to: task.assigned_to || '',
            priority: task.priority,
            status: task.status,
            start_date: newStart,
            due_date: newDue
          })
        });
        notify('Fechas actualizadas');
      } catch (error) { notify(error.message); }
      renderGantt();
    });
  });

  document.querySelectorAll('.gantt-cal-more').forEach(more => {
    more.addEventListener('click', () => notify('Hay más tareas esta semana de las que caben visualmente. Filtra por integrante o estado.'));
  });

  // Botón Hoy de Gantt Timeline
  document.querySelector('#gtc-today-btn')?.addEventListener('click', () => {
    scrollToGanttDate(new Date());
  });
}

// Modal de Creación rápida de Tarea o Hito
function openGanttCreateModal(isMilestone = false) {
  document.querySelectorAll('.gantt-modal-overlay').forEach(n => n.remove());
  const overlay = document.createElement('div');
  overlay.className = 'file-viewer gantt-modal-overlay';

  const projects = ganttDataCache?.projects || [];
  const projectOptions = projects.map(p =>
    `<option value="${p.id}" ${ganttProjectId === String(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`
  ).join('');

  const todayStr = new Date().toISOString().slice(0, 10);

  overlay.innerHTML = `
    <div class="file-viewer-panel" style="max-width:540px;height:auto;padding:var(--sp-4)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-3)">
        <h2 style="margin:0">${isMilestone ? `${icon('clock')} Nuevo Hito de Proyecto` : `${icon('plus')} Nueva Tarea en Cronograma`}</h2>
        <button type="button" class="btn secondary" id="gantt-modal-close" style="width:32px;height:32px;padding:0">${icon('close')}</button>
      </div>
      <form id="gantt-quick-create-form" style="display:grid;gap:var(--sp-3)">
        <label>Proyecto
          <select class="select" name="project_id" required>
            ${projectOptions || '<option value="1">Proyecto Predeterminado</option>'}
          </select>
        </label>
        <label>Título
          <input class="input" name="title" placeholder="${isMilestone ? 'Ej: Entrega Fase 1 / Demo con Cliente' : 'Ej: Diseño de Arquitectura'}" required>
        </label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3)">
          <label>Fecha Inicio
            <input class="input" type="date" name="start_date" value="${todayStr}">
          </label>
          <label>Fecha Fin
            <input class="input" type="date" name="due_date" value="${todayStr}">
          </label>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3)">
          <label>Prioridad
            <select class="select" name="priority">
              <option value="baja">Baja</option>
              <option value="media" selected>Media</option>
              <option value="alta">Alta</option>
              <option value="critica">Crítica</option>
            </select>
          </label>
          <label>Estado
            <select class="select" name="status">
              <option value="pendiente" selected>Pendiente</option>
              <option value="en_proceso">En proceso</option>
              <option value="completada">Completada</option>
            </select>
          </label>
        </div>
        <input type="hidden" name="is_milestone" value="${isMilestone ? 'true' : 'false'}">
        <div class="actions" style="margin-top:var(--sp-2)">
          <button type="submit" class="btn">${isMilestone ? 'Crear Hito' : 'Crear Tarea'}</button>
          <button type="button" class="btn secondary" id="gantt-modal-cancel">Cancelar</button>
        </div>
      </form>
    </div>
  `;
  document.body.append(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('#gantt-modal-close').onclick = close;
  overlay.querySelector('#gantt-modal-cancel').onclick = close;

  overlay.querySelector('#gantt-quick-create-form').onsubmit = async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    try {
      await api('/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: Number(data.project_id),
          title: data.title,
          start_date: data.start_date || null,
          due_date: data.due_date || null,
          priority: data.priority,
          status: data.status,
          is_milestone: isMilestone,
          progress: data.status === 'completada' ? 100 : (data.status === 'en_proceso' ? 50 : 0)
        })
      });
      notify(isMilestone ? 'Hito creado' : 'Tarea creada');
      close();
      renderGantt();
    } catch (err) { notify(err.message); }
  };
}

// Modal de Importación de GanttProject
function openGanttImportModal() {
  document.querySelectorAll('.gantt-modal-overlay').forEach(n => n.remove());
  const overlay = document.createElement('div');
  overlay.className = 'file-viewer gantt-modal-overlay';

  const projects = ganttDataCache?.projects || [];
  const projectOptions = projects.map(p =>
    `<option value="${p.id}" ${ganttProjectId === String(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`
  ).join('');

  overlay.innerHTML = `
    <div class="file-viewer-panel" style="max-width:540px;height:auto;padding:var(--sp-4)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-3)">
        <h2 style="margin:0">${icon('upload')} Importar Archivo Gantt Haitani</h2>
        <button type="button" class="btn secondary" id="gantt-import-close" style="width:32px;height:32px;padding:0">${icon('close')}</button>
      </div>
      <p class="muted" style="margin-bottom:var(--sp-3)">
        Selecciona un archivo <strong>.gan</strong> exportado desde <strong>Gantt Haitani</strong> (o archivo .csv). Se importarán las tareas, duraciones, dependencias e hitos automáticamente.
      </p>
      <form id="gantt-import-form" style="display:grid;gap:var(--sp-3)">
        <label>Proyecto de Destino
          <select class="select" name="project_id">
            <option value="">Crear nuevo proyecto con el nombre del archivo</option>
            ${projectOptions}
          </select>
        </label>
        <label>Archivo (.gan o .csv)
          <input class="input" type="file" name="file" accept=".gan,.xml,.csv" required>
        </label>
        <div class="actions" style="margin-top:var(--sp-2)">
          <button type="submit" class="btn">Importar a Haitani</button>
          <button type="button" class="btn secondary" id="gantt-import-cancel">Cancelar</button>
        </div>
      </form>
    </div>
  `;
  document.body.append(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('#gantt-import-close').onclick = close;
  overlay.querySelector('#gantt-import-cancel').onclick = close;

  overlay.querySelector('#gantt-import-form').onsubmit = async event => {
    event.preventDefault();
    const formData = new FormData(event.target);
    try {
      const res = await api('/gantt/import/gan', {
        method: 'POST',
        body: formData
      });
      notify(res.message || 'Proyecto importado exitosamente');
      if (res.projectId) ganttProjectId = String(res.projectId);
      close();
      renderGantt();
    } catch (err) { notify(err.message); }
  };
}

// Edición Rápida con Dependencias & WBS
async function openGanttQuickEdit(id) {
  let task;
  try { task = await api(`/tasks/${id}`); }
  catch (error) { notify(error.message); return; }

  const allTasks = ganttDataCache?.tasks || [];
  const allDeps = ganttDataCache?.dependencies || [];
  const projectTasks = allTasks.filter(t => t.project_id === task.project_id && t.id !== task.id);

  // Predecesoras de esta tarea
  const currentDeps = allDeps.filter(d => d.task_id === task.id);

  document.querySelectorAll('.gantt-popover').forEach(node => node.remove());
  const popover = document.createElement('div');
  popover.className = 'gantt-popover';
  popover.style.maxWidth = '360px';
  popover.style.zIndex = '100';

  const potentialParents = projectTasks.map(t =>
    `<option value="${t.id}" ${task.parent_id === t.id ? 'selected' : ''}>${esc(t.title)}</option>`
  ).join('');

  const potentialPreds = projectTasks.map(t =>
    `<option value="${t.id}">${esc(t.title)}</option>`
  ).join('');

  const depsListHtml = currentDeps.length ? currentDeps.map(d => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--line);font-size:11px">
      <span><strong>${esc(d.predecessor_title || 'Tarea #' + d.predecessor_id)}</strong> (${d.dependency_type || 'FS'})</span>
      <button type="button" class="btn secondary btn-dep-delete" data-dep-id="${d.id}" style="padding:2px 6px;font-size:10px">${icon('close')}</button>
    </div>
  `).join('') : '<small class="muted">Sin dependencias predecesoras</small>';

  popover.innerHTML = `
    <div style="margin-bottom:var(--sp-2)">
      <strong style="font-size:14px">${esc(task.title)}</strong>
      ${task.is_milestone ? '<span class="badge" style="background:#e5484d;color:#fff;margin-left:6px">Hito</span>' : ''}
    </div>
    <label>Título
      <input class="input" id="gp-title" value="${esc(task.title)}" required>
    </label>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-2)">
      <label>Fecha inicial
        <input class="input" type="date" id="gp-start" value="${task.start_date || ''}">
      </label>
      <label>Fecha límite
        <input class="input" type="date" id="gp-due" value="${task.due_date || ''}">
      </label>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-2)">
      <label>Estado
        <select class="select" id="gp-status">
          <option value="pendiente" ${task.status === 'pendiente' ? 'selected' : ''}>Pendiente</option>
          <option value="en_proceso" ${task.status === 'en_proceso' ? 'selected' : ''}>En proceso</option>
          <option value="completada" ${task.status === 'completada' ? 'selected' : ''}>Completada</option>
        </select>
      </label>
      <label>Progreso (%)
        <input class="input" type="number" id="gp-progress" min="0" max="100" value="${task.progress ?? (task.status === 'completada' ? 100 : (task.status === 'en_proceso' ? 50 : 0))}">
      </label>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-2)">
      <label>Tarea Padre (WBS)
        <select class="select" id="gp-parent">
          <option value="">(Ninguna / Raíz)</option>
          ${potentialParents}
        </select>
      </label>
      <label style="display:flex;align-items:center;gap:6px;margin-top:20px;font-size:12px">
        <input type="checkbox" id="gp-milestone" ${task.is_milestone ? 'checked' : ''}>
        Es Hito
      </label>
    </div>

    <div style="margin-top:var(--sp-3);padding-top:var(--sp-2);border-top:1px solid var(--line)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <strong style="font-size:11px;text-transform:uppercase;color:var(--color-slate-gray)">Predecesoras (Gantt Haitani)</strong>
      </div>
      <div id="gp-dep-list" style="margin-bottom:var(--sp-2)">
        ${depsListHtml}
      </div>
      ${potentialPreds ? `
        <div style="display:flex;gap:4px">
          <select class="select" id="gp-new-pred" style="font-size:11px;flex:1">
            <option value="">+ Vincular predecesora...</option>
            ${potentialPreds}
          </select>
          <button type="button" class="btn secondary" id="gp-add-pred" style="padding:4px 8px;font-size:11px">Vincular</button>
        </div>
      ` : ''}
    </div>

    <div class="actions" style="margin-top:var(--sp-3)">
      <button class="btn" id="gp-save">Guardar Cambios</button>
      <button type="button" class="btn secondary" id="gp-close">Cerrar</button>
    </div>
  `;
  document.body.append(popover);

  // Posicionamiento dinámico
  const anchor = document.querySelector(`.gtc-bar[data-id="${id}"]`) ||
                 document.querySelector(`.gtc-row-table[data-id="${id}"]`) ||
                 document.querySelector(`.gtc-milestone-diamond[data-id="${id}"]`) ||
                 document.querySelector(`.gantt-cal-bar[data-id="${id}"]`) ||
                 document.body;
  const rect = anchor.getBoundingClientRect();
  popover.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 380))}px`;
  popover.style.top = `${Math.min(rect.bottom + 8, window.innerHeight - 380)}px`;

  const close = () => {
    popover.remove();
    document.removeEventListener('pointerdown', onOutside);
  };
  const onOutside = e => {
    if (!popover.contains(e.target)) close();
  };
  setTimeout(() => document.addEventListener('pointerdown', onOutside), 0);

  document.querySelector('#gp-close').onclick = close;

  // Añadir dependencia
  document.querySelector('#gp-add-pred')?.addEventListener('click', async () => {
    const predId = document.querySelector('#gp-new-pred')?.value;
    if (!predId) return;
    try {
      await api('/gantt/dependencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: task.id,
          predecessor_id: Number(predId),
          dependency_type: 'FS',
          lag_days: 0
        })
      });
      notify('Dependencia vinculada');
      close();
      renderGantt();
    } catch (err) { notify(err.message); }
  });

  // Eliminar dependencia
  popover.querySelectorAll('.btn-dep-delete').forEach(btn => {
    btn.onclick = async () => {
      try {
        await api(`/gantt/dependencies/${btn.dataset.depId}`, { method: 'DELETE' });
        notify('Dependencia eliminada');
        close();
        renderGantt();
      } catch (err) { notify(err.message); }
    };
  });

  // Guardar cambios en la tarea
  document.querySelector('#gp-save').onclick = async () => {
    try {
      const title = document.querySelector('#gp-title').value;
      const start = document.querySelector('#gp-start').value;
      const due = document.querySelector('#gp-due').value;
      const status = document.querySelector('#gp-status').value;
      const progress = Number(document.querySelector('#gp-progress').value || 0);
      const parent_id = document.querySelector('#gp-parent').value || null;
      const is_milestone = document.querySelector('#gp-milestone').checked;

      await api(`/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: task.description || '',
          assigned_to: task.assigned_to || '',
          priority: task.priority,
          status,
          start_date: start,
          due_date: due,
          progress,
          parent_id,
          is_milestone
        })
      });

      notify('Tarea actualizada');
      close();
      renderGantt();
    } catch (error) { notify(error.message); }
  };
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
async function assistant(){return `${heading('Asistente IA','Controla el proyecto con preguntas sobre tareas, responsables y fechas.')}<section class="assistant-shell"><div class="assistant-intro"><div><span class="assistant-kicker">Sanzu / Sakura Coffee</span><h2>Tu copiloto de operaciones</h2><p>Consulta el estado del proyecto y recibe respuestas basadas en la información actual del panel.</p></div><span class="assistant-status"><i></i>Conectado al panel</span></div><div class="assistant-suggestions"><button type="button" class="btn secondary assistant-suggestion">¿Qué tareas están vencidas?</button><button type="button" class="btn secondary assistant-suggestion">¿Cuál es el progreso del proyecto?</button><button type="button" class="btn secondary assistant-suggestion">Dame un resumen para la reunión</button><button type="button" class="btn secondary assistant-suggestion">¿Cuáles son las tareas críticas?</button><button type="button" class="btn secondary assistant-suggestion">¿Cómo está la carga de trabajo (workload)?</button><button type="button" class="btn secondary assistant-suggestion">¿Qué riesgos detectas en el proyecto?</button><button type="button" class="btn secondary assistant-suggestion">¿Hay documentación faltante?</button><button type="button" class="btn secondary assistant-suggestion">¿Cuáles son las prioridades actuales?</button></div><div class="assistant-messages" id="assistant-messages"><article class="assistant-message assistant-bot"><span class="assistant-avatar">S</span><div><strong>Sanzu</strong><p>Hola, ${esc(state.user.name)}. Puedo ayudarte a detectar riesgos, revisar tareas críticas, retrasos, workload y preparar el siguiente paso del proyecto.</p><small>Listo para consultar Sakura Coffee</small></div></article></div><form class="assistant-form" id="assistant-form"><textarea class="textarea" name="message" rows="2" placeholder="Pregunta por retrasos, tareas críticas, riesgos, workload o documentación..." required></textarea><button type="submit" class="btn assistant-send" aria-label="Enviar pregunta">${icon('send')} Enviar</button></form></section>`}
async function renderAssistant(){layout(await assistant());const messages=document.querySelector('#assistant-messages');const form=document.querySelector('#assistant-form');const sendBtn=form?.querySelector('.assistant-send');const textarea=form?.querySelector('textarea[name="message"]');const suggestionButtons=document.querySelectorAll('.assistant-suggestion');let conversationId=localStorage.getItem('haitani-assistant-conversation-id')||`conv-${Date.now()}`;localStorage.setItem('haitani-assistant-conversation-id',conversationId);let isAsking=false;const setBusy=busy=>{isAsking=busy;if(sendBtn)sendBtn.disabled=busy;if(textarea)textarea.disabled=busy;suggestionButtons.forEach(btn=>btn.disabled=busy)};const ask=async rawMessage=>{const message=String(rawMessage||'').trim();if(!message||isAsking)return;setBusy(true);messages?.insertAdjacentHTML('beforeend',`<article class="assistant-message assistant-user"><span class="assistant-avatar">${esc(state.user?.name?.[0]||'U')}</span><div><strong>Tú</strong><p>${esc(message)}</p></div></article>`);if(form)form.reset();messages?.insertAdjacentHTML('beforeend','<div class="assistant-loading" id="assistant-loading">Sanzu está analizando el proyecto...</div>');if(messages)messages.scrollTop=messages.scrollHeight;try{const result=await api('/assistant/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,conversationId})});if(result.conversationId){conversationId=result.conversationId;localStorage.setItem('haitani-assistant-conversation-id',conversationId);}document.querySelector('#assistant-loading')?.remove();const sourceLabel=result.source==='sanzu'?'IA remota':'Modo local';const warningText=result.warning?esc(result.warning):'Contexto actualizado desde el proyecto';messages?.insertAdjacentHTML('beforeend',`<article class="assistant-message assistant-bot"><span class="assistant-avatar">S</span><div><strong>Sanzu <small class="assistant-source">${sourceLabel}</small></strong><p style="white-space:pre-line">${esc(result.answer)}</p><small>${warningText}</small></div></article>`);if(messages)messages.scrollTop=messages.scrollHeight}catch(error){document.querySelector('#assistant-loading')?.remove();const errorMsg=error.message||'No fue posible obtener respuesta del asistente.';messages?.insertAdjacentHTML('beforeend',`<article class="assistant-message assistant-bot"><span class="assistant-avatar" style="background:#ef4444;color:#fff">!</span><div><strong style="color:#ef4444">Sanzu</strong><p style="border-color:#ef4444;color:#ef4444">${esc(errorMsg)}</p><small>Error al consultar. Puedes volver a intentarlo.</small></div></article>`);if(messages)messages.scrollTop=messages.scrollHeight;notify(errorMsg)}finally{setBusy(false);if(textarea)textarea.focus()}};if(form){form.onsubmit=event=>{event.preventDefault();const msg=textarea?textarea.value:'';if(msg.trim())ask(msg)}};if(textarea){textarea.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(form){form.requestSubmit?form.requestSubmit():form.dispatchEvent(new Event('submit',{cancelable:true}))}}})};suggestionButtons.forEach(button=>{button.onclick=e=>{e.preventDefault();const q=button.textContent.trim();if(q)ask(q)}})}
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
        <label>Owner (opcional, se toma de la URL)<input class="input" name="owner"></label>
        <label>Repository (opcional, se toma de la URL)<input class="input" name="repo" placeholder="CoffeeKorea"></label>
        <label>Token de GitHub (solo si el repositorio es privado)<input class="input" name="token" type="password" autocomplete="off"></label>
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
      const result = await api('/github/configure', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      notify(result.message || 'Repositorio vinculado correctamente.');
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
      if(location.hash.includes('pending-verification')) return pendingVerificationView();
      return landingView();
    }
  }
  if (state.user && !state.user.is_platform_admin) {
    if (state.user.organization_status === 'pending' || location.hash.includes('pending-verification')) {
      return pendingVerificationView();
    }
    if (state.user.organization_status === 'suspended') {
      return suspendedOrganizationView();
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
    if(route.includes('issues'))return renderIssues();
    if(route.includes('methodologies'))return renderMethodologies();
    if(route.includes('milestones'))return renderMilestones();
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

function pendingVerificationView() {
  app.innerHTML = `
    <main class="login">
      <div class="auth-theme-bar">${themeToggle()}</div>
      <div class="auth-stage">
        <div class="login-box" id="pending-verification-box">
          <div class="login-box-header">
            <div class="brand">${brandLogo()}</div>
            <div class="eyebrow">Verificación Empresarial</div>
            <h1>Organización en revisión</h1>
            <p class="muted">Tu cuenta ha sido creada exitosamente y se encuentra en estado <strong>Pendiente de Aprobación</strong>.</p>
          </div>
          <div class="alert alert-info" style="margin: 1.5rem 0; line-height: 1.6;">
            Por políticas de seguridad empresarial y aislamiento multi-inquilino, un administrador global debe revisar y verificar los datos de tu empresa antes de habilitar el acceso a los servicios de Haitani y Sanzu.
          </div>
          <div class="auth-actions">
            <button type="button" class="btn secondary btn-block" id="pending-logout-btn">Cerrar sesión</button>
          </div>
        </div>
      </div>
    </main>
  `;
  bindTheme();
  document.querySelector('#pending-logout-btn')?.addEventListener('click', async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch {}
    state.user = null;
    location.hash = '#/login';
    loginView();
  });
}

function suspendedOrganizationView() {
  app.innerHTML = `
    <main class="login">
      <div class="auth-theme-bar">${themeToggle()}</div>
      <div class="auth-stage">
        <div class="login-box" id="suspended-box">
          <div class="login-box-header">
            <div class="brand">${brandLogo()}</div>
            <div class="eyebrow" style="color: var(--danger, #e53e3e);">Acceso Suspendido</div>
            <h1>Organización suspendida</h1>
            <p class="muted">El acceso para esta organización ha sido suspendido por un administrador.</p>
          </div>
          <div class="auth-actions">
            <button type="button" class="btn secondary btn-block" id="suspended-logout-btn">Volver al inicio</button>
          </div>
        </div>
      </div>
    </main>
  `;
  bindTheme();
  document.querySelector('#suspended-logout-btn')?.addEventListener('click', async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch {}
    state.user = null;
    location.hash = '#/login';
    loginView();
  });
}

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
              <input class="input" name="slug" pattern="[a-z0-9][a-z0-9\\x2d]{2,49}" placeholder="sakura-coffee" required>
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
                        <label>Dominio corporativo
              <input class="input" name="domain" placeholder="empresa.com">
            </label>
            <label>Sitio web
              <input class="input" name="website" placeholder="https://empresa.com">
            </label>
            <label class="full">Registro oficial / CIF / RFC
              <input class="input" name="official_registry_number" placeholder="Identificador fiscal o legal de la empresa">
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
const renderMessagesBase2 = renderMessages;
renderMessages = async function() {
  await renderMessagesBase2();
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
  let projectMilestones = [];
  let projectIssues = [];
  try {
    overviewData = await api(`/projects/${selectedProjectId}/overview`);
    intelData = await api(`/projects/${selectedProjectId}/intelligence`).catch(() => null);
    projectMilestones = await api(`/projects/${selectedProjectId}/milestones`).catch(() => []);
    projectIssues = await api(`/projects/${selectedProjectId}/issues`).catch(() => []);
    if (!Array.isArray(projectMilestones)) projectMilestones = [];
    if (!Array.isArray(projectIssues)) projectIssues = [];
  } catch (err) {
    return layout(`
      ${heading('Project Overview', 'Control operativo y ejecutivo')}
      <div class="alert mt-4">Error al cargar datos del proyecto: ${esc(err.message)}</div>
    `);
  }

  // Compatibilidad: /api/projects/:id/overview regresa { health, tasks, risks: { items }, sprints, documentsCount }
  // y esta vista espera { progress, summary, blockedTasks, overdueTasks, risks: [], workload, sprint }.
  if (overviewData && overviewData.tasks && !Array.isArray(overviewData.tasks) && !overviewData.summary) {
    const tk = overviewData.tasks;
    const ovTasks = ((await api(`/gantt?project_id=${selectedProjectId}`).catch(() => null)) || {}).tasks || [];
    const open = ovTasks.filter(t => t.status !== 'completada');
    const pct = (n, d) => d ? Math.round(n * 100 / d) : 100;
    const byPerson = new Map();
    ovTasks.filter(t => t.assigned_to).forEach(t => {
      const w = byPerson.get(t.assigned_to) || { name: t.assignee_name || 'Sin nombre', total: 0, completed: 0, active: 0 };
      w.total++; if (t.status === 'completada') w.completed++; else w.active++;
      byPerson.set(t.assigned_to, w);
    });
    const overdueList = tk.overdueList || [];
    overviewData.progress = overviewData.health?.progress ?? (tk.total ? Math.round(tk.completed * 100 / tk.total) : 0);
    overviewData.summary = { totalTasks: tk.total || 0, completedTasks: tk.completed || 0, totalDocuments: overviewData.documentsCount || 0 };
    overviewData.blockedTasks = tk.blockedList || [];
    overviewData.overdueTasks = overdueList;
    overviewData.health = {
      ...(overviewData.health || {}),
      overdue: tk.overdueCount || 0,
      critical: overdueList.filter(t => ['alta', 'urgente', 'critica', 'crítica'].includes(String(t.priority || '').toLowerCase())).length,
      dateCoverage: pct(open.filter(t => t.start_date && t.due_date).length, open.length),
      assignmentCoverage: pct(open.filter(t => t.assigned_to).length, open.length),
      recommendations: overviewData.health?.recommendations || [],
    };
    overviewData.risks = Array.isArray(overviewData.risks) ? overviewData.risks : (overviewData.risks?.items || []);
    overviewData.workload = byPerson.size ? [...byPerson.values()] : (overviewData.workload || []).map(w => ({ name: w.name, total: w.activeTasks || 0, completed: 0, active: w.activeTasks || 0 }));
    overviewData.sprint = overviewData.sprints?.active || null;
  }
  if (overviewData && !overviewData.sanzuSync && intelData?.sanzuSync) {
    overviewData.sanzuSync = { status: intelData.sanzuSync.status, synced_at: intelData.sanzuSync.syncedAt || intelData.sanzuSync.synced_at };
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
            <div style="display:flex;align-items:center;gap:var(--sp-2)">
              ${icon('flag')}
              <h3 style="margin:0">Hitos del Proyecto (Milestones)</h3>
            </div>
            <div class="actions">
              <a class="sub" href="#/${state.user.role}/milestones?project=${p.id}">Ver todos</a>
              ${['admin', 'project_manager'].includes(state.user.role) ? `
                <button class="btn mini secondary" id="overview-create-milestone-btn" data-project-id="${p.id}">
                  ${icon('plus')} Nuevo Hito
                </button>
              ` : ''}
            </div>
          </div>
          ${projectMilestones.length ? `
            <div style="display:grid;gap:var(--sp-2)">
              ${projectMilestones.slice(0, 5).map(m => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:var(--bg-glass);border-radius:var(--r-sm);border:1px solid var(--line);gap:var(--sp-2);flex-wrap:wrap">
                  <div>
                    <strong style="font-size:0.92rem">${esc(m.title)}</strong>
                    <div class="muted sub">${m.description ? esc(m.description) + ' · ' : ''}Fecha objetivo: <strong>${esc(String(m.due_date).slice(0, 10))}</strong></div>
                  </div>
                  <div style="display:flex;align-items:center;gap:var(--sp-2)">
                    ${milestoneStatusBadge(m.status)}
                    ${['admin', 'project_manager'].includes(state.user.role) ? `
                      <button class="icon-btn edit-milestone-btn" data-milestone-id="${m.id}" data-project-id="${p.id}" title="Editar hito">${icon('edit')}</button>
                      <button class="icon-btn danger delete-milestone-btn" data-milestone-id="${m.id}" title="Eliminar hito">${icon('trash')}</button>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          ` : '<div class="empty">No hay hitos registrados para este proyecto.</div>'}
        </div>

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
            <a class="btn secondary" href="#/${state.user.role}/methodologies?project=${p.id}">${icon('bookOpen')} Metodologías</a>
          </div>
        </div>
      </div>
    </div>
  `;

  layout(markup);

  document.querySelector('#overview-project-select')?.addEventListener('change', (e) => {
    location.hash = `#/${state.user.role}/overview?project=${e.target.value}`;
  });

  document.querySelector('#overview-create-milestone-btn')?.addEventListener('click', (e) => {
    openMilestoneModal(e.currentTarget.dataset.projectId, null, () => renderOverview());
  });
  document.querySelectorAll('.edit-milestone-btn').forEach(btn => {
    btn.onclick = async () => {
      try {
        const m = await api(`/milestones/${btn.dataset.milestoneId}`);
        openMilestoneModal(btn.dataset.projectId, m, () => renderOverview());
      } catch (err) { notify(err.message); }
    };
  });
  document.querySelectorAll('.delete-milestone-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('¿Eliminar este hito del proyecto?')) return;
      try {
        await api(`/milestones/${btn.dataset.milestoneId}`, { method: 'DELETE' });
        notify('Hito eliminado correctamente');
        renderOverview();
      } catch (err) { notify(err.message); }
    };
  });

  document.querySelector('#overview-create-issue-btn')?.addEventListener('click', (e) => {
    openIssueModal(e.currentTarget.dataset.projectId, null, () => renderOverview());
  });
  document.querySelectorAll('.edit-issue-btn').forEach(btn => {
    btn.onclick = async () => {
      try {
        const iss = await api(`/issues/${btn.dataset.issueId}`);
        openIssueModal(btn.dataset.projectId, iss, () => renderOverview());
      } catch (err) { notify(err.message); }
    };
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
  let users = [];
  try {
    overview = await api('/risks/overview');
    projects = await api('/projects').catch(() => []);
    users = await api('/users').catch(() => []);
  } catch (err) {
    return layout(`
      ${heading('Risk Center & Eventos', 'Monitoreo de riesgos y eventos')}
      <div class="alert mt-4">Error al cargar Risk Center: ${esc(err.message)}</div>
    `);
  }

  const s = overview.stats || overview.summary || { totalOpenRisks: 0, highSeverity: 0, mediumSeverity: 0, lowSeverity: 0 };
  const risks = overview.risks || [];
  const workload = overview.workload || [];
  const events = overview.activeEvents || overview.events || [];
  const canManage = ['admin', 'project_manager'].includes(state.user.role);

  const hashParams = new URLSearchParams((location.hash.split('?')[1]) || '');
  const filterProject = hashParams.get('project') || '';
  const filterStatus = hashParams.get('status') || '';

  const filteredRisks = risks.filter(r => {
    if (filterProject && String(r.project_id) !== String(filterProject)) return false;
    if (filterStatus && r.status !== filterStatus) return false;
    return true;
  });

  const markup = `
    ${heading('Risk Center & Eventos', 'Gestión proactiva de riesgos de proyecto con severidad calculada automáticamente', `
      <div class="actions">
        <button class="btn secondary" id="detect-events-btn">
          ${icon('activity')} Detectar Anomalías
        </button>
        ${canManage ? `
          <button class="btn" id="open-risk-modal">
            ${icon('plus')} Registrar Riesgo
          </button>
        ` : ''}
      </div>
    `)}

    <div class="grid stats dashboard-stats mt-4">
      <div class="card stat stat-primary">
        <div class="stat-header"><div class="label">Riesgos Abiertos</div>${icon('alertTriangle')}</div>
        <div class="num">${s.totalOpenRisks || risks.filter(r => r.status === 'open').length}</div>
        <div class="stat-footer-sub">En todos los proyectos</div>
      </div>
      <div class="card stat">
        <div class="stat-header"><div class="label">Severidad Alta / Crítica</div>${icon('shield')}</div>
        <div class="num" style="color:var(--pink)">${s.highSeverity || risks.filter(r => r.severity_score >= 60).length}</div>
        <div class="stat-footer-sub">Calculada automáticamente</div>
      </div>
      <div class="card stat">
        <div class="stat-header"><div class="label">Eventos del Sistema</div>${icon('bell')}</div>
        <div class="num" style="color:${events.length > 0 ? 'var(--pink)' : 'inherit'}">${events.length}</div>
        <div class="stat-footer-sub">Alertas operativas pendientes</div>
      </div>
      <div class="card stat">
        <div class="stat-header"><div class="label">Mitigados / Cerrados</div>${icon('check')}</div>
        <div class="num green">${risks.filter(r => r.status === 'mitigated' || r.status === 'closed').length}</div>
        <div class="stat-footer-sub">Riesgos controlados</div>
      </div>
    </div>

    <!-- Filtros de proyecto y estado -->
    <div class="card p-3 mt-4" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--sp-2)">
      <div style="display:flex;align-items:center;gap:var(--sp-2);flex-wrap:wrap">
        <span class="muted sub">Filtrar por proyecto:</span>
        <select class="select mini" id="filter-risk-project" style="min-width:180px">
          <option value="">Todos los proyectos</option>
          ${projects.map(p => `<option value="${p.id}" ${String(p.id) === filterProject ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
        </select>
        <span class="muted sub" style="margin-left:8px">Estado:</span>
        <button class="btn mini ${!filterStatus ? '' : 'secondary'} risk-filter-status" data-status="">Todos</button>
        <button class="btn mini ${filterStatus === 'open' ? '' : 'secondary'} risk-filter-status" data-status="open">Abiertos</button>
        <button class="btn mini ${filterStatus === 'mitigated' ? '' : 'secondary'} risk-filter-status" data-status="mitigated">Mitigados</button>
        <button class="btn mini ${filterStatus === 'accepted' ? '' : 'secondary'} risk-filter-status" data-status="accepted">Aceptados</button>
        <button class="btn mini ${filterStatus === 'closed' ? '' : 'secondary'} risk-filter-status" data-status="closed">Cerrados</button>
      </div>
      <span class="muted sub">${filteredRisks.length} riesgo(s) visualizado(s)</span>
    </div>

    <!-- Matriz de Riesgos -->
    <div class="card p-4 mt-4">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-3)">
        <div style="display:flex;align-items:center;gap:var(--sp-2)">
          ${icon('alertTriangle')}
          <h3 style="margin:0">Matriz de Riesgos (${filteredRisks.length})</h3>
        </div>
      </div>
      ${filteredRisks.length ? `
        <div style="display:grid;gap:var(--sp-3)">
          ${filteredRisks.map(r => `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:16px;background:var(--bg-glass);border-radius:var(--r-md);border:1px solid var(--line);flex-wrap:wrap;gap:var(--sp-3)">
              <div style="max-width:70%">
                <div style="display:flex;align-items:center;gap:var(--sp-2);flex-wrap:wrap;margin-bottom:4px">
                  <strong style="font-size:1.05rem">${esc(r.title)}</strong>
                  ${riskSeverityBadge(r.severity, r.severity_score)}
                  ${riskStatusBadge(r.status)}
                </div>
                ${r.description ? `<p class="muted" style="margin:4px 0">${esc(r.description)}</p>` : ''}
                <div style="font-size:0.88rem;margin-top:6px;display:flex;flex-wrap:wrap;gap:var(--sp-2);align-items:center">
                  <span><strong>Probabilidad:</strong> ${esc(r.probability)}</span> ·
                  <span><strong>Impacto:</strong> ${esc(r.impact)}</span>
                  ${r.project_name ? ` · Proyecto: <strong>${esc(r.project_name)}</strong>` : ''}
                  · Responsable: <strong style="color:var(--text)">${esc(r.assigned_name || 'Sin asignar')}</strong>
                </div>
                ${r.mitigation ? `
                  <div style="font-size:0.88rem;margin-top:6px;padding:8px 12px;background:var(--bg, #111);border-radius:var(--r-sm);border-left:3px solid var(--primary, #0ea5e9)">
                    <strong>Plan de Mitigación:</strong> ${esc(r.mitigation)}
                  </div>
                ` : ''}
              </div>
              ${canManage ? `
                <div class="actions" style="display:flex;flex-direction:column;align-items:flex-end;gap:var(--sp-2)">
                  <div style="display:flex;align-items:center;gap:var(--sp-1)">
                    <span class="muted sub" style="font-size:0.8rem">Cambiar estado:</span>
                    <select class="select mini quick-risk-status" data-risk-id="${r.id}">
                      <option value="open" ${r.status === 'open' ? 'selected' : ''}>Abierto</option>
                      <option value="mitigated" ${r.status === 'mitigated' ? 'selected' : ''}>Mitigado</option>
                      <option value="accepted" ${r.status === 'accepted' ? 'selected' : ''}>Aceptado</option>
                      <option value="closed" ${r.status === 'closed' ? 'selected' : ''}>Cerrado</option>
                    </select>
                  </div>
                  <div style="display:flex;gap:var(--sp-1)">
                    <button class="btn secondary mini edit-risk-modal-btn" data-risk-id="${r.id}">
                      ${icon('edit')} Editar
                    </button>
                    <button class="btn secondary mini delete-risk-btn" data-risk-id="${r.id}" style="color:var(--pink)">
                      ${icon('trash')}
                    </button>
                  </div>
                </div>
              ` : `
                <div>${riskStatusBadge(r.status)}</div>
              `}
            </div>
          `).join('')}
        </div>
      ` : '<div class="empty">No hay riesgos registrados en la matriz para los filtros seleccionados.</div>'}
    </div>

    <!-- Eventos Automáticos del Sistema -->
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

    <!-- Modal para Registrar o Editar Riesgo -->
    <div class="status-overlay" id="risk-modal" style="display:none" role="dialog" aria-modal="true">
      <div class="status-viewer admin-modal-panel" style="max-width:540px">
        <div class="status-viewer-head">
          <h3 id="risk-modal-title">Registrar Nuevo Riesgo</h3>
          <button type="button" class="btn secondary mini close-risk-modal">${icon('close')}</button>
        </div>
        <form class="p-4" id="create-risk-form" style="display:grid;gap:var(--sp-3)">
          <input type="hidden" name="id" id="risk-form-id" value="">
          <label>
            Título del Riesgo *
            <input class="input" name="title" id="risk-form-title" required placeholder="Ej: Indisponibilidad de API de pagos en producción">
          </label>
          <label>
            Descripción
            <textarea class="textarea" name="description" id="risk-form-description" rows="2" placeholder="Detalle y contexto del riesgo..."></textarea>
          </label>
          <div class="grid" style="grid-template-columns:1fr 1fr;gap:var(--sp-2)">
            <label>
              Proyecto *
              <select class="select" name="project_id" id="risk-form-project" required>
                ${projects.map(pr => `<option value="${pr.id}">${esc(pr.name)}</option>`).join('')}
              </select>
            </label>
            <label>
              Responsable (Miembro del Proyecto)
              <select class="select" name="assigned_to" id="risk-form-assigned">
                <option value="">Sin asignar</option>
                ${users.map(u => `<option value="${u.id}">${esc(u.name)} (${esc(u.role)})</option>`).join('')}
              </select>
            </label>
          </div>
          <div class="grid" style="grid-template-columns:1fr 1fr 1fr;gap:var(--sp-2)">
            <label>
              Probabilidad
              <select class="select" name="probability" id="risk-form-probability">
                <option value="baja">Baja</option>
                <option value="media" selected>Media</option>
                <option value="alta">Alta</option>
              </select>
            </label>
            <label>
              Impacto
              <select class="select" name="impact" id="risk-form-impact">
                <option value="baja">Baja</option>
                <option value="media" selected>Media</option>
                <option value="alta">Alta</option>
              </select>
            </label>
            <label>
              Estado
              <select class="select" name="status" id="risk-form-status">
                <option value="open">Abierto (Open)</option>
                <option value="mitigated">Mitigado (Mitigated)</option>
                <option value="accepted">Aceptado (Accepted)</option>
                <option value="closed">Cerrado (Closed)</option>
              </select>
            </label>
          </div>
          <p class="muted sub" style="margin:0;font-size:0.8rem">
            * La severidad se calculará automáticamente en el backend a partir de la probabilidad y el impacto.
          </p>
          <label>
            Plan de Mitigación / Contingencia
            <textarea class="textarea" name="mitigation" id="risk-form-mitigation" rows="3" placeholder="Acciones preventivas, responsables y contingencia..."></textarea>
          </label>
          <div class="actions" style="display:flex;justify-content:flex-end;gap:var(--sp-2);margin-top:var(--sp-2)">
            <button type="button" class="btn secondary close-risk-modal">Cancelar</button>
            <button type="submit" class="btn" id="risk-form-submit-btn">${icon('check')} Guardar Riesgo</button>
          </div>
        </form>
      </div>
    </div>
  `;

  layout(markup);

  const riskModal = document.querySelector('#risk-modal');
  document.querySelector('#open-risk-modal')?.addEventListener('click', () => {
    document.querySelector('#risk-form-id').value = '';
    document.querySelector('#risk-modal-title').textContent = 'Registrar Nuevo Riesgo';
    document.querySelector('#create-risk-form').reset();
    riskModal.style.display = 'grid';
  });

  document.querySelectorAll('.close-risk-modal').forEach(btn => {
    btn.onclick = () => riskModal.style.display = 'none';
  });

  document.querySelector('#filter-risk-project')?.addEventListener('change', (e) => {
    const p = e.target.value;
    location.hash = `#/${state.user.role}/risks?${p ? 'project=' + p : ''}${filterStatus ? '&status=' + filterStatus : ''}`;
  });

  document.querySelectorAll('.risk-filter-status').forEach(btn => {
    btn.onclick = () => {
      const s = btn.dataset.status;
      location.hash = `#/${state.user.role}/risks?${filterProject ? 'project=' + filterProject : ''}${s ? '&status=' + s : ''}`;
    };
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
      btn.innerHTML = `${icon('activity')} Detectar Anomalías`;
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
    const riskId = values.id;
    delete values.id;
    if (!values.assigned_to) delete values.assigned_to;

    try {
      if (riskId) {
        await api(`/risks/${riskId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values)
        });
        notify('Riesgo actualizado correctamente');
      } else {
        await api('/risks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values)
        });
        notify('Riesgo registrado en la matriz');
      }
      riskModal.style.display = 'none';
      renderRisks();
    } catch (err) {
      notify('Error al guardar riesgo: ' + err.message);
    }
  });

  document.querySelectorAll('.edit-risk-modal-btn').forEach(btn => {
    btn.onclick = async () => {
      try {
        const risk = await api(`/risks/${btn.dataset.riskId}`);
        document.querySelector('#risk-form-id').value = risk.id;
        document.querySelector('#risk-modal-title').textContent = 'Editar Riesgo';
        document.querySelector('#risk-form-title').value = risk.title || '';
        document.querySelector('#risk-form-description').value = risk.description || '';
        document.querySelector('#risk-form-project').value = risk.project_id || '';
        document.querySelector('#risk-form-assigned').value = risk.assigned_to || '';
        document.querySelector('#risk-form-probability').value = risk.probability || 'media';
        document.querySelector('#risk-form-impact').value = risk.impact || 'media';
        document.querySelector('#risk-form-status').value = risk.status || 'open';
        document.querySelector('#risk-form-mitigation').value = risk.mitigation || '';
        riskModal.style.display = 'grid';
      } catch (err) {
        notify('Error al cargar datos del riesgo: ' + err.message);
      }
    };
  });

  document.querySelectorAll('.quick-risk-status').forEach(select => {
    select.onchange = async () => {
      const newStatus = select.value;
      const riskId = select.dataset.riskId;
      try {
        await api(`/risks/${riskId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });
        notify(`Estado de riesgo actualizado a: ${newStatus}`);
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


function issuePriorityBadge(priority) {
  const p = String(priority || '').toLowerCase();
  const map = {
    critical: ['pink', 'Crítica'],
    high: ['yellow', 'Alta'],
    medium: ['lilac', 'Media'],
    low: ['green', 'Baja']
  };
  const [cls, label] = map[p] || ['badge', priority || 'Media'];
  return `<span class="badge ${cls}">${esc(label)}</span>`;
}

function issueStatusBadge(status) {
  const s = String(status || '').toLowerCase();
  const map = {
    open: ['yellow', 'Abierta'],
    in_progress: ['lilac', 'En progreso'],
    resolved: ['green', 'Resuelta'],
    closed: ['badge', 'Cerrada']
  };
  const [cls, label] = map[s] || ['badge', status || 'Abierta'];
  return `<span class="badge ${cls}">${esc(label)}</span>`;
}

function openIssueModal(projectId, issue = null, onSaved = null) {
  document.querySelectorAll('.issue-modal-overlay').forEach(n => n.remove());
  const overlay = document.createElement('div');
  overlay.className = 'file-viewer issue-modal-overlay';
  const isEdit = Boolean(issue && issue.id);
  const title = isEdit ? 'Editar Incidencia' : 'Reportar Nueva Incidencia';

  let users = [];
  try {
    api('/users').then(res => {
      users = res || [];
      const sel = overlay.querySelector('#issue-form-assigned');
      if (sel) {
        sel.innerHTML = '<option value="">Sin asignar</option>' + users.map(u =>
          `<option value="${u.id}" ${issue?.assigned_to === u.id ? 'selected' : ''}>${esc(u.name)} (${esc(u.role)})</option>`
        ).join('');
      }
    }).catch(() => {});
  } catch {}

  overlay.innerHTML = `
    <div class="file-viewer-panel" style="max-width:540px;height:auto;padding:var(--sp-4);background:var(--panel, #18181b);border-radius:var(--r-lg, 12px);border:1px solid var(--line, #27272a)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-3)">
        <h3 style="margin:0">${icon('alertTriangle')} ${title}</h3>
        <button type="button" class="btn secondary close-issue-modal" style="width:32px;height:32px;padding:0">${icon('close')}</button>
      </div>
      <form id="issue-form" style="display:grid;gap:var(--sp-3)">
        <input type="hidden" name="project_id" value="${projectId || issue?.project_id || ''}">
        <label>Título de la Incidencia *
          <input class="input" name="title" required value="${esc(issue?.title || '')}" placeholder="Ej: Error 500 al guardar factura / Botón desalineado en móvil">
        </label>
        <label>Descripción detallada *
          <textarea class="textarea" name="description" rows="3" placeholder="Pasos para reproducir, comportamiento esperado vs obtenido...">${esc(issue?.description || '')}</textarea>
        </label>
        <div class="grid" style="grid-template-columns:1fr 1fr;gap:var(--sp-3)">
          <label>Prioridad
            <select class="select" name="priority">
              <option value="low" ${issue?.priority === 'low' ? 'selected' : ''}>Baja (Low)</option>
              <option value="medium" ${!issue || issue?.priority === 'medium' ? 'selected' : ''}>Media (Medium)</option>
              <option value="high" ${issue?.priority === 'high' ? 'selected' : ''}>Alta (High)</option>
              <option value="critical" ${issue?.priority === 'critical' ? 'selected' : ''}>Crítica (Critical)</option>
            </select>
          </label>
          <label>Estado
            <select class="select" name="status">
              <option value="open" ${!issue || issue?.status === 'open' ? 'selected' : ''}>Abierta (Open)</option>
              <option value="in_progress" ${issue?.status === 'in_progress' ? 'selected' : ''}>En progreso (In Progress)</option>
              <option value="resolved" ${issue?.status === 'resolved' ? 'selected' : ''}>Resuelta (Resolved)</option>
              <option value="closed" ${issue?.status === 'closed' ? 'selected' : ''}>Cerrada (Closed)</option>
            </select>
          </label>
        </div>
        <label>Asignado a (Responsable)
          <select class="select" name="assigned_to" id="issue-form-assigned">
            <option value="">Cargando usuarios...</option>
          </select>
        </label>
        <div class="actions" style="display:flex;justify-content:flex-end;gap:var(--sp-2);margin-top:var(--sp-2)">
          <button type="button" class="btn secondary close-issue-modal">Cancelar</button>
          <button type="submit" class="btn">${icon('check')} ${isEdit ? 'Actualizar Incidencia' : 'Reportar Incidencia'}</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelectorAll('.close-issue-modal').forEach(btn => {
    btn.onclick = () => overlay.remove();
  });

  const form = overlay.querySelector('#issue-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    if (!values.assigned_to) delete values.assigned_to;
    try {
      if (isEdit) {
        await api(`/issues/${issue.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values)
        });
        notify('Incidencia actualizada correctamente');
      } else {
        await api('/issues', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values)
        });
        notify('Incidencia reportada con éxito');
      }
      overlay.remove();
      if (onSaved) onSaved();
    } catch (err) {
      notify(err.message || 'Error al guardar la incidencia');
    }
  };
}

async function renderIssues() {
  let projects = [];
  let users = [];
  try {
    projects = await api('/projects');
    users = await api('/users').catch(() => []);
  } catch {}

  if (!projects.length) {
    return layout(`
      ${heading('Incidencias (Issues)', 'Gestión y resolución de fallos y problemas operativos')}
      <div class="card p-5 mt-4 text-center">
        <h2>No hay proyectos registrados</h2>
        <p class="muted">Crea un proyecto primero en el dashboard para gestionar sus incidencias.</p>
        <a class="btn mt-3" href="#/${state.user.role}/dashboard">Ir al Dashboard</a>
      </div>
    `);
  }

  const hashParams = new URLSearchParams((location.hash.split('?')[1]) || '');
  let selectedProjectId = Number(hashParams.get('project')) || projects[0].id;
  if (!projects.some(p => p.id === selectedProjectId)) selectedProjectId = projects[0].id;
  const statusFilter = hashParams.get('status') || '';
  const priorityFilter = hashParams.get('priority') || '';
  const assignedFilter = hashParams.get('assigned_to') || '';

  const queryParams = new URLSearchParams({ project_id: selectedProjectId });
  if (statusFilter) queryParams.set('status', statusFilter);
  if (priorityFilter) queryParams.set('priority', priorityFilter);
  if (assignedFilter) queryParams.set('assigned_to', assignedFilter);

  let issues = [];
  try {
    issues = await api(`/issues?${queryParams.toString()}`);
  } catch (err) {
    return layout(`
      ${heading('Incidencias (Issues)', 'Gestión y resolución de fallos y problemas operativos')}
      <div class="alert mt-4">Error al cargar incidencias: ${esc(err.message)}</div>
    `);
  }

  const canReport = state.user.role !== 'viewer';
  const canManageAll = ['admin', 'project_manager'].includes(state.user.role);

  const total = issues.length;
  const openCount = issues.filter(i => i.status === 'open').length;
  const inProgressCount = issues.filter(i => i.status === 'in_progress').length;
  const resolvedCount = issues.filter(i => i.status === 'resolved' || i.status === 'closed').length;

  const currentProject = projects.find(p => p.id === selectedProjectId);

  const markup = `
    ${heading('Incidencias (Issues)', 'Control, priorización y resolución de fallos reportados en los proyectos', `
      <div class="actions">
        <select class="select" id="issues-project-select" style="min-width:200px">
          ${projects.map(p => `<option value="${p.id}" ${p.id === selectedProjectId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
        </select>
        ${canReport ? `
          <button class="btn" id="open-report-issue-btn">
            ${icon('plus')} Reportar Incidencia
          </button>
        ` : ''}
      </div>
    `)}

    <div class="grid stats dashboard-stats mt-4">
      <div class="card stat stat-primary">
        <div class="stat-header"><div class="label">Total Incidencias</div>${icon('alertTriangle')}</div>
        <div class="num">${total}</div>
        <div class="stat-footer-sub">En proyecto: ${esc(currentProject?.name || '')}</div>
      </div>
      <div class="card stat">
        <div class="stat-header"><div class="label">Abiertas</div>${icon('clock')}</div>
        <div class="num yellow">${openCount}</div>
        <div class="stat-footer-sub">Por atender</div>
      </div>
      <div class="card stat">
        <div class="stat-header"><div class="label">En Proceso</div>${icon('progress')}</div>
        <div class="num lilac">${inProgressCount}</div>
        <div class="stat-footer-sub">En investigación/arreglo</div>
      </div>
      <div class="card stat">
        <div class="stat-header"><div class="label">Resueltas</div>${icon('check')}</div>
        <div class="num green">${resolvedCount}</div>
        <div class="stat-footer-sub">Subsanadas / Cerradas</div>
      </div>
    </div>

    <!-- Barra de Filtros: Estado, Prioridad, Responsable -->
    <div class="card p-3 mt-4" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--sp-2)">
      <div style="display:flex;align-items:center;gap:var(--sp-2);flex-wrap:wrap">
        <span class="muted sub">Filtros:</span>
        <select class="select mini" id="filter-issue-status" style="min-width:130px">
          <option value="">Estado: Todos</option>
          <option value="open" ${statusFilter === 'open' ? 'selected' : ''}>Abiertas</option>
          <option value="in_progress" ${statusFilter === 'in_progress' ? 'selected' : ''}>En progreso</option>
          <option value="resolved" ${statusFilter === 'resolved' ? 'selected' : ''}>Resueltas</option>
          <option value="closed" ${statusFilter === 'closed' ? 'selected' : ''}>Cerradas</option>
        </select>
        <select class="select mini" id="filter-issue-priority" style="min-width:130px">
          <option value="">Prioridad: Todas</option>
          <option value="critical" ${priorityFilter === 'critical' ? 'selected' : ''}>Crítica</option>
          <option value="high" ${priorityFilter === 'high' ? 'selected' : ''}>Alta</option>
          <option value="medium" ${priorityFilter === 'medium' ? 'selected' : ''}>Media</option>
          <option value="low" ${priorityFilter === 'low' ? 'selected' : ''}>Baja</option>
        </select>
        <select class="select mini" id="filter-issue-assigned" style="min-width:150px">
          <option value="">Responsable: Todos</option>
          ${users.map(u => `<option value="${u.id}" ${String(u.id) === assignedFilter ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}
        </select>
        ${(statusFilter || priorityFilter || assignedFilter) ? `
          <button class="btn mini secondary" id="clear-issue-filters">Limpiar filtros</button>
        ` : ''}
      </div>
      <span class="muted sub">${issues.length} incidencia(s) encontrada(s)</span>
    </div>

    <!-- Lista de Incidencias -->
    <div class="card p-4 mt-4">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-3)">
        <h3 style="margin:0">Listado de Incidencias (${issues.length})</h3>
      </div>
      ${issues.length ? `
        <div style="display:grid;gap:var(--sp-3)">
          ${issues.map(iss => `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:16px;background:var(--bg-glass);border-radius:var(--r-md);border:1px solid var(--line);gap:var(--sp-3);flex-wrap:wrap">
              <div style="max-width:70%">
                <div style="display:flex;align-items:center;gap:var(--sp-2);flex-wrap:wrap;margin-bottom:4px">
                  <strong style="font-size:1.05rem">${esc(iss.title)}</strong>
                  ${issuePriorityBadge(iss.priority)}
                  ${issueStatusBadge(iss.status)}
                </div>
                ${iss.description ? `<p class="muted" style="margin:4px 0">${esc(iss.description)}</p>` : ''}
                <div style="font-size:0.88rem;margin-top:6px;display:flex;flex-wrap:wrap;gap:var(--sp-2);align-items:center" class="muted">
                  <span>Reportado por: <strong>${esc(iss.reporter_name || 'Anónimo')}</strong></span> ·
                  <span>Asignado a: <strong style="color:var(--text)">${esc(iss.assigned_name || 'Sin asignar')}</strong></span> ·
                  <span>Fecha: ${esc(new Date(iss.created_at).toLocaleDateString())}</span>
                </div>
              </div>
              <div class="actions" style="display:flex;align-items:center;gap:var(--sp-2)">
                ${canReport ? `
                  <button class="btn secondary mini edit-issue-page-btn" data-issue-id="${iss.id}">
                    ${icon('edit')} Editar
                  </button>
                ` : ''}
                ${canManageAll ? `
                  <button class="btn secondary mini delete-issue-page-btn" data-issue-id="${iss.id}" style="color:var(--pink)">
                    ${icon('trash')}
                  </button>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="empty">No se encontraron incidencias con los filtros seleccionados.</div>
      `}
    </div>
  `;

  layout(markup);

  function applyFilters() {
    const p = document.querySelector('#issues-project-select')?.value || selectedProjectId;
    const st = document.querySelector('#filter-issue-status')?.value || '';
    const pr = document.querySelector('#filter-issue-priority')?.value || '';
    const as = document.querySelector('#filter-issue-assigned')?.value || '';
    const q = new URLSearchParams({ project: p });
    if (st) q.set('status', st);
    if (pr) q.set('priority', pr);
    if (as) q.set('assigned_to', as);
    location.hash = `#/${state.user.role}/issues?${q.toString()}`;
  }

  document.querySelector('#issues-project-select')?.addEventListener('change', applyFilters);
  document.querySelector('#filter-issue-status')?.addEventListener('change', applyFilters);
  document.querySelector('#filter-issue-priority')?.addEventListener('change', applyFilters);
  document.querySelector('#filter-issue-assigned')?.addEventListener('change', applyFilters);
  document.querySelector('#clear-issue-filters')?.addEventListener('click', () => {
    location.hash = `#/${state.user.role}/issues?project=${selectedProjectId}`;
  });

  document.querySelector('#open-report-issue-btn')?.addEventListener('click', () => {
    openIssueModal(selectedProjectId, null, () => renderIssues());
  });

  document.querySelectorAll('.edit-issue-page-btn').forEach(btn => {
    btn.onclick = async () => {
      try {
        const iss = await api(`/issues/${btn.dataset.issueId}`);
        openIssueModal(selectedProjectId, iss, () => renderIssues());
      } catch (err) { notify(err.message); }
    };
  });

  document.querySelectorAll('.delete-issue-page-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('¿Seguro que deseas eliminar esta incidencia?')) return;
      try {
        await api(`/issues/${btn.dataset.issueId}`, { method: 'DELETE' });
        notify('Incidencia eliminada');
        renderIssues();
      } catch (err) { notify(err.message); }
    };
  });
}


// ---------- Hitos (Milestones) ----------
function milestoneStatusBadge(status) {
  const map = { pendiente: ['yellow', 'Pendiente'], en_progreso: ['lilac', 'En progreso'], completado: ['green', 'Completado'] };
  const [cls, label] = map[String(status || '').toLowerCase()] || ['badge', status || 'Pendiente'];
  return `<span class="badge ${cls}">${esc(label)}</span>`;
}

function milestoneDate(value) {
  return String(value || '').slice(0, 10);
}

// Días que faltan (negativo = atrasado) para un hito que no está completado
function milestoneDaysLeft(m) {
  const d = milestoneDate(m.due_date);
  if (!d) return null;
  const [y, mo, da] = d.split('-').map(Number);
  const due = new Date(y, mo - 1, da);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((due - today) / 86400000);
}

function milestoneTimingBadge(m) {
  if (m.status === 'completado') return '';
  const left = milestoneDaysLeft(m);
  if (left === null) return '';
  if (left < 0) return `<span class="badge pink">Atrasado ${-left} ${-left === 1 ? 'día' : 'días'}</span>`;
  if (left === 0) return '<span class="badge yellow">Vence hoy</span>';
  if (left <= 7) return `<span class="badge yellow">Faltan ${left} ${left === 1 ? 'día' : 'días'}</span>`;
  return `<span class="muted sub">Faltan ${left} días</span>`;
}

function openMilestoneModal(projectId, milestone = null, onSaved = null) {
  document.querySelectorAll('.milestone-modal-overlay').forEach(n => n.remove());
  const overlay = document.createElement('div');
  overlay.className = 'file-viewer milestone-modal-overlay';
  const isEdit = Boolean(milestone && milestone.id);
  overlay.innerHTML = `
    <div class="file-viewer-panel" style="max-width:520px;height:auto;padding:var(--sp-4);background:var(--panel, #18181b);border-radius:var(--r-lg, 12px);border:1px solid var(--line, #27272a)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-3)">
        <h3 style="margin:0">${icon('flag')} ${isEdit ? 'Editar hito' : 'Nuevo hito'}</h3>
        <button type="button" class="btn secondary close-milestone-modal" style="width:32px;height:32px;padding:0">${icon('close')}</button>
      </div>
      <form id="milestone-form" style="display:grid;gap:var(--sp-3)">
        <input type="hidden" name="project_id" value="${esc(projectId || milestone?.project_id || '')}">
        <label>Nombre del hito *
          <input class="input" name="title" required maxlength="160" value="${esc(milestone?.title || '')}" placeholder="Ej: Entrega del prototipo / Sprint review 4">
        </label>
        <label>Descripción
          <textarea class="textarea" name="description" rows="3" placeholder="Qué se entrega o qué debe estar listo en esta fecha">${esc(milestone?.description || '')}</textarea>
        </label>
        <div class="grid" style="grid-template-columns:1fr 1fr;gap:var(--sp-3)">
          <label>Fecha objetivo *
            <input class="input" type="date" name="due_date" required value="${esc(milestoneDate(milestone?.due_date))}">
          </label>
          <label>Estado
            <select class="select" name="status">
              <option value="pendiente" ${!milestone || milestone.status === 'pendiente' ? 'selected' : ''}>Pendiente</option>
              <option value="en_progreso" ${milestone?.status === 'en_progreso' ? 'selected' : ''}>En progreso</option>
              <option value="completado" ${milestone?.status === 'completado' ? 'selected' : ''}>Completado</option>
            </select>
          </label>
        </div>
        <div class="actions" style="display:flex;justify-content:flex-end;gap:var(--sp-2);margin-top:var(--sp-2)">
          <button type="button" class="btn secondary close-milestone-modal">Cancelar</button>
          <button type="submit" class="btn">${icon('check')} ${isEdit ? 'Guardar cambios' : 'Crear hito'}</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelectorAll('.close-milestone-modal').forEach(btn => { btn.onclick = () => overlay.remove(); });
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  const form = overlay.querySelector('#milestone-form');
  let sending = false;
  form.onsubmit = async e => {
    e.preventDefault();
    if (sending) return;
    sending = true;
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    const values = Object.fromEntries(new FormData(form));
    try {
      if (isEdit) {
        delete values.project_id;
        await api(`/milestones/${milestone.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
        notify('Hito actualizado');
      } else {
        await api('/milestones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
        notify('Hito creado');
      }
      overlay.remove();
      if (onSaved) onSaved();
    } catch (err) {
      notify(err.message);
      sending = false;
      if (submit) submit.disabled = false;
    }
  };
}

async function renderMilestones() {
  let projects = [];
  try { projects = await api('/projects'); } catch {}
  const title = 'Hitos del proyecto';
  const subtitle = 'Entregas importantes con su fecha objetivo y su estado';
  if (!projects.length) {
    return layout(`
      ${heading(title, subtitle)}
      <div class="card p-5 mt-4 text-center">
        <h2>No hay proyectos registrados</h2>
        <p class="muted">Crea un proyecto primero para registrar sus hitos.</p>
        <a class="btn mt-3" href="#/${state.user.role}/dashboard">Ir al Dashboard</a>
      </div>`);
  }
  const hashParams = new URLSearchParams((location.hash.split('?')[1]) || '');
  let selectedProjectId = Number(hashParams.get('project')) || projects[0].id;
  if (!projects.some(p => p.id === selectedProjectId)) selectedProjectId = projects[0].id;
  const statusFilter = hashParams.get('status') || '';

  let milestones = [];
  try {
    milestones = await api(`/projects/${selectedProjectId}/milestones`);
  } catch (err) {
    return layout(`${heading(title, subtitle)}<div class="alert mt-4">Error al cargar los hitos: ${esc(err.message)}</div>`);
  }
  const canManage = ['admin', 'project_manager'].includes(state.user.role);
  const late = milestones.filter(m => m.status !== 'completado' && milestoneDaysLeft(m) < 0);
  const count = s => milestones.filter(m => m.status === s).length;
  const shown = statusFilter === 'atrasado' ? late : statusFilter ? milestones.filter(m => m.status === statusFilter) : milestones;
  const next = milestones.filter(m => m.status !== 'completado' && milestoneDaysLeft(m) >= 0).sort((a, b) => milestoneDate(a.due_date).localeCompare(milestoneDate(b.due_date)))[0];
  const currentProject = projects.find(p => p.id === selectedProjectId);

  layout(`
    ${heading(title, subtitle, `
      <div class="actions">
        <select class="select" id="milestones-project-select" style="min-width:200px">
          ${projects.map(p => `<option value="${p.id}" ${p.id === selectedProjectId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
        </select>
        <a class="btn secondary" href="#/${state.user.role}/gantt">${icon('gantt')} Ver en el Gantt</a>
        ${canManage ? `<button class="btn" id="open-new-milestone-btn">${icon('plus')} Nuevo hito</button>` : ''}
      </div>`)}

    <div class="grid stats dashboard-stats mt-4">
      <div class="card stat stat-primary">
        <div class="stat-header"><div class="label">Hitos</div>${icon('flag')}</div>
        <div class="num">${milestones.length}</div>
        <div class="stat-footer-sub">En ${esc(currentProject?.name || '')}</div>
      </div>
      <div class="card stat">
        <div class="stat-header"><div class="label">Completados</div>${icon('check')}</div>
        <div class="num green">${count('completado')}</div>
        <div class="stat-footer-sub">${milestones.length ? Math.round(count('completado') * 100 / milestones.length) : 0} % del total</div>
      </div>
      <div class="card stat">
        <div class="stat-header"><div class="label">Atrasados</div>${icon('alertTriangle')}</div>
        <div class="num ${late.length ? 'yellow' : ''}">${late.length}</div>
        <div class="stat-footer-sub">Fecha vencida sin completar</div>
      </div>
      <div class="card stat">
        <div class="stat-header"><div class="label">Próximo hito</div>${icon('calendar')}</div>
        <div class="num num-sm">${next ? esc(milestoneDate(next.due_date)) : '—'}</div>
        <div class="stat-footer-sub">${next ? esc(next.title) : 'Sin hitos pendientes'}</div>
      </div>
    </div>

    <div class="card p-3 mt-4" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--sp-2)">
      <div style="display:flex;align-items:center;gap:var(--sp-2);flex-wrap:wrap">
        <span class="muted sub">Mostrar:</span>
        <select class="select mini" id="filter-milestone-status" style="min-width:160px">
          <option value="">Todos</option>
          <option value="pendiente" ${statusFilter === 'pendiente' ? 'selected' : ''}>Pendientes</option>
          <option value="en_progreso" ${statusFilter === 'en_progreso' ? 'selected' : ''}>En progreso</option>
          <option value="completado" ${statusFilter === 'completado' ? 'selected' : ''}>Completados</option>
          <option value="atrasado" ${statusFilter === 'atrasado' ? 'selected' : ''}>Atrasados</option>
        </select>
      </div>
      <span class="muted sub">${shown.length} hito(s)</span>
    </div>

    <div class="card p-4 mt-4">
      ${shown.length ? `
        <div style="display:grid;gap:var(--sp-3)">
          ${shown.map(m => `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:16px;background:var(--bg-glass);border-radius:var(--r-md);border:1px solid var(--line);gap:var(--sp-3);flex-wrap:wrap">
              <div style="display:flex;gap:var(--sp-3);align-items:flex-start;max-width:75%">
                <div style="min-width:64px;text-align:center;padding:6px 8px;border-radius:var(--r-sm);border:1px solid var(--line)">
                  <div class="muted sub">${esc(new Date(milestoneDate(m.due_date) + 'T12:00:00').toLocaleDateString('es-MX', { month: 'short' }))}</div>
                  <strong style="font-size:1.4rem">${esc(milestoneDate(m.due_date).slice(8, 10))}</strong>
                </div>
                <div>
                  <div style="display:flex;align-items:center;gap:var(--sp-2);flex-wrap:wrap;margin-bottom:4px">
                    <strong style="font-size:1.05rem">${esc(m.title)}</strong>
                    ${milestoneStatusBadge(m.status)}
                    ${milestoneTimingBadge(m)}
                  </div>
                  ${m.description ? `<p class="muted" style="margin:4px 0">${esc(m.description)}</p>` : ''}
                  <div class="muted sub">Fecha objetivo: <strong>${esc(milestoneDate(m.due_date))}</strong>${m.creator_name ? ` · Registrado por ${esc(m.creator_name)}` : ''}</div>
                </div>
              </div>
              ${canManage ? `
                <div class="actions" style="display:flex;align-items:center;gap:var(--sp-2)">
                  ${m.status !== 'completado' ? `<button class="btn secondary mini complete-milestone-btn" data-milestone-id="${m.id}">${icon('check')} Completar</button>` : ''}
                  <button class="btn secondary mini edit-milestone-page-btn" data-milestone-id="${m.id}">${icon('edit')} Editar</button>
                  <button class="btn secondary mini delete-milestone-page-btn" data-milestone-id="${m.id}" style="color:var(--pink)">${icon('trash')}</button>
                </div>` : ''}
            </div>`).join('')}
        </div>
      ` : `<div class="empty">${milestones.length ? 'No hay hitos con ese filtro.' : `Este proyecto todavía no tiene hitos.${canManage ? ' Crea el primero con "Nuevo hito".' : ''}`}</div>`}
    </div>
  `);

  const go = () => {
    const q = new URLSearchParams({ project: document.querySelector('#milestones-project-select')?.value || selectedProjectId });
    const st = document.querySelector('#filter-milestone-status')?.value;
    if (st) q.set('status', st);
    location.hash = `#/${state.user.role}/milestones?${q.toString()}`;
  };
  document.querySelector('#milestones-project-select')?.addEventListener('change', go);
  document.querySelector('#filter-milestone-status')?.addEventListener('change', go);
  document.querySelector('#open-new-milestone-btn')?.addEventListener('click', () => openMilestoneModal(selectedProjectId, null, () => renderMilestones()));
  document.querySelectorAll('.edit-milestone-page-btn').forEach(btn => {
    btn.onclick = async () => {
      try { openMilestoneModal(selectedProjectId, await api(`/milestones/${btn.dataset.milestoneId}`), () => renderMilestones()); } catch (err) { notify(err.message); }
    };
  });
  document.querySelectorAll('.complete-milestone-btn').forEach(btn => {
    btn.onclick = async () => {
      btn.disabled = true;
      try {
        await api(`/milestones/${btn.dataset.milestoneId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'completado' }) });
        notify('Hito completado');
        renderMilestones();
      } catch (err) { notify(err.message); btn.disabled = false; }
    };
  });
  document.querySelectorAll('.delete-milestone-page-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('¿Eliminar este hito del proyecto?')) return;
      try {
        await api(`/milestones/${btn.dataset.milestoneId}`, { method: 'DELETE' });
        notify('Hito eliminado');
        renderMilestones();
      } catch (err) { notify(err.message); }
    };
  });
}

async function renderMethodologies() {
  const hash = location.hash || '';
  const searchParams = new URLSearchParams(hash.split('?')[1] || '');
  let selectedProjectId = searchParams.get('project') ? Number(searchParams.get('project')) : null;

  let projects = [];
  try {
    projects = await api('/projects');
  } catch (err) {
    projects = [];
  }

  let methodologies = [];
  try {
    methodologies = await api('/methodologies');
  } catch (err) {
    methodologies = [];
  }

  if (projects.length && (!selectedProjectId || !projects.some(p => p.id === selectedProjectId))) {
    selectedProjectId = projects[0].id;
  }
  const currentProject = projects.find(p => p.id === selectedProjectId) || null;
  const isAdminOrPm = ['admin', 'project_manager'].includes(state.user.role);

  const total = methodologies.length;
  const agileCount = methodologies.filter(m => (m.category || '').toLowerCase() === 'agile').length;
  const traditionalCount = methodologies.filter(m => (m.category || '').toLowerCase() === 'traditional').length;
  const hybridCount = methodologies.filter(m => (m.category || '').toLowerCase() === 'hybrid').length;

  const headerAction = isAdminOrPm ? `
    <button class="btn" id="open-create-methodology-btn">
      ${icon('plus')} Registrar Metodología
    </button>
  ` : '';

  const markup = `
    ${heading('Catálogo de Metodologías', 'Marcos de trabajo, principios de desarrollo y estándares de proyectos IT', headerAction)}

    <!-- Selector de Proyecto y Contexto -->
    <div class="card p-3 mb-4" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--sp-3)">
      <div style="display:flex;align-items:center;gap:var(--sp-3);flex-wrap:wrap">
        <label style="margin:0;font-weight:600;display:flex;align-items:center;gap:8px">
          ${icon('folder')} Proyecto:
          <select id="methodology-project-select" class="select" style="min-width:240px;margin:0">
            ${projects.map(p => `<option value="${p.id}" ${p.id === selectedProjectId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
          </select>
        </label>
        ${currentProject ? `
          <div style="display:flex;align-items:center;gap:6px">
            <span class="muted sub">Metodología asignada:</span>
            <span class="badge blue font-weight-bold">${esc(currentProject.methodology_id || 'AGILE')}</span>
          </div>
        ` : ''}
      </div>
      <div style="display:flex;gap:var(--sp-2)">
        ${currentProject ? `
          <a class="btn secondary mini" href="#/${state.user.role}/overview?project=${currentProject.id}">
            ${icon('pieChart')} Volver al Proyecto
          </a>
        ` : ''}
      </div>
    </div>

    <!-- Indicadores del Catálogo -->
    <div class="grid-4 mb-4">
      <div class="stat">
        <div class="stat-header"><div class="label">Total Metodologías</div>${icon('bookOpen')}</div>
        <div class="value">${total}</div>
        <div class="stat-footer-sub">Catálogo extensible</div>
      </div>
      <div class="stat">
        <div class="stat-header"><div class="label">Ágiles (Agile)</div>${icon('kanban')}</div>
        <div class="value">${agileCount}</div>
        <div class="stat-footer-sub">Scrum, Kanban, XP, Lean...</div>
      </div>
      <div class="stat">
        <div class="stat-header"><div class="label">Tradicionales</div>${icon('gantt')}</div>
        <div class="value">${traditionalCount}</div>
        <div class="stat-footer-sub">Waterfall / Cascada</div>
      </div>
      <div class="stat">
        <div class="stat-header"><div class="label">Híbridas</div>${icon('progress')}</div>
        <div class="value">${hybridCount}</div>
        <div class="stat-footer-sub">Adaptables y mixtas</div>
      </div>
    </div>

    <!-- Grid de Tarjetas de Metodología -->
    <div class="grid-2 mb-4" style="gap:var(--sp-4)">
      ${methodologies.map(m => {
        const isCurrent = currentProject && currentProject.methodology_id === m.id;
        const catBadge = m.category === 'agile' ? 'green' : m.category === 'traditional' ? 'yellow' : 'blue';
        const catLabel = m.category === 'agile' ? 'Ágil' : m.category === 'traditional' ? 'Tradicional' : 'Híbrida';
        const principles = Array.isArray(m.principles) ? m.principles : [];
        const practices = Array.isArray(m.practices) ? m.practices : [];

        return `
          <div class="card p-4" style="display:flex;flex-direction:column;justify-content:space-between;${isCurrent ? 'border-color:var(--color-primary, #627079);box-shadow:0 0 0 1px rgba(148,178,186,0.3)' : ''}">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:var(--sp-2)">
                <div>
                  <h3 style="margin:0 0 4px 0;display:flex;align-items:center;gap:8px">
                    ${esc(m.name)}
                    <span class="badge ${catBadge}">${catLabel}</span>
                    ${m.is_custom ? '<span class="badge pink">Personalizada</span>' : ''}
                  </h3>
                  <code style="font-size:0.8rem;color:var(--muted)">ID: ${esc(m.id)}</code>
                </div>
                ${isCurrent ? '<span class="badge green" style="white-space:nowrap">✓ Asignada</span>' : ''}
              </div>

              <p class="muted" style="font-size:0.9rem;line-height:1.5;margin-bottom:var(--sp-3)">
                ${esc(m.description)}
              </p>

              ${principles.length ? `
                <div style="margin-bottom:var(--sp-2)">
                  <div class="sub muted" style="font-weight:600;margin-bottom:4px">Principios:</div>
                  <div style="display:flex;flex-wrap:wrap;gap:4px">
                    ${principles.slice(0, 4).map(p => `<span class="badge" style="font-size:0.75rem">${esc(p)}</span>`).join('')}
                    ${principles.length > 4 ? `<span class="badge" style="font-size:0.75rem">+${principles.length - 4} más</span>` : ''}
                  </div>
                </div>
              ` : ''}

              ${practices.length ? `
                <div style="margin-bottom:var(--sp-3)">
                  <div class="sub muted" style="font-weight:600;margin-bottom:4px">Prácticas clave:</div>
                  <div style="display:flex;flex-wrap:wrap;gap:4px">
                    ${practices.slice(0, 4).map(pr => `<span class="badge" style="font-size:0.75rem">${esc(pr)}</span>`).join('')}
                    ${practices.length > 4 ? `<span class="badge" style="font-size:0.75rem">+${practices.length - 4} más</span>` : ''}
                  </div>
                </div>
              ` : ''}
            </div>

            <div class="actions" style="display:flex;justify-content:space-between;align-items:center;margin-top:var(--sp-3);padding-top:var(--sp-2);border-top:1px solid var(--line)">
              <button class="btn secondary mini view-methodology-btn" data-method-id="${esc(m.id)}">
                ${icon('eye')} Ver Detalle
              </button>
              ${isAdminOrPm ? `
                <button class="btn mini ${isCurrent ? 'secondary' : ''} assign-methodology-btn" data-method-id="${esc(m.id)}" ${isCurrent ? 'disabled' : ''}>
                  ${icon('check')} ${isCurrent ? 'Metodología Actual' : 'Asignar al Proyecto'}
                </button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  layout(markup);

  document.querySelector('#methodology-project-select')?.addEventListener('change', (e) => {
    location.hash = `#/${state.user.role}/methodologies?project=${e.target.value}`;
  });

  document.querySelector('#open-create-methodology-btn')?.addEventListener('click', () => {
    openCustomMethodologyModal(() => renderMethodologies());
  });

  document.querySelectorAll('.view-methodology-btn').forEach(btn => {
    btn.onclick = async () => {
      try {
        const m = await api(`/methodologies/${btn.dataset.methodId}`);
        openMethodologyDetailModal(m, projects, selectedProjectId, () => renderMethodologies());
      } catch (err) {
        notify(err.message);
      }
    };
  });

  document.querySelectorAll('.assign-methodology-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!selectedProjectId) {
        notify('Por favor selecciona un proyecto primero.');
        return;
      }
      const methodId = btn.dataset.methodId;
      try {
        await api(`/projects/${selectedProjectId}/methodology`, {
          method: 'PUT',
          body: { methodology_id: methodId }
        });
        notify(`Metodología ${methodId} asignada con éxito al proyecto.`);
        renderMethodologies();
      } catch (err) {
        notify(err.message);
      }
    };
  });
}

function openMethodologyDetailModal(methodology, projects, currentProjectId, onSaved) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop active';
  const isAdminOrPm = ['admin', 'project_manager'].includes(state.user.role);
  const principles = Array.isArray(methodology.principles) ? methodology.principles : [];
  const practices = Array.isArray(methodology.practices) ? methodology.practices : [];

  modal.innerHTML = `
    <div class="modal card" style="max-width:650px;width:95%">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-3)">
        <div>
          <h2 style="margin:0;display:flex;align-items:center;gap:8px">
            ${icon('bookOpen')} ${esc(methodology.name)}
          </h2>
          <span class="badge blue sub mt-1">ID: ${esc(methodology.id)} · Categoría: ${esc(methodology.category || 'agile')}</span>
        </div>
        <button class="btn secondary mini close-modal-btn" type="button">${icon('close')}</button>
      </div>

      <div style="margin-bottom:var(--sp-4)">
        <h4 style="margin:0 0 6px 0">Descripción del Marco</h4>
        <p class="muted" style="line-height:1.6;font-size:0.95rem">${esc(methodology.description)}</p>
      </div>

      ${principles.length ? `
        <div style="margin-bottom:var(--sp-4)">
          <h4 style="margin:0 0 8px 0">Principios Rectores</h4>
          <ul style="margin:0;padding-left:20px;font-size:0.9rem;line-height:1.6">
            ${principles.map(p => `<li>${esc(p)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      ${practices.length ? `
        <div style="margin-bottom:var(--sp-4)">
          <h4 style="margin:0 0 8px 0">Prácticas y Ceremonias Clave</h4>
          <ul style="margin:0;padding-left:20px;font-size:0.9rem;line-height:1.6">
            ${practices.map(pr => `<li>${esc(pr)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      ${isAdminOrPm ? `
        <div class="card p-3 mb-3" style="background:var(--bg-glass);border:1px solid var(--line)">
          <h4 style="margin:0 0 8px 0">Asignar a un Proyecto</h4>
          <div style="display:flex;gap:var(--sp-2);align-items:center;flex-wrap:wrap">
            <select id="modal-assign-project-id" class="select" style="flex:1;min-width:200px;margin:0">
              ${projects.map(p => `<option value="${p.id}" ${p.id === currentProjectId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
            </select>
            <button class="btn" id="modal-submit-assign-btn" type="button">
              ${icon('check')} Asignar Metodología
            </button>
          </div>
        </div>
      ` : ''}

      <div class="actions" style="justify-content:flex-end">
        <button class="btn secondary close-modal-btn" type="button">Cerrar</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => modal.remove();
  modal.querySelectorAll('.close-modal-btn').forEach(b => b.onclick = closeModal);

  modal.querySelector('#modal-submit-assign-btn')?.addEventListener('click', async () => {
    const projId = modal.querySelector('#modal-assign-project-id')?.value;
    if (!projId) return;
    try {
      await api(`/projects/${projId}/methodology`, {
        method: 'PUT',
        body: { methodology_id: methodology.id }
      });
      notify(`Metodología ${methodology.name} asignada exitosamente.`);
      closeModal();
      if (onSaved) onSaved();
    } catch (err) {
      notify(err.message);
    }
  });
}

function openCustomMethodologyModal(onCreated) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop active';

  modal.innerHTML = `
    <div class="modal card" style="max-width:560px;width:95%">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-3)">
        <h3 style="margin:0;display:flex;align-items:center;gap:8px">${icon('plus')} Registrar Metodología</h3>
        <button class="btn secondary mini close-modal-btn" type="button">${icon('close')}</button>
      </div>
      <p class="muted sub" style="margin-bottom:var(--sp-3)">
        El catálogo es extensible: agregar una metodología nueva no altera las rutas ni el esquema del sistema.
      </p>

      <form id="custom-methodology-form" class="form-grid">
        <label>Nombre de la Metodología
          <input class="input" name="name" placeholder="Ej. Shape Up, Crystal Clear..." required>
        </label>
        <label>Identificador (ID / Código)
          <input class="input" name="id" placeholder="Ej. SHAPE_UP, CRYSTAL (opcional)">
        </label>
        <label>Categoría
          <select class="select" name="category">
            <option value="agile">Ágil (Agile)</option>
            <option value="traditional">Tradicional (Secuencial)</option>
            <option value="hybrid">Híbrida</option>
          </select>
        </label>
        <label class="full">Descripción
          <textarea class="textarea" name="description" rows="3" placeholder="Descripción del marco metodológico y cuándo es recomendado..." required></textarea>
        </label>
        <label class="full">Principios Rectores (separados por coma)
          <input class="input" name="principles" placeholder="Ej. Ciclos de 6 semanas, Sin backlog infinito, Apuestas de valor">
        </label>
        <label class="full">Prácticas Clave (separadas por coma)
          <input class="input" name="practices" placeholder="Ej. Shaping, Betting Table, Building, Cooldown">
        </label>
        <div class="actions full" style="justify-content:flex-end;margin-top:var(--sp-2)">
          <button class="btn secondary close-modal-btn" type="button">Cancelar</button>
          <button class="btn" type="submit">${icon('check')} Guardar en Catálogo</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => modal.remove();
  modal.querySelectorAll('.close-modal-btn').forEach(b => b.onclick = closeModal);

  modal.querySelector('#custom-methodology-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const principlesRaw = fd.get('principles') || '';
    const practicesRaw = fd.get('practices') || '';

    const payload = {
      name: fd.get('name'),
      id: fd.get('id') || undefined,
      category: fd.get('category'),
      description: fd.get('description'),
      principles: principlesRaw ? principlesRaw.split(',').map(s => s.trim()).filter(Boolean) : [],
      practices: practicesRaw ? practicesRaw.split(',').map(s => s.trim()).filter(Boolean) : []
    };

    try {
      await api('/methodologies', {
        method: 'POST',
        body: payload
      });
      notify('Metodología registrada en el catálogo extensible con éxito.');
      closeModal();
      if (onCreated) onCreated();
    } catch (err) {
      notify(err.message);
    }
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