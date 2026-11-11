import { describe, expect, it } from 'vitest';
import { emailSchema, paginationQuerySchema, passwordSchema, phoneSchema } from './common';

describe('passwordSchema', () => {
  it('accepts a password with 10+ characters, a letter and a number', () => {
    expect(passwordSchema.safeParse('secretpass1').success).toBe(true);
  });

  it('rejects short passwords and passwords without a letter or a number', () => {
    expect(passwordSchema.safeParse('short1').success).toBe(false);
    expect(passwordSchema.safeParse('onlyletters').success).toBe(false);
    expect(passwordSchema.safeParse('1234567890').success).toBe(false);
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
  it('normalises to E.164', () => {
    expect(phoneSchema.parse('98765 43210')).toBe('+919876543210');
  });

  it('rejects invalid phone numbers', () => {
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
