/* =====================================================================
   System map, public enquiry form, Test scenario 001, Settings & rules
   ===================================================================== */

/* ---------- system map ---------- */
function viewAbout() {
  const box = (t, items, tone, href) => `<a class="card" href="${href}" style="display:block;color:inherit;border-top:3px solid var(--${tone})"><b>${t}</b><div class="muted" style="font-size:12.5px;margin-top:4px">${items}</div></a>`;
  const phases = [
    ['1', 'Property management', 'Registration, type-specific specs, images, pricing, availability', '#/properties', 'Build first'],
    ['2', 'Customer enquiry system', 'Purpose, budget, location, type, timeline', '#/enquiry', ''],
    ['3', 'Customer qualification', 'BANT, lead stages, readiness scoring, follow-ups', '#/customers/CUST-1001/qualification', ''],
    ['4', 'Property matching', 'Requirements vs available properties, with explanations', '#/matching', ''],
    ['5', 'HNI assessment', 'Potential-HNI indicators, consent-based verification, restricted access', '#/hni', ''],
    ['6', 'AI integration', 'Assistant asks initial questions, explains specs, preps sales calls', '#/about', 'Out of wireframe scope'],
  ];
  return {
    title: 'System map', crumbs: 'Overview / <b>System map</b>',
    html: `
    <div class="page-head"><div><h1>Real estate specification system — Property + Customer</h1><p>More than a listing site: understand what you sell, what the customer needs, whether the property suits them, and how ready they are to buy.</p></div></div>
    <div class="grid g2">${box('PROPERTY DATA — Module A', 'Property details · Documents · Location · Price · Features', 'blue', '#/properties')}${box('CUSTOMER DATA — Module B', 'Purpose · Budget · Preferences · Timeline · Funding readiness', 'purple', '#/customers')}</div>
    <div style="text-align:center;font-size:20px;color:var(--muted);margin:6px 0">↓ ↓</div>
    ${box('MATCHING + QUALIFICATION ENGINE — Modules C &amp; D', 'Property suitability (fit score) · Customer readiness (readiness score) · Lead priority · HNI status kept separate', 'amber', '#/matching')}
    <div style="text-align:center;font-size:20px;color:var(--muted);margin:6px 0">↓ ↓</div>
    <div class="grid g2">${box('Property recommendations', 'Best-fit properties with explanations', 'green', '#/customers/CUST-1001/matches')}${box('Sales CRM — Module E', 'Qualified customer leads · pipeline · follow-ups · reports', 'green', '#/dashboard')}</div>
    <div class="grid g2" style="margin-top:14px">
      <div class="card"><h2>Guiding principles built into this wireframe</h2><ul class="why">
        <li>Property value, customer purchasing capacity and sales priority are <b>separate assessments</b>.</li>
        <li>A high-budget customer is not automatically an HNI; an expensive property is not automatically a high-value investment.</li>
        <li>Every property and customer has a unique ID.</li>
        <li>Forms change by property type — no one-size form.</li>
        <li>Legal &amp; documents is optional: approval badges show once their document is uploaded; never “100% legally clear”.</li>
        <li>Distances are measured; planned/proposed infrastructure is never shown as existing.</li>
        <li>Unresolved mandatory legal checks block a property from being the top recommendation.</li>
        <li>Consent before follow-up; sensitive financial data is never collected during lead generation.</li></ul></div>
      <div class="card"><h2>Implementation phases</h2>
        <div class="tbl-wrap"><table><tbody>${phases.map(p => `<tr class="click" data-href="${p[3]}"><td><span class="chip blue">Phase ${p[0]}</span></td><td><b>${p[1]}</b><br><small>${p[2]}</small></td><td>${p[4] ? chip(p[4], p[4] === 'Build first' ? 'green' : '') : ''}</td></tr>`).join('')}</tbody></table></div>
        <p class="muted" style="margin:10px 0 0">Version 1 MVP = Real Estate Specification &amp; Lead Management: add plots/flats/houses/commercial with detailed specs, customers submit requirements, executives qualify leads, the system recommends matches, managers view pipeline &amp; reports.</p></div>
    </div>
    <div class="card"><h2>Try it</h2><div class="row">
      <a class="btn" href="#/test">🧪 Run test scenario 001</a><a class="btn" href="#/enquiry">📝 Submit an enquiry as a customer</a><a class="btn" href="#/properties/new">🏠 Add a property (watch the form change by type)</a>
      <a class="btn" href="#/customers/CUST-1001/matches">🎯 See Arun’s matches (Property A / B / C example)</a><a class="btn" href="#/customers/CUST-1015/hni">🛡️ High budget ≠ HNI example</a></div></div>`,
  };
}

