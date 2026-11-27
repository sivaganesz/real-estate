/**
 * Indian display formats: ₹45,00,000, ₹62 L, ₹1.25 Cr, "₹60 L – ₹80 L", 1,200 sq.ft., 27 Nov 2026, 11:00 AM.
 * Empty values return '' so callers can hide them. Ported from wireframe-rebuild/src/lib/format.ts and extended.
 * Phone formatting lives in lib/phone.ts, local-day arithmetic and relative times in lib/dates.ts.
 */
import { format } from 'date-fns'

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

/** "₹60 L – ₹80 L", "up to ₹1.2 Cr" style ranges; one side missing shows the other alone with a prefix. */
export function inrRange(min: number | undefined | null, max: number | undefined | null, words: { upTo: string; from: string } = { upTo: 'up to', from: 'from' }): string {
  const lo = inrShort(min)
  const hi = inrShort(max)
  if (lo && hi) return lo === hi ? lo : `${lo} – ${hi}`
  if (hi) return `${words.upTo} ${hi}`
  if (lo) return `${words.from} ${lo}`
  return ''
}

const trim = (s: string) => s.replace(/\.?0+$/, '')

export function num(n: number | undefined | null): string {
  if (n == null || Number.isNaN(n)) return ''
  return n.toLocaleString('en-IN')
}

export function sqft(n: number | undefined | null): string {
  return n == null ? '' : `${num(n)} sq.ft.`
}

const toDate = (iso: string) => new Date(iso.length === 10 ? iso + 'T00:00:00' : iso)

/** DD MMM YYYY ("05 Nov 2026"); Tamil uses the ta-IN calendar words. */
export function fmtDate(iso: string | undefined, lang = 'en'): string {
  if (!iso) return ''
  const d = toDate(iso)
  if (Number.isNaN(d.getTime())) return iso
  if (lang === 'ta') return d.toLocaleDateString('ta-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  return format(d, 'dd MMM yyyy')
}

/** h:mm a ("11:00 AM"), local time. */
export function fmtTime(iso: string | undefined, lang = 'en'): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  if (lang === 'ta') return d.toLocaleTimeString('ta-IN', { hour: 'numeric', minute: '2-digit' })
  return format(d, 'h:mm a')
}

/** "05 Nov 2026, 11:00 AM". */
export function fmtDateTime(iso: string | undefined, lang = 'en'): string {
  if (!iso) return ''
  return `${fmtDate(iso, lang)}, ${fmtTime(iso, lang)}`
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

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? ''
