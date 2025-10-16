// /assets/course/pages/payment.js
// Payment screen with Dev Dock–driven edit/view and save-on-input.
// - Edit mode is toggled by `dev:mode` (no Builder button dependency).
// - Fields save at the point of entry (debounced for typing).
// - Seeds sample data for Jody Graham’s $40 portrait course if empty.

function getS() { return window.AppHome?.getSettings?.() || {}; }
function setS(s){ try { window.AppHome?.setSettings?.(s); } catch {} }
const $ = (sel, r=document) => r.querySelector(sel);
const digitsOnly = v => String(v||'').replace(/[^\d]/g,'');

/* ---------- read + normalize state for this course ---------- */
function readPaymentState(heroId){
  const S  = getS();
  const pd = (S.pageData?.[heroId]?.payment) || {};
  const pv = (S.pageData?.[heroId]?.preview) || {}; // fallback for hero image/title

  const priceDigits = digitsOnly(pd.price ?? '');
  const priceNumber = Number(priceDigits || 0) || 0;

  return {
    title:     pd.title || S?.heroLabels?.[heroId] || 'Expressive Portraits with Jody Graham',
    heroUrl:   pv.image || pd.heroUrl || '',
    subtitle:  pd.subtitle || 'Secure Checkout',
    desc:      pd.desc || 'Enroll in “Expressive Portraits with Jody Graham”. Review the details below and proceed to payment.',
    showPrice: pd.showPrice ?? true,
    price:     priceDigits || '40',
    priceNumber,
    paid:      !!pd.paid,
    paidAt:    pd.paidAt || null
  };
}

/* ---------- persist helpers ---------- */
function writePaymentState(heroId, patch){
  const S = getS();
  S.pageData = S.pageData || {};
  S.pageData[heroId] = S.pageData[heroId] || {};
  const prev = S.pageData[heroId].payment || {};
  S.pageData[heroId].payment = { ...prev, ...patch };
  setS(S);
}
function hardSave(heroId, stPatch){
  writePaymentState(heroId, stPatch);
  try { window.AppHome?.paint?.(); } catch {}
}
function debounce(fn, ms=180){
  let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); };
}
const softSave = debounce((heroId, patch)=> writePaymentState(heroId, patch), 150);

/* ---------- next-page resolver (AFTER PAYMENT) ---------- */
function openNextPageAfterPayment(heroId){
  const S = getS();
  const hp = (S.heroPages && S.heroPages[heroId]) || {};
  const enabled    = hp.enabled || {};
  const activities = Array.isArray(hp.activities) ? hp.activities : ['activity-1'];
  const names      = hp.names || {};

  if (enabled.introduction) {
    try { window.BuilderPages?.open?.({ key:'introduction', heroId, label: names.introduction || 'Introduction' }); } catch {}
    return;
  }
  for (const key of activities) {
    if (enabled[key]) {
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
      const instanceId = idMap[key];
      const label = names[key] || `Activity ${String(key).split('-')[1] || ''}`;
      try { window.BuilderPages?.open?.({ key:'activity', heroId, instanceId, label }); } catch {}
      return;
    }
  }
  for (const k of ['conclusion','achievement','feedback']) {
    if (enabled[k]) {
      try { window.BuilderPages?.open?.({ key:k, heroId, label: names[k] || k[0].toUpperCase()+k.slice(1) }); } catch {}
      return;
    }
  }
  try { window.BuilderPages?.open?.({ key:'preview', heroId, label:names.preview || 'Preview' }); } catch {}
}

/* ---------- LIGHTBOX (top-most) ---------- */
function openPaymentLightbox(price, onDone) {
  const wrap = document.createElement('div');
  Object.assign(wrap.style, {
    position:'fixed', inset:'0',
    zIndex: 2147483660,
    display:'grid', placeItems:'center',
    background:'rgba(0,0,0,.50)',
    backdropFilter:'blur(2px)', WebkitBackdropFilter:'blur(2px)'
  });

  const inner = document.createElement('div');
  Object.assign(inner.style, {
    width:'min(520px,92vw)',
    borderRadius:'14px',
    background:'#0d1118', color:'#eef3ff',
    border:'1px solid rgba(255,255,255,.15)',
    boxShadow:'0 24px 60px rgba(0,0,0,.65)',
    padding:'16px',
    font:'600 14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif'
  });

  inner.innerHTML = `
    <h2 style="margin:0 0 8px;font-size:18px;font-weight:800;">Confirm Purchase</h2>
    <p style="margin:0 0 12px;opacity:.95;">You are about to pay <strong>$${price}</strong> for this course.</p>
    <div style="display:grid;gap:8px;grid-template-columns:1fr 1fr">
      <button data-act="confirm" style="padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#0A84FF;color:#fff;font-weight:800;cursor:pointer">Confirm</button>
      <button data-act="cancel"  style="padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#6e6e73;color:#fff;font-weight:800;cursor:pointer">Cancel</button>
    </div>
  `;

  wrap.appendChild(inner);

  wrap.addEventListener('click', (e)=>{
    const act = e.target?.dataset?.act;
    if (e.target === wrap || act === 'cancel') { wrap.remove(); return; }
    if (act === 'confirm') {
      const btns = inner.querySelectorAll('button');
      btns.forEach(b => b.disabled = true);
      const confirm = inner.querySelector('[data-act="confirm"]');
      confirm.textContent = 'Processing…';
      setTimeout(()=>{
        inner.innerHTML = `
          <h2 style="margin:0 0 8px;font-size:18px;font-weight:800;">✅ Payment Successful</h2>
          <p style="margin:0 0 12px;opacity:.95;">Thank you! You are now enrolled.</p>
          <button data-act="close" style="padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#0A84FF;color:#fff;font-weight:800;cursor:pointer;width:100%">Close</button>
        `;
        inner.querySelector('[data-act="close"]').onclick = () => { wrap.remove(); onDone?.(); };
      }, 900);
    }
  });

  document.body.appendChild(wrap);
}

