/* =====================================================================
   Appointments — one place for all site visits, office meetings and calls.
   Site visits are stored in customer.siteVisits (the same records the customer's
   "Site visits" card edits, so both stay in sync); meetings and calls are stored
   in customer.appointments. Every booking / reschedule / outcome is logged on the
   customer's activity timeline.
   ===================================================================== */

const APPT_TYPES = ['Site visit', 'Office meeting', 'Phone call'];
const APPT_ICON = { 'Site visit': '📍', 'Office meeting': '🏢', 'Phone call': '📞' };
const APPT_STATUSES = ['Scheduled', 'Completed', 'Cancelled', 'No-show'];
const APPT_TONE = { Scheduled: 'blue', Completed: 'green', Cancelled: 'grey', 'No-show': 'red' };
const CANCEL_REASONS = ['Customer request', 'Customer not reachable', 'Property no longer available', 'Executive unavailable', 'Weather / travel', 'Other'];
const DURATIONS = [{ v: 30, l: '30 min' }, { v: 60, l: '1 hour' }, { v: 90, l: '1.5 hours' }, { v: 120, l: '2 hours' }];
const TIME_SLOTS = (() => { const a = []; for (let h = 7; h <= 20; h++) ['00', '30'].forEach(m => a.push(String(h).padStart(2, '0') + ':' + m)); return a; })();
const ACTIVITY_FOR = { 'Site visit': 'Site visit', 'Office meeting': 'Meeting', 'Phone call': 'Call' };

/* optional deep link: #/appointments?view=month */
UI.appt = { view: (location.hash.match(/view=(day|workweek|week|month|list)\b/) || [])[1] || 'workweek', date: DEMO_TODAY, exec: '', type: '', status: '', prop: '', upcoming: true };

/* ---------- data access ---------- */
function nextApptId() { DB.counters.appt = (DB.counters.appt || 0) + 1; return 'APT-' + String(DB.counters.appt).padStart(4, '0'); }

/* One-time demo data: times for the seeded site visits + a few meetings and calls (also re-applied after "Reset demo data"). */
function ensureApptSeed() {
  if (DB.apptSeeded) return;
  DB.apptSeeded = true;
  const times = { 'CUST-1002': '11:00', 'CUST-1004': '10:30', 'CUST-1005': '16:00', 'CUST-1006': '15:00', 'CUST-1012': '11:30', 'CUST-1013': '12:00' };
  DB.customers.forEach(c => (c.siteVisits || []).forEach((v, i) => {
    if (!v.time && i === 0 && times[c.id]) v.time = times[c.id];
    v.exec = v.exec || c.owner; v.duration = v.duration || 60; v.id = v.id || nextApptId(); v.history = v.history || [];
  }));
  const add = (cid, o) => {
    const c = getCust(cid); if (!c) return;
    (c.appointments = c.appointments || []).push(Object.assign({ id: nextApptId(), duration: 60, exec: c.owner, status: 'Scheduled', prop: '', notes: '', feedback: '', cancelReason: '', history: [] }, o));
  };
  add('CUST-1004', { type: 'Office meeting', date: '2026-11-16', time: '11:00', prop: 'PROP-1007', notes: 'Final price discussion with the seller at our office' });
  add('CUST-1001', { type: 'Phone call', date: '2026-11-16', time: '17:00', duration: 30, prop: 'PROP-1001', notes: 'Share PROP-1001 documents and fix a site visit date' });
  add('CUST-1009', { type: 'Phone call', date: '2026-11-17', time: '12:00', duration: 30, prop: 'PROP-1011', notes: 'Loading bay and truck access questions' });
  add('CUST-1003', { type: 'Office meeting', date: '2026-11-17', time: '16:00', notes: 'Walk through comparable transactions for PROP-1001 and PROP-1012' });
  add('CUST-1007', { type: 'Phone call', date: '2026-11-18', time: '18:30', duration: 30, notes: 'Loan eligibility update' });
  add('CUST-1013', { type: 'Office meeting', date: '2026-11-25', time: '11:00', duration: 120, prop: 'PROP-1010', notes: 'Registration at the sub-registrar office' });
  add('CUST-1005', { type: 'Office meeting', date: '2026-11-12', time: '15:00', prop: 'PROP-1009', notes: 'Fire NOC verification update before final offer' });
  add('CUST-1008', { type: 'Office meeting', date: '2026-11-14', time: '15:00', status: 'Cancelled', cancelReason: 'Customer request', notes: 'Introductory meeting', history: [{ date: '2026-11-13', text: 'Cancelled — Customer request (travelling)', by: 'Executive 04 — Naveen P' }] });
  add('CUST-1011', { type: 'Phone call', date: '2026-11-06', time: '10:30', duration: 30, status: 'No-show', notes: 'Follow-up call', history: [{ date: '2026-11-06', text: 'Marked as no-show — not reachable', by: 'Executive 03 — Divya M' }] });
  save();
}

