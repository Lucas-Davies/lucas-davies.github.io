// /assets/course/pages/preview.js
// Compact Preview with full-bleed hero (CSS-controlled) + Trailer lightbox.
// Dev Dock integration: edit mode is driven by `dev:mode` (no Builder edit button).
// All edits persist on data entry (debounced). Also seeds example data for
// Jody Graham’s $40 portrait course if the model is empty.

/* ---------------- state + tiny utils ---------------- */
function getS(){ return window.AppHome?.getSettings?.() || {}; }
function setS(s){ try{ window.AppHome?.setSettings?.(s); }catch{} }

const h = (tag, props={}, children=[])=>{
  const el = document.createElement(tag);
  for (const [k,v] of Object.entries(props)){
    if (k === 'style' && v) Object.assign(el.style, v);
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v);
  }
  (Array.isArray(children)?children:[children]).forEach(c=>{
    if (c!=null) el.appendChild(typeof c==='string'?document.createTextNode(c):c);
  });
  return el;
};
const digitsOnly = v => String(v||'').replace(/[^\d]/g,'');
const isPaid     = v => Number(digitsOnly(v)||0) > 0;

/* --- debounce (for save-on-input) --- */
function debounce(fn, ms=180){
  let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); };
}

const ALL_TABS = ['Course Trailer','Course Structure','Requirements'];
const sanitizeTabs = (arr)=> {
  const set = new Set(Array.isArray(arr)?arr:[]);
  if (!set.size) return [...ALL_TABS];
  return ALL_TABS.filter(t => set.has(t));
};
const getHeroLabel = (id)=> getS().heroLabels?.[id] || id;

