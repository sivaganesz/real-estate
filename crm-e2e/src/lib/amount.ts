/**
 * Rupee amounts as people type them: a number and a unit (lakh or crore), so nobody counts zeros.
 * ₹1.28 Cr ↔ { v: '1.28', unit: 'Cr' } · ₹85 L ↔ { v: '85', unit: 'L' }.
 * Ported from wireframe-rebuild/src/lib/amount.ts; adds parseAmountText for typed text ("1.2 Cr", "85 lakhs", "45,00,000").
 */
export type AmountUnit = 'L' | 'Cr'
export type AmountField = { v: string; unit: AmountUnit }

export const LAKH = 100_000
export const CRORE = 10_000_000
const FACTOR: Record<AmountUnit, number> = { L: LAKH, Cr: CRORE }

export const toAmountField = (n?: number, unit?: AmountUnit): AmountField => {
  if (!n) return { v: '', unit: unit ?? 'L' }
  const u: AmountUnit = unit ?? (n >= CRORE ? 'Cr' : 'L')
  return { v: String(+(n / FACTOR[u]).toFixed(u === 'Cr' ? 4 : 2)), unit: u }
}

export const fromAmountField = (f: AmountField): number | undefined => {
  const x = parseFloat(f.v)
  return Number.isFinite(x) && x > 0 ? Math.round(x * FACTOR[f.unit]) : undefined
}

/**
 * Reads a typed amount: "1.2 Cr", "1.2cr", "85 L", "85 lakhs", "85 lac", "₹45,00,000", "4500000", "75k".
 * A bare number below 1,000 is read as lakhs ("85" → ₹85 L), which is how people talk about property prices.
 * Returns undefined when there is no number.
 */
export function parseAmountText(text: string): number | undefined {
  const m = /(\d[\d,]*(?:\.\d+)?)\s*(crores?|cr|lakhs?|lacs?|lac|l|k|thousand)?\b/i.exec(text.replace(/₹/g, ' ').trim())
  if (!m) return undefined
  const v = parseFloat(m[1].replace(/,/g, ''))
  if (!Number.isFinite(v)) return undefined
  const unit = (m[2] ?? '').toLowerCase()
  if (unit.startsWith('c')) return Math.round(v * CRORE)
  if (unit.startsWith('l')) return Math.round(v * LAKH)
  if (unit === 'k' || unit === 'thousand') return Math.round(v * 1000)
  return v < 1000 ? Math.round(v * LAKH) : Math.round(v)
}
