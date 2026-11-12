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
