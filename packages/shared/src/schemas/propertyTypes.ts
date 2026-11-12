import { z } from 'zod';
import { idSchema } from './common';

/**
 * Settings → Property types & amenities → Categories & attributes.
 *
 * Category (Residential, …) → Subcategory (Residential Plot, Villa / House, …) → Attributes.
 * - Core attributes (property name, purpose, price, area, location) are on every property,
 *   always required, and can't be changed or deleted.
 * - Common attributes belong to a category and appear for all its subcategories.
 * - Subcategory attributes appear only for that subcategory.
 * An attribute is defined once (name, value type, options) and can be used in several
 * places, so a filter like "BHK" works the same for villas and apartments.
 */

export const CATEGORY_KEYS = ['residential', 'commercial', 'other'] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export const PURPOSES = ['sale', 'rent', 'lease'] as const;
export type Purpose = (typeof PURPOSES)[number];
export const PURPOSE_LABELS: Record<Purpose, string> = {
  sale: 'Sale',
  rent: 'Rent',
  lease: 'Lease',
};

export const ATTRIBUTE_TYPES = [
  'text',
  'long_text',
  'number',
  'yes_no',
  'dropdown',
  'multi_select',
  'date',
] as const;
export type AttributeType = (typeof ATTRIBUTE_TYPES)[number];
export const ATTRIBUTE_TYPE_LABELS: Record<AttributeType, string> = {
  text: 'Text',
  long_text: 'Long text',
  number: 'Number',
  yes_no: 'Yes / No',
  dropdown: 'Dropdown',
  multi_select: 'Multi-select',
  date: 'Date',
};

/** Types that need a list of options. */
export const TYPES_WITH_OPTIONS: readonly AttributeType[] = ['dropdown', 'multi_select'];
export const ATTRIBUTE_MAX_OPTIONS = 50;

/** Built into every property; shown as locked rows above the common attributes. */
export const CORE_ATTRIBUTES = [
  { key: 'title', label: 'Property name', valueType: 'Text', detail: '' },
  { key: 'purpose', label: 'Purpose', valueType: 'Dropdown', detail: 'Sale, Rent, Lease' },
  { key: 'price', label: 'Price', valueType: 'Number', detail: '₹, with Negotiable' },
  { key: 'area', label: 'Area', valueType: 'Number + unit', detail: 'sq.ft, cent, acre…' },
  { key: 'location', label: 'Location', valueType: 'Address', detail: 'city, area, pincode' },
] as const;
export const CORE_ATTRIBUTE_KEYS: readonly string[] = CORE_ATTRIBUTES.map((a) => a.key);

// ------------------------------------------------------------------ responses

export const coreAttributeSchema = z.object({
  key: z.string(),
  label: z.string(),
  valueType: z.string(),
  detail: z.string(),
});
export type CoreAttribute = z.infer<typeof coreAttributeSchema>;

/** An attribute as used in one place (common or a subcategory). */
export const placedAttributeSchema = z.object({
  id: idSchema,
  key: z.string().meta({ example: 'road_width' }),
  label: z.string().meta({ example: 'Road width' }),
  type: z.enum(ATTRIBUTE_TYPES),
  unit: z.string().nullable().meta({ example: 'ft' }),
  options: z.array(z.string()),
  searchFilter: z.boolean(),
  /** Per place: whether it must be filled before a property can be published. */
  required: z.boolean(),
  /** The other places that use the same attribute, e.g. ["Apartment / Flat"]. */
  usedIn: z.array(z.string()),
});
export type PlacedAttribute = z.infer<typeof placedAttributeSchema>;

export const subcategorySchema = z.object({
  id: idSchema,
  categoryKey: z.enum(CATEGORY_KEYS),
  name: z.string().meta({ example: 'Villa / House' }),
  codePrefix: z.string().meta({ example: 'VIL' }),
  purposes: z.array(z.enum(PURPOSES)),
  isActive: z.boolean(),
  propertyCount: z.number().int(),
  /** The code prefix can't change once properties use it (their codes contain it). */
  prefixLocked: z.boolean(),
  attributes: z.array(placedAttributeSchema),
});
export type Subcategory = z.infer<typeof subcategorySchema>;

