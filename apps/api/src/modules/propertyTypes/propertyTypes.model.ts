import { AMENITY_ICONS, ATTRIBUTE_TYPES, CATEGORY_KEYS, PURPOSES } from '@real-estate/shared';
import { model, Schema } from 'mongoose';
import { auditFields } from '../../db/auditPlugin';
import { idField, refField } from '../../db/ids';

/**
 * Attribute library: each attribute is defined once and can be used by a category
 * (common attributes) and/or by several subcategories.
 */
const attributeSchema = new Schema(
  {
    _id: idField,
    /** Made from the first name, e.g. "road_width". Never changes, so stored values keep working. */
    key: { type: String, required: true },
    label: { type: String, required: true },
    /** Lower-cased label, to stop two attributes with the same name. */
    labelKey: { type: String, required: true },
    type: { type: String, required: true, enum: ATTRIBUTE_TYPES },
    unit: { type: String, default: null },
    options: { type: [String], default: [] },
    searchFilter: { type: Boolean, default: false },
    ...auditFields,
  },
  { timestamps: true },
);
attributeSchema.index({ key: 1 }, { unique: true });
attributeSchema.index({ labelKey: 1 }, { unique: true });

/** Where an attribute is used, in display order. "required" is per place. */
const placementSchema = new Schema(
  {
    attributeId: { ...refField('PropertyAttribute'), required: true },
    required: { type: Boolean, default: false },
  },
  { _id: false },
);

const categorySchema = new Schema(
  {
    _id: idField,
    key: { type: String, required: true, enum: CATEGORY_KEYS },
    name: { type: String, required: true },
    isActive: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    /** Common attributes: shown for every subcategory in this category. */
    attributes: { type: [placementSchema], default: [] },
    /** Set once the starting subcategories and attributes were added (and the category activated). */
    setupSeededAt: { type: Date, default: null },
    /** Set once the starting amenities were added, so deleted ones never come back. */
    amenitiesSeededAt: { type: Date, default: null },
    updatedBy: refField('User'),
  },
  { timestamps: true },
);
categorySchema.index({ key: 1 }, { unique: true });

const subcategorySchema = new Schema(
  {
    _id: idField,
    categoryKey: { type: String, required: true, enum: CATEGORY_KEYS },
    name: { type: String, required: true },
    /** Lower-cased name: unique within a category. */
    nameKey: { type: String, required: true },
    codePrefix: { type: String, required: true },
    purposes: { type: [String], enum: PURPOSES, default: [] },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    attributes: { type: [placementSchema], default: [] },
    ...auditFields,
  },
  { timestamps: true },
);
subcategorySchema.index({ categoryKey: 1, nameKey: 1 }, { unique: true });
subcategorySchema.index({ codePrefix: 1 }, { unique: true });

/** Amenities offered as a checklist on the property form, per category. */
const amenitySchema = new Schema(
  {
    _id: idField,
    categoryKey: { type: String, required: true, enum: CATEGORY_KEYS },
    name: { type: String, required: true },
    /** Lower-cased name: unique within a category. */
    nameKey: { type: String, required: true },
    icon: { type: String, enum: [...AMENITY_ICONS, null], default: null },
    appliesToAll: { type: Boolean, default: true },
    subcategoryIds: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    ...auditFields,
  },
  { timestamps: true },
);
amenitySchema.index({ categoryKey: 1, nameKey: 1 }, { unique: true });
amenitySchema.index({ categoryKey: 1, order: 1 });

export const PropertyAttributeModel = model('PropertyAttribute', attributeSchema);
export const PropertyCategoryModel = model('PropertyCategory', categorySchema);
export const PropertySubcategoryModel = model('PropertySubcategory', subcategorySchema);
export const AmenityModel = model('Amenity', amenitySchema);

export interface AmenityDoc {
  _id: string;
  categoryKey: (typeof CATEGORY_KEYS)[number];
  name: string;
  nameKey: string;
  icon: (typeof AMENITY_ICONS)[number] | null;
  appliesToAll: boolean;
  subcategoryIds: string[];
  isActive: boolean;
  order: number;
}

export interface Placement {
  attributeId: string;
  required: boolean;
}

export interface AttributeDoc {
  _id: string;
  key: string;
  label: string;
  labelKey: string;
  type: (typeof ATTRIBUTE_TYPES)[number];
  unit: string | null;
  options: string[];
  searchFilter: boolean;
}

export interface CategoryDoc {
  _id: string;
  key: (typeof CATEGORY_KEYS)[number];
  name: string;
  isActive: boolean;
  order: number;
  attributes: Placement[];
}

export interface SubcategoryDoc {
  _id: string;
  categoryKey: (typeof CATEGORY_KEYS)[number];
  name: string;
  nameKey: string;
  codePrefix: string;
  purposes: (typeof PURPOSES)[number][];
  isActive: boolean;
  order: number;
  attributes: Placement[];
}
