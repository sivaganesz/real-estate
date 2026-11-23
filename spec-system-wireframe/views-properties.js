/* =====================================================================
   Module A — Property specification database
   ===================================================================== */
function legalChip(p) {
  const s = legalSummary(p);
  if (s.openApprovals.length) return chip(`${s.openApprovals.length} document${s.openApprovals.length > 1 ? 's' : ''} pending`, 'amber', 'Approval claimed without its document: ' + s.openApprovals.join(', '));
  return chip(`${s.files} document${s.files === 1 ? '' : 's'}`, s.files ? 'blue' : '', s.approvals ? 'Every approval badge has its document' : 'No approval badges');
}
/* ---------- list ---------- */
/** Completion score (same weights as the Add property page); the tooltip lists what is still missing. */
function scoreCell(p) {
  if (typeof AddProperty === 'undefined') return '';
  const s = AddProperty.listedScore(p);
  return `<div class="dl-ring" title="${esc(s.missing.length ? 'To reach 100%: ' + s.missing.join(', ') : 'Complete')}">${AddProperty.miniRing(s.score)}</div>`;
}
/** What the AI flags on a listing (the "needs attention" strip). Each: { k, group, l (this listing), fix (link), act }. */
function propAttention(p) {
  if (p.archived || p.status === 'Sold') return [];
  const out = [];
  const sc = typeof AddProperty !== 'undefined' ? AddProperty.listedScore(p) : { score: 100, missing: [] };
  if (sc.score < 80) out.push({ k: 'details', group: 'Missing details', l: 'Missing: ' + sc.missing.map(m => m.replace(/ \(.*\)$/, '').toLowerCase()).join(', '), fix: `#/properties/${p.id}/edit`, act: 'Add details' });
  const v = valuationSummary(p, DB.settings);
  if (v.count && v.position && !v.position.startsWith('Within')) {
    const up = v.diffPct > 0;
    out.push({ k: 'price', group: 'Price out of range', l: `Price ${Math.abs(Math.round(v.diffPct))}% ${up ? 'above' : 'below'} similar properties`, fix: `#/properties/${p.id}/pricing`, act: 'Review price' });
  }
  const days = Math.round((new Date(DEMO_TODAY) - new Date(p.listingDate)) / 864e5);
  const visited = DB.customers.some(c => (c.siteVisits || []).some(s => s.prop === p.id));
  if (p.status === 'Available' && days >= 45 && !visited) out.push({ k: 'stale', group: 'No site visits in 45+ days', l: `Listed ${days} days ago, no site visits yet`, fix: `#/properties/${p.id}/matches`, act: 'Offer to matching buyers' });
  const docs = legalSummary(p).openApprovals;
  if (docs.length) out.push({ k: 'docs', group: 'Approval documents pending', l: `${docs.join(', ')} — document pending`, fix: `#/properties/${p.id}/legal`, act: 'Upload' });
  return out;
}
function viewProperties() {
  const S = PropSearch.run('props'), list = S.list; // search bar + filtering: property-search.js
  const f = UI.filters.props;
  // with an attention filter on, each row says what's wrong and offers the fix
  const attnLine = p => {
    const items = propAttention(p).filter(i => !f.attn || i.k === f.attn);
    return f.attn && items.length ? items.map(i => `<div class="ps-row-attn">⚠ ${esc(i.l)} · <a href="${i.fix}">${esc(i.act)} →</a></div>`).join('') : '';
  };
  const rows = list.map(p => `
    <tr class="click" data-href="#/properties/${p.id}">
      <td class="mono" style="white-space:nowrap">${p.id}</td>
      <td><b>${esc(p.title)}</b><br><small>${typeLabel(p.type)} · ${p.purpose}</small>${p.projectId && typeof projectOf === 'function' && projectOf(p) ? ` <a class="prj-tag" href="#/projects/${p.projectId}" title="Part of a project">🏢 ${esc(projectOf(p).name)}</a>` : ''}${attnLine(p)}</td>
      <td>${esc(p.locality)}<br><small>${esc(p.city)}</small></td>
      <td class="num">${num(p.area)} <small>sq.ft.</small></td>
      <td class="num"><b>${inrShort(p.price)}</b><br><small>${inr(pricePerSqft(p))}/sq.ft.</small></td>
      <td>${chip(p.status, STATUS_TONE[p.status])}${p.archived ? ' ' + chip('Archived', 'outline') : ''}</td>
      <td><small>${fmtDate(p.listingDate)}</small></td>
      <td class="score-col">${scoreCell(p)}</td>
    </tr>`).join('');
  return {
    title: 'Properties', crumbs: 'Specification data / <b>Properties</b>',
    after: () => PropSearch.after('props'),
    html: `
    <div class="page-head"><div><h1>Property specification database</h1><p>Every property has a unique ID and a standard specification. Form fields change by property type.</p></div><span class="sp"></span>
      ${typeof AddProperty !== 'undefined' ? AddProperty.draftsButton() : ''}<a class="btn primary" href="#/properties/new">＋ Add property</a><a class="btn" href="#/import">📥 Bulk import</a></div>
    ${S.head}
    <div class="tbl-wrap ps-table"><table>
      <thead><tr><th>ID</th><th>Property</th><th>Location</th><th class="num">Area</th><th class="num">Asking price</th><th>Status</th><th>Listed</th><th class="score-col" title="Required details 60%, key details 15%, photos 10%, legal documents 10%, amenities 5% — hover a score to see what’s missing">Completion score</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="8" class="empty">No properties match these filters.${S.relax ? '<br><br>' + S.relax : ''}</td></tr>`}</tbody>
    </table></div>
    ${S.pager}`,
  };
}


/* ---------- detail ---------- */
/* five tabs: Location and Media now live on the Overview (old #/…/location and #/…/media links land there) */
const PROP_TABS = [['overview', 'Overview'], ['legal', 'Legal & documents'], ['pricing', 'Price'], ['matches', 'Matching customers'], ['history', 'History']];
function viewProperty(id, tab) {
  const p = getProp(id);
  if (!p) return { title: 'Not found', html: '<div class="card empty">Property not found. <a href="#/properties">Back to list</a></div>' };
  const ls = legalSummary(p);
  if (tab === 'location') { UI.nbFocus = true; tab = 'overview'; } // old link → the neighbourhood card
  if (['specs', 'media'].includes(tab)) tab = 'overview'; // old links
  const body = { overview: propOverview, legal: propLegal, pricing: propPricing, matches: propMatches, history: propHistory }[tab] || propOverview;
  const nMatch = matchesForProperty(p, DB).length;
  const n = p.images || 0;
  return {
    title: p.title, crumbs: `Specification data / <a href="#/properties">Properties</a> / <b>${p.id}</b>`,
    after: () => { if (UI.nbFocus) { UI.nbFocus = false; const el = document.getElementById('nb-card'); if (el) setTimeout(() => el.scrollIntoView({ block: 'start' }), 0); } },
    html: `
    <div class="ent-head">
      ${n ? `<a class="av ph-thumb" href="#/properties/${p.id}" title="${n} photo${n > 1 ? 's' : ''}">🏠<small>${n} 📷</small></a>` : `<div class="av">${p.type === 'plot' ? '▦' : p.type === 'flat' ? '🏢' : p.type === 'house' ? '🏡' : '🏬'}</div>`}
      <div class="meta"><h1>${esc(p.title)}${p.archived || !canEditSettings() ? '' : ` <a class="title-pen" href="#/properties/${p.id}/edit/field-title" title="Change the title" aria-label="Change the title">✎</a>`}</h1>
        <div class="row">${chip(p.id, 'outline mono')} ${chip(typeLabel(p.type), 'blue')} ${chip(p.purpose)} ${chip(p.status, STATUS_TONE[p.status])} ${p.approvals.map(a => a.status === 'pending'
            ? `<a class="chip amber hd-warn" href="#/properties/${p.id}/legal" title="Upload the document — until then matching shows this property only as a Conditional match">⚠ ${esc(approvalOf(a.k).long)} · document pending</a>`
            : chip((a.status === 'verified' ? '✓ ' : '') + esc(approvalOf(a.k).long), 'blue', a.status === 'verified' ? 'Document verified' : 'Document uploaded')).join(' ')}</div>
        ${p.projectId && typeof projectOf === 'function' && projectOf(p) ? `<div class="row" style="margin-top:6px"><a class="prj-tag" href="#/projects/${p.projectId}">🏢 Unit ${esc(p.unit.no)} of ${esc(projectOf(p).name)} →</a>${p.status === 'Reserved' && p.hold ? `<small class="muted">🔒 held for ${esc((getCust(p.hold.cust) || {}).name || p.hold.cust)} until ${fmtDate(p.hold.until)}</small>` : ''}</div>` : ''}
        <div class="row muted" style="margin-top:6px">📍 ${esc(p.locality)}, ${esc(p.city)} · ${num(p.area)} sq.ft.${p.facing ? ` · ${esc(p.facing)} facing` : ''} · listed ${fmtDate(p.listingDate)}</div>
      </div>
      <div class="price"><div class="p">${inr(p.price)}</div><div class="muted">${inr(pricePerSqft(p))} / sq.ft. (${PROPERTY_TYPES[p.type].areaBasis})</div>
        <div class="row hd-actions">${propHeaderActions(p)}</div></div>
    </div>
    ${p.archived ? `<div class="note" style="margin-bottom:12px">🗄 <b>Archived</b> on ${fmtDate(p.archivedDate)} by ${esc(p.archivedBy)}${p.archiveReason ? ' — ' + esc(p.archiveReason) : ''}. Hidden from the property list, matching and new bookings. Existing customer links and history are kept.</div>` : ''}
    <div class="tabs">${PROP_TABS.map(([k, l]) => `<a href="#/properties/${p.id}/${k}" class="${tab === k ? 'on' : ''}">${l}${k === 'matches' ? ` <span class="chip">${nMatch}</span>` : k === 'legal' ? (ls.openApprovals.length ? ` <span class="chip amber">${ls.openApprovals.length} pending</span>` : ls.files ? ` <span class="chip">${ls.files}</span>` : '') : ''}</a>`).join('')}</div>
    ${body(p)}`,
  };
}
/** Overview (first tab). Main: photos, the property's details (with amenities), and the neighbourhood.
    Side: one To do list and the best-matching buyers — or, once it is sold / reserved / on hold, the deal. */
function propOverview(p) {
  const t = PROPERTY_TYPES[p.type], edit = `#/properties/${p.id}/edit`, L = normLoc(p);
  const val = (f, v) => (f.t === 'number' && /₹/.test(f.l) ? inr(v) : f.t === 'number' ? num(v) : esc(v));
  const filled = t.fields.filter(f => !(p.specs[f.k] === '' || p.specs[f.k] == null));
  const empty = t.fields.filter(f => p.specs[f.k] === '' || p.specs[f.k] == null);
  const dl = rows => `<div class="dl3">${rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
  // photos
  const n = p.images || 0;
  const photos = n
    ? `<div class="ov-photos">${Array.from({ length: Math.min(n, 4) }, (_, i) => `<div class="ov-ph ${i === 0 ? 'cover' : ''}">${i === 0 ? '🏠' : '🖼'}<small>${i === 0 ? 'Cover' : 'Photo ' + (i + 1)}</small>${i === 3 && n > 4 ? `<b class="ov-more">+${n - 4}</b>` : ''}</div>`).join('')}
        <button class="ov-ph add" data-act="addImage" data-id="${p.id}">＋<small>Upload photo</small></button></div>
      <div class="ov-photo-bar"><span class="muted">${n} photo${n > 1 ? 's' : ''}${p.videos ? ` · ${p.videos} video${p.videos > 1 ? 's' : ''}` : ''}</span>${canEditSettings() ? `<button class="linkbtn danger" data-act="rmImage" data-id="${p.id}">Remove last photo</button>` : ''}</div>`
    : `<button class="ov-nophoto" data-act="addImage" data-id="${p.id}"><span>📷</span><div><b>No photos yet</b><small>Listings with photos get far more enquiries — add some (+10%)</small></div><span class="btn sm">＋ Upload photo</span></button>`;
  // details (filled only) + amenities, in one card; the empty fields become one-click chips that open the assistant on that field
  const addChips = empty.slice(0, 6).map(f => `<a class="ov-add" href="${edit}/field-${f.k}">＋ ${esc(f.l.replace(/ \(.*\)$/, ''))}</a>`).join('') + (empty.length > 6 ? `<a class="ov-add more" href="${edit}/details">+${empty.length - 6} more</a>` : '');
  const details = filled.map(f => [esc(f.l), val(f, p.specs[f.k])]).concat((p.extra || []).map(x => [esc(x.label), esc(x.value)]));
  // main property information (spec §A — common to every property)
  const main = [['Property ID', `<span class="mono">${esc(p.id)}</span>`], ['Type', `${esc(t.label)} <small class="muted">· ${esc(t.category)}</small>`], ['Purpose', esc(p.purpose)],
    ['Asking price', `${inr(p.price)}${p.priceOnRequest ? ' <small class="muted">(hidden on listing)</small>' : ''}`],
    [esc(t.areaLabel.replace(' (sq.ft.)', '')), `${num(p.area)} sq.ft. <small class="muted">· ${inr(pricePerSqft(p))}/sq.ft.</small>`],
    ['Location', `${L.address ? esc(L.address) + ', ' : ''}${esc(p.locality)}, ${esc(p.city)}${p.state ? `, ${esc(p.state)}` : ''}${L.pincode ? ' – ' + esc(L.pincode) : ''}`], ['Facing', p.facing ? esc(p.facing) : '<span class="muted">—</span>'],
    ['Status', chip(p.status, STATUS_TONE[p.status])], ['Listed on', fmtDate(p.listingDate)]];
  const detailsCard = `<div class="card"><div class="card-head"><h2>Property details</h2><span class="sp"></span>${canEditSettings() ? `<a class="btn sm" href="${edit}">✨ Edit with AI</a>` : ''}</div>
      <div class="ov-sec first"><span class="ov-lbl">Main property information</span></div>
      ${dl(main)}
      <div class="ov-sec"><span class="ov-lbl">${esc(t.label)} specifications</span><small class="muted">${filled.length} of ${t.fields.length} filled in</small></div>
      ${details.length ? dl(details) : '<p class="muted" style="margin:0">No details yet.</p>'}
      <div class="ov-amen"><span class="ov-lbl">Amenities</span>${p.amenities.length ? p.amenities.map(a => `<span class="ov-amen-chip">${esc(a)}</span>`).join('') : `<span class="muted">None added yet (+5%)</span> <a class="ov-add" href="${edit}/details">＋ Add amenities</a>`}</div>
      ${empty.length && p.status === 'Available' && canEditSettings() ? `<div class="ov-adds"><span class="ov-lbl">Add</span>${addChips}</div>` : ''}</div>`;
  // side: one "To do" list (what needs attention + what is missing), or — once the property is no longer on offer — the deal
  const live = p.status === 'Available';
  const sc = typeof AddProperty !== 'undefined' ? AddProperty.listedScore(p) : { score: 100, missing: [] };
  const fixFor = m => (/photo/i.test(m) ? [null, '📎 Add'] : /legal/i.test(m) ? [`#/properties/${p.id}/legal`, 'Open'] : /key details/i.test(m) ? [`${edit}/details`, 'Add'] : [edit, 'Add']);
  const missingRows = live ? sc.missing.map(m => {
    const [href, l] = fixFor(m), [, name, pts] = m.match(/^(.*) \((\+\d+%)\)$/) || [, m, ''];
    return `<li><span class="ic">○</span><span class="tx">${esc(name)}</span><span class="pts">${pts}</span>${href ? `<a class="btn sm" href="${href}">${l}</a>` : `<button class="btn sm" data-act="addImage" data-id="${p.id}">${l}</button>`}</li>`;
  }) : [];
  // not on offer any more → only the documents still matter (they are needed for registration)
  const attn = (typeof propAttention === 'function' ? propAttention(p) : []).filter(i => i.k !== 'details' && (live || i.k === 'docs'));
  const attnRows = attn.map(i => `<li class="warn"><span class="ic">⚠</span><span class="tx">${esc(i.l)}${i.k === 'docs' ? `<small>${live ? 'Until it is uploaded, matching shows it only as a Conditional match.' : 'Needed before registration.'}</small>` : ''}</span><a class="btn sm" href="${i.fix}">${esc(i.act)}</a></li>`);
  if (live && !nbExact(L)) missingRows.unshift(`<li class="warn"><span class="ic">📍</span><span class="tx">Set the exact location<small>The map shows ${esc(p.locality)} until then, and routes can’t be checked.</small></span><button class="btn sm" data-act="nbLocOpen" data-id="${p.id}">Set</button></li>`);
  const todoN = attnRows.length + missingRows.length;
  const todo = !todoN ? '' : `<div class="card ov-score"><div class="ov-score-top">${live && typeof AddProperty !== 'undefined' ? AddProperty.ring(sc.score, 56) : ''}<div><h2>To do</h2>
      <small class="muted">${todoN} thing${todoN > 1 ? 's' : ''}${live ? (sc.score < 100 ? ` · listing ${sc.score}% complete` : ' · listing complete') : ` · ${esc(p.status.toLowerCase())}`}</small></div></div>
      <ul class="sfacts">${attnRows.join('')}${missingRows.join('')}</ul></div>`;
  const top = live ? matchesForProperty(p, DB).slice(0, 3) : [];
  const buyers = `<div class="card"><div class="card-head"><h2>Best-matching buyers</h2><span class="sp"></span>${top.length ? `<a href="#/properties/${p.id}/matches">See all</a>` : ''}</div>
      ${top.length ? top.map(({ cust: c, m }) => `<a class="ov-buyer" href="#/customers/${c.id}/matches"><span class="ov-av">${esc(initials(c.name))}</span><span class="ov-bn"><b>${esc(c.name)}</b><small>${inrShort(c.budget.min)} – ${inrShort(c.budget.max)} · ${esc(c.stage)}</small></span>${chip(m.M + '% fit', m.tone, m.label)}</a>`).join('')
        : '<p class="muted" style="margin:0">No active buyer fits yet.</p>'}</div>`;
  return `<div class="ov">
    <div class="ov-main">
      ${photos}
      ${detailsCard}
      ${neighbourhoodCard(p)}
    </div>
    <div class="ov-side">
      ${live ? '' : dealCard(p)}
      ${live ? priceCard(p) : ''}
      ${todo}
      ${live ? buyers : ''}
    </div>
  </div>`;
}
/** For a property that is no longer on offer: who it went to (or is going to), the offer against the asking price, and when. */
/** The price answer in one glance — what a buyer or owner asks: is it fair, what is the total? (details on the Price tab) */
function priceCard(p) {
  const v = valuationSummary(p, DB.settings), href = `#/properties/${p.id}/pricing`;
  const where = !v.count ? null : v.position.startsWith('Within') ? ['In line with', 'green', ''] : v.position.startsWith('Below') ? ['Below', 'amber', ' — check for differences'] : ['Above', 'amber', ' — review the price'];
  return `<div class="card ov-price"><div class="card-head"><h2>Price check</h2><span class="sp"></span><a href="${href}">Details →</a></div>
    <div class="ov-price-n"><b>${inr(v.ppsf)}</b><small>/sq.ft.</small></div>
    ${where ? `<p>${chip(where[0] + ' the market', where[1])} <span class="muted">${v.count} similar: ${v.min === v.max ? inr(v.min) : `${inr(v.min)} – ${inr(v.max)}`}/sq.ft.${where[2]}</span></p>`
      : `<p class="muted">Not compared yet — no similar properties in our records. <a href="${href}">Add one</a></p>`}
    <div class="ov-price-all"><span>Total for the buyer</span><b>${inr(v.allIn)}</b><small class="muted">incl. stamp duty &amp; registration</small></div>
  </div>`;
}
function dealCard(p) {
  const c = DB.customers.find(x => x.negotiation && x.negotiation.prop === p.id), n = c && c.negotiation;
  const when = (p.history || []).find(h => /^Status changed/.test(h.text));
  const visits = DB.customers.reduce((s, x) => s + (x.siteVisits || []).filter(v => v.prop === p.id).length, 0);
  const head = { Sold: '🏁 Sold', Booked: '📝 Booked', Reserved: '🔒 Reserved', 'Under negotiation': '🤝 Under negotiation', 'On hold': '⏸ On hold' }[p.status] || esc(p.status);
  const gap = n && n.offered ? Math.round((n.offered - p.price) / p.price * 1000) / 10 : null;
  return `<div class="card ov-deal"><div class="card-head"><h2>${head}</h2><span class="sp"></span>${when ? `<small class="muted">since ${fmtDate(when.date)}</small>` : ''}</div>
    ${c ? `<a class="ov-buyer" href="#/customers/${c.id}"><span class="ov-av">${esc(initials(c.name))}</span><span class="ov-bn"><b>${esc(c.name)}</b><small>${esc(c.stage)} · ${esc(execName(DB, c.owner))}</small></span></a>
      <div class="ov-deal-nums"><div><span>Asking</span><b>${inrShort(p.price)}</b></div><div><span>Offer</span><b>${n.offered ? inrShort(n.offered) : '—'}</b>${gap != null ? `<small class="${gap < 0 ? 't-amber' : 't-green'}">${gap > 0 ? '+' : ''}${gap}%</small>` : ''}</div><div><span>Seller’s counter</span><b>${n.counter ? inrShort(n.counter) : '—'}</b></div></div>
      ${n.notes ? `<p class="ov-deal-note">“${esc(n.notes)}”</p>` : ''}`
      : `<p class="muted" style="margin:0 0 8px">${p.status === 'Sold' ? 'No buyer is linked in the system — it may have been sold outside it.' : p.status === 'On hold' ? 'The owner has put it on hold.' : 'No customer is linked to this deal yet.'}</p>`}
    <small class="muted">${visits} site visit${visits === 1 ? '' : 's'} in all · not offered in matching while ${esc(p.status.toLowerCase())}</small>
  </div>`;
}