/** Icons admins can pick for an amenity (lucide icon names; the admin app maps them). */
export const AMENITY_ICONS = [
  'shield-check',
  'cctv',
  'fence',
  'car',
  'zap',
  'arrow-up-down',
  'waves',
  'dumbbell',
  'baby',
  'trees',
  'building-2',
  'cloud-rain',
  'droplets',
  'lightbulb',
  'route',
  'wifi',
  'flame',
  'sun',
  'store',
  'sparkles',
] as const;
export type AmenityIcon = (typeof AMENITY_ICONS)[number];

export const amenitySchema = z.object({
  id: idSchema,
  name: z.string().meta({ example: 'Gated community' }),
  icon: z.enum(AMENITY_ICONS).nullable(),
  /** True: offered for every subcategory in the category, including ones added later. */
  appliesToAll: z.boolean(),
  /** When not for all: the subcategories it is offered for. */
  subcategoryIds: z.array(idSchema),
  isActive: z.boolean(),
  /** Properties that have this amenity ticked. */
  propertyCount: z.number().int(),
});
export type Amenity = z.infer<typeof amenitySchema>;

export const categorySchema = z.object({
  key: z.enum(CATEGORY_KEYS),
  name: z.string().meta({ example: 'Residential' }),
  /** Inactive categories are "set up later": they can't be edited or used yet. */
  isActive: z.boolean(),
  commonAttributes: z.array(placedAttributeSchema),
  subcategories: z.array(subcategorySchema),
  /** In display order (the order of the checklist on the property form). */
  amenities: z.array(amenitySchema),
});
export type Category = z.infer<typeof categorySchema>;

/** GET /admin/property-types: everything the Settings page and the property form need. */
export const propertyTypesSchema = z.object({
  coreAttributes: z.array(coreAttributeSchema),
  categories: z.array(categorySchema),
});
export type PropertyTypes = z.infer<typeof propertyTypesSchema>;

/** GET /admin/property-types/attributes?q= : existing attributes, to avoid duplicates. */
export const attributeMatchSchema = z.object({
  id: idSchema,
  label: z.string(),
  type: z.enum(ATTRIBUTE_TYPES),
  usedIn: z.array(z.string()),
});
export type AttributeMatch = z.infer<typeof attributeMatchSchema>;

// ------------------------------------------------------------------ inputs

const labelSchema = z
  .string()
  .trim()
  .min(2, 'Attribute name must be at least 2 characters')
  .max(60, 'Attribute name must be at most 60 characters');

const unitSchema = z.string().trim().max(20, 'Unit must be at most 20 characters');

const optionsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, "Options can't be empty")
      .max(60, 'Keep each option under 60 characters'),
  )
  .max(ATTRIBUTE_MAX_OPTIONS, `Up to ${ATTRIBUTE_MAX_OPTIONS} options`);

interface DefinitionShape {
  type: AttributeType;
  options: string[];
}

/** Dropdown and multi-select need at least one option, with no duplicates. */
export function checkAttributeOptions(value: DefinitionShape, ctx: z.RefinementCtx): void {
  if (!TYPES_WITH_OPTIONS.includes(value.type)) return;
  if (value.options.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['options'], message: 'Add at least one option' });
    return;
  }
  const seen = new Set<string>();
  for (const option of value.options) {
    const k = option.toLowerCase();
    if (seen.has(k)) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: `"${option}" is listed twice` });
      return;
    }
    seen.add(k);
  }
}

/** A new attribute: its definition plus how it behaves in this place. */
export const newAttributeBodySchema = z
  .object({
    source: z.literal('new'),
    label: labelSchema,
    type: z.enum(ATTRIBUTE_TYPES, 'Choose a value type'),
    unit: unitSchema.default(''),
    options: optionsSchema.default([]),
    searchFilter: z.boolean().default(false),
    required: z.boolean().default(false),
  })
  .superRefine(checkAttributeOptions);

/** Reuse an attribute that already exists elsewhere (e.g. "Facing"). */
export const existingAttributeBodySchema = z.object({
  source: z.literal('existing'),
  attributeId: idSchema,
  required: z.boolean().default(false),
});

/** POST …/attributes: either a new attribute or an existing one. */
export const addAttributeBodySchema = z.discriminatedUnion('source', [
  newAttributeBodySchema,
  existingAttributeBodySchema,
]);
export type AddAttributeBody = z.input<typeof addAttributeBodySchema>;
export type AddAttribute = z.output<typeof addAttributeBodySchema>;

