/* =====================================================================
   Bulk import — properties from a CSV file (Specification data)
   Flow: choose type → download template → upload → validate & preview → import.
   Rules: one template per property type (fields differ by type);
          blank Property ID = new property, existing ID = update only the filled cells;
          the same rules as Add property: city, locality, area, price and two key details of the type are required —
          a row missing any of them is NOT rejected: it is saved as a draft and the AI assistant asks for what is missing;
          a blank title is suggested by the AI; latitude + longitude = the exact location;
          approval badges can be listed (they start as "document pending"); documents are added on the property page.
   ===================================================================== */

UI.imp = { type: 'plot', rows: null, src: null, colsOpen: false, file: '', fileNotes: [], filter: '', update: true, result: null, sender: '' };
const IMP_MAX_ROWS = 500;
const IMP_MAIN = [
  { k: 'property_id', l: 'Property ID', t: 'text', hint: 'Leave blank for a new property · existing ID to update it' },
  { k: 'title', l: 'Property title', t: 'text', hint: 'Leave blank and the AI suggests one' },
  { k: 'purpose', l: 'Listing purpose', t: 'select', o: LISTING_PURPOSES, hint: 'Default: Sale' },
  { k: 'status', l: 'Property status', t: 'select', o: PROPERTY_STATUSES, hint: 'Default: Available' },
  { k: 'listing_date', l: 'Listing date', t: 'date', hint: 'YYYY-MM-DD · default: today' },
  { k: 'city', l: 'City / district', t: 'select', o: Object.keys(CITIES), req: true },
  { k: 'locality', l: 'Locality', t: 'text', req: true },
  { k: 'address', l: 'Door no. and street', t: 'text' },
  { k: 'pincode', l: 'Pincode', t: 'text', hint: '6 digits' },
  { k: 'facing', l: 'Facing', t: 'select', o: FACINGS },
  { k: 'area_sqft', l: 'Area (sq.ft.)', t: 'number', req: true, positive: true },
  { k: 'asking_price', l: 'Asking price (₹)', t: 'number', req: true, positive: true, hint: 'Digits only; commas allowed' },
  { k: 'latitude', l: 'Latitude', t: 'number', hint: 'With longitude = the exact location (optional)' },
  { k: 'longitude', l: 'Longitude', t: 'number' },
  { k: 'amenities', l: 'Amenities', t: 'list', hint: 'Separate with ; — e.g. Security;CCTV' },
  { k: 'approvals', l: 'Approval badges', t: 'approvals', hint: 'e.g. RERA;Building approval — each starts as “document pending”' },
];
const IMP_FIELD_MAP = { title: 'title', purpose: 'purpose', status: 'status', listing_date: 'listingDate', city: 'city', locality: 'locality', address: 'location.address', pincode: 'location.pincode', facing: 'facing', area_sqft: 'area', asking_price: 'price', latitude: 'location.lat', longitude: 'location.lng', amenities: 'amenities' };

function impColumns(type) {
  return IMP_MAIN.map(c => c.k === 'area_sqft' ? Object.assign({}, c, { l: PROPERTY_TYPES[type].areaLabel }) : c)
    .concat(PROPERTY_TYPES[type].fields.map(f => ({ k: f.k, l: f.l, t: f.t, o: f.o, spec: true, hint: f.h, req: (REQUIRED_DETAILS[type] || []).includes(f.k) })))
    .sort((a, b) => (b.spec && b.req) - (a.spec && a.req) || 0);
}

