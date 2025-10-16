// /assets/course/pages/conclusion.js
// Conclusion page with Dev Dock–driven edit/view + save-on-input.
// - Uses ctx.getSettings()/ctx.setSettings() if present (falls back to AppHome).
// - Seeds sample content for Jody Graham once (without overwriting existing).
// - Device picker for hero image; falls back to preview image then sample.

function getS(ctx){ return ctx?.getSettings?.() || window.AppHome?.getSettings?.() || {}; }
function setS(ctx, s){ try{ (ctx?.setSettings || window.AppHome?.setSettings)?.(s); }catch{} }
function paint(){ try{ window.AppHome?.paint?.(); }catch{} }
const esc = (s='') => String(s)
  .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
  .replaceAll('"','&quot;').replaceAll("'","&#039;");
function debounce(fn, ms=180){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }

function ensureConclusionState(S, heroId){
  S.pageData ??= {};
  S.pageData[heroId] ??= {};
  const pv = S.pageData[heroId].preview || {};
  const c  = S.pageData[heroId].conclusion || {};

  // Seed once with sample values (don’t overwrite existing)
  const seeded = {
    image: c.image ?? pv.image ?? 'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?q=80&w=1600&auto=format&fit=crop',
    title: c.title ?? ((S.heroLabels?.[heroId] || 'Expressive Portraits with Jody Graham') + ' — Conclusion'),
    subtitle: c.subtitle ?? 'You’ve reached the end 🎉',
    desc: c.desc ?? 'Great work! Here’s a quick wrap-up and your next steps.',
    outcomes: Array.isArray(c.outcomes) && c.outcomes.length ? c.outcomes.slice(0,200) : [
      'Capture expressive portraits with confident line',
      'Apply layering and mixed media to add depth',
      'Build a 3-piece portrait mini-series'
    ],
    nextSteps: Array.isArray(c.nextSteps) && c.nextSteps.length ? c.nextSteps.slice(0,200) : [
      'Share your portraits for feedback in the community',
      'Try the “Limited Palette Portraits” follow-up lesson',
      'Claim and download your certificate'
    ],
    certificateNote: c.certificateNote ?? 'Your certificate will be available on your dashboard after completion.'
  };

  if (!S.pageData[heroId].conclusion){
    S.pageData[heroId].conclusion = seeded;
  }
  return S.pageData[heroId].conclusion;
}

function saveConclusion(ctx, heroId, model){
  const S = getS(ctx);
  S.pageData ??= {};
  S.pageData[heroId] ??= {};
  S.pageData[heroId].conclusion = {
    image: String(model.image||''),
    title: String(model.title||''),
    subtitle: String(model.subtitle||''),
    desc: String(model.desc||''),
    outcomes: (model.outcomes||[]).map(String).filter(Boolean),
    nextSteps: (model.nextSteps||[]).map(String).filter(Boolean),
    certificateNote: String(model.certificateNote||'')
  };
  setS(ctx, S);
}

const softSave = (ctx, heroId) => debounce(m => saveConclusion(ctx, heroId, m), 150);
function hardSave(ctx, heroId, m){ saveConclusion(ctx, heroId, m); paint(); }

/* ---------------- UI Builders ---------------- */
function buildHero(model, editMode, onPick){
  const hero = document.createElement('div');
  hero.className = 'conclusion-hero';
  hero.style.backgroundImage = model.image ? `url("${model.image}")` : '';
  hero.innerHTML = `<div class="conclusion-fade"></div>`;

  if (editMode){
    const tools = document.createElement('div');
    tools.className = 'conclusion-hero-tools';

    const file = document.createElement('input');
    file.type='file'; file.accept='image/*'; file.hidden=true;

    const pick = document.createElement('button');
    pick.className = 'conclusion-hero-btn';
    pick.textContent = model.image ? 'Change image' : 'Add image';
    pick.onclick = ()=> file.click();

    const clr = document.createElement('button');
    clr.className = 'conclusion-hero-btn';
    clr.textContent = 'Remove image';
    clr.style.marginLeft = '8px';
    clr.style.opacity = model.image ? '1' : '.5';
    clr.style.pointerEvents = model.image ? 'auto' : 'none';
    clr.onclick = ()=> onPick('');

    file.onchange = ()=>{
      const f = file.files?.[0]; if (!f) return;
      const fr = new FileReader();
      fr.onload = ()=> onPick(String(fr.result||'')); 
      fr.readAsDataURL(f);
      file.value='';
    };

    tools.append(pick, file, clr);
    hero.appendChild(tools);
  }
  return hero;
}

