/**
 * Lead Editing Assistant (master prompt §12.2, §12.3 "and edits"): "change budget to 1.5 Cr and add Hebbal" →
 * a reviewed patch. The text goes through the same AI extraction as Add lead; only the fields the AI read are
 * considered, and each becomes a visible "from → to" change the user ticks before Apply. Lists follow the words:
 * "add / also / include" adds, "remove / drop / without" removes, anything else replaces. Nothing is saved here.
 */
import type { FieldMetaMap, Lead, LeadInput } from '@/domain/types'
import { cityOfLocality } from '@/domain/catalogue'
import type { LeadFieldPatch } from '@/services/leads'
import { getPath } from './lead-form'

export type EditChange = { path: string; from: unknown; to: unknown; confidence?: number }

const LIST_PATHS = new Set([
  'requirement.localities', 'requirement.cities', 'requirement.configurations', 'requirement.propertyTypes', 'requirement.facing',
  'requirement.amenities', 'qualification.decisionMakers',
])
/** Paths an edit may change; contact details only when the message clearly talks about them. */
const CONTACT_WORDS: Record<string, RegExp> = {
  name: /\bname\b/i,
  phone: /\b(phone|mobile|number|contact)\b/i,
  altPhone: /\b(alternate|alternative|another|second|other)\b/i,
  email: /\b(e-?mail|mail id)\b/i,
}

const ADD = /\b(add|also|include|including|plus|along with)\b/i
const REMOVE = /\b(remove|drop|delete|without|exclude|no longer|not interested in)\b/i

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function editChanges(lead: Lead, text: string, x: { fields: Partial<LeadInput>; meta: FieldMetaMap }): EditChange[] {
  const remove = REMOVE.test(text)
  const add = !remove && ADD.test(text)
  const out: EditChange[] = []
  // "need" is inferred from the other fields, not said; NRI only when the message says so
  const paths = Object.keys(x.meta).filter((p) => p !== 'qualification.need' && (p !== 'isNri' || /\bnri\b/i.test(text)))
  for (const path of paths) {
    if (path in CONTACT_WORDS && !CONTACT_WORDS[path].test(text)) continue
    const to = getPath(x.fields, path)
    if (to === undefined) continue
    const from = getPath(lead, path)
    let next: unknown = to
    if (LIST_PATHS.has(path) && Array.isArray(to)) {
      const cur = Array.isArray(from) ? (from as unknown[]) : []
      next = remove ? cur.filter((v) => !to.includes(v)) : add ? [...new Set([...cur, ...to])] : to
    }
    if (same(from, next)) continue
    out.push({ path, from, to: next, confidence: x.meta[path]?.confidence })
  }
  return keepPlacesConsistent(lead, out, remove)
}

/** Cities follow localities: removing a city also removes its localities; a kept locality keeps its city. */
function keepPlacesConsistent(lead: Lead, changes: EditChange[], remove: boolean): EditChange[] {
  const loc = changes.find((c) => c.path === 'requirement.localities')
  const city = changes.find((c) => c.path === 'requirement.cities')
  if (remove && city && !loc) {
    const cities = city.to as string[]
    const kept = lead.requirement.localities.filter((l) => { const c = cityOfLocality(l); return !c || cities.includes(c) })
    if (kept.length !== lead.requirement.localities.length) changes.push({ path: 'requirement.localities', from: lead.requirement.localities, to: kept })
  }
  if (remove && loc && city) {
    // "remove Hebbal" names the locality; its city stays while another locality there remains
    const locs = loc.to as string[]
    const needed = new Set(locs.map((l) => cityOfLocality(l)).filter(Boolean))
    const cities = lead.requirement.cities.filter((c) => needed.has(c) || !(city.from as string[]).includes(c) || !lead.requirement.localities.some((l) => cityOfLocality(l) === c))
    city.to = cities
    if (same(city.from, city.to)) changes.splice(changes.indexOf(city), 1)
  }
  return changes
}

/** The selected changes as a service patch, keeping the budget order valid. */
export function patchFromChanges(lead: Lead, changes: EditChange[]): { patch: LeadFieldPatch; fieldMeta: FieldMetaMap } {
  const requirement: Record<string, unknown> = {}
  const qualification: Record<string, unknown> = {}
  const patch: Record<string, unknown> = {}
  const fieldMeta: FieldMetaMap = {}
  for (const c of changes) {
    const [head, key] = c.path.split('.')
    if (head === 'requirement' && key) requirement[key] = c.to
    else if (head === 'qualification' && key) qualification[key] = c.to
    else patch[c.path] = c.to
    fieldMeta[c.path] = { origin: 'ai', confidence: c.confidence }
  }
  const max = (requirement.budgetMax as number | undefined) ?? lead.requirement.budgetMax
  if (max) {
    const min = (requirement.budgetMin as number | undefined) ?? lead.requirement.budgetMin
    const pref = (requirement.budgetPreferred as number | undefined) ?? lead.requirement.budgetPreferred
    if (min && min > max) requirement.budgetMin = undefined
    if (pref && pref > max) requirement.budgetPreferred = max
  }
  if (Object.keys(requirement).length) patch.requirement = requirement
  if (Object.keys(qualification).length) patch.qualification = qualification
  return { patch: patch as LeadFieldPatch, fieldMeta }
}
