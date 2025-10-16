/* =========================================================
   /assets/menu/course.menu.js  (full replacement)

   Course Menu (invoked from hero cards)

   • Accordion groups (exclusive open): Status, Requirements,
     Audience, Schedule (with recurrence), Pricing & Sales, System
   • Requirements chips (+ custom add/edit/delete stubs)
   • Pricing (base, inflation), Sales calendar (table)
   • Modal shell (backdrop + close / Esc)
   • No Overview pane
   • No Design group / shape controls (handled by hero kebab later)
   • Opens via CourseMenu.openCourseMenu(heroId)

   Public API (global):
     window.CourseMenu.openCourseMenu(heroId)
     window.CourseMenu.close()

   Bridges (no-ops if absent):
     - window.AppHome.getSettings() / setSettings()

   Styling: /assets/menu/styles.css
   ========================================================= */
'use strict';

let lastOpenId = null; // remember which accordion group is open

/* ---------- tiny DOM helpers ---------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/* =========================================================
   Utilities
   ========================================================= */
function freqLabel(f){ return ({DAILY:'Daily',WEEKLY:'Weekly',MONTHLY:'Monthly',YEARLY:'Yearly'})[f] || 'Daily'; }
function stateClassFor(st){
  return st==='preview' ? 'sel-orange'
       : st==='live'    ? 'sel-green'
       : st==='off'     ? 'sel-red'
       :                  'sel-blue';
}
function fmtDateISO(iso){
  if(!iso) return '';
  const d=new Date(iso);
  if(Number.isNaN(+d)) return '';
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}
function roundDollar(x){ if(x==null||Number.isNaN(x)) return null; return Math.round(Number(x)); }
function applyInfl(base, pct){ if(base==null||pct==null) return null; return roundDollar(base*(1+pct/100)); }
function knob(on){ return `<span class="cm-Toggle ${on?'on':''}"><span class="knob"></span></span>`; }

/* Stub: active sale check (you can replace with your real logic anytime) */
function isSaleActiveOn(s, date){
  if(!s || !s.start) return false;
  const start=new Date(s.start);
  const end  = s.end ? new Date(s.end) : null;
  if(Number.isNaN(+start)) return false;
  if(end && Number.isNaN(+end)) return false;
  return date >= start && (!end || date <= end);
}

/* =========================================================
   Modal root (created once)
   ========================================================= */
function ensureModalRoot() {
  let root = document.getElementById('courseMenuRoot');
  if (root) return root;

  root = document.createElement('div');
  root.id = 'courseMenuRoot';
  root.setAttribute('hidden', '');
  root.innerHTML = `
    <div class="cm-Backdrop" data-cm-close></div>
    <div class="cm-Card" role="dialog" aria-modal="true" aria-labelledby="cmTitle" style="opacity:0; transform:translateY(24px); transition:opacity .18s ease, transform .18s ease">
      <!-- Header -->
      <div class="cm-Head">
        <span class="cm-Title" id="cmTitle">Course Controls</span>
        <button class="cm-X" type="button" data-cm-close aria-label="Close">×</button>
      </div>

      <!-- Dynamic groups -->
      <section class="cm-Body" id="cmBody"></section>

      <!-- Footer -->
      <div class="cm-Foot mono" id="cmIdFooter"></div>
    </div>
  `;
  document.body.appendChild(root);
  return root;
}

