import {
  AREA_UNIT_LABELS,
  AREA_UNITS,
  IMPORT_MAX_IMAGES_PER_ROW,
  normalizeLabel,
  PURPOSE_LABELS,
  PURPOSES,
} from '@real-estate/shared';
import type {
  AreaUnit,
  AttributeType,
  CreatePropertyBody,
  PriceBasis,
  Purpose,
} from '@real-estate/shared';
import type { FormDefinition } from '../propertyTypes/propertyTypes.service';

/** A spreadsheet cell after reading (rich text, links and formulas reduced to their value). */
export type CellValue = string | number | boolean | Date | null;

type ColumnKind = 'text' | 'number' | 'yes_no' | 'list' | 'multi' | 'date' | 'urls';

export interface ImportColumn {
  /** "title", "price", "attr:bhk"… */
  key: string;
  header: string;
  kind: ColumnKind;
  /** Allowed values for list columns (shown as a dropdown in Excel). */
  options?: string[];
  /** Shown on the Instructions sheet. */
  help: string;
  /** For the Instructions sheet: needed to import (name, purpose) or to publish. */
  need: 'import' | 'publish' | 'optional';
  width: number;
  sample: CellValue;
}

const BASIS_LABELS: Record<PriceBasis, string> = {
  total: 'Total',
  per_sqft: 'Per sq.ft',
  per_month: 'Per month',
};
const YES_NO = ['Yes', 'No'];

/** Header text without the " *" mark and extra spaces, for matching uploaded columns. */
export const headerKey = (header: string) => normalizeLabel(header.replace(/\*/g, ''));

function attributeKind(type: AttributeType): ColumnKind {
  switch (type) {
    case 'number':
      return 'number';
    case 'yes_no':
      return 'yes_no';
    case 'dropdown':
      return 'list';
    case 'multi_select':
      return 'multi';
    case 'date':
      return 'date';
    default:
      return 'text';
  }
}

const SAMPLES: Record<string, CellValue> = {
  title: '3 BHK independent villa with garden',
  price: 12500000,
  area: 2100,
  city: 'Chennai',
  locality: 'Tambaram',
  pincode: '600045',
  state: 'Tamil Nadu',
};

