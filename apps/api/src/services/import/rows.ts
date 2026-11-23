import {
  AMENITIES,
  FACINGS,
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABEL,
  PropertyInput,
  TYPE_DETAILS,
  parseArea,
  parseMoney,
  propertyReadiness,
  suggestTitle,
  type AreaUnit,
  type PropertyType,
} from '@estate/shared';
import { detectType } from '../../ai/rules';
import { findDuplicates } from '../properties';
import type { Cell } from './sheet';
import type { ColumnMap } from './mapping';

export type RowResult = {
  status: 'ready' | 'draft' | 'duplicate' | 'error';
  issues: string[];
  values: Record<string, unknown> & { type?: PropertyType };
  availability?: 'available' | 'held' | 'booked' | 'sold';
  photoUrls: string[];
  duplicateOf?: { id: string; title: string };
};

const str = (v: Cell | undefined) => (v === null || v === undefined ? '' : String(v).trim());
const yes = (s: string) => (/^(y|yes|true|1|available|avl)$/i.test(s) ? true : /^(n|no|false|0)$/i.test(s) ? false : null);

const UNIT_WORDS: [RegExp, AreaUnit][] = [
  [/sq\.?\s*y|yard/i, 'sqyd'],
  [/sq\.?\s*m\b|sqm|met/i, 'sqm'],
  [/cent/i, 'cent'],
  [/ground/i, 'ground'],
  [/acre/i, 'acre'],
  [/sq|ft|feet|sft/i, 'sqft'],
];

function facing(s: string) {
  const short: Record<string, string> = { n: 'North', e: 'East', s: 'South', w: 'West', ne: 'North-East', nw: 'North-West', se: 'South-East', sw: 'South-West' };
  const k = s.toLowerCase().replace(/[^a-z]/g, '');
  if (short[k]) return short[k];
  const f = FACINGS.find((x) => x.toLowerCase().replace(/[^a-z]/g, '') === k.replace(/facing$/, ''));
  return f ?? null;
}

function typeFrom(s: string): PropertyType | null {
  if (!s) return null;
  const t = s.toLowerCase();
  const exact = PROPERTY_TYPES.find((p) => p === t || PROPERTY_TYPE_LABEL[p].toLowerCase() === t);
  return exact ?? detectType(t);
}

