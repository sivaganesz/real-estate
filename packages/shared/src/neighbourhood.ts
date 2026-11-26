import { z } from 'zod';

/**
 * Places near a property, grouped the way buyers ask about them. Found from
 * OpenStreetMap or added by the team; the team checks the route and decides
 * which ones may be shown to buyers ("OK to advertise").
 */
export const PLACE_CATEGORIES = ['commute', 'schools', 'hospitals', 'shopping'] as const;
export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];
export const PLACE_CATEGORY_LABEL: Record<PlaceCategory, string> = {
  commute: 'Commute',
  schools: 'Schools & colleges',
  hospitals: 'Hospitals',
  shopping: 'Shopping',
};

/** What kind of place it is, for its icon. */
export const PLACE_KINDS = ['bus', 'train', 'metro', 'road', 'school', 'college', 'hospital', 'shop', 'mall', 'market'] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];
export const PLACE_KIND_CATEGORY: Record<PlaceKind, PlaceCategory> = {
  bus: 'commute',
  train: 'commute',
  metro: 'commute',
  road: 'commute',
  school: 'schools',
  college: 'schools',
  hospital: 'hospitals',
  shop: 'shopping',
  mall: 'shopping',
  market: 'shopping',
};
export const PLACE_KIND_LABEL: Record<PlaceKind, string> = {
  bus: 'Bus stop',
  train: 'Railway station',
  metro: 'Metro station',
  road: 'Main road / highway',
  school: 'School',
  college: 'College',
  hospital: 'Hospital',
  shop: 'Supermarket / shop',
  mall: 'Mall',
  market: 'Market',
};

/** A place as the team adds or edits it. Minutes are estimated from the distance when left out. */
export const PlaceInput = z.object({
  name: z.string().trim().min(2, 'Give the place a name').max(80),
  kind: z.enum(PLACE_KINDS),
  distanceKm: z.number().min(0).max(50),
  minutes: z.number().int().min(0).max(240).nullish(),
  routeChecked: z.boolean().default(false),
  advertise: z.boolean().default(false),
});
export type PlaceInput = z.infer<typeof PlaceInput>;

export type NearbyPlace = PlaceInput & {
  id: string;
  minutes: number;
  lat?: number | null;
  lng?: number | null;
  source: 'osm' | 'team';
};

/** Straight-line distance in km between two points. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Rough drive time in city traffic: roads wind (×1.3 the straight line) at
 * about 20 km/h, plus a minute to get going. The team corrects it after checking.
 */
export function estimateMinutes(km: number): number {
  return Math.max(2, Math.round(((km * 1.3) / 20) * 60 + 1));
}
