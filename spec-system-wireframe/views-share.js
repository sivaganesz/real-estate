/* =====================================================================
   Share a property — the brochure the customer receives (#/properties/ID/share)
   One page built from the property's data — nothing is typed again. The same rules as everywhere else:
     · nearby places: only existing ones whose route is checked (or that need no check) — as the Customer view;
     · approvals: only verified ones become badges; a pending document is never advertised;
       the brochure never says "legally clear" — documents are shared on request;
     · never shown: the owner's contact, internal notes, the price check and comparables, documents,
       survey / layout numbers; extra details (e.g. from an import) only when someone switches them on.
   Sharing it (link or PDF) is logged on the property's History, and — when a buyer is chosen — on the buyer's
   timeline, and adds it to their recommendations (like ✓ Recommend), so the Lead pipeline shows it too.
   WhatsApp sending comes later with the WhatsApp integration.
   ===================================================================== */

UI.share = { pid: '', cust: '', exact: false, total: true };
/** Details kept off the brochure — shared on request with the documents. */
const SHARE_HIDDEN_FIELDS = ['surveyNo', 'subdivision', 'layoutApproval'];
const shareToken = p => 'p/' + p.id.replace('PROP-', '') + nbHash(p.id + p.title).toString(36);
const shareUrl = p => `https://realspec.in/${shareToken(p)}`;
const shareBuyers = p => DB.customers.filter(c => isActive(c)).map(c => ({ c, m: matchScore(c, p, DB.settings) })).sort((a, b) => b.m.M - a.m.M);
const shortName = n => String(n || '').replace(/^Executive \d+ — /, '');

/** What goes on the brochure, and what is held back (and why) — one place for the rules. */
function shareContent(p) {
  const t = PROPERTY_TYPES[p.type], L = normLoc(p), exact = nbExact(L);
  const val = (f, v) => (f.t === 'number' && /₹/.test(f.l) ? inr(v) : f.t === 'number' ? num(v) + (/\(ft\)/.test(f.l) ? ' ft' : /sq\.ft/.test(f.l) ? ' sq.ft.' : '') : esc(v));
  const facts = [[t.areaLabel.replace(' (sq.ft.)', ''), `${num(p.area)} sq.ft.`], ...(p.facing ? [['Facing', esc(p.facing)]] : [])]
    .concat(t.fields.filter(f => !SHARE_HIDDEN_FIELDS.includes(f.k) && !(p.specs[f.k] === '' || p.specs[f.k] == null)).map(f => [esc(f.l.replace(/ \(.*\)$/, '')), val(f, p.specs[f.k])]))
    .concat((p.extra || []).filter(x => x.public).map(x => [esc(x.label), esc(x.value)]));
  const named = L.nearby.filter(x => x.name);
  const places = named.filter(nbOK), held = named.filter(x => !nbOK(x));
  normLegal(p);
  const verified = p.approvals.filter(a => a.status === 'verified'), notYet = p.approvals.filter(a => a.status !== 'verified');
  const v = valuationSummary(p, DB.settings), c = DB.settings.costs;
  return { t, L, exact, facts, places, held, verified, notYet, v, c, hiddenFields: t.fields.filter(f => SHARE_HIDDEN_FIELDS.includes(f.k) && p.specs[f.k]) };
}

