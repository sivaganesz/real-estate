/**
 * Finishing an import (the wizard keeps a job in progress in page state; only finished jobs are stored).
 * One commit creates the leads (each runs E2: auto-assignment), properties, updates and drafts, stores the job and
 * emits import.completed (E16: importer and admins notified; assignment notices batched per assignee).
 */
import type { Draft, ID, ImportJob, PropertyInput } from '@/domain/types'
import { assertActorCan } from './core/actor'
import { commit, must } from './core/commit'
import { insertLead, type NewLead } from './leads'
import { insertProperty } from './properties'

/** A draft to keep from an import (a low-confidence row or document). */
export type DraftInputLike = Pick<Draft, 'kind' | 'title' | 'payload' | 'fieldMeta' | 'source'>

export type ImportPayload = {
  kind: ImportJob['kind']
  fileName: string
  fileType: ImportJob['fileType']
  template: ImportJob['template']
  mapping?: ImportJob['mapping']
  mappingProfileId?: ID
  leads?: NewLead[]
  properties?: PropertyInput[]
  /** Existing records to update ("update existing" on duplicates). */
  propertyUpdates?: { id: ID; patch: Partial<PropertyInput> }[]
  drafts?: DraftInputLike[]
  counts: Partial<ImportJob['counts']> & { total: number }
  errorRows?: ImportJob['errorRows']
}

export function completeImport(p: ImportPayload): { jobId: ID } {
  const { result: jobId } = commit('import.complete', (tx) => {
    const action = p.kind === 'leads' ? 'import.leads' : p.kind === 'document' ? 'import.document' : 'import.properties'
    assertActorCan(tx.actor, action)
    const createdIds: ID[] = []
    for (const l of p.leads ?? []) createdIds.push(insertLead(tx, l, 'import'))
    for (const prop of p.properties ?? []) createdIds.push(insertProperty(tx, prop))
    for (const u of p.propertyUpdates ?? []) {
      const existing = must(tx.db.properties, u.id, 'property')
      Object.assign(existing, u.patch)
      existing.updatedAt = tx.now
      tx.emit({ type: 'property.updated', id: u.id, fields: Object.keys(u.patch) })
    }
    const jobId = tx.id('IMP')
    const draftIds: ID[] = []
    for (const d of p.drafts ?? []) {
      const id = tx.id('DRF')
      tx.db.drafts.push({ ...d, id, createdBy: tx.actor.id, createdAt: tx.now, updatedAt: tx.now, status: 'open', importJobId: jobId })
      draftIds.push(id)
    }
    const counts: ImportJob['counts'] = {
      total: p.counts.total, imported: p.counts.imported ?? createdIds.length, updated: p.counts.updated ?? (p.propertyUpdates?.length ?? 0),
      skipped: p.counts.skipped ?? 0, duplicates: p.counts.duplicates ?? 0, errors: p.counts.errors ?? (p.errorRows?.length ?? 0), drafts: p.counts.drafts ?? draftIds.length,
    }
    tx.db.importJobs.push({
      id: jobId, kind: p.kind, fileName: p.fileName, fileType: p.fileType, template: p.template, createdBy: tx.actor.id, createdAt: tx.now, finishedAt: tx.now,
      status: counts.errors || counts.skipped ? (counts.imported || counts.updated ? 'partial' : 'failed') : 'completed',
      mapping: p.mapping, mappingProfileId: p.mappingProfileId, counts, createdIds, draftIds, errorRows: p.errorRows ?? [],
    })
    for (const l of tx.db.leads) if (createdIds.includes(l.id)) l.importJobId = jobId
    for (const pr of tx.db.properties) if (createdIds.includes(pr.id)) pr.importJobId = jobId
    tx.emit({ type: 'import.completed', jobId })
    return jobId
  }, { via: 'import', undoable: true })
  return { jobId }
}

export function deleteImportJob(id: ID) {
  return commit('import.delete', (tx) => {
    must(tx.db.importJobs, id, 'importJob')
    assertActorCan(tx.actor, 'import.properties')
    tx.db.importJobs = tx.db.importJobs.filter((j) => j.id !== id)
  })
}
