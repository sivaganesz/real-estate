import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLogger } from '../lib/logger';
import { LocalStorageProvider } from '../lib/storage';
import { PropertiesService } from '../modules/properties/properties.service';
import { PropertyModel } from '../modules/properties/property.model';
import { propertyUsage } from '../modules/properties/propertyUsage';
import { ensureStartingPropertyTypes } from '../modules/propertyTypes/propertyTypes.defaults';
import { PropertyTypesService } from '../modules/propertyTypes/propertyTypes.service';
import { UserModel } from '../modules/users/user.model';
import { startTestDatabase } from '../test/helpers';
import { seedDemo } from './seedDemo';

describe('seed:demo (PROP-13)', () => {
  let db: Awaited<ReturnType<typeof startTestDatabase>>;
  let uploads: string;
  beforeAll(async () => {
    db = await startTestDatabase();
    uploads = await mkdtemp(path.join(tmpdir(), 're-demo-'));
  });
  afterAll(async () => {
    await db.stop();
    await rm(uploads, { recursive: true, force: true });
  });

  it('loads the 12 wireframe properties, complete and with their detail data, once', async () => {
    await ensureStartingPropertyTypes();
    const admin = await UserModel.create({
      name: 'Owner',
      email: 'o@x.com',
      role: 'admin',
      status: 'active',
    });
    const storage = new LocalStorageProvider(uploads);
    const logger = createLogger({ NODE_ENV: 'test', LOG_LEVEL: 'info' });
    const deps = { nodeEnv: 'development', actorId: admin._id, storage, logger };

    const first = await seedDemo(deps);
    expect(first.created).toHaveLength(12);
    expect((await PropertyModel.find().lean()).map((p) => p.status).sort()).toEqual([
      ...Array(10).fill('available'),
      'reserved',
      'sold',
    ]);

    const service = new PropertiesService({
      propertyTypes: new PropertyTypesService({ usage: propertyUsage }),
      storage,
    });
    const plot = await PropertyModel.findOne({ title: 'Premium residential plot' }).lean();
    const p = await service.get(plot!._id);
    expect(p.code).toBe('RE-PLT-000001');
    expect(p.pricePerSqft).toBe(2333);
    expect(p.publishIssues).toEqual([]); // listed properties are complete
    expect(p.media.filter((m) => m.kind === 'image')).toHaveLength(2);
    expect(p.legalSummary).toMatchObject({ total: 9, verified: 8, pending: 1, openMandatory: [] });
    expect(p.nearby.find((n) => n.name === 'Outer ring road extension')).toMatchObject({
      status: 'planned',
      routeChecked: false,
    });
    expect(p.valuation.comparables).toHaveLength(3);
    expect(p.location).toMatchObject({ roadType: 'Tar road', roadWidthFt: 30, pincode: '625001' });
    expect(p.publishedAt?.slice(0, 10)).toBe('2026-11-16');

    const again = await seedDemo(deps);
    expect(again).toMatchObject({ created: [], skipped: expect.arrayContaining([plot!.title]) });
    expect(await PropertyModel.countDocuments()).toBe(12);
  }, 60_000);

  it('is refused in production', async () => {
    await expect(
      seedDemo({
        nodeEnv: 'production',
        actorId: 'x',
        storage: new LocalStorageProvider(uploads),
        logger: createLogger({ NODE_ENV: 'test', LOG_LEVEL: 'info' }),
      }),
    ).rejects.toThrow(/development and test/);
  });
});