/** One sheet row → property values, with every problem described in plain words. */
export function buildRow(raw: Cell[], mapping: ColumnMap[], fixes: Record<string, unknown>, ctx: { defaultType?: string; defaultCity?: string; projects: { id: string; name: string }[] }): RowResult {
  const issues: string[] = [];
  const get = (field: string) => {
    if (field in fixes) return str(fixes[field] as Cell);
    const m = mapping.find((x) => x.field === field);
    return m ? str(raw[m.column]) : '';
  };
  const extras: { label: string; value: string; internal?: boolean }[] = [];
  for (const m of mapping) if (m.field === 'extra' && str(raw[m.column])) extras.push({ label: m.header.replace(/\*/g, '').trim(), value: str(raw[m.column]), internal: true });

  const title = get('title');
  const type = typeFrom(get('type')) ?? typeFrom(title) ?? ((ctx.defaultType as PropertyType) || null);
  if (!type) issues.push('Type is missing (add a Type column or choose a default type)');

  const purposeText = get('purpose').toLowerCase();
  const purpose = /rent/.test(purposeText) ? 'rent' : /lease/.test(purposeText) ? 'lease' : 'sale';

  const priceText = get('price');
  const price = priceText ? parseMoney(priceText) : null;
  if (priceText && !price) issues.push(`Price "${priceText}" is not a number`);
  if (price && purpose === 'sale' && price < 50_000) issues.push(`Price ₹${price.toLocaleString('en-IN')} looks too low for a sale; is it in lakhs?`);

  const unitText = get('areaUnit');
  let areaUnit: AreaUnit = 'sqft';
  for (const [rx, u] of UNIT_WORDS) if (rx.test(unitText)) {
    areaUnit = u;
    break;
  }
  const areaText = get('area');
  let area: number | null = null;
  if (areaText) {
    const a = parseArea(/^[\d.,\s]+$/.test(areaText) ? `${areaText} ${unitText}` : areaText);
    if (a) {
      area = a.value;
      areaUnit = /[a-z]/i.test(areaText) ? a.unit : areaUnit;
    } else issues.push(`Area "${areaText}" is not a number`);
  }

  const details: Record<string, string | number | boolean | null> = {};
  const dims = get('dimensions').match(/(\d+(?:\.\d+)?)\s*(?:ft)?\s*[x×*]\s*(\d+(?:\.\d+)?)/i);
  if (dims) {
    details.width = Number(dims[1]);
    details.length = Number(dims[2]);
  }
  const num = (field: string, key: string) => {
    const v = get(field);
    if (!v) return;
    const n = /^ground|^g$/i.test(v) ? 0 : Number(v.replace(/[^\d.]/g, ''));
    if (Number.isFinite(n) && v.replace(/[^\d.]/g, '') !== '') details[key] = n;
    else if (n === 0) details[key] = 0;
    else issues.push(`${key} "${v}" is not a number`);
  };
  num('bedrooms', 'bedrooms');
  num('bathrooms', 'bathrooms');
  num('floor', 'floor');
  num('totalFloors', 'totalFloors');
  num('length', 'length');
  num('width', 'width');
  num('roadWidth', 'roadWidth');
  num('landArea', 'landArea');
  num('powerKva', 'powerKva');
  if (get('facing')) {
    const f = facing(get('facing'));
    if (f) details.facing = f;
    else extras.push({ label: 'Facing', value: get('facing') });
  }
  if (get('furnishing')) details.furnishing = /semi/i.test(get('furnishing')) ? 'Semi-furnished' : /un|no/i.test(get('furnishing')) ? 'Unfurnished' : 'Fully furnished';
  for (const [field, key] of [
    ['cornerPlot', 'cornerPlot'],
    ['roadAccess', 'roadAccess'],
  ] as const) {
    const b = yes(get(field));
    if (b !== null) details[key] = b;
  }
  if (get('usage')) details.usage = get('usage');
  if (get('waterSource')) details.waterSource = get('waterSource').replace(/^\w/, (c) => c.toUpperCase());
  if (!details.bedrooms && /(\d)\s*bhk/i.test(title)) details.bedrooms = Number(title.match(/(\d)\s*bhk/i)![1]);
  // Owners often put the size and use in the title: "Plot 30x40", "Shop near bus stand".
  const titleDims = title.match(/(\d{2,3})\s*[x×*]\s*(\d{2,3})/);
  if (titleDims && !details.width && !details.length) {
    details.width = Number(titleDims[1]);
    details.length = Number(titleDims[2]);
  }
  if (!details.usage && (type === 'commercial' || type === 'industrial')) {
    const u = title.toLowerCase().match(/\b(shop|office|showroom|warehouse|hotel|factory|shed|godown)\b/)?.[1];
    const map: Record<string, string> =
      type === 'commercial'
        ? { shop: 'Retail / shop', office: 'Office', showroom: 'Showroom', warehouse: 'Warehouse', hotel: 'Hotel' }
        : { factory: 'Factory', warehouse: 'Warehouse', shed: 'Shed', godown: 'Warehouse' };
    if (u && map[u]) details.usage = map[u];
  }
  if (type === 'plot' && !area && details.length && details.width) {
    area = Number(details.length) * Number(details.width);
    areaUnit = 'sqft';
  }
  if (type === 'plot' && get('approval') && /dtcp|cmda|panchayat|unapproved/i.test(get('approval'))) details.approval = get('approval');

  // Keep only the details this type has; the rest are kept as extras so nothing is lost.
  const known = new Set((type ? TYPE_DETAILS[type] : []).map((f) => f.key));
  for (const [k, v] of Object.entries(details)) {
    if (!known.has(k)) {
      extras.push({ label: k, value: String(v) });
      delete details[k];
    }
  }

  const approvals: { name: string }[] = [];
  const appr = get('approval');
  if (appr) {
    for (const name of ['RERA', 'DTCP', 'CMDA']) if (new RegExp(name, 'i').test(appr)) approvals.push({ name });
    if (/^[A-Z]{2}\/\d+\//.test(appr)) {
      approvals.push({ name: 'RERA' });
      extras.push({ label: 'RERA number', value: appr });
    }
  }

  const amenities: string[] = [];
  for (const a of get('amenities').split(/[,;/|]+/).map((s) => s.trim()).filter(Boolean)) {
    const hit = AMENITIES.find((x) => x.toLowerCase() === a.toLowerCase() || x.toLowerCase().includes(a.toLowerCase()));
    if (hit) amenities.push(hit);
    else extras.push({ label: 'Amenity', value: a });
  }

  let projectId: string | null = null;
  const projectName = get('project');
  if (projectName) {
    const p = ctx.projects.find((x) => x.name.toLowerCase() === projectName.toLowerCase());
    if (p) projectId = p.id;
    else extras.push({ label: 'Project / layout', value: projectName });
  }

  const pin = get('pincode').replace(/\D/g, '');
  if (get('pincode') && pin.length !== 6) issues.push(`Pincode "${get('pincode')}" should have 6 digits`);

  const avText = get('availability').toLowerCase();
  const availability = /sold/.test(avText) ? 'sold' : /book/.test(avText) ? 'booked' : /hold|block/.test(avText) ? 'held' : 'available';

  const negotiable = yes(get('negotiable'));
  const photoUrls = get('photoUrl').split(/[\s,;]+/).filter((u) => /^https?:\/\//.test(u));

  const values: RowResult['values'] = {
    type: type ?? undefined,
    purpose,
    title: title || undefined,
    price,
    priceNegotiable: negotiable ?? undefined,
    area,
    areaUnit,
    city: get('city') || ctx.defaultCity || null,
    locality: get('locality') || null,
    address: get('address') || null,
    pincode: pin.length === 6 ? pin : null,
    projectId,
    block: get('block') || null,
    unitNumber: get('unitNumber') || null,
    details,
    extras,
    amenities,
    description: get('description') || null,
    approvals,
  };
  if (type && !values.title) values.title = suggestTitle({ type, purpose, locality: values.locality as string, city: values.city as string, details });
  // "2BHK Flat" says nothing on its own in a list of fifty; add where it is.
  else if (values.locality && title.length < 30 && !title.toLowerCase().includes(String(values.locality).toLowerCase())) values.title = `${title} in ${values.locality}`;

  if (type) {
    const parsed = PropertyInput.safeParse(values);
    if (!parsed.success) for (const i of parsed.error.issues) issues.push(`${i.path.join('.') || 'Row'}: ${i.message}`);
  }
  if (issues.length || !type) return { status: 'error', issues, values, availability, photoUrls };

  const r = propertyReadiness({ ...(values as Parameters<typeof propertyReadiness>[0]), type });
  return {
    status: r.ready ? 'ready' : 'draft',
    issues: r.ready ? [] : [`Missing ${r.missing.map((m) => m.label.toLowerCase()).join(', ')} — will be saved as a draft`],
    values,
    availability,
    photoUrls,
  };
}

/** Duplicates: against existing properties, and earlier rows of the same file. */
export async function markDuplicates(rows: (RowResult & { index: number })[]) {
  const seen = new Map<string, number>();
  for (const r of rows) {
    if (r.status === 'error' || !r.values.type) continue;
    const v = r.values;
    const key = v.unitNumber ? `${v.projectId ?? v.extras}|${v.block}|${v.unitNumber}` : `${v.type}|${String(v.locality).toLowerCase()}|${v.price}|${v.area}`;
    if (seen.has(key)) {
      r.status = 'duplicate';
      r.duplicateOf = { id: '', title: `Row ${seen.get(key)! + 1} of this file` };
      r.issues = ['Same as an earlier row in this file'];
      continue;
    }
    seen.set(key, r.index);
    const d = await findDuplicates(v as Parameters<typeof findDuplicates>[0]);
    if (d.length) {
      r.status = 'duplicate';
      r.duplicateOf = { id: d[0].id, title: d[0].title };
      r.issues = [`Looks like “${d[0].title}” already in the system`];
    }
  }
}
