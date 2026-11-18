/* =====================================================================
   Module B — Customer specification database (+ Module C HNI tab)
   ===================================================================== */

const REQ_FIELDS = {
  plot: [
    { k: 'facing', l: 'Facing preference', t: 'select', o: ['', ...FACINGS], blank: null },
    { k: 'minRoad', l: 'Minimum road width (ft)', t: 'number' },
    { k: 'corner', l: 'Corner preference', t: 'select', o: ['No preference', 'Corner', 'Non-corner'] },
    { k: 'constructionPlan', l: 'Construction plan', t: 'select', o: CONSTRUCTION_PLANS },
  ],
  flat: [
    { k: 'bhk', l: 'BHK', t: 'select', o: ['', '1 BHK', '2 BHK', '3 BHK', '4 BHK', '4+ BHK'] },
    { k: 'parking', l: 'Parking', t: 'select', o: ['Required', 'Preferred', 'Not needed'] },
    { k: 'possession', l: 'Possession requirement', t: 'select', o: ['Any', 'Ready to move', 'Under construction'] },
  ],
  house: [
    { k: 'bhk', l: 'Bedrooms (BHK)', t: 'select', o: ['', '2 BHK', '3 BHK', '4 BHK', '5 BHK'] },
    { k: 'landArea', l: 'Minimum land area (sq.ft.)', t: 'number' },
    { k: 'parking', l: 'Parking', t: 'select', o: ['Required', 'Preferred', 'Not needed'] },
    { k: 'possession', l: 'Possession requirement', t: 'select', o: ['Any', 'Ready to move'] },
  ],
  commercial: [
    { k: 'commCategory', l: 'Commercial category', t: 'select', o: ['', ...PROPERTY_TYPES.commercial.fields[0].o] },
    { k: 'occupancy', l: 'Occupancy preference', t: 'select', o: ['Any', 'Vacant', 'Tenanted'] },
  ],
};
const REQ_SIZE_LABEL = { plot: 'Preferred plot size (sq.ft.)', flat: 'Preferred built-up area (sq.ft.)', house: 'Preferred built-up area (sq.ft.)', commercial: 'Required usable area (sq.ft.)' };
const reqFieldsHtml = (type, req) => REQ_FIELDS[type].map(f => fld(f.l, inputFor(f, req[f.k], 'req.' + f.k))).join('');

function reqSummary(c) {
  const r = c.req, bits = [typeLabel(r.type), (r.cities || []).join(' / ')];
  if (r.size) bits.push(num(r.size) + ' sq.ft.');
  ['bhk', 'facing', 'commCategory'].forEach(k => r[k] && bits.push(r[k]));
  return bits.filter(Boolean).join(' · ');
}
const isOverdue = c => c.nextFollowUp && c.nextFollowUp < DEMO_TODAY && isActive(c);
const isDueToday = c => c.nextFollowUp === DEMO_TODAY && isActive(c);
function followUpCell(c) {
  if (!c.nextFollowUp) return '<span class="muted">—</span>';
  if (isOverdue(c)) return chip('Overdue · ' + fmtDate(c.nextFollowUp), 'red');
  if (isDueToday(c)) return chip('Today', 'amber');
  return `<small>${fmtDate(c.nextFollowUp)}</small>`;
}

/* ---------- list ---------- */
function viewCustomers() {
  const f = UI.filters.custs, q = (f.q || '').toLowerCase();
  let list = DB.customers.map(c => ({ c, rd: readiness(c, DB), cls: classificationOf(c, DB) })).filter(({ c, rd }) =>
    (!q || [c.id, c.name, c.mobile, ...(c.req.cities || [])].join(' ').toLowerCase().includes(q)) &&
    (!f.stage || c.stage === f.stage) && (!f.owner || c.owner === f.owner) && (!f.purpose || c.purpose === f.purpose) &&
    (!f.band || rd.band.l === f.band) && (!f.type || c.req.type === f.type));
  const sorters = { readiness: (a, b) => b.rd.total - a.rd.total, followup: (a, b) => (a.c.nextFollowUp || '9999').localeCompare(b.c.nextFollowUp || '9999'), newest: (a, b) => b.c.enquiryDate.localeCompare(a.c.enquiryDate) };
  list.sort(sorters[f.sort] || sorters.readiness);
  const rows = list.map(({ c, rd, cls }) => `
    <tr class="click" data-href="#/customers/${c.id}">
      <td class="mono">${c.id}</td>
      <td><b>${esc(c.name)}</b><br><small>${esc(c.source)} · ${fmtDate(c.enquiryDate)}</small></td>
      <td>${c.purpose}</td>
      <td>${esc(reqSummary(c))}</td>
      <td class="num">${inrShort(c.budget.min)} – ${inrShort(c.budget.max)}</td>
      <td><b>${rd.total}</b> ${chip(rd.band.l, rd.band.tone)}</td>
      <td>${cls === 'Potential HNI' || cls === 'Verified HNI' ? (canSeeHNI() ? chip(cls, 'purple') : chip('Restricted', 'outline')) : chip(cls, 'outline')}</td>
      <td>${chip(c.stage, stageTone(c.stage))}</td>
      <td><small>${esc(execName(DB, c.owner).split('—')[0])}</small></td>
      <td>${followUpCell(c)}</td>
    </tr>`).join('');
  const bands = ['High-priority lead', 'Qualified lead', 'Developing lead', 'Early-stage enquiry'];
  return {
    title: 'Customers', crumbs: 'Specification data / <b>Customers</b>',
    html: `
    <div class="page-head"><div><h1>Customer specification database</h1><p>What each customer wants, why, what they can realistically buy, when — and which conditions the property must satisfy.</p></div><span class="sp"></span>
      <a class="btn" href="#/enquiry">📝 Public enquiry form</a><a class="btn primary" href="#/customers/new">＋ Add customer</a></div>
    <div class="filters">
      <input type="search" id="cf-q" placeholder="Search name, ID, mobile, city…" value="${esc(f.q || '')}" data-inp="filter" data-scope="custs" data-key="q">
      <select data-chg="filter" data-scope="custs" data-key="stage">${options([...STAGES, LOST_STAGE], f.stage, 'All stages')}</select>
      <select data-chg="filter" data-scope="custs" data-key="owner">${options(DB.settings.executives.map(e => ({ v: e.id, l: e.name })), f.owner, 'All executives')}</select>
      <select data-chg="filter" data-scope="custs" data-key="purpose">${options(PURPOSES.map(p => p.v), f.purpose, 'Any purpose')}</select>
      <select data-chg="filter" data-scope="custs" data-key="type">${options(Object.entries(PROPERTY_TYPES).map(([v, t]) => ({ v, l: t.label })), f.type, 'Any property type')}</select>
      <select data-chg="filter" data-scope="custs" data-key="band">${options(bands, f.band, 'Any readiness')}</select>
      <select data-chg="filter" data-scope="custs" data-key="sort">${options([{ v: 'readiness', l: 'Sort: readiness' }, { v: 'followup', l: 'Sort: next follow-up' }, { v: 'newest', l: 'Sort: newest' }], f.sort)}</select>
      ${Object.entries(f).some(([k, v]) => k !== 'sort' && v) ? `<button class="btn ghost" data-act="clearFilters" data-scope="custs">Clear</button>` : ''}
    </div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>ID</th><th>Customer</th><th>Purpose</th><th>Looking for</th><th class="num">Budget</th><th>Readiness</th><th>Classification</th><th>Stage</th><th>Owner</th><th>Next follow-up</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="10" class="empty">No customers match these filters.</td></tr>'}</tbody></table></div>
    <p class="muted" style="margin-top:10px">${list.length} of ${DB.customers.length} customers. Readiness and classification are separate assessments — a high budget never makes someone an HNI.</p>`,
  };
}

