/* =====================================================================
   Projects — a builder's development with many units (#/projects)
   A project holds what its units share — builder, location, RERA number, approvals, amenities, brochure, possession,
   and a price list. Each unit (a flat, or a plot in a layout) is an ordinary property linked to its project
   (property.projectId + property.unit = { block, floor, no, pos, corner }), so matching, the Share page, recommendations
   and the Lead pipeline work for units without anything special.
   What the module adds:
     · the inventory at a glance — a grid of units coloured by status, per block and floor (or per phase for plots);
     · holding a unit for a buyer for 2 days ("blocking"), so nobody else sells it meanwhile;
     · a price list (base rate, floor rise, corner premium, parking) applied to the available units at once;
     · the buyers who fit the project, and which units fit each buyer — matching on top.
   Roles: the Sales manager / Admin creates projects, sets the price list and marks units booked or sold.
          A Sales executive holds units for their own leads, recommends and shares.
   ===================================================================== */

UI.prj = { unit: '', buyer: '', edit: false };
const PRJ_STATUSES = ['Upcoming launch', 'Under construction', 'Ready'];
const PRJ_HOLD_DAYS = 2;
const prjUnits = prj => DB.properties.filter(p => p.projectId === prj.id && !p.archived);
const getProject = id => (DB.projects || []).find(x => x.id === id);
const projectOf = p => p && p.projectId ? getProject(p.projectId) : null;
const fmtMonth = m => { if (!m) return '—'; const [y, mo] = String(m).split('-'); return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+mo - 1] || ''} ${y}`; };
/** A unit's price from the project's price list: area × (base rate + floor rise) × corner premium + parking. */
function prjPriceParts(prj, p) {
  const L = prj.priceList || {}, u = p.unit || {}, flat = prj.type === 'flat';
  const rise = flat ? (Number(L.floorRisePsf) || 0) * Math.max(0, (Number(u.floor) || 1) - 1) : 0;
  const base = p.area * ((Number(L.basePsf) || 0) + rise), corner = u.corner ? base * (Number(L.cornerPct) || 0) / 100 : 0, parking = flat ? Number(L.parking) || 0 : 0;
  return { rate: (Number(L.basePsf) || 0) + rise, rise, base, corner, parking, total: Math.round((base + corner + parking) / 1000) * 1000 };
}
const prjPrice = (prj, p) => prjPriceParts(prj, p).total;
const PRJ_ST = { Available: 'av', Reserved: 'held', Booked: 'booked', Sold: 'sold', 'Under negotiation': 'neg', 'On hold': 'off' };
function prjCount(us) {
  const c = { Available: 0, Reserved: 0, Booked: 0, Sold: 0, other: 0 };
  us.forEach(u => { if (c[u.status] !== undefined) c[u.status]++; else c.other++; });
  return c;
}
const prjRange = us => { const ps = us.filter(u => u.status === 'Available').map(u => u.price); return ps.length ? [Math.min(...ps), Math.max(...ps)] : [0, 0]; };
/** Active buyers who fit at least one available unit, best unit first. */
function prjBuyers(prj) {
  const units = prjUnits(prj).filter(u => u.status === 'Available');
  return DB.customers.filter(isActive).map(c => {
    const fits = units.map(u => ({ u, m: matchScore(c, u, DB.settings) })).filter(x => !x.m.excluded).sort((a, b) => b.m.M - a.m.M);
    return fits.length ? { c, best: fits[0], n: fits.length, fits } : null;
  }).filter(Boolean).sort((a, b) => b.best.m.M - a.best.m.M);
}
const prjHoldOf = u => (u.status === 'Reserved' && u.hold ? u.hold : null);
const prjExpired = h => h && h.until < DEMO_TODAY;
/** Who may hold a unit for this lead: managers for anyone, a Sales executive for their own leads. */
const prjCanHoldFor = c => canEditSettings() || c.owner === 'EX01';

/* ---------- making units ---------- */
/** The units a project's structure describes (not saved) — used by "New project" (preview) and to create them. */
function prjPlan(prj, blocks, db = DB) {
  const out = [];
  if (prj.type === 'flat') {
    blocks.forEach(b => { for (let f = 1; f <= b.floors; f++) for (let pos = 1; pos <= prj.perFloor; pos++) {
      const m = prj.mix[pos - 1] || prj.mix[0];
      out.push({ block: b.name, floor: f, pos, no: `${b.name}-${f}0${pos}`, bhk: m.bhk, area: +m.area, facing: m.facing, corner: !!m.corner, totalFloors: b.floors });
    } });
  } else {
    let n = (db.properties || []).filter(p => p.projectId === prj.id).length;
    blocks.forEach(b => { for (let i = 1; i <= b.plots; i++) {
      const m = prj.plotMix[(i - 1) % prj.plotMix.length]; n++;
      out.push({ block: b.name, floor: null, pos: i, no: String(n), length: +m.length, width: +m.width, area: m.length * m.width, facing: m.facing, corner: i === 1 || i === b.plots });
    } });
  }
  return out;
}
function prjMakeUnit(db, prj, u) {
  const flat = prj.type === 'flat';
  const p = {
    id: 'PROP-' + (++db.counters.prop), projectId: prj.id, unit: { block: u.block, floor: u.floor, no: u.no, pos: u.pos, corner: u.corner },
    title: flat ? `${prj.name} — ${u.no} · ${u.bhk}` : `${prj.name} — Plot ${u.no}`,
    type: prj.type, purpose: 'Sale', status: 'Available', listingDate: prj.launched || DEMO_TODAY,
    city: prj.city, locality: prj.locality, state: 'Tamil Nadu', facing: u.facing || '', area: u.area, price: 0,
    amenities: (prj.amenities || []).slice(), images: prj.images || 0,
    specs: flat ? { bhk: u.bhk, carpet: Math.round(u.area * 0.8), superBuiltup: u.area, floor: u.floor, totalFloors: u.totalFloors, lifts: 1, parking: '1 covered', possession: prj.status === 'Ready' ? 'Ready to move' : 'Under construction', possessionDate: prj.possession || '' }
      : { length: u.length, width: u.width, roadWidth: 30, roadAccess: 'Layout road', corner: u.corner ? 'Corner' : 'Non-corner', topography: 'Level', landUse: 'Residential', layoutApproval: prj.layoutApproval || '' },
    location: { lat: prj.lat || '', lng: prj.lng || '', address: prj.address || '', pincode: prj.pincode || '', district: (CITIES[prj.city] || {}).district || prj.city, pinOk: !!prj.lat, suggestPending: false, roadType: '', roadWidth: '', nearby: [] },
    approvals: (prj.approvals || []).map(a => ({ k: a.k, status: a.status, file: a.file || '', uploadedBy: '', uploadedAt: '', verifiedBy: '', verifiedAt: '' })), documents: [],
    valuation: { reviewDate: '', valuerReport: '', notes: '', comparables: [] },
    history: [{ date: DEMO_TODAY, ts: Date.now(), text: `Created as unit ${u.no} of ${prj.name} (${prj.id})`, by: prj.createdBy || 'Admin' }],
  };
  p.price = prjPrice(prj, p);
  db.properties.push(p);
  return p;
}
/** Create the units for some blocks; the nearby places are looked up once and shared by every unit. */
function prjGenerate(db, prj, blocks) {
  const made = prjPlan(prj, blocks, db).map(u => prjMakeUnit(db, prj, u));
  if (!prj.nearby && made.length && typeof addDefaultPlaces === 'function') {
    const saved = DB; DB = db; addDefaultPlaces(made[0]); DB = saved; // runs against the database being built
    prj.nearby = clone(made[0].location.nearby);
  }
  made.forEach((p, i) => { if (i || !p.location.nearby.length) p.location.nearby = (prj.nearby || []).map((x, j) => Object.assign({}, x, { id: `nb-${p.id}-${j}` })); });
  return made;
}

/* ---------- sample projects (fictional) ---------- */
function seedProjectsInto(db) {
  db.projects = [];
  const lotus = {
    id: 'PRJ-001', name: 'Lotus Residency', builder: 'Lotus Builders (sample)', type: 'flat', city: 'Madurai', locality: 'Anna Nagar', address: '12, 4th Main Road', pincode: '625020',
    lat: 9.9252, lng: 78.1390, status: 'Under construction', possession: '2027-06', launched: '2026-08-01', rera: 'TN/35/Building/0456/2026',
    approvals: [{ k: 'rera', status: 'verified', file: 'rera-certificate.pdf' }, { k: 'building', status: 'uploaded', file: 'building-approval.pdf' }],
    amenities: ['Lift', 'Power backup', 'Gym', 'Security', 'CCTV', 'Visitor parking'], images: 8, brochure: 'lotus-residency-brochure.pdf',
    description: 'Two 4-floor blocks of 2 and 3 BHK homes, 400 m from Anna Nagar main road.',
    blocks: [{ name: 'A', floors: 4 }, { name: 'B', floors: 4 }], perFloor: 2,
    mix: [{ bhk: '2 BHK', area: 1050, facing: 'East', corner: false }, { bhk: '3 BHK', area: 1380, facing: 'North', corner: true }],
    priceList: { basePsf: 4400, floorRisePsf: 40, cornerPct: 3, parking: 250000 }, createdBy: 'Sales manager', createdAt: '2026-08-01',
    history: [{ date: '2026-08-01', text: 'Project created with 16 units', by: 'Sales manager' }, { date: '2026-10-20', text: 'Price list updated: base ₹4,400/sq.ft.', by: 'Sales manager' }],
  };
  const acres = {
    id: 'PRJ-002', name: 'Green Acres Layout', builder: 'Green Acres Developers (sample)', type: 'plot', city: 'Madurai', locality: 'Othakadai', address: 'Othakadai–Melur Road', pincode: '625107',
    lat: 9.9540, lng: 78.1820, status: 'Ready', possession: '', launched: '2026-06-15', rera: 'TN/35/Layout/0211/2026', layoutApproval: 'DTCP approval (sample no. 77/2026)',
    approvals: [{ k: 'rera', status: 'verified', file: 'rera-layout.pdf' }, { k: 'building', status: 'verified', file: 'dtcp-approval.pdf' }],
    amenities: ['Gated community', 'Park / open space', 'Security'], images: 5, brochure: 'green-acres-layout-plan.pdf',
    description: 'A DTCP-approved gated layout of 12 plots with 30 ft roads, ready to register.',
    blocks: [{ name: 'Phase 1', plots: 12 }],
    plotMix: [{ length: 40, width: 30, facing: 'East' }, { length: 40, width: 30, facing: 'West' }, { length: 50, width: 30, facing: 'East' }],
    priceList: { basePsf: 2900, floorRisePsf: 0, cornerPct: 5, parking: 0 }, createdBy: 'Sales manager', createdAt: '2026-06-15',
    history: [{ date: '2026-06-15', text: 'Project created with 12 plots', by: 'Sales manager' }],
  };
  [lotus, acres].forEach(prj => { db.projects.push(prj); prjGenerate(db, prj, prj.blocks); });
  const unit = (prj, no) => db.properties.find(p => p.projectId === prj.id && p.unit.no === no);
  const set = (prj, no, status, extra) => { const u = unit(prj, no); u.status = status; Object.assign(u, extra || {}); u.history.unshift({ date: '2026-11-10', text: `Status changed: Available → ${status}`, by: 'Sales manager' }); };
  ['A-101', 'A-102', 'B-101'].forEach(no => set(lotus, no, 'Sold'));
  ['A-201', 'B-102'].forEach(no => set(lotus, no, 'Booked'));
  set(lotus, 'B-301', 'Reserved', { hold: { cust: 'CUST-1002', by: 'Executive 02 — Karthik R', at: '2026-11-15', until: '2026-11-17' } });
  ['1', '2'].forEach(no => set(acres, no, 'Sold'));
  set(acres, '5', 'Booked');
  set(acres, '8', 'Reserved', { hold: { cust: 'CUST-1011', by: 'Executive 03 — Divya M', at: '2026-11-12', until: '2026-11-14' } }); // expired — shows "release or extend"
}
// new and reset demo data get the sample projects; data saved before this module gets them once
const _seedDBWithoutProjects = seedDB;
seedDB = function () { const db = _seedDBWithoutProjects(); seedProjectsInto(db); return db; };
if (!DB.projects) { seedProjectsInto(DB); save(); }

/* ---------- list ---------- */
function prjInvBar(c, total) {
  const seg = (n, cls, l) => n ? `<i class="st-${cls}" style="width:${n / total * 100}%" title="${n} ${l}"></i>` : '';
  return `<div class="pj-inv">${seg(c.Available, 'av', 'available')}${seg(c.Reserved, 'held', 'held for a buyer')}${seg(c.Booked, 'booked', 'booked')}${seg(c.Sold, 'sold', 'sold')}${seg(c.other, 'off', 'other')}</div>`;
}
function viewProjects() {
  const mgr = canEditSettings();
  const cards = (DB.projects || []).map(prj => {
    const us = prjUnits(prj), c = prjCount(us), [lo, hi] = prjRange(us), buyers = prjBuyers(prj).length;
    return `<a class="pj-card" href="#/projects/${prj.id}">
      <div class="pj-cover ${prj.type}"><span>${prj.type === 'flat' ? '🏢' : '🗺️'}</span><b>${prj.images || 0} 📷</b></div>
      <div class="pj-body">
        <div class="pj-kick">${prj.type === 'flat' ? 'Apartments' : 'Plotted layout'} · ${esc(prj.status)}</div>
        <h3>${esc(prj.name)}</h3><small>${esc(prj.builder)} · 📍 ${esc(prj.locality)}, ${esc(prj.city)}</small>
        ${prjInvBar(c, us.length || 1)}
        <div class="pj-meta"><span><b>${c.Available}</b> of ${us.length} available</span><span>${lo ? (lo === hi ? inrShort(lo) : `${inrShort(lo)} – ${inrShort(hi)}`) : 'Sold out'}</span></div>
        <div class="pj-foot">${buyers ? `<span class="pj-fit">🎯 ${buyers} buyer${buyers > 1 ? 's' : ''} fit</span>` : '<span class="muted">No buyer fits yet</span>'}${prj.rera ? '<span>✓ RERA</span>' : ''}<span>${prj.possession ? 'Possession ' + fmtMonth(prj.possession) : esc(prj.status)}</span></div>
      </div></a>`;
  }).join('');
  return {
    title: 'Projects', crumbs: 'Specification data / <b>Projects</b>',
    html: `<div class="page-head"><div><h1>Projects</h1><p>A builder’s development with many units — apartments or a plotted layout. Each unit is a property, so it is matched, shared and recommended like any other.</p></div><span class="sp"></span>
      ${mgr ? '<a class="btn primary" href="#/projects/new">＋ New project</a>' : ''}</div>
      <div class="pj-grid">${cards || '<div class="card empty">No projects yet.</div>'}</div>`,
  };
}

/* ---------- one project ---------- */
function viewProject(id) {
  const prj = getProject(id);
  if (!prj) return { title: 'Not found', html: '<div class="card empty">Project not found. <a href="#/projects">Back to projects</a></div>' };
  if (UI.prj.pid !== prj.id) Object.assign(UI.prj, { pid: prj.id, unit: '', buyer: '', edit: false });
  const mgr = canEditSettings(), us = prjUnits(prj), c = prjCount(us), [lo, hi] = prjRange(us), buyers = prjBuyers(prj);
  const sel = UI.prj.unit ? getProp(UI.prj.unit) : null, focus = UI.prj.buyer ? buyers.find(b => b.c.id === UI.prj.buyer) : null;
  const fitOf = u => focus ? focus.fits.find(x => x.u.id === u.id) : null;
  const flat = prj.type === 'flat';
  const kpi = (ic, tone, n, l) => `<div class="pk"><span class="pk-ic" style="--c:${tone}">${ic}</span><div><b>${n}</b><span>${l}</span></div></div>`;
  const cell = u => {
    const h = prjHoldOf(u), f = fitOf(u);
    return `<button class="pj-u st-${PRJ_ST[u.status] || 'off'} ${sel && sel.id === u.id ? 'on' : ''} ${focus ? (f ? 'fit' : 'dim') : ''}" data-act="prjUnit" data-id="${u.id}"
      title="${esc(u.title)} — ${esc(u.status)}${h ? ` (held for ${esc((getCust(h.cust) || {}).name || h.cust)})` : ''}">
      <b>${esc(flat ? u.unit.no : 'Plot ' + u.unit.no)}</b><small>${flat ? esc(u.specs.bhk) : `${u.specs.length}×${u.specs.width}`}${u.unit.corner ? ' · corner' : ''}</small>
      <small>${u.status === 'Available' ? inrShort(u.price) : u.status === 'Reserved' ? (prjExpired(h) ? '⌛ hold expired' : '🔒 held') : esc(u.status)}</small>${f ? `<em>${f.m.M}%</em>` : ''}</button>`;
  };
  const blocks = [...new Set(us.map(u => u.unit.block))];
  const grid = blocks.map(b => {
    const bu = us.filter(u => u.unit.block === b);
    if (!flat) return `<div class="pj-block"><h4>${esc(b)} <small>${bu.length} plots</small></h4><div class="pj-plots">${bu.sort((x, y) => x.unit.pos - y.unit.pos).map(cell).join('')}</div></div>`;
    const floors = [...new Set(bu.map(u => u.unit.floor))].sort((x, y) => y - x);
    return `<div class="pj-block"><h4>Block ${esc(b)} <small>${floors.length} floors · ${bu.length} flats</small></h4>
      ${floors.map(f => `<div class="pj-floor"><span class="pj-fl">F${f}</span>${bu.filter(u => u.unit.floor === f).sort((x, y) => x.unit.pos - y.unit.pos).map(cell).join('')}</div>`).join('')}</div>`;
  }).join('');
  const legend = `<div class="pj-legend"><span><i class="st-av"></i>Available ${c.Available}</span><span><i class="st-held"></i>Held for a buyer ${c.Reserved}</span><span><i class="st-booked"></i>Booked ${c.Booked}</span><span><i class="st-sold"></i>Sold ${c.Sold}</span></div>`;
  const inventory = `<div class="card"><div class="card-head"><h2>Inventory</h2><span class="sp"></span>${mgr ? `<button class="btn sm" data-act="prjAddBlock" data-id="${prj.id}">＋ Add ${flat ? 'block' : 'phase'}</button>` : ''}</div>
    ${legend}${focus ? `<div class="note blue" style="margin:8px 0">Showing the units that fit <b>${esc(focus.c.name)}</b> (${focus.n}) — <button class="linkbtn" data-act="prjBuyer" data-id="">show all</button></div>` : ''}
    <div class="pj-blocks">${grid}</div></div>`;
  // buyers who fit — matching on top
  const buyersCard = `<div class="card pj-buyers"><div class="card-head"><h2>🎯 Buyers who fit</h2>${chip(buyers.length)}</div>
    ${buyers.length ? buyers.slice(0, 6).map(b => `<div class="pj-buyer ${UI.prj.buyer === b.c.id ? 'on' : ''}">
        <span class="ov-av">${esc(initials(b.c.name))}</span>
        <div class="pj-bn"><a href="#/customers/${b.c.id}"><b>${esc(b.c.name)}</b></a><small>${inrShort(b.c.budget.max)} max · ${esc(b.c.stage)} · best: <a data-act="prjUnit" data-id="${b.best.u.id}">${esc(flat ? b.best.u.unit.no : 'Plot ' + b.best.u.unit.no)}</a></small></div>
        ${chip(b.best.m.M + '%', b.best.m.tone, b.best.m.label)}
        <button class="btn sm ghost" data-act="prjBuyer" data-id="${b.c.id}" title="Highlight the units that fit">${UI.prj.buyer === b.c.id ? 'All units' : `${b.n} unit${b.n > 1 ? 's' : ''}`}</button></div>`).join('')
      : '<p class="muted" style="margin:0">No active buyer fits an available unit yet.</p>'}</div>`;
  const panel = sel ? prjUnitPanel(prj, sel) : `<div class="card pj-hint">👆 Click a unit to see its price, who it fits, and to hold it for a buyer.</div>`;
  const pl = prj.priceList || {}, dis = mgr ? '' : 'disabled';
  const avail = us.filter(u => u.status === 'Available'), changes = avail.filter(u => prjPrice(prj, u) !== u.price).length;
  const priceCard = `<div class="card"><div class="card-head"><h2>Price list</h2><span class="sp"></span>${mgr ? '' : '<small class="muted">Set by a manager</small>'}</div>
    <div class="pj-pl">
      <label>Base rate (₹/sq.ft.)<input type="number" value="${pl.basePsf || ''}" data-chg="prjPL" data-id="${prj.id}" data-k="basePsf" ${dis}></label>
      ${flat ? `<label>Floor rise (₹/sq.ft. per floor)<input type="number" value="${pl.floorRisePsf || 0}" data-chg="prjPL" data-id="${prj.id}" data-k="floorRisePsf" ${dis}></label>` : ''}
      <label>Corner premium (%)<input type="number" value="${pl.cornerPct || 0}" data-chg="prjPL" data-id="${prj.id}" data-k="cornerPct" ${dis}></label>
      ${flat ? `<label>Car parking (₹)<input type="number" value="${pl.parking || 0}" data-chg="prjPL" data-id="${prj.id}" data-k="parking" ${dis}></label>` : ''}</div>
    <p class="muted" style="margin:8px 0 0;font-size:12.5px">Price = area × (base rate${flat ? ' + floor rise × floors above the first' : ''})${pl.cornerPct ? ' + corner premium' : ''}${flat ? ' + parking' : ''}. Booked, sold and held units keep their price.</p>
    ${mgr ? `<div class="row" style="margin-top:10px"><button class="btn ${changes ? 'primary' : ''}" data-act="prjApplyPL" data-id="${prj.id}" ${changes ? '' : 'disabled'}>Apply to available units${changes ? ` (${changes} change)` : ''}</button></div>` : ''}</div>`;
  const ap = prj.approvals || [];
  const field = (l, k, v, input) => `<div><span>${l}</span>${UI.prj.edit && mgr ? input : `<b>${v}</b>`}</div>`;
  const detailsCard = `<div class="card"><div class="card-head"><h2>Project details</h2><span class="sp"></span>${mgr ? `<button class="btn sm" data-act="prjEdit">${UI.prj.edit ? 'Done' : '✎ Edit'}</button>` : ''}</div>
    <div class="dl3">
      ${field('Builder', 'builder', esc(prj.builder), `<input value="${esc(prj.builder)}" data-chg="prjField" data-id="${prj.id}" data-k="builder">`)}
      ${field('Status', 'status', esc(prj.status), `<select data-chg="prjField" data-id="${prj.id}" data-k="status">${options(PRJ_STATUSES, prj.status)}</select>`)}
      ${field('Possession', 'possession', fmtMonth(prj.possession), `<input type="month" value="${esc(prj.possession || '')}" data-chg="prjField" data-id="${prj.id}" data-k="possession">`)}
      ${field('RERA number', 'rera', esc(prj.rera || '—'), `<input value="${esc(prj.rera || '')}" data-chg="prjField" data-id="${prj.id}" data-k="rera">`)}
      <div><span>Address</span><b>${esc([prj.address, prj.locality, prj.city].filter(Boolean).join(', '))}${prj.pincode ? ' – ' + esc(prj.pincode) : ''}</b></div>
      <div><span>Launched</span><b>${fmtDate(prj.launched)}</b></div></div>
    <div class="ov-amen"><span class="ov-lbl">Approvals</span>${ap.length ? ap.map(a => chip((a.status === 'verified' ? '✓ ' : a.status === 'pending' ? '⚠ ' : '') + esc(approvalOf(a.k).long), a.status === 'verified' ? 'green' : a.status === 'pending' ? 'amber' : 'blue', a.status === 'verified' ? 'Document verified' : a.status === 'pending' ? 'Document pending' : 'Document uploaded')).join(' ') : '<span class="muted">None</span>'}</div>
    <div class="ov-amen"><span class="ov-lbl">Amenities</span>${(prj.amenities || []).map(a => `<span class="ov-amen-chip">${esc(a)}</span>`).join('') || '<span class="muted">None</span>'}</div>
    ${prj.description ? `<p style="margin:10px 0 0">${esc(prj.description)}</p>` : ''}
    ${prj.brochure ? `<p style="margin:8px 0 0"><button class="linkbtn" data-act="lgView" data-f="${esc(prj.brochure)}">📄 ${esc(prj.brochure)}</button> <small class="muted">· shared with every unit</small></p>` : ''}
    <p class="muted" style="margin:8px 0 0;font-size:12.5px">Every unit shares these details, the photos and the nearby places. Changes here reach all ${us.length} units.</p></div>`;
  return {
    title: prj.name, crumbs: `Specification data / <a href="#/projects">Projects</a> / <b>${esc(prj.name)}</b>`,
    html: `<div class="ent-head">
        <div class="av">${flat ? '🏢' : '🗺️'}</div>
        <div class="meta"><h1>${esc(prj.name)}</h1>
          <div class="row">${chip(prj.id, 'outline mono')} ${chip(flat ? 'Apartments' : 'Plotted layout', 'blue')} ${chip(esc(prj.status), prj.status === 'Ready' ? 'green' : 'amber')} ${prj.rera ? chip('✓ RERA ' + esc(prj.rera), 'green') : ''}</div>
          <div class="row muted" style="margin-top:6px">📍 ${esc(prj.locality)}, ${esc(prj.city)} · ${esc(prj.builder)}${prj.possession ? ' · possession ' + fmtMonth(prj.possession) : ''}</div></div>
        <div class="price"><div class="p">${lo ? (lo === hi ? inr(lo) : `${inrShort(lo)} – ${inrShort(hi)}`) : 'Sold out'}</div><div class="muted">available units · from ₹${num(pl.basePsf || 0)}/sq.ft.</div></div>
      </div>
      <div class="pk-row">${kpi(flat ? '🏢' : '🗺️', '#2f5bea', us.length, flat ? 'Flats' : 'Plots')}${kpi('✓', '#11743f', c.Available, 'Available')}${kpi('🔒', '#c27a0e', c.Reserved, 'Held for a buyer')}${kpi('📝', '#1958c9', c.Booked, 'Booked')}${kpi('🏁', '#6b7385', c.Sold, 'Sold')}</div>
      <div class="pj-main"><div class="pj-left">${inventory}${priceCard}${detailsCard}</div><div class="pj-side">${panel}${buyersCard}</div></div>`,
  };
}

/** The selected unit: its price, the hold, who it fits, and what can be done with it. */
function prjUnitPanel(prj, u) {
  const mgr = canEditSettings(), flat = prj.type === 'flat', pp = prjPriceParts(prj, u), h = prjHoldOf(u), hc = h ? getCust(h.cust) : null;
  const v = valuationSummary(u, DB.settings), fits = u.status === 'Available' ? matchesForProperty(u, DB).slice(0, 3) : [];
  const canRelease = h && (mgr || h.by === currentUser());
  const leads = DB.customers.filter(c => isActive(c) && prjCanHoldFor(c)).map(c => ({ c, m: matchScore(c, u, DB.settings) })).sort((a, b) => (a.m.excluded - b.m.excluded) || b.m.M - a.m.M);
  return `<div class="card pj-panel">
    <div class="pj-ph"><b>${esc(flat ? u.unit.no : 'Plot ' + u.unit.no)}</b>${chip(u.status === 'Reserved' ? 'Held' : u.status, STATUS_TONE[u.status])}<span class="sp"></span><button class="btn icon sm ghost" data-act="prjUnit" data-id="" title="Close">✕</button></div>
    <p class="muted" style="margin:2px 0 8px">${flat ? `${esc(u.specs.bhk)} · floor ${u.unit.floor} of ${u.specs.totalFloors}` : `${u.specs.length} × ${u.specs.width} ft`} · ${num(u.area)} sq.ft.${u.facing ? ` · ${esc(u.facing)} facing` : ''}${u.unit.corner ? ' · corner' : ''}</p>
    <table class="pj-pp"><tbody>
      <tr><td>${num(u.area)} sq.ft. × ${inr(pp.rate)}${pp.rise ? ` <small class="muted">(incl. floor rise ${inr(pp.rise)})</small>` : ''}</td><td>${inr(Math.round(pp.base))}</td></tr>
      ${pp.corner ? `<tr><td>Corner premium (${prj.priceList.cornerPct}%)</td><td>${inr(Math.round(pp.corner))}</td></tr>` : ''}
      ${pp.parking ? `<tr><td>Car parking</td><td>${inr(pp.parking)}</td></tr>` : ''}
      <tr class="tot"><td>Price</td><td>${inr(u.price)}</td></tr>
      <tr><td class="muted">With stamp duty &amp; registration</td><td class="muted">${inr(v.allIn)}</td></tr></tbody></table>
    ${h ? `<div class="note ${prjExpired(h) ? 'amber' : 'blue'}" style="margin-top:10px">🔒 Held for <a href="#/customers/${h.cust}"><b>${esc(hc ? hc.name : h.cust)}</b></a> by ${esc(shortName(h.by))} · ${prjExpired(h) ? `<b>hold expired on ${fmtDate(h.until)}</b> — release or extend it` : `until ${fmtDate(h.until)}`}</div>` : ''}
    <div class="pj-acts">
      ${u.status === 'Available' ? (leads.length ? `<div class="pj-hold"><select id="pj-hold-cust">${leads.map(({ c, m }) => `<option value="${c.id}">${esc(c.name)}${m.excluded ? '' : ` — ${m.M}% fit`}</option>`).join('')}</select>
          <button class="btn primary" data-act="prjHold" data-id="${u.id}">🔒 Hold ${PRJ_HOLD_DAYS} days</button></div>` : '<small class="muted">You can hold units for your own leads.</small>') : ''}
      ${canRelease ? `<button class="btn" data-act="prjRelease" data-id="${u.id}">Release</button><button class="btn" data-act="prjExtend" data-id="${u.id}">Extend ${PRJ_HOLD_DAYS} days</button>` : ''}
      ${mgr && ['Available', 'Reserved'].includes(u.status) ? `<button class="btn" data-act="prjStatus" data-id="${u.id}" data-k="Booked">📝 Mark booked</button>` : ''}
      ${mgr && ['Available', 'Reserved', 'Booked'].includes(u.status) ? `<button class="btn" data-act="prjStatus" data-id="${u.id}" data-k="Sold">🏁 Mark sold</button>` : ''}
      ${mgr && ['Booked', 'Sold'].includes(u.status) ? `<button class="btn" data-act="prjStatus" data-id="${u.id}" data-k="Available">↺ Make available</button>` : ''}
    </div>
    <div class="row" style="margin-top:10px;gap:12px"><a href="#/properties/${u.id}">Open unit page →</a>${u.status === 'Available' ? `<a href="#/properties/${u.id}/share">↗ Share</a>` : ''}</div>
    ${fits.length ? `<div class="pj-fits"><span class="ov-lbl">Fits</span>${fits.map(({ cust: c, m }) => `<div class="pj-fitrow"><a href="#/customers/${c.id}">${esc(c.name)}</a>${chip(m.M + '%', m.tone, m.label)}
        ${(c.recommended || []).includes(u.id) ? '<small class="t-green">✓ recommended</small>' : `<button class="btn sm ghost" data-act="recommend" data-id="${c.id}" data-p="${u.id}">✓ Recommend</button>`}</div>`).join('')}</div>` : ''}
  </div>`;
}

/* ---------- new project ---------- */
UI.prjNew = null;
const prjNewBlank = () => ({ type: 'flat', name: '', builder: '', city: 'Madurai', locality: '', address: '', pincode: '', status: 'Under construction', possession: '2027-12', rera: '',
  blocks: 'A, B', floors: 4, perFloor: 2, mix: [{ bhk: '2 BHK', area: 1100, facing: 'East', corner: false }, { bhk: '3 BHK', area: 1450, facing: 'North', corner: true }],
  phases: 'Phase 1', plots: 12, plotMix: [{ length: 40, width: 30, facing: 'East' }, { length: 40, width: 30, facing: 'West' }],
  basePsf: 4500, floorRisePsf: 40, cornerPct: 3, parking: 250000, amenities: [] });
/** The draft as a project object (blocks and price list in the saved shape). */
function prjFromDraft(N) {
  const names = s => String(s).split(',').map(x => x.trim()).filter(Boolean);
  const flat = N.type === 'flat';
  return { type: N.type, name: N.name.trim(), perFloor: +N.perFloor, mix: N.mix.slice(0, +N.perFloor), plotMix: N.plotMix, status: N.status, possession: N.possession,
    blocks: flat ? names(N.blocks).map(n => ({ name: n, floors: +N.floors })) : names(N.phases).map(n => ({ name: n, plots: +N.plots })),
    priceList: { basePsf: +N.basePsf, floorRisePsf: flat ? +N.floorRisePsf : 0, cornerPct: +N.cornerPct, parking: flat ? +N.parking : 0 } };
}
function viewProjectNew() {
  if (!canEditSettings()) return { title: 'New project', html: '<div class="card empty">🔒 Only an Admin or Sales manager can create projects.</div>' };
  const N = UI.prjNew = UI.prjNew || prjNewBlank(), flat = N.type === 'flat';
  while (N.mix.length < N.perFloor) N.mix.push({ bhk: '2 BHK', area: 1100, facing: 'East', corner: false });
  const P = prjFromDraft(N), plan = prjPlan(P, P.blocks).map(u => Object.assign(u, { price: prjPrice(P, { area: u.area, unit: u }) }));
  const prices = plan.map(u => u.price), byKind = {};
  plan.forEach(u => { const k = flat ? `${u.bhk} · ${num(u.area)} sq.ft.` : `${u.length}×${u.width} ft`; byKind[k] = (byKind[k] || 0) + 1; });
  const inp = (k, v, attrs = '') => `<input value="${esc(v)}" data-chg="prjNew" data-k="${k}" ${attrs}>`;
  const f = (l, ctl, hint) => `<div class="f"><label>${l}</label>${ctl}${hint ? `<small class="muted">${hint}</small>` : ''}</div>`;
  const mixRows = flat ? N.mix.slice(0, N.perFloor).map((m, i) => `<tr><td>Flat ${i + 1} on each floor</td>
      <td><select data-chg="prjNew" data-k="mix.${i}.bhk">${options(['1 BHK', '2 BHK', '3 BHK', '4 BHK', '4+ BHK'], m.bhk)}</select></td>
      <td>${inp(`mix.${i}.area`, m.area, 'type="number" style="width:100px"')}</td>
      <td><select data-chg="prjNew" data-k="mix.${i}.facing">${options(FACINGS, m.facing)}</select></td>
      <td><input type="checkbox" data-chg="prjNew" data-k="mix.${i}.corner" ${m.corner ? 'checked' : ''}></td></tr>`).join('')
    : N.plotMix.map((m, i) => `<tr><td>Size ${i + 1}</td><td>${inp(`plotMix.${i}.length`, m.length, 'type="number" style="width:80px"')} × ${inp(`plotMix.${i}.width`, m.width, 'type="number" style="width:80px"')} ft</td>
      <td><select data-chg="prjNew" data-k="plotMix.${i}.facing">${options(FACINGS, m.facing)}</select></td>
      <td>${N.plotMix.length > 1 ? `<button type="button" class="btn sm ghost" data-act="prjNewMix" data-k="-${i}">✕</button>` : ''}</td></tr>`).join('');
  return {
    title: 'New project', crumbs: 'Specification data / <a href="#/projects">Projects</a> / <b>New project</b>',
    html: `<div class="page-head"><div><h1>New project</h1><p>Describe the project once — every unit is created from it, priced from the price list, and shares its details.</p></div><span class="sp"></span><a class="btn" href="#/projects">Cancel</a></div>
    <div class="pj-new">
      <div class="card">
        <div class="form-sec"><h2><span class="num">1</span>The project</h2>
          <div class="pills" style="margin-bottom:10px"><button type="button" class="pill ${flat ? 'on' : ''}" data-act="prjNewType" data-k="flat">🏢 Apartments</button><button type="button" class="pill ${flat ? '' : 'on'}" data-act="prjNewType" data-k="plot">🗺️ Plotted layout</button></div>
          <div class="fgrid">${f('Project name *', inp('name', N.name, 'placeholder="e.g. Lotus Residency"'))}${f('Builder', inp('builder', N.builder, 'placeholder="e.g. Lotus Builders"'))}
            ${f('City *', `<select data-chg="prjNew" data-k="city">${options(Object.keys(CITIES), N.city)}</select>`)}${f('Locality *', inp('locality', N.locality, `list="pj-locs" placeholder="e.g. ${esc((CITIES[N.city] || { localities: [''] }).localities[0])}"`) + `<datalist id="pj-locs">${(CITIES[N.city] || { localities: [] }).localities.map(l => `<option value="${esc(l)}">`).join('')}</datalist>`)}
            ${f('Status', `<select data-chg="prjNew" data-k="status">${options(PRJ_STATUSES, N.status)}</select>`)}${flat ? f('Possession', inp('possession', N.possession, 'type="month"')) : ''}
            ${f('RERA number', inp('rera', N.rera, 'placeholder="Optional"'))}</div></div>
        <div class="form-sec"><h2><span class="num">2</span>${flat ? 'Blocks and flats' : 'Phases and plots'}</h2>
          <div class="fgrid">${flat ? f('Blocks', inp('blocks', N.blocks), 'Names, separated by commas — e.g. A, B') + f('Floors in each block', inp('floors', N.floors, 'type="number" min="1" max="40"')) + f('Flats on each floor', inp('perFloor', N.perFloor, 'type="number" min="1" max="8"'))
            : f('Phases', inp('phases', N.phases), 'e.g. Phase 1, Phase 2') + f('Plots in each phase', inp('plots', N.plots, 'type="number" min="1" max="200"'))}</div>
          <div class="tbl-wrap" style="margin-top:10px"><table><thead><tr>${flat ? '<th>Position</th><th>BHK</th><th>Area (sq.ft.)</th><th>Facing</th><th>Corner</th>' : '<th></th><th>Plot size</th><th>Facing</th><th></th>'}</tr></thead><tbody>${mixRows}</tbody></table></div>
          ${flat ? '' : '<p class="muted" style="font-size:12.5px;margin:6px 0 0">Plots take these sizes in turn; the first and last plot of each phase are corners. <button type="button" class="linkbtn" data-act="prjNewMix" data-k="+">＋ Another size</button></p>'}</div>
        <div class="form-sec"><h2><span class="num">3</span>Price list</h2>
          <div class="fgrid">${f('Base rate (₹/sq.ft.)', inp('basePsf', N.basePsf, 'type="number"'))}${flat ? f('Floor rise (₹/sq.ft. per floor)', inp('floorRisePsf', N.floorRisePsf, 'type="number"')) : ''}
            ${f('Corner premium (%)', inp('cornerPct', N.cornerPct, 'type="number"'))}${flat ? f('Car parking (₹)', inp('parking', N.parking, 'type="number"')) : ''}</div></div>
        <div class="form-sec"><h2><span class="num">4</span>Amenities <span class="opt-tag">Optional</span></h2>
          <div class="checks">${AMENITIES.map(a => `<label class="check"><input type="checkbox" data-chg="prjNewAmen" value="${esc(a)}" ${N.amenities.includes(a) ? 'checked' : ''}> ${esc(a)}</label>`).join('')}</div></div>
      </div>
      <div class="card pj-preview"><h2>This creates</h2>
        <div class="pj-big">${plan.length}<small>${flat ? 'flats' : 'plots'}</small></div>
        <ul class="sh-checks">${Object.entries(byKind).map(([k, n]) => `<li class="ok"><span class="ic">•</span><span>${n} × ${esc(k)}</span></li>`).join('')}</ul>
        <p>${prices.length ? `Priced <b>${inrShort(Math.min(...prices))} – ${inrShort(Math.max(...prices))}</b>` : ''}</p>
        <p class="muted" style="font-size:12.5px">All start as <b>Available</b>. Photos, documents and nearby places are added once, on the project, and shared by every unit.</p>
        <button class="btn primary block" data-act="prjCreate" ${plan.length ? '' : 'disabled'}>Create project</button></div>
    </div>`,
  };
}

/* ---------- events ---------- */
function prjLogBoth(u, c, text) { logHistory(u, text); if (c) logActivity(c, 'Note', text); }
Object.assign(ACTIONS, {
  prjUnit: d => { UI.prj.unit = d.id && UI.prj.unit !== d.id ? d.id : ''; render(); },
  prjBuyer: d => { UI.prj.buyer = d.id && UI.prj.buyer !== d.id ? d.id : ''; render(); },
  prjEdit: () => { UI.prj.edit = !UI.prj.edit; render(); },
  prjHold: d => {
    const u = getProp(d.id), prj = projectOf(u), el = document.getElementById('pj-hold-cust'), c = el && getCust(el.value);
    if (!c || u.status !== 'Available' || !prjCanHoldFor(c)) return;
    u.status = 'Reserved'; u.hold = { cust: c.id, by: currentUser(), at: DEMO_TODAY, until: addDays(DEMO_TODAY, PRJ_HOLD_DAYS) };
    prjLogBoth(u, c, `Unit ${u.unit.no} at ${prj.name} (${u.id}) held for ${c.name} until ${fmtDate(u.hold.until)}`);
    if (!(c.recommended || []).includes(u.id)) { (c.recommended = c.recommended || []).push(u.id); if (stageIndex(c.stage) >= 0 && stageIndex(c.stage) < STAGES.indexOf('Property recommended')) moveStage(c, 'Property recommended'); }
    save(); toast(`${u.unit.no} held for ${c.name} until ${fmtDate(u.hold.until)}`); render();
  },
  prjRelease: d => {
    const u = getProp(d.id), h = prjHoldOf(u); if (!h || !(canEditSettings() || h.by === currentUser())) return;
    const c = getCust(h.cust); u.status = 'Available'; delete u.hold;
    prjLogBoth(u, c, `Hold on unit ${u.unit.no} (${u.id}) released — available again`); save(); toast(`${u.unit.no} is available again`); render();
  },
  prjExtend: d => {
    const u = getProp(d.id), h = prjHoldOf(u); if (!h || !(canEditSettings() || h.by === currentUser())) return;
    h.until = addDays(h.until < DEMO_TODAY ? DEMO_TODAY : h.until, PRJ_HOLD_DAYS);
    prjLogBoth(u, getCust(h.cust), `Hold on unit ${u.unit.no} (${u.id}) extended until ${fmtDate(h.until)}`); save(); render();
  },
  prjStatus: d => {
    if (!canEditSettings()) return;
    const u = getProp(d.id), h = prjHoldOf(u), c = h ? getCust(h.cust) : null, from = u.status;
    u.status = d.k; if (d.k === 'Available') delete u.hold;
    prjLogBoth(u, c && d.k !== 'Available' ? c : null, `Unit ${u.unit.no} (${u.id}): ${from} → ${d.k}${c && d.k !== 'Available' ? ` for ${c.name}` : ''}`);
    save(); toast(`${u.unit.no}: ${d.k}`); render();
  },
  prjApplyPL: d => {
    if (!canEditSettings()) return;
    const prj = getProject(d.id); let n = 0;
    prjUnits(prj).filter(u => u.status === 'Available').forEach(u => { const np = prjPrice(prj, u); if (np !== u.price) { logHistory(u, `Price ${inr(u.price)} → ${inr(np)} (project price list)`); u.price = np; n++; } });
    (prj.history = prj.history || []).unshift({ date: DEMO_TODAY, text: `Price list applied to ${n} available unit${n === 1 ? '' : 's'}`, by: currentUser() });
    save(); toast(`${n} unit price${n === 1 ? '' : 's'} updated`); render();
  },
  prjAddBlock: d => {
    if (!canEditSettings()) return;
    const prj = getProject(d.id), flat = prj.type === 'flat', last = prj.blocks[prj.blocks.length - 1];
    const name = flat ? String.fromCharCode(Math.max(...prj.blocks.map(b => b.name.charCodeAt(0))) + 1) : `Phase ${prj.blocks.length + 1}`;
    const b = flat ? { name, floors: last.floors } : { name, plots: last.plots };
    prj.blocks.push(b); const made = prjGenerate(DB, prj, [b]);
    (prj.history = prj.history || []).unshift({ date: DEMO_TODAY, text: `${flat ? 'Block ' + name : name} added with ${made.length} units`, by: currentUser() });
    save(); toast(`${flat ? 'Block ' + name : name} added — ${made.length} units`); render();
  },
  prjNewType: d => { // each kind starts from its own typical rate until someone changes it
    const N = UI.prjNew, typical = { flat: 4500, plot: 2500 };
    if (N.basePsf === typical[N.type]) N.basePsf = typical[d.k];
    N.type = d.k; render();
  },
  prjNewMix: d => { const N = UI.prjNew; if (d.k === '+') N.plotMix.push({ length: 40, width: 30, facing: 'North' }); else N.plotMix.splice(+d.k.slice(1), 1); render(); },
  prjCreate: () => {
    if (!canEditSettings()) return;
    const N = UI.prjNew; if (!N.name.trim() || !N.locality.trim()) { toast('Give the project a name and a locality'); return; }
    const P = prjFromDraft(N), geo = typeof CITY_GEO !== 'undefined' && CITY_GEO[N.city] || {};
    const prj = Object.assign(P, {
      id: 'PRJ-' + String((DB.projects || []).length + 1).padStart(3, '0'), builder: N.builder.trim() || '—', city: N.city, locality: N.locality.trim(), address: '', pincode: '',
      lat: geo.lat || '', lng: geo.lng || '', rera: N.rera.trim(), approvals: N.rera.trim() ? [{ k: 'rera', status: 'pending', file: '' }] : [], amenities: N.amenities.slice(), images: 0, brochure: '',
      description: '', launched: DEMO_TODAY, createdBy: currentUser(), createdAt: DEMO_TODAY, history: [],
    });
    DB.projects.push(prj); const made = prjGenerate(DB, prj, prj.blocks);
    prj.history.unshift({ date: DEMO_TODAY, text: `Project created with ${made.length} units`, by: currentUser() });
    UI.prjNew = null; save(); toast(`${prj.name} created — ${made.length} units`); go('#/projects/' + prj.id);
  },
});
Object.assign(CHANGES, {
  prjNew: el => {
    const N = UI.prjNew, path = el.dataset.k.split('.'), v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Math.max(0, Number(el.value) || 0) : el.value;
    let o = N; for (let i = 0; i < path.length - 1; i++) o = o[path[i]]; o[path[path.length - 1]] = v;
    if (el.dataset.k === 'perFloor') N.perFloor = Math.min(8, Math.max(1, N.perFloor));
    render();
  },
  prjNewAmen: el => { const N = UI.prjNew; N.amenities = el.checked ? [...new Set([...N.amenities, el.value])] : N.amenities.filter(a => a !== el.value); },
  prjPL: el => { if (!canEditSettings()) return; const prj = getProject(el.dataset.id); prj.priceList[el.dataset.k] = Number(el.value) || 0; save(); render(); },
  prjField: el => {
    if (!canEditSettings()) return;
    const prj = getProject(el.dataset.id), k = el.dataset.k, from = prj[k]; prj[k] = el.value;
    // what the units share follows the project
    prjUnits(prj).forEach(u => {
      if (k === 'possession' && prj.type === 'flat') u.specs.possessionDate = el.value;
      if (k === 'status' && prj.type === 'flat') u.specs.possession = el.value === 'Ready' ? 'Ready to move' : 'Under construction';
    });
    (prj.history = prj.history || []).unshift({ date: DEMO_TODAY, text: `${k[0].toUpperCase() + k.slice(1)}: ${from || '—'} → ${el.value || '—'}`, by: currentUser() });
    save(); render();
  },
});
