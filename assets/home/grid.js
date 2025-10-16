/* =========================================================
   /assets/home/grid.js
   Grid container + sections + stable layout index helpers
   - Ensures #pageGrid
   - Creates sections (optional divider) and rows
   - Adds hero cards to rows
   - paintGrid(pageOrder, { renderDivider, renderHero, includeHero })
   - buildLayoutIndex(pageOrder) -> { hero, divider, sections }
   - computeAndPersistLayout(S) mutates S.layout and returns it
   - getHeroLoc(S, id) / getDividerLoc(S, id) / getSectionMeta(S, id)
   ========================================================= */

export const GridConfig = {
  defaultRowSize: 'm',           // xs | s | m | l | xl
  sectionClass:   'section',
  rowBaseClass:   'grid',
  sizeClass:      (sz) => `size-${sz || GridConfig.defaultRowSize}`,
};

/* ---------- Root / rows ---------- */
export function ensureGridRoot() {
  let root = document.querySelector('#pageGrid');
  if (!root) {
    root = document.createElement('div');
    root.id = 'pageGrid';
    document.body.appendChild(root);
  }
  return root;
}

export function clearGrid(root = ensureGridRoot()) {
  root.innerHTML = '';
}

export function startSection({ rowSize, dividerEl } = {}, root = ensureGridRoot()) {
  const sec = document.createElement('section');
  sec.className = GridConfig.sectionClass;

  if (dividerEl) sec.appendChild(dividerEl);

  const row = document.createElement('div');
  row.className = `${GridConfig.rowBaseClass} ${GridConfig.sizeClass(rowSize)}`;
  sec.appendChild(row);

  root.appendChild(sec);
  return { sectionEl: sec, rowEl: row };
}

export function addCardToRow(rowEl, cardEl) {
  if (rowEl && cardEl) rowEl.appendChild(cardEl);
}

/* ---------- Paint from pageOrder ---------- */
export function paintGrid(pageOrder = [], opts = {}) {
  const {
    renderDivider = () => null,
    renderHero    = () => null,
    includeHero   = () => true,
    root          = ensureGridRoot(),
  } = opts;

  clearGrid(root);
  let currentRow = null;

  for (const it of pageOrder) {
    if (!it || !it.type) continue;

    if (it.type === 'divider') {
      const dividerEl = renderDivider(it) || null;
      const { rowEl } = startSection({ rowSize: it.rowSize, dividerEl }, root);
      currentRow = rowEl;
      continue;
    }

    if (it.type === 'hero') {
      if (!includeHero(it.id)) continue;
      if (!currentRow) {
        // first items may be heroes — start anonymous section
        const { rowEl } = startSection({ rowSize: GridConfig.defaultRowSize }, root);
        currentRow = rowEl;
      }
      const card = renderHero(it.id);
      if (card) addCardToRow(currentRow, card);
    }
  }

  // prune empty sections
  root.querySelectorAll('.section').forEach(sec => {
    const hasDivider = !!sec.querySelector('.divider');
    const row = sec.querySelector(`.${GridConfig.rowBaseClass}`);
    const hasHeroes = !!row && row.children.length > 0;
    if (!hasDivider && !hasHeroes) sec.remove();
  });
}

/* =========================================================
   Stable layout index
   Produces:
     {
       hero:    { [heroId]: { sectionId, sectionIndex, indexInSection, globalIndex } },
       divider: { [divId]:  { sectionIndex, globalIndex } },
       sections:[ { id, title, rowSize, sectionIndex } ]
     }
   All indices are 1-based. Headless heroes use sectionIndex=0.
   ========================================================= */
export function buildLayoutIndex(pageOrder = []) {
  const hero = {};
  const divider = {};
  const sections = [];

  let sectionIndex = 0;     // 1..N
  let indexInSection = 0;   // 1..M per section/headless run
  let globalIndex = 0;      // 1..K across page
  let currentSectionId = null;
  let currentRowSize = 'm';
  let currentTitle = '';

  for (const it of pageOrder) {
    if (!it || !it.type) continue;
    globalIndex += 1;

    if (it.type === 'divider') {
      sectionIndex += 1;
      indexInSection = 0;
      currentSectionId = it.id;
      currentRowSize = it.rowSize || 'm';
      currentTitle = it.title || 'Heading';

      divider[it.id] = { sectionIndex, globalIndex };
      sections.push({ id: it.id, title: currentTitle, rowSize: currentRowSize, sectionIndex });
      continue;
    }

    if (it.type === 'hero') {
      indexInSection += 1;
      hero[it.id] = {
        sectionId: currentSectionId,
        sectionIndex: sectionIndex || 0, // 0 when headless
        indexInSection,
        globalIndex,
      };
    }
  }

  return { hero, divider, sections };
}

/* Persist layout to settings object (mutates S) */
export function computeAndPersistLayout(S) {
  S.layout = buildLayoutIndex(S.pageOrder || []);
  return S.layout;
}

/* Convenience getters (pass full settings object S) */
export function getHeroLoc(S, heroId) {
  return S?.layout?.hero?.[heroId] || null;
}
export function getDividerLoc(S, divId) {
  return S?.layout?.divider?.[divId] || null;
}
export function getSectionMeta(S, sectionId) {
  return (S?.layout?.sections || []).find(s => s.id === sectionId) || null;
} 