/** The template's columns for one subcategory, in order. */
export function columnsFor(def: FormDefinition): ImportColumn[] {
  const purposes = def.subcategory.purposes.map((p) => PURPOSE_LABELS[p]);
  const amenities = def.amenities.filter((a) => a.isActive).map((a) => a.name);
  const core: ImportColumn[] = [
    {
      key: 'title',
      header: 'Property name *',
      kind: 'text',
      need: 'import',
      width: 36,
      help: '5 to 150 characters.',
      sample: SAMPLES.title!,
    },
    {
      key: 'purpose',
      header: 'Purpose *',
      kind: 'list',
      options: purposes,
      need: 'import',
      width: 12,
      help: `One of: ${purposes.join(', ')}.`,
      sample: purposes[0]!,
    },
    {
      key: 'price',
      header: 'Price (₹)',
      kind: 'number',
      need: 'publish',
      width: 14,
      help: 'In rupees, digits only (e.g. 4500000). For rent or lease: the monthly rent.',
      sample: SAMPLES.price!,
    },
    {
      key: 'priceBasis',
      header: 'Price basis',
      kind: 'list',
      options: Object.values(BASIS_LABELS),
      need: 'optional',
      width: 12,
      help: 'Total (default for sale), Per sq.ft, or Per month (default for rent / lease).',
      sample: 'Total',
    },
    {
      key: 'negotiable',
      header: 'Negotiable',
      kind: 'yes_no',
      options: YES_NO,
      need: 'optional',
      width: 11,
      help: 'Yes or No.',
      sample: 'Yes',
    },
    {
      key: 'onRequest',
      header: 'Price on request',
      kind: 'yes_no',
      options: YES_NO,
      need: 'optional',
      width: 14,
      help: 'Yes hides the price. Then the price can be left empty.',
      sample: 'No',
    },
    {
      key: 'deposit',
      header: 'Security deposit (₹)',
      kind: 'number',
      need: 'optional',
      width: 16,
      help: 'Rent / lease only.',
      sample: null,
    },
    {
      key: 'lockIn',
      header: 'Lock-in (months)',
      kind: 'number',
      need: 'optional',
      width: 14,
      help: 'Rent / lease only. Whole months.',
      sample: null,
    },
    {
      key: 'area',
      header: 'Area',
      kind: 'number',
      need: 'publish',
      width: 10,
      help: 'Number, in the unit of the next column.',
      sample: SAMPLES.area!,
    },
    {
      key: 'areaUnit',
      header: 'Area unit',
      kind: 'list',
      options: AREA_UNITS.map((u) => AREA_UNIT_LABELS[u]),
      need: 'optional',
      width: 10,
      help: 'sq.ft (default), sq.yd, sq.m, cent, ground, acre or hectare.',
      sample: 'sq.ft',
    },
    {
      key: 'city',
      header: 'City',
      kind: 'text',
      need: 'publish',
      width: 14,
      help: 'e.g. Chennai.',
      sample: SAMPLES.city!,
    },
    {
      key: 'locality',
      header: 'Area / locality',
      kind: 'text',
      need: 'publish',
      width: 18,
      help: 'e.g. Tambaram.',
      sample: SAMPLES.locality!,
    },
    {
      key: 'pincode',
      header: 'Pincode',
      kind: 'text',
      need: 'publish',
      width: 10,
      help: '6 digits.',
      sample: SAMPLES.pincode!,
    },
    {
      key: 'state',
      header: 'State',
      kind: 'text',
      need: 'optional',
      width: 14,
      help: 'e.g. Tamil Nadu.',
      sample: SAMPLES.state!,
    },
    {
      key: 'address',
      header: 'Full address',
      kind: 'text',
      need: 'optional',
      width: 28,
      help: 'Door number and street.',
      sample: null,
    },
    {
      key: 'landmark',
      header: 'Landmark',
      kind: 'text',
      need: 'optional',
      width: 16,
      help: 'e.g. Near the railway station.',
      sample: null,
    },
    {
      key: 'lat',
      header: 'Latitude',
      kind: 'number',
      need: 'optional',
      width: 11,
      help: 'Map pin, e.g. 12.9249 (with Longitude).',
      sample: null,
    },
    {
      key: 'lng',
      header: 'Longitude',
      kind: 'number',
      need: 'optional',
      width: 11,
      help: 'Map pin, e.g. 80.1000 (with Latitude).',
      sample: null,
    },
  ];
  const attributes: ImportColumn[] = def.attributes.map(({ attribute: a, required }) => {
    const kind = attributeKind(a.type);
    const header = `${a.label}${a.unit ? ` (${a.unit})` : ''}${required ? ' *' : ''}`;
    const help =
      kind === 'list'
        ? `One of: ${a.options.join(', ')}.`
        : kind === 'multi'
          ? `Any of: ${a.options.join(', ')} (separate with commas).`
          : kind === 'yes_no'
            ? 'Yes or No.'
            : kind === 'number'
              ? `Number${a.unit ? ` in ${a.unit}` : ''}.`
              : kind === 'date'
                ? 'A date (e.g. 2026-11-12).'
                : 'Text.';
    return {
      key: `attr:${a.key}`,
      header,
      kind,
      options:
        kind === 'yes_no'
          ? YES_NO
          : kind === 'list'
            ? a.options
            : a.options.length
              ? a.options
              : undefined,
      need: required ? 'publish' : 'optional',
      width: Math.min(28, Math.max(12, header.length + 2)),
      help,
      sample: null,
    };
  });
  const extra: ImportColumn[] = [
    {
      key: 'amenities',
      header: 'Amenities',
      kind: 'multi',
      options: amenities,
      need: 'optional',
      width: 30,
      help: amenities.length
        ? `Any of: ${amenities.join(', ')} (separate with commas).`
        : 'No amenities are set up for this subcategory.',
      sample: amenities.slice(0, 2).join(', ') || null,
    },
    {
      key: 'featured',
      header: 'Featured',
      kind: 'yes_no',
      options: YES_NO,
      need: 'optional',
      width: 10,
      help: 'Yes or No.',
      sample: 'No',
    },
    {
      key: 'images',
      header: 'Image URLs',
      kind: 'urls',
      need: 'publish',
      width: 40,
      help: `Up to ${IMPORT_MAX_IMAGES_PER_ROW} photo links (https, JPG / PNG / WebP), separated by commas. The first one becomes the cover. Publishing needs at least one photo.`,
      sample: null,
    },
  ];
  return [...core, ...attributes, ...extra];
}

