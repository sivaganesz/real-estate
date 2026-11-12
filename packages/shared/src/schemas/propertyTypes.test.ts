import { describe, expect, it } from 'vitest';
import {
  addAttributeBodySchema,
  attributeKeyFromLabel,
  createSubcategoryBodySchema,
  normalizeLabel,
} from './propertyTypes';

describe('property types', () => {
  it('makes attribute keys from names', () => {
    expect(attributeKeyFromLabel('Road width (ft)')).toBe('road_width_ft');
    expect(attributeKeyFromLabel('  Age of property ')).toBe('age_of_property');
    expect(attributeKeyFromLabel('Built-up area')).toBe('built_up_area');
    expect(attributeKeyFromLabel('₹ / month')).toBe('month');
    expect(attributeKeyFromLabel('!!!')).toBe('attribute');
  });

  it('compares names ignoring case and extra spaces', () => {
    expect(normalizeLabel('  Corner   PLOT ')).toBe('corner plot');
  });

  it('a new dropdown or multi-select needs unique options', () => {
    const base = { source: 'new', label: 'Approval type', type: 'dropdown' } as const;
    expect(addAttributeBodySchema.safeParse(base).error?.issues[0]).toMatchObject({
      path: ['options'],
      message: 'Add at least one option',
    });
    expect(
      addAttributeBodySchema.safeParse({ ...base, options: ['DTCP', 'dtcp'] }).error?.issues[0]
        ?.message,
    ).toBe('"dtcp" is listed twice');
    expect(addAttributeBodySchema.parse({ ...base, options: [' DTCP ', 'CMDA'] })).toMatchObject({
      options: ['DTCP', 'CMDA'],
      required: false,
      searchFilter: false,
    });
  });

  it('reusing an existing attribute needs only its id', () => {
    const id = '0192f3a4-7b1c-7e2d-9a3f-1c2b3d4e5f60';
    expect(addAttributeBodySchema.parse({ source: 'existing', attributeId: id })).toEqual({
      source: 'existing',
      attributeId: id,
      required: false,
    });
  });

  it('a subcategory has a 3-letter prefix (upper-cased) and purposes in a fixed order', () => {
    expect(
      createSubcategoryBodySchema.parse({
        categoryKey: 'residential',
        name: ' Farm house ',
        codePrefix: 'frm',
        purposes: ['lease', 'sale'],
      }),
    ).toEqual({
      categoryKey: 'residential',
      name: 'Farm house',
      codePrefix: 'FRM',
      purposes: ['sale', 'lease'],
      isActive: true,
    });
    expect(
      createSubcategoryBodySchema.safeParse({
        categoryKey: 'residential',
        name: 'Xy',
        codePrefix: 'FR1',
        purposes: ['sale'],
      }).success,
    ).toBe(false);
  });
});
