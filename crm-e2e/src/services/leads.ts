/**
 * Lead writes. Every change goes through commit(); ownership, first-call tasks, duplicates and stage consequences
 * are effects (services/core/effects.ts). Module owners may add new exported functions here (foundation-plan §8.2).
 */
import { current, type Draft } from 'immer'
import type { Deal, FieldMetaMap, ID, Lead, LeadInput, LostReason, Origin, PipelineStageKey, Qualification, Requirement } from '@/domain/types'
import { STAGE_RANK } from '@/domain/catalogue'
import { findDuplicates, type Duplicate } from '@/lib/duplicates'
import { toE164 } from '@/lib/phone'
import { assertValid, validateLead, validateStageMove } from '@/lib/validation'
import { assertActorCan } from './core/actor'
import { commit, getDb, must, type Tx } from './core/commit'
import { adminIds, managersFor, moveStage, notify } from './core/effects'

export const emptyRequirement = (): Requirement => ({
  propertyTypes: [], configurations: [], cities: [], localities: [], budgetFlexPct: 10, possession: 'any', facing: [],
  amenities: [], mustHaves: [], purpose: 'sale',
})
export const emptyQualification = (): Qualification => ({ decisionMakers: [], loan: 'unknown' })

/** What a form, the AI or an import must at least give: a name and a source (and a phone or email, validated). */
export type NewLead = Pick<LeadInput, 'name' | 'source'> & Partial<LeadInput>

/** Builds and inserts a lead on the draft, then emits lead.created (E2 decides the owner). Shared with imports. */
export function insertLead(tx: Tx, input: NewLead, via: Origin): ID {
  const id = tx.id('LEAD')
  const stage = input.stage ?? 'new'
  const lead: Lead = {
    ...input,
    id,
    name: input.name.trim(),
    phone: input.phone ? toE164(input.phone) || input.phone : '',
    altPhone: input.altPhone ? toE164(input.altPhone) || input.altPhone : undefined,
    email: input.email?.trim() || undefined,
    isNri: input.isNri ?? false,
    ownerId: input.ownerId ?? null,
    createdBy: tx.actor.id,
    createdAt: tx.now,
    updatedAt: tx.now,
    createdVia: via,
    stage,
    stageSince: tx.now,
    stageHistory: [{ stage, at: tx.now, by: tx.actor.id }],
    requirement: { ...emptyRequirement(), ...input.requirement },
    qualification: { ...emptyQualification(), ...input.qualification },
    engagement: { responded: false, docsRequested: false, siteVisited: false },
    shortlist: [],
    tags: input.tags ?? [],
  }
  tx.db.leads.push(lead)
  tx.emit({ type: 'lead.created', leadId: id, via })
  return id
}

export type CreateLeadResult = { id: ID; ownerId: ID | null; reasonKey?: string; duplicates: Duplicate[] }

/** Creates a lead. Executives own what they create; managers and admins get auto-assignment when it is on. */
export function createLead(input: NewLead, opts: { via?: Origin } = {}): CreateLeadResult {
  assertValid(validateLead(input))
  const duplicates = findDuplicates(getDb(), { phone: input.phone, altPhone: input.altPhone, email: input.email })
  const via = opts.via ?? 'manual'
  const { result: id } = commit('lead.create', (tx) => {
    assertActorCan(tx.actor, 'lead.create')
    if (input.ownerId && tx.actor.id !== 'system' && tx.actor.role !== 'executive') assertActorCan(tx.actor, 'lead.assign', { ownerId: input.ownerId }, tx.db)
    return insertLead(tx, input, via)
  }, { via })
  const db = getDb()
  const lead = db.leads.find((l) => l.id === id)
  const assignment = [...db.assignments].reverse().find((a) => a.leadId === id)
  return { id, ownerId: lead?.ownerId ?? null, reasonKey: assignment?.reason.key, duplicates }
}

/** Fields an edit may change (owner and stage have their own functions). */
export type LeadPatch = Partial<Omit<LeadInput, 'ownerId' | 'stage'>> & { tags?: string[]; engagement?: Partial<Lead['engagement']> }

function mergePatch(lead: Draft<Lead>, patch: LeadPatch, meta?: FieldMetaMap): string[] {
  const fields: string[] = []
  for (const [k, v] of Object.entries(patch) as [keyof LeadPatch, unknown][]) {
    if (v === undefined) continue
    if (k === 'requirement' || k === 'qualification' || k === 'engagement') {
      Object.assign(lead[k], v)
      fields.push(...Object.keys(v as object).map((f) => `${k}.${f}`))
    } else if (k === 'phone' || k === 'altPhone') {
      ;(lead as Record<string, unknown>)[k] = toE164(String(v)) || v
      fields.push(k)
    } else {
      ;(lead as Record<string, unknown>)[k] = v
      fields.push(k)
    }
  }
  if (meta) lead.fieldMeta = { ...lead.fieldMeta, ...meta }
  return fields
}

export function updateLead(id: ID, patch: LeadPatch, opts: { via?: Origin; fieldMeta?: FieldMetaMap; undoable?: boolean } = {}) {
  return commit('lead.update', (tx) => {
    const lead = must(tx.db.leads, id, 'lead')
    assertActorCan(tx.actor, 'lead.edit', lead, tx.db)
    const merged = { ...current(lead), ...patch, requirement: { ...current(lead).requirement, ...patch.requirement } } as Partial<LeadInput>
    assertValid(validateLead(merged))
    const fields = mergePatch(lead, patch, opts.fieldMeta)
    if (!fields.length) return []
    lead.updatedAt = tx.now
    tx.emit({ type: 'lead.updated', leadId: id, fields })
    return fields
  }, { via: opts.via, undoable: opts.undoable })
}

