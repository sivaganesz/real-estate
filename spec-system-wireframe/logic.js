/* =====================================================================
   Business logic — kept separate from the UI so the rules are readable.
   Three independent assessments (never mixed):
     1. Property fit score     (matchScore)      — property ↔ requirement
     2. Purchase readiness     (readiness)       — customer's buying readiness
     3. HNI verification status (customer.hni)   — consent-based, never a score
   ===================================================================== */

/* ---------- formatting ---------- */
const inr = n => (n === '' || n == null || isNaN(n)) ? '—' : '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
function inrShort(n) {
  if (n === '' || n == null || isNaN(n)) return '—';
  n = Number(n);
  if (n >= 1e7) return '₹' + (n / 1e7).toFixed(n % 1e7 === 0 ? 0 : 2).replace(/\.?0+$/, '') + ' Cr';
  if (n >= 1e5) return '₹' + (n / 1e5).toFixed(n % 1e5 === 0 ? 0 : 1).replace(/\.0$/, '') + ' L';
  return inr(n);
}
const num = n => (n === '' || n == null || isNaN(n)) ? '—' : Number(n).toLocaleString('en-IN');
function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function daysBetween(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000); }
const ymd = dt => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; // local date (toISOString shifts a day in IST)
function addDays(d, n) { const dt = new Date(d + 'T00:00:00'); dt.setDate(dt.getDate() + n); return ymd(dt); }
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/* ---------- property helpers ---------- */
const typeLabel = t => PROPERTY_TYPES[t] ? PROPERTY_TYPES[t].label : t;
const categoryOf = t => PROPERTY_TYPES[t] ? PROPERTY_TYPES[t].category : '';
function pricePerSqft(p) { return p.area > 0 ? Math.round(p.price / p.area) : null; }

function legalSummary(p) {
  const s = { verified: 0, pending: 0, not: 0, total: p.legal.length };
  p.legal.forEach(d => s[d.status]++);
  const mand = MANDATORY_BY_TYPE[p.type] || [];
  s.openMandatory = p.legal.filter(d => mand.includes(d.key) && d.status !== 'verified').map(d => LEGAL_DOCS[d.key].n);
  return s;
}

function valuationSummary(p, settings) {
  const comps = (p.valuation.comparables || []).filter(c => Number(c.pricePerSqft) > 0);
  const ppsf = pricePerSqft(p);
  const out = { ppsf, count: comps.length };
  if (comps.length) {
    const vals = comps.map(c => Number(c.pricePerSqft));
    out.avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    out.min = Math.min(...vals); out.max = Math.max(...vals);
    const txn = comps.filter(c => c.kind === 'Transaction').map(c => Number(c.pricePerSqft));
    out.txnAvg = txn.length ? Math.round(txn.reduce((a, b) => a + b, 0) / txn.length) : null;
    out.diffPct = ppsf ? ((ppsf - out.avg) / out.avg) * 100 : null;
    // Neutral positioning — never "bargain" / "best price"
    if (ppsf >= out.min && ppsf <= out.max) out.position = 'Within comparable range';
    else if (ppsf < out.min) out.position = 'Below comparable range — check for differences (access, approval, condition)';
    else out.position = 'Above comparable range — justify with differences or review price';
  }
  const c = settings.costs;
  const pct = (Number(c.stampDutyPct) || 0) + (Number(c.registrationPct) || 0) + (Number(c.otherPct) || 0);
  out.costPct = pct;
  out.txnCosts = Math.round(p.price * pct / 100);
  out.allIn = p.price + out.txnCosts;
  return out;
}

/* ---------- matching engine ---------- */
function infraScore(p) {
  const s = p.specs || {};
  if (p.type === 'plot') {
    const checks = [s.water && s.water !== 'Not available', s.electricity === 'Available at site', s.drainage && s.drainage !== 'Not available', ['Tar road', 'Concrete road'].includes(s.roadInfra)];
    return (checks.filter(Boolean).length / checks.length) * 100;
  }
  if (p.type === 'house') {
    const checks = [s.water && s.water !== 'Tanker dependent', !!s.power, s.approvalDocs === 'Approval + completion available', ['New', 'Good'].includes(s.condition)];
    return (checks.filter(Boolean).length / checks.length) * 100;
  }
  if (p.type === 'flat') {
    const checks = [(s.lifts || 0) > 0 || (s.floor || 0) <= 1, s.parking && s.parking !== 'None', (p.amenities || []).includes('Power backup'), (p.amenities || []).includes('Security')];
    return (checks.filter(Boolean).length / checks.length) * 100;
  }
  const checks = [(s.roadWidth || 0) >= 30, s.parking && s.parking !== 'None', !!s.permittedUsage];
  return (checks.filter(Boolean).length / checks.length) * 100;
}