/* ---------- add / edit form ---------- */
function blankCustomer() {
  return {
    id: '', name: '', mobile: '', email: '', contactPref: 'WhatsApp', source: 'Walk-in', enquiryDate: DEMO_TODAY, owner: '', purpose: '', purposeNote: '',
    budget: { min: '', pref: '', max: '', flexPct: 0, basis: 'Not clarified yet', funding: 'Own funds', fundingReady: 'Not decided' },
    req: { type: 'plot', cities: ['Madurai'], localities: [], size: '', approvalRequired: true, siteVisit: true, amenities: [], corner: 'No preference' },
    bant: { authority: 'Not known yet', need: 'Partly defined', timeline: 'Not decided' },
    engagement: { responded: false, docsRequested: false, siteVisited: false }, stage: 'New enquiry', consent: { followUp: false, date: '', channel: '' },
  };
}
function purposeCards(val, name = 'purpose') {
  return `<div class="radio-cards">${PURPOSES.map(p => `<label class="radio-card"><input type="radio" name="${name}" value="${esc(p.v)}" ${val === p.v ? 'checked' : ''} required><span><b>${p.v}</b><small>${p.d}</small></span></label>`).join('')}</div>`;
}
function budgetLive(min, pref, max, flex) {
  if (!max) return 'Enter a budget range';
  const ceil = max * (1 + (Number(flex) || 0) / 100);
  return `${inrShort(min)} – ${inrShort(max)} · preferred ${inrShort(pref)} · with flexibility up to ${inrShort(ceil)}`;
}

function viewCustomerForm(id) {
  const src = id ? getCust(id) : null;
  if (id && !src) return { title: 'Not found', html: '<div class="card empty">Customer not found.</div>' };
  const c = src ? clone(src) : blankCustomer(), b = c.budget, r = c.req;
  const typeOpts = Object.entries(PROPERTY_TYPES).map(([v, t]) => ({ v, l: t.label }));
  return {
    title: id ? 'Edit customer' : 'Add customer',
    crumbs: `Specification data / <a href="#/customers">Customers</a> / <b>${id ? 'Edit ' + id : 'Add customer'}</b>`,
    html: `
    <div class="page-head"><div><h1>${id ? 'Edit ' + esc(c.name) : 'Add customer'}</h1><p>Collect only necessary information, explain why, and record consent for follow-up.</p></div></div>
    <form data-form="customer" data-id="${id || ''}" class="card">
      <div class="form-sec"><h2><span class="num">A</span>Basic customer information</h2>
        <div class="fgrid">
          ${fld('Customer ID', `<input value="${esc(c.id || 'Auto: CUST-' + (DB.counters.cust + 1))}" disabled>`)}
          ${fld('Customer name', `<input name="name" value="${esc(c.name)}" required>`, { req: 1 })}
          ${fld('Mobile number', `<input name="mobile" value="${esc(c.mobile)}" required placeholder="+91">`, { req: 1, hint: 'Stored with consent only' })}
          ${fld('Email', `<input type="email" name="email" value="${esc(c.email)}">`, { hint: 'Optional' })}
          ${fld('Preferred contact method', `<select name="contactPref">${options(CONTACT_PREFS, c.contactPref)}</select>`)}
          ${fld('Lead source', `<select name="source">${options(LEAD_SOURCES, c.source)}</select>`)}
          ${fld('Enquiry date', `<input type="date" name="enquiryDate" value="${esc(c.enquiryDate)}">`)}
          ${fld('Assigned sales executive', `<select name="owner">${options(DB.settings.executives.map(e => ({ v: e.id, l: e.name })), c.owner, 'Auto-assign (least loaded)')}</select>`)}
          ${fld('Sales stage', `<select name="stage">${options([...STAGES, LOST_STAGE], c.stage)}</select>`)}
        </div>
        <div class="note blue" style="margin-top:12px"><label class="check"><input type="checkbox" name="consent" ${c.consent && c.consent.followUp ? 'checked' : ''}> <b>Customer consents to follow-up</b> on the preferred contact method.</label>
          <div style="margin-top:4px;font-size:12.5px">Say why: “We use your number only to share matching properties and arrange visits. You can ask us to stop at any time.” Without consent, no follow-up can be scheduled.</div></div>
      </div>
      <div class="form-sec"><h2><span class="num">B</span>Customer purpose <small class="mono">purchase_purpose</small></h2>
        ${purposeCards(c.purpose)}
        <div style="margin-top:10px">${fld('Purpose details', `<input name="purposeNote" value="${esc(c.purposeNote)}" placeholder="e.g. Construct own house, logistics expansion">`)}</div>
      </div>
      <div class="form-sec"><h2><span class="num">C</span>Budget specification</h2>
        <div class="fgrid c4">
          ${fld('Minimum budget (₹)', `<input type="number" name="b.min" min="0" step="any" value="${esc(b.min)}" data-inp="budget">`)}
          ${fld('Preferred budget (₹)', `<input type="number" name="b.pref" min="0" step="any" value="${esc(b.pref)}" data-inp="budget">`)}
          ${fld('Maximum budget (₹)', `<input type="number" name="b.max" min="1" step="any" value="${esc(b.max)}" required data-inp="budget">`, { req: 1 })}
          ${fld('Budget flexibility (%)', `<input type="number" name="b.flexPct" min="0" max="50" step="any" value="${esc(b.flexPct)}" data-inp="budget">`)}
          ${fld('What does the budget include?', `<select name="b.basis">${options(BUDGET_BASIS, b.basis)}</select>`, { cls: 'span2', hint: 'Clarify before recommending — ₹30L may mean property only, all-in with registration, or including a loan' })}
          ${fld('Funding preference', `<select name="b.funding">${options(FUNDING_PREFS, b.funding)}</select>`)}
          ${fld('Funding readiness', `<select name="b.fundingReady">${options(FUNDING_READY, b.fundingReady)}</select>`)}
        </div>
        <p class="muted" id="budget-live" style="margin:8px 0 0">${budgetLive(b.min, b.pref, b.max, b.flexPct)}</p>
      </div>
      <div class="form-sec"><h2><span class="num">D</span>Property requirements</h2>
        <div class="fgrid">
          ${fld('Preferred property type', `<select name="req.type" data-chg="ctype">${options(typeOpts, r.type)}</select>`, { req: 1 })}
          ${fld(`<span id="size-label">${REQ_SIZE_LABEL[r.type]}</span>`, `<input type="number" name="req.size" min="0" step="any" value="${esc(r.size)}">`)}
          ${fld('Preferred localities', `<input name="req.localities" value="${esc((r.localities || []).join(', '))}" placeholder="Comma separated — leave empty for any">`)}
          ${fld('Preferred location(s)', `<div class="checks">${Object.keys(CITIES).map(ct => `<label class="check"><input type="checkbox" name="req.cities" value="${ct}" ${(r.cities || []).includes(ct) ? 'checked' : ''}> ${ct}</label>`).join('')}</div>`, { cls: 'span3', req: 1 })}
        </div>
        <div class="fgrid" id="req-fields" style="margin-top:12px">${reqFieldsHtml(r.type, r)}</div>
        <div class="checks" style="margin-top:12px">
          <label class="check"><input type="checkbox" name="req.approvalRequired" ${r.approvalRequired ? 'checked' : ''}> Applicable approvals must be verified</label>
          <label class="check"><input type="checkbox" name="req.siteVisit" ${r.siteVisit ? 'checked' : ''}> Site visit required</label>
        </div>
        <div style="margin-top:12px">${fld('Must-have amenities', `<div class="checks">${AMENITIES.map(a => `<label class="check"><input type="checkbox" name="req.amenities" value="${esc(a)}" ${(r.amenities || []).includes(a) ? 'checked' : ''}> ${a}</label>`).join('')}</div>`)}</div>
      </div>
      <div class="form-sec"><h2><span class="num">E</span>Purchase readiness — BANT + funding + engagement</h2>
        <div class="fgrid">
          ${fld('Authority — who decides?', `<select name="bant.authority">${options(AUTHORITY, c.bant.authority)}</select>`, { hint: 'Deciding alone, or with family / business partners?' })}
          ${fld('Need — how clear is the requirement?', `<select name="bant.need">${options(NEED_CLARITY, c.bant.need)}</select>`)}
          ${fld('Timeline — when to purchase?', `<select name="bant.timeline">${options(TIMELINES, c.bant.timeline)}</select>`)}
        </div>
        <div class="checks" style="margin-top:12px"><b style="font-size:12.5px">Engagement:</b>
          <label class="check"><input type="checkbox" name="eng.responded" ${c.engagement.responded ? 'checked' : ''}> Responded</label>
          <label class="check"><input type="checkbox" name="eng.docsRequested" ${c.engagement.docsRequested ? 'checked' : ''}> Requested documents</label>
          <label class="check"><input type="checkbox" name="eng.siteVisited" ${c.engagement.siteVisited ? 'checked' : ''}> Attended a site visit</label></div>
      </div>
      <div class="form-actions"><a class="btn" href="${id ? '#/customers/' + id : '#/customers'}">Cancel</a><button class="btn primary">${id ? 'Save changes' : 'Save customer'}</button></div>
    </form>`,
  };
}

