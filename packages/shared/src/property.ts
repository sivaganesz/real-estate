import { z } from 'zod';
import { AREA_UNITS } from './format';

export const PROPERTY_TYPES = ['apartment', 'villa', 'plot', 'commercial', 'agricultural', 'industrial'] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
  apartment: 'Apartment',
  villa: 'Villa / House',
  plot: 'Plot',
  commercial: 'Commercial',
  agricultural: 'Agricultural land',
  industrial: 'Industrial',
};

export const PURPOSES = ['sale', 'rent', 'lease'] as const;
export type Purpose = (typeof PURPOSES)[number];

/**
 * Two separate questions, two fields:
 *  - listing:      can the team, the AI and buyers see/offer it?  draft → live → archived
 *  - availability: can it still be sold?                          available → held → booked → sold
 * The old single "status" mixed both (a property could not be "live" and "held").
 * No separate review state: only managers and admins load properties and both may publish.
 */
export const LISTING_STATES = ['draft', 'live', 'archived'] as const;
export type ListingState = (typeof LISTING_STATES)[number];
export const LISTING_LABEL: Record<ListingState, string> = {
  draft: 'Draft',
  live: 'Live',
  archived: 'Archived',
};

export const AVAILABILITY = ['available', 'held', 'booked', 'sold'] as const;
export type Availability = (typeof AVAILABILITY)[number];
export const AVAILABILITY_LABEL: Record<Availability, string> = {
  available: 'Available',
  held: 'On hold',
  booked: 'Booked',
  sold: 'Sold',
};

/** The broad group a type belongs to, shown next to the type ("Plot · Residential"). */
export const PROPERTY_CATEGORY: Record<PropertyType, string> = {
  apartment: 'Residential',
  villa: 'Residential',
  plot: 'Residential',
  commercial: 'Commercial',
  agricultural: 'Land',
  industrial: 'Industrial',
};

export const FACINGS = ['North', 'East', 'South', 'West', 'North-East', 'North-West', 'South-East', 'South-West'] as const;
export const FURNISHING = ['Unfurnished', 'Semi-furnished', 'Fully furnished'] as const;
// Option lists from the approved property catalogue v2 (wireframe).
const WATER_SUPPLY = ['Municipal supply', 'Borewell', 'Municipal + borewell', 'Tanker dependent', 'Not available'] as const;
const TOPOGRAPHY = ['Level', 'Gentle slope', 'Elevated', 'Low-lying'] as const;

export const AMENITIES = [
  'Car parking', 'Lift', 'Power backup', 'Security', 'CCTV', 'Gym', 'Swimming pool', 'Clubhouse',
  "Children's play area", 'Garden', 'Gated community', 'Rainwater harvesting', 'Borewell', 'Corporation water',
  'Solar', 'Intercom', 'Visitor parking', 'EV charging',
] as const;

/**
 * Details that matter per type. `required` ones (max 2) must be known before a
 * property can go live; the rest are asked for gently on the property's to-do list.
 */
export type DetailField = {
  key: string;
  label: string;
  kind: 'number' | 'text' | 'select' | 'boolean';
  unit?: string;
  options?: readonly string[];
  required?: boolean;
};