function viewPropShare(id) {
  const p = getProp(id);
  if (!p) return { title: 'Not found', html: '<div class="card empty">Property not found. <a href="#/properties">Back to list</a></div>' };
  const S = UI.share;
  if (S.pid !== p.id) Object.assign(S, { pid: p.id, cust: '', exact: false, total: true });
  const K = shareContent(p), live = p.status === 'Available' && !p.archived;
  const buyers = shareBuyers(p), cust = S.cust ? getCust(S.cust) : null;
  const n = p.images || 0, shares = p.shares || [];
  // the checks: what the customer will and won't see
  const ok = (good, html) => `<li class="${good ? 'ok' : 'warn'}"><span class="ic">${good ? '✓' : '⚠'}</span><span>${html}</span></li>`;
  const checks = [
    ok(n > 0, n ? `${n} photo${n > 1 ? 's' : ''}` : `No photos yet — <a href="#/properties/${p.id}">add some</a> before sharing`),
    ok(true, `${K.places.length} nearby place${K.places.length === 1 ? '' : 's'} shown${K.held.length ? ` · <b>${K.held.length} hidden</b> until the route is checked (<a href="#/properties/${p.id}/location">check</a>)` : ''}`),
    ...K.verified.map(a => ok(true, `${esc(approvalOf(a.k).long)} — verified, shown as a badge`)),
    ...K.notYet.map(a => ok(false, `${esc(approvalOf(a.k).long)} — ${a.status === 'pending' ? 'document pending' : 'waiting for verification'}, <b>not shown</b> (<a href="#/properties/${p.id}/legal">open</a>)`)),
    ok(K.exact, K.exact ? 'Exact location set' : 'No exact location yet — the brochure shows the locality only'),
  ].join('');
  const extras = (p.extra || []).map((x, i) => `<label class="check"><input type="checkbox" data-chg="shareExtra" data-id="${p.id}" data-i="${i}" ${x.public ? 'checked' : ''}> ${esc(x.label)} <small class="muted">“${esc(x.value)}”</small></label>`).join('');
  const panel = `<div class="card sh-panel">
      <h2>Share with a customer</h2>
      ${live ? '' : `<div class="note amber" style="margin-bottom:10px">${p.archived ? 'Archived' : esc(p.status)} — not on offer, so sharing is off.</div>`}
      <label class="sh-lbl">For</label>
      <select data-chg="shareCust" ${live ? '' : 'disabled'}><option value="">Anyone (no name on it)</option>${buyers.map(({ c, m }) => `<option value="${c.id}" ${S.cust === c.id ? 'selected' : ''}>${esc(c.name)} — ${m.M}% fit${(c.recommended || []).includes(p.id) ? ' · recommended' : ''}</option>`).join('')}</select>
      <small class="muted">${cust ? `Their name goes on the brochure. Sharing logs it on their timeline and adds it to their recommendations.` : 'Best-matching buyers first.'}</small>
      <label class="sh-lbl">Show</label>
      <label class="check"><input type="checkbox" data-chg="shareOpt" data-k="total" ${S.total ? 'checked' : ''}> Total cost for the buyer <small class="muted">(stamp duty &amp; registration)</small></label>
      <label class="check ${K.exact ? '' : 'dis'}"><input type="checkbox" data-chg="shareOpt" data-k="exact" ${S.exact && K.exact ? 'checked' : ''} ${K.exact ? '' : 'disabled'}> Exact location (map pin) <small class="muted">${K.exact ? 'off = locality only, pin at the site visit' : 'not set yet'}</small></label>
      ${extras ? `<label class="sh-lbl">Extra details <small class="muted">— internal unless switched on</small></label>${extras}` : ''}
      <div class="sh-acts">
        <button class="btn primary" data-act="shareDo" data-id="${p.id}" data-how="link" ${live ? '' : 'disabled'}>🔗 Copy link</button>
        <button class="btn" data-act="shareDo" data-id="${p.id}" data-how="pdf" ${live ? '' : 'disabled'}>📄 Download PDF</button></div>
      <small class="muted">WhatsApp sending comes with the WhatsApp integration (later).</small>
      <label class="sh-lbl">Before you share</label>
      <ul class="sh-checks">${checks}</ul>
      <p class="sh-never">Never on the brochure: the owner’s contact, internal notes, the price check, documents${K.hiddenFields.length ? `, ${K.hiddenFields.map(f => esc(f.l.replace(/ \(.*\)$/, '').toLowerCase())).join(', ')}` : ''}.</p>
      ${shares.length ? `<label class="sh-lbl">Shared ${shares.length} time${shares.length > 1 ? 's' : ''}</label><ul class="sh-log">${shares.slice(0, 5).map(s => `<li>${fmtDate(s.date)} · ${s.how === 'pdf' ? 'PDF' : 'link'}${s.cust ? ` · <a href="#/customers/${s.cust}">${esc((getCust(s.cust) || {}).name || s.cust)}</a>` : ''} <small class="muted">by ${esc(s.by)}</small></li>`).join('')}</ul>` : ''}
    </div>`;
  return {
    title: 'Share ' + p.title, crumbs: `Specification data / <a href="#/properties">Properties</a> / <a href="#/properties/${p.id}">${p.id}</a> / <b>Share</b>`,
    html: `<div class="page-head no-print"><div><h1>Share</h1><p>Exactly what the customer receives — built from the property, with only what may be advertised.</p></div><span class="sp"></span><a class="btn" href="#/properties/${p.id}">← ${esc(p.id)}</a></div>
      <div class="sh">${brochureHtml(p, K, cust)}<div class="no-print">${panel}</div></div>`,
  };
}

