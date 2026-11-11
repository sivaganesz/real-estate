/**
 * Area units and conversion to sq.ft (TRD §7.9). Every property stores its area in the
 * unit the admin entered plus the sq.ft equivalent, which is used for filtering.
 */

export const AREA_UNITS = ['sqft', 'sqyd', 'sqm', 'cent', 'ground', 'acre', 'hectare'] as const;
export type AreaUnit = (typeof AREA_UNITS)[number];

export const AREA_UNIT_LABELS: Record<AreaUnit, string> = {
  sqft: 'sq.ft',
  sqyd: 'sq.yd',
  sqm: 'sq.m',
  cent: 'cent',
  ground: 'ground',
  acre: 'acre',
  hectare: 'hectare',
};

/** How many sq.ft one unit equals. */
export const SQFT_PER_UNIT: Record<AreaUnit, number> = {
  sqft: 1,
  sqyd: 9,
  sqm: 10.7639,
  cent: 435.6,
  ground: 2400,
  acre: 43_560,
  hectare: 107_639,
};

/** Converts an area to sq.ft, rounded to 2 decimals. */
export function toSqft(value: number, unit: AreaUnit): number {
  return Math.round(value * SQFT_PER_UNIT[unit] * 100) / 100;
}

/** "2,400 sq.ft", "1.5 acre". */
export function formatArea(value: number, unit: AreaUnit): string {
  const shown = Number.isInteger(value) ? value.toLocaleString('en-IN') : String(value);
  return `${shown} ${AREA_UNIT_LABELS[unit]}`;
}