function prefChecks(c, p) {
  const r = c.req, s = p.specs || {}, out = [];
  if (p.type === 'plot') {
    if (r.facing) out.push({ l: `Facing ${r.facing}`, ok: p.facing === r.facing, got: p.facing });
    if (r.minRoad) out.push({ l: `Road ≥ ${r.minRoad} ft`, ok: (s.roadWidth || 0) >= r.minRoad, got: (s.roadWidth || '—') + ' ft' });
    if (r.corner && r.corner !== 'No preference') out.push({ l: r.corner, ok: s.corner === r.corner, got: s.corner });
  } else if (p.type === 'flat') {
    if (r.bhk) out.push({ l: r.bhk, ok: s.bhk === r.bhk, got: s.bhk });
    if (r.parking === 'Required') out.push({ l: 'Parking', ok: s.parking && s.parking !== 'None', got: s.parking });
    if (r.possession && r.possession !== 'Any') out.push({ l: r.possession, ok: s.possession === r.possession, got: s.possession });
  } else if (p.type === 'house') {
    if (r.bhk) { const want = parseInt(r.bhk, 10); out.push({ l: r.bhk, ok: (s.bedrooms || 0) >= want, got: (s.bedrooms || '—') + ' bed' }); }
    if (r.landArea) out.push({ l: `Land ≥ ${num(r.landArea)} sq.ft.`, ok: (s.landArea || 0) >= r.landArea, got: num(s.landArea) + ' sq.ft.' });
    if (r.parking === 'Required') out.push({ l: 'Parking', ok: s.parking && s.parking !== 'None', got: s.parking });
    if (r.possession === 'Ready to move') out.push({ l: 'Ready to move', ok: s.approvalDocs === 'Approval + completion available', got: s.approvalDocs });
  } else if (p.type === 'commercial') {
    if (r.commCategory) out.push({ l: r.commCategory, ok: s.commCategory === r.commCategory, got: s.commCategory });
    if (r.occupancy && r.occupancy !== 'Any') out.push({ l: r.occupancy, ok: s.occupancy === r.occupancy, got: s.occupancy });
  }
  return out;
}

/**
 * Score one property for one customer.
 * Step 1: hard filters (any failure → excluded).  Step 2: weighted score
 *   M = wB·B + wL·L + wS·S + wA·A + wP·P   (each component 0–100)
 * Unresolved mandatory legal checks → "Conditional", never a top recommendation.
 */