function listEditor(label, items, onChange){
  const sec = document.createElement('div');
  sec.className = 'conclusion-section';
  sec.innerHTML = `<h2 class="conclusion-h2">${esc(label)}</h2>`;
  const list = document.createElement('div');
  list.className = 'conclusion-list-edit';

  function render(){
    list.innerHTML='';
    items.forEach((txt, i)=>{
      const row = document.createElement('div');
      row.style.display='grid';
      row.style.gridTemplateColumns='1fr auto auto';
      row.style.gap='8px';
      row.style.alignItems='center';

      const inp = document.createElement('input');
      inp.className='conclusion-li-input';
      inp.value = txt;
      inp.addEventListener('input', debounce(()=>{ items[i]=inp.value; onChange(); }, 150));

      const up = document.createElement('button');
      up.className='conclusion-li-btn'; up.textContent='▲'; up.title='Up';
      up.onclick = ()=>{ if(i>0){ const it=items.splice(i,1)[0]; items.splice(i-1,0,it); onChange(); render(); } };

      const del = document.createElement('button');
      del.className='conclusion-li-btn'; del.textContent='✕'; del.title='Remove';
      del.onclick = ()=>{ items.splice(i,1); onChange(); render(); };

      const controls = document.createElement('div');
      controls.style.display='flex'; controls.style.gap='6px';
      controls.append(up, del);

      row.append(inp, controls);
      list.appendChild(row);
    });

    const add = document.createElement('button');
    add.className='conclusion-li-add'; add.textContent='+ Add';
    add.style.marginTop='8px';
    add.onclick = ()=>{ items.push(''); onChange(); render(); };
    list.appendChild(add);
  }

  render();
  sec.appendChild(list);
  return sec;
}

function viewContent(model){
  const cont = document.createElement('div');
  cont.className = 'conclusion-content';
  cont.innerHTML = `
    <h1 class="conclusion-title">${esc(model.title)}</h1>
    <p class="conclusion-sub">${esc(model.subtitle)}</p>
    <div class="conclusion-body">${esc(model.desc)}</div>
  `;

  if (Array.isArray(model.outcomes) && model.outcomes.length){
    const ul = document.createElement('ul'); ul.className='conclusion-list';
    model.outcomes.forEach(x=>{ const li=document.createElement('li'); li.innerHTML=esc(x); ul.appendChild(li); });
    const box = document.createElement('div'); box.className='conclusion-section';
    box.innerHTML = `<h2 class="conclusion-h2">Outcomes</h2>`;
    box.appendChild(ul); cont.appendChild(box);
  }

  if (Array.isArray(model.nextSteps) && model.nextSteps.length){
    const ul = document.createElement('ul'); ul.className='conclusion-list';
    model.nextSteps.forEach(x=>{ const li=document.createElement('li'); li.innerHTML=esc(x); ul.appendChild(li); });
    const box = document.createElement('div'); box.className='conclusion-section';
    box.innerHTML = `<h2 class="conclusion-h2">Next Steps</h2>`;
    box.appendChild(ul); cont.appendChild(box);
  }

  const action = document.createElement('div');
  action.className = 'conclusion-action';
  const btn = document.createElement('button');
  btn.className = 'conclusion-btn';
  btn.textContent = '✅ Mark Course Complete';
  btn.addEventListener('click', ()=> openCompletionLightbox(model.certificateNote));
  action.appendChild(btn);
  cont.appendChild(action);
  return cont;
}

