import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestDatabase } from '../../test/helpers';
import { ensureStartingPropertyTypes } from './propertyTypes.defaults';
import {
  AmenityModel,
  PropertyAttributeModel,
  PropertyCategoryModel,
  PropertySubcategoryModel,
} from './propertyTypes.model';
import type { SubcategoryDoc } from './propertyTypes.model';

/** The product catalogue v2 matches docs/v2/PROPERTY-CATALOGUE.md (approved 2026-11-16). */
describe('starting catalogue v2', () => {
  let db: Awaited<ReturnType<typeof startTestDatabase>>;
  let subs: SubcategoryDoc[];
  const keysOf = async (placements: { attributeId: string }[]) => {
    const attrs = await PropertyAttributeModel.find({
      _id: { $in: placements.map((p) => p.attributeId) },
    }).lean<{ _id: string; key: string }[]>();
    const byId = new Map(attrs.map((a) => [a._id, a.key]));
    return placements.map((p) => byId.get(p.attributeId));
  };
  const sub = (prefix: string) => subs.find((s) => s.codePrefix === prefix)!;

  beforeAll(async () => {
    db = await startTestDatabase();
    expect(await ensureStartingPropertyTypes()).toBe('created');
    subs = await PropertySubcategoryModel.find().sort({ order: 1 }).lean<SubcategoryDoc[]>();
  });
  afterAll(async () => db.stop());

  it('has 3 residential and 5 commercial types; Other stays inactive and empty', async () => {
    const cats = await PropertyCategoryModel.find().sort({ order: 1 }).lean();
    expect(cats.map((c) => [c.key, c.isActive])).toEqual([
      ['residential', true],
      ['commercial', true],
      ['other', false],
    ]);
    const list = (cat: string) =>
      subs.filter((s) => s.categoryKey === cat).map((s) => [s.name, s.codePrefix]);
    expect(list('residential')).toEqual([
      ['Residential plot', 'PLT'],
      ['Flat / Apartment', 'APT'],
      ['Independent house / Villa', 'VIL'],
    ]);
    expect(list('commercial')).toEqual([
      ['Office space', 'OFC'],
      ['Shop / Showroom', 'SHP'],
      ['Warehouse / Godown', 'WHS'],
      ['Commercial building', 'CBD'],
      ['Industrial shed', 'ISH'],
    ]);
    expect(list('other')).toEqual([]);
  });

  it('labels the main area per type', () => {
    expect(sub('PLT').mainAreaMeaning).toBe('plot');
    expect(sub('APT').mainAreaMeaning).toBe('built_up');
    expect(sub('VIL').mainAreaMeaning).toBe('built_up');
    for (const p of ['OFC', 'SHP', 'WHS', 'CBD', 'ISH'])
      expect(sub(p).mainAreaMeaning).toBe('usable');
  });

  it('places common and type-specific attributes as approved (48 incl. road type/width)', async () => {
    const residential = (await PropertyCategoryModel.findOne({ key: 'residential' }).lean())!;
    const commercial = (await PropertyCategoryModel.findOne({ key: 'commercial' }).lean())!;
    expect(await keysOf(residential.attributes)).toEqual(['facing', 'description']);
    expect(await keysOf(commercial.attributes)).toEqual([
      'facing',
      'description',
      'floor',
      'frontage',
      'parking',
      'permitted_usage',
      'occupancy',
      'rental_income',
      'lease_duration',
      'lease_terms',
      'maintenance',
      'operating_expenses',
    ]);
    expect(sub('PLT').attributes).toHaveLength(12);
    expect(sub('APT').attributes).toHaveLength(11);
    expect(sub('VIL').attributes).toHaveLength(13);
    expect(sub('OFC').attributes).toHaveLength(0); // commercial specs are category-wide
    // Shared attributes are defined once.
    expect((await keysOf(sub('PLT').attributes)).filter((k) => k === 'water_supply')).toHaveLength(
      1,
    );
    expect(await keysOf(sub('VIL').attributes)).toContain('water_supply');
    expect(await keysOf(sub('APT').attributes)).toContain('maintenance');
    // 46 attribute definitions; road type and width are location fields (PROP-09).
    expect(await PropertyAttributeModel.countDocuments()).toBe(46);
    const possession = await PropertyAttributeModel.findOne({ key: 'expected_possession' }).lean();
    expect(possession?.type).toBe('month');
  });

  it('gives each type the wireframe legal checklist with its mandatory checks', () => {
    const mandatory = (p: string) =>
      sub(p)
        .legalChecklist!.filter((c) => c.mandatory)
        .map((c) => c.key);
    expect(sub('PLT').legalChecklist).toHaveLength(9);
    expect(mandatory('PLT')).toEqual(['sale_deed', 'encumbrance_certificate', 'layout_approval']);
    expect(mandatory('APT')).toEqual([
      'sale_deed',
      'encumbrance_certificate',
      'building_plan',
      'rera',
    ]);
    expect(mandatory('VIL')).toEqual(['sale_deed', 'encumbrance_certificate', 'building_plan']);
    expect(sub('WHS').legalChecklist!.map((c) => c.key)).toContain('fire_noc');
    expect(sub('PLT').legalChecklist![0]).toEqual({
      key: 'parent_documents',
      label: 'Parent documents',
      verifies: 'Ownership history (chain of title)',
      mandatory: false,
    });
  });

  it('offers the wireframe amenities per category', async () => {
    const names = async (categoryKey: 'residential' | 'commercial') =>
      (await AmenityModel.find({ categoryKey }).sort({ order: 1 }).lean()).map((a) => a.name);
    expect(await names('residential')).toEqual([
      'Gated community',
      'Security',
      'Park / open space',
      'Power backup',
      'Lift',
      'Gym',
      'Swimming pool',
      'Clubhouse',
      'Rainwater harvesting',
      'CCTV',
      'Visitor parking',
    ]);
    expect(await names('commercial')).toEqual([
      'Security',
      'Power backup',
      'Lift',
      'Rainwater harvesting',
      'CCTV',
      'Visitor parking',
      'Loading bay',
    ]);
    const loading = (await AmenityModel.findOne({ name: 'Loading bay' }).lean())!;
    expect(loading.subcategoryIds.sort()).toEqual([sub('WHS')._id, sub('ISH')._id].sort());
  });
});
