// /assets/course/pages/activity.js
// Activity page with Dev Dock–driven edit/view + save-on-input
// Sections: Text • Audio • Video • Quiz
// Seeds one of each section (sample course: Jody Graham)
//
// Updates (v2):
// - Persist picked images/audio/video to IndexedDB (fallback to small data-URLs) and mirror refs in localStorage.
// - Resolve stored media via object URLs at render time (works offline).
// - No regression to text typing behavior (no re-render while typing).
// - Hero background image/video now persists reliably after device pick.
// - Upload buttons for audio/video remain; now use the asset store.
// - Gentle textarea autosize.

function getS(){ return window.AppHome?.getSettings?.() || {}; }
function setS(s){
  try { window.AppHome?.setSettings?.(s); } catch {}
  // Always mirror to localStorage for backup
  try { localStorage.setItem('__activityPageStore__', JSON.stringify(s || {})); } catch {}
}
// Fallback read from localStorage (in case AppHome unavailable or to restore latest draft)
function getLS(){
  try {
    const raw = localStorage.getItem('__activityPageStore__');
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

const $ = (sel, r=document)=> r.querySelector(sel);

// key helper
function k(heroId, instanceId){ return `${heroId || 'course'}::${instanceId || 'A1'}`; }

/* ---------------- Asset Store (IndexedDB + fallback) ---------------- */
const AssetStore = (()=>{
  const DB_NAME = 'ActivityAssets';
  const STORE = 'files';
  const SCHEME = 'idb://'; // model URLs look like idb://<id>
  const SMALL_DATAURL_LIMIT = 2 * 1024 * 1024; // 2MB threshold for dataURL fallback

  let _dbp;
  let _urlCache = new Map(); // id -> objectURL (revoke on unmount)

  function openDB(){
    if (_dbp) return _dbp;
    _dbp = new Promise((resolve, reject)=>{
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = (e)=>{
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE)){
            db.createObjectStore(STORE, { keyPath: 'id' });
          }
        };
        req.onsuccess = ()=> resolve(req.result);
        req.onerror = ()=> reject(req.error || new Error('IndexedDB open error'));
      } catch (err){
        reject(err);
      }
    });
    return _dbp;
  }

  async function saveFile(file){
    // If file is small, fallback to dataURL so we don't rely on IDB everywhere
    try {
      if (file.size <= SMALL_DATAURL_LIMIT){
        const dataUrl = await fileToDataURL(file);
        return { url: dataUrl, scheme: 'data' };
      }
    } catch {}
    try {
      const db = await openDB();
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
      const rec = { id, type: file.type, name: file.name, blob: file };
      await new Promise((res, rej)=>{
        const tx = db.transaction(STORE, 'readwrite');
        tx.oncomplete = ()=> res();
        tx.onerror = ()=> rej(tx.error);
        tx.objectStore(STORE).put(rec);
      });
      return { url: SCHEME + id, scheme: 'idb' };
    } catch (e){
      // last resort: try dataURL (may fail for very large)
      const dataUrl = await fileToDataURL(file);
      return { url: dataUrl, scheme: 'data' };
    }
  }

  async function getBlobById(id){
    const db = await openDB();
    return await new Promise((res, rej)=>{
      const tx = db.transaction(STORE, 'readonly');
      tx.onerror = ()=> rej(tx.error);
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = ()=> res(req.result ? req.result.blob : null);
      req.onerror = ()=> rej(req.error);
    });
  }

  async function fileToDataURL(file){
    return await new Promise((res, rej)=>{
      const fr = new FileReader();
      fr.onload = ()=> res(String(fr.result || ''));
      fr.onerror = ()=> rej(fr.error || new Error('FileReader error'));
      fr.readAsDataURL(file);
    });
  }

  async function resolveUrl(url){
    if (!url) return '';
    if (!url.startsWith(SCHEME)) return url;
    const id = url.slice(SCHEME.length);
    if (_urlCache.has(id)) return _urlCache.get(id);
    try {
      const blob = await getBlobById(id);
      if (!blob) return '';
      const objUrl = URL.createObjectURL(blob);
      _urlCache.set(id, objUrl);
      return objUrl;
    } catch { return ''; }
  }

  function revokeAll(){
    for (const u of _urlCache.values()){
      try { URL.revokeObjectURL(u); } catch {}
    }
    _urlCache.clear();
  }

  return { saveFile, resolveUrl, revokeAll, SCHEME };
})();