export const TYPE_DETAILS: Record<PropertyType, DetailField[]> = {
  apartment: [
    { key: 'bedrooms', label: 'Bedrooms (BHK)', kind: 'number', required: true },
    { key: 'floor', label: 'Floor', kind: 'number', required: true },
    { key: 'totalFloors', label: 'Total floors', kind: 'number' },
    { key: 'bathrooms', label: 'Bathrooms', kind: 'number' },
    { key: 'facing', label: 'Facing', kind: 'select', options: FACINGS },
    { key: 'furnishing', label: 'Furnishing', kind: 'select', options: FURNISHING },
    { key: 'parking', label: 'Car parks', kind: 'number' },
    { key: 'carpetArea', label: 'Carpet area', kind: 'number', unit: 'sq.ft' },
    { key: 'superBuiltUpArea', label: 'Super built-up area', kind: 'number', unit: 'sq.ft' },
    { key: 'uds', label: 'UDS (undivided share of land)', kind: 'number', unit: 'sq.ft' },
    { key: 'lifts', label: 'Lifts', kind: 'number' },
    { key: 'maintenance', label: 'Maintenance', kind: 'number', unit: '₹/month' },
    { key: 'possession', label: 'Possession', kind: 'select', options: ['Ready to move', 'Under construction'] },
    { key: 'expectedPossession', label: 'Expected possession', kind: 'text' },
  ],
  villa: [
    { key: 'bedrooms', label: 'Bedrooms', kind: 'number', required: true },
    { key: 'landArea', label: 'Land area', kind: 'number', unit: 'sq.ft', required: true },
    { key: 'bathrooms', label: 'Bathrooms', kind: 'number' },
    { key: 'floors', label: 'Floors', kind: 'number' },
    { key: 'facing', label: 'Facing', kind: 'select', options: FACINGS },
    { key: 'furnishing', label: 'Furnishing', kind: 'select', options: FURNISHING },
    { key: 'parking', label: 'Car parks', kind: 'number' },
    { key: 'houseType', label: 'House or villa', kind: 'select', options: ['Independent house', 'Villa (gated community)', 'Row house'] },
    { key: 'constructionYear', label: 'Built in (year)', kind: 'number' },
    { key: 'constructionQuality', label: 'Construction quality', kind: 'select', options: ['Premium', 'Standard', 'Basic'] },
    { key: 'condition', label: 'Condition', kind: 'select', options: ['New', 'Good', 'Needs minor repair', 'Needs major repair'] },
    { key: 'waterSupply', label: 'Water supply', kind: 'select', options: WATER_SUPPLY },
    { key: 'powerArrangement', label: 'Power', kind: 'select', options: ['EB connection', 'EB + inverter', 'EB + generator backup', 'EB + solar'] },
    { key: 'garden', label: 'Garden / open space', kind: 'text' },
  ],
  plot: [
    { key: 'length', label: 'Length', kind: 'number', unit: 'ft', required: true },
    { key: 'width', label: 'Width', kind: 'number', unit: 'ft', required: true },
    { key: 'facing', label: 'Facing', kind: 'select', options: FACINGS },
    { key: 'roadWidth', label: 'Road width', kind: 'number', unit: 'ft' },
    { key: 'roadType', label: 'Road access', kind: 'select', options: ['Public road', 'Layout road', 'Private / pathway access'] },
    { key: 'roadSurface', label: 'Road surface', kind: 'select', options: ['Tar road', 'Concrete road', 'Gravel road', 'Mud road'] },
    { key: 'cornerPlot', label: 'Corner plot', kind: 'boolean' },
    { key: 'topography', label: 'Topography', kind: 'select', options: TOPOGRAPHY },
    { key: 'surveyNumber', label: 'Survey number', kind: 'text' },
    { key: 'subdivision', label: 'Subdivision', kind: 'text' },
    { key: 'approval', label: 'Layout approval (DTCP / CMDA)', kind: 'text' },
    { key: 'landUse', label: 'Land use', kind: 'select', options: ['Residential', 'Mixed residential', 'Commercial', 'Agricultural (conversion required)'] },
    { key: 'waterSupply', label: 'Water supply', kind: 'select', options: WATER_SUPPLY },
    { key: 'powerSupply', label: 'Electricity', kind: 'select', options: ['Available at site', 'Line nearby, connection to apply', 'Not available'] },
    { key: 'drainage', label: 'Drainage', kind: 'select', options: ['Underground drainage', 'Open drain', 'Not available'] },
  ],
  commercial: [
    { key: 'usage', label: 'Usage', kind: 'select', options: ['Office', 'Retail / shop', 'Showroom', 'Warehouse', 'Hotel', 'Other'], required: true },
    { key: 'floor', label: 'Floor', kind: 'number', required: true },
    { key: 'washrooms', label: 'Washrooms', kind: 'number' },
    { key: 'frontage', label: 'Frontage', kind: 'number', unit: 'ft' },
    { key: 'furnishing', label: 'Furnishing', kind: 'select', options: FURNISHING },
    { key: 'parking', label: 'Car parks', kind: 'number' },
    { key: 'facing', label: 'Facing', kind: 'select', options: FACINGS },
    { key: 'occupancy', label: 'Occupancy', kind: 'select', options: ['Vacant', 'Tenanted', 'Owner-occupied'] },
    { key: 'rentalIncome', label: 'Rental income', kind: 'number', unit: '₹/month' },
    { key: 'maintenance', label: 'Maintenance', kind: 'number', unit: '₹/month' },
    { key: 'leaseDuration', label: 'Lease duration', kind: 'text' },
  ],
  agricultural: [
    { key: 'waterSource', label: 'Water source', kind: 'select', options: ['Borewell', 'Open well', 'Canal', 'River', 'None'], required: true },
    { key: 'roadAccess', label: 'Road access', kind: 'boolean', required: true },
    { key: 'soilType', label: 'Soil type', kind: 'text' },
    { key: 'electricity', label: 'Electricity (EB)', kind: 'boolean' },
    { key: 'fencing', label: 'Fencing', kind: 'boolean' },
    { key: 'surveyNumber', label: 'Survey number', kind: 'text' },
    { key: 'topography', label: 'Topography', kind: 'select', options: TOPOGRAPHY },
  ],
  industrial: [
    { key: 'usage', label: 'Usage', kind: 'select', options: ['Factory', 'Warehouse', 'Shed', 'Land'], required: true },
    { key: 'powerKva', label: 'Power', kind: 'number', unit: 'kVA', required: true },
    { key: 'roadWidth', label: 'Road width', kind: 'number', unit: 'ft' },
    { key: 'clearHeight', label: 'Clear height', kind: 'number', unit: 'ft' },
    { key: 'truckAccess', label: 'Truck access', kind: 'boolean' },
    { key: 'surveyNumber', label: 'Survey number', kind: 'text' },
  ],
};

