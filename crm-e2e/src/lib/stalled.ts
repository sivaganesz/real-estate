/**
 * Days in stage and the aging tone (foundation-plan §5.5): muted below 1× the stage's target days,
 * warning from 1× to 2×, danger (stalled) above 2×. Closed stages never age.
 */
import type { Lead, PipelineStageDef, PipelineStageKey, Settings } from '@/domain/types'
import { CLOSED_STAGES } from '@/domain/catalogue'

export type AgingTone = 'muted' | 'warning' | 'danger'
const DAY = 86_400_000

/** Whole days since the lead entered its current stage. */
export const daysInStage = (lead: Pick<Lead, 'stageSince'>, now: Date) =>
  Math.max(0, Math.floor((now.getTime() - new Date(lead.stageSince).getTime()) / DAY))

export function agingTone(days: number, targetDays: number): AgingTone {
  if (targetDays <= 0) return 'muted'
  if (days > 2 * targetDays) return 'danger'
  if (days >= targetDays) return 'warning'
  return 'muted'
}

export const stageDef = (stages: PipelineStageDef[], key: PipelineStageKey) => stages.find((s) => s.key === key)

export function agingOf(lead: Pick<Lead, 'stage' | 'stageSince'>, settings: Pick<Settings, 'pipeline'>, now: Date): { days: number; target: number; tone: AgingTone } {
  const days = daysInStage(lead, now)
  const target = stageDef(settings.pipeline.stages, lead.stage)?.targetDays ?? 0
  if (CLOSED_STAGES.includes(lead.stage)) return { days, target, tone: 'muted' }
  return { days, target, tone: agingTone(days, target) }
}

/** The stages where a stuck deal is worth a manager's attention (the stalledDeal timer). */
export const STALL_WATCH: PipelineStageKey[] = ['qualified', 'siteVisitDone', 'negotiation']

export const isStalled = (lead: Pick<Lead, 'stage' | 'stageSince'>, settings: Pick<Settings, 'pipeline'>, now: Date) =>
  agingOf(lead, settings, now).tone === 'danger'

/* ---------- stalled deals and the recommended next step (M6 Pipeline, master prompt §11 "AI: stalled deals") ---------- */

/** How far over its stage target a deal is: days / targetDays (0 when the stage has no target). */
export const stallRatio = (days: number, targetDays: number) => (targetDays > 0 ? days / targetDays : 0)

export type StallAdviceKey = 'firstCall' | 'qualify' | 'bookVisit' | 'confirmVisit' | 'postVisitCall' | 'closeGap' | 'collectDocs'
/** The recommended action for a deal stuck in a stage: an i18n key (`pipeline:advice.<key>`), the task it becomes, and when. */
export type StallAdvice = { key: StallAdviceKey; taskType: 'call' | 'whatsapp' | 'followUp' | 'meeting' | 'document'; dueInHours: number }

const ADVICE: Partial<Record<PipelineStageKey, StallAdvice>> = {
  new: { key: 'firstCall', taskType: 'call', dueInHours: 1 },
  contacted: { key: 'qualify', taskType: 'call', dueInHours: 4 },
  qualified: { key: 'bookVisit', taskType: 'call', dueInHours: 4 },
  siteVisitScheduled: { key: 'confirmVisit', taskType: 'whatsapp', dueInHours: 2 },
  siteVisitDone: { key: 'postVisitCall', taskType: 'call', dueInHours: 4 },
  negotiation: { key: 'closeGap', taskType: 'meeting', dueInHours: 24 },
  booked: { key: 'collectDocs', taskType: 'document', dueInHours: 24 },
}

/** The next step for a stuck deal, or undefined for closed stages. */
export const stallAdvice = (stage: PipelineStageKey): StallAdvice | undefined => ADVICE[stage]

export type StalledDeal = { lead: Lead; days: number; target: number; ratio: number; advice: StallAdvice }

/**
 * Open deals past 2× their stage target, worst first (the ratio, then value). The manager's "stalled deals" list and the
 * ✦ marker on pipeline cards both come from here, so they always agree.
 */
export function stalledDeals(leads: Lead[], settings: Pick<Settings, 'pipeline'>, now: Date, value: (l: Lead) => number = () => 0): StalledDeal[] {
  const out: StalledDeal[] = []
  for (const lead of leads) {
    const a = agingOf(lead, settings, now)
    const advice = stallAdvice(lead.stage)
    if (a.tone !== 'danger' || !advice) continue
    out.push({ lead, days: a.days, target: a.target, ratio: stallRatio(a.days, a.target), advice })
  }
  return out.sort((x, y) => y.ratio - x.ratio || value(y.lead) - value(x.lead))
}