// ------------------------------------------------------------------ reading cells

const asText = (v: CellValue): string => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
};

function asNumber(v: CellValue, header: string, errors: string[]): number | null {
  if (v === null || v === '') return null;
  if (typeof v === 'number') return v;
  const text = asText(v).replace(/[,₹\s]/g, '');
  if (text === '') return null;
  const n = Number(text);
  if (!Number.isFinite(n)) {
    errors.push(`${header}: "${asText(v)}" isn't a number`);
    return null;
  }
  return n;
}

function asYesNo(v: CellValue, header: string, errors: string[]): boolean | null {
  if (v === null || v === '') return null;
  if (typeof v === 'boolean') return v;
  const t = asText(v).toLowerCase();
  if (['yes', 'y', 'true', '1'].includes(t)) return true;
  if (['no', 'n', 'false', '0'].includes(t)) return false;
  errors.push(`${header}: use Yes or No`);
  return null;
}

function asChoice<T extends string>(
  v: CellValue,
  header: string,
  choices: Record<T, string>,
  errors: string[],
): T | null {
  const t = asText(v).toLowerCase();
  if (!t) return null;
  const hit = (Object.entries(choices) as [T, string][]).find(
    ([key, label]) => key === t || label.toLowerCase() === t,
  );
  if (!hit) errors.push(`${header}: use one of ${Object.values<string>(choices).join(', ')}`);
  return hit ? hit[0] : null;
}

const splitList = (v: CellValue) =>
  asText(v)
    .split(/[,\n;]/)
    .map((s) => s.trim())
    .filter(Boolean);

export interface ParsedRow {
  body: CreatePropertyBody;
  imageUrls: string[];
  errors: string[];
}

/**
 * One spreadsheet row → a create-property body. Simple format problems (not a number, not
 * Yes / No…) are listed here; the full checks run afterwards, as for Add property.
 */