/* extra demo items (separate flag so browsers that already have appointment data get them too) */
function ensureApptSeedV2() {
  if (DB.apptSeedV2) return;
  DB.apptSeedV2 = true;
  const add = (cid, o) => { const c = getCust(cid); if (c) (c.appointments = c.appointments || []).push(Object.assign({ id: nextApptId(), duration: 30, exec: c.owner, status: 'Scheduled', prop: '', notes: '', feedback: '', cancelReason: '', history: [] }, o)); };
  add('CUST-1006', { type: 'Phone call', date: '2026-11-19', time: '11:30', prop: 'PROP-1008', notes: 'Confirm villa visit logistics and parking' });
  add('CUST-1014', { type: 'Office meeting', date: '2026-11-21', time: '10:00', duration: 60, notes: 'Introductory meeting — clarify budget and funding' });
  save();
}

function allAppointments() {
  ensureApptSeed(); ensureApptSeedV2();
  let dirty = false; const out = [];
  DB.customers.forEach(c => {
    (c.siteVisits || []).forEach((v, i) => { if (!v.id) { v.id = nextApptId(); dirty = true; } out.push(apptRow(c, 'siteVisits', i, v, 'Site visit')); });
    (c.appointments || []).forEach((v, i) => out.push(apptRow(c, 'appointments', i, v, v.type)));
  });
  if (dirty) save();
  return out.sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')));
}
function apptRow(c, src, i, v, type) {
  return { id: v.id, c, src, i, rec: v, type, date: v.date, time: v.time || '', duration: Number(v.duration) || 60, prop: v.prop || '', exec: v.exec || c.owner, status: v.status || 'Scheduled' };
}
const findAppt = id => allAppointments().find(a => a.id === id);
const toMin = t => t ? (+t.slice(0, 2)) * 60 + (+t.slice(3, 5)) : null;
const endTime = (t, dur) => { const m = toMin(t) + dur; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
const execShort = id => (execName(DB, id).split('—')[1] || execName(DB, id)).trim();

/** Clashes: same executive at an overlapping time, or the same property with another site visit at an overlapping time. */
function apptConflicts(x, ignoreId) {
  if (!x.time || !x.date) return [];
  const s = toMin(x.time), e = s + (Number(x.duration) || 60);
  return allAppointments().filter(a => a.id !== ignoreId && a.status === 'Scheduled' && a.date === x.date && a.time &&
    toMin(a.time) < e && s < toMin(a.time) + a.duration &&
    (a.exec === x.exec || (x.type === 'Site visit' && a.type === 'Site visit' && x.prop && a.prop === x.prop)))
    .map(a => a.exec === x.exec
      ? `${execName(DB, a.exec)} already has a ${a.type.toLowerCase()} with ${a.c.name} at ${a.time}–${endTime(a.time, a.duration)}`
      : `${a.prop} already has a site visit with ${a.c.name} at ${a.time}–${endTime(a.time, a.duration)}`);
}

/* ---------- small renderers ---------- */
function weekStart(d) { const dt = new Date(d + 'T00:00:00'); dt.setDate(dt.getDate() - (dt.getDay() + 6) % 7); return ymd(dt); }
const dayLabel = d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
function apptCard(a, compact) {
  const dim = a.status === 'Cancelled' || a.status === 'No-show';
  return `<div class="kcard" data-act="apptOpen" data-id="${a.id}" style="cursor:pointer;${dim ? 'opacity:.6;' : ''}${a.status === 'Scheduled' && a.date < DEMO_TODAY ? 'border-left:3px solid #e0a043;' : ''}">
    <div class="row"><b>${a.time || 'Time TBC'}</b><span>${APPT_ICON[a.type] || ''}</span><span class="sp"></span>${chip(a.status, APPT_TONE[a.status])}</div>
    <div class="nm" style="margin-top:3px;${dim ? 'text-decoration:line-through;' : ''}">${esc(a.c.name)}</div>
    <div class="ln">${a.type}${a.prop ? ' · ' + a.prop : ''}</div>
    ${compact ? '' : `<div class="ln">${esc(execShort(a.exec))}${a.time ? ' · ' + (DURATIONS.find(x => x.v === a.duration) || { l: a.duration + ' min' }).l : ''}</div>`}
  </div>`;
}

/* ---------- main view (Teams-style calendar) ---------- */
const TC_START = 7, TC_END = 21, TC_HH = 48; // visible hours and pixels per hour
const TC_TYPE = { 'Site visit': 't-visit', 'Office meeting': 't-meet', 'Phone call': 't-call' };
const tcStatus = a => a.status === 'Cancelled' ? 's-cancel' : a.status === 'No-show' ? 's-noshow' : a.status === 'Completed' ? 's-done' : a.date < DEMO_TODAY ? 's-needs' : '';
const fmtHour = h => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
const APPT_VIEWS = [{ v: 'day', l: 'Day' }, { v: 'workweek', l: 'Work week' }, { v: 'week', l: 'Week' }, { v: 'month', l: 'Month' }, { v: 'list', l: 'List' }];

function tcDays() {
  const A = UI.appt;
  if (A.view === 'day') return [A.date];
  const ws = weekStart(A.date);
  return Array.from({ length: A.view === 'workweek' ? 6 : 7 }, (_, i) => addDays(ws, i));
}
function tcRangeLabel() {
  const A = UI.appt, dt = s => new Date(s + 'T00:00:00');
  if (A.view === 'list') return A.upcoming ? `From ${fmtDate(DEMO_TODAY)}` : 'All dates';
  if (A.view === 'month') return dt(A.date).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  if (A.view === 'day') return dt(A.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const days = tcDays(), a = dt(days[0]), b = dt(days[days.length - 1]);
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} – ${b.getDate()} ${b.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`
    : `${a.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${b.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

/** Side-by-side layout for overlapping events (like Teams / Outlook). */
function tcLayout(evts) {
  evts.sort((a, b) => a.s - b.s || b.e - a.e);
  const out = []; let cluster = [], clusterEnd = -1;
  const flush = () => {
    const cols = [];
    cluster.forEach(ev => { let i = cols.findIndex(end => end <= ev.s); if (i < 0) { i = cols.length; cols.push(0); } cols[i] = ev.e; ev.col = i; });
    cluster.forEach(ev => { ev.ncol = cols.length; out.push(ev); });
    cluster = []; clusterEnd = -1;
  };
  evts.forEach(ev => { if (cluster.length && ev.s >= clusterEnd) flush(); cluster.push(ev); clusterEnd = Math.max(clusterEnd, ev.e); });
  if (cluster.length) flush();
  return out;
}

function tcTitle(a) {
  const p = a.prop ? getProp(a.prop) : null;
  return [`${a.type} — ${a.c.name}`, a.time ? `${a.time}–${endTime(a.time, a.duration)}` : 'Time not set', p ? `${p.id} · ${p.title}` : '', execName(DB, a.exec), `Status: ${a.status}`].filter(Boolean).join('\n');
}
function tcEvent(ev) {
  const a = ev.a, s = Math.max(ev.s, TC_START * 60), e = Math.min(ev.e, TC_END * 60);
  const top = (s - TC_START * 60) / 60 * TC_HH, h = Math.max((e - s) / 60 * TC_HH - 2, 20);
  const short = h < 40;
  return `<div class="tc-ev ${TC_TYPE[a.type]} ${tcStatus(a)} ${short ? 'short' : ''}" data-act="apptOpen" data-id="${a.id}" title="${esc(tcTitle(a))}"
    style="top:${top}px;height:${h}px;left:calc(${ev.col / ev.ncol * 100}% + 2px);width:calc(${100 / ev.ncol}% - 4px)">
    <b>${a.status === 'Completed' ? '✓ ' : ''}${APPT_ICON[a.type]} ${esc(a.c.name)}</b>
    ${short ? `<span>${a.time}</span>` : `<span>${a.type}${a.prop ? ' · ' + a.prop : ''}</span><span>${a.time}–${endTime(a.time, a.duration)} · ${esc(execShort(a.exec))}</span>`}
  </div>`;
}
function tcPill(a) {
  return `<div class="tc-pill ${TC_TYPE[a.type]} ${tcStatus(a)}" data-act="apptOpen" data-id="${a.id}" title="${esc(tcTitle(a))}">${a.time ? `<b>${a.time}</b> ` : ''}${APPT_ICON[a.type]} ${esc(a.c.name)}</div>`;
}

function tcGrid(f) {
  const days = tcDays(), n = days.length;
  const cols = `56px repeat(${n}, minmax(${n > 1 ? 120 : 200}px, 1fr))`;
  const untimed = d => f.filter(a => a.date === d && !a.time);
  const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
  const head = `<div class="tc-row tc-head" style="grid-template-columns:${cols}"><div></div>${days.map(d => {
    const dt = new Date(d + 'T00:00:00');
    return `<div class="tc-dh ${d === DEMO_TODAY ? 'today' : ''}" data-act="apptDay" data-d="${d}" title="Open day view"><span class="tc-dn">${dt.getDate()}</span><span>${dt.toLocaleDateString('en-IN', { weekday: n > 1 ? 'short' : 'long' })}</span></div>`;
  }).join('')}</div>`;
  const allday = days.some(d => untimed(d).length)
    ? `<div class="tc-row tc-allday" style="grid-template-columns:${cols}"><div class="tc-tl">Time TBC</div>${days.map(d => `<div>${untimed(d).map(tcPill).join('')}</div>`).join('')}</div>` : '';
  const hours = Array.from({ length: TC_END - TC_START }, (_, i) => TC_START + i);
  const times = `<div class="tc-times">${hours.map(h => `<span style="top:${(h - TC_START) * TC_HH}px">${fmtHour(h)}</span>`).join('')}</div>`;
  const dayCols = days.map(d => {
    const evs = tcLayout(f.filter(a => a.date === d && a.time).map(a => ({ a, s: toMin(a.time), e: toMin(a.time) + a.duration })));
    const nowLine = d === DEMO_TODAY && nowMin >= TC_START * 60 && nowMin <= TC_END * 60 ? `<div class="tc-now" style="top:${(nowMin - TC_START * 60) / 60 * TC_HH}px"></div>` : '';
    return `<div class="tc-day ${d === DEMO_TODAY ? 'today' : ''}" data-act="tcSlot" data-d="${d}" style="background-size:100% ${TC_HH}px,100% ${TC_HH / 2}px">${evs.map(tcEvent).join('')}${nowLine}</div>`;
  }).join('');
  return `<div class="tc"><div class="tc-body" id="tc-body">${head}${allday}
    <div class="tc-grid" style="grid-template-columns:${cols};height:${(TC_END - TC_START) * TC_HH}px">${times}${dayCols}</div></div></div>`;
}

function tcMonth(f) {
  const A = UI.appt, month = A.date.slice(0, 7), first = month + '-01', start = weekStart(first);
  const dim = new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate();
  const rows = Math.ceil((daysBetween(start, first) + dim) / 7);
  const cells = Array.from({ length: rows * 7 }, (_, i) => addDays(start, i)).map(d => {
    const list = f.filter(a => a.date === d), dt = new Date(d + 'T00:00:00');
    return `<div class="tc-mc ${d.slice(0, 7) !== month ? 'other' : ''} ${d === DEMO_TODAY ? 'today' : ''}" data-act="apptBookOpen" data-date="${d}" title="Click empty space to book">
      <div class="tc-mdn"><a data-act="apptDay" data-d="${d}">${dt.getDate()}${dt.getDate() === 1 ? ' ' + dt.toLocaleDateString('en-IN', { month: 'short' }) : ''}</a></div>
      ${list.slice(0, 3).map(tcPill).join('')}${list.length > 3 ? `<a class="tc-more" data-act="apptDay" data-d="${d}">+${list.length - 3} more</a>` : ''}</div>`;
  }).join('');
  return `<div class="tc"><div class="tc-month">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(w => `<div class="tc-mh">${w}</div>`).join('')}${cells}</div></div>`;
}

function viewAppointments() {
  const A = UI.appt, all = allAppointments();
  const f = all.filter(a => (!A.exec || a.exec === A.exec) && (!A.type || a.type === A.type) && (!A.status || a.status === A.status) && (!A.prop || a.prop === A.prop));
  const today = f.filter(a => a.date === DEMO_TODAY && a.status !== 'Cancelled');
  const next7 = f.filter(a => a.status === 'Scheduled' && a.date > DEMO_TODAY && a.date <= addDays(DEMO_TODAY, 7));
  const needs = f.filter(a => a.status === 'Scheduled' && a.date < DEMO_TODAY);
  const done = f.filter(a => a.status === 'Completed').length, lost = f.filter(a => a.status === 'Cancelled' || a.status === 'No-show').length;
  const nextToday = today.filter(a => a.status === 'Scheduled' && a.time).map(a => a.time)[0];
  const body = A.view === 'list' ? apptList(f) : A.view === 'month' ? tcMonth(f) : tcGrid(f);
  const legend = `<div class="tc-legend"><span><i class="t-visit"></i>Site visit</span><span><i class="t-meet"></i>Office meeting</span><span><i class="t-call"></i>Phone call</span>
    <span>✓ completed</span><span style="text-decoration:line-through">cancelled</span><span><i class="s-noshow" style="border-color:#b42318"></i>no-show</span><span><i style="outline:2px dashed #e0a043;border-color:transparent"></i>needs outcome</span>
    <span class="sp"></span><span>Click an empty slot to book · click an appointment to open it</span></div>`;
  return {
    title: 'Appointments', crumbs: 'Sales &amp; qualification / <b>Appointments</b>',
    html: `
    <div class="page-head"><div><h1>Appointments</h1><p>All site visits, office meetings and calls in one calendar — book, reschedule, cancel and record outcomes.</p></div></div>
    <div class="grid g4" style="margin-bottom:14px">
      <div class="card kpi"><div class="lbl">Today</div><div class="val">${today.length}</div><div class="sub">${nextToday ? 'next at ' + nextToday : 'nothing pending'}</div></div>
      <div class="card kpi"><div class="lbl">Next 7 days</div><div class="val">${next7.length}</div><div class="sub">${next7.filter(a => a.type === 'Site visit').length} site visit(s)</div></div>
      <div class="card kpi"><div class="lbl">Needs outcome</div><div class="val" style="color:${needs.length ? 'var(--amber)' : 'inherit'}">${needs.length}</div><div class="sub">past, still “Scheduled”</div></div>
      <div class="card kpi"><div class="lbl">Completed</div><div class="val" style="color:var(--green)">${done}</div><div class="sub">${lost} cancelled / no-show</div></div>
    </div>
    ${needs.length ? `<div class="note amber" style="margin-bottom:12px">Record what happened for: ${needs.map(a => `<a data-act="apptOpen" data-id="${a.id}">${esc(a.c.name)} (${a.type}, ${fmtDate(a.date)})</a>`).join(', ')}</div>` : ''}
    <div class="tc-bar">
      ${A.view !== 'list' ? `<button class="btn sm" data-act="apptNav" data-d="0">📅 Today</button>
        <button class="btn ghost sm" data-act="apptNav" data-d="-1" title="Previous">‹</button><button class="btn ghost sm" data-act="apptNav" data-d="1" title="Next">›</button>` : ''}
      <span class="tc-range">${tcRangeLabel()}</span>
      ${A.view !== 'list' ? `<input type="date" value="${A.date}" data-chg="apptDate" title="Go to date" style="width:auto">` : `<label class="check"><input type="checkbox" data-chg="apptUpcoming" ${A.upcoming ? 'checked' : ''}> Upcoming only</label>`}
      <span class="sp"></span>
      <select data-chg="apptView" style="width:auto;font-weight:600" title="Calendar view">${options(APPT_VIEWS, A.view)}</select>
      <button class="btn primary" data-act="apptBookOpen">＋ New appointment</button>
    </div>
    <div class="tc-bar tc-filters">
      <span class="muted" style="font-size:12px">Filter</span>
      <select data-chg="apptFilter" data-key="exec" style="width:auto">${options(DB.settings.executives.map(e => ({ v: e.id, l: e.name })), A.exec, 'All executives')}</select>
      <select data-chg="apptFilter" data-key="type" style="width:auto">${options(APPT_TYPES, A.type, 'All types')}</select>
      <select data-chg="apptFilter" data-key="status" style="width:auto">${options(APPT_STATUSES, A.status, 'Any status')}</select>
      <select data-chg="apptFilter" data-key="prop" style="width:auto;max-width:240px">${options(DB.properties.map(p => ({ v: p.id, l: `${p.id} · ${p.title}` })), A.prop, 'All properties')}</select>
      ${A.exec || A.type || A.status || A.prop ? '<button class="btn ghost sm" data-act="apptClearFilters">Clear</button>' : ''}
    </div>
    ${body}
    ${A.view !== 'list' ? legend : ''}`,
    after: () => { const b = document.getElementById('tc-body'); if (b) b.scrollTop = A.scrollTop != null ? A.scrollTop : (8 - TC_START) * TC_HH - 14; },
  };
}

function apptList(f) {
  const A = UI.appt, list = A.upcoming ? f.filter(a => a.date >= DEMO_TODAY || (a.status === 'Scheduled')) : f;
  return `<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Time</th><th>Type</th><th>Customer</th><th>Property</th><th>Executive</th><th>Status</th><th>Actions</th></tr></thead><tbody>
    ${list.map(a => `<tr class="click" data-act="apptOpen" data-id="${a.id}" style="${a.status === 'Cancelled' || a.status === 'No-show' ? 'opacity:.65' : ''}">
      <td>${fmtDate(a.date)}${a.date === DEMO_TODAY ? ' ' + chip('Today', 'blue') : ''}</td><td class="mono">${a.time ? `${a.time}–${endTime(a.time, a.duration)}` : 'TBC'}</td>
      <td>${APPT_ICON[a.type]} ${a.type}</td><td><b>${esc(a.c.name)}</b><br><small class="mono">${a.c.id}</small></td>
      <td>${a.prop ? `<span class="mono">${a.prop}</span>` : '<span class="muted">—</span>'}</td><td><small>${esc(execShort(a.exec))}</small></td>
      <td>${chip(a.status, APPT_TONE[a.status])}${a.status === 'Scheduled' && a.date < DEMO_TODAY ? ' ' + chip('Needs outcome', 'amber') : ''}</td>
      <td>${a.status === 'Scheduled' ? `<div class="row" style="gap:4px"><button class="btn sm" data-act="apptEdit" data-id="${a.id}">Reschedule</button><button class="btn sm" data-act="apptDoneOpen" data-id="${a.id}">Complete</button><button class="btn sm danger" data-act="apptCancelOpen" data-id="${a.id}">Cancel</button></div>` : ''}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">No appointments for these filters.</td></tr>'}
  </tbody></table></div>`;
}

/* ---------- dashboard card ---------- */
function todayApptsCard() {
  const list = allAppointments().filter(a => a.date === DEMO_TODAY && a.status !== 'Cancelled');
  return `<div class="card" style="margin-top:14px"><div class="card-head"><h2>Today’s appointments</h2>${chip(list.length, list.length ? 'blue' : '')}<span class="sp"></span>
      <button class="btn sm" data-act="apptBookOpen">＋ Book</button><a href="#/appointments">All appointments →</a></div>
    ${list.length ? `<div class="tbl-wrap"><table><tbody>${list.map(a => `<tr class="click" data-act="apptOpen" data-id="${a.id}">
      <td class="mono" style="width:110px">${a.time ? `${a.time}–${endTime(a.time, a.duration)}` : 'TBC'}</td><td>${APPT_ICON[a.type]} ${a.type}</td>
      <td><b>${esc(a.c.name)}</b>${a.prop ? ` <small class="mono">${a.prop}</small>` : ''}</td><td><small>${esc(execShort(a.exec))}</small></td><td>${chip(a.status, APPT_TONE[a.status])}</td></tr>`).join('')}</tbody></table></div>`
      : '<p class="muted">No appointments today.</p>'}</div>`;
}

/* ---------- modals ---------- */
function apptPropOptions(c, type) {
  const avail = DB.properties.filter(p => p.status === 'Available' && !p.archived);
  let list = avail.map(p => ({ v: p.id, l: `${p.id} · ${p.title}` }));
  if (c) {
    const mm = matchesForCustomer(c, DB), ids = mm.eligible.map(m => m.prop.id);
    list = mm.eligible.map(m => ({ v: m.prop.id, l: `★ ${m.prop.id} · ${m.prop.title} (${m.label})` })).concat(list.filter(o => !ids.includes(o.v)));
  }
  return type === 'Site visit' ? list : [{ v: '', l: '— Not about a specific property —' }].concat(list);
}

Object.assign(MODALS, {
  apptBook: m => {
    const editing = m.id ? findAppt(m.id) : null;
    const d = m.draft || (editing
      ? { cust: editing.c.id, type: editing.type, prop: editing.prop, date: editing.date, time: editing.time || '11:00', duration: editing.duration, exec: editing.exec, notes: editing.rec.notes || '' }
      : { cust: m.cust || '', type: m.type || 'Site visit', prop: m.prop || '', date: m.date || addDays(DEMO_TODAY, 1), time: m.time || '11:00', duration: 60, exec: m.exec || '', notes: '' });
    const c = getCust(d.cust);
    const custs = DB.customers.filter(x => isActive(x) || x.id === d.cust);
    return {
      title: editing ? `Reschedule ${editing.type.toLowerCase()} — ${esc(editing.c.name)}` : 'Book appointment',
      html: `
      ${m.warn ? `<div class="note red" style="margin-bottom:12px"><b>Time clash:</b><ul class="why" style="margin:4px 0 0">${m.warn.map(w => `<li>${esc(w)}</li>`).join('')}</ul>Change the time or executive, or click “Book anyway”.</div>` : ''}
      <div class="fgrid c2">
        ${fld('Customer', editing ? `<input value="${esc(c.name)} (${c.id})" disabled><input type="hidden" name="cust" value="${c.id}">`
          : `<select name="cust" data-chg="apptDraft" required>${options(custs.map(x => ({ v: x.id, l: `${x.name} (${x.id})` })), d.cust, '— Choose customer —')}</select>`, { req: 1 })}
        ${fld('Type', editing ? `<input value="${editing.type}" disabled><input type="hidden" name="type" value="${editing.type}">`
          : `<select name="type" data-chg="apptDraft">${options(APPT_TYPES, d.type)}</select>`, { req: 1 })}
        ${fld('Property', `<select name="prop">${options(apptPropOptions(c, d.type), d.prop)}</select>`, { cls: 'span3', req: d.type === 'Site visit', hint: c ? '★ = passes this customer’s hard filters' : '' })}
        ${fld('Date', `<input type="date" name="date" value="${esc(d.date)}" required>`, { req: 1 })}
        ${fld('Time', `<select name="time">${options(TIME_SLOTS, d.time)}</select>`, { req: 1 })}
        ${fld('Duration', `<select name="duration">${options(DURATIONS, d.duration)}</select>`)}
        ${fld('Sales executive', `<select name="exec">${options(DB.settings.executives.map(e => ({ v: e.id, l: e.name })), d.exec, c ? `Lead owner — ${execShort(c.owner)}` : 'Lead owner')}</select>`)}
        ${fld('Notes', `<textarea name="notes" placeholder="Purpose, what to prepare, meeting point…">${esc(d.notes)}</textarea>`, { cls: 'span3' })}
      </div>
      ${c && !(c.consent && c.consent.followUp) ? '<div class="note amber" style="margin-top:12px">No follow-up consent recorded for this customer — confirm consent before booking.</div>' : ''}`,
      submit: m.warn ? 'Book anyway' : editing ? 'Save new time' : 'Book appointment',
    };
  },
  apptDetail: m => {
    const a = findAppt(m.id); if (!a) return { title: 'Appointment', html: '<p>Not found.</p>', submit: false };
    const r = a.rec, p = a.prop ? getProp(a.prop) : null, sched = a.status === 'Scheduled';
    return {
      title: `${APPT_ICON[a.type]} ${a.type} — ${esc(a.c.name)}`, submit: false,
      html: `
      <div class="row" style="margin-bottom:10px">${chip(a.status, APPT_TONE[a.status])} ${chip(a.id, 'outline mono')} ${sched && a.date < DEMO_TODAY ? chip('Needs outcome', 'amber') : ''}</div>
      <dl class="kv" style="grid-template-columns:120px 1fr">
        <dt>When</dt><dd>${fmtDate(a.date)} · ${a.time ? `${a.time}–${endTime(a.time, a.duration)}` : 'time not set'}</dd>
        <dt>Customer</dt><dd><a data-act="apptGo" data-href="#/customers/${a.c.id}/followups">${esc(a.c.name)}</a> <small>${esc(a.c.mobile)} · prefers ${esc(a.c.contactPref)}</small></dd>
        <dt>Property</dt><dd>${p ? `<a data-act="apptGo" data-href="#/properties/${p.id}">${p.id}</a> ${esc(p.title)} <small>${esc(p.locality)}, ${esc(p.city)}</small>` : '—'}</dd>
        <dt>Executive</dt><dd>${esc(execName(DB, a.exec))}</dd>
        <dt>Notes</dt><dd>${esc(r.notes || '—')}</dd>
        ${r.feedback ? `<dt>Outcome</dt><dd>${esc(r.feedback)}${r.interest ? ` · interest: <b>${r.interest}</b>` : ''}</dd>` : ''}
        ${r.cancelReason ? `<dt>Cancel reason</dt><dd>${esc(r.cancelReason)}</dd>` : ''}
      </dl>
      ${(r.history || []).length ? `<hr><b style="font-size:13px">History</b><ul class="tl" style="margin-top:8px">${r.history.slice().reverse().map(h => `<li><div class="when">${fmtDate(h.date)} · ${esc(h.by)}</div>${esc(h.text)}</li>`).join('')}</ul>` : ''}
      <hr><div class="row">
        ${sched ? `<button type="button" class="btn sm" data-act="apptEdit" data-id="${a.id}">↻ Reschedule</button><button type="button" class="btn sm primary" data-act="apptDoneOpen" data-id="${a.id}">✓ Mark completed</button>
          <button type="button" class="btn sm" data-act="apptNoShow" data-id="${a.id}">No-show</button><button type="button" class="btn sm danger" data-act="apptCancelOpen" data-id="${a.id}">Cancel</button>`
          : `<button type="button" class="btn sm" data-act="apptRebook" data-id="${a.id}">Book a follow-up appointment</button>`}
        <span class="sp"></span><button type="button" class="btn sm" data-act="apptGo" data-href="#/customers/${a.c.id}/followups">Open customer →</button></div>`,
    };
  },
  apptCancel: m => {
    const a = findAppt(m.id);
    return { title: `Cancel ${a.type.toLowerCase()} — ${esc(a.c.name)}`, submit: 'Cancel appointment', html: `
      <p class="muted" style="margin-top:0">${fmtDate(a.date)} ${a.time || ''}${a.prop ? ' · ' + a.prop : ''}</p>
      ${fld('Reason', `<select name="reason">${options(CANCEL_REASONS, 'Customer request')}</select>`, { req: 1 })}<div style="height:10px"></div>
      ${fld('Details', `<input name="note" placeholder="Optional">`)}` };
  },
  apptDone: m => {
    const a = findAppt(m.id), c = a.c, consent = c.consent && c.consent.followUp;
    return { title: `Record outcome — ${esc(c.name)}`, submit: 'Mark completed', html: `
      <p class="muted" style="margin-top:0">${a.type} · ${fmtDate(a.date)} ${a.time || ''}${a.prop ? ' · ' + a.prop : ''}</p>
      ${fld(a.type === 'Site visit' ? 'Site visit feedback' : 'Outcome', `<textarea name="feedback" required placeholder="What did the customer say? Concerns, questions, next step…"></textarea>`, { req: 1 })}<div style="height:10px"></div>
      <div class="fgrid c2">
        ${a.type === 'Site visit' ? fld('Customer interest', `<select name="interest">${options(['High', 'Medium', 'Low'], 'Medium')}</select>`) : ''}
        ${fld('Next follow-up', `<input type="date" name="next" ${consent ? '' : 'disabled'}>`, { hint: consent ? 'Optional' : 'Needs consent' })}
      </div>` };
  },
});

Object.assign(MODAL_SUBMIT, {
  apptBook: (m, fd) => {
    const d = { cust: fd.get('cust'), type: fd.get('type'), prop: fd.get('prop') || '', date: fd.get('date'), time: fd.get('time'), duration: Number(fd.get('duration')) || 60, exec: fd.get('exec') || '', notes: (fd.get('notes') || '').trim() };
    const c = getCust(d.cust);
    if (!c) return toast('Choose a customer');
    if (!d.date) return toast('Choose a date');
    if (d.type === 'Site visit' && !d.prop) return toast('Choose the property for the site visit');
    if (!d.exec) d.exec = c.owner;
    const conflicts = apptConflicts(d, m.id);
    const sameAsWarned = m.warn && m.draft && ['date', 'time', 'duration', 'exec', 'prop'].every(k => String(m.draft[k]) === String(d[k]));
    if (conflicts.length && !sameAsWarned) { m.warn = conflicts; m.draft = d; render(); return; }
    const by = currentUser(), when = `${fmtDate(d.date)} ${d.time}`;
    if (m.id) {
      const a = findAppt(m.id), r = a.rec, old = `${fmtDate(r.date)} ${r.time || ''}`.trim(), moved = r.date !== d.date || r.time !== d.time;
      Object.assign(r, { date: d.date, time: d.time, duration: d.duration, exec: d.exec, prop: d.prop, notes: d.notes, status: 'Scheduled' });
      (r.history = r.history || []).push({ date: DEMO_TODAY, text: moved ? `Rescheduled from ${old} to ${when}` : 'Details updated', by });
      logActivity(c, ACTIVITY_FOR[a.type], moved ? `${a.type} rescheduled from ${old} to ${when}` : `${a.type} on ${when} updated`);
      toast(moved ? 'Appointment rescheduled' : 'Appointment updated');
    } else {
      const rec = { id: nextApptId(), date: d.date, time: d.time, duration: d.duration, exec: d.exec, prop: d.prop, notes: d.notes, status: 'Scheduled', feedback: '', interest: '', cancelReason: '', history: [{ date: DEMO_TODAY, text: `Booked for ${when}${conflicts.length ? ' (booked despite a time clash)' : ''}`, by }] };
      if (d.type === 'Site visit') {
        (c.siteVisits = c.siteVisits || []).push(rec);
        if (!(c.recommended || []).includes(d.prop)) (c.recommended = c.recommended || []).push(d.prop);
        if (stageIndex(c.stage) >= 0 && stageIndex(c.stage) < STAGES.indexOf('Site visit scheduled')) moveStage(c, 'Site visit scheduled');
      } else (c.appointments = c.appointments || []).push(Object.assign({ type: d.type }, rec));
      logActivity(c, ACTIVITY_FOR[d.type], `${d.type} booked for ${when}${d.prop ? ' — ' + d.prop : ''} with ${execName(DB, d.exec)}`);
      toast(`${d.type} booked`);
    }
    save(); UI.modal = null; render();
  },
  apptCancel: (m, fd) => {
    const a = findAppt(m.id), r = a.rec, reason = fd.get('reason'), note = (fd.get('note') || '').trim();
    r.status = 'Cancelled'; r.cancelReason = reason + (note ? ` — ${note}` : '');
    (r.history = r.history || []).push({ date: DEMO_TODAY, text: `Cancelled — ${r.cancelReason}`, by: currentUser() });
    logActivity(a.c, ACTIVITY_FOR[a.type], `${a.type} on ${fmtDate(a.date)} cancelled (${r.cancelReason})`);
    save(); UI.modal = null; toast('Appointment cancelled'); render();
  },
  apptDone: (m, fd) => {
    const a = findAppt(m.id), r = a.rec, c = a.c, fb = (fd.get('feedback') || '').trim();
    if (!fb) return toast('Add the outcome');
    r.status = 'Completed'; r.feedback = fb; if (a.type === 'Site visit') r.interest = fd.get('interest') || '';
    (r.history = r.history || []).push({ date: DEMO_TODAY, text: 'Marked completed', by: currentUser() });
    c.lastContact = a.date > DEMO_TODAY ? DEMO_TODAY : a.date; c.engagement.responded = true;
    if (a.type === 'Site visit') c.engagement.siteVisited = true;
    const next = fd.get('next'); if (next && c.consent.followUp) c.nextFollowUp = next;
    logActivity(c, ACTIVITY_FOR[a.type], `${a.type} completed${a.prop ? ' (' + a.prop + ')' : ''}: ${fb}${r.interest ? ` — interest ${r.interest}` : ''}`);
    save(); UI.modal = null; toast('Outcome recorded'); render();
  },
});

/* ---------- actions & changes ---------- */
Object.assign(ACTIONS, {
  apptSetView: d => { UI.appt.view = d.v; render(); },
  apptClearFilters: () => { Object.assign(UI.appt, { exec: '', type: '', status: '', prop: '' }); render(); },
  apptNav: d => {
    const A = UI.appt, n = +d.d;
    if (n === 0) A.date = DEMO_TODAY;
    else if (A.view === 'month') { const dt = new Date(A.date.slice(0, 7) + '-01T00:00:00'); dt.setMonth(dt.getMonth() + n); A.date = ymd(dt); }
    else A.date = addDays(A.date, n * (A.view === 'day' ? 1 : 7));
    render();
  },
  tcSlot: (d, el, e) => { // click on empty calendar space -> book at that half-hour
    const y = e && e.clientY != null ? e.clientY - el.getBoundingClientRect().top : 0;
    const m = Math.min(Math.max(TC_START * 60 + Math.floor(Math.max(y, 0) / (TC_HH / 2)) * 30, TC_START * 60), 20 * 60 + 30);
    openModal({ kind: 'apptBook', date: d.d, time: String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'), exec: UI.appt.exec });
  },
  apptDay: d => { UI.appt.view = 'day'; UI.appt.date = d.d; render(); },
  apptOpen: d => openModal({ kind: 'apptDetail', id: d.id }),
  apptBookOpen: d => openModal({ kind: 'apptBook', date: d.date, time: d.time, exec: d.exec }),
  apptEdit: d => openModal({ kind: 'apptBook', id: d.id }),
  apptRebook: d => { const a = findAppt(d.id); openModal({ kind: 'apptBook', cust: a.c.id, type: a.type, prop: a.prop }); },
  apptCancelOpen: d => openModal({ kind: 'apptCancel', id: d.id }),
  apptDoneOpen: d => openModal({ kind: 'apptDone', id: d.id }),
  apptNoShow: d => {
    const a = findAppt(d.id), r = a.rec;
    r.status = 'No-show'; (r.history = r.history || []).push({ date: DEMO_TODAY, text: 'Marked as no-show', by: currentUser() });
    logActivity(a.c, ACTIVITY_FOR[a.type], `${a.type} on ${fmtDate(a.date)} — customer did not show up`);
    save(); toast('Marked as no-show'); render();
  },
  apptGo: d => { UI.modal = null; go(d.href); render(); },
});
Object.assign(CHANGES, {
  apptFilter: el => { UI.appt[el.dataset.key] = el.value; render(); },
  apptView: el => { UI.appt.view = el.value; render(); },
  apptDate: el => { if (el.value) { UI.appt.date = el.value; render(); } },
  apptUpcoming: el => { UI.appt.upcoming = el.checked; render(); },
  apptDraft: el => {
    const fd = new FormData(el.form), m = UI.modal;
    m.draft = { cust: fd.get('cust'), type: fd.get('type'), prop: '', date: fd.get('date'), time: fd.get('time'), duration: Number(fd.get('duration')) || 60, exec: fd.get('exec') || '', notes: fd.get('notes') || '' };
    m.warn = null; render();
  },
});

/* remember the calendar's vertical scroll position across re-renders */
document.addEventListener('scroll', e => { if (e.target && e.target.id === 'tc-body') UI.appt.scrollTop = e.target.scrollTop; }, true);
