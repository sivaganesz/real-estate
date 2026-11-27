/**
 * Lead pills (DESIGN_SYSTEM §3.1, §11.3): temperature (dot + icon + word, never colour alone), stage (soft wash +
 * stage dot + foreground label), source, and the last-contact badge (muted < 3 days, warning 3–6, danger ≥ 7 or SLA).
 */
import { AlarmClock, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { LeadSource, PipelineStageKey, Priority, Temperature } from '@/domain/types'
import { DotBadge, ToneBadge } from '@/components/shared/badges'
import { priorityTone, stageTone, temperatureTone } from '@/lib/tones'
import { cn } from '@/lib/utils'

export function TemperaturePill({ value, className }: { value: Temperature; className?: string }) {
  const { t } = useTranslation('catalogue')
  const c = temperatureTone[value]
  return <ToneBadge classes={c} icon={c.icon} className={className}>{t(`temperature.${value}`)}</ToneBadge>
}

export function StagePill({ stage, short, className }: { stage: PipelineStageKey; short?: boolean; className?: string }) {
  const { t } = useTranslation('catalogue')
  return <DotBadge classes={stageTone[stage]} className={className}>{t(short ? `stageShort.${stage}` : `stage.${stage}`)}</DotBadge>
}

export function SourcePill({ source, className }: { source: LeadSource; className?: string }) {
  const { t } = useTranslation('catalogue')
  return <ToneBadge tone="neutral" className={className}>{t(`source.${source}`)}</ToneBadge>
}

export function LastContactBadge({ days, breached, className }: { days: number | null; breached?: boolean; className?: string }) {
  const { t } = useTranslation('domain')
  const tone = breached || (days ?? 0) >= 7 ? 'text-danger' : (days ?? 0) >= 3 ? 'text-warning' : 'text-muted-foreground'
  return (
    <span className={cn('inline-flex items-center gap-1 text-meta tabular-nums', tone, className)} title={t('lead.lastContactTitle')}>
      <Clock className="size-3.5" aria-hidden="true" />
      {days === null ? t('lead.neverContacted') : days === 0 ? t('lead.contactedToday') : t('lead.daysAgo', { count: days })}
    </span>
  )
}

/** Lead aging (master prompt §8): "SLA breached" in danger, else days since contact (never contacted ages from creation). */
export function AgingBadge({ aging, className }: { aging: { days: number | null; breached: boolean; tone: 'muted' | 'warning' | 'danger' }; className?: string }) {
  const { t } = useTranslation('leads')
  if (aging.breached) {
    return (
      <span className={cn('inline-flex h-5 items-center gap-1 rounded-full bg-danger-soft px-2 text-meta font-medium text-danger', className)} title={t('aging.slaTitle')}>
        <AlarmClock className="size-3" aria-hidden="true" />
        {t('aging.sla')}
      </span>
    )
  }
  const tone = aging.tone === 'danger' ? 'text-danger' : aging.tone === 'warning' ? 'text-warning' : 'text-muted-foreground'
  return (
    <span className={cn('inline-flex items-center gap-1 text-meta whitespace-nowrap tabular-nums', tone, className)} title={t('aging.title')}>
      <Clock className="size-3.5" aria-hidden="true" />
      {aging.days === null ? t('aging.never') : aging.days === 0 ? t('aging.today') : t('aging.days', { count: aging.days })}
    </span>
  )
}

/** Priority as a small dot + word (high in danger, medium warning, low muted). */
export function PriorityPill({ value, className }: { value: Priority; className?: string }) {
  const { t } = useTranslation('catalogue')
  return <DotBadge classes={priorityTone[value]} className={className}>{t(`priority.${value}`)}</DotBadge>
}
