/**
 * The Add / Edit lead form model, kept pure so the sheet, the page and the AI fill share one set of rules
 * (master prompt §12.3, §12.6). Smart required: name + phone or e-mail + source. Everything else is optional and
 * lives in collapsed sections. Paste-and-fill only touches the fields the AI actually read (its `meta` keys), so a
 * value the user typed is never wiped by an empty extraction.
 * Ported in spirit from wireframe-rebuild/src/features/leads/lead-form.tsx (draftOf / withPrefill / build) and
 * adapted to the new LeadInput shape.
 */
import type { FieldMetaMap, ID, Lead, LeadInput, LeadSource, Qualification, Requirement } from '@/domain/types'
import { CITIES, PROPERTY_TYPES, cityOfLocality } from '@/domain/catalogue'
import { validateLead, type FieldError } from '@/lib/validation'

export type OwnerChoice = ID | 'auto' | 'unassigned'

export type LeadDraft = {
  name: string
  phone: string
  altPhone: string
  email: string
  source?: LeadSource
  sourceDetail: string
  isNri: boolean
  nriCountry: string
  preferredLanguage: string
  contactPref?: Lead['contactPref']
  familySize?: number
  /** Managers and admins: a person, "auto" (assignment engine) or leave unassigned. Executives always own their leads. */
  owner: OwnerChoice
  requirement: Requirement
  qualification: Qualification
  consent: boolean
  notes: string
}

export const emptyRequirement = (): Requirement => ({
  propertyTypes: [], configurations: [], cities: [], localities: [], budgetFlexPct: 10, possession: 'any', facing: [],
  amenities: [], mustHaves: [], purpose: 'sale',
})

export const emptyDraft = (owner: OwnerChoice = 'auto'): LeadDraft => ({
  name: '', phone: '', altPhone: '', email: '', source: undefined, sourceDetail: '', isNri: false, nriCountry: '', preferredLanguage: '',
  contactPref: undefined, familySize: undefined, owner, requirement: emptyRequirement(), qualification: { decisionMakers: [], loan: 'unknown' },
  consent: false, notes: '',
})

export function draftFromLead(l: Lead): LeadDraft {
  return {
    name: l.name, phone: l.phone, altPhone: l.altPhone ?? '', email: l.email ?? '', source: l.source, sourceDetail: l.sourceDetail ?? '',
    isNri: l.isNri, nriCountry: l.nriCountry ?? '', preferredLanguage: l.preferredLanguage ?? '', contactPref: l.contactPref,
    familySize: l.familySize, owner: l.ownerId ?? 'unassigned',
    requirement: structuredClone({ ...emptyRequirement(), ...l.requirement }),
    qualification: structuredClone(l.qualification),
    consent: !!l.consent?.followUp && !l.consent.withdrawnAt, notes: '',
  }
}

/** Read a dotted path ('requirement.budgetMax'). */
export function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj)
}

/** Immutable set of a dotted path. */
export function setPath<T>(obj: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split('.')
  const base = (obj ?? {}) as Record<string, unknown>
  return { ...base, [head]: rest.length ? setPath(base[head], rest.join('.'), value) : value } as T
}

/** Lists that hold places keep cities in step with localities: a locality brings its city, a removed city its localities. */
export function withPlaces(d: LeadDraft, next: { cities?: string[]; localities?: string[] }): LeadDraft {
  let cities = next.cities ?? d.requirement.cities
  let localities = next.localities ?? d.requirement.localities
  if (next.cities) localities = localities.filter((loc) => { const c = cityOfLocality(loc); return !c || cities.includes(c) })
  if (next.localities) {
    for (const loc of localities) {
      const c = cityOfLocality(loc)
      if (c && !cities.includes(c)) cities = [...cities, c]
    }
  }
  return { ...d, requirement: { ...d.requirement, cities, localities } }
}

/** Localities offered for the chosen cities (all cities when none is chosen). */
export const localityOptions = (cities: string[]) => (cities.length ? cities : Object.keys(CITIES)).flatMap((c) => CITIES[c] ?? [])

/** Whether the requirement asks for homes (so BHK, possession and furnishing questions make sense). */
export const wantsHomes = (r: Pick<Requirement, 'propertyTypes'>) => !r.propertyTypes.length || r.propertyTypes.some((t) => PROPERTY_TYPES[t].configurable)

/**
 * Apply an AI extraction: only the paths the AI read (meta keys) are written; a field the user typed after an earlier
 * extraction is overwritten only if the AI read it again. Returns the new draft and the AI meta to mark.
 */
