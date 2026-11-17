import { ATTRIBUTE_TYPE_LABELS } from '@real-estate/shared';
import type { AttributeReview, PlacedAttribute } from '@real-estate/shared';
import { formatDate } from '@/lib/format';

/** "1 attribute", "3 attributes". */
export const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Friendly names for the amenity icons (tooltips and screen readers). */
export const AMENITY_ICON_LABELS: Record<string, string> = {
  'shield-check': 'Security',
  cctv: 'CCTV',
  fence: 'Gate / fence',
  car: 'Parking',
  zap: 'Power',
  'arrow-up-down': 'Lift',
  waves: 'Pool',
  dumbbell: 'Gym',
  baby: 'Kids',
  trees: 'Garden',
  'building-2': 'Club house',
  'cloud-rain': 'Rainwater',
  droplets: 'Water',
  lightbulb: 'Lights',
  route: 'Road',
  wifi: 'Internet',
  flame: 'Gas',
  sun: 'Solar',
  store: 'Shops',
  sparkles: 'Other',
};

const MAX_OPTIONS_SHOWN = 4;

/** "Added from property RE-PLT-000004 by Meena on 17 Nov 2026" (PROP-20). */
export function reviewText(review: AttributeReview): string {
  return [
    `Added from ${review.propertyCode ? `property ${review.propertyCode}` : 'a new property'}`,
    review.addedBy && `by ${review.addedBy.name}`,
    `on ${formatDate(review.at)}`,
  ]
    .filter(Boolean)
    .join(' ');
}

/** "Number · ft", "Dropdown · DTCP, CMDA, Panchayat, Unapproved", "Dropdown · 1 RK, 1 BHK, … (6)". */
export function describeType(attribute: Pick<PlacedAttribute, 'type' | 'unit' | 'options'>) {
  const { type, unit, options } = attribute;
  let detail = '';
  if (unit) detail = unit;
  if (options.length > 0) {
    detail =
      options.length > MAX_OPTIONS_SHOWN
        ? `${options.slice(0, MAX_OPTIONS_SHOWN).join(', ')}, … (${options.length})`
        : options.join(', ');
  }
  return { label: ATTRIBUTE_TYPE_LABELS[type], detail };
}
