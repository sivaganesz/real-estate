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

UI.imp = { type: 'plot', rows: null, file: '', fileNotes: [], filter: '', update: true, result: null };
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
function impValidate(objs, type) {
  const cols = impColumns(type), seen = {};
  return objs.map((obj, i) => {
    const line = i + 2; // header is line 1
    const r = { line, data: {}, errors: [], warnings: [], needs: [], notes: [], mode: 'new', existing: null, changes: [] };
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
    if (r.mode === 'update' && !r.errors.length) {
      cols.forEach(c => {
        if (c.k === 'property_id' || !d[c.k]) return;
        const cur = c.spec ? r.existing.specs[c.k] : getPath(r.existing, IMP_FIELD_MAP[c.k]);
        const nv = impValue(c, d[c.k]);
        if (JSON.stringify(cur ?? '') !== JSON.stringify(nv)) r.changes.push({ l: c.l, from: cur, to: nv });
      });
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

function impLoad(text, fileName) {
  const I = UI.imp, rows = parseCSV(text).filter(r => r.some(c => c.trim() !== ''));
  I.result = null; I.filter = ''; I.fileNotes = [];
  if (!rows.length) { toast('The file is empty'); return; }
  const header = rows[0].map(h => h.trim());
  const cols = impColumns(I.type), known = cols.map(c => c.k);
  if (!header.includes('property_id') && !header.includes('title')) { toast('This doesn’t look like an import template — download the template and try again'); return; }
  const unknown = header.filter(h => h && !known.includes(h));
  if (unknown.length) I.fileNotes.push(`Columns ignored (not in the ${typeLabel(I.type)} template): ${unknown.join(', ')}`);
  const missing = cols.filter(c => c.req && !header.includes(c.k));
  if (missing.length) I.fileNotes.push(`Columns not in this file: ${missing.map(c => c.k).join(', ')} — fine for update-only files; new rows without them are saved as drafts`);
  let data = rows.slice(1);
  if (data.length > IMP_MAX_ROWS) { I.fileNotes.push(`Only the first ${IMP_MAX_ROWS} rows were read`); data = data.slice(0, IMP_MAX_ROWS); }
  const objs = data.map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
  I.file = fileName; I.rows = impValidate(objs, I.type);
  render();
}

/* ---------- import ---------- */
function impApply() {
  const I = UI.imp; if (!DB.imports) DB.imports = [];
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
        specs, amenities: d.amenities ? impValue({ t: 'list' }, d.amenities) : [], approvals: impApprovals(d.approvals) }, { file: I.file, line: r.line, batch });
      drafts.push(res);
      return;
    }
    if (r.mode === 'new') {
      const specs = {};
      PROPERTY_TYPES[I.type].fields.forEach(f => { const c = cols.find(x => x.k === f.k); specs[f.k] = d[f.k] ? impValue(c, d[f.k]) : ''; });
      const p = {
        id: 'PROP-' + (++DB.counters.prop), title: d.title || r.suggestedTitle || typeLabel(I.type), type: I.type, purpose: d.purpose || 'Sale', status: d.status || 'Available', listingDate: d.listing_date || DEMO_TODAY,
        city: d.city, locality: d.locality, state: 'Tamil Nadu', facing: d.facing || '', area: impNum(d.area_sqft), price: impNum(d.asking_price),
        amenities: d.amenities ? impValue({ t: 'list' }, d.amenities) : [], images: 0, specs,
        location: (ll => ({ lat: ll ? impNum(d.latitude) : '', lng: ll ? impNum(d.longitude) : '', address: d.address || '', pincode: d.pincode || '', district: (CITIES[d.city] || {}).district || d.city, pinOk: ll, suggestPending: ll, roadType: '', roadWidth: '', nearby: [] }))(!!(d.latitude && d.longitude)),
        approvals: impApprovals(d.approvals).map(k => ({ k, status: 'pending', file: '', uploadedBy: '', uploadedAt: '', verifiedBy: '', verifiedAt: '' })), documents: [],
        valuation: { reviewDate: '', valuerReport: '', notes: '', comparables: [] }, history: [],
      };
      logHistory(p, `Created by bulk import ${batch} (${I.file}, line ${r.line})${d.title ? '' : ' — title suggested by the AI'}`);
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
      logHistory(p, `Updated by bulk import ${batch}: ${r.changes.map(x => x.l).join(', ')}`);
      updated.push(p.id);
    }
  });
  const rec = { id: batch, date: DEMO_TODAY, by: currentUser(), type: I.type, file: I.file, total: I.rows.length, created, updated, drafts, skipped: skipped.length, errors: I.rows.filter(r => r.errors.length).length };
  DB.imports.unshift(rec); save();
  I.result = rec; I.rows = null;
  toast(`${batch}: ${created.length} created, ${drafts.length} saved as drafts, ${updated.length} updated, ${skipped.length} skipped`);
  render();
}

