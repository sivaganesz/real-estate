import { describe, expect, it } from 'vitest';
import { emailSchema, paginationQuerySchema, passwordSchema, phoneSchema } from './common';

describe('passwordSchema', () => {
  const ok = (p: string) => passwordSchema.safeParse(p).success;

  it('accepts any password with 6+ characters, upper and lower case, a number and a special character', () => {
    expect(ok('Password@123')).toBe(true);
    expect(ok('Ab1@cd')).toBe(true);
    expect(ok('Madurai#2026')).toBe(true);
  });

  it('names the rule that is missing', () => {
    const message = (p: string) => passwordSchema.safeParse(p).error?.issues.map((i) => i.message);
    expect(message('Ab1@c')).toContain('Password must be at least 6 characters');
    expect(message('password@123')).toEqual(['Password must contain an uppercase letter']);
    expect(message('PASSWORD@123')).toEqual(['Password must contain a lowercase letter']);
    expect(message('Password@abc')).toEqual(['Password must contain a number']);
    expect(message('Password123')).toEqual(['Password must contain a special character']);
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
