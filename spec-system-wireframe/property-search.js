/* =====================================================================
   Property search — shared by the property list and the Drafts page.
   A keyword box with an ✨ AI button (type or speak a sentence), and one light row of filter pills:
   Type · City · Budget · Size · More, with Sort on the right. Each pill opens a small panel.
   Filter state per page: UI.filters[scope] = { q, type, city, purpose, status, sort, aiText, aiRan,
   ai: { locality, minPrice, maxPrice, minArea, maxArea, bhk, facing, corner, amen[] } }
   ===================================================================== */
(function () {
  UI.filters.drafts = UI.filters.drafts || {};
  UI.ps = UI.ps || {}; // per page: { ai: expanded?, open: which pill panel is open }

  /* Each page tells the search how to read its records (a common shape) and which statuses it has. */
  const SCOPES = {
    props: {
      noun: ['property', 'properties'],
      note: () => { const n = DB.properties.filter(p => p.archived).length; return n ? `${n} archived` : ''; },
      items: () => DB.properties.map(p => ({
        raw: p, id: p.id, title: p.title, type: p.type, purpose: p.purpose, city: p.city, locality: p.locality,
        price: +p.price || 0, area: +p.area || 0, facing: p.facing, specs: p.specs || {}, amenities: p.amenities || [],
        status: p.status, archived: !!p.archived, date: p.listingDate,
        score: typeof AddProperty !== 'undefined' ? AddProperty.listedScore(p).score : 0,
        attn: typeof propAttention === 'function' && !p.archived ? propAttention(p) : [],
      })),
      statuses: PROPERTY_STATUSES.map(v => ({ v, l: v })),
      archive: true, // has an “Archived” tab
      attention: true, // has the AI “needs attention” strip (propAttention in views-properties.js)
    },
    drafts: {
      noun: ['draft', 'drafts'],
      note: () => { const n = AddProperty.searchItems().filter(x => x.status === 'Waiting for approval').length; return n ? `${n} waiting for approval` : ''; },
      items: () => (typeof AddProperty !== 'undefined' ? AddProperty.searchItems() : []),
      statuses: ['Draft', 'Ready to publish', 'Waiting for approval'].map(v => ({ v, l: v })),
    },
  };
  const PURPOSE = { Sale: 'Sale', Rent: 'Rent', Lease: 'Lease' };
  const PAGE_SIZES = [10, 15, 25, 50, 100];
  const SORTS = [{ v: '', l: 'Newest' }, { v: 'priceAsc', l: 'Price: low to high' }, { v: 'priceDesc', l: 'Price: high to low' }, { v: 'scoreAsc', l: 'Least complete first' }];
  const EXAMPLES = ['2 BHK flat in Madurai under 60 lakh', 'East-facing plot in Madurai, 25 to 32 lakh', 'Villa in Coimbatore with swimming pool', 'Shop or office in Chennai', 'Corner plot above 1400 sq.ft.'];
  const BUDGETS = [['', 30e5, 'Under ₹30 L'], [30e5, 60e5, '₹30 L – ₹60 L'], [60e5, 1e7, '₹60 L – ₹1 Cr'], [1e7, 3e7, '₹1 Cr – ₹3 Cr'], [3e7, '', 'Above ₹3 Cr']];
  const PRICES = [10e5, 20e5, 25e5, 30e5, 40e5, 50e5, 60e5, 75e5, 1e7, 1.5e7, 2e7, 3e7, 5e7];
  const AREAS = [500, 800, 1000, 1200, 1500, 2000, 2400, 3000, 5000, 10000];
  const AI_KEYS = ['locality', 'minPrice', 'maxPrice', 'minArea', 'maxArea', 'bhk', 'facing', 'corner', 'amen'];
  const st = s => (UI.ps[s] = UI.ps[s] || {});
  const F = s => UI.filters[s];
  const bhkOf = x => parseInt(x.specs.bhk, 10) || +x.specs.bedrooms || 0;

  /* ---------- matching ---------- */
  /** Does record x pass the filters f? `skip` lists criteria to leave out (used to suggest what to relax). */
  function match(s, x, f, skip = []) {
    const a = f.ai || {}, on = k => !skip.includes(k), stv = f.status || '';
    // status tabs: '' = all active, a status, or '__arch' = the Archived tab (archived ones show nowhere else)
    if (stv === '__arch' && on('status')) { if (!x.archived) return false; }
    else if (x.archived || (on('status') && stv && x.status !== stv)) return false;
    if (on('attn') && f.attn && !(x.attn || []).some(i => i.k === f.attn)) return false;
    if (on('type') && f.type && (f.type.startsWith('cat:') ? categoryOf(x.type) !== f.type.slice(4) : x.type !== f.type)) return false;
    if (on('city') && f.city && x.city !== f.city) return false;
    if (on('locality') && a.locality && x.locality !== a.locality) return false;
    if (on('purpose') && f.purpose && x.purpose !== f.purpose) return false;
    if (on('q') && f.q) {
      const hay = [x.id, x.title, x.locality, x.city, x.type && typeLabel(x.type), categoryOf(x.type), x.purpose, x.facing, x.specs.bhk, x.specs.subType, x.specs.commCategory].join(' ').toLowerCase();
      if (!f.q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w))) return false; // every word, in any order
    }
    if (on('price') && ((a.minPrice && x.price < a.minPrice) || (a.maxPrice && x.price > a.maxPrice))) return false;
    if (on('area') && ((a.minArea && x.area < a.minArea) || (a.maxArea && x.area > a.maxArea))) return false;
    if (on('bhk') && a.bhk && (a.bhk >= 5 ? bhkOf(x) < 5 : bhkOf(x) !== a.bhk)) return false;
    if (on('facing') && a.facing && (x.facing || '').toLowerCase() !== a.facing.toLowerCase()) return false;
    if (on('corner') && a.corner && x.specs.corner !== 'Corner') return false;
    if ((a.amen || []).some(m => on('amen:' + m) && !x.amenities.includes(m))) return false;
    return true;
  }
  function sortList(list, by) {
    const fn = { priceAsc: (x, y) => x.price - y.price, priceDesc: (x, y) => y.price - x.price, scoreAsc: (x, y) => x.score - y.score }[by]
      || ((x, y) => (y.date || '').localeCompare(x.date || '') || y.id.localeCompare(x.id));
    return list.slice().sort(fn);
  }
  /** Every active criterion { k, l } — used for the "show N without …" suggestion. */
  function criteria(s, f) {
    const a = f.ai || {}, out = [];
    if (f.type) out.push({ k: 'type', l: typeText(f.type) });
    if (a.bhk) out.push({ k: 'bhk', l: bhkText(a.bhk) });
    if (f.purpose) out.push({ k: 'purpose', l: 'For ' + f.purpose.toLowerCase() });
    if (a.locality) out.push({ k: 'locality', l: a.locality });
    if (f.city) out.push({ k: 'city', l: f.city });
    if (a.minPrice || a.maxPrice) out.push({ k: 'price', l: rangeText(a.minPrice, a.maxPrice, inrShort) });
    if (a.minArea || a.maxArea) out.push({ k: 'area', l: rangeText(a.minArea, a.maxArea, num) + ' sq.ft.' });
    if (a.facing) out.push({ k: 'facing', l: a.facing + ' facing' });
    if (a.corner) out.push({ k: 'corner', l: 'Corner plot' });
    (a.amen || []).forEach(m => out.push({ k: 'amen:' + m, l: 'With ' + m.toLowerCase() }));
    if (f.status) out.push({ k: 'status', l: f.status === '__arch' ? 'Archived' : f.status });
    if (f.attn) out.push({ k: 'attn', l: 'Needs attention' });
    if (f.q) out.push({ k: 'q', l: `“${f.q}”` });
    return out;
  }
  const typeText = t => (t.startsWith('cat:') ? 'All ' + t.slice(4).toLowerCase() : typeLabel(t));
  const bhkText = n => (n >= 5 ? '5+ BHK' : n + ' BHK');
  const rangeText = (lo, hi, fmt) => (lo && hi ? (lo === hi ? fmt(lo) : `${fmt(lo)} – ${fmt(hi)}`) : hi ? `Under ${fmt(hi)}` : `${fmt(lo)}+`);

  /* ---------- the (simulated) AI: a sentence → the same filters ----------
     A real build would send the sentence and this filter schema to the AI service and get the same structure back. */
  function parse(s, text) {
    let t = ' ' + text.toLowerCase().replace(/[,;!?]/g, ' ').replace(/₹/g, ' ').replace(/\s+/g, ' ') + ' ';
    const f = {}, a = {}, has = re => re.test(t), cut = x => { t = t.replace(x, ' '); };
    const money = (n, u) => {
      n = parseFloat(n); u = (u || '').trim();
      if (/^c/.test(u)) return n * 1e7; if (/^l/.test(u)) return n * 1e5; if (u === 'k') return n * 1e3;
      return n < 1000 ? n * 1e5 : n; // a bare small number means lakh
    };
    const sqft = (n, u) => { n = parseFloat(n); return /cent/.test(u) ? Math.round(n * 435.6) : /acre/.test(u) ? Math.round(n * 43560) : n; };
    const N = '(\\d+(?:\\.\\d+)?)', U = '(crores?|cr|lakhs?|lacs?|l|k)?', A = '(sq\\.? ?ft\\.?|sqft|square feet|sft|cents?|acres?)';
    let m;
    // area first, so its numbers are not read as a price
    if ((m = t.match(new RegExp(`${N} ?(?:-|to|and) ?${N} ?${A}`)))) { a.minArea = sqft(m[1], m[3]); a.maxArea = sqft(m[2], m[3]); cut(m[0]); }
    else if ((m = t.match(new RegExp(`(under|below|less than|upto|up to|max|within) ${N} ?${A}`)))) { a.maxArea = sqft(m[2], m[3]); cut(m[0]); }
    else if ((m = t.match(new RegExp(`(?:(above|over|more than|at least|min|minimum|around|about) )?${N} ?${A}`)))) {
      const v = sqft(m[2], m[3]);
      if (/around|about/.test(m[1] || '')) { a.minArea = Math.round(v * 0.85); a.maxArea = Math.round(v * 1.15); } else a.minArea = v;
      cut(m[0]);
    }
    if ((m = t.match(/(\d) ?(?:bhk|bed ?rooms?|beds?)\b/))) { a.bhk = +m[1]; cut(m[0]); }
    // price
    if ((m = t.match(new RegExp(`(?:between )?${N} ?${U} ?(?:-|to|and) ?${N} ?${U}(?= )`)))) { a.minPrice = money(m[1], m[2] || m[4]); a.maxPrice = money(m[3], m[4]); cut(m[0]); }
    else {
      if ((m = t.match(new RegExp(`(under|below|less than|within|upto|up to|max|maximum|budget(?: of| is)?|not more than) ${N} ?${U}(?= )`)))) { a.maxPrice = money(m[2], m[3]); cut(m[0]); }
      if ((m = t.match(new RegExp(`(above|over|more than|min|minimum|at least|starting) ${N} ?${U}(?= )`)))) { a.minPrice = money(m[2], m[3]); cut(m[0]); }
      if ((m = t.match(new RegExp(`(around|about|approx|approximately) ${N} ?${U}(?= )`)))) { const v = money(m[2], m[3]); a.minPrice = Math.round(v * 0.85); a.maxPrice = Math.round(v * 1.15); cut(m[0]); }
    }
    // type / category
    const TYPES = [['agri', /\b(agricultural|agri|farm ?lands?|farms?)\b/], ['industrial', /\b(industrial|sheds?|factory)\b/], ['commercial', /\b(office|offices|shops?|showrooms?|warehouses?|godowns?|retail)\b/],
      ['house', /\b(houses?|villas?|independent|bungalows?)\b/], ['flat', /\b(flats?|apartments?)\b/], ['plot', /\b(plots?|sites?|lands?)\b/]];
    const hit = TYPES.filter(([, re]) => has(re)).map(([k]) => k);
    if (hit.length === 1) f.type = hit[0];
    else if (hit.length > 1) { if (hit.every(k => categoryOf(k) === categoryOf(hit[0]))) f.type = 'cat:' + categoryOf(hit[0]); }
    else if (a.bhk) f.type = 'flat';
    else if (has(/\bresidential\b/)) f.type = 'cat:Residential';
    else if (has(/\bcommercial\b/)) f.type = 'cat:Commercial';
    // place: locality first (it tells the city too)
    const ALIAS = { trichy: 'Tiruchirappalli', kovai: 'Coimbatore', madras: 'Chennai' };
    Object.entries(CITIES).forEach(([c, v]) => v.localities.forEach(l => {
      const names = [l.replace(/ \(.*\)$/, ''), (l.match(/\((.*)\)/) || [])[1]].filter(n => n && n.length > 2 && !CITIES[n]);
      if (!a.locality && names.some(n => t.includes(' ' + n.toLowerCase() + ' '))) { a.locality = l; f.city = c; }
    }));
    if (!f.city) {
      const c = Object.keys(CITIES).find(x => t.includes(' ' + x.toLowerCase() + ' ')) || (Object.entries(ALIAS).find(([k]) => t.includes(' ' + k + ' ')) || [])[1];
      if (c) f.city = c;
    }
    if (has(/\b(rent|rental|to let)\b/)) f.purpose = 'Rent'; else if (has(/\blease\b/)) f.purpose = 'Lease'; else if (has(/\b(buy|sale|sell|purchase)\b/)) f.purpose = 'Sale';
    if ((m = t.match(/\b(north|south|east|west)[- ]?facing\b|\bfacing (north|south|east|west)\b/))) { const d = m[1] || m[2]; a.facing = d[0].toUpperCase() + d.slice(1); }
    if (has(/\bcorner\b/)) a.corner = true;
    const AM = { 'Swimming pool': /\b(swimming pool|pool)\b/, Gym: /\b(gym|fitness)\b/, Lift: /\b(lift|elevator)\b/, 'Gated community': /\bgated\b/, Security: /\bsecurity\b/, CCTV: /\bcctv\b/,
      Clubhouse: /\bclub ?house\b/, 'Power backup': /\b(power backup|backup|generator)\b/, 'Park / open space': /\b(park|open space)\b/, 'Rainwater harvesting': /\brain ?water\b/,
      'Visitor parking': /\bvisitor parking\b/, 'Loading bay': /\bloading\b/ };
    const amen = Object.entries(AM).filter(([, re]) => has(re)).map(([k]) => k);
    if (amen.length) a.amen = amen;
    // status named in the sentence ("sold", "on hold", "ready to publish"…); "draft" alone is just the page's name
    const stHit = SCOPES[s].statuses.map(o => o.v).find(v => v !== 'Draft' && t.includes(' ' + v.toLowerCase() + ' '));
    if (stHit) f.status = stHit;
    else if (s === 'drafts' && has(/\b(waiting|pending|approval)\b/)) f.status = 'Waiting for approval';
    else if (s === 'props' && has(/\b(available|unsold)\b/)) f.status = 'Available';
    if (SCOPES[s].archive && has(/\barchived?\b/)) f.status = '__arch';
    if (has(/\b(cheapest|lowest price|low to high|budget friendly|affordable)\b/)) f.sort = 'priceAsc';
    else if (has(/\b(most expensive|highest price|high to low|premium|luxury)\b/)) f.sort = 'priceDesc';
    else if (has(/\b(least complete|missing details|low score)\b/)) f.sort = 'scoreAsc';
    if (Object.keys(a).length) f.ai = a;
    return f;
  }

  /* ---------- the bar ---------- */
  const opt = (s, k, v, label, on, extra = '') => `<button class="ps-opt ${on ? 'on' : ''}" data-act="psSet" data-s="${s}" data-k="${k}" data-v="${esc(String(v))}">${label}${extra}</button>`;
  const sel = (s, k, val, list, blank) => `<select data-chg="psSel" data-s="${s}" data-k="${k}">${options(list, val ? String(val) : '', blank)}</select>`;
  const rangeSel = (s, k, val, presets, fmt, blank) => sel(s, k, val, [...new Set([...presets, ...(val ? [+val] : [])])].sort((x, y) => x - y).map(v => ({ v: String(v), l: fmt(v) })), blank);

  function panels(s, f, items) {
    const a = f.ai || {}, cnt = fn => items.filter(x => (s !== 'props' || !x.archived) && fn(x)).length;
    const cities = [...new Set(items.filter(x => x.city).map(x => x.city))].sort();
    if (f.city && !cities.includes(f.city)) cities.push(f.city);
    const residential = !f.type || ['flat', 'house', 'cat:Residential'].includes(f.type);
    return {
      type: `<div class="ps-list">${opt(s, 'type', '', 'All types', !f.type)}${['Residential', 'Commercial'].map(cat => `<div class="ps-group">${cat}</div>${opt(s, 'type', 'cat:' + cat, 'All ' + cat.toLowerCase(), f.type === 'cat:' + cat)}${Object.entries(PROPERTY_TYPES).filter(([, t]) => t.category === cat).map(([k, t]) => opt(s, 'type', k, t.label, f.type === k, `<small>${cnt(x => x.type === k)}</small>`)).join('')}`).join('')}</div>`,
      city: `<div class="ps-list ps-scroll-sm">${opt(s, 'city', '', 'All cities', !f.city)}${cities.map(c => opt(s, 'city', c, c, f.city === c, `<small>${cnt(x => x.city === c)}</small>`)).join('')}</div>
        ${f.city ? `<div class="ps-sub">Locality</div><div class="ps-seg wrap ps-scroll-sm">${opt(s, 'locality', '', 'Anywhere', !a.locality)}${((CITIES[f.city] || {}).localities || []).map(l => opt(s, 'locality', l, esc(l), a.locality === l)).join('')}</div>` : ''}`,
      budget: `<div class="ps-seg wrap">${BUDGETS.map(([lo, hi, l]) => opt(s, 'budget', `${lo}-${hi}`, l, (a.minPrice || '') === lo && (a.maxPrice || '') === hi)).join('')}</div>
        <div class="ps-sub">Or choose</div><div class="ps-range">${rangeSel(s, 'minPrice', a.minPrice, PRICES, inrShort, 'No min')}<span>to</span>${rangeSel(s, 'maxPrice', a.maxPrice, PRICES, inrShort, 'No max')}</div>`,
      size: `${residential || a.bhk ? `<div class="ps-sub first">Bedrooms</div><div class="ps-seg">${opt(s, 'bhk', '', 'Any', !a.bhk)}${[1, 2, 3, 4, 5].map(n => opt(s, 'bhk', n, n === 5 ? '5+' : n, a.bhk === n)).join('')}</div>` : ''}
        <div class="ps-sub ${residential || a.bhk ? '' : 'first'}">Area (sq.ft.)</div><div class="ps-range">${rangeSel(s, 'minArea', a.minArea, AREAS, num, 'No min')}<span>to</span>${rangeSel(s, 'maxArea', a.maxArea, AREAS, num, 'No max')}</div>`,
      more: `<div class="ps-sub first">Purpose</div><div class="ps-seg">${opt(s, 'purpose', '', 'Any', !f.purpose)}${LISTING_PURPOSES.map(v => opt(s, 'purpose', v, PURPOSE[v], f.purpose === v)).join('')}</div>
        <div class="ps-sub">Facing</div><div class="ps-seg">${opt(s, 'facing', '', 'Any', !a.facing)}${['East', 'West', 'North', 'South'].map(d => opt(s, 'facing', d, d, a.facing === d)).join('')}</div>
        <div class="ps-sub">Amenities</div><div class="ps-seg wrap ps-scroll-sm">${opt(s, 'corner', 1, 'Corner plot', !!a.corner)}${AMENITIES.map(m => opt(s, 'amen', m, esc(m), (a.amen || []).includes(m))).join('')}</div>`,
      sort: `<div class="ps-list">${SORTS.map(o => opt(s, 'sort', o.v, o.l, (f.sort || '') === o.v)).join('')}</div>`,
    };
  }
  function pills(s, f, items) {
    const a = f.ai || {}, open = st(s).open, P = panels(s, f, items);
    const moreN = [f.purpose, a.facing, a.corner].filter(Boolean).length + (a.amen || []).length;
    const defs = [
      ['type', f.type ? typeText(f.type) : 'Type', !!f.type],
      ['city', f.city ? f.city + (a.locality ? ' · ' + a.locality.replace(/ \(.*\)$/, '') : '') : 'City', !!(f.city || a.locality)],
      ['budget', a.minPrice || a.maxPrice ? rangeText(a.minPrice, a.maxPrice, inrShort) : 'Budget', !!(a.minPrice || a.maxPrice)],
      ['size', [a.bhk && bhkText(a.bhk), (a.minArea || a.maxArea) && rangeText(a.minArea, a.maxArea, num) + ' sq.ft.'].filter(Boolean).join(' · ') || 'Size', !!(a.bhk || a.minArea || a.maxArea)],
      ['more', moreN ? `More · ${moreN}` : 'More', moreN > 0],
    ];
    const pill = ([k, label, set], cls = '') => `<div class="ps-pill-wrap ${cls}">
        <button class="ps-pill ${set ? 'set' : ''} ${open === k ? 'open' : ''}" data-act="psPill" data-s="${s}" data-k="${k}" title="${esc(label)}"><span class="ps-lbl">${esc(label)}</span>${set ? `<span class="ps-x" data-act="psClearPill" data-s="${s}" data-k="${k}" title="Clear">✕</span>` : '<span class="ps-caret">▾</span>'}</button>
        ${open === k ? `<div class="ps-pop ps-pop-${k}">${P[k]}</div>` : ''}</div>`;
    const sortL = (SORTS.find(o => o.v === (f.sort || '')) || SORTS[0]).l;
    const any = criteria(s, f).length || f.sort || f.aiText;
    return `<div class="ps-pills">${defs.map(d => pill(d)).join('')}</div><span class="sp"></span>
      ${pill(['sort', 'Sort: ' + sortL, false], 'ps-sort')}
      ${any ? `<button class="ps-clear" data-act="psClearAll" data-s="${s}">Clear all</button>` : ''}`;
  }

  /** Filters the page's records and builds the search bar. Returns { list (raw records), bar, relax }. */
  function run(s) {
    const f = F(s), cfg = SCOPES[s], items = cfg.items(), u = st(s);
    if (f.city && f.ai && f.ai.locality && !((CITIES[f.city] || {}).localities || []).includes(f.ai.locality)) delete f.ai.locality;
    const list = sortList(items.filter(x => match(s, x, f)), f.sort);
    const crit = criteria(s, f);
    // nothing found: offer the smallest change (drop one filter, else two) that brings records back
    let relax = '';
    if (!list.length && crit.length) {
      const count = cs => items.filter(x => match(s, x, f, cs.map(c => c.k))).length;
      const pairs = crit.flatMap((c, i) => crit.slice(i + 1).map(d => [c, d]));
      const best = [crit.map(c => [c]), pairs].map(sets => sets.map(cs => ({ cs, n: count(cs) })).filter(x => x.n).sort((x, y) => y.n - x.n)[0]).find(Boolean);
      if (best) relax = `<button class="btn sm" data-act="psDrop" data-s="${s}" data-k="${esc(best.cs.map(c => c.k).join('|'))}">Show ${best.n} without ${best.cs.map(c => esc(c.l)).join(' and ')}</button>`;
    }
    const noun = n => (n === 1 ? cfg.noun[0] : cfg.noun[1]);
    const stale = f.aiRan && f.aiText !== f.aiRan;
    const line = stale ? '<span class="ps-lead">Press Enter to search for the new words.</span>'
      : f.aiMiss ? `<span class="ps-miss">I couldn’t pick out a type, place, budget or size from that. Try:</span> ${EXAMPLES.map(x => `<button class="ps-example" data-act="psExample" data-s="${s}" data-text="${esc(x)}">${esc(x)}</button>`).join('')}`
      : f.aiRan ? `<span class="ps-lead">${list.length ? `Found <b>${list.length}</b> ${noun(list.length)} — the filters below are set from your words.` : 'No exact match.'}</span>${relax}`
      : `<span class="ps-lead">Try:</span> ${EXAMPLES.map(x => `<button class="ps-example" data-act="psExample" data-s="${s}" data-text="${esc(x)}">${esc(x)}</button>`).join('')}`;
    const bar = u.ai ? `
      <div class="ps-ai">
        <div class="ps-ai-box ${u.listening ? 'listening' : ''}">
          <span class="ps-ai-spark">✨</span>
          <textarea id="ps-ai-${s}" rows="1" data-inp="psText" data-s="${s}" placeholder="${u.listening ? 'Listening… say what you are looking for' : `Describe what you’re looking for — e.g. “2 BHK flat in Madurai under 60 lakh”`}">${esc(f.aiText || '')}</textarea>
          <button class="ps-icon ps-mic ${u.listening ? 'on' : ''}" data-act="psVoice" data-s="${s}" title="${u.listening ? 'Stop listening' : 'Speak instead of typing'}">🎤</button>
          <button class="btn primary sm" data-act="psAsk" data-s="${s}">Search</button>
          <button class="ps-icon" data-act="psToggle" data-s="${s}" title="Back to the normal search">▴</button>
        </div>
        <div class="ps-understood" data-ps-line="${s}">${line}</div>
        <div class="ps-bar">${pills(s, f, items)}</div>
      </div>` : `
      <div class="ps-bar">
        <div class="ps-search">
          <span class="ps-glass">🔍</span>
          <input type="search" id="ps-q-${s}" placeholder="Search ID, title, locality…" value="${esc(f.q || '')}" data-inp="psQ" data-s="${s}">
          <button class="ps-ai-btn" data-act="psToggle" data-s="${s}" title="AI search — describe what you want, by typing or speaking">✨</button>
        </div>
        ${pills(s, f, items)}
      </div>`;
    // paging: rows per page on the left, Prev / Next on the right; a filter change goes back to page 1
    const key = JSON.stringify({ ...f, aiText: undefined });
    if (u.key !== key) { u.key = key; u.page = 1; }
    const size = u.size || 10, pages = Math.max(1, Math.ceil(list.length / size));
    u.page = Math.min(Math.max(1, u.page || 1), pages);
    const from = (u.page - 1) * size, shown = list.slice(from, from + size);
    const pager = `<div class="ps-pager">
        <div class="ps-pill-wrap ps-rows"><button class="ps-pill ${u.open === 'rows' ? 'open' : ''}" data-act="psPill" data-s="${s}" data-k="rows">Rows per page: <b>${size}</b><span class="ps-caret">▾</span></button>${u.open === 'rows' ? `<div class="ps-pop ps-pop-up"><div class="ps-list">${PAGE_SIZES.map(n => `<button class="ps-opt ${n === size ? 'on' : ''}" data-act="psSize" data-s="${s}" data-n="${n}">${n} rows</button>`).join('')}</div></div>` : ''}</div>
        <span class="ps-count">${list.length ? `Showing <b>${from + 1}–${from + shown.length}</b> of <b>${list.length}</b> ${noun(list.length)}` : `No ${cfg.noun[1]} to show`}${cfg.note && cfg.note() ? ' · ' + cfg.note() : ''}</span>
        <div class="ps-nav">
          <button class="btn sm" data-act="psPage" data-s="${s}" data-d="-1" ${u.page <= 1 ? 'disabled' : ''}>‹ Prev</button>
          <span>Page ${u.page} of ${pages}</span>
          <button class="btn sm" data-act="psPage" data-s="${s}" data-d="1" ${u.page >= pages ? 'disabled' : ''}>Next ›</button>
        </div>
      </div>`;
    // status tabs, counted with every other filter applied
    const tabCount = v => items.filter(x => match(s, x, { ...f, status: v })).length;
    const tabDefs = [{ v: '', l: 'All' }, ...cfg.statuses, ...(cfg.archive ? [{ v: '__arch', l: 'Archived' }] : [])]
      .map(o => ({ ...o, n: tabCount(o.v) })).filter(o => !o.v || o.n || (f.status || '') === o.v); // empty tabs are hidden
    const attnOn = cfg.attention && u.attnHidden;
    const tabs = `<div class="ps-tabs">${tabDefs.map(o => `<button class="ps-tab ${(f.status || '') === o.v ? 'on' : ''}" data-act="psSet" data-s="${s}" data-k="status" data-v="${o.v}">${esc(o.l)} <span>${o.n}</span></button>`).join('')}
      ${attnOn ? `<button class="ps-attn-show" data-act="psAttnHide" data-s="${s}">✨ Needs attention</button>` : ''}</div>`;
    // AI "needs attention" strip: what the software noticed, one click to filter
    let attn = '';
    if (cfg.attention && !u.attnHidden) {
      const groups = {};
      items.filter(x => !x.archived).forEach(x => (x.attn || []).forEach(i => { (groups[i.k] = groups[i.k] || { l: i.group, n: 0 }).n++; }));
      const flagged = items.filter(x => (x.attn || []).length).length;
      if (flagged) attn = `<div class="ps-attn"><span class="ps-attn-lead">✨ <b>${flagged} ${noun(flagged)}</b> need attention</span>
        ${Object.entries(groups).map(([k, g]) => `<button class="ps-attn-chip ${f.attn === k ? 'on' : ''}" data-act="psSet" data-s="${s}" data-k="attn" data-v="${f.attn === k ? '' : k}">${esc(g.l)} <b>${g.n}</b></button>`).join('')}
        <span class="sp"></span><button class="ps-attn-x" data-act="psAttnHide" data-s="${s}" title="Hide for now">✕</button></div>`;
    }
    const head = `${attn}<div class="ps-sticky">${bar}${tabs}</div>`;
    return { list: shown.map(x => x.raw), all: list.map(x => x.raw), bar, head, relax, pager, total: items.length };
  }
  /** Sticky layout: the page scrolls, the search bar + tabs and the column headings stay at the top, the pager at the bottom. */
  function fit() {
    const tb = document.querySelector('.topbar'), sticky = document.querySelector('.ps-sticky');
    if (!sticky) return;
    const top = tb ? tb.offsetHeight : 0;
    document.documentElement.style.setProperty('--ps-top', top + 'px');
    document.documentElement.style.setProperty('--ps-head', top + sticky.offsetHeight + 'px');
  }
  window.addEventListener('resize', fit);
  /** Focus the AI box after it opens (call from the view's `after`). */
  function after(s) {
    const u = st(s);
    if (u.focus) { u.focus = false; const el = document.getElementById('ps-ai-' + s); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }
    fit();
    // a panel that would run off the right edge opens towards the left instead
    const pop = document.querySelector('.ps-pop');
    if (pop && pop.getBoundingClientRect().right > document.documentElement.clientWidth - 12) pop.classList.add('ps-pop-right');
  }

  /* ---------- actions ---------- */
  function ask(s, text) {
    text = (text || '').trim();
    if (!text) { toast('Type or say what you are looking for'); return; }
    const p = parse(s, text);
    const got = p.type || p.city || p.purpose || p.status || p.ai || p.sort;
    UI.filters[s] = got ? { ...p, aiText: text, aiRan: text } : { aiText: text, aiRan: text, aiMiss: true }; // a new sentence replaces the old filters
    st(s).open = null;
    render();
  }
  function setVal(s, k, v) {
    const f = F(s), a = f.ai = f.ai || {};
    if (k === 'budget') { const [lo, hi] = v.split('-'); if (lo) a.minPrice = +lo; else delete a.minPrice; if (hi) a.maxPrice = +hi; else delete a.maxPrice; }
    else if (k === 'amen') { const set = new Set(a.amen || []); set.has(v) ? set.delete(v) : set.add(v); a.amen = AMENITIES.filter(m => set.has(m)); if (!a.amen.length) delete a.amen; }
    else if (k === 'corner') { if (a.corner) delete a.corner; else a.corner = true; }
    else if (AI_KEYS.includes(k)) { if (v === '') delete a[k]; else a[k] = ['locality', 'facing'].includes(k) ? v : +v; }
    else { if (v === '') delete f[k]; else f[k] = v; }
    if (a.minPrice && a.maxPrice && a.minPrice > a.maxPrice) [a.minPrice, a.maxPrice] = [a.maxPrice, a.minPrice]; // min above max: swap
    if (a.minArea && a.maxArea && a.minArea > a.maxArea) [a.minArea, a.maxArea] = [a.maxArea, a.minArea];
    if (k === 'city') delete a.locality;
    if (k === 'locality' && v) f.city = Object.keys(CITIES).find(c => CITIES[c].localities.includes(v)) || f.city;
    if (!Object.keys(a).length) delete f.ai;
    delete f.aiMiss;
    if (['type', 'sort', 'budget'].includes(k) || (k === 'city' && !v)) st(s).open = null; // single choice: close the panel
    render();
  }
  function dropKeys(s, keys) {
    const f = F(s), a = f.ai || {};
    keys.forEach(k => {
      if (k === 'price') { delete a.minPrice; delete a.maxPrice; }
      else if (k === 'area') { delete a.minArea; delete a.maxArea; }
      else if (k.startsWith('amen:')) { a.amen = (a.amen || []).filter(m => m !== k.slice(5)); if (!a.amen.length) delete a.amen; }
      else if (AI_KEYS.includes(k)) delete a[k];
      else delete f[k];
      if (k === 'city') delete a.locality;
    });
    render();
  }
  const PILL_KEYS = { type: ['type'], city: ['city', 'locality'], budget: ['price'], size: ['bhk', 'area'], more: ['purpose', 'facing', 'corner', 'amen'] };
  function stopVoice(s) {
    const u = st(s); u.listening = false;
    if (u.timer) { clearInterval(u.timer); u.timer = null; }
    if (u.rec) { const r = u.rec; u.rec = null; try { r.abort(); } catch (e) { /* already stopped */ } }
  }
  function voice(s) {
    const u = st(s);
    if (u.listening) { stopVoice(s); render(); return; }
    const box = () => document.getElementById('ps-ai-' + s);
    const demo = () => { // no microphone or speech service: "hear" a sample phrase so the flow can still be shown
      u.listening = true; F(s).aiText = ''; render();
      const phrase = '2 BHK flat in Madurai under 60 lakh with lift'; let i = 0;
      u.timer = setInterval(() => {
        i += 3; F(s).aiText = phrase.slice(0, i); if (box()) box().value = F(s).aiText;
        if (i >= phrase.length) { stopVoice(s); ask(s, phrase); }
      }, 70);
    };
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast('Voice demo — using a sample phrase'); demo(); return; }
    try {
      const rec = new SR(); u.rec = rec; rec.lang = 'en-IN'; rec.interimResults = true;
      rec.onresult = e => {
        const txt = [...e.results].map(r => r[0].transcript).join(' ');
        F(s).aiText = txt; if (box()) box().value = txt;
        if (e.results[e.results.length - 1].isFinal) { stopVoice(s); ask(s, txt); }
      };
      rec.onerror = e => {
        if (u.rec !== rec) return;
        stopVoice(s);
        if (e.error === 'no-speech' || e.error === 'aborted') { toast('Didn’t catch that — try again'); render(); }
        else { toast('Microphone not available — voice demo with a sample phrase'); demo(); }
      };
      rec.onend = () => { if (u.rec === rec) { stopVoice(s); render(); } };
      u.listening = true; render(); rec.start();
    } catch (e) { stopVoice(s); demo(); }
  }

  Object.assign(ACTIONS, {
    psToggle: d => { const u = st(d.s); u.ai = !u.ai; u.focus = u.ai; u.open = null; if (!u.ai) stopVoice(d.s); render(); },
    psAsk: d => ask(d.s, F(d.s).aiText),
    psExample: d => { F(d.s).aiText = d.text; ask(d.s, d.text); },
    psPill: d => { const u = st(d.s); u.open = u.open === d.k ? null : d.k; render(); },
    psSet: d => setVal(d.s, d.k, d.v),
    psClearPill: d => { st(d.s).open = null; dropKeys(d.s, PILL_KEYS[d.k]); },
    psDrop: d => dropKeys(d.s, d.k.split('|')),
    psClearAll: d => { UI.filters[d.s] = {}; st(d.s).open = null; render(); },
    psVoice: d => voice(d.s),
    psAttnHide: d => { const u = st(d.s); u.attnHidden = !u.attnHidden; if (u.attnHidden) delete F(d.s).attn; render(); },
    psSize: d => { const u = st(d.s); u.size = +d.n; u.page = 1; u.open = null; render(); const w = document.querySelector('.ps-table'); if (w) w.scrollTop = 0; },
    psPage: d => { const u = st(d.s); u.page = (u.page || 1) + +d.d; render(); const w = document.querySelector('.ps-table'); if (w) w.scrollTop = 0; },
  });
  Object.assign(CHANGES, { psSel: el => setVal(el.dataset.s, el.dataset.k, el.value) });
  Object.assign(INPUTS, {
    psQ: el => { F(el.dataset.s).q = el.value; render(); },
    psText: el => {
      const f = F(el.dataset.s); f.aiText = el.value;
      el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 160) + 'px'; fit(); // grows with the text
      const line = document.querySelector(`[data-ps-line="${el.dataset.s}"]`);
      if (line && f.aiRan && el.value !== f.aiRan) line.innerHTML = '<span class="ps-lead">Press Enter to search for the new words.</span>';
    },
  });
  document.addEventListener('keydown', e => {
    const id = e.target.id || '';
    if (!id.startsWith('ps-ai-')) return;
    const s = id.slice(6);
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(s, e.target.value); }
    else if (e.key === 'Escape') ACTIONS.psToggle({ s });
  });
  document.addEventListener('click', e => { // a click outside an open panel closes it
    const s = Object.keys(UI.ps).find(k => UI.ps[k].open);
    if (s && !e.target.closest('.ps-pill-wrap')) { UI.ps[s].open = null; render(); }
  });

  window.PropSearch = { run, after };
})();