/* ---------- Inline editor (Dev Dock edit mode) ---------- */
function ensureEditor(host, st, heroId){
  let bar = host.querySelector('.payment-editor');
  if (!bar){
    bar = document.createElement('div');
    bar.className = 'payment-editor';
    Object.assign(bar.style, {
      position:'sticky', top:'0', zIndex:'5',
      display:'grid', gap:'8px',
      gridTemplateColumns:'1fr',
      alignItems:'stretch',
      padding:'10px 12px',
      margin:'0 0 12px',
      background:'rgba(255,255,255,.04)',
      border:'1px solid rgba(255,255,255,.12)',
      borderRadius:'12px',
      backdropFilter:'blur(6px)'
    });
    bar.innerHTML = `
      <label style="display:grid;gap:6px">
        <span style="opacity:.85">Title</span>
        <input data-edit="title" type="text" value="" style="padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#0d1118;color:#eef3ff" />
      </label>

      <label style="display:grid;gap:6px">
        <span style="opacity:.85">Subtitle</span>
        <input data-edit="subtitle" type="text" value="" style="padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#0d1118;color:#eef3ff" />
      </label>

      <label style="display:grid;gap:6px">
        <span style="opacity:.85">Description</span>
        <textarea data-edit="desc" rows="3" style="padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#0d1118;color:#eef3ff"></textarea>
      </label>

      <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center">
        <label style="display:flex;gap:8px;align-items:center">
          <span style="opacity:.85;min-width:48px">Price</span>
          <span style="opacity:.85">$</span>
          <input data-edit="price" type="number" min="0" step="1" inputmode="numeric"
                 style="flex:1;min-width:0;padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#0d1118;color:#eef3ff" />
        </label>
        <label style="display:flex;gap:8px;align-items:center;justify-content:flex-end">
          <input data-edit="showPrice" type="checkbox" />
          <span style="opacity:.85">Show price</span>
        </label>
      </div>
      <div class="payment-editor-hint" style="opacity:.7;font-size:12px;text-align:right">Edits save as you type</div>
    `;
    const content = host.querySelector('.payment-content');
    content?.prepend(bar);
  }

  // Seed editor values
  bar.querySelector('[data-edit="title"]').value     = st.title;
  bar.querySelector('[data-edit="subtitle"]').value  = st.subtitle;
  bar.querySelector('[data-edit="desc"]').value      = st.desc;
  bar.querySelector('[data-edit="price"]').value     = st.price;
  bar.querySelector('[data-edit="showPrice"]').checked = !!st.showPrice;

  // Wire save-on-input
  const titleI   = bar.querySelector('[data-edit="title"]');
  const subI     = bar.querySelector('[data-edit="subtitle"]');
  const descI    = bar.querySelector('[data-edit="desc"]');
  const priceI   = bar.querySelector('[data-edit="price"]');
  const showChk  = bar.querySelector('[data-edit="showPrice"]');

  const reflect = ()=>{
    const viewTitle = host.querySelector('.payment-title');
    const viewSub   = host.querySelector('.payment-sub');
    const viewDesc  = host.querySelector('.payment-body');
    const priceRow  = host.querySelector('[data-price-row]');
    const priceVal  = host.querySelector('[data-price-val]');
    const btn       = host.querySelector('[data-act="pay-now"]');

    const priceDigits = digitsOnly(priceI.value);
    const priceNum = Number(priceDigits||0);

    if (viewTitle) viewTitle.textContent = titleI.value || 'Course Payment';
    if (viewSub)   viewSub.textContent   = subI.value   || 'Secure Checkout';
    if (viewDesc)  viewDesc.textContent  = descI.value  || '';
    if (priceVal)  priceVal.textContent  = `$${priceNum}`;
    if (priceRow)  priceRow.style.display = showChk.checked ? '' : 'none';
    if (btn)       btn.textContent = (showChk.checked && priceNum>0) ? '💳 Pay Now' : (st.paid ? 'Continue' : 'Enroll Free');
  };

  const saveTitle = debounce(()=> { softSave(heroId, { title: titleI.value }); reflect(); }, 120);
  const saveSub   = debounce(()=> { softSave(heroId, { subtitle: subI.value }); reflect(); }, 120);
  const saveDesc  = debounce(()=> { softSave(heroId, { desc: descI.value }); reflect(); }, 150);
  const savePrice = (immediate=false)=>{
    const digits = digitsOnly(priceI.value);
    priceI.value = digits;
    (immediate ? hardSave : softSave)(heroId, { price: digits });
    reflect();
  };
  const saveShow  = ()=> { hardSave(heroId, { showPrice: !!showChk.checked }); reflect(); };

  titleI.addEventListener('input', saveTitle);
  subI.addEventListener('input',   saveSub);
  descI.addEventListener('input',  saveDesc);
  priceI.addEventListener('input', ()=> savePrice(false));
  priceI.addEventListener('blur',  ()=> savePrice(true));
  priceI.addEventListener('keydown', (e)=>{ if (e.key==='Enter'){ e.preventDefault(); priceI.blur(); }});
  showChk.addEventListener('change', saveShow);

  // Initial reflect
  reflect();

  return bar;
}

