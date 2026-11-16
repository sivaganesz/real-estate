/* =====================================================================
   App core — state, persistence, router, shell, generic event handling.
   Views live in views-*.js. Every edit is saved to localStorage.
   ===================================================================== */

const STORE_KEY = 'respec-wireframe-v1';
const ROLE_KEY = 'respec-wireframe-role';
const ROLES = ['Admin', 'Sales manager', 'Sales executive'];

function loadDB() { try { const s = localStorage.getItem(STORE_KEY); if (s) return JSON.parse(s); } catch (e) { /* storage blocked */ } return null; }
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); } catch (e) { /* storage blocked — keep in memory */ } }
let DB = loadDB() || seedDB();

const UI = {
  role: (() => { try { return localStorage.getItem(ROLE_KEY) || 'Sales manager'; } catch (e) { return 'Sales manager'; } })(),
  modal: null,
  filters: { props: {}, custs: { sort: 'readiness' }, pipe: {}, hni: {} },
  enq: { step: 0, d: {}, done: null },
  test: null,
  lastHash: null,
  toastTimer: null,
};

/* ---------- small helpers ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const chip = (t, tone = '', title = '') => `<span class="chip ${tone}" ${title ? `title="${esc(title)}"` : ''}>${t}</span>`;
const getProp = id => DB.properties.find(p => p.id === id);
const getCust = id => DB.customers.find(c => c.id === id);
const canSeeHNI = () => UI.role !== 'Sales executive';
const canEditSettings = () => UI.role !== 'Sales executive';
function currentUser() { return UI.role === 'Sales executive' ? execName(DB, 'EX01') : UI.role; }
const initials = n => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const STATUS_TONE = { Available: 'green', 'Under negotiation': 'purple', Reserved: 'blue', Booked: 'blue', 'On hold': 'amber', Sold: 'grey' };
const stageTone = s => s === LOST_STAGE ? 'red' : s === 'Booking / Closed' ? 'green' : stageIndex(s) >= 4 ? 'purple' : stageIndex(s) >= 2 ? 'blue' : 'grey';
const isActive = c => c.stage !== LOST_STAGE && c.stage !== 'Booking / Closed';

function options(list, val, blank) {
  let h = blank != null ? `<option value="">${esc(blank)}</option>` : '';
  h += list.map(o => {
    const v = typeof o === 'object' ? o.v : o, l = typeof o === 'object' ? (o.l || o.v) : o;
    if (v === '') return `<option value="" ${val === '' || val == null ? 'selected' : ''}>${esc(l || '—')}</option>`;
    return `<option value="${esc(v)}" ${String(v) === String(val ?? '') ? 'selected' : ''}>${esc(l)}</option>`;
  }).join('');
  return h;
}
function fld(label, control, o = {}) {
  return `<div class="f ${o.cls || ''}"><label ${o.id ? `id="${o.id}"` : ''}>${label}${o.req ? ' <span class="req">*</span>' : ''}</label>${control}${o.hint ? `<span class="hint">${o.hint}</span>` : ''}</div>`;
}
function inputFor(f, val, name, attrs = '') {
  const v = val ?? '';
  if (f.t === 'select') return `<select name="${name}" ${attrs}>${options(f.o, v, f.blank)}</select>`;
  if (f.t === 'textarea') return `<textarea name="${name}" ${attrs}>${esc(v)}</textarea>`;
  const type = { number: 'number', month: 'month', date: 'date' }[f.t] || 'text';
  return `<input type="${type}" name="${name}" value="${esc(v)}" ${type === 'number' ? 'step="any" min="0"' : ''} ${attrs}>`;
}
/* inline bound controls: data-bind="kind|id|path"  (kind p=property, c=customer, s=settings) */
const bkey = (k, id, path) => `${k}|${id}|${path}`;
function bIn(k, id, path, val, type = 'text', attrs = '') {
  return `<input class="inline-in" type="${type}" ${type === 'number' ? 'step="any"' : ''} data-bind="${bkey(k, id, path)}" value="${esc(val ?? '')}" ${attrs}>`;
}
function bSel(k, id, path, val, list, attrs = '', blank) {
  return `<select class="inline-in" data-bind="${bkey(k, id, path)}" ${attrs}>${options(list, val, blank)}</select>`;
}
function bChk(k, id, path, val, label, attrs = '') {
  return `<label class="check"><input type="checkbox" data-bind="${bkey(k, id, path)}" ${val ? 'checked' : ''} ${attrs}> ${label}</label>`;
}
function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }
function setPath(obj, path, v) {
  const ks = path.split('.'); let o = obj;
  ks.slice(0, -1).forEach((k, i) => { if (o[k] == null) o[k] = /^\d+$/.test(ks[i + 1]) ? [] : {}; o = o[k]; });
  o[ks[ks.length - 1]] = v;
}
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.style.display = 'block';
  clearTimeout(UI.toastTimer); UI.toastTimer = setTimeout(() => { t.style.display = 'none'; }, 2600);
}
function meter(v, tone = '') { return `<div class="meter ${tone}"><i style="width:${clamp(v)}%"></i></div>`; }
function logActivity(c, type, text) { c.activity.unshift({ date: DEMO_TODAY, type, text, by: currentUser() }); }
function logHistory(p, text) { (p.history = p.history || []).unshift({ date: DEMO_TODAY, text, by: currentUser() }); }