/* ---------- Explore the neighbourhood ----------
   One card for the whole location: the map pin and address (Set location), the places around it (from Google, or added by
   hand), whether each one may be advertised, and what the customer will see. Places live on the property as
   location.nearby[] = { id, cat, name, distanceKm, durationMin, status, routeChecked, checkedBy, checkedAt, checkHow,
                         source: 'google' | 'user', placeId, addedBy, addedAt }
   Google is mocked here: Set location = Places Autocomplete + geocoding, Find nearby places = Places Nearby Search + route distances. */
const placeCats = () => (DB.settings && (DB.settings.placeCategories || []).length ? DB.settings.placeCategories : PLACE_CATEGORIES);
const catOf = name => {
  const c = placeCats().find(x => x.name === name), d = PLACE_CATEGORIES.find(x => x.name === name) || {};
  return c ? { check: d.check !== false, auto: !!d.auto, ...c } : { name, icon: '📍', group: 'other', check: true, auto: false };
};
/** Does this kind of place need its route checked before it is advertised? (Settings → Nearby place categories) */
const needsCheck = cat => catOf(cat).check !== false;
const nbIcon = cat => catOf(cat).icon || '📍';
const nbHash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 9973; return h; };
const kmTxt = (x, approx) => (x.distanceKm !== '' && x.distanceKm != null ? `${approx ? '~' : ''}${x.distanceKm} km` : '— km') + (x.durationMin ? ` · ${approx ? '~' : ''}${x.durationMin} min` : '');
/** Is the map pin the property's exact location? Without it the map shows the locality (approximate). */
const nbExact = L => L.lat !== '' && L.lat != null && L.pinOk !== false;
const nbOK = x => x.status === 'Existing' && (!!x.routeChecked || !needsCheck(x.cat));
/** Can this place be used in advertising? (spec: only existing places, with the route checked) */
const nbTrust = x => (x.status !== 'Existing' ? { l: `${x.status} — not advertised`, tone: 'grey' } : x.routeChecked ? { l: '✓ Route checked', tone: 'green' }
  : !needsCheck(x.cat) ? { l: '✓ OK to advertise', tone: 'green' } : { l: x.source === 'google' ? 'From Google — check route' : 'Route not checked', tone: 'amber' });
/** Older records: the highway becomes a place like any other, and every place gets a source. Safe to run again. */
function normLoc(p) {
  const L = p.location = p.location || {};
  L.nearby = L.nearby || [];
  if (L.highway) {
    if (L.highway.name && !L.nearby.some(x => x.cat === 'Highway')) {
      const r = L.highway.route || '';
      L.nearby.push({ id: 'nb-hw-' + p.id, cat: 'Highway', name: L.highway.name, distanceKm: L.highway.distanceKm, durationMin: '', status: 'Existing',
        routeChecked: !!r && !/not yet driven|on map/i.test(r), checkHow: r, source: 'user' });
    }
    delete L.highway;
  }
  L.nearby.forEach(x => { if (!x.source) x.source = x.ai ? 'google' : 'user'; delete x.ai; if (x.durationMin == null) x.durationMin = ''; });
  ['address', 'pincode', 'district', 'lat', 'lng', 'roadType', 'roadWidth'].forEach(k => { if (L[k] == null) L[k] = ''; });
  if (L.pinOk == null) L.pinOk = L.lat !== '' && L.lng !== '';
  if (p.specs) {
    const k = roadKeys(p), blank = v => v === '' || v == null;
    if (!L.roadSynced) { // older records kept the road only in the location — move it into the details once
      if (k.typeKey && blank(p.specs[k.typeKey]) && L.roadType && k.typeOpts.includes(L.roadType)) p.specs[k.typeKey] = L.roadType;
      if (k.widthKey && blank(p.specs[k.widthKey]) && !blank(L.roadWidth)) p.specs[k.widthKey] = Number(L.roadWidth);
      L.roadSynced = true;
    }
    const r = roadOf(p); L.roadType = r.type; L.roadWidth = r.width; // details are the source — keep the mirror current
  }
  return L;
}
/** The road outside the property. It is kept in ONE place: the property's details (specs) when its type has the field —
    that is what Edit details, the AI and matching use — and in location.* only for types without it (flat, house).
    location.roadType / roadWidth always mirror the current value, so every screen shows the same road. */
function roadKeys(p) {
  const has = k => ((PROPERTY_TYPES[p.type] || {}).fields || []).some(f => f.k === k);
  const typeKey = has('roadInfra') ? 'roadInfra' : p.type === 'agri' && has('roadAccess') ? 'roadAccess' : null;
  const field = typeKey && PROPERTY_TYPES[p.type].fields.find(f => f.k === typeKey);
  return { typeKey, widthKey: has('roadWidth') ? 'roadWidth' : null, typeOpts: field && field.o ? field.o.map(o => (typeof o === 'object' ? o.v : o)) : ROAD_TYPES };
}
function roadOf(p) {
  const k = roadKeys(p), L = p.location || {}, sp = p.specs || {};
  const v = x => (x == null ? '' : x);
  return { ...k, type: v(k.typeKey ? sp[k.typeKey] : L.roadType), width: v(k.widthKey ? sp[k.widthKey] : L.roadWidth) };
}
function setRoad(p, type, width) {
  const k = roadKeys(p), w = width === '' || width == null ? '' : Number(width);
  if (k.typeKey) p.specs[k.typeKey] = type;
  if (k.widthKey) p.specs[k.widthKey] = w;
  Object.assign(p.location, { roadType: type, roadWidth: w });
}
/** Mock geocoding: a locality's map position and pincode (Google Geocoding in the real build). */
function geoOf(city, locality) {
  const g = CITY_GEO[city] || [11.0, 78.5, '600'], h = nbHash(locality || city);
  return { lat: +(g[0] + ((h % 61) - 30) / 1000).toFixed(5), lng: +(g[1] + (((h >> 3) % 61) - 30) / 1000).toFixed(5), pin: g[2] + String(h % 90 + 10).padStart(3, '0') };
}
const nearestLocality = (city, lat, lng) => ((CITIES[city] || {}).localities || []).map(l => ({ l, g: geoOf(city, l) }))
  .sort((a, b) => Math.hypot(a.g.lat - lat, a.g.lng - lng) - Math.hypot(b.g.lat - lat, b.g.lng - lng))[0];
const shortLoc = l => String(l || '').replace(/\s*\(.*\)$/, '');

