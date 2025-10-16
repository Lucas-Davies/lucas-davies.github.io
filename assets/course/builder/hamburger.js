/* =========================================================
   Builder Hamburger — Course Pages (Preview mandatory)
   + Robust title sync from pages (set by instance OR key)
   + Settings button restored
   + ✅ Public API to enable/disable "payment"
   + ✅ Listens to `course:pricing-updated` to keep payment in sync
   + ✅ Highlights current page in drawer (indent + iOS blue)
   ========================================================= */

const getS = () => window.AppHome?.getSettings?.() || {};
const setS = (s) => { try { window.AppHome?.setSettings?.(s); } catch {} };

const CORE_PREFIX = ['preview', 'payment', 'introduction'];
const CORE_SUFFIX = ['conclusion', 'achievement', 'feedback'];
const STATIC_TITLES = {
  preview: 'Preview',
  payment: 'Payment',
  introduction: 'Introduction',
  conclusion: 'Conclusion',
  achievement: 'Achievement',
  feedback: 'Feedback'
};

const isActivityKey = (k) => String(k).startsWith('activity-');
const baseModuleKey = (key) => (isActivityKey(key) ? 'activity' : key);
const defaultLabel = (key) =>
  isActivityKey(key) ? `Activity ${key.split('-')[1] || ''}` : (STATIC_TITLES[key] || key);
const getLabel = (model, key) =>
  (isActivityKey(key) && model.names?.[key]) ? model.names[key] : defaultLabel(key);

/* -------------------- Current page state (for highlight) -------------------- */
const _CURRENT = Object.create(null); // { [heroId]: { moduleKey:'preview|activity|...', instanceId?:string } }

// Track current page for highlight (supports both key/pageKey)
window.addEventListener('builder:page-opened', (e) => {
  const d = e?.detail || {};
  if (!d.heroId) return;

  const k = d.pageKey ?? d.key ?? 'preview';
  _CURRENT[d.heroId] = {
    moduleKey: String(k).startsWith('activity') ? 'activity' : k,
    instanceId: d.instanceId || null
  };

  const menu = document.getElementById('builderMenu');
  if (menu?.classList.contains('show')) {
    try { menu.dispatchEvent(new Event('hamburger:active-changed')); } catch {}
  }
}); 