/* ---------- view ---------- */
function viewImport() {
  const I = UI.imp, t = PROPERTY_TYPES[I.type];
  const step = I.result ? 3 : I.rows ? 2 : 0;
  const steps = ['Choose type & template', 'Upload file', 'Review & validate', 'Import complete'].map((s, i) => `<span class="${i === step || (step === 0 && i === 1) ? 'on' : i < step ? 'done' : ''}">${i + 1}. ${s}</span>`).join('');
  let body;
  if (I.result) body = impResultHtml(I.result);
  else if (I.rows) body = impReviewHtml();
  else body = impStartHtml(t);
  return {
    title: 'Bulk import', crumbs: 'Specification data / <b>Bulk import</b>',
    html: `
    <div class="page-head"><div><h1>Bulk import properties</h1><p>Add or update many properties at once from a CSV file. Every row is validated before anything is saved.</p></div><span class="sp"></span>
      <a class="btn" href="#/properties">← Properties</a></div>
    <div class="steps">${steps}</div>
    ${body}
    ${impHistoryHtml()}`,
  };
}

function impStartHtml(t) {
  const I = UI.imp, cols = impColumns(I.type);
  return `
  <div class="grid g2">
    <div class="card"><h2>1 · Choose property type</h2>
      <p class="muted" style="margin-top:-4px">Each type has its own template because the specification fields differ.</p>
      <div class="radio-cards" style="grid-template-columns:repeat(2,minmax(0,1fr))">${Object.entries(PROPERTY_TYPES).map(([k, v]) => `<label class="radio-card"><input type="radio" name="impType" value="${k}" ${k === I.type ? 'checked' : ''} data-chg="impType"><span><b>${v.label}</b><small>${v.category} · ${v.fields.length} specific fields</small></span></label>`).join('')}</div>
      <div class="row" style="margin-top:14px"><button class="btn primary" data-act="impTemplate">⤓ Download ${t.label} template</button><button class="btn" data-act="impSampleCsv">⤓ Sample file</button></div>
    </div>
    <div class="card"><h2>2 · Upload the completed file</h2>
      <label class="ph" data-filedrop style="height:150px;cursor:pointer;text-align:center;padding:12px">
        <input type="file" accept=".csv,text/csv" data-chg="impFile" style="display:none">
        <span>📄 <b>Drop a CSV file here</b> or click to browse<br><small>${t.label} template · up to ${IMP_MAX_ROWS} rows</small></span></label>
      <div class="row" style="margin-top:12px"><span class="muted">No file handy?</span><button class="btn sm" data-act="impUseSample">Try with sample data</button></div>
      <div class="note" style="margin-top:12px"><ul class="why" style="margin:0">
        <li>Leave <b>Property ID</b> blank for a new property. Fill it in to update an existing one — only the cells you fill in are changed.</li>
        <li><b>Nothing is lost:</b> a row missing a required detail is saved as a <b>draft</b>, and the AI assistant asks for what’s missing. A blank title is suggested by the AI.</li>
        <li>Approval badges can be listed (they start as “document pending”); documents are uploaded on the property page. The important nearby places are added automatically.</li>
        <li>Location distances, comparables and images are added on the property page afterwards.</li>
        <li>Excel users: save the sheet as CSV (UTF-8) before uploading.</li></ul></div>
    </div>
  </div>
  <div class="card"><div class="card-head"><h2>Template columns — ${t.label}</h2><span class="sp"></span><small>${cols.length} columns</small></div>
    <div class="tbl-wrap"><table><thead><tr><th>Column</th><th>Field</th><th>Required</th><th>Allowed values / format</th></tr></thead><tbody>
    ${cols.map(c => `<tr><td class="mono">${c.k}</td><td>${esc(c.l)}${c.spec ? ' ' + chip('type-specific', 'blue') : ''}</td><td>${c.req ? chip('Needed to publish', 'amber') : c.k === 'title' ? '<small class="muted">AI suggests if blank</small>' : '<small class="muted">Optional</small>'}</td>
      <td><small>${c.t === 'select' ? esc(c.o.join(' / ')) : c.t === 'number' ? 'Number' : c.t === 'date' ? 'YYYY-MM-DD' : c.t === 'month' ? 'YYYY-MM' : c.t === 'list' || c.t === 'approvals' ? 'List, separated by ;' : 'Text'}${c.hint ? ' · ' + esc(c.hint) : ''}</small></td></tr>`).join('')}
    </tbody></table></div></div>`;
}

