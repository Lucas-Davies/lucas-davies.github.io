/* =========================================================
   /assets/home/hero.js — lean, grid-safe
   - Sections (dividers) + hero cards via grid.js
   - Per-hero shape: 'square' (default) or 'hr' (landscape) — independent
   - Kebab drawers for heroes & dividers
   - Move up/down (dev mode: body.config-on)
   - Click hero -> /assets/course/builder/builder.js (CourseBuilder.open)
   ========================================================= */

import {
  paintGrid,
  computeAndPersistLayout,
  getHeroLoc,
  getDividerLoc,
  getSectionMeta,
} from './grid.js';

/* -----------------------------
   Storage (tiny, resilient)
----------------------------- */
const LSK = { settings: 'as:settings' };
const LS  = {
  get(k, f=null){ try{ const r=localStorage.getItem(k); return r==null? f:JSON.parse(r);}catch{return f;} },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} }
};
const esc = (s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* Normalize + defaults */
function sane(cfg){
  const c = (!cfg || typeof cfg!=='object') ? {} : { ...cfg };
  c.pageOrder  = Array.isArray(c.pageOrder) ? c.pageOrder.filter(x=>x && (x.type==='hero'||x.type==='divider')) : [];
  c.heroFlags  = c.heroFlags || {};
  c.heroLabels = c.heroLabels||{};
  c.heroAssets = c.heroAssets||{}; // { [id]: { thumb, filename? } }
  c.layout     = c.layout||null;

  // Default + clamp shapes (square|hr only)
  for (const id of Object.keys(c.heroFlags)){
    if (!c.heroFlags[id]) c.heroFlags[id] = {};
    c.heroFlags[id].shape = (c.heroFlags[id].shape==='hr') ? 'hr' : 'square';
  }
  return c;
}
export function getSettings(){ return sane(LS.get(LSK.settings, {})); }
export function setSettings(s){ LS.set(LSK.settings, sane(s)); }

/* -----------------------------
   Info modal (micro)
----------------------------- */
function infoModal({ title='Information', rows=[] }={}){
  const ov=document.createElement('div'); ov.className='info-overlay';
  Object.assign(ov.style,{position:'fixed',inset:'0',background:'rgba(0,0,0,.45)',backdropFilter:'blur(2px)',zIndex:2147483646,display:'grid',placeItems:'center'});
  const card=document.createElement('div'); card.className='info-modal';
  Object.assign(card.style,{width:'min(560px,92vw)',borderRadius:'14px',background:'#0f1116',color:'#eef3ff',border:'1px solid rgba(255,255,255,.15)',boxShadow:'0 30px 70px rgba(0,0,0,.6)',padding:'16px',fontFamily:'system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif'});
  const h=document.createElement('div'); h.textContent=title; Object.assign(h.style,{fontWeight:800,fontSize:'18px',marginBottom:'10px'}); card.appendChild(h);
  if (rows.length){
    const dl=document.createElement('dl'); Object.assign(dl.style,{margin:0,display:'grid',gridTemplateColumns:'160px 1fr',gap:'8px 12px'});
    rows.forEach(r=>{ const dt=document.createElement('dt'); dt.textContent=r.label; dt.style.opacity='.7'; const dd=document.createElement('dd'); dd.textContent=r.value; dd.style.margin=0; dd.style.fontWeight=600; dl.appendChild(dt); dl.appendChild(dd); });
    card.appendChild(dl);
  }
  ov.appendChild(card); document.body.appendChild(ov);
  const close=()=>ov.remove();
  ov.addEventListener('pointerdown',e=>{ if(e.target===ov) close(); });
  document.addEventListener('keydown',function onk(e){ if(e.key==='Escape'){ close(); document.removeEventListener('keydown',onk);} });
}

async function openBuilder(heroId){
  const log = (...a)=>{ try{ console.log('[hero→builder]', ...a); }catch{} };
  const ok  = ()=> (window.CourseBuilder && typeof window.CourseBuilder.open==='function');
  const call= ()=>{ try{ return window.CourseBuilder.open(heroId), true; }catch(e){ log('open() threw', e); return false; } };

  if (ok()){ log('open present →', heroId); return call(); }

  const candidates = [
    '/assets/course/builder/builder.js',   // absolute first
    './assets/course/builder/builder.js',  // relative fallback
  ];

  // ESM import
  for (const src of candidates){
    try { log('import try', src); await import(/* @vite-ignore */ src);
      if (ok()){ log('import OK', src); return call(); }
    } catch(e){ log('import fail', src, e); }
  }

  // <script type="module">
  for (const src of candidates){
    try {
      log('<script module> try', src);
      await new Promise((res, rej)=>{
        if ([...document.scripts].some(s => s.type==='module' && (s.src||'').endsWith(src))) return res();
        const s=document.createElement('script');
        s.type='module'; s.src=src; s.async=true;
        s.onload=res; s.onerror=(err)=>rej(err||new Error('load fail'));
        document.head.appendChild(s);
      });
      if (ok()){ log('<script module> OK', src); return call(); }
    } catch(e){ log('<script module> fail', src, e); }
  }

  log('Builder not available. Check path/export.');
  return false;
} 

/* =========================================================
   RENDER — Divider & Hero
========================================================= */
export function renderDividerEl(divObj){
  const wrap=document.createElement('div'); wrap.className='divider'; wrap.dataset.divId=divObj.id;
  wrap.innerHTML = `
    <button type="button" class="divider-menu" data-div-kebab="${esc(divObj.id)}" title="Menu" aria-haspopup="true">⋮</button>
    <div class="div-arrows">
      <button type="button" class="move-btn" data-div-move="up"   data-id="${esc(divObj.id)}" aria-label="Move heading up">▲</button>
      <button type="button" class="move-btn" data-div-move="down" data-id="${esc(divObj.id)}" aria-label="Move heading down">▼</button>
    </div>
    <h2 class="divider-title" contenteditable="false">${esc(divObj.title || 'Heading')}</h2>
  `;
  return wrap;
}

export function renderHeroCard(heroId){
  const S=getSettings();
  const label=S.heroLabels?.[heroId]||heroId;
  const art =S.heroAssets?.[heroId]?.thumb;
  const shape=(S.heroFlags?.[heroId]?.shape==='hr')?'hr':'square';

  const el=document.createElement('article');
  el.className=`hero-card shape-${shape}`;
  el.dataset.id=heroId;
  el.dataset.shape=shape; // optional hook for CSS

  el.innerHTML=`
    <a class="hero-hit"
       href="#"
       data-open-hero="${esc(heroId)}"
       aria-label="${esc(label)}"
       role="button"
       tabindex="0"></a>
    <button class="hero-menu" type="button" data-hero-kebab="${esc(heroId)}" aria-haspopup="true" title="Menu">⋮</button>
    <div class="hero-move">
      <button class="move-btn" type="button" data-move="up"   data-id="${esc(heroId)}" aria-label="Move up">▲</button>
      <button class="move-btn" type="button" data-move="down" data-id="${esc(heroId)}" aria-label="Move down">▼</button>
    </div>
    <div class="hero-body">
      ${art? `<img class="hero-thumb" alt="" src="${esc(art)}">` : ''}
      <div class="hero-title">${esc(label)}</div>
    </div>
  `;
  return el;
} 

/* -----------------------------
   Include filters
----------------------------- */
export function shouldIncludeHero(id){
  const f=getSettings().heroFlags?.[id]||{};
  return !(f.archived || f.deleted);
}

/* =========================================================
   PAINT (compute layout + render via grid.js)
========================================================= */
export function paint(){
  const S=getSettings();
  computeAndPersistLayout(S); setSettings(S);
  paintGrid(S.pageOrder, {
    renderDivider: (d)=>renderDividerEl(d),
    renderHero:    (id)=>renderHeroCard(id),
    includeHero:   (id)=>shouldIncludeHero(id),
  });
}

/* =========================================================
   MOVE (dev mode only)
========================================================= */
function moveItem(id, type, dir){
  const S=getSettings();
  const idx=S.pageOrder.findIndex(it=>(type==='hero'? it.type==='hero'&&it.id===id : it.type==='divider'&&it.id===id));
  if (idx<0) return;
  const to=Math.min(Math.max(0, idx+dir), S.pageOrder.length-1);
  if (to===idx) return;
  const [item]=S.pageOrder.splice(idx,1); S.pageOrder.splice(to,0,item);
  computeAndPersistLayout(S); setSettings(S); paint();
}

/* =========================================================
   DRAWERS — hero + divider
========================================================= */
function openHeroDrawer(btn){
  closeDrawers();
  const heroId=btn.dataset.heroKebab;
  const S=getSettings();
  const label=S.heroLabels?.[heroId]||heroId;
  const flags=S.heroFlags?.[heroId]||{};
  const assets=S.heroAssets?.[heroId]||{};
  const shape=(flags.shape==='hr')?'hr':'square';

  const drawer=document.createElement('div'); drawer.className='hero-drawer'; drawer.dataset.heroId=heroId;
  const r=btn.getBoundingClientRect();
  Object.assign(drawer.style,{position:'fixed',top:`${r.bottom+4}px`,left:`${Math.max(8,r.right-200)}px`,zIndex:2147483646});
  drawer.innerHTML=`
    <div class="drawer-option white" data-action="info" data-id="${heroId}">Information</div>
    <div class="drawer-option white has-sub" data-action="design-toggle" data-id="${heroId}">
      <span>Design</span><span class="arrow blue">›</span>
    </div>
    <div class="sub" data-design-sub="${heroId}" style="height:0;opacity:0;overflow:hidden;">
      <button class="sub-opt" data-design-rename="${heroId}">Rename</button>

      <div class="drawer-option white has-sub" data-action="cover-shape-toggle" data-id="${heroId}" style="margin:6px 6px 0;border-radius:8px;">
        <span>Cover Shape</span><span class="arrow blue">›</span>
      </div>
      <div class="sub" data-shape-sub="${heroId}" style="height:0;opacity:0;overflow:hidden;">
        <label class="sub-opt ${shape==='square'?'active':''}" data-shape-choice="square" data-id="${heroId}">
          <input type="checkbox" ${shape==='square'?'checked':''} style="pointer-events:none;margin-right:6px">Square
        </label>
        <label class="sub-opt ${shape==='hr'?'active':''}" data-shape-choice="hr" data-id="${heroId}">
          <input type="checkbox" ${shape==='hr'?'checked':''} style="pointer-events:none;margin-right:6px">Landscape
        </label>
      </div>

      <button class="sub-opt" data-design-change-cover="${heroId}">Change Cover</button>
    </div>
    <div class="drawer-option blue" data-action="archive" data-id="${heroId}">Archive</div>
    <div class="drawer-option red"  data-action="trash"   data-id="${heroId}">Trash</div>
  `;
  document.body.appendChild(drawer);

  drawer.addEventListener('click',(e)=>{
    const opt=e.target.closest('[data-action],[data-design-rename],[data-design-change-cover],[data-shape-choice]');
    if(!opt) return;

    // Information includes shape + cover filename
    if (opt.dataset.action==='info'){
      const Scur=getSettings();
      const loc=getHeroLoc(Scur, heroId);
      const sec=loc?.sectionId? getSectionMeta(Scur,loc.sectionId):null;
      const flags=Scur.heroFlags?.[heroId]||{};
      const assets=Scur.heroAssets?.[heroId]||{};
      closeDrawers();
      infoModal({ title:'Course Information', rows:[
        {label:'ID:', value:heroId},
        {label:'Title:', value:label},
        {label:'Shape:', value: (flags.shape==='hr' ? 'Landscape' : 'Square')},
        {label:'Cover Image:', value: assets.filename || (assets.thumb && !String(assets.thumb).startsWith('data:') ? String(assets.thumb).split('/').pop() : '—')},
        {label:'Grid location:', value: loc? `${sec? (sec.title||'Heading'):'No heading'} • item ${loc.indexInSection}` : 'Unknown'}
      ]});
      return;
    }

    // Accordions
    if (opt.dataset.action==='design-toggle'){
      toggleSub(drawer, `[data-design-sub="${CSS.escape(heroId)}"]`, opt.querySelector('.arrow')); return;
    }
    if (opt.dataset.action==='cover-shape-toggle'){
      toggleSub(drawer, `[data-shape-sub="${CSS.escape(heroId)}"]`, opt.querySelector('.arrow')); return;
    }

    // Rename
    if (opt.hasAttribute('data-design-rename')){ inlineRenameHero(heroId); closeDrawers(); return; }

    // Change cover
    if (opt.hasAttribute('data-design-change-cover')){ changeHeroCover(heroId); closeDrawers(); return; }

    // Shape change (square|hr) — update storage + live class on this card
    if (opt.hasAttribute('data-shape-choice')){
      const choice = (opt.dataset.shapeChoice==='hr') ? 'hr' : 'square';
      const S2=getSettings(); S2.heroFlags=S2.heroFlags||{};
      S2.heroFlags[heroId] = { ...(S2.heroFlags[heroId]||{}), shape: choice };
      setSettings(S2);

      // Live update the clicked card (no full repaint needed)
      applyHeroShapeClass(heroId, choice);

      // Update the visual checks in the drawer
      const host=drawer.querySelector(`[data-shape-sub="${CSS.escape(heroId)}"]`);
      host?.querySelectorAll('[data-shape-choice]').forEach(el=>{
        const active = el.dataset.shapeChoice===choice;
        el.classList.toggle('active', active);
        const cb=el.querySelector('input[type="checkbox"]'); if (cb) cb.checked = active;
      });

      focusHero(heroId);
      return;
    }

    // Archive / Trash
    if (opt.dataset.action==='archive' || opt.dataset.action==='trash'){
      const S2=getSettings(); S2.heroFlags=S2.heroFlags||{}; const f=S2.heroFlags[heroId]||{};
      if (opt.dataset.action==='archive'){ f.archived=true; delete f.deleted; } else { f.deleted=true; delete f.archived; }
      S2.heroFlags[heroId]=f; computeAndPersistLayout(S2); setSettings(S2); closeDrawers(); paint();
    }
  });
}

function openDividerDrawer(btn){
  closeDrawers();
  const divId=btn.dataset.divKebab;
  const S=getSettings();
  const d=S.pageOrder.find(it=>it.type==='divider'&&it.id===divId)||{};
  const size=d.rowSize||'l'; // whatever your grid sizes are; unchanged
  const title=d.title||'Heading';

  const drawer=document.createElement('div'); drawer.className='div-drawer'; drawer.dataset.divId=divId;
  const r=btn.getBoundingClientRect(); Object.assign(drawer.style,{position:'fixed',top:`${r.bottom+4}px`,left:`${r.left}px`,zIndex:2147483646});
  drawer.innerHTML=`
    <div class="drawer-option white" data-div-action="info"   data-id="${divId}">Information</div>
    <div class="drawer-option white" data-div-action="rename" data-id="${divId}">Rename</div>

    <div class="drawer-option white has-sub" data-div-action="size-toggle" data-id="${divId}">
      <span>Hero Size</span><span class="arrow blue">›</span>
    </div>
    <div class="size-sub" data-size-sub="${divId}" style="height:0;opacity:0;overflow:hidden;">
      <button class="size-opt ${size==='xs'?'active':''}" data-size-choice="xs" data-id="${divId}">Extra Small</button>
      <button class="size-opt ${size==='s'?'active':''}"  data-size-choice="s"  data-id="${divId}">Small</button>
      <button class="size-opt ${size==='m'?'active':''}"  data-size-choice="m"  data-id="${divId}">Medium</button>
      <button class="size-opt ${size==='l'?'active':''}"  data-size-choice="l"  data-id="${divId}">Large</button>
      <button class="size-opt ${size==='xl'?'active':''}" data-size-choice="xl" data-id="${divId}">Extra Large</button>
    </div>

    <div class="drawer-option red" data-div-action="delete" data-id="${divId}">Delete</div>
  `;
  document.body.appendChild(drawer);

  drawer.addEventListener('click',(e)=>{
    const opt=e.target.closest('.drawer-option[data-div-action]');
    if(!opt) return;
    const act=opt.dataset.divAction;

    if (act==='info'){
      const Scur=getSettings(); const loc=getDividerLoc(Scur, divId);
      closeDrawers(); infoModal({ title:'Section Information', rows:[
        {label:'ID:',value:divId},
        {label:'Title:',value:title},
        {label:'Grid location:', value: (typeof loc?.sectionIndex==='number') ? `Section ${loc.sectionIndex}` : 'Unknown' }
      ]}); return;
    }
    if (act==='delete'){ closeDrawers(); deleteDivider(divId); return; }
    if (act==='rename'){ closeDrawers(); inlineRenameDivider(divId); return; }
    if (act==='size-toggle'){
      const row=drawer.querySelector(`.drawer-option.has-sub[data-id="${CSS.escape(divId)}"]`);
      toggleSub(drawer, `[data-size-sub="${CSS.escape(divId)}"]`, row?.querySelector('.arrow')); return;
    }
  });
}

/* -----------------------------
   Live shape class updater (per-hero, independent)
----------------------------- */
function applyHeroShapeClass(heroId, shape){
  const card=document.querySelector(`.hero-card[data-id="${CSS.escape(heroId)}"]`);
  if (!card) return;
  card.classList.remove('shape-square','shape-hr');
  card.classList.add(`shape-${shape}`);
  card.dataset.shape = shape;
}

/* -----------------------------
   Submenu animation
----------------------------- */
function toggleSub(root, selector, arrowEl){
  const sub = (typeof selector==='string') ? root.querySelector(selector) : selector;
  if (!sub || sub.__animating) return;
  const isOpen=sub.classList.contains('is-open'); sub.__animating=true;

  if (!isOpen){
    sub.style.height='auto'; const h=sub.scrollHeight; sub.style.height='0px';
    requestAnimationFrame(()=>{ sub.classList.add('is-open'); sub.style.opacity='1'; sub.style.height=`${h}px`; arrowEl?.classList.add('rot'); });
  }else{
    const h=sub.getBoundingClientRect().height||sub.scrollHeight; sub.style.height=`${h}px`; sub.offsetHeight;
    requestAnimationFrame(()=>{ sub.classList.remove('is-open'); sub.style.opacity='0'; sub.style.height='0px'; arrowEl?.classList.remove('rot'); });
  }
  const done=(ev)=>{ if(ev.propertyName!=='height') return; sub.removeEventListener('transitionend',done);
    if (sub.classList.contains('is-open')){ sub.style.height='auto'; sub.style.opacity='1'; } else { sub.style.height=''; sub.style.opacity=''; }
    sub.__animating=false;
  };
  sub.addEventListener('transitionend', done);
}

/* -----------------------------
   Inline rename + cover (stores filename)
----------------------------- */
function inlineRenameHero(heroId){
  const el=document.querySelector(`.hero-card[data-id="${CSS.escape(heroId)}"] .hero-title`); if(!el) return;
  el.contentEditable='true'; el.focus();
  const r=document.createRange(); r.selectNodeContents(el);
  const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
  const save=()=>{ el.contentEditable='false'; const name=(el.textContent||'').trim()||heroId;
    const S=getSettings(); S.heroLabels=S.heroLabels||{}; S.heroLabels[heroId]=name; setSettings(S); };
  el.addEventListener('blur',save,{once:true});
  el.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); el.blur(); } });
}