/* ---------- router ---------- */
function parseRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  return { parts: path.split('/').filter(Boolean).map(decodeURIComponent), q: new URLSearchParams(qs || ''), path };
}
function go(h) { location.hash = h; }

function route(r) {
  const [a, b, c] = r.parts;
  switch (a || 'dashboard') {
    case 'dashboard': return viewDashboard();
    case 'about': return viewAbout();
    case 'properties':
      if (!b) return viewProperties();
      if (b === 'new') return viewPropertyForm(null);
      if (c === 'edit') return viewPropertyForm(b);
      return viewProperty(b, c || 'specs');
    case 'customers':
      if (!b) return viewCustomers();
      if (b === 'new') return viewCustomerForm(null);
      if (c === 'edit') return viewCustomerForm(b);
      return viewCustomer(b, c || 'overview');
    case 'import': return viewImport();
    case 'appointments': return viewAppointments();
    case 'pipeline': return viewPipeline();
    case 'matching': return viewMatching(r.q.get('c'));
    case 'hni': return viewHNI();
    case 'reports': return viewReports();
    case 'enquiry': return viewEnquiry();
    case 'test': return viewTest();
    case 'settings': return viewSettings();
    default: return { title: 'Not found', html: `<div class="card empty">Page not found. <a href="#/dashboard">Go to dashboard</a></div>` };
  }
}

/* ---------- shell ---------- */
const NAV = [
  { sec: 'Overview' },
  { r: 'dashboard', i: '📊', l: 'Sales dashboard' },
  { r: 'about', i: '🧭', l: 'System map' },
  { sec: 'Specification data' },
  { r: 'properties', i: '🏠', l: 'Properties', cnt: () => DB.properties.filter(p => p.status === 'Available' && !p.archived).length },
  { r: 'customers', i: '👤', l: 'Customers', cnt: () => DB.customers.filter(isActive).length },
  { r: 'import', i: '📥', l: 'Bulk import' },
  { sec: 'Sales & qualification' },
  { r: 'pipeline', i: '🗂️', l: 'Lead pipeline' },
  { r: 'appointments', i: '📅', l: 'Appointments', cnt: () => allAppointments().filter(a => a.date === DEMO_TODAY && a.status === 'Scheduled').length },
  { r: 'matching', i: '🎯', l: 'Matching engine' },
  { r: 'hni', i: '🛡️', l: 'HNI qualification', restricted: true },
  { r: 'reports', i: '📈', l: 'Reports' },
  { sec: 'Tools' },
  { r: 'enquiry', i: '📝', l: 'Public enquiry form' },
  { r: 'test', i: '🧪', l: 'Test scenario 001' },
  { r: 'settings', i: '⚙️', l: 'Settings & rules' },
];

function shell(view, r) {
  const cur = r.parts[0] || 'dashboard';
  const nav = NAV.map(n => n.sec ? `<div class="nav-sec">${n.sec}</div>` :
    `<a href="#/${n.r}" class="${cur === n.r ? 'on' : ''}"><span class="ico">${n.i}</span>${n.l}${n.restricted && !canSeeHNI() ? '<span class="lock">🔒</span>' : n.cnt ? `<span class="cnt">${n.cnt()}</span>` : ''}</a>`).join('');
  return `
  <div class="wf-ribbon"><b>WIREFRAME</b><span>Real Estate Specification &amp; Lead Management — V1 MVP · all data is fictional mock data · edits are saved in this browser</span><span class="sp"></span>
    <span>Demo date: ${fmtDate(DEMO_TODAY)}</span><button data-act="resetData">Reset demo data</button></div>
  <div class="shell">
    <aside class="side">
      <div class="brand"><div class="logo">RE</div><div>RealSpec CRM<small>Property + Customer specs</small></div></div>
      <nav class="nav">${nav}</nav>
    </aside>
    <div class="main">
      <div class="topbar">
        <div class="crumbs">${view.crumbs || esc(view.title)}</div><span class="sp"></span>
        <a class="btn sm" href="#/enquiry">📝 Public enquiry</a>
        <a class="btn sm" href="#/customers/new">＋ Customer</a>
        <a class="btn sm" href="#/properties/new">＋ Property</a>
        <label class="row" style="gap:6px;font-size:12px;color:var(--muted)">Viewing as
          <select data-chg="role" style="width:auto">${options(ROLES, UI.role)}</select></label>
      </div>
      <div class="content">${view.html}</div>
    </div>
  </div>
  ${UI.modal ? renderModal() : ''}`;
}