function impReviewHtml() {
  const I = UI.imp, rows = I.rows;
  const count = s => rows.filter(r => impStatus(r) === s).length;
  const nNew = count('new'), nDraft = count('draft'), nUpd = count('update'), nErr = count('error'), nSame = count('nochange'), nWarn = rows.filter(r => !r.errors.length && r.warnings.length).length;
  const willImport = rows.filter(impWillImport).length;
  const ST = { new: ['New', 'green'], draft: ['Draft', 'amber'], update: ['Update', 'blue'], nochange: ['No change', ''], error: ['Error', 'red'] };
  const shown = rows.filter(r => !I.filter || (I.filter === 'warning' ? !r.errors.length && r.warnings.length : impStatus(r) === I.filter));
  const trs = shown.map(r => {
    const s = impStatus(r), d = r.data, p = r.existing;
    const issues = [...r.errors.map(e => `<li style="color:var(--red)">✗ ${esc(e)}</li>`), ...(r.errors.length ? [] : r.needs.length ? [`<li style="color:var(--amber)">✎ Saved as a draft — the AI will ask for: <b>${esc(r.needs.join(', '))}</b></li>`] : []), ...r.warnings.map(w => `<li style="color:var(--amber)">⚠ ${esc(w)}</li>`), ...r.notes.map(n => `<li class="muted">✨ ${esc(n)}</li>`),
      ...r.changes.map(c => `<li>${esc(c.l)}: <s class="muted">${esc(Array.isArray(c.from) ? c.from.join('; ') : c.from ?? '—')}</s> → <b>${esc(Array.isArray(c.to) ? c.to.join('; ') : c.to)}</b></li>`)].join('');
    return `<tr>
      <td class="num mono">${r.line}</td><td>${chip(ST[s][0], ST[s][1])}${s === 'update' && !I.update ? '<br><small class="muted">skipped</small>' : ''}</td>
      <td class="mono">${p ? `<a href="#/properties/${p.id}">${p.id}</a>` : esc(d.property_id) || '<small class="muted">auto</small>'}</td>
      <td><b>${esc(d.title || (p && p.title) || r.suggestedTitle || '—')}</b>${!d.title && r.suggestedTitle ? ' <small class="srcmini s-ai">✨ AI</small>' : ''}<br><small>${esc(d.locality || (p && p.locality) || '')}${d.city || p ? ', ' + esc(d.city || p.city) : ''}</small></td>
      <td class="num">${d.area_sqft ? esc(d.area_sqft) : p ? `<small class="muted">${num(p.area)}</small>` : '—'}</td>
      <td class="num">${d.asking_price && !isNaN(impNum(d.asking_price)) ? inrShort(impNum(d.asking_price)) : esc(d.asking_price) || (p ? `<small class="muted">${inrShort(p.price)}</small>` : '—')}</td>
      <td>${issues ? `<ul class="why" style="margin:0">${issues}</ul>` : '<small class="muted">Ready</small>'}</td></tr>`;
  }).join('');
  return `
  <div class="card"><div class="card-head"><h2>Review — ${esc(I.file)}</h2>${chip(typeLabel(I.type), 'blue')}<span class="sp"></span><button class="btn sm" data-act="impReset">Choose another file</button></div>
    ${I.fileNotes.map(n => `<div class="note amber" style="margin-bottom:8px">${esc(n)}</div>`).join('')}
    <div class="grid g5" style="margin-bottom:12px">
      <div class="card kpi"><div class="lbl">Rows in file</div><div class="val">${rows.length}</div></div>
      <div class="card kpi"><div class="lbl">New properties</div><div class="val" style="color:var(--green)">${nNew}</div><div class="sub">ready to publish</div></div>
      <div class="card kpi"><div class="lbl">Saved as drafts</div><div class="val" style="color:var(--amber)">${nDraft}</div><div class="sub">the AI asks for what’s missing</div></div>
      <div class="card kpi"><div class="lbl">Updates to existing</div><div class="val" style="color:var(--blue)">${nUpd}</div><div class="sub">${nSame ? nSame + ' row(s) with no change' : ''}</div></div>
      <div class="card kpi"><div class="lbl">Rows with errors</div><div class="val" style="color:var(--red)">${nErr}</div><div class="sub">${nWarn} with warnings</div></div>
    </div>
    <div class="filters">
      <select data-chg="impFilter" style="width:auto">${options([{ v: 'new', l: 'New only' }, { v: 'draft', l: 'Drafts only' }, { v: 'update', l: 'Updates only' }, { v: 'error', l: 'Errors only' }, { v: 'warning', l: 'Warnings only' }, { v: 'nochange', l: 'No change' }], I.filter, `All rows (${rows.length})`)}</select>
      <label class="check"><input type="checkbox" data-chg="impUpdate" ${I.update ? 'checked' : ''}> Update existing properties matched by Property ID</label>
    </div>
    <div class="tbl-wrap"><table><thead><tr><th class="num">Line</th><th>Result</th><th>Property ID</th><th>Property</th><th class="num">Area</th><th class="num">Price</th><th>Validation / changes</th></tr></thead>
      <tbody>${trs || '<tr><td colspan="7" class="empty">No rows for this filter.</td></tr>'}</tbody></table></div>
    <div class="row" style="margin-top:14px">
      ${nErr ? `<button class="btn" data-act="impErrors">⤓ Download error report (${nErr})</button><span class="muted">Rows with errors (wrong values or unknown IDs) are skipped — fix and upload them again.</span>` : ''}
      <span class="sp"></span><button class="btn" data-act="impReset">Cancel</button>
      <button class="btn primary" data-act="impApply" ${willImport ? '' : 'disabled'}>Import ${willImport} row${willImport === 1 ? '' : 's'}</button></div>
  </div>`;
}

