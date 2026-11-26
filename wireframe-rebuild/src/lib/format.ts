/** Indian display formats: ₹62 L, ₹1.25 Cr, 1,200 sq.ft. Empty values return '' so callers can hide them. */

export function inr(n: number | undefined | null): string {
  if (n == null || Number.isNaN(n)) return ''
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

export function inrShort(n: number | undefined | null): string {
  if (n == null || Number.isNaN(n)) return ''
  if (n >= 1e7) return '₹' + trim((n / 1e7).toFixed(2)) + ' Cr'
  if (n >= 1e5) return '₹' + trim((n / 1e5).toFixed(1)) + ' L'
  return inr(n)
}

const trim = (s: string) => s.replace(/\.?0+$/, '')

export function num(n: number | undefined | null): string {
  if (n == null || Number.isNaN(n)) return ''
  return n.toLocaleString('en-IN')
}

export function sqft(n: number | undefined | null): string {
  return n == null ? '' : `${num(n)} sq.ft.`
}

export function fmtDate(iso: string | undefined, lang = 'en'): string {
  if (!iso) return ''
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86_400_000)
}

/**
 * A date n days after `iso` (YYYY-MM-DD), worked out in local time. Never use toISOString() for this: it converts to UTC,
 * which in India (UTC+5:30) turns local midnight into the previous day, so "tomorrow" would come out as today.
 */
export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const initials =(name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
