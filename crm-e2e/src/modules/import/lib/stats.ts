/**
 * Read-side helpers for the import pages: who sees which jobs and drafts, the hub KPIs, and how sure a draft is.
 * Pure (takes `now`); unit-tested.
 */
import type { Draft, FieldMetaMap, ID, ImportJob } from '@/domain/types'
import { localDay } from '@/lib/dates'

/** Below this a field is highlighted "please check" (same threshold as the AI field marker). */
export const LOW_CONFIDENCE = 0.75

/** Always a new array (callers sort it; store arrays are frozen). Admins see every job; managers see their own and every leads import (they own lead imports for the team). */
export const visibleJobs = (jobs: ImportJob[], userId: ID, seeAll: boolean) =>
  jobs.filter((j) => seeAll || j.createdBy === userId || j.kind === 'leads')

/** Drafts: your own; managers and admins (who can bulk import) see everyone's. */
export const visibleDrafts = (drafts: Draft[], userId: ID, seeAll: boolean) =>
  drafts.filter((d) => seeAll || d.createdBy === userId)

export function lowFields(meta: FieldMetaMap): string[] {
  return Object.entries(meta).filter(([, m]) => (m.confidence ?? 1) < LOW_CONFIDENCE).map(([k]) => k)
}
/** Mean confidence of the fields the AI or the import filled (1 when nothing was filled automatically). */
export function draftConfidence(meta: FieldMetaMap): number {
  const vals = Object.values(meta).filter((m) => m.origin !== 'manual').map((m) => m.confidence ?? 1)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 1
}

const DAY = 86_400_000

export function importStats(jobs: ImportJob[], drafts: Draft[], now: Date) {
  const since = now.getTime() - 30 * DAY
  const recent = jobs.filter((j) => Date.parse(j.createdAt) >= since)
  const days = Array.from({ length: 14 }, (_, i) => localDay(new Date(now.getTime() - (13 - i) * DAY)))
  const spark = days.map((d) => jobs.filter((j) => localDay(j.createdAt) === d).reduce((n, j) => n + j.counts.imported + j.counts.updated, 0))
  const open = drafts.filter((d) => d.status === 'open')
  const low = open.filter((d) => lowFields(d.fieldMeta).length > 0)
  return {
    jobs30: recent.length,
    rows30: recent.reduce((n, j) => n + j.counts.total, 0),
    created30: recent.reduce((n, j) => n + j.counts.imported + j.counts.updated, 0),
    duplicates30: recent.reduce((n, j) => n + j.counts.duplicates, 0),
    openDrafts: open.length,
    lowDrafts: low.length,
    draftsLowShare: open.length ? Math.round((low.length / open.length) * 100) : 0,
    spark,
  }
}