function changeHeroCover(heroId){
  const input=Object.assign(document.createElement('input'),{type:'file',accept:'image/*',style:'display:none'}); document.body.appendChild(input);
  input.onchange=()=>{ const f=input.files?.[0]; if(!f){ input.remove(); return; }
    const filename = f.name || '';
    const rd=new FileReader();
    rd.onload=()=>{ const S=getSettings(); S.heroAssets=S.heroAssets||{};
      S.heroAssets[heroId] = { ...(S.heroAssets[heroId]||{}), thumb: rd.result, filename };
      setSettings(S); paint(); input.remove();
    };
    rd.readAsDataURL(f);
  };
  input.click();
}

/* -----------------------------
   Divider helpers
----------------------------- */
function deleteDivider(divId){
  const S=getSettings(); const idx=S.pageOrder.findIndex(it=>it.type==='divider'&&it.id===divId);
  if (idx<0) return; S.pageOrder.splice(idx,1); computeAndPersistLayout(S); setSettings(S); paint();
}
function inlineRenameDivider(divId){
  const el=document.querySelector(`.divider[data-div-id="${CSS.escape(divId)}"] .divider-title`); if(!el) return;
  el.contentEditable='true'; el.focus();
  const r=document.createRange(); r.selectNodeContents(el);
  const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
  const save=()=>{ el.contentEditable='false'; const title=(el.textContent||'').trim()||'Heading';
    const S=getSettings(); const item=S.pageOrder.find(it=>it.type==='divider'&&it.id===divId); if(item) item.title=title;
    computeAndPersistLayout(S); setSettings(S); };
  el.addEventListener('blur',save,{once:true});
  el.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); el.blur(); } });
}

