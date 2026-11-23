import { z } from 'zod';
import { AiUnavailable, aiJson, gemini } from '../../ai/client';
import { ImportFormat } from '../../models/importBatch';
import type { Cell } from './sheet';

/** Every field a column can fill. `extra` keeps the column as an internal detail; `ignore` drops it. */
export const IMPORT_FIELDS = [
  { key: 'title', label: 'Title', template: 'Title', synonyms: ['title', 'property name', 'property', 'name', 'listing', 'description short', 'project name'] },
  { key: 'type', label: 'Type', template: 'Type', synonyms: ['type', 'property type', 'category', 'kind', 'sub category', 'subcategory'] },
  { key: 'purpose', label: 'For (sale/rent/lease)', template: 'For', synonyms: ['purpose', 'for', 'sale/rent', 'transaction', 'listing type', 'deal type'] },
  { key: 'price', label: 'Price', template: 'Price', synonyms: ['price', 'price (₹)', 'rate', 'amount', 'cost', 'value', 'total price', 'asking price', 'expected price', 'rent', 'monthly rent', 'quote'] },
  { key: 'area', label: 'Area', template: 'Area', synonyms: ['area', 'size', 'plot size', 'plot area', 'built up area', 'built-up area', 'bua', 'sba', 'super built up', 'carpet area', 'sq ft', 'sqft', 'extent', 'land area', 'saleable area'] },
  { key: 'areaUnit', label: 'Area unit', template: 'Area unit', synonyms: ['area unit', 'unit of area', 'uom', 'measure'] },
  { key: 'city', label: 'City', template: 'City', synonyms: ['city', 'town', 'district'] },
  { key: 'locality', label: 'Locality', template: 'Locality', synonyms: ['locality', 'location', 'area / locality', 'area/locality', 'place', 'zone', 'neighbourhood', 'neighborhood', 'village', 'suburb'] },
  { key: 'address', label: 'Address', template: 'Address', synonyms: ['address', 'full address', 'street', 'door no'] },
  { key: 'pincode', label: 'Pincode', template: 'Pincode', synonyms: ['pincode', 'pin code', 'pin', 'zip', 'postal code'] },
  { key: 'project', label: 'Project', template: 'Project', synonyms: ['project', 'layout name', 'layout', 'community', 'society', 'building name', 'venture'] },
  { key: 'block', label: 'Block / tower', template: 'Block', synonyms: ['block', 'tower', 'wing', 'phase'] },
  { key: 'unitNumber', label: 'Unit / plot no.', template: 'Unit no', synonyms: ['unit no', 'unit number', 'unit', 'flat no', 'flat number', 'plot no', 'plot number', 'villa no', 'door number', 'survey no', 'survey number'] },
  { key: 'bedrooms', label: 'Bedrooms (BHK)', template: 'BHK', synonyms: ['bhk', 'bedrooms', 'beds', 'bed', 'configuration', 'config', 'unit type', 'no of bedrooms'] },
  { key: 'bathrooms', label: 'Bathrooms', template: 'Bathrooms', synonyms: ['bathrooms', 'baths', 'bath', 'toilets'] },
  { key: 'floor', label: 'Floor', template: 'Floor', synonyms: ['floor', 'floor no', 'floor number', 'level'] },
  { key: 'totalFloors', label: 'Total floors', template: 'Total floors', synonyms: ['total floors', 'floors', 'no of floors', 'building floors'] },
  { key: 'facing', label: 'Facing', template: 'Facing', synonyms: ['facing', 'direction', 'orientation'] },
  { key: 'furnishing', label: 'Furnishing', template: 'Furnishing', synonyms: ['furnishing', 'furnished', 'furnish status'] },
  { key: 'dimensions', label: 'Dimensions (e.g. 30x40)', template: 'Dimensions', synonyms: ['dimension', 'dimensions', 'plot dimensions', 'size (ft)', 'l x b', 'lxb'] },
  { key: 'length', label: 'Length (ft)', template: 'Length', synonyms: ['length', 'depth'] },
  { key: 'width', label: 'Width (ft)', template: 'Width', synonyms: ['width', 'breadth', 'frontage width'] },
  { key: 'roadWidth', label: 'Road width (ft)', template: 'Road width', synonyms: ['road width', 'road width (ft)', 'road', 'approach road'] },
  { key: 'cornerPlot', label: 'Corner plot', template: 'Corner plot', synonyms: ['corner plot', 'corner'] },
  { key: 'landArea', label: 'Land area (sq.ft)', template: 'Land area', synonyms: ['land area', 'uds', 'undivided share', 'plot area of villa'] },
  { key: 'usage', label: 'Usage', template: 'Usage', synonyms: ['usage', 'use', 'commercial type'] },
  { key: 'waterSource', label: 'Water source', template: 'Water source', synonyms: ['water', 'water source', 'water facility'] },
  { key: 'roadAccess', label: 'Road access', template: 'Road access', synonyms: ['road access', 'road facing'] },
  { key: 'powerKva', label: 'Power (kVA)', template: 'Power kVA', synonyms: ['power', 'power kva', 'kva', 'electricity load', 'power load'] },
  { key: 'approval', label: 'Approval', template: 'Approval', synonyms: ['approval', 'approval type', 'approved by', 'dtcp', 'cmda', 'rera', 'rera no', 'rera number'] },
  { key: 'amenities', label: 'Amenities', template: 'Amenities', synonyms: ['amenities', 'features', 'facilities'] },
  { key: 'description', label: 'Description', template: 'Description', synonyms: ['description', 'details', 'about', 'notes for buyer'] },
  { key: 'negotiable', label: 'Negotiable', template: 'Negotiable', synonyms: ['negotiable', 'nego'] },
  { key: 'availability', label: 'Availability', template: 'Availability', synonyms: ['status', 'availability', 'available', 'sold/unsold'] },
  { key: 'photoUrl', label: 'Photo URL', template: 'Photo URL', synonyms: ['photo', 'photo url', 'image', 'image url', 'photos', 'image urls'] },
  { key: 'extra', label: 'Keep as an internal detail', template: '', synonyms: [] },
  { key: 'ignore', label: 'Ignore this column', template: '', synonyms: ['s.no', 'sno', 'sl no', 'sl.no', 'serial', '#', 'sr no', 'sr. no'] },
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number]['key'];
export const TEMPLATE_HEADERS = IMPORT_FIELDS.filter((f) => f.template).map((f) => f.template);

