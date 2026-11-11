import { describe, expect, it } from 'vitest';
import { formatINR, formatINRPerMonth, groupIndian } from './format';

describe('formatINR', () => {
  it('formats crores', () => {
    expect(formatINR(12_500_000)).toBe('₹1.25 Cr');
    expect(formatINR(10_000_000)).toBe('₹1 Cr');
  });

  it('formats lakhs', () => {
    expect(formatINR(4_500_000)).toBe('₹45 L');
    expect(formatINR(3_850_000)).toBe('₹38.5 L');
    expect(formatINR(100_000)).toBe('₹1 L');
  });

  it('formats smaller amounts with Indian grouping', () => {
    expect(formatINR(25_000)).toBe('₹25,000');
    expect(formatINR(0)).toBe('₹0');
  });

  it('returns an empty string for invalid numbers', () => {
    expect(formatINR(Number.NaN)).toBe('');
  });
});

describe('groupIndian / formatINRPerMonth', () => {
  it('groups digits the Indian way', () => {
    expect(groupIndian(1_234_567)).toBe('12,34,567');
  });

  it('formats monthly rent', () => {
    expect(formatINRPerMonth(25_000)).toBe('₹25,000/month');
  });
});
