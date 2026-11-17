import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PropertyModel } from '../modules/properties/property.model';
import { ensureStartingPropertyTypes } from '../modules/propertyTypes/propertyTypes.defaults';
import { PropertySubcategoryModel } from '../modules/propertyTypes/propertyTypes.model';
import { UserModel } from '../modules/users/user.model';
import { startTestDatabase } from '../test/helpers';
import { TEST_CATALOGUE } from '../test/testCatalogue';
import { resetCatalogue } from './resetCatalogue';

describe('db:reset-catalogue (PROP-13)', () => {
  let db: Awaited<ReturnType<typeof startTestDatabase>>;
  beforeAll(async () => {
    db = await startTestDatabase();
  });
  afterAll(async () => db.stop());

  it('is refused in production', async () => {
    await expect(resetCatalogue({ nodeEnv: 'production', uploadDir: '.' })).rejects.toThrow(
      /development and test/,
    );
  });

  it('replaces a v1 catalogue and its test data with v2, keeping users and other files', async () => {
    await ensureStartingPropertyTypes(TEST_CATALOGUE); // a v1-style installation
    const villa = (await PropertySubcategoryModel.findOne({ codePrefix: 'VIL' }).lean())!;
    await PropertyModel.collection.insertOne({
      _id: 'old-prop' as never,
      code: 'RE-VIL-000001',
      subcategoryId: villa._id,
      status: 'published',
    });
    await UserModel.create({ name: 'Owner', email: 'o@x.com', role: 'admin', status: 'active' });

    const uploads = await mkdtemp(path.join(tmpdir(), 're-reset-'));
    for (const folder of ['properties', 'imports', 'company']) {
      await mkdir(path.join(uploads, folder, 'x'), { recursive: true });
      await writeFile(path.join(uploads, folder, 'x', 'f.txt'), 'x');
    }

    const removed = await resetCatalogue({ nodeEnv: 'development', uploadDir: uploads });
    expect(removed).toMatchObject({ properties: 1, propertyTypes: 9 });
    expect(await PropertyModel.countDocuments()).toBe(0);
    expect((await PropertySubcategoryModel.find().lean()).map((s) => s.codePrefix).sort()).toEqual([
      'APT',
      'CBD',
      'ISH',
      'OFC',
      'PLT',
      'SHP',
      'VIL',
      'WHS',
    ]);
    expect(await UserModel.countDocuments()).toBe(1);
    expect(existsSync(path.join(uploads, 'properties'))).toBe(false);
    expect(existsSync(path.join(uploads, 'imports'))).toBe(false);
    expect(existsSync(path.join(uploads, 'company', 'x', 'f.txt'))).toBe(true);
  });
});