/** The brochure itself (also what the PDF prints). */
function brochureHtml(p, K, cust) {
  const S = UI.share, n = p.images || 0, { v, c } = K;
  // the buyer's own executive; otherwise whoever shares it — a manager's brochure says "our sales team"
  const owner = cust && DB.settings.executives.some(e => e.id === cust.owner) ? execName(DB, cust.owner) : UI.role === 'Sales executive' ? currentUser() : '';
  const contact = owner ? shortName(owner) : 'our sales team';
  const photos = n ? `<div class="br-photos">${Array.from({ length: Math.min(n, 3) }, (_, i) => `<div class="br-ph ${i === 0 ? 'cover' : ''}">${i === 0 ? '🏠' : '🖼'}${i === 2 && n > 3 ? `<b>+${n - 3}</b>` : ''}</div>`).join('')}</div>`
    : '<div class="br-photos none"><div class="br-ph cover">📷<small>Photos coming soon</small></div></div>';
  const groups = PLACE_GROUPS.map(g => ({ g, xs: K.places.filter(x => (catOf(x.cat).group || 'other') === g.k) })).filter(x => x.xs.length);
  const pct = n => `${c[n]}%`;
  return `<article class="br-sheet" id="brochure">
    <header class="br-top"><span class="br-logo">RE</span><b>RealSpec Properties</b><span class="sp"></span><small>${cust ? `Prepared for <b>${esc(cust.name)}</b> · ` : ''}${fmtDate(DEMO_TODAY)}</small></header>
    ${photos}
    <div class="br-body">
      <div class="br-kicker">${esc(K.t.label)} · For ${esc(p.purpose.toLowerCase())}</div>
      <h1 class="br-title">${esc(p.title)}</h1>
      <div class="br-loc">📍 ${esc(p.locality)}, ${esc(p.city)}</div>
      ${K.verified.length ? `<div class="br-badges">${K.verified.map(a => `<span class="br-badge">✓ ${esc(approvalOf(a.k).long)}</span>`).join('')}</div>` : ''}
      <div class="br-price">${p.priceOnRequest ? '<div><b>Price on request</b></div>' : `<div><b>${inr(p.price)}</b><small>${inr(pricePerSqft(p))} / sq.ft.</small></div>
        ${S.total ? `<div class="br-total"><span>Approx. total for you</span><b>${inr(v.allIn)}</b><small>incl. stamp duty ${pct('stampDutyPct')}, registration ${pct('registrationPct')}${+c.otherPct ? `, other ${pct('otherPct')}` : ''} — an estimate</small></div>` : ''}`}</div>
      <h3>Key facts</h3>
      <div class="br-facts">${K.facts.map(([k, val]) => `<div><span>${k}</span><b>${val}</b></div>`).join('')}</div>
      ${p.amenities.length ? `<h3>Amenities</h3><div class="br-amen">${p.amenities.map(a => `<span>${esc(a)}</span>`).join('')}</div>` : ''}
      ${groups.length ? `<h3>Nearby</h3><div class="br-near">${groups.map(({ g, xs }) => `<div><b>${g.i} ${esc(g.l)}</b>${xs.map(x => `<span>${esc(x.name)} <small>${kmTxt(x, !K.exact || !x.routeChecked)}</small></span>`).join('')}</div>`).join('')}</div>` : ''}
      <h3>Location</h3>
      <p class="br-where">${esc(p.locality)}, ${esc(p.city)}${S.exact && K.exact ? ` · <a href="https://maps.google.com/?q=${K.L.lat},${K.L.lng}">📍 Open the exact location in Google Maps</a>` : ' · the exact location is shared at the site visit'}</p>
    </div>
    <footer class="br-foot"><div><b>Talk to ${esc(contact)}</b><small>RealSpec Properties · reply to this message or call to book a site visit</small></div><span class="br-link">${esc(shareUrl(p))}</span></footer>
    <p class="br-fine">Details as provided by the owner and checked by our team. Distances marked ~ are approximate. Approval documents and title papers are shared on request — please verify them before buying.</p>
  </article>`;
}

/** Share it: copy the link or print the PDF; log it on the property, and on the buyer (as a recommendation). */
function shareDo(p, how) {
  const S = UI.share, c = S.cust ? getCust(S.cust) : null, by = currentUser();
  (p.shares = p.shares || []).unshift({ date: DEMO_TODAY, ts: Date.now(), how, cust: c ? c.id : '', by });
  logHistory(p, `Brochure shared (${how === 'pdf' ? 'PDF' : 'link'})${c ? ` with ${c.name} (${c.id})` : ''}`);
  if (c) {
    const m = matchScore(c, p, DB.settings);
    if (!(c.recommended || []).includes(p.id)) {
      (c.recommended = c.recommended || []).push(p.id);
      logActivity(c, 'Note', `Recommended ${p.id} (${m.label}, fit ${m.M}) — brochure shared (${how === 'pdf' ? 'PDF' : 'link'})`);
      if (stageIndex(c.stage) >= 0 && stageIndex(c.stage) < STAGES.indexOf('Property recommended')) moveStage(c, 'Property recommended');
    } else logActivity(c, 'Note', `Brochure of ${p.id} shared again (${how === 'pdf' ? 'PDF' : 'link'})`);
  }
  save();
  if (how === 'link') { try { navigator.clipboard.writeText(shareUrl(p)); } catch (e) { /* the toast still shows the link */ } toast(`Link copied: ${shareUrl(p)}${c ? ` — logged on ${c.name}’s timeline` : ''}`); }
  else { toast(`Brochure ready — choose “Save as PDF”${c ? ` · logged on ${c.name}’s timeline` : ''}`); setTimeout(() => window.print(), 50); }
  render();
}

Object.assign(ACTIONS, {
  shareDo: d => { const p = getProp(d.id); if (p && p.status === 'Available' && !p.archived) shareDo(p, d.how); },
});
Object.assign(CHANGES, {
  shareCust: el => { UI.share.cust = el.value; render(); },
  shareOpt: el => { UI.share[el.dataset.k] = el.checked; render(); },
  shareExtra: el => { const p = getProp(el.dataset.id), x = p.extra[+el.dataset.i]; x.public = el.checked; logHistory(p, `Extra detail “${x.label}” ${el.checked ? 'shown to' : 'hidden from'} customers`); save(); render(); },
});
