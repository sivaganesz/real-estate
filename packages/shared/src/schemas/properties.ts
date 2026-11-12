import { z } from 'zod';
import { AREA_UNITS } from '../area';
import { idSchema, paginationQuerySchema } from './common';
import { CATEGORY_KEYS, PURPOSES } from './propertyTypes';
import type { Purpose } from './propertyTypes';
import { officeLocationSchema } from './settings';

/** Property status lifecycle (PRD §5.4). Only Published properties reach the AI agent. */
export const PROPERTY_STATUSES = [
  'draft',
  'published',
  'unpublished',
  'booked',
  'sold',
  'rented',
  'leased',
  'archived',
] as const;
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  unpublished: 'Unpublished',
  booked: 'Booked',
  sold: 'Sold',
  rented: 'Rented',
  leased: 'Leased',
  archived: 'Archived',
};

/** Which statuses each status can move to. */
export const STATUS_TRANSITIONS: Record<PropertyStatus, readonly PropertyStatus[]> = {
  draft: ['published', 'archived'],
  published: ['unpublished', 'booked', 'sold', 'rented', 'leased', 'archived'],
  unpublished: ['published', 'archived'],
  booked: ['published', 'sold', 'rented', 'leased', 'archived'],
  sold: ['published', 'archived'],
  rented: ['published', 'archived'],
  leased: ['published', 'archived'],
  archived: ['draft'],
};

/** The closing status that matches each purpose: a sale is Sold, a rental Rented… */
export const CLOSED_STATUS_FOR: Record<Purpose, PropertyStatus> = {
  sale: 'sold',
  rent: 'rented',
  lease: 'leased',
};

/** Can `from` move to `to` for a property with this purpose? */
export function canChangeStatus(
  from: PropertyStatus,
  to: PropertyStatus,
  purpose: Purpose,
): boolean {
  if (!STATUS_TRANSITIONS[from].includes(to)) return false;
  const closing: readonly PropertyStatus[] = ['sold', 'rented', 'leased'];
  return !closing.includes(to) || CLOSED_STATUS_FOR[purpose] === to;
}

export const PRICE_BASES = ['total', 'per_sqft', 'per_month'] as const;
export type PriceBasis = (typeof PRICE_BASES)[number];

/** Indian pincode: 6 digits, not starting with 0. */
export const PINCODE_PATTERN = /^[1-9]\d{5}$/;

/** Value types allowed for "this property only" attributes (no options to manage). */
export const EXTRA_ATTRIBUTE_TYPES = ['text', 'long_text', 'number', 'yes_no', 'date'] as const;
export type ExtraAttributeType = (typeof EXTRA_ATTRIBUTE_TYPES)[number];

/** A stored attribute value: text, number, yes/no, a list (multi-select) or a date (YYYY-MM-DD). */
export const attributeValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
]);
export type AttributeValue = z.infer<typeof attributeValueSchema>;

// ------------------------------------------------------------------ parts