/* ---------- public enquiry form (customer-facing) ---------- */
const ENQ_STEPS = ['Purpose', 'Property & location', 'Budget', 'Requirements & timeline', 'Contact & consent'];
function enqDefaults() {
  return { purpose: '', type: 'plot', cities: ['Madurai'], localities: '', size: '', min: '', pref: '', max: '', flexPct: 5, basis: 'Not clarified yet', funding: 'Own funds', fundingReady: 'Not decided',
    req: {}, approvalRequired: true, siteVisit: true, timeline: '1–3 months', authority: 'Not known yet', name: '', mobile: '', email: '', contactPref: 'WhatsApp', consent: false };
}
function viewEnquiry() {
  const E = UI.enq; if (!E.d || !Object.keys(E.d).length) E.d = enqDefaults();
  const d = E.d, st = E.step;
  if (E.done) return enquiryDone(E.done);
  const steps = ENQ_STEPS.map((s, i) => `<span class="${i === st ? 'on' : i < st ? 'done' : ''}">${i + 1}. ${s}</span>`).join('');
  let body = '';
  if (st === 0) body = `<h2>What is your purpose for purchasing a property?</h2><p class="muted" style="margin-top:-4px">This helps us show what matters to you — a family home buyer and an investor look for different things.</p>${purposeCards(d.purpose, 'purpose')}`;
  if (st === 1) body = `<h2>What are you looking for, and where?</h2>
    <div class="fgrid">
      ${fld('Property type', `<select name="type">${options(Object.entries(PROPERTY_TYPES).map(([v, t]) => ({ v, l: t.label })), d.type)}</select>`, { req: 1 })}
      ${fld('Preferred size (sq.ft.)', `<input type="number" name="size" min="0" value="${esc(d.size)}" placeholder="e.g. 1200">`)}
      ${fld('Preferred localities', `<input name="localities" value="${esc(d.localities)}" placeholder="Optional">`)}
      ${fld('Preferred city', `<div class="checks">${Object.keys(CITIES).map(c => `<label class="check"><input type="checkbox" name="cities" value="${c}" ${d.cities.includes(c) ? 'checked' : ''}> ${c}</label>`).join('')}</div>`, { req: 1, cls: 'span3' })}
    </div>`;
  if (st === 2) body = `<h2>Your budget</h2><p class="muted" style="margin-top:-4px">A range helps us suggest realistic options. There’s no obligation.</p>
    <div class="fgrid">
      ${fld('Minimum (₹)', `<input type="number" name="min" min="0" value="${esc(d.min)}">`)}
      ${fld('Preferred (₹)', `<input type="number" name="pref" min="0" value="${esc(d.pref)}">`)}
      ${fld('Maximum (₹)', `<input type="number" name="max" min="1" value="${esc(d.max)}" required>`, { req: 1 })}
      ${fld('Flexibility', `<select name="flexPct">${options([{ v: 0, l: 'None' }, { v: 5, l: 'Up to 5%' }, { v: 10, l: 'Up to 10%' }], d.flexPct)}</select>`)}
      ${fld('Does this budget include registration & other costs?', `<select name="basis">${options(BUDGET_BASIS, d.basis)}</select>`, { cls: 'span2' })}
      ${fld('How will you fund it?', `<select name="funding">${options(FUNDING_PREFS, d.funding)}</select>`)}
      ${fld('Funding status', `<select name="fundingReady">${options([{ v: 'Ready', l: 'Funds / loan ready' }, { v: 'Arranging', l: 'Arranging' }, { v: 'Not decided', l: 'Not decided yet' }], d.fundingReady)}</select>`)}
    </div>`;
  if (st === 3) body = `<h2>A few details about your requirement</h2>
    <div class="fgrid">${reqFieldsHtml(d.type, d.req)}
      ${fld('When are you planning to purchase?', `<select name="timeline">${options(TIMELINES, d.timeline)}</select>`)}
      ${fld('Who will take the decision?', `<select name="authority">${options([{ v: 'Sole decision-maker', l: 'Myself' }, { v: 'Joint — family / partners involved', l: 'With family / partners' }, { v: 'Not known yet', l: 'Prefer not to say' }], d.authority)}</select>`)}
    </div>
    <div class="checks" style="margin-top:12px"><label class="check"><input type="checkbox" name="approvalRequired" ${d.approvalRequired ? 'checked' : ''}> I want applicable approvals verified</label>
      <label class="check"><input type="checkbox" name="siteVisit" ${d.siteVisit ? 'checked' : ''}> I’d like a site visit</label></div>`;
  if (st === 4) body = `<h2>How can we reach you?</h2>
    <div class="fgrid">
      ${fld('Name', `<input name="name" value="${esc(d.name)}" required>`, { req: 1 })}
      ${fld('Mobile number', `<input name="mobile" value="${esc(d.mobile)}" required placeholder="+91">`, { req: 1 })}
      ${fld('Email', `<input type="email" name="email" value="${esc(d.email)}">`, { hint: 'Optional' })}
      ${fld('Preferred contact method', `<select name="contactPref">${options(CONTACT_PREFS, d.contactPref)}</select>`)}
    </div>
    <div class="note blue" style="margin-top:14px"><label class="check"><input type="checkbox" name="consent" ${d.consent ? 'checked' : ''}> <b>I agree to be contacted</b> about matching properties and site visits on my preferred contact method.</label>
      <div style="font-size:12.5px;margin-top:4px">Why we ask: we collect only what’s needed to recommend suitable properties. We never ask for bank statements or financial documents at this stage. You can withdraw consent at any time.</div></div>`;
  return {
    title: 'Public enquiry form', crumbs: 'Tools / <b>Public enquiry form</b> <span class="chip">customer-facing preview</span>',
    html: `<div class="public">
      <div class="hero"><h1>Find the right property — tell us what you need</h1><p>Takes about 2 minutes. We’ll suggest properties that actually match your purpose, budget and timeline.</p></div>
      <div class="steps">${steps}</div>
      <form class="card" data-form="enquiry">${body}
        <div class="row" style="margin-top:18px">${st > 0 ? '<button type="button" class="btn" data-act="enqBack">← Back</button>' : ''}<span class="sp"></span>
          <button class="btn primary">${st < ENQ_STEPS.length - 1 ? 'Continue →' : 'Submit enquiry'}</button></div>
      </form></div>`,
  };
}
function readEnquiryStep(fd) {
  const d = UI.enq.d, st = UI.enq.step;
  if (st === 0) d.purpose = fd.get('purpose') || '';
  if (st === 1) { const t = fd.get('type'); if (t !== d.type) d.req = {}; d.type = t; d.size = fd.get('size'); d.localities = fd.get('localities'); d.cities = fd.getAll('cities'); }
  if (st === 2) ['min', 'pref', 'max', 'flexPct', 'basis', 'funding', 'fundingReady'].forEach(k => d[k] = fd.get(k));
  if (st === 3) { REQ_FIELDS[d.type].forEach(f => d.req[f.k] = fd.get('req.' + f.k)); d.timeline = fd.get('timeline'); d.authority = fd.get('authority'); d.approvalRequired = fd.get('approvalRequired') === 'on'; d.siteVisit = fd.get('siteVisit') === 'on'; }
  if (st === 4) { ['name', 'mobile', 'email', 'contactPref'].forEach(k => d[k] = (fd.get(k) || '').trim()); d.consent = fd.get('consent') === 'on'; }
}
FORMS.enquiry = (f, fd) => {
  readEnquiryStep(fd);
  const d = UI.enq.d, st = UI.enq.step;
  if (st === 0 && !d.purpose) return toast('Please choose a purpose');
  if (st === 1 && !d.cities.length) return toast('Please choose at least one city');
  if (st === 2 && !(Number(d.max) > 0)) return toast('Please enter a maximum budget');
  if (st === 2 && Number(d.min) > Number(d.max)) return toast('Minimum budget is above the maximum');
  if (st === 4 && (!d.name || !d.mobile)) return toast('Name and mobile are required');
  if (st < ENQ_STEPS.length - 1) { UI.enq.step++; render(); return; }
  // submit → create customer record in the CRM
  const n = v => v === '' || v == null ? '' : Number(v);
  const req = { type: d.type, cities: d.cities, localities: (d.localities || '').split(',').map(s => s.trim()).filter(Boolean), size: n(d.size), approvalRequired: d.approvalRequired, siteVisit: d.siteVisit, amenities: [] };
  REQ_FIELDS[d.type].forEach(f => req[f.k] = f.t === 'number' ? n(d.req[f.k]) : (d.req[f.k] || (f.o ? f.o[0] : '')));
  const owner = nextExecutive(DB);
  const c = cust({
    id: 'CUST-' + (++DB.counters.cust), name: d.name, mobile: d.mobile, email: d.email, contactPref: d.contactPref, source: 'Website', enquiryDate: DEMO_TODAY, owner,
    purpose: d.purpose, budget: { min: n(d.min) || 0, pref: n(d.pref) || n(d.max), max: n(d.max), flexPct: n(d.flexPct) || 0, basis: d.basis, funding: d.funding, fundingReady: d.fundingReady },
    req, bant: { authority: d.authority, need: 'Partly defined', timeline: d.timeline }, engagement: { responded: true, docsRequested: false, siteVisited: false },
    consent: d.consent ? { followUp: true, date: DEMO_TODAY, channel: 'Website form' } : { followUp: false, date: '', channel: '' },
    stage: 'New enquiry', stageSince: DEMO_TODAY, lastContact: '', nextFollowUp: d.consent ? addDays(DEMO_TODAY, 1) : '', activity: [],
  });
  c.activity.unshift({ date: DEMO_TODAY, type: 'Note', text: `Website enquiry received; auto-assigned to ${execName(DB, owner)}${c.nextFollowUp ? `; follow-up scheduled ${fmtDate(c.nextFollowUp)}` : '; no consent, so no follow-up scheduled'}.`, by: 'System' });
  DB.customers.unshift(c); save();
  UI.enq.done = c.id; render();
};
function enquiryDone(id) {
  const c = getCust(id);
  if (!c) { UI.enq = { step: 0, d: {}, done: null }; return viewEnquiry(); }
  const mm = matchesForCustomer(c, DB), rd = readiness(c, DB);
  return {
    title: 'Enquiry submitted', crumbs: 'Tools / <b>Public enquiry form</b>',
    html: `<div class="public">
      <div class="card" style="text-align:center;padding:30px"><div style="font-size:34px">✅</div><h1>Thank you, ${esc(c.name)}!</h1>
        <p class="muted">Your reference is <b class="mono">${c.id}</b>. ${c.consent.followUp ? `Our team will contact you on ${esc(c.contactPref)}.` : 'You didn’t consent to follow-up, so we won’t contact you — you can reach us anytime.'}</p></div>
      <div class="card"><div class="card-head"><h2>Behind the scenes — what the CRM did</h2><span class="chip">internal view</span></div>
        <ul class="why">
          <li>Saved the enquiry as <a href="#/customers/${c.id}">${c.id}</a> (stage: New enquiry).</li>
          <li>Auto-assigned to <b>${esc(execName(DB, c.owner))}</b> (least-loaded executive).</li>
          <li>${c.nextFollowUp ? `Follow-up scheduled for ${fmtDate(c.nextFollowUp)} — consent recorded.` : 'No follow-up scheduled — no consent.'}</li>
          <li>Matching: ${mm.eligible.length} eligible (${mm.eligible.filter(m => m.label === 'Conditional match').length} conditional), ${mm.excluded.length} excluded.${mm.top ? ` Top: <a href="#/properties/${mm.top.prop.id}">${mm.top.prop.id}</a> (${mm.top.M}).` : ''}</li>
          <li>Initial readiness: ${rd.total}/100 — ${rd.band.l}. Sales will qualify with BANT questions.</li>
          <li>Classification suggestion: ${esc(suggestedClassification(c, DB))}. HNI status: Not determined.</li></ul>
        <div class="row" style="margin-top:12px"><a class="btn primary" href="#/customers/${c.id}/matches">Open in CRM →</a><button class="btn" data-act="enqRestart">Submit another enquiry</button></div></div>
    </div>`,
  };
}
Object.assign(ACTIONS, {
  enqBack: () => { UI.enq.step = Math.max(0, UI.enq.step - 1); render(); },
  enqRestart: () => { UI.enq = { step: 0, d: {}, done: null }; render(); },
});

