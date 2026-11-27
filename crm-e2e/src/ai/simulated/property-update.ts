/**
 * "Update a property" in plain words (the Property Editing assistant of master prompt §12.2): "price reduced to 1.15 Cr",
 * "now on hold", "sold last week", "possession moved to Dec 2027", "semi-furnished now, 2 covered parking". Reuses the
 * listing reader (extract-property) and keeps only the facts that differ from the property, so the user sees a short
 * old → new list. Pure; no React, no store.
 */
import type { Property, PropertyInput, PropertyStatus } from '@/domain/types'
import { extractPropertyFields } from './extract-property'
import { amountsIn, norm } from './parse'

export type PropertyChange = { field: string; from?: unknown; to: unknown }
export type PropertyUpdateReading = { patch: Partial<PropertyInput>; changes: PropertyChange[] }

const STATUS_WORDS: [RegExp, PropertyStatus][] = [
  [/\b(sold|sold out|registered)\b/, 'sold'],
  [/\b(booked|token received|blocked for)\b/, 'booked'],
  [/\b(on hold|hold it|put on hold|reserved)\b/, 'onHold'],
  [/\b(available again|back (?:in|on) (?:the )?market|available|released)\b/, 'available'],
]

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function readPropertyUpdate(text: string, property: Property, ctx: { now: Date }): PropertyUpdateReading {
  const s = norm(text)
  const lower = s.toLowerCase()
  const x = extractPropertyFields(s, ctx)
  const patch: Partial<PropertyInput> = {}
  const changes: PropertyChange[] = []
  const set = <K extends keyof PropertyInput>(k: K, v: PropertyInput[K] | undefined) => {
    if (v === undefined || same(v, property[k as keyof Property])) return
    patch[k] = v
    changes.push({ field: String(k), from: property[k as keyof Property], to: v })
  }

  const status = STATUS_WORDS.find(([re]) => re.test(lower))?.[1]
  if (status && status !== property.status) { patch.status = status; changes.push({ field: 'status', from: property.status, to: status }) }

  // a price change: "price reduced to 1.15 Cr", "new price 98 L", "asking 1.2 cr now"; one amount is enough when a price word is near
  const amounts = amountsIn(s)
  if (amounts.length && /\b(price|asking|rate|cost|reduced|dropped|increased|revised|now|quote|expected)\b/.test(lower)) {
    const pick = amounts[amounts.length - 1].value
    set('price', pick)
  }
  if (/\bnegotiable\b/.test(lower) && !/\bnon[- ]?negotiable|not negotiable|fixed price\b/.test(lower)) set('priceNegotiable', true)
  if (/\bnon[- ]?negotiable|not negotiable|fixed price\b/.test(lower)) set('priceNegotiable', false)
  const f = x.fields
  if (f.configuration && /\b(bhk|configuration|rk)\b/.test(lower)) set('configuration', f.configuration)
  if (f.facing) set('facing', f.facing)
  if (f.floor !== undefined) set('floor', f.floor)
  if (f.totalFloors !== undefined) set('totalFloors', f.totalFloors)
  if (f.furnishing) set('furnishing', f.furnishing)
  if (f.possession && /\b(possession|ready|under construction|handover|rtm)\b/.test(lower)) set('possession', f.possession)
  if (f.parking && /\bparking\b/.test(lower)) set('parking', f.parking)
  if (f.area && /\b(sq|sft|sqft|area|carpet|built|cents|acres|yards)\b/.test(lower)) set('area', { ...property.area, ...f.area })
  if (f.amenities?.length) {
    const next = [...new Set([...property.amenities, ...f.amenities])]
    if (next.length !== property.amenities.length) set('amenities', next)
  }
  if (f.rera) set('rera', f.rera)
  if (f.vastuCompliant) set('vastuCompliant', true)
  if (f.corner) set('corner', true)
  return { patch, changes }
}