export type StageExtra = { lost?: { reason: LostReason; note?: string }; deal?: Partial<Deal> }

/** Moves a lead to a stage. Lost needs a reason; Booked needs the property and booking amount (E5 does the rest). */
export function changeStage(id: ID, to: PipelineStageKey, extra: StageExtra = {}, opts: { via?: Origin } = {}) {
  return commit('lead.stage', (tx) => stageOnDraft(tx, id, to, extra), { via: opts.via, undoable: true })
}

function stageOnDraft(tx: Tx, id: ID, to: PipelineStageKey, extra: StageExtra) {
  const lead = must(tx.db.leads, id, 'lead')
  assertActorCan(tx.actor, to === 'booked' || to === 'converted' ? 'lead.markBooked' : 'lead.moveStage', lead, tx.db)
  const deal = { ...lead.deal, ...extra.deal }
  assertValid(validateStageMove(to, { lostReason: extra.lost?.reason, propertyId: deal.propertyId, bookingAmount: deal.bookingAmount }))
  if (extra.deal) lead.deal = deal
  if (to === 'lost' && extra.lost) lead.lost = { ...extra.lost, at: tx.now, by: tx.actor.id }
  if (to !== 'lost' && lead.stage === 'lost') lead.lost = undefined
  moveStage(tx, lead, to)
}

/** The same move for many leads at once (one undo). Leads already at or past the stage are skipped when `forwardOnly`. */
export function bulkChangeStage(ids: ID[], to: PipelineStageKey, extra: StageExtra = {}, opts: { forwardOnly?: boolean } = {}) {
  return commit('lead.stage.bulk', (tx) => {
    let moved = 0
    for (const id of ids) {
      const lead = must(tx.db.leads, id, 'lead')
      if (lead.stage === to || (opts.forwardOnly && STAGE_RANK[lead.stage] >= STAGE_RANK[to])) continue
      stageOnDraft(tx, id, to, extra)
      moved++
    }
    return moved
  }, { undoable: true })
}

/** Deletes leads (managers and admins). Their open tasks and future appointments are cancelled. Undoable for 10 s. */
export function deleteLeads(ids: ID[]) {
  return commit('lead.delete', (tx) => {
    for (const id of ids) {
      const lead = must(tx.db.leads, id, 'lead')
      assertActorCan(tx.actor, 'lead.delete', lead, tx.db)
      const snapshot = current(lead)
      tx.db.leads = tx.db.leads.filter((l) => l.id !== id)
      tx.emit({ type: 'lead.deleted', lead: snapshot })
    }
    return ids.length
  }, { undoable: true })
}

export const deleteLead = (id: ID) => deleteLeads([id])

/** An executive asks the manager to move a lead to someone else. */
export function requestReassign(leadId: ID, note?: string) {
  return commit('lead.requestReassign', (tx) => {
    const lead = must(tx.db.leads, leadId, 'lead')
    assertActorCan(tx.actor, 'lead.requestReassign', lead, tx.db)
    for (const m of managersFor(tx, lead.ownerId)) {
      notify(tx, m, 'system', { variant: 'reassignRequest', name: lead.name, owner: tx.actor.name, note: note ?? '' }, { ref: { kind: 'lead', id: lead.id }, priority: 'high' })
    }
    tx.emit({ type: 'lead.noted', leadId, text: note ?? '' })
  })
}

/** Records the HNI status (managers and admins only). */
export function setHniStatus(leadId: ID, status: NonNullable<Lead['hni']>['status'], signals?: Record<string, string>) {
  return commit('lead.hni', (tx) => {
    const lead = must(tx.db.leads, leadId, 'lead')
    assertActorCan(tx.actor, 'lead.viewHni')
    assertActorCan(tx.actor, 'lead.edit', lead, tx.db)
    lead.hni = { status, signals: signals ?? lead.hni?.signals }
    lead.updatedAt = tx.now
    tx.emit({ type: 'lead.updated', leadId, fields: ['hni'] })
  })
}

/** Admins are told about a duplicate the user chose to keep ("Save anyway"). */
export function flagDuplicate(leadId: ID, otherId: ID) {
  return commit('lead.duplicate', (tx) => {
    const lead = must(tx.db.leads, leadId, 'lead')
    const other = must(tx.db.leads, otherId, 'lead')
    for (const a of adminIds(tx)) notify(tx, a, 'duplicateFound', { name: lead.name, other: other.name }, { ref: { kind: 'lead', id: lead.id }, dedupeKey: `duplicate:${lead.id}` })
  })
}

/**
 * A patch whose requirement / qualification hold only the keys that change; they are merged into the lead's
 * (mergePatch assigns key by key). Used by inline edits, qualification chips and the Lead Editing Assistant.
 */
export type LeadFieldPatch = Omit<LeadPatch, 'requirement' | 'qualification'> & {
  requirement?: Partial<Requirement>
  qualification?: Partial<Qualification>
}

export function updateLeadFields(id: ID, patch: LeadFieldPatch, opts: { via?: Origin; fieldMeta?: FieldMetaMap; undoable?: boolean } = {}) {
  // updateLead validates against the merged requirement and mergePatch merges these keys into the stored ones
  return updateLead(id, patch as LeadPatch, opts)
}