/* ---------- Test scenario 001 ---------- */
const TEST_NAME = 'Test customer — Scenario 001';
function runTest001(withConsent) {
  let c = DB.customers.find(x => x.name === TEST_NAME);
  const base = {
    name: TEST_NAME, mobile: '+91 90000 00001', source: 'Test', enquiryDate: DEMO_TODAY, contactPref: 'WhatsApp',
    purpose: 'Own use', purposeNote: 'Construct own house',
    budget: { min: 2500000, pref: 3000000, max: 3000000, flexPct: 0, basis: 'Property price only', funding: 'Combination', fundingReady: 'Arranging' },
    req: { type: 'plot', cities: ['Madurai'], localities: [], size: 1200, facing: '', minRoad: 0, corner: 'No preference', approvalRequired: true, constructionPlan: 'Within 1 year', siteVisit: true, amenities: [] },
    bant: { authority: 'Joint — family / partners involved', need: 'Clear and specific', timeline: '1–3 months' },
    engagement: { responded: true, docsRequested: false, siteVisited: false },
    consent: withConsent ? { followUp: true, date: DEMO_TODAY, channel: 'Test' } : { followUp: false, date: '', channel: '' },
    classification: '', hni: emptyHni(), recommended: [], stage: 'New enquiry', stageSince: DEMO_TODAY, lastContact: DEMO_TODAY,
  };
  if (!c) { c = cust(Object.assign({ id: 'CUST-' + (++DB.counters.cust), owner: '', activity: [] }, base)); DB.customers.unshift(c); }
  else Object.assign(c, base);
  // expected system behaviour, performed by the system:
  c.owner = c.owner || nextExecutive(DB);                                 // assign the lead
  c.nextFollowUp = c.consent.followUp ? addDays(DEMO_TODAY, 1) : '';      // follow-up only after consent
  const mm = matchesForCustomer(c, DB);
  if (mm.top) c.recommended = [mm.top.prop.id];                           // recommend verified listing
  c.stage = 'Qualified'; c.stageSince = DEMO_TODAY;
  c.activity.unshift({ date: DEMO_TODAY, type: 'Note', text: `Test scenario 001 run (${withConsent ? 'with' : 'without'} consent)`, by: 'Test runner' });
  save();

  const ceil = c.budget.max * (1 + c.budget.flexPct / 100);
  const candidates = DB.properties.filter(p => !p.archived && p.type === 'plot' && p.city === 'Madurai' && p.price <= ceil);
  const unavailable = candidates.filter(p => p.status !== 'Available');
  const legalOpen = mm.eligible.filter(m => !m.legalOk);
  const cls = classificationOf(c, DB);
  const checks = [
    { t: 'Save the customer’s enquiry', ok: !!getCust(c.id), d: `Saved as ${c.id}` },
    { t: 'Identify residential plots matching the location and budget', ok: candidates.length > 0, d: candidates.map(p => `${p.id} (${inrShort(p.price)}, ${p.status})`).join(', ') || 'none' },
    { t: 'Exclude unavailable properties', ok: unavailable.every(p => mm.excluded.some(m => m.prop.id === p.id)), d: unavailable.length ? unavailable.map(p => `${p.id} excluded — ${p.status}`).join(', ') : 'No unavailable candidates' },
    { t: 'Flag approvals claimed without a document', ok: legalOpen.every(m => m.label === 'Conditional match') && (!mm.top || mm.top.legalOk), d: legalOpen.length ? legalOpen.map(m => `${m.prop.id} → Conditional (${legalSummary(m.prop).openApprovals.join(', ')} pending)`).join('; ') : 'No eligible property with a pending approval document' },
    { t: 'Recommend suitable listings', ok: !!mm.top && mm.top.legalOk, d: mm.top ? `${mm.top.prop.id} — ${mm.top.prop.title}, fit ${mm.top.M} (${mm.top.label})` : 'No suitable listing available' },
    { t: 'Assign the lead to a sales executive', ok: !!DB.settings.executives.find(e => e.id === c.owner), d: execName(DB, c.owner) },
    { t: 'Schedule a follow-up after customer consent', ok: withConsent ? !!c.nextFollowUp : !c.nextFollowUp, d: withConsent ? `Consent recorded → follow-up ${fmtDate(c.nextFollowUp)}` : 'No consent → correctly NOT scheduled' },
    { t: 'Expected output: Qualified buyer', ok: cls === 'Qualified buyer', d: `Classification: ${cls}` },
    { t: 'Expected output: HNI status not determined', ok: c.hni.status === 'Not determined', d: `HNI status: ${c.hni.status} — budget and purchase purpose do not establish HNI status` },
  ];
  UI.test = { id: c.id, checks, withConsent, rd: readiness(c, DB), mm };
}
function viewTest() {
  const T = UI.test;
  const exists = DB.customers.find(x => x.name === TEST_NAME);
  return {
    title: 'Test scenario 001', crumbs: 'Tools / <b>Test scenario 001</b>',
    html: `
    <div class="page-head"><div><h1>Test scenario 001 — Residential plot buyer</h1><p>Runs the scenario against the <b>current</b> data, so you can edit properties (status, legal checks, price) and re-run to see the behaviour change.</p></div></div>
    <div class="grid g2">
      <div class="card"><h2>Customer requirements</h2><dl class="kv" style="grid-template-columns:130px 1fr">
        <dt>Location</dt><dd>Madurai</dd><dt>Purpose</dt><dd>Construct own house</dd><dt>Budget</dt><dd>₹30 lakhs</dd><dt>Plot size</dt><dd>1,200 sq.ft.</dd><dt>Timeline</dt><dd>3 months</dd><dt>Approval</dt><dd>Wants applicable approvals verified</dd></dl>
        <div class="row" style="margin-top:14px">
          <button class="btn primary" data-act="runTest" data-consent="1">▶ Run test (customer gives consent)</button>
          <button class="btn" data-act="runTest" data-consent="0">▶ Run without consent</button>
          ${exists ? `<button class="btn danger" data-act="rmTest">Remove test customer</button>` : ''}</div></div>
      <div class="card"><h2>Expected system behaviour</h2><ol class="why">
        <li>Save the customer’s enquiry.</li><li>Identify residential plots matching the location and budget.</li><li>Exclude unavailable properties.</li><li>Flag unresolved approval verification.</li>
        <li>Recommend suitable verified listings.</li><li>Assign the lead to a sales executive.</li><li>Schedule a follow-up after customer consent.</li></ol>
        <p style="margin:8px 0 0"><b>Expected output:</b> Qualified buyer · HNI status: Not determined.</p></div>
    </div>
    ${T ? `<div class="card" style="margin-top:14px"><div class="card-head"><h2>Result — ${T.checks.filter(x => x.ok).length}/${T.checks.length} passed</h2><span class="sp"></span>
        ${chip(T.checks.every(x => x.ok) ? 'PASS' : 'FAIL', T.checks.every(x => x.ok) ? 'green' : 'red')} <a class="btn sm" href="#/customers/${T.id}/matches">Open test customer →</a></div>
      ${T.checks.map(x => `<div class="test-row"><div class="st">${chip(x.ok ? '✓ Pass' : '✗ Fail', x.ok ? 'green' : 'red')}</div><div class="d"><b>${esc(x.t)}</b><small>${esc(x.d)}</small></div></div>`).join('')}
      <hr><p class="muted" style="margin:0">Separate assessments for this customer — Property fit: ${T.mm.top ? T.mm.top.M + '/100' : '—'} · Purchase readiness: ${T.rd.total}/100 (${T.rd.band.l}) · HNI: Not determined.</p></div>
      <div class="card"><h2>Matching detail</h2>${T.mm.all.filter(m => m.prop.type === 'plot' && m.prop.city === 'Madurai').sort((a, b) => a.excluded - b.excluded || b.M - a.M).map(m => `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--line2)"><a href="#/properties/${m.prop.id}" class="mono">${m.prop.id}</a> <span>${esc(m.prop.title)} · ${inrShort(m.prop.price)} · ${num(m.prop.area)} sq.ft.</span><span class="sp"></span>${chip(m.label, m.tone)} <b>${m.excluded ? '—' : m.M}</b></div>`).join('')}
        <p class="muted" style="margin:10px 0 0">Try it: open <a href="#/properties/PROP-1002/legal">PROP-1002 → Legal</a>, mark “Layout approval” as verified, then re-run — it becomes eligible without the conditional flag.</p></div>` : ''}`,
  };
}
Object.assign(ACTIONS, {
  runTest: d => { runTest001(d.consent === '1'); toast('Test scenario 001 executed'); render(); },
  rmTest: () => { DB.customers = DB.customers.filter(x => x.name !== TEST_NAME); UI.test = null; save(); toast('Test customer removed'); render(); },
});