/**
 * PATCH …/attributes/:attributeId. Name, type, unit, options and search filter change the
 * attribute everywhere it is used; "required" applies to this place only.
 */
export const updateAttributeBodySchema = z
  .object({
    label: labelSchema,
    type: z.enum(ATTRIBUTE_TYPES, 'Choose a value type'),
    unit: unitSchema,
    options: optionsSchema,
    searchFilter: z.boolean(),
    required: z.boolean(),
  })
  .partial();
export type UpdateAttributeBody = z.input<typeof updateAttributeBodySchema>;
export type UpdateAttribute = z.output<typeof updateAttributeBodySchema>;

export const CODE_PREFIX_PATTERN = /^[A-Z]{3}$/;

const subcategoryFields = {
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(60, 'Name must be at most 60 characters'),
  codePrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(CODE_PREFIX_PATTERN, 'Use exactly 3 letters, e.g. FRM'),
  purposes: z
    .array(z.enum(PURPOSES))
    .min(1, 'Choose at least one purpose')
    .transform((list) => PURPOSES.filter((p) => list.includes(p))),
  isActive: z.boolean(),
};

/** POST /admin/property-types/subcategories */
export const createSubcategoryBodySchema = z.object({
  categoryKey: z.enum(CATEGORY_KEYS),
  ...subcategoryFields,
  isActive: subcategoryFields.isActive.default(true),
});
export type CreateSubcategoryBody = z.input<typeof createSubcategoryBodySchema>;
export type CreateSubcategory = z.output<typeof createSubcategoryBodySchema>;

/** PATCH /admin/property-types/subcategories/:id */
export const updateSubcategoryBodySchema = z.object(subcategoryFields).partial();
export type UpdateSubcategoryBody = z.input<typeof updateSubcategoryBodySchema>;
export type UpdateSubcategory = z.output<typeof updateSubcategoryBodySchema>;

const amenityFields = {
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(60, 'Name must be at most 60 characters'),
  icon: z.enum(AMENITY_ICONS).nullable(),
  appliesToAll: z.boolean(),
  subcategoryIds: z.array(idSchema).max(100),
  isActive: z.boolean(),
};

/** "For all subcategories" or at least one subcategory. */
const amenityAppliesTo = {
  message: 'Choose at least one subcategory, or "All"',
  path: ['subcategoryIds'],
};

/** POST /admin/property-types/categories/:key/amenities */
export const createAmenityBodySchema = z
  .object({
    ...amenityFields,
    icon: amenityFields.icon.default(null),
    appliesToAll: amenityFields.appliesToAll.default(true),
    subcategoryIds: amenityFields.subcategoryIds.default([]),
    isActive: amenityFields.isActive.default(true),
  })
  .refine((v) => v.appliesToAll || v.subcategoryIds.length > 0, amenityAppliesTo);
export type CreateAmenityBody = z.input<typeof createAmenityBodySchema>;
export type CreateAmenity = z.output<typeof createAmenityBodySchema>;

/** PATCH /admin/property-types/amenities/:id */
export const updateAmenityBodySchema = z
  .object(amenityFields)
  .partial()
  .refine(
    (v) =>
      v.appliesToAll !== false || v.subcategoryIds === undefined || v.subcategoryIds.length > 0,
    amenityAppliesTo,
  );
export type UpdateAmenityBody = z.input<typeof updateAmenityBodySchema>;
export type UpdateAmenity = z.output<typeof updateAmenityBodySchema>;

/** PUT /admin/property-types/categories/:key/amenities/order: every amenity id, in the new order. */
export const reorderAmenitiesBodySchema = z.object({
  ids: z.array(idSchema).min(1).max(500),
});
export type ReorderAmenitiesBody = z.infer<typeof reorderAmenitiesBodySchema>;

/** "Road width (ft)" → "road_width". Used to make an attribute's key from its name. */
export function attributeKeyFromLabel(label: string): string {
  const key = label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, ' ')
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return key || 'attribute';
}

/** Names compared case- and space-insensitively ("Corner  Plot" = "corner plot"). */
export function normalizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ');
}