/** A detail as people read it: "Yes", "30 ft", "₹4,500/month", "1,650 sq.ft". */
export function detailValue(field: Pick<DetailField, 'unit'>, v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  const text = typeof v === 'number' && v >= 10_000 ? v.toLocaleString('en-IN') : String(v);
  if (!field.unit) return text;
  // Money units read as "₹4,500/month", not "4500 ₹/month".
  if (field.unit.startsWith('₹')) return `₹${typeof v === 'number' ? v.toLocaleString('en-IN') : v}${field.unit.slice(1)}`;
  return `${text} ${field.unit}`;
}

export const PropertyInput = z.object({
  title: z.string().trim().min(3).max(140).optional(),
  type: z.enum(PROPERTY_TYPES),
  purpose: z.enum(PURPOSES).default('sale'),
  projectId: z.string().nullish(),
  block: z.string().trim().max(40).nullish(),
  unitNumber: z.string().trim().max(40).nullish(),
  price: z.number().positive().nullish(),
  priceNegotiable: z.boolean().optional(),
  area: z.number().positive().nullish(),
  areaUnit: z.enum(AREA_UNITS).default('sqft'),
  city: z.string().trim().max(80).nullish(),
  locality: z.string().trim().max(120).nullish(),
  address: z.string().trim().max(300).nullish(),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Pincode has 6 digits').nullish().or(z.literal('')),
  details: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
  extras: z.array(z.object({ label: z.string().min(1), value: z.string().min(1), internal: z.boolean().optional() })).default([]),
  amenities: z.array(z.string()).default([]),
  description: z.string().max(4000).nullish(),
  highlights: z.array(z.string().max(160)).max(8).default([]),
  approvals: z.array(z.object({ name: z.string().trim().min(1).max(60), documentUrl: z.string().nullish(), verified: z.boolean().optional() })).default([]),
  /** The exact spot, when someone has set it; otherwise maps use the locality. */
  location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).nullish(),
  sources: z.record(z.string()).optional(),
});
export type PropertyInput = z.infer<typeof PropertyInput>;

export type Readiness = { ready: boolean; missing: { key: string; label: string }[]; suggestions: { key: string; label: string }[] };

