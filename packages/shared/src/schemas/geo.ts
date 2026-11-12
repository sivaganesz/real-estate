import { z } from 'zod';

/** A place found on the map: coordinates plus the address parts we could read. */
export const geoPlaceSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  /** Full place name, e.g. "Tambaram, Chengalpattu, Tamil Nadu, 600045, India". */
  label: z.string(),
  locality: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  pincode: z.string().nullable(),
});
export type GeoPlace = z.infer<typeof geoPlaceSchema>;

const part = (max: number) => z.string().trim().max(max).optional();

/** GET /admin/geo/search: where is this address? (at least one part) */
export const geoSearchQuerySchema = z
  .object({
    locality: part(100),
    city: part(60),
    state: part(60),
    pincode: part(6),
  })
  .refine((q) => Boolean(q.locality || q.city || q.state || q.pincode), {
    message: 'Enter a city, area or pincode',
    path: ['city'],
  });
export type GeoSearchQuery = z.infer<typeof geoSearchQuerySchema>;

/** GET /admin/geo/reverse: what is at this map pin? */
export const geoReverseQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});