/* Ensure styles (load only once) */
function ensureMenuStyles() {
  if (document.querySelector('link[data-course-menu-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/assets/menu/styles.css';
  link.setAttribute('data-course-menu-style', '1');
  document.head.appendChild(link);
}

/* =========================================================
   State (per open)
   ========================================================= */
function makeBlankState(heroId, settings) {
  const label = settings?.heroLabels?.[heroId] || heroId;
  const flags = settings?.heroFlags?.[heroId] || {};
  return {
    id: heroId || 'COURSE-ID',
    title: label,
    status: (flags.state || 'dev'), // 'preview' | 'live' | 'off' | 'dev'
    requirements: { materials: new Set(), supports: new Set(), tools: new Set(), notes: '' },
    customReq: { materials: [], supports: [], tools: [] },
    audience: { beginner:false, intermediate:false, advanced:false, custom:false },
    customAudienceQuery: '',
    schedule: { preview: null, live: null, off: null, dev: null },
    scheduleEnabled: { preview:false, live:false, off:false, dev:false },
    recurring: { preview:null, live:null, off:null, dev:null }, // {freq, interval, start}
    // design retained in state for compatibility; not shown/edited here
    design: { shape: (flags.shape || 'square'), cover: null },
    system: { archived: !!flags.archived },
    pricing: { baseDollars: null, inflPct: null },
    sales: [], // [{id,label,pct,start,end,recur:{freq,interval,start}}]
    insights: { rating: null }
  };
}

/* =========================================================
   Derived values (pricing/sales)
   ========================================================= */
function salePctForToday(state){
  if(!Array.isArray(state.sales)) return 0;
  const today=new Date();
  let max=0;
  for(const s of state.sales){ if(isSaleActiveOn(s,today)) max=Math.max(max, Number(s.pct)||0); }
  return max;
}
function computeCostToday(state){
  const base=state.pricing?.baseDollars;
  if(base==null || Number.isNaN(base)) return null;
  const pct=salePctForToday(state);
  return Math.round(pct ? base*(1-pct/100) : base);
}
function updatePricingPreview(state){
  const prev = document.getElementById('infl-preview');
  if (!prev) return;
  const out = (state.pricing.baseDollars!=null && state.pricing.inflPct!=null)
    ? `$${applyInfl(state.pricing.baseDollars, Number(state.pricing.inflPct))}`
    : '—';
  prev.textContent = `Next FY: ${out}`;
}
function updateCostTodayField(state){
  const el=document.getElementById('cost-today');
  if(!el) return;
  const cost=computeCostToday(state);
  el.value = (cost==null) ? '—' : `$${cost}`;
}

/* =========================================================
   Sales table helpers
   ========================================================= */
function renderSalesTable(state){
  const box = document.getElementById('sales-list');
  if(!box) return;
  const sales = Array.isArray(state.sales) ? state.sales : [];
  if (!sales.length){ box.innerHTML = `<div class="help" style="opacity:.8">No scheduled sales yet.</div>`; return; }
  const now = new Date();
  const rows = sales.map(s=>{
    const live = s.start ? new Date(s.start) <= now : false;
    const range = `${fmtDateISO(s.start)||'—'} <span style="margin:0 6px">→</span> <span class="sel-orange">${fmtDateISO(s.end)||'—'}</span>`;
    const delCell = live ? `<span class="subtle">—</span>`
                         : `<button class="iconBtn bin" title="Remove sale" data-act="sale-del" data-id="${s.id}">🗑</button>`;
    return `<tr>
      <td class="mono">${state.id}</td>
      <td>${s.label || 'Sale'}</td>
      <td style="font-weight:800">${Number(s.pct||0)}%</td>
      <td>${range}</td>
      <td style="text-align:right">${delCell}</td>
    </tr>`;
  }).join('');
  box.innerHTML = `
    <div class="checkGroup" style="margin-top:8px">
      <div class="groupLabel">Sales History</div>
      <div style="overflow:auto">
        <table style="width:100%; border-collapse:collapse">
          <thead>
            <tr>
              <th style="text-align:left; padding:6px 8px; border-bottom:1px solid var(--stroke-2)">Course ID</th>
              <th style="text-align:left; padding:6px 8px; border-bottom:1px solid var(--stroke-2)">Sale Type</th>
              <th style="text-align:left; padding:6px 8px; border-bottom:1px solid var(--stroke-2)">% Discount</th>
              <th style="text-align:left; padding:6px 8px; border-bottom:1px solid var(--stroke-2)">Date Range</th>
              <th style="text-align:right; padding:6px 8px; border-bottom:1px solid var(--stroke-2)"></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}
function clearSaleForm(){
  const $id = (x)=>document.getElementById(x);
  ($id('sale-label')||{}).value = '';
  const r = $id('sale-pct-range'); if(r){ r.value = 10; }
  const v = $id('sale-pct-val');   if(v){ v.textContent = '10%'; }
  ['sale-start','sale-end','sale-recur-start'].forEach(id=>{ const el=$id(id); if(el) el.value=''; });
  const rf=$id('sale-recur-freq'); if(rf) rf.value='';
  const ri=$id('sale-recur-interval'); if(ri) ri.value='';
}

/* =========================================================
   Body groups
   ========================================================= */
const stockReqs = {
  materials: ['Acrylics','Charcoal','Crayons','Digital Tablet','Ink','Markers','Oils','Paint','Pastels','Pencils','Watercolors'].sort((a,b)=>a.localeCompare(b)),
  supports:  ['Canvas','Cardboard','Fabric','Glass','Linen','MDF','Metal','Paper','Plastic','Stone','Wall','Wood','Yupo'].sort((a,b)=>a.localeCompare(b)),
  tools:     ['Apron','Brushes','Clips','Easel','Heat Gun','Knives','Light Box','Masking Tape','Palette','Projector','Ruler/Compass','Sponges','Spray Gun','Table'].sort((a,b)=>a.localeCompare(b))
};

function reqGroupHTML(state, groupKey){
  const stock = stockReqs[groupKey].map(label=>{
    const on = state.requirements[groupKey].has(label);
    return `
      <label class="checkOpt">
        <input type="checkbox" data-act="check" data-group="${groupKey}" data-val="${label}" ${on?'checked':''} aria-label="${label}">
        <span>${label}</span>
      </label>`;
  }).join('');

  const customArr = Array.isArray(state.customReq?.[groupKey]) ? state.customReq[groupKey] : [];
  const customBlock = customArr.length
    ? `<div style="flex-basis:100%; height:1px; background:var(--stroke-2); margin:4px 0 2px"></div>` +
      customArr.map(label=>{
        const on = state.requirements[groupKey].has(label);
        return `
          <label class="checkOpt" data-custom="1">
            <input type="checkbox" data-act="check" data-group="${groupKey}" data-val="${label}" ${on?'checked':''} aria-label="${label}">
            <span>${label}</span>
            <button type="button" class="chipIconBtn" data-act="custom-edit" data-group="${groupKey}" data-label="${label}" title="Rename">✎</button>
            <button type="button" class="chipIconBtn danger" data-act="custom-delete" data-group="${groupKey}" data-label="${label}" title="Delete">🗑</button>
          </label>`;
      }).join('')
    : '';

  const plus = `
    <label class="checkOpt" data-act="custom-add" data-group="${groupKey}" role="button" aria-label="Add custom ${groupKey}">
      <span style="font-weight:900">+</span>
    </label>`;

  return `
    <div class="checkRow" style="display:flex;flex-wrap:wrap;gap:10px">
      ${stock}
      ${customBlock}
      ${plus}
    </div>
  `;
}

function subTree(title, innerHTML, key){
  return `
    <div class="modalOpt subHead" data-sub="${key}">
      <div class="optLeft" style="font-weight:800;opacity:.9">${title}</div>
      <div class="optRight"><span class="chev" data-chev="${key}">▶</span></div>
    </div>
    <div class="subBody" data-sub-body="${key}" style="display:none">${innerHTML}</div>
  `;
}

function statusRow(state, label,key){
  const on=state.status===key;
  return `<div class="modalOpt" data-act="status" data-key="${key}">
    <div class="optLeft"><span class="${on?stateClassFor(key):''}">${label}</span></div>
    <div class="optRight">${knob(on)}</div>
  </div>`;
}
function audRow(state, label,key){
  const on=!!state.audience[key];
  return `<div class="modalOpt">
    <div class="optLeft"><span class="${on?'sel-blue':''}">${label}</span></div>
    <div class="optRight"><label class="checkOpt" style="border:none;background:transparent;padding:0;cursor:default">
      <input type="checkbox" data-act="aud" data-key="${key}" ${on?'checked':''} aria-label="${label}">
    </label></div>
  </div>`;
}
function schedToggleRow(state, label,key,colorClass){
  const on = state.scheduleEnabled[key] ?? false; 
  const dateVal=state.schedule[key]||'';
  const rec=state.recurring[key];
  const recText=rec?`${freqLabel(rec.freq)} ×${rec.interval||1} from ${fmtDateISO(rec.start)}`:'None';
  return `
<div class="modalOpt schedRow" data-act="sched-toggle" data-key="${key}">
  <div class="optLeft"><span class="${dateVal?colorClass:''}">${label}</span></div>
  <div class="optRight" data-stop>${knob(on)}</div>
</div> 
    <div class="schedPanel" data-panel="${key}" style="display:${on?'block':'none'}">
      <div class="row" style="margin-bottom:8px">
        <input type="date" class="inlineInput inlineSmall" data-act="date" data-key="${key}" value="${dateVal}">
        <button class="pillIcon red" title="Clear date" data-act="clear-date" data-key="${key}" aria-label="Clear ${label}">🗑</button>
      </div>
      <div class="row" style="gap:8px;align-items:center">
        <span class="subtle" style="min-width:100px">Recurring</span>
        <select class="inlineInput inlineSmall" data-act="rec-freq" data-key="${key}">
          ${['','DAILY','WEEKLY','MONTHLY','YEARLY'].map(v=>`<option value="${v}" ${rec?.freq===v?'selected':''}>${v||'None'}</option>`).join('')}
        </select>
        <input type="number" min="1" class="inlineInput inlineSmall" placeholder="Interval" data-act="rec-interval" data-key="${key}" value="${rec?.interval||''}">
        <input type="date" class="inlineInput inlineSmall" data-act="rec-start" data-key="${key}" value="${rec?.start||''}">
        <span class="help">Current: ${recText}</span>
      </div>
      <div class="row" style="margin-top:10px">
        <button class="pillBtn" data-act="add-staff-note" data-key="${key}">+ Staff Notification</button>
        <button class="pillBtn" data-act="add-cust-note" data-key="${key}">+ Customer Notification</button>
        <span class="help">Notifications will list below (placeholder).</span>
      </div>
    </div>
  `;
}

/* =========================================================
   Build/repaint main body
   ========================================================= */
function buildBody(state, body) {
  // auto-enable toggles for existing dates
  ['preview','live','off','dev'].forEach(k=>{
    if(state.schedule[k] && !state.scheduleEnabled[k]) state.scheduleEnabled[k] = true;
  });

  const statusHTML = [
    statusRow(state,'Pre-Release Preview','preview'),
    statusRow(state,'Live','live'),
    statusRow(state,'Offline','off'),
    statusRow(state,'Under Development','dev'),
  ].join('');

  const reqHTML = `
    ${subTree('Materials',         reqGroupHTML(state,'materials'), 'req-mat')}
    ${subTree('Supports',          reqGroupHTML(state,'supports'),  'req-sup')}
    ${subTree('Tools & Equipment', reqGroupHTML(state,'tools'),     'req-tools')}
    <div class="modalOpt" style="align-items:flex-start">
      <div style="flex:1">
        <label class="subtle" style="display:block;margin-bottom:6px">Artist Recommendations</label>
        <textarea id="req-notes" rows="3" placeholder="Special instructions, substitutions, safety notes…" class="inlineInput" style="width:100%">${state.requirements.notes||''}</textarea>
      </div>
    </div>
  `;

  const audHTML = `
    ${audRow(state,'Beginner','beginner')}
    ${audRow(state,'Intermediate','intermediate')}
    ${audRow(state,'Advanced','advanced')}
  `;

  const scheduleHTML = `
    ${schedToggleRow(state,'Pre-Release Preview','preview','sel-orange')}
    ${schedToggleRow(state,'Live','live','sel-green')}
    ${schedToggleRow(state,'Offline','off','sel-red')}
    ${schedToggleRow(state,'Under Development','dev','sel-blue')}
  `;

  const pricingHTML = `
    <div class="modalOpt">
      <div class="optLeft" style="gap:12px; flex-wrap:wrap">
        <span>Base Price (AUD)</span>
        <input class="inlineInput inlineSmall" type="number" min="0" step="1" id="price-dollars" value="\${state.pricing.baseDollars ?? ''}" placeholder="300">
        <span style="margin-left:16px">Cost Price (Today)</span>
        <input class="inlineInput inlineSmall" id="cost-today" value="—" readonly aria-readonly="true" style="opacity:.9; pointer-events:none">
      </div>
      <div class="optRight"></div>
    </div>
    <div class="modalOpt">
      <div class="optLeft" style="gap:12px">
        <span>Inflation Compensator (%)</span>
        <input class="inlineInput inlineSmall" type="number" step="0.1" id="price-infl" value="\${state.pricing.inflPct ?? ''}" placeholder="3.5">
      </div>
      <div class="optRight subtle" id="infl-preview"></div>
    </div>
    <div class="modalOpt" style="align-items:flex-start">
      <div class="optLeft" style="flex-direction:column; align-items:flex-start; gap:10px">
        <div style="font-weight:800">Schedule Price / Sales Calendar</div>
        <div class="row">
          <span class="subtle" style="min-width:120px">Sale Type</span>
          <input id="sale-label" class="inlineInput inlineSmall" placeholder="e.g. Christmas Sale">
        </div>
        <div class="row" style="align-items:center">
          <span class="subtle" style="min-width:120px">Discount %</span>
          <input id="sale-pct-range" type="range" min="0" max="100" step="1" value="10" style="width:220px">
          <span id="sale-pct-val" style="font-weight:800">10%</span>
        </div>
        <div class="row">
          <span class="subtle" style="min-width:120px">Start</span>
          <input id="sale-start" type="date" class="inlineInput inlineSmall">
          <span class="subtle" style="min-width:60px; text-align:center">End</span>
          <input id="sale-end" type="date" class="inlineInput inlineSmall">
        </div>
        <div class="row" style="align-items:center">
          <span class="subtle" style="min-width:120px">Recurring</span>
          <select id="sale-recur-freq" class="inlineInput inlineSmall">
            <option value="">None</option><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="YEARLY">Yearly</option>
          </select>
          <input id="sale-recur-interval" type="number" min="1" class="inlineInput inlineSmall" placeholder="Interval">
          <input id="sale-recur-start" type="date" class="inlineInput inlineSmall" placeholder="Start anchor">
        </div>
        <div class="row" style="justify-content:flex-end; width:100%; gap:8px">
          <button class="pillBtn" type="button" data-act="sale-clear">Clear</button>
          <button class="pillBtn" type="button" data-act="sale-save">Save Sale</button>
        </div>
        <div id="sales-list" class="w100 mt10"></div>
      </div>
      <div class="optRight"></div>
    </div>
  `;

  const systemHTML = `
    <div class="modalOpt" data-act="staff-request">
      <div class="optLeft"><span>Staff Request</span></div><div class="optRight">›</div>
    </div>
  `;

  body.innerHTML = `
    <div class="modalGroup" id="cm-grp-status">
      <div class="groupHead" data-acc="#cm-grp-status"><span>Course Status</span><span class="chev">▶</span></div>
      <div class="groupBody">${statusHTML}</div>
    </div>

    <div class="modalGroup" id="cm-grp-req">
      <div class="groupHead" data-acc="#cm-grp-req"><span>Course Requirements</span><span class="chev">▶</span></div>
      <div class="groupBody">${reqHTML}</div>
    </div>

    <div class="modalGroup" id="cm-grp-aud">
      <div class="groupHead" data-acc="#cm-grp-aud"><span>Selected Audience</span><span class="chev">▶</span></div>
      <div class="groupBody">${audHTML}</div>
    </div>

    <div class="modalGroup" id="cm-grp-sched">
      <div class="groupHead" data-acc="#cm-grp-sched"><span>Schedule</span><span class="chev">▶</span></div>
      <div class="groupBody">${scheduleHTML}</div>
    </div>

    <div class="modalGroup" id="cm-grp-price">
      <div class="groupHead" data-acc="#cm-grp-price"><span>Pricing & Sales</span><span class="chev">▶</span></div>
      <div class="groupBody">${pricingHTML}</div>
    </div>

    <div class="modalGroup" id="cm-grp-system">
      <div class="groupHead" data-acc="#cm-grp-system"><span>System</span><span class="chev">▶</span></div>
      <div class="groupBody">${systemHTML}</div>
    </div>
  `;
}

/* =========================================================
   Wire interactions
   ========================================================= */
function wireMenuInteractions(state, rootEl){
  const body = rootEl.querySelector('#cmBody');

  // ----- ACCORDIONS (exclusive open) -----
  body.querySelectorAll('.groupHead').forEach(head=>{
    head.onclick = ()=>{
      const host = head.closest('.modalGroup');
      const willOpen = !host.classList.contains('open');
      body.querySelectorAll('.modalGroup').forEach(g=> g.classList.remove('open'));
      if (willOpen) { host.classList.add('open'); lastOpenId = host.id; } else { lastOpenId = null; }
    };
  });

  // ----- SUBTREES (Requirements) -----
  body.querySelectorAll('.subHead').forEach(sh=>{
    sh.onclick = ()=>{
      const key  = sh.dataset.sub;
      const sub  = body.querySelector(`[data-sub-body="${key}"]`);
      const chev = sh.querySelector(`[data-chev="${key}"]`);
      const open = sub && sub.style.display !== 'none';
      if (sub) sub.style.display = open ? 'none' : 'block';
      if (chev) chev.textContent = open ? '▶' : '▼';
    };
  });

  // ----- CLICK (main actions) -----
  body.addEventListener('click', (e)=>{
    if (e.target.closest('[data-stop], input, select, textarea')) { e.stopPropagation(); return; }

    const target = e.target.closest('[data-act]');
    if (!target) return;
    const act = target.dataset.act;

    // Status (radio-style)
    if (act === 'status') {
      state.status = target.dataset.key;
      const openId = body.querySelector('.modalGroup.open')?.id || lastOpenId;
      buildBody(state, body);
      wireMenuInteractions(state, rootEl);
      if (openId) body.querySelector(`#${CSS.escape(openId)} .groupHead`)?.click();
      return;
    }

    // Schedule toggle (panel show/hide)
    if (act === 'sched-toggle') {
      const k = target.dataset.key;
      state.scheduleEnabled[k] = !state.scheduleEnabled[k];
      const openId = body.querySelector('.modalGroup.open')?.id || lastOpenId;
      buildBody(state, body);
      wireMenuInteractions(state, rootEl);
      if (openId) body.querySelector(`#${CSS.escape(openId)} .groupHead`)?.click();
      return;
    }

    // Clear schedule date
    if (act === 'clear-date') {
      const k = target.dataset.key;
      state.schedule[k] = null;
      const openId = body.querySelector('.modalGroup.open')?.id || lastOpenId;
      buildBody(state, body);
      wireMenuInteractions(state, rootEl);
      if (openId) body.querySelector(`#${CSS.escape(openId)} .groupHead`)?.click();
      return;
    }

    // Requirements custom chips (placeholders)
    if (act === 'custom-add' || act === 'custom-edit' || act === 'custom-rename-save' ||
        act === 'custom-rename-cancel' || act === 'custom-delete') {
      return;
    }

    // Sales
    if (act === 'sale-clear') { clearSaleForm(); return; }

    if (act === 'sale-save') {
      const label = document.getElementById('sale-label')?.value.trim() || 'Sale';
      const pct   = Number(document.getElementById('sale-pct-range')?.value) || 0;
      const start = document.getElementById('sale-start')?.value || null;
      const end   = document.getElementById('sale-end')?.value || null;
      const recur = {
        freq: document.getElementById('sale-recur-freq')?.value || null,
        interval: Number(document.getElementById('sale-recur-interval')?.value) || null,
        start: document.getElementById('sale-recur-start')?.value || null
      };
      if (!start || !end) { alert('Please set start and end dates'); return; }

      state.sales.push({ id: Date.now(), label, pct, start, end, recur, live:false });
      renderSalesTable(state);
      updateCostTodayField(state);
      clearSaleForm();
      return;
    }

    if (act === 'sale-del') {
      const id = Number(target.dataset.id);
      const s  = state.sales.find(x => x.id === id);
      if (!s) return;
      if (new Date(s.start) <= new Date()) { alert('This sale has already started and cannot be deleted.'); return; }
      state.sales = state.sales.filter(x => x.id !== id);
      renderSalesTable(state);
      updateCostTodayField(state);
      return;
    }

    // System (placeholder)
    if (act === 'staff-request') { alert('Staff Request (placeholder)'); return; }
  });

  // ----- CHANGE (checkboxes) -----
  body.addEventListener('change', (e)=>{
    const t = e.target;

    if (t.matches('input[type="checkbox"][data-act="check"]')) {
      const g = t.dataset.group;
      const v = t.dataset.val;
      const set = state.requirements[g] || (state.requirements[g] = new Set());
      if (t.checked) set.add(v); else set.delete(v);
      return;
    }

    if (t.matches('input[type="checkbox"][data-act="aud"]')) {
      const k = t.dataset.key;
      state.audience[k] = t.checked;
      return;
    }
  });

  // ----- INPUT (live updates) -----
  body.addEventListener('input', (e)=>{
    const t = e.target;

    // requirements note
    if (t.id === 'req-notes') {
      state.requirements.notes = t.value;
      return;
    }

    // schedule dates + recurrence
    if (t.dataset.act === 'date') {
      const k = t.dataset.key;
      state.schedule[k] = t.value || null;
      return;
    }
    if (t.dataset.act === 'rec-freq') {
      const k = t.dataset.key;
      const cur = state.recurring[k] || {};
      const val = t.value || null;
      state.recurring[k] = val ? { ...cur, freq: val } : null;
      return;
    }
    if (t.dataset.act === 'rec-interval') {
      const k = t.dataset.key;
      const cur = state.recurring[k] || {};
      const v = t.value ? Math.max(1, Number(t.value)) : null;
      state.recurring[k] = cur ? { ...cur, interval: v || 1 } : null;
      return;
    }
    if (t.dataset.act === 'rec-start') {
      const k = t.dataset.key;
      const cur = state.recurring[k] || {};
      const v = t.value || null;
      state.recurring[k] = cur ? { ...cur, start: v } : null;
      return;
    }

    // pricing
    if (t.id === 'price-dollars') {
      state.pricing.baseDollars = t.value ? Number(t.value) : null;
      updatePricingPreview(state);
      updateCostTodayField(state);
      return;
    }
    if (t.id === 'price-infl') {
      state.pricing.inflPct = t.value !== '' ? Number(t.value) : null;
      updatePricingPreview(state);
      return;
    }

    // discount range label
    if (t.id === 'sale-pct-range') {
      const v = Number(t.value) || 0;
      const badge = document.getElementById('sale-pct-val');
      if (badge) badge.textContent = `${v}%`;
      return;
    }
  });

  // initial renders
  renderSalesTable(state);
  updatePricingPreview(state);
  updateCostTodayField(state);
}

