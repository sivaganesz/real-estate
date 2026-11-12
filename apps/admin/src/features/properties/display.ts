import {
  formatArea,
  formatINR,
  formatPrice,
  PROPERTY_STATUS_LABELS,
  PURPOSE_LABELS,
} from '@real-estate/shared';
import type {
  AttributeValue,
  Category,
  PlacedAttribute,
  PropertyStatus,
  Purpose,
} from '@real-estate/shared';
import { formatDate } from '@/lib/format';

/** "3 BHK", "1,850 sq.ft", "Yes", "Gym, Pool", "12 Nov 2026". Empty values return null. */
export function formatAttributeValue(
  a: Pick<PlacedAttribute, 'type' | 'unit'>,
  value: AttributeValue | undefined,
): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (Array.isArray(value)) return value.length ? value.join(', ') : null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (a.type === 'number' && typeof value === 'number') {
    const shown = value.toLocaleString('en-IN');
    if (!a.unit) return shown;
    return a.unit.startsWith('₹') ? `₹${shown}${a.unit.slice(1)}` : `${shown} ${a.unit}`;
  }
  if (a.type === 'date' && typeof value === 'string') return formatDate(`${value}T00:00:00`);
  return String(value);
}

/** Labels of every attribute (by key) and amenity (by id), for the change history. */
export function namesFrom(categories: Category[]) {
  const attributes = new Map<string, string>();
  const amenities = new Map<string, string>();
  const subcategories = new Map<string, string>();
  for (const c of categories) {
    for (const a of c.commonAttributes) attributes.set(a.key, a.label);
    for (const s of c.subcategories) {
      subcategories.set(s.id, s.name);
      for (const a of s.attributes) attributes.set(a.key, a.label);
    }
    for (const a of c.amenities) amenities.set(a.id, a.name);
  }
  return { attributes, amenities, subcategories };
}

const FIELD_LABELS: Record<string, string> = {
  title: 'Property name',
  purpose: 'Purpose',
  subcategoryId: 'Subcategory',
  price: 'Price',
  rental: 'Rent details',
  area: 'Area',
  location: 'Location',
  isFeatured: 'Featured',
  amenityIds: 'Amenities',
  extraAttributes: 'Extra details',
  removedAttributeKeys: 'Removed details',
  status: 'Status',
  code: 'Code',
  media: 'File',
  cover: 'Cover photo',
};

export const ACTION_LABELS: Record<string, string> = {
  created: 'Created as draft',
  updated: 'Edited',
  status_changed: 'Status changed',
  archived: 'Archived',
  duplicated: 'Created as a copy',
  media_added: 'File added',
  media_removed: 'File deleted',
  media_reordered: 'Files reordered',
  cover_changed: 'Cover photo changed',
};

type Names = ReturnType<typeof namesFrom>;

export function historyFieldLabel(field: string, names: Names): string {
  const attr = /^attributes\.(.+)$/.exec(field);
  if (attr) return names.attributes.get(attr[1]!) ?? attr[1]!;
  return FIELD_LABELS[field] ?? field;
}

/** One side of a history change, in words. */
export function historyValue(field: string, value: unknown, names: Names): string {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'status') return PROPERTY_STATUS_LABELS[value as PropertyStatus] ?? String(value);
  if (field === 'purpose') return PURPOSE_LABELS[value as Purpose] ?? String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' || typeof value === 'string') return String(value);
  if (field === 'price' && typeof value === 'object') {
    return formatPrice(value as Parameters<typeof formatPrice>[0]);
  }
  if (field === 'area' && typeof value === 'object') {
    const a = value as { value: number; unit: Parameters<typeof formatArea>[1] };
    return formatArea(a.value, a.unit);
  }
  if (field === 'rental' && typeof value === 'object') {
    const r = value as { securityDeposit: number | null; lockInMonths: number | null };
    return (
      [
        r.securityDeposit !== null && `deposit ${formatINR(r.securityDeposit)}`,
        r.lockInMonths !== null && `lock-in ${r.lockInMonths} months`,
      ]
        .filter(Boolean)
        .join(', ') || '—'
    );
  }
  if (field === 'location' && typeof value === 'object') {
    const l = value as Record<string, string>;
    return [l.locality, l.city, l.pincode].filter(Boolean).join(', ') || '—';
  }
  if (Array.isArray(value)) {
    if (field === 'amenityIds')
      return (
        value.map((id) => names.amenities.get(String(id)) ?? 'removed amenity').join(', ') || '—'
      );
    if (field === 'removedAttributeKeys')
      return value.map((k) => names.attributes.get(String(k)) ?? String(k)).join(', ') || '—';
    if (field === 'extraAttributes')
      return value.map((e) => (e as { label: string }).label).join(', ') || '—';
    return value.join(', ') || '—';
  }
  return JSON.stringify(value);
}
