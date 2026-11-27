/**
 * Drafts: unfinished or low-confidence AI / import extractions, kept until someone finishes and saves them.
 */
import type { Draft, EntityRef, ID } from '@/domain/types'
import { assertActorCan } from './core/actor'
import { commit, must } from './core/commit'

export type NewDraft = Pick<Draft, 'kind' | 'title' | 'payload' | 'fieldMeta' | 'source'> & Partial<Pick<Draft, 'importJobId'>>

export function createDraft(input: NewDraft): { id: ID } {
  const { result: id } = commit('draft.create', (tx) => {
    assertActorCan(tx.actor, 'import.document')
    const id = tx.id('DRF')
    tx.db.drafts.push({ ...input, id, createdBy: tx.actor.id, createdAt: tx.now, updatedAt: tx.now, status: 'open' })
    return id
  })
  return { id }
}

const ownDraft = (d: Draft, actorId: ID, role: string) => d.createdBy === actorId || role === 'admin' || role === 'system'

export function updateDraft(id: ID, patch: Partial<Pick<Draft, 'title' | 'payload' | 'fieldMeta'>>) {
  return commit('draft.update', (tx) => {
    const d = must(tx.db.drafts, id, 'draft')
    if (!ownDraft(d, tx.actor.id, tx.actor.role)) assertActorCan(tx.actor, 'import.leads')
    Object.assign(d, patch)
    d.updatedAt = tx.now
  })
}

/** The draft became a record (call after the lead / property / appointment service created it). */
export function markDraftSaved(id: ID, savedAs: EntityRef) {
  return commit('draft.saved', (tx) => {
    const d = must(tx.db.drafts, id, 'draft')
    d.status = 'saved'
    d.savedAs = savedAs
    d.updatedAt = tx.now
    tx.emit({ type: 'draft.saved', id })
  })
}

export function discardDraft(id: ID) {
  return commit('draft.discard', (tx) => {
    const d = must(tx.db.drafts, id, 'draft')
    if (!ownDraft(d, tx.actor.id, tx.actor.role)) assertActorCan(tx.actor, 'import.leads')
    d.status = 'discarded'
    d.updatedAt = tx.now
  }, { undoable: true })
}

export function deleteDraft(id: ID) {
  return commit('draft.delete', (tx) => {
    const d = must(tx.db.drafts, id, 'draft')
    if (!ownDraft(d, tx.actor.id, tx.actor.role)) assertActorCan(tx.actor, 'import.leads')
    tx.db.drafts = tx.db.drafts.filter((x) => x.id !== id)
  }, { undoable: true })
}