function matchScore(c, p, settings) {
  const w = settings.matchWeights, b = c.budget, r = c.req;
  const ceiling = b.max * (1 + (Number(b.flexPct) || 0) / 100);
  const filters = [
    { k: 'available', l: 'Available', ok: p.status === 'Available', why: `Status is ${p.status}` },
    { k: 'type', l: 'Type matches', ok: p.type === r.type, why: `${typeLabel(p.type)} ≠ ${typeLabel(r.type)}` },
    { k: 'location', l: 'Location acceptable', ok: (r.cities || []).includes(p.city), why: `${p.city} not in preferred cities` },
    { k: 'budget', l: 'Within permitted budget', ok: p.price <= ceiling, why: `${inrShort(p.price)} > max ${inrShort(b.max)}${b.flexPct ? ` (+${b.flexPct}% = ${inrShort(ceiling)})` : ''}` },
  ];
  const ls = legalSummary(p);
  const legalOk = ls.openMandatory.length === 0;
  filters.push({ k: 'legal', l: 'Mandatory legal checks', ok: legalOk, soft: true, why: `Unresolved: ${ls.openMandatory.join(', ')}` });

  // components
  let B;
  if (p.price <= b.pref) B = 100;
  else if (p.price <= b.max) B = 100 - 30 * (p.price - b.pref) / Math.max(1, b.max - b.pref);
  else if (p.price <= ceiling) B = 55;
  else B = 0;
  let L = 0;
  if ((r.cities || []).includes(p.city)) L = (r.localities && r.localities.length) ? (r.localities.includes(p.locality) ? 100 : 70) : 100;
  let S = 100, sizeDev = 0;
  if (r.size) { sizeDev = Math.abs(p.area - r.size) / r.size; S = clamp(Math.round(100 - sizeDev * 200)); }
  const infra = infraScore(p);
  let A = infra;
  if (r.amenities && r.amenities.length) {
    const have = r.amenities.filter(a => (p.amenities || []).includes(a)).length;
    A = 0.5 * infra + 0.5 * (have / r.amenities.length) * 100;
  }
  const prefs = prefChecks(c, p);
  const P = prefs.length ? (prefs.filter(x => x.ok).length / prefs.length) * 100 : 100;
  const comps = { B: Math.round(B), L: Math.round(L), S: Math.round(S), A: Math.round(A), P: Math.round(P) };
  const M = Math.round(w.B * B + w.L * L + w.S * S + w.A * A + w.P * P);

  const hardFail = filters.filter(f => !f.soft && !f.ok);
  let label, tone;
  if (hardFail.length) {
    const onlyBudget = hardFail.length === 1 && hardFail[0].k === 'budget';
    label = onlyBudget ? 'Budget mismatch' : 'Excluded'; tone = 'red';
  } else if (!legalOk || S < 60) { label = 'Conditional match'; tone = 'amber'; }
  else if (M >= 80) { label = 'Strong match'; tone = 'green'; }
  else if (M >= 65) { label = 'Good match'; tone = 'blue'; }
  else { label = 'Weak match'; tone = 'grey'; }

  // plain-language explanation
  const why = [];
  if (!hardFail.length) {
    why.push(p.price <= b.pref ? `Price ${inrShort(p.price)} is within preferred budget` : p.price <= b.max ? `Price ${inrShort(p.price)} is within maximum budget (above preferred ${inrShort(b.pref)})` : `Price ${inrShort(p.price)} uses the ${b.flexPct}% budget flexibility`);
    if (r.size) why.push(sizeDev === 0 ? `Exact size match (${num(p.area)} sq.ft.)` : `Size ${num(p.area)} sq.ft. vs wanted ${num(r.size)} (${p.area > r.size ? '+' : '−'}${Math.round(sizeDev * 100)}%)`);
    if (r.localities && r.localities.length) why.push(r.localities.includes(p.locality) ? `${p.locality} is a preferred locality` : `${p.locality} — city matches, locality not in preferred list`);
    prefs.forEach(x => why.push(`${x.ok ? '✓' : '✗'} ${x.l}${x.ok ? '' : ` (has: ${x.got || '—'})`}`));
    if (!legalOk) why.push(`⚠ Mandatory checks unresolved: ${ls.openMandatory.join(', ')} — resolve before recommending`);
    if (r.approvalRequired && legalOk) why.push('✓ Required approvals verified by legal professional');
  } else {
    hardFail.forEach(f => why.push(f.why));
  }
  return { prop: p, filters, comps, M, label, tone, legalOk, excluded: hardFail.length > 0, why, ceiling };
}

/** Ranked matches for a customer: eligible first (clean legal before conditional), then excluded. */
function matchesForCustomer(c, db) {
  const all = db.properties.filter(p => !p.archived).map(p => matchScore(c, p, db.settings)); // archived properties never match
  const eligible = all.filter(m => !m.excluded).sort((a, b) => (a.label === 'Conditional match') - (b.label === 'Conditional match') || b.M - a.M);
  const excluded = all.filter(m => m.excluded).sort((a, b) => b.M - a.M);
  const top = eligible.find(m => m.label !== 'Conditional match');
  return { eligible, excluded, top, all };
}

function matchesForProperty(p, db) {
  if (p.archived) return [];
  return db.customers.filter(c => c.stage !== LOST_STAGE && c.stage !== 'Booking / Closed')
    .map(c => ({ cust: c, m: matchScore(c, p, db.settings) }))
    .filter(x => !x.m.excluded)
    .sort((a, b) => b.m.M - a.m.M);
}

