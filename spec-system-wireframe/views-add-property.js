/* =====================================================================
   Add property — the AI-first page, inside the main wireframe.
   Opened by “＋ Add property” on the property list and “＋ Property” in the top bar.
   The chat is the main way in; a live summary sits beside it and the form,
   media, legal documents and history open in a drawer. Unfinished properties
   stay as drafts (shown above the old property list); a published property
   is handed over to the old property list and property page.
   Built from properties-ai.js (the standalone version of this page).
   The AI is SIMULATED with simple text rules — no AI service is called.
   ===================================================================== */
(function () {

const KEY = 'respec-wireframe-ai-drafts-v1';
const ROLES = ['Admin', 'Sales manager', 'Sales executive'];
const EXEC = 'Executive 01 — Priya S';
const TODAY = DEMO_TODAY;
const CITY_CENTRE = Object.fromEntries(Object.keys(CITIES).map(c => [c, true])); // cities come from data.js
const CITY_ALIASES = { trichy: 'Tiruchirappalli', tiruchi: 'Tiruchirappalli', kovai: 'Coimbatore', madras: 'Chennai', tanjore: 'Thanjavur', nellai: 'Tirunelveli' };
const AVAIL_TONE = { Available: 'green', 'Under negotiation': 'purple', Reserved: 'blue', Booked: 'blue', 'On hold': 'amber', Sold: 'grey' };
const REC_STATUS = { draft: ['Draft', 'amber'], pending: ['Waiting for approval', 'blue'], published: ['Published', 'green'] };
const SRC = { chat: ['💬', 'From chat'], form: ['📝', 'Entered in the form'], google: ['🗺', 'Google Maps (mock)'], ai: ['✨', 'Written by AI'], derived: ['↳', 'Worked out'], calc: ['🧮', 'Calculated'], upload: ['📎', 'Uploaded'], import: ['📄', 'From the import file'] };
const AMENITY_WORDS = [[/gated/i, 'Gated community'], [/security|watchman/i, 'Security'], [/\bpark\b|open space/i, 'Park / open space'],
  [/power back ?up|generator/i, 'Power backup'], [/\blifts?\b|elevator/i, 'Lift'], [/\bgym\b|fitness/i, 'Gym'], [/swimming pool|\bpool\b/i, 'Swimming pool'],
  [/club ?house/i, 'Clubhouse'], [/rain ?water/i, 'Rainwater harvesting'], [/\bcctv\b/i, 'CCTV'], [/visitor parking/i, 'Visitor parking'], [/loading (bay|dock)/i, 'Loading bay']];
const FIELD_SYNONYMS = { carpark: 'parking', carparking: 'parking', parking: 'parking', lift: 'lifts', lifts: 'lifts', bedroom: 'bedrooms', bedrooms: 'bedrooms',
  bathroom: 'bathrooms', bathrooms: 'bathrooms', toilets: 'bathrooms', floors: 'floors', water: 'water', watersource: 'water', power: 'power', eb: 'electricity',
  electricity: 'electricity', road: 'roadWidth', roadwidth: 'roadWidth', maintenance: 'maintenance', possession: 'possession', survey: 'surveyNo', surveyno: 'surveyNo',
  approval: 'layoutApproval', frontage: 'frontage', bhk: 'bhk', floor: 'floor', carpet: 'carpet', carpetarea: 'carpet', uds: 'uds', topography: 'topography', drainage: 'drainage' };
const LABEL_STOP = new Set(['it', 'this', 'that', 'there', 'which', 'what', 'owner', 'seller', 'buyer', 'price', 'askingprice', 'rate', 'size', 'location', 'title', 'status',
  'property', 'theproperty', 'total', 'rent', 'distance', 'he', 'she', 'we', 'they', 'i', 'plot', 'flat', 'house', 'villa', 'shop', 'office', 'site', 'land', 'building', 'apartment', 'description']);
const AMEN_SKIP = /\b(parking|car park|floor|road|facing|bhk|sq|sqft|feet|ft|lakh|crore|price|area|bedroom|bathroom|toilet|water|borewell|electric|drainage|approval|dtcp|cmda|rera|survey|maintenance|frontage|tenant|lease|rent|possession|ready|plot|flat|house|villa|shop|office|warehouse|land|corner|acres?|cents?|kva|phase|soil|crops?|trees?|fencing)\b/i;

const TYPE_ORDER = ['flat', 'house', 'plot', 'commercial', 'agri', 'industrial'];
const typesIn = cat => TYPE_ORDER.filter(k => PROPERTY_TYPES[k].category === cat);
const PURPOSE_LABEL = { Sale: 'Sell', Rent: 'Rent', Lease: 'Lease' };
/* Approval badges: picked while creating the property; the document follows later under Legal documents.
   One shared list for every property (logic.js approvalTypes → Settings): RERA and building approval, plus any the team creates. */
const allApprovals = () => approvalTypes();
/* Only a few amenities per type — they are optional extras; anything else can be added by name. */
const AMENITIES_BY_TYPE = {
  flat: ['Lift', 'Power backup', 'Security', 'CCTV', 'Gym', 'Swimming pool'],
  house: ['Gated community', 'Security', 'Power backup', 'Rainwater harvesting', 'Park / open space'],
  plot: ['Gated community', 'Park / open space', 'Security', 'Rainwater harvesting'],
  commercial: ['Lift', 'Power backup', 'CCTV', 'Visitor parking', 'Loading bay'],
  agri: ['Farm house', 'Drip irrigation', 'Security'],
  industrial: ['Power backup', 'CCTV', 'Security', 'Loading bay'],
};
/* The few details asked for at creation; every other known detail can be added from “Add more details”. */
const CORE_FIELDS = {
  plot: ['length', 'width', 'roadWidth', 'corner'],
  flat: ['bhk', 'floor', 'parking', 'possession'],
  house: ['subType', 'bedrooms', 'bathrooms', 'parking'],
  commercial: ['commCategory', 'floor', 'occupancy'],
  agri: ['acres', 'waterSource', 'roadAccess'],
  industrial: ['subType', 'powerKva', 'roadWidth'],
};
/* The key details required to publish — two per type. The type's other details are optional and can come later. */
const REQ_DETAILS = REQUIRED_DETAILS; // data.js — shared with Bulk import
/* The few optional extras offered as one-tap chips under “Add a detail”; anything else via “Something else”. */
const SUGGESTED_FIELDS = {
  plot: ['surveyNo', 'water', 'electricity'],
  flat: ['carpet', 'totalFloors', 'maintenance'],
  house: ['landArea', 'floors', 'constructionYear'],
  commercial: ['frontage', 'parking', 'maintenance'],
  agri: ['soil', 'electricity', 'crops'],
  industrial: ['shedArea', 'truckAccess', 'water'],
};

/* ---------- state ---------- */
let S = null;
const AUI = { forced: null, forcedMgr: true, attach: false, toastTimer: null, keep: null };
const me = () => AUI.forced || currentUser(); // the main wireframe’s “Viewing as”
const isMgr = () => (AUI.forced ? AUI.forcedMgr : canEditSettings());
function withUser(name, mgr, fn) { AUI.forced = name; AUI.forcedMgr = mgr; try { fn(); } finally { AUI.forced = null; } }
function save() {
  if (S && S.props) S.props.filter(p => p.editOf).forEach(syncEdit); // edits of published properties go straight back to them
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage blocked — keep in memory */ }
}
function load() { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
const getP = id => S.props.find(p => p.id === id);

/* ---------- small helpers ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const chip = (t, tone = '', title = '') => `<span class="chip ${tone}" ${title ? `title="${esc(title)}"` : ''}>${t}</span>`;
const CAP1 = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const CAPW = s => String(s).toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const normKey = s => String(s).toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');
const numOf = s => Number(String(s).replace(/,/g, ''));
const isEmpty = v => v === '' || v == null || (Array.isArray(v) && !v.length);
function getPath(o, path) { return path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o); }
function setPath(o, path, v) { const ks = path.split('.'); let a = o; ks.slice(0, -1).forEach(k => { if (a[k] == null) a[k] = {}; a = a[k]; }); a[ks[ks.length - 1]] = v; }
function go(h) { location.hash = h; }
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.style.display = 'block'; clearTimeout(AUI.toastTimer); AUI.toastTimer = setTimeout(() => { t.style.display = 'none'; }, 2600);
}
const hist = (p, text) => p.history.unshift({ at: TODAY, ts: Date.now(), by: me(), text });
const areaLabel = p => (p.type ? PROPERTY_TYPES[p.type].areaLabel.replace(' (sq.ft.)', '') : 'Area');
const meter = (v, tone = '') => `<div class="meter ${tone}"><i style="width:${clamp(v)}%"></i></div>`;
function hash(s) { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 100003; return h; }

/* ---------- the property record ---------- */
function blank(id) {
  return {
    id, status: 'draft', avail: '', createdBy: me(), createdAt: TODAY, updatedAt: TODAY, submittedBy: '',
    category: '', type: '', purpose: '', title: '', facing: '', area: '', price: '', priceOnRequest: false,
    loc: { address: '', locality: '', city: '', district: '', state: '', country: '', pincode: '', lat: '', lng: '', pinOk: false, precise: true },
    specs: {}, custom: [], amenities: [], amenOnly: [], approvals: [], shownFields: [], steps: {}, docs: {}, photos: 0, videos: 0,
    src: {}, seen: {}, chat: [], queue: [], history: [], asking: null, geoTried: false, dupChecked: false,
  };
}
function newRecord() { const p = blank('D-' + (++S.counter)); S.props.unshift(p); hist(p, 'Draft started'); return p; }
/** A draft nobody has put anything into yet (discarded when you leave it). */
const isBlankDraft = p => p.status === 'draft' && !p.type && !p.category && !p.purpose && !p.loc.city && !p.loc.locality && !p.photos && !p.videos && !Object.keys(p.docs).length && !p.chat.some(m => m.who === 'user');
/** Catalogue fields added for a type (through the AI) count as known fields from then on. */
function fieldsFor(type) {
  if (!type) return [];
  return PROPERTY_TYPES[type].fields.concat(S.catalog.fields.filter(f => f.type === type).map(f => ({ k: f.key, l: f.label, t: f.vtype === 'number' ? 'number' : 'text', added: true })));
}
const allAmenities = () => [...new Set(AMENITIES.concat(...Object.values(AMENITIES_BY_TYPE), S.catalog.amenities.map(a => a.name)))];
/** Fields shown in Details: the type’s core fields, anything already filled in, and anything the person chose to add. */
function shownFields(p) {
  const core = CORE_FIELDS[p.type] || [];
  return fieldsFor(p.type).filter(f => core.includes(f.k) || f.added || !isEmpty(p.specs[f.k]) || (p.shownFields || []).includes(f.k));
}
const coreFields = p => fieldsFor(p.type).filter(f => (CORE_FIELDS[p.type] || []).includes(f.k));
const reqDetails = p => fieldsFor(p.type).filter(f => (REQ_DETAILS[p.type] || []).includes(f.k));
const shortLabel = f => f.l.replace(/ \(.*\)$/, '');
function labelOf(p, path) {
  const MAIN = { type: 'Property type', category: 'Category', purpose: 'Purpose', title: 'Title', facing: 'Facing', price: 'Price', priceOnRequest: 'Price on request', amenities: 'Amenities', approvals: 'Approvals', avail: 'Availability',
    'loc.address': 'Address', 'loc.locality': 'Locality', 'loc.city': 'City', 'loc.district': 'District', 'loc.state': 'State', 'loc.country': 'Country', 'loc.pincode': 'Pincode' };
  if (path === 'area') return areaLabel(p);
  if (MAIN[path]) return MAIN[path];
  if (path.startsWith('specs.')) { const f = fieldsFor(p.type).find(x => 'specs.' + x.k === path); return f ? f.l : path.slice(6); }
  return path;
}
function fmt(p, path, v) {
  if (isEmpty(v)) return '—';
  if (path === 'price') return inrShort(v);
  if (path === 'area') return `${num(v)} sq.ft.`;
  if (path === 'type') return typeLabel(v);
  if (path === 'priceOnRequest') return v ? 'Yes' : 'No';
  if (path === 'purpose') return PURPOSE_LABEL[v] || v;
  if (path === 'approvals') return v.map(k => approvalOf(k).l).join(', ');
  if (Array.isArray(v)) return v.join(', ');
  if (path.startsWith('specs.')) { const f = fieldsFor(p.type).find(x => 'specs.' + x.k === path); if (f && f.t === 'number') return /₹/.test(f.l) ? inr(v) : num(v); }
  return String(v);
}
function setType(p, type) {
  const old = p.specs; p.type = type; p.specs = {};
  if (type) p.category = PROPERTY_TYPES[type].category;
  fieldsFor(type).forEach(f => {
    const k = 'specs.' + f.k;
    if (!isEmpty(old[f.k])) p.specs[f.k] = old[f.k];
    else if (p.seen[k]) { p.specs[f.k] = p.seen[k].v; p.src[k] = { s: 'chat', q: p.seen[k].q, by: me(), at: TODAY }; }
  });
  Object.keys(p.src).filter(k => k.startsWith('specs.') && !(k.slice(6) in p.specs)).forEach(k => delete p.src[k]);
}
function suggestTitle(p) {
  if (!p.type || !(p.loc.locality || p.loc.city)) return '';
  const noun = { plot: 'residential plot', flat: 'apartment', house: /villa/i.test(p.specs.subType || '') ? 'villa' : 'independent house', commercial: (p.specs.commCategory || 'commercial property').split(' / ')[0].toLowerCase(),
    agri: p.specs.acres ? `${num(p.specs.acres)} acres agricultural land` : 'agricultural land', industrial: (p.specs.subType || 'industrial land').toLowerCase() }[p.type];
  const bhk = p.specs.bhk || (p.type === 'house' && p.specs.bedrooms ? `${p.specs.bedrooms} BHK` : '');
  const lead = [p.type === 'plot' && p.specs.corner === 'Corner' ? 'corner' : '', p.type === 'plot' && p.facing ? `${p.facing.toLowerCase()}-facing` : '', bhk, noun].filter(Boolean).join(' ');
  return CAP1(lead) + ', ' + (p.loc.locality || p.loc.city);
}
function description(p) {
  if (!p.type) return '';
  const t = PROPERTY_TYPES[p.type], bits = [];
  bits.push(`${p.specs.bhk ? p.specs.bhk + ' ' : ''}${t.label.toLowerCase()} ${p.purpose === 'Rent' ? 'for rent' : p.purpose === 'Lease' ? 'for lease' : 'for sale'}${p.loc.locality ? ' in ' + p.loc.locality : ''}${p.loc.city ? ', ' + p.loc.city : ''}`);
  if (p.area) bits.push(`${num(p.area)} sq.ft. ${t.areaBasis}${p.facing ? `, ${p.facing.toLowerCase()} facing` : ''}`);
  const f = fieldsFor(p.type).filter(x => !isEmpty(p.specs[x.k]) && !['bhk'].includes(x.k)).slice(0, 4).map(x => `${x.l.toLowerCase()}: ${fmt(p, 'specs.' + x.k, p.specs[x.k])}`);
  if (f.length) bits.push(f.join('; '));
  if (p.amenities.length) bits.push('amenities include ' + p.amenities.slice(0, 5).join(', ').toLowerCase());
  return CAP1(bits.join('. ')) + '.';
}

/* ---------- the simulated AI: plain language → facts ---------- */
function knownAmenity(text) {
  const n = normKey(text);
  const cat = allAmenities().find(a => normKey(a) === n || (n.length > 3 && normKey(a).includes(n)));
  if (cat) return cat;
  const w = AMENITY_WORDS.find(([re]) => re.test(text));
  return w ? w[1] : null;
}
function matchField(type, label) {
  const L = normKey(label);
  const MAIN = { facing: 'facing', direction: 'facing', purpose: 'purpose', listingpurpose: 'purpose', locality: 'loc.locality', area: 'area', city: 'loc.city', district: 'loc.district', pincode: 'loc.pincode', pin: 'loc.pincode', address: 'loc.address' };
  if (MAIN[L]) return MAIN[L];
  const fs = fieldsFor(type);
  if (FIELD_SYNONYMS[L] && fs.some(f => f.k === FIELD_SYNONYMS[L])) return 'specs.' + FIELD_SYNONYMS[L];
  const f = fs.find(x => { const fl = normKey(x.l); return fl === L || (L.length >= 4 && (fl.startsWith(L) || L.startsWith(fl))); });
  return f ? 'specs.' + f.k : null;
}
function parseFor(type, path, value) {
  if (path === 'facing') { const f = FACINGS.find(x => normKey(x) === normKey(value)); return f || null; }
  if (path === 'purpose') { const f = LISTING_PURPOSES.find(x => new RegExp(x, 'i').test(value)); return f || null; }
  if (path === 'area') { const m = String(value).match(/\d[\d,]*(\.\d+)?/); return m ? numOf(m[0]) : null; }
  if (!path.startsWith('specs.')) return CAP1(value);
  const f = fieldsFor(type).find(x => 'specs.' + x.k === path);
  if (!f) return null;
  if (f.t === 'number') { const m = String(value).match(/\d[\d,]*(\.\d+)?/); return m ? numOf(m[0]) : null; }
  if (f.t === 'select') { const v = normKey(value); return f.o.find(o => normKey(o) === v) || f.o.find(o => normKey(o).includes(v) || v.includes(normKey(o))) || CAP1(value); }
  return CAP1(value);
}

/** A map location from a pasted Google Maps link, a WhatsApp location or plain coordinates.
    Short links (maps.app.goo.gl) are resolved by Google in the real build — here they land near the locality (mock). */
function pinFromText(t, p) {
  let m;
  if ((m = t.match(/@(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/)) || (m = t.match(/[?&](?:q|query|ll)=(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/)) || (m = t.match(/(?:^|\s)(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/)))
    return { lat: +m[1], lng: +m[2], q: m[0].trim() };
  if ((m = t.match(/\b(?:https?:\/\/)?(?:maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.com\/\S*|wa\.me\/\S*location)\/?[\w?=&.-]*/i)) && p && p.loc && p.loc.city && typeof geoOf === 'function') {
    const g = geoOf(p.loc.city, p.loc.locality), h = hash(m[0]);
    return { lat: +(g.lat + ((h % 21) - 10) / 2000).toFixed(5), lng: +(g.lng + (((h >> 4) % 21) - 10) / 2000).toFixed(5), q: m[0].trim() };
  }
  return null;
}
function extract(text, p) {
  const t = ' ' + String(text || '').replace(/\s+/g, ' ') + ' ';
  const x = { raw: text, f: {}, amen: [], newAmen: [], custom: [], removeAmen: [], badges: [], unbadges: [], notes: [], avail: null, latlng: null };
  const put = (k, v, q, c = 'ok') => { if (v !== '' && v != null && !(k in x.f)) x.f[k] = { v, q: String(q || '').trim(), c }; };
  let m;
  if ((m = text.match(/^\s*title\s*(?::|is|to|=)\s*(.+)$/i))) { put('title', m[1].trim(), m[0]); return x; }
  if ((m = text.match(/^\s*address\s*(?::|is|=)\s*(.+)$/i))) put('loc.address', m[1].trim(), m[0]);

  // map pin: a Google Maps link or plain coordinates
  x.latlng = pinFromText(t, p);

  // property type (commercial words first: “commercial plot” is commercial)
  if ((m = t.match(/\b(agricultural|agri land|farm ?land|farm|coconut (grove|farm)|mango (grove|farm)|paddy (field|land)|nanjai|punjai)\b/i))) put('type', 'agri', m[0]);
  else if ((m = t.match(/\b(industrial|factory|sipcot|sidco|manufacturing unit)\b/i))) put('type', 'industrial', m[0]);
  else if ((m = t.match(/\b(shops?|showroom|offices?|warehouse|godown|commercial)\b/i))) put('type', 'commercial', m[0]);
  else if ((m = t.match(/\b(villas?|independent house|individual house|row house|houses?|bungalow)\b/i))) put('type', 'house', m[0]);
  else if ((m = t.match(/\b(flats?|apartments?|\d\s*bhk)\b/i))) put('type', 'flat', m[0]);
  else if ((m = t.match(/\b(plots?|land|site)\b(?!\s*visit)/i))) put('type', 'plot', m[0]);
  const type = (x.f.type && x.f.type.v) || p.type;

  if ((m = t.match(/\bfor\s+(rent|lease|sale)\b/i))) put('purpose', CAP1(m[1].toLowerCase()), m[0]);
  else if ((m = t.match(/\bto[- ]let\b/i))) put('purpose', 'Rent', m[0]);
  else if ((m = t.match(/\b(sell|selling|resale)\b/i))) put('purpose', 'Sale', m[0]);
  else if ((m = text.match(/^\s*(sale|rent|lease)\s*$/i))) put('purpose', CAP1(m[1].toLowerCase()), m[0]);

  // location: city, locality, pincode (district, state and country are derived later)
  const nt = normKey(t);
  let city = null;
  Object.keys(CITY_CENTRE).forEach(c => { if (!city && nt.includes(normKey(c))) city = { c, q: c }; });
  Object.entries(CITY_ALIASES).forEach(([a, c]) => { if (!city && new RegExp('\\b' + a + '\\b', 'i').test(t)) city = { c, q: a }; });
  const locs = [];
  Object.entries(CITIES).forEach(([c, info]) => info.localities.forEach(l => { const k = normKey(l); if (k.length >= 4 && nt.includes(k)) locs.push({ c, l }); }));
  const loc = locs.find(o => city && o.c === city.c) || (!city && locs[0]);
  if (city) put('loc.city', city.c, city.q);
  if (loc) { put('loc.locality', loc.l, loc.l.replace(/\s*\(.*\)/, '')); if (!city) put('loc.city', loc.c, `from the locality “${loc.l}”`, 'check'); }
  else if (city && (m = t.match(new RegExp(`(?:\\bin|\\bat|\\bnear)\\s+([A-Za-z][\\w.]*(?:\\s[A-Za-z][\\w.]*){0,2}?),?\\s+${city.q}`, 'i'))) && !/^(the|a|an)$/i.test(m[1]))
    put('loc.locality', CAPW(m[1]), m[0], 'check');
  if ((m = t.match(/\b(6\d{5})\b/))) put('loc.pincode', m[1], m[0]);

  // price — lakh / crore first, then plain ₹ amounts; skip rent and maintenance amounts
  const before = i => t.slice(Math.max(0, i - 22), i).toLowerCase();
  const perMonth = i => /^\s*(per month|\/\s?month|pm\b|p\.m\.|a month|monthly)/i.test(t.slice(i, i + 14));
  if (/price on request|\bPOR\b|price not (disclosed|shared)/i.test(t)) put('priceOnRequest', true, 'price on request');
  for (const mm of t.matchAll(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(crores?|cr\b|lakhs?|lacs?|lakh|l\b)/gi)) {
    const end = mm.index + mm[0].length;
    if (/rent|maintenance|deposit|advance/.test(before(mm.index)) || perMonth(end)) continue;
    put('price', Math.round(Number(mm[1]) * (/^c/i.test(mm[2]) ? 1e7 : 1e5)), mm[0]); break;
  }
  if (!x.f.price) for (const mm of t.matchAll(/(?:₹|rs\.?)\s*([\d,]{5,})/gi)) {
    const end = mm.index + mm[0].length;
    if (/rent|maintenance|deposit|advance/.test(before(mm.index)) || perMonth(end)) continue;
    put('price', numOf(mm[1]), mm[0]); break;
  }
  if ((m = t.match(/\bprice\s*(?:is|:|=|to)?\s*(?:now\s*)?(?:₹|rs\.?)?\s*(\d+(?:\.\d+)?)\s*(?=[,.;]?\s)(?!\s*(?:crores?|cr\b|lakhs?|lacs?|l\b|sq|k\b))/i)) && !x.f.price) x.priceBare = { n: Number(m[1]), q: m[0] };
  if (/negotiable/i.test(t)) x.notes.push('The owner says the price is <b>negotiable</b> — I kept the asking price as given.');

  // areas
  if ((m = t.match(/\bcarpet\D{0,12}(\d[\d,]*)\s*(?:sq\.?\s?ft|sqft|sft)/i))) put('specs.carpet', numOf(m[1]), m[0]);
  for (const mm of t.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s?ft\.?|sqft|sq\.?\s?feet|square\s?feet|sft)/gi)) {
    const b = t.slice(Math.max(0, mm.index - 22), mm.index).toLowerCase(), a = t.slice(mm.index + mm[0].length, mm.index + mm[0].length + 12).toLowerCase(), v = numOf(mm[1]);
    if (/carpet/.test(b)) continue;
    if (/super/.test(b)) put('specs.superBuiltup', v, mm[0]);
    else if (/uds|undivided/.test(b + a)) put('specs.uds', v, mm[0]);
    else if (/plot|land|site/.test(a) && type !== 'plot') put('specs.landArea', v, mm[0]);
    else put('area', v, mm[0]);
  }
  if ((m = t.match(/\b(\d{2,3})\s*(?:ft\.?\s*)?[x×*]\s*(\d{2,3})\b/i))) {
    put('specs.length', Number(m[1]), m[0]); put('specs.width', Number(m[2]), m[0]);
    if (type === 'plot') put('area', Number(m[1]) * Number(m[2]), `${m[0]} (length × width)`, 'check');
  }
  if (type === 'plot' && !x.f.area && x.f['specs.landArea']) x.f.area = x.f['specs.landArea'];

  // facing
  if ((m = t.match(/\b(north|south|east|west)(?:[\s-]?(east|west))?[\s-]*facing\b/i)) || (m = t.match(/\bfacing\s*(?:the\s*)?(north|south|east|west)(?:[\s-]?(east|west))?/i)))
    put('facing', CAP1(m[1].toLowerCase()) + (m[2] ? '-' + CAP1(m[2].toLowerCase()) : ''), m[0]);

  // road, access and plot records
  if ((m = t.match(/(\d{2,3})\s*(?:ft|feet|')\.?\s*(?:wide\s*)?(?:(?:tar|bt|concrete|cement|gravel|mud|main|layout|public)\s*)?road/i))) put('specs.roadWidth', Number(m[1]), m[0]);
  if ((m = t.match(/\b(tar|bt|concrete|cement|cc|gravel|mud)\s*road/i))) put('specs.roadInfra', { tar: 'Tar road', bt: 'Tar road', concrete: 'Concrete road', cement: 'Concrete road', cc: 'Concrete road', gravel: 'Gravel road', mud: 'Mud road' }[m[1].toLowerCase()], m[0]);
  if ((m = t.match(/layout road/i))) put('specs.roadAccess', 'Layout road', m[0]);
  if ((m = t.match(/\bcorner\b/i))) put('specs.corner', 'Corner', m[0]);
  if ((m = t.match(/\b(?:s\.?\s?no\.?|survey\s*(?:no\.?|number))\s*[:.\-]?\s*(\d[\w\/-]*)/i))) put('specs.surveyNo', m[1], m[0]);
  // approval badges (RERA, building approval) — ticked or unticked from the text; the documents come later
  const unRera = /\b(no|not|without|remove|untick|isn'?t)\s+(the\s+)?rera\b|\brera\s+(is\s+)?not\b/i.test(t);
  const unBuild = /\b(no|not|without|remove|untick|isn'?t)\s+(the\s+)?(building approval|approval|dtcp|cmda)\b/i.test(t);
  if (unRera) x.unbadges.push('rera'); else if (/\brera\b/i.test(t)) x.badges.push('rera');
  if (unBuild) x.unbadges.push('building');
  else if (/\b(dtcp|cmda|lpa)\b|approved (building )?plan|building (plan )?approval|plan approval|plan approved|layout approv/i.test(t)) x.badges.push('building');
  // land measures used in Tamil Nadu: acres and cents (1 cent = 435.6 sq.ft.)
  if ((m = t.match(/(\d+(?:\.\d+)?)\s*acres?\b/i))) { put('specs.acres', Number(m[1]), m[0]); if (!x.f.area) put('area', Math.round(Number(m[1]) * 43560), `${m[0]} (1 acre = 43,560 sq.ft.)`, 'check'); }
  if ((m = t.match(/(\d+(?:\.\d+)?)\s*cents?\b/i)) && !x.f.area) put('area', Math.round(Number(m[1]) * 435.6), `${m[0]} (1 cent = 435.6 sq.ft.)`, 'check');
  if ((m = t.match(/(\d{1,4})\s*kva\b/i))) put('specs.powerKva', Number(m[1]), m[0]);
  if ((m = t.match(/\b(sipcot|sidco)\b[^,.;]*/i))) put('specs.estate', m[0].trim().replace(/^\w+/, w => w.toUpperCase()), m[0]);
  if ((m = t.match(/\b(three|3)[ -]?phase\b/i))) put('specs.electricity', 'Three-phase', m[0]);
  if ((m = t.match(/\b(coconut|mango|banana|teak|sugarcane)\s+(trees?|plantation|crop)\b/i))) put('specs.crops', CAP1(m[0].toLowerCase()), m[0]);
  if ((m = t.match(/\b(red|black|alluvial|sandy)\s+soil\b/i))) put('specs.soil', CAP1(m[1].toLowerCase()) + ' soil', m[0]);
  if ((m = t.match(/\b(open well|canal)\b/i))) put('specs.waterSource', CAP1(m[1].toLowerCase()), m[0]);
  else if ((m = t.match(/\bbore ?well\b/i))) put('specs.waterSource', 'Borewell', m[0]);
  if ((m = t.match(/\b(fully|partly)\s+fenced|\bfenced\b/i))) put('specs.fencing', /partly/i.test(m[0]) ? 'Partly fenced' : 'Fully fenced', m[0]);
  const bore = /bore ?well/i.test(t), muni = /(corporation|municipal|metro|panchayat) water/i.test(t);
  if (bore || muni) put('specs.water', bore && muni ? 'Municipal + borewell' : bore ? 'Borewell' : 'Municipal supply', bore && muni ? 'borewell + corporation water' : bore ? 'borewell' : 'corporation water');
  if ((m = t.match(/\b(ugd|underground drainage)\b/i))) put('specs.drainage', 'Underground drainage', m[0]);

  // buildings
  if ((m = t.match(/\b(\d)\s*bhk\b/i))) { if (type === 'house') put('specs.bedrooms', Number(m[1]), m[0]); else put('specs.bhk', Number(m[1]) >= 5 ? '4+ BHK' : `${m[1]} BHK`, m[0]); }
  if ((m = t.match(/\b(\d)\s*(?:bed ?rooms?|beds)\b/i))) put('specs.bedrooms', Number(m[1]), m[0]);
  if ((m = t.match(/\b(\d)\s*(?:bath ?rooms?|baths|toilets)\b/i))) put('specs.bathrooms', Number(m[1]), m[0]);
  if ((m = t.match(/\b(ground|\d{1,2})(st|nd|rd|th)?\s*floor\b/i))) {
    const g = /ground/i.test(m[1]);
    if (type === 'commercial') put('specs.floor', g ? 'Ground floor' : `${m[1]}${m[2] || ''} floor`, m[0]); else put('specs.floor', g ? 0 : Number(m[1]), m[0]);
  }
  if ((m = t.match(/\bg\s*\+\s*(\d{1,2})\b/i))) put(type === 'house' ? 'specs.floors' : 'specs.totalFloors', Number(m[1]) + 1, `${m[0]} (ground + ${m[1]})`);
  if ((m = t.match(/\b(\d)\s*lifts?\b/i))) put('specs.lifts', Number(m[1]), m[0]);
  if ((m = t.match(/\b(\d)?\s*(covered|open|reserved)?\s*car\s*park(?:ing|s)?\b/i))) {
    const n = Number(m[1] || 1), open = /open/i.test(m[2] || '');
    if (type === 'flat') put('specs.parking', open ? '1 open' : n >= 2 ? '2 covered' : '1 covered', m[0]);
    if (type === 'house') put('specs.parking', n >= 3 ? '3+ cars' : n === 2 ? '2 cars' : '1 car', m[0]);
  }
  if ((m = t.match(/maintenance\D{0,12}([\d,]{3,})/i))) put('specs.maintenance', numOf(m[1]), m[0]);
  if ((m = t.match(/ready to move/i))) put('specs.possession', 'Ready to move', m[0]);
  else if ((m = t.match(/under construction/i))) put('specs.possession', 'Under construction', m[0]);
  if ((m = t.match(/(?:built|constructed|completed)\s*(?:in\s*)?((?:19|20)\d\d)/i))) put('specs.constructionYear', Number(m[1]), m[0]);
  if ((m = t.match(/\bvilla/i))) put('specs.subType', 'Villa (gated community)', m[0]);
  else if ((m = t.match(/independent house|individual house/i))) put('specs.subType', 'Independent house', m[0]);
  if ((m = t.match(/\b(office)/i))) put('specs.commCategory', 'Office space', m[0]);
  else if ((m = t.match(/\b(shop|showroom|retail)/i))) put('specs.commCategory', 'Shop / Showroom', m[0]);
  else if ((m = t.match(/\b(warehouse|godown)/i))) put('specs.commCategory', 'Warehouse / Godown', m[0]);
  if ((m = t.match(/(\d{1,3})\s*(?:ft|feet)\s*frontage|frontage\D{0,6}(\d{1,3})/i))) put('specs.frontage', Number(m[1] || m[2]), m[0]);
  if ((m = t.match(/\b(tenanted|rented out)\b/i))) put('specs.occupancy', 'Tenanted', m[0]);
  else if ((m = t.match(/\bvacant\b/i))) put('specs.occupancy', 'Vacant', m[0]);

  // availability (only applied to published properties)
  if ((m = t.match(/\b(available|under negotiation|reserved|booked|on hold|sold)\b/i)) && /\b(mark|set|make|now|status|is|it'?s|as|got)\b/i.test(t) && !/ready to move/i.test(t))
    x.avail = PROPERTY_STATUSES.find(s => s.toLowerCase() === m[1].toLowerCase());

  // amenities: removals first, then known ones anywhere, then new ones after has / with / includes
  let tA = t.replace(/https?:\/\/\S+/gi, ' ');
  for (const mm of t.matchAll(/\b(?:remove|delete|no longer has|doesn'?t have|does not have|there is no|no)\s+(?:the\s+)?([a-z][a-z /-]{2,30}?)(?=[,.;]|\s+(?:and|amenity)\b|\s*$)/gi)) {
    const a = (p.amenities || []).find(x2 => normKey(x2) === normKey(mm[1]) || normKey(x2).includes(normKey(mm[1])));
    if (a) { x.removeAmen.push(a); tA = tA.replace(mm[0], ' '); }
  }
  AMENITY_WORDS.forEach(([re, a]) => { if (re.test(tA)) x.amen.push(a); });
  for (const mm of tA.matchAll(/\b(?:has|have|having|with|includes?|including|features?|comes with|amenities(?:\s*(?::|are|include))?)\s+(.+?)(?=[.;]|$)/gi)) {
    mm[1].split(/,|\band\b|&|\bplus\b/i).forEach(raw => {
      const it = raw.trim().replace(/^(a|an|the|also|its own|own|good|nice|private)\s+/i, '').replace(/\s+(too|also|as well|facility|facilities|available)$/i, '').trim();
      if (!it || /\d/.test(it) || it.split(/\s+/).length > 4 || it.length < 3) return;
      const k = knownAmenity(it);
      if (k) { x.amen.push(k); return; }
      if (AMEN_SKIP.test(it) || matchField(type, it)) return;
      x.newAmen.push(CAP1(it.toLowerCase()));
    });
  }
  x.amen = [...new Set(x.amen)];
  x.newAmen = [...new Set(x.newAmen)].filter(a => !x.amen.some(b => normKey(b) === normKey(a)));

  // “label: value” or “label is value” — a known field, or a new attribute (links are not details)
  text.replace(/https?:\/\/\S+/gi, ' ').split(/[,;\n]|\.(?=\s|$)/).forEach(cl => {
    const mm = cl.match(/^\s*(?:and\s+|also\s+|the\s+)?([a-z][a-z /&'-]{1,30}?)\s*(?::|=|\bis\b|\bare\b)\s*(.{1,40}?)\s*$/i);
    if (!mm) return;
    const label = mm[1].trim(), value = mm[2].trim(), L = normKey(label);
    if (!L || L.length < 3 || LABEL_STOP.has(L) || !value || /^(a|an|the)$/i.test(value)) return;
    const path = matchField(type, label);
    if (path) { if (!(path in x.f)) { const v = parseFor(type, path, value); if (v !== null) put(path, v, cl.trim()); } return; }
    x.custom.push({ label: CAP1(label.toLowerCase()), value: CAP1(value), vtype: /^\d[\d,.]*$/.test(value) ? 'number' : /^(yes|no)$/i.test(value) ? 'yes / no' : 'text', q: cl.trim() });
  });
  return x;
}
const foundSomething = x => Object.keys(x.f).length || x.amen.length || x.newAmen.length || x.custom.length || x.badges.length || (x.unbadges || []).length || x.latlng || x.priceBare;

/* ---------- applying what was understood ---------- */
function aiSay(p, html) { p.chat.push({ who: 'ai', html, at: TODAY }); }
function youSay(p, html) { p.chat.push({ who: 'user', html, by: me(), at: TODAY }); }
const HELP = 'Sorry, I didn’t catch a property detail there. Try something like “price 78 lakhs” or “it has a gym”.';

function changesFrom(p, x) {
  const ch = [];
  const typeOk = x.f.type && x.f.type.v !== p.type && (!p.type || /\b(type|it'?s (a|an)|actually|change|not an?)\b/i.test(x.raw));
  if (typeOk) ch.push({ path: 'type', from: p.type, to: x.f.type.v, q: x.f.type.q });
  const newType = typeOk ? x.f.type.v : p.type;
  const ok = new Set(fieldsFor(newType).map(f => 'specs.' + f.k));
  Object.entries(x.f).forEach(([path, o]) => {
    if (path === 'type') return;
    if (path.startsWith('specs.') && !ok.has(path)) { p.seen[path] = o; return; }
    const from = getPath(p, path);
    if (String(from ?? '') === String(o.v)) return;
    ch.push({ path, from, to: o.v, q: o.q, c: o.c });
  });
  const add = x.amen.filter(a => !p.amenities.includes(a)), rem = x.removeAmen.filter(a => p.amenities.includes(a));
  if (add.length || rem.length) ch.push({ path: 'amenities', from: p.amenities.slice(), to: p.amenities.filter(a => !rem.includes(a)).concat(add), q: add.concat(rem.map(r => 'no ' + r)).join(', ') });
  const badges = (x.badges || []).filter(b => !p.approvals.includes(b)), unbadges = (x.unbadges || []).filter(b => p.approvals.includes(b));
  if (badges.length || unbadges.length) ch.push({ path: 'approvals', from: p.approvals.slice(), to: p.approvals.filter(b => !unbadges.includes(b)).concat(badges), q: badges.concat(unbadges).map(b => approvalOf(b).l).join(', ') });
  if (x.avail && p.status === 'published' && x.avail !== p.avail) ch.push({ path: 'avail', from: p.avail, to: x.avail, q: x.avail });
  if (x.latlng) ch.push({ path: 'pin', from: p.loc.lat !== '' ? `${p.loc.lat}, ${p.loc.lng}` : '', to: `${x.latlng.lat}, ${x.latlng.lng}`, q: x.latlng.q, ll: x.latlng });
  // property-only attributes that already exist are simply updated
  x.custom.filter(c => p.custom.some(d => normKey(d.label) === normKey(c.label))).forEach(c => {
    const d = p.custom.find(e => normKey(e.label) === normKey(c.label));
    if (d.value !== c.value) ch.push({ path: 'custom.' + d.label, from: d.value, to: c.value, q: c.q });
  });
  return ch;
}
function applyChanges(p, ch, kind) {
  ch.forEach(c => {
    if (c.path === 'type') setType(p, c.to);
    else if (c.path === 'pin') { Object.assign(p.loc, { lat: c.ll.lat, lng: c.ll.lng, pinOk: true, precise: true }); p.src['loc.lat'] = { s: kind, q: c.q, by: me(), at: TODAY }; p.queue = p.queue.filter(q => q.kind !== 'pin'); }
    else if (c.path.startsWith('custom.')) p.custom.find(d => d.label === c.path.slice(7)).value = c.to;
    else setPath(p, c.path, c.to);
    if (!['pin'].includes(c.path) && !c.path.startsWith('custom.')) p.src[c.path] = { s: kind, q: c.q || '', by: me(), at: TODAY };
    if (c.path === 'price' && c.to > 0) p.priceOnRequest = false;
    if (c.path === 'loc.city' || c.path === 'loc.locality') { Object.assign(p.loc, { lat: '', lng: '', pinOk: false }); delete p.src['loc.lat']; p.geoTried = false; p.queue = p.queue.filter(q => q.kind !== 'pin'); }
    const lbl = c.path === 'pin' ? 'Map pin' : c.path.startsWith('custom.') ? c.path.slice(7) : labelOf(p, c.path);
    AUI.flash = { id: p.id, paths: (AUI.flash && AUI.flash.id === p.id && Date.now() - AUI.flash.at < 300 ? AUI.flash.paths : []).concat(c.path), at: Date.now() };
    hist(p, `${lbl}: ${c.path === 'pin' || c.path.startsWith('custom.') ? (c.from || '—') : fmt(p, c.path, c.from)} → ${c.path === 'pin' || c.path.startsWith('custom.') ? c.to : fmt(p, c.path, c.to)} (${kind === 'form' ? 'form' : 'chat'})`);
  });
  p.updatedAt = TODAY;
}
/** “type, city, price and 3 more” — a short summary of what changed. */
function updatesText(p, ch) {
  const names = ch.map(c => (c.path === 'pin' ? 'map pin' : c.path === 'approvals' ? 'approval badge' : c.path.startsWith('custom.') ? c.path.slice(7).toLowerCase()
    : c.path === 'type' ? 'property type' : labelOf(p, c.path).replace(/ \(.*\)$/, '').toLowerCase()));
  const uniq = [...new Set(names)];
  return uniq.length <= 4 ? uniq.join(', ').replace(/, ([^,]*)$/, ' and $1') : `${uniq.slice(0, 3).join(', ')} and ${uniq.length - 3} more`;
}

/** Derived values, the map lookup and the checks that run after every change. */
function afterUpdate(p, ch) {
  const notes = [];
  if (p.loc.city && (!p.loc.state || (p.src['loc.state'] && p.src['loc.state'].s === 'derived'))) {
    const d = (CITIES[p.loc.city] || {}).district || p.loc.city;
    if (p.loc.district !== d || p.loc.state !== 'Tamil Nadu') {
      Object.assign(p.loc, { district: d, state: 'Tamil Nadu', country: 'India' });
      ['loc.district', 'loc.state', 'loc.country'].forEach(k => { p.src[k] = { s: 'derived', q: p.loc.city, at: TODAY }; });
    }
  }
  if (p.type && (p.loc.locality || p.loc.city) && (!p.title || (p.src.title && p.src.title.s === 'ai'))) {
    const tt = suggestTitle(p);
    if (tt && tt !== p.title) { p.title = tt; p.src.title = { s: 'ai', q: 'Written from the type and locality — say “title: …” to change it', at: TODAY }; }
  }
  // agricultural land is usually given in acres — work out the area in sq.ft. when it isn’t given
  if (p.type === 'agri' && p.specs.acres > 0 && !(p.area > 0)) { p.area = Math.round(p.specs.acres * 43560); p.src.area = { s: 'derived', q: `${p.specs.acres} acres × 43,560 sq.ft.`, at: TODAY }; }
  // no map pin during creation — city and locality are enough (district, state and country are worked out above)
  if (!p.dupChecked && p.type && p.loc.locality && p.area > 0) {
    p.dupChecked = true;
    // compare with the other drafts and with every property in the main list
    const d = S.props.concat(listed()).find(o => o !== p && o.type === p.type && normKey(o.loc.locality) === normKey(p.loc.locality) && o.area > 0 && Math.abs(o.area - p.area) / o.area <= 0.1);
    if (d) p.queue.unshift({ kind: 'dup', id: d.id });
  }
  if (ch.some(c => c.path === 'price' || c.path === 'area') && p.price > 0 && p.area > 0 && p.type && p.loc.city) {
    const xs = listed().filter(o => o.type === p.type && o.loc.city === p.loc.city && o.price > 0 && o.area > 0).map(o => Math.round(o.price / o.area));
    const ppsf = Math.round(p.price / p.area);
    if (xs.length >= 2) { const min = Math.min(...xs), max = Math.max(...xs); if (ppsf < min * 0.6 || ppsf > max * 1.6) p.queue.push({ kind: 'priceCheck', ppsf, min, max, n: xs.length }); }
  }
  return notes;
}

/** One message from a person, about property p. */
function handle(p, text) {
  const t = text.trim();
  if (/^(publish|submit|send (it )?for approval|approve)\b/i.test(t)) return tryPublish(p);
  if (/\b(what('?s| is)?\s+(missing|left|pending|needed)|still needed|^status\??$)/i.test(t)) return aiSay(p, missingHtml(p));
  const bare = t.match(/^\s*(?:₹|rs\.?)?\s*([\d,]+(?:\.\d+)?)\s*$/i);
  let x;
  if (bare && p.asking === 'price') x = { raw: t, f: {}, amen: [], newAmen: [], custom: [], removeAmen: [], notes: [], priceBare: { n: numOf(bare[1]), q: t } };
  else if (bare && p.asking === 'area') x = { raw: t, f: { area: { v: numOf(bare[1]), q: t } }, amen: [], newAmen: [], custom: [], removeAmen: [], notes: [] };
  else x = extract(t, p);
  // a short answer to “Which locality?” is the locality, even if I don’t know the place
  if (p.asking === 'locality' && !foundSomething(x) && t.split(/\s+/).length <= 4 && /^[a-z][a-z .'-]+$/i.test(t)) x.f['loc.locality'] = { v: CAPW(t), q: t };
  // a short answer to “What should the listing be called?” is the title
  if (p.asking === 'title' && !x.f.title && !foundSomething(x)) x.f.title = { v: t, q: t };
  // a short answer to “What’s the floor number?” / “Which BHK configuration?” fills that detail
  if (p.asking && p.asking.startsWith('specs.') && !x.f[p.asking] && t.split(/\s+/).length <= 5) {
    const f = fieldsFor(p.type).find(y => 'specs.' + y.k === p.asking);
    let v = null;
    if (f && f.t === 'number') { const n = t.match(/\d[\d,]*(\.\d+)?/); v = n ? numOf(n[0]) : /\bground\b/i.test(t) ? 0 : null; }
    else if (f && f.t === 'select') v = f.o.map(o => (typeof o === 'object' ? o.v : o)).find(o => o && (normKey(o) === normKey(t) || normKey(o).startsWith(normKey(t)) || normKey(t).includes(normKey(o)))) || null;
    else if (f) v = t;
    if (v != null) x.f[p.asking] = { v, q: t };
  }
  // “residential” or “commercial” as an answer to the category question sets only the category
  // “skip”, “no”, “later”, “done” move past the photos or amenities step
  if ((p.asking === 'media' || p.asking === 'amenities') && /^(skip|no|nope|not now|later|none|nothing|done|no thanks|that'?s all|next)\b/i.test(t)) return skipStep(p, p.asking, false);
  const catAnswer = t.match(/^(residential|commercial)\.?$/i);
  if (p.asking === 'category' && catAnswer) x = { raw: t, f: { category: { v: CAP1(catAnswer[1].toLowerCase()), q: t } }, amen: [], newAmen: [], custom: [], removeAmen: [], badges: [], notes: [] };
  if (x.priceBare && !x.f.price) {
    if (x.priceBare.n < 1000) p.queue.push({ kind: 'priceUnit', n: x.priceBare.n });
    else x.f.price = { v: x.priceBare.n, q: x.priceBare.q };
  }
  commit(p, x, 'chat');
}
function commit(p, x, kind) {
  const live = p.status === 'published';
  if (live && !isMgr()) { aiSay(p, 'Only an Admin or Sales manager can change a published property. Ask one of them — they can make the change here by chat.'); return; }
  const ch = changesFrom(p, x);
  const newAmen = x.newAmen.filter(a => !p.amenities.some(b => normKey(b) === normKey(a)) && !p.queue.some(q => q.kind === 'newAmenity' && normKey(q.name) === normKey(a)));
  const custom = x.custom.filter(c => !p.custom.some(d => normKey(d.label) === normKey(c.label)) && !p.queue.some(q => q.kind === 'newAttr' && normKey(q.label) === normKey(c.label)));
  if (live && ch.length) p.queue.push({ kind: 'changes', changes: ch });
  else if (ch.length) {
    applyChanges(p, ch, kind);
    const ap = ch.find(c => c.path === 'approvals'), rest = ch.filter(c => c !== ap), said = [];
    if (rest.length) said.push(`filled in ${esc(updatesText(p, rest))}`);
    if (ap) {
      const added = ap.to.filter(k => !ap.from.includes(k)), removed = ap.from.filter(k => !ap.to.includes(k));
      if (added.length) said.push(`ticked ${added.map(k => approvalOf(k).long).join(' and ')} (the document can come later)`);
      if (removed.length) said.push(`removed the ${removed.map(k => approvalOf(k).long).join(' and ')} badge`);
    }
    aiSay(p, `Got it — ${said.join('; ')}.`);
  }
  newAmen.forEach(name => p.queue.push({ kind: 'newAmenity', name }));
  custom.forEach(c => p.queue.push({ kind: 'newAttr', label: c.label, value: c.value, vtype: c.vtype, q: c.q }));
  x.notes.forEach(n => aiSay(p, n));
  if (!live) afterUpdate(p, ch).forEach(n => aiSay(p, n));
  if (!ch.length && !newAmen.length && !custom.length && !x.notes.length && !p.queue.length) aiSay(p, HELP);
  p.updatedAt = TODAY;
}

/* ---------- what is required, and how complete a listing is ----------
   Required to publish: purpose, property type, city, locality, price, area (plot size), the title (the AI suggests one)
   and two key details of the type (REQ_DETAILS). Everything else is optional and counts towards the completion score (100%).
   The exact map location is optional too: without it the property shows on the map as its locality (approximate).
   Approval badges (RERA, building approval) are optional and can be ticked any time; their documents follow later. */
const otherDocs = type => (type ? LEGAL_BY_TYPE[type].filter(k => !['rera', 'layout', 'plan'].includes(k)) : []);
const docName = k => (approvalOf(k) ? approvalOf(k).doc : LEGAL_DOCS[k] ? LEGAL_DOCS[k].n : k);
function missing(p) {
  const m = [];
  if (!p.purpose) m.push({ k: 'purpose', l: 'Purpose (sell, rent or lease)' });
  if (!p.type) m.push({ k: 'type', l: 'Property type' });
  if (!p.loc.city) m.push({ k: 'city', l: 'City' });
  if (!p.loc.locality) m.push({ k: 'locality', l: 'Locality' });
  if (!(p.price > 0)) m.push({ k: 'price', l: p.purpose === 'Rent' ? 'Monthly rent' : 'Price' });
  if (!(p.area > 0)) m.push({ k: 'area', l: p.type ? areaLabel(p) : 'Area / plot size' });
  reqDetails(p).filter(f => isEmpty(p.specs[f.k])).forEach(f => m.push({ k: 'specs.' + f.k, l: shortLabel(f), detail: 1 }));
  if (!String(p.title || '').trim()) m.push({ k: 'title', l: 'Title' });
  return m;
}
const BASIC_KEYS = ['purpose', 'type', 'city', 'locality', 'price', 'area', 'title'];
/** Completion: the six required items (10 each), then the optional ones up to 100%. */
function completionItems(p) {
  const core = coreFields(p), filled = core.filter(f => !isEmpty(p.specs[f.k])).length;
  const badgeDocs = p.approvals.filter(k => p.docs[k]).length, anyDoc = Object.keys(p.docs).length;
  return [
    { k: 'purpose', l: 'Purpose', pts: 10, ok: !!p.purpose, req: 1 },
    { k: 'type', l: 'Property type', pts: 10, ok: !!p.type, req: 1 },
    { k: 'city', l: 'City', pts: 10, ok: !!p.loc.city, req: 1 },
    { k: 'locality', l: 'Locality', pts: 10, ok: !!p.loc.locality, req: 1 },
    { k: 'price', l: 'Price', pts: 10, ok: p.price > 0, req: 1 },
    { k: 'area', l: p.type ? areaLabel(p) : 'Area / plot size', pts: 10, ok: p.area > 0, req: 1 },
    { k: 'details', l: 'Property details', pts: 15, ok: core.length > 0 && filled === core.length, part: core.length ? filled / core.length : 0, hint: core.length ? `${filled} of ${core.length} given` : 'choose the type first' },
    { k: 'photos', l: 'Photos', pts: 10, ok: p.photos > 0, tab: 'media' },
    { k: 'docs', l: p.approvals.length ? 'Approval documents' : 'Legal documents', pts: 10, tab: 'legal',
      ok: p.approvals.length ? badgeDocs === p.approvals.length : anyDoc > 0, part: p.approvals.length ? badgeDocs / p.approvals.length : 0,
      hint: p.approvals.length ? `${badgeDocs} of ${p.approvals.length} uploaded` : 'none uploaded yet' },
    { k: 'amenities', l: 'Amenities', pts: 5, ok: p.amenities.length > 0 },
  ];
}
function completeness(p) { return Math.round(completionItems(p).reduce((s, i) => s + (i.ok ? i.pts : (i.part || 0) * i.pts), 0)); }
const scoreTone = n => (n >= 80 ? 'green' : n >= 50 ? 'amber' : 'red');
const toComplete = p => completionItems(p).filter(i => !i.ok && !i.req);
function optionalNotGiven(p) { return fieldsFor(p.type).filter(f => isEmpty(p.specs[f.k])).map(f => f.l.replace(/ \(.*\)$/, '')); }
function missingHtml(p) {
  const m = missing(p), r = toComplete(p);
  const parts = [m.length ? `<b>Needed to publish (${m.length}):</b><ul>${m.map(x => `<li>${esc(x.l)}</li>`).join('')}</ul>` : '<div><b>Everything needed to publish is here.</b></div>'];
  if (r.length) parts.push(`<b>To reach 100% (optional):</b><ul>${r.map(x => `<li>${esc(x.l)} <span class="muted">+${x.pts}${x.hint ? ' · ' + esc(x.hint) : ''}</span></li>`).join('')}</ul>`);
  return parts.join('') + `<div style="margin-top:6px">Completion: <b>${completeness(p)}%</b></div>`;
}
/* ---------- the hand-over to the main wireframe’s property list ---------- */
/** Properties already in the main list, in the shape the checks here expect. */
function listed() {
  return DB.properties.filter(o => !o.archived).map(o => ({ id: o.id, title: o.title, type: o.type, area: o.area, price: o.price, status: 'published', listed: true, loc: { locality: o.locality, city: o.city } }));
}
const findAny = id => getP(id) || listed().find(o => o.id === id);
/** Turn a finished draft into a property of the main wireframe (old list, old property page, matching). */
function publishToMain(p, approvedBy) {
  const t = PROPERTY_TYPES[p.type], id = 'PROP-' + (++DB.counters.prop);
  const specs = Object.fromEntries(t.fields.map(f => [f.k, isEmpty(p.specs[f.k]) ? '' : p.specs[f.k]]));
  const old = {
    id, title: p.title || suggestTitle(p) || typeLabel(p.type), type: p.type, purpose: p.purpose, status: 'Available', listingDate: DEMO_TODAY,
    city: p.loc.city, locality: p.loc.locality, state: p.loc.state || 'Tamil Nadu', facing: p.facing || '', area: Number(p.area), price: Number(p.price), priceOnRequest: !!p.priceOnRequest,
    amenities: p.amenities.slice(), images: p.photos, videos: p.videos, specs,
    ...legalFromDraft(p),
    extra: p.custom.map(c => ({ label: c.label, value: c.value })),
    location: { address: p.loc.address || '', pincode: p.loc.pincode || '', district: p.loc.district || (CITIES[p.loc.city] || {}).district || p.loc.city,
      lat: p.loc.lat, lng: p.loc.lng, pinOk: !!p.loc.pinOk, roadType: specs.roadInfra || '', roadWidth: specs.roadWidth || '', nearby: [],
      suggestPending: !!(p.loc.pinOk && p.loc.lat !== '') }, // an exact location → look up the places around it once
    valuation: { reviewDate: '', valuerReport: '', notes: '', comparables: [] },
    history: [{ date: DEMO_TODAY, text: `Published${approvedBy ? ` (approved by ${approvedBy})` : ''} — created with the AI assistant as draft ${p.id}, ${completeness(p)}% complete`, by: me() }],
  };
  DB.properties.unshift(old);
  if (typeof addDefaultPlaces === 'function') addDefaultPlaces(old); // the important places nearby, shown by default
  S.props = S.props.filter(x => x !== p);
  window.save(); save();
  return old;
}
/** The draft's approvals and documents in the property's shape (Legal & documents tab). With prev (an existing property),
    what didn't change is kept as it is — including who verified it — and documents added on the property page stay. */
function legalFromDraft(p, prev) {
  prev = prev || { approvals: [], documents: [] };
  const approvals = p.approvals.map(k => {
    const d = p.docs[k], o = prev.approvals.find(a => a.k === k);
    if (o && (!d || o.file === d.file)) return o;
    return d ? { k, status: d.status === 'verified' ? 'verified' : 'uploaded', file: d.file || k + '-document.pdf', uploadedBy: d.by || me(), uploadedAt: d.at || DEMO_TODAY, verifiedBy: '', verifiedAt: '' }
      : { k, status: 'pending', file: '', uploadedBy: '', uploadedAt: '', verifiedBy: '', verifiedAt: '' };
  });
  const documents = prev.documents.slice();
  Object.entries(p.docs).filter(([k]) => !p.approvals.includes(k) && LEGAL_DOCS[k] && !documents.some(x => x.kind === k)).forEach(([k, d]) =>
    documents.push({ id: 'doc-' + k + '-' + hash(p.id + k), name: LEGAL_DOCS[k].n, kind: k, file: d.file || k + '-scan.pdf', uploadedBy: d.by || me(), uploadedAt: d.at || DEMO_TODAY, verified: d.status === 'verified', verifiedBy: '', verifiedAt: '' }));
  return { approvals, documents };
}
/* ---------- editing a published property with the AI assistant ----------
   The property is opened on this page as a live copy (editOf = its ID). Every confirmed change — from the chat or the
   drawer — is written straight back to the property in the main list, with a history line. */
const drafts = () => S.props.filter(p => !p.editOf); // edit copies never show as drafts
function editCopy(old) {
  const p = blank(old.id);
  normLegal(old);
  const appr = old.approvals.map(a => a.k);
  Object.assign(p, {
    editOf: old.id, status: 'published', avail: old.status, createdBy: ((old.history || []).slice(-1)[0] || {}).by || me(), createdAt: old.listingDate, updatedAt: TODAY,
    category: categoryOf(old.type), type: old.type, purpose: old.purpose, title: old.title, facing: old.facing || '',
    area: old.area, price: old.price, priceOnRequest: !!old.priceOnRequest,
    specs: Object.fromEntries(Object.entries(old.specs || {}).filter(([, v]) => !isEmpty(v))),
    custom: (old.extra || []).map(x => ({ label: x.label, value: x.value })),
    amenities: (old.amenities || []).slice(), approvals: appr, photos: old.images || 0, videos: old.videos || 0,
    dupChecked: true, // it is the property itself — no duplicate check
  });
  const OL = old.location || {};
  Object.assign(p.loc, { city: old.city, locality: old.locality, state: old.state || 'Tamil Nadu', district: OL.district || (CITIES[old.city] || {}).district || old.city, country: 'India',
    address: OL.address || '', pincode: OL.pincode || '', lat: OL.lat ?? '', lng: OL.lng ?? '', pinOk: !!(OL.lat !== '' && OL.lat != null && OL.pinOk !== false), precise: true });
  // approval documents, and the property's other documents of a known kind, count as collected here too
  old.approvals.filter(a => a.file).forEach(a => { p.docs[a.k] = { status: a.status === 'verified' ? 'verified' : 'collected', file: a.file, at: a.uploadedAt || old.listingDate, by: a.uploadedBy || '' }; });
  old.documents.filter(d => LEGAL_DOCS[d.kind] && !p.docs[d.kind]).forEach(d => { p.docs[d.kind] = { status: d.verified ? 'verified' : 'collected', file: d.file, at: d.uploadedAt || old.listingDate, by: d.uploadedBy || '' }; });
  p.shownFields = Object.keys(p.specs);
  p.syncedHist = 0;
  return p;
}
/** Open property `id` for editing (always a fresh copy of what is in the list now). */
function startEdit(id) {
  const old = DB.properties.find(o => o.id === id);
  if (!old) return null;
  S.props = S.props.filter(x => x.editOf !== id);
  const p = editCopy(old);
  S.props.unshift(p); save();
  return p;
}
/** Write an edit copy back onto its property. */
function syncEdit(p) {
  const old = DB.properties.find(o => o.id === p.editOf);
  if (!old) return;
  const t = PROPERTY_TYPES[p.type] || PROPERTY_TYPES[old.type];
  Object.assign(old, {
    title: p.title || old.title, type: p.type || old.type, purpose: p.purpose || old.purpose, status: p.avail || old.status,
    city: p.loc.city || old.city, locality: p.loc.locality || old.locality, state: p.loc.state || old.state, facing: p.facing || '',
    area: Number(p.area) || old.area, price: Number(p.price) || old.price, priceOnRequest: !!p.priceOnRequest,
    amenities: p.amenities.slice(), images: p.photos, videos: p.videos,
    specs: Object.assign({}, old.specs, Object.fromEntries(t.fields.map(f => [f.k, isEmpty(p.specs[f.k]) ? '' : p.specs[f.k]]))),
    extra: p.custom.map(c => ({ label: c.label, value: c.value })),
  });
  Object.assign(old, legalFromDraft(p, normLegal(old))); // approvals and documents
  // the address and map pin (nearby places stay as they are — they are managed on the property page)
  old.location = old.location || { nearby: [] };
  const wasExact = old.location.lat !== '' && old.location.lat != null && old.location.pinOk !== false, isExact = p.loc.lat !== '' && p.loc.lat != null && !!p.loc.pinOk;
  if (isExact && !wasExact) old.location.suggestPending = true;
  Object.assign(old.location, { address: p.loc.address || '', pincode: p.loc.pincode || '', district: p.loc.district || old.location.district || '', lat: p.loc.lat, lng: p.loc.lng, pinOk: !!p.loc.pinOk });
  // history: what changed since the last sync, marked as done through the assistant
  const fresh = p.history.length - (p.syncedHist || 0);
  if (fresh > 0) {
    old.history = old.history || [];
    const how = text => (/ \(chat\)$/.test(text) ? text.replace(/ \(chat\)$/, ' — via AI chat') : / \(form\)$/.test(text) ? text.replace(/ \(form\)$/, ' — in the details form') : text + ' — via the AI assistant');
    p.history.slice(0, fresh).reverse().forEach(h => old.history.unshift({ date: DEMO_TODAY, ts: h.ts || Date.now(), by: h.by, text: how(h.text) }));
    p.syncedHist = p.history.length;
  }
  window.save();
}
function tryPublish(p) {
  if (p.status === 'published') return aiSay(p, 'This property is already published.');
  const m = missing(p);
  if (m.length) return aiSay(p, `Not yet — I’ve kept it as a draft. Still needed: ${m.map(x => esc(x.l)).join(', ')}.`);
  if (isMgr()) {
    const old = publishToMain(p);
    toast(`${old.id} published — it’s in the property list now`);
    go('#/properties/' + old.id); // the old property page takes over from here
  } else {
    p.status = 'pending'; p.submittedBy = me(); hist(p, 'Submitted for approval');
    aiSay(p, 'Sent to a Sales manager for approval. You can still add details while you wait.');
  }
}
/** Quick buttons for the optional items that are a click away (photos, badge documents). */
/** What the assistant asks next — one short question, or nothing. */
function nextStep(p) {
  if (p.queue.length) return null;
  if (p.status === 'published') return null; // the input box says “Tell me what changed…”
  if (p.status === 'pending') return isMgr() ? { html: 'Waiting for your approval.', buttons: [{ act: 'approve', l: 'Approve & publish', primary: 1 }, { act: 'sendback', l: 'Send back' }] } : null;
  const m = missing(p);
  // once the required details are in: photos and videos, then amenities (both can be skipped), then publish
  if (!m.length && !p.steps.media && !p.photos && !p.videos) return { key: 'media', ask: 'Would you like to add photos or a video now?',
    html: 'Would you like to add photos or a video now?<div class="hint-line">Listings with photos get far more interest. You can also add them later.</div>',
    buttons: [{ act: 'photo', l: '📎 Add photos', primary: 1 }, { act: 'video', l: '🎬 Add video' }, { act: 'skipStep', k: 'media', l: 'Skip for now' }] };
  if (!m.length && !p.steps.amenities) {
    const list = [...new Set((AMENITIES_BY_TYPE[p.type] || []).concat(p.amenities))];
    return { key: 'amenities', ask: 'Does it have any of these amenities?',
      html: `Does it have any of these amenities?<div class="hint-line">Tap the ones it has, or type any others — e.g. “it has a home theatre”.</div>`,
      buttons: list.map(a => ({ act: 'amenAns', v: a, l: (p.amenities.includes(a) ? '✓ ' : '＋ ') + a, on: p.amenities.includes(a) }))
        .concat([{ act: 'skipStep', k: 'amenities', l: p.amenities.length ? 'Done' : 'Skip', primary: p.amenities.length > 0 }]) };
  }
  if (!m.length) {
    // all required details are in; approvals are optional — offer them as one-tap badges
    const offer = allApprovals().filter(a => !p.approvals.includes(a.k));
    return { html: `Everything needed is here. Ready to publish?${offer.length ? '<div class="hint-line">Approvals are optional — tick them now, or later when the documents are ready.</div>' : ''}`,
      buttons: [{ act: 'publish', l: isMgr() ? 'Publish' : 'Submit for approval', primary: 1 }].concat(offer.map(a => ({ act: 'badge', k: a.k, l: `＋ ${a.long}` }))) };
  }
  const first = m[0]; let ask = '', buttons = [];
  if (first.k === 'purpose') { ask = 'Sell, rent or lease?'; buttons = LISTING_PURPOSES.map(v => ({ act: 'ans', k: 'purpose', v, l: PURPOSE_LABEL[v] })); }
  else if (first.k === 'type' && !p.category) { ask = 'Residential or commercial?'; buttons = CATEGORIES.map(v => ({ act: 'ans', k: 'category', v, l: v })); return { key: 'category', ask, html: esc(ask), buttons }; }
  else if (first.k === 'type') { ask = `What type of ${p.category.toLowerCase()} property?`; buttons = typesIn(p.category).map(k => ({ act: 'ans', k: 'type', v: k, l: PROPERTY_TYPES[k].label })); }
  else if (first.k === 'city') ask = 'Which city is it in?';
  else if (first.k === 'locality') ask = `Which locality in ${p.loc.city}?`;
  else if (first.k === 'price') ask = p.purpose === 'Rent' ? 'What’s the monthly rent?' : 'What’s the price?';
  else if (first.k === 'area') ask = p.type === 'agri' ? 'How big is the land? (acres or sq.ft.)' : `What’s the ${(p.type ? areaLabel(p) : 'area').toLowerCase()} in sq.ft.?`;
  else if (first.k === 'title') { ask = 'What should the listing be called?'; const tt = suggestTitle(p); if (tt) buttons = [{ act: 'ans', k: 'title', v: tt, l: '✓ ' + tt }]; }
  else { // a required key detail of the type
    const f = fieldsFor(p.type).find(x => 'specs.' + x.k === first.k), l = shortLabel(f), lc = /^[A-Z][a-z]/.test(l) ? l[0].toLowerCase() + l.slice(1) : l;
    ask = f.t === 'select' ? `Which ${lc}?` : `What’s the ${lc}?`;
    if (f.t === 'select') buttons = f.o.map(o => (typeof o === 'object' ? o.v : o)).filter(Boolean).slice(0, 8).map(v => ({ act: 'ans', k: first.k, v, l: v }));
  }
  return { key: first.k, ask, html: esc(ask), buttons };
}
/** Move past the optional photos or amenities step. */
function skipStep(p, k, viaButton) {
  if (viaButton) youSay(p, k === 'amenities' && p.amenities.length ? 'Done' : 'Skip for now');
  p.steps[k] = true;
  aiSay(p, k === 'media' ? 'No problem — you can add photos and videos any time from the summary.'
    : p.amenities.length ? `Great — ${p.amenities.length} amenit${p.amenities.length > 1 ? 'ies' : 'y'} added.` : 'OK — no amenities for now.');
  p.updatedAt = TODAY;
}
/** Before the person answers, keep the question in the conversation so the history reads naturally. */
function freezeNext(p) {
  if (!p.chat.some(m => m.who === 'user')) { p.asking = null; return; } // the greeting already asks
  const n = nextStep(p);
  // ask again only when the question changes (uploading three documents in a row is one question)
  if (n && n.ask) { if (n.key !== p.asking) aiSay(p, esc(n.ask)); p.asking = n.key; }
  else p.asking = null;
}
function talk(p, text) { freezeNext(p); youSay(p, esc(text)); handle(p, text); }

/* ---------- pending decisions (one card at a time) ---------- */
function queueText(p, q) {
  switch (q.kind) {
    case 'dup': { const o = findAny(q.id); return o ? `Is this the same as <a href="#/properties/${o.listed ? '' : 'draft/'}${o.id}" target="_blank" rel="noopener">${o.id}</a> — ${esc(o.title)}?` : 'Is this a property we already have?'; }
    case 'newAmenity': return `“${esc(q.name)}” is a new amenity. Add it to the list?`;
    case 'newAttr': return `New detail: <b>${esc(q.label)}</b> — ${esc(q.value)}. Save it?`;
    case 'pin': return p.loc.precise
      ? `Is the map pin for ${esc(p.loc.locality || p.loc.city)} right? <a href="https://www.google.com/maps?q=${p.loc.lat},${p.loc.lng}" target="_blank" rel="noopener">View</a>`
      : `I only found ${esc(p.loc.city)} on the map. Can you send the exact location?`;
    case 'priceUnit': return `₹${q.n} lakh or ₹${q.n} crore?`;
    case 'priceCheck': return `${inr(q.ppsf)}/sq.ft. looks unusual for ${esc(p.loc.city)}. Is the price right?`;
    case 'changes': return `Save these changes?<table>${q.changes.map(c => {
      const lbl = c.path === 'pin' ? 'Map pin' : c.path.startsWith('custom.') ? c.path.slice(7) : labelOf(p, c.path);
      const f = v => c.path === 'pin' || c.path.startsWith('custom.') ? esc(v || '—') : esc(fmt(p, c.path, v));
      return `<tr><td>${esc(lbl)}</td><td class="muted">${f(c.from)}</td><td>→ <b>${f(c.to)}</b></td></tr>`;
    }).join('')}</table>`;
    default: return '';
  }
}
function queueButtons(p, q) {
  switch (q.kind) {
    case 'dup': return [{ c: 'different', l: 'No, it’s new', primary: 1 }, { c: 'same', l: 'Yes, open it' }];
    case 'newAmenity': return [{ c: 'list', l: 'Add to list', primary: 1 }, { c: 'only', l: 'Only here' }, { c: 'skip', l: 'Skip' }];
    case 'newAttr': return (p.type ? [{ c: 'type', l: 'For all of this type', primary: 1 }] : []).concat([{ c: 'only', l: 'Only here', primary: !p.type }, { c: 'skip', l: 'Skip' }]);
    case 'pin': return (p.loc.precise ? [{ c: 'ok', l: 'Yes', primary: 1 }] : []).concat([{ c: 'link', l: 'Send location' }, { c: 'later', l: 'Later' }]);
    case 'priceUnit': return [{ c: 'lakh', l: 'Lakh', primary: 1 }, { c: 'crore', l: 'Crore' }, { c: 'rupees', l: `₹${q.n} exactly` }];
    case 'priceCheck': return [{ c: 'ok', l: 'It’s right', primary: 1 }, { c: 'change', l: 'Change it' }];
    case 'changes': return [{ c: 'apply', l: 'Save', primary: 1 }, { c: 'cancel', l: 'Cancel' }];
    default: return [];
  }
}
function resolve(p, choice) {
  const q = p.queue[0]; if (!q) return;
  const label = (queueButtons(p, q).find(b => b.c === choice) || {}).l || choice;
  aiSay(p, queueText(p, q).replace(/<table[\s\S]*<\/table>/, ''));
  youSay(p, esc(label));
  p.queue.shift();
  switch (q.kind) {
    case 'dup':
      if (choice === 'same') {
        const o = findAny(q.id);
        S.props = S.props.filter(x => x !== p);
        if (o.listed) { save(); toast(`Draft ${p.id} discarded — ${o.id} is already listed`); go('#/properties/' + o.id); return 'nav'; }
        o.chat.push({ who: 'ai', html: `A new draft (${p.id}) matched this property, so I discarded it and brought you here. Tell me what has changed.`, at: TODAY });
        save(); go('#/properties/draft/' + o.id); return 'nav';
      }
      hist(p, `Checked against ${q.id} — a different property`); aiSay(p, `Noted — I’ll keep it separate from ${q.id}.`); break;
    case 'newAmenity':
      if (choice === 'skip') { aiSay(p, `Left out “${esc(q.name)}”.`); break; }
      if (choice === 'list' && !S.catalog.amenities.some(a => normKey(a.name) === normKey(q.name))) S.catalog.amenities.push({ name: q.name, by: me(), at: TODAY, from: p.id });
      p.amenities.push(q.name); if (choice === 'only') p.amenOnly.push(q.name);
      p.src.amenities = { s: 'chat', q: q.name, by: me(), at: TODAY };
      hist(p, `Amenity added: ${q.name}${choice === 'only' ? ' (this property only)' : ' (new in the amenity list)'}`);
      aiSay(p, choice === 'list' ? `Added “${esc(q.name)}” to this property and to the amenity list.` : `Added “${esc(q.name)}” to this property only.`);
      break;
    case 'newAttr': {
      if (choice === 'skip') { aiSay(p, `Left out “${esc(q.label)}”.`); break; }
      if (choice === 'type') {
        const key = 'x_' + normKey(q.label);
        if (!S.catalog.fields.some(f => f.type === p.type && f.key === key)) S.catalog.fields.push({ key, label: q.label, type: p.type, vtype: q.vtype, by: me(), at: TODAY, from: p.id });
        p.specs[key] = q.vtype === 'number' ? numOf(q.value) : q.value; p.src['specs.' + key] = { s: 'chat', q: q.q, by: me(), at: TODAY };
        aiSay(p, `Added “${esc(q.label)}” as a field for all ${typeLabel(p.type)} properties, and set it to ${esc(q.value)} here. Other properties of this type will show it as an optional detail.`);
      } else {
        p.custom.push({ label: q.label, value: q.value, vtype: q.vtype, by: me(), at: TODAY, q: q.q });
        aiSay(p, `Added “${esc(q.label)}: ${esc(q.value)}” to this property only.`);
      }
      hist(p, `New attribute: ${q.label} = ${q.value}${choice === 'type' ? ` (for all ${typeLabel(p.type)} properties)` : ' (this property only)'}`);
      break;
    }
    case 'pin':
      if (choice === 'ok') { p.loc.pinOk = true; p.src['loc.lat'] = { s: 'google', q: 'Confirmed by ' + me(), by: me(), at: TODAY }; hist(p, `Map pin confirmed (${p.loc.lat}, ${p.loc.lng})`); aiSay(p, 'Pin confirmed.'); }
      else if (choice === 'later') { p.pinLater = true; aiSay(p, 'OK, you can confirm it later.'); }
      else { p.asking = 'pin'; aiSay(p, 'OK — paste the Google Maps link (Share → Copy link) or the coordinates, for example 9.9301, 78.1452.'); }
      break;
    case 'priceUnit': {
      const v = choice === 'lakh' ? q.n * 1e5 : choice === 'crore' ? q.n * 1e7 : q.n;
      const ch = [{ path: 'price', from: p.price, to: v, q: `${q.n} (${label})` }];
      if (p.status === 'published') p.queue.unshift({ kind: 'changes', changes: ch }); else { applyChanges(p, ch, 'chat'); aiSay(p, `Asking price set to ${inrShort(v)}.`); afterUpdate(p, ch); }
      break;
    }
    case 'priceCheck':
      if (choice === 'ok') { hist(p, `Price per sq.ft. checked — kept at ${inr(q.ppsf)}`); aiSay(p, 'OK, I’ll keep the price.'); }
      else { p.asking = 'price'; aiSay(p, 'What’s the correct asking price?'); }
      break;
    case 'changes':
      if (choice === 'apply') { applyChanges(p, q.changes, 'chat'); aiSay(p, `Saved — ${esc(updatesText(p, q.changes))} updated.`); afterUpdate(p, q.changes).forEach(n => aiSay(p, n)); }
      else aiSay(p, 'Cancelled — nothing was changed.');
      break;
  }
  p.updatedAt = TODAY;
}

/* ---------- uploads (from the chat, the Media tab or the Legal documents tab) ---------- */
function upload(p, doc, viaChat) {
  p.docs[doc] = { status: 'collected', file: `${docName(doc).replace(/[^A-Za-z]+/g, '-').replace(/-$/, '')}.pdf`, at: TODAY, by: me() };
  hist(p, `Document uploaded: ${docName(doc)} (pending verification)`);
  if (viaChat) { youSay(p, `📎 ${esc(p.docs[doc].file)}`); aiSay(p, `Got the ${esc(docName(doc))} — marked <b>Collected, pending verification</b> (only an authorised legal professional can mark it verified). Completion is now ${completeness(p)}%.`); }
  p.updatedAt = TODAY;
}
function addPhotos(p, viaChat) {
  p.photos += 3; p.steps.media = true; hist(p, 'Photos added (3)');
  if (viaChat) { youSay(p, '📎 3 photos'); aiSay(p, `Added 3 photos (${p.photos} in total). I’ll use the first one as the cover. Completion is now ${completeness(p)}%.`); }
  p.updatedAt = TODAY;
}
function addVideo(p, viaChat) {
  p.videos += 1; p.steps.media = true; hist(p, 'Video added');
  if (viaChat) { youSay(p, '🎬 1 video'); aiSay(p, 'Added the video to the Media tab.'); }
  p.updatedAt = TODAY;
}

/* ---------- seed: the sample properties become published records; four drafts show the different ways in ---------- */
const GREET = 'Hi! Describe the property in your own words and I’ll fill in the details for you.';
function seed() {
  // drafts only: published properties live in the main wireframe’s list
  S = { v: 1, counter: 1000, props: [], catalog: { amenities: [], fields: [], approvals: [] } };
  // AI assistant: a Sales executive's flat, submitted for approval
  withUser(EXEC, false, () => {
    const p = newRecord(); aiSay(p, GREET);
    talk(p, '2 BHK flat for sale in Porur, Chennai. 980 sqft, 3rd floor, east facing. Asking 62 lakhs. RERA registered. Has a gym, swimming pool and a rooftop garden.');
    while (p.queue.length) resolve(p, p.queue[0].kind === 'pin' ? 'ok' : p.queue[0].kind === 'newAmenity' ? 'list' : 'different');
    freezeNext(p); addPhotos(p, true); freezeNext(p); upload(p, 'rera', true);
    p.steps.amenities = true; youSay(p, 'Submit for approval'); tryPublish(p);
    stamp(p, '2026-11-14');
  });
  // AI assistant: a Sales manager's plot — ready to publish; DTCP badge ticked, document not uploaded yet
  withUser('Sales manager', true, () => {
    const p = newRecord(); aiSay(p, GREET);
    talk(p, 'Corner plot for sale in Kappalur, Madurai. 60x40, 2400 sqft, east facing, 40 ft tar road, DTCP approved. Asking 45 lakhs. Compound wall: built on all sides');
    while (p.queue.length) resolve(p, p.queue[0].kind === 'pin' ? 'ok' : p.queue[0].kind === 'newAttr' ? 'only' : 'different');
    addPhotos(p, false);
    stamp(p, '2026-11-15');
  });
  // the form: a Sales manager started agricultural land — the locality is still missing
  withUser('Sales manager', true, () => {
    const p = newRecord(); aiSay(p, GREET);
    const ch = [{ path: 'purpose', from: '', to: 'Sale' }, { path: 'type', from: '', to: 'agri' }, { path: 'loc.city', from: '', to: 'Dindigul' }, { path: 'specs.acres', from: '', to: 5 }, { path: 'specs.waterSource', from: '', to: 'Borewell' }];
    applyChanges(p, ch.slice(0, 2), 'form'); applyChanges(p, ch.slice(2), 'form'); afterUpdate(p, ch);
    p.queue = []; hist(p, 'Filled in with the form'); p.steps.media = true;
    stamp(p, '2026-11-17');
  });
  // AI assistant: a Sales executive's flat from yesterday — the purpose wasn't mentioned
  withUser(EXEC, false, () => {
    const p = newRecord(); aiSay(p, GREET);
    talk(p, '3 BHK flat in Thirunagar, Madurai. 2nd floor of G+4, 1,350 sq.ft built-up, north-east facing. 1 covered car parking, lift and power backup. Ready to move.');
    stamp(p, '2026-11-17');
  });
  return S;
}
function stamp(p, day) { p.createdAt = p.updatedAt = day; p.chat.forEach(m => { m.at = day; }); p.history.forEach(h => { h.at = day; }); Object.values(p.src).forEach(s => { if (s.at) s.at = day; }); Object.values(p.docs).forEach(d => { d.at = day; }); }

/* =====================================================================
   Views
   ===================================================================== */
const canEdit = p => !(p.status === 'published' && !isMgr());
function badgesInline(p) {
  return p.approvals.map(k => { const d = p.docs[k]; return chip(approvalOf(k).l + (d ? '' : ' · doc pending'), d ? (d.status === 'verified' ? 'green' : 'blue') : 'amber', d ? (d.status === 'verified' ? 'Document verified' : 'Document uploaded, pending verification') : 'Badge selected — document not uploaded yet'); }).join(' ');
}

/* ---------- property page ---------- */
const fid = path => 'f-' + path.replace(/[^a-zA-Z0-9]+/g, '-');
function srcMini(s) {
  if (!s) return '';
  const m = { chat: ['✨ AI', 'Filled in by the AI assistant'], google: ['🗺 Google', 'From Google Maps (mock)'], ai: ['✨ AI-written', 'Written by the AI from the details'], derived: ['auto', 'Worked out automatically'], import: ['📄 File', 'From the import file'] }[s.s];
  return m ? `<span class="srcmini s-${s.s}" title="${esc(m[1] + (s.q ? ` — “${s.q}”` : ''))}">${m[0]}</span>` : '';
}
const inputCtl = (p, path, val, type, dis, extra = '') => `<input id="${fid(path)}" data-f="${esc(path)}" data-id="${p.id}" type="${type}" ${type === 'number' ? 'step="any" min="0"' : ''} value="${esc(val ?? '')}" ${dis} ${extra}>`;
const selectCtl = (p, path, list, val, dis, blankL = '—') => `<select id="${fid(path)}" data-f="${esc(path)}" data-id="${p.id}" ${dis}><option value="">${blankL}</option>${list.map(o => { const v = typeof o === 'object' ? o.v : o, l = typeof o === 'object' ? o.l : o; return `<option value="${esc(v)}" ${String(v) === String(val ?? '') ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
const pillsCtl = (p, path, list, val, dis, act = 'fset') => `<div class="pills" id="${fid(path)}" tabindex="-1">${list.map(o => `<button type="button" class="pill ${o.v === val ? 'on' : ''}" data-ap="${act}" data-id="${p.id}" data-path="${path}" data-v="${esc(o.v)}" ${dis}>${esc(o.l)}</button>`).join('')}</div>`;
const fieldHtml = (p, path, label, control, o = {}) => `<div class="f ${o.cls || ''}"><label for="${fid(path)}">${label}${o.req ? ' <span class="req">*</span>' : ''} ${srcMini(p.src[path])}</label>${control}${o.hint ? `<span class="hint">${o.hint}</span>` : ''}</div>`;

/** A round progress ring with the percentage in the middle. */
function ring(score, size = 64) {
  const r = (size - 8) / 2, c = 2 * Math.PI * r, off = c * (1 - score / 100);
  return `<svg class="ring ring-${scoreTone(score)}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-label="${score}% complete" role="img">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" style="font-size:${size > 50 ? 15 : 11}px">${score}%</text></svg>`;
}
/** A small score ring for list rows. */
const miniRing = (score, size = 46) => ring(score, size).replace('class="ring ', 'class="ring ring-mini ');
/** The single most useful next step: a required item first, then the biggest optional one. */
function nextItem(p) { const items = completionItems(p).filter(i => !i.ok); return items.find(i => i.req) || items.sort((a, b) => b.pts - a.pts)[0] || null; }
function progressSentence(p) {
  const m = missing(p);
  if (m.length) return `${m.length} required item${m.length > 1 ? 's' : ''} left before you can publish`;
  if (completeness(p) >= 100) return 'Complete — every detail is in';
  return p.status === 'published' ? 'Published — add more to reach 100%' : 'Ready to publish — the rest is optional';
}
/** Optional exact location: the sales executive's current location, or a pasted Maps / WhatsApp link. Without it the
    property is shown on the map as its locality (approximate). */
function pinCtl(p, dis) {
  const L = p.loc, exact = L.lat !== '' && L.lat != null && L.pinOk;
  if (exact) {
    const s = p.src['loc.lat'];
    return `<div class="pin-line ok"><span>📍 <b>Exact location set</b> <span class="muted">${L.lat}, ${L.lng}${s && s.q ? ' · ' + esc(String(s.q).length > 40 ? String(s.q).slice(0, 40) + '…' : s.q) : ''}</span></span>
      <a href="https://www.google.com/maps?q=${L.lat},${L.lng}" target="_blank" rel="noopener">View on map ↗</a>${dis ? '' : `<button type="button" class="linkbtn danger" data-ap="pinClear" data-id="${p.id}">Remove</button>`}</div>`;
  }
  return `<div class="pin-line">
      <div class="pin-ctl"><button type="button" class="btn sm" data-ap="pinHere" data-id="${p.id}" ${dis}>📍 Use my current location</button><span class="muted">or</span>
        <input id="${fid('pin')}" placeholder="Paste a Google Maps link or WhatsApp location" ${dis}><button type="button" class="btn sm" data-ap="pinLink" data-id="${p.id}" ${dis}>Use link</button></div>
      <span class="hint">${L.locality ? `Skip it if you like — the map will show <b>${esc(L.locality)}</b> as an approximate location until it is set.` : 'Skip it if you like — the map shows the locality until it is set.'}</span></div>`;
}
function setPin(p, ll, how) {
  if (!canEdit(p)) { toast('Only an Admin or Sales manager can change a published property'); return; }
  const ch = [{ path: 'pin', from: p.loc.lat !== '' ? `${p.loc.lat}, ${p.loc.lng}` : '', to: `${ll.lat}, ${ll.lng}`, q: how, ll }];
  applyChanges(p, ch, 'form'); afterUpdate(p, ch);
  if (!p.loc.pincode && typeof geoOf === 'function' && p.loc.city) p.loc.pincode = geoOf(p.loc.city, p.loc.locality).pin; // Google fills the pincode from the pin
  p.updatedAt = TODAY; save(); toast('Exact location set'); render();
}
function detailsTab(p) {
  const dis = canEdit(p) ? '' : 'disabled', t = p.type ? PROPERTY_TYPES[p.type] : null, L = p.loc;
  const typeList = p.category ? typesIn(p.category).map(k => ({ v: k, l: PROPERTY_TYPES[k].label })) : [];
  const localities = (CITIES[L.city] || { localities: [] }).localities;
  const shown = shownFields(p), coreKeys = CORE_FIELDS[p.type] || [];
  // only a few suggested extras are offered as chips; anything else via “Something else” (or by telling the AI)
  const more = fieldsFor(p.type).filter(f => (SUGGESTED_FIELDS[p.type] || []).includes(f.k) && !shown.includes(f));
  const rmBtn = (act, attr, name) => (dis ? '' : `<button type="button" class="rm-field" data-ap="${act}" data-id="${p.id}" ${attr} title="Remove ${esc(name)}" aria-label="Remove ${esc(name)}">✕</button>`);
  const reqKeys = REQ_DETAILS[p.type] || [];
  const specs = shown.slice().sort((a, b) => reqKeys.includes(b.k) - reqKeys.includes(a.k)).map(x => fieldHtml(p, 'specs.' + x.k, esc(x.l) + (x.added ? ' <span class="newtag">New field</span>' : '') + (coreKeys.includes(x.k) ? '' : rmBtn('hideField', `data-k="${x.k}"`, x.l)),
    x.t === 'select' ? selectCtl(p, 'specs.' + x.k, x.o, p.specs[x.k], dis) : inputCtl(p, 'specs.' + x.k, p.specs[x.k], x.t === 'number' ? 'number' : x.t === 'month' ? 'month' : 'text', dis), { hint: x.h, req: reqKeys.includes(x.k) })).join('');
  const custom = p.custom.map(c => `<div class="f"><label for="${fid('custom.' + c.label)}">${esc(c.label)} <span class="newtag">This property only</span>${rmBtn('rmCustom', `data-l="${esc(c.label)}"`, c.label)}</label>${inputCtl(p, 'custom.' + c.label, c.value, 'text', dis)}</div>`).join('');
  const addOpen = AUI.addOpen || {};
  const addLink = (k, label) => (dis ? '' : `<div class="sec-tools"><button type="button" class="linkbtn" data-ap="openAdd" data-k="${k}">＋ ${label}</button></div>`);
  const amenList = [...new Set((AMENITIES_BY_TYPE[p.type] || []).concat(p.amenities))];
  const amen = amenList.map(a => `<label class="check"><input type="checkbox" data-amen="${esc(a)}" data-id="${p.id}" ${p.amenities.includes(a) ? 'checked' : ''} ${dis}> ${esc(a)}</label>`).join('');
  const badges = allApprovals().map(a => {
    const on = p.approvals.includes(a.k), d = p.docs[a.k];
    const st = !on ? '' : d ? (d.status === 'verified' ? '<small>document verified</small>' : '<small>document uploaded</small>') : '<small class="pend">document pending</small>';
    return `<button type="button" class="badge-tog ${on ? 'on' : ''}" data-ap="badge" data-id="${p.id}" data-k="${a.k}" ${dis} title="${on ? 'Click to remove' : 'Click to add'}"><span>${on ? '✓ ' : '＋ '}${esc(a.long)}</span>${st}</button>`;
  }).join('');
  // four sections joined by a vertical step indicator; each can be collapsed with its arrow
  const m = missing(p), core = coreFields(p), coreIn = core.filter(f => !isEmpty(p.specs[f.k])).length;
  const req = reqDetails(p), reqIn = req.filter(f => !isEmpty(p.specs[f.k])).length, basicLeft = m.filter(x => BASIC_KEYS.includes(x.k)).length;
  const appr = p.approvals.map(k => `${approvalOf(k).l}${p.docs[k] ? '' : ' · document pending'}`).join(', ');
  const aiTitle = p.src.title && p.src.title.s === 'ai';
  const steps = [
    { k: 'basic', title: 'Required details', done: !basicLeft, status: basicLeft ? `${BASIC_KEYS.length - basicLeft} of ${BASIC_KEYS.length} filled` : 'Complete', req: true,
      body: `<div class="fgrid c2">
          ${fieldHtml(p, 'title', 'Listing title', inputCtl(p, 'title', p.title, 'text', dis, 'placeholder="Suggested for you once the type and locality are known"'),
            { req: 1, cls: 'span3', hint: p.title ? (aiTitle ? '✨ Suggested by the AI from the type and locality — change it any time' : 'Your title — the AI won’t change it') : '' })}
          ${fieldHtml(p, 'purpose', 'I want to', pillsCtl(p, 'purpose', LISTING_PURPOSES.map(v => ({ v, l: PURPOSE_LABEL[v] })), p.purpose, dis), { req: 1 })}
          ${fieldHtml(p, 'category', 'Category', pillsCtl(p, 'category', CATEGORIES.map(v => ({ v, l: v })), p.category, dis, 'fcat'), { req: 1, hint: 'Agricultural and industrial land are under Commercial' })}
          ${fieldHtml(p, 'type', 'Property type', p.category ? pillsCtl(p, 'type', typeList, p.type, dis) : '<div class="pick-first" id="f-type" tabindex="-1">Choose a category first — the types depend on it.</div>', { req: 1, cls: 'span3' })}
          ${fieldHtml(p, 'loc.city', 'City / town', selectCtl(p, 'loc.city', Object.keys(CITY_CENTRE), L.city, dis), { req: 1 })}
          ${fieldHtml(p, 'loc.locality', 'Locality', inputCtl(p, 'loc.locality', L.locality, 'text', dis, `list="loc-list" placeholder="e.g. ${esc(localities[0] || 'Anna Nagar')}"`) + `<datalist id="loc-list">${localities.map(l => `<option value="${esc(l)}">`).join('')}</datalist>`, { req: 1, hint: L.city ? `${esc([L.district && L.district + ' district', L.state, L.country].filter(Boolean).join(', '))} — filled in automatically` : '' })}
          ${fieldHtml(p, 'pin', 'Exact location <span class="opt-tag">Optional</span>', pinCtl(p, dis), { cls: 'span3' })}
          ${fieldHtml(p, 'price', p.purpose === 'Rent' ? 'Monthly rent (₹)' : 'Price (₹)', inputCtl(p, 'price', p.price, 'number', dis), { req: 1, hint: p.price > 0 ? inrShort(p.price) + (p.area > 0 ? ` · ${inr(Math.round(p.price / p.area))}/sq.ft.` : '') : '' })}
          ${fieldHtml(p, 'area', t ? t.areaLabel : 'Area / plot size (sq.ft.)', inputCtl(p, 'area', p.area, 'number', dis), { req: 1 })}
          <div class="f span3"><label class="check"><input type="checkbox" id="${fid('priceOnRequest')}" data-f="priceOnRequest" data-id="${p.id}" ${p.priceOnRequest ? 'checked' : ''} ${dis}> Hide the price on the listing (“price on request”)</label></div>
        </div>` },
    { k: 'details', title: t ? `${esc(t.label)} details` : 'Property details', done: req.length > 0 && reqIn === req.length, req: true,
      status: t ? (reqIn < req.length ? `${reqIn} of ${req.length} required filled` : `Required filled · ${coreIn} of ${core.length} key details`) : 'Choose the type first',
      body: t ? `<div class="fgrid">
            ${specs}
            ${fieldHtml(p, 'facing', 'Facing', selectCtl(p, 'facing', FACINGS, p.facing, dis))}
            ${custom}
          </div>
          <p class="muted" style="margin:10px 0 0;font-size:12.5px"><b style="color:var(--ink2)">Description</b> <span class="srcmini s-ai">✨ AI-written</span> — ${esc(description(p))}</p>
          ${dis ? '' : `<div class="more-details"><span class="muted">Add a detail:</span>${more.map(f => `<button type="button" class="add-chip" data-ap="showField" data-id="${p.id}" data-k="${f.k}">＋ ${esc(f.l.replace(/ \(.*\)$/, ''))}</button>`).join('')}<button type="button" class="add-chip own" data-ap="customOpen">＋ Something else</button></div>
            ${AUI.customDetail ? `<div class="add-row"><input id="f-new-label" placeholder="Detail — e.g. Paint colour"><input id="f-new-value" placeholder="Value — e.g. Ivory"><button type="button" class="btn sm primary" data-ap="addDetail" data-id="${p.id}">Add</button><button type="button" class="btn sm" data-ap="customOpen">Cancel</button></div>` : ''}`}`
        : '<p class="muted" style="margin:0">Choose the property type to see its details.</p>' },
    { k: 'amen', title: 'Amenities', done: p.amenities.length > 0, status: p.amenities.length ? `${p.amenities.length} selected` : 'None yet',
      body: `${addLink('amen', 'Add amenity')}${p.type ? `<div class="checks">${amen}</div>` : '<p class="muted" style="margin:0">Choose the property type to see the usual amenities.</p>'}
        ${addOpen.amen && !dis ? `<div class="add-row"><input id="f-new-amen" placeholder="Amenity — e.g. Home theatre"><button type="button" class="btn sm primary" data-ap="addAmen" data-id="${p.id}">Add</button><button type="button" class="btn sm" data-ap="openAdd" data-k="amen">Cancel</button></div>` : ''}` },
    { k: 'approvals', title: 'Approvals', done: p.approvals.length > 0, status: appr || 'None ticked',
      body: `${addLink('approvals', 'Add approval')}<p class="muted" style="margin:0 0 8px;font-size:12.5px">Tick what applies; upload the documents whenever they’re ready.</p>
        <div class="badge-line">${badges}</div>${addOpen.approvals && !dis ? `<div class="add-row"><input id="f-new-approval" placeholder="Approval — e.g. Fire NOC"><button type="button" class="btn sm primary" data-ap="addApproval" data-id="${p.id}">Add</button><button type="button" class="btn sm" data-ap="openAdd" data-k="approvals">Cancel</button></div>` : ''}` },
  ];
  const chev = up => `<svg class="chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="${up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return `
    <div class="card form-card stepper">
      ${steps.map((s, i) => {
        const closed = !!(AUI.collapsed || {})[s.k];
        return `<section class="step ${s.done ? 'done' : ''} ${closed ? 'closed' : ''}" id="sec-${s.k}">
          <div class="step-rail"><span class="step-dot">${s.done ? '✓' : i + 1}</span></div>
          <div class="step-main">
            <button type="button" class="step-head" data-ap="toggleSec" data-k="${s.k}" aria-expanded="${!closed}" aria-controls="body-${s.k}">
              <span class="step-title">${s.title}${s.req ? ' <span class="req-tag">Required</span>' : ' <span class="opt-tag">Optional</span>'}</span>
              <span class="step-status ${s.done ? 'ok' : ''}">${esc(s.status)}</span>${chev(!closed)}
            </button>
            ${closed ? '' : `<div class="step-body" id="body-${s.k}">${s.body}</div>`}
          </div>
        </section>`;
      }).join('')}
    </div>`;
}
function mediaTab(p) {
  const dis = canEdit(p) ? '' : 'disabled';
  return `
    <div class="card"><div class="card-head"><h2>Photos</h2>${chip(p.photos)}<span class="sp"></span><button class="btn sm" data-ap="photo" data-id="${p.id}" ${dis}>📎 Add photos</button>${p.photos ? `<button class="btn sm danger" data-ap="rmPhoto" data-id="${p.id}" ${dis}>Remove one</button>` : ''}</div>
      ${p.photos ? `<div class="photos">${Array.from({ length: Math.min(p.photos, 12) }, (_, i) => `<div class="ph">${i === 0 ? '★ Cover' : 'Photo ' + (i + 1)}</div>`).join('')}</div>${p.photos > 12 ? `<small class="muted">+${p.photos - 12} more</small>` : ''}`
        : `<div class="ph dropzone-lg">Drop photos here, or use “Add photos”<br><small>Optional — photos add 10% to the completion and help the listing</small></div>`}
    </div>
    <div class="card"><div class="card-head"><h2>Videos</h2>${chip(p.videos)}<span class="sp"></span><button class="btn sm" data-ap="video" data-id="${p.id}" ${dis}>🎬 Add video</button>${p.videos ? `<button class="btn sm danger" data-ap="rmVideo" data-id="${p.id}" ${dis}>Remove one</button>` : ''}</div>
      ${p.videos ? `<div class="photos">${Array.from({ length: p.videos }, (_, i) => `<div class="ph">▶ Video ${i + 1}</div>`).join('')}</div>` : '<p class="muted" style="margin:0">No videos — a walkthrough video is optional.</p>'}
    </div>`;
}
function legalTab(p) {
  const dis = canEdit(p) ? '' : 'disabled';
  const row = (k, lead) => {
    const d = p.docs[k];
    const st = !d ? chip('Not uploaded', lead ? 'amber' : '') : d.status === 'verified' ? chip('Verified by legal professional', 'green') : chip('Collected, pending verification', 'blue');
    return `<div class="doc-row"><span class="n">${lead || ''}${esc(docName(k))}</span>${st}${!d ? `<button type="button" class="btn sm" data-ap="upload" data-id="${p.id}" data-doc="${k}" ${dis}>📎 Upload</button>` : `<small class="mono muted">${esc(d.file || '')}</small>`}</div>`;
  };
  const others = otherDocs(p.type);
  return `
    <div class="card"><div class="card-head"><h2>Approval documents</h2><span class="sp"></span><small class="muted">for the badges ticked in Details</small></div>
      ${p.approvals.length ? p.approvals.map(k => row(k, `${chip(approvalOf(k).l, 'purple')} `)).join('') : '<p class="muted" style="margin:0 0 8px">No approval badges ticked yet.</p>'}
      <div class="badges" style="margin-top:10px"><small class="muted" style="margin-right:6px">Tick a badge:</small>${allApprovals().filter(a => !p.approvals.includes(a.k)).map(a => `<button type="button" class="badge-tog" data-ap="badge" data-id="${p.id}" data-k="${a.k}" ${dis}>＋ ${a.l}</button>`).join('')}</div>
    </div>
    <div class="card"><div class="card-head"><h2>Other legal documents</h2><span class="sp"></span><small class="muted">optional</small></div>
      ${p.type ? others.map(k => row(k)).join('') : '<p class="muted" style="margin:0">The list depends on the property type — choose it in Details.</p>'}
    </div>
    <div class="note">Uploading a document collects it — it is marked <b>Collected, pending verification</b>. Only an authorised legal professional marks it verified.</div>`;
}
function historyTab(p) {
  return `<div class="card"><h2>Change history</h2><ul class="tl">${p.history.map(h => `<li><div class="when">${fmtDate(h.at)} · ${esc(h.by)}</div>${esc(h.text)}</li>`).join('') || '<li>No changes yet.</li>'}</ul></div>`;
}
function chatHtml(chat) {
  return chat.map(m => `<div class="msg ${m.who}"><div class="b">${m.html}</div></div>`).join('');
}
function btnHtml(p, b, act) {
  return `<button type="button" class="qr ${b.primary ? 'primary' : ''}${b.on ? ' on' : ''}" data-ap="${b.act || act}" data-id="${p.id}" data-via="chat"${b.c ? ` data-c="${b.c}"` : ''}${b.k ? ` data-k="${b.k}"` : ''}${b.v != null ? ` data-v="${esc(b.v)}"` : ''}${b.doc ? ` data-doc="${b.doc}"` : ''}>${b.l}</button>`;
}
/** The open question (or next step), shown as the assistant’s latest message with quick replies under it. */
function pendingHtml(p) {
  const q = p.queue[0], n = q ? null : nextStep(p);
  const html = q ? queueText(p, q) : n && n.html, buttons = q ? queueButtons(p, q).map(b => btnHtml(p, b, 'q')) : (n && n.buttons || []).map(b => btnHtml(p, b));
  if (!html) return '';
  const last = p.chat[p.chat.length - 1];
  const same = last && last.who === 'ai' && last.html === html; // don't repeat a question that is already the last message
  return `${same ? '' : `<div class="msg ai"><div class="b">${html}</div></div>`}${buttons.length ? `<div class="qrs">${buttons.join('')}</div>` : ''}`;
}
function examplesHtml(p) {
  const ex = ['2 BHK flat for sale in Porur, Chennai, 62 lakhs', '5 acres farm land near Dindigul, 1.2 crore', 'Shop for rent in Srirangam, Trichy'];
  return `<div class="examples"><span class="muted">Try:</span>${ex.map(e => `<button type="button" class="qr" data-ap="newTry" data-id="${p.id}" data-t="${esc(e)}">${esc(e)}</button>`).join('')}</div>`;
}
function aiPanel(p) {
  const score = completeness(p), fresh = !p.chat.some(m => m.who === 'user'), can = canEdit(p);
  const ph = !can ? 'Only an Admin or Sales manager can change this property' : p.status === 'published' ? 'Tell me what changed…' : 'Describe the property…';
  return `<div class="card chatcard">
    <div class="chat-head"><b>✨ AI assistant</b><span class="sp"></span><span class="cp" title="Listing completion"><span class="cp-bar"><i class="cp-${scoreTone(score)}" style="width:${score}%"></i></span>${score}%</span></div>
    <div class="log" id="log">${chatHtml(p.chat)}${!fresh || p.queue.length ? pendingHtml(p)
      : p.status === 'draft' ? examplesHtml(p)
      : `<div class="msg ai"><div class="b">Tell me what changed — like “price is now 75 lakhs” or “mark it reserved”. I’ll check with you before saving.</div></div>`}</div>
    <form class="composer" data-apform="send" data-id="${p.id}">
      <textarea name="msg" id="msg" rows="1" placeholder="${ph}" ${can ? '' : 'disabled'}></textarea>
      <button class="send" ${can ? '' : 'disabled'} aria-label="Send" title="Send">➤</button>
    </form></div>`;
}

/* ---------- the live summary beside the chat: what the AI understood, and what is missing ---------- */
function shortFact(p, f) {
  const v = p.specs[f.k];
  if (f.t === 'number') return `${f.l.replace(/ \(.*\)$/, '').toLowerCase()} ${fmt(p, 'specs.' + f.k, v)}`;
  return String(v);
}
function summaryCard(p) {
  const m = missing(p), score = completeness(p), L = p.loc, t = p.type, can = canEdit(p);
  const recent = AUI.flash && AUI.flash.id === p.id && Date.now() - AUI.flash.at < 4000 ? AUI.flash.paths : [];
  const hit = (...xs) => (xs.some(x => recent.some(r => r === x || (x === 'specs' && r.startsWith('specs.')))) ? ' new' : '');
  const byAI = (...xs) => xs.some(x => p.src[x] && p.src[x].s === 'chat');
  const btn = (label, act, extra = '') => (can ? `<button type="button" class="btn sm" data-ap="${act}" data-id="${p.id}" ${extra}>${label}</button>` : '');
  const row = (ok, text, o = {}) => `<li class="${ok ? 'done' : o.req ? 'req' : 'todo'}${o.cls || ''}"><span class="ic">${ok ? '✓' : o.req ? '!' : '○'}</span><span class="tx">${text}${o.ai ? ' <span class="aitag">AI</span>' : ''}</span>${o.pts && !ok ? `<span class="pts">+${o.pts}%</span>` : ''}${o.btn || ''}</li>`;
  const rows = [];
  // purpose and type (required)
  if (p.purpose && t) rows.push(row(true, `${PURPOSE_LABEL[p.purpose]} · ${typeLabel(t)}`, { ai: byAI('purpose', 'type'), cls: hit('purpose', 'type') }));
  else rows.push(row(false, !p.purpose && !t ? 'Purpose and property type' : !p.purpose ? `Purpose <span class="muted">· ${typeLabel(t)}</span>` : `Property type <span class="muted">· ${PURPOSE_LABEL[p.purpose]}</span>`, { req: 1, cls: hit('purpose', 'type'), btn: btn('Add', 'goItem', `data-k="${!p.purpose ? 'purpose' : 'type'}"`) }));
  // location (required: city and locality) — the exact map location is optional
  const exact = L.lat !== '' && L.lat != null && L.pinOk;
  if (L.city && L.locality) rows.push(row(true, `${esc(L.locality)}, ${esc(L.city)} <span class="muted">· ${exact ? '📍 exact location' : 'approximate on the map'}</span>`,
    { ai: byAI('loc.city', 'loc.locality'), cls: hit('loc.city', 'loc.locality', 'pin'), btn: exact ? '' : btn('📍 Exact', 'goItem', 'data-k="pin"') }));
  else rows.push(row(false, L.city ? `Locality <span class="muted">· ${esc(L.city)}</span>` : 'City and locality', { req: 1, cls: hit('loc.city'), btn: btn('Add', 'goItem', `data-k="${L.city ? 'locality' : 'city'}"`) }));
  // price and area (both required)
  const pr = p.price > 0 ? inrShort(p.price) + (p.priceOnRequest ? ' (hidden on listing)' : '') : '', ar = p.area > 0 ? `${num(p.area)} sq.ft.` : '';
  if (pr && ar) rows.push(row(true, `${pr} · ${ar}`, { ai: byAI('price', 'area'), cls: hit('price', 'area', 'priceOnRequest') }));
  else rows.push(row(false, pr || ar ? `${pr || ar} <span class="muted">· ${pr ? 'area' : 'price'} needed</span>` : 'Price and area', { req: 1, cls: hit('price', 'area'), btn: btn('Add', 'goItem', `data-k="${pr ? 'area' : 'price'}"`) }));
  // type details
  if (t) {
    const fs = coreFields(p), all = fieldsFor(t), filled = all.filter(f => !isEmpty(p.specs[f.k])), coreIn = fs.filter(f => !isEmpty(p.specs[f.k])).length, enough = fs.length > 0 && coreIn === fs.length;
    const reqLeft = reqDetails(p).filter(f => isEmpty(p.specs[f.k]));
    rows.push(row(enough, reqLeft.length ? `${esc(reqLeft.map(shortLabel).join(' and '))} <span class="muted">· required</span>`
        : filled.length ? `${esc(filled.slice(0, 3).map(f => shortFact(p, f)).join(' · '))} <span class="muted">· ${coreIn} of ${fs.length} key details</span>` : `${typeLabel(t)} details`,
      { ai: filled.some(f => byAI('specs.' + f.k)), pts: reqLeft.length ? 0 : 15, req: reqLeft.length > 0, cls: hit('specs'), btn: enough ? '' : btn('Add', 'goItem', `data-k="${reqLeft.length ? 'specs.' + reqLeft[0].k : 'details'}"`) }));
  }
  // amenities
  rows.push(row(p.amenities.length > 0, p.amenities.length ? esc(p.amenities.slice(0, 3).join(', ') + (p.amenities.length > 3 ? ` +${p.amenities.length - 3}` : '')) : 'Amenities',
    { ai: byAI('amenities'), pts: 5, cls: hit('amenities'), btn: p.amenities.length ? '' : btn('Add', 'goItem', 'data-k="amenities"') }));
  // photos
  rows.push(row(p.photos > 0, p.photos ? `${p.photos} photo${p.photos > 1 ? 's' : ''}${p.videos ? ` · ${p.videos} video${p.videos > 1 ? 's' : ''}` : ''}` : 'Photos',
    { pts: 10, btn: p.photos ? '' : btn('📎 Add', 'photo') }));
  // approvals and legal documents
  const docsIn = Object.keys(p.docs).length;
  if (p.approvals.length) {
    const up = p.approvals.filter(k => p.docs[k]).length;
    rows.push(row(up === p.approvals.length, `${p.approvals.map(k => approvalOf(k).l).join(', ')} <span class="muted">· ${up} of ${p.approvals.length} document${p.approvals.length > 1 ? 's' : ''}</span>`,
      { pts: 10, cls: hit('approvals'), btn: up === p.approvals.length ? '' : btn('📎 Upload', 'drawer', 'data-tab="legal"') }));
  } else rows.push(row(docsIn > 0, docsIn ? `${docsIn} legal document${docsIn > 1 ? 's' : ''}` : 'Approvals and legal documents', { pts: 10, btn: docsIn ? '' : btn('Add', 'drawer', 'data-tab="legal"') }));

  const status = p.status === 'draft' ? (m.length ? `<div class="need">Needed to publish: ${esc(m.map(x => x.l.replace(/ \(.*\)$/, '')).join(', '))}</div>` : '<div class="ok-line">✓ Everything needed to publish is in</div>') : '';
  const actions = p.editOf ? `<div class="ok-line">✓ Changes are saved to ${p.editOf} as you confirm them</div><button class="btn primary block" data-ap="editDone" data-id="${p.id}">Done — back to the property</button>`
    : p.status === 'draft' ?`<button class="btn primary block" data-ap="publish" data-id="${p.id}" ${m.length ? 'disabled' : ''}>${isMgr() ? 'Publish' : 'Submit for approval'}</button>`
    : p.status === 'pending' && isMgr() ? `<div class="row" style="gap:8px"><button class="btn" data-ap="sendback" data-id="${p.id}">Send back</button><button class="btn primary" style="flex:1;justify-content:center" data-ap="approve" data-id="${p.id}">✓ Approve & publish</button></div>` : '';
  return `<div class="card sumcard">
    <div class="sum-top">${ring(score, 60)}<div style="min-width:0;flex:1">${AUI.titleEdit === p.id
      ? `<div class="title-ed"><input id="sum-title" value="${esc(p.title)}" placeholder="Listing title" aria-label="Listing title"><button type="button" class="btn sm primary" data-ap="titleSave" data-id="${p.id}">Save</button><button type="button" class="btn sm" data-ap="titleEdit" data-id="${p.id}" data-v="0">Cancel</button></div>`
      : `<h2 class="sum-title">${esc(p.title || 'New property')}${can && p.title ? ` <button type="button" class="title-pen" data-ap="titleEdit" data-id="${p.id}" title="Change the title" aria-label="Change the title">✎</button>` : ''}</h2>`}
      ${p.title && p.src.title && p.src.title.s === 'ai' && AUI.titleEdit !== p.id ? '<small class="muted ai-title">✨ Suggested title — click ✎ to change it</small>' : ''}
      <div class="row" style="gap:5px;margin-top:4px">${chip(REC_STATUS[p.status][0], REC_STATUS[p.status][1])}${p.status === 'published' ? chip(esc(p.avail), AVAIL_TONE[p.avail]) : ''}${badgesInline(p)}</div></div></div>
    <ul class="sfacts">${rows.join('')}</ul>
    ${status}
    <a class="btn block" href="#/properties/draft/${p.id}/details">Review all details</a>
    ${actions}
  </div>`;
}

/* ---------- the form, media, documents and history: one drawer that slides in from the right ---------- */
function drawerHtml(p, tab) {
  const legalCount = p.approvals.length ? `${p.approvals.filter(k => p.docs[k]).length}/${p.approvals.length}` : Object.keys(p.docs).length;
  const tabs = [['details', 'Details'], ['media', `Media (${p.photos + p.videos})`], ['legal', `Legal documents (${legalCount})`], ['history', 'History']]
    .map(([k, l]) => `<a href="#/properties/draft/${p.id}/${k}" class="${tab === k ? 'on' : ''}">${l}</a>`).join('');
  const body = { details: detailsTab, media: mediaTab, legal: legalTab, history: historyTab }[tab](p);
  return `<a class="scrim" href="#/properties/draft/${p.id}" aria-label="Close"></a>
    <aside class="drawer" role="dialog" aria-label="Property details">
      <div class="drawer-head"><div><b>${esc(p.title || 'Property details')}</b><div class="muted" style="font-size:12px">Filled in by the AI as you chat — check or correct anything here</div></div><span class="sp"></span><a class="x" href="#/properties/draft/${p.id}" aria-label="Close" title="Close">✕</a></div>
      <div class="tabs drawer-tabs">${tabs}</div>
      <div class="drawer-body" id="drawer-body">${body}</div>
    </aside>`;
}
function viewProperty(id, tab) {
  const p = getP(id);
  if (!p) return { title: 'Not found', html: '<div class="card empty">This property doesn’t exist — it may have been discarded. <a href="#/properties">Back to properties</a></div>' };
  tab = ['details', 'media', 'legal', 'history'].includes(tab) ? tab : null;
  return {
    title: p.title || p.id, crumbs: `<a href="#/properties">Properties</a> / <b>${p.id}</b>`,
    after: () => {
      const l = document.getElementById('log'); if (l) l.scrollTop = l.scrollHeight;
      if (AUI.focus) { const el = document.getElementById(AUI.focus); AUI.focus = null; if (el) { el.scrollIntoView({ block: 'center' }); el.focus({ preventScroll: true }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1200); } }
      else if (!tab) { const msg = document.getElementById('msg'); if (msg && !msg.disabled && document.activeElement === document.body) msg.focus({ preventScroll: true }); }
    },
    html: `<div class="pa"><div class="pa-chat">${aiPanel(p)}</div><div class="pa-side">${summaryCard(p)}</div></div>${tab ? drawerHtml(p, tab) : ''}`,
  };
}

/* ---------- changing a field from the form (same history and checks as the chat) ---------- */
function setField(p, path, v) {
  if (!canEdit(p)) { toast('Only an Admin or Sales manager can change a published property'); return; }
  const from = path.startsWith('custom.') ? (p.custom.find(c => c.label === path.slice(7)) || {}).value : getPath(p, path);
  if (String(from ?? '') === String(v ?? '') && !Array.isArray(v)) return;
  const ch = [{ path, from: Array.isArray(from) ? from.slice() : from, to: v, q: 'form' }];
  applyChanges(p, ch, 'form');
  afterUpdate(p, ch);
  save(); render();
}

/* ---------- inside the main wireframe: its router and render, this page’s own events ---------- */
/** Re-render through the main wireframe, keeping the drawer scrolled where it was. */
function render() {
  const db = document.getElementById('drawer-body');
  AUI.keep = db ? { hash: location.hash, top: db.scrollTop } : null;
  window.render();
}
/** Drafts nobody put anything into are discarded once you leave them. */
function dropBlankDrafts(exceptId) {
  const before = S.props.length;
  S.props = S.props.filter(p => !isBlankDraft(p) || p.id === exceptId);
  if (S.props.length !== before) save();
}
/** The strip above the old property list: drafts and properties waiting for approval. */
function draftsStrip() {
  dropBlankDrafts();
  if (!drafts().length) return '';
  const rows = drafts().map(p => {
    const m = missing(p), sc = completeness(p);
    const state = p.status === 'pending' ? chip('Waiting for approval', 'blue') : m.length ? `<span class="ds-need">Needs: ${esc(m.map(x => x.l.replace(/ \(.*\)$/, '')).join(', '))}</span>` : chip('Ready to publish', 'green');
    return `<a class="ds-row" href="#/properties/draft/${p.id}"><span class="mono">${p.id}</span><span class="ds-title"><b>${esc(p.title || 'Untitled property')}</b><small class="muted">${esc([p.type ? typeLabel(p.type) : '', p.loc.locality, p.loc.city].filter(Boolean).join(' · ') || 'Nothing given yet')} · started by ${esc(p.createdBy)}</small></span>${state}<span class="ds-score">${meter(sc, scoreTone(sc))}<small>${sc}%</small></span><span class="ds-go">${p.status === 'pending' && isMgr() ? 'Review' : 'Continue'} →</span></a>`;
  }).join('');
  return `<div class="card drafts-strip"><div class="card-head"><h2>📝 Drafts in progress</h2>${chip(drafts().length)}<span class="sp"></span><small class="muted">Not in the list yet — open one to continue with the AI assistant</small></div>${rows}</div>`;
}
/** “📝 Drafts (n)” next to “+ Add property” — opens the drafts as a list page, in the same layout as the property list. */
function draftsButton() {
  dropBlankDrafts();
  if (!drafts().length) return '';
  const waiting = drafts().filter(p => p.status === 'pending').length;
  return `<a class="btn" href="#/properties/drafts">📝 Drafts <span class="chip ${waiting && isMgr() ? 'blue' : ''}">${drafts().length}</span></a>`;
}
/** The drafts page: the old property list’s table, filled with the properties still being added. */
const draftStatus = p => (p.status === 'pending' ? 'Waiting for approval' : missing(p).length ? 'Draft' : 'Ready to publish');
/** Drafts in the shape the shared search (property-search.js) reads. */
function searchItems() {
  dropBlankDrafts();
  return drafts().map(p => ({
    raw: p, id: p.id, title: p.title, type: p.type, purpose: p.purpose, city: p.loc.city, locality: p.loc.locality,
    price: +p.price || 0, area: +p.area || 0, facing: p.facing, specs: p.specs || {}, amenities: p.amenities || [],
    status: draftStatus(p), date: p.updatedAt, score: completeness(p),
  }));
}
function draftsList() {
  const SR = PropSearch.run('drafts'), list = SR.list; // same search bar and filters as the property list
  const rows = list.map(p => {
    const m = missing(p), sc = completeness(p);
    const badges = p.approvals.map(k => chip(esc(approvalOf(k).l) + (p.docs[k] ? '' : ' · doc pending'), p.docs[k] ? 'blue' : 'amber')).join(' ');
    return `<tr class="click" data-href="#/properties/draft/${p.id}">
      <td class="mono" style="white-space:nowrap">${p.id}</td>
      <td><b>${esc(p.title || 'Untitled property')}</b><br><small>${esc([p.type ? typeLabel(p.type) : 'Type not given', PURPOSE_LABEL[p.purpose]].filter(Boolean).join(' · '))}</small>${m.length ? `<br><small style="color:var(--red)">Needs: ${esc(m.map(x => x.l.replace(/ \(.*\)$/, '')).join(', '))}</small>` : ''}</td>
      <td>${esc(p.loc.locality) || '<span class="muted">—</span>'}<br><small>${esc(p.loc.city)}</small></td>
      <td class="num">${p.area > 0 ? `${num(p.area)} <small>sq.ft.</small>` : '<span class="muted">—</span>'}</td>
      <td class="num">${p.price > 0 ? `<b>${inrShort(p.price)}</b>${p.area > 0 ? `<br><small>${inr(Math.round(p.price / p.area))}/sq.ft.</small>` : ''}` : '<span class="muted">—</span>'}</td>
      <td>${badges || '<span class="muted">—</span>'}</td>
      <td>${chip(draftStatus(p), { 'Waiting for approval': 'blue', Draft: 'amber', 'Ready to publish': 'green' }[draftStatus(p)])}</td>
      <td><small>${fmtDate(p.updatedAt)}<br>${esc(p.createdBy)}</small></td>
      <td class="score-col"><div class="dl-ring" title="${esc(m.length ? 'Needed to publish: ' + m.map(x => x.l).join(', ') : 'Everything needed to publish is in')}">${miniRing(sc)}</div></td>
    </tr>`;
  }).join('');
  return {
    title: 'Drafts', crumbs: 'Specification data / <a href="#/properties">Properties</a> / <b>Drafts</b>',
    after: () => PropSearch.after('drafts'),
    html: `
    <div class="page-head"><div><h1>Drafts</h1><p>Properties being added — not in the property list yet. Open one to continue with the AI assistant.</p></div><span class="sp"></span>
      <a class="btn" href="#/properties">← All properties</a><a class="btn primary" href="#/properties/new">＋ Add property</a></div>
    ${SR.head}
    <div class="tbl-wrap ps-table"><table>
      <thead><tr><th>ID</th><th>Property</th><th>Location</th><th class="num">Area</th><th class="num">Asking price</th><th>Approvals</th><th>Status</th><th>Updated</th><th class="score-col" title="What is still needed to publish — hover a score for the list">Completion score</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="9" class="empty">${drafts().length ? `No drafts match these filters.${SR.relax ? '<br><br>' + SR.relax : ''}` : 'No drafts — everything has been published. <a href="#/properties/new">Add a property</a>'}</td></tr>`}</tbody>
    </table></div>
    ${SR.pager}`,
  };
}
/** Completion score of a property in the main list — the same weights as on the Add property page. */
function listedScore(o) {
  const t = PROPERTY_TYPES[o.type], core = (CORE_FIELDS[o.type] || []).filter(k => t && t.fields.some(f => f.k === k));
  const coreIn = core.filter(k => !isEmpty((o.specs || {})[k])).length;
  normLegal(o);
  const docs = o.approvals.length ? o.approvals.filter(a => a.status !== 'pending').length / o.approvals.length : o.documents.length ? 1 : 0;
  const items = [
    ['Purpose', 10, !!o.purpose], ['Property type', 10, !!o.type], ['City', 10, !!o.city], ['Locality', 10, !!o.locality],
    ['Price', 10, o.price > 0], ['Area', 10, o.area > 0], ['Key details', 15, core.length ? coreIn / core.length : 0],
    ['Photos', 10, (o.images || 0) > 0], ['Legal documents', 10, docs], ['Amenities', 5, (o.amenities || []).length > 0],
  ].map(([l, pts, v]) => ({ l, pts, v: v === true ? 1 : v === false ? 0 : v }));
  return { score: Math.round(items.reduce((s, i) => s + i.pts * i.v, 0)), missing: items.filter(i => i.v < 1).map(i => `${i.l} (+${Math.round(i.pts * (1 - i.v))}%)`) };
}
function startNew() {
  const p = newRecord(); aiSay(p, GREET); save();
  setTimeout(() => location.replace('#/properties/draft/' + p.id), 0);
  return { title: 'Add property', crumbs: 'Specification data / <a href="#/properties">Properties</a> / <b>Add property</b>', html: '' };
}
function view(id, tab) {
  dropBlankDrafts(id);
  if (!getP(id) && DB.properties.some(o => o.id === id)) startEdit(id); // reloaded an edit page: open a fresh copy
  const v = viewProperty(id, tab), p = getP(id);
  v.crumbs = p && p.editOf ? `Specification data / <a href="#/properties">Properties</a> / <a href="#/properties/${id}">${id}</a> / <b>Edit with AI</b>`
    : `Specification data / <a href="#/properties">Properties</a> / <b>${p ? 'Add property · ' + id : id}</b>`;
  const after = v.after;
  v.after = () => {
    if (AUI.keep && AUI.keep.hash === location.hash) { const d = document.getElementById('drawer-body'); if (d) d.scrollTop = AUI.keep.top; }
    AUI.keep = null;
    if (after) after();
  };
  return v;
}
/** #/properties/PROP-x/edit[/details | /field-<key>] — open a published property in the AI assistant. */
function edit(id, arg) {
  const p = startEdit(id);
  if (!p) return { title: 'Not found', html: '<div class="card empty">Property not found. <a href="#/properties">Back to properties</a></div>' };
  let tab = '';
  if (arg === 'field-title' || arg === 'location') { AUI.focus = fid(arg === 'location' ? 'pin' : 'title'); tab = '/details'; }
  else if (arg && arg.startsWith('field-')) { const k = arg.slice(6); if (!p.shownFields.includes(k)) p.shownFields.push(k); AUI.focus = fid('specs.' + k); tab = '/details'; save(); }
  else if (['details', 'media', 'legal'].includes(arg)) tab = '/' + arg;
  setTimeout(() => location.replace('#/properties/draft/' + id + tab), 0);
  return { title: 'Edit ' + id, crumbs: 'Specification data / <a href="#/properties">Properties</a> / <b>' + id + '</b>', html: '' };
}
function onSend(id, text) {
  const p = getP(id); if (!p || !text.trim()) return;
  talk(p, text); save(); render();
}
const GO_ITEM = { title: ['details', 'title'], purpose: ['details', 'purpose'], type: ['details', 'type'], city: ['details', 'loc.city'], locality: ['details', 'loc.locality'], price: ['details', 'price'], area: ['details', 'area'], details: ['details', 'sec-details'], amenities: ['details', 'sec-amen'], pin: ['details', 'pin'], photos: ['media', ''], docs: ['legal', ''] };
const AP_ACTIONS = {
  q: d => { const p = getP(d.id); if (resolve(p, d.c) === 'nav') return; save(); render(); },
  ans: d => {
    const p = getP(d.id); freezeNext(p);
    youSay(p, esc(d.k === 'type' ? typeLabel(d.v) : d.k === 'purpose' ? PURPOSE_LABEL[d.v] : d.v));
    commit(p, { raw: 'type', f: { [d.k]: { v: d.v, q: d.v } }, amen: [], newAmen: [], custom: [], removeAmen: [], badges: [], notes: [] }, 'chat');
    save(); render();
  },
  pinHere: d => { // the browser's location in the real build; here a point in the locality (mock)
    const p = getP(d.id);
    if (!p.loc.city) { toast('Choose the city first'); return; }
    const g = geoOf(p.loc.city, p.loc.locality), j = Date.now() % 997;
    setPin(p, { lat: +(g.lat + ((j % 21) - 10) / 2500).toFixed(5), lng: +(g.lng + (((j >> 3) % 21) - 10) / 2500).toFixed(5) }, 'current location of ' + me());
  },
  pinLink: d => {
    const p = getP(d.id), el = document.getElementById(fid('pin')), v = el ? el.value.trim() : '';
    if (!v) { toast('Paste a Google Maps link or a WhatsApp location first'); return; }
    if (!p.loc.city && !/\d\.\d{3,}/.test(v)) { toast('Choose the city first'); return; }
    const ll = pinFromText(v, p);
    if (!ll) { toast('That doesn’t look like a map link — try Share → Copy link in Google Maps'); return; }
    setPin(p, ll, ll.q);
  },
  pinClear: d => {
    const p = getP(d.id); if (!canEdit(p)) return;
    hist(p, `Map pin removed (${p.loc.lat}, ${p.loc.lng}) — back to the locality (form)`);
    Object.assign(p.loc, { lat: '', lng: '', pinOk: false }); delete p.src['loc.lat']; p.updatedAt = TODAY; save(); render();
  },
  titleEdit: d => { AUI.titleEdit = d.v === '0' ? null : d.id; render(); if (AUI.titleEdit) setTimeout(() => { const el = document.getElementById('sum-title'); if (el) { el.focus(); el.select(); } }, 0); },
  titleSave: d => {
    const p = getP(d.id), el = document.getElementById('sum-title'), v = el ? el.value.trim() : '';
    if (!v) { toast('The title can’t be empty'); return; }
    AUI.titleEdit = null; setField(p, 'title', v); render();
  },
  pinok: d => { const p = getP(d.id); p.loc.pinOk = true; p.queue = p.queue.filter(q => q.kind !== 'pin'); hist(p, `Map pin confirmed (${p.loc.lat}, ${p.loc.lng})`); if (d.via === 'chat') { youSay(p, 'The pin is right'); aiSay(p, 'Pin confirmed.'); } save(); toast('Map pin confirmed'); render(); },
  upload: d => { const p = getP(d.id); if (!canEdit(p)) return; AUI.attach = false; if (d.via === 'chat') freezeNext(p); upload(p, d.doc, d.via === 'chat'); save(); toast(`${docName(d.doc)} uploaded — pending verification`); render(); },
  photo: d => { const p = getP(d.id); if (!canEdit(p)) return; AUI.attach = false; if (d.via === 'chat') freezeNext(p); addPhotos(p, d.via === 'chat'); save(); toast('3 photos added'); render(); },
  video: d => { const p = getP(d.id); if (!canEdit(p)) return; AUI.attach = false; addVideo(p, d.via === 'chat'); save(); toast('Video added'); render(); },
  rmPhoto: d => { const p = getP(d.id); p.photos = Math.max(0, p.photos - 1); hist(p, 'Photo removed'); save(); render(); },
  rmVideo: d => { const p = getP(d.id); p.videos = Math.max(0, p.videos - 1); hist(p, 'Video removed'); save(); render(); },
  publish: d => {
    const p = getP(d.id); if (d.via === 'chat') { freezeNext(p); youSay(p, isMgr() ? 'Publish' : 'Submit for approval'); }
    tryPublish(p); save();
    if (getP(p.id)) { toast(p.status === 'pending' ? `${p.id} sent for approval` : 'Still a draft'); render(); } // published ones have moved to the property list
  },
  approve: d => { const p = getP(d.id); if (!isMgr()) return; const old = publishToMain(p, p.submittedBy); toast(`${old.id} published — it’s in the property list now`); go('#/properties/' + old.id); },
  editDone: d => { const p = getP(d.id); const id = p ? p.editOf : d.id; if (p) { syncEdit(p); S.props = S.props.filter(x => x !== p); save(); } toast('Saved — ' + id + ' is up to date'); go('#/properties/' + id); },
  sendback: d => { const p = getP(d.id); p.status = 'draft'; hist(p, 'Sent back to draft'); aiSay(p, `Sent back to ${esc(p.submittedBy)} as a draft.`); save(); render(); },
  fset: d => { const p = getP(d.id); setField(p, d.path, d.v); },
  fcat: d => {
    const p = getP(d.id); if (!canEdit(p) || p.category === d.v) return;
    if (p.type && PROPERTY_TYPES[p.type].category !== d.v) setType(p, '');
    p.category = d.v; p.src.category = { s: 'form' }; hist(p, `Category: ${d.v} (form)`); p.updatedAt = TODAY; save(); render();
  },
  badge: d => {
    const p = getP(d.id), a = approvalOf(d.k), on = p.approvals.includes(d.k);
    if (d.via !== 'chat') return setField(p, 'approvals', on ? p.approvals.filter(k => k !== d.k) : p.approvals.concat(d.k));
    if (!canEdit(p)) return;
    youSay(p, esc(a.long)); // ticked from the assistant’s quick reply
    applyChanges(p, [{ path: 'approvals', from: p.approvals.slice(), to: on ? p.approvals.filter(k => k !== d.k) : p.approvals.concat(d.k), q: a.long }], 'chat');
    aiSay(p, on ? `Removed the ${esc(a.long)} badge.` : `Ticked ${esc(a.long)}. Upload the document whenever it’s ready — say “remove ${esc(a.l)}” if that was a mistake.`);
    save(); render();
  },
  showField: d => { const p = getP(d.id); if (!d.k) return; p.shownFields = (p.shownFields || []).concat(d.k); AUI.focus = fid('specs.' + d.k); save(); render(); },
  hideField: d => { // remove an optional detail someone added but no longer needs
    const p = getP(d.id); p.shownFields = (p.shownFields || []).filter(k => k !== d.k);
    if (!isEmpty(p.specs[d.k])) return setField(p, 'specs.' + d.k, '');
    save(); render();
  },
  openAdd: d => { AUI.addOpen = AUI.addOpen || {}; AUI.addOpen[d.k] = !AUI.addOpen[d.k]; AUI.focus = AUI.addOpen[d.k] ? (d.k === 'amen' ? 'f-new-amen' : 'f-new-approval') : null; render(); },
  customOpen: () => { AUI.customDetail = !AUI.customDetail; AUI.focus = AUI.customDetail ? 'f-new-label' : null; render(); },
  skipStep: d => { const p = getP(d.id); freezeNext(p); skipStep(p, d.k, true); save(); render(); },
  amenAns: d => { // tap-to-toggle amenities in the assistant’s amenities step
    const p = getP(d.id); if (!canEdit(p)) return;
    const on = p.amenities.includes(d.v);
    applyChanges(p, [{ path: 'amenities', from: p.amenities.slice(), to: on ? p.amenities.filter(a => a !== d.v) : p.amenities.concat(d.v), q: d.v }], 'chat');
    save(); render();
  },
  addApproval: d => { // a new approval badge (e.g. Fire NOC) — becomes available on every property
    const p = getP(d.id), el = document.getElementById('f-new-approval'), name = (el && el.value || '').trim(); if (!name) return;
    if (AUI.addOpen) AUI.addOpen.approvals = false;
    const k = addApprovalType(CAP1(name)); window.save(); // shared with every property (Settings → Approval badges)
    if (!p.approvals.includes(k)) setField(p, 'approvals', p.approvals.concat(k)); else render();
  },
  addAmen: d => {
    const p = getP(d.id), el = document.getElementById('f-new-amen'), v = (el && el.value || '').trim(); if (!v) return;
    const name = knownAmenity(v) || CAP1(v.toLowerCase());
    if (AUI.addOpen) AUI.addOpen.amen = false;
    if (!allAmenities().some(a => a === name)) S.catalog.amenities.push({ name, by: me(), at: TODAY, from: p.id });
    if (!p.amenities.includes(name)) setField(p, 'amenities', p.amenities.concat(name)); else render();
  },
  addDetail: d => {
    const p = getP(d.id), l = (document.getElementById('f-new-label').value || '').trim(), v = (document.getElementById('f-new-value').value || '').trim();
    if (!l || !v) { toast('Type the detail and its value'); return; }
    AUI.customDetail = false;
    const path = matchField(p.type, l);
    if (path) { const val = parseFor(p.type, path, v); if (val !== null) return setField(p, path, val); }
    p.custom.push({ label: CAP1(l), value: CAP1(v), vtype: /^\d[\d,.]*$/.test(v) ? 'number' : 'text', by: me(), at: TODAY, q: 'form' });
    hist(p, `New detail (this property only): ${CAP1(l)} = ${CAP1(v)}`); p.updatedAt = TODAY; save(); render();
  },
  rmCustom: d => { const p = getP(d.id); p.custom = p.custom.filter(c => c.label !== d.l); hist(p, `Detail removed: ${d.l}`); save(); render(); },
  goItem: d => {
    const p = getP(d.id), [tab, target] = GO_ITEM[d.k] || (String(d.k).startsWith('specs.') ? ['details', d.k] : ['details', '']);
    // open the section that holds the field, if it was collapsed
    if (tab === 'details' && AUI.collapsed) delete AUI.collapsed[target.startsWith('sec-') ? target.slice(4) : target.startsWith('specs.') ? 'details' : 'basic'];
    AUI.focus = target ? (target.startsWith('sec-') ? target : fid(target)) : null;
    const h = `#/properties/draft/${p.id}/${tab}`; if (location.hash === h) render(); else go(h);
  },
  toggleSec: d => { AUI.collapsed = AUI.collapsed || {}; AUI.collapsed[d.k] = !AUI.collapsed[d.k]; render(); },
  drawer: d => go(`#/properties/draft/${d.id}/${d.tab}`),
  toggleChecklist: () => { AUI.checklist = !AUI.checklist; render(); },
  attach: () => { AUI.attach = !AUI.attach; render(); },
  newTry: d => onSend(d.id, d.t),
};
document.addEventListener('click', e => {
  const a = e.target.closest('[data-ap]');
  if (a) { e.preventDefault(); const fn = AP_ACTIONS[a.dataset.ap]; if (fn) fn(a.dataset); return; }
  if (AUI.attach && !e.target.closest('.attach-menu')) { AUI.attach = false; render(); }
});
document.addEventListener('submit', e => {
  const f = e.target; if (f.dataset.apform !== 'send') return;
  e.preventDefault(); onSend(f.dataset.id, String(new FormData(f).get('msg') || ''));
});
document.addEventListener('keydown', e => {
  if (e.target.id === 'sum-title' && (e.key === 'Enter' || e.key === 'Escape')) { e.preventDefault(); e.stopPropagation(); const b = document.querySelector(e.key === 'Enter' ? '[data-ap="titleSave"]' : '[data-ap="titleEdit"][data-v="0"]'); if (b) b.click(); return; }
  if (e.target.id === fid('pin') && e.key === 'Enter') { e.preventDefault(); const b = document.querySelector('[data-ap="pinLink"]'); if (b) b.click(); return; }
  if (e.key === 'Escape' && document.querySelector('.drawer')) { const m = location.hash.match(/#\/properties\/draft\/(D-\d+)/); if (m) go('#/properties/draft/' + m[1]); return; }
  if (e.target.id === 'msg' && e.key === 'Enter' && !e.shiftKey && e.target.form && e.target.form.dataset.apform) { e.preventDefault(); e.target.form.requestSubmit(); }
  if ((e.target.id === 'f-new-amen' || e.target.id === 'f-new-value' || e.target.id === 'f-new-approval') && e.key === 'Enter') { e.preventDefault(); const b = e.target.parentElement.querySelector('button'); if (b) b.click(); }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.amen) { const p = getP(el.dataset.id); setField(p, 'amenities', el.checked ? p.amenities.concat(el.dataset.amen) : p.amenities.filter(a => a !== el.dataset.amen)); return; }
  if (el.dataset.f) {
    const p = getP(el.dataset.id), path = el.dataset.f;
    const v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value.trim();
    setField(p, path, v);
  }
});

S = load() || seed();
// approvals created here before the list was shared move into it once
((S.catalog && S.catalog.approvals) || []).forEach(a => { if (!approvalTypes().some(t => t.k === a.k)) addApprovalType(a.l, a.doc); });
if (S.catalog) S.catalog.approvals = [];
save();
// the main ribbon’s “Reset demo data” also resets the drafts
const mainReset = ACTIONS.doReset;
ACTIONS.doReset = (...args) => { S = null; seed(); save(); return mainReset(...args); };
// search on the drafts page
/** Bulk import: a row missing required details is saved as a draft instead of being rejected. */
function importDraft(d, meta) {
  const p = newRecord(), q = `${meta.file}, ${meta.where || 'line ' + meta.line}`;
  const put = (path, v) => { if (v === '' || v == null || (Array.isArray(v) && !v.length)) return; setPath(p, path, v); p.src[path] = { s: 'import', q, by: me(), at: TODAY }; };
  if (d.type) setType(p, d.type);
  put('purpose', d.purpose); put('title', d.title); put('facing', d.facing); put('area', d.area); put('price', d.price);
  put('loc.city', d.city); put('loc.locality', d.locality); put('loc.pincode', d.pincode); put('loc.address', d.address);
  Object.entries(d.specs || {}).forEach(([k, v]) => put('specs.' + k, v));
  if (d.lat !== '' && d.lng !== '' && d.lat != null && d.lng != null) { Object.assign(p.loc, { lat: d.lat, lng: d.lng, pinOk: true, precise: true }); p.src['loc.lat'] = { s: 'import', q, by: me(), at: TODAY }; }
  p.amenities = (d.amenities || []).slice(); p.approvals = (d.approvals || []).slice();
  // columns with no field of their own ("Owner remarks") come in as this property's own details, as written
  p.custom = (d.extra || []).map(x => ({ label: x.label, value: x.value, vtype: 'text', by: me(), at: TODAY, q }));
  if (d.photos) { p.photos = d.photos; p.steps.media = true; } // photos found in a brochure or the photo itself
  p.shownFields = Object.keys(p.specs).filter(k => !isEmpty(p.specs[k]));
  afterUpdate(p, []); // district / state, a suggested title, the duplicate check
  const need = missing(p).map(x => x.l);
  hist(p, `Imported from ${q} (${meta.batch}) — saved as a draft${need.length ? ': ' + need.join(', ') + ' still needed' : ''}`);
  const conf = meta.confirm || [];
  // a Sales executive's complete row goes straight to "Waiting for approval" — as when they press Submit
  if (meta.submit && !need.length && !conf.length) { p.status = 'pending'; p.submittedBy = me(); hist(p, 'Submitted for approval (bulk import)'); }
  aiSay(p, `I imported this from <b>${esc(meta.file)}</b> (${esc(meta.where || 'line ' + meta.line)}).${need.length ? ` Still needed to publish: ${need.map(esc).join(', ')}.` : ' Everything needed is here.'}${conf.length ? ` Please confirm: ${conf.map(esc).join('; ')}${conf.some(c => /price/i.test(c)) && p.price ? ` — I read the price as ${esc(inr(p.price))}` : ''}.` : ''}`);
  save();
  return { id: p.id, missing: need, confirm: conf, pending: p.status === 'pending' };
}
/** A suggested title for a property that has none (Bulk import uses it too). */
const titleFor = o => suggestTitle({ type: o.type, facing: o.facing || '', specs: o.specs || {}, loc: { locality: o.locality || '', city: o.city || '' } });
window.AddProperty = { ring, startNew, edit, view, draftsList, draftsButton, draftsStrip, listedScore, miniRing, searchItems, importDraft, titleFor };
})();
