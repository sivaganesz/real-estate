import {
  AREA_UNITS,
  EXTRA_ATTRIBUTE_TYPES,
  PINCODE_PATTERN,
  PRICE_BASES,
  PURPOSES,
} from '@real-estate/shared';
import type {
  AttributeType,
  Category,
  CreatePropertyBody,
  PlacedAttribute,
  Property,
  Subcategory,
} from '@real-estate/shared';
import { z } from 'zod';
import type { ApiErrorDetail } from '@/lib/api';

/** Attribute values are edited as text ("" = empty), "yes"/"no", or a list (multi-select). */
export type FieldValue = string | string[];

const optionalNumber = (message: string, opts: { min?: number; int?: boolean } = {}) =>
  z
    .string()
    .trim()
    .refine((v) => {
      if (v === '') return true;
      const n = Number(v);
      return Number.isFinite(n) && n >= (opts.min ?? 0) && (!opts.int || Number.isInteger(n));
    }, message);

const coordinate = (limit: number) =>
  z
    .string()
    .trim()
    .refine(
      (v) => v === '' || Math.abs(Number(v)) <= limit,
      `Enter a number between -${limit} and ${limit}`,
    );

export const propertyFormSchema = z
  .object({
    subcategoryId: z.string().min(1, 'Choose a subcategory'),
    title: z
      .string()
      .trim()
      .min(5, 'Property name must be at least 5 characters')
      .max(150, 'Property name must be at most 150 characters'),
    purpose: z.enum(PURPOSES, 'Choose a purpose'),
    priceAmount: optionalNumber('Enter the price in rupees, e.g. 4500000').refine(
      (v) => v === '' || Number(v) > 0,
      'Price must be more than 0',
    ),
    priceBasis: z.enum(PRICE_BASES),
    negotiable: z.boolean(),
    onRequest: z.boolean(),
    deposit: optionalNumber('Enter the deposit in rupees'),
    lockIn: optionalNumber('Enter whole months, e.g. 11', { int: true }),
    areaValue: optionalNumber('Enter the area as a number').refine(
      (v) => v === '' || Number(v) > 0,
      'Area must be more than 0',
    ),
    areaUnit: z.enum(AREA_UNITS),
    location: z.object({
      state: z.string().trim().max(60),
      city: z.string().trim().max(60),
      locality: z.string().trim().max(100),
      pincode: z
        .string()
        .trim()
        .refine((v) => v === '' || PINCODE_PATTERN.test(v), 'Enter a valid 6-digit pincode'),
      address: z.string().trim().max(500),
      landmark: z.string().trim().max(120),
      lat: coordinate(90),
      lng: coordinate(180),
    }),
    // Untouched fields are undefined (= empty); the API checks the values against their types.
    attributeValues: z.record(z.string(), z.union([z.string(), z.array(z.string())]).optional()),
    extraAttributes: z.array(
      z.object({
        label: z.string().trim().min(2, 'Name must be at least 2 characters').max(60),
        type: z.enum(EXTRA_ATTRIBUTE_TYPES),
        value: z.string(),
      }),
    ),
    removedAttributeKeys: z.array(z.string()),
    amenityIds: z.array(z.string()),
    isFeatured: z.boolean(),
  })
  .refine((v) => !(v.location.lat === '' && v.location.lng !== ''), {
    path: ['location', 'lat'],
    message: 'Enter both latitude and longitude, or neither',
    when: () => true,
  })
  .refine((v) => !(v.location.lng === '' && v.location.lat !== ''), {
    path: ['location', 'lng'],
    message: 'Enter both latitude and longitude, or neither',
    when: () => true,
  });

export type PropertyFormValues = z.infer<typeof propertyFormSchema>;

/** What the form shows for a subcategory: common attributes first, then its own. */
export interface FormLayout {
  category: Category;
  subcategory: Subcategory;
  common: PlacedAttribute[];
  own: PlacedAttribute[];
}

export function layoutFor(categories: Category[], subcategoryId: string): FormLayout | null {
  for (const category of categories) {
    const subcategory = category.subcategories.find((s) => s.id === subcategoryId);
    if (subcategory) {
      return {
        category,
        subcategory,
        common: category.commonAttributes,
        own: subcategory.attributes,
      };
    }
  }
  return null;
}

/** Stored value → form text. */
function toField(type: AttributeType, value: unknown): FieldValue {
  if (value === undefined || value === null) return type === 'multi_select' ? [] : '';
  if (type === 'multi_select') return Array.isArray(value) ? value.map(String) : [];
  if (type === 'yes_no') return value === true ? 'yes' : value === false ? 'no' : '';
  return String(value);
}

/** Form text → value sent to the API (null clears it). */
function fromField(
  type: AttributeType | (typeof EXTRA_ATTRIBUTE_TYPES)[number],
  value: FieldValue | undefined,
) {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.length ? value : null;
  const text = value.trim();
  if (text === '') return null;
  if (type === 'number') return Number(text);
  if (type === 'yes_no') return text === 'yes';
  return text;
}

export function emptyValues(): PropertyFormValues {
  return {
    subcategoryId: '',
    title: '',
    purpose: 'sale',
    priceAmount: '',
    priceBasis: 'total',
    negotiable: false,
    onRequest: false,
    deposit: '',
    lockIn: '',
    areaValue: '',
    areaUnit: 'sqft',
    location: {
      state: '',
      city: '',
      locality: '',
      pincode: '',
      address: '',
      landmark: '',
      lat: '',
      lng: '',
    },
    attributeValues: {},
    extraAttributes: [],
    removedAttributeKeys: [],
    amenityIds: [],
    isFeatured: false,
  };
}