function render() {
  const r = parseRoute();
  const hashChanged = UI.lastHash !== location.hash;
  // remember focus (so live filters don't lose the cursor)
  const ae = document.activeElement, focusId = ae && ae.id, selStart = ae && ae.selectionStart;
  let view;
  try { view = route(r); } catch (e) { console.error(e); view = { title: 'Error', html: `<div class="note red">Something went wrong rendering this screen: ${esc(e.message)}</div>` }; }
  document.getElementById('app').innerHTML = shell(view, r);
  document.title = (view.title ? view.title + ' · ' : '') + 'RealSpec CRM wireframe';
  if (hashChanged) { window.scrollTo(0, 0); UI.lastHash = location.hash; }
  if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); try { if (selStart != null) el.setSelectionRange(selStart, selStart); } catch (e) { /* not a text input */ } } }
  if (view.after) view.after();
}

/* ---------- modal ---------- */
function openModal(m) { UI.modal = m; render(); }
function closeModal() { UI.modal = null; render(); }
function renderModal() {
  const m = UI.modal, body = MODALS[m.kind] ? MODALS[m.kind](m) : { title: 'Modal', html: '' };
  return `<div class="overlay" data-act="overlay"><div class="modal" role="dialog" aria-modal="true">
    <form data-form="modal">
      <div class="modal-head"><h2>${body.title}</h2><span class="sp"></span><button type="button" class="btn ghost sm" data-act="closeModal">✕</button></div>
      <div class="modal-body">${body.html}</div>
      <div class="modal-foot"><button type="button" class="btn" data-act="closeModal">Cancel</button>${body.submit !== false ? `<button class="btn primary">${body.submit || 'Save'}</button>` : ''}</div>
    </form></div></div>`;
}

/* ---------- generic bound-field changes ---------- */
function onBind(el) {
  const [kind, id, path] = el.dataset.bind.split('|');
  const target = kind === 'p' ? getProp(id) : kind === 'c' ? getCust(id) : DB.settings;
  if (!target) return;
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (el.type === 'number') v = v === '' ? '' : Number(v);
  const old = getPath(target, path);
  if (BIND_HOOKS.before(kind, target, path, v, old) === false) { render(); return; }
  setPath(target, path, v);
  BIND_HOOKS.after(kind, target, path, v, old);
  save();
  render();
}

const BIND_HOOKS = {
  before(kind, t, path, v) {
    if (kind === 'c' && path === 'hni.status' && v === 'Verified' && !t.hni.consent) {
      toast('HNI can only be marked Verified after the customer’s consent for verification is recorded.'); return false;
    }
    if (kind === 'c' && path === 'nextFollowUp' && v && !(t.consent && t.consent.followUp)) {
      toast('Record the customer’s consent before scheduling a follow-up.'); return false;
    }
    if (kind === 's' && !canEditSettings()) { toast('Only Admin / Sales manager can change business rules.'); return false; }
    return true;
  },
  after(kind, t, path, v, old) {
    if (kind === 'p') {
      const m = path.match(/^legal\.(\d+)\.status$/);
      if (m) {
        const d = t.legal[+m[1]];
        if (v === 'verified') { d.date = d.date || DEMO_TODAY; d.verifiedBy = d.verifiedBy || 'Adv. Legal Partner (sample)'; }
        if (v === 'not') { d.verifiedBy = ''; d.date = ''; d.file = ''; }
        if (v === 'pending' && !d.file) d.file = `${d.key}-scan.pdf`;
        logHistory(t, `Legal: ${LEGAL_DOCS[d.key].n} → ${LEGAL_STATUS[v].l}`);
      }
      if (path === 'status') logHistory(t, `Status changed: ${old} → ${v}`);
      if (path === 'price') logHistory(t, `Asking price changed: ${inr(old)} → ${inr(v)}`);
    }
    if (kind === 'c') {
      if (path === 'owner') logActivity(t, 'Note', `Lead reassigned to ${execName(DB, v)}`);
      if (path === 'nextFollowUp' && v) logActivity(t, 'Note', `Next follow-up set for ${fmtDate(v)}`);
      if (path.startsWith('hni.')) { t.hni.reviewedBy = currentUser(); t.hni.reviewedDate = DEMO_TODAY; }
      if (path === 'hni.status' && v === 'Verified') { t.hni.verifiedDate = t.hni.verifiedDate || DEMO_TODAY; t.hni.verifiedBy = t.hni.verifiedBy || currentUser(); }
      if (path === 'hni.potentialFlag' && v && t.hni.status === 'Not determined') t.hni.status = 'Potential — indicators recorded';
    }
  },
};