/* ---------- settings ---------- */
function viewSettings() {
  const S = DB.settings, dis = canEditSettings() ? '' : 'disabled';
  const wSum = Object.values(S.matchWeights).reduce((a, b) => a + Number(b || 0), 0);
  const pSum = Object.values(S.readinessPoints).reduce((a, b) => a + Number(b || 0), 0);
  const wLbl = { B: 'Budget match (B)', L: 'Location match (L)', S: 'Size match (S)', A: 'Amenities match (A)', P: 'Preference match (P)' };
  const pLbl = { budget: 'Budget fits property', requirement: 'Clear purchase requirement', timeline: 'Purchase timeline', funding: 'Funding readiness', authority: 'Decision-making authority', engagement: 'Engagement and follow-up' };
  return {
    title: 'Settings & rules', crumbs: 'Tools / <b>Settings &amp; rules</b>',
    html: `
    <div class="page-head"><div><h1>Settings &amp; business rules</h1><p>All scoring rules are starting assumptions. Tune them after analysing actual site-visit and conversion data.</p></div></div>
    ${dis ? '<div class="note amber" style="margin-bottom:14px">Read-only — only Admin / Sales manager can change business rules.</div>' : ''}
    <div class="grid g2">
      <div class="card"><div class="card-head"><h2>Matching weights</h2><span class="sp"></span>${chip('Sum ' + wSum.toFixed(2), Math.abs(wSum - 1) < 0.001 ? 'green' : 'red')}</div>
        <div class="fgrid c2">${Object.keys(wLbl).map(k => fld(wLbl[k], bIn('s', '', 'matchWeights.' + k, S.matchWeights[k], 'number', `min="0" max="1" step="0.05" ${dis}`))).join('')}</div>
        <div class="formula" style="margin-top:12px">M = ${S.matchWeights.B}B + ${S.matchWeights.L}L + ${S.matchWeights.S}S + ${S.matchWeights.A}A + ${S.matchWeights.P}P</div>
        ${Math.abs(wSum - 1) >= 0.001 ? '<div class="note red" style="margin-top:10px">Weights should add up to 1.00 so the fit score stays out of 100.</div>' : ''}</div>
      <div class="card"><div class="card-head"><h2>Purchase readiness points</h2><span class="sp"></span>${chip('Total ' + pSum, pSum === 100 ? 'green' : 'red')}</div>
        <div class="fgrid c2">${Object.keys(pLbl).map(k => fld(pLbl[k], bIn('s', '', 'readinessPoints.' + k, S.readinessPoints[k], 'number', `min="0" max="100" ${dis}`))).join('')}</div>
        ${pSum !== 100 ? '<div class="note red" style="margin-top:10px">Points should total 100.</div>' : ''}</div>
      <div class="card"><h2>Lead classification bands</h2>
        <div class="fgrid">${fld('High-priority from', bIn('s', '', 'bands.high', S.bands.high, 'number', dis))}${fld('Qualified from', bIn('s', '', 'bands.qualified', S.bands.qualified, 'number', dis))}${fld('Developing from', bIn('s', '', 'bands.developing', S.bands.developing, 'number', dis))}</div>
        <p class="muted" style="margin:8px 0 0">Below “Developing” = Early-stage enquiry.</p></div>
      <div class="card"><h2>Classification &amp; follow-up</h2>
        <div class="fgrid c2">${fld('“High-value prospect” suggestion from (₹)', bIn('s', '', 'highValueThreshold', S.highValueThreshold, 'number', dis), { hint: `${inrShort(S.highValueThreshold)} — a suggestion only, never HNI` })}
        ${fld('Flag leads stuck after (days)', bIn('s', '', 'stuckDays', S.stuckDays, 'number', dis))}</div></div>
      <div class="card"><h2>Transaction cost assumptions</h2>
        <div class="fgrid">${fld('Stamp duty (%)', bIn('s', '', 'costs.stampDutyPct', S.costs.stampDutyPct, 'number', dis))}${fld('Registration fee (%)', bIn('s', '', 'costs.registrationPct', S.costs.registrationPct, 'number', dis))}${fld('Other costs (%)', bIn('s', '', 'costs.otherPct', S.costs.otherPct, 'number', dis))}</div>
        <p class="muted" style="margin:8px 0 0">Illustrative — confirm current state rates and guideline value before quoting to customers.</p></div>
      <div class="card"><div class="card-head"><h2>Sales executives</h2><span class="sp"></span><button class="btn sm" data-act="addExec" ${dis}>＋ Add</button></div>
        <div class="stack">${S.executives.map((e, i) => `<div class="row"><span class="mono" style="width:44px">${e.id}</span><div style="flex:1">${bIn('s', '', `executives.${i}.name`, e.name, 'text', dis)}</div></div>`).join('')}</div></div>
    </div>
    ${placeCategoriesCard(dis)}
    ${approvalTypesCard(dis)}
    <div class="card"><h2>Demo data</h2>
      <p class="muted" style="margin-top:0">Everything you change is stored in this browser only. Export to share a snapshot, or reset to the original mock data.</p>
      <div class="row"><button class="btn" data-act="exportData">⤓ Export JSON</button>
        <label class="btn">⤒ Import JSON<input type="file" accept="application/json" data-chg="importData" style="display:none"></label>
        <button class="btn danger" data-act="resetData">Reset demo data</button></div></div>`,
  };
}
/** Nearby place categories — used by "Explore the neighbourhood" on every property, by Find nearby places (Google type) and,
    later, by customer requirements ("a school within 2 km"). */