/* ---------- CSV helpers ---------- */
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const csvCell = v => { v = String(v ?? ''); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
const toCSV = rows => rows.map(r => r.map(csvCell).join(',')).join('\r\n');
function downloadFile(name, text) {
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- sample data (deliberately includes errors and warnings) ---------- */
function impSample(type) {
  if (type === 'plot') {
    const base = { purpose: 'Sale', status: 'Available', listing_date: DEMO_TODAY, city: 'Madurai', roadAccess: 'Layout road', corner: 'Non-corner', topography: 'Level', landUse: 'Residential', water: 'Municipal supply', electricity: 'Available at site', drainage: 'Underground drainage', roadInfra: 'Tar road' };
    return [
      Object.assign({}, base, { title: 'Corner plot near Kochadai', locality: 'Thirunagar', facing: 'North', area_sqft: '1500', asking_price: '33,00,000', latitude: '9.8890', longitude: '78.0580', amenities: 'Park / open space', length: '50', width: '30', roadWidth: '30', corner: 'Corner', surveyNo: '14/2', subdivision: 'Plot 9', layoutApproval: 'DTCP approval (sample no. 301/2025)' }),
      Object.assign({}, base, { title: 'Compact plot, Othakadai east', locality: 'Othakadai', facing: 'East', area_sqft: '1000', asking_price: '2200000', length: '40', width: '25', roadWidth: '24', surveyNo: '205/1', layoutApproval: 'DTCP approval (sample no. 88/2023)', water: 'Borewell', drainage: 'Open drain' }),
      Object.assign({}, base, { title: '', locality: 'Kalavasal', facing: 'East', area_sqft: '1200', asking_price: '2700000', length: '40', width: '30', roadWidth: '30', surveyNo: '77/4', layoutApproval: 'Local body approval (sample no. 12/2024)', pincode: '625016', approvals: 'Building approval' }),
      Object.assign({}, base, { title: 'Plot behind the bus depot', locality: 'Kappalur', facing: 'South', area_sqft: '1100', asking_price: '1800000', roadWidth: '20' }),
      { property_id: 'PROP-1012', asking_price: '3000000' },
      Object.assign({}, base, { title: 'Plot near ring road junction', locality: 'Ponmeni', facing: 'East', area_sqft: '1200', asking_price: '', length: '40', width: '30', surveyNo: '61/2' }),
      Object.assign({}, base, { title: 'Plot with odd facing', locality: 'Ponmeni', facing: 'Eastern', area_sqft: '1200', asking_price: '2600000', length: '40', width: '30' }),
      { property_id: 'PROP-9999', title: 'Unknown reference', asking_price: '2500000' },
      Object.assign({}, base, { title: 'Plot in Salem outskirts', city: 'Salem', locality: 'Omalur', facing: 'West', area_sqft: 'abc', asking_price: '1500000' }),
      Object.assign({}, base, { title: 'Premium residential plot', locality: 'Vilangudi', facing: 'East', area_sqft: '1200', asking_price: '2900000', amenities: 'Security;Helipad', length: '40', width: '30', roadWidth: '30' }),
    ];
  }
  // generic sample for other types: one valid new row, one update, one error row
  const t = PROPERTY_TYPES[type];
  const spec = {}; t.fields.forEach(f => { spec[f.k] = f.t === 'select' ? f.o[0] : f.t === 'number' ? '2' : f.t === 'month' ? '2027-06' : 'Sample'; });
  const existing = DB.properties.find(p => p.type === type && !p.archived);
  const city = Object.keys(CITIES)[1];
  const rows = [
    Object.assign({}, spec, { title: `New ${t.label.toLowerCase()} (sample)`, purpose: 'Sale', status: 'Available', listing_date: DEMO_TODAY, city, locality: CITIES[city].localities[1], facing: 'East', area_sqft: '1400', asking_price: '9500000' }),
    Object.assign({}, spec, { title: '', city, locality: CITIES[city].localities[0], facing: 'Sideways', area_sqft: '900', asking_price: '7000000', [t.fields[0].k]: 'Not an option' }),
  ];
  if (existing) rows.splice(1, 0, { property_id: existing.id, asking_price: String(Math.round(existing.price * 1.02)), status: 'Available' });
  return rows;
}

/* ---------- validation ---------- */
const impNum = v => Number(String(v).replace(/,/g, '').trim());
function impValidate(objs, type, lines) {
  const cols = impColumns(type), seen = {};
  return objs.map((obj, i) => {
    const line = lines ? lines[i] : i + 2; // the line in the file (headings may sit below a title)
    const r = { line, data: {}, errors: [], warnings: [], needs: [], notes: [], mode: 'new', existing: null, changes: [], extra: (obj._extra || []).filter(x => x.value) };
    cols.forEach(c => { r.data[c.k] = String(obj[c.k] ?? '').trim(); });
    const d = r.data, id = d.property_id;
    if (id) {
      if (seen[id]) r.errors.push(`Duplicate Property ID in this file (also on line ${seen[id]})`); else seen[id] = line;
      const ex = getProp(id);
      if (!ex) r.errors.push(`Unknown Property ID “${id}” — leave it blank to create a new property (IDs are generated by the system)`);
      else { r.mode = 'update'; r.existing = ex; if (ex.archived) r.errors.push(`${id} is archived — restore it before updating`); if (ex.type !== type) r.errors.push(`${id} is a ${typeLabel(ex.type)} — use the ${typeLabel(ex.type)} template`); }
    }
    if (r.mode === 'new') cols.filter(c => c.req && !d[c.k]).forEach(c => r.needs.push(c.l.replace(/ \(.*\)$/, '')));
    cols.forEach(c => {
      const v = d[c.k]; if (!v || c.k === 'property_id') return;
      if (c.t === 'number') {
        if (isNaN(impNum(v))) r.errors.push(`${c.l}: “${v}” is not a number`);
        else if (c.positive && impNum(v) <= 0) r.errors.push(`${c.l} must be greater than 0`);
      } else if (c.t === 'select') {
        const hit = c.o.find(o => o.toLowerCase() === v.toLowerCase());
        if (hit) d[c.k] = hit; else r.errors.push(`${c.l}: “${v}” is not an allowed value (${c.o.join(' / ')})`);
      } else if (c.t === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) r.errors.push(`${c.l}: use YYYY-MM-DD`);
      else if (c.t === 'month' && !/^\d{4}-\d{2}$/.test(v)) r.errors.push(`${c.l}: use YYYY-MM`);
      else if (c.t === 'list') {
        const items = v.split(';').map(s => s.trim()).filter(Boolean);
        const unknown = items.filter(a => !AMENITIES.some(x => x.toLowerCase() === a.toLowerCase()));
        if (unknown.length) r.warnings.push(`Unknown amenities ignored: ${unknown.join(', ')}`);
      } else if (c.t === 'approvals') {
        const items = v.split(';').map(s => s.trim()).filter(Boolean), unknown = items.filter(a => !impApproval(a));
        if (unknown.length) r.warnings.push(`Unknown approval badges ignored: ${unknown.join(', ')} — create them in Settings → Approval badges`);
        if (items.length > unknown.length) r.notes.push(`${items.length - unknown.length} approval badge(s) — document pending until uploaded`);
      } else if (c.k === 'pincode' && !/^\d{6}$/.test(v)) r.errors.push(`Pincode: “${v}” should be 6 digits`);
    });
    if (!!d.latitude !== !!d.longitude) r.warnings.push('Only one of latitude / longitude given — the exact location is skipped');
    else if (d.latitude && !isNaN(impNum(d.latitude)) && !isNaN(impNum(d.longitude))) r.notes.push('Exact location from latitude / longitude');
    if (r.mode === 'new' && !d.title && !r.errors.length && typeof AddProperty !== 'undefined') {
      const specs = {}; PROPERTY_TYPES[type].fields.forEach(f => { if (d[f.k]) specs[f.k] = d[f.k]; });
      r.suggestedTitle = AddProperty.titleFor({ type, locality: d.locality, city: d.city, facing: d.facing, specs });
      if (r.suggestedTitle) r.notes.push(`Title suggested by the AI: “${r.suggestedTitle}”`);
    }
    const city = d.city || (r.existing && r.existing.city);
    if (d.locality && CITIES[city] && !CITIES[city].localities.includes(d.locality)) r.warnings.push(`New locality “${d.locality}” for ${city}`);
    if (r.mode === 'new' && d.locality) { // same type and locality, similar size → probably the same property
      const area = impNum(d.area_sqft);
      const dup = DB.properties.find(p => !p.archived && p.type === type && p.locality.toLowerCase() === d.locality.toLowerCase() && (d.title && p.title.toLowerCase() === d.title.toLowerCase() || (area > 0 && Math.abs(p.area - area) / p.area <= 0.1)));
      if (dup) r.warnings.push(`Possible duplicate of ${dup.id} (${dup.title} — same locality, similar size); it will still be added`);
    }
    if (r.extra.length) r.notes.push(`Kept as extra detail${r.extra.length > 1 ? 's' : ''}: ${r.extra.map(x => `${x.label} “${x.value}”`).join(', ')}`);
    if (r.mode === 'update' && !r.errors.length) {
      cols.forEach(c => {
        if (c.k === 'property_id' || !d[c.k]) return;
        const cur = c.spec ? r.existing.specs[c.k] : getPath(r.existing, IMP_FIELD_MAP[c.k]);
        const nv = impValue(c, d[c.k]);
        if (JSON.stringify(cur ?? '') !== JSON.stringify(nv)) r.changes.push({ l: c.l, from: cur, to: nv });
      });
      r.extra.forEach(x => { const cur = ((r.existing.extra || []).find(e => impNorm(e.label) === impNorm(x.label)) || {}).value; if ((cur || '') !== x.value) r.changes.push({ l: x.label, from: cur, to: x.value, extra: true }); });
      if (!r.changes.length) r.warnings.push('No changes — this row will be skipped');
    }
    return r;
  });
}
function impValue(c, v) {
  if (c.t === 'number') return impNum(v);
  if (c.t === 'list') return v.split(';').map(s => s.trim()).map(a => AMENITIES.find(x => x.toLowerCase() === a.toLowerCase())).filter(Boolean);
  return v;
}
const impStatus = r => r.errors.length ? 'error' : r.mode === 'update' ? (r.changes.length ? 'update' : 'nochange') : r.needs.length ? 'draft' : 'new';
/** An approval badge named in the file (by its short or long name). */
const impApproval = name => approvalTypes().find(a => [a.l, a.long, a.k].some(x => String(x).toLowerCase() === String(name).toLowerCase()));
const impApprovals = v => [...new Set(String(v || '').split(';').map(x => impApproval(x.trim())).filter(Boolean).map(a => a.k))];
const impWillImport = r => { const s = impStatus(r); return s === 'new' || s === 'draft' || (s === 'update' && UI.imp.update); };

/* ---------- reading any spreadsheet: the columns are matched for you ----------
   A file made from our template goes straight to the review. Any other file (an owner's or a channel partner's own
   sheet) gets a "Match columns" step first: each column is matched to a field by its heading — with synonyms and a look
   at the values ("Area" with numbers is the size; with names it is the locality) — and the team confirms or changes it.
   Confirmed matches are remembered for the next file (DB.importMemory), and the whole format is saved per sender
   (DB.importMappings — "ABC Realty's format recognised"). Columns with no field are kept as extra details, never dropped.
   The headings may sit below a title; total rows at the bottom are skipped. In the real build the AI does the matching. */
const impNorm = h => String(h || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');
const IMP_SYN = {
  property_id: ['propertyid', 'id', 'propid', 'refno', 'reference'],
  title: ['title', 'propertytitle', 'propertyname', 'name', 'plotname', 'projectname', 'listingtitle', 'heading', 'property'],
  purpose: ['purpose', 'listingpurpose', 'saleorrent', 'salerent', 'dealtype', 'transaction', 'for'],
  status: ['status', 'availability', 'propertystatus'],
  listing_date: ['listingdate', 'date', 'listedon', 'dateadded', 'listeddate'],
  city: ['city', 'town', 'district', 'citydistrict'],
  locality: ['locality', 'areaname', 'location', 'place', 'neighbourhood', 'neighborhood', 'village', 'locality name'],
  address: ['address', 'doorno', 'street', 'fulladdress', 'addressline', 'doornostreet'],
  pincode: ['pincode', 'pin', 'postalcode', 'zip', 'zipcode', 'pinno'],
  facing: ['facing', 'direction', 'orientation'],
  area_sqft: ['areasqft', 'size', 'plotsize', 'plotarea', 'sqft', 'totalarea', 'builtuparea', 'extent', 'landarea', 'areainsqft', 'sizesqft', 'carpetarea'],
  asking_price: ['askingprice', 'price', 'rate', 'cost', 'amount', 'expectedprice', 'value', 'totalprice', 'pricers', 'priceinr', 'quotedprice', 'rs'],
  latitude: ['latitude', 'lat'], longitude: ['longitude', 'long', 'lng', 'lon'],
  amenities: ['amenities', 'features', 'facilities'],
  approvals: ['approvals', 'approval', 'approvalbadges', 'approvedby', 'sanction', 'approvaltype'],
  length: ['length', 'plotlength', 'lengthft'], width: ['width', 'breadth', 'plotwidth', 'widthft', 'breadthft'],
  roadWidth: ['roadwidth', 'road', 'roadft', 'roadsize', 'streetwidth', 'roadaccesswidth'], corner: ['corner', 'cornerplot', 'cornernoncorner'],
  surveyNo: ['surveyno', 'surveynumber', 'sfno', 'survey', 'sno'], layoutApproval: ['layoutapproval', 'dtcp', 'approvalno', 'layoutno', 'layoutapprovaldetails'],
  bhk: ['bhk', 'config', 'configuration', 'bhkconfiguration', 'type bhk'], floor: ['floor', 'floorno', 'floornumber'], bedrooms: ['bedrooms', 'beds', 'bedroom'],
  bathrooms: ['bathrooms', 'baths', 'toilets'], parking: ['parking', 'carparking', 'carpark'], maintenance: ['maintenance', 'maintenancecharges', 'monthlymaintenance'],
};
const isNumish = v => /^\s*(₹|rs\.?)?\s*[\d,.]+\s*(l|lac|lakh|lakhs|cr|crore|crores|k|sq\.?\s*ft\.?|sqft|ft|feet|cents|acres?)?\s*$/i.test(String(v));
/** Match a file's column headings to the template's fields: exact → remembered → AI (synonyms + the values). */
const IMP_EXTRA = '_extra'; // "Keep as extra detail" — a column with no field of its own
const impKeyOk = (k, cols) => k === '' || k === IMP_EXTRA || cols.some(c => c.k === k);
function impAutoMap(headers, rows, type, format) {
  const cols = impColumns(type), mem = DB.importMemory || {}, used = new Set(), fm = (format && format.map) || {};
  const out = headers.map((h, i) => {
    const n = impNorm(h), samples = rows.map(r => r[i]).filter(v => String(v ?? '').trim() !== '').slice(0, 3);
    if (!n) return { h, key: '', how: 'none', samples };
    let col = cols.find(c => impNorm(c.k) === n || impNorm(c.l) === n);
    if (col) return { h, key: col.k, how: 'exact', samples };
    if (fm[n] !== undefined && impKeyOk(fm[n], cols)) return { h, key: fm[n], how: 'format', samples };
    if (mem[n] !== undefined && impKeyOk(mem[n], cols)) return { h, key: mem[n], how: 'remembered', samples };
    // ambiguous headings: decide by the values
    if (['area', 'location', 'areaname'].includes(n) && samples.length) {
      const num = samples.filter(isNumish).length >= Math.ceil(samples.length / 2);
      return { h, key: num ? 'area_sqft' : 'locality', how: 'ai', samples, why: num ? 'the values are sizes' : 'the values are place names' };
    }
    const hit = cols.find(c => (IMP_SYN[c.k] || []).map(impNorm).includes(n)) || cols.find(c => (IMP_SYN[c.k] || []).map(impNorm).some(s => s.length > 3 && (n.includes(s) || s.includes(n))));
    return hit ? { h, key: hit.k, how: 'ai', samples } : samples.length ? { h, key: IMP_EXTRA, how: 'extra', samples } : { h, key: '', how: 'none', samples };
  });
  out.forEach(m => { if (!m.key || m.key === IMP_EXTRA) return; if (used.has(m.key) && m.how !== 'exact') { m.key = m.samples.length ? IMP_EXTRA : ''; m.how = m.key ? 'extra' : 'none'; } else used.add(m.key); });
  return out;
}
/** Values from people's own sheets: "30 L", "1.2 Cr", "1,200 sqft", "30 ft", Excel dates. */
function impClean(key, v, type) {
  const s = String(v ?? '').trim(); if (!s) return { v: '' };
  const col = impColumns(type).find(c => c.k === key) || {};
  if (key === 'asking_price' || (col.t === 'number' && /₹/.test(col.l || ''))) {
    const m = s.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(cr|crore|crores|l|lac|lakh|lakhs|k)?\b/i);
    if (m) { const mult = { cr: 1e7, crore: 1e7, crores: 1e7, l: 1e5, lac: 1e5, lakh: 1e5, lakhs: 1e5, k: 1e3 }[(m[2] || '').toLowerCase()] || 1; const n = Math.round(+m[1] * mult); return { v: String(n), note: mult > 1 ? `“${s}” read as ${inr(n)}` : '' }; }
  }
  if (col.t === 'number') { const m = s.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/); if (m && m[0] !== s.replace(/,/g, '')) return { v: m[0], note: `“${s}” read as ${m[0]}` }; if (m) return { v: m[0] }; }
  if (col.t === 'date' && /^\d{5}$/.test(s)) { const d = new Date(Date.UTC(1899, 11, 30) + (+s) * 864e5).toISOString().slice(0, 10); return { v: d, note: `Excel date ${s} read as ${d}` }; }
  if (key === 'approvals') return { v: s.split(/[;,/]| and /i).map(x => x.trim()).map(x => /dtcp|cmda|layout|building|plan/i.test(x) && !impApproval(x) ? 'Building approval' : /rera/i.test(x) ? 'RERA' : x).filter(Boolean).join(';') };
  if (col.t === 'select') { const hit = (col.o || []).find(o => impNorm(o) === impNorm(s)) || (col.o || []).find(o => impNorm(o).startsWith(impNorm(s)) && impNorm(s).length >= 3); return { v: hit || s }; }
  return { v: s };
}
/** Rows (first = headings) → the review, through the "Match columns" step when the headings aren't ours. */
/** The heading row: the first row (of the first 15) that is nearly as wide as the table and mostly text — a title
    or "Prepared by…" line above it is skipped. */
function impFindHeader(rows) {
  const filled = r => r.filter(c => c.trim() !== '').length, wide = Math.max(...rows.slice(0, 40).map(filled));
  for (let i = 0; i < Math.min(rows.length - 1, 15); i++) {
    const f = filled(rows[i]); if (f < Math.max(2, Math.ceil(wide * 0.6))) continue;
    if (rows[i].filter(c => c.trim() !== '' && !isNumish(c)).length / f >= 0.7) return i;
  }
  return 0;
}
/** A saved format: the same set of headings (80%+ alike) from an earlier file of the same type. */
const impSig = headers => [...new Set(headers.map(impNorm).filter(Boolean))];
function impFindFormat(headers, type) {
  const sig = impSig(headers); let best = null, bestScore = 0;
  (DB.importMappings || []).filter(f => f.type === type).forEach(f => { const same = f.sig.filter(x => sig.includes(x)).length, score = same / Math.max(f.sig.length, sig.length); if (score >= 0.8 && score > bestScore) { best = f; bestScore = score; } });
  return best;
}
/** Rows → the review. Headings found (even below a title), totals skipped, columns matched. */
function impPrepare(rows, fileName) {
  const I = UI.imp;
  const all = rows.map((r, i) => ({ r: (r || []).map(c => String(c ?? '')), line: i + 1 })).filter(x => x.r.some(c => c.trim() !== ''));
  Object.assign(I, { result: null, filter: '', fileNotes: [], rows: null, src: null, colsOpen: false, sender: '' });
  if (all.length < 2) { toast(all.length ? 'The file has headings but no rows' : 'The file is empty'); render(); return; }
  const hi = impFindHeader(all.map(x => x.r)), found = [];
  const headers = all[hi].r.map(h => h.trim());
  if (all[hi].line > 1) found.push(`Headings found on line ${all[hi].line}${hi ? ` — skipped above them: ${all.slice(0, hi).map(x => '“' + x.r.filter(c => c.trim()).join(' ') + '”').join(', ')}` : ''}`);
  let body = all.slice(hi + 1), limited = false;
  // "Total: 4 plots" / "Grand total" rows at the bottom
  const isTotal = r => /^\s*(grand\s+|sub\s*)?total\b/i.test(r.find(c => c.trim()) || '') && r.filter(c => c.trim()).length <= Math.ceil(headers.filter(Boolean).length / 2);
  const totals = body.filter(x => isTotal(x.r)); body = body.filter(x => !isTotal(x.r));
  if (totals.length) found.push(`Skipped ${totals.length} total row${totals.length > 1 ? 's' : ''} (line ${totals.map(x => x.line).join(', ')})`);
  if (!body.length) { toast('The file has headings but no rows'); render(); return; }
  if (body.length > IMP_MAX_ROWS) { body = body.slice(0, IMP_MAX_ROWS); limited = true; }
  const data = body.map(x => x.r), format = impFindFormat(headers, I.type);
  const mapping = impAutoMap(headers, data, I.type, format);
  I.file = fileName; I.sender = format ? format.sender : '';
  I.src = { headers, data, lines: body.map(x => x.line), mapping, limited, found, format, template: mapping.every(m => m.how === 'exact' || !m.h) };
  impRun();
}
/** (Re)check every row with the current column matches — runs again whenever a match is changed. */
function impRun() {
  const I = UI.imp, { data, mapping, limited } = I.src, cols = impColumns(I.type);
  I.fileNotes = limited ? [`Only the first ${IMP_MAX_ROWS} rows were read`] : [];
  const missing = cols.filter(c => c.req && !mapping.some(m => m.key === c.k));
  if (missing.length) I.fileNotes.push(`Not in this file: ${missing.map(c => c.l.replace(/ \(.*\)$/, '')).join(', ')} — rows are still imported, as drafts the AI finishes`);
  const conv = [];
  const objs = data.map((r, ri) => {
    const o = {}; conv[ri] = [];
    // "30 ft", "32 lakhs", Excel dates — read the same way in every column
    mapping.forEach((m, i) => {
      if (!m.key) return;
      if (m.key === IMP_EXTRA) { (o._extra = o._extra || []).push({ label: m.h, value: String(r[i] ?? '').trim() }); return; }
      const c = impClean(m.key, r[i], I.type); o[m.key] = c.v; if (c.note) conv[ri].push(c.note);
    });
    return o;
  });
  I.rows = impValidate(objs, I.type, I.src.lines);
  I.rows.forEach((row, ri) => { (conv[ri] || []).forEach(n => row.notes.push(n)); });
  render();
}
function impLoad(text, fileName) { impPrepare(parseCSV(text), fileName); }
/* An owner's own sheet — different headings, lakh prices, units in the cells — to try the matching. */
function impOwnerSample() {
  return [['ABC Realty – Plot list, November 2026'], ['Prepared for the sales team'], [],
    ['Plot Name', 'Area Name', 'Town', 'Plot Size', 'Rate', 'Facing', 'Length', 'Breadth', 'Road', 'Survey No', 'Approval', 'Contact person', 'Owner remarks'],
    ['Sunrise Nagar plot', 'Vilangudi', 'Madurai', '1200 sqft', '30 L', 'East', '40', '30', '30 ft', '112/3', 'DTCP', 'Mr. Kumar', 'Clear title, ready to register'],
    ['', 'Thirunagar', 'Madurai', '1,500', '36 lakhs', 'North', '50', '30', '40 ft', '', 'Building approval', '', ''],
    ['Corner plot near temple', 'Ponmeni', 'Madurai', '1350', '31,00,000', 'North-East', '45', '30', '', '61/4', '', 'Mrs. Latha', 'Price slightly negotiable'],
    ['Budget plot', 'Kappalur', 'Madurai', '1000', '18 L', 'South', '', '', '20 ft', '', '', '', ''],
    ['Total: 4 plots']];
}

/* ---------- Excel (.xlsx), read in the browser: an .xlsx file is a zip of XML files ---------- */
async function readXlsx(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf);
  let eocd = -1; for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not an Excel file');
  const n = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true); const files = {};
  for (let k = 0; k < n; k++) {
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    files[new TextDecoder().decode(u8.slice(p + 46, p + 46 + nlen))] = { method, csize, off };
    p += 46 + nlen + xlen + clen;
  }
  const read = async name => {
    const f = files[name]; if (!f) return null;
    const start = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true), raw = u8.slice(start, start + f.csize);
    if (f.method === 0) return new TextDecoder().decode(raw);
    const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).text();
  };
  const xml = s => new DOMParser().parseFromString(s, 'application/xml');
  const ss = await read('xl/sharedStrings.xml'), shared = ss ? [...xml(ss).getElementsByTagName('si')].map(si => [...si.getElementsByTagName('t')].map(t => t.textContent).join('')) : [];
  const sheetName = Object.keys(files).filter(f => /^xl\/worksheets\/sheet\d+\.xml$/.test(f)).sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]))[0];
  if (!sheetName) throw new Error('no sheet found');
  const doc = xml(await read(sheetName)), rows = [];
  const colIx = ref => { let c = 0; for (const ch of ref.replace(/\d+/g, '')) c = c * 26 + ch.charCodeAt(0) - 64; return c - 1; };
  [...doc.getElementsByTagName('row')].forEach(row => {
    const r = [];
    [...row.getElementsByTagName('c')].forEach(c => {
      const t = c.getAttribute('t'), v = c.getElementsByTagName('v')[0], is = c.getElementsByTagName('is')[0];
      let val = t === 's' ? shared[+(v && v.textContent)] : t === 'inlineStr' ? (is ? is.textContent : '') : t === 'b' ? (v && v.textContent === '1' ? 'TRUE' : 'FALSE') : v ? v.textContent : '';
      if (t !== 's' && t !== 'inlineStr' && t !== 'str' && val !== '' && !isNaN(+val)) val = String(+(+val).toPrecision(12));
      r[colIx(c.getAttribute('r') || 'A')] = val ?? '';
    });
    rows[+row.getAttribute('r') - 1] = Array.from(r, x => x ?? '');
  });
  return Array.from(rows, x => x || []);
}