export function valuesFromProperty(p: Property, layout: FormLayout | null): PropertyFormValues {
  const attributeValues: Record<string, FieldValue> = {};
  for (const a of layout ? [...layout.common, ...layout.own] : []) {
    attributeValues[a.key] = toField(a.type, p.attributeValues[a.key]);
  }
  return {
    subcategoryId: p.subcategoryId,
    title: p.title,
    purpose: p.purpose,
    priceAmount: p.price.amount === null ? '' : String(p.price.amount),
    priceBasis: p.price.basis,
    negotiable: p.price.negotiable,
    onRequest: p.price.onRequest,
    deposit: p.rental?.securityDeposit == null ? '' : String(p.rental.securityDeposit),
    lockIn: p.rental?.lockInMonths == null ? '' : String(p.rental.lockInMonths),
    areaValue: p.area ? String(p.area.value) : '',
    areaUnit: p.area?.unit ?? 'sqft',
    location: {
      state: p.location.state,
      city: p.location.city,
      locality: p.location.locality,
      pincode: p.location.pincode,
      address: p.location.address,
      landmark: p.location.landmark,
      lat: p.location.mapPin ? String(p.location.mapPin.lat) : '',
      lng: p.location.mapPin ? String(p.location.mapPin.lng) : '',
    },
    attributeValues,
    extraAttributes: p.extraAttributes.map((e) => ({
      label: e.label,
      type: e.type,
      value: e.type === 'yes_no' ? (e.value ? 'yes' : 'no') : String(e.value),
    })),
    removedAttributeKeys: p.removedAttributeKeys,
    amenityIds: p.amenityIds,
    isFeatured: p.isFeatured,
  };
}

/** Form → API body (create; the same body works for an update). */
export function bodyFromValues(v: PropertyFormValues, layout: FormLayout): CreatePropertyBody {
  const attributeValues: Record<string, string | number | boolean | string[] | null> = {};
  for (const a of [...layout.common, ...layout.own]) {
    attributeValues[a.key] = v.removedAttributeKeys.includes(a.key)
      ? null
      : fromField(a.type, v.attributeValues[a.key]);
  }
  const extraAttributes = v.extraAttributes.flatMap((e) => {
    const value = fromField(e.type, e.value);
    return value === null || Array.isArray(value)
      ? []
      : [{ label: e.label.trim(), type: e.type, value }];
  });
  const num = (text: string) => (text.trim() === '' ? null : Number(text));
  return {
    subcategoryId: v.subcategoryId,
    title: v.title.trim(),
    purpose: v.purpose,
    price: {
      amount: num(v.priceAmount),
      basis: v.priceBasis,
      negotiable: v.negotiable,
      onRequest: v.onRequest,
    },
    rental:
      v.purpose === 'sale'
        ? null
        : { securityDeposit: num(v.deposit), lockInMonths: num(v.lockIn) },
    area: v.areaValue.trim() === '' ? null : { value: Number(v.areaValue), unit: v.areaUnit },
    location: {
      state: v.location.state.trim(),
      city: v.location.city.trim(),
      locality: v.location.locality.trim(),
      pincode: v.location.pincode.trim(),
      address: v.location.address.trim(),
      landmark: v.location.landmark.trim(),
      mapPin:
        v.location.lat.trim() !== '' && v.location.lng.trim() !== ''
          ? { lat: Number(v.location.lat), lng: Number(v.location.lng) }
          : null,
    },
    attributeValues,
    extraAttributes,
    removedAttributeKeys: v.removedAttributeKeys,
    amenityIds: v.amenityIds,
    isFeatured: v.isFeatured,
  };
}

/** Maps an API error path ("body.price.amount") to the form field that shows it. */
export function fieldForErrorPath(path: string): string | null {
  const p = path.replace(/^body\./, '');
  const direct: Record<string, string> = {
    title: 'title',
    purpose: 'purpose',
    subcategoryId: 'subcategoryId',
    'price.amount': 'priceAmount',
    'area.value': 'areaValue',
    'rental.securityDeposit': 'deposit',
    'rental.lockInMonths': 'lockIn',
    'location.mapPin.lat': 'location.lat',
    'location.mapPin.lng': 'location.lng',
    amenityIds: 'amenityIds',
  };
  if (direct[p]) return direct[p];
  if (/^location\.(state|city|locality|pincode|address|landmark)$/.test(p)) return p;
  const attr = /^attributeValues\.(.+)$/.exec(p);
  if (attr) return `attributeValues.${attr[1]}`;
  const extra = /^extraAttributes\.(\d+)/.exec(p);
  if (extra) return `extraAttributes.${extra[1]}.label`;
  return null;
}

/** Splits API error details into field errors and messages without a field. */
export function splitErrors(details: ApiErrorDetail[] | undefined) {
  const fields: { name: string; message: string }[] = [];
  const other: string[] = [];
  for (const d of details ?? []) {
    const name = fieldForErrorPath(d.path);
    if (name) fields.push({ name, message: d.message });
    else other.push(d.message);
  }
  return { fields, other };
}
