import { describe, expect, it } from 'vitest';
import { legalChecklist, legalSummary, mergeLegalChecks, newLegalCheck } from './legal';
import type { PropertyLegalCheck } from './legal';
import { pricePerSqft } from './pricing';
import { propertySearchText } from './search';

describe('pricePerSqft (PROP-07)', () => {
  const sale = (
    amount: number | null,
    basis: 'total' | 'per_sqft' | 'per_month',
    areaSqft = 1200,
  ) => pricePerSqft({ purpose: 'sale', price: { amount, basis }, areaSqft });

  it('is total ÷ area for a sale (wireframe PROP-1001: ₹28 L / 1,200 sq.ft. = ₹2,333)', () => {
    expect(sale(2_800_000, 'total')).toBe(2333);
  });

  it('is the price itself when priced per sq.ft.', () => {
    expect(sale(2450, 'per_sqft')).toBe(2450);
  });

  it('is empty for rent or lease, price on request, or no area', () => {
    expect(
      pricePerSqft({
        purpose: 'rent',
        price: { amount: 45000, basis: 'per_month' },
        areaSqft: 600,
      }),
    ).toBeNull();
    expect(sale(null, 'total')).toBeNull();
    expect(
      pricePerSqft({ purpose: 'sale', price: { amount: 1, basis: 'total' }, areaSqft: 0 }),
    ).toBeNull();
  });
});

describe('legal checks (PROP-28–31)', () => {
  const plot = legalChecklist(
    ['parent_documents', 'sale_deed', 'encumbrance_certificate', 'layout_approval', 'rera'],
    ['sale_deed', 'encumbrance_certificate', 'layout_approval'],
  );
  const set = (checks: PropertyLegalCheck[], key: string, status: PropertyLegalCheck['status']) =>
    checks.map((c) => (c.key === key ? { ...c, status } : c));

  it('a new property starts with every check not collected and all mandatory ones open', () => {
    const checks = plot.map(newLegalCheck);
    expect(legalSummary(checks)).toEqual({
      total: 5,
      verified: 0,
      pending: 0,
      notCollected: 5,
      openMandatory: ['sale_deed', 'encumbrance_certificate', 'layout_approval'],
    });
  });

  it('counts verified and pending, and only unverified mandatory checks stay open', () => {
    let checks = plot.map(newLegalCheck);
    for (const k of ['parent_documents', 'sale_deed', 'encumbrance_certificate', 'layout_approval'])
      checks = set(checks, k, 'verified');
    checks = set(checks, 'rera', 'pending');
    expect(legalSummary(checks)).toMatchObject({ verified: 4, pending: 1, openMandatory: [] });
    // A pending mandatory check is still open: pending is not verified.
    expect(legalSummary(set(checks, 'sale_deed', 'pending')).openMandatory).toEqual(['sale_deed']);
  });

  it('changing type keeps collected checks, adds new ones, and never drops a check', () => {
    const checks = set(plot.map(newLegalCheck), 'rera', 'verified');
    const flat = legalChecklist(['sale_deed', 'building_plan', 'rera'], ['rera', 'building_plan']);
    const merged = mergeLegalChecks(checks, flat);
    expect(merged.map((c) => c.key)).toEqual([
      'sale_deed',
      'building_plan',
      'rera',
      'parent_documents',
      'encumbrance_certificate',
      'layout_approval',
    ]);
    expect(merged.find((c) => c.key === 'rera')).toMatchObject({
      status: 'verified',
      mandatory: true,
    });
    expect(merged.find((c) => c.key === 'building_plan')!.status).toBe('not_collected');
  });
});

describe('propertySearchText (M7)', () => {
  it('joins code, title and location in lower case', () => {
    expect(
      propertySearchText({
        code: 'RE-PLT-000001',
        title: 'Premium residential plot',
        location: { city: 'Madurai', locality: 'Vilangudi', pincode: '625018' },
      }),
    ).toBe('re-plt-000001 premium residential plot madurai vilangudi 625018');
  });
});