const text = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be at most ${max} characters`);

export const priceSchema = z.object({
  /** In rupees. For rent / lease this is the monthly rent. Null while not decided. */
  amount: z.number().positive('Price must be more than 0').max(1e11).nullable().default(null),
  basis: z.enum(PRICE_BASES).default('total'),
  negotiable: z.boolean().default(false),
  /** Hides the price on the website and from the AI agent ("Price on request"). */
  onRequest: z.boolean().default(false),
});
export type Price = z.output<typeof priceSchema>;

/** Rent and lease only. */
export const rentalSchema = z.object({
  securityDeposit: z.number().min(0).max(1e10).nullable().default(null),
  lockInMonths: z.number().int().min(0).max(240).nullable().default(null),
});
export type Rental = z.output<typeof rentalSchema>;

export const areaInputSchema = z.object({
  value: z.number().positive('Area must be more than 0').max(1e9),
  unit: z.enum(AREA_UNITS),
});

export const locationSchema = z.object({
  state: text(60, 'State').default(''),
  city: text(60, 'City').default(''),
  locality: text(100, 'Area / locality').default(''),
  pincode: z
    .string()
    .trim()
    .refine((v) => v === '' || PINCODE_PATTERN.test(v), 'Enter a valid 6-digit pincode')
    .default(''),
  address: text(500, 'Address').default(''),
  landmark: text(120, 'Landmark').default(''),
  mapPin: officeLocationSchema.nullable().default(null),
});
export type PropertyLocation = z.output<typeof locationSchema>;

export const extraAttributeSchema = z.object({
  label: z
    .string()
    .trim()
    .min(2, 'Attribute name must be at least 2 characters')
    .max(60, 'Attribute name must be at most 60 characters'),
  type: z.enum(EXTRA_ATTRIBUTE_TYPES),
  value: z.union([z.string().max(5000), z.number(), z.boolean()]),
});
export type ExtraAttribute = z.infer<typeof extraAttributeSchema>;

// ------------------------------------------------------------------ responses

export const userRefSchema = z.object({ id: idSchema, name: z.string() }).nullable();

/** Something missing before a property can be published, e.g. { path: 'price', message }. */
export const publishIssueSchema = z.object({ path: z.string(), message: z.string() });
export type PublishIssue = z.infer<typeof publishIssueSchema>;

/**
 * Media kinds and what each accepts (PRD ADM-PROP-06). The API also checks each file's
 * content, not just its name.
 */
export const MEDIA_KINDS = ['image', 'video', 'floor_plan', 'brochure', 'document'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

const MB = 1024 * 1024;
export const MEDIA_RULES: Record<
  MediaKind,
  { label: string; accept: string; extensions: string[]; maxBytes: number }
> = {
  image: {
    label: 'Photo',
    accept: 'image/jpeg,image/png,image/webp',
    extensions: ['jpg', 'jpeg', 'png', 'webp'],
    maxBytes: 10 * MB,
  },
  video: {
    label: 'Video',
    accept: 'video/mp4,video/webm',
    extensions: ['mp4', 'webm'],
    maxBytes: 50 * MB,
  },
  floor_plan: {
    label: 'Floor plan',
    accept: 'image/jpeg,image/png,image/webp,application/pdf',
    extensions: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
    maxBytes: 20 * MB,
  },
  brochure: {
    label: 'Brochure',
    accept: 'application/pdf',
    extensions: ['pdf'],
    maxBytes: 20 * MB,
  },
  document: {
    label: 'Document',
    accept: 'application/pdf',
    extensions: ['pdf'],
    maxBytes: 20 * MB,
  },
};
/** Most files one property can hold. */
export const MAX_MEDIA_PER_PROPERTY = 60;

export const propertyMediaSchema = z.object({
  id: idSchema,
  kind: z.enum(MEDIA_KINDS),
  /** Browser URL of the file (images: the large WebP). */
  url: z.string(),
  /** Images only: small (≈400px) and medium (≈1200px) WebP versions. */
  thumbUrl: z.string().nullable(),
  mediumUrl: z.string().nullable(),
  originalName: z.string(),
  mime: z.string(),
  sizeBytes: z.number().int(),
  isCover: z.boolean(),
});
export type PropertyMedia = z.infer<typeof propertyMediaSchema>;

export const propertySchema = z.object({
  id: idSchema,
  code: z.string().meta({ example: 'RE-VIL-000031' }),
  categoryKey: z.enum(CATEGORY_KEYS),
  subcategoryId: idSchema,
  subcategoryName: z.string(),
  title: z.string(),
  purpose: z.enum(PURPOSES),
  price: priceSchema,
  rental: rentalSchema.nullable(),
  area: z.object({ value: z.number(), unit: z.enum(AREA_UNITS), sqft: z.number() }).nullable(),
  location: locationSchema,
  /** Values by attribute key (common and subcategory attributes). */
  attributeValues: z.record(z.string(), attributeValueSchema),
  /** Keys with a value that the current subcategory doesn't show (kept after a subcategory change). */
  hiddenAttributeKeys: z.array(z.string()),
  extraAttributes: z.array(extraAttributeSchema),
  /** Optional attributes taken off this property's form ("remove from this property only"). */
  removedAttributeKeys: z.array(z.string()),
  amenityIds: z.array(idSchema),
  /** In display order; the cover photo is marked. */
  media: z.array(propertyMediaSchema),
  status: z.enum(PROPERTY_STATUSES),
  isFeatured: z.boolean(),
  /** What still needs filling before it can be published (empty = ready). */
  publishIssues: z.array(publishIssueSchema),
  publishedAt: z.string().nullable(),
  statusChangedAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: userRefSchema,
  updatedBy: userRefSchema,
});
export type Property = z.infer<typeof propertySchema>;

/** A row in the property list. */
export const propertyListItemSchema = z.object({
  id: idSchema,
  code: z.string(),
  title: z.string(),
  categoryKey: z.enum(CATEGORY_KEYS),
  subcategoryId: idSchema,
  subcategoryName: z.string(),
  purpose: z.enum(PURPOSES),
  price: priceSchema,
  area: z.object({ value: z.number(), unit: z.enum(AREA_UNITS), sqft: z.number() }).nullable(),
  location: z.object({ city: z.string(), locality: z.string(), pincode: z.string() }),
  /** Small version of the cover photo, for the list. */
  coverUrl: z.string().nullable(),
  status: z.enum(PROPERTY_STATUSES),
  isFeatured: z.boolean(),
  updatedAt: z.string(),
});
export type PropertyListItem = z.infer<typeof propertyListItemSchema>;

/** GET /admin/properties/status-counts: numbers for the status tabs. */
export const propertyStatusCountsSchema = z.record(
  z.enum(['all', ...PROPERTY_STATUSES]),
  z.number().int(),
);
export type PropertyStatusCounts = Record<'all' | PropertyStatus, number>;

export const propertyHistoryEntrySchema = z.object({
  id: idSchema,
  action: z.string(),
  changes: z.record(z.string(), z.tuple([z.unknown(), z.unknown()])).nullable(),
  at: z.string(),
  by: userRefSchema,
});
export type PropertyHistoryEntry = z.infer<typeof propertyHistoryEntrySchema>;

// ------------------------------------------------------------------ inputs

const titleSchema = z
  .string()
  .trim()
  .min(5, 'Property name must be at least 5 characters')
  .max(150, 'Property name must be at most 150 characters');

const propertyFields = {
  subcategoryId: idSchema,
  title: titleSchema,
  purpose: z.enum(PURPOSES, 'Choose a purpose'),
  price: priceSchema,
  rental: rentalSchema.nullable(),
  area: areaInputSchema.nullable(),
  location: locationSchema,
  /** Values for the subcategory's and category's attributes; null or "" clears one. */
  attributeValues: z.record(z.string(), attributeValueSchema.nullable()),
  extraAttributes: z.array(extraAttributeSchema).max(30, 'Up to 30 extra attributes'),
  /** Optional attributes removed from this property's form; their values are cleared. */
  removedAttributeKeys: z.array(z.string().max(80)).max(100),
  amenityIds: z.array(idSchema).max(100),
  isFeatured: z.boolean(),
};

/**
 * POST /admin/properties: saved as a Draft. Only the subcategory, name and purpose are
 * needed to save; everything else can be filled later (checked when publishing).
 */
export const createPropertyBodySchema = z.object({
  ...propertyFields,
  price: propertyFields.price.default({
    amount: null,
    basis: 'total',
    negotiable: false,
    onRequest: false,
  }),
  rental: propertyFields.rental.default(null),
  area: propertyFields.area.default(null),
  location: propertyFields.location.default({
    state: '',
    city: '',
    locality: '',
    pincode: '',
    address: '',
    landmark: '',
    mapPin: null,
  }),
  attributeValues: propertyFields.attributeValues.default({}),
  extraAttributes: propertyFields.extraAttributes.default([]),
  removedAttributeKeys: propertyFields.removedAttributeKeys.default([]),
  amenityIds: propertyFields.amenityIds.default([]),
  isFeatured: propertyFields.isFeatured.default(false),
});
export type CreatePropertyBody = z.input<typeof createPropertyBodySchema>;
export type CreateProperty = z.output<typeof createPropertyBodySchema>;

/**
 * PATCH /admin/properties/:id: only the parts sent are changed. `attributeValues` is merged
 * key by key (null clears a value); `extraAttributes` and `amenityIds` replace the list.
 * Changing `subcategoryId` keeps the code; values the new subcategory doesn't show are hidden.
 */
export const updatePropertyBodySchema = z.object(propertyFields).partial();
export type UpdatePropertyBody = z.input<typeof updatePropertyBodySchema>;
export type UpdateProperty = z.output<typeof updatePropertyBodySchema>;

/** POST /admin/properties/:id/status */
export const changeStatusBodySchema = z.object({ status: z.enum(PROPERTY_STATUSES) });

/** POST /admin/properties/bulk-status */
export const bulkStatusBodySchema = z.object({
  ids: z.array(idSchema).min(1, 'Select at least one property').max(200),
  status: z.enum(PROPERTY_STATUSES),
});
export const bulkStatusResultSchema = z.object({
  updated: z.array(z.object({ id: idSchema, code: z.string() })),
  failed: z.array(z.object({ id: idSchema, code: z.string().nullable(), reason: z.string() })),
});
export type BulkStatusResult = z.infer<typeof bulkStatusResultSchema>;

const boolQuery = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();
const amountQuery = z.coerce.number().min(0).optional();

/** GET /admin/properties */
export const listPropertiesQuerySchema = paginationQuerySchema.extend({
  /** Code, name, city, area / locality or pincode. */
  q: z.string().trim().max(100).optional(),
  categoryKey: z.enum(CATEGORY_KEYS).optional(),
  subcategoryId: idSchema.optional(),
  purpose: z.enum(PURPOSES).optional(),
  city: z.string().trim().max(60).optional(),
  locality: z.string().trim().max(100).optional(),
  pincode: z.string().trim().max(6).optional(),
  minPrice: amountQuery,
  maxPrice: amountQuery,
  /** Without a status, archived properties are left out. */
  status: z.enum(PROPERTY_STATUSES).optional(),
  featured: boolQuery,
});
export type ListPropertiesQuery = z.infer<typeof listPropertiesQuerySchema>;

/** GET /admin/properties/location-suggestions: values already used, for consistent spelling. */
export const LOCATION_SUGGESTION_FIELDS = ['state', 'city', 'locality', 'pincode'] as const;
export const locationSuggestionsQuerySchema = z.object({
  field: z.enum(LOCATION_SUGGESTION_FIELDS),
  q: z.string().trim().max(100).default(''),
  /** Narrows locality / pincode suggestions to one city. */
  city: z.string().trim().max(60).optional(),
});
export const locationSuggestionSchema = z.object({ value: z.string(), count: z.number().int() });
export type LocationSuggestion = z.infer<typeof locationSuggestionSchema>;

/** PUT /admin/properties/:id/media/order: every media id, in the new order. */
export const reorderMediaBodySchema = z.object({
  ids: z.array(idSchema).min(1).max(MAX_MEDIA_PER_PROPERTY),
});

/** POST /admin/properties/:id/media?kind=image (multipart, field "file"). */
export const uploadMediaQuerySchema = z.object({ kind: z.enum(MEDIA_KINDS).default('image') });