Object.assign(CHANGES, {
  ctype: el => {
    document.getElementById('req-fields').innerHTML = reqFieldsHtml(el.value, {});
    document.getElementById('size-label').textContent = REQ_SIZE_LABEL[el.value];
  },
});
Object.assign(INPUTS, {
  budget: el => { const f = el.form, g = n => Number(f.elements[n].value) || 0; document.getElementById('budget-live').textContent = budgetLive(g('b.min'), g('b.pref'), g('b.max'), g('b.flexPct')); },
});

function readCustomerForm(fd, base) {
  const n = k => { const v = fd.get(k); return v === '' || v == null ? '' : Number(v); };
  const type = fd.get('req.type');
  const req = { type, cities: fd.getAll('req.cities'), localities: (fd.get('req.localities') || '').split(',').map(s => s.trim()).filter(Boolean), size: n('req.size'),
    approvalRequired: fd.get('req.approvalRequired') === 'on', siteVisit: fd.get('req.siteVisit') === 'on', amenities: fd.getAll('req.amenities') };
  REQ_FIELDS[type].forEach(f => { req[f.k] = f.t === 'number' ? n('req.' + f.k) : fd.get('req.' + f.k) || ''; });
  const consentNow = fd.get('consent') === 'on';
  return {
    name: fd.get('name').trim(), mobile: fd.get('mobile').trim(), email: fd.get('email').trim(), contactPref: fd.get('contactPref'), source: fd.get('source'),
    enquiryDate: fd.get('enquiryDate'), owner: fd.get('owner'), purpose: fd.get('purpose') || '', purposeNote: fd.get('purposeNote'),
    budget: { min: n('b.min') || 0, pref: n('b.pref') || n('b.max'), max: n('b.max'), flexPct: n('b.flexPct') || 0, basis: fd.get('b.basis'), funding: fd.get('b.funding'), fundingReady: fd.get('b.fundingReady') },
    req, bant: { authority: fd.get('bant.authority'), need: fd.get('bant.need'), timeline: fd.get('bant.timeline') },
    engagement: { responded: fd.get('eng.responded') === 'on', docsRequested: fd.get('eng.docsRequested') === 'on', siteVisited: fd.get('eng.siteVisited') === 'on' },
    consent: consentNow ? (base && base.consent && base.consent.followUp ? base.consent : { followUp: true, date: DEMO_TODAY, channel: 'Recorded by ' + currentUser() }) : { followUp: false, date: '', channel: '' },
    stageWanted: fd.get('stage'),
  };
}

