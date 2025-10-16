/* assets/home/home.js
   Home page grid + hero shapes/logic only.
   - Forces solid black background (no image layers)
   - Renders dividers + heroes from S.pageOrder
   - Computes hero state (live/dev/off) and next chips
   - No dock, no drawers, no HQ — just the grid
*/

(() => {
  'use strict';

  /* ===== Local storage + settings (minimal, same keys) ===== */
  const LSK = {
    settings:      'as:settings',
    schemaVer:     'as:schemaVer',
    currentArtist: 'as:currentArtist',
  };
  const SCHEMA_VERSION = 1;

  const LocalStore = {
    get(k,f=null){ try{ const r=localStorage.getItem(k); return r==null?f:JSON.parse(r);}catch{ return f; } },
    set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} }
  };

  function defaults(){
    return {
      heroFlags:{}, heroLabels:{}, heroAssets:{}, heroProgress:{}, heroStyle:{},
      heroSchedule:{}, heroShortcuts:{}, pageOrder:[], flags:{schedule:true},
      courseMap:{}, courseCounters:{}
    };
  }
  function sanitize(cfg){
    let c = (!cfg||typeof cfg!=='object') ? defaults() : {...cfg};
    c.heroFlags     ||= {};
    c.heroLabels    ||= {};
    c.heroAssets    ||= {};
    c.heroProgress  ||= {};
    c.heroStyle     ||= {};
    c.heroSchedule  ||= {};
    c.heroShortcuts ||= {};
    c.pageOrder     = Array.isArray(c.pageOrder) ? c.pageOrder.filter(it=>it && (it.type==='hero'||it.type==='divider')) : [];
    c.flags         ||= { schedule:true };
    c.courseMap     ||= {};
    c.courseCounters||= {};
    return c;
  }

  function settingsKeyForArtist(artistId){ return artistId ? `${LSK.settings}:${artistId}` : LSK.settings; }
  function schemaKeyForArtist(artistId){   return artistId ? `${LSK.schemaVer}:${artistId}` : LSK.schemaVer; }

  function getCurrentArtistId(){ return LocalStore.get(LSK.currentArtist, null); }
  function setCurrentArtistId(id){ LocalStore.set(LSK.currentArtist, id||null); }

  function getSettingsForArtist(artistId){
    const sKey = settingsKeyForArtist(artistId);
    const vKey = schemaKeyForArtist(artistId);
    const ver  = Number(LocalStore.get(vKey, 0)) || 0;
    const raw  = LocalStore.get(sKey, null);
    const sane = sanitize(raw);
    if (ver !== SCHEMA_VERSION){
      LocalStore.set(sKey, sane);
      LocalStore.set(vKey, SCHEMA_VERSION);
    }
    return sane;
  }
  function setSettingsForArtist(artistId, s){
    const sKey = settingsKeyForArtist(artistId);
    const vKey = schemaKeyForArtist(artistId);
    LocalStore.set(sKey, sanitize(s));
    LocalStore.set(vKey, SCHEMA_VERSION);
  }

  let CUR_ARTIST_ID = getCurrentArtistId() || null;
  let S = getSettingsForArtist(CUR_ARTIST_ID);
  function saveSettings(next){ S = sanitize(next||S); setSettingsForArtist(CUR_ARTIST_ID, S); }

  /* ===== Tiny utils ===== */
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc = (s)=>String(s??'').replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  function toDateOnly(d){ const t=new Date(d); if(Number.isNaN(+t)) return null; return new Date(t.getFullYear(),t.getMonth(),t.getDate()); }
  function parseYMD(s){ if(!s) return null; const t=new Date(s); if(Number.isNaN(+t)) return null; return new Date(t.getFullYear(),t.getMonth(),t.getDate()); }
  function nextFromRecurrence(rec, now){
    if(!rec || !rec.r) return null;
    const R = rec.r || {}; const freq=String(R.freq||'').toUpperCase(); const interval=Math.max(1, Number(R.interval||1));
    let cur = parseYMD(R.start||new Date()); if(!cur) return null;
    now = toDateOnly(now||new Date());
    function step(d){ if(freq==='DAILY') d.setDate(d.getDate()+interval); else if(freq==='WEEKLY') d.setDate(d.getDate()+7*interval); else if(freq==='MONTHLY') d.setMonth(d.getMonth()+interval); else if(freq==='YEARLY') d.setFullYear(d.getFullYear()+interval); else d.setDate(d.getDate()+interval); }
    let n=0; while(cur<now && n<512){ step(cur); n++; }
    return cur>=now?cur:null;
  }
  function nextOccurrence(val, now){
    if(!val) return null;
    if(typeof val==='string'){ const t=parseYMD(val); return (t && t>=toDateOnly(now||new Date())) ? t : null; }
    if(typeof val==='object' && val.r) return nextFromRecurrence(val, now);
    return null;
  }

  function numberFromId(id){ const m=String(id||'').match(/(\d+)/); return m?m[1]:''; }
  function labelFor(id){
    const hl = S.heroLabels || {};
    const custom = hl[id];
    if (custom && custom.trim()) return custom.trim();
    const n = numberFromId(id); return n?`#${n}`:id;
  }
  function styleFor(id){
    const st = (S.heroStyle||{})[id] || {};
    return {
      color: st.labelColor || '',
      font:  st.labelFont || "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif",
      size:  Number(st.labelSize || 18)
    };
  }

  function computeHeroState(id){
    const f   = (S.heroFlags||{})[id] || {};
    const sch = (S.heroSchedule||{})[id] || {};
    const today=toDateOnly(new Date());
    const rel=parseYMD(typeof sch.release==='string'?sch.release:sch.release?.r?.start);
    const exp=parseYMD(typeof sch.expiry==='string'?sch.expiry:sch.expiry?.r?.start);
    const dev=parseYMD(typeof sch.dev==='string'?sch.dev:sch.dev?.r?.start);
    if(exp && exp<=today) return 'off';
    if(rel && rel<=today) return 'live';
    if(dev && dev<=today) return 'dev';
    return f.state || 'off';
  }

  /* ===== DOM builders ===== */
  function heroCard(id, staff, role){
    const f          = (S.heroFlags||{})[id];
    if (!f || f.place !== 'page') return null;

    const asset      = (S.heroAssets?.[id]?.heroCard) || {};
    const art        = asset.src || '';
    const fitCss     = asset.fit || 'cover';
    const posCss     = asset.pos || '50% 50%';
    const st         = styleFor(id);
    const state      = computeHeroState(id);

    if(!staff){
      if(state!=='live') return null;
      if(!(f.aud && f.aud[role])) return null;
    }

    const el = document.createElement('article');
    el.className = 'hero shape-' + (f.shape || 'square');
    el.dataset.heroId = id;

    if (staff) {
      if (state === 'live') el.classList.add('state-live');
      else if (state === 'dev') el.classList.add('state-dev');
      else el.classList.add('state-off');
    }

    el.innerHTML = `
      ${art ? `<div class="art"></div>` : ''}
      <span class="label" style="color:${esc(st.color)};font-family:${esc(st.font)};font-size:${st.size}px">${esc(labelFor(id))}</span>
      <div class="ctrls"></div>
    `;

    if (art){
      const artWrap = el.querySelector('.art');
      const img = document.createElement('img');
      img.alt = '';
      img.src = art;
      img.setAttribute('referrerpolicy', 'no-referrer');
      img.setAttribute('crossorigin', 'anonymous');
      img.style.objectFit = fitCss;
      img.style.objectPosition = posCss;
      img.addEventListener('error', () => console.warn('[hero cover load failed]', id, img.src));
      artWrap.appendChild(img);
    }

    // inline schedule chip (soonest)
    const sch = (S.heroSchedule||{})[id] || {};
    const nextRel = nextOccurrence(sch.release);
    const nextDev = nextOccurrence(sch.dev);
    const nextExp = nextOccurrence(sch.expiry);
    const items = [];
    if (nextRel) items.push(['Live','green', nextRel]);
    else if (nextDev) items.push(['Dev','blue', nextDev]);
    if (nextExp) items.push(['Exp','red', nextExp]);
    items.sort((a,b)=>a[2]-b[2]);
    if (items.length){
      const [label,color,date] = items[0];
      const days = Math.ceil((toDateOnly(date) - toDateOnly(new Date()))/86400000);
      const chip = document.createElement('div');
      chip.className = 'sched-chip ' + color;
      chip.textContent = `${label}: ${days} day${days===1?'':'s'}`;
      el.appendChild(chip);
    }

    // audience dots (staff view)
    if (staff && f.aud){
      const dots = document.createElement('div');
      dots.style.cssText='position:absolute;right:10px;bottom:10px;display:flex;gap:6px;z-index:2;';
      [['gold','Advanced'],['silver','Intermediate'],['bronze','Beginner']].forEach(([k,t])=>{
        if (f.aud[k]) dots.innerHTML += `<span class="aud-dot ${k}" title="${t}"></span>`;
      });
      if (dots.innerHTML) el.appendChild(dots);
    }

    return el;
  }

  function dividerEl(obj, editable=false){
    const color = obj.color || '';
    const fontFamily = obj.fontFamily || "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";
    const fontSize = Number(obj.fontSize || 22);
    const el = document.createElement('div');
    el.className = 'divider'; el.dataset.type='divider'; el.dataset.divId=obj.id;
    el.innerHTML = `
      <span class="htext" style="color:${esc(color)};font-family:${esc(fontFamily)};font-size:${fontSize}px">${esc(obj.title || 'Heading')}</span>
      <div class="tools"><div class="aud-indicators-head"></div></div>`;
    return el;
  }

  function aggregateHeadingAudience(rowEl){
    const heroFlags = S.heroFlags || {};
    const agg={bronze:false,silver:false,gold:false};
    rowEl.querySelectorAll('.hero').forEach(h=>{
      const id=h.dataset.heroId; const f=heroFlags[id]; if(!f) return;
      const state=computeHeroState(id);
      if(state!=='live') return;
      if(f.aud){ agg.bronze ||= !!f.aud.bronze; agg.silver ||= !!f.aud.silver; agg.gold ||= !!f.aud.gold; }
    });
    return agg;
  }

  /* ===== Public: paint home grid ===== */
  function paintHome(){
    // solid black page – remove any background image layers if present
    document.body.style.background = '#000';
    $$('.bg').forEach(n=>n.remove());

    // ensure container exists
    let root = $('#pageGrid');
    if (!root) {
      root = document.createElement('div');
      root.id = 'pageGrid';
      document.body.appendChild(root);
    }
    root.innerHTML = '';

    // role gating (home shows everything for staff/admin only)
    // In "home" we assume staff view to preview the layout
    const staff = true;
    const role  = 'admin';

    function startSection(divObj){
      const sec=document.createElement('section'); sec.className='section';
      if(divObj) sec.appendChild(dividerEl(divObj));
      const rowSize = divObj?.rowSize || 'm';
      const row=document.createElement('div'); row.className=`grid size-${rowSize}`;
      sec.appendChild(row); root.appendChild(sec);
      return {sec,row};
    }

    const pageOrder = S.pageOrder || [];
    let currentRow=null;

    for(const it of pageOrder){
      if(it.type==='divider'){ const s=startSection(it); currentRow=s.row; continue; }
      if(it.type==='hero'){
        const card = heroCard(it.id, staff, role);
        if(!card) continue;
        if(!currentRow){ const s=startSection(null); currentRow=s.row; }
        currentRow.appendChild(card);
      }
    }

    // remove empty sections and set audience indicators
    $$('#pageGrid .section').forEach(sec=>{
      const row = sec.querySelector('.grid');
      const hasHeroes = row && row.children.length>0;
      const hasDivider = !!sec.querySelector('.divider');
      if(!hasHeroes && !hasDivider){ sec.remove(); return; }
      const slot = sec.querySelector('.aud-indicators-head');
      if(slot){
        const agg=aggregateHeadingAudience(row);
        const items=[['gold','Advanced'],['silver','Intermediate'],['bronze','Beginner']].filter(([k])=>agg[k]);
        slot.innerHTML = items.map(([k,t])=>`<span class="aud-dot ${k}" title="${t}"></span>`).join('');
      }
    });
  }

  /* ===== Export to window ===== */
  window.AppHome = {
    paint: paintHome,
    reloadArtist(artistId){
      setCurrentArtistId(artistId||null);
      CUR_ARTIST_ID = artistId||null;
      S = getSettingsForArtist(CUR_ARTIST_ID);
      paintHome();
    },
    saveSettings // exposed in case the dock updates S
  };

  // Auto-paint on load
  if (document.readyState !== 'loading') paintHome();
  else document.addEventListener('DOMContentLoaded', paintHome);
})(); 