/**
 * Indian price formatting (PRD §5.5): ₹45 L, ₹1.25 Cr, ₹25,000.
 */

const LAKH = 100_000;
const CRORE = 10_000_000;

/** Groups digits the Indian way: 1234567 → "12,34,567". */
export function groupIndian(value: number): string {
  return Math.round(value).toLocaleString('en-IN');
}

/** Up to 2 decimals, without trailing zeros: 1.50 → "1.5", 45.00 → "45". */
function compact(value: number): string {
  return Number(value.toFixed(2)).toString();
}

/**
 * Formats an amount in rupees.
 * - ≥ 1 crore → "₹1.25 Cr"
 * - ≥ 1 lakh  → "₹45 L"
 * - otherwise → "₹25,000"
 */
export function formatINR(amount: number): string {
  if (!Number.isFinite(amount)) return '';
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  if (abs >= CRORE) return `${sign}₹${compact(abs / CRORE)} Cr`;
  if (abs >= LAKH) return `${sign}₹${compact(abs / LAKH)} L`;
  return `${sign}₹${groupIndian(abs)}`;
}

/** Monthly rent: "₹25,000/month". Always shows the full amount. */
export function formatINRPerMonth(amount: number): string {
  if (!Number.isFinite(amount)) return '';
  return `₹${groupIndian(amount)}/month`;
}

/**
 * A property's price as shown in lists and on the detail page:
 * "₹1.25 Cr", "₹25,000/month", "₹4,500/sq.ft", "Price on request", or "Price not set".
 */
export function formatPrice(price: {
  amount: number | null;
  basis: 'total' | 'per_sqft' | 'per_month';
  onRequest: boolean;
}): string {
  if (price.onRequest) return 'Price on request';
  if (price.amount === null) return 'Price not set';
  if (price.basis === 'per_month') return formatINRPerMonth(price.amount);
  if (price.basis === 'per_sqft') return `₹${groupIndian(price.amount)}/sq.ft`;
  return formatINR(price.amount);
}