export type ColumnMap = { column: number; header: string; field: ImportField; how: 'template' | 'saved' | 'rule' | 'ai' | 'none' | 'manual'; confidence: 'high' | 'check'; samples: string[] };

const norm = (s: string) => s.toLowerCase().replace(/\*/g, '').replace(/\(.*?\)/g, (m) => (/₹|ft|sq/.test(m) ? m : '')).replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();

export const headersKey = (headers: string[]) => headers.map(norm).sort().join('|');

/**
 * Columns are matched cheapest first:
 * 1. our template's own headings, 2. this sender's saved layout,
 * 3. synonyms plus a look at the values, 4. the AI, only for what's left.
 */
export async function mapColumns(headers: string[], rows: Cell[][], sender?: string): Promise<{ mapping: ColumnMap[]; aiUsed: boolean; savedFormat: boolean }> {
  const samples = (i: number) => rows.map((r) => r[i]).filter((v) => v !== null && v !== '').slice(0, 3).map(String);
  const mapping: ColumnMap[] = headers.map((h, i) => ({ column: i, header: h, field: 'extra', how: 'none', confidence: 'check', samples: samples(i) }));
  const used = new Set<string>();
  const claim = (m: ColumnMap, field: ImportField, how: ColumnMap['how'], confidence: ColumnMap['confidence']) => {
    if (field !== 'extra' && field !== 'ignore' && used.has(field)) return false;
    m.field = field;
    m.how = how;
    m.confidence = confidence;
    if (field !== 'extra' && field !== 'ignore') used.add(field);
    return true;
  };

  // 1. Template
  for (const m of mapping) {
    const t = IMPORT_FIELDS.find((f) => f.template && norm(f.template) === norm(m.header));
    if (t) claim(m, t.key, 'template', 'high');
  }

  // 2. Saved format for this sender
  let savedFormat = false;
  if (sender) {
    const fmt = await ImportFormat.findOne({ sender: sender.trim().toLowerCase(), headersKey: headersKey(headers) }).lean();
    if (fmt) {
      savedFormat = true;
      for (const m of mapping) {
        if (m.how !== 'none') continue;
        const s = fmt.mapping.find((x) => norm(x.header ?? '') === norm(m.header));
        if (s?.field) claim(m, s.field as ImportField, 'saved', 'high');
      }
    }
  }

  // 3. Rules: synonyms, then the values decide ambiguous headings
  for (const m of mapping) {
    if (m.how !== 'none') continue;
    const h = norm(m.header);
    const numeric = m.samples.length > 0 && m.samples.every((s) => /^[\d.,\s]+(sq\.?\s*ft|sqft|sft|cents?|acres?|grounds?|l|lakhs?|cr|crores?)?$/i.test(s.trim()));
    if (h === 'area' || h === 'area name') {
      claim(m, numeric ? 'area' : 'locality', 'rule', 'high');
      continue;
    }
    if (m.samples.some((s) => /^\d{2,3}\s*[x×*]\s*\d{2,3}/i.test(s)) && /size|dimension|plot/.test(h)) {
      if (claim(m, 'dimensions', 'rule', 'high')) continue;
    }
    const exact = IMPORT_FIELDS.find((f) => (f.synonyms as readonly string[]).some((s) => norm(s) === h));
    if (exact && claim(m, exact.key, 'rule', 'high')) continue;
    const partial = IMPORT_FIELDS.find((f) => (f.synonyms as readonly string[]).map(norm).some((s) => s.length > 3 && (h.startsWith(s) || h.endsWith(s))));
    if (partial && claim(m, partial.key, 'rule', 'check')) continue;
  }

  // 4. AI for the rest
  let aiUsed = false;
  const unknown = mapping.filter((m) => m.how === 'none');
  if (unknown.length && gemini()) {
    try {
      const fields = IMPORT_FIELDS.filter((f) => !used.has(f.key)).map((f) => `${f.key}: ${f.label}`);
      const Out = z.object({ columns: z.array(z.object({ column: z.number(), field: z.string(), confidence: z.enum(['high', 'check']) })) });
      const res = await aiJson(Out, [
        {
          text: `A real-estate property spreadsheet has these columns we could not match. For each, pick the best field key, or "extra" if it is a useful fact that fits no field, or "ignore" if it is a serial number or empty.\n\nFields:\n${fields.join('\n')}\n\nColumns (index, heading, sample values):\n${unknown.map((m) => `${m.column}: "${m.header}" → ${m.samples.join(' | ') || '(empty)'}`).join('\n')}`,
        },
      ]);
      for (const c of res.columns) {
        const m = mapping.find((x) => x.column === c.column);
        const f = IMPORT_FIELDS.find((x) => x.key === c.field);
        if (m && f && m.how === 'none') claim(m, f.key, 'ai', c.confidence);
      }
      aiUsed = true;
    } catch (err) {
      if (!(err instanceof AiUnavailable)) throw err;
      // The AI step is optional: unmatched columns stay as extra details.
    }
  }
  for (const m of mapping) if (m.how === 'none' && !m.samples.length) m.field = 'ignore';
  return { mapping, aiUsed, savedFormat };
}

export async function rememberFormat(sender: string, headers: string[], mapping: ColumnMap[]) {
  const key = headersKey(headers);
  await ImportFormat.findOneAndUpdate(
    { sender: sender.trim().toLowerCase(), headersKey: key },
    { $set: { mapping: mapping.map((m) => ({ header: m.header, field: m.field })) }, $inc: { uses: 1 } },
    { upsert: true },
  );
}
