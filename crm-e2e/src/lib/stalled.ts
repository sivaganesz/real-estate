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
