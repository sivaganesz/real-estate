/**
 * Small readers the wireframe's "AI" uses on a message: amounts, dates, times, phone numbers, and which lead or property
 * it names. In the product the AI returns these values itself (lib/ai/understand.ts says how); these rules only stand in
 * so the screens can be shown. They never guess: a value they can't read is left out, and the assistant asks.
 */
import { CITIES } from '@/data/catalogue'
import type { Lead, Property } from '@/data/types'
import { addDays } from '@/lib/format'

const UNIT: Record<string, number> = { l: 1e5, lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5, 'லட்சம்': 1e5, cr: 1e7, crore: 1e7, crores: 1e7, 'கோடி': 1e7 }
const UNIT_RE = '(l|lakhs?|lacs?|cr|crores?|லட்சம்|கோடி)\\b'
const toRupees = (n: string, unit: string) => Math.round(parseFloat(n.replace(/,/g, '')) * UNIT[unit.toLowerCase()])

/** Every amount with a unit, in order: "50–60 L" gives both 50 L and 60 L. */
export function amounts(text: string): number[] {
  const out: number[] = []
  // a range with one unit at the end: "50-60 L", "50 to 60 lakh", "1.2 – 1.5 Cr"
  const range = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:-|–|to)\\s*(\\d+(?:\\.\\d+)?)\\s*${UNIT_RE}`, 'gi')
  const taken: [number, number][] = []
  for (const m of text.matchAll(range)) {
    out.push(toRupees(m[1], m[3]), toRupees(m[2], m[3]))
    taken.push([m.index!, m.index! + m[0].length])
  }
  for (const m of text.matchAll(new RegExp(`₹?\\s*(\\d+(?:[.,]\\d+)?)\\s*${UNIT_RE}`, 'gi'))) {
    if (taken.some(([a, b]) => m.index! >= a && m.index! < b)) continue
    out.push(toRupees(m[1], m[2]))
  }
  return out
}

/** The first amount after any of the words: amountAfter("offered 1.28 Cr, seller wants 1.32 Cr", /offer/) → 1.28 Cr. */
export function amountAfter(text: string, words: RegExp): number | undefined {
  const m = words.exec(text)
  if (!m) return undefined
  return amounts(text.slice(m.index))[0]
}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const pad = (n: number) => String(n).padStart(2, '0')

/** A day named in the message, as YYYY-MM-DD: today, tomorrow, a weekday (the next one), "21 Nov", "21/11", "in 3 days", "next week". */
export function dateIn(text: string, today: string): string | undefined {
  const s = text.toLowerCase()
  if (/\b(day after tomorrow)\b/.test(s)) return addDays(today, 2)
  if (/\b(tomorrow|tmrw|tmr)\b|நாளை/.test(s)) return addDays(today, 1)
  if (/\btoday\b|இன்று/.test(s)) return today
  const inN = /\bin (\d+) days?\b/.exec(s)
  if (inN) return addDays(today, Number(inN[1]))
  if (/\bnext week\b/.test(s)) return addDays(today, 7)
  const dm = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/.exec(s) ?? /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})\b/.exec(s)
  if (dm) {
    const [d, mon] = /^\d/.test(dm[1]) ? [Number(dm[1]), dm[2]] : [Number(dm[2]), dm[1]]
    return withYear(today, MONTHS.indexOf(mon) + 1, d)
  }
  const slash = /\b(\d{1,2})\/(\d{1,2})\b/.exec(s)
  if (slash) return withYear(today, Number(slash[2]), Number(slash[1]))
  const wd = DAYS.findIndex((d) => new RegExp(`\\b(${d}|${d.slice(0, 3)})\\b`).test(s))
  if (wd >= 0) {
    const now = new Date(today + 'T00:00:00').getDay()
    return addDays(today, ((wd - now + 7) % 7) || 7)
  }
  return undefined
}
const withYear = (today: string, m: number, d: number) => {
  const y = Number(today.slice(0, 4))
  const iso = `${y}-${pad(m)}-${pad(d)}`
  return iso < today ? `${y + 1}-${pad(m)}-${pad(d)}` : iso
}

/** A time of day: "11 am", "3pm", "11:30", "15:00" → "HH:MM". */
export function timeIn(text: string): string | undefined {
  const m = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(text) ?? /\b(\d{1,2}):(\d{2})\b/.exec(text)
  if (!m) return undefined
  let h = Number(m[1])
  const min = m[2] ? Number(m[2]) : 0
  const ap = m[3]?.toLowerCase()
  if (ap === 'pm' && h < 12) h += 12
  if (ap === 'am' && h === 12) h = 0
  return h < 24 && min < 60 ? `${pad(h)}:${pad(min)}` : undefined
}

/** An Indian mobile number, written as +91 98765 43210, 98765-43210 or 9876543210. */
export function phoneIn(text: string): string | undefined {
  const m = /(\+?91[\s-]?)?([6-9]\d{4})[\s-]?(\d{5})\b/.exec(text)
  return m ? `+91 ${m[2]} ${m[3]}` : undefined
}

/** Leads the message names, by first name or full name ("Called Meena", "Arun's budget"). Longest name first. */
export function leadsNamed(text: string, leads: Lead[]): Lead[] {
  const s = text.toLowerCase()
  const hits = leads.filter((l) => {
    const full = l.name.toLowerCase()
    const first = full.split(/\s+/)[0]
    return s.includes(l.id.toLowerCase()) || new RegExp(`\\b${escape(full)}\\b`).test(s) || (first.length > 2 && new RegExp(`\\b${escape(first)}('s)?\\b`).test(s))
  })
  return hits.sort((a, b) => b.name.length - a.name.length)
}

/** A property the message names: its id ("PROP-1003", "1003") or most of its title. */
export function propertyNamed(text: string, props: Property[]): Property | undefined {
  const id = /\bprop[-\s]?(\d{4})\b/i.exec(text)?.[1]
  if (id) return props.find((p) => p.id === `PROP-${id}`)
  const s = text.toLowerCase()
  // a title is named when most of its words (4+ letters) appear
  let best: { p: Property; n: number } | undefined
  for (const p of props) {
    const words = p.title.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4)
    const n = words.filter((w) => s.includes(w)).length
    if (words.length && n / words.length >= 0.6 && (!best || n > best.n)) best = { p, n }
  }
  return best?.p
}

/** Cities and localities the message names; a locality brings its city. */
export function placesIn(text: string): { cities: string[]; localities: string[] } {
  const s = text.toLowerCase()
  const cities = new Set<string>(), localities = new Set<string>()
  for (const [city, locs] of Object.entries(CITIES)) {
    if (new RegExp(`\\b${escape(city.toLowerCase())}\\b`).test(s)) cities.add(city)
    for (const loc of locs) {
      const short = loc.toLowerCase().replace(/\s*\(.*\)$/, '')
      if (new RegExp(`\\b${escape(short)}\\b`).test(s)) { localities.add(loc); cities.add(city) }
    }
  }
  return { cities: [...cities], localities: [...localities] }
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
