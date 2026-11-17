/**
 * Asking price per sq.ft. (PRD v2 PROP-07): total price ÷ area in sq.ft., against the
 * property type's main area. Only for a sale priced as a total or per sq.ft.; rent and lease
 * prices are per month, so there is no per-sq.ft. figure.
 */
export function pricePerSqft(input: {
  purpose: 'sale' | 'rent' | 'lease';
  price: { amount: number | null; basis: 'total' | 'per_sqft' | 'per_month'; onRequest?: boolean };
  areaSqft: number | null | undefined;
}): number | null {
  const { purpose, price, areaSqft } = input;
  if (purpose !== 'sale' || price.amount === null || price.amount <= 0) return null;
  if (price.basis === 'per_sqft') return Math.round(price.amount);
  if (price.basis !== 'total' || !areaSqft || areaSqft <= 0) return null;
  return Math.round(price.amount / areaSqft);
}
