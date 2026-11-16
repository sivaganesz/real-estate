import { describe, expect, it } from 'vitest';
import { emailSchema, paginationQuerySchema, passwordSchema, phoneSchema } from './common';

describe('passwordSchema', () => {
  it('accepts a password with 10+ characters, a letter and a number', () => {
    expect(passwordSchema.safeParse('correct-horse-9').success).toBe(true);
    expect(passwordSchema.safeParse('Madurai2026plot').success).toBe(true);
  });

  it('rejects short passwords and passwords without a letter or a number', () => {
    expect(passwordSchema.safeParse('abc123def').success).toBe(false);
    expect(passwordSchema.safeParse('onlyletterslong').success).toBe(false);
    expect(passwordSchema.safeParse('1234567890').success).toBe(false);
  });

  it('rejects common words padded with numbers or symbols', () => {
    for (const p of ['Password@123', 'admin12345', 'qwerty123456', 'Welcome@2026', 'abcd123456'])
      expect(passwordSchema.safeParse(p).success, p).toBe(false);
  });
});

describe('emailSchema', () => {
  it('trims and lower-cases emails', () => {
    expect(emailSchema.parse('  Name@Company.COM ')).toBe('name@company.com');
  });

  it('rejects invalid emails', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
  });
});

describe('phoneSchema', () => {
  it('normalises 10 digits (or +91 and digits) to E.164', () => {
    expect(phoneSchema.parse('9876543210')).toBe('+919876543210');
    expect(phoneSchema.parse('+919876543210')).toBe('+919876543210');
  });

  it('rejects letters, spaces and symbols', () => {
    expect(phoneSchema.safeParse('98765abcde').success).toBe(false);
    expect(phoneSchema.safeParse('98765 43210').success).toBe(false);
    expect(phoneSchema.safeParse('98765-43210').success).toBe(false);
  });

  it('rejects numbers that are too short', () => {
    expect(phoneSchema.safeParse('123').success).toBe(false);
  });
});

describe('paginationQuerySchema', () => {
  it('applies defaults and coerces strings', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(paginationQuerySchema.parse({ page: '2', limit: '50', sort: '-createdAt' })).toEqual({
      page: 2,
      limit: 50,
      sort: '-createdAt',
    });
  });

  it('caps the limit at 100', () => {
    expect(paginationQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });
});