function editContent(model, heroId, saveNow){
  const cont = document.createElement('div');
  cont.className = 'conclusion-content';

  const mkField = (label, val, key, as='input', rows=4)=>{
    const row = document.createElement('div'); row.className='conclusion-field';
    const lab = document.createElement('label'); lab.className='conclusion-label'; lab.textContent=label;
    const node = document.createElement(as); node.className='conclusion-input'; if(as==='textarea') node.rows=rows;
    node.value = val;
    node.addEventListener('input', debounce(()=>{ model[key]=node.value; saveNow(model); }, 150));
    row.append(lab, node);
    return row;
  };

  cont.appendChild(mkField('Title', model.title, 'title'));
  cont.appendChild(mkField('Subtitle', model.subtitle, 'subtitle'));
  cont.appendChild(mkField('Description', model.desc, 'desc', 'textarea', 5));

  const onListChange = ()=> saveNow(model);
  cont.appendChild(listEditor('Outcomes', model.outcomes, onListChange));
  cont.appendChild(listEditor('Next Steps', model.nextSteps, onListChange));

  cont.appendChild(mkField('Certificate Note', model.certificateNote, 'certificateNote', 'textarea', 3));

  // Preview (disabled) action
  const prev = document.createElement('div'); prev.className='conclusion-action';
  const btn = document.createElement('button'); btn.className='conclusion-btn';
  btn.textContent='✅ Mark Course Complete'; btn.disabled=true; btn.style.opacity='.6'; btn.style.pointerEvents='none';
  prev.appendChild(btn); cont.appendChild(prev);

  return cont;
}

/* ---------------- Lightbox ---------------- */
function openCompletionLightbox(note) {
  const wrap = document.createElement('div');
  Object.assign(wrap.style, {
    position:'fixed', inset:'0', zIndex:2147483660, display:'grid', placeItems:'center',
    background:'rgba(0,0,0,.5)', backdropFilter:'blur(2px)'
  });
  const inner = document.createElement('div');
  Object.assign(inner.style, {
    width:'min(520px,92vw)', borderRadius:'14px',
    background:'#0d1118', color:'#eef3ff', border:'1px solid rgba(255,255,255,.15)',
    boxShadow:'0 24px 60px rgba(0,0,0,.65)', padding:'16px',
    font:'600 14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif'
  });
  inner.innerHTML = `
    <h2 style="margin:0 0 8px;font-size:18px;font-weight:800;">Course Completed</h2>
    <p style="margin:0 0 12px;opacity:.95;">${esc(note || 'Nice work! You can now claim your certificate.')}</p>
    <div style="display:flex;justify-content:flex-end">
      <button data-act="close" style="padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#0A84FF;color:#fff;font-weight:800;cursor:pointer">Close</button>
    </div>
  `;
  wrap.appendChild(inner);
  wrap.addEventListener('click', e=>{ if (e.target===wrap || e.target?.dataset?.act==='close') wrap.remove(); });
  document.body.appendChild(wrap);
}

/* ---------------- Mount/Unmount ---------------- */
export async function mount(host, ctx){
  const heroId = ctx?.heroId || 'course';
  // seed/ensure
  let S = getS(ctx);
  let model = ensureConclusionState(S, heroId);
  setS(ctx, S); // persist seed once

  const wrap = document.createElement('div');
  wrap.className = 'conclusion-wrap';
  host.appendChild(wrap);

  let editMode = !!window.__DEV_MODE__;
  const saveNowSoft = softSave(ctx, heroId);

  const render = ()=>{
    wrap.innerHTML = '';
    wrap.appendChild(buildHero(model, editMode, (img)=>{
      model.image = img; hardSave(ctx, heroId, model); // immediate for image
      // re-read to keep in sync
      model = ensureConclusionState(getS(ctx), heroId);
      render();
    }));
    wrap.appendChild(editMode ? editContent(model, heroId, m=>saveNowSoft(m)) : viewContent(model));
  };

  const onDevMode = (e)=>{
    const on = !!e.detail?.on;
    const leaving = editMode && !on;
    if (leaving){
      // re-read persisted data when leaving
      model = ensureConclusionState(getS(ctx), heroId);
    }
    editMode = on;
    render();
  };
  window.addEventListener('dev:mode', onDevMode);
  host.__onDevMode = onDevMode;

  render();
}

export async function unmount(host){
  try { if (host.__onDevMode) window.removeEventListener('dev:mode', host.__onDevMode); } catch {}
  host.innerHTML = '';
}