function neighbourhoodCard(p) {
  const L = normLoc(p), cust = UI.nbView === 'customer', exact = nbExact(L);
  const named = L.nearby.filter(x => x.name);
  const byKm = (a, b) => (+a.distanceKm || 99) - (+b.distanceKm || 99);
  const shown = cust ? named.filter(nbOK) : named;
  const groups = PLACE_GROUPS.map(g => ({ ...g, items: shown.filter(x => (catOf(x.cat).group || 'other') === g.k).sort(byKm) })).filter(g => g.items.length);
  if (cust) { const fut = named.filter(x => x.status !== 'Existing').sort(byKm); if (fut.length) groups.push({ k: 'future', l: 'Coming up — not built yet', i: '🚧', items: fut }); }
  const sel = UI.nbSel, selG = groups.find(g => g.items.some(x => x.id === sel)); // the selected place's group stays open
  const open = selG ? selG.k : UI.nbOpen && groups.some(g => g.k === UI.nbOpen) ? UI.nbOpen : (groups[0] || {}).k;
  // schematic map: the property in the middle, places on rings by distance (1 / 3 / 10 km, log scale), angle spread by name
  const all = groups.flatMap(g => g.items);
  const r = km => Math.min(40, 6 + Math.log10(1 + (+km || 0) * 3) * 18); // radius, in % of the map's width (cqw)
  const ang = s => nbHash(s) % 360 * Math.PI / 180;
  const marks = all.map(x => { const a = ang(x.name), d = r(x.distanceKm); return `<button class="nb-mark ${sel === x.id ? 'on' : ''} ${x.status !== 'Existing' ? 'future' : ''}" style="left:clamp(18px, calc(var(--cx) + ${(d * Math.cos(a)).toFixed(1)}cqw), calc(100% - 18px));top:clamp(18px, calc(50% + ${(d * Math.sin(a)).toFixed(1)}cqw), calc(100% - 18px))" data-act="nbSel" data-id="${p.id}" data-x="${x.id}" title="${esc(x.name)} · ${x.distanceKm} km">${nbIcon(x.cat)}</button>`; }).join('');
  const rings = [1, 3, 10].map(km => `<div class="nb-ring" style="width:${(r(km) * 2).toFixed(1)}cqw"><span>${km} km</span></div>`).join('');
  const s = all.find(x => x.id === sel);
  const item = x => {
    const tr = nbTrust(x), on = sel === x.id;
    return `<div class="nb-item ${on ? 'on' : ''}"><button class="nb-row" data-act="nbSel" data-id="${p.id}" data-x="${x.id}"><span class="nb-ic">${nbIcon(x.cat)}</span><span class="nb-tx"><span class="nb-n">${esc(x.name)}</span>
        <span class="nb-d">${kmTxt(x, !exact || (cust && !x.routeChecked))}${cust ? (x.status !== 'Existing' ? ` · ${esc(x.status)}` : '') : ` · <em class="t-${tr.tone}">${tr.l}</em>`}</span></span></button>
      ${on && !cust ? nbDetail(p, x) : ''}</div>`;
  };
  const list = groups.map(g => `<div class="nb-grp ${g.k === open ? 'open' : ''}">
      <button class="nb-gh" data-act="nbGroup" data-k="${g.k}"><span>${g.i}</span><b>${g.l}</b><small>${g.items.length}</small><i>${g.k === open ? '▴' : '▾'}</i></button>
      ${g.k === open ? `<div class="nb-items">${g.items.map(item).join('')}</div>` : ''}
    </div>`).join('');
  const rd = roadOf(p), road = [rd.type, rd.width ? rd.width + ' ft road' : ''].filter(Boolean).join(', ');
  const pinned = exact;
  const maps = pinned ? `https://www.google.com/maps?q=${L.lat},${L.lng}` : `https://www.google.com/maps/search/${encodeURIComponent(p.locality + ', ' + p.city)}`;
  const pending = !cust && pinned && L.suggestPending ? nbCandidates(p).length : 0;
  const okN = named.filter(nbOK).length, waitN = named.filter(x => x.status === 'Existing' && !x.routeChecked && needsCheck(x.cat)).length;
  const empty = cust ? `<div class="nb-empty">Nothing can be advertised yet.<br><small>A place shows here once it exists and someone has checked the route.</small></div>`
    : `<div class="nb-empty">No nearby places yet.<br><button class="btn sm" data-act="nbFindOpen" data-id="${p.id}">↻ Find places nearby</button></div>`;
  return `<div class="card nb-card" id="nb-card"><div class="card-head"><h2>Explore the neighbourhood</h2><span class="sp"></span>
      <div class="nb-seg"><button class="${cust ? '' : 'on'}" data-act="nbView" data-v="team">Team view</button><button class="${cust ? 'on' : ''}" data-act="nbView" data-v="customer" title="Exactly what the listing, brochure and WhatsApp message may say">👁 Customer view</button></div></div>
    <div class="nb-bar">
      <span class="nb-addr">📍 <b>${esc(L.address || `${p.locality}, ${p.city}`)}</b>${L.address ? ` <span class="muted">· ${esc(p.locality)}, ${esc(p.city)}</span>` : ''}${L.pincode ? ` <span class="muted">– ${esc(L.pincode)}</span>` : ''}${road ? ` <span class="muted">· ${esc(road)}</span>` : ''}</span>
      ${pinned ? '' : ' <span class="nb-approx">approximate location</span>'}
      ${cust ? '' : pinned ? `<button class="linkbtn" data-act="nbLocOpen" data-id="${p.id}">✎ Change location</button>` : `<button class="btn sm nb-setpin" data-act="nbLocOpen" data-id="${p.id}">📍 Set exact location</button>`}
      <span class="sp"></span>
      ${cust ? '' : `<button class="btn sm" data-act="nbFindOpen" data-id="${p.id}" title="Look up more schools, hospitals, transport and shops around the property">↻ Find more places</button><button class="btn sm" data-act="nbAddOpen" data-id="${p.id}">＋ Add place</button>`}
    </div>
    <p class="nb-sub">${cust ? `What the listing, brochure and WhatsApp message will show.${waitN ? ` <span class="muted">${waitN} place${waitN > 1 ? 's are' : ' is'} hidden until the route is checked.</span>` : ''}`
      : `${named.length} place${named.length === 1 ? '' : 's'} · <b class="t-green">${okN} OK to advertise</b>${waitN ? ` · <span class="t-amber">${waitN} waiting for a route check</span>` : ''}`}</p>
    ${pending ? `<div class="nb-found"><span>✨ <b>${pending} places found</b> around the exact location — schools, hospitals, transport and shops.</span><span class="sp"></span><button class="btn sm primary" data-act="nbFindOpen" data-id="${p.id}">Review and keep</button><button class="btn sm ghost" data-act="nbFoundHide" data-id="${p.id}">Not now</button></div>` : ''}
    <div class="nb-wrap">
      <div class="nb-map ${pinned ? '' : 'approx'}">${rings}${pinned ? `<div class="nb-pin" title="${esc(p.title)}">📍</div>` : `<div class="nb-area" title="The exact location isn’t set yet"><span>${esc(p.locality)}</span></div>`}${marks}
        ${s ? `<div class="nb-tip">${nbIcon(s.cat)} <b>${esc(s.name)}</b> · ${kmTxt(s, !pinned)}</div>` : ''}
        ${pinned ? '<span class="nb-note">Map preview — distances to scale (approx.)</span>' : `<span class="nb-note warn">Approximate — exact location not set</span>`}
        <a class="btn primary sm nb-view" href="${maps}" target="_blank" rel="noopener">View on Google Maps ↗</a></div>
      <div class="nb-list">${list || empty}</div>
    </div></div>`;
}
/** The selected place, opened in the list: where it came from, the route check, and its actions (or its edit fields). */
function nbDetail(p, x) {
  const i = p.location.nearby.indexOf(x), path = k => `location.nearby.${i}.${k}`;
  if (UI.nbEdit === x.id) return `<div class="nb-det nb-edit">
      ${fld('Name', bIn('p', p.id, path('name'), x.name))}
      <div class="nb-2">${fld('Category', bSel('p', p.id, path('cat'), x.cat, placeCats().map(c => c.name)))}${fld('Status', bSel('p', p.id, path('status'), x.status, INFRA_STATUSES))}</div>
      <div class="nb-2">${fld('Distance (km)', bIn('p', p.id, path('distanceKm'), x.distanceKm, 'number'))}${fld('Time (min)', bIn('p', p.id, path('durationMin'), x.durationMin, 'number'))}</div>
      <button class="btn sm primary" data-act="nbEdit" data-x="">Done</button></div>`;
  const when = d => (d ? ' · ' + fmtDate(d) : '');
  const src = x.source === 'google' ? `From Google${x.addedBy === 'Shown by default' ? ' · shown by default' : ''}${when(x.addedAt)}` : `Added by ${esc(x.addedBy || 'the team')}${when(x.addedAt)}`;
  const chk = x.routeChecked ? `✓ ${x.checkedBy ? `Checked by ${esc(x.checkedBy)}${when(x.checkedAt)}` : 'Route checked'}${x.checkHow ? ` — ${esc(x.checkHow)}` : ''}` : '';
  return `<div class="nb-det"><small>${src}</small>${chk ? `<small>${chk}</small>` : ''}
      ${x.status !== 'Existing' ? `<small>${esc(x.status)} — never advertised as an existing benefit.</small>` : ''}
      ${!needsCheck(x.cat) && x.status === 'Existing' && !x.routeChecked ? `<small>No route check needed for ${esc(x.cat.toLowerCase())}s — advertised with the approximate distance.</small>` : ''}
      ${x.status === 'Existing' && !x.routeChecked && needsCheck(x.cat) && !nbExact(p.location) ? '<small class="t-amber">Set the exact location first — the route is checked from the property, not the locality.</small>' : ''}
      <div class="row">${x.status === 'Existing' && !x.routeChecked && needsCheck(x.cat) && nbExact(p.location) ? `<button class="btn sm primary" data-act="nbRouteOpen" data-id="${p.id}" data-x="${x.id}">✓ Mark route checked</button>` : ''}
        ${x.routeChecked ? `<button class="btn sm" data-act="nbUncheck" data-id="${p.id}" data-x="${x.id}">Undo check</button>` : ''}
        <button class="btn sm" data-act="nbEdit" data-x="${x.id}">✎ Edit</button><button class="btn sm ghost danger" data-act="nbRemove" data-id="${p.id}" data-x="${x.id}">Remove</button></div></div>`;
}

/* --- mock Google Places: what "Find nearby places" returns for a category (names are samples) --- */
const NB_MOCK = {
  'Bus stop': { n: ['{l} bus stop', '{l} main road bus stop'], km: [0.2, 1.4] },
  'Railway station': { n: ['{c} Junction'], km: [2.5, 11] },
  'Metro station': { n: ['{l} metro station'], km: [0.6, 3], only: ['Chennai'] },
  Airport: { n: ['{c} Airport'], km: [8, 24], only: ['Madurai', 'Chennai', 'Coimbatore', 'Tiruchirappalli', 'Salem'] },
  School: { n: ['{l} Matriculation School (sample)', '{l} Public School (sample)'], km: [0.4, 3] },
  College: { n: ['{c} Arts & Science College (sample)'], km: [1.5, 6] },
  Hospital: { n: ['{l} Multispeciality Hospital (sample)', '{l} Nursing Home (sample)'], km: [0.6, 4] },
  Market: { n: ['{l} market', '{l} Supermarket (sample)'], km: [0.3, 2.5] },
  'Shopping mall': { n: ['{c} City Centre Mall (sample)'], km: [2, 8] },
  Bank: { n: ['{l} bank branch & ATM (sample)'], km: [0.3, 2] },
  'Place of worship': { n: ['{l} temple (sample)'], km: [0.2, 1.8] },
  Park: { n: ['{l} corporation park (sample)'], km: [0.3, 2.5] },
};
const mockKm = (seed, [lo, hi]) => { const km = +(lo + (nbHash(seed) % 100) / 100 * (hi - lo)).toFixed(1); return { km, min: Math.round(km * 2.6 + 3) }; };
function nbCandidates(p) {
  const L = normLoc(p), have = new Set(L.nearby.map(x => x.placeId || x.name.toLowerCase()));
  return placeCats().filter(c => c.google && NB_MOCK[c.name] && (!NB_MOCK[c.name].only || NB_MOCK[c.name].only.includes(p.city))).flatMap(c => {
    const m = NB_MOCK[c.name], hasCat = L.nearby.some(x => x.cat === c.name);
    return m.n.map((t, j) => {
      const name = t.replace('{l}', shortLoc(p.locality)).replace('{c}', p.city), placeId = 'gp-' + nbHash(name + '|' + p.city), d = mockKm(name + p.id, m.km);
      return { id: placeId, placeId, cat: c.name, name, distanceKm: d.km, durationMin: d.min, pre: !hasCat && j === 0 };
    }).filter(x => !have.has(x.placeId) && !have.has(x.name.toLowerCase()));
  });
}
/** The important places every new property shows by default: the nearest of each category marked "Shown by default"
    in Settings (bus stop, school, hospital, market, railway station), from Google. They still need their route checked
    where the category asks for it. */
function addDefaultPlaces(p) {
  const L = normLoc(p), cands = nbCandidates(p);
  const got = placeCats().filter(c => catOf(c.name).auto && !L.nearby.some(x => x.cat === c.name))
    .map(c => cands.filter(x => x.cat === c.name).sort((a, b) => a.distanceKm - b.distanceKm)[0]).filter(Boolean);
  got.forEach(x => L.nearby.push({ id: 'nb' + Date.now() + nbHash(x.name), cat: x.cat, name: x.name, distanceKm: x.distanceKm, durationMin: x.durationMin, status: 'Existing',
    routeChecked: false, source: 'google', placeId: x.placeId, addedBy: 'Shown by default', addedAt: DEMO_TODAY }));
  if (got.length) logHistory(p, `Nearby places shown by default: ${got.map(x => x.name).join(', ')} (from Google)`);
  return got.length;
}
const guessCat = q => {
  const rules = [[/school|matric|cbse|vidyalaya/i, 'School'], [/college|university|institute/i, 'College'], [/hospital|clinic|nursing|medical/i, 'Hospital'], [/metro/i, 'Metro station'],
    [/railway|junction|rail station/i, 'Railway station'], [/bus/i, 'Bus stop'], [/airport/i, 'Airport'], [/mall/i, 'Shopping mall'], [/market|supermarket|store|mart/i, 'Market'],
    [/bank|atm/i, 'Bank'], [/temple|kovil|church|mosque|masjid|dargah/i, 'Place of worship'], [/park|garden/i, 'Park'], [/highway|nh-?\d|bypass|ring road/i, 'Highway']];
  const hit = rules.find(([re]) => re.test(q));
  return hit && placeCats().some(c => c.name === hit[1]) ? hit[1] : 'Other';
};