export function parseRow(
  def: FormDefinition,
  columns: ImportColumn[],
  cells: Map<string, CellValue>,
): ParsedRow {
  const errors: string[] = [];
  const get = (key: string) => cells.get(key) ?? null;
  const header = (key: string) =>
    columns.find((c) => c.key === key)?.header.replace(/\s*\*$/, '') ?? key;

  const purposeLabels = Object.fromEntries(PURPOSES.map((p) => [p, PURPOSE_LABELS[p]])) as Record<
    Purpose,
    string
  >;
  const purpose =
    asChoice(get('purpose'), header('purpose'), purposeLabels, errors) ??
    def.subcategory.purposes[0]!;
  const basis =
    asChoice(get('priceBasis'), header('priceBasis'), BASIS_LABELS, errors) ??
    (purpose === 'sale' ? 'total' : 'per_month');
  const unitLabels = Object.fromEntries(AREA_UNITS.map((u) => [u, AREA_UNIT_LABELS[u]])) as Record<
    AreaUnit,
    string
  >;
  const unit = asChoice(get('areaUnit'), header('areaUnit'), unitLabels, errors) ?? 'sqft';
  const areaValue = asNumber(get('area'), header('area'), errors);
  const lat = asNumber(get('lat'), header('lat'), errors);
  const lng = asNumber(get('lng'), header('lng'), errors);
  if ((lat === null) !== (lng === null))
    errors.push('Latitude and Longitude: fill both or neither');

  const attributeValues: Record<string, string | number | boolean | string[] | null> = {};
  for (const { attribute: a } of def.attributes) {
    const key = `attr:${a.key}`;
    const v = get(key);
    const h = header(key);
    switch (attributeKind(a.type)) {
      case 'number':
        attributeValues[a.key] = asNumber(v, h, errors);
        break;
      case 'yes_no':
        attributeValues[a.key] = asYesNo(v, h, errors);
        break;
      case 'multi':
        attributeValues[a.key] = splitList(v);
        break;
      default:
        attributeValues[a.key] = asText(v) || null;
    }
  }

  const amenityNames = splitList(get('amenities'));
  const amenityIds: string[] = [];
  for (const name of amenityNames) {
    const hit = def.amenities.find((a) => normalizeLabel(a.name) === normalizeLabel(name));
    if (hit) amenityIds.push(hit._id);
    else errors.push(`Amenities: "${name}" isn't an amenity of ${def.subcategory.name}`);
  }

  const imageUrls = splitList(get('images'));
  if (imageUrls.length > IMPORT_MAX_IMAGES_PER_ROW) {
    errors.push(`Image URLs: up to ${IMPORT_MAX_IMAGES_PER_ROW} links`);
  }
  for (const url of imageUrls) {
    if (!/^https:\/\/\S+$/i.test(url)) errors.push(`Image URLs: "${url}" must be an https link`);
  }

  const body: CreatePropertyBody = {
    subcategoryId: def.subcategory._id,
    title: asText(get('title')),
    purpose,
    price: {
      amount: asNumber(get('price'), header('price'), errors),
      basis,
      negotiable: asYesNo(get('negotiable'), header('negotiable'), errors) ?? false,
      onRequest: asYesNo(get('onRequest'), header('onRequest'), errors) ?? false,
    },
    rental:
      purpose === 'sale'
        ? null
        : {
            securityDeposit: asNumber(get('deposit'), header('deposit'), errors),
            lockInMonths: asNumber(get('lockIn'), header('lockIn'), errors),
          },
    area: areaValue === null ? null : { value: areaValue, unit },
    location: {
      state: asText(get('state')),
      city: asText(get('city')),
      locality: asText(get('locality')),
      pincode: asText(get('pincode')).replace(/\.0$/, ''),
      address: asText(get('address')),
      landmark: asText(get('landmark')),
      mapPin: lat !== null && lng !== null ? { lat, lng } : null,
    },
    attributeValues,
    amenityIds,
    isFeatured: asYesNo(get('featured'), header('featured'), errors) ?? false,
  };
  return { body, imageUrls: imageUrls.slice(0, IMPORT_MAX_IMAGES_PER_ROW), errors };
}

/** Turns an API error path into the spreadsheet column name for row messages. */
export function columnForPath(path: string, columns: ImportColumn[]): string {
  const p = path.replace(/^body\./, '');
  const direct: Record<string, string> = {
    title: 'title',
    purpose: 'purpose',
    'price.amount': 'price',
    'area.value': 'area',
    'rental.securityDeposit': 'deposit',
    'rental.lockInMonths': 'lockIn',
    'location.city': 'city',
    'location.locality': 'locality',
    'location.pincode': 'pincode',
    'location.state': 'state',
    'location.address': 'address',
    'location.landmark': 'landmark',
    'location.mapPin.lat': 'lat',
    'location.mapPin.lng': 'lng',
    amenityIds: 'amenities',
  };
  const attr = /^attributeValues\.(.+)$/.exec(p);
  const key = attr ? `attr:${attr[1]}` : direct[p];
  const col = key ? columns.find((c) => c.key === key) : undefined;
  return col ? col.header.replace(/\s*\*$/, '') : '';
}