/* ---------------- safe element helper ---------------- */
function h(tag, attrs = {}, children){
  const el = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs||{})){
    if (k === 'style'){
      if (v && typeof v === 'object') Object.assign(el.style, v);
      else if (v != null) el.setAttribute('style', String(v)); // safe for strings
    } else if (k in el){
      try { el[k] = v; } catch { el.setAttribute(k, v); }
    } else {
      el.setAttribute(k, v);
    }
  }
  if (children != null){
    (Array.isArray(children)?children:[children]).forEach(c=>{
      if (c == null) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
  }
  return el;
}

/* ---------------- debounce + saves ---------------- */
function debounce(fn, ms=180){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
// softSave: save to model store but DON'T repaint UI
const softSave = debounce((heroId, instId, patch)=> writeModel(heroId, instId, patch, false), 150);
// hardSave: save and optionally repaint (used for structural changes or hero swap)
function hardSave(heroId, instId, patch){ writeModel(heroId, instId, patch, true); }

/* ---------------- model ---------------- */
const SECTION_TYPES = ['text','audio','video','quiz'];

function defaultModel(){
  return {
    title: 'Expressive Portraits — Activity',
    subtitle: 'Hands-on practice with Jody Graham',
    desc: 'Work through these guided exercises to loosen your line and deepen your observation.',
    heroType: 'image',
    heroUrl: 'https://images.unsplash.com/photo-1526318472351-c75fcf070305?q=80&w=1600&auto=format&fit=crop',
    sections: [
      {
        id: 't1',
        type: 'text',
        enabled: true,
        heading: 'Gesture Warm-up',
        text: 'Start with three 60-second portrait sketches. Focus on capturing movement, not accuracy. Use broad, sweeping lines.',
        url: '',
        q: '',
        a: ''
      },
      {
        id: 'a1',
        type: 'audio',
        enabled: true,
        heading: 'Artist Commentary (Audio)',
        text: '',
        url: 'https://www.kozco.com/tech/piano2-CoolEdit.mp3',
        q: '',
        a: ''
      },
      {
        id: 'v1',
        type: 'video',
        enabled: true,
        heading: 'Layering Techniques (Video)',
        text: '',
        url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        q: '',
        a: ''
      },
      {
        id: 'q1',
        type: 'quiz',
        enabled: true,
        heading: 'Quick Knowledge Check',
        text: '',
        url: '',
        q: 'Why do we start with fast sketches before detailed portraits?',
        a: 'To loosen up and train the eye to see big shapes before focusing on detail.'
      }
    ]
  };
}

// Merge helpers: prefer latest from localStorage when present
function mergedStore(){
  const S = getS() || {};
  const L = getLS() || {};
  // shallow merge, but keep nested pageData from both sides
  const out = { ...S, ...L };
  out.pageData = { ...(S.pageData||{}), ...(L.pageData||{}) };
  return out;
}

function loadModel(heroId, instanceId){
  const all = mergedStore();
  const key = k(heroId, instanceId);
  const heroKey = heroId;
  all.pageData ??= {};
  all.pageData[heroKey] ??= {};
  all.pageData[heroKey].activity ??= {};
  let cur = all.pageData[heroKey].activity[key];

  if (!cur){
    cur = defaultModel();
    all.pageData[heroKey].activity[key] = cur;
    setS(all); // also mirrors to localStorage
  }
  // normalize
  cur.title    = cur.title    || 'Activity';
  cur.subtitle = cur.subtitle || '';
  cur.desc     = cur.desc     || '';
  cur.heroType = (cur.heroType === 'video' ? 'video' : 'image');
  cur.heroUrl  = String(cur.heroUrl || '');
  cur.sections = Array.isArray(cur.sections) ? cur.sections : [];
  return cur;
}

function writeModel(heroId, instanceId, patchOrFull, repaint){
  // always work against the merged (AppHome+localStorage) store
  const S = mergedStore();
  const key = k(heroId, instanceId);
  const heroKey = heroId;

  S.pageData ??= {};
  S.pageData[heroKey] ??= {};
  S.pageData[heroKey].activity ??= {};

  const prev = S.pageData[heroKey].activity[key] || defaultModel();

  // Allow both patch objects and full model replacements
  let next;
  if (patchOrFull && patchOrFull.sections && Array.isArray(patchOrFull.sections)) {
    // assume full
    next = cleanModel(patchOrFull);
  } else {
    next = { ...prev, ...patchOrFull };
  }
  S.pageData[heroKey].activity[key] = cleanModel(next);
  setS(S); // writes both AppHome store and localStorage mirror
  if (repaint) { try { window.AppHome?.paint?.(); } catch {} }
}

function cleanModel(m){
  return {
    title:    String(m.title || '').trim(),
    subtitle: String(m.subtitle || '').trim(),
    desc:     String(m.desc || ''),
    heroType: (m.heroType === 'video' ? 'video' : 'image'),
    heroUrl:  String(m.heroUrl || ''),
    sections: (Array.isArray(m.sections) ? m.sections : []).map(s => {
      const type = SECTION_TYPES.includes(s.type) ? s.type : 'text';
      return {
        id:      s.id || Math.random().toString(36).slice(2,8),
        type,
        enabled: !!s.enabled,
        heading: String(s.heading || ''),
        text:    String(s.text || ''),
        url:     String(s.url || ''),
        q:       String(s.q || ''),
        a:       String(s.a || '')
      };
    })
  };
}

/* ---------------- helpers ---------------- */
function autosizeTextarea(ta){
  const fit = ()=>{
    ta.style.height = 'auto';
    ta.style.height = (ta.scrollHeight + 2) + 'px';
  };
  ta.addEventListener('input', fit);
  setTimeout(fit, 0);
}
function isIDB(url){ return typeof url === 'string' && url.startsWith(AssetStore.SCHEME); }

/* ---------------- hero ---------------- */
function heroBlock(model, editMode, onPick){
  const wrap = h('div', { className:'activity-hero' });

  // container for image/video
  const mediaHolder = h('div', { className:'activity-hero-img' });
  const fade = h('div', { className:'activity-hero-fade' });

  // Render current hero
  (async ()=>{
    const src = await AssetStore.resolveUrl(model.heroUrl);
    // Decide between video and background image
    if (model.heroType === 'video' && src){
      const vid = h('video', { className:'activity-hero-img', autoplay:true, muted:true, loop:true, playsInline:true });
      vid.src = src;
      wrap.appendChild(vid);
    } else {
      Object.assign(mediaHolder.style, src ? { backgroundImage:`url("${src}")` } : {});
      wrap.appendChild(mediaHolder);
    }
    wrap.appendChild(fade);
  })();

  if (editMode){
    const row = h('div', { className:'activity-hero-ctrl' });
    const pick = h('button', { className:'pgs-enroll', textContent:'Change image/video', type:'button' });
    const clr  = h('button', { className:'pgs-list',   textContent:'Clear',               type:'button' });

    pick.onclick = async ()=>{
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*,video/*';
      inp.style.display = 'none';
      document.body.appendChild(inp);
      inp.addEventListener('change', async ()=>{
        const f = inp.files?.[0]; if (!f) return;
        const isVid = (f.type||'').startsWith('video');
        const { url } = await AssetStore.saveFile(f);
        onPick({ heroType: isVid ? 'video' : 'image', heroUrl: url });
      }, { once:true });
      inp.click();
    };
    clr.onclick = ()=> onPick({ heroType:'image', heroUrl:'' });

    row.appendChild(pick);
    row.appendChild(clr);
    wrap.appendChild(row);
  }
  return wrap;
}

/* ---------------- meta ---------------- */
function metaBlock(model, editMode, onChange){
  const wrap = h('div', { className:'activity-meta' });

  if (editMode){
    const t = h('input',    { className:'pgs-input activity-title-in', value:model.title,    placeholder:'Title…' });
    const s = h('input',    { className:'pgs-input activity-sub-in',   value:model.subtitle, placeholder:'Subtitle…' });
    const d = h('textarea', { className:'pgs-input pgs-area activity-desc-in', value:model.desc, placeholder:'Description…', rows: 4 });

    autosizeTextarea(d);

    t.addEventListener('input', debounce(()=> onChange({ title: t.value }), 120));
    s.addEventListener('input', debounce(()=> onChange({ subtitle: s.value }), 120));
    d.addEventListener('input', debounce(()=> onChange({ desc: d.value }), 150));

    wrap.appendChild(t); wrap.appendChild(s); wrap.appendChild(d);
  } else {
    wrap.appendChild(h('h1', { className:'activity-title', textContent:model.title }));
    wrap.appendChild(h('p',  { className:'activity-sub',   textContent:model.subtitle }));
    wrap.appendChild(h('div',{ className:'activity-body',  textContent:model.desc }));
  }
  return wrap;
}

/* ---------------- sections (view) ---------------- */
function renderViewSection(sec){
  const box = h('section', { className:'act-sec' });
  box.appendChild(h('h3', { className:'act-sec-h', textContent: sec.heading || 'Untitled' }));

  if (sec.type === 'text'){
    box.appendChild(h('div', { className:'act-sec-body', textContent: sec.text || '' }));
  } else if (sec.type === 'audio' && sec.url){
    const audio = h('audio', { controls:true });
    // Async resolve for idb://
    AssetStore.resolveUrl(sec.url).then((src)=>{ audio.src = src || ''; });
    Object.assign(audio.style, { width:'100%', display:'block', borderRadius:'12px' });
    box.appendChild(audio);
  } else if (sec.type === 'video' && sec.url){
    const video = h('video', { controls:true, playsInline:true });
    AssetStore.resolveUrl(sec.url).then((src)=>{ video.src = src || ''; });
    Object.assign(video.style, { width:'100%', display:'block', borderRadius:'12px', background:'#000' });
    box.appendChild(video);
  } else if (sec.type === 'quiz'){
    const q = h('div', { className:'pgs-summary-text', textContent: sec.q || '' });
    const ans = h('details', {}, [
      h('summary', { textContent:'Show answer' }),
      h('div', { className:'pgs-muted', textContent: sec.a || '', style:{ marginTop:'6px' } })
    ]);
    box.appendChild(q);
    box.appendChild(ans);
  }
  return box;
}

/* ---------------- sections (edit) ---------------- */
function field(label, node){
  const wrap = h('div', { className:'pgs-field' });
  wrap.appendChild(h('label', { className:'pgs-label', textContent:label }));
  wrap.appendChild(node);
  return wrap;
}

function editCard(sec, idx, apply){
  const card  = h('div', { className:'act-card', id:'card-'+sec.id });
  const head  = h('div', { className:'act-card-head' });
  const left  = h('div', { className:'act-card-left' });
  const right = h('div', { className:'act-card-right' });

  const onOff = h('input', { type:'checkbox', checked:!!sec.enabled });
  onOff.onchange = ()=> apply(idx, { enabled: !!onOff.checked }, { structure:false });

  const sel = h('select', { className:'pgs-input', style:{ width:'160px' } });
  ['text','audio','video','quiz'].forEach(t=>{
    const opt = h('option', { value:t, textContent: t[0].toUpperCase()+t.slice(1) });
    if (t === sec.type) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.onchange = ()=>{
    const t = sel.value;
    const base = { type:t, text:'', url:'', q:'', a:'' };
    if (t === 'text')  base.text = sec.text || '';
    if (t === 'audio' || t === 'video') base.url = sec.url || '';
    if (t === 'quiz'){ base.q = sec.q || ''; base.a = sec.a || ''; }
    apply(idx, base, { replaceType:true, structure:true });
  };

  left.appendChild(h('label', { className:'act-onoff' }, [onOff, ' Show']));
  left.appendChild(sel);

  const up   = h('button', { className:'pgs-list', textContent:'▲', title:'Up',   type:'button' });
  const down = h('button', { className:'pgs-list', textContent:'▼', title:'Down', type:'button' });
  const del  = h('button', { className:'pgs-list', textContent:'✕', title:'Remove', type:'button' });

  up.onclick   = ()=> apply(idx, { _move:-1 }, { structure:true });
  down.onclick = ()=> apply(idx, { _move:+1 }, { structure:true });
  del.onclick  = ()=> apply(idx, { _delete:true }, { structure:true });

  right.appendChild(up); right.appendChild(down); right.appendChild(del);
  head.appendChild(left); head.appendChild(right);
  card.appendChild(head);

  const body = h('div', { className:'act-card-body' });

  const heading = h('input', { className:'pgs-input', value: sec.heading || '', placeholder:'Section heading…' });
  heading.addEventListener('input', debounce(()=> apply(idx, { heading: heading.value }, { structure:false }), 140));
  body.appendChild(field('Heading', heading));

  if (sec.type === 'text'){
    const ta = h('textarea', { className:'pgs-input pgs-area', value: sec.text || '', placeholder:'Write text…', rows: 4 });
    autosizeTextarea(ta);
    ta.addEventListener('input', debounce(()=> apply(idx, { text: ta.value }, { structure:false }), 160));
    body.appendChild(field('Text', ta));
  } else if (sec.type === 'audio' || sec.type === 'video'){
    const url = h('input', { className:'pgs-input', value: sec.url || '', placeholder: sec.type==='audio' ? 'https://… .mp3/.m4a or Upload' : 'https://… .mp4 or Upload' });
    url.addEventListener('input', debounce(()=> apply(idx, { url: url.value }, { structure:false }), 160));

    // file picker to store media using AssetStore
    const pick = h('button', { className:'pgs-list', type:'button', textContent:'Upload file' });
    pick.onclick = ()=>{
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = sec.type === 'audio' ? 'audio/*' : 'video/*';
      inp.style.display = 'none';
      document.body.appendChild(inp);
      inp.addEventListener('change', async ()=>{
        const f = inp.files?.[0]; if (!f) return;
        const { url: stored } = await AssetStore.saveFile(f);
        apply(idx, { url: stored }, { structure:false });
        url.value = stored;
      }, { once:true });
      inp.click();
    };

    const row = h('div', { className:'pgs-field' });
    row.appendChild(url);
    row.appendChild(pick);
    body.appendChild(field(sec.type==='audio' ? 'Audio URL / Upload' : 'Video URL / Upload', row));
  } else if (sec.type === 'quiz'){
    const q = h('input', { className:'pgs-input', value: sec.q || '', placeholder:'Question…' });
    const a = h('input', { className:'pgs-input', value: sec.a || '', placeholder:'Answer…' });
    q.addEventListener('input', debounce(()=> apply(idx, { q: q.value }, { structure:false }), 140));
    a.addEventListener('input', debounce(()=> apply(idx, { a: a.value }, { structure:false }), 140));
    body.appendChild(field('Question', q));
    body.appendChild(field('Answer', a));
  }

  card.appendChild(body);
  return card;
}

/* ---------------- main mount ---------------- */
export async function mount(host, ctx){
  const heroId     = ctx.heroId;
  const instanceId = ctx.instanceId || 'activity-1';

  // Expose context (optional)
  try { window.__currentBuilderPage = { ctx: { heroId, instanceId, pageKey:'activity' } }; } catch {}

  let model = loadModel(heroId, instanceId);
  let editMode = !!window.__DEV_MODE__;
  let lastAddedId = null;

  const wrap = h('div', { className:'activity-wrap' });
  host.appendChild(wrap);

  function render(){
    wrap.innerHTML = '';

    wrap.appendChild(
      heroBlock(model, editMode, (patch)=>{
        model = { ...model, ...patch };
        // Save hero and repaint to show immediately
        hardSave(heroId, instanceId, { heroType:model.heroType, heroUrl:model.heroUrl });
        render();
      })
    );

    wrap.appendChild(
      metaBlock(model, editMode, (patch)=>{
        model = { ...model, ...patch };
        // Save but do NOT re-render to avoid typing disruption
        softSave(heroId, instanceId, patch);
      })
    );

    if (editMode){
      // add row
      const addRow = h('div', { className:'act-add' });
      ['text','audio','video','quiz'].forEach(t=>{
        const b = h('button', { className:'pgs-enroll', type:'button', textContent:`+ ${t[0].toUpperCase()+t.slice(1)}` });
        Object.assign(b.style, { height:'28px', padding:'0 6px', borderRadius:'8px', fontSize:'12px', lineHeight:'1' });
        b.onclick = ()=>{
          const id = 's' + Math.random().toString(36).slice(2,8);
          model.sections = [...model.sections, { id, type:t, enabled:true, heading:t==='quiz'?'Test your knowledge':t[0].toUpperCase()+t.slice(1), text:'', url:'', q:'', a:'' }];
          hardSave(heroId, instanceId, { sections:model.sections });
          lastAddedId = id;
          render();
        };
        addRow.appendChild(b);
      });
      wrap.appendChild(addRow);
    }

    const secWrap = h('div', { className:'activity-sections' });
    wrap.appendChild(secWrap);

    if (!editMode){
      const enabled = model.sections.filter(s=>!!s.enabled);
      if (!enabled.length){
        secWrap.appendChild(h('div', { className:'pgs-muted', textContent:'No sections enabled.' }));
      } else {
        enabled.forEach(s=> secWrap.appendChild(renderViewSection(s)));
      }

      const cont = h('div', { className:'act-continue-row' });
      const go   = h('button', { className:'act-continue-btn', type:'button', textContent:'Continue' });
      go.onclick = ()=> { try { window.BuilderHamburger?.openNextEnabledPage?.(heroId); } catch {} };
      cont.appendChild(go);
      wrap.appendChild(cont);
    } else {
      // edit cards
      const apply = (idx, patch, opts={})=>{
        const arr = model.sections.slice();
        const isDelete = !!patch._delete;
        const isMoveUp = patch._move === -1 && idx>0;
        const isMoveDn = patch._move === +1 && idx<arr.length-1;
        const replaceType = !!(opts && opts.replaceType);
        const structure = !!(opts && opts.structure);

        if (isDelete){ arr.splice(idx,1); }
        else if (isMoveUp){ const s=arr.splice(idx,1)[0]; arr.splice(idx-1,0,s); }
        else if (isMoveDn){ const s=arr.splice(idx,1)[0]; arr.splice(idx+1,0,s); }
        else {
          const cur = arr[idx];
          arr[idx] = replaceType
            ? { ...cur, type:patch.type, text:patch.text, url:patch.url, q:patch.q, a:patch.a }
            : { ...cur, ...patch };
        }

        model.sections = arr;

        // Always save changes (both structure + content) to stores
        if (structure || isDelete || isMoveUp || isMoveDn || replaceType){
          // Structure change: hard save + re-render to reflect order/visibility/type
          hardSave(heroId, instanceId, { sections: arr });
          render();
        } else {
          // Content change (typing): save softly and DO NOT re-render to keep caret/focus
          softSave(heroId, instanceId, { sections: arr });
        }
      };

      model.sections.forEach((s,i)=> secWrap.appendChild(editCard(s,i,apply)));

      // disabled continue (preview only)
      const prev = h('div', { className:'act-continue-row' });
      const btn  = h('button', { className:'act-continue-btn', textContent:'Continue', disabled:true, type:'button' });
      btn.style.opacity = '.6'; btn.style.pointerEvents = 'none';
      prev.appendChild(btn);
      wrap.appendChild(prev);

      // focus last added
      if (lastAddedId){
        const el = document.getElementById('card-'+lastAddedId);
        if (el) {
          el.scrollIntoView({ behavior:'smooth', block:'center' });
          el.classList.add('highlight-new');
          setTimeout(()=> el.classList.remove('highlight-new'), 1200);
        }
        lastAddedId = null;
      }
    }
  }

  // dev:mode integration
  const onDev = (e)=>{
    const on = !!e.detail?.on;
    if (editMode && !on){
      model = loadModel(heroId, instanceId);
    }
    editMode = on;
    render();
  };
  window.addEventListener('dev:mode', onDev);
  host.__actDev = onDev;

  render();
}

export async function unmount(host){
  try { if (host && host.__actDev) window.removeEventListener('dev:mode', host.__actDev); } catch {}
  if (host) host.innerHTML = '';
  try { AssetStore.revokeAll(); } catch {}
}
 