/* -----------------------------
   Drawer utils + focus nudge
----------------------------- */
function closeDrawers(){ document.querySelectorAll('.hero-drawer,.div-drawer').forEach(d=>d.remove()); }
export function focusHero(id){ const el=document.querySelector(`.hero-card[data-id="${CSS.escape(id)}"]`); if(!el) return; el.classList.add('focus-pulse'); setTimeout(()=>el.classList.remove('focus-pulse'),900); }

/* ========================================================
   GLOBAL EVENTS
========================================================= */
function isActivatorKey(e){
  // Space or Enter triggers "button" behavior
  return e.key === 'Enter' || e.key === ' ';
}

document.addEventListener('click', async (e)=>{
  const dev = document.body.classList.contains('config-on');

  // outside click closes drawers
  if (!e.target.closest('.hero-drawer,.div-drawer,.hero-menu,.divider-menu')) closeDrawers();

  // --- OPEN BUILDER (uniform in red/green) ---
  // 1) Click anywhere on a hero card except its kebab or move buttons
  const card = e.target.closest('.hero-card');
  if (card && !e.target.closest('.hero-menu,.move-btn')){
    e.preventDefault?.();
    await openBuilder(card.dataset.id);
    return;
  }

  // 2) Explicit overlay (keyboard focusable)
  const hit = e.target.closest('[data-open-hero]');
  if (hit){
    e.preventDefault?.();
    await openBuilder(hit.getAttribute('data-open-hero'));
    return;
  }

  // --- Hero/Divider drawers ---
  const hk=e.target.closest('.hero-menu[data-hero-kebab]');
  if (hk){ e.stopPropagation(); openHeroDrawer(hk); return; }

  const dk=e.target.closest('.divider-menu[data-div-kebab]');
  if (dk){ e.stopPropagation(); openDividerDrawer(dk); return; }

  // --- Divider size choice ---
  const sizeBtn=e.target.closest('.size-opt[data-size-choice][data-id]');
  if (sizeBtn){
    const id=sizeBtn.dataset.id, size=sizeBtn.dataset.sizeChoice;
    const S=getSettings();
    const row=S.pageOrder.find(it=>it.type==='divider'&&it.id===id);
    if (row){ row.rowSize=size; computeAndPersistLayout(S); setSettings(S); paint(); }
    const host=sizeBtn.closest('.size-sub');
    host?.querySelectorAll('.size-opt').forEach(b=>b.classList.toggle('active', b===sizeBtn));
    return;
  }

  // --- Moves (dev only) ---
  if (!dev) return;
  const hBtn=e.target.closest('.move-btn[data-move][data-id]');
  if (hBtn && hBtn.closest('.hero-card')){
    moveItem(hBtn.dataset.id,'hero', hBtn.dataset.move==='up'? -1:1);
    return;
  }
  const dBtn=e.target.closest('.move-btn[data-div-move][data-id]');
  if (dBtn){
    moveItem(dBtn.dataset.id,'divider', dBtn.dataset.divMove==='up'? -1:1);
    return;
  }
},{passive:false});

document.addEventListener('keydown', async (e)=>{
  // Esc closes overlays/drawers
  if (e.key==='Escape'){
    document.querySelector('.info-overlay')?.remove();
    closeDrawers();
    return;
  }

  // Keyboard activate on focused hero-hit (space/enter)
  const hit = e.target.closest('[data-open-hero]');
  if (hit && isActivatorKey(e)){
    e.preventDefault();
    await openBuilder(hit.getAttribute('data-open-hero'));
  }
}); 
/* =========================================================
   BOOT
========================================================= */
document.addEventListener('DOMContentLoaded',()=>{ try{ paint(); }catch(e){ console.warn(e); } });

/* =========================================================
   Bridge (optional external use)
========================================================= */
window.AppHome = { paint, focusHero, getSettings, setSettings }; 