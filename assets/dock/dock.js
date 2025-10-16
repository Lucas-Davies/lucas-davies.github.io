/* =========================================================
   Dev Dock — in front of Builder + edit-mode driver
   - Dev ON  => enable live edit for current Builder page
   - Dev OFF => disable edit (no save/commit on toggle)
   - Re-applies mode on every builder:page-opened
   - Dock z-index > Builder so it sits above
   - All dock features preserved (Create / Settings / Archive / Trash)
   ========================================================= */
(() => {
  'use strict';

  /* ---------------- AppHome bridges ---------------- */
  const getS  = () => window.AppHome?.getSettings?.() || {};
  const setS  = (s) => { try { window.AppHome?.setSettings?.(s); } catch {} };
  const paint = () => { try { window.AppHome?.paint?.(); } catch {} };
  const focus = (id) => { try { window.AppHome?.focusHero?.(id); } catch {} };

  /* ---------------- IDs / counters ---------------- */
  function ddmmyyyy(d = new Date()){
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yyyy = String(d.getFullYear());
    return `${dd}${mm}${yyyy}`;
  }
  function nextCourseId(S){
    const key = ddmmyyyy();
    S.courseCounters = S.courseCounters || {};
    const n = (S.courseCounters[key] || 0) + 1;
    S.courseCounters[key] = n;
    const seq = String(n).padStart(3,'0');
    return `C${key}${seq}`;
  }

  /* ---------------- Build dock ---------------- */
  const dock = document.createElement('footer');
  dock.id = 'devDock';
  dock.className = 'dev-dock collapsed';
  Object.assign(dock.style, {
    position:'fixed',
    right:'10px',
    bottom:'10px',
    zIndex:'2147483700' // ⬆️ above Builder
  });
  dock.innerHTML = `
    <div class="dockBar" role="toolbar" aria-label="Developer dock">
      <button type="button" id="devToggle" class="footer-chip" aria-pressed="false" title="Developer">
        <span class="led" aria-hidden="true"></span>Developer
      </button>
      <button type="button" id="settingsToggle" class="footer-chip dev-opt"
              aria-haspopup="dialog" aria-expanded="false" aria-controls="settingsDrawer">Settings</button>
      <button type="button" id="createToggle" class="footer-chip dev-opt"
              aria-haspopup="dialog" aria-expanded="false" aria-controls="createPanel">Create</button>
    </div>

    <!-- Create drawer -->
    <section id="createPanel" class="dock-panel" role="dialog" aria-modal="false" hidden>
      <header class="drawerHead"><span class="drawerTitle">Create</span></header>
      <div class="drawerBody">
        <button type="button" id="createCourseBtn" class="menuItem">+ Course</button>
        <button type="button" id="addHeadingBtn"   class="menuItem">+ Heading</button>
      </div>
    </section>

    <!-- Settings drawer (Archive / Trash only) -->
    <section id="settingsDrawer" class="dock-panel" role="dialog" aria-modal="false" hidden>
      <header class="drawerHead"><span class="drawerTitle">Settings</span></header>
      <div class="drawerBody">
        <button type="button" class="drawerBtn" data-dock-action="archive" style="color:#32D74B">Archive</button>
        <button type="button" class="drawerBtn" data-dock-action="trash"   style="color:#FF3B30">Trash</button>
      </div>
    </section>
  `;
  (document.body || document.documentElement).appendChild(dock);

  /* ---------------- Refs ---------------- */
  const devBtn      = dock.querySelector('#devToggle');
  const createBtn   = dock.querySelector('#createToggle');
  const settingsBtn = dock.querySelector('#settingsToggle');
  const createEl    = dock.querySelector('#createPanel');
  const settingsEl  = dock.querySelector('#settingsDrawer');

  const devOn   = () => document.body.classList.contains('config-on');

  /* ---------------- Drawer helpers ---------------- */
  function closeCreate(){ if (!createEl.hidden){ createEl.hidden=true; createBtn.setAttribute('aria-expanded','false'); } }
  function closeSettings(){ if (!settingsEl.hidden){ settingsEl.hidden=true; settingsBtn.setAttribute('aria-expanded','false'); } }
  function openCreate(){ if (createEl.hidden){ createEl.hidden=false; createBtn.setAttribute('aria-expanded','true'); closeSettings(); } }
  function toggleCreate(){ createEl.hidden ? openCreate() : closeCreate(); }
  function openSettings(){ if (settingsEl.hidden){ settingsEl.hidden=false; settingsBtn.setAttribute('aria-expanded','true'); closeCreate(); } }
  function toggleSettings(){ settingsEl.hidden ? openSettings() : closeSettings(); }

  /* ---------------- EDIT-MODE GLUE (Builder-agnostic) ---------------- */
  function emitDevMode(on){
    // Global flags/classes pages can key off
    window.__DEV_MODE__ = !!on;
    document.body.classList.toggle('is-edit', !!on);
    document.body.classList.toggle('config-on', !!on);

    // Canonical event for pages to react (enable/disable inputs etc.)
    try { window.dispatchEvent(new CustomEvent('dev:mode', { detail:{ on: !!on } })); } catch {}
    // ⛔️ No save/commit/paint on toggle. Pages handle persistence on data entry.
  }

  // When Builder opens a page (via hamburger), re-apply current dev mode
  window.addEventListener('builder:page-opened', () => {
    emitDevMode(devOn());
  });

  /* ---------------- Mode toggle ---------------- */
  const setDev = (on)=>{
    dock.classList.toggle('open', on);
    dock.classList.toggle('collapsed', !on);
    devBtn?.setAttribute('aria-pressed', on ? 'true' : 'false');
    emitDevMode(on);
  };

  /* ---------------- Create actions ---------------- */
  function createCourseSoft(){
    const S = getS();
    S.pageOrder   = Array.isArray(S.pageOrder) ? S.pageOrder : [];
    S.heroFlags   = S.heroFlags  || {};
    S.heroLabels  = S.heroLabels || {};

    const id = nextCourseId(S);
    S.pageOrder.push({ type:'hero', id });
    S.heroFlags[id]  = { place:'page', state:'dev', aud:{}, shape:'square' };
    S.heroLabels[id] = 'New Course';

    setS(S); closeCreate(); paint();
    if (!document.querySelector(`.hero-card[data-id="${CSS.escape(id)}"]`)) { location.reload(); return; }
    focus(id);
  }

  function addHeadingSoft(){
    const S = getS();
    S.pageOrder = Array.isArray(S.pageOrder) ? S.pageOrder : [];
    const id = 'hd-' + Date.now();
    S.pageOrder.push({ type:'divider', id, title:'Heading' });
    setS(S); closeCreate(); paint();
  }

  /* ---------------- Archive/Trash drawers ---------------- */
  function normalizeUnflag(f, key){
    if (!f) return {};
    f[key] = false; try { delete f[key]; } catch {}
    return f;
  }
  function describeHeroLoc(S, heroId){
    let lastHeading = null, indexInSection = 0;
    for (const it of (S.pageOrder || [])){
      if (it.type === 'divider'){ lastHeading = it.title || 'Heading'; indexInSection = 0; }
      else if (it.type === 'hero'){
        indexInSection++;
        if (it.id === heroId) return `${lastHeading || 'No heading'} • item ${indexInSection}`;
      }
    }
    return 'Unknown';
  }
  function showInfoModal({ title='Information', fields=[] } = {}){
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position:'fixed', inset:0, background:'rgba(0,0,0,.45)',
      backdropFilter:'blur(2px)', zIndex:2147483800, display:'grid', placeItems:'center'
    });
    const modal = document.createElement('div');
    Object.assign(modal.style, {
      width:'min(520px,92vw)', borderRadius:'14px', background:'#0f1116', color:'#eef3ff',
      border:'1px solid rgba(255,255,255,.15)', boxShadow:'0 30px 70px rgba(0,0,0,.6)',
      padding:'16px 16px 10px', fontFamily:'system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif'
    });
    const h=document.createElement('div'); h.textContent=title; Object.assign(h.style,{fontWeight:800,fontSize:'18px',marginBottom:'10px'});
    const list=document.createElement('dl'); Object.assign(list.style,{margin:0,display:'grid',gridTemplateColumns:'140px 1fr',rowGap:'8px',columnGap:'12px'});
    for (const f of fields){
      const dt=document.createElement('dt'); dt.textContent=f.label; Object.assign(dt.style,{opacity:.7});
      const dd=document.createElement('dd'); dd.textContent=f.value; Object.assign(dd.style,{margin:0,fontWeight:600});
      list.appendChild(dt); list.appendChild(dd);
    }
    modal.appendChild(h); modal.appendChild(list); overlay.appendChild(modal); document.body.appendChild(overlay);
    const close=()=>overlay.remove();
    overlay.addEventListener('pointerdown', (e)=>{ if (e.target===overlay) close(); });
    document.addEventListener('keydown', function onKey(e){ if (e.key==='Escape'){ close(); document.removeEventListener('keydown', onKey); }});
  }
  function openArchiveTrashDrawer(type){
    const S = getS();
    const flagKey = (type === 'archive') ? 'archived' : 'deleted';
    const ids = Object.keys(S.heroFlags || {}).filter(id => !!(S.heroFlags[id]||{})[flagKey]);

    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position:'fixed', inset:0, background:'rgba(0,0,0,.45)',
      backdropFilter:'blur(2px)', zIndex:2147483800, display:'grid', placeItems:'center'
    });

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      width:'min(560px,92vw)', maxHeight:'80vh', overflowY:'auto',
      borderRadius:'14px', background:'#0f1116', color:'#eef3ff',
      border:'1px solid rgba(255,255,255,.15)', boxShadow:'0 30px 70px rgba(0,0,0,.6)', padding:'18px 16px',
      fontFamily:'system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif'
    });

    const heading = document.createElement('div');
    heading.textContent = flagKey === 'archived' ? 'Archived Courses' : 'Trashed Courses';
    Object.assign(heading.style, { fontSize:'18px', fontWeight:800, marginBottom:'12px' });
    panel.appendChild(heading);

    const empty = document.createElement('div');
    empty.textContent = 'No courses found.';
    Object.assign(empty.style, { opacity:.65, padding:'8px 0', display: ids.length ? 'none' : 'block' });
    panel.appendChild(empty);

    function maybeToggleEmpty(){
      const rowsLeft = panel.querySelectorAll('.course-row').length;
      empty.style.display = rowsLeft ? 'none' : 'block';
    }

    const makeRow = (id, label) => {
      const row = document.createElement('div');
      row.className = 'course-row';
      Object.assign(row.style, {
        display:'grid', gridTemplateColumns:'1fr auto auto', gap:'8px', alignItems:'center',
        padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,.08)'
      });

      const name = document.createElement('div');
      name.textContent = label || id;
      Object.assign(name.style, { overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' });

      const infoBtn = document.createElement('button');
      infoBtn.textContent = 'Info';
      Object.assign(infoBtn.style, {
        background:'transparent', color:'#fff',
        border:'1px solid rgba(255,255,255,.22)', borderRadius:'8px',
        padding:'6px 10px', fontSize:'13px', cursor:'pointer'
      });
      infoBtn.addEventListener('click', ()=>{
        const Scur = getS();
        const f = (Scur.heroFlags && Scur.heroFlags[id]) || {};
        const shape = f.shape || 'square';
        showInfoModal({
          title:'Course Information',
          fields:[
            {label:'ID:',            value:id},
            {label:'Title:',         value:(Scur.heroLabels && Scur.heroLabels[id]) || id},
            {label:'Orientation:',   value: shape==='hr' ? 'Landscape' : 'Square'},
            {label:'Grid location:', value: describeHeroLoc(Scur, id)},
            {label:'Status:',        value:(f.state === 'dev' || !f.state) ? 'Under Development' : String(f.state)}
          ]
        });
      });

      const returnBtn = document.createElement('button');
      returnBtn.textContent = 'Return to Page';
      Object.assign(returnBtn.style, {
        background:'#0A84FF', color:'#fff', border:'none', borderRadius:'8px',
        padding:'6px 10px', fontSize:'13px', cursor:'pointer'
      });
      returnBtn.addEventListener('click', ()=>{
        const flags = S.heroFlags[id] || {};
        S.heroFlags[id] = normalizeUnflag(flags, flagKey);
        setS(S); paint(); row.remove(); maybeToggleEmpty(); focus(id);
      });

      row.appendChild(name);
      row.appendChild(infoBtn);
      row.appendChild(returnBtn);
      return row;
    };

    ids.forEach(id => {
      const label = (S.heroLabels && S.heroLabels[id]) || id;
      panel.appendChild(makeRow(id, label));
    });

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    overlay.addEventListener('pointerdown', (e)=>{ if (e.target === overlay) overlay.remove(); });
    document.addEventListener('keydown', function onKey(e){ if (e.key==='Escape'){ overlay.remove(); document.removeEventListener('keydown', onKey); }});
  }

  /* ---------------- Clicks ---------------- */
  dock.addEventListener('click', (e)=>{
    const btn = e.target.closest('button');
    if (!btn || !dock.contains(btn)) return;

    if (btn.id === 'devToggle'){ setDev(!devOn()); return; }  // no paint() here
    if (!devOn()) return;

    if (btn.id === 'createToggle'){ toggleCreate(); return; }
    if (btn.id === 'settingsToggle'){ toggleSettings(); return; }

    if (btn.id === 'createCourseBtn'){ createCourseSoft(); return; }
    if (btn.id === 'addHeadingBtn')  { addHeadingSoft();  return; }

    if (btn.classList.contains('drawerBtn')){
      const act = btn.dataset.dockAction;
      if (act === 'archive' || act === 'trash'){ openArchiveTrashDrawer(act); return; }
    }
  });

  // stop outside-closers from catching drawer clicks
  createEl.addEventListener('pointerdown', (e)=> e.stopPropagation());
  settingsEl.addEventListener('pointerdown', (e)=> e.stopPropagation());

  // close drawers on outside click / Esc
  document.addEventListener('pointerdown', (e)=>{
    if (!dock.contains(e.target)) { closeCreate(); closeSettings(); }
  });
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape'){ closeCreate(); closeSettings(); }
  });

  /* ---------------- Init ---------------- */
  setDev(false); // start in view mode
})(); 