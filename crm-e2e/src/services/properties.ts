/**
 * Property writes. Status changes emit property.statusChanged (E12: owners of interested leads are told);
 * delete cascades over shortlists, deals and site visits (E13) and can be undone for 10 s.
 */
import { current } from 'immer'
import type { FieldMetaMap, ID, Origin, Property, PropertyInput, PropertyStatus } from '@/domain/types'
import { categoryOf } from '@/domain/catalogue'
import { toE164 } from '@/lib/phone'
import { assertValid, validateProperty } from '@/lib/validation'
import { assertActorCan } from './core/actor'
import { commit, must, type Tx } from './core/commit'
import { setPropertyStatus as setStatusOnDraft } from './core/effects'

/** Inserts a property on the draft and emits property.created. Shared with imports. */
export function insertProperty(tx: Tx, input: PropertyInput): ID {
  const id = tx.id('PRP')
  const p: Property = {
    ...input,
    id,
    category: categoryOf(input.type),
    owner: input.owner ? { ...input.owner, phone: toE164(input.owner.phone) || input.owner.phone } : undefined,
    createdBy: tx.actor.id,
    createdAt: tx.now,
    updatedAt: tx.now,
    listedAt: input.listedAt ?? (input.listing === 'live' ? tx.now : undefined),
  }
  tx.db.properties.push(p)
  tx.emit({ type: 'property.created', id })
  return id
}

export function createProperty(input: PropertyInput, opts: { via?: Origin } = {}): { id: ID } {
  assertValid(validateProperty(input))
  const { result: id } = commit('property.create', (tx) => {
    assertActorCan(tx.actor, 'property.create')
    return insertProperty(tx, input)
  }, opts)
  return { id }
}

export type PropertyPatch = Partial<PropertyInput>

export function updateProperty(id: ID, patch: PropertyPatch, opts: { via?: Origin; fieldMeta?: FieldMetaMap; undoable?: boolean } = {}) {
  return commit('property.update', (tx) => {
    const p = must(tx.db.properties, id, 'property')
    assertActorCan(tx.actor, 'property.edit', p, tx.db)
    const { status, ...rest } = patch
    assertValid(validateProperty({ ...current(p), ...rest }))
    const fields: string[] = []
    for (const [k, v] of Object.entries(rest)) {
      if (v === undefined) continue
      ;(p as Record<string, unknown>)[k] = v
      fields.push(k)
    }
    if (rest.type) p.category = categoryOf(rest.type)
    if (rest.listing === 'live' && !p.listedAt) p.listedAt = tx.now
    if (opts.fieldMeta) p.fieldMeta = { ...p.fieldMeta, ...opts.fieldMeta }
    if (fields.length) {
      p.updatedAt = tx.now
      tx.emit({ type: 'property.updated', id, fields })
    }
    if (status) setStatusOnDraft(tx, p, status)
    return fields
  }, { via: opts.via, undoable: opts.undoable })
}

/** Available / on hold (until a time, for a lead) / booked / sold. Booked and sold drop out of matching at once. */
export function changePropertyStatus(id: ID, status: PropertyStatus, hold: { heldUntil?: string; heldForLeadId?: ID } = {}) {
  return commit('property.status', (tx) => {
    const p = must(tx.db.properties, id, 'property')
    assertActorCan(tx.actor, 'property.edit', p, tx.db)
    setStatusOnDraft(tx, p, status)
    if (status === 'onHold') {
      p.heldUntil = hold.heldUntil
      p.heldForLeadId = hold.heldForLeadId
    }
  }, { undoable: true })
}

/** Admin only. Shortlists, deals and single-property site visits are cleaned up (E13). Undoable for 10 s. */
export function deleteProperties(ids: ID[]) {
  return commit('property.delete', (tx) => {
    for (const id of ids) {
      const p = must(tx.db.properties, id, 'property')
      assertActorCan(tx.actor, 'property.delete', p, tx.db)
      const snapshot = current(p)
      tx.db.properties = tx.db.properties.filter((x) => x.id !== id)
      tx.emit({ type: 'property.deleted', property: snapshot })
    }
    return ids.length
  }, { undoable: true })
}

export const deleteProperty = (id: ID) => deleteProperties([id])

/**
 * Bulk status change from the Properties list (M3): one undoable commit for every selected property. Each property
 * is permission-checked (an executive only changes what they created); E12 tells interested leads' owners.
 */
export function changePropertiesStatus(ids: ID[], status: PropertyStatus) {
  return commit('property.status.bulk', (tx) => {
    let changed = 0
    for (const id of ids) {
      const p = must(tx.db.properties, id, 'property')
      assertActorCan(tx.actor, 'property.edit', p, tx.db)
      if (p.status === status) continue
      setStatusOnDraft(tx, p, status)
      changed++
    }
    return changed
  }, { undoable: true })
}

const KEEP_ON_REPLACE = new Set(['id', 'createdBy', 'createdAt', 'updatedAt', 'category', 'listedAt', 'importJobId', 'fieldMeta', 'status'])

/**
 * Saves the full edit form (M3): every editable field is replaced, so a field the user cleared (RERA, owner, a spec)
 * is really removed — `updateProperty` only sets the keys it is given. Status changes still go through E12.
 */
export function replaceProperty(id: ID, input: PropertyInput, opts: { via?: Origin; fieldMeta?: FieldMetaMap } = {}) {
  assertValid(validateProperty(input))
  return commit('property.replace', (tx) => {
    const p = must(tx.db.properties, id, 'property')
    assertActorCan(tx.actor, 'property.edit', p, tx.db)
    const before = current(p) as unknown as Record<string, unknown>
    const { status, ...rest } = input
    const next: Record<string, unknown> = {
      ...rest,
      owner: rest.owner ? { ...rest.owner, phone: toE164(rest.owner.phone) || rest.owner.phone } : undefined,
    }
    const target = p as unknown as Record<string, unknown>
    const fields: string[] = []
    for (const k of new Set([...Object.keys(before), ...Object.keys(next)])) {
      if (KEEP_ON_REPLACE.has(k)) continue
      const v = next[k]
      if (JSON.stringify(before[k]) === JSON.stringify(v)) continue
      if (v === undefined) delete target[k]
      else target[k] = v
      fields.push(k)
    }
    p.category = categoryOf(p.type)
    if (p.listing === 'live' && !p.listedAt) p.listedAt = tx.now
    if (opts.fieldMeta && Object.keys(opts.fieldMeta).length) p.fieldMeta = { ...p.fieldMeta, ...opts.fieldMeta }
    if (fields.length) {
      p.updatedAt = tx.now
      tx.emit({ type: 'property.updated', id, fields })
    }
    if (status !== p.status) setStatusOnDraft(tx, p, status)
    return fields
  }, { via: opts.via })
}