function impResultHtml(r) {
  const link = id => `<a href="#/properties/${id}" class="mono">${id}</a>`;
  return `
  <div class="card"><div class="card-head"><h2>✅ Import ${r.id} complete</h2><span class="sp"></span><button class="btn primary" data-act="impReset">Import another file</button></div>
    <div class="grid g4" style="margin-bottom:12px">
      <div class="card kpi"><div class="lbl">Created</div><div class="val" style="color:var(--green)">${r.created.length}</div></div>
      <div class="card kpi"><div class="lbl">Saved as drafts</div><div class="val" style="color:var(--amber)">${(r.drafts || []).length}</div></div>
      <div class="card kpi"><div class="lbl">Updated</div><div class="val" style="color:var(--blue)">${r.updated.length}</div></div>
      <div class="card kpi"><div class="lbl">Skipped</div><div class="val">${r.skipped}</div><div class="sub">${r.errors} with errors</div></div>
    </div>
    ${r.created.length ? `<p><b>New properties:</b> ${r.created.map(link).join(', ')}</p>` : ''}
    ${r.updated.length ? `<p><b>Updated:</b> ${r.updated.map(link).join(', ')}</p>` : ''}
    ${(r.drafts || []).length ? `<div class="note"><b>Drafts to finish</b> — open each one and the AI asks for what’s missing:<ul class="why" style="margin:6px 0 0">${r.drafts.map(x => `<li><a class="mono" href="#/properties/draft/${x.id}">${x.id}</a> — needs ${esc(x.missing.join(', ') || 'nothing')}</li>`).join('')}</ul><a class="btn sm" style="margin-top:8px" href="#/properties/drafts">Open Drafts</a></div>` : ''}
    ${r.created.length ? '<div class="note amber">Next: open each new property and add photos, approval badges and documents (all optional) and check the pricing. The important nearby places are already shown.</div>' : ''}
  </div>`;
}

