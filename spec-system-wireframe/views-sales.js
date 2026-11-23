/* =====================================================================
   Module D (matching), Module E (CRM dashboard, pipeline, reports), HNI register
   ===================================================================== */

function barRows(items, max, tone = '') {
  max = max || Math.max(1, ...items.map(i => i.v));
  return items.map(i => `<div class="bar-row"><span>${i.href ? `<a href="${i.href}">${esc(i.l)}</a>` : esc(i.l)}</span>${meter(i.v / max * 100, i.tone || tone)}<span class="num"><b>${i.v}</b></span></div>`).join('');
}

/* ---------- dashboard ---------- */
function viewDashboard() {
  const cs = DB.customers, S = DB.settings;
  const reached = i => cs.filter(c => (c.stage === LOST_STAGE ? stageIndex(c.lostAtStage || 'New enquiry') : stageIndex(c.stage)) >= i).length;
  const total = cs.length, qualified = reached(2);
  const visits = cs.reduce((a, c) => a + (c.siteVisits || []).length, 0);
  const bookings = cs.filter(c => c.stage === 'Booking / Closed').length;
  const due = cs.filter(c => isOverdue(c) || isDueToday(c)).sort((a, b) => a.nextFollowUp.localeCompare(b.nextFollowUp));
  const stuck = cs.filter(c => isActive(c) && daysBetween(c.stageSince, DEMO_TODAY) > S.stuckDays);
  const prio = cs.filter(isActive).map(c => ({ c, rd: readiness(c, DB), mm: matchesForCustomer(c, DB) })).sort((a, b) => b.rd.total - a.rd.total).slice(0, 8);
  const stageItems = [...STAGES, LOST_STAGE].map(s => ({ l: s, v: cs.filter(c => c.stage === s).length, tone: s === LOST_STAGE ? 'red' : s === 'Booking / Closed' ? 'green' : '' }));
  const bandCounts = {}; cs.filter(isActive).forEach(c => { const b = readiness(c, DB).band; bandCounts[b.l] = bandCounts[b.l] || { v: 0, tone: b.tone }; bandCounts[b.l].v++; });
  const openLegal = DB.properties.filter(p => p.status === 'Available' && !p.archived && legalSummary(p).openApprovals.length);
  return {
    title: 'Sales dashboard', crumbs: 'Overview / <b>Sales dashboard</b>',
    html: `
    <div class="page-head"><div><h1>Real estate CRM — sales dashboard</h1><p>Not only how many leads you have, but where they are getting stuck and what to do next.</p></div><span class="sp"></span>
      <a class="btn" href="#/pipeline">Open pipeline</a><a class="btn primary" href="#/customers/new">＋ New customer</a></div>
    <div class="grid g4">
      <a class="card kpi" href="#/customers"><div class="lbl">Total leads</div><div class="val">${total}</div><div class="sub">${cs.filter(isActive).length} active · ${cs.filter(c => c.stage === LOST_STAGE).length} lost</div></a>
      <a class="card kpi" href="#/customers"><div class="lbl">Qualified leads</div><div class="val">${qualified}</div><div class="sub">reached “Qualified” or beyond</div></a>
      <a class="card kpi" href="#/pipeline"><div class="lbl">Site visits</div><div class="val">${visits}</div><div class="sub">${cs.reduce((a, c) => a + (c.siteVisits || []).filter(v => v.status === 'Scheduled').length, 0)} upcoming</div></a>
      <a class="card kpi" href="#/pipeline"><div class="lbl">Bookings</div><div class="val">${bookings}</div><div class="sub">${total ? (bookings / total * 100).toFixed(1) : 0}% of leads</div></a>
    </div>
    <div class="grid g2" style="margin-top:14px">
      <div class="card"><div class="card-head"><h2>Lead pipeline</h2><span class="sp"></span><a href="#/pipeline">Board →</a></div>${barRows(stageItems)}
        ${stuck.length ? `<div class="note amber" style="margin-top:10px">${stuck.length} lead(s) stuck more than ${S.stuckDays} days in the same stage: ${stuck.map(c => `<a href="#/customers/${c.id}">${esc(c.name)}</a> <small>(${c.stage}, ${daysBetween(c.stageSince, DEMO_TODAY)}d)</small>`).join(', ')}</div>` : ''}</div>
      <div class="card"><div class="card-head"><h2>Follow-ups due</h2><span class="sp"></span>${chip(due.length + ' due', due.length ? 'amber' : 'green')}</div>
        ${due.length ? `<div class="tbl-wrap"><table><tbody>${due.map(c => `<tr class="click" data-href="#/customers/${c.id}/followups"><td><b>${esc(c.name)}</b><br><small>${c.stage}</small></td><td><small>${esc(execName(DB, c.owner).split('—')[1] || '')}</small></td><td>${followUpCell(c)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Nothing due today. 🎉</p>'}
      </div>
    </div>
    ${todayApptsCard()}
    <div class="card" style="margin-top:14px"><div class="card-head"><h2>Priority leads — next actions</h2><span class="sp"></span><small>Sorted by purchase readiness</small></div>
      <div class="tbl-wrap"><table><thead><tr><th>Customer</th><th>Readiness</th><th>Best property fit</th><th>Stage</th><th>Owner</th><th>Next follow-up</th></tr></thead><tbody>
      ${prio.map(({ c, rd, mm }) => { const t = mm.top || mm.eligible[0]; return `<tr class="click" data-href="#/customers/${c.id}"><td><b>${esc(c.name)}</b><br><small>${esc(reqSummary(c))}</small></td><td><b>${rd.total}</b> ${chip(rd.band.l, rd.band.tone)}</td><td>${t ? `${chip(t.label, t.tone)} <small>${t.prop.id} · ${t.M}</small>` : '<small class="muted">No eligible property</small>'}</td><td>${chip(c.stage, stageTone(c.stage))}</td><td><small>${esc(execName(DB, c.owner).split('—')[1] || '')}</small></td><td>${followUpCell(c)}</td></tr>`; }).join('')}
      </tbody></table></div></div>
    <div class="grid g3" style="margin-top:14px">
      <div class="card"><h2>Readiness mix (active leads)</h2>${barRows(['High-priority lead', 'Qualified lead', 'Developing lead', 'Early-stage enquiry'].map(l => ({ l, v: (bandCounts[l] || {}).v || 0, tone: (bandCounts[l] || {}).tone })))}</div>
      <div class="card"><h2>Inventory</h2>${barRows(PROPERTY_STATUSES.map(s => ({ l: s, v: DB.properties.filter(p => p.status === s && !p.archived).length, tone: STATUS_TONE[s] === 'grey' ? 'grey' : STATUS_TONE[s], href: '#/properties' })))}</div>
      <div class="card"><h2>Approval documents pending</h2>${openLegal.length ? `<ul class="why">${openLegal.map(p => `<li><a href="#/properties/${p.id}/legal">${p.id}</a> ${esc(p.title)} <br><small>${legalSummary(p).openApprovals.join(', ')} — document pending</small></li>`).join('')}</ul>` : '<p class="muted">Every approval badge on an available listing has its document.</p>'}</div>
    </div>
    <p class="muted" style="margin-top:12px">Fictional dashboard data for design purposes.</p>`,
  };
}

/* ---------- pipeline ---------- */
/* Each stage has its own colour — the funnel, the column and the cards share it. */
const STAGE_COLOR = { 'New enquiry': '#64748b', Contacted: '#2f5bea', Qualified: '#6a3fc4', 'Property recommended': '#0e8a8a', 'Site visit scheduled': '#c27a0e', Negotiation: '#d9622b', 'Booking / Closed': '#11743f' };
const stageColor = s => STAGE_COLOR[s] || '#b42318';
const TONE_COLOR = { green: 'var(--green)', amber: '#d08a12', red: 'var(--red)', blue: 'var(--blue)', purple: 'var(--purple)', grey: '#8a93a3' };
function viewPipeline() {
  const f = UI.filters.pipe, S = DB.settings;
  const list = DB.customers.filter(c => !f.owner || c.owner === f.owner);
  const active = list.filter(isActive), money = cs => cs.reduce((t, c) => t + (c.budget.max || 0), 0);
  const stuckN = active.filter(c => daysBetween(c.stageSince, DEMO_TODAY) > S.stuckDays).length;
  const closed = list.filter(c => c.stage === 'Booking / Closed'), lost = list.filter(c => c.stage === LOST_STAGE);
  const visits = list.reduce((n, c) => n + (c.siteVisits || []).filter(v => v.status === 'Scheduled' && v.date >= DEMO_TODAY && daysBetween(DEMO_TODAY, v.date) <= 7).length, 0);
  // the headline numbers
  const kpi = (ic, tone, n, l, sub) => `<div class="pk"><span class="pk-ic" style="--c:${tone}">${ic}</span><div><b>${n}</b><span>${l}</span>${sub ? `<small>${sub}</small>` : ''}</div></div>`;
  const kpis = `<div class="pk-row">
      ${kpi('👥', '#2f5bea', active.length, 'Active leads', `${list.filter(c => c.stage === 'New enquiry').length} new enquiries`)}
      ${kpi('₹', '#0e8a8a', inrShort(money(active)), 'Pipeline value', 'sum of maximum budgets')}
      ${kpi('📅', '#c27a0e', visits, 'Site visits this week', 'scheduled')}
      ${kpi('⚠', '#d9622b', stuckN, 'Stuck leads', `more than ${S.stuckDays} days in a stage`)}
      ${kpi('🏁', '#11743f', closed.length, 'Closed', `${inrShort(money(closed))} · ${lost.length} lost`)}</div>`;
  // the funnel: how many leads are at each stage, and how many reached the next one
  const live = list.filter(c => c.stage !== LOST_STAGE), reached = i => live.filter(c => stageIndex(c.stage) >= i).length;
  const maxN = Math.max(1, ...STAGES.map(s => live.filter(c => c.stage === s).length));
  const funnel = `<div class="card pf"><div class="pf-head"><h2>Sales funnel</h2><small class="muted">Bar = leads at the stage now · arrow = share of leads that got at least that far</small></div>
    <div class="pf-row">${STAGES.map((s, i) => {
      const at = live.filter(c => c.stage === s), conv = i && reached(i - 1) ? Math.round(reached(i) / reached(i - 1) * 100) : null;
      return `${i ? `<span class="pf-arrow" title="${reached(i)} of ${reached(i - 1)} leads reached ${esc(s)}">›<small>${conv}%</small></span>` : ''}
        <button class="pf-step ${UI.pipeFocus === s ? 'on' : ''}" style="--c:${stageColor(s)}" data-act="pipeFocus" data-k="${esc(s)}" title="Show only this stage">
          <span class="pf-bar"><i style="height:${Math.max(8, at.length / maxN * 100)}%"></i></span><b>${at.length}</b><span class="pf-l">${esc(s)}</span><small>${at.length ? inrShort(money(at)) : '—'}</small></button>`;
    }).join('')}</div></div>`;
  const shownStages = UI.pipeFocus ? [UI.pipeFocus] : [...STAGES, LOST_STAGE];
  const cols = shownStages.map(stage => {
    const cards = list.filter(c => c.stage === stage).map(c => {
      const rd = readiness(c, DB), days = daysBetween(c.stageSince, DEMO_TODAY), stuck = isActive(c) && days > S.stuckDays;
      const pct = Math.round(rd.total / (rd.maxTotal || 100) * 100);
      return `<div class="kcard ${stuck ? 'stuck' : ''}" draggable="true" data-drag="${c.id}" data-href="#/customers/${c.id}" style="--c:${stageColor(stage)}">
        <div class="row"><span class="k-av" style="--t:${TONE_COLOR[rd.band.tone] || '#8a93a3'}">${esc(initials(c.name))}</span><span class="nm">${esc(c.name)}</span><span class="sp"></span><span class="k-purp" title="${esc(c.purpose || '')}">${typeof PURPOSE_ICON !== 'undefined' && c.purpose ? PURPOSE_ICON[c.purpose] || '' : ''}</span></div>
        <div class="k-ready" title="Purchase readiness ${rd.total} — ${esc(rd.band.l)}"><span><i style="width:${pct}%;background:${TONE_COLOR[rd.band.tone] || '#8a93a3'}"></i></span><small>${rd.total} · ${esc(rd.band.l)}</small></div>
        <div class="ln">${esc(reqSummary(c))}</div>
        <div class="ln">${inrShort(c.budget.max)} max · ${esc((execName(DB, c.owner).split('—')[1] || '').trim())}</div>
        ${(() => { // what this buyer has been offered, and the next site visit
          const recs = (c.recommended || []).filter(id => getProp(id));
          const sv = (c.siteVisits || []).filter(v => v.status === 'Scheduled' && v.date >= DEMO_TODAY).sort((a, b) => (a.date > b.date ? 1 : -1))[0];
          return (recs.length ? `<div class="ln k-recs" title="Recommended properties">🏠 <b>${recs.length} recommended:</b> ${recs.slice(0, 3).map(id => `<a href="#/properties/${id}">${id}</a>`).join(', ')}${recs.length > 3 ? ` +${recs.length - 3}` : ''}</div>` : '')
            + (sv ? `<div class="ln k-visit">📅 visit ${fmtDate(sv.date)} · <a href="#/properties/${sv.prop}">${sv.prop}</a></div>` : '');
        })()}
        <div class="ln row">${stage === LOST_STAGE ? chip(c.lostReason, 'red') : followUpCell(c)}<span class="sp"></span><span title="Days in this stage">${stuck ? '⚠ ' : ''}${days}d</span></div>
      </div>`;
    }).join('');
    const inStage = list.filter(c => c.stage === stage), n = inStage.length;
    return `<div class="col ${stage === LOST_STAGE ? 'lost' : ''}" data-drop="${stage}" style="--c:${stageColor(stage)}"><div class="col-head"><span class="col-dot"></span>${stage}<span class="chip">${n}</span></div>
      <div class="col-sum">${n ? inrShort(money(inStage)) + ' in budgets' : 'No leads'}</div>${cards || '<div class="col-empty">Drop a lead here</div>'}</div>`;
  }).join('');
  return {
    title: 'Lead pipeline', crumbs: 'Sales &amp; qualification / <b>Lead pipeline</b>',
    html: `
    <div class="page-head"><div><h1>Lead pipeline</h1><p>Drag a card to move a lead to the next stage. Moving to <b>Lost</b> asks for a reason. ⚠ marks leads stuck more than ${S.stuckDays} days.</p></div><span class="sp"></span>
      <select data-chg="filter" data-scope="pipe" data-key="owner" style="width:auto">${options(DB.settings.executives.map(e => ({ v: e.id, l: e.name })), f.owner, 'All executives')}</select></div>
    ${kpis}${funnel}
    ${UI.pipeFocus ? `<div class="pf-focus">Showing <b>${esc(UI.pipeFocus)}</b> only <button class="linkbtn" data-act="pipeFocus" data-k="">Show all stages</button></div>` : ''}
    <div class="board ${UI.pipeFocus ? 'one' : ''}">${cols}</div>`,
  };
}
Object.assign(ACTIONS, { pipeFocus: d => { UI.pipeFocus = d.k && UI.pipeFocus !== d.k ? d.k : ''; render(); } });

/* ---------- matching engine ---------- */
function viewMatching(cid) {
  const active = DB.customers.filter(c => c.stage !== LOST_STAGE);
  const c = getCust(cid) || getCust('CUST-1001') || active[0];
  if (!c) return { title: 'Matching engine', html: '<div class="card empty">No customers yet.</div>' };
  const mm = matchesForCustomer(c, DB), w = DB.settings.matchWeights, b = c.budget;
  const mark = (f) => f.ok ? '<span style="color:var(--green)">✓</span>' : f.soft ? '<span style="color:var(--amber)" title="' + esc(f.why) + '">⚠</span>' : `<span style="color:var(--red)" title="${esc(f.why)}">✗</span>`;
  const filterRows = mm.all.slice().sort((x, y) => x.excluded - y.excluded || y.M - x.M).map(m => `<tr>
    <td><a href="#/properties/${m.prop.id}">${m.prop.id}</a><br><small>${esc(m.prop.title)}</small></td>
    <td><small>${typeLabel(m.prop.type)}<br>${esc(m.prop.city)} · ${inrShort(m.prop.price)}</small></td>
    ${m.filters.map(f => `<td class="filter-cell">${mark(f)}</td>`).join('')}
    <td>${chip(m.label, m.tone)}</td></tr>`).join('');
  const rankRows = mm.eligible.map((m, i) => `<tr ${mm.top && m.prop.id === mm.top.prop.id ? 'style="background:var(--green-soft)"' : ''}>
    <td class="num">${i + 1}</td><td><a href="#/properties/${m.prop.id}">${m.prop.id}</a> <small>${esc(m.prop.title)}</small>${mm.top && m.prop.id === mm.top.prop.id ? ' ' + chip('★ Top', 'green') : ''}</td>
    ${['B', 'L', 'S', 'A', 'P'].map(k => `<td class="num">${m.comps[k]}</td>`).join('')}<td class="num"><b>${m.M}</b></td><td>${chip(m.label, m.tone)}</td></tr>
    <tr><td></td><td colspan="8"><small>${m.why.map(esc).join(' · ')}</small></td></tr>`).join('');
  return {
    title: 'Matching engine', crumbs: 'Sales &amp; qualification / <b>Matching engine</b>',
    html: `
    <div class="page-head"><div><h1>Property matching engine</h1><p>Hard filters first, then rank the remaining properties with a transparent weighted score — with an explanation for every recommendation.</p></div><span class="sp"></span>
      <label class="row" style="gap:6px">Customer <select data-chg="matchCust" style="width:auto">${options(active.map(x => ({ v: x.id, l: `${x.id} · ${x.name}` })), c.id)}</select></label></div>
    <div class="grid g3">
      <div class="card"><h2>Customer profile</h2><dl class="kv" style="grid-template-columns:110px 1fr">
        <dt>Customer</dt><dd><a href="#/customers/${c.id}">${esc(c.name)}</a></dd><dt>Purpose</dt><dd>${c.purpose}${c.purposeNote ? ' — ' + esc(c.purposeNote) : ''}</dd>
        <dt>Looking for</dt><dd>${esc(reqSummary(c))}</dd><dt>Budget</dt><dd>${inrShort(b.min)} – ${inrShort(b.max)}${b.flexPct ? ` (+${b.flexPct}% → ${inrShort(b.max * (1 + b.flexPct / 100))})` : ''}</dd>
        <dt>Timeline</dt><dd>${c.bant.timeline}</dd><dt>Approval</dt><dd>${c.req.approvalRequired ? 'Wants applicable approvals verified' : 'Not mandatory'}</dd></dl></div>
      <div class="card"><h2>Weighted formula</h2><div class="formula">M = ${w.B}B + ${w.L}L + ${w.S}S + ${w.A}A + ${w.P}P</div>
        <p class="muted" style="margin:8px 0 0">B budget match · L location match · S size match · A amenities/infrastructure · P preference match — each scored out of 100. Starting assumptions: tune with site-visit and sales results in <a href="#/settings">Settings</a>.</p></div>
      <div class="card"><h2>Result</h2>
        <div class="row">${chip(mm.eligible.filter(m => m.label !== 'Conditional match').length + ' eligible', 'green')}${chip(mm.eligible.filter(m => m.label === 'Conditional match').length + ' conditional', 'amber')}${chip(mm.excluded.length + ' excluded', 'red')}</div>
        <p style="margin:10px 0 0">${mm.top ? `Best initial recommendation: <a href="#/properties/${mm.top.prop.id}"><b>${mm.top.prop.id}</b></a> — ${esc(mm.top.prop.title)} (${mm.top.M}).` : 'No unconditional recommendation available.'}</p>
        <p class="muted" style="margin:6px 0 0">Critical rule: a property with an approval badge whose document is pending never becomes the top recommendation, even with a high score.</p></div>
    </div>
    <div class="card" style="margin-top:14px"><h2>Step 1 — Hard filters (all ${mm.all.length} active properties)</h2>
      <div class="tbl-wrap"><table><thead><tr><th>Property</th><th>Type · city · price</th><th>Available</th><th>Type</th><th>Location</th><th>Budget</th><th>Approval documents</th><th>Result</th></tr></thead><tbody>${filterRows}</tbody></table></div>
      <p class="muted" style="margin:8px 0 0">✗ excludes the property · ⚠ keeps it only as a Conditional match until resolved. Hover a mark for the reason.</p></div>
    <div class="card"><h2>Step 2 — Ranking of properties that passed</h2>
      ${mm.eligible.length ? `<div class="tbl-wrap"><table><thead><tr><th class="num">#</th><th>Property</th><th class="num">B</th><th class="num">L</th><th class="num">S</th><th class="num">A</th><th class="num">P</th><th class="num">M</th><th>Label</th></tr></thead><tbody>${rankRows}</tbody></table></div>` : '<p class="muted">Nothing passed the hard filters.</p>'}
      <div class="row" style="margin-top:12px"><a class="btn primary" href="#/customers/${c.id}/matches">Recommend from customer page →</a></div></div>`,
  };
}
Object.assign(CHANGES, { matchCust: el => go('#/matching?c=' + el.value) });

/* ---------- HNI register ---------- */
function viewHNI() {
  if (!canSeeHNI()) return { title: 'HNI qualification', crumbs: 'Sales &amp; qualification / <b>HNI qualification</b>', html: restrictedHtml() };
  const f = UI.filters.hni;
  const rows = DB.customers.map(c => ({ c, cls: classificationOf(c, DB), n: HNI_SIGNALS.filter(s => (c.hni.signals || {})[s.k]).length }))
    .filter(x => !f.flagged || ['High-value prospect', 'Potential HNI', 'Verified HNI', 'Investor'].includes(x.cls) || x.c.hni.status !== 'Not determined')
    .sort((a, b) => b.c.budget.max - a.c.budget.max);
  const statusCounts = HNI_STATUSES.map(s => ({ l: s, v: DB.customers.filter(c => c.hni.status === s).length, tone: s === 'Verified' ? 'green' : s.startsWith('Potential') ? '' : 'grey' }));
  return {
    title: 'HNI qualification', crumbs: 'Sales &amp; qualification / <b>HNI qualification</b> 🔒',
    html: `
    <div class="page-head"><div><h1>HNI &amp; high-value customer qualification</h1><p>A separate, restricted assessment — never mixed with ordinary lead scoring.</p></div><span class="sp"></span>
      <label class="check"><input type="checkbox" data-chg="filter" data-scope="hni" data-key="flagged" ${f.flagged ? 'checked' : ''}> Only investors, high-value &amp; HNI-flagged</label></div>
    <div class="grid g-side">
      <div class="tbl-wrap"><table><thead><tr><th>Customer</th><th class="num">Max budget</th><th>Purpose</th><th>Classification</th><th>HNI status</th><th>Signals</th><th>Consent</th><th>Reviewed</th></tr></thead><tbody>
        ${rows.map(({ c, cls, n }) => `<tr class="click" data-href="#/customers/${c.id}/hni"><td><b>${esc(c.name)}</b><br><small class="mono">${c.id}</small></td><td class="num">${inrShort(c.budget.max)}</td><td>${c.purpose}</td>
          <td>${chip(cls, ['Potential HNI', 'Verified HNI'].includes(cls) ? 'purple' : cls === 'High-value prospect' ? 'blue' : 'outline')}</td><td><small>${esc(c.hni.status)}</small></td><td>${n}/${HNI_SIGNALS.length}</td>
          <td>${c.hni.consent ? chip('Yes', 'green') : chip('No')}</td><td><small>${c.hni.reviewedDate ? fmtDate(c.hni.reviewedDate) : '—'}</small></td></tr>`).join('')}
      </tbody></table></div>
      <div>
        <div class="card"><h2>Status overview</h2>${barRows(statusCounts)}</div>
        <div class="card"><h2>Rules</h2><ul class="why">
          <li>A <b>potential</b> HNI is not a confirmed HNI.</li>
          <li>High budget ≠ HNI. See <a href="#/customers/CUST-1015/hni">CUST-1015</a>: ₹5–7 Cr stated, no funding plan.</li>
          <li>No bank statements, tax returns or balances during lead generation.</li>
          <li>Verification only through a lawful, consent-based process with restricted access.</li>
          <li>Never use name, appearance, occupation, caste, religion or personal characteristics.</li></ul></div>
      </div>
    </div>`,
  };
}

/* ---------- reports ---------- */
function viewReports() {
  const cs = DB.customers, S = DB.settings;
  const reachedIdx = c => c.stage === LOST_STAGE ? stageIndex(c.lostAtStage || 'New enquiry') : stageIndex(c.stage);
  const funnel = STAGES.map((s, i) => ({ s, n: cs.filter(c => reachedIdx(c) >= i).length }));
  const group = (fn, keys) => { const m = {}; cs.forEach(c => { const k = fn(c); m[k] = (m[k] || 0) + 1; }); return (keys || Object.keys(m)).map(k => ({ l: k, v: m[k] || 0 })).filter(x => x.v || keys); };
  const stuckByStage = STAGES.slice(0, -1).map(s => { const inS = cs.filter(c => c.stage === s); const avg = inS.length ? Math.round(inS.reduce((a, c) => a + daysBetween(c.stageSince, DEMO_TODAY), 0) / inS.length) : 0; return { s, n: inS.length, avg, stuck: inS.filter(c => daysBetween(c.stageSince, DEMO_TODAY) > S.stuckDays).length }; });
  const execRows = S.executives.map(e => {
    const mine = cs.filter(c => c.owner === e.id);
    return `<tr><td>${esc(e.name)}</td><td class="num">${mine.filter(isActive).length}</td><td class="num">${mine.filter(c => reachedIdx(c) >= 2).length}</td><td class="num">${mine.reduce((a, c) => a + (c.siteVisits || []).length, 0)}</td><td class="num">${mine.filter(c => c.stage === 'Booking / Closed').length}</td><td class="num">${mine.filter(c => c.stage === LOST_STAGE).length}</td><td class="num">${mine.filter(isOverdue).length ? chip(mine.filter(isOverdue).length, 'red') : 0}</td></tr>`;
  }).join('');
  return {
    title: 'Reports', crumbs: 'Sales &amp; qualification / <b>Reports</b>',
    html: `
    <div class="page-head"><div><h1>Reports</h1><p>Where leads come from, how far they get, and where they get stuck.</p></div></div>
    <div class="grid g2">
      <div class="card"><h2>Conversion funnel</h2>
        ${funnel.map((f, i) => `<div class="bar-row"><span>${f.s}</span>${meter(f.n / Math.max(1, funnel[0].n) * 100, i === funnel.length - 1 ? 'green' : '')}<span class="num"><b>${f.n}</b></span></div>`).join('')}
        <p class="muted" style="margin:8px 0 0">Leads that reached each stage (lost leads counted up to the stage where they were lost). Enquiry → booking: <b>${(funnel[6].n / Math.max(1, funnel[0].n) * 100).toFixed(1)}%</b>.</p></div>
      <div class="card"><h2>Where leads are stuck</h2>
        <div class="tbl-wrap"><table><thead><tr><th>Stage</th><th class="num">Leads now</th><th class="num">Avg days in stage</th><th class="num">Over ${S.stuckDays} days</th></tr></thead><tbody>
        ${stuckByStage.map(r => `<tr><td>${r.s}</td><td class="num">${r.n}</td><td class="num">${r.avg}</td><td class="num">${r.stuck ? chip(r.stuck, 'amber') : 0}</td></tr>`).join('')}</tbody></table></div></div>
    </div>
    <div class="grid g3" style="margin-top:14px">
      <div class="card"><h2>Leads by source</h2>${barRows(group(c => c.source))}</div>
      <div class="card"><h2>Leads by purchase purpose</h2>${barRows(group(c => c.purpose))}</div>
      <div class="card"><h2>Reasons lost</h2>${cs.some(c => c.stage === LOST_STAGE) ? barRows(group(c => c.stage === LOST_STAGE ? c.lostReason : null).filter(x => x.l !== 'null'), 0, 'red') : '<p class="muted">No lost leads.</p>'}</div>
      <div class="card"><h2>Requirement by property type</h2>${barRows(group(c => typeLabel(c.req.type)))}</div>
      <div class="card"><h2>Customer classification</h2>${barRows(group(c => classificationOf(c, DB), CLASSIFICATIONS.map(x => x.v)))}</div>
      <div class="card"><h2>Unmet demand</h2><p class="muted" style="margin-top:0">Active leads with no property passing the hard filters — input for sourcing new inventory.</p>
        <ul class="why">${cs.filter(isActive).filter(c => !matchesForCustomer(c, DB).eligible.length).map(c => `<li><a href="#/customers/${c.id}/matches">${esc(c.name)}</a> — ${esc(reqSummary(c))}, up to ${inrShort(c.budget.max)}</li>`).join('') || '<li>None</li>'}</ul></div>
    </div>
    <div class="card" style="margin-top:14px"><h2>Sales executive performance</h2>
      <div class="tbl-wrap"><table><thead><tr><th>Executive</th><th class="num">Active leads</th><th class="num">Qualified+</th><th class="num">Site visits</th><th class="num">Bookings</th><th class="num">Lost</th><th class="num">Overdue follow-ups</th></tr></thead><tbody>${execRows}</tbody></table></div></div>`,
  };
}