/* ---------------- video helpers ---------------- */
function parseVideo(url){
  const s = String(url||'').trim();
  if (!s) return { type:'none' };
  const yt = s.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/i);
  if (yt) return { type:'youtube', embed:`https://www.youtube.com/embed/${yt[1]}?rel=0&autoplay=1` };
  const vm = s.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vm) return { type:'vimeo', embed:`https://player.vimeo.com/video/${vm[1]}?autoplay=1` };
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(s)) return { type:'mp4', src:s };
  return { type:'unknown', raw:s };
}
function readBgFromDOM(root){
  const n = root?.querySelector?.('.pgs-bg-img');
  if (!n) return null;
  const bi = n.style.backgroundImage || getComputedStyle(n).backgroundImage || '';
  const m = bi.match(/url\((['"]?)(.*?)\1\)/);
  return m ? m[2] : null;
}

function makeLightbox(){
  let node = document.getElementById('pgs-video-modal');
  if (node) node.remove();

  node = h('div', { id:'pgs-video-modal', className:'pgs-video-modal', style:{
    position:'fixed', inset:'0', display:'none', zIndex:'99999'
  }});
  const backdrop = h('div', { className:'pgs-video-backdrop', style:{ position:'absolute', inset:'0' }});
  const sheet = h('div', { className:'pgs-video-sheet', style:{
    position:'absolute', inset:'0', display:'grid', placeItems:'center', padding:'20px'
  }});
  const box = h('div', { className:'pgs-video-box', style:{ position:'relative', width:'min(100%, 980px)', aspectRatio:'16/9' }});
  const close = h('button', { className:'pgs-video-close', textContent:'×', style:{
    position:'absolute', top:'-44px', right:'0', fontSize:'28px', lineHeight:'1',
    cursor:'pointer'
  }});

  sheet.appendChild(box);
  node.appendChild(backdrop);
  sheet.appendChild(close);
  node.appendChild(sheet);
  document.body.appendChild(node);

  function clearBox(){ while (box.firstChild) box.removeChild(box.firstChild); }
  function open(url){
    const meta = parseVideo(url);
    clearBox();
    if (meta.type==='youtube' || meta.type==='vimeo'){
      const ifr = h('iframe', { src: meta.embed, allow:'autoplay; encrypted-media', allowFullscreen:true, style:{
        width:'100%', height:'100%', border:'0', borderRadius:'12px'
      }});
      box.appendChild(ifr);
    } else if (meta.type==='mp4'){
      const vid = h('video', { src: meta.src, controls:true, autoplay:true, style:{
        width:'100%', height:'100%', borderRadius:'12px', background:'#000'
      }});
      box.appendChild(vid);
    } else {
      const msg = h('div', { textContent:'Video coming soon.', style:{
        display:'grid', placeItems:'center', width:'100%', height:'100%', borderRadius:'12px'
      }});
      box.appendChild(msg);
    }
    node.style.display = 'block';
    document.body.classList.add('pgs-modal-open');
  }
  function closeModal(){
    node.style.display = 'none';
    document.body.classList.remove('pgs-modal-open');
    clearBox();
  }
  backdrop.onclick = closeModal;
  close.onclick = closeModal;

  return { open, close: closeModal, el: node };
}

/* ---------------- model load/save ---------------- */
function loadModel(heroId){
  const cur = getS().pageData?.[heroId]?.preview || {};
  const req = cur.requirements || {};
  return {
    image:   cur.image   || '',
    price:   String(cur.price || ''),
    summary: cur.summary || 'Write a short, compelling description for prospective learners.',
    audience: {
      beginner:     cur.audience?.beginner     ?? true,
      intermediate: cur.audience?.intermediate ?? true,
      advanced:     cur.audience?.advanced     ?? false
    },
    tabs: sanitizeTabs(cur.headings || ALL_TABS),
    trailerText:      String(cur.trailerText      || ''),
    structureText:    String(cur.structureText    || ''),
    requirementsText: String(cur.requirementsText || ''),
    trailerUrl:       String(cur.trailerUrl       || ''),
    requirements: {
      mandatory: Array.isArray(req.mandatory)? req.mandatory.slice(0,200):[],
      optional:  Array.isArray(req.optional) ? req.optional.slice(0,200):[],
      nice:      Array.isArray(req.nice)     ? req.nice.slice(0,200):[]
    }
  };
}

function saveModel(heroId, model){
  const S = getS();
  S.pageData = S.pageData || {};
  S.pageData[heroId] = S.pageData[heroId] || {};
  S.pageData[heroId].preview = {
    image:   model.image,
    price:   digitsOnly(model.price),
    summary: model.summary,
    audience:{ ...model.audience },
    headings: model.tabs,
    trailerText:      String(model.trailerText || ''),
    structureText:    String(model.structureText || ''),
    requirementsText: String(model.requirementsText || ''),
    trailerUrl:       String(model.trailerUrl || ''),
    requirements: {
      mandatory: (model.requirements?.mandatory||[]).map(String).filter(Boolean),
      optional:  (model.requirements?.optional ||[]).map(String).filter(Boolean),
      nice:      (model.requirements?.nice     ||[]).map(String).filter(Boolean)
    }
  };
  setS(S);
}

/* ---------------- hero + meta ---------------- */
function buildHero(model){
  return h('div', { className:'pgs-bg' }, [
    h('div', { className:'pgs-bg-img', style: model.image ? { backgroundImage:`url("${model.image}")` } : {} }),
    h('div', { className:'pgs-bg-fade' })
  ]);
}

function buildMeta(model, editMode, courseName, onImagePick, heroId, rerender){
  const head = h('div', { className:'pgs-meta' });
  head.appendChild(h('div', { className:'pgs-title', textContent: courseName }));

  const cta = h('div', { className:'pgs-ctas' });
  const paid = isPaid(model.price);
  const enrollBtn = h('button', { 
    className: paid ? 'pgs-enroll' : 'pgs-free', 
    textContent: paid ? 'Enroll' : 'Free' 
  });
  if (!editMode) enrollBtn.onclick = ()=> {
    try {
      const S = getS(); const hp=S.heroPages?.[heroId]||{}; const en=hp.enabled||{};
      if (en.payment)       return void window.BuilderPages?.open?.({ key:'payment', heroId, label:(hp.names||{}).payment||'Payment' });
      if (en.introduction)  return void window.BuilderPages?.open?.({ key:'introduction', heroId, label:(hp.names||{}).introduction||'Introduction' });
      const acts = Array.isArray(hp.activities)?hp.activities:['activity-1'];
      for (const k of acts){ if (en[k]) return void window.BuilderPages?.open?.({ key:'activity', heroId, instanceId:k, label:(hp.names||{})[k]||'Activity' }); }
      for (const k of ['conclusion','achievement','feedback'])
        if (en[k]) return void window.BuilderPages?.open?.({ key:k, heroId, label:(hp.names||{})[k]||k });
    } catch {}
  };
  cta.appendChild(enrollBtn);

  // audience chips
  const aud = h('div', { className:'pgs-aud-wrap' });
  const mk = (key,label,tone)=>{
    if (!editMode) {
      if (model.audience[key]) aud.appendChild(h('span',{ className:`audChip ${tone}`, textContent:label }));
      return;
    }
    const id=`aud-${key}`;
    const chk=h('input',{ 
      type:'checkbox', id, checked:!!model.audience[key], 
      onchange:()=>{ model.audience[key]=!!chk.checked; softSave(heroId, model); }
    });
    const chip=h('label',{ className:`audChip ${tone}`, htmlFor:id, textContent:label, style: !model.audience[key]?{color:'#ff5252',borderColor:'#ff5252'}:{} });
    aud.appendChild(h('span',{ style:{display:'inline-flex',alignItems:'center',gap:'6px'}},[chk,chip]));
  };
  mk('beginner','Beginner','bronze'); 
  mk('intermediate','Intermediate','silver'); 
  mk('advanced','Advanced','gold');
  cta.appendChild(aud);
  head.appendChild(cta);

  if (!editMode && paid){
    head.appendChild(h('div', { className:'pgs-price-readout' }, [
      h('span', { className:'pgs-price-val', textContent:`$${Number(digitsOnly(model.price)||0)}` })
    ]));
  }

  // Price + image picker
  if (editMode){
    const row = h('div', { className:'pgs-price-edit-row' });
    const input = h('input', {
      className:'pgs-price-edit',
      inputMode:'numeric',
      placeholder:'0',
      value: digitsOnly(model.price),
      oninput: (e)=>{
        model.price = digitsOnly(e.currentTarget.value);
        e.currentTarget.value = model.price;
        softSave(heroId, model);
        requestAnimationFrame(rerender);
      },
      onblur: ()=>{ hardSaveModel(heroId, model); rerender(); },
      onchange: ()=>{ hardSaveModel(heroId, model); rerender(); },
      onkeydown: (ev)=>{ if (ev.key==='Enter'){ ev.preventDefault(); ev.currentTarget.blur(); } }
    });
    row.appendChild(h('span', { className:'pgs-price-symbol', textContent:'$' }));
    row.appendChild(input);
    head.appendChild(row);

    // ------- IMAGE PICKER (save on pick) -------
    const file = h('input', { type:'file', accept:'image/*', hidden:true });
    const imgBtn = h('button', {
      className:'pgs-img-btn',
      textContent: model.image ? 'Change background image' : 'Add background image',
      onclick:()=> file.click()
    });
    const clrBtn = h('button', {
      className:'pgs-img-btn',
      textContent:'Remove image',
      style:{ marginLeft:'8px', opacity: model.image ? '1' : '.5', pointerEvents: model.image ? 'auto' : 'none' },
      onclick:()=>{
        model.image = '';
        hardSaveModel(heroId, model);
        onImagePick(model.image); // re-render hero
      }
    });

    // Optional: light compression to avoid huge data URLs in settings
    async function toDataURLCompressed(file, maxW=2200, quality=0.9){
      return await new Promise((res)=>{
        const img = new Image();
        const fr  = new FileReader();
        fr.onload = () => {
          img.onload = () => {
            const scale = Math.min(1, maxW / img.width || 1);
            const w = Math.round(img.width * scale);
            const h = Math.round(img.height * scale);
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            const ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            const mime = /^image\/(png|jpeg|webp)$/i.test(file.type) ? file.type : 'image/jpeg';
            res(c.toDataURL(mime, quality));
          };
          img.src = fr.result;
        };
        fr.readAsDataURL(file);
      });
    }

    file.onchange = async ()=>{
      const f = file.files?.[0]; if (!f) return;
      try{
        let dataUrl;
        try { dataUrl = await toDataURLCompressed(f); }
        catch { 
          const fr = new FileReader();
          dataUrl = await new Promise(r => { fr.onload=()=>r(String(fr.result||'')); fr.readAsDataURL(f); });
        }
        model.image = String(dataUrl || '');
        hardSaveModel(heroId, model);     // ✅ persist immediately
        onImagePick(model.image);         // ✅ refresh hero background now
      }catch(e){ console.warn('[preview] image pick failed:', e); }
      file.value = '';
    };

    head.appendChild(h('div', { className:'pgs-img-ctrl-under-price' }, [imgBtn, file, clrBtn]));
  } 

  return head;
} 

/* ---------------- rich text (bold + bullets + smart enter) ---------------- */
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const inlineFmt = s => esc(s).replace(/\*\*([^\*]+)\*\*/g,'<strong>$1</strong>');
function renderRichHTML(raw){
  const lines = String(raw||'').split(/\r?\n/);
  let html='', inList=false;
  const isBullet = l=>/^\s*-\s+/.test(l);
  const endList = ()=>{ if (inList){ html+='</ul>'; inList=false; } };
  for (let line of lines){
    if (isBullet(line)){ if (!inList){ html+='<ul>'; inList=true; } html+=`<li>${inlineFmt(line.replace(/^\s*-\s+/,''))}</li>`; }
    else if (line.trim()===''){ endList(); html+='<br>'; }
    else { endList(); html+=`<div>${inlineFmt(line)}</div>`; }
  }
  endList(); return html;
}
function smartEnter(ta, ev){
  if (ev.key!=='Enter') return;
  const v=ta.value, pos=ta.selectionStart;
  const start=v.lastIndexOf('\n',pos-1)+1, end=v.indexOf('\n',pos)===-1?v.length:v.indexOf('\n',pos);
  const line=v.slice(start,end), m=line.match(/^(\s*)(-\s+)?/); const bullet=m&&m[2]?m[1]+m[2]:null;
  if (!bullet) return;
  ev.preventDefault();
  const afterDash = line.replace(/^\s*-\s+/, '');
  const exit = afterDash.trim()==='';
  const insert = '\n' + (exit?'':bullet);
  const next = v.slice(0,pos)+insert+v.slice(pos);
  const newPos = pos+insert.length;
  ta.value = next; ta.setSelectionRange(newPos,newPos); ta.dispatchEvent(new Event('input',{bubbles:true}));
}
function richBlock(key, placeholder, model, editMode, heroId){
  const area = h('div', { className:'pgs-area', style:{ padding:'0 var(--pad-x)', marginBottom:'28px', maxWidth:'800px' }});
  if (editMode){
    const bar = h('div', { style:{ display:'flex', gap:'8px', alignItems:'center', margin:'6px 0 10px' }});
    const mkBtn = (txt, title, cb)=> h('button', {
      textContent:txt, title,
      style:{ padding:'6px 10px', borderRadius:'8px', border:'1px solid rgba(255,255,255,.18)', background:'#0b1220', color:'#eef3ff', cursor:'pointer' },
      onclick:cb
    });
    const ta = h('textarea', { className:'pgs-input', value:model[key], placeholder, oninput: debounce(e=>{
      model[key]=String(e.currentTarget.value||''); saveModel(heroId, model);
    }) });
    
    ta.style.minHeight='220px';
    ta.addEventListener('keydown', e=> smartEnter(ta,e));
    const bold = mkBtn('B','Bold (**text**)', ()=>{
      const a=ta.selectionStart,b=ta.selectionEnd,v=ta.value,sel=v.slice(a,b); const WR='**';
      let next,na=a,nb=b;
      if (sel.startsWith(WR)&&sel.endsWith(WR)){ next=v.slice(0,a)+sel.slice(2,-2)+v.slice(b); nb-=4; }
      else if (v.slice(a-2,a)===WR && v.slice(b,b+2)===WR){ next=v.slice(0,a-2)+sel+v.slice(b+2); na-=2; nb-=2; }
      else { next=v.slice(0,a)+WR+sel+WR+v.slice(b); na+=2; nb+=2; }
      ta.value=next; ta.focus(); ta.setSelectionRange(na,nb);
      ta.dispatchEvent(new Event('input',{bubbles:true}));
    });
    const bullets = mkBtn('•','Toggle bullet(s)', ()=>{
      const a=ta.selectionStart,b=ta.selectionEnd,v=ta.value;
      let s=v.lastIndexOf('\n',a-1)+1; let e=b; const eol=v.indexOf('\n',b); if (eol!==-1) e=eol;
      const lines=v.slice(s,e).split('\n');
      const allBul=lines.every(l=>/^\s*-\s+/.test(l)||l.trim()==='');
      const out=lines.map(l=>{
        if (l.trim()==='') return l;
        return allBul ? l.replace(/^\s*-\s+/, '') : (l.match(/^(\s*)/)[0] + '- ' + l.trimStart());
      }).join('\n');
      ta.value = v.slice(0,s)+out+v.slice(e);
      ta.focus(); ta.dispatchEvent(new Event('input',{bubbles:true}));
    });
    bar.appendChild(bold); bar.appendChild(bullets);
    area.appendChild(bar);
    area.appendChild(ta);
  } else {
    const view = h('div', { className:'pgs-text' });
    view.innerHTML = renderRichHTML(model[key]);
    area.appendChild(view);
  }
  return area;
}

// === Save helpers (used by price/audience etc.) ===
const softSave = (() => {
  const d = debounce((hid, m) => saveModel(hid, m), 150);
  return (hid, m) => d(hid, m); // debounced write while typing
})();

function hardSaveModel(hid, m){
  saveModel(hid, m);            // immediate write
  try { window.AppHome?.paint?.(); } catch {}
} 

/* ---------------- Requirements ---------------- */
function persistRequirements(heroId, req){
  const S = getS();
  S.pageData = S.pageData || {};
  S.pageData[heroId] = S.pageData[heroId] || {};
  const pv = S.pageData[heroId].preview = S.pageData[heroId].preview || {};
  pv.requirements = {
    mandatory: (req.mandatory||[]).map(String).filter(Boolean),
    optional:  (req.optional ||[]).map(String).filter(Boolean),
    nice:      (req.nice     ||[]).map(String).filter(Boolean)
  };
  setS(S);
}
function btn(color='#0A84FF'){ return {
  padding:'8px 10px', borderRadius:'10px', border:'1px solid rgba(255,255,255,.18)',
  background:'#0b1220', color:color, cursor:'pointer'
};}
function pill(){ return {
  padding:'8px 12px', borderRadius:'999px', border:'1px solid rgba(255,255,255,.18)',
  background:'#0b1220', color:'#eef3ff', cursor:'pointer', marginTop:'8px'
};}
function buildRequirements(model, editMode, heroId, rerender){
  const root = h('div', { className:'pgs-area', style:{ padding:'0 var(--pad-x)', marginBottom:'28px' } });
  const mk = (title,key)=>{
    const box = h('div', { style:{ margin:'16px 0 14px', maxWidth:'800px' }});
    box.appendChild(h('div', { style:{ fontWeight:'800', marginBottom:'8px', opacity:.95 }, textContent:title }));
    const list = h('div', { style:{ display:'grid', gap:'8px' }});
    const items = model.requirements[key] || [];

    const render = ()=>{
      list.innerHTML=''; 
      if (!editMode){
        items.forEach(txt=> list.appendChild(h('div',{ style:{ padding:'8px 10px', border:'1px solid rgba(255,255,255,.22)', borderRadius:'10px' }, textContent:txt })));
        return;
      }
      items.forEach((txt,i)=>{
        const row = h('div', { style:{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:'8px', alignItems:'center' }});
        const disp = h('div', { textContent:txt, style:{ padding:'8px 10px', border:'1px solid rgba(255,255,255,.22)', borderRadius:'10px' }});
        const edit = h('button', { textContent:'✎', title:'Edit', style:btn() });
        const del  = h('button', { textContent:'✕', title:'Delete', style:btn('#ff5151') });
        edit.onclick = ()=>{
          const inp=h('input',{ className:'pgs-input', value:txt, style:{ minHeight:'42px', padding:'8px 10px' }});
          const ok =h('button',{ textContent:'✓', style:btn() });
          const no =h('button',{ textContent:'↩', style:btn() });
          const apply=()=>{ const v=String(inp.value||'').trim(); if(!v)return; items[i]=v; commit(); };
          ok.onclick=apply; no.onclick=render; inp.onkeydown=e=>{ if(e.key==='Enter') apply(); if(e.key==='Escape') render(); };
          row.innerHTML=''; row.appendChild(inp); row.appendChild(ok); row.appendChild(no); inp.focus();
        };
        del.onclick = ()=>{ items.splice(i,1); commit(); };
        row.appendChild(disp); row.appendChild(edit); row.appendChild(del); list.appendChild(row);
      });
    };
    const add = ()=>{
      const row = h('div', { style:{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:'8px', alignItems:'center' }});
      const inp = h('input',{ className:'pgs-input', placeholder:'Add requirement…', style:{ minHeight:'42px', padding:'8px 10px' }});
      const ok  = h('button',{ textContent:'✓', style:btn() });
      const no  = h('button',{ textContent:'✕', style:btn('#ff5151') });
      const go = ()=>{ const v=String(inp.value||'').trim(); if(!v) return; items.push(v); commit(); };
      ok.onclick=go; no.onclick=()=>row.remove(); inp.onkeydown=e=>{ if(e.key==='Enter') go(); if(e.key==='Escape') row.remove(); };
      list.appendChild(row); row.appendChild(inp); row.appendChild(ok); row.appendChild(no); inp.focus();
    };
    const commit=()=>{ model.requirements[key]=items.slice(); persistRequirements(heroId, model.requirements); rerender(); };

    render();
    box.appendChild(list);
    if (editMode){ const addBtn=h('button',{ textContent:'+ Add', style:pill(), onclick:add }); box.appendChild(addBtn); }
    return box;
  };
  root.appendChild(mk('Mandatory','mandatory'));
  root.appendChild(mk('Optional','optional'));
  root.appendChild(mk('Nice to haves','nice'));
  return root;
}

/* ---------------- Tabs ---------------- */
function tabsBar(model, editMode, curRef, rerender, heroId){
  const bar = h('div', { 
    className:'pgs-headings-bar',
    style:{ display:'flex', justifyContent:'center', margin:'28px auto 36px', width:'100%', maxWidth:'820px' }
  });

  const row = h('div', { 
    className:'pgs-headings-row',
    style:{ display:'flex', flexWrap:'wrap', justifyContent:'center', alignItems:'center', gap:'42px', textAlign:'center' }
  });

  const has = t => model.tabs.includes(t);
  const setCur = t => { curRef.current = t; rerender(); };

  ALL_TABS.forEach(t=>{
    const active = has(t);
    const isCur = t === curRef.current;

    if (editMode){
      const id = `tab-${t.replace(/\s+/g,'-').toLowerCase()}`;
      const chk = h('input', {
        type:'checkbox', id, checked:active,
        onchange:()=>{
          if (chk.checked){
            model.tabs = sanitizeTabs([...new Set(model.tabs.concat(t))]);
            if (!curRef.current) curRef.current = t;
          } else {
            model.tabs = model.tabs.filter(x=>x!==t);
            if (curRef.current===t) curRef.current = model.tabs[0]||'';
          }
          saveModel(heroId, model);
          rerender();
        }
      });

      const btn = h('button', {
        className:'pgs-heading' + (isCur ? ' is-active' : ''),
        textContent:t,
        style: active ? {} : { color:'#ff5252' },
        onclick:()=> active && setCur(t)
      });

      row.appendChild(h('span', { style:{ display:'inline-flex', alignItems:'center', gap:'8px' } }, [
        h('label',{ htmlFor:id },[chk]), btn
      ]));

    } else {
      if (!active) return;
      const btn = h('button', {
        className:'pgs-heading' + (isCur ? ' is-active' : ''),
        textContent:t,
        onclick:()=> setCur(t)
      });
      row.appendChild(btn);
    }
  });

  bar.appendChild(row);
  return bar;
}

/* ---------------- Trailer video box ---------------- */
function trailerBox(model, editMode, heroId){
  const modal = makeLightbox();

  const wrap = h('div', { className:'pgs-trailer', style:{ padding:'0 var(--pad-x)', margin:'0 0 16px', maxWidth:'800px' }});

  const poster = h('button', {
    className:'pgs-trailer-open',
    type:'button',
    title: model.trailerUrl ? 'Play trailer' : 'Trailer coming soon',
    onclick: ()=> modal.open(model.trailerUrl)
  });
  wrap.appendChild(poster);

  if (editMode){
    const ctrl = h('div', { className:'pgs-trailer-ctrl', style:{ display:'flex', gap:'8px', alignItems:'center', margin:'10px 0 2px' }});
    const inp = h('input', {
      className:'pgs-input pgs-trailer-url',
      placeholder:'Paste YouTube / Vimeo / MP4 URL…',
      value: model.trailerUrl,
      oninput: debounce(e => { model.trailerUrl = String(e.currentTarget.value||''); saveModel(heroId, model); })
    });
    const preview = h('button', { className:'pgs-trailer-preview', textContent:'Preview', onclick:()=> modal.open(model.trailerUrl) });
    ctrl.appendChild(inp);
    ctrl.appendChild(preview);
    wrap.appendChild(ctrl);
  }

  return wrap;
}

/* ---------------- Summary ---------------- */
function summaryBlock(model, editMode, heroId){
  const area = h('div',{ className:'pgs-area pgs-summary' });
  area.appendChild(
    editMode
      ? h('textarea',{ className:'pgs-input', value:model.summary, placeholder:'A short description…', oninput:debounce(e=>{ model.summary=e.currentTarget.value; saveModel(heroId, model); })})
      : h('div',{ className:'pgs-text', textContent:model.summary })
  );
  return area;
}

/* ---------------- Tab container ---------------- */
function tabContainer(model, editMode, curTab, heroId, rerender){
  const wrap = h('div');
  if (curTab==='Course Trailer' && model.tabs.includes('Course Trailer')){
    wrap.appendChild(trailerBox(model, editMode, heroId));
    wrap.appendChild(richBlock('trailerText','Course Trailer…',model,editMode,heroId));
  }
  if (curTab==='Course Structure' && model.tabs.includes('Course Structure')){
    wrap.appendChild(richBlock('structureText','Course Structure…',model,editMode,heroId));
  }
  if (curTab==='Requirements' && model.tabs.includes('Requirements')){
    wrap.appendChild(buildRequirements(model,editMode,heroId,rerender));
  }
  return wrap;
}

/* ---------------- lifecycle ---------------- */
export async function mount(el, ctx){
  const heroId = ctx.heroId;

  // Load existing model
  let model = loadModel(heroId);

  // ---------- Seed demo content for Jody Graham if fields are empty ----------
  if (!model.image) {
    model.image = "https://images.unsplash.com/photo-1549887534-4f7a250d4a2a?auto=format&fit=crop&w=1920&q=80";
  }
  if (!model.summary || model.summary.startsWith('Write a short')) {
    model.summary =
      "Join Australian artist Jody Graham for a deep dive into expressive portrait drawing using charcoal, ink, and mixed media. Learn to capture mood, gesture, and character in this hands-on portrait course.";
  }
  if (!model.price || Number(model.price) <= 0) model.price = "40";
  if (!model.trailerUrl)
    model.trailerUrl = "https://www.youtube.com/watch?v=Q6g2DEo7C4c";
  if (!model.trailerText)
    model.trailerText =
      "Discover the beauty of imperfection in portrait art. This trailer introduces Jody’s philosophy of drawing from emotion and observation.";
  if (!model.structureText)
    model.structureText = `**Course Outline:**
- Week 1: Materials and setup — explore charcoal, graphite, and ink.
- Week 2: Understanding light, tone, and proportion.
- Week 3: Gesture and expressive mark-making.
- Week 4: Layering mixed media and final portrait composition.`;
  if (!model.requirements.mandatory.length)
    model.requirements.mandatory = [
      "Basic drawing materials (charcoal, paper, eraser)",
      "Access to a workspace with good lighting",
    ];
  if (!model.requirements.optional.length)
    model.requirements.optional = [
      "Fixative spray for finished artworks",
      "Easel or drawing board",
    ];
  if (!model.requirements.nice.length)
    model.requirements.nice = ["An open mind and creative energy!"];
  model.audience = { beginner: true, intermediate: true, advanced: true };
  model.tabs = ["Course Trailer", "Course Structure", "Requirements"];

  // Persist seed immediately so the course “sticks”
  saveModel(heroId, model);

  const courseName =
    getHeroLabel(heroId) || "Expressive Portraits with Jody Graham";
  let curTab = model.tabs.find(t=>ALL_TABS.includes(t)) || 'Requirements';

  try { window.__currentBuilderPage = { ctx: { heroId, instanceId: ctx.instanceId, pageKey:'preview' } }; } catch {}
  const wrap = h('div', { className:'pgs-wrap pgs--fb pgs--snap-top' });
  el.appendChild(wrap); el.__wrap = wrap;

  let editMode = !!window.__DEV_MODE__; // initial state from Dev Dock if present

  const rerender = ()=>{
    wrap.innerHTML='';
    wrap.appendChild(buildHero(model));
    wrap.appendChild(h('div',{ className:'pgs-hero-heading', textContent:courseName }));
    wrap.appendChild(buildMeta(model, editMode, courseName, ()=>rerender(), heroId, rerender));
    wrap.appendChild(summaryBlock(model, editMode, heroId));
    const tabRef = { current: curTab };
    wrap.appendChild(tabsBar(model, editMode, tabRef, ()=>{ curTab = tabRef.current; rerender(); }, heroId));
    wrap.appendChild(tabContainer(model, editMode, curTab, heroId, rerender));
  };

  // 🔄 Dev Dock integration: flip edit mode on/off
  const onDevMode = (e)=>{
    const on = !!e.detail?.on;
    const leaving = editMode && !on;
    if (leaving){
      // Refresh model from persistent store in case of external changes
      model = loadModel(heroId);
      if (!model.tabs.includes(curTab)) curTab = model.tabs[0] || '';
    }
    editMode = on;
    rerender();
  };
  window.addEventListener('dev:mode', onDevMode);
  el.__onDevMode = onDevMode;

  rerender();
}

export async function unmount(el){
  try { if (el.__onDevMode) window.removeEventListener('dev:mode', el.__onDevMode); } catch {}
  el.innerHTML='';
}

/* ---------------- commit hook (used by router/app if needed) ---------------- */
export async function commit(el, ctx){
  try{
    const wrap=el.querySelector('.pgs-wrap')||el, heroId=ctx?.heroId, next=loadModel(heroId);
    const price=wrap.querySelector('.pgs-price-edit'); if (price) next.price=digitsOnly(price.value);
    const sum  =wrap.querySelector('.pgs-summary .pgs-input'); if (sum) next.summary=String(sum.value||'');
    const tr   =wrap.querySelector('textarea.pgs-input[placeholder^="Course Trailer"]'); if (tr) next.trailerText=String(tr.value||'');
    const st   =wrap.querySelector('textarea.pgs-input[placeholder^="Course Structure"]'); if (st) next.structureText=String(st.value||'');
    const turl =wrap.querySelector('.pgs-trailer-url'); if (turl) next.trailerUrl=String(turl.value||'');
    ['beginner','intermediate','advanced'].forEach(k=>{ const chk=wrap.querySelector(`#aud-${k}`); if (chk) next.audience[k]=!!chk.checked; });
    saveModel(heroId, next);
  }catch(e){ console.warn('[preview.commit] continuing:',e); }
} 