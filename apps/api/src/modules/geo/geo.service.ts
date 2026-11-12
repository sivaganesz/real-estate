import type { GeoPlace, GeoSearchQuery } from '@real-estate/shared';
import type { Env } from '../../config/env';
import { upstreamError } from '../../lib/errors';
import type { Logger } from '../../lib/logger';

/** OpenStreetMap Nominatim result (only the fields we use). */
interface NominatimPlace {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;
/** Nominatim's usage policy: at most one request per second, with an identifying User-Agent. */
const MIN_GAP_MS = 1100;
const USER_AGENT = 'RealEstateAdminPortal/0.1 (self-hosted property admin)';

function toPlace(p: NominatimPlace): GeoPlace {
  const a = p.address ?? {};
  return {
    lat: Number(p.lat),
    lng: Number(p.lon),
    label: p.display_name,
    locality: a.suburb ?? a.neighbourhood ?? a.quarter ?? a.village ?? a.hamlet ?? null,
    city:
      a.city ?? a.town ?? a.municipality ?? a.city_district ?? a.county ?? a.state_district ?? null,
    state: a.state ?? null,
    pincode: a.postcode?.replace(/\s/g, '') ?? null,
  };
}

/**
 * Address ↔ map pin lookups for the property form. Requests go through the API (not the
 * browser) so they follow the provider's rules: one at a time, at most one per second,
 * cached for a day. Only the typed address or the pin is sent, never people's details.
 */
export class GeocodingService {
  private readonly baseUrl: string;
  private readonly country: string;
  private readonly logger: Logger;
  private readonly fetchImpl: typeof fetch;
  private readonly cache = new Map<string, { at: number; value: GeoPlace | null }>();
  private queue: Promise<unknown> = Promise.resolve();
  private lastCall = 0;
  private readonly minGapMs: number;

  constructor(deps: {
    env: Pick<Env, 'GEOCODER_URL' | 'GEOCODER_COUNTRY'>;
    logger: Logger;
    fetchImpl?: typeof fetch;
    /** Spacing between requests (tests use 0). */
    minGapMs?: number;
  }) {
    this.minGapMs = deps.minGapMs ?? MIN_GAP_MS;
    this.baseUrl = deps.env.GEOCODER_URL.replace(/\/+$/, '');
    this.country = deps.env.GEOCODER_COUNTRY;
    this.logger = deps.logger;
    // Looked up on each call, so tests can stub the global fetch.
    this.fetchImpl = deps.fetchImpl ?? ((input, init) => fetch(input, init));
  }

  /** Where an address is. Tries the full address, then without the locality. */
  async search(q: GeoSearchQuery): Promise<GeoPlace | null> {
    const attempts = [
      [q.locality, q.city, q.state, q.pincode],
      ...(q.locality ? [[q.city, q.state, q.pincode]] : []),
    ].map((parts) => parts.filter(Boolean).join(', '));
    for (const text of attempts) {
      if (!text) continue;
      const found = await this.cached(`search:${text.toLowerCase()}`, async () => {
        const rows = await this.call<NominatimPlace[]>('/search', {
          q: text,
          format: 'jsonv2',
          addressdetails: '1',
          limit: '1',
          countrycodes: this.country,
        });
        return rows[0] ? toPlace(rows[0]) : null;
      });
      if (found) return found;
    }
    return null;
  }

  /** What is at a map pin (nearest address). */
  async reverse(lat: number, lng: number): Promise<GeoPlace | null> {
    const key = `reverse:${lat.toFixed(5)},${lng.toFixed(5)}`;
    return this.cached(key, async () => {
      const row = await this.call<NominatimPlace & { error?: string }>('/reverse', {
        lat: String(lat),
        lon: String(lng),
        format: 'jsonv2',
        addressdetails: '1',
        zoom: '18',
      });
      return row && !row.error ? { ...toPlace(row), lat, lng } : null;
    });
  }

  private async cached(key: string, load: () => Promise<GeoPlace | null>) {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
    const value = await load();
    if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(key, { at: Date.now(), value });
    return value;
  }

  /** One request at a time, spaced at least MIN_GAP_MS apart. */
  private call<T>(path: string, params: Record<string, string>): Promise<T> {
    const run = async () => {
      const wait = this.lastCall + this.minGapMs - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.lastCall = Date.now();
      const url = `${this.baseUrl}${path}?${new URLSearchParams(params)}`;
      let res: Response;
      try {
        res = await this.fetchImpl(url, {
          headers: { 'user-agent': USER_AGENT, 'accept-language': 'en' },
          signal: AbortSignal.timeout(6000),
        });
      } catch (err) {
        this.logger.warn({ err, path }, 'Map lookup failed');
        throw upstreamError(
          'Map lookup is unavailable right now. You can still drop the pin by hand.',
        );
      }
      if (!res.ok) {
        this.logger.warn({ status: res.status, path }, 'Map lookup failed');
        throw upstreamError(
          'Map lookup is unavailable right now. You can still drop the pin by hand.',
        );
      }
      return (await res.json()) as T;
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }
}