/* ---------- mount/unmount ---------- */
export async function mount(host, ctx){
  const heroId = ctx.heroId;

  // read/seed state
  let st = readPaymentState(heroId);

  // Ensure sample data persisted so it “sticks” across reloads.
  if (!getS().pageData?.[heroId]?.payment) {
    writePaymentState(heroId, {
      title: st.title,
      subtitle: st.subtitle,
      desc: st.desc,
      price: st.price,
      showPrice: st.showPrice
    });
  }

  host.innerHTML = `
    <div class="payment-wrap">
      <div class="payment-hero" ${st.heroUrl ? `style="background-image:url('${st.heroUrl}')"`:''}>
        <div class="payment-fade"></div>
      </div>

      <div class="payment-content">
        <h1 class="payment-title">${st.title}</h1>
        <p class="payment-sub">${st.subtitle}</p>
        <div class="payment-body">${st.desc}</div>

        <!-- Price row: shown only when showPrice -->
        <div class="payment-price" data-price-row ${ st.showPrice ? '' : 'style="display:none"' }>
          <span class="payment-price-label">Price:</span>
          <span class="payment-price-val" data-price-val>$${st.priceNumber}</span>
        </div>

        <div class="payment-action">
          <button class="payment-btn" data-act="pay-now">${
            st.paid ? 'Continue' : (st.showPrice && st.priceNumber>0 ? '💳 Pay Now' : 'Enroll Free')
          }</button>
        </div>
      </div>
    </div>
  `;

  const btn = host.querySelector('[data-act="pay-now"]');

  const setBtnToContinue = ()=>{
    if (!btn) return;
    btn.textContent = 'Continue';
    btn.disabled = false;
  };

  btn?.addEventListener('click', ()=>{
    st = readPaymentState(heroId); // re-read fresh
    if (st.paid) { openNextPageAfterPayment(heroId); return; }

    if (!st.showPrice || st.priceNumber === 0){
      st = { ...st, paid:true, paidAt: Date.now() };
      writePaymentState(heroId, { paid:true, paidAt: st.paidAt });
      setBtnToContinue();
      openNextPageAfterPayment(heroId);
      return;
    }

    openPaymentLightbox(st.priceNumber, ()=>{
      st = { ...st, paid:true, paidAt: Date.now() };
      writePaymentState(heroId, { paid:true, paidAt: st.paidAt });
      setBtnToContinue();
      openNextPageAfterPayment(heroId);
    });
  });

  // Dev Dock edit/view integration
  let editorBar = null;
  let editMode = !!window.__DEV_MODE__;
  const applyMode = (on)=>{
    editMode = !!on;
    if (editMode){
      st = readPaymentState(heroId);
      if (!editorBar) editorBar = ensureEditor(host, st, heroId);
    } else {
      if (editorBar){ editorBar.remove(); editorBar = null; }
      // reflect latest persisted state to view
      st = readPaymentState(heroId);
      const priceRow  = host.querySelector('[data-price-row]');
      const priceVal  = host.querySelector('[data-price-val]');
      const titleEl   = host.querySelector('.payment-title');
      const subEl     = host.querySelector('.payment-sub');
      const bodyEl    = host.querySelector('.payment-body');
      const btnEl     = host.querySelector('[data-act="pay-now"]');
      if (titleEl) titleEl.textContent = st.title;
      if (subEl)   subEl.textContent   = st.subtitle;
      if (bodyEl)  bodyEl.textContent  = st.desc;
      if (priceVal) priceVal.textContent = `$${st.priceNumber}`;
      if (priceRow) priceRow.style.display = st.showPrice ? '' : 'none';
      if (btnEl)   btnEl.textContent = (st.showPrice && st.priceNumber>0) ? '💳 Pay Now' : (st.paid ? 'Continue' : 'Enroll Free');
    }
  };

  const onDevMode = (e)=> applyMode(!!e.detail?.on);
  window.addEventListener('dev:mode', onDevMode);
  host.__onDevMode = onDevMode;

  // initial mode
  applyMode(editMode);
}

export async function unmount(host){
  try { if (host.__onDevMode) window.removeEventListener('dev:mode', host.__onDevMode); } catch {}
  host.innerHTML = '';
} 