/** What a property still needs before it can go live, and what would make it better. */
export function propertyReadiness(p: {
  type: PropertyType;
  title?: string | null;
  price?: number | null;
  area?: number | null;
  city?: string | null;
  locality?: string | null;
  details?: Record<string, unknown> | null;
  media?: unknown[] | null;
  description?: string | null;
  approvals?: { name: string; documentUrl?: string | null }[] | null;
}): Readiness {
  const missing: Readiness['missing'] = [];
  const has = (v: unknown) => v !== undefined && v !== null && v !== '';
  if (!has(p.title)) missing.push({ key: 'title', label: 'Title' });
  if (!has(p.price)) missing.push({ key: 'price', label: 'Price' });
  if (!has(p.area)) missing.push({ key: 'area', label: 'Area' });
  if (!has(p.city)) missing.push({ key: 'city', label: 'City' });
  if (!has(p.locality)) missing.push({ key: 'locality', label: 'Locality' });
  for (const f of TYPE_DETAILS[p.type] ?? []) {
    if (f.required && !has(p.details?.[f.key])) missing.push({ key: `details.${f.key}`, label: f.label });
  }
  const suggestions: Readiness['suggestions'] = [];
  if (!p.media?.length) suggestions.push({ key: 'media', label: 'Add photos' });
  if (!has(p.description)) suggestions.push({ key: 'description', label: 'Add a description' });
  for (const a of p.approvals ?? []) {
    if (!a.documentUrl) suggestions.push({ key: 'approvals', label: `Upload the ${a.name} document` });
  }
  for (const f of TYPE_DETAILS[p.type] ?? []) {
    if (!f.required && !has(p.details?.[f.key])) suggestions.push({ key: `details.${f.key}`, label: f.label });
  }
  return { ready: missing.length === 0, missing, suggestions };
}

export function suggestTitle(p: {
  type: PropertyType;
  purpose?: Purpose;
  locality?: string | null;
  city?: string | null;
  area?: number | null;
  details?: Record<string, unknown> | null;
}): string {
  const d = p.details ?? {};
  const where = p.locality || p.city || '';
  const bits: string[] = [];
  if ((p.type === 'apartment' || p.type === 'villa') && d.bedrooms) bits.push(`${d.bedrooms} BHK`);
  bits.push(p.type === 'villa' ? 'Villa' : PROPERTY_TYPE_LABEL[p.type]);
  if (p.type === 'plot' && d.length && d.width) bits.push(`${d.length}×${d.width} ft`);
  let t = bits.join(' ');
  if (p.purpose && p.purpose !== 'sale') t += ` for ${p.purpose}`;
  if (where) t += ` in ${where}`;
  return t;
}

export const PROJECT_STATUSES = ['upcoming', 'under_construction', 'ready'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  upcoming: 'Upcoming',
  under_construction: 'Under construction',
  ready: 'Ready to move',
};

export const ProjectInput = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(PROPERTY_TYPES),
  status: z.enum(PROJECT_STATUSES).default('under_construction'),
  city: z.string().trim().min(2),
  locality: z.string().trim().min(2),
  address: z.string().trim().nullish(),
  reraNumber: z.string().trim().nullish(),
  possessionDate: z.string().nullish(),
  description: z.string().nullish(),
  amenities: z.array(z.string()).default([]),
  blocks: z
    .array(z.object({ name: z.string().min(1), floors: z.number().int().min(0).max(80) }))
    .default([]),
  developer: z.string().trim().max(120).nullish(),
  landAcres: z.number().positive().nullish(),
  /** Approvals claimed for the whole project; each unit inherits them. */
  approvals: z.array(z.string().min(1)).optional(),
});
export type ProjectInput = z.infer<typeof ProjectInput>;

/**
 * How complete a listing is, 0–100. What's needed to go live counts double;
 * photos count double too (buyers look first); the description, approval
 * documents and optional details make up the rest.
 */
export function propertyCompletion(p: Parameters<typeof propertyReadiness>[0]): number {
  const has = (v: unknown) => v !== undefined && v !== null && v !== '';
  let total = 0;
  let done = 0;
  const check = (ok: boolean, weight: number) => {
    total += weight;
    if (ok) done += weight;
  };
  for (const v of [p.title, p.price, p.area, p.city, p.locality]) check(has(v), 2);
  for (const f of TYPE_DETAILS[p.type] ?? []) check(has(p.details?.[f.key]), f.required ? 2 : 1);
  check(!!p.media?.length, 2);
  check(has(p.description), 1);
  for (const a of p.approvals ?? []) check(!!a.documentUrl, 1);
  return total ? Math.round((done / total) * 100) : 0;
}

/**
 * What a buyer pays on top of the price at registration (Tamil Nadu rates).
 * An estimate: the final charges depend on the guideline value.
 */
