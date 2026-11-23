/** Indian money and area helpers, shared by the UI, the API and the AI parsers. */

export const LAKH = 100_000;
export const CRORE = 10_000_000;

/** ₹45 L, ₹1.25 Cr, ₹25,000 */
export function formatINR(amount: number | null | undefined, opts: { short?: boolean } = {}): string {
  if (amount == null || !Number.isFinite(amount)) return '—';
  const short = opts.short ?? true;
  if (short && amount >= CRORE) return `₹${trim(amount / CRORE)} Cr`;
  if (short && amount >= LAKH) return `₹${trim(amount / LAKH)} L`;
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

function trim(n: number): string {
  return Number(n.toFixed(2)).toString();
}

/**
 * Reads the ways people write prices: "62 lakhs", "62L", "1.2 Cr", "₹ 45,00,000",
 * "45 lac", "25k". Returns rupees, or null when the text has no amount.
 */
export function parseMoney(input: unknown): number | null {
  if (typeof input === 'number') return Number.isFinite(input) && input > 0 ? input : null;
  if (typeof input !== 'string') return null;
  const s = input.toLowerCase().replace(/rs\.?|inr|₹|\/-/g, ' ').replace(/\s+/g, ' ').trim();
  const m = s.match(/(\d[\d,]*(?:\.\d+)?)\s*(crores?|cr|lakhs?|lacs?|lac|l|k|thousand)?\b/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  const unit = m[2] ?? '';
  if (unit.startsWith('cr')) return Math.round(n * CRORE);
  if (unit.startsWith('l')) return Math.round(n * LAKH);
  if (unit === 'k' || unit === 'thousand') return Math.round(n * 1000);
  return Math.round(n);
}

export const AREA_UNITS = ['sqft', 'sqyd', 'sqm', 'cent', 'ground', 'acre'] as const;
export type AreaUnit = (typeof AREA_UNITS)[number];

export const AREA_UNIT_LABEL: Record<AreaUnit, string> = {
  sqft: 'sq.ft',
  sqyd: 'sq.yd',
  sqm: 'sq.m',
  cent: 'cent',
  ground: 'ground',
  acre: 'acre',
};

const SQFT_PER: Record<AreaUnit, number> = {
  sqft: 1,
  sqyd: 9,
  sqm: 10.7639,
  cent: 435.6,
  ground: 2400,
  acre: 43560,
};

export function toSqft(value: number, unit: AreaUnit): number {
  return Math.round(value * SQFT_PER[unit]);
}

/** "1,200 sqft", "2.5 acres", "4 cents", "30x40" → { value, unit } */
export function parseArea(input: unknown): { value: number; unit: AreaUnit } | null {
  if (typeof input === 'number') return input > 0 ? { value: input, unit: 'sqft' } : null;
  if (typeof input !== 'string') return null;
  const s = input.toLowerCase().replace(/,/g, '').trim();
  const dims = s.match(/(\d+(?:\.\d+)?)\s*(?:x|×|\*|by)\s*(\d+(?:\.\d+)?)/);
  if (dims) return { value: Math.round(parseFloat(dims[1]) * parseFloat(dims[2])), unit: 'sqft' };
  const m = s.match(/(\d+(?:\.\d+)?)\s*(sq\.?\s*ft|sqft|sft|square feet|sq\.?\s*yd|sqyd|square yards?|sq\.?\s*m\b|sqm|square met(?:re|er)s?|cents?|grounds?|acres?)?/);
  if (!m) return null;
  const value = parseFloat(m[1]);
  if (!(value > 0)) return null;
  const u = (m[2] ?? '').replace(/\s/g, '');
  let unit: AreaUnit = 'sqft';
  if (/yd|yard/.test(u)) unit = 'sqyd';
  else if (/sqm|sq\.m|metre|meter/.test(u)) unit = 'sqm';
  else if (u.startsWith('cent')) unit = 'cent';
  else if (u.startsWith('ground')) unit = 'ground';
  else if (u.startsWith('acre')) unit = 'acre';
  return { value, unit };
}

export function formatArea(value?: number | null, unit: AreaUnit = 'sqft'): string {
  if (!value) return '—';
  return `${value.toLocaleString('en-IN')} ${AREA_UNIT_LABEL[unit]}`;
}

export function relativeDay(date: Date | string, now = new Date()): string {
  const d = new Date(date);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(d) - start(now)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < 0 && diff > -7) return `${-diff} days ago`;
  if (diff > 0 && diff < 7) return d.toLocaleDateString('en-IN', { weekday: 'long' });
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return digits ? `+${digits}` : '';
}