/* -------------------- IDs -------------------- */
function ensureIdMap(S, heroId){
  S.heroPageIds = S.heroPageIds || {};
  S.heroPageIds[heroId] = S.heroPageIds[heroId] || {};
  return S.heroPageIds[heroId];
}
function nextActivityInstanceId(idMap, heroId){
  let max = 0;
  for (const v of Object.values(idMap)){
    const m = String(v).match(/-A(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${heroId}-A${max + 1}`;
}

/* -------------------- Model helpers -------------------- */
function sanePages(S, heroId){
  S.heroPages = S.heroPages || {};
  const cur = S.heroPages[heroId] || {};
  const enabled    = { ...(cur.enabled || {}) };
  const activities = Array.isArray(cur.activities) && cur.activities.length
    ? [...cur.activities] : ['activity-1'];
  const names      = { ...(cur.names || {}) };

  const idMap = ensureIdMap(S, heroId);
  for (const key of activities){
    if (!idMap[key]) idMap[key] = nextActivityInstanceId(idMap, heroId);
  }

  for (const key of [...CORE_PREFIX, ...activities, ...CORE_SUFFIX]){
    if (typeof enabled[key] !== 'boolean') enabled[key] = true;
    if (isActivityKey(key) && !names[key]) names[key] = defaultLabel(key);
  }
  enabled.preview = true; // mandatory
  S.heroPages[heroId] = { enabled, activities, names };
  return S.heroPages[heroId];
}

function cloneModel(m){
  return { enabled: { ...m.enabled }, activities:[...m.activities], names:{...(m.names||{})} };
}
function fullOrder(m){ return [...CORE_PREFIX, ...m.activities, ...CORE_SUFFIX]; }
function cleanupEnabled(m){
  const all = new Set(fullOrder(m));
  Object.keys(m.enabled).forEach(k => { if (!all.has(k)) delete m.enabled[k]; });
  Object.keys(m.names || {}).forEach(k => { if (!all.has(k)) delete m.names[k]; });
  m.enabled.preview = true;
  return m;
}

/* -------------------- Toast -------------------- */
function showToast(msg){
  const t = document.createElement('div');
  Object.assign(t.style,{
    position:'fixed', left:'50%', bottom:'28px', transform:'translateX(-50%)',
    background:'rgba(15,17,22,.96)', color:'#eef3ff',
    border:'1px solid rgba(255,255,255,.18)', borderRadius:'10px',
    padding:'10px 14px', font:'600 14px system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif',
    zIndex:2147483647, boxShadow:'0 10px 30px rgba(0,0,0,.5)', opacity:'0',
    transition:'opacity .18s ease'
  });
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(()=>t.style.opacity='1');
  setTimeout(()=>{ t.style.opacity='0'; t.addEventListener('transitionend',()=>t.remove(),{once:true}); },1800);
}

/* -------------------- SETTINGS (lazy) -------------------- */
async function openSettingsPanel(heroId){
  const cssCandidates = [
    '/assets/course/builder/settings/settings.css',
    '/builder/settings/settings.css'
  ];
  const jsCandidates = [
    '/assets/course/builder/settings/settings.js',
    '/builder/settings/settings.js'
  ];

  const addCssOnce = (href) => new Promise((resolve) => {
    if ([...document.styleSheets].some(s => (s.ownerNode?.href || '').endsWith('/settings.css'))) {
      return resolve(true);
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve(true);
    link.onerror = () => resolve(false);
    document.head.appendChild(link);
  });

  for (const href of cssCandidates) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await addCssOnce(href);
    if (ok) break;
  }

  let mod = null;
  let lastErr = null;
  for (const src of jsCandidates) {
    try {
      // eslint-disable-next-line no-await-in-loop
      mod = await import(/* @vite-ignore */ src);
      if (mod) break;
    } catch (e) { lastErr = e; }
  }
  if (!mod) {
    console.error('settings import failed', lastErr);
    showToast('Could not load Settings module');
    return;
  }

  const fn =
    (typeof mod.openSettingsPanel === 'function' && mod.openSettingsPanel) ||
    (typeof mod.default === 'function' && mod.default) ||
    (mod.default && typeof mod.default.openSettingsPanel === 'function' && mod.default.openSettingsPanel);

  if (!fn) {
    console.error('settings module loaded but no openSettingsPanel export', mod);
    showToast('Settings module missing openSettingsPanel()');
    return;
  }

  try { fn(heroId); }
  catch (e) { console.error('settings open failed', e); showToast('Failed to open Settings'); }
}

/* -------------------- Page openers -------------------- */
function openPageFromHamburger(heroId, model, key){
  const modKey = baseModuleKey(key);
  const label  = getLabel(model, key);

  let instanceId = null;
  if (isActivityKey(key)){
    const S = getS();
    const idMap = ensureIdMap(S, heroId);
    if (!idMap[key]) idMap[key] = nextActivityInstanceId(idMap, heroId);
    setS(S);
    instanceId = idMap[key];
  }

  // Optimistic mark-as-current to update highlight instantly
  _CURRENT[heroId] = { moduleKey: modKey, instanceId: instanceId || null };
  try {
    const menu = document.getElementById('builderMenu');
    if (menu?.classList.contains('show')) menu.dispatchEvent(new Event('hamburger:active-changed'));
  } catch {}

  if (window.BuilderPages?.open){
    window.BuilderPages.open({ key: modKey, heroId, instanceId, label });
  } else {
    showToast('pages.js not available');
  }
}

/* -------------------- Title sync (unchanged; no rename UI) -------------------- */
function setLabelByKeyInternal(heroId, pageKey, label){
  if (!pageKey || !label) return false;
  const clean = String(label).trim();
  if (!clean) return false;
  const S = getS();
  const model = sanePages(S, heroId);
  model.names = model.names || {};
  model.names[pageKey] = clean;
  setS(S);
  return true;
}
function setLabelByInstanceInternal(heroId, instanceId, label){
  if (!instanceId) return false;
  const S = getS();
  const idMap = ensureIdMap(S, heroId);
  const entry = Object.entries(idMap).find(([, v]) => v === instanceId);
  if (!entry) return false;
  const [pageKey] = entry;
  const ok = setLabelByKeyInternal(heroId, pageKey, label);
  if (ok) {
    const S2 = getS();
    const model2 = sanePages(S2, heroId);
    model2.names[pageKey] = String(label).trim();
    setS(S2);
  }
  return ok;
}
function patchOpenDrawerRowTitle(heroId, instanceId, label){
  try {
    const menu = document.getElementById('builderMenu');
    if (!menu || !menu.classList.contains('show')) return;
    if (!instanceId) return;
    const row = menu.querySelector(
      `.hamburger-item[data-hero-id="${CSS.escape(heroId)}"][data-instance-id="${CSS.escape(instanceId)}"] .hamburger-title`
    );
    if (row) row.textContent = String(label || '').trim() || 'Activity Lesson';
  } catch {}
}

/* -------------------- Enable/Disable helpers (NEW) -------------------- */
function setEnabledByKeyInternal(heroId, pageKey, on){
  const S = getS();
  const model = sanePages(S, heroId);
  model.enabled[pageKey] = !!on;
  model.enabled.preview = true; // keep Preview mandatory
  // Clean & persist
  const cleaned = cleanupEnabled(model);
  S.heroPages[heroId] = cleaned;
  setS(S);
  // Let any open drawer refresh
  try {
    const menu = document.getElementById('builderMenu');
    if (menu?.classList.contains('show')) {
      menu.dispatchEvent(new Event('builder:labels-updated'));
    }
  } catch {}
  // Let other panels know pages changed (export, etc.)
  try { window.dispatchEvent(new CustomEvent('course:pages-saved', { detail:{ heroId } })); } catch {}
  return true;
}

/* -------------------- Public API -------------------- */
(function exposePublicAPI(){
  window.BuilderHamburger = Object.assign(window.BuilderHamburger || {}, {
    // navigation helper used by Preview
    openNextEnabledPage: (heroId) => {
      const S = getS();
      const model = sanePages(S, heroId);
      const next = model.activities?.find(k => model.enabled[k]);
      if (next) openPageFromHamburger(heroId, model, next);
    },

    // Title sync calls (left intact; no rename controls in UI)
    setLabelByInstance: (heroId, instanceId, label) => {
      const ok = setLabelByInstanceInternal(heroId, instanceId, label);
      patchOpenDrawerRowTitle(heroId, instanceId, label);
      const menu = document.getElementById('builderMenu');
      if (menu?.classList.contains('show')) menu.dispatchEvent(new Event('builder:labels-updated'));
      return ok;
    },
    setLabelByKey: (heroId, pageKey, label) => {
      const ok = setLabelByKeyInternal(heroId, pageKey, label);
      const menu = document.getElementById('builderMenu');
      if (menu?.classList.contains('show')) menu.dispatchEvent(new Event('builder:labels-updated'));
      return ok;
    },

    // ✅ NEW: generic toggle
    setEnabledByKey: (heroId, pageKey, on) => setEnabledByKeyInternal(heroId, pageKey, on),

    // ✅ NEW: convenience specifically for payment
    setPaymentEnabled: (heroId, on) => setEnabledByKeyInternal(heroId, 'payment', on)
  });

  // Optional: event-based label sync (unchanged)
  window.addEventListener('builder:page-title', (e)=>{
    const d = e?.detail || {};
    if (!d.heroId || !d.label) return;
    if (d.instanceId) setLabelByInstanceInternal(d.heroId, d.instanceId, d.label);
    else if (d.pageKey) setLabelByKeyInternal(d.heroId, d.pageKey, d.label);
    patchOpenDrawerRowTitle(d.heroId, d.instanceId, d.label);
    const menu = document.getElementById('builderMenu');
    if (menu?.classList.contains('show')) menu.dispatchEvent(new Event('builder:labels-updated'));
  });

  // ✅ NEW: keep "payment" enabled state in sync with pricing updates
  // detail: { heroId, showPrice, price }
  window.addEventListener('course:pricing-updated', (e)=>{
    const d = e?.detail || {};
    if (!d.heroId) return;
    const priceNum = Number((d.price || '').replace(/[^\d]/g,'') || 0);
    const isFree  = !d.showPrice || priceNum === 0;
    setEnabledByKeyInternal(d.heroId, 'payment', !isFree);
  });
})();

/* -------------------- UI rendering -------------------- */
function renderHeader(menuEl, editMode, onAdd){
  let head = menuEl.querySelector('.menu-head');
  if (!head){
    head = document.createElement('div');
    head.className = 'menu-head';
    menuEl.prepend(head);
  }
  const blue='var(--hb-blue,#0A84FF)';
  head.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <span style="font-weight:800;">Course Pages</span>
      ${editMode ? `
        <button id="hambAddActivity"
          style="height:28px;padding:0 10px;border-radius:8px;border:1px solid rgba(255,255,255,.18);
          background:${blue};color:#fff;font-weight:700;cursor:pointer;">+ Activity</button>
      ` : ''}
    </div>`;
  if (editMode){
    const addBtn = head.querySelector('#hambAddActivity');
    if (addBtn) addBtn.onclick = onAdd;
  }
}

/* ---------- Active-row styling + highlight helpers ---------- */

/**
 * Marks a row as active or inactive.
 * The CSS now handles all visual styling via [data-active="1"].
 */
function applyRowStyles(rowEl, active) {
  if (!rowEl) return;
  rowEl.dataset.active = active ? '1' : '0';
}

/**
 * Recomputes which row is active based on the current open page.
 * Relies on the global _CURRENT[heroId] state updated when pages open.
 */
function markActiveRows(menuEl, heroId) {
  const cur = _CURRENT[heroId] || {};
  const rows = menuEl.querySelectorAll('.hamburger-item');

  rows.forEach(row => {
    const pageKey = row.dataset.pageKey || '';
    const instanceId = row.dataset.instanceId || '';

    // Determine if this row corresponds to the open page
    const active = instanceId
      ? (cur.moduleKey === 'activity' && cur.instanceId === instanceId)
      : (cur.moduleKey === pageKey);

    applyRowStyles(row, active);
  });
} 

/* ---------- RENDER LIST (complete + active highlight) ---------- */
function renderList(menuEl, editMode, model, mutate, heroId) {
  let body = menuEl.querySelector('.menu-body');
  if (!body) {
    body = document.createElement('div');
    body.className = 'menu-body';
    menuEl.appendChild(body);
  }
  body.innerHTML = '';

  const S = getS();
  const idMap = ensureIdMap(S, heroId);

  // Safety: ensure sane model
  if (!model || !model.enabled || !Array.isArray(model.activities)) {
    console.warn('[hamburger] invalid model; rebuilding');
    const S2 = getS();
    model = sanePages(S2, heroId);
    setS(S2);
  }

  const orderedKeys = fullOrder(model).filter(k => editMode || model.enabled[k]);
  if (orderedKeys.length === 0) {
    const empty = document.createElement('div');
    empty.textContent = 'No pages enabled.';
    Object.assign(empty.style, { opacity: .7, padding: '10px 6px' });
    body.appendChild(empty);
    return;
  }

  for (const key of orderedKeys) {
    const row = document.createElement('div');
    row.className = 'hamburger-item';
    row.dataset.heroId = heroId;

    if (isActivityKey(key)) {
      if (!idMap[key]) {
        idMap[key] = nextActivityInstanceId(idMap, heroId);
        setS(S);
      }
      row.dataset.instanceId = idMap[key];
    } else {
      row.dataset.pageKey = key;
    }

    Object.assign(row.style, {
      display: 'grid',
      gridTemplateColumns: (editMode ? '24px 1fr auto' : '1fr auto'),
      gap: '8px',
      alignItems: 'center',
      padding: '6px 0',
      borderBottom: '1px solid rgba(255,255,255,.08)'
    });

    /* --- Left column: checkbox (edit mode only) --- */
    if (editMode) {
      if (key === 'preview') {
        const sp = document.createElement('div');
        sp.style.width = '24px';
        row.appendChild(sp);
      } else {
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.checked = !!model.enabled[key];

        if (key === 'payment') {
          chk.disabled = true;
          chk.title = 'Managed by Preview pricing (auto on/off)';
          chk.onchange = () => { chk.checked = !!model.enabled[key]; };
          row.style.opacity = model.enabled[key] ? '1' : '.6';
        } else {
          chk.onchange = () => mutate(m => { m.enabled[key] = chk.checked; });
        }
        row.appendChild(chk);
      }
    }

    /* --- Middle: label button (always opens the page) --- */
    const btn = document.createElement('button');
    btn.className = 'hamburger-open';
    Object.assign(btn.style, {
      textAlign: 'left',
      background: 'transparent',
      color: '#eef3ff',
      border: 0,
      padding: '8px 6px',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: 700
    });

    const span = document.createElement('span');
    span.className = 'hamburger-title';
    span.textContent = getLabel(model, key);
    btn.appendChild(span);

    btn.onclick = () => openPageFromHamburger(heroId, model, key);

    /* --- Right column: per-item actions (activities only) --- */
    const right = document.createElement('div');
    Object.assign(right.style, { display: 'flex', alignItems: 'center', gap: '6px' });

    if (editMode && isActivityKey(key)) {
      const del = document.createElement('button');
      const onlyOne = model.activities.length <= 1;
      del.textContent = '🗑';
      Object.assign(del.style, {
        width: '28px',
        height: '28px',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,.18)',
        background: '#111722',
        color: '#fff',
        cursor: onlyOne ? 'not-allowed' : 'pointer',
        opacity: onlyOne ? '.5' : '1'
      });
      if (!onlyOne) {
        del.onclick = () => {
          if (!confirm(`Delete "${getLabel(model, key)}"?`)) return;
          mutate(m => {
            m.activities = m.activities.filter(a => a !== key);
            delete m.enabled[key];
            delete (m.names || {})[key];
          });
        };
      }
      right.appendChild(del);
    } else {
      const sp = document.createElement('div');
      sp.style.width = '28px';
      right.appendChild(sp);
    }

    // assemble row
    row.appendChild(btn);
    row.appendChild(right);

    // grey out disabled items in edit view (except Preview)
    if (editMode && key !== 'preview') {
      row.style.opacity = model.enabled[key] ? '1' : '.45';
    }

    body.appendChild(row);
  }

  /* ---------- Active highlight logic ---------- */

  // Immediately mark active after render
  markActiveRows(menuEl, heroId);

  // Keep highlight in sync with router
  const onActiveChange = () => markActiveRows(menuEl, heroId);
  if (menuEl.__onActiveChange) {
    menuEl.removeEventListener('hamburger:active-changed', menuEl.__onActiveChange);
  }
  menuEl.__onActiveChange = onActiveChange;
  menuEl.addEventListener('hamburger:active-changed', onActiveChange);
} 

/* -------------------- bottom bar (ABSOLUTE, smaller, no overlap) -------------------- */
function renderBottomBar(menuEl, editMode, onEdit, onSave, onCancel, heroId){
  const old = menuEl.querySelector('[data-bottom-bar]');
  if (old) old.remove();

  const bodyEl = menuEl.querySelector('.menu-body');
  if (bodyEl) {
    bodyEl.style.flex = '1';
    bodyEl.style.overflow = 'auto';
  }

  const wrap = document.createElement('div');
  wrap.dataset.bottomBar = '1';
  Object.assign(wrap.style, {
    position: 'absolute',
    bottom: '0',
    left: '0',
    right: '0',
    padding: '10px 12px 12px',
    background: 'linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,.35) 20%, rgba(0,0,0,.65))',
    display: 'grid',
    gap: '8px',
    zIndex: '1'
  });

  const blue  = 'var(--hb-blue,#0A84FF)';
  const grey  = 'var(--hb-grey,#6e6e73)';
  const green = 'var(--hb-green,#32D74B)';

  const styleBtn = (btn, bg) => {
    Object.assign(btn.style, {
      width: '100%',
      padding: '9px 11px',
      borderRadius: '9px',
      border: '1px solid rgba(255,255,255,.18)',
      background: bg,
      color: '#fff',
      fontWeight: '700',
      fontSize: '13px',
      cursor: 'pointer'
    });
  };

  if (editMode){
    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    styleBtn(cancel, grey);
    cancel.onclick = onCancel;
    wrap.appendChild(cancel);
  }

  const edit = document.createElement('button');
  edit.textContent = editMode ? 'Save' : 'Edit Hamburger';
  styleBtn(edit, editMode ? green : grey);
  edit.onclick = editMode ? onSave : onEdit;
  wrap.appendChild(edit);

  const settings = document.createElement('button');
  settings.textContent = 'Settings';
  styleBtn(settings, blue);
  settings.onclick = () => openSettingsPanel(heroId);
  wrap.appendChild(settings);

  menuEl.appendChild(wrap);

  const applyPadding = () => {
    if (!bodyEl) return;
    const h = wrap.getBoundingClientRect().height || 0;
    bodyEl.style.paddingBottom = Math.ceil(h + 12) + 'px';
  };
  applyPadding();

  const ro = new ResizeObserver(applyPadding);
  ro.observe(wrap);
  if (menuEl.__footerRO) { try { menuEl.__footerRO.disconnect(); } catch {} }
  menuEl.__footerRO = ro;

  const onWinResize = () => applyPadding();
  window.addEventListener('resize', onWinResize, { passive: true });

  wrap.addEventListener('DOMNodeRemoved', () => {
    try { ro.disconnect(); } catch {}
    window.removeEventListener('resize', onWinResize);
  }, { once: true });
}

/* -------------------- populate(menuEl, heroId) -------------------- */
export function populate(menuEl, heroId){
  if (!menuEl) return;

  // Guard against transient errors so the drawer never looks empty
  try {
    const S0 = getS();
    let persisted = sanePages(S0, heroId); setS(S0);

    let editMode = !!menuEl.__editMode;
    let draft    = menuEl.__draft || cloneModel(persisted);

    const rerender = () => {
      try {
        renderHeader(menuEl, editMode, onAddActivity);
        renderList(menuEl, editMode, editMode ? draft : persisted, mutate, heroId);
        renderBottomBar(menuEl, editMode, enterEdit, saveExit, cancelExit, heroId);
        menuEl.__editMode = editMode;
        menuEl.__draft    = draft;
      } catch (err){
        console.error('[hamburger] render failed', err);
        const body = menuEl.querySelector('.menu-body') || menuEl.appendChild(Object.assign(document.createElement('div'),{className:'menu-body'}));
        body.innerHTML = '<div style="opacity:.7;padding:10px 6px;">Failed to render menu.</div>';
      }
    };

    const mutate = (fn) => { fn(draft); cleanupEnabled(draft); rerender(); };

    const onAddActivity = () => {
      const next = Math.max(1, ...draft.activities.map(a => +a.split('-')[1] || 1)) + 1;
      const key  = `activity-${next}`;
      draft.activities.push(key);
      draft.enabled[key] = true;
      draft.names[key]   = defaultLabel(key);
      rerender();
    };

    const enterEdit = () => {
      editMode = true;
      const Sf = getS(); persisted = sanePages(Sf, heroId); setS(Sf);
      draft = cloneModel(persisted);
      rerender();
    };

    const saveExit = () => {
      const Sw = getS();
      const cur = sanePages(Sw, heroId);
      cur.activities = [...draft.activities];
      cur.enabled    = { ...draft.enabled, preview: true };
      cur.names      = { ...(draft.names || {}) };
      cleanupEnabled(cur);

      // instanceId maintenance
      const idMap   = ensureIdMap(Sw, heroId);
      const keysNow = new Set(cur.activities);
      for (const k of cur.activities){
        if (!idMap[k]) idMap[k] = nextActivityInstanceId(idMap, heroId);
      }
      Object.keys(idMap).forEach(k => { if (!keysNow.has(k)) delete idMap[k]; });

      setS(Sw);

      try { window.dispatchEvent(new CustomEvent('course:pages-saved', { detail: { heroId } })); } catch {}

      const Sr = getS(); persisted = sanePages(Sr, heroId); setS(Sr);
      editMode = false;
      draft    = cloneModel(persisted);
      rerender();

      try { menuEl.dispatchEvent(new Event('builder:labels-updated')); } catch {}
    };

    const cancelExit = () => {
      editMode = false;
      const Scur = getS(); persisted = sanePages(Scur, heroId); setS(Scur);
      draft = cloneModel(persisted);
      rerender();
    };

    if (!menuEl.__closeObserver){
      const obs = new MutationObserver(()=>{
        const hidden = menuEl.getAttribute('aria-hidden') === 'true' || !menuEl.classList.contains('show');
        if (hidden){ menuEl.__editMode = false; menuEl.__draft = null; }
      });
      obs.observe(menuEl, { attributes:true, attributeFilter:['class','aria-hidden'] });
      menuEl.__closeObserver = obs;
    }

    menuEl.addEventListener('builder:labels-updated', rerender);

    rerender();
  } catch (err) {
    console.error('[hamburger] populate failed', err);
    // Try to at least show a basic header/footer so it’s not blank
    try {
      renderHeader(menuEl, false, ()=>{});
      const body = menuEl.querySelector('.menu-body') || menuEl.appendChild(Object.assign(document.createElement('div'),{className:'menu-body'}));
      body.innerHTML = '<div style="opacity:.7;padding:10px 6px;">Menu failed to load.</div>';
      renderBottomBar(menuEl, false, ()=>{}, ()=>{}, ()=>{}, heroId);
    } catch {}
  }
}

/* -------------------- force refresh when drawer finishes opening -------------------- */
(function ensureHamburgerRefreshOnOpen(){
  const menu = document.getElementById('builderMenu');
  if (!menu) return;
  menu.addEventListener('transitionend', ()=>{
    if (menu.classList.contains('show')){
      const heroId = window.__currentBuilderPage?.ctx?.heroId;
      if (heroId) {
        try { window.BuilderHamburger?.populate?.(menu, heroId); } catch (e){ console.warn('[hamburger] re-populate on open failed', e); }
      }
    }
  });
})();

export default { populate }; 