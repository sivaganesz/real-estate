/**
 * Display text for proposal cards: a changed field's label and its old → new value, in the UI language
 * (catalogue labels, ₹ L / Cr, phone format). Used by the command reader and by the edit forms of the panel.
 */
import i18next from 'i18next'
import { configLabel } from '@/lib/matching'
import { fmtDate, inrShort, num } from '@/lib/format'
import { phoneDisplay } from '@/lib/phone'

const t = (key: string, opts: Record<string, unknown> = {}): string => i18next.t(key, opts)

const CATALOGUE: Record<string, string> = {
  possession: 'possession', timeline: 'timeline', loan: 'loan', buyerPurpose: 'buyerPurpose', authority: 'authority',
  source: 'source', status: 'propertyStatus', furnishing: 'furnishing', need: 'need', type: 'propertyType',
}
const LIST_CATALOGUE: Record<string, string> = {
  decisionMakers: 'decisionMaker', facing: 'facing', propertyTypes: 'propertyType', amenities: 'amenity',
}
const MONEY = new Set(['budgetMax', 'budgetMin', 'budgetPreferred', 'price', 'maintenancePerMonth'])

/** The last part of a field path ("requirement.budgetMax" → "budgetMax"). */
export const fieldKey = (path: string) => path.split('.').pop() ?? path

/** The label i18n key for a changed field. */
export const fieldLabelKey = (path: string) => `ai:changeField.${fieldKey(path)}`

/** A field value as display text. */
export function fieldValue(path: string, v: unknown): string {
  const k = fieldKey(path)
  if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return t('ai:value.none')
  if (MONEY.has(k) && typeof v === 'number') return inrShort(v)
  if (k === 'phone' || k === 'altPhone') return phoneDisplay(String(v))
  if (k === 'configurations' && Array.isArray(v)) return v.map((c) => configLabel(c as never)).join(', ')
  if (k === 'configuration') return configLabel(v as never)
  if (k === 'facing' && typeof v === 'string') return t(`catalogue:facing.${v}`)
  if (LIST_CATALOGUE[k] && Array.isArray(v)) return v.map((x) => t(`catalogue:${LIST_CATALOGUE[k]}.${String(x)}`)).join(', ')
  if (CATALOGUE[k] && typeof v === 'string') return t(`catalogue:${CATALOGUE[k]}.${v}`)
  if (k === 'possession' && typeof v === 'object') {
    const p = v as { status: string; date?: string }
    return p.date ? `${t(`catalogue:possession.${p.status}`)} · ${fmtDate(p.date)}` : t(`catalogue:possession.${p.status}`)
  }
  if (k === 'parking' && typeof v === 'object') {
    const p = v as { covered: number; open: number }
    return t('ai:value.parking', { covered: p.covered, open: p.open })
  }
  if (k === 'area' && typeof v === 'object') {
    const a = v as Record<string, number | string | undefined>
    const part = (key: string) => (typeof a[key] === 'number' ? t(`ai:value.area.${key}`, { n: num(a[key] as number) }) : '')
    return ['carpet', 'builtUp', 'superBuiltUp', 'plot'].map(part).filter(Boolean).join(' · ') || t('ai:value.none')
  }
  if (k === 'rera' && typeof v === 'object') return (v as { number: string }).number
  if (typeof v === 'boolean') return t(v ? 'ai:value.yes' : 'ai:value.no')
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'number') return num(v)
  return String(v)
}

/** "₹1.2 Cr → ₹1.5 Cr" (or just the new value when there was none). */
export function changeText(path: string, from: unknown, to: unknown): string {
  const empty = from === undefined || from === null || from === '' || (Array.isArray(from) && !from.length)
  return empty ? fieldValue(path, to) : `${fieldValue(path, from)} → ${fieldValue(path, to)}`
}
