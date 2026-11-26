import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Express } from 'express';
import { estimateMinutes } from '@estate/shared';
import { EMAIL, login, setup, teardown, type Agent } from './helpers';

let app: Express;
let manager: Agent;
let priya: Agent;
let id: string;
beforeAll(async () => {
  app = await setup();
  manager = await login(app, EMAIL.manager);
  priya = await login(app, EMAIL.priya);
  id = (await manager.get('/api/properties?q=Kelambakkam&smart=false')).body.items[0].id;
});
afterAll(teardown);
afterEach(() => vi.unstubAllGlobals());

type Place = { id: string; name: string; kind: string; distanceKm: number; minutes: number; routeChecked: boolean; advertise: boolean; source: string };
const places = async () => (await manager.get(`/api/properties/${id}`)).body.property.nearby as Place[];

describe('places nearby', () => {
  it('the team adds, checks and removes places; executives only look', async () => {
    const r = await manager.post(`/api/properties/${id}/nearby`).send({ name: 'Tambaram railway station', kind: 'train', distanceKm: 1.2 });
    expect(r.status).toBe(201);
    const station = (r.body.property.nearby as Place[]).find((n) => n.name === 'Tambaram railway station')!;
    expect(station).toMatchObject({ kind: 'train', distanceKm: 1.2, minutes: estimateMinutes(1.2), routeChecked: false, advertise: false, source: 'team' });

    expect((await manager.post(`/api/properties/${id}/nearby`).send({ name: 'tambaram Railway Station', kind: 'train', distanceKm: 1 })).body.error).toMatch(/already in the list/);
    expect((await manager.post(`/api/properties/${id}/nearby`).send({ name: 'X', kind: 'train', distanceKm: 1 })).body.error).toMatch(/name/);
    expect((await priya.post(`/api/properties/${id}/nearby`).send({ name: 'Somewhere', kind: 'bus', distanceKm: 1 })).status).toBe(403);

    const patched = await manager.patch(`/api/properties/${id}/nearby/${station.id}`).send({ routeChecked: true, minutes: 6 });
    expect((patched.body.property.nearby as Place[]).find((n) => n.id === station.id)).toMatchObject({ routeChecked: true, minutes: 6 });

    const del = await manager.delete(`/api/properties/${id}/nearby/${station.id}`);
    expect((del.body.property.nearby as Place[]).some((n) => n.id === station.id)).toBe(false);
  });

  it('buyers see only the places marked OK to advertise', async () => {
    await manager.post(`/api/properties/${id}/nearby`).send({ name: 'Hindu Mission Hospital', kind: 'hospital', distanceKm: 2.1, advertise: true });
    await manager.post(`/api/properties/${id}/nearby`).send({ name: 'Unverified tea stall', kind: 'shop', distanceKm: 0.3 });
    const { token } = (await manager.post(`/api/properties/${id}/share`)).body;
    const pub = (await manager.get(`/api/public/properties/${token}`)).body.property;
    expect(pub.nearby).toEqual([{ name: 'Hindu Mission Hospital', kind: 'hospital', distanceKm: 2.1, minutes: estimateMinutes(2.1) }]);
  });

  it('finds the nearest places on OpenStreetMap once, unchecked and not advertised', async () => {
    const osm = {
      elements: [
        { type: 'node', id: 1, lat: 12.9257, lon: 80.1006, tags: { highway: 'bus_stop', name: 'Tambaram Sanatorium' } },
        { type: 'node', id: 2, lat: 12.93, lon: 80.1, tags: { highway: 'bus_stop', name: 'Farther stop' } },
        { type: 'way', id: 3, center: { lat: 12.92, lon: 80.11 }, tags: { amenity: 'school', name: 'Zion Matriculation School' } },
        { type: 'way', id: 4, center: { lat: 12.92, lon: 80.12 }, tags: { amenity: 'college', name: 'Madras Christian College' } },
        { type: 'node', id: 5, lat: 12.93, lon: 80.11, tags: { amenity: 'cafe', name: 'Not listed' } },
        { type: 'node', id: 6, lat: 12.93, lon: 80.11, tags: { amenity: 'hospital', name: 'Hindu Mission Hospital' } },
        // The same school mapped again under another name, 10 m away: skipped.
        { type: 'node', id: 7, lat: 12.92005, lon: 80.11005, tags: { amenity: 'school', name: 'Zion Matric School Annexe' } },
      ],
    };
    const fetchStub = vi.fn(async () => new Response(JSON.stringify(osm), { status: 200 }));
    vi.stubGlobal('fetch', fetchStub);

    const r = (await manager.post(`/api/properties/${id}/nearby/discover`)).body;
    // One bus stop (the nearest), the school and college; the hospital is already there by name; the school's twin and cafes are skipped.
    expect(r.added).toBe(3);
    const found = (await places()).filter((n) => n.source === 'osm');
    expect(found.map((n) => [n.name, n.kind, n.routeChecked, n.advertise])).toEqual(
      expect.arrayContaining([
        ['Tambaram Sanatorium', 'bus', false, false],
        ['Zion Matriculation School', 'school', false, false],
        ['Madras Christian College', 'college', false, false],
      ]),
    );
    expect(found.every((n) => n.distanceKm > 0 && n.minutes === estimateMinutes(n.distanceKm))).toBe(true);

    expect((await manager.post(`/api/properties/${id}/nearby/discover`)).body.added).toBe(0);
    // Each lookup asks every server at once and keeps the first answer.
    expect(fetchStub).toHaveBeenCalled();
  });

  it('says so plainly when OpenStreetMap cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    const r = await manager.post(`/api/properties/${id}/nearby/discover`);
    expect(r.status).toBe(503);
    expect(r.body.error).toMatch(/add places by hand/);
  });
});