FORMS.customer = (f, fd) => {
  const id = f.dataset.id, data = readCustomerForm(fd, id ? getCust(id) : null);
  const b = data.budget;
  if (!data.name || !data.mobile || !data.purpose || !(b.max > 0) || !data.req.cities.length) { toast('Name, mobile, purpose, maximum budget and at least one location are required.'); return; }
  if ((b.min && b.min > b.max) || (b.pref && b.pref > b.max)) { toast('Minimum and preferred budget must not exceed the maximum.'); return; }
  const stageWanted = data.stageWanted; delete data.stageWanted;
  if (!data.owner) data.owner = nextExecutive(DB);
  let c;
  if (id) {
    c = getCust(id);
    Object.assign(c, data);
    if (!c.consent.followUp) c.nextFollowUp = '';
    logActivity(c, 'Note', 'Customer specification updated');
    if (stageWanted !== c.stage) moveStage(c, stageWanted, stageWanted === LOST_STAGE ? 'Other' : '');
  } else {
    c = cust(Object.assign(data, { id: 'CUST-' + (++DB.counters.cust), stage: stageWanted, stageSince: DEMO_TODAY, lastContact: '', nextFollowUp: data.consent.followUp ? addDays(DEMO_TODAY, 1) : '', activity: [] }));
    c.consent = data.consent;
    logActivity(c, 'Note', `Customer created and assigned to ${execName(DB, c.owner)}${c.nextFollowUp ? `; follow-up scheduled ${fmtDate(c.nextFollowUp)}` : '; no consent — follow-up not scheduled'}`);
    DB.customers.unshift(c);
  }
  save(); toast(id ? 'Customer saved' : `Customer ${c.id} created`);
  go(`#/customers/${c.id}/${id ? 'overview' : 'matches'}`);
};

/* ---------- detail ---------- */
const CUST_TABS = [['overview', 'Overview'], ['qualification', 'Qualification (BANT)'], ['matches', 'Property matches'], ['followups', 'Follow-ups & activity'], ['hni', 'HNI assessment']];

function viewCustomer(id, tab) {
  const c = getCust(id);
  if (!c) return { title: 'Not found', html: '<div class="card empty">Customer not found. <a href="#/customers">Back to list</a></div>' };
  const rd = readiness(c, DB), cls = classificationOf(c, DB), mm = matchesForCustomer(c, DB);
  const body = { overview: custOverview, qualification: custQualification, matches: custMatches, followups: custFollowups, hni: custHNI }[tab] || custOverview;
  const consentOk = c.consent && c.consent.followUp;
  const hniCls = cls === 'Potential HNI' || cls === 'Verified HNI';
  return {
    title: c.name, crumbs: `Specification data / <a href="#/customers">Customers</a> / <b>${c.id}</b>`,
    html: `
    <div class="ent-head">
      <div class="av">${initials(c.name)}</div>
      <div class="meta"><h1>${esc(c.name)}</h1>
        <div class="row">${chip(c.id, 'outline mono')} ${chip(c.stage, stageTone(c.stage))} ${chip(rd.total + ' · ' + rd.band.l, rd.band.tone)} ${hniCls && !canSeeHNI() ? chip('Classification restricted', 'outline') : chip(cls, hniCls ? 'purple' : 'outline')} ${chip(c.purpose)}</div>
        <div class="row muted" style="margin-top:6px">📞 ${esc(c.mobile)} · prefers ${esc(c.contactPref)} · ${esc(c.source)} · enquired ${fmtDate(c.enquiryDate)} · ${consentOk ? chip('Consent for follow-up ✓', 'green') : chip('No follow-up consent', 'red')}</div>
      </div>
      <div class="stack" style="min-width:250px">
        <div class="row"><small style="width:96px">Owner</small>${bSel('c', c.id, 'owner', c.owner, DB.settings.executives.map(e => ({ v: e.id, l: e.name })), 'style="flex:1;width:auto"')}</div>
        <div class="row"><small style="width:96px">Next follow-up</small>${bIn('c', c.id, 'nextFollowUp', c.nextFollowUp, 'date', `style="flex:1;width:auto" ${consentOk ? '' : 'disabled title="Record consent first"'}`)}</div>
        <div class="row" style="justify-content:flex-end"><a class="btn sm" href="#/customers/${c.id}/edit">✎ Edit</a><button class="btn sm" data-act="stageModal" data-id="${c.id}">Move stage</button><a class="btn sm primary" href="#/customers/${c.id}/followups">＋ Log activity</a></div>
      </div>
    </div>
    ${c.stage === LOST_STAGE ? `<div class="note red" style="margin-bottom:12px">Lost — <b>${esc(c.lostReason)}</b>${c.lostNote ? ': ' + esc(c.lostNote) : ''}</div>` : ''}
    <div class="tabs">${CUST_TABS.map(([k, l]) => `<a href="#/customers/${c.id}/${k}" class="${tab === k ? 'on' : ''}">${l}${k === 'matches' ? ` <span class="chip">${mm.eligible.length}</span>` : ''}${k === 'hni' && !canSeeHNI() ? ' 🔒' : ''}</a>`).join('')}</div>
    ${body(c, rd, cls, mm)}`,
  };
}

function scoreCards(c, rd, mm) {
  const top = mm.top || mm.eligible[0];
  const hniTxt = canSeeHNI() ? c.hni.status : 'Restricted';
  return `<div class="grid g3" style="margin-bottom:14px">
    <div class="card score-card"><h3>1 · Property fit score</h3>
      ${top ? `<div class="big">${top.M}<small>/100</small></div>${meter(top.M, top.tone)}<div>${chip(top.label, top.tone)} <a href="#/properties/${top.prop.id}">${top.prop.id}</a> <small>${esc(top.prop.title)}</small></div>` : '<div class="big">—</div><small>No property passes the hard filters</small>'}
      <small>How well the best property meets this customer’s requirements.</small></div>
    <div class="card score-card"><h3>2 · Purchase readiness score</h3>
      <div class="big">${rd.total}<small>/${rd.maxTotal}</small></div>${meter(rd.total, rd.band.tone)}<div>${chip(rd.band.l, rd.band.tone)}</div>
      <small>How ready the customer is to buy (BANT + funding + engagement).</small></div>
    <div class="card score-card"><h3>3 · HNI verification status</h3>
      <div class="big" style="font-size:20px">${esc(hniTxt)}</div>
      <small>A status, never a score. Potential indicators are recorded separately and are not proof of wealth.</small>
      ${canSeeHNI() ? `<a href="#/customers/${c.id}/hni">Open HNI assessment →</a>` : '<small>🔒 Visible to managers only</small>'}</div>
  </div>`;
}