export const BUYER_COSTS = [
  { key: 'stamp', label: 'Stamp duty', pct: 7 },
  { key: 'registration', label: 'Registration', pct: 2 },
] as const;

export function buyerTotal(price: number) {
  const parts = BUYER_COSTS.map((c) => ({ ...c, amount: Math.round((price * c.pct) / 100) }));
  return { parts, total: price + parts.reduce((t, p) => t + p.amount, 0) };
}


/**
 * Rough centres of the localities and cities we sell in, so every property can
 * show a map before anyone sets its exact spot.
 */
export const PLACE_COORDS: Record<string, [number, number]> = {
  // Cities
  chennai: [13.0827, 80.2707],
  coimbatore: [11.0168, 76.9558],
  madurai: [9.9252, 78.1198],
  tiruchirappalli: [10.7905, 78.7047],
  trichy: [10.7905, 78.7047],
  bengaluru: [12.9716, 77.5946],
  bangalore: [12.9716, 77.5946],
  // Chennai
  adyar: [13.0012, 80.2565],
  ambattur: [13.1143, 80.1548],
  'anna nagar': [13.085, 80.2101],
  'ashok nagar': [13.0373, 80.2123],
  avadi: [13.1067, 80.097],
  'besant nagar': [13.0003, 80.2667],
  chromepet: [12.9516, 80.1462],
  egmore: [13.0732, 80.2609],
  guduvanchery: [12.8448, 80.06],
  guindy: [13.0067, 80.2206],
  kelambakkam: [12.7871, 80.221],
  kilpauk: [13.0839, 80.2423],
  kodambakkam: [13.0521, 80.2255],
  madipakkam: [12.9623, 80.1986],
  medavakkam: [12.9171, 80.1923],
  mogappair: [13.0837, 80.175],
  mylapore: [13.0339, 80.2619],
  nanganallur: [12.9796, 80.188],
  navalur: [12.8459, 80.2265],
  nungambakkam: [13.0569, 80.2425],
  pallavaram: [12.9675, 80.1491],
  pammal: [12.9749, 80.1347],
  perambur: [13.1186, 80.234],
  perungudi: [12.9654, 80.2461],
  poonamallee: [13.0473, 80.0945],
  porur: [13.0382, 80.1565],
  saidapet: [13.0213, 80.2231],
  sholinganallur: [12.901, 80.2279],
  siruseri: [12.8256, 80.2196],
  't. nagar': [13.0418, 80.2341],
  't nagar': [13.0418, 80.2341],
  tambaram: [12.9249, 80.1],
  thiruporur: [12.7256, 80.1897],
  thiruvanmiyur: [12.983, 80.2594],
  thoraipakkam: [12.9416, 80.2362],
  uthandi: [12.8676, 80.2433],
  valasaravakkam: [13.0405, 80.1729],
  vandalur: [12.8925, 80.081],
  velachery: [12.9815, 80.218],
  villivakkam: [13.108, 80.2095],
  'west mambalam': [13.039, 80.221],
  // Coimbatore
  gandhipuram: [11.0183, 76.9725],
  peelamedu: [11.0275, 77.0237],
  'rs puram': [11.0089, 76.9497],
  saravanampatti: [11.078, 77.0006],
};

/** Where to centre a map: the exact spot, else the locality, else the city. */
export function mapPoint(p: { location?: { lat: number; lng: number } | null; locality?: string | null; city?: string | null }): { lat: number; lng: number; level: 'exact' | 'locality' | 'city' } | null {
  if (p.location) return { ...p.location, level: 'exact' };
  const find = (name?: string | null) => {
    const n = (name ?? '').toLowerCase().trim();
    if (!n) return null;
    if (PLACE_COORDS[n]) return PLACE_COORDS[n];
    // "Sholinganallur, OMR" or "Near Porur junction": use the first known name inside.
    const key = Object.keys(PLACE_COORDS).find((k) => n.includes(k));
    return key ? PLACE_COORDS[key] : null;
  };
  const loc = find(p.locality);
  if (loc) return { lat: loc[0], lng: loc[1], level: 'locality' };
  const city = find(p.city);
  if (city) return { lat: city[0], lng: city[1], level: 'city' };
  return null;
}
