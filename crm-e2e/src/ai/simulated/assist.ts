/**
 * Small pure helpers behind the module assistants (master prompt §12.2):
 * - Follow-up: when to follow up next and which message fits the stage;
 * - Import / extraction: is a paste a table, a buyer's enquiry, an owner's listing or an appointment, and the table's
 *   headers and rows;
 * - Property creation: a complete PropertyInput from a listing extraction (only when the essentials are there);
 * - Qualification: a lead patch from a field path and an answer ("qualification.timeline" = "m1to3").
 * Pure; no React, no store.
 */
import type { Extraction } from '../types'
import type { ImportKind, Lead, MessagePurpose, PropertyInput } from '@/domain/types'
import { addDaysToDay, localDay } from '@/lib/dates'
import { atLocal, norm, phonesIn } from './parse'

/* ---------- follow-up ---------- */

export type FollowUpSuggestion = { at: string; reasonKey: string; purpose: MessagePurpose }

/** The message purpose that fits where the lead is. */
export function purposeForStage(lead: Pick<Lead, 'stage' | 'firstContactAt'>): MessagePurpose {
  switch (lead.stage) {
    case 'new': return lead.firstContactAt ? 'followUp' : 'intro'
    case 'siteVisitScheduled': return 'visitConfirm'
    case 'siteVisitDone': return 'postVisit'
    case 'negotiation': return 'offer'
    default: return 'followUp'
  }
}

const round15 = (d: Date) => new Date(Math.ceil(d.getTime() / 900_000) * 900_000)

/**
 * When to follow up: a new lead or a hot one within two hours (in working hours), right after a visit the same
 * evening, otherwise the next working morning; a cold lead in three days. Sundays move to Monday.
 */
export function suggestFollowUpTime(lead: Pick<Lead, 'stage' | 'firstContactAt' | 'lastContactAt'>, temperature: 'hot' | 'warm' | 'cold', now: Date, opts: { visitJustDone?: boolean } = {}): FollowUpSuggestion {
  const purpose = purposeForStage(lead)
  const workday = (day: string) => (new Date(`${day}T12:00:00`).getDay() === 0 ? addDaysToDay(day, 1) : day)
  const today = localDay(now)
  if (opts.visitJustDone || lead.stage === 'siteVisitDone') {
    const evening = atLocal(today, '18:00')
    return { at: evening > now.toISOString() ? evening : atLocal(workday(addDaysToDay(today, 1)), '11:00'), reasonKey: 'ai:followUpTime.postVisit', purpose }
  }
  if (lead.stage === 'new' && !lead.firstContactAt) {
    const soon = round15(new Date(now.getTime() + 15 * 60_000))
    const ok = soon.getHours() >= 9 && soon.getHours() < 20
    return { at: ok ? soon.toISOString() : atLocal(workday(addDaysToDay(today, 1)), '10:00'), reasonKey: 'ai:followUpTime.newLead', purpose }
  }
  if (temperature === 'hot') {
    const soon = round15(new Date(now.getTime() + 2 * 3_600_000))
    const ok = soon.getHours() >= 9 && soon.getHours() < 20
    return { at: ok ? soon.toISOString() : atLocal(workday(addDaysToDay(today, 1)), '11:00'), reasonKey: 'ai:followUpTime.hot', purpose }
  }
  if (temperature === 'cold') return { at: atLocal(workday(addDaysToDay(today, 3)), '11:00'), reasonKey: 'ai:followUpTime.cold', purpose }
  return { at: atLocal(workday(addDaysToDay(today, 1)), '11:00'), reasonKey: 'ai:followUpTime.warm', purpose }
}

/* ---------- import / extraction ---------- */

export type PasteKind = 'table' | 'lead' | 'property' | 'appointment'

/** Splits a pasted sheet (CSV, TSV, ; or | separated) into headers and rows; undefined when it is not a table. */
export function parseTable(text: string): { headers: string[]; rows: string[][] } | undefined {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return undefined
  const sep = ['\t', ';', '|', ','].find((s) => lines.slice(0, 3).every((l) => l.split(s).length >= 3))
  if (!sep) return undefined
  const split = (l: string) => {
    if (sep !== ',') return l.split(sep).map((c) => c.trim())
    const out: string[] = []
    let cur = ''
    let quoted = false
    for (const ch of l) {
      if (ch === '"') quoted = !quoted
      else if (ch === ',' && !quoted) { out.push(cur.trim()); cur = '' }
      else cur += ch
    }
    out.push(cur.trim())
    return out
  }
  const [head, ...rest] = lines.map(split)
  // a header row has no phone numbers and few digits
  if (head.some((h) => phonesIn(h).length) || head.join('').replace(/\D/g, '').length > head.join('').length / 3) return undefined
  return { headers: head, rows: rest.filter((r) => r.length >= 2) }
}