Object.assign(MODALS, {
  /* Set location: search (Places Autocomplete), click the map to move the pin, and the address fields fill themselves */
  nbLoc: m => {
    const p = getProp(m.id), E = UI.locEd, span = 0.04;
    const x = 50 + (E.lng - E.cLng) / span * 100, y = 50 - (E.lat - E.cLat) / span * 100;
    const q = E.q.trim().toLowerCase();
    const sugg = q.length < 2 ? [] : Object.entries(CITIES).flatMap(([c, v]) => v.localities.map(l => ({ c, l, g: geoOf(c, l) })))
      .filter(s => `${s.l}, ${s.c} ${s.g.pin}`.toLowerCase().includes(q)).slice(0, 5);
    const inp = (k, l, o = {}) => fld(l, `<input id="loc-${k}" data-inp="locF" data-k="${k}" value="${esc(E[k])}" ${o.attrs || ''}>`, o);
    const where = `${E.locality ? esc(E.locality) + ', ' : ''}${esc(E.city)}, Tamil Nadu${E.pincode ? ' – ' + esc(E.pincode) : ''}`;
    return {
      title: E.exact ? `Location of ${p.id}` : `Set the exact location of ${p.id}`, submit: 'Save location', cls: 'wide',
      html: `<div class="loc-ways"><button type="button" class="btn" data-act="locHere">📍 Use my current location</button><span class="muted">or</span>
          <input id="loc-link" placeholder="Paste a Google Maps link or WhatsApp location" autocomplete="off"><button type="button" class="btn" data-act="locLink">Use link</button></div>
        <div class="loc-search"><input id="loc-q" data-inp="locQ" value="${esc(E.q)}" placeholder="🔍  …or search an address, landmark, locality or pincode" autocomplete="off">
          ${sugg.length ? `<div class="loc-sugg">${sugg.map(s => `<button type="button" data-act="locPick" data-c="${esc(s.c)}" data-l="${esc(s.l)}">📍 <b>${esc(s.l)}</b>, ${esc(s.c)}, Tamil Nadu ${s.g.pin}</button>`).join('')}</div>` : ''}</div>
        <div class="loc-map" data-act="locMap"><span class="loc-pin ${E.moved ? '' : 'approx'}" style="left:${Math.max(2, Math.min(98, x))}%;top:${Math.max(4, Math.min(98, y))}%">📍</span>
          <span class="loc-hint">${E.moved ? `✓ Pin set${E.how ? ' — ' + esc(E.how) : ''}` : E.exact ? 'Click the map to move the pin' : `This is the centre of ${esc(E.locality || E.city)} — click the map where the property is`}</span><span class="loc-ll">${E.lat}, ${E.lng}</span></div>
        <div class="loc-found"><span>📍 <b>${where}</b> <small class="muted">· filled in from the pin</small></span><button type="button" class="linkbtn" data-act="locMore">${E.more ? 'Hide details' : '✎ Change locality, pincode or road'}</button></div>
        <div class="fgrid c2" style="margin-top:10px">
          ${inp('address', 'Door no. and street <span class="opt-tag">Optional</span>', { cls: 'span2', attrs: 'placeholder="e.g. 12, 2nd cross street"' })}
          ${E.more ? `${fld('Locality', `<input id="loc-locality" data-inp="locF" data-k="locality" value="${esc(E.locality)}" list="loc-dl"><datalist id="loc-dl">${((CITIES[E.city] || {}).localities || []).map(l => `<option value="${esc(l)}">`).join('')}</datalist>`, { req: 1 })}
          ${fld('City', `<select data-chg="locCity">${options(Object.keys(CITIES), E.city)}</select>`, { req: 1 })}
          ${inp('pincode', 'Pincode')}
          ${fld('District / State', `<input value="${esc((CITIES[E.city] || {}).district || E.city)}, Tamil Nadu" disabled>`, { hint: 'From the city' })}
          ${fld(p.type === 'agri' ? 'Road access' : 'Road type', `<select data-chg="locRoad">${options(roadKeys(p).typeOpts, E.roadType, '—')}</select>`, { hint: roadKeys(p).typeKey ? 'Same as in the property details' : '' })}
          ${inp('roadWidth', 'Road width (ft)', { attrs: 'type="number" min="0"' })}` : ''}
        </div>`,
    };
  },
  /* Find nearby places: results come back as suggestions — the user keeps the ones that matter */
  nbFind: m => {
    const p = getProp(m.id), L = normLoc(p), list = UI.nbCand || [];
    if (!list.length) return { title: 'Find more places', submit: false, html: '<p style="margin-top:0">Nothing new found — every place Google knows within 5 km is already on the list.</p><p class="muted">Use <b>＋ Add place</b> for anything Google doesn’t have.</p>' };
    const grp = PLACE_GROUPS.map(g => ({ g, items: list.filter(x => catOf(x.cat).group === g.k) })).filter(x => x.items.length);
    return {
      title: `${list.length} places found near ${esc(p.locality)}`, submit: 'Add selected places', cls: 'wide',
      html: `${nbExact(L) ? `<p class="muted" style="margin-top:0">Searched Google Places within 5 km of the exact location. Distance and time are by road.</p>`
          : `<div class="note amber" style="margin:0 0 10px">The exact location isn’t set — searched around the centre of ${esc(p.locality)}, so distances are approximate.</div>`}
        <div class="nbf-tools"><button type="button" class="linkbtn" data-act="nbfAll" data-v="1">Select all</button> · <button type="button" class="linkbtn" data-act="nbfAll" data-v="0">Clear</button></div>
        ${grp.map(({ g, items }) => `<div class="nbf-grp"><div class="nbf-gh">${g.i} ${g.l}</div>${items.map(x => `<label class="nbf-row"><input type="checkbox" name="pick" value="${x.id}" ${x.pre ? 'checked' : ''}>
          <span class="nb-ic">${nbIcon(x.cat)}</span><span class="nb-tx"><b>${esc(x.name)}</b><small>${esc(x.cat)} · ${x.distanceKm} km · ${x.durationMin} min</small></span></label>`).join('')}</div>`).join('')}
        <div class="note" style="margin-top:12px">Added places are <b>not advertised</b> until someone checks the actual route — Google’s distance is a starting point, not a promise to the customer.</div>`,
    };
  },
  /* Add place: anything Google has (search), or something it doesn't yet — e.g. an upcoming metro station */
  nbAdd: m => {
    const p = getProp(m.id), A = UI.nbAdd, pin = A.mode === 'pin';
    const q = A.q.trim();
    const res = !pin && q.length >= 2 && !A.pick ? [q, `${q}, ${shortLoc(p.locality)}`, `${q}, ${p.city}`].map(n => { const d = mockKm(n + p.id, [0.3, 6]); return { name: n, km: d.km, min: d.min }; }) : [];
    const catSel = fld('Category', `<select data-chg="nbAddF" data-k="cat">${options(placeCats().map(c => c.name), A.cat)}</select>`);
    const stSel = fld('Status', `<select data-chg="nbAddF" data-k="status">${options(INFRA_STATUSES, A.status)}</select>`, { hint: pin ? 'Planned and proposed places are shown as “coming up”, never as existing' : '' });
    return {
      title: 'Add a nearby place', submit: 'Add place',
      html: `<div class="nb-seg nba-mode"><button type="button" class="${pin ? '' : 'on'}" data-act="nbAddMode" data-v="search">🔍 Search Google</button><button type="button" class="${pin ? 'on' : ''}" data-act="nbAddMode" data-v="pin">📌 Not on Google yet</button></div>
        ${pin ? `<p class="muted">For a place Google doesn’t have yet — a new IT park, an upcoming metro station, a planned bypass.</p>
          <div class="fgrid c2">${fld('Name', `<input id="nba-name" data-inp="nbAddF" data-k="name" value="${esc(A.name)}" placeholder="e.g. Metro Phase 2 — Sholinganallur station">`, { req: 1, cls: 'span2' })}
            ${catSel}${stSel}
            ${fld('Distance (km, approx.)', `<input id="nba-km" type="number" step="any" min="0" data-inp="nbAddF" data-k="km" value="${esc(A.km)}">`)}
            ${fld('Source', `<input id="nba-how" data-inp="nbAddF" data-k="how" value="${esc(A.how)}" placeholder="e.g. CMRL Phase 2 plan, 2026">`, { hint: 'Where this information comes from' })}</div>`
        : A.pick ? `<div class="nba-pick"><span class="nb-ic">${nbIcon(A.cat)}</span><span class="nb-tx"><b>${esc(A.pick.name)}</b><small>${A.pick.km} km · ${A.pick.min} min by road · Google (mock)</small></span><button type="button" class="linkbtn" data-act="nbAddPick" data-i="-1">Change</button></div>
          <div class="fgrid c2" style="margin-top:12px">${catSel}${stSel}</div>`
        : `<input id="nba-q" data-inp="nbAddQ" value="${esc(A.q)}" placeholder="Type a name — e.g. Apollo hospital, Kendriya Vidyalaya, Murugan temple" autocomplete="off" style="width:100%">
          ${res.length ? `<div class="loc-sugg static">${res.map((r2, i) => `<button type="button" data-act="nbAddPick" data-i="${i}" data-n="${esc(r2.name)}" data-km="${r2.km}" data-min="${r2.min}">${nbIcon(guessCat(r2.name))} <b>${esc(r2.name)}</b> <small class="muted">· ${r2.km} km</small></button>`).join('')}</div>` : '<p class="muted" style="margin:8px 0 0">Results come from Google Places (mock).</p>'}`}`,
    };
  },
  /* Mark route checked: the spec's rule — only after the actual route and travel conditions were checked */
  nbRoute: m => {
    const p = getProp(m.id), x = p.location.nearby.find(n => n.id === m.x);
    return {
      title: 'Mark the route as checked', submit: '✓ Route checked',
      html: `<p style="margin-top:0">${nbIcon(x.cat)} <b>${esc(x.name)}</b> <span class="muted">from ${esc(p.locality)}</span></p>
        <div class="fgrid c2">${fld('Distance by road (km)', `<input type="number" step="any" min="0" name="km" value="${esc(x.distanceKm)}" required>`, { hint: x.source === 'google' ? 'Google said ' + x.distanceKm + ' km — correct it if the route differs' : '' })}
          ${fld('Travel time (min)', `<input type="number" min="0" name="min" value="${esc(x.durationMin)}">`)}
          ${fld('How was it checked?', `<select name="how">${options(ROUTE_CHECKS, ROUTE_CHECKS[0])}</select>`, { cls: 'span2' })}
          ${fld('Conditions on the way', `<input name="note" placeholder="e.g. narrow lane near the temple; 10 min more at peak hours">`, { cls: 'span2' })}</div>
        <p class="muted" style="margin-bottom:0">Once checked, it appears in the customer view, the brochure and WhatsApp messages. Checked by ${esc(currentUser())}, ${fmtDate(DEMO_TODAY)}.</p>`,
    };
  },
});
Object.assign(MODAL_SUBMIT, {
  nbLoc: m => {
    const p = getProp(m.id), L = normLoc(p), E = UI.locEd;
    if (!E.locality.trim()) { toast('Locality is required'); return; }
    const pinNow = E.moved, first = pinNow && !E.exact;
    const moved = pinNow && E.exact && Math.hypot((E.lat - L.lat) * 111, (E.lng - L.lng) * 109) > 0.3;
    const ch = [];
    if (E.locality.trim() !== p.locality || E.city !== p.city) ch.push(`${E.locality.trim()}, ${E.city}`);
    if (E.address.trim() !== L.address) ch.push('address');
    if (E.pincode.trim() !== L.pincode) ch.push('pincode ' + E.pincode.trim());
    if (first) ch.push(`exact map location (${E.how})`); else if (moved) ch.push(`map pin moved (${E.how})`);
    const rd = roadOf(p), roadCh = E.roadType !== rd.type || String(E.roadWidth) !== String(rd.width);
    if (roadCh) ch.push(`road (${[E.roadType, E.roadWidth !== '' ? E.roadWidth + ' ft' : ''].filter(Boolean).join(', ') || 'cleared'})`);
    // a different locality without a new pin: the old pin no longer applies — back to approximate
    const relocated = (E.locality.trim() !== p.locality || E.city !== p.city) && !pinNow;
    Object.assign(p, { locality: E.locality.trim(), city: E.city, state: 'Tamil Nadu' });
    Object.assign(L, { address: E.address.trim(), pincode: E.pincode.trim(), district: (CITIES[E.city] || {}).district || E.city });
    if (roadCh) setRoad(p, E.roadType, E.roadWidth);
    if (pinNow) Object.assign(L, { lat: E.lat, lng: E.lng, pinOk: true, pinBy: currentUser(), pinAt: DEMO_TODAY });
    if (relocated) Object.assign(L, { lat: '', lng: '', pinOk: false });
    if (first) L.suggestPending = true; // look up the places around the new exact location once
    if (ch.length) logHistory(p, `Location updated: ${ch.join(', ')}`);
    save(); UI.modal = null; UI.locEd = null;
    toast(first ? 'Exact location saved — looking up places nearby' : moved && L.nearby.length ? 'Location saved — the pin moved, so re-check the distances to nearby places' : 'Location saved'); render();
  },
  nbFind: (m, fd) => {
    const p = getProp(m.id), picks = fd.getAll('pick'), got = (UI.nbCand || []).filter(x => picks.includes(x.id));
    if (!got.length) { toast('Tick at least one place'); return; }
    got.forEach(x => p.location.nearby.push({ id: 'nb' + Date.now() + nbHash(x.name), cat: x.cat, name: x.name, distanceKm: x.distanceKm, durationMin: x.durationMin, status: 'Existing',
      routeChecked: false, source: 'google', placeId: x.placeId, addedBy: currentUser(), addedAt: DEMO_TODAY }));
    const toCheck = got.filter(x => needsCheck(x.cat)).length;
    logHistory(p, `${got.length} nearby place${got.length > 1 ? 's' : ''} added from Google (${got.map(x => x.name).join(', ')})${toCheck ? ` — ${toCheck} need${toCheck > 1 ? '' : 's'} a route check before advertising` : ''}`);
    UI.nbOpen = catOf(got[0].cat).group; UI.nbView = 'team'; p.location.suggestPending = false;
    save(); UI.modal = null; UI.nbCand = null; toast(`${got.length} place${got.length > 1 ? 's' : ''} added${toCheck ? ` — ${toCheck} need${toCheck > 1 ? '' : 's'} a route check before it is advertised` : ''}`); render();
  },
  nbAdd: m => {
    const p = getProp(m.id), A = UI.nbAdd, pin = A.mode === 'pin';
    const name = pin ? A.name.trim() : A.pick && A.pick.name;
    if (!name) { toast(pin ? 'Type the place’s name' : 'Search for the place and pick it from the results'); return; }
    const x = { id: 'nb' + Date.now(), cat: A.cat, name, distanceKm: pin ? (A.km === '' ? '' : Number(A.km)) : A.pick.km, durationMin: pin ? '' : A.pick.min, status: A.status,
      routeChecked: false, source: pin ? 'user' : 'google', addedBy: currentUser(), addedAt: DEMO_TODAY };
    if (!pin) x.placeId = 'gp-' + nbHash(name + '|' + p.city);
    if (pin && A.how.trim()) x.checkHow = 'Source: ' + A.how.trim();
    p.location.nearby.push(x);
    logHistory(p, `Nearby place added: ${name} (${A.cat}, ${A.status}${pin ? ', not on Google' : ', from Google'})`);
    UI.nbOpen = catOf(A.cat).group; UI.nbSel = x.id; UI.nbView = 'team';
    save(); UI.modal = null; UI.nbAdd = null; toast(`${name} added`); render();
  },
  nbRoute: (m, fd) => {
    const p = getProp(m.id), x = p.location.nearby.find(n => n.id === m.x);
    const note = (fd.get('note') || '').trim(), how = fd.get('how');
    Object.assign(x, { routeChecked: true, distanceKm: Number(fd.get('km')), durationMin: fd.get('min') === '' ? '' : Number(fd.get('min')), checkedBy: currentUser(), checkedAt: DEMO_TODAY, checkHow: how + (note ? ' — ' + note : '') });
    logHistory(p, `Route checked: ${x.name}, ${x.distanceKm} km (${how.toLowerCase()})`);
    save(); UI.modal = null; toast(`${x.name} can now be advertised`); render();
  },
});
Object.assign(ACTIONS, {
  nbGroup: d => { UI.nbOpen = d.k; UI.nbSel = null; UI.nbEdit = null; render(); },
  nbSel: d => { UI.nbSel = UI.nbSel === d.x ? null : d.x; UI.nbEdit = null; render(); },
  nbView: d => { UI.nbView = d.v; UI.nbSel = null; UI.nbEdit = null; render(); },
  nbEdit: d => { UI.nbEdit = d.x || null; render(); },
  nbRemove: d => { const p = getProp(d.id), x = p.location.nearby.find(n => n.id === d.x); p.location.nearby = p.location.nearby.filter(n => n !== x); logHistory(p, `Nearby place removed: ${x.name}`); UI.nbSel = null; save(); toast(`${x.name} removed`); render(); },
  nbUncheck: d => { const p = getProp(d.id), x = p.location.nearby.find(n => n.id === d.x); Object.assign(x, { routeChecked: false, checkedBy: '', checkedAt: '' }); logHistory(p, `Route check undone: ${x.name} — no longer advertised`); save(); render(); },
  nbRouteOpen: d => openModal({ kind: 'nbRoute', id: d.id, x: d.x }),
  nbFoundHide: d => { getProp(d.id).location.suggestPending = false; save(); render(); },
  nbFindOpen: d => { UI.nbCand = nbCandidates(getProp(d.id)); openModal({ kind: 'nbFind', id: d.id }); },
  nbfAll: d => document.querySelectorAll('.modal input[name="pick"]').forEach(c => { c.checked = d.v === '1'; }),
  nbAddOpen: d => { UI.nbAdd = { mode: 'search', q: '', pick: null, cat: 'Other', status: 'Existing', name: '', km: '', how: '' }; openModal({ kind: 'nbAdd', id: d.id }); },
  nbAddMode: d => { const A = UI.nbAdd; A.mode = d.v; A.status = d.v === 'pin' ? 'Planned' : 'Existing'; render(); },
  nbAddPick: d => { const A = UI.nbAdd; if (d.i === '-1') { A.pick = null; } else { A.pick = { name: d.n, km: +d.km, min: +d.min }; A.cat = guessCat(d.n); } render(); },
  nbLocOpen: d => {
    const p = getProp(d.id), L = normLoc(p), g = geoOf(p.city, p.locality), has = nbExact(L);
    UI.locEd = { q: '', lat: has ? +L.lat : g.lat, lng: has ? +L.lng : g.lng, address: L.address, locality: p.locality, city: p.city, pincode: L.pincode || g.pin, roadType: roadOf(p).type, roadWidth: roadOf(p).width,
      exact: has, moved: false, how: '', more: false };
    Object.assign(UI.locEd, { cLat: UI.locEd.lat, cLng: UI.locEd.lng });
    openModal({ kind: 'nbLoc', id: p.id });
  },
  locPick: d => { const E = UI.locEd, g = geoOf(d.c, d.l); Object.assign(E, { city: d.c, locality: d.l, pincode: g.pin, lat: g.lat, lng: g.lng, cLat: g.lat, cLng: g.lng, q: '', moved: false, how: '' }); render(); },
  locMap: (d, el, e) => {
    const E = UI.locEd, b = el.getBoundingClientRect(), span = 0.04;
    E.lng = +(E.cLng + ((e.clientX - b.left) / b.width - 0.5) * span).toFixed(5);
    E.lat = +(E.cLat - ((e.clientY - b.top) / b.height - 0.5) * span).toFixed(5);
    const n = nearestLocality(E.city, E.lat, E.lng); // reverse geocoding (mock)
    if (n && Math.hypot(n.g.lat - E.lat, n.g.lng - E.lng) < 0.02) { E.locality = n.l; E.pincode = n.g.pin; }
    E.moved = true; E.how = 'placed on the map';
    render();
  },
  locHere: () => { // the browser's location in the real build; a point in the locality here (mock)
    const E = UI.locEd, g = geoOf(E.city, E.locality), j = Date.now() % 997;
    Object.assign(E, { lat: +(g.lat + ((j % 21) - 10) / 2500).toFixed(5), lng: +(g.lng + (((j >> 3) % 21) - 10) / 2500).toFixed(5), moved: true, how: 'your current location' });
    Object.assign(E, { cLat: E.lat, cLng: E.lng }); render();
  },
  locLink: () => {
    const E = UI.locEd, el = document.getElementById('loc-link'), v = el ? el.value.trim() : '';
    if (!v) { toast('Paste a Google Maps link or a WhatsApp location first'); return; }
    const m = v.match(/(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/);
    let ll = null;
    if (m) ll = { lat: +m[1], lng: +m[2] };
    else if (/maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google|google\.[a-z.]+\/maps|wa\.me/i.test(v)) { const g = geoOf(E.city, E.locality), h = nbHash(v); ll = { lat: +(g.lat + ((h % 21) - 10) / 2000).toFixed(5), lng: +(g.lng + (((h >> 4) % 21) - 10) / 2000).toFixed(5) }; }
    if (!ll) { toast('That doesn’t look like a map link — in Google Maps use Share → Copy link'); return; }
    Object.assign(E, ll, { cLat: ll.lat, cLng: ll.lng, moved: true, how: 'from the pasted link' });
    const n = nearestLocality(E.city, E.lat, E.lng); if (n && Math.hypot(n.g.lat - E.lat, n.g.lng - E.lng) < 0.02) { E.locality = n.l; E.pincode = n.g.pin; }
    render();
  },
  locMore: () => { UI.locEd.more = !UI.locEd.more; render(); },
});
Object.assign(INPUTS, {
  locQ: el => { UI.locEd.q = el.value; render(); },
  locF: el => { UI.locEd[el.dataset.k] = el.value; },
  nbAddQ: el => { UI.nbAdd.q = el.value; render(); },
  nbAddF: el => { UI.nbAdd[el.dataset.k] = el.value; },
});
document.addEventListener('keydown', e => { // Enter in a search box searches; it must not submit the dialog
  if (e.key === 'Enter' && e.target && (e.target.id === 'loc-q' || e.target.id === 'nba-q')) e.preventDefault();
});
Object.assign(CHANGES, {
  locCity: el => { const E = UI.locEd, g = geoOf(el.value, ''); Object.assign(E, { city: el.value, locality: '', pincode: g.pin, lat: g.lat, lng: g.lng, cLat: g.lat, cLng: g.lng, moved: false, how: '' }); render(); },
  locRoad: el => { UI.locEd.roadType = el.value; },
  nbAddF: el => { UI.nbAdd[el.dataset.k] = el.value; render(); },
});

/* ---------- Legal & documents: optional. Approval badges (each with its document) + any other documents ---------- */
function propLegal(p) {
  const s = legalSummary(p), mgr = canEditSettings(), on = p.approvals.map(a => a.k);
  const who = (by, at) => [by ? 'by ' + esc(by) : '', at ? fmtDate(at) : ''].filter(Boolean).join(', ');
  const stChip = a => (a.status === 'pending' ? chip('⚠ Document pending', 'amber') : a.status === 'verified' ? chip('✓ Verified', 'green') : chip('Document uploaded', 'blue'));
  const apRow = a => {
    const t = approvalOf(a.k);
    return `<div class="lg-row ${a.status === 'pending' ? 'warn' : ''}">
      <span class="lg-ic">🏅</span>
      <div class="lg-main"><div><b>${esc(t.long)}</b> ${stChip(a)}</div>
        <small>${a.file ? `📄 ${esc(a.file)}${who(a.uploadedBy, a.uploadedAt) ? ' · uploaded ' + who(a.uploadedBy, a.uploadedAt) : ''}${a.status === 'verified' ? ` · verified ${who(a.verifiedBy, a.verifiedAt)}` : ''}` : `Needs: ${esc(t.doc)}`}</small></div>
      <div class="lg-acts">${a.file
        ? `<button class="btn sm" data-act="lgView" data-f="${esc(a.file)}">View</button><button class="btn sm ghost" data-act="apUpload" data-id="${p.id}" data-k="${a.k}">Replace</button>${mgr ? `<button class="btn sm ghost" data-act="apVerify" data-id="${p.id}" data-k="${a.k}">${a.status === 'verified' ? 'Undo verified' : '✓ Mark verified'}</button>` : ''}`
        : `<button class="btn sm primary" data-act="apUpload" data-id="${p.id}" data-k="${a.k}">⤒ Upload document</button>`}
        ${mgr ? `<button class="btn sm ghost danger" data-act="apRemove" data-id="${p.id}" data-k="${a.k}" title="Remove this badge" aria-label="Remove ${esc(t.long)}">✕</button>` : ''}</div>
    </div>`;
  };
  const addable = approvalTypes().filter(t => !on.includes(t.k));
  const newForm = UI.apNew === p.id ? `<div class="lg-new">
      <div class="fgrid c2">${fld('Approval name', '<input id="ap-new-name" placeholder="e.g. Fire NOC, DTCP approval, Occupancy certificate">', { req: 1 })}
        ${fld('Its document <span class="opt-tag">Optional</span>', '<input id="ap-new-doc" placeholder="e.g. Fire NOC certificate">')}</div>
      <p class="muted" style="margin:8px 0">A new approval is available on <b>every property</b> from then on (Settings → Approval badges).</p>
      <div class="row"><button class="btn sm primary" data-act="apNewSave" data-id="${p.id}">Create and add to ${p.id}</button><button class="btn sm" data-act="apNewOpen" data-id="${p.id}">Cancel</button></div></div>` : '';
  const approvalsCard = `<div class="card"><div class="card-head"><h2>Approvals</h2><span class="opt-tag">Optional</span><span class="sp"></span>${mgr ? `<button class="btn sm" data-act="apNewOpen" data-id="${p.id}">＋ New approval</button>` : ''}</div>
    <p class="muted lg-intro">Tick the approvals this property has. A badge shows on the listing once its document is uploaded — until then it says <b>document pending</b>, and matching shows the property only as a Conditional match.</p>
    ${p.approvals.length ? p.approvals.map(apRow).join('') : '<p class="muted" style="margin:0 0 4px">No approval badges.</p>'}
    ${addable.length ? `<div class="lg-add"><span class="muted">Add a badge:</span>${addable.map(t => `<button class="ov-add" data-act="apAdd" data-id="${p.id}" data-k="${t.k}">＋ ${esc(t.long)}</button>`).join('')}</div>` : ''}
    ${newForm}</div>`;
  // other documents — any document, optional; the usual ones for the type are one click away
  const docRow = d => `<div class="lg-row">
      <span class="lg-ic">📄</span>
      <div class="lg-main"><div><b>${esc(d.name)}</b> ${d.verified ? chip('✓ Verified', 'green') : ''}</div>
        <small>${esc(d.file)}${who(d.uploadedBy, d.uploadedAt) ? ' · uploaded ' + who(d.uploadedBy, d.uploadedAt) : ''}${d.verified && who(d.verifiedBy, d.verifiedAt) ? ` · verified ${who(d.verifiedBy, d.verifiedAt)}` : ''}</small></div>
      <div class="lg-acts"><button class="btn sm" data-act="lgView" data-f="${esc(d.file)}">View</button>${mgr ? `<button class="btn sm ghost" data-act="docVerify" data-id="${p.id}" data-d="${d.id}">${d.verified ? 'Undo verified' : '✓ Mark verified'}</button>` : ''}
        ${mgr ? `<button class="btn sm ghost danger" data-act="docRemove" data-id="${p.id}" data-d="${d.id}" title="Remove" aria-label="Remove ${esc(d.name)}">✕</button>` : ''}</div>
    </div>`;
  const usual = (LEGAL_BY_TYPE[p.type] || []).concat('valuer').filter(k => !OLD_APPROVAL_DOCS[k] && !p.documents.some(d => d.kind === k));
  const docsCard = `<div class="card"><div class="card-head"><h2>Other documents</h2><span class="opt-tag">Optional</span><span class="sp"></span><button class="btn sm" data-act="docNewOpen" data-id="${p.id}">⤒ Upload document</button></div>
    ${p.documents.length ? p.documents.map(docRow).join('') : '<p class="muted" style="margin:0 0 4px">No documents yet — upload any that help the sale.</p>'}
    ${usual.length ? `<div class="lg-add"><span class="muted">Usual for a ${esc(typeLabel(p.type).toLowerCase())}:</span>${usual.map(k => `<button class="ov-add" data-act="docAdd" data-id="${p.id}" data-k="${k}" title="${esc(LEGAL_DOCS[k].v)}">⤒ ${esc(LEGAL_DOCS[k].n)}</button>`).join('')}</div>` : ''}
    ${UI.docNew === p.id ? `<div class="lg-new"><div class="row" style="gap:8px"><input id="doc-new-name" placeholder="Document name — e.g. Property tax receipt 2025" style="flex:1"><button class="btn sm primary" data-act="docNewSave" data-id="${p.id}">⤒ Upload</button><button class="btn sm" data-act="docNewOpen" data-id="${p.id}">Cancel</button></div></div>` : ''}
  </div>`;
  const shown = p.approvals.filter(a => a.status !== 'pending').map(a => approvalOf(a.k).long + (a.status === 'verified' ? ' ✓' : ''));
  return `${approvalsCard}${docsCard}
  <div class="note"><b>On the listing:</b> ${shown.length ? esc(shown.join(' · ')) : 'no approval badges'}${s.openApprovals.length ? ` <span class="muted">(${esc(s.openApprovals.join(', '))} — shown once the document is uploaded)</span>` : ''}.
    Documents are shared with a customer only on request. The listing never says “100% legally clear”.</div>`;
}
Object.assign(ACTIONS, {
  lgView: d => toast(`Opening ${d.f} (mock)`),
  apAdd: d => {
    const p = getProp(d.id); normLegal(p); if (p.approvals.some(a => a.k === d.k)) return;
    p.approvals.push({ k: d.k, status: 'pending', file: '', uploadedBy: '', uploadedAt: '', verifiedBy: '', verifiedAt: '' });
    logHistory(p, `Approval badge added: ${approvalOf(d.k).long} — document pending`); save(); toast(`${approvalOf(d.k).long} added — upload its document to show it on the listing`); render();
  },
  apUpload: d => {
    const p = getProp(d.id), a = p.approvals.find(x => x.k === d.k), again = !!a.file;
    Object.assign(a, { file: `${d.k.replace(/^x_/, '')}-document${again ? '-v2' : ''}.pdf`, status: 'uploaded', uploadedBy: currentUser(), uploadedAt: DEMO_TODAY, verifiedBy: '', verifiedAt: '' });
    logHistory(p, `${approvalOf(d.k).long}: document ${again ? 'replaced' : 'uploaded'}`); save(); toast(`${approvalOf(d.k).long} — document ${again ? 'replaced' : 'uploaded'} (mock)`); render();
  },
  apVerify: d => {
    if (!canEditSettings()) return;
    const p = getProp(d.id), a = p.approvals.find(x => x.k === d.k), v = a.status !== 'verified';
    Object.assign(a, v ? { status: 'verified', verifiedBy: currentUser(), verifiedAt: DEMO_TODAY } : { status: 'uploaded', verifiedBy: '', verifiedAt: '' });
    logHistory(p, `${approvalOf(d.k).long}: ${v ? 'document verified' : 'verification undone'}`); save(); render();
  },
  apRemove: d => {
    if (!canEditSettings()) return;
    const p = getProp(d.id); p.approvals = p.approvals.filter(x => x.k !== d.k);
    logHistory(p, `Approval badge removed: ${approvalOf(d.k).long}`); save(); toast(`${approvalOf(d.k).long} removed`); render();
  },
  apNewOpen: d => { UI.apNew = UI.apNew === d.id ? null : d.id; render(); if (UI.apNew) setTimeout(() => { const el = document.getElementById('ap-new-name'); if (el) el.focus(); }, 0); },
  apNewSave: d => {
    if (!canEditSettings()) return;
    const p = getProp(d.id), name = (document.getElementById('ap-new-name').value || '').trim(), doc = (document.getElementById('ap-new-doc').value || '').trim();
    if (!name) { toast('Type the approval’s name'); return; }
    const before = approvalTypes().length, k = addApprovalType(name, doc), created = approvalTypes().length > before;
    if (!p.approvals.some(a => a.k === k)) p.approvals.push({ k, status: 'pending', file: '', uploadedBy: '', uploadedAt: '', verifiedBy: '', verifiedAt: '' });
    logHistory(p, `Approval badge ${created ? 'created and ' : ''}added: ${approvalOf(k).long} — document pending`);
    UI.apNew = null; save(); toast(created ? `${approvalOf(k).long} created — available on every property` : `${approvalOf(k).long} added`); render();
  },
  docAdd: d => {
    const p = getProp(d.id); normLegal(p);
    p.documents.push({ id: 'doc' + Date.now(), name: LEGAL_DOCS[d.k].n, kind: d.k, file: `${d.k}-scan.pdf`, uploadedBy: currentUser(), uploadedAt: DEMO_TODAY, verified: false, verifiedBy: '', verifiedAt: '' });
    logHistory(p, `Document uploaded: ${LEGAL_DOCS[d.k].n}`); save(); toast(`${LEGAL_DOCS[d.k].n} uploaded (mock)`); render();
  },
  docNewOpen: d => { UI.docNew = UI.docNew === d.id ? null : d.id; render(); if (UI.docNew) setTimeout(() => { const el = document.getElementById('doc-new-name'); if (el) el.focus(); }, 0); },
  docNewSave: d => {
    const p = getProp(d.id), name = (document.getElementById('doc-new-name').value || '').trim();
    if (!name) { toast('Name the document'); return; }
    const file = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.pdf';
    p.documents.push({ id: 'doc' + Date.now(), name, kind: 'other', file, uploadedBy: currentUser(), uploadedAt: DEMO_TODAY, verified: false, verifiedBy: '', verifiedAt: '' });
    UI.docNew = null; logHistory(p, `Document uploaded: ${name}`); save(); toast(`${name} uploaded (mock)`); render();
  },
  docVerify: d => {
    if (!canEditSettings()) return;
    const p = getProp(d.id), x = p.documents.find(y => y.id === d.d);
    Object.assign(x, x.verified ? { verified: false, verifiedBy: '', verifiedAt: '' } : { verified: true, verifiedBy: currentUser(), verifiedAt: DEMO_TODAY });
    logHistory(p, `${x.name}: ${x.verified ? 'verified' : 'verification undone'}`); save(); render();
  },
  docRemove: d => { if (!canEditSettings()) return; const p = getProp(d.id), x = p.documents.find(y => y.id === d.d); p.documents = p.documents.filter(y => y !== x); logHistory(p, `Document removed: ${x.name}`); save(); toast(`${x.name} removed`); render(); },
});
document.addEventListener('keydown', e => { // Enter in the small "new" forms
  if (e.key !== 'Enter' || !e.target || !['ap-new-name', 'ap-new-doc', 'doc-new-name'].includes(e.target.id)) return;
  e.preventDefault(); const b = document.querySelector(e.target.id === 'doc-new-name' ? '[data-act="docNewSave"]' : '[data-act="apNewSave"]'); if (b) b.click();
});
/* ---------- Price: is the asking price reasonable, and how do we say it without overselling? ----------
   Fully automatic: the price is judged against every similar property in our own records (same type and city, area within
   ±25%, listed or sold in the last 12 months) — worked out live, so a nearby sale counts as soon as it is marked Sold.
   The team only removes ones that aren't really similar, or adds outside ones (portal listings, registered sales).
   valuation.comparables[] = the outside ones { location, type, area, pricePerSqft, kind: 'Asking' | 'Transaction', date, source, differences }
   valuation.dismissed[]   = IDs of our properties marked "not similar" for this one */
const COMP_DAYS = 365, COMP_AREA = 0.25;
function compDiffs(p, o) { // what differs, in a few words — the AI's note, which the team can change
  const d = [], pct = Math.round((o.area - p.area) / p.area * 100);
  if (o.locality !== p.locality) d.push(`in ${o.locality}`);
  if (pct) d.push(`${Math.abs(pct)}% ${pct > 0 ? 'larger' : 'smaller'}`);
  const a = p.specs || {}, b = o.specs || {};
  if (a.corner && b.corner && a.corner !== b.corner) d.push(b.corner.toLowerCase());
  if (a.roadWidth && b.roadWidth && a.roadWidth !== b.roadWidth) d.push(`${b.roadWidth} ft road`);
  if (a.bhk && b.bhk && a.bhk !== b.bhk) d.push(b.bhk);
  if (a.floor !== undefined && b.floor !== undefined && a.floor !== '' && b.floor !== '' && a.floor !== b.floor) d.push(`floor ${b.floor}`);
  return d.slice(0, 3).join(', ') || 'very similar';
}
function compFrom(p, o) {
  const sold = ['Sold', 'Booked'].includes(o.status), when = ((o.history || []).find(h => /^Status changed/.test(h.text)) || {}).date;
  return { ref: o.id, location: `${o.locality}, ${o.city}`, type: typeLabel(o.type), area: o.area, pricePerSqft: Math.round(o.price / o.area),
    kind: sold ? 'Transaction' : 'Asking', date: sold && when ? when : o.listingDate, source: `Our records · ${o.id}${sold ? ' (' + o.status.toLowerCase() + ')' : ''}`, differences: compDiffs(p, o) };
}
/** Similar properties in our own records (not marked "not similar"). */
function compCandidates(p) {
  const V = p.valuation, no = new Set(V.dismissed || []), today = new Date(DEMO_TODAY);
  return DB.properties.filter(o => o.id !== p.id && !o.archived && o.type === p.type && o.city === p.city && o.area > 0 && o.price > 0 && p.area > 0
      && Math.abs(o.area - p.area) / p.area <= COMP_AREA && (today - new Date(o.listingDate)) / 864e5 <= COMP_DAYS && !no.has(o.id))
    .sort((a, b) => (b.locality === p.locality) - (a.locality === p.locality) || Math.abs(a.area - p.area) - Math.abs(b.area - p.area))
    .map(o => compFrom(p, o));
}
/** Everything the price is judged against: found in our records (live) + added from outside. Ones from our records that
    an older version stored by hand are dropped — they now come in live. */
function compsOf(p) {
  const V = p.valuation;
  if ((V.comparables || []).some(c => c.ref)) V.comparables = V.comparables.filter(c => !c.ref);
  return compCandidates(p).map(c => ({ ...c, auto: true })).concat(V.comparables || []);
}
function propPricing(p) {
  const v = valuationSummary(p, DB.settings), V = p.valuation, auto = compCandidates(p), all = auto.concat(V.comparables), noun = typeLabel(p.type).toLowerCase();
  const tone = !v.count ? 'grey' : v.position.startsWith('Within') ? 'green' : 'amber';
  const pos = !v.count ? '' : v.position.startsWith('Within') ? 'within the range' : v.position.startsWith('Below') ? 'below the range' : 'above the range';
  // the headline: the price, and where it sits among similar properties
  const vals = [v.ppsf || 0, ...all.map(c => Number(c.pricePerSqft) || 0)].filter(x => x > 0);
  const maxP = Math.max(...vals, 1), lo = Math.min(...vals, maxP) * 0.85; // start the scale just below the lowest, so differences show
  const bars = [{ l: 'This property (asking)', val: v.ppsf, me: 1 }].concat(all.filter(c => Number(c.pricePerSqft) > 0).map(c => ({ l: `${c.location}${c.ref ? ' · ' + c.ref : ''} · ${c.kind === 'Transaction' ? 'sold' : 'asking'}`, val: Number(c.pricePerSqft) })))
    .map(b => `<div class="bar-row ${b.me ? 'me' : ''}"><span>${esc(b.l)}</span>${meter((b.val - lo) / ((maxP - lo) || 1) * 100, b.me ? '' : 'grey')}<span class="num">${num(b.val)}</span></div>`).join('');
  const head = `<div class="card pr-head">
      <div class="pr-top">
        <div class="pr-stat"><span>Asking price</span><b>${inr(p.price)}</b><small>${inr(v.ppsf)} / sq.ft. · ${num(p.area)} sq.ft.${p.priceOnRequest ? ' · hidden on the listing' : ''}</small></div>
        <div class="pr-stat total"><span>Total for the buyer</span><b>${inr(v.allIn)}</b>
          <dl class="pr-break"><dt>Stamp duty <b>${DB.settings.costs.stampDutyPct}%</b></dt><dd><b>+ ${inr(Math.round(p.price * DB.settings.costs.stampDutyPct / 100))}</b></dd>
            <dt>Registration <b>${DB.settings.costs.registrationPct}%</b></dt><dd><b>+ ${inr(Math.round(p.price * DB.settings.costs.registrationPct / 100))}</b></dd>
            <dt>Other (legal, misc.) <b>${DB.settings.costs.otherPct}%</b></dt><dd><b>+ ${inr(Math.round(p.price * DB.settings.costs.otherPct / 100))}</b></dd></dl></div>
        ${v.count ? `<div class="pr-stat verdict ${tone}"><span>Market check · ${v.count} similar</span><b>${pos === 'within the range' ? 'In line with the market' : pos === 'below the range' ? 'Below the market' : 'Above the market'}</b>
          <dl class="pr-break"><dt>Similar properties</dt><dd><b>${v.min === v.max ? inr(v.min) : `${inr(v.min)} – ${inr(v.max)}`}</b> /sq.ft.</dd>
            ${v.txnAvg ? `<dt>Recent sales average</dt><dd><b>${inr(v.txnAvg)}</b> /sq.ft.</dd>` : ''}<dt>This property</dt><dd><b>${inr(v.ppsf)}</b> /sq.ft.</dd></dl>
          ${v.position.includes(' — ') ? `<small class="pr-hint">${esc(v.position.split(' — ')[1].replace(/^./, c => c.toUpperCase()))}.</small>` : ''}</div>`
          : `<div class="pr-stat verdict grey"><span>Market check</span><b>Not compared yet</b><small>No similar ${noun}s in ${esc(p.city)} in our records yet. Add one from outside — a portal listing or a registered sale.</small></div>`}</div>
      ${v.count ? `<div class="pr-bars">${bars}</div>` : ''}
      <p class="pr-rule">Say it neutrally — never “bargain” or “best price” just because another seller asks more. Cost rates are set in <a href="#/settings">Settings</a>; confirm the current rates before quoting.</p>
    </div>`;
  // comparables kept: compact rows; an outside one can be edited
  const row = (c, i) => UI.compEdit === p.id + ':' + i ? `<div class="pr-row edit"><div class="fgrid">
        ${fld('Location', bIn('p', p.id, `valuation.comparables.${i}.location`, c.location))}${fld('Area (sq.ft.)', bIn('p', p.id, `valuation.comparables.${i}.area`, c.area, 'number'))}${fld('₹ / sq.ft.', bIn('p', p.id, `valuation.comparables.${i}.pricePerSqft`, c.pricePerSqft, 'number'))}
        ${fld('Asking or sold', bSel('p', p.id, `valuation.comparables.${i}.kind`, c.kind, [{ v: 'Asking', l: 'Asking price' }, { v: 'Transaction', l: 'Sold (transaction)' }]))}${fld('Date', bIn('p', p.id, `valuation.comparables.${i}.date`, c.date, 'date'))}${fld('Source', bIn('p', p.id, `valuation.comparables.${i}.source`, c.source, 'text', 'placeholder="e.g. Registered sale, portal listing"'))}
        ${fld('What differs', bIn('p', p.id, `valuation.comparables.${i}.differences`, c.differences, 'text', 'placeholder="e.g. corner plot, older layout"'), { cls: 'span3' })}</div>
        <button class="btn sm primary" data-act="compEdit" data-id="${p.id}" data-i="">Done</button></div>`
    : `<div class="pr-row"><span class="pr-ppsf"><b>${c.pricePerSqft ? inr(c.pricePerSqft) : '—'}</b><small>/sq.ft.</small></span>
        <div class="pr-main"><div><b>${esc(c.location)}</b> ${chip(c.kind === 'Transaction' ? 'Sold' : 'Asking', c.kind === 'Transaction' ? 'green' : '')} ${c.ref ? `<a class="mono small" href="#/properties/${c.ref}">${c.ref}</a>` : ''}</div>
          <small>${num(c.area)} sq.ft. · ${c.date ? fmtDate(c.date) : 'no date'} · ${esc(c.source || 'source not given')}${c.differences ? ` · <i>${esc(c.differences)}</i>` : ''}</small></div>
        <div class="lg-acts"><button class="btn sm ghost" data-act="compEdit" data-id="${p.id}" data-i="${i}">✎ Edit</button><button class="btn sm ghost danger" data-act="rmComp" data-id="${p.id}" data-i="${i}" title="Remove" aria-label="Remove">✕</button></div></div>`;
  const found = auto.map(c => `<div class="pr-row"><span class="pr-ppsf"><b>${inr(c.pricePerSqft)}</b><small>/sq.ft.</small></span>
      <div class="pr-main"><div><b>${esc(c.location)}</b> ${chip(c.kind === 'Transaction' ? 'Sold' : 'Asking', c.kind === 'Transaction' ? 'green' : '')} <a class="mono small" href="#/properties/${c.ref}">${c.ref}</a></div>
        <small>${num(c.area)} sq.ft. · ${fmtDate(c.date)} · <i>${esc(c.differences)}</i></small></div>
      <div class="lg-acts"><button class="btn sm ghost" data-act="compNo" data-id="${p.id}" data-r="${c.ref}" title="Leave it out of the comparison">Not similar</button></div></div>`).join('');
  const comps = `<div class="card"><div class="card-head"><h2>Similar properties</h2>${v.count ? chip(String(v.count)) : ''}<span class="sp"></span><button class="btn sm" data-act="addComp" data-id="${p.id}" title="A portal listing or a registered sale outside our records">＋ Add from outside</button></div>
      <p class="pr-auto">✨ Found automatically in our records — ${esc(noun)}s in ${esc(p.city)}, area within ±25%, listed or sold in the last 12 months. A new sale nearby is included as soon as it is marked Sold. Leave out any that aren’t really similar.</p>
      ${found || '<p class="muted" style="margin:0 0 6px">None in our records yet.</p>'}
      ${V.comparables.length ? `<div class="pr-found"><div class="pr-found-h">Added from outside</div>${V.comparables.map(row).join('')}</div>` : ''}
      ${(V.dismissed || []).length ? `<p class="pr-auto">${V.dismissed.length} left out as not similar (${V.dismissed.join(', ')}) · <button class="linkbtn" data-act="compUndo" data-id="${p.id}">Bring back</button></p>` : ''}
    </div>`;
  return `${head}${comps}`;
}
Object.assign(ACTIONS, {
  compNo: d => { const p = getProp(d.id); (p.valuation.dismissed = p.valuation.dismissed || []).push(d.r); logHistory(p, `Comparable left out as not similar: ${d.r}`); save(); toast(`${d.r} left out of the comparison`); render(); },
  compUndo: d => { const p = getProp(d.id); logHistory(p, `Comparables brought back: ${p.valuation.dismissed.join(', ')}`); p.valuation.dismissed = []; save(); render(); },
  compEdit: d => { UI.compEdit = d.i === '' || d.i == null ? null : d.id + ':' + d.i; render(); },
});
/* ---------- Matching customers: who should hear about this property, why, and what to do next ----------
   Uses the same matching engine as the customer pages (logic.js matchScore). Actions are the customer's own:
   recommend (told the buyer — by call, WhatsApp or in person) and book a site visit (views-customers.js), logged on the customer's timeline.
   Sending the property itself (details, photos, brochure) is in the header's Share menu. */
const PURPOSE_ICON = { 'Own use': '🏠', Investment: '📈', 'Rental income': '💰', 'Business use': '🏢', 'Second home': '🌴', Other: '•' };
/** The talking points for this buyer, chosen by their purchase purpose (spec: purpose changes what matters). */
function pitchFor(c, p) {
  const L = normLoc(p), sp = p.specs || {}, rd = roadOf(p), v = valuationSummary(p, DB.settings), out = [];
  const near = cat => L.nearby.filter(x => x.cat === cat && nbOK(x)).sort((a, b) => (+a.distanceKm || 99) - (+b.distanceKm || 99))[0];
  const placeTxt = (cat, label) => { const x = near(cat); if (x) out.push(`${label} ${x.distanceKm} km`); };
  const road = (r => r && !/road/.test(r) ? r + ' road' : r)([rd.width ? rd.width + ' ft' : '', rd.type ? rd.type.toLowerCase() : ''].filter(Boolean).join(' '));
  const market = () => { if (v.count) out.push(`${v.position.startsWith('Within') ? 'In line with the market' : v.position.startsWith('Below') ? 'Below the market' : 'Above the market'} (${inr(v.min)}–${inr(v.max)}/sq.ft.)`); if (v.txnAvg) out.push(`recent sales ${inr(v.txnAvg)}/sq.ft.`); };
  const upcoming = () => { const f = L.nearby.filter(x => x.name && x.status !== 'Existing').sort((a, b) => (+a.distanceKm || 99) - (+b.distanceKm || 99))[0]; if (f) out.push(`${f.status.toLowerCase()} ${f.name.charAt(0).toLowerCase() + f.name.slice(1)} ~${f.distanceKm} km`); };
  const approvals = () => { const ok = p.approvals.filter(a => a.status !== 'pending').map(a => approvalOf(a.k).l); if (ok.length) out.push(ok.join(' + ') + ' ✓'); };
  switch (c.purpose) {
    case 'Own use': case 'Second home':
      placeTxt('School', 'School'); placeTxt('Hospital', 'Hospital'); placeTxt('Bus stop', 'Bus stop');
      if (road) out.push(road);
      if (sp.water) out.push('water: ' + String(sp.water).toLowerCase());
      if (p.type === 'plot') approvals(); else if (sp.possession) out.push(String(sp.possession).toLowerCase());
      break;
    case 'Investment':
      market(); upcoming(); approvals();
      break;
    case 'Rental income':
      if (sp.occupancy) out.push(String(sp.occupancy).toLowerCase());
      if (sp.rentalIncome) out.push(`rent ${inr(sp.rentalIncome)}/month (${(sp.rentalIncome * 12 / p.price * 100).toFixed(1)}% a year)`);
      if (sp.maintenance) out.push(`maintenance ${inr(sp.maintenance)}/month`);
      placeTxt('Railway station', 'Railway'); placeTxt('Bus stop', 'Bus stop'); market();
      break;
    case 'Business use':
      if (sp.commCategory) out.push(sp.commCategory);
      if (sp.frontage) out.push(sp.frontage + ' ft frontage');
      if (road) out.push(road);
      if (sp.permittedUsage) out.push('permitted: ' + String(sp.permittedUsage).toLowerCase());
      if (sp.parking) out.push('parking: ' + String(sp.parking).toLowerCase());
      { const h = near('Highway'); if (h) out.push(`${h.name} ${h.distanceKm} km`); }
      break;
    default: market();
  }
  return out.slice(0, 5);
}
function propMatches(p) {
  const live = p.status === 'Available' && !p.archived;
  const list = matchesForProperty(p, DB).map(x => ({ ...x, rd: readiness(x.cust, DB) }));
  if (UI.matchSort === 'ready') list.sort((a, b) => b.rd.total - a.rd.total || b.m.M - a.m.M);
  const n = l => list.filter(x => x.m.label === l).length;
  // close but over budget — worth a conversation about the budget gap
  const close = live ? DB.customers.filter(c => isActive(c)).map(c => ({ cust: c, m: matchScore(c, p, DB.settings) }))
    .filter(x => x.m.label === 'Budget mismatch' && p.price <= x.m.ceiling * 1.15).sort((a, b) => a.m.ceiling - b.m.ceiling).reverse() : [];
  const visitOf = c => (c.siteVisits || []).filter(v => v.prop === p.id).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const card = ({ cust: c, m, rd }) => { // one compact row per buyer; the reasons open on "Why?"
    const rec = (c.recommended || []).includes(p.id), sv = visitOf(c), r = c.req || {}, open = UI.mcOpen === p.id + ':' + c.id;
    const want = [r.size ? `${num(r.size)} sq.ft.` : '', (r.localities || []).length ? 'in ' + r.localities.slice(0, 2).join(', ') : (r.cities || []).length ? 'in ' + r.cities.join(', ') : ''].filter(Boolean).join(' ');
    const reasons = m.why.filter(w => !/^⚠/.test(w)), warn = m.why.filter(w => /^⚠/.test(w)), pts = pitchFor(c, p);
    const actions = live ? `${rec ? `<button class="btn sm ghost mc-rec on" data-act="unrecommend" data-id="${c.id}" data-p="${p.id}" title="Click to undo">✓ Recommended</button>`
        : `<button class="btn sm ${m.legalOk ? 'primary' : ''}" data-act="recommend" data-id="${c.id}" data-p="${p.id}" title="${m.legalOk ? 'You told this buyer about it — by call, WhatsApp or in person. Adds it to their shortlist and moves the lead on.' : 'An approval document is pending — explain before recommending'}">✓ Recommend</button>`}
        ${sv && sv.status === 'Scheduled' ? `<span class="mc-visit">📅 ${fmtDate(sv.date)}</span>` : `<button class="btn sm" data-act="visitModal" data-id="${c.id}" data-p="${p.id}" title="Book a site visit">📅 Visit</button>`}` : '';
    return `<div class="mc-card">
      <span class="ov-av">${esc(initials(c.name))}</span>
      <div class="mc-main">
        <div class="mc-l1"><a href="#/customers/${c.id}" title="Open lead ${c.id}"><b>${esc(c.name)}</b></a>
          <span class="mc-purpose" title="${esc(c.purposeNote || (PURPOSES.find(x => x.v === c.purpose) || {}).d || '')}">${PURPOSE_ICON[c.purpose] || '•'} ${esc(c.purpose || 'Purpose not asked')}</span>
          <span class="mc-dim">${esc(c.stage)} · ready to buy <b class="t-${rd.band.tone}" title="${esc(rd.band.l)}">${rd.total}</b></span></div>
        <div class="mc-l2">${inrShort(c.budget.min)} – ${inrShort(c.budget.max)}${want ? ' · ' + esc(want) : ''} · ${esc(execName(DB, c.owner).replace(/^Executive \d+ — /, ''))}</div>
        ${pts.length ? `<div class="mc-say" title="What to tell ${esc(c.name.split(' ')[0])}${c.purpose ? ' — for ' + esc(c.purpose.toLowerCase()) : ''}">💬 ${pts.map(esc).join(' · ')}</div>` : ''}
        ${warn.map(w => `<div class="mc-warn">${esc(w)}</div>`).join('')}
        ${open ? `<div class="mc-why">${reasons.map(w => `<span class="${/^✗/.test(w) ? 'no' : /not in preferred/.test(w) ? 'part' : 'ok'}">${esc(w.replace(/^[✓✗]\s*/, ''))}</span>`).join('')}</div>` : ''}
      </div>
      <div class="mc-side">
        <div class="mc-fit"><b class="t-${m.tone}">${m.M}</b><span>${esc(m.label)}</span></div>
        <button class="linkbtn mc-whybtn" data-act="mcWhy" data-k="${p.id}:${c.id}">${open ? 'Hide reasons' : `Why ${m.M}?`}</button>
        <div class="mc-acts">${actions}</div>
      </div>
    </div>`;
  };
  const head = `<div class="mc-head"><div><h2>${list.length ? `${list.length} buyer${list.length > 1 ? 's' : ''} fit this property` : 'No buyer fits this property yet'}</h2>
      <div class="row">${n('Strong match') ? chip(n('Strong match') + ' strong', 'green') : ''}${n('Good match') ? chip(n('Good match') + ' good', 'blue') : ''}${n('Weak match') ? chip(n('Weak match') + ' weak') : ''}${n('Conditional match') ? chip(n('Conditional match') + ' conditional', 'amber') : ''}${close.length ? chip(close.length + ' close on budget', 'outline') : ''}${(() => { const ps = [...new Set(list.map(x => x.cust.purpose).filter(Boolean))]; return ps.length ? `<span class="mc-purposes">${ps.map(x => `${PURPOSE_ICON[x] || '•'} ${list.filter(y => y.cust.purpose === x).length} ${esc(x.toLowerCase())}`).join(' · ')}</span>` : ''; })()}</div></div>
      <span class="sp"></span>${list.length > 1 ? `<div class="nb-seg"><button class="${UI.matchSort === 'ready' ? '' : 'on'}" data-act="matchSort" data-v="fit">Best fit</button><button class="${UI.matchSort === 'ready' ? 'on' : ''}" data-act="matchSort" data-v="ready">Most ready to buy</button></div>` : ''}</div>`;
  return `${!live ? `<div class="note amber" style="margin-bottom:12px">This property is <b>${esc(p.archived ? 'archived' : p.status)}</b>, so it is not offered to buyers — matching shows it to nobody until it is available again.</div>` : ''}
  <div class="card">${head}
    <p class="muted mc-rule">Only active leads, after the hard filters (available, type, city, budget + flexibility). Ranked by fit; an approval document pending makes it a Conditional match.</p>
    ${list.map(card).join('') || '<p class="muted" style="margin:0">When a lead’s requirement fits — type, city and budget — they appear here automatically.</p>'}
  </div>
  ${close.length ? `<div class="card"><h2>Close — over budget</h2><p class="muted" style="margin:-4px 0 10px">Everything fits except the price. Worth a call about the budget gap or a small price move.</p>
    ${close.map(({ cust: c, m }) => { const gap = p.price - c.budget.max; return `<div class="pr-row"><span class="ov-av">${esc(initials(c.name))}</span>
      <div class="pr-main"><div><a href="#/customers/${c.id}"><b>${esc(c.name)}</b></a> ${chip(esc(c.stage), stageTone(c.stage))}</div><small>Budget up to ${inrShort(c.budget.max)}${c.budget.flexPct ? ` (+${c.budget.flexPct}% flexible)` : ''} · <b class="t-amber">${inrShort(gap)} over the maximum</b> (+${Math.round(gap / c.budget.max * 100)}%)</small></div>
      <div class="lg-acts"><a class="btn sm ghost" href="#/customers/${c.id}">Open lead →</a></div></div>`; }).join('')}</div>` : ''}`;
}

/* ---------- History: everything that happened to this property, and to the buyers around it ---------- */
const HIST_CATS = [
  { k: 'details', l: 'Details', i: '✎' }, { k: 'price', l: 'Price', i: '₹' }, { k: 'status', l: 'Status', i: '🏷' }, { k: 'location', l: 'Location', i: '📍' },
  { k: 'docs', l: 'Documents', i: '📄' }, { k: 'media', l: 'Photos', i: '📷' }, { k: 'buyers', l: 'Buyers', i: '👤' },
];
function histCat(t) {
  return /price|comparable/i.test(t) ? 'price'
    : /^status|archiv|restored|sold|reserved|booked/i.test(t) ? 'status'
    : /approval|document|legal|verified|valuation report/i.test(t) ? 'docs'
    : /location|nearby|route|pin|place|address|pincode|road/i.test(t) ? 'location'
    : /photo|video/i.test(t) ? 'media' : 'details';
}
function propHistory(p) {
  const items = (p.history || []).map((h, i) => {
    let text = h.text, via = '';
    const m = text.match(/ — (via AI chat|in the details form|via the AI assistant)$/);
    if (m) { text = text.slice(0, -m[0].length); via = /form/.test(m[1]) ? 'Form' : '✨ AI'; }
    if (/^(Property listed|Published)/.test(text)) via = via || (/AI assistant/.test(text) ? '✨ AI' : '');
    return { date: h.date || h.at, ts: h.ts || 0, by: h.by, text, via, cat: /^(Property listed|Published)/.test(text) ? 'details' : histCat(text), order: i };
  });
  // the buyers' side: anything on a customer's timeline about this property (recommended, shared, site visits, offers)
  DB.customers.forEach(c => (c.activity || []).filter(a => a.text && a.text.includes(p.id)).forEach((a, i) =>
    items.push({ date: a.date, ts: a.ts || 0, by: a.by, text: a.text, who: c, type: a.type, cat: 'buyers', order: 1000 + i })));
  items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.ts - a.ts) || a.order - b.order));
  const f = UI.histF && UI.histF.id === p.id ? UI.histF.k : 'all';
  const count = k => items.filter(x => x.cat === k).length;
  const shown = f === 'all' ? items : items.filter(x => x.cat === f);
  const chips = [`<button class="hs-chip ${f === 'all' ? 'on' : ''}" data-act="histF" data-id="${p.id}" data-k="all">All <small>${items.length}</small></button>`]
    .concat(HIST_CATS.filter(c => count(c.k)).map(c => `<button class="hs-chip ${f === c.k ? 'on' : ''}" data-act="histF" data-id="${p.id}" data-k="${c.k}">${c.i} ${c.l} <small>${count(c.k)}</small></button>`)).join('');
  let last = '';
  const rows = shown.map(x => {
    const day = x.date !== last ? `<div class="hs-day">${fmtDate(x.date)}</div>` : ''; last = x.date;
    const cat = HIST_CATS.find(c => c.k === x.cat) || HIST_CATS[0];
    return `${day}<div class="hs-row"><span class="hs-ic c-${x.cat}">${cat.i}</span>
      <div class="hs-main">${x.who ? `<a href="#/customers/${x.who.id}"><b>${esc(x.who.name)}</b></a> · ` : ''}${esc(x.text)}
        <small>${esc(x.by || '')}${x.via ? ` · <span class="hs-via">${esc(x.via)}</span>` : ''}${x.type && x.type !== 'Note' ? ` · ${esc(x.type)}` : ''}</small></div></div>`;
  }).join('');
  return `<div class="card"><div class="card-head"><h2>History</h2><span class="sp"></span><small class="muted">Changes to the property, and what happened with buyers</small></div>
    <div class="hs-chips">${chips}</div>
    ${rows || '<p class="muted" style="margin:0">Nothing here yet.</p>'}</div>`;
}
Object.assign(ACTIONS, {
  matchSort: d => { UI.matchSort = d.v; render(); },
  mcWhy: d => { UI.mcOpen = UI.mcOpen === d.k ? null : d.k; render(); },
  histF: d => { UI.histF = { id: d.id, k: d.k }; render(); },
});
Object.assign(ACTIONS, {
  clearFilters: d => { UI.filters[d.scope] = d.scope === 'custs' ? { sort: 'readiness' } : {}; render(); },
  addComp: d => { const p = getProp(d.id); p.valuation.comparables.push({ location: p.locality + ', ' + p.city, type: typeLabel(p.type), area: p.area, pricePerSqft: '', kind: 'Transaction', date: DEMO_TODAY, source: '', differences: '' }); UI.compEdit = p.id + ':' + (p.valuation.comparables.length - 1); save(); render(); },
  rmComp: d => { const p = getProp(d.id), c = p.valuation.comparables.splice(+d.i, 1)[0]; UI.compEdit = null; if (c) logHistory(p, `Comparable removed: ${c.ref || c.location}`); save(); render(); },
  addImage: d => { const p = getProp(d.id); p.images = (p.images || 0) + 1; logHistory(p, `Photo uploaded (${p.images} in all)`); save(); toast('Photo uploaded (mock)'); render(); },
  rmImage: d => { if (!canEditSettings()) return; const p = getProp(d.id); p.images = Math.max(0, (p.images || 0) - 1); logHistory(p, 'Photo removed'); save(); render(); },
});
/* ---------- archive / restore / delete ---------- */
const MANAGE_TITLE = 'disabled title="Admin / Sales manager only"';
function propHeaderActions(p) {
  const dis = canEditSettings() ? '' : MANAGE_TITLE;
  if (p.archived) return `${chip('Archived', 'outline')}<button class="btn" data-act="propRestore" data-id="${p.id}" ${dis}>↺ Restore</button><button class="btn danger" data-act="propDeleteOpen" data-id="${p.id}" ${dis}>🗑 Delete</button>`;
  const menu = (k, btn, items) => `<div class="hd-menu">${btn}${UI.propMenu === k ? `<div class="hd-pop">${items}</div>` : ''}</div>`;
  if (!canEditSettings()) return `${chip(p.status, STATUS_TONE[p.status])}<a class="btn" href="#/properties/${p.id}/share" title="See the brochure the customer receives, then copy the link or download the PDF">↗ Share</a>
    <span class="hd-ro" title="Only an Admin or Sales manager can change a published property — add photos, documents and nearby places here, or ask them for other changes">🔒 Changes by a manager</span>`;
  return `${bSel('p', p.id, 'status', p.status, PROPERTY_STATUSES, 'style="width:auto" title="Change status"')}<a class="btn primary" href="#/properties/${p.id}/edit" title="Tell the AI assistant what changed">✨ Edit with AI</a>
    <a class="btn" href="#/properties/${p.id}/share" title="See the brochure the customer receives, then copy the link or download the PDF">↗ Share</a>
    ${menu('more', `<button class="btn icon" data-act="propMenu" data-k="more" title="More actions">⋯</button>`,
      `<button data-act="propArchiveOpen" data-id="${p.id}" ${dis}>🗄 Archive</button><button class="danger" data-act="propDeleteOpen" data-id="${p.id}" ${dis}>🗑 Delete</button>`)}`;
}
document.addEventListener('click', e => { // close the header menus when clicking elsewhere
  if (UI.propMenu && (!e.target.closest('.hd-menu') || e.target.closest('.hd-pop'))) { UI.propMenu = null; render(); }
});
/** Customers whose records point at this property (recommendation, site visit, negotiation or appointment). */
function propertyLinks(pid) {
  return DB.customers.map(c => {
    const k = [];
    if ((c.recommended || []).includes(pid)) k.push('recommended');
    const sv = (c.siteVisits || []).filter(v => v.prop === pid).length; if (sv) k.push(sv + ' site visit' + (sv > 1 ? 's' : ''));
    if (c.negotiation && c.negotiation.prop === pid) k.push('negotiation');
    const ap = (c.appointments || []).filter(a => a.prop === pid).length; if (ap) k.push(ap + ' appointment' + (ap > 1 ? 's' : ''));
    return k.length ? { c, k } : null;
  }).filter(Boolean);
}
function upcomingForProperty(pid) {
  const out = [];
  DB.customers.forEach(c => [...(c.siteVisits || []).map(v => Object.assign({ type: 'Site visit' }, v)), ...(c.appointments || [])]
    .filter(a => a.prop === pid && (a.status || 'Scheduled') === 'Scheduled' && a.date >= DEMO_TODAY)
    .forEach(a => out.push({ c, a })));
  return out;
}
const linkList = links => `<ul class="why" style="margin:6px 0 0">${links.map(l => `<li><a data-act="propGo" data-href="#/customers/${l.c.id}">${esc(l.c.name)}</a> <small class="mono">${l.c.id}</small> — ${l.k.join(', ')}</li>`).join('')}</ul>`;
Object.assign(MODALS, {
  propArchive: m => {
    const p = getProp(m.id), links = propertyLinks(p.id), up = upcomingForProperty(p.id);
    return {
      title: `Archive ${p.id}?`, submit: 'Archive property',
      html: `<p style="margin-top:0"><b>${esc(p.title)}</b><br><small class="muted">${typeLabel(p.type)} · ${esc(p.locality)}, ${esc(p.city)} · ${inrShort(p.price)} · ${p.status}</small></p>
        <div class="note"><b>Archiving will:</b><ul class="why" style="margin:4px 0 0">
          <li>hide the property from the property list (find it again with the “Archived only” filter);</li>
          <li>remove it from matching, recommendations and new appointment bookings;</li>
          <li>keep its specification, documents, history and every customer link — you can restore it at any time.</li></ul></div>
        ${links.length ? `<div style="margin-top:12px"><b>${links.length} customer record(s) refer to this property</b> — they keep the reference and get a note on their timeline:${linkList(links)}</div>` : ''}
        ${up.length ? `<div class="note amber" style="margin-top:12px">⚠ ${up.length} upcoming appointment(s) for this property are still scheduled (${up.map(x => `${esc(x.c.name)}, ${fmtDate(x.a.date)}`).join('; ')}). Archiving does not cancel them — reschedule or cancel them in Appointments.</div>` : ''}
        <div style="margin-top:12px">${fld('Reason (optional)', `<select name="reason">${options(['', 'Sold outside the system', 'Withdrawn by owner', 'Listing expired', 'Duplicate listing', 'Other'], '')}</select>`)}</div>`,
    };
  },
  propDelete: m => {
    const p = getProp(m.id), links = propertyLinks(p.id);
    if (links.length) return {
      title: `${p.id} can’t be deleted`, submit: p.archived ? false : 'Archive instead',
      html: `<div class="note red" style="margin-bottom:12px">This property is linked to <b>${links.length} customer record(s)</b>. Deleting it would break their recommendations, site visits, negotiations or appointments.</div>
        ${linkList(links)}
        <p style="margin:12px 0 0">${p.archived ? 'It is already archived, so it is hidden from the list and from matching.' : '<b>Archive it instead</b> to hide it from the list and from matching while keeping the customer history.'}</p>`,
    };
    const docs = legalSummary(p).files;
    return {
      title: `Delete ${p.id} permanently?`, submit: 'Delete permanently',
      html: `<p style="margin-top:0"><b>${esc(p.title)}</b><br><small class="muted">${typeLabel(p.type)} · ${esc(p.locality)}, ${esc(p.city)} · ${inrShort(p.price)} · ${p.status}</small></p>
        <div class="note green" style="margin-bottom:10px">✓ No customer record refers to this property, so it can be deleted.</div>
        <div class="note red">This <b>cannot be undone</b>. The specification, location, ${p.approvals.length} approval badge${p.approvals.length === 1 ? '' : 's'} and ${docs} document${docs === 1 ? '' : 's'}, ${p.valuation.comparables.length} comparables, ${p.images || 0} images and the change history will be removed.</div>
        <label class="check" style="margin-top:12px"><input type="checkbox" name="confirm" required> I understand that ${p.id} will be permanently deleted</label>`,
    };
  },
});
Object.assign(MODAL_SUBMIT, {
  propArchive: (m, fd) => {
    const p = getProp(m.id), reason = fd.get('reason') || '';
    Object.assign(p, { archived: true, archivedDate: DEMO_TODAY, archivedBy: currentUser(), archiveReason: reason });
    logHistory(p, `Archived${reason ? ' — ' + reason : ''}`);
    propertyLinks(p.id).forEach(l => logActivity(l.c, 'Note', `Property ${p.id} (${p.title}) was archived — no longer offered or matched`));
    save(); UI.modal = null; toast(`${p.id} archived`); render();
  },
  propDelete: (m, fd) => {
    const p = getProp(m.id);
    if (propertyLinks(p.id).length) { if (!p.archived) openModal({ kind: 'propArchive', id: p.id }); return; } // re-checked at submit time
    if (fd.get('confirm') !== 'on') { toast('Tick the confirmation box to delete'); return; }
    DB.properties = DB.properties.filter(x => x.id !== p.id);
    save(); UI.modal = null; toast(`${p.id} deleted`); go('#/properties'); render();
  },
});
Object.assign(ACTIONS, {
  propMenu: d => { UI.propMenu = UI.propMenu === d.k ? null : d.k; render(); },
  propArchiveOpen: d => { if (canEditSettings()) openModal({ kind: 'propArchive', id: d.id }); },
  propDeleteOpen: d => { if (canEditSettings()) openModal({ kind: 'propDelete', id: d.id }); },
  propRestore: d => {
    if (!canEditSettings()) return;
    const p = getProp(d.id); p.archived = false; logHistory(p, 'Restored from archive');
    save(); toast(`${p.id} restored`); render();
  },
  propGo: d => { UI.modal = null; go(d.href); render(); },
});