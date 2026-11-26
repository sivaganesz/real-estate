import { PlaceInput, distanceKm, estimateMinutes, mapPoint, type PlaceKind } from '@estate/shared';
import { Property } from '../models/property';
import { audit, type Actor } from '../lib/auth';
import { HttpError, badRequest, notFound, parse } from '../lib/http';

/**
 * OpenStreetMap's free query service (Overpass). No key. The public servers are
 * often busy, so we ask the main one and a mirror at once and take the first
 * answer. OVERPASS_URL (comma-separated) replaces the list, e.g. for a self-hosted one.
 */
const OVERPASS_URLS = (process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter,https://maps.mail.ru/osm/tools/overpass/api/interpreter').split(',').map((u) => u.trim()).filter(Boolean);

/** Runs one Overpass query on every server at once; the first good answer wins and the others are cancelled. */
async function overpass(query: string): Promise<OsmElement[]> {
  const controllers = OVERPASS_URLS.map(() => new AbortController());
  const timer = setTimeout(() => controllers.forEach((c) => c.abort()), 60_000);
  try {
    return await Promise.any(
      OVERPASS_URLS.map(async (url, i) => {
        // Busy servers answer 429/502/503/504 and ask for a retry with backoff: 2 s, 5 s, 10 s.
        let res: Response | undefined;
        for (const wait of [0, 2_000, 5_000, 10_000]) {
          if (wait) await new Promise((ok) => setTimeout(ok, wait));
          if (controllers[i].signal.aborted) throw new Error(`${url}: cancelled`);
          res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'EstateOS/0.1 (nearby places lookup)' },
            body: `data=${encodeURIComponent(query)}`,
            signal: controllers[i].signal,
          });
          if (![429, 502, 503, 504].includes(res.status)) break;
        }
        if (!res?.ok) throw new Error(`${url}: status ${res?.status}`);
        const elements = ((await res.json()) as { elements?: OsmElement[] }).elements ?? [];
        controllers.forEach((c, j) => j !== i && c.abort());
        return elements;
      }),
    );
  } finally {
    clearTimeout(timer);
  }
}

type PlaceDoc = { _id: unknown; name: string; kind: string; distanceKm?: number | null; minutes?: number | null; lat?: number | null; lng?: number | null; routeChecked?: boolean; advertise?: boolean; source?: string };

export function serialisePlace(n: PlaceDoc) {
  return { id: String(n._id), name: n.name, kind: n.kind, distanceKm: n.distanceKm ?? 0, minutes: n.minutes ?? 0, lat: n.lat ?? null, lng: n.lng ?? null, routeChecked: !!n.routeChecked, advertise: !!n.advertise, source: n.source ?? 'team' };
}

/** What buyers see: only places the team marked OK to advertise, nearest first. */
export function advertisedPlaces(nearby: PlaceDoc[] | undefined) {
  return (nearby ?? [])
    .filter((n) => n.advertise)
    .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
    .map((n) => ({ name: n.name, kind: n.kind, distanceKm: n.distanceKm ?? 0, minutes: n.minutes ?? 0 }));
}

