/**
 * Keeps the demo fresh (foundation-plan §6.3). When the persisted `meta.anchorDate` is not today, every date field in
 * every collection moves forward (or back) by the whole-day difference, so "today", "overdue" and "upcoming" stay true
 * on any later day, including the user's own edits. Pure: returns a new DB.
 *
 * The registry lists every date path per collection. `[]` walks an array; 'day' = ISODate, 'time' = ISODateTime.
 * A new date field in domain/types.ts must be added here (the rebase test checks the seed's dates move).
 */
import { produce } from 'immer'
import type { DB, ISODate } from '@/domain/types'
import { addDaysToDay, dayDiff, shiftDateTime } from '@/lib/dates'

type Kind = 'day' | 'time'
type PathSpec = [path: string, kind: Kind]
type Collection = Exclude<keyof DB, 'meta' | 'settings'>

export const DATE_PATHS: Record<Collection, PathSpec[]> = {
  users: [['leaveUntil', 'day'], ['joinedAt', 'day'], ['deactivatedAt', 'time']],
  leads: [
    ['createdAt', 'time'], ['updatedAt', 'time'], ['stageSince', 'time'], ['stageHistory[].at', 'time'],
    ['firstContactAt', 'time'], ['lastContactAt', 'time'], ['shortlist[].at', 'time'], ['deal.bookedAt', 'time'],
    ['lost.at', 'time'], ['consent.at', 'time'], ['consent.withdrawnAt', 'time'], ['requirement.possessionBy', 'day'],
  ],
  clients: [['bookedAt', 'time'], ['createdAt', 'time'], ['updatedAt', 'time']],
  properties: [['possession.date', 'day'], ['heldUntil', 'time'], ['createdAt', 'time'], ['updatedAt', 'time'], ['listedAt', 'time']],
  appointments: [
    ['start', 'time'], ['rescheduledFrom', 'time'], ['createdAt', 'time'], ['updatedAt', 'time'],
    ['outcome.at', 'time'], ['outcome.nextFollowUpAt', 'time'],
  ],
  tasks: [['dueAt', 'time'], ['completedAt', 'time'], ['createdAt', 'time']],
  activities: [['at', 'time']],
  notifications: [['at', 'time'], ['readAt', 'time']],
  assignments: [['at', 'time']],
  importJobs: [['createdAt', 'time'], ['finishedAt', 'time']],
  drafts: [['createdAt', 'time'], ['updatedAt', 'time']],
  savedViews: [],
}
const SETTINGS_PATHS: PathSpec[] = [['mappingProfiles[].createdAt', 'time']]

type Bag = Record<string, unknown>

function shiftAt(node: unknown, segments: string[], kind: Kind, days: number): void {
  if (node == null || typeof node !== 'object') return
  const [head, ...rest] = segments
  const isArray = head.endsWith('[]')
  const key = isArray ? head.slice(0, -2) : head
  const bag = node as Bag
  const value = bag[key]
  if (value == null) return
  if (isArray) {
    if (!Array.isArray(value)) return
    if (rest.length === 0) return
    for (const item of value) shiftAt(item, rest, kind, days)
    return
  }
  if (rest.length > 0) {
    shiftAt(value, rest, kind, days)
    return
  }
  if (typeof value !== 'string') return
  bag[key] = kind === 'day' ? addDaysToDay(value, days) : shiftDateTime(value, days)
}

/** Moves every date by `days` whole local days. */
export function shiftDb(db: DB, days: number): DB {
  if (days === 0) return db
  return produce(db, (draft) => {
    for (const [collection, specs] of Object.entries(DATE_PATHS) as [Collection, PathSpec[]][]) {
      for (const record of draft[collection] as unknown[]) {
        for (const [path, kind] of specs) shiftAt(record, path.split('.'), kind, days)
      }
    }
    for (const [path, kind] of SETTINGS_PATHS) shiftAt(draft.settings, path.split('.'), kind, days)
    draft.meta.anchorDate = addDaysToDay(draft.meta.anchorDate, days)
  })
}

/** Rebases a persisted DB so that its anchor day becomes `today`. */
export function rebaseDates(db: DB, today: ISODate): DB {
  const days = dayDiff(db.meta.anchorDate, today)
  if (days === 0) return db
  const shifted = shiftDb(db, days)
  return shifted.meta.anchorDate === today ? shifted : produce(shifted, (d) => { d.meta.anchorDate = today })
}
