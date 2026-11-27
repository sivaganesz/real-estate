/**
 * The Today greeting and the one-paragraph day brief (master prompt §6: "You have 3 site visits, 5 follow-ups and
 * 2 overdue tasks. Start with Priya Sharma – hot lead, visit at 11:00 AM."). Pure: it picks i18n keys and params from
 * the facts; the page translates them. It is the simulated AI's wording (rules over real data), so the UI always shows
 * the Demo AI badge next to it.
 */
import type { TodayItem } from '@/services/queries/today'

export type GreetingKey = 'morning' | 'afternoon' | 'evening'

export function greetingKey(now: Date): GreetingKey {
  const h = now.getHours()
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
}

export type Phrase = { key: string; params: Record<string, string | number> }

/** Executive brief: what the day holds, then where to start. */
export function executiveBrief(f: { visits: number; followUps: number; overdue: number; newLeads: number; first?: TodayItem; firstHot: boolean }): { summary: Phrase; start?: Phrase } {
  const empty = !f.visits && !f.followUps && !f.overdue && !f.newLeads
  const summary: Phrase = empty
    ? { key: 'brief.exec.clear', params: {} }
    : { key: f.overdue ? 'brief.exec.summaryOverdue' : 'brief.exec.summary', params: { visits: f.visits, followUps: f.followUps, overdue: f.overdue, newLeads: f.newLeads } }
  if (!f.first) return { summary }
  const name = String(f.first.params.name ?? '')
  return { summary, start: { key: f.firstHot ? 'brief.exec.startHot' : 'brief.exec.start', params: { name } } }
}

/** Manager brief: the queue, the team's overdue work and what needs a decision. */
export function managerBrief(f: { unassigned: number; overdue: number; visits: number; stalled: number; onLeave: number; escalations: number }): Phrase[] {
  const out: Phrase[] = [{ key: 'brief.manager.summary', params: { unassigned: f.unassigned, overdue: f.overdue, visits: f.visits } }]
  if (f.escalations) out.push({ key: 'brief.manager.escalations', params: { count: f.escalations } })
  if (f.onLeave) out.push({ key: 'brief.manager.onLeave', params: { count: f.onLeave } })
  if (f.stalled) out.push({ key: 'brief.manager.stalled', params: { count: f.stalled } })
  if (out.length === 1 && !f.unassigned && !f.overdue) out.push({ key: 'brief.manager.calm', params: {} })
  return out
}

/** Admin brief: today's business in one line, then the most urgent alert. */
export function adminBrief(f: { newLeads: number; visits: number; bookings: number; pipeline: string; alerts: number }): Phrase[] {
  const out: Phrase[] = [{ key: 'brief.admin.summary', params: { newLeads: f.newLeads, visits: f.visits, bookings: f.bookings, pipeline: f.pipeline } }]
  out.push(f.alerts ? { key: 'brief.admin.alerts', params: { count: f.alerts } } : { key: 'brief.admin.noAlerts', params: {} })
  return out
}

/** Days left in the month, today included (targets are monthly). */
export function daysLeftInMonth(now: Date): number {
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return last - now.getDate() + 1
}

/** How many a day it takes to meet a monthly target from here (0 when met or no target). */
export function perDayNeeded(done: number, target: number, now: Date): number {
  if (!target || done >= target) return 0
  return Math.ceil((target - done) / daysLeftInMonth(now))
}