function placeCategoriesCard(dis) {
  const cats = placeCats(), own = (DB.settings.placeCategories || []).length > 0;
  const used = name => DB.properties.reduce((n, p) => n + ((p.location || {}).nearby || []).filter(x => x.cat === name).length, 0);
  const row = (c, i) => `<tr><td style="width:64px">${own ? bIn('s', '', `placeCategories.${i}.icon`, c.icon, 'text', `${dis} style="width:48px;text-align:center"`) : c.icon}</td>
      <td>${own ? bIn('s', '', `placeCategories.${i}.name`, c.name, 'text', dis) : esc(c.name)}</td>
      <td>${own ? bSel('s', '', `placeCategories.${i}.group`, c.group, PLACE_GROUPS.map(g => ({ v: g.k, l: g.l })), dis) : esc((PLACE_GROUPS.find(g => g.k === c.group) || {}).l)}</td>
      <td>${own ? bIn('s', '', `placeCategories.${i}.google`, c.google, 'text', `${dis} placeholder="— added by hand only"`) : `<span class="mono">${esc(c.google || '—')}</span>`}</td>
      <td class="ctr">${own ? bChk('s', '', `placeCategories.${i}.check`, catOf(c.name).check, '', dis) : (catOf(c.name).check ? '✓' : '—')}</td>
      <td class="ctr">${own ? bChk('s', '', `placeCategories.${i}.auto`, catOf(c.name).auto, '', dis) : (catOf(c.name).auto ? '✓' : '—')}</td>
      <td class="num"><small class="muted">${used(c.name)}</small></td></tr>`;
  return `<div class="card"><div class="card-head"><h2>Nearby place categories</h2><span class="sp"></span><button class="btn sm" data-act="addPlaceCat" ${dis}>＋ Add category</button></div>
    <p class="muted" style="margin-top:-4px">The kinds of places shown in <b>Explore the neighbourhood</b>. The Google type is what <b>Find more places</b> searches for; leave it empty for places only added by hand (e.g. Highway). <b>Route check</b> — the route must be checked before the place is advertised (everyday places close by); the others are advertised with Google’s approximate distance. <b>Shown by default</b> — the nearest one appears on every new property.</p>
    <div class="tbl-wrap"><table><thead><tr><th>Icon</th><th>Category</th><th>Shown under</th><th>Google Places type</th><th class="ctr" title="The route must be checked before it is advertised">Route check</th><th class="ctr" title="The nearest one is shown on every new property">Shown by default</th><th class="num">In use</th></tr></thead>
      <tbody>${cats.map(row).join('')}</tbody></table></div>
    ${own ? '' : '<p class="muted" style="margin:8px 0 0">These are the defaults — click <b>Add category</b> to start editing them.</p>'}</div>`;
}
/** Approval badges — the shared list behind "Approvals" on every property and in Add property. */
function approvalTypesCard(dis) {
  const own = (DB.settings.approvals || []).length > 0, list = approvalTypes();
  const used = k => DB.properties.filter(p => { normLegal(p); return p.approvals.some(a => a.k === k); }).length;
  const row = (a, i) => `<tr><td>${own ? bIn('s', '', `approvals.${i}.long`, a.long, 'text', dis) : esc(a.long)}${APPROVAL_TYPES.some(t => t.k === a.k) ? ' <small class="muted">default</small>' : ''}</td>
      <td>${own ? bIn('s', '', `approvals.${i}.doc`, a.doc, 'text', dis) : esc(a.doc)}</td>
      <td><small class="muted">${a.by ? `${esc(a.by)}${a.at ? ', ' + fmtDate(a.at) : ''}` : '—'}</small></td>
      <td class="num"><small class="muted">${used(a.k)}</small></td></tr>`;
  return `<div class="card"><div class="card-head"><h2>Approval badges</h2><span class="sp"></span><button class="btn sm" data-act="addApprovalType" ${dis}>＋ Add approval</button></div>
    <p class="muted" style="margin-top:-4px">Badges the team can tick on a property (Legal &amp; documents, or while adding it with the AI). A ticked badge shows on the listing once its document is uploaded. New ones can also be created from any property.</p>
    <div class="tbl-wrap"><table><thead><tr><th>Approval</th><th>Its document</th><th>Created by</th><th class="num">On properties</th></tr></thead>
      <tbody>${list.map(row).join('')}</tbody></table></div></div>`;
}
{ // renaming a category renames it on every property's places too, so nothing is left in an unknown category
  const after = BIND_HOOKS.after;
  BIND_HOOKS.after = (kind, t, path, v, old) => {
    after(kind, t, path, v, old);
    const ap = kind === 's' && path.match(/^approvals\.(\d+)\.long$/); // the short label follows the name
    if (ap && DB.settings.approvals[+ap[1]]) DB.settings.approvals[+ap[1]].l = v;
    if (kind === 's' && /^placeCategories\.\d+\.name$/.test(path) && old && v !== old) {
      DB.properties.forEach(p => ((p.location || {}).nearby || []).forEach(x => { if (x.cat === old) x.cat = v; }));
    }
  };
}
Object.assign(ACTIONS, {
  addApprovalType: () => {
    if (!canEditSettings()) return;
    addApprovalType('New approval ' + ((DB.settings.approvals || []).length + 1), '');
    save(); render();
  },
  addPlaceCat: () => {
    if (!canEditSettings()) return;
    if (!(DB.settings.placeCategories || []).length) DB.settings.placeCategories = PLACE_CATEGORIES.map(c => ({ ...c }));
    DB.settings.placeCategories.forEach(c => { const d = catOf(c.name); c.check = d.check; c.auto = d.auto; });
    DB.settings.placeCategories.push({ name: 'New category', icon: '📍', group: 'other', google: '', check: true, auto: false });
    save(); render();
  },
  addExec: () => { if (!canEditSettings()) return; const n = DB.settings.executives.length + 1, id = 'EX' + String(n).padStart(2, '0'); DB.settings.executives.push({ id, name: `Executive ${String(n).padStart(2, '0')} — New` }); save(); render(); },
  exportData: () => {
    const blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `realspec-wireframe-data-${DEMO_TODAY}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
});
Object.assign(CHANGES, {
  importData: el => {
    const file = el.files && el.files[0]; if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      try { const d = JSON.parse(rd.result); if (!d.properties || !d.customers || !d.settings) throw new Error('Not a wireframe export'); DB = d; save(); toast('Data imported'); render(); }
      catch (e) { toast('Import failed: ' + e.message); }
    };
    rd.readAsText(file);
  },
});
