/**
 * The Check screen's choices → what the import service writes (master prompt §15.1 "confirm → summary"):
 * ready rows are created, draft rows become Drafts, duplicates are skipped or update the existing record,
 * error rows and rows the user skipped are not imported and are listed (with their problems) in the failed-rows CSV.
 * Pure; unit-tested.
 */
import type { Draft, ID, PropertyInput, Qualification, Requirement } from '@/domain/types'
import type { SheetKind } from './fields'
import type { EvaluatedRow, Issue, LeadRecord } from './rows'

export type DraftInputLikePublic = Pick<Draft, 'kind' | 'title' | 'payload' | 'fieldMeta' | 'source'>
export type LeadUpdate = {
  id: ID
  patch: { email?: string; altPhone?: string; sourceDetail?: string; preferredLanguage?: string; requirement?: Partial<Requirement>; qualification?: Partial<Qualification> }
  note?: string
}
export type PropertyUpdate = { id: ID; patch: Partial<PropertyInput> }

export type PlanOptions = {
  kind: SheetKind
  fileName: string
  /** What to do with rows that already exist in the CRM. Rows repeated inside the file are always skipped. */
  duplicates: 'skip' | 'update'
  /** Properties: ready rows go live (matchable) or stay as listing drafts. */
  publish: boolean
  skipped: ReadonlySet<number>
}

export type ImportPlan = {
  leads: LeadRecord[]
  properties: PropertyInput[]
  leadUpdates: LeadUpdate[]
  propertyUpdates: PropertyUpdate[]
  drafts: DraftInputLikePublic[]
  errorRows: { row: number; messages: string[] }[]
  /** Rows not imported, for the CSV: row number + problems (issue keys with params). */
  failed: { row: EvaluatedRow; reason: 'error' | 'skipped' | 'duplicate' }[]
  counts: { total: number; imported: number; updated: number; skipped: number; duplicates: number; errors: number; drafts: number }
}

/** Only the fields a re-import may change on an existing record (non-empty values from the sheet). */
function leadPatch(r: LeadRecord): LeadUpdate['patch'] {
  const p: LeadUpdate['patch'] = {}
  if (r.email) p.email = r.email
  if (r.altPhone) p.altPhone = r.altPhone
  if (r.sourceDetail) p.sourceDetail = r.sourceDetail
  if (r.preferredLanguage) p.preferredLanguage = r.preferredLanguage
  const req = r.requirement
  if (req && (req.cities.length || req.localities.length || req.configurations.length || req.propertyTypes.length || req.budgetMax || req.budgetMin)) {
    p.requirement = {
      ...(req.cities.length ? { cities: req.cities } : {}), ...(req.localities.length ? { localities: req.localities } : {}),
      ...(req.configurations.length ? { configurations: req.configurations } : {}), ...(req.propertyTypes.length ? { propertyTypes: req.propertyTypes } : {}),
      ...(req.budgetMin ? { budgetMin: req.budgetMin } : {}), ...(req.budgetMax ? { budgetMax: req.budgetMax } : {}),
    }
  }
  if (r.qualification?.timeline) p.qualification = { timeline: r.qualification.timeline }
  return p
}
function propertyPatch(p: PropertyInput): Partial<PropertyInput> {
  const out: Partial<PropertyInput> = { price: p.price }
  if (Object.keys(p.area).length) out.area = p.area
  if (p.possession) out.possession = p.possession
  if (p.rera) out.rera = p.rera
  if (p.facing) out.facing = p.facing
  if (p.floor != null) out.floor = p.floor
  if (p.description) out.description = p.description
  return out
}

export const issueMessage = (i: Issue) => i.key

export function planImport(rows: EvaluatedRow[], o: PlanOptions): ImportPlan {
  const plan: ImportPlan = {
    leads: [], properties: [], leadUpdates: [], propertyUpdates: [], drafts: [], errorRows: [], failed: [],
    counts: { total: rows.length, imported: 0, updated: 0, skipped: 0, duplicates: 0, errors: 0, drafts: 0 },
  }
  const updated = new Set<ID>()
  for (const r of rows) {
    if (o.skipped.has(r.rowNumber)) {
      plan.counts.skipped++
      plan.failed.push({ row: r, reason: 'skipped' })
      continue
    }
    if (r.status === 'error') {
      plan.counts.errors++
      plan.errorRows.push({ row: r.rowNumber, messages: r.issues.filter((i) => i.level !== 'warning').map(issueMessage) })
      plan.failed.push({ row: r, reason: 'error' })
      continue
    }
    if (r.status === 'duplicate') {
      plan.counts.duplicates++
      const d = r.duplicate
      if (o.duplicates === 'update' && d && d.kind !== 'row' && !updated.has(d.id)) {
        updated.add(d.id)
        if (d.kind === 'lead' && r.lead) plan.leadUpdates.push({ id: d.id, patch: leadPatch(r.lead), note: r.lead.note })
        if (d.kind === 'property' && r.property) plan.propertyUpdates.push({ id: d.id, patch: propertyPatch(r.property) })
      } else {
        plan.counts.skipped++
        plan.failed.push({ row: r, reason: 'duplicate' })
      }
      continue
    }
    if (r.status === 'draft') {
      const isLead = o.kind === 'leads'
      const payload = (isLead ? r.lead : r.property) as Record<string, unknown> | undefined
      plan.drafts.push({
        kind: isLead ? 'lead' : 'property',
        title: r.label,
        payload: payload ?? {},
        fieldMeta: r.meta,
        source: { type: 'import', fileName: o.fileName },
      })
      continue
    }
    if (o.kind === 'leads' && r.lead) plan.leads.push(r.lead)
    else if (r.property) plan.properties.push({ ...r.property, listing: o.publish ? 'live' : 'draft' })
  }
  plan.counts.imported = plan.leads.length + plan.properties.length
  plan.counts.updated = plan.leadUpdates.length + plan.propertyUpdates.length
  plan.counts.drafts = plan.drafts.length
  return plan
}

const csvCell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

/**
 * The rows that were not imported, as they came in, plus a Problems column, ready to fix and upload again.
 * `problem` turns an issue into readable text (the page passes the translator).
 */
export function failedRowsCsv(headers: string[], cellsByRow: Map<number, string[]>, failed: ImportPlan['failed'], problem: (i: Issue) => string, reasonText: (r: 'error' | 'skipped' | 'duplicate') => string): string {
  const lines = [[...headers, 'Row', 'Problems'].map(csvCell).join(',')]
  for (const f of failed) {
    const cells = cellsByRow.get(f.row.rowNumber) ?? []
    const problems = f.reason === 'error' ? f.row.issues.filter((i) => i.level !== 'warning').map(problem) : [reasonText(f.reason)]
    lines.push([...headers.map((_, i) => cells[i] ?? ''), String(f.row.rowNumber), problems.join('; ')].map(csvCell).join(','))
  }
  return `${lines.join('\r\n')}\r\n`
}
