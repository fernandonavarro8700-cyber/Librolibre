/**
 * icons.js — Iconos SVG inline (stroke-based, 24x24 viewBox).
 * Se usan como strings para inyectar vía innerHTML en los componentes.
 */

const strokeProps = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';

export const Icons = {
  library: `<svg viewBox="0 0 24 24" ${strokeProps}><path d="M4 19.5V4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>`,
  recent: `<svg viewBox="0 0 24 24" ${strokeProps}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>`,
  favorite: `<svg viewBox="0 0 24 24" ${strokeProps}><path d="M12 20.5s-7.5-4.6-9.8-9.2C.6 7.7 2.4 4 6 4c2 0 3.5 1.2 4.5 2.6C11.5 5.2 13 4 15 4c3.6 0 5.4 3.7 3.8 7.3C19.5 15.9 12 20.5 12 20.5z"/></svg>`,
  category: `<svg viewBox="0 0 24 24" ${strokeProps}><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></svg>`,
  collection: `<svg viewBox="0 0 24 24" ${strokeProps}><path d="M4 6h13M4 6a2 2 0 0 1 2-2h13v14"/><path d="M4 6v13a2 2 0 0 0 2 2h13"/></svg>`,
  stats: `<svg viewBox="0 0 24 24" ${strokeProps}><path d="M4 20V10M12 20V4M20 20v-7"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" ${strokeProps}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`,
  info: `<svg viewBox="0 0 24 24" ${strokeProps}><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></svg>`,
  search: `<svg viewBox="0 0 24 24" ${strokeProps}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>`,
  grid: `<svg viewBox="0 0 24 24" ${strokeProps}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
  list: `<svg viewBox="0 0 24 24" ${strokeProps}><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" ${strokeProps}><path d="M12 5v14M5 12h14"/></svg>`,
  chevronLeft: `<svg viewBox="0 0 24 24" ${strokeProps}><path d="m15 18-6-6 6-6"/></svg>`,
  star: `<svg viewBox="0 0 24 24" ${strokeProps}><path d="m12 2 3.1 6.6 7.2.9-5.4 5 1.4 7.2L12 18.3 5.7 21.7l1.4-7.2-5.4-5 7.2-.9z"/></svg>`,
  close: `<svg viewBox="0 0 24 24" ${strokeProps}><path d="M18 6 6 18M6 6l12 12"/></svg>`,
  book: `<svg viewBox="0 0 24 24" ${strokeProps}><path d="M4 19.5V4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>`,
  upload: `<svg viewBox="0 0 24 24" ${strokeProps}><path d="M12 16V4M6 10l6-6 6 6"/><path d="M4 20h16"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" ${strokeProps}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>`,
  flame: `<svg viewBox="0 0 24 24" ${strokeProps}><path d="M12 2s-6 5.5-6 11a6 6 0 0 0 12 0c0-2-1-3.5-2-4.5 0 2-1 3-2 3 .5-3-1.5-5-2-6.5-.5 1.5-2.5 2-2.5 4.5"/></svg>`,
  check: `<svg viewBox="0 0 24 24" ${strokeProps}><path d="m5 12 5 5L20 7"/></svg>`,
  alert: `<svg viewBox="0 0 24 24" ${strokeProps}><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.5 17a1.8 1.8 0 0 0 1.6 2.7h15.8a1.8 1.8 0 0 0 1.6-2.7L13.7 3.9a1.8 1.8 0 0 0-3.4 0Z"/></svg>`,
  chevronRight: `<svg viewBox="0 0 24 24" ${strokeProps}><path d="m9 18 6-6-6-6"/></svg>`,
  zoomIn: `<svg viewBox="0 0 24 24" ${strokeProps}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/></svg>`,
  zoomOut: `<svg viewBox="0 0 24 24" ${strokeProps}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M8 11h6"/></svg>`,
  rotate: `<svg viewBox="0 0 24 24" ${strokeProps}><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>`,
  fullscreen: `<svg viewBox="0 0 24 24" ${strokeProps}><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>`,
  layout: `<svg viewBox="0 0 24 24" ${strokeProps}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>`,
  bookmarkAdd: `<svg viewBox="0 0 24 24" ${strokeProps}><path d="M6 3.5h12v17l-6-4-6 4z"/></svg>`,
  panel: `<svg viewBox="0 0 24 24" ${strokeProps}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" ${strokeProps}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
  github: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.73.5.5 5.73.5 12c0 5.09 3.29 9.4 7.86 10.93.57.1.78-.25.78-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.34-1.28-1.69-1.28-1.69-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.07.78 2.15 0 1.55-.01 2.8-.01 3.18 0 .3.2.66.79.55A10.53 10.53 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" ${strokeProps}><rect x="2.5" y="4.5" width="19" height="15" rx="2"/><path d="m3 6.5 9 6.5 9-6.5"/></svg>`,
  spread: `<svg viewBox="0 0 24 24" ${strokeProps}><rect x="2" y="4" width="9" height="16" rx="1.5"/><rect x="13" y="4" width="9" height="16" rx="1.5"/></svg>`,
};

export function icon(name, extraClass = '') {
  const svg = Icons[name] || '';
  if (!extraClass) return svg;
  return svg.replace('<svg ', `<svg class="${extraClass}" `);
}

window.Icons = Icons;
export default Icons;
