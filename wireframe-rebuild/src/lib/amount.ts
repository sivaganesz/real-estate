/**
 * Rupee amounts as people type them: a number and a unit (lakh or crore), so nobody counts zeros.
 * ₹1.28 Cr ↔ { v: '1.28', unit: 'Cr' } · ₹85 L ↔ { v: '85', unit: 'L' }.
 */
export type AmountUnit = 'L' | 'Cr'
export type AmountField = { v: string; unit: AmountUnit }

const FACTOR: Record<AmountUnit, number> = { L: 1e5, Cr: 1e7 }

export const toAmountField = (n?: number, unit?: AmountUnit): AmountField => {
  if (!n) return { v: '', unit: unit ?? 'L' }
  const u: AmountUnit = unit ?? (n >= 1e7 ? 'Cr' : 'L')
  return { v: String(+(n / FACTOR[u]).toFixed(u === 'Cr' ? 4 : 2)), unit: u }
}

export const fromAmountField = (f: AmountField): number | undefined => {
  const x = parseFloat(f.v)
  return Number.isFinite(x) && x > 0 ? Math.round(x * FACTOR[f.unit]) : undefined
}