function custOverview(c, rd, cls, mm) {
  const r = c.req, b = c.budget, ceil = b.max * (1 + (b.flexPct || 0) / 100);
  const reqRows = [['Purpose', c.purpose + (c.purposeNote ? ` — ${c.purposeNote}` : '')], ['Preferred property', typeLabel(r.type)], ['Preferred location', (r.cities || []).join(', ') + (r.localities && r.localities.length ? ` (${r.localities.join(', ')})` : '')], [REQ_SIZE_LABEL[r.type], r.size ? num(r.size) + ' sq.ft.' : '—']];
  REQ_FIELDS[r.type].forEach(f => reqRows.push([f.l, r[f.k] === '' || r[f.k] == null ? '—' : (f.t === 'number' ? num(r[f.k]) : r[f.k])]));
  reqRows.push(['Approval requirement', r.approvalRequired ? 'Applicable approvals must be verified' : 'Not mandatory'], ['Site visit', r.siteVisit ? 'Required' : 'Not required'], ['Must-have amenities', (r.amenities || []).join(', ') || '—']);
  const recs = (c.recommended || []).map(id => getProp(id)).filter(Boolean);
  const lastVisit = (c.siteVisits || []).slice(-1)[0];
  const kv = rows => `<dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${typeof v === 'string' && v.startsWith('<') ? v : esc(v)}</dd>`).join('')}</dl>`;
  const hniCls = cls === 'Potential HNI' || cls === 'Verified HNI';
  return `${scoreCards(c, rd, mm)}
  <div class="grid g2">
    <div class="card"><div class="card-head"><h2>Customer requirements</h2><span class="sp"></span><a class="btn sm" href="#/customers/${c.id}/edit">✎ Edit</a></div>${kv(reqRows)}</div>
    <div>
      <div class="card"><h2>Budget specification</h2>
        ${kv([['Minimum budget', inr(b.min)], ['Preferred budget', inr(b.pref)], ['Maximum budget', inr(b.max)], ['Budget flexibility', `Up to ${b.flexPct || 0}% → ceiling ${inr(Math.round(ceil))}`], ['Budget includes', b.basis], ['Funding preference', b.funding], ['Funding readiness', b.fundingReady]])}
        ${b.basis === 'Not clarified yet' ? `<div class="note amber" style="margin-top:10px">Clarify whether ${inrShort(b.max)} is for the property alone, includes registration and other costs, or includes a home loan — before recommending properties.</div>` : ''}
      </div>
      <div class="card"><div class="card-head"><h2>Customer classification</h2><span class="sp"></span><small>Separate from lead score</small></div>
        ${hniCls && !canSeeHNI() ? '<p class="muted">🔒 Restricted to managers.</p>' : `
        <div class="row"><select class="inline-in" data-bind="${bkey('c', c.id, 'classification')}" style="width:auto">${options(CLASSIFICATIONS.map(x => x.v).filter(v => v !== 'Verified HNI' || c.hni.status === 'Verified'), c.classification, `Auto — ${suggestedClassification(c, DB)}`)}</select>
        ${c.classification ? chip('Manual override', 'amber') : chip('System suggestion', 'outline')}</div>
        <p class="muted" style="margin:8px 0 0">${(CLASSIFICATIONS.find(x => x.v === cls) || {}).d || ''}. “Verified HNI” is only available after a consent-based verification.</p>`}
      </div>
    </div>
  </div>
  <div class="card"><h2>Sales record</h2>
    <div class="dl3">
      <div><span>Lead owner</span><b>${esc(execName(DB, c.owner))}</b></div>
      <div><span>Last contact date</span><b>${fmtDate(c.lastContact)}</b></div>
      <div><span>Next follow-up date</span><b>${followUpCell(c)}</b></div>
      <div><span>Current sales stage</span><b>${chip(c.stage, stageTone(c.stage))} <small>since ${fmtDate(c.stageSince)}</small></b></div>
      <div><span>Recommended properties</span><b>${recs.map(p => `<a href="#/properties/${p.id}">${p.id}</a>`).join(', ') || '—'}</b></div>
      <div><span>Site visit feedback</span><b>${lastVisit ? `${fmtDate(lastVisit.date)} · ${lastVisit.status}${lastVisit.feedback ? ' — ' + esc(lastVisit.feedback) : ''}` : '—'}</b></div>
      <div><span>Negotiation</span><b>${c.negotiation ? `${c.negotiation.prop}: offered ${inrShort(c.negotiation.offered)}, counter ${inrShort(c.negotiation.counter)}` : '—'}</b></div>
      <div><span>Reason lost</span><b>${c.stage === LOST_STAGE ? esc(c.lostReason) : '—'}</b></div>
    </div>
  </div>`;
}

function custQualification(c, rd) {
  const q = (lbl, question, control) => `<div class="f"><label>${lbl}</label><span class="hint" style="margin-top:-2px">“${question}”</span>${control}</div>`;
  const b = c.budget;
  return `
  <div class="grid g2">
    <div class="card"><h2>BANT questions</h2>
      <div class="stack">
        ${q('Budget', 'What budget range are you comfortable with?', `<div class="row">${chip(`${inrShort(b.min)} – ${inrShort(b.max)}`, 'blue')} <small>${esc(b.basis)}</small> <a href="#/customers/${c.id}/edit">edit</a></div>`)}
        ${q('Authority', 'Are you making the purchase decision yourself, or with family / business partners?', bSel('c', c.id, 'bant.authority', c.bant.authority, AUTHORITY))}
        ${q('Need', 'What is your actual requirement?', bSel('c', c.id, 'bant.need', c.bant.need, NEED_CLARITY))}
        ${q('Timeline', 'When are you planning to purchase?', bSel('c', c.id, 'bant.timeline', c.bant.timeline, TIMELINES))}
        ${q('Funding readiness', 'Have you arranged funds or financing?', bSel('c', c.id, 'budget.fundingReady', b.fundingReady, FUNDING_READY))}
        <div class="f"><label>Engagement</label><span class="hint">Has the customer responded, requested documents or attended a site visit?</span>
          <div class="checks">${bChk('c', c.id, 'engagement.responded', c.engagement.responded, 'Responded')}${bChk('c', c.id, 'engagement.docsRequested', c.engagement.docsRequested, 'Requested documents')}${bChk('c', c.id, 'engagement.siteVisited', c.engagement.siteVisited, 'Attended site visit')}</div></div>
      </div>
    </div>
    <div class="card"><div class="card-head"><h2>Purchase readiness score</h2><span class="sp"></span>${chip(rd.total + '/' + rd.maxTotal, rd.band.tone)}</div>
      <div class="tbl-wrap"><table><thead><tr><th>Criteria</th><th>Answer</th><th class="num">Points</th></tr></thead><tbody>
        ${rd.rows.map(r => `<tr><td>${r.l}</td><td><small>${esc(r.note)}</small></td><td class="num"><b>${r.score}</b> / ${r.max}</td></tr>`).join('')}
        <tr><td colspan="2"><b>Total</b></td><td class="num"><b>${rd.total}</b> / ${rd.maxTotal}</td></tr></tbody></table></div>
      <div style="margin-top:12px">${meter(rd.total, rd.band.tone)}</div>
      <div class="row" style="margin-top:10px;font-size:12px">${chip(`${DB.settings.bands.high}–100 High-priority`, 'green')}${chip(`${DB.settings.bands.qualified}–${DB.settings.bands.high - 1} Qualified`, 'blue')}${chip(`${DB.settings.bands.developing}–${DB.settings.bands.qualified - 1} Developing`, 'amber')}${chip(`< ${DB.settings.bands.developing} Early-stage`)}</div>
      <p class="muted" style="margin:10px 0 0">Initial business rules, not industry-standard thresholds — adjust in <a href="#/settings">Settings</a> after analysing conversion data. No points are ever awarded for name, appearance, occupation, caste, religion or other personal characteristics.</p>
    </div>
  </div>`;
}

function matchCard(c, m, isTop) {
  const w = DB.settings.matchWeights, rec = (c.recommended || []).includes(m.prop.id), p = m.prop;
  return `<div class="match ${isTop ? 'top' : ''}">
    <div class="match-head">
      <div><div class="ttl"><a href="#/properties/${p.id}">${esc(p.title)}</a> <small class="mono">${p.id}</small></div>
        <small>${typeLabel(p.type)} · ${esc(p.locality)}, ${esc(p.city)} · ${num(p.area)} sq.ft. · <b>${inrShort(p.price)}</b></small></div>
      ${chip(m.label, m.tone)} ${isTop ? chip('★ Top recommendation', 'green') : ''} ${rec ? chip('Recommended to customer', 'blue') : ''}
      <div class="match-score">${m.M}<small>fit score</small></div>
    </div>
    <div class="comps">${[['B', 'Budget'], ['L', 'Location'], ['S', 'Size'], ['A', 'Amenities'], ['P', 'Preferences']].map(([k, l]) => `<div><small>${l} · ×${w[k]}</small><b>${m.comps[k]}</b>${meter(m.comps[k], m.comps[k] >= 80 ? 'green' : m.comps[k] >= 50 ? 'amber' : 'red')}</div>`).join('')}</div>
    <ul class="why">${m.why.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <div class="row" style="margin-top:10px">
      ${rec ? `<button class="btn sm" data-act="unrecommend" data-id="${c.id}" data-p="${p.id}">Remove recommendation</button>` : `<button class="btn sm ${m.legalOk ? 'primary' : ''}" data-act="recommend" data-id="${c.id}" data-p="${p.id}" ${m.legalOk ? '' : 'title="Mandatory legal checks unresolved — explain before recommending"'}>✓ Recommend to customer</button>`}
      <button class="btn sm" data-act="visitModal" data-id="${c.id}" data-p="${p.id}">📅 Schedule site visit</button>
    </div>
  </div>`;
}

function custMatches(c, rd, cls, mm) {
  const w = DB.settings.matchWeights;
  return `
  <div class="grid g-side">
    <div>
      <div class="card" style="margin-bottom:14px"><div class="card-head"><h2>Recommended properties for ${esc(c.name)}</h2><span class="sp"></span><a class="btn sm" href="#/matching?c=${c.id}">Open in matching engine →</a></div>
        <p class="muted" style="margin:0">${esc(reqSummary(c))} · budget ${inrShort(c.budget.min)}–${inrShort(c.budget.max)}${c.budget.flexPct ? ` (+${c.budget.flexPct}%)` : ''}${c.req.approvalRequired ? ' · approvals must be verified' : ''}</p></div>
      ${mm.eligible.length ? mm.eligible.map(m => matchCard(c, m, mm.top && m.prop.id === mm.top.prop.id)).join('') : '<div class="card empty">No available property passes the hard filters. Consider discussing budget, location or type — or record this as “No suitable inventory”.</div>'}
      ${mm.excluded.length ? `<details class="card" style="margin-top:14px"><summary><b>Excluded by hard filters (${mm.excluded.length})</b> — not recommended as direct matches</summary>
        <div class="tbl-wrap" style="margin-top:10px"><table><thead><tr><th>Property</th><th>Result</th><th>Why excluded</th></tr></thead><tbody>
        ${mm.excluded.map(m => `<tr><td><a href="#/properties/${m.prop.id}">${m.prop.id}</a> <small>${esc(m.prop.title)} · ${inrShort(m.prop.price)}</small></td><td>${chip(m.label, m.tone)}</td><td><small>${m.why.map(esc).join('; ')}</small></td></tr>`).join('')}
        </tbody></table></div></details>` : ''}
    </div>
    <div>
      <div class="card"><h2>How matching works</h2>
        <ol class="why" style="padding-left:18px"><li><b>Hard filters</b>: available · type matches · location acceptable · price within budget (+ flexibility).</li><li><b>Rank</b> the rest by weighted score.</li><li>An approval badge claimed without its document → <b>Conditional</b>, never the top recommendation.</li></ol>
        <div class="formula" style="margin-top:10px">M = ${w.B}B + ${w.L}L + ${w.S}S + ${w.A}A + ${w.P}P</div>
        <p class="muted" style="margin:8px 0 0">B budget · L location · S size · A amenities/infrastructure · P preferences. Each 0–100. Weights are starting assumptions — tune in <a href="#/settings">Settings</a>.</p>
      </div>
    </div>
  </div>`;
}

function custFollowups(c) {
  const consentOk = c.consent && c.consent.followUp;
  const props = DB.properties;
  const visits = (c.siteVisits || []).map((v, i) => `<tr>
    <td style="width:150px">${bIn('c', c.id, `siteVisits.${i}.date`, v.date, 'date')}</td>
    <td><a href="#/properties/${v.prop}">${v.prop}</a></td>
    <td>${bSel('c', c.id, `siteVisits.${i}.status`, v.status, ['Scheduled', 'Completed', 'Cancelled', 'No-show'])}</td>
    <td>${bSel('c', c.id, `siteVisits.${i}.interest`, v.interest, ['', 'High', 'Medium', 'Low'])}</td>
    <td>${bIn('c', c.id, `siteVisits.${i}.feedback`, v.feedback, 'text', 'placeholder="Feedback after visit"')}</td></tr>`).join('');
  const n = c.negotiation;
  return `
  <div class="grid g-side">
    <div>
      <form class="card" data-form="activity" data-id="${c.id}"><h2>Log activity</h2>
        <div class="fgrid">
          ${fld('Type', `<select name="type">${options(ACTIVITY_TYPES, 'Call')}</select>`)}
          ${fld('Date', `<input type="date" name="date" value="${DEMO_TODAY}">`)}
          ${fld('Next follow-up', `<input type="date" name="next" ${consentOk ? '' : 'disabled'}>`, { hint: consentOk ? 'Optional' : 'Needs consent' })}
          ${fld('Notes', `<textarea name="text" required placeholder="What was discussed, what the customer asked for…"></textarea>`, { cls: 'span3' })}
        </div>
        <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn primary">Add to timeline</button></div>
      </form>
      <div class="card"><h2>Activity timeline</h2><ul class="tl">${c.activity.map(a => `<li><div class="when">${fmtDate(a.date)} · ${esc(a.type)} · ${esc(a.by)}</div>${esc(a.text)}</li>`).join('') || '<li>No activity yet.</li>'}</ul></div>
    </div>
    <div>
      <div class="card"><h2>Follow-up consent</h2>
        ${consentOk ? `<div class="note green">Consent recorded ${fmtDate(c.consent.date)} · ${esc(c.consent.channel || '')}. Follow-ups via ${esc(c.contactPref)}.</div><div class="row" style="margin-top:8px"><button class="btn sm danger" data-act="withdrawConsent" data-id="${c.id}">Record withdrawal</button></div>`
          : `<div class="note red">No consent — follow-ups can’t be scheduled.</div><div class="row" style="margin-top:8px"><button class="btn sm primary" data-act="consentModal" data-id="${c.id}">Record consent</button></div>`}
      </div>
      <div class="card"><div class="card-head"><h2>Site visits</h2><span class="sp"></span><button class="btn sm" data-act="visitModal" data-id="${c.id}">＋ Schedule</button></div>
        ${visits ? `<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Property</th><th>Status</th><th>Interest</th><th>Feedback</th></tr></thead><tbody>${visits}</tbody></table></div>` : '<p class="muted">No site visits yet.</p>'}
      </div>
      <div class="card"><div class="card-head"><h2>Negotiation</h2><span class="sp"></span>${n ? '' : `<button class="btn sm" data-act="startNeg" data-id="${c.id}">Start negotiation</button>`}</div>
        ${n ? `<div class="stack">
          ${fld('Property', bSel('c', c.id, 'negotiation.prop', n.prop, props.map(p => ({ v: p.id, l: `${p.id} · ${p.title}` }))))}
          <div class="fgrid c2">${fld('Customer offer (₹)', bIn('c', c.id, 'negotiation.offered', n.offered, 'number'))}${fld('Seller counter (₹)', bIn('c', c.id, 'negotiation.counter', n.counter, 'number'))}</div>
          ${fld('Negotiation details', `<textarea class="inline-in" data-bind="${bkey('c', c.id, 'negotiation.notes')}">${esc(n.notes)}</textarea>`)}
          ${n.offered && n.counter ? `<small class="muted">Gap: ${inr(Math.abs(n.counter - n.offered))} (${(Math.abs(n.counter - n.offered) / n.counter * 100).toFixed(1)}%)</small>` : ''}</div>` : '<p class="muted">No negotiation in progress.</p>'}
      </div>
      ${c.stage === LOST_STAGE ? `<div class="card"><h2>Reason lost</h2>${fld('Reason', bSel('c', c.id, 'lostReason', c.lostReason, LOST_REASONS))}<div style="height:8px"></div>${fld('Details', bIn('c', c.id, 'lostNote', c.lostNote))}</div>` : ''}
    </div>
  </div>`;
}

function custHNI(c, rd, cls) {
  if (!canSeeHNI()) return restrictedHtml();
  const h = c.hni, sugg = suggestedClassification(c, DB);
  const recorded = HNI_SIGNALS.filter(s => (h.signals || {})[s.k]).length;
  return `
  <div class="note amber" style="margin-bottom:14px">🛡️ <b>Restricted section.</b> HNI qualification is kept separate from ordinary lead scoring. Record only voluntarily provided business information. Do <b>not</b> ask for bank statements, tax returns, account balances or other sensitive financial documents during lead generation.</div>
  <div class="grid g-side">
    <div>
      <div class="card"><div class="card-head"><h2>Qualification signals</h2><span class="sp"></span>${chip(`${recorded}/${HNI_SIGNALS.length} recorded`, recorded ? 'blue' : '')}</div>
        <div class="tbl-wrap"><table><thead><tr><th>Area</th><th>Question to ask</th><th>Customer’s answer (as stated)</th></tr></thead><tbody>
        ${HNI_SIGNALS.map(s => `<tr><td><b>${s.l}</b></td><td><small>${s.q}</small></td><td>${bIn('c', c.id, `hni.signals.${s.k}`, (h.signals || {})[s.k] || '', 'text', 'placeholder="Not discussed"')}</td></tr>`).join('')}
        </tbody></table></div>
      </div>
      <div class="card"><h2>Verification (consent-based)</h2>
        <div class="fgrid c2">
          ${fld('HNI verification status', bSel('c', c.id, 'hni.status', h.status, HNI_STATUSES))}
          ${fld('Potential HNI indicators', bChk('c', c.id, 'hni.potentialFlag', h.potentialFlag, 'Indicators recorded — mark as Potential HNI'))}
          ${fld('Customer consent for verification', bChk('c', c.id, 'hni.consent', h.consent, 'Consent obtained (lawful, documented)'))}
          ${fld('Consent date', bIn('c', c.id, 'hni.consentDate', h.consentDate, 'date', h.consent ? '' : 'disabled'))}
          ${fld('Verified by', bIn('c', c.id, 'hni.verifiedBy', h.verifiedBy, 'text', h.consent ? '' : 'disabled'))}
          ${fld('Verified date', bIn('c', c.id, 'hni.verifiedDate', h.verifiedDate, 'date', h.consent ? '' : 'disabled'))}
          ${fld('Notes', `<textarea class="inline-in" data-bind="${bkey('c', c.id, 'hni.notes')}">${esc(h.notes)}</textarea>`, { cls: 'span3' })}
        </div>
        <p class="muted" style="margin:8px 0 0">Last reviewed ${h.reviewedDate ? `${fmtDate(h.reviewedDate)} by ${esc(h.reviewedBy)}` : '—'}. Status can only become “Verified” after consent is recorded.</p>
      </div>
    </div>
    <div>
      <div class="card"><h2>Classification ladder</h2>
        ${CLASSIFICATIONS.map(x => `<div style="padding:7px 9px;border-radius:7px;margin-bottom:4px;${x.v === cls ? 'background:var(--purple-soft);' : ''}"><b style="font-size:13px">${x.v}</b> ${x.v === cls ? chip('current', 'purple') : ''} ${x.v === sugg && x.v !== cls ? chip('suggested', 'outline') : ''}<br><small>${x.d}</small></div>`).join('')}
        <div class="note" style="margin-top:8px">A potential HNI is <b>not</b> a confirmed HNI. A ₹30 L buyer may be a serious investor; a ₹5 Cr enquiry may have no immediate purchase capacity.</div>
      </div>
      <div class="card"><h2>Why not a number?</h2><p class="muted" style="margin:0">Readiness is scored (${rd.total}/100). HNI is a <b>verification status</b> — a numeric score must never be presented as proof of wealth.</p></div>
    </div>
  </div>`;
}

function restrictedHtml() {
  return `<div class="card empty" style="padding:50px">🔒<h2 style="margin-top:8px">Restricted to managers</h2><p>HNI indicators and verification are sensitive. Switch “Viewing as” to <b>Sales manager</b> or <b>Admin</b> to see this section.</p></div>`;
}

/* ---------- forms, modals, actions ---------- */
FORMS.activity = (f, fd) => {
  const c = getCust(f.dataset.id), text = (fd.get('text') || '').trim();
  if (!text) { toast('Add a note'); return; }
  const type = fd.get('type'), date = fd.get('date') || DEMO_TODAY;
  c.activity.unshift({ date, type, text, by: currentUser() });
  if (['Call', 'WhatsApp', 'Email', 'Meeting', 'Site visit'].includes(type)) { c.lastContact = date; c.engagement.responded = true; }
  if (type === 'Documents shared') c.engagement.docsRequested = true;
  const next = fd.get('next');
  if (next && c.consent.followUp) c.nextFollowUp = next;
  save(); toast('Activity added'); render();
};

Object.assign(MODALS, {
  stage: m => {
    const c = getCust(m.id), stage = m.stage || c.stage;
    return { title: `Move ${esc(c.name)} to stage`, html: `
      ${fld('New stage', `<select name="stage" data-chg="modalStage">${options([...STAGES, LOST_STAGE], stage)}</select>`)}
      <div id="lost-fields" style="margin-top:12px;${stage === LOST_STAGE ? '' : 'display:none'}">
        ${fld('Reason lost', `<select name="reason">${options(LOST_REASONS, c.lostReason || 'Bought elsewhere')}</select>`, { req: 1 })}<div style="height:10px"></div>
        ${fld('Details', `<input name="note" placeholder="What happened?">`)}</div>
      <p class="muted" style="margin:12px 0 0">Current: ${c.stage} since ${fmtDate(c.stageSince)}. Tracking reasons lost shows managers where leads get stuck.</p>`, submit: 'Move' };
  },
  visit: m => {
    const c = getCust(m.id), mm = matchesForCustomer(c, DB);
    const opts = mm.eligible.map(x => ({ v: x.prop.id, l: `${x.prop.id} · ${x.prop.title} (${x.label})` }));
    if (!opts.length) DB.properties.filter(p => p.status === 'Available' && !p.archived).forEach(p => opts.push({ v: p.id, l: `${p.id} · ${p.title}` }));
    return { title: `Schedule site visit — ${esc(c.name)}`, html: `
      ${fld('Property', `<select name="prop">${options(opts, m.p || (opts[0] || {}).v)}</select>`, { req: 1 })}<div style="height:10px"></div>
      ${fld('Visit date', `<input type="date" name="date" value="${addDays(DEMO_TODAY, 3)}" required>`, { req: 1 })}
      ${c.consent.followUp ? '' : '<div class="note red" style="margin-top:12px">No follow-up consent recorded — confirm consent with the customer first.</div>'}`, submit: 'Schedule' };
  },
  consent: m => {
    const c = getCust(m.id);
    return { title: `Record consent — ${esc(c.name)}`, html: `
      <p>Confirm the customer agreed to be contacted for follow-ups and understands why their details are collected.</p>
      ${fld('Channel / how consent was given', `<select name="channel">${options(['Verbal on call', 'WhatsApp message', 'Website form', 'Signed enquiry form', 'Email'], 'Verbal on call')}</select>`)}<div style="height:10px"></div>
      ${fld('Date', `<input type="date" name="date" value="${DEMO_TODAY}">`)}`, submit: 'Record consent' };
  },
});
Object.assign(CHANGES, { modalStage: el => { document.getElementById('lost-fields').style.display = el.value === LOST_STAGE ? '' : 'none'; } });
Object.assign(MODAL_SUBMIT, {
  stage: (m, fd) => { const c = getCust(m.id), s = fd.get('stage'); moveStage(c, s, s === LOST_STAGE ? fd.get('reason') : '', fd.get('note')); UI.modal = null; toast(`${c.name} → ${s}`); render(); },
  visit: (m, fd) => {
    const c = getCust(m.id), pid = fd.get('prop'), date = fd.get('date');
    c.siteVisits = c.siteVisits || []; c.siteVisits.push({ date, prop: pid, status: 'Scheduled', feedback: '', interest: '' });
    if (!(c.recommended || []).includes(pid)) (c.recommended = c.recommended || []).push(pid);
    logActivity(c, 'Site visit', `Site visit scheduled for ${pid} on ${fmtDate(date)}`);
    if (stageIndex(c.stage) >= 0 && stageIndex(c.stage) < STAGES.indexOf('Site visit scheduled')) moveStage(c, 'Site visit scheduled');
    save(); UI.modal = null; toast('Site visit scheduled'); render();
  },
  consent: (m, fd) => {
    const c = getCust(m.id); c.consent = { followUp: true, date: fd.get('date'), channel: fd.get('channel') };
    if (!c.nextFollowUp && isActive(c)) c.nextFollowUp = addDays(DEMO_TODAY, 1);
    logActivity(c, 'Note', `Follow-up consent recorded (${fd.get('channel')})`); save(); UI.modal = null; toast('Consent recorded'); render();
  },
});
Object.assign(ACTIONS, {
  stageModal: d => openModal({ kind: 'stage', id: d.id }),
  visitModal: d => openModal({ kind: 'visit', id: d.id, p: d.p }),
  consentModal: d => openModal({ kind: 'consent', id: d.id }),
  withdrawConsent: d => { const c = getCust(d.id); c.consent = { followUp: false, date: '', channel: '' }; c.nextFollowUp = ''; logActivity(c, 'Note', 'Customer withdrew follow-up consent — follow-ups cancelled'); save(); toast('Consent withdrawn; follow-up cleared'); render(); },
  recommend: d => {
    const c = getCust(d.id), p = getProp(d.p), m = matchScore(c, p, DB.settings);
    (c.recommended = c.recommended || []).push(d.p);
    logActivity(c, 'Note', `Recommended ${d.p} (${m.label}, fit ${m.M})${m.legalOk ? '' : ' — customer informed that mandatory legal checks are pending'}`);
    if (stageIndex(c.stage) >= 0 && stageIndex(c.stage) < STAGES.indexOf('Property recommended')) moveStage(c, 'Property recommended');
    save(); toast(m.legalOk ? 'Marked as recommended' : 'Recommended with legal caveat logged'); render();
  },
  unrecommend: d => { const c = getCust(d.id); c.recommended = (c.recommended || []).filter(x => x !== d.p); logActivity(c, 'Note', `Removed recommendation ${d.p}`); save(); render(); },
  startNeg: d => { const c = getCust(d.id), mm = matchesForCustomer(c, DB); c.negotiation = { prop: (c.recommended || [])[0] || (mm.eligible[0] || { prop: DB.properties[0] }).prop.id, offered: '', counter: '', notes: '' }; save(); render(); },
});