/** What a paste is: a sheet, an owner's listing, an appointment, or (the default) a buyer's enquiry. */
export function classifyPaste(text: string): PasteKind {
  if (parseTable(text)) return 'table'
  const s = norm(text).toLowerCase()
  if (/\b(site visit|meeting|appointment|video call|schedule|reschedule)\b/.test(s) && /\b(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\s*(?:am|pm)|\d{1,2}:\d{2})\b/.test(s) && !/\b(looking for|budget|selling)\b/.test(s)) return 'appointment'
  const listing = /\b(for sale|selling|sell my|to sell|owner|asking|expected price|available for (?:sale|rent)|resale flat|rera|carpet|built[- ]?up|super built|khata|patta|dtcp|cmda|negotiable|for rent|to let)\b/.test(s)
  const buyer = /\b(looking for|want|wants|need|needs|interested in|budget|searching|require|chahiye|enquiry|inquiry)\b/.test(s)
  return listing && !buyer ? 'property' : 'lead'
}

/* ---------- property creation ---------- */

/** A complete PropertyInput from a listing extraction, or undefined while essentials are missing. */
export function propertyInputFrom(x: Extraction<PropertyInput>): PropertyInput | undefined {
  if (x.missing.length) return undefined
  const f = x.fields
  if (!f.type || !f.price || !f.location?.city || !f.location.locality || !f.area) return undefined
  return {
    title: f.title ?? '',
    type: f.type,
    purpose: f.purpose ?? 'sale',
    transaction: f.transaction ?? 'resale',
    configuration: f.configuration,
    projectName: f.projectName,
    builderName: f.builderName,
    location: f.location,
    price: f.price,
    priceNegotiable: f.priceNegotiable,
    maintenancePerMonth: f.maintenancePerMonth,
    area: f.area,
    bedrooms: f.bedrooms,
    bathrooms: f.bathrooms,
    balconies: f.balconies,
    floor: f.floor,
    totalFloors: f.totalFloors,
    facing: f.facing,
    vastuCompliant: f.vastuCompliant,
    corner: f.corner,
    parking: f.parking ?? { covered: 0, open: 0 },
    furnishing: f.furnishing,
    gatedCommunity: f.gatedCommunity,
    amenities: f.amenities ?? [],
    possession: f.possession ?? { status: 'ready' },
    rera: f.rera,
    approvals: f.approvals ?? [],
    khata: f.khata,
    pattaAvailable: f.pattaAvailable,
    bankApprovals: f.bankApprovals ?? [],
    roadWidthFt: f.roadWidthFt,
    specs: f.specs ?? {},
    status: 'available',
    listing: 'live',
    media: [],
    owner: f.owner?.phone ? f.owner : undefined,
    fieldMeta: x.meta,
  }
}

/* ---------- qualification ---------- */

/** "qualification.timeline" + "m1to3" → { qualification: { timeline: 'm1to3' } } (one level of nesting). */
export function patchFromPath(path: string, value: unknown): Record<string, unknown> {
  const [head, leaf] = path.split('.')
  return leaf ? { [head]: { [leaf]: value } } : { [head]: value }
}

/** Which import a sheet looks like, from its headers (a buyer list or one of the property kinds). */
export function guessImportKind(headers: string[]): ImportKind {
  const h = headers.join(' ').toLowerCase()
  const buyer = /\b(name|customer|client|buyer|mobile|phone|budget|enquiry|source)\b/.test(h)
  const listing = /\b(price|asking|carpet|built|sq\.?\s?ft|sqft|rera|facing|floor|possession|project|owner)\b/.test(h)
  if (buyer && (!listing || /\bbudget\b/.test(h))) return 'leads'
  if (/\b(plot|acre|cents|guntha|survey|dtcp)\b/.test(h)) return 'plots'
  if (/\bvilla|independent house|row house\b/.test(h)) return 'villas'
  if (/\b(shop|office|showroom|warehouse|commercial)\b/.test(h)) return 'commercial'
  return listing ? 'apartments' : 'leads'
}

export type ImportReading =
  | { type: 'table'; kind: ImportKind; headers: string[]; rows: string[][] }
  | { type: Exclude<PasteKind, 'table'> }

/** The Import / extraction assistant's first step: a sheet (with its kind) or a single record's text. */
export function classifyImport(text: string, kind?: ImportKind): ImportReading {
  const table = parseTable(text)
  if (table) return { type: 'table', kind: kind && kind !== 'document' ? kind : guessImportKind(table.headers), ...table }
  const k = classifyPaste(text)
  return { type: k === 'table' ? 'lead' : k }
}
