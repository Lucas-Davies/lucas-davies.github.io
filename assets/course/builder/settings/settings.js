// /assets/course/builder/settings/settings.js
// Centered modal with a 4-column grid of 12 selectable placeholder tiles.

/* ----------------- DOM helpers ----------------- */
function ensureOnce() {
  let root = document.getElementById('builderSettings');
  if (root) return root;

  root = document.createElement('div');
  root.id = 'builderSettings';
  root.className = 'settings-overlay';
  root.innerHTML = `
    <div class="settings-card" role="dialog" aria-modal="true" aria-labelledby="settingsTitle">
      <header class="settings-head">
        <h2 id="settingsTitle" class="settings-title">Settings</h2>
        <button class="settings-x" aria-label="Close">×</button>
      </header>

      <div class="settings-grid" aria-label="Settings options"></div>

      <footer class="settings-foot">
        <button class="settings-btn settings-cancel" type="button">Cancel</button>
        <button class="settings-btn settings-save"   type="button">Save</button>
      </footer>
    </div>
  `;
  document.body.appendChild(root);
  return root;
}

function buildTiles(gridEl) {
  gridEl.innerHTML = '';
  // 12 placeholders, 4 columns (3 rows)
  for (let i = 1; i <= 12; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'settings-tile';
    btn.dataset.id = `placeholder-${i}`;
    btn.innerHTML = `
      <span class="tile-title">Placeholder ${i}</span>
      <span class="tile-check" aria-hidden="true">✓</span>
    `;
    btn.addEventListener('click', () => {
      btn.classList.toggle('selected');
      btn.setAttribute('aria-pressed', btn.classList.contains('selected') ? 'true' : 'false');
    });
    gridEl.appendChild(btn);
  }
}

function wireInteractions(root, heroId) {
  const card     = root.querySelector('.settings-card');
  const closeX   = root.querySelector('.settings-x');
  const btnCancel= root.querySelector('.settings-cancel');
  const btnSave  = root.querySelector('.settings-save');

  const close = () => { root.classList.remove('show'); setTimeout(() => root.remove(), 150); };

  // outside click
  root.addEventListener('pointerdown', (e) => { if (e.target === root) close(); });
  // close button
  closeX.addEventListener('click', close);
  // Esc key
  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
  document.addEventListener('keydown', onKey);

  btnCancel.addEventListener('click', close);

  btnSave.addEventListener('click', () => {
    const selected = Array.from(root.querySelectorAll('.settings-tile.selected'))
      .map(el => el.dataset.id);
    window.dispatchEvent(new CustomEvent('builder:settings-saved', {
      detail: { heroId, selected }
    }));
    close();
  });

  // Focus trap (simple)
  const focusables = () => Array.from(card.querySelectorAll('button,[tabindex]:not([tabindex="-1"])'));
  card.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = focusables();
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // Initial focus
  setTimeout(() => { (card.querySelector('.settings-tile') || closeX).focus(); }, 0);

  // Cleanup
  const obs = new MutationObserver(() => {
    if (!document.body.contains(root)) {
      document.removeEventListener('keydown', onKey);
      obs.disconnect();
    }
  });
  obs.observe(document.body, { childList: true });
}

/* ----------------- Public API ----------------- */
/**
 * Open the Settings modal (centered). Grid is 4 columns × 3 rows (12 tiles).
 * @param {string} heroId Current course hero id for event payloads.
 */
export function openSettingsPanel(heroId) {
  const root = ensureOnce();
  const grid = root.querySelector('.settings-grid');
  buildTiles(grid);
  wireInteractions(root, heroId);
  requestAnimationFrame(() => root.classList.add('show'));
}

/* Back-compat: also export `open` as an alias */
export const open = (containerOrHeroId, maybeHeroId) => {
  // Support old signature open(_container, heroId)
  const heroId = (typeof maybeHeroId !== 'undefined') ? maybeHeroId : containerOrHeroId;
  openSettingsPanel(heroId);
};

export default { openSettingsPanel, open }; 