import {
  AREA_UNITS,
  CATEGORY_KEYS,
  EXTRA_ATTRIBUTE_TYPES,
  MEDIA_KINDS,
  PRICE_BASES,
  PROPERTY_STATUSES,
  PURPOSES,
} from '@real-estate/shared';
import type {
  AreaUnit,
  AttributeValue,
  CategoryKey,
  ExtraAttribute,
  MediaKind,
  PriceBasis,
  PropertyStatus,
  Purpose,
} from '@real-estate/shared';
import { model, Schema } from 'mongoose';
import { auditFields } from '../../db/auditPlugin';
import { idField } from '../../db/ids';

/** Uploaded files (filled by the media endpoints in Phase 2.2b). Paths are relative to uploads/. */
const mediaSchema = new Schema(
  {
    _id: idField,
    kind: { type: String, required: true, enum: MEDIA_KINDS },
    path: { type: String, required: true },
    thumbPath: { type: String, default: null },
    mediumPath: { type: String, default: null },
    originalName: { type: String, default: '' },
    mime: { type: String, default: '' },
    sizeBytes: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
    isCover: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const propertySchema = new Schema(
  {
    _id: idField,
    /** "RE-VIL-000031": made from the subcategory's prefix when created; never changes. */
    code: { type: String, required: true },
    categoryKey: { type: String, required: true, enum: CATEGORY_KEYS },
    subcategoryId: { type: String, required: true },
    title: { type: String, required: true },
    purpose: { type: String, required: true, enum: PURPOSES },
    price: {
      amount: { type: Number, default: null },
      basis: { type: String, enum: PRICE_BASES, default: 'total' },
      negotiable: { type: Boolean, default: false },
      onRequest: { type: Boolean, default: false },
    },
    rental: {
      type: new Schema(
        {
          securityDeposit: { type: Number, default: null },
          lockInMonths: { type: Number, default: null },
        },
        { _id: false },
      ),
      default: null,
    },
    area: {
      type: new Schema(
        {
          value: { type: Number, required: true },
          unit: { type: String, required: true, enum: AREA_UNITS },
          /** Used for filtering and sorting by size. */
          sqft: { type: Number, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    location: {
      state: { type: String, default: '' },
      city: { type: String, default: '' },
      locality: { type: String, default: '' },
      pincode: { type: String, default: '' },
      address: { type: String, default: '' },
      landmark: { type: String, default: '' },
      mapPin: {
        type: new Schema({ lat: Number, lng: Number }, { _id: false }),
        default: null,
      },
    },
    /** By attribute key. Values for attributes the subcategory no longer shows are kept. */
    attributeValues: { type: Schema.Types.Mixed, default: {} },
    /** "This property only" attributes. */
    extraAttributes: {
      type: [
        new Schema(
          {
            label: { type: String, required: true },
            type: { type: String, required: true, enum: EXTRA_ATTRIBUTE_TYPES },
            value: { type: Schema.Types.Mixed, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    /** Optional attributes removed from this property's form. */
    removedAttributeKeys: { type: [String], default: [] },
    amenityIds: { type: [String], default: [] },
    media: { type: [mediaSchema], default: [] },
    status: { type: String, required: true, enum: PROPERTY_STATUSES, default: 'draft' },
    isFeatured: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
    statusChangedAt: { type: Date, default: Date.now },
    ...auditFields,
  },
  { timestamps: true, minimize: false },
);

propertySchema.index({ code: 1 }, { unique: true });
propertySchema.index({ status: 1, subcategoryId: 1, 'location.city': 1, 'price.amount': 1 });
propertySchema.index({ 'location.locality': 1 });
propertySchema.index({ 'location.pincode': 1 });
propertySchema.index({ amenityIds: 1 });
propertySchema.index({ updatedAt: -1 });

export const PropertyModel = model('Property', propertySchema);

export interface MediaDoc {
  _id: string;
  kind: MediaKind;
  path: string;
  thumbPath: string | null;
  mediumPath: string | null;
  originalName: string;
  mime: string;
  sizeBytes: number;
  isCover: boolean;
  order: number;
  createdAt?: Date;
}

export interface PropertyDoc {
  _id: string;
  code: string;
  categoryKey: CategoryKey;
  subcategoryId: string;
  title: string;
  purpose: Purpose;
  price: { amount: number | null; basis: PriceBasis; negotiable: boolean; onRequest: boolean };
  rental: { securityDeposit: number | null; lockInMonths: number | null } | null;
  area: { value: number; unit: AreaUnit; sqft: number } | null;
  location: {
    state: string;
    city: string;
    locality: string;
    pincode: string;
    address: string;
    landmark: string;
    mapPin: { lat: number; lng: number } | null;
  };
  attributeValues: Record<string, AttributeValue>;
  extraAttributes: ExtraAttribute[];
  removedAttributeKeys: string[];
  amenityIds: string[];
  media: MediaDoc[];
  status: PropertyStatus;
  isFeatured: boolean;
  publishedAt: Date | null;
  statusChangedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** One counter per subcategory prefix, for property codes. */
const counterSchema = new Schema(
  { _id: String, seq: { type: Number, default: 0 } },
  { versionKey: false },
);
export const CounterModel = model('Counter', counterSchema);

/** "RE-VIL-000031": the next code for a prefix (atomic, so codes are never reused). */
export async function nextPropertyCode(prefix: string): Promise<string> {
  const counter = await CounterModel.findOneAndUpdate(
    { _id: `property:${prefix}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  ).lean<{ seq: number }>();
  return `RE-${prefix}-${String(counter!.seq).padStart(6, '0')}`;
}

/** Display order: by `order`, then upload time. */
export function sortMedia<T extends { order: number; createdAt?: Date }>(media: T[]): T[] {
  return [...media].sort(
    (a, b) => a.order - b.order || (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0),
  );
}