/* =========================================================
   Public open/close
   ========================================================= */
function openCourseMenu(heroId) {
  if (!heroId) { console.warn('[CourseMenu] openCourseMenu called without heroId'); return; }
  ensureMenuStyles();
  const root = ensureModalRoot();
  const card = root.querySelector('.cm-Card');
  const body = root.querySelector('#cmBody');
  const foot = root.querySelector('#cmIdFooter');

  // bridge: pull saved settings (labels/flags)
  const S = (window.AppHome && typeof window.AppHome.getSettings === 'function')
    ? window.AppHome.getSettings()
    : {};

  const state = makeBlankState(heroId, S);

  // paint views
  buildBody(state, body);
  renderSalesTable(state);
  updatePricingPreview(state);
  updateCostTodayField(state);
  wireMenuInteractions(state, root);
  foot.textContent = heroId;

  // show + animate in
  root.removeAttribute('hidden');
  requestAnimationFrame(() => {
    card.style.opacity = '1';
    card.style.transform = 'translateY(0)';
  });
}

function closeCourseMenu() {
  const root = document.getElementById('courseMenuRoot');
  if (!root) return;
  const card = root.querySelector('.cm-Card');
  if (card) {
    card.style.opacity = '0';
    card.style.transform = 'translateY(24px)';
    setTimeout(() => root.setAttribute('hidden', ''), 240);
  } else {
    root.setAttribute('hidden', '');
  }
}

/* Click-out / buttons with [data-cm-close] */
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-cm-close]')) closeCourseMenu();
});

/* ESC to close */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape')) closeCourseMenu();
});

/* =========================================================
   Export API
   ========================================================= */
window.CourseMenu = {
  openCourseMenu,
  closeCourseMenu,
  close: closeCourseMenu, // legacy alias
}; 