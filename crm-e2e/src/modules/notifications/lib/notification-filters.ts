/**
 * The notification centre's pure logic: kinds grouped into five categories, filters (read state, category,
 * priority, when), counts for the tabs, and day groups for the list.
 */
import type { Notification, NotificationKind } from '@/domain/types'

export const CATEGORIES = ['assignments', 'schedule', 'alerts', 'deals', 'system'] as const
export type Category = (typeof CATEGORIES)[number]

const CATEGORY: Record<NotificationKind, Category> = {
  assignment: 'assignments', reassignment: 'assignments', leaveReassign: 'assignments', deactivatedOwner: 'assignments', duplicateFound: 'assignments',
  appointmentCreated: 'schedule', appointmentReminder: 'schedule', taskOverdue: 'schedule',
  slaBreach: 'alerts', escalation: 'alerts', stalledDeal: 'alerts', propertyUnavailable: 'alerts',
  stageChanged: 'deals', booking: 'deals',
  importFinished: 'system', system: 'system',
}
export const categoryOf = (kind: NotificationKind): Category => CATEGORY[kind]

export type ReadFilter = 'all' | 'unread' | 'read'
export type WhenFilter = 'today' | '7d' | 'all'
export type NotificationFilters = { read: ReadFilter; categories: Category[]; highOnly: boolean; when: WhenFilter }
export const DEFAULT_NOTIFICATION_FILTERS: NotificationFilters = { read: 'all', categories: [], highOnly: false, when: 'all' }

export const activeNotificationFilters = (f: NotificationFilters) => f.categories.length + (f.highOnly ? 1 : 0) + (f.when !== 'all' ? 1 : 0)

/** The user's own notifications, newest first. */
export const notificationsFor = (all: Notification[], userId: string) => all.filter((n) => n.userId === userId).sort((a, b) => b.at.localeCompare(a.at))

export function filterNotifications(
  mine: Notification[], f: NotificationFilters, ctx: { today: string; dayOf: (iso: string) => string; addDays: (day: string, n: number) => string },
): Notification[] {
  const from = f.when === 'today' ? ctx.today : f.when === '7d' ? ctx.addDays(ctx.today, -6) : null
  return mine.filter((n) =>
    (f.read === 'all' || (f.read === 'unread' ? !n.readAt : !!n.readAt)) &&
    (!f.categories.length || f.categories.includes(categoryOf(n.kind))) &&
    (!f.highOnly || n.priority === 'high') &&
    (!from || ctx.dayOf(n.at) >= from))
}

/** Counts for tabs and filter options. */
export function notificationCounts(mine: Notification[]): { all: number; unread: number; high: number; byCategory: Record<Category, number> } {
  const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>
  let unread = 0, high = 0
  for (const n of mine) {
    byCategory[categoryOf(n.kind)]++
    if (!n.readAt) unread++
    if (n.priority === 'high' && !n.readAt) high++
  }
  return { all: mine.length, unread, high, byCategory }
}

/** Consecutive notifications on the same local day, in the order given. */
export function groupByDay<T extends { at: string }>(list: T[], dayOf: (iso: string) => string): { day: string; items: T[] }[] {
  const out: { day: string; items: T[] }[] = []
  for (const n of list) {
    const day = dayOf(n.at)
    const last = out.at(-1)
    if (last && last.day === day) last.items.push(n)
    else out.push({ day, items: [n] })
  }
  return out
}

/**
 * The simulated "catch me up" digest: unread items counted per kind (most urgent first), the single most urgent one
 * to open first, and whether anything is high priority. The page renders it as sentences with the Demo AI badge.
 */
export type Digest = { total: number; high: number; parts: { kind: NotificationKind; count: number }[]; first: Notification | null }

const URGENCY: NotificationKind[] = [
  'escalation', 'slaBreach', 'taskOverdue', 'appointmentReminder', 'leaveReassign', 'deactivatedOwner', 'stalledDeal', 'propertyUnavailable',
  'assignment', 'reassignment', 'booking', 'appointmentCreated', 'stageChanged', 'duplicateFound', 'importFinished', 'system',
]

export function digest(mine: Notification[]): Digest {
  const unread = mine.filter((n) => !n.readAt)
  const counts = new Map<NotificationKind, number>()
  for (const n of unread) counts.set(n.kind, (counts.get(n.kind) ?? 0) + 1)
  const parts = URGENCY.filter((k) => counts.has(k)).map((kind) => ({ kind, count: counts.get(kind) ?? 0 }))
  const rank = (n: Notification) => (n.priority === 'high' ? 0 : 1) * 100 + URGENCY.indexOf(n.kind)
  const first = [...unread].sort((a, b) => rank(a) - rank(b) || b.at.localeCompare(a.at))[0] ?? null
  return { total: unread.length, high: unread.filter((n) => n.priority === 'high').length, parts, first }
}