/* ---------- columns: a one-line summary on the review; "Check / change" opens the matches inline ---------- */
function impColsHtml() {
  const I = UI.imp, M = I.src, cols = impColumns(I.type);
  if (!M || M.template) return '';
  const used = M.mapping.filter(m => m.h && m.key && m.key !== IMP_EXTRA), kept = M.mapping.filter(m => m.h && m.key === IMP_EXTRA), unused = M.mapping.filter(m => m.h && !m.key), ai = used.filter(m => m.how === 'ai').length;
  const dupKeys = M.mapping.map(m => m.key).filter((k, i, a) => k && k !== IMP_EXTRA && a.indexOf(k) !== i);
  const senders = [...new Set((DB.importMappings || []).map(f => f.sender).filter(Boolean))];
  const from = `<div class="im-from">${M.format ? `<span class="im-known">📁 <b>${esc(M.format.sender || 'This')}’s format recognised</b> — columns matched as last time${M.format.uses ? ` (used ${M.format.uses}×)` : ''}</span>` : '<span class="muted">New format — it will be saved for next time.</span>'}
      <label>Sent by <input data-chg="impSender" list="im-senders" value="${esc(I.sender || '')}" placeholder="e.g. ABC Realty"></label><datalist id="im-senders">${senders.map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>`;
  const label = k => (cols.find(c => c.k === k) || { l: k }).l.replace(/ \(.*\)$/, '');
  const conv = (I.rows || []).reduce((n, r) => n + r.notes.filter(x => / read as /.test(x)).length, 0), ex = ((I.rows || []).flatMap(r => r.notes).find(x => / read as /.test(x)) || '').replace(/^“(.*)” read as (.*)$/, '$1 → $2');
  const summary = from + `<div class="im-cols"><span>✨ <b>${used.length} of ${used.length + kept.length + unused.length} columns matched</b>${ai ? ` · ${ai} by the AI` : ''}${kept.length ? ` · kept as extra details: ${esc(kept.map(m => m.h).join(', '))}` : ''}${unused.length ? ` · not used: ${esc(unused.map(m => m.h).join(', '))}` : ''}${conv ? ` · ${conv} value${conv > 1 ? 's' : ''} read from other formats (e.g. ${esc(ex)})` : ''}</span>
      <button class="linkbtn" data-act="impColsOpen">${I.colsOpen ? 'Done' : 'Check / change'}</button></div>`;
  if (!I.colsOpen) return summary + (dupKeys.length ? '<div class="note red" style="margin-top:6px">Two columns go into the same field — open “Check / change” and fix one.</div>' : '');
  const opt = m => `<option value="">— Don’t use —</option><option value="${IMP_EXTRA}" ${m.key === IMP_EXTRA ? 'selected' : ''}>Keep as extra detail</option>${cols.map(c => `<option value="${c.k}" ${m.key === c.k ? 'selected' : ''}>${esc(c.l)}</option>`).join('')}`;
  return summary + `<div class="im-colgrid">${M.mapping.map((m, i) => m.h ? `<div class="im-col ${dupKeys.includes(m.key) ? 'dup' : ''}">
      <div><b>${esc(m.h)}</b> ${m.how === 'ai' ? '<span class="srcmini s-ai" title="Matched by the AI">✨</span>' : m.how === 'remembered' || m.how === 'format' ? '<small class="muted">as last time</small>' : ''}<small class="muted">${m.samples.slice(0, 2).map(esc).join(' · ') || 'empty'}</small></div>
      <select data-chg="impMapSel" data-i="${i}">${opt(m)}</select></div>` : '').join('')}</div>
    <p class="muted" style="margin:6px 0 0;font-size:12px">Your choices are saved with this sender’s format for the next file. “Keep as extra detail” adds the column to the property as written.${dupKeys.length ? ' <b class="t-amber">Two columns go into the same field.</b>' : ''}</p>`;
}
/* ---------- import ---------- */
function impApply() {
  const I = UI.imp; if (!DB.imports) DB.imports = [];
  if (I.src && !I.src.template) {
    DB.importMemory = DB.importMemory || {}; I.src.mapping.forEach(m => { if (m.h && m.how !== 'exact') DB.importMemory[impNorm(m.h)] = m.key; });
    // the whole format, saved per sender — recognised next time even when the sender isn't named again
    DB.importMappings = DB.importMappings || [];
    const sig = impSig(I.src.headers), sender = (I.sender || '').trim(), map = {};
    I.src.mapping.forEach(m => { if (impNorm(m.h)) map[impNorm(m.h)] = m.key; });
    let f = I.src.format || DB.importMappings.find(x => x.type === I.type && x.sender && x.sender.toLowerCase() === sender.toLowerCase() && x.sig.join() === sig.join());
    if (!f) { f = { id: 'FMT-' + String(DB.importMappings.length + 1).padStart(3, '0'), type: I.type, uses: 0, created: DEMO_TODAY, by: currentUser() }; DB.importMappings.push(f); }
    Object.assign(f, { sender: sender || f.sender || '', sig, headers: I.src.headers.filter(Boolean), map, uses: (f.uses || 0) + 1, last: DEMO_TODAY });
  }
  const cols = impColumns(I.type), batch = 'IMP-' + String(DB.imports.length + 1).padStart(3, '0');
  const created = [], updated = [], skipped = [], drafts = [];
  I.rows.forEach(r => {
    if (!impWillImport(r)) { skipped.push(r); return; }
    const d = r.data;
    if (impStatus(r) === 'draft') { // missing required details → a draft the AI assistant finishes
      const specs = {};
      PROPERTY_TYPES[I.type].fields.forEach(f => { const c = cols.find(x => x.k === f.k); if (d[f.k]) specs[f.k] = impValue(c, d[f.k]); });
      const res = AddProperty.importDraft({ type: I.type, purpose: d.purpose || 'Sale', title: d.title, facing: d.facing, area: d.area_sqft ? impNum(d.area_sqft) : '', price: d.asking_price ? impNum(d.asking_price) : '',
        city: d.city, locality: d.locality, pincode: d.pincode, address: d.address, lat: d.latitude && d.longitude ? impNum(d.latitude) : '', lng: d.latitude && d.longitude ? impNum(d.longitude) : '',
        specs, amenities: d.amenities ? impValue({ t: 'list' }, d.amenities) : [], approvals: impApprovals(d.approvals), extra: r.extra }, { file: I.file, line: r.line, batch });
      drafts.push(res);
      return;
    }
    if (r.mode === 'new') {
      const specs = {};
      PROPERTY_TYPES[I.type].fields.forEach(f => { const c = cols.find(x => x.k === f.k); specs[f.k] = d[f.k] ? impValue(c, d[f.k]) : ''; });
      const p = {
        id: 'PROP-' + (++DB.counters.prop), title: d.title || r.suggestedTitle || typeLabel(I.type), type: I.type, purpose: d.purpose || 'Sale', status: d.status || 'Available', listingDate: d.listing_date || DEMO_TODAY,
        city: d.city, locality: d.locality, state: 'Tamil Nadu', facing: d.facing || '', area: impNum(d.area_sqft), price: impNum(d.asking_price),
        amenities: d.amenities ? impValue({ t: 'list' }, d.amenities) : [], images: 0, specs, extra: r.extra.map(x => ({ label: x.label, value: x.value })),
        location: (ll => ({ lat: ll ? impNum(d.latitude) : '', lng: ll ? impNum(d.longitude) : '', address: d.address || '', pincode: d.pincode || '', district: (CITIES[d.city] || {}).district || d.city, pinOk: ll, suggestPending: ll, roadType: '', roadWidth: '', nearby: [] }))(!!(d.latitude && d.longitude)),
        approvals: impApprovals(d.approvals).map(k => ({ k, status: 'pending', file: '', uploadedBy: '', uploadedAt: '', verifiedBy: '', verifiedAt: '' })), documents: [],
        valuation: { reviewDate: '', valuerReport: '', notes: '', comparables: [] }, history: [],
      };
      logHistory(p, `Created by bulk import ${batch} (${I.file}, line ${r.line}${I.sender ? ', from ' + I.sender : ''})${d.title ? '' : ' — title suggested by the AI'}`);
      DB.properties.unshift(p); created.push(p.id);
      if (typeof addDefaultPlaces === 'function') addDefaultPlaces(p);
    } else {
      const p = r.existing;
      cols.forEach(c => {
        if (c.k === 'property_id' || !d[c.k]) return;
        const v = impValue(c, d[c.k]);
        if (c.k === 'approvals') { impApprovals(d.approvals).forEach(k => { normLegal(p); if (!p.approvals.some(a => a.k === k)) p.approvals.push({ k, status: 'pending', file: '', uploadedBy: '', uploadedAt: '', verifiedBy: '', verifiedAt: '' }); }); return; }
        if (c.spec) p.specs[c.k] = v; else setPath(p, IMP_FIELD_MAP[c.k], v);
      });
      r.extra.forEach(x => { p.extra = p.extra || []; const e = p.extra.find(y => impNorm(y.label) === impNorm(x.label)); if (e) e.value = x.value; else p.extra.push({ label: x.label, value: x.value }); });
      logHistory(p, `Updated by bulk import ${batch}: ${r.changes.map(x => x.l).join(', ')}`);
      updated.push(p.id);
    }
  });
  const rec = { id: batch, date: DEMO_TODAY, by: currentUser(), type: I.type, file: I.file, sender: (I.sender || '').trim(), total: I.rows.length, created, updated, drafts, skipped: skipped.length, errors: I.rows.filter(r => r.errors.length).length };
  DB.imports.unshift(rec); save();
  I.result = rec; I.rows = null;
  toast(`${batch}: ${created.length} created, ${drafts.length} saved as drafts, ${updated.length} updated, ${skipped.length} skipped`);
  render();
}

