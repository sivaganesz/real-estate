import { describe, expect, it } from 'vitest';
import { formatPhone, normalizePhone } from './phone';

describe('normalizePhone', () => {
  it('treats numbers without a country code as Indian', () => {
    expect(normalizePhone('98765 43210')).toBe('+919876543210');
    expect(normalizePhone('098765-43210')).toBe('+919876543210');
  });

  it('keeps numbers that already have a country code', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('+919876543210');
  });

  it('returns null for invalid numbers', () => {
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('not a phone')).toBeNull();
  });
});

describe('formatPhone', () => {
  it('formats E.164 numbers for display', () => {
    expect(formatPhone('+919876543210')).toBe('+91 98765 43210');
  });
});
