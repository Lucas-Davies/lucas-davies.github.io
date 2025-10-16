/* /assets/media/icons/icons.js
   ES module of SVG icons + chip builders that match your existing CSS.
   All icons use currentColor so parent styles control color.
*/

/* ============ Core SVG helper ============ */
function _svg(paths, { size = 20, stroke = 'currentColor', strokeWidth = 2, fill = 'none', vb = '0 24 24 24' } = {}) {
  // vb accepts either '0 0 24 24' or '0 24 24 24' (both okay); normalize if needed:
  const viewBox = vb.includes('0 0') ? vb : '0 0 24 24';
  const pathHTML = Array.isArray(paths) ? paths.join('') : paths;
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"
         viewBox="${viewBox}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      ${pathHTML}
    </svg>`;
}

/* ============ Individual icons ============ */
export const Icons = {
  close:   (opts) => _svg(`<path d="M18 6L6 18M6 6l12 12"/>`, opts),
  edit:    (opts) => _svg(`<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z"/>`, opts),
  save:    (opts) => _svg(`<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21V13H7v8"/><path d="M7 3v5h8"/>`, opts),
  check:   (opts) => _svg(`<path d="M20 6L9 17l-5-5"/>`, opts),
  plus:    (opts) => _svg(`<path d="M12 5v14M5 12h14"/>`, opts),
  minus:   (opts) => _svg(`<path d="M5 12h14"/>`, opts),
  trash:   (opts) => _svg(`<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>`, opts),
  info:    (opts) => _svg(`<circle cx="12" cy="12" r="9"/><path d="M12 8h.01"/><path d="M11 12h2v6h-2z"/>`, opts),
  warn:    (opts) => _svg(`<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>`, opts),

  up:      (opts) => _svg(`<path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>`, opts),
  down:    (opts) => _svg(`<path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/>`, opts),
  left:    (opts) => _svg(`<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>`, opts),
  right:   (opts) => _svg(`<path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>`, opts),

  // UI chrome
  hamburger: (opts) => _svg(`<path d="M3 6h18M3 12h18M3 18h18"/>`, opts),
  kebab:     (opts) => _svg(`<circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>`, { ...opts, fill: 'currentColor', stroke: 'none' }),

  // Audience medals (for inline with chips)
  medalBronze:   (opts) => _svg(`<circle cx="12" cy="13" r="6" /> <path d="M9 4l3 3 3-3"/>`, { ...opts, stroke: 'currentColor', fill: 'none' }),
  medalSilver:   (opts) => _svg(`<circle cx="12" cy="13" r="6" /> <path d="M8 5l4 4 4-4"/>`, { ...opts }),
  medalGold:     (opts) => _svg(`<circle cx="12" cy="13" r="6" /> <path d="M12 7l2 2 3-.5-1.5 2.6L17 13l-3 .6L12 16l-2-2.4L7 13l2.5-1.9L8 8.5l3 .5 1-2"/>`, { ...opts })
};

/* ============ Chip builders (match your CSS) ============ */
/* Audience chips use .audChip + (bronze|silver|gold|blue) from styles.css */
export function audienceChip(level = 'beginner', label) {
  const map = {
    beginner:     { cls: 'bronze', icon: Icons.medalBronze,  text: 'Beginner' },
    intermediate: { cls: 'silver', icon: Icons.medalSilver,  text: 'Intermediate' },
    advanced:     { cls: 'gold',   icon: Icons.medalGold,    text: 'Advanced' },
    custom:       { cls: 'blue',   icon: () => '',           text: 'Custom' }
  };
  const { cls, icon, text } = map[level] || map.beginner;
  const svg = icon === null ? '' : icon({ size: 14, strokeWidth: 2 });
  return `<span class="audChip ${cls}">${svg ? svg + ' ' : ''}${label || text}</span>`;
}

/* Schedule chip uses .sched-chip + (green|blue|red), same shape as your cards */
export function scheduleChip(kind = 'live', text = '') {
  const meta = {
    live:    { cls: 'green',  label: 'Live' },
    preview: { cls: 'blue',   label: 'Preview' },
    off:     { cls: 'red',    label: 'Offline' },
    dev:     { cls: '',       label: 'Dev' }
  }[kind] || { cls: '', label: '—' };

  const content = text ? `${meta.label}: ${text}` : meta.label;
  return `<span class="sched-chip ${meta.cls}">${content}</span>`;
}

/* ============ Button / pill builders ============ */
export function pillIcon(label, iconHTML, { className = 'pillBtn', ariaLabel } = {}) {
  const a = ariaLabel ? ` aria-label="${ariaLabel}"` : '';
  return `<button class="${className}"${a}>${iconHTML ? iconHTML + ' ' : ''}${label || ''}</button>`;
}

/* ============ DOM helpers to swap in icons ============ */
export function setIcon(el, iconName, opts) {
  if (!el || !Icons[iconName]) return;
  el.innerHTML = Icons[iconName](opts);
}

export function replaceTextWithIcon(selector, iconName, opts) {
  document.querySelectorAll(selector).forEach(el => setIcon(el, iconName, opts));
}

/* ============ Quick presets for your common controls ============ */
/* These are convenience helpers so you can keep your existing structure
   from main.js and styles.css while rendering nicer icons.
*/
export function applyCommonIcons() {
  // Kebab buttons on heroes/dividers (your markup already uses .kebab)  [oai_citation:2‡main.js](sediment://file_00000000f81061fa875472e4336e7534)
  document.querySelectorAll('button.kebab').forEach(btn => setIcon(btn, 'kebab', { size: 16 }));

  // Config arrows used for reordering (your CSS styles .cfg-arrow)  [oai_citation:3‡styles.css](sediment://file_00000000eedc61fa984eb3930cbcee02)
  document.querySelectorAll('button.cfg-arrow[data-sort="up"], button.cfg-arrow[data-div-act="up"]')
    .forEach(btn => setIcon(btn, 'up', { size: 16 }));
  document.querySelectorAll('button.cfg-arrow[data-sort="down"], button.cfg-arrow[data-div-act="down"]')
    .forEach(btn => setIcon(btn, 'down', { size: 16 }));

  // Modal close button .modalX uses a red background; swap to an X icon for clarity  [oai_citation:4‡styles.css](sediment://file_00000000eedc61fa984eb3930cbcee02)
  const x = document.querySelector('.modalX');
  if (x) setIcon(x, 'close', { size: 16, strokeWidth: 2.2 });
}

/* ============ Tiny factory for audience chips inline in Overview ============ */
export function audienceChipsHTML(aud = { beginner:false, intermediate:false, advanced:false, custom:false }) {
  const parts = [];
  if (aud.beginner)     parts.push(audienceChip('beginner'));
  if (aud.intermediate) parts.push(audienceChip('intermediate'));
  if (aud.advanced)     parts.push(audienceChip('advanced'));
  if (aud.custom)       parts.push(audienceChip('custom'));
  return parts.join(' ');
}

/* ============ Optional: simple toolbar template ============ */
export function iconToolbar({ showSave = true, showEdit = true } = {}) {
  const saveBtn = showSave ? pillIcon('Save', Icons.save({ size: 16, strokeWidth: 2 }), { className: 'pillBtn', ariaLabel: 'Save' }) : '';
  const editBtn = showEdit ? pillIcon('Edit', Icons.edit({ size: 16, strokeWidth: 2 }), { className: 'pillBtn', ariaLabel: 'Edit' }) : '';
  return `<div class="iconToolbar" style="display:flex;gap:8px">${saveBtn}${editBtn}</div>`;
}