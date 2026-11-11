import { describe, expect, it } from 'vitest';
import { AppError } from './errors';
import { pageMeta, pageSkip, parseSort } from './http';

describe('pagination helpers', () => {
  it('builds page meta', () => {
    expect(pageMeta(347, 1, 20)).toEqual({ page: 1, limit: 20, total: 347, totalPages: 18 });
    expect(pageMeta(0, 1, 20).totalPages).toBe(0);
  });

  it('computes skip', () => {
    expect(pageSkip(3, 20)).toBe(40);
  });
});

describe('parseSort', () => {
  const allowed = ['createdAt', 'name'];

  it('uses the fallback when no sort is given', () => {
    expect(parseSort(undefined, allowed, { createdAt: -1 })).toEqual({ createdAt: -1 });
  });

  it('parses ascending and descending sorts', () => {
    expect(parseSort('name', allowed, {})).toEqual({ name: 1 });
    expect(parseSort('-createdAt', allowed, {})).toEqual({ createdAt: -1 });
  });

  it('rejects fields that are not allowed', () => {
    expect(() => parseSort('passwordHash', allowed, {})).toThrow(AppError);
  });
});
