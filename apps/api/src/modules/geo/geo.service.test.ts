import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../lib/errors';
import { createLogger } from '../../lib/logger';
import { GeocodingService } from './geo.service';

const logger = createLogger({ NODE_ENV: 'test', LOG_LEVEL: 'info' });
const env = { GEOCODER_URL: 'https://geo.example.com/', GEOCODER_COUNTRY: 'in' };
const TAMBARAM = {
  lat: '12.9249',
  lon: '80.1000',
  display_name: 'Tambaram, Chengalpattu, Tamil Nadu, 600045, India',
  address: { suburb: 'Tambaram', city: 'Chennai', state: 'Tamil Nadu', postcode: '600 045' },
};
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

function service(responses: unknown[]) {
  const fetchImpl = vi.fn<typeof fetch>(async () => ok(responses.shift() ?? []));
  return { geo: new GeocodingService({ env, logger, fetchImpl, minGapMs: 0 }), fetchImpl };
}

describe('GeocodingService', () => {
  it('finds an address in the configured country and reads its parts', async () => {
    const { geo, fetchImpl } = service([[TAMBARAM]]);
    const place = await geo.search({ locality: 'Tambaram', city: 'Chennai', pincode: '600045' });
    expect(place).toEqual({
      lat: 12.9249,
      lng: 80.1,
      label: 'Tambaram, Chengalpattu, Tamil Nadu, 600045, India',
      locality: 'Tambaram',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600045',
    });
    const [url, init] = fetchImpl.mock.calls[0]!;
    const u = new URL(String(url));
    expect(u.origin + u.pathname).toBe('https://geo.example.com/search');
    expect(Object.fromEntries(u.searchParams)).toMatchObject({
      q: 'Tambaram, Chennai, 600045',
      countrycodes: 'in',
      limit: '1',
    });
    expect((init!.headers as Record<string, string>)['user-agent']).toMatch(
      /^RealEstateAdminPortal/,
    );
  });

  it('tries again without the locality, and caches answers', async () => {
    const { geo, fetchImpl } = service([[], [TAMBARAM]]);
    const q = { locality: 'Unknown Nagar', city: 'Chennai' };
    expect((await geo.search(q))?.city).toBe('Chennai');
    expect(new URL(String(fetchImpl.mock.calls[1]![0])).searchParams.get('q')).toBe('Chennai');
    await geo.search(q);
    expect(fetchImpl).toHaveBeenCalledTimes(2); // second search answered from the cache
  });

  it('reads the nearest address of a pin, keeping the exact pin', async () => {
    const { geo, fetchImpl } = service([TAMBARAM]);
    const place = await geo.reverse(12.92491, 80.10012);
    expect(place).toMatchObject({ lat: 12.92491, lng: 80.10012, pincode: '600045' });
    expect(new URL(String(fetchImpl.mock.calls[0]![0])).pathname).toBe('/reverse');
    expect(await service([{ error: 'Unable to geocode' }]).geo.reverse(0, 0)).toBeNull();
  });

  it('reports an unavailable service as a 502 the form can explain', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response('busy', { status: 429 }));
    const geo = new GeocodingService({ env, logger, fetchImpl, minGapMs: 0 });
    await expect(geo.search({ city: 'Chennai' })).rejects.toMatchObject({
      status: 502,
      message: 'Map lookup is unavailable right now. You can still drop the pin by hand.',
    });
    await expect(geo.search({ city: 'Chennai' })).rejects.toBeInstanceOf(AppError);
  });
});
