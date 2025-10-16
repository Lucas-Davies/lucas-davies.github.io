/* =========================================================
   BuilderPages — tiny router shim (preview/activity/…)
   Loads page modules and mounts them into .builder-body
   + Calls current page's commit() before switching/unmounting
   + Listens for builder:save-clicked and commits immediately
   + Publishes window.__currentBuilderPage for page modules
   ========================================================= */

(function () {
  if (window.BuilderPages) return; // don’t double-create

  // ---- util ------------------------------------------------
  const getS  = () => window.AppHome?.getSettings?.() || {};
  const setS  = (s) => { try { window.AppHome?.setSettings?.(s); } catch {} };
  const $     = (sel, r = document) => r.querySelector(sel);

  // ---- settings write hook + barrier ---------------------------------------
(function instrumentSettingsWrite(){
  const ah = window.AppHome;
  if (!ah || !ah.setSettings || ah.setSettings.__wrapped) return;
  const orig = ah.setSettings.bind(ah);
  ah.setSettings = function wrappedSetSettings(next){
    const ret = orig(next);
    Promise.resolve().then(()=>{
      try { window.dispatchEvent(new Event('settings:after-set')); } catch {}
    });
    return ret;
  };
  ah.setSettings.__wrapped = true;
})();

function waitForSettingsFlush(timeout = 600){
  return new Promise((resolve)=>{
    let done = false;
    const t = setTimeout(()=>{ if (!done) { done = true; resolve(); } }, timeout);
    const onEvt = ()=>{ if (done) return; done = true; clearTimeout(t); resolve(); };
    window.addEventListener('settings:after-set', onEvt, { once:true });
  });
}
  
  function showModal(msg){
    const ov = document.createElement('div');
    Object.assign(ov.style, {
      position:'fixed', inset:'0', zIndex:2147483605,
      background:'rgba(0,0,0,.45)', display:'grid', placeItems:'center'
    });
    const card = document.createElement('div');
    Object.assign(card.style, {
      width:'min(520px,92vw)', borderRadius:'14px',
      background:'#0d1118', color:'#eef3ff',
      border:'1px solid rgba(255,255,255,.15)',
      boxShadow:'0 24px 60px rgba(0,0,0,.55)', padding:'16px',
      font:'600 14px system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif'
    });
    card.innerHTML = `
      <div style="font-weight:800;margin-bottom:8px;">Notice</div>
      <div style="opacity:.9;margin-bottom:10px;">${msg}</div>
      <div style="text-align:right;">
        <button style="padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:#1a2230;color:#fff;cursor:pointer">Close</button>
      </div>`;
    card.querySelector('button').onclick = () => ov.remove();
    ov.appendChild(card); document.body.appendChild(ov);
  }

  // Absolute path loader (no more relative mishaps)
  async function loadModule(baseKey){
    const candidates = [
      `/assets/course/pages/${baseKey}.js`,
      `/assets/course/pages/${baseKey}.js?cb=${Date.now()}`, // cache-bust fallback
    ];
    let lastErr = null;
    for (const url of candidates){
      try {
        const mod = await import(/* @vite-ignore */ url);
        return mod;
      } catch (e) { lastErr = e; }
    }
    console.error(`BuilderPages: failed to load ${baseKey}`, lastErr);
    return null;
  }

  // derive/ensure an instanceId for activities if one isn’t passed
  function ensureActivityInstanceId(heroId, key, instanceId){
    if (instanceId) return instanceId;
    try {
      const S = getS();
      S.heroPageIds = S.heroPageIds || {};
      S.heroPageIds[heroId] = S.heroPageIds[heroId] || {};
      const idMap = S.heroPageIds[heroId];
      if (!idMap[key]) {
        let max = 0;
        for (const v of Object.values(idMap)){
          const m = String(v).match(/-A(\d+)$/);
          if (m) max = Math.max(max, parseInt(m[1], 10));
        }
        idMap[key] = `${heroId}-A${max + 1}`;
        setS(S);
      }
      return idMap[key];
    } catch { return null; }
  }

  // ---- current mount -------------------------------------------------------
  let current = { key: null, mod: null, el: null, ctx: null };

  // Ask the current page to commit its data (if it exposes commit/save)
  async function commitCurrent(){
    try {
      if (!current?.mod) return;
      if (typeof current.mod.commit === 'function') {
        await current.mod.commit(current.el, current.ctx);
      } else if (typeof current.mod.save === 'function') {
        await current.mod.save(current.el, current.ctx);
      } else {
        // low-level fallback: dispatch an event pages can listen to
        window.dispatchEvent(new CustomEvent('builder:commit-request', { detail: current.ctx || {} }));
      }
      // mark the commit tick so the Builder button can honor it
      try { window.__lastSettingsCommitAt = Date.now(); } catch {}
    } catch (e) {
      console.warn('BuilderPages.commitCurrent() failed (continuing):', e);
    }
  }

  async function open(arg, heroMaybe, extraCtx={}){
    // Normalize arguments
    let key, heroId, instanceId, label;
    if (typeof arg === 'string'){
      key        = arg;
      heroId     = heroMaybe;
      instanceId = extraCtx.instanceId;
      label      = extraCtx.label;
    } else if (arg && typeof arg === 'object'){
      key        = arg.key;
      heroId     = arg.heroId;
      instanceId = arg.instanceId;
      label      = arg.label;
    }
    key = String(key || 'preview');

    // Before we close current page, ask it to commit and give a breath
    try { await commitCurrent(); } catch {}
    // allow microtask → style/layout → microtask (lets observers finish)
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    // Close current
    try { await current.mod?.unmount?.(current.el); } catch {}
    current.key = null;

    // Find host element
    const builderRoot = document.getElementById('builderRoot');
    const el = builderRoot?.querySelector('.builder-body') || document.body;

    // For activity pages, ensure we have an instanceId
    if (key === 'activity' || key.startsWith('activity-')) {
      const stableKey = 'activity-1';
      instanceId = ensureActivityInstanceId(heroId, stableKey, instanceId);
    }

    // Base key for module file (activity/preview/…)
    const baseKey = key.startsWith('activity-') || key === 'activity' ? 'activity' : key;

    // Load module
    const mod = await loadModule(baseKey);
    if (!mod || typeof mod.mount !== 'function'){
      showModal(`${baseKey} could not be opened`);
      return false;
    }

    // Build ctx and mount
    const ctx = { heroId, instanceId, label, pageKey: key };
    try {
      await mod.mount(el, ctx);
      current = { key, mod, el, ctx };

      // Publish "what's open" for pages (preview uses this)
      try { window.__currentBuilderPage = { ctx }; } catch {}

      // Broadcast (Builder listens for this)
try {
  window.dispatchEvent(new CustomEvent('builder:page-opened', {
    // include both names for backward/forward compatibility
    detail: { key, pageKey: key, heroId, instanceId, label }
  }));
} catch {} 
      return true;
    } catch (e){
      console.error('BuilderPages.mount failed', e);
      showModal(`${baseKey} could not be opened`);
      return false;
    }
  }

  async function close() {
    try { await commitCurrent(); } catch {}

    // ✅ Wait for AppHome.setSettings() to flush before unmounting
    await waitForSettingsFlush(600);

    // Then unmount and clean up the current page
    try { await current.mod?.unmount?.(current.el); } catch {}
    current = { key: null, mod: null, el: null, ctx: null };

    try { window.__currentBuilderPage = null; } catch {}
  }

  // ✅ Expose the BuilderPages API globally
  window.BuilderPages = { open, close, commitCurrent };

  // ✅ When Builder's "Save" button is clicked, commit immediately
  window.addEventListener('builder:save-clicked', async () => {
    try {
      await window.BuilderPages?.commitCurrent?.();
      await waitForSettingsFlush(600); // ensure write is persisted
    } catch (err) {
      console.warn('[BuilderPages] save-click commit failed', err);
    }
  });
})(); 