export function applyExtraction(d: LeadDraft, x: { fields: Partial<LeadInput>; meta: FieldMetaMap }): { draft: LeadDraft; meta: FieldMetaMap } {
  let next = d
  const meta: FieldMetaMap = {}
  for (const [path, m] of Object.entries(x.meta)) {
    const value = getPath(x.fields, path)
    if (value === undefined) continue
    next = setPath(next, path, value)
    meta[path] = m
  }
  return { draft: next, meta }
}

/** A missing-question chip answer: AI chips may carry one-item lists ([value]) for list fields. */
export function answerField(d: LeadDraft, field: string, value: unknown): LeadDraft {
  const cur = getPath(d, field)
  if (Array.isArray(cur)) {
    const add = Array.isArray(value) ? value : [value]
    const merged = [...new Set([...cur, ...add])]
    if (field === 'requirement.localities') return withPlaces(d, { localities: merged as string[] })
    if (field === 'requirement.cities') return withPlaces(d, { cities: merged as string[] })
    let next = setPath(d, field, merged)
    if (field === 'requirement.configurations' && !next.requirement.propertyTypes.length) next = setPath(next, 'requirement.propertyTypes', ['apartment'])
    if (field === 'qualification.decisionMakers' && !next.qualification.authority) {
      const makers = merged as Qualification['decisionMakers']
      next = setPath(next, 'qualification.authority', makers.length === 1 && makers[0] === 'self' ? 'sole' : 'joint')
    }
    return next
  }
  return setPath(d, field, Array.isArray(value) ? value[0] : value)
}

const trim = (s: string) => s.trim() || undefined

/** The service input for createLead / updateLead (owner handled by the caller). */
export function draftToInput(d: LeadDraft): Omit<LeadInput, 'ownerId'> & { source: LeadSource } {
  const r = d.requirement
  return {
    name: d.name.trim(),
    phone: d.phone.trim(),
    altPhone: trim(d.altPhone),
    email: trim(d.email)?.toLowerCase(),
    source: d.source as LeadSource,
    sourceDetail: trim(d.sourceDetail),
    isNri: d.isNri,
    nriCountry: d.isNri ? trim(d.nriCountry) : undefined,
    preferredLanguage: trim(d.preferredLanguage),
    contactPref: d.contactPref,
    familySize: d.familySize || undefined,
    requirement: {
      ...r,
      budgetPreferred: r.budgetPreferred && r.budgetMax && r.budgetPreferred > r.budgetMax ? r.budgetMax : r.budgetPreferred,
      configurations: wantsHomes(r) ? r.configurations : [],
    },
    qualification: d.qualification,
  }
}

/** Smart-required validation for the form (name, phone or e-mail, source) plus budget order. */
export function draftErrors(d: LeadDraft): FieldError[] {
  return validateLead({ ...draftToInput(d), source: d.source })
}

/** Which form step an error belongs to (the sheet jumps there on Save). */
export function stepOfField(field: string): 0 | 1 | 2 {
  if (field.startsWith('requirement.budget')) return 2
  if (field.startsWith('requirement.')) return 1
  if (field.startsWith('qualification.')) return 2
  return 0
}

/** How many optional details are set in a section (the "+ More details (n)" trigger). */
export function moreCount(d: LeadDraft): { contact: number; requirement: number; qualification: number } {
  const r = d.requirement
  const q = d.qualification
  return {
    contact: [d.altPhone, d.email, d.sourceDetail, d.preferredLanguage, d.contactPref, d.familySize, d.isNri || undefined].filter(Boolean).length,
    requirement: [r.areaMinSqft, r.areaMaxSqft, r.facing.length, r.furnishing && r.furnishing !== 'any', r.amenities.length, r.parking, r.transaction && r.transaction !== 'any', r.vastu, r.mustHaves.length].filter(Boolean).length,
    qualification: [q.loan !== 'unknown', q.buyerPurpose, q.fundingReady].filter(Boolean).length,
  }
}

/** A complete Lead built from the draft, for live previews (matching fit, qualification card, assignment). Never saved. */
export function previewLead(d: LeadDraft, nowIso: string, base?: Lead): Lead {
  const input = draftToInput(d)
  return {
    id: base?.id ?? 'LEAD-NEW', createdBy: base?.createdBy ?? 'system', createdAt: base?.createdAt ?? nowIso, updatedAt: nowIso, createdVia: base?.createdVia ?? 'manual',
    stage: base?.stage ?? 'new', stageSince: base?.stageSince ?? nowIso, stageHistory: base?.stageHistory ?? [],
    engagement: base?.engagement ?? { responded: false, docsRequested: false, siteVisited: false }, shortlist: base?.shortlist ?? [], tags: base?.tags ?? [],
    ownerId: base?.ownerId ?? null,
    ...input,
    name: input.name || '—',
  }
}