/* ---------- stage moves ---------- */
function moveStage(c, stage, reason, note) {
  if (c.stage === stage) return;
  const from = c.stage;
  if (stage === LOST_STAGE) { c.lostReason = reason || 'Other'; c.lostNote = note || ''; c.lostAtStage = from; c.nextFollowUp = ''; }
  else { c.lostReason = ''; c.lostNote = ''; }
  c.stage = stage; c.stageSince = DEMO_TODAY;
  logActivity(c, 'Note', `Stage changed: ${from} → ${stage}${reason ? ` (reason: ${reason})` : ''}`);
  save();
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]');
  if (a) {
    if (a.dataset.act === 'overlay' && e.target !== a) return; // only backdrop clicks close
    e.preventDefault();
    const fn = ACTIONS[a.dataset.act];
    if (fn) fn(a.dataset, a, e); else console.warn('No action', a.dataset.act);
    return;
  }
  const row = e.target.closest('[data-href]');
  if (row && !e.target.closest('a,button,input,select,textarea,label')) go(row.dataset.href);
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.bind) onBind(el);
  else if (el.dataset.chg && CHANGES[el.dataset.chg]) CHANGES[el.dataset.chg](el, e);
});
document.addEventListener('input', e => { const el = e.target; if (el.dataset.inp && INPUTS[el.dataset.inp]) INPUTS[el.dataset.inp](el, e); });
document.addEventListener('submit', e => {
  const f = e.target;
  if (f.dataset.form && FORMS[f.dataset.form]) { e.preventDefault(); FORMS[f.dataset.form](f, new FormData(f)); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && UI.modal) closeModal(); });
/* drag & drop for the pipeline board */
document.addEventListener('dragstart', e => { const k = e.target.closest && e.target.closest('[data-drag]'); if (k) { e.dataTransfer.setData('text/plain', k.dataset.drag); e.dataTransfer.effectAllowed = 'move'; } });
document.addEventListener('dragover', e => { const col = e.target.closest && e.target.closest('[data-drop]'); if (col) { e.preventDefault(); col.classList.add('drop'); } });
document.addEventListener('dragleave', e => { const col = e.target.closest && e.target.closest('[data-drop]'); if (col && !col.contains(e.relatedTarget)) col.classList.remove('drop'); });
document.addEventListener('drop', e => {
  const col = e.target.closest && e.target.closest('[data-drop]'); if (!col) return;
  e.preventDefault(); col.classList.remove('drop');
  const c = getCust(e.dataTransfer.getData('text/plain')); const stage = col.dataset.drop;
  if (!c || c.stage === stage) return;
  if (stage === LOST_STAGE) { openModal({ kind: 'stage', id: c.id, stage }); return; }
  moveStage(c, stage); toast(`${c.name} → ${stage}`); render();
});

/* registries filled by views-*.js */
const ACTIONS = {
  closeModal: () => closeModal(),
  overlay: () => closeModal(),
  resetData: () => openModal({ kind: 'confirm', title: 'Reset demo data?', text: 'All edits made in this browser will be discarded and the original mock data restored.', then: 'doReset' }),
  doReset: () => { DB = seedDB(); save(); UI.modal = null; UI.test = null; UI.enq = { step: 0, d: {}, done: null }; toast('Demo data restored'); render(); },
  go: d => go(d.href),
};
const CHANGES = {
  role: el => { UI.role = el.value; try { localStorage.setItem(ROLE_KEY, UI.role); } catch (e) { /* ignore */ } toast(`Now viewing as ${UI.role}`); render(); },
  filter: el => { UI.filters[el.dataset.scope][el.dataset.key] = el.type === 'checkbox' ? el.checked : el.value; render(); },
};
const INPUTS = {
  filter: el => { UI.filters[el.dataset.scope][el.dataset.key] = el.value; render(); },
};
const FORMS = {
  modal: (f, fd) => { const m = UI.modal; if (m && MODAL_SUBMIT[m.kind]) MODAL_SUBMIT[m.kind](m, fd); },
};
const MODALS = {
  confirm: m => ({ title: m.title, html: `<p>${m.text}</p>`, submit: 'Confirm' }),
};
const MODAL_SUBMIT = {
  confirm: m => { const fn = ACTIONS[m.then]; UI.modal = null; if (fn) fn(m); else render(); },
};

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', render);
