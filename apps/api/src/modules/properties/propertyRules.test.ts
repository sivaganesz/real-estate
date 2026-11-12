import { describe, expect, it } from 'vitest';
import type { FormDefinition } from '../propertyTypes/propertyTypes.service';
import {
  checkAttributeValue,
  checkExtraAttributes,
  mergeAttributeValues,
  publishIssues,
} from './propertyRules';

const attr = (key: string, type: string, options: string[] = []) =>
  ({
    _id: key,
    key,
    label: key.toUpperCase(),
    labelKey: key,
    type,
    unit: null,
    options,
    searchFilter: false,
  }) as never;

const definition = {
  category: { key: 'residential', name: 'Residential', isActive: true },
  subcategory: {
    _id: 's1',
    name: 'Villa / House',
    purposes: ['sale', 'rent'],
    isActive: true,
    codePrefix: 'VIL',
  },
  attributes: [
    { attribute: attr('bhk', 'dropdown', ['1 BHK', '2 BHK']), required: true },
    { attribute: attr('floors', 'number'), required: false },
  ],
  amenities: [],
} as unknown as FormDefinition;

describe('attribute value rules', () => {
  it('checks each value type and treats empty as "no value"', () => {
    const check = (type: string, value: unknown, options: string[] = []) =>
      checkAttributeValue({ type, options, label: 'X' } as never, value as never);
    expect(check('text', '  Sea view ')).toEqual({ value: 'Sea view' });
    expect(check('text', '   ')).toEqual({ value: undefined });
    expect(check('text', 'x'.repeat(501))).toEqual({ error: 'Keep it under 500 characters' });
    expect(check('number', '12.5')).toEqual({ value: 12.5 });
    expect(check('number', 'twelve')).toEqual({ error: 'Enter a number' });
    expect(check('number', -1)).toEqual({ value: -1 }); // basement floor
    expect(check('yes_no', 'yes')).toEqual({ error: 'Choose yes or no' });
    expect(check('dropdown', 'north', ['North', 'South'])).toEqual({ value: 'North' });
    expect(check('dropdown', 'West', ['North', 'South'])).toEqual({
      error: 'Choose one of: North, South',
    });
    expect(check('multi_select', ['a', 'A', 'b'], ['A', 'B'])).toEqual({ value: ['A', 'B'] });
    expect(check('multi_select', [], ['A'])).toEqual({ value: undefined });
    expect(check('date', '2026-02-30')).toEqual({ error: 'Enter a date as YYYY-MM-DD' });
    expect(check('date', '2026-11-12')).toEqual({ value: '2026-11-12' });
    expect(check('text', null)).toEqual({ value: undefined });
  });

  it('merges values key by key and keeps values the form no longer shows', () => {
    const { values, errors } = mergeAttributeValues(
      definition,
      { bhk: '1 BHK', floors: 2, built_up_area: 1800 },
      { floors: null, bhk: '2 bhk' },
    );
    expect(errors).toEqual([]);
    expect(values).toEqual({ bhk: '2 BHK', built_up_area: 1800 });
    expect(mergeAttributeValues(definition, {}, { lift: true }).errors[0]!.message).toBe(
      '"lift" isn\'t an attribute of Villa / House',
    );
  });

  it('extra attributes: unique names that are not already on the form', () => {
    const { values, errors } = checkExtraAttributes(definition, [
      { label: 'Servant room', type: 'yes_no', value: true },
      { label: 'servant  ROOM', type: 'yes_no', value: false },
      { label: 'BHK', type: 'text', value: '3' },
      { label: 'Pooja room', type: 'text', value: '' },
    ]);
    expect(values).toEqual([{ label: 'Servant room', type: 'yes_no', value: true }]);
    expect(errors.map((e) => e.path)).toEqual(['body.extraAttributes.1', 'body.extraAttributes.2']);
  });

  it('publishing needs price (or "on request"), area, location, required attributes and a photo', () => {
    const base = {
      purpose: 'sale' as const,
      price: { amount: null, onRequest: true },
      area: { value: 1, unit: 'sqft' },
      location: { city: 'Chennai', locality: 'Tambaram', pincode: '600045' },
      attributeValues: { bhk: '1 BHK' },
      media: [{ kind: 'image' }],
    };
    expect(publishIssues(definition, base)).toEqual([]);
    expect(
      publishIssues(definition, {
        ...base,
        purpose: 'lease',
        attributeValues: {},
        media: [{ kind: 'brochure' }],
      }).map((i) => i.path),
    ).toEqual(['purpose', 'attributeValues.bhk', 'media']);
  });
});
