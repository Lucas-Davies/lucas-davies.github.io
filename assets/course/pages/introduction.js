// /assets/course/pages/introduction.js
// Course Introduction Page — Dev Dock edit/view + save-on-input
// - Edit mode is driven by `dev:mode` (no Builder button).
// - All fields persist at point of entry (debounced for typing).
// - Seeds a sample for Jody Graham’s $40 portrait course if empty.

function getS() { return window.AppHome?.getSettings?.() || {}; }
function setS(s) { try { window.AppHome?.setSettings?.(s); } catch {} }

const $ = (sel, r = document) => r.querySelector(sel);
function h(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'style' && v && typeof v === 'object') Object.assign(el.style, v);
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach(c=>{
    if (c == null) return;
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return el;
}
function debounce(fn, ms=180){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }

/* ---------------- model ---------------- */
function loadIntroModel(heroId) {
  const S = getS();
  S.pageData = S.pageData || {};
  const cur = S.pageData[heroId]?.introduction || {};
  const pv  = S.pageData[heroId]?.preview || {};

  return {
    image: cur.image ?? pv.image ?? '',
    title: cur.title ?? 'Expressive Portraits with Jody Graham',
    subtitle: cur.subtitle ?? 'Welcome — learn bold, Australian portrait techniques',
    body: cur.body ?? (
      'Discover how to capture character with loose, energetic mark-making. ' +
      'Jody Graham shares her process for building expressive portraits from quick ' +
      'gesture to atmospheric finishes.\n\n' +
      '- Materials overview (+ easy Aussie art-store swaps)\n' +
      '- Line, shape & value: make bold choices\n' +
      '- Layering charcoal, ink and gesso for mood\n' +
      '- Finishing touches that keep the portrait alive'
    ),
  };
}

function saveIntroModel(heroId, model) {
  const S = getS();
  S.pageData = S.pageData || {};
  S.pageData[heroId] = S.pageData[heroId] || {};
  S.pageData[heroId].introduction = {
    image: String(model.image || ''),
    title: String(model.title || ''),
    subtitle: String(model.subtitle || ''),
    body: String(model.body || '')
  };
  setS(S);
}
const softSave = (()=>{ const d = debounce((hid, m)=> saveIntroModel(hid, m), 150); return (hid,m)=>d(hid,m); })();
function hardSave(heroId, model){ saveIntroModel(heroId, model); try{ window.AppHome?.paint?.(); }catch{} }

/* ---------------- hero ---------------- */
function buildIntroHero(model, editMode, onImagePicked) {
  const hero = h('div', { className: 'intro-hero' }, [
    h('div', { className: 'intro-hero-fade' }),
  ]);
  if (model.image) hero.style.backgroundImage = `url("${model.image}")`;

  if (editMode) {
    const file = h('input', { type: 'file', accept: 'image/*', hidden: true });

    const btns = h('div', { className: 'intro-hero-tools' });
    const pickBtn = h('button', { className: 'intro-hero-btn', textContent: model.image ? 'Change image' : 'Add image' });
    const clrBtn  = h('button', { className: 'intro-hero-btn', textContent: 'Remove image', style:{ marginLeft:'8px', opacity: model.image ? '1' : '.5', pointerEvents: model.image ? 'auto' : 'none' }});

    pickBtn.onclick = () => file.click();
    clrBtn.onclick  = () => onImagePicked('');

    // optional lightweight compression to keep settings small
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
            c.getContext('2d').drawImage(img, 0, 0, w, h);
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
        onImagePicked(String(dataUrl || ''));
      }catch(e){ console.warn('[intro] image pick failed:', e); }
      file.value = '';
    };

    btns.appendChild(pickBtn);
    btns.appendChild(clrBtn);
    btns.appendChild(file);
    hero.appendChild(btns);
  }

  return hero;
}

/* ---------------- content ---------------- */
function buildIntroContent(model, editMode, heroId) {
  const wrap = h('div', { className: 'intro-content' });

  if (editMode){
    const title = h('input', {
      className: 'intro-title-input',
      value: model.title,
      placeholder: 'Introduction title…',
      oninput: debounce(e => { model.title = String(e.currentTarget.value||''); softSave(heroId, model); })
    });
    const subtitle = h('input', {
      className: 'intro-subtitle-input',
      value: model.subtitle,
      placeholder: 'Subtitle…',
      oninput: debounce(e => { model.subtitle = String(e.currentTarget.value||''); softSave(heroId, model); })
    });
    const body = h('textarea', {
      className: 'intro-body-input',
      value: model.body,
      placeholder: 'Write a welcoming paragraph…',
      oninput: debounce(e => { model.body = String(e.currentTarget.value||''); softSave(heroId, model); })
    });

    wrap.append(title, subtitle, body);
  } else {
    wrap.append(
      h('h1', { className: 'intro-title', textContent: model.title }),
      h('h2', { className: 'intro-subtitle', textContent: model.subtitle }),
      h('p',  { className: 'intro-body', textContent: model.body })
    );
  }

  return wrap;
}

/* ---------------- lifecycle ---------------- */
export async function mount(el, ctx) {
  const { heroId } = ctx;
  let model = loadIntroModel(heroId);

  // Seed a friendly sample once if nothing was previously saved
  const S = getS();
  if (!S.pageData?.[heroId]?.introduction) {
    const sampleImage = 'https://images.unsplash.com/photo-1500043357865-c6b8827edf39?q=80&w=1600&auto=format&fit=crop'; // sample URL (can be replaced via device picker)
    model.image = model.image || sampleImage;
    saveIntroModel(heroId, model);
  }

  const wrap = h('div', { className: 'intro-wrap' });
  el.appendChild(wrap);

  let editMode = !!window.__DEV_MODE__;

  const render = () => {
    wrap.innerHTML = '';
    wrap.appendChild(buildIntroHero(model, editMode, (img) => {
      model.image = img;
      hardSave(heroId, model);   // write immediately on image change
      render();                  // reflect background instantly
    }));
    wrap.appendChild(buildIntroContent(model, editMode, heroId));
  };

  // Dev Dock integration
  const onDevMode = (e)=>{
    const on = !!e.detail?.on;
    const leaving = editMode && !on;
    if (leaving){
      // refresh model in case of any external mutations
      model = loadIntroModel(heroId);
    }
    editMode = on;
    render();
  };
  window.addEventListener('dev:mode', onDevMode);
  el.__introDev = onDevMode;

  render();
}

export async function unmount(el) {
  try { if (el.__introDev) window.removeEventListener('dev:mode', el.__introDev); } catch {}
  el.innerHTML = '';
}