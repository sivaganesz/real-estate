import { describe, expect, it } from 'vitest';
import { formatArea, toSqft } from './area';

describe('toSqft', () => {
  it('converts each unit to sq.ft', () => {
    expect(toSqft(2400, 'sqft')).toBe(2400);
    expect(toSqft(100, 'sqyd')).toBe(900);
    expect(toSqft(1, 'ground')).toBe(2400);
    expect(toSqft(5, 'cent')).toBe(2178);
    expect(toSqft(1.5, 'acre')).toBe(65_340);
    expect(toSqft(100, 'sqm')).toBe(1076.39);
  });
});

describe('formatArea', () => {
  it('shows the value with its unit label', () => {
    expect(formatArea(2400, 'sqft')).toBe('2,400 sq.ft');
    expect(formatArea(1.5, 'acre')).toBe('1.5 acre');
  });
});