/* ---------- view: drop a file → check → import ---------- */
function viewImport() {
  const I = UI.imp;
  const body = I.result ? impResultHtml(I.result) : I.rows ? impReviewHtml() : impStartHtml();
  // a slim horizontal stepper: ① Upload file ── ② Check ── ③ Done
  const at = I.result ? 2 : I.rows ? 1 : 0;
  const stepper = `<div class="im-steps">${['Upload file', 'Check', 'Done'].map((l, i) => `${i ? `<span class="im-line ${i <= at ? 'on' : ''}"></span>` : ''}<span class="im-step ${i < at || at === 2 ? 'done' : i === at ? 'on' : ''}"><b>${i < at || at === 2 ? '✓' : i + 1}</b>${l}</span>`).join('')}</div>`;
  return {
    title: 'Bulk import', crumbs: 'Specification data / <b>Bulk import</b>',
    html: `<div class="page-head"><div><h1>Bulk import</h1><p>Add or update many properties at once from a spreadsheet.</p></div><span class="sp"></span><a class="btn" href="#/properties">← Properties</a></div>
      ${stepper}${body}${impHistoryHtml()}`,
  };
}
function impStartHtml() {
  const I = UI.imp, t = PROPERTY_TYPES[I.type], cols = impColumns(I.type);
  return `<div class="card im-start">
      <div class="im-q">What’s in the file?</div>
      <div class="pills im-types">${Object.entries(PROPERTY_TYPES).map(([k, v]) => `<button type="button" class="pill ${k === I.type ? 'on' : ''}" data-act="impTypePick" data-k="${k}">${esc(v.label)}</button>`).join('')}</div>
      <label class="im-drop" data-filedrop>
        <input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-chg="impFile" style="display:none">
        <span class="im-drop-ic">📄</span><b>Drop an Excel or CSV file here</b><small>or click to choose · our template or your own sheet · up to ${IMP_MAX_ROWS} rows</small></label>
      <div class="im-links"><button class="linkbtn" data-act="impTemplate">⤓ Download the ${esc(t.label.toLowerCase())} template</button><span>·</span><button class="linkbtn" data-act="impUseSample">Try a sample</button><span>·</span><button class="linkbtn" data-act="impUseOwner">Try an owner’s own sheet</button></div>
      <p class="im-promise">✨ Columns with other names are matched for you · a title above the headings is fine · “30 L” or “1,200 sqft” are read · other columns are kept as extra details · rows missing details become drafts — nothing is lost.</p>
    </div>
    <details class="card im-more"><summary>Which columns can the file have? <span class="muted">(${cols.length} for a ${esc(t.label.toLowerCase())})</span></summary>
      <div class="im-colref">${cols.filter(c => c.k !== 'property_id').map(c => `<span class="${c.req ? 'req' : ''}" title="${esc(c.hint || '')}">${esc(c.l.replace(/ \(.*\)$/, ''))}</span>`).join('')}</div>
      <p class="muted" style="margin:8px 0 0;font-size:12.5px"><b class="t-amber">Highlighted</b> = needed to publish (a row without them becomes a draft). Add a <b>Property ID</b> column to update existing properties — only the filled cells change. Approvals can be listed; documents and photos are added on the property page.</p>
    </details>`;
}
function impReviewHtml() {
  const I = UI.imp, rows = I.rows, count = st => rows.filter(r => impStatus(r) === st).length;
  const n = { all: rows.length, new: count('new'), draft: count('draft'), update: count('update') + count('nochange'), error: count('error') };
  const willImport = rows.filter(impWillImport).length;
  const F = [['', 'All', n.all], ['new', 'Ready', n.new, 'green'], ['draft', 'Drafts', n.draft, 'amber'], ['update', 'Updates', n.update, 'blue'], ['error', 'Need fixing', n.error, 'red']].filter(f => f[2] || !f[0]);
  const chips = F.map(([k, l, c, tone]) => `<button class="im-f ${I.filter === k ? 'on' : ''} ${tone || ''}" data-act="impF" data-k="${k}">${l} <b>${c}</b></button>`).join('');
  const shown = rows.filter(r => !I.filter || impStatus(r) === I.filter || (I.filter === 'update' && impStatus(r) === 'nochange'));
  const what = r => {
    const st = impStatus(r);
    if (st === 'error') return `<span class="t-red">✗ ${esc(r.errors[0])}</span>${r.errors.length > 1 ? ` <small class="muted">+${r.errors.length - 1} more</small>` : ''}`;
    const main = st === 'draft' ? `<span class="t-amber">Draft — the AI will ask for <b>${esc(r.needs.join(', '))}</b></span>`
      : st === 'update' ? `Update: ${r.changes.map(c => `${esc(c.l.replace(/ \(.*\)$/, ''))} ${/price|₹/i.test(c.l) && +c.from ? `<s class="muted">${inrShort(+c.from)}</s> ` : ''}→ <b>${/price|₹/i.test(c.l) && +c.to ? inrShort(+c.to) : esc(Array.isArray(c.to) ? c.to.join('; ') : c.to)}</b>`).join(', ')}`
      : st === 'nochange' ? '<span class="muted">No change — skipped</span>' : '<span class="t-green">Ready</span>';
    const extra = [...r.warnings.map(w => `<span class="t-amber">⚠ ${esc(w)}</span>`), ...r.notes.filter(x => !/ read as /.test(x)).map(x => esc(x))];
    return main + (extra.length ? `<small class="im-extra">${extra.join(' · ')}</small>` : '');
  };
  const DOT = { new: 'green', draft: 'amber', update: 'blue', nochange: 'grey', error: 'red' };
  const list = shown.map(r => { const st = impStatus(r), d = r.data, p = r.existing, title = d.title || (p && p.title) || r.suggestedTitle || '—';
    return `<div class="im-row"><span class="im-dot ${DOT[st]}" title="Line ${r.line}"></span>
      <div class="im-prop"><b>${esc(title)}</b>${!d.title && r.suggestedTitle ? ' <span class="srcmini s-ai" title="Title suggested by the AI">✨</span>' : ''}
        <small>${p ? `<a class="mono" href="#/properties/${p.id}">${p.id}</a> · ` : ''}${esc(d.locality || (p && p.locality) || '')}${d.city || p ? ', ' + esc(d.city || p.city) : ''} · line ${r.line}</small></div>
      <div class="im-nums">${d.area_sqft && !isNaN(impNum(d.area_sqft)) ? num(impNum(d.area_sqft)) + ' sq.ft.' : esc(d.area_sqft || '')}<br>${d.asking_price && !isNaN(impNum(d.asking_price)) ? inrShort(impNum(d.asking_price)) : esc(d.asking_price || '')}</div>
      <div class="im-what">${what(r)}</div></div>`; }).join('');
  return `<div class="card">
    <div class="card-head"><h2>${esc(I.file)}</h2>${chip(typeLabel(I.type), 'blue')}<span class="muted" style="font-size:13px">${rows.length} row${rows.length === 1 ? '' : 's'}</span><span class="sp"></span><button class="btn sm" data-act="impReset">Choose another file</button></div>
    ${impColsHtml()}
    ${(I.src && I.src.found || []).map(x => `<p class="im-found">🔎 ${esc(x)}</p>`).join('')}
    ${I.fileNotes.map(x => `<div class="note amber" style="margin:8px 0 0">${esc(x)}</div>`).join('')}
    <div class="im-fs">${chips}</div>
    <div class="im-list">${list || '<p class="muted" style="margin:10px 0">No rows here.</p>'}</div>
    <div class="im-foot">
      ${n.error ? `<button class="linkbtn" data-act="impErrors">⤓ Rows that need fixing (${n.error})</button>` : ''}
      ${n.update ? `<label class="check"><input type="checkbox" data-chg="impUpdate" ${I.update ? 'checked' : ''}> Update existing properties</label>` : ''}
      <span class="sp"></span><button class="btn" data-act="impReset">Cancel</button>
      <button class="btn primary" data-act="impApply" ${willImport ? '' : 'disabled'}>Import ${willImport} row${willImport === 1 ? '' : 's'}</button></div>
  </div>`;
}
function impResultHtml(r) {
  const link = id => `<a href="#/properties/${id}" class="mono">${id}</a>`, dr = r.drafts || [];
  return `<div class="card im-done">
    <h2>✅ Imported ${esc(r.file)}</h2>
    <div class="im-fs">${r.created.length ? `<span class="im-f green on">Added <b>${r.created.length}</b></span>` : ''}${dr.length ? `<span class="im-f amber on">Drafts to finish <b>${dr.length}</b></span>` : ''}${r.updated.length ? `<span class="im-f blue on">Updated <b>${r.updated.length}</b></span>` : ''}${r.skipped ? `<span class="im-f">Skipped <b>${r.skipped}</b></span>` : ''}</div>
    ${r.created.length ? `<p><b>Added:</b> ${r.created.map(link).join(', ')} <span class="muted">— nearby places already shown; add photos when you have them.</span></p>` : ''}
    ${r.updated.length ? `<p><b>Updated:</b> ${r.updated.map(link).join(', ')}</p>` : ''}
    ${dr.length ? `<p><b>Drafts:</b> ${dr.map(x => `<a class="mono" href="#/properties/draft/${x.id}">${x.id}</a> <small class="muted">(needs ${esc(x.missing.join(', '))})</small>`).join(', ')} <span class="muted">— open one and the AI asks for what’s missing.</span></p>` : ''}
    <div class="row" style="margin-top:12px">${r.created.length ? '<a class="btn" href="#/properties">Open properties</a>' : ''}${dr.length ? '<a class="btn" href="#/properties/drafts">Open drafts</a>' : ''}<span class="sp"></span><button class="btn primary" data-act="impReset">Import another file</button></div>
  </div>`;
}
function impFormatsHtml() {
  const list = DB.importMappings || [];
  if (!list.length) return '';
  return `<details class="card im-more"><summary>Saved formats <span class="muted">(${list.length}) — recognised automatically next time</span></summary>
    <div class="tbl-wrap"><table><thead><tr><th>Sender</th><th>Type</th><th>Columns</th><th class="num">Used</th><th>Last used</th><th></th></tr></thead><tbody>
    ${list.map(f => `<tr><td><b>${esc(f.sender || 'Unnamed')}</b></td><td>${esc(typeLabel(f.type))}</td><td><small>${esc(f.headers.slice(0, 6).join(', '))}${f.headers.length > 6 ? ` +${f.headers.length - 6}` : ''}</small></td><td class="num">${f.uses}</td><td>${fmtDate(f.last)}</td>
      <td><button class="btn sm ghost" data-act="impFmtForget" data-id="${f.id}">Forget</button></td></tr>`).join('')}
    </tbody></table></div></details>`;
}
function impHistoryHtml() {
  const list = DB.imports || [];
  if (!list.length) return impFormatsHtml();
  return `<details class="card im-more"><summary>Past imports <span class="muted">(${list.length})</span></summary>
    <div class="tbl-wrap"><table><thead><tr><th>Batch</th><th>Date</th><th>By</th><th>File</th><th class="num">Added</th><th class="num">Drafts</th><th class="num">Updated</th><th class="num">Skipped</th></tr></thead><tbody>
    ${list.map(b => `<tr><td class="mono">${b.id}</td><td>${fmtDate(b.date)}</td><td><small>${esc(b.by)}</small></td><td><small>${esc(b.file)}</small>${b.sender ? `<br><small class="muted">from ${esc(b.sender)}</small>` : ''}</td><td class="num">${b.created.length}</td><td class="num">${(b.drafts || []).length}</td><td class="num">${b.updated.length}</td><td class="num">${b.skipped}</td></tr>`).join('')}
    </tbody></table></div></details>` + impFormatsHtml();
}
/* ---------- events ---------- */
Object.assign(ACTIONS, {
  impTemplate: () => { const cols = impColumns(UI.imp.type); downloadFile(`property-import-template-${UI.imp.type}.csv`, toCSV([cols.map(c => c.k)])); toast('Template downloaded'); },
  impSampleCsv: () => { const cols = impColumns(UI.imp.type); downloadFile(`property-import-sample-${UI.imp.type}.csv`, toCSV([cols.map(c => c.k), ...impSample(UI.imp.type).map(o => cols.map(c => o[c.k] ?? ''))])); },
  impUseSample: () => { const cols = impColumns(UI.imp.type); impLoad(toCSV([cols.map(c => c.k), ...impSample(UI.imp.type).map(o => cols.map(c => o[c.k] ?? ''))]), `sample-${UI.imp.type}.csv`); },
  impReset: () => { Object.assign(UI.imp, { rows: null, src: null, colsOpen: false, file: '', fileNotes: [], filter: '', result: null, sender: '' }); render(); },
  impFmtForget: d => { DB.importMappings = (DB.importMappings || []).filter(f => f.id !== d.id); save(); toast('Format forgotten — the next file like it is matched afresh'); render(); },
  impTypePick: d => { UI.imp.type = d.k; render(); },
  impF: d => { UI.imp.filter = d.k; render(); },
  impColsOpen: () => { UI.imp.colsOpen = !UI.imp.colsOpen; render(); },
  impUseOwner: () => { UI.imp.type = 'plot'; impPrepare(impOwnerSample(), 'owner-plots.xlsx'); },
  impApply: () => impApply(),
  impErrors: () => {
    const cols = impColumns(UI.imp.type), bad = UI.imp.rows.filter(r => r.errors.length);
    downloadFile(`import-errors-${UI.imp.type}.csv`, toCSV([['line', 'errors', ...cols.map(c => c.k)], ...bad.map(r => [r.line, r.errors.join(' | '), ...cols.map(c => r.data[c.k])])]));
  },
});
Object.assign(CHANGES, {
  impType: el => { UI.imp.type = el.value; UI.imp.rows = null; UI.imp.result = null; render(); },
  impFilter: el => { UI.imp.filter = el.value; render(); },
  impUpdate: el => { UI.imp.update = el.checked; render(); },
  impFile: el => impReadFile(el.files && el.files[0]),
  impSender: el => { UI.imp.sender = el.value.trim(); },
  impMapSel: el => { const m = UI.imp.src.mapping[+el.dataset.i]; m.key = el.value; m.how = 'you'; impRun(); },
});
function impReadFile(file) {
  if (!file) return;
  if (/\.xlsx$/i.test(file.name)) { // Excel: read in the browser
    file.arrayBuffer().then(readXlsx).then(rows => impPrepare(rows, file.name)).catch(e => toast('Couldn’t read this Excel file (' + e.message + ') — try saving it again, or as CSV'));
    return;
  }
  if (/\.xls$/i.test(file.name)) { toast('Old Excel (.xls) files can’t be read — in Excel use File → Save As → Excel Workbook (.xlsx)'); return; }
  if (!/\.csv$/i.test(file.name)) { toast('Please upload an Excel (.xlsx) or CSV file'); return; }
  const rd = new FileReader();
  rd.onload = () => impLoad(String(rd.result), file.name);
  rd.readAsText(file);
}
document.addEventListener('dragover', e => { const z = e.target.closest && e.target.closest('[data-filedrop]'); if (z) { e.preventDefault(); z.style.borderColor = 'var(--brand)'; } });
document.addEventListener('dragleave', e => { const z = e.target.closest && e.target.closest('[data-filedrop]'); if (z && !z.contains(e.relatedTarget)) z.style.borderColor = ''; });
document.addEventListener('drop', e => { const z = e.target.closest && e.target.closest('[data-filedrop]'); if (z) { e.preventDefault(); z.style.borderColor = ''; impReadFile(e.dataTransfer.files[0]); } });
