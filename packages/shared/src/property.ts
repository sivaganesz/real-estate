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

export const FACINGS = ['North', 'East', 'South', 'West', 'North-East', 'North-West', 'South-East', 'South-West'] as const;
export const FURNISHING = ['Unfurnished', 'Semi-furnished', 'Fully furnished'] as const;

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
  ],
  villa: [
    { key: 'bedrooms', label: 'Bedrooms', kind: 'number', required: true },
    { key: 'landArea', label: 'Land area', kind: 'number', unit: 'sq.ft', required: true },
    { key: 'bathrooms', label: 'Bathrooms', kind: 'number' },
    { key: 'floors', label: 'Floors', kind: 'number' },
    { key: 'facing', label: 'Facing', kind: 'select', options: FACINGS },
    { key: 'furnishing', label: 'Furnishing', kind: 'select', options: FURNISHING },
    { key: 'parking', label: 'Car parks', kind: 'number' },
  ],
  plot: [
    { key: 'length', label: 'Length', kind: 'number', unit: 'ft', required: true },
    { key: 'width', label: 'Width', kind: 'number', unit: 'ft', required: true },
    { key: 'facing', label: 'Facing', kind: 'select', options: FACINGS },
    { key: 'roadWidth', label: 'Road width', kind: 'number', unit: 'ft' },
    { key: 'cornerPlot', label: 'Corner plot', kind: 'boolean' },
    { key: 'approval', label: 'Approval (DTCP / CMDA)', kind: 'text' },
  ],
  commercial: [
    { key: 'usage', label: 'Usage', kind: 'select', options: ['Office', 'Retail / shop', 'Showroom', 'Warehouse', 'Hotel', 'Other'], required: true },
    { key: 'floor', label: 'Floor', kind: 'number', required: true },
    { key: 'washrooms', label: 'Washrooms', kind: 'number' },
    { key: 'frontage', label: 'Frontage', kind: 'number', unit: 'ft' },
    { key: 'furnishing', label: 'Furnishing', kind: 'select', options: FURNISHING },
    { key: 'parking', label: 'Car parks', kind: 'number' },
  ],
  agricultural: [
    { key: 'waterSource', label: 'Water source', kind: 'select', options: ['Borewell', 'Open well', 'Canal', 'River', 'None'], required: true },
    { key: 'roadAccess', label: 'Road access', kind: 'boolean', required: true },
    { key: 'soilType', label: 'Soil type', kind: 'text' },
    { key: 'electricity', label: 'Electricity (EB)', kind: 'boolean' },
    { key: 'fencing', label: 'Fencing', kind: 'boolean' },
  ],
  industrial: [
    { key: 'usage', label: 'Usage', kind: 'select', options: ['Factory', 'Warehouse', 'Shed', 'Land'], required: true },
    { key: 'powerKva', label: 'Power', kind: 'number', unit: 'kVA', required: true },
    { key: 'roadWidth', label: 'Road width', kind: 'number', unit: 'ft' },
    { key: 'clearHeight', label: 'Clear height', kind: 'number', unit: 'ft' },
  ],
};

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
  approvals: z.array(z.object({ name: z.string(), documentUrl: z.string().nullish() })).default([]),
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