/* ---------- purchase readiness (transparent 100-point model, BANT + funding + engagement) ---------- */
const TIMELINE_FACTOR = { 'Within 1 month': 1, '1–3 months': 0.8, '3–6 months': 0.5, '6–12 months': 0.25, 'Not decided': 0 };
const FUNDING_FACTOR = { Ready: 1, Arranging: 0.55, 'Not decided': 0 };
const AUTHORITY_FACTOR = { 'Sole decision-maker': 1, 'Joint — family / partners involved': 0.7, 'Needs approval from others': 0.4, 'Not known yet': 0 };
const NEED_FACTOR = { 'Clear and specific': 1, 'Partly defined': 0.5, 'Just exploring': 0.2 };

function readiness(c, db) {
  const pts = db.settings.readinessPoints;
  const mm = matchesForCustomer(c, db);
  const withinMax = mm.eligible.some(m => m.prop.price <= c.budget.max);
  const withinFlex = mm.eligible.length > 0;
  const budgetF = withinMax ? 1 : withinFlex ? 0.5 : 0;
  const e = c.engagement || {};
  const engF = (e.responded ? 0.3 : 0) + (e.docsRequested ? 0.3 : 0) + (e.siteVisited ? 0.4 : 0);
  const rows = [
    { k: 'budget', l: 'Budget fits property', max: pts.budget, f: budgetF, note: withinMax ? 'At least one eligible property within maximum budget' : withinFlex ? 'Fits only with budget flexibility' : 'No available property fits the budget' },
    { k: 'requirement', l: 'Clear purchase requirement', max: pts.requirement, f: NEED_FACTOR[c.bant.need] ?? 0, note: c.bant.need },
    { k: 'timeline', l: 'Purchase timeline', max: pts.timeline, f: TIMELINE_FACTOR[c.bant.timeline] ?? 0, note: c.bant.timeline },
    { k: 'funding', l: 'Funding readiness', max: pts.funding, f: FUNDING_FACTOR[c.budget.fundingReady] ?? 0, note: `${c.budget.fundingReady} (${c.budget.funding})` },
    { k: 'authority', l: 'Decision-making authority', max: pts.authority, f: AUTHORITY_FACTOR[c.bant.authority] ?? 0, note: c.bant.authority },
    { k: 'engagement', l: 'Engagement and follow-up', max: pts.engagement, f: engF, note: [e.responded && 'responded', e.docsRequested && 'requested documents', e.siteVisited && 'attended site visit'].filter(Boolean).join(', ') || 'no engagement yet' },
  ];
  rows.forEach(r => r.score = Math.round(r.max * r.f));
  const total = rows.reduce((a, r) => a + r.score, 0);
  const maxTotal = rows.reduce((a, r) => a + Number(r.max), 0);
  return { rows, total, maxTotal, band: readinessBand(total, db.settings) };
}

function readinessBand(score, settings) {
  const b = settings.bands;
  if (score >= b.high) return { l: 'High-priority lead', tone: 'green' };
  if (score >= b.qualified) return { l: 'Qualified lead', tone: 'blue' };
  if (score >= b.developing) return { l: 'Developing lead', tone: 'amber' };
  return { l: 'Early-stage enquiry', tone: 'grey' };
}

/* ---------- customer classification (suggestion; sales manager may override) ---------- */
function suggestedClassification(c, db) {
  if (c.hni && c.hni.status === 'Verified') return 'Verified HNI';
  if (c.hni && c.hni.potentialFlag) return 'Potential HNI';
  if (c.budget.max >= db.settings.highValueThreshold) return 'High-value prospect';
  if (['Investment', 'Rental income'].includes(c.purpose)) return 'Investor';
  const mm = matchesForCustomer(c, db);
  if (c.bant.need === 'Clear and specific' && mm.eligible.length > 0) return 'Qualified buyer';
  return 'General lead';
}
const classificationOf = (c, db) => c.classification || suggestedClassification(c, db);

/* ---------- misc ---------- */
const execName = (db, id) => (db.settings.executives.find(e => e.id === id) || {}).name || '— Unassigned —';
const stageIndex = s => s === LOST_STAGE ? -1 : STAGES.indexOf(s);
function nextExecutive(db) {
  // least-loaded active-lead executive (simple auto-assignment rule)
  const load = {};
  db.settings.executives.forEach(e => load[e.id] = 0);
  db.customers.forEach(c => { if (c.stage !== LOST_STAGE && c.stage !== 'Booking / Closed' && load[c.owner] != null) load[c.owner]++; });
  return Object.entries(load).sort((a, b) => a[1] - b[1])[0][0];
}
