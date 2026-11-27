/**
 * Finishing an import (the wizard keeps a job in progress in page state; only finished jobs are stored).
 * One commit creates the leads (each runs E2: auto-assignment), properties, updates and drafts, stores the job and
 * emits import.completed (E16: importer and admins notified; assignment notices batched per assignee).
 */
import type { Draft, ID, ImportJob, Lead, MappingProfile, PropertyInput } from '@/domain/types'
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

// ── M5 Import & Extraction (additive) ──────────────────────────────────────────────────────────────────────────────

/** An imported lead plus the note made from its remarks and the sheet's unmapped columns. */
export type ImportLead = NewLead & { note?: string }
/** "Update existing" on a duplicate lead: only the values the sheet has; the requirement is merged, never emptied. */
export type ImportLeadUpdate = {
  id: ID
  patch: { email?: string; altPhone?: string; sourceDetail?: string; preferredLanguage?: string; requirement?: Partial<Lead['requirement']>; qualification?: Partial<Lead['qualification']> }
  note?: string
}
export type RunImportPayload = Omit<ImportPayload, 'leads'> & { leads?: ImportLead[]; leadUpdates?: ImportLeadUpdate[] }

/**
 * Finishes an import in one undoable commit, like completeImport, and also: keeps each lead's note on its timeline
 * (lead.noted), and updates existing leads chosen as "update existing" (lead.edit is checked per lead).
 * Created records carry `importJobId`; the job lists them; E16 notifies the importer and admins; E2 assigns each lead.
 */
export function runImport(p: RunImportPayload): { jobId: ID; undoToken?: string } {
  const { result: jobId, undoToken } = commit('import.run', (tx) => {
    const action = p.kind === 'leads' ? 'import.leads' : p.kind === 'document' ? 'import.document' : 'import.properties'
    assertActorCan(tx.actor, action)
    const createdIds: ID[] = []
    for (const { note, ...l } of p.leads ?? []) {
      const id = insertLead(tx, l, 'import')
      createdIds.push(id)
      if (note?.trim()) tx.emit({ type: 'lead.noted', leadId: id, text: note.trim() })
    }
    for (const prop of p.properties ?? []) createdIds.push(insertProperty(tx, prop))
    for (const u of p.leadUpdates ?? []) {
      const lead = must(tx.db.leads, u.id, 'lead')
      assertActorCan(tx.actor, 'lead.edit', lead, tx.db)
      const { requirement, qualification, ...rest } = u.patch
      Object.assign(lead, rest)
      if (requirement) Object.assign(lead.requirement, requirement)
      if (qualification) Object.assign(lead.qualification, qualification)
      lead.updatedAt = tx.now
      tx.emit({ type: 'lead.updated', leadId: u.id, fields: Object.keys(u.patch) })
      if (u.note?.trim()) tx.emit({ type: 'lead.noted', leadId: u.id, text: u.note.trim() })
    }
    for (const u of p.propertyUpdates ?? []) {
      const existing = must(tx.db.properties, u.id, 'property')
      Object.assign(existing, u.patch)
      existing.updatedAt = tx.now
      tx.emit({ type: 'property.updated', id: u.id, fields: Object.keys(u.patch) })
    }
    const id = tx.id('IMP')
    const draftIds: ID[] = []
    for (const d of p.drafts ?? []) {
      const did = tx.id('DRF')
      tx.db.drafts.push({ ...d, id: did, createdBy: tx.actor.id, createdAt: tx.now, updatedAt: tx.now, status: 'open', importJobId: id })
      draftIds.push(did)
    }
    const updated = (p.leadUpdates?.length ?? 0) + (p.propertyUpdates?.length ?? 0)
    const counts: ImportJob['counts'] = {
      total: p.counts.total, imported: p.counts.imported ?? createdIds.length, updated: p.counts.updated ?? updated,
      skipped: p.counts.skipped ?? 0, duplicates: p.counts.duplicates ?? 0, errors: p.counts.errors ?? (p.errorRows?.length ?? 0), drafts: p.counts.drafts ?? draftIds.length,
    }
    tx.db.importJobs.push({
      id, kind: p.kind, fileName: p.fileName, fileType: p.fileType, template: p.template, createdBy: tx.actor.id, createdAt: tx.now, finishedAt: tx.now,
      status: counts.errors || counts.skipped ? (counts.imported || counts.updated || counts.drafts ? 'partial' : 'failed') : 'completed',
      mapping: p.mapping, mappingProfileId: p.mappingProfileId, counts, createdIds, draftIds, errorRows: p.errorRows ?? [],
    })
    for (const l of tx.db.leads) if (createdIds.includes(l.id)) l.importJobId = id
    for (const pr of tx.db.properties) if (createdIds.includes(pr.id)) pr.importJobId = id
    tx.emit({ type: 'import.completed', jobId: id })
    return id
  }, { via: 'import', undoable: true })
  return { jobId, undoToken }
}

/** Saves a column mapping for reuse (same sender, same layout). Same name and kind → replaced. */
export function saveMappingProfile(input: Pick<MappingProfile, 'name' | 'kind' | 'columns'>): { id: ID } {
  const { result: id } = commit('import.mapping.save', (tx) => {
    assertActorCan(tx.actor, input.kind === 'leads' ? 'import.leads' : 'import.properties')
    const name = input.name.trim()
    const list = tx.db.settings.mappingProfiles
    const existing = list.find((m) => m.kind === input.kind && m.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      existing.columns = input.columns
      return existing.id
    }
    const id = `MAP-${list.length + 1}-${Date.parse(tx.now).toString(36)}`
    list.push({ id, name, kind: input.kind, columns: input.columns, createdBy: tx.actor.id, createdAt: tx.now })
    return id
  })
  return { id }
}

export function deleteMappingProfile(id: ID) {
  return commit('import.mapping.delete', (tx) => {
    const m = must(tx.db.settings.mappingProfiles, id, 'mappingProfile')
    assertActorCan(tx.actor, m.kind === 'leads' ? 'import.leads' : 'import.properties')
    tx.db.settings.mappingProfiles = tx.db.settings.mappingProfiles.filter((x) => x.id !== id)
  }, { undoable: true })
}

/** Removes a job from the history (the records it created stay). Undoable for 10 s. */
export function removeImportJob(id: ID) {
  return commit('import.remove', (tx) => {
    const job = must(tx.db.importJobs, id, 'importJob')
    assertActorCan(tx.actor, job.kind === 'leads' ? 'import.leads' : job.kind === 'document' ? 'import.document' : 'import.properties')
    tx.db.importJobs = tx.db.importJobs.filter((j) => j.id !== id)
  }, { undoable: true })
}