async function load(id: string) {
  const p = await Property.findById(id);
  if (!p) throw notFound('Property');
  return p;
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export async function addPlace(id: string, raw: unknown, actor: Actor) {
  const input = parse(PlaceInput, raw);
  const p = await load(id);
  if (p.nearby.some((n) => sameName(n.name, input.name))) throw badRequest(`${input.name} is already in the list`);
  p.nearby.push({ ...input, minutes: input.minutes ?? estimateMinutes(input.distanceKm), source: 'team' });
  await p.save();
  await audit(actor, 'property', p._id, 'nearby', `Added nearby place: ${input.name}`);
  return p.toObject();
}

export async function updatePlace(id: string, placeId: string, raw: unknown, actor: Actor) {
  const input = parse(PlaceInput.partial(), raw);
  const p = await load(id);
  const place = p.nearby.id(placeId);
  if (!place) throw notFound('Place');
  if (input.name && p.nearby.some((n) => String(n._id) !== placeId && sameName(n.name, input.name!))) throw badRequest(`${input.name} is already in the list`);
  // A new distance without new minutes gets a fresh estimate.
  if (input.distanceKm !== undefined && input.minutes === undefined) input.minutes = estimateMinutes(input.distanceKm);
  place.set(input);
  await p.save();
  await audit(actor, 'property', p._id, 'nearby', `Updated nearby place: ${place.name}`);
  return p.toObject();
}

export async function removePlace(id: string, placeId: string, actor: Actor) {
  const p = await load(id);
  const place = p.nearby.id(placeId);
  if (!place) throw notFound('Place');
  const name = place.name;
  place.deleteOne();
  await p.save();
  await audit(actor, 'property', p._id, 'nearby', `Removed nearby place: ${name}`);
  return p.toObject();
}

type OsmElement = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

/** What an OpenStreetMap feature is to a buyer, or null if we don't list it. */
export function kindOf(tags: Record<string, string>): PlaceKind | null {
  if (tags.station === 'subway' || (tags.railway === 'station' && tags.subway === 'yes')) return 'metro';
  if (tags.railway === 'station' || tags.railway === 'halt') return 'train';
  if (tags.highway === 'bus_stop' || tags.amenity === 'bus_station') return 'bus';
  if (tags.amenity === 'school') return 'school';
  if (tags.amenity === 'college' || tags.amenity === 'university') return 'college';
  if (tags.amenity === 'hospital') return 'hospital';
  if (tags.shop === 'mall') return 'mall';
  if (tags.shop === 'supermarket' || tags.shop === 'department_store') return 'shop';
  if (tags.amenity === 'marketplace') return 'market';
  return null;
}

/** How many of each kind the list holds at most from "Find more places", nearest first. */
const PER_KIND: Record<PlaceKind, number> = { bus: 1, train: 1, metro: 1, road: 0, school: 2, college: 1, hospital: 2, shop: 1, mall: 1, market: 1 };

/**
 * Looks up schools, hospitals, shops and bus/train/metro stops around the
 * property on OpenStreetMap and adds the nearest ones it doesn't have yet.
 * New places start unchecked and not advertised: the team reviews them first.
 */
export async function discoverPlaces(id: string, actor: Actor) {
  const p = await load(id);
  const point = mapPoint({ location: p.location?.lat != null && p.location?.lng != null ? { lat: p.location.lat, lng: p.location.lng } : null, locality: p.locality, city: p.city });
  if (!point) throw badRequest("Set the property's location first, so we know where to look");
  const at = `${point.lat},${point.lng}`;
  const query = `[out:json][timeout:25];
(
  nwr["amenity"~"^(school|college|university|hospital|marketplace|bus_station)$"]["name"](around:3000,${at});
  nwr["shop"~"^(supermarket|department_store|mall)$"]["name"](around:3000,${at});
  node["highway"="bus_stop"]["name"](around:1500,${at});
  nwr["railway"~"^(station|halt)$"]["name"](around:6000,${at});
);
out center 300;`;

  let elements: OsmElement[];
  try {
    elements = await overpass(query);
  } catch (err) {
    const reasons = err instanceof AggregateError ? err.errors : [err];
    console.error('[overpass]', reasons.map((e) => (e instanceof Error ? e.message : String(e))).join('; '));
    throw new HttpError(503, "Couldn't reach OpenStreetMap just now. Try again in a minute, or add places by hand.");
  }

  const known = new Set(p.nearby.map((n) => n.osmId).filter(Boolean));
  const candidates = elements
    .map((e) => {
      const kind = e.tags ? kindOf(e.tags) : null;
      const lat = e.lat ?? e.center?.lat;
      const lng = e.lon ?? e.center?.lon;
      const name = e.tags?.['name:en'] || e.tags?.name;
      if (!kind || !name || lat === undefined || lng === undefined) return null;
      return { osmId: `${e.type}/${e.id}`, kind, name, lat, lng, distanceKm: Math.round(distanceKm(point, { lat, lng }) * 10) / 10 };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null && !known.has(c.osmId) && !p.nearby.some((n) => sameName(n.name, c.name)))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  // Count what the list already has, so pressing it again only fills gaps (e.g. after the team removed one).
  const taken: Partial<Record<PlaceKind, number>> = {};
  for (const n of p.nearby) taken[n.kind as PlaceKind] = (taken[n.kind as PlaceKind] ?? 0) + 1;
  const seen = new Set<string>();
  const picked: { kind: string; lat: number; lng: number }[] = [];
  let added = 0;
  for (const c of candidates) {
    // The same station is often mapped twice (a node and an area): keep one per name.
    const key = c.name.trim().toLowerCase();
    if (seen.has(key) || (taken[c.kind] ?? 0) >= PER_KIND[c.kind]) continue;
    // One place mapped under two names ("Chettinad Hospital" and "Chettinadu Hospital & Research Institute"): same kind within 200 m.
    const twin = [...p.nearby, ...picked].some((n) => n.kind === c.kind && n.lat != null && n.lng != null && distanceKm({ lat: n.lat, lng: n.lng }, c) < 0.2);
    if (twin) continue;
    picked.push(c);
    seen.add(key);
    taken[c.kind] = (taken[c.kind] ?? 0) + 1;
    p.nearby.push({ ...c, minutes: estimateMinutes(c.distanceKm), routeChecked: false, advertise: false, source: 'osm' });
    added++;
  }
  if (added) {
    await p.save();
    await audit(actor, 'property', p._id, 'nearby', `Found ${added} nearby place${added === 1 ? '' : 's'} on OpenStreetMap`);
  }
  return { added, approximate: point.level !== 'exact', property: p.toObject() };
}
