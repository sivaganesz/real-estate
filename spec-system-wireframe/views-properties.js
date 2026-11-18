/* =====================================================================
   Module A — Property specification database
   ===================================================================== */
function legalChip(p) {
  const s = legalSummary(p);
  const tone = s.openMandatory.length ? 'amber' : s.verified === s.total ? 'green' : 'blue';
  return chip(`${s.verified}/${s.total} verified`, tone, s.openMandatory.length ? 'Mandatory checks unresolved: ' + s.openMandatory.join(', ') : 'All mandatory checks verified');
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
  const docs = legalSummary(p).openMandatory;
  if (docs.length) out.push({ k: 'docs', group: 'Documents pending', l: `Not verified: ${docs.slice(0, 2).join(', ')}${docs.length > 2 ? ` +${docs.length - 2} more` : ''}`, fix: `#/properties/${p.id}/legal`, act: 'Open documents' });
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
      <td><b>${esc(p.title)}</b><br><small>${typeLabel(p.type)} · ${p.purpose}</small>${attnLine(p)}</td>
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


/* ---------- add / edit form ---------- */
function blankProperty() {
  return { id: '', title: '', type: 'plot', purpose: 'Sale', status: 'Available', listingDate: DEMO_TODAY, city: 'Madurai', locality: '', state: 'Tamil Nadu', facing: 'East', area: '', price: '', amenities: [], images: 0, specs: {} };
}
function specFieldsHtml(type, specs) {
  return PROPERTY_TYPES[type].fields.map(fd => fld(fd.l, inputFor(fd, specs[fd.k], 'spec.' + fd.k), { hint: fd.h })).join('');
}
function viewPropertyForm(id) {
  const src = id ? getProp(id) : null;
  if (id && !src) return { title: 'Not found', html: '<div class="card empty">Property not found.</div>' };
  const p = src ? clone(src) : blankProperty();
  const t = PROPERTY_TYPES[p.type];
  const typeOpts = CATEGORIES.map(cat => `<optgroup label="${cat}">${Object.entries(PROPERTY_TYPES).filter(([, v]) => v.category === cat).map(([k, v]) => `<option value="${k}" ${k === p.type ? 'selected' : ''}>${v.label}</option>`).join('')}</optgroup>`).join('');
  const ppsf = p.area > 0 && p.price > 0 ? inr(Math.round(p.price / p.area)) : '—';
  return {
    title: id ? 'Edit property' : 'Add property',
    crumbs: `Specification data / <a href="#/properties">Properties</a> / <b>${id ? 'Edit ' + id : 'Add property'}</b>`,
    html: `
    <div class="page-head"><div><h1>${id ? 'Edit ' + esc(p.title) : 'Add property'}</h1><p>Main information is common to all properties. The specification section below changes with the property type.</p></div></div>
    <form data-form="property" data-id="${id || ''}" class="card">
      <div class="form-sec"><h2><span class="num">1</span>Main property information</h2>
        <div class="fgrid">
          ${fld('Property ID', `<input value="${esc(p.id || 'Auto: PROP-' + (DB.counters.prop + 1))}" disabled>`, { hint: 'Unique — never rely on the title alone' })}
          ${fld('Property title', `<input name="title" value="${esc(p.title)}" required placeholder="e.g. Premium residential plot">`, { req: 1, cls: 'span2' })}
          ${fld('Property type', `<select name="type" data-chg="ptype">${typeOpts}</select>`, { req: 1 })}
          ${fld('Property category', `<input id="cat-display" value="${t.category}" disabled>`, { hint: 'Derived from type' })}
          ${fld('Listing purpose', `<select name="purpose">${options(LISTING_PURPOSES, p.purpose)}</select>`, { req: 1 })}
          ${fld('State', `<input name="state" value="${esc(p.state)}">`)}
          ${fld('City / district', `<select name="city" data-chg="pcity">${options(Object.keys(CITIES), p.city)}</select>`, { req: 1 })}
          ${fld('Locality', `<input name="locality" list="loc-list" value="${esc(p.locality)}" required><datalist id="loc-list">${(CITIES[p.city] || { localities: [] }).localities.map(l => `<option value="${esc(l)}">`).join('')}</datalist>`, { req: 1, hint: 'Actual locality name' })}
          ${fld('Facing', `<select name="facing">${options(FACINGS, p.facing)}</select>`)}
          ${fld(`<span id="area-label">${t.areaLabel}</span>`, `<input type="number" name="area" min="1" step="any" value="${esc(p.area)}" required data-inp="ppsf">`, { req: 1 })}
          ${fld('Asking price (₹)', `<input type="number" name="price" min="1" step="any" value="${esc(p.price)}" required data-inp="ppsf">`, { req: 1 })}
          ${fld('Asking price per sq.ft.', `<input id="ppsf-live" value="${ppsf}" disabled>`, { hint: 'Total price ÷ area (auto)' })}
          ${fld('Property status', `<select name="status">${options(PROPERTY_STATUSES, p.status)}</select>`)}
          ${fld('Listing date', `<input type="date" name="listingDate" value="${esc(p.listingDate)}">`)}
        </div>
      </div>
      <div class="form-sec"><h2><span class="num">2</span>Property-specific specifications <span class="chip blue" id="type-chip">${t.label}</span></h2>
        <p class="muted" style="margin-top:-4px">Only the fields relevant to this type are shown — a plot never asks for BHK, a flat never asks for survey subdivision.</p>
        <div class="fgrid" id="spec-fields">${specFieldsHtml(p.type, p.specs)}</div>
      </div>
      <div class="form-sec"><h2><span class="num">3</span>Features &amp; amenities</h2>
        <div class="checks">${AMENITIES.map(a => `<label class="check"><input type="checkbox" name="amenities" value="${esc(a)}" ${p.amenities.includes(a) ? 'checked' : ''}> ${a}</label>`).join('')}</div>
      </div>
      <div class="form-sec"><h2><span class="num">4</span>Location, legal documents and valuation</h2>
        <div class="note blue">After saving, complete the <b>Location</b> (GPS, measured distances, existing vs planned infrastructure), <b>Legal &amp; documents</b> (three-status verification) and <b>Pricing &amp; valuation</b> (comparables) tabs on the property page.</div>
      </div>
      <div class="form-actions"><a class="btn" href="${id ? '#/properties/' + id : '#/properties'}">Cancel</a><button class="btn primary">${id ? 'Save changes' : 'Save property'}</button></div>
    </form>`,
  };
}
Object.assign(CHANGES, {
  ptype: el => {
    const t = PROPERTY_TYPES[el.value];
    document.getElementById('spec-fields').innerHTML = specFieldsHtml(el.value, {});
    document.getElementById('area-label').textContent = t.areaLabel;
    document.getElementById('cat-display').value = t.category;
    document.getElementById('type-chip').textContent = t.label;
  },
  pcity: el => {
    const dl = document.getElementById('loc-list');
    if (dl) dl.innerHTML = (CITIES[el.value] || { localities: [] }).localities.map(l => `<option value="${esc(l)}">`).join('');
  },
});
Object.assign(INPUTS, {
  ppsf: el => {
    const f = el.form, a = Number(f.elements.area.value), pr = Number(f.elements.price.value);
    document.getElementById('ppsf-live').value = a > 0 && pr > 0 ? inr(Math.round(pr / a)) : '—';
  },
});
FORMS.property = (f, fd) => {
  const id = f.dataset.id;
  const type = fd.get('type');
  const specs = {};
  PROPERTY_TYPES[type].fields.forEach(x => { const v = fd.get('spec.' + x.k); specs[x.k] = x.t === 'number' ? (v === '' ? '' : Number(v)) : v; });
  const data = {
    title: fd.get('title').trim(), type, purpose: fd.get('purpose'), state: fd.get('state'), city: fd.get('city'), locality: fd.get('locality').trim(),
    facing: fd.get('facing'), area: Number(fd.get('area')), price: Number(fd.get('price')), status: fd.get('status'), listingDate: fd.get('listingDate'),
    amenities: fd.getAll('amenities'), specs,
  };
  if (!data.title || !(data.area > 0) || !(data.price > 0)) { toast('Title, area and price are required.'); return; }
  let p;
  if (id) {
    p = getProp(id);
    if (p.type !== type) { // rebuild legal checklist for the new type, keep matching documents
      const old = Object.fromEntries(p.legal.map(d => [d.key, d]));
      p.legal = LEGAL_BY_TYPE[type].map(k => old[k] || { key: k, status: 'not', verifiedBy: '', date: '', file: '', note: '' });
    }
    Object.assign(p, data);
    logHistory(p, 'Specification updated');
  } else {
    p = Object.assign(data, {
      id: 'PROP-' + (++DB.counters.prop), images: 0,
      location: { lat: '', lng: '', roadType: '', roadWidth: '', highway: { name: '', distanceKm: '', route: '' }, nearby: [] },
      legal: LEGAL_BY_TYPE[type].map(k => ({ key: k, status: 'not', verifiedBy: '', date: '', file: '', note: '' })),
      valuation: { reviewDate: '', valuerReport: '', notes: '', comparables: [] }, history: [],
    });
    logHistory(p, 'Property listed');
    DB.properties.unshift(p);
  }
  save(); toast(id ? 'Property saved' : `Property ${p.id} created — now add location, legal and valuation details`);
  go(`#/properties/${p.id}/${id ? 'specs' : 'location'}`);
};
/* ---------- detail ---------- */
const PROP_TABS = [['overview', 'Overview'], ['location', 'Location'], ['legal', 'Legal & documents'], ['pricing', 'Pricing & valuation'], ['matches', 'Matching customers'], ['media', 'Media'], ['history', 'History']];
function viewProperty(id, tab) {
  const p = getProp(id);
  if (!p) return { title: 'Not found', html: '<div class="card empty">Property not found. <a href="#/properties">Back to list</a></div>' };
  const ls = legalSummary(p);
  if (tab === 'specs') tab = 'overview'; // old links
  const body = { overview: propOverview, location: propLocation, legal: propLegal, pricing: propPricing, matches: propMatches, media: propMedia, history: propHistory }[tab] || propOverview;
  const nMatch = matchesForProperty(p, DB).length;
  return {
    title: p.title, crumbs: `Specification data / <a href="#/properties">Properties</a> / <b>${p.id}</b>`,
    html: `
    <div class="ent-head">
      <div class="av">${p.type === 'plot' ? '▦' : p.type === 'flat' ? '🏢' : p.type === 'house' ? '🏡' : '🏬'}</div>
      <div class="meta"><h1>${esc(p.title)}</h1>
        <div class="row">${chip(p.id, 'outline mono')} ${chip(categoryOf(p.type))} ${chip(typeLabel(p.type), 'blue')} ${chip(p.purpose)} ${chip(p.status, STATUS_TONE[p.status])} ${(p.badges || []).map(b => chip(esc(b.l) + (b.doc ? '' : ' · document pending'), b.doc ? 'blue' : 'amber')).join(' ')}</div>
        <div class="row muted" style="margin-top:6px">📍 ${esc(p.locality)}, ${esc(p.city)}, ${esc(p.state)} · ${num(p.area)} sq.ft.${p.facing ? ` · ${esc(p.facing)} facing` : ''} · listed ${fmtDate(p.listingDate)}</div>
      </div>
      <div class="price"><div class="p">${inr(p.price)}</div><div class="muted">${inr(pricePerSqft(p))} / sq.ft. (${PROPERTY_TYPES[p.type].areaBasis})</div>
        <div class="row" style="justify-content:flex-end;margin-top:8px">${propHeaderActions(p)}</div></div>
    </div>
    ${p.archived ? `<div class="note" style="margin-bottom:12px">🗄 <b>Archived</b> on ${fmtDate(p.archivedDate)} by ${esc(p.archivedBy)}${p.archiveReason ? ' — ' + esc(p.archiveReason) : ''}. Hidden from the property list, matching and new bookings. Existing customer links and history are kept.</div>` : ''}
    ${ls.openMandatory.length ? `<div class="note amber" style="margin-bottom:12px">⚠ Mandatory checks unresolved: <b>${ls.openMandatory.join(', ')}</b>. The matching engine will show this property only as a <i>Conditional match</i> — it can’t be a top recommendation until they’re verified.</div>` : ''}
    <div class="tabs">${PROP_TABS.map(([k, l]) => `<a href="#/properties/${p.id}/${k}" class="${tab === k ? 'on' : ''}">${l}${k === 'matches' ? ` <span class="chip">${nMatch}</span>` : k === 'legal' ? ` <span class="chip ${ls.openMandatory.length ? 'amber' : 'green'}">${ls.verified}/${ls.total}</span>` : ''}</a>`).join('')}</div>
    ${body(p)}`,
  };
}
/** Overview (first tab): photos, key facts, filled-in details only (+ add chips for the rest), and beside them
    what's missing, what needs attention and the best-matching buyers. */
function propOverview(p) {
  const t = PROPERTY_TYPES[p.type], edit = `#/properties/${p.id}/edit`;
  const val = (f, v) => (f.t === 'number' && /₹/.test(f.l) ? inr(v) : f.t === 'number' ? num(v) : esc(v));
  const filled = t.fields.filter(f => !(p.specs[f.k] === '' || p.specs[f.k] == null));
  const empty = t.fields.filter(f => p.specs[f.k] === '' || p.specs[f.k] == null);
  const dl = rows => `<div class="dl3">${rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
  // photos
  const n = p.images || 0;
  const photos = n
    ? `<div class="ov-photos">${Array.from({ length: Math.min(n, 4) }, (_, i) => `<div class="ov-ph ${i === 0 ? 'cover' : ''}">${i === 0 ? '🏠' : '🖼'}<small>${i === 0 ? 'Cover' : 'Photo ' + (i + 1)}</small>${i === 3 && n > 4 ? `<b class="ov-more">+${n - 4}</b>` : ''}</div>`).join('')}
        <a class="ov-ph add" href="${edit}/media">＋<small>Add photos</small></a></div>`
    : `<a class="ov-nophoto" href="${edit}/media"><span>📷</span><div><b>No photos yet</b><small>Listings with photos get far more enquiries — add some (+10%)</small></div><span class="btn sm">＋ Add photos</span></a>`;
  // key facts (only what is known)
  const facts = [['Type', `${t.label} <small class="muted">· ${t.category}</small>`], ['Purpose', esc(p.purpose)], ['Asking price', `${inr(p.price)}${p.priceOnRequest ? ' <small class="muted">(hidden on listing)</small>' : ''}`],
    [t.areaLabel.replace(' (sq.ft.)', ''), `${num(p.area)} sq.ft. <small class="muted">· ${inr(pricePerSqft(p))}/sq.ft.</small>`], ['Location', `${esc(p.locality)}, ${esc(p.city)}`],
    ...(p.facing ? [['Facing', esc(p.facing)]] : []), ['Status', chip(p.status, STATUS_TONE[p.status])], ['Listed', fmtDate(p.listingDate)]];
  // details: filled only; the rest as one-click chips that open the assistant on that field
  const addChips = empty.slice(0, 6).map(f => `<a class="ov-add" href="${edit}/field-${f.k}">＋ ${esc(f.l.replace(/ \(.*\)$/, ''))}</a>`).join('') + (empty.length > 6 ? `<a class="ov-add more" href="${edit}/details">+${empty.length - 6} more</a>` : '');
  const details = filled.map(f => [esc(f.l), val(f, p.specs[f.k])]).concat((p.extra || []).map(x => [esc(x.label), esc(x.value)]));
  // side: completion
  const sc = typeof AddProperty !== 'undefined' ? AddProperty.listedScore(p) : { score: 100, missing: [] };
  const fixFor = m => (/photo/i.test(m) ? [`${edit}/media`, '📎 Add'] : /legal/i.test(m) ? [`#/properties/${p.id}/legal`, 'Open'] : /key details/i.test(m) ? [`${edit}/details`, 'Add'] : [edit, 'Add']);
  const missingRows = sc.missing.map(m => { const [href, l] = fixFor(m); const [, name, pts] = m.match(/^(.*) \((\+\d+%)\)$/) || [, m, '']; return `<li><span class="ic">○</span><span class="tx">${esc(name)}</span><span class="pts">${pts}</span><a class="btn sm" href="${href}">${l}</a></li>`; }).join('');
  // side: needs attention
  const attn = typeof propAttention === 'function' ? propAttention(p).filter(i => i.k !== 'details') : [];
  // side: best-matching buyers
  const top = matchesForProperty(p, DB).slice(0, 3);
  return `<div class="ov">
    <div class="ov-main">
      ${photos}
      <div class="card"><div class="card-head"><h2>Key facts</h2><span class="sp"></span><a class="btn sm" href="${edit}">✨ Edit with AI</a></div>${dl(facts)}</div>
      <div class="card"><div class="card-head"><h2>${esc(t.label)} details</h2><span class="sp"></span><small class="muted">${filled.length} of ${t.fields.length} filled in</small></div>
        ${details.length ? dl(details) : '<p class="muted" style="margin:0">No details yet.</p>'}
        ${empty.length ? `<div class="ov-adds"><span class="muted">Add:</span>${addChips}</div>` : ''}</div>
      <div class="card"><div class="card-head"><h2>Amenities</h2><span class="sp"></span>${p.amenities.length ? '' : `<a class="btn sm" href="${edit}/details">＋ Add</a>`}</div>
        <div class="row">${p.amenities.length ? p.amenities.map(a => chip(esc(a), 'outline')).join(' ') : '<span class="muted">None added yet (+5%)</span>'}</div></div>
    </div>
    <div class="ov-side">
      <div class="card ov-score"><div class="ov-score-top">${typeof AddProperty !== 'undefined' ? AddProperty.ring(sc.score, 60) : ''}<div><h2>${sc.score === 100 ? 'Listing complete' : 'Listing completion'}</h2><small class="muted">${sc.score === 100 ? 'Everything is in — nice.' : 'Add these to reach 100%'}</small></div></div>
        ${missingRows ? `<ul class="sfacts">${missingRows}</ul>` : ''}</div>
      ${attn.length ? `<div class="card ov-attn"><h2>✨ Needs attention</h2>${attn.map(i => `<div class="ov-attn-row"><span>⚠ ${esc(i.l)}</span><a href="${i.fix}">${esc(i.act)} →</a></div>`).join('')}</div>` : ''}
      <div class="card"><div class="card-head"><h2>Approvals</h2><span class="sp"></span><a class="btn sm" href="#/properties/${p.id}/legal">Documents</a></div>
        <div class="row">${(p.badges || []).length ? p.badges.map(b => chip(esc(b.l) + (b.doc ? '' : ' · document pending'), b.doc ? 'blue' : 'amber')).join(' ') : '<span class="muted">No approval badges</span>'}</div></div>
      <div class="card"><div class="card-head"><h2>Best-matching buyers</h2><span class="sp"></span>${top.length ? `<a href="#/properties/${p.id}/matches">See all</a>` : ''}</div>
        ${top.length ? top.map(({ cust: c, m }) => `<a class="ov-buyer" href="#/customers/${c.id}/matches"><span class="ov-av">${esc(c.name.split(' ').map(x => x[0]).join('').slice(0, 2))}</span><span class="ov-bn"><b>${esc(c.name)}</b><small>${inrShort(c.budget.min)} – ${inrShort(c.budget.max)} · ${esc(c.stage)}</small></span>${chip(m.M + '% fit', m.tone, m.label)}</a>`).join('')
          : `<p class="muted" style="margin:0">${p.status !== 'Available' ? `Not offered — it is ${esc(p.status)}.` : 'No active buyer fits yet.'}</p>`}</div>
    </div>
  </div>`;
}
function propLocation(p) {
  const L = p.location, cityInfo = CITIES[p.city] || {};
  const nearbyRows = L.nearby.map((n, i) => `
    <tr>
      <td>${bSel('p', p.id, `location.nearby.${i}.cat`, n.cat, NEARBY_CATEGORIES)}</td>
      <td>${bIn('p', p.id, `location.nearby.${i}.name`, n.name)}</td>
      <td style="width:110px">${bIn('p', p.id, `location.nearby.${i}.distanceKm`, n.distanceKm, 'number')}</td>
      <td style="text-align:center">${bChk('p', p.id, `location.nearby.${i}.routeChecked`, n.routeChecked, '')}</td>
      <td>${bSel('p', p.id, `location.nearby.${i}.status`, n.status, INFRA_STATUSES)}</td>
      <td>${n.status !== 'Existing' ? chip('Not an existing benefit', 'amber') : !n.routeChecked ? chip('Route not checked', 'amber') : chip('OK to advertise', 'green')}</td>
      <td><button class="btn ghost sm danger" data-act="rmNearby" data-id="${p.id}" data-i="${i}" title="Remove">✕</button></td>
    </tr>`).join('');
  const adv = L.nearby.filter(n => n.status === 'Existing' && n.routeChecked);
  const future = L.nearby.filter(n => n.status !== 'Existing');
  const hidden = L.nearby.filter(n => n.status === 'Existing' && !n.routeChecked);
  const mapLink = L.lat && L.lng ? `<a href="https://www.google.com/maps?q=${L.lat},${L.lng}" target="_blank" rel="noopener">Open in maps ↗</a>` : '';
  return `
  <div class="grid g-side">
    <div>
      <div class="card"><div class="card-head"><h2>C. Location specification</h2><span class="sp"></span><small>Edits save automatically</small></div>
        <div class="fgrid">
          ${fld('State', `<input value="${esc(p.state)}" disabled>`)}
          ${fld('District', `<input value="${esc(cityInfo.district || p.city)}" disabled>`)}
          ${fld('Locality', bIn('p', p.id, 'locality', p.locality))}
          ${fld('Latitude', bIn('p', p.id, 'location.lat', L.lat, 'number'))}
          ${fld('Longitude', bIn('p', p.id, 'location.lng', L.lng, 'number'))}
          ${fld('Road type', bIn('p', p.id, 'location.roadType', L.roadType))}
          ${fld('Road width (ft)', bIn('p', p.id, 'location.roadWidth', L.roadWidth, 'number'))}
          ${fld('Highway access', bIn('p', p.id, 'location.highway.name', L.highway.name))}
          ${fld('Highway distance (km, by road)', bIn('p', p.id, 'location.highway.distanceKm', L.highway.distanceKm, 'number'))}
          ${fld('Highway route — how it was measured', bIn('p', p.id, 'location.highway.route', L.highway.route), { cls: 'span3' })}
        </div></div>
      <div class="card"><div class="card-head"><h2>Schools, hospitals, transport &amp; infrastructure</h2><span class="sp"></span><button class="btn sm" data-act="addNearby" data-id="${p.id}">＋ Add place</button></div>
        <p class="muted" style="margin-top:-6px">Record the <b>measured</b> road distance. Tick “route checked” only after the actual route and travel conditions were verified.</p>
        <div class="tbl-wrap"><table><thead><tr><th>Category</th><th>Name</th><th>Distance (km)</th><th>Route checked</th><th>Status</th><th>Advertising</th><th></th></tr></thead>
        <tbody>${nearbyRows || '<tr><td colspan="7" class="empty">No places recorded yet.</td></tr>'}</tbody></table></div>
      </div>
    </div>
    <div>
      <div class="card"><div class="card-head"><h2>Map</h2><span class="sp"></span>${mapLink}</div>
        <div class="ph map"><span class="pin">📍</span><span style="margin-top:120px">${L.lat && L.lng ? `${L.lat}, ${L.lng}` : 'Add GPS coordinates'}</span></div></div>
      <div class="card"><h2>Customer-facing preview</h2>
        <p class="muted" style="margin-top:-4px">What the listing may claim, generated from the rules above.</p>
        <b style="font-size:13px">Nearby (measured by road)</b>
        <ul class="why">${adv.map(n => `<li>${esc(n.name)} — ${n.distanceKm} km</li>`).join('') || '<li class="muted">Nothing verified yet</li>'}
          ${L.highway.name ? `<li>${esc(L.highway.name)} — ${L.highway.distanceKm} km</li>` : ''}</ul>
        ${future.length ? `<b style="font-size:13px">Future infrastructure — not yet existing</b><ul class="why">${future.map(n => `<li>${esc(n.name)} <span class="chip amber">${n.status}</span></li>`).join('')}</ul>` : ''}
        ${hidden.length ? `<div class="note amber" style="margin-top:8px">${hidden.length} place(s) hidden until the route is checked — never say “5 minutes away” without verifying.</div>` : ''}
      </div>
    </div>
  </div>`;
}
function propLegal(p) {
  const s = legalSummary(p), mand = MANDATORY_BY_TYPE[p.type];
  const rows = p.legal.map((d, i) => {
    const meta = LEGAL_DOCS[d.key], st = LEGAL_STATUS[d.status];
    return `<tr>
      <td><b>${meta.n}</b> ${mand.includes(d.key) ? chip('Mandatory', 'purple') : ''}<br><small>${meta.v}</small></td>
      <td style="min-width:230px">${bSel('p', p.id, `legal.${i}.status`, d.status, Object.entries(LEGAL_STATUS).map(([v, o]) => ({ v, l: o.l })))}<div style="margin-top:4px">${chip(st.l, st.tone)}</div></td>
      <td>${bIn('p', p.id, `legal.${i}.verifiedBy`, d.verifiedBy, 'text', d.status !== 'verified' ? 'disabled placeholder="Only when verified"' : 'placeholder="Advocate / firm"')}</td>
      <td style="width:150px">${bIn('p', p.id, `legal.${i}.date`, d.date, 'date')}</td>
      <td>${d.file ? `<span class="mono">📄 ${esc(d.file)}</span>` : `<button class="btn sm" data-act="uploadDoc" data-id="${p.id}" data-i="${i}">⤒ Upload</button>`}</td>
      <td>${bIn('p', p.id, `legal.${i}.note`, d.note, 'text', 'placeholder="Notes"')}</td>
    </tr>`;
  }).join('');
  return `
  <div class="grid g3" style="margin-bottom:14px">
    <div class="card kpi"><div class="lbl">Verified by authorised legal professional</div><div class="val" style="color:var(--green)">${s.verified}</div><div class="sub">of ${s.total} checks</div></div>
    <div class="card kpi"><div class="lbl">Collected, pending verification</div><div class="val" style="color:var(--amber)">${s.pending}</div><div class="sub">uploaded ≠ verified</div></div>
    <div class="card kpi"><div class="lbl">Not collected</div><div class="val">${s.not}</div><div class="sub">${s.openMandatory.length ? `${s.openMandatory.length} mandatory check(s) open` : 'all mandatory checks verified'}</div></div>
  </div>
  <div class="card"><div class="card-head"><h2>D. Legal &amp; documentation checklist — ${typeLabel(p.type)}</h2></div>
    <div class="note" style="margin-bottom:12px">These checks are <b>not interchangeable</b> — e.g. a DTCP or other planning approval does not by itself prove clear ownership. Status is one of three values only; the system never displays “100% legally clear”.</div>
    <div class="tbl-wrap"><table><thead><tr><th>Document / check</th><th>Status</th><th>Verified by</th><th>Date</th><th>File</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table></div>
  </div>
  <div class="card"><h2>Customer-facing wording</h2>
    <p style="margin:0">“${s.verified} of ${s.total} document checks verified by an authorised legal professional${s.verified ? ` (latest ${fmtDate(p.legal.filter(d => d.status === 'verified').map(d => d.date).sort().pop())})` : ''}.${s.pending ? ` ${s.pending} collected and pending verification.` : ''}${s.not ? ` ${s.not} not yet collected.` : ''}”</p>
  </div>`;
}
function propPricing(p) {
  const v = valuationSummary(p, DB.settings), V = p.valuation;
  const compRows = V.comparables.map((c, i) => `<tr>
    <td>${bIn('p', p.id, `valuation.comparables.${i}.location`, c.location)}</td>
    <td>${bIn('p', p.id, `valuation.comparables.${i}.type`, c.type)}</td>
    <td style="width:100px">${bIn('p', p.id, `valuation.comparables.${i}.area`, c.area, 'number')}</td>
    <td style="width:110px">${bIn('p', p.id, `valuation.comparables.${i}.pricePerSqft`, c.pricePerSqft, 'number')}</td>
    <td style="width:130px">${bSel('p', p.id, `valuation.comparables.${i}.kind`, c.kind, ['Asking', 'Transaction'])}</td>
    <td style="width:145px">${bIn('p', p.id, `valuation.comparables.${i}.date`, c.date, 'date')}</td>
    <td>${bIn('p', p.id, `valuation.comparables.${i}.source`, c.source)}</td>
    <td>${bIn('p', p.id, `valuation.comparables.${i}.differences`, c.differences)}</td>
    <td><button class="btn ghost sm danger" data-act="rmComp" data-id="${p.id}" data-i="${i}">✕</button></td></tr>`).join('');
  const maxP = Math.max(v.ppsf || 0, ...V.comparables.map(c => Number(c.pricePerSqft) || 0)) || 1;
  const bars = [{ l: 'This property (asking)', val: v.ppsf, me: 1 }].concat(V.comparables.map(c => ({ l: `${c.location} · ${c.kind}`, val: Number(c.pricePerSqft) })))
    .map(b => `<div class="bar-row"><span style="font-size:12px">${esc(b.l)}</span>${meter(b.val / maxP * 100, b.me ? '' : 'grey')}<span class="num" style="font-size:12px">${num(b.val)}</span></div>`).join('');
  const posTone = !v.count ? 'grey' : v.position.startsWith('Within') ? 'green' : 'amber';
  return `
  <div class="grid g2">
    <div class="card"><h2>E. Asking price</h2>
      <div class="fgrid c2">
        ${fld('Asking price (₹)', bIn('p', p.id, 'price', p.price, 'number'))}
        ${fld(PROPERTY_TYPES[p.type].areaLabel, bIn('p', p.id, 'area', p.area, 'number'))}
        ${fld('Price review date', bIn('p', p.id, 'valuation.reviewDate', V.reviewDate, 'date'))}
        ${fld('Asking price per sq.ft.', `<input value="${inr(v.ppsf)}" disabled>`)}
      </div>
      <div class="formula" style="margin-top:12px">Price per sq.ft. = Total property price ÷ Area in sq.ft.<br>${inr(p.price)} ÷ ${num(p.area)} = <b>${inr(v.ppsf)}</b></div>
    </div>
    <div class="card"><h2>Value positioning</h2>
      ${v.count ? `
      <div class="dl3" style="grid-template-columns:repeat(2,1fr)">
        <div><span>Average comparable</span><b>${inr(v.avg)}/sq.ft.</b></div>
        <div><span>Transaction-only average</span><b>${v.txnAvg ? inr(v.txnAvg) + '/sq.ft.' : '—'}</b></div>
        <div><span>Comparable range</span><b>${inr(v.min)} – ${inr(v.max)}</b></div>
        <div><span>Asking vs average</span><b>${v.diffPct > 0 ? '+' : ''}${v.diffPct.toFixed(1)}%</b></div>
      </div>
      <div style="margin-top:10px">${chip(v.position, posTone)}</div>` : '<p class="muted">Add at least one comparable to position the price.</p>'}
      <div class="note amber" style="margin-top:12px">Never call a price a “bargain” just because another seller asks more. Compare similar properties in the same micro-market with similar approvals, access, dimensions and condition.</div>
    </div>
  </div>
  <div class="card"><div class="card-head"><h2>Comparable properties</h2><span class="sp"></span><button class="btn sm" data-act="addComp" data-id="${p.id}">＋ Add comparable</button></div>
    <div class="tbl-wrap"><table><thead><tr><th>Location</th><th>Type</th><th>Area</th><th>₹ / sq.ft.</th><th>Asking or transaction</th><th>Date</th><th>Source</th><th>Differences affecting price</th><th></th></tr></thead>
    <tbody>${compRows || '<tr><td colspan="9" class="empty">No comparables yet.</td></tr>'}</tbody></table></div>
    <div style="margin-top:14px">${bars}</div>
    <p class="muted" style="margin:8px 0 0">Illustrative numbers — not actual market prices.</p>
  </div>
  <div class="grid g2">
    <div class="card"><h2>Estimated transaction costs</h2>
      <div class="kv"><dt>Stamp duty</dt><dd>${DB.settings.costs.stampDutyPct}%</dd><dt>Registration fee</dt><dd>${DB.settings.costs.registrationPct}%</dd><dt>Other (legal, misc.)</dt><dd>${DB.settings.costs.otherPct}%</dd>
        <dt>Estimated costs</dt><dd><b>${inr(v.txnCosts)}</b></dd><dt>Estimated all-in cost</dt><dd><b>${inr(v.allIn)}</b></dd></div>
      <p class="muted" style="margin:10px 0 0">Rates are editable assumptions in <a href="#/settings">Settings</a>; confirm current rates and the guideline value before quoting. Helps clarify whether a customer’s budget includes these costs.</p>
    </div>
    <div class="card"><h2>Valuation evidence</h2>
      ${fld('Valuation professional’s report', bIn('p', p.id, 'valuation.valuerReport', V.valuerReport, 'text', 'placeholder="e.g. Registered valuer, report date"'))}
      <div style="height:10px"></div>
      ${fld('Valuation notes', `<textarea class="inline-in" data-bind="${bkey('p', p.id, 'valuation.notes')}">${esc(V.notes)}</textarea>`)}
    </div>
  </div>`;
}
function propMatches(p) {
  const list = matchesForProperty(p, DB);
  const rows = list.map(({ cust: c, m }) => {
    const rd = readiness(c, DB);
    return `<tr class="click" data-href="#/customers/${c.id}/matches">
      <td><b>${esc(c.name)}</b><br><small class="mono">${c.id}</small></td><td>${c.purpose}</td>
      <td>${inrShort(c.budget.min)} – ${inrShort(c.budget.max)}</td><td>${chip(m.label, m.tone)}</td>
      <td class="num"><b>${m.M}</b></td><td>${chip(rd.total + ' · ' + rd.band.l, rd.band.tone)}</td><td>${chip(c.stage, stageTone(c.stage))}</td><td><small>${esc(execName(DB, c.owner))}</small></td></tr>`;
  }).join('');
  return `
  ${p.status !== 'Available' ? `<div class="note amber" style="margin-bottom:12px">This property is <b>${p.status}</b>, so it is excluded by the hard filter for every customer.</div>` : ''}
  <div class="card"><div class="card-head"><h2>Customers whose requirements this property fits</h2><span class="sp"></span><small>Active leads only · hard filters applied first</small></div>
    <div class="tbl-wrap"><table><thead><tr><th>Customer</th><th>Purpose</th><th>Budget</th><th>Match</th><th class="num">Fit score</th><th>Readiness</th><th>Stage</th><th>Owner</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="8" class="empty">No active customer passes the hard filters for this property.</td></tr>'}</tbody></table></div></div>`;
}
function propMedia(p) {
  const tiles = Array.from({ length: p.images || 0 }, (_, i) => `<div class="ph">Image ${i + 1}<br>${i === 0 ? '(cover)' : ''}</div>`).join('');
  const docs = p.legal.filter(d => d.file);
  return `
  <div class="card"><div class="card-head"><h2>Images</h2><span class="sp"></span><button class="btn sm" data-act="addImage" data-id="${p.id}">⤒ Upload image</button>${p.images ? `<button class="btn sm danger" data-act="rmImage" data-id="${p.id}">Remove last</button>` : ''}</div>
    <div class="media">${tiles || '<div class="empty">No images yet.</div>'}</div></div>
  <div class="card"><h2>Documents</h2>${docs.length ? `<ul class="why">${docs.map(d => `<li class="mono">📄 ${esc(d.file)} — ${LEGAL_DOCS[d.key].n} ${chip(LEGAL_STATUS[d.status].l, LEGAL_STATUS[d.status].tone)}</li>`).join('')}</ul>` : '<p class="muted">No documents uploaded. Upload from the Legal &amp; documents tab.</p>'}</div>`;
}
function propHistory(p) {
  return `<div class="card"><h2>Change history</h2><ul class="tl">${(p.history || []).map(h => `<li><div class="when">${fmtDate(h.date)} · ${esc(h.by)}</div>${esc(h.text)}</li>`).join('') || '<li>No history.</li>'}</ul></div>`;
}
Object.assign(ACTIONS, {
  clearFilters: d => { UI.filters[d.scope] = d.scope === 'custs' ? { sort: 'readiness' } : {}; render(); },
  addNearby: d => { const p = getProp(d.id); p.location.nearby.push({ id: 'nb' + Date.now(), cat: 'School', name: '', distanceKm: '', routeChecked: false, status: 'Existing' }); save(); render(); },
  rmNearby: d => { const p = getProp(d.id); p.location.nearby.splice(+d.i, 1); save(); render(); },
  addComp: d => { const p = getProp(d.id); p.valuation.comparables.push({ location: p.locality + ', ' + p.city, type: typeLabel(p.type), area: p.area, pricePerSqft: '', kind: 'Transaction', date: DEMO_TODAY, source: '', differences: '' }); save(); render(); },
  rmComp: d => { const p = getProp(d.id); p.valuation.comparables.splice(+d.i, 1); save(); render(); },
  uploadDoc: d => {
    const p = getProp(d.id), doc = p.legal[+d.i];
    doc.file = `${doc.key}-scan.pdf`; if (doc.status === 'not') doc.status = 'pending'; doc.date = doc.date || DEMO_TODAY;
    logHistory(p, `Document uploaded: ${LEGAL_DOCS[doc.key].n} (pending verification)`); save(); toast('Uploaded (mock) — status set to “Collected, pending verification”'); render();
  },
  addImage: d => { const p = getProp(d.id); p.images = (p.images || 0) + 1; save(); render(); },
  rmImage: d => { const p = getProp(d.id); p.images = Math.max(0, (p.images || 0) - 1); save(); render(); },
});
/* ---------- archive / restore / delete ---------- */
const MANAGE_TITLE = 'disabled title="Admin / Sales manager only"';
function propHeaderActions(p) {
  const dis = canEditSettings() ? '' : MANAGE_TITLE;
  if (p.archived) return `${chip('Archived', 'outline')}<button class="btn" data-act="propRestore" data-id="${p.id}" ${dis}>↺ Restore</button><button class="btn danger" data-act="propDeleteOpen" data-id="${p.id}" ${dis}>🗑 Delete</button>`;
  return `${bSel('p', p.id, 'status', p.status, PROPERTY_STATUSES, 'style="width:auto" title="Change status"')}<a class="btn primary" href="#/properties/${p.id}/edit" title="Tell the AI assistant what changed">✨ Edit with AI</a>
    <button class="btn" data-act="propArchiveOpen" data-id="${p.id}" ${dis}>🗄 Archive</button><button class="btn danger" data-act="propDeleteOpen" data-id="${p.id}" ${dis}>🗑 Delete</button>`;
}
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
    const docs = p.legal.filter(d => d.file).length;
    return {
      title: `Delete ${p.id} permanently?`, submit: 'Delete permanently',
      html: `<p style="margin-top:0"><b>${esc(p.title)}</b><br><small class="muted">${typeLabel(p.type)} · ${esc(p.locality)}, ${esc(p.city)} · ${inrShort(p.price)} · ${p.status}</small></p>
        <div class="note green" style="margin-bottom:10px">✓ No customer record refers to this property, so it can be deleted.</div>
        <div class="note red">This <b>cannot be undone</b>. The specification, location, ${p.legal.length} legal checks (${docs} with documents), ${p.valuation.comparables.length} comparables, ${p.images || 0} images and the change history will be removed.</div>
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
  propArchiveOpen: d => { if (canEditSettings()) openModal({ kind: 'propArchive', id: d.id }); },
  propDeleteOpen: d => { if (canEditSettings()) openModal({ kind: 'propDelete', id: d.id }); },
  propRestore: d => {
    if (!canEditSettings()) return;
    const p = getProp(d.id); p.archived = false; logHistory(p, 'Restored from archive');
    save(); toast(`${p.id} restored`); render();
  },
  propGo: d => { UI.modal = null; go(d.href); render(); },
});