function impHistoryHtml() {
  const list = DB.imports || [];
  if (!list.length) return '';
  return `<div class="card" style="margin-top:14px"><h2>Import history</h2>
    <div class="tbl-wrap"><table><thead><tr><th>Batch</th><th>Date</th><th>By</th><th>Type</th><th>File</th><th class="num">Rows</th><th class="num">Created</th><th class="num">Drafts</th><th class="num">Updated</th><th class="num">Skipped</th></tr></thead><tbody>
    ${list.map(b => `<tr><td class="mono">${b.id}</td><td>${fmtDate(b.date)}</td><td><small>${esc(b.by)}</small></td><td>${typeLabel(b.type)}</td><td><small>${esc(b.file)}</small></td><td class="num">${b.total}</td><td class="num">${b.created.length}</td><td class="num">${(b.drafts || []).length}</td><td class="num">${b.updated.length}</td><td class="num">${b.skipped}</td></tr>`).join('')}
    </tbody></table></div></div>`;
}

/* ---------- events ---------- */
Object.assign(ACTIONS, {
  impTemplate: () => { const cols = impColumns(UI.imp.type); downloadFile(`property-import-template-${UI.imp.type}.csv`, toCSV([cols.map(c => c.k)])); toast('Template downloaded'); },
  impSampleCsv: () => { const cols = impColumns(UI.imp.type); downloadFile(`property-import-sample-${UI.imp.type}.csv`, toCSV([cols.map(c => c.k), ...impSample(UI.imp.type).map(o => cols.map(c => o[c.k] ?? ''))])); },
  impUseSample: () => { const cols = impColumns(UI.imp.type); impLoad(toCSV([cols.map(c => c.k), ...impSample(UI.imp.type).map(o => cols.map(c => o[c.k] ?? ''))]), `sample-${UI.imp.type}.csv`); },
  impReset: () => { Object.assign(UI.imp, { rows: null, file: '', fileNotes: [], filter: '', result: null }); render(); },
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
});
function impReadFile(file) {
  if (!file) return;
  if (!/\.csv$/i.test(file.name)) { toast('Please upload a .csv file (in Excel: File → Save As → CSV UTF-8)'); return; }
  const rd = new FileReader();
  rd.onload = () => impLoad(String(rd.result), file.name);
  rd.readAsText(file);
}
document.addEventListener('dragover', e => { const z = e.target.closest && e.target.closest('[data-filedrop]'); if (z) { e.preventDefault(); z.style.borderColor = 'var(--brand)'; } });
document.addEventListener('dragleave', e => { const z = e.target.closest && e.target.closest('[data-filedrop]'); if (z && !z.contains(e.relatedTarget)) z.style.borderColor = ''; });
document.addEventListener('drop', e => { const z = e.target.closest && e.target.closest('[data-filedrop]'); if (z) { e.preventDefault(); z.style.borderColor = ''; impReadFile(e.dataTransfer.files[0]); } });
