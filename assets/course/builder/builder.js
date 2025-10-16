/* =========================================================
   BUILDER — Stripped shell (no edit/save control)
   - Only: window/shell, hamburger drawer, close button
   - Page-open safety wrapper retained
   - Dev Dock controls edit/save externally (dev on/off)
   ========================================================= */

/* ---------------------------- helpers ---------------------------- */
function getHeroLabel(heroId) {
  try {
    const S = window.AppHome?.getSettings?.();
    return (S?.heroLabels?.[heroId]) || heroId;
  } catch { return String(heroId || 'Course'); }
}

/* -------- lazy-load hamburger module (ESM only; safe fallbacks) --- */
async function ensureHamburgerLoaded() {
  if (window.__builderHamburgerLoaded) return true;
  if (window.__builderHamburgerLoading) {
    try { await window.__builderHamburgerLoading; } catch {}
    return !!window.__builderHamburgerLoaded;
  }
  const ABS = '/assets/course/builder/hamburger.js';

  window.__builderHamburgerLoading = (async () => {
    // 1) dynamic import
    try {
      await import(/* @vite-ignore */ ABS);
      if (window.BuilderHamburger?.populate) { window.__builderHamburgerLoaded = true; return; }
    } catch {}
    // 2) module script tag
    try {
      await new Promise((res, rej) => {
        if ([...document.scripts].some(s => s.type === 'module' && (s.src || '').endsWith(ABS))) return res();
        const s = document.createElement('script');
        s.type = 'module'; s.src = ABS; s.async = true;
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
      if (window.BuilderHamburger?.populate) { window.__builderHamburgerLoaded = true; return; }
    } catch {}
  })();

  try { await window.__builderHamburgerLoading; } catch {}
  return !!window.__builderHamburgerLoaded;
}

function populateHamburgerMenu(menuEl, heroId) {
  try {
    const api = window.BuilderHamburger || {};
    if (typeof api.populate === 'function') { api.populate(menuEl, heroId); return true; }
  } catch {}
  return false;
}

/* ----------------- page-open safety (stores last payload) ----------------- */
function wireOpenHook() {
  if (!window.BuilderPages || window.BuilderPages.__builderWrappedOpen) return;

  const originalOpen = window.BuilderPages.open?.bind(window.BuilderPages);
  if (typeof originalOpen !== 'function') return;

  window.BuilderPages.open = function wrappedOpen(arg1, arg2) {
    // Normalize to payload object
    let payload;
    if (typeof arg1 === 'string') {
      payload = { key: arg1, heroId: arg2 };
    } else if (arg1 && typeof arg1 === 'object') {
      payload = { ...arg1 };
    } else {
      payload = { key: 'preview' };
    }

    // Remember for external consumers (e.g., Dev Dock)
    window.__builder_last_open = payload;

    // Non-fatal broadcast
    try {
      window.dispatchEvent(new CustomEvent('builder:page-opened', { detail: payload }));
    } catch {}

    return originalOpen(arg1, arg2);
  };

  window.BuilderPages.__builderWrappedOpen = true;
}

function getLastOpenFallback(heroId) {
  const p = window.__builder_last_open || {};
  return {
    key: p.key || 'preview',
    heroId: p.heroId || heroId,
    instanceId: p.instanceId,
    label: p.label
  };
}

/* Simple safe opener (does NOT alter edit/save) */
function safeOpen(pageOrKey, heroId, instanceId, label) {
  if (!window.BuilderPages?.open) return;
  try {
    if (typeof pageOrKey === 'object' && pageOrKey) {
      window.BuilderPages.open(pageOrKey);
    } else {
      const key = pageOrKey || 'preview';
      window.BuilderPages.open({ key, heroId, instanceId, label });
    }
  } catch (e) {
    console.warn('safeOpen fallback → preview', e);
    try { window.BuilderPages.open({ key: 'preview', heroId }); } catch {}
  }
}

/* ============================= OPEN ============================= */
export function openCourseBuilder(heroId) {
  // Build shell once
  let root = document.getElementById('builderRoot');
  if (!root) {
    root = document.createElement('div');
    root.id = 'builderRoot';
    root.innerHTML = `
      <div class="builder-shell">
        <header class="builder-head">
          <button class="builder-hamburger" title="Menu" aria-label="Menu">☰</button>
          <div class="builder-title"></div>
          <div class="builder-actions">
            <!-- No Edit/Save/Cancel here by design -->
            <button class="builder-close" id="builderClose" aria-label="Close">×</button>
          </div>
        </header>

        <main class="builder-body">
          <div class="builder-placeholder"><p></p></div>
        </main>

        <nav class="builder-menu" id="builderMenu" aria-hidden="true">
          <div class="menu-head"></div>
          <div class="menu-body"></div>
        </nav>
      </div>
    `;
    document.body.appendChild(root);
  }

  // Minimal, scroll-safe shell
  const shellEl = root.querySelector('.builder-shell');
  const bodyEl  = root.querySelector('.builder-body');
  if (shellEl) Object.assign(shellEl.style, { minHeight:'0', display:'flex', flexDirection:'column' });
  if (bodyEl) Object.assign(bodyEl.style, {
    minHeight:'0', overflowY:'auto', WebkitOverflowScrolling:'touch',
    overscrollBehavior:'contain', display:'block',
    paddingTop:'56px', paddingBottom:'120px', background:'#000',
    touchAction:'auto'
  });

  // Refs
  const headerTitle = root.querySelector('.builder-title');
  const bodyP       = root.querySelector('.builder-placeholder p');
  const closeBtn    = root.querySelector('#builderClose');
  const burger      = root.querySelector('.builder-hamburger');
  const menu        = root.querySelector('#builderMenu');
  const menuBody    = root.querySelector('.menu-body');
  const menuHead    = root.querySelector('.menu-head');

  headerTitle.textContent = `Builder — ${getHeroLabel(heroId)}`;
  bodyP.textContent       = `Course Builder for ${getHeroLabel(heroId)}`;

  // Close: remove shell; app paints underneath
  closeBtn.onclick = () => {
    try { window.BuilderPages?.close?.(); } catch {}
    root.remove();
    try { window.AppHome?.paint?.(); } catch {}
  };

  /* ------------------------- Drawer ------------------------- */
  function hideMenu(){
    menu.classList.remove('show');
    menu.setAttribute('aria-hidden','true');
    document.removeEventListener('pointerdown', outsideHandler);
    document.removeEventListener('keydown', escHandler);
  }
  let outsideHandler = ()=>{};
  let escHandler = ()=>{};

  function showMenu(){
    menuHead.textContent = '';
    menuBody.innerHTML = '';
    menu.classList.add('show');
    menu.setAttribute('aria-hidden','false');

    ensureHamburgerLoaded().then(ok=>{
      if (!ok || !populateHamburgerMenu(menu, heroId)) {
        // Drawer silently hides if hamburger couldn't populate
        hideMenu();
      }
    });

    outsideHandler = (e) => {
      const clickedInside = menu.contains(e.target) || burger.contains(e.target);
      if (!clickedInside) hideMenu();
    };
    escHandler = (e) => { if (e.key === 'Escape') hideMenu(); };

    document.addEventListener('pointerdown', outsideHandler, { passive:true });
    document.addEventListener('keydown', escHandler);
  }

  burger.onclick = () => {
    if (menu.classList.contains('show')) hideMenu();
    else showMenu();
  };

  // Page-open wrapper stays intact
  wireOpenHook();

  // Re-open last page (or preview) on launch — Dev Dock decides edit/save elsewhere
  const last = getLastOpenFallback(heroId);
  safeOpen(last, last.heroId, last.instanceId, last.label);
}

/* Expose global for non-module callers (defensive) */
window.CourseBuilder = window.CourseBuilder || {};
window.CourseBuilder.open = openCourseBuilder;

export default { openCourseBuilder }; 