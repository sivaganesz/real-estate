/**
 * Lead card (DESIGN_SYSTEM §11.3): a 3 px top edge in the temperature colour; avatar, name, locality · configuration
 * and a score ring; temperature, stage and budget chips; the reason line (✦ Iris for AI-derived next actions); and a
 * footer with the last-contact badge, the owner avatar and Call / WhatsApp / More (hover-revealed on desktop, always
 * on touch). `compact` is the single 56 px row used on Today.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { paths } from '@/app/paths'
import { AISuggestionChip } from '@/components/ai/ai-suggestion-chip'
import { ScoreRing } from '@/components/shared/progress-ring'
import { UserAvatar } from '@/components/shared/user-avatar'
import type { Lead } from '@/domain/types'
import { configLabel } from '@/lib/matching'
import { inrRange } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ContactActions } from './contact-actions'
import { LastContactBadge, StagePill, TemperaturePill } from './lead-pills'
import { useLeadFacts } from './use-lead-facts'

const EDGE = { hot: 'before:bg-hot', warm: 'before:bg-warm', cold: 'before:bg-cold' } as const

export function LeadCard({ lead, compact, reason, more, onOpen, className }: {
  lead: Lead
  compact?: boolean
  /** Overrides the derived reason line (e.g. "Visit at 11:00 today"). */
  reason?: ReactNode
  /** A "More" menu button (owner decides actions). */
  more?: ReactNode
  /** Open in a drawer instead of navigating. */
  onOpen?: () => void
  className?: string
}) {
  const { t } = useTranslation(['domain', 'leads'])
  const f = useLeadFacts(lead)
  const r = lead.requirement
  const place = r.localities[0] ?? r.cities[0]
  const config = r.configurations.map(configLabel).join(' / ')
  const meta = [place, config].filter(Boolean).join(' · ')
  const budget = r.budgetMax || r.budgetMin ? inrRange(r.budgetMin, r.budgetMax, { upTo: t('domain:lead.upTo'), from: t('domain:lead.from') }) : null
  const reasonNode = reason ?? (f.next ? <AISuggestionChip>{t(`leads:next.${f.next.key}`, f.next.params ?? {})}</AISuggestionChip> : null)
  const name = onOpen ? (
    <button type="button" onClick={onOpen} className="truncate text-left font-semibold hover:underline focus-visible:underline focus-visible:outline-none after:absolute after:inset-0">{lead.name}</button>
  ) : (
    <Link to={paths.lead(lead.id)} className="truncate font-semibold hover:underline focus-visible:underline focus-visible:outline-none after:absolute after:inset-0">{lead.name}</Link>
  )

  if (compact) {
    return (
      <article data-testid="lead-card" className={cn('group relative flex h-14 items-center gap-3 rounded-lg border bg-card pr-2 pl-4 shadow-card transition-shadow duration-(--dur-fast) hover:shadow-md before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:rounded-l-lg', EDGE[f.temperature], className)}>
        <UserAvatar name={lead.name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm">{name}<TemperaturePill value={f.temperature} className="max-sm:hidden" /></p>
          <p className="truncate text-meta text-muted-foreground">{meta || t('domain:lead.noRequirement')}</p>
        </div>
        <ScoreRing score={f.score.score} size={32} label={t('domain:lead.score')} />
        <div className="relative z-[1] opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100 pointer-coarse:opacity-100">
          <ContactActions lead={lead} />
        </div>
      </article>
    )
  }

  return (
    <article
      data-testid="lead-card"
      className={cn(
        'group relative flex flex-col gap-3 overflow-hidden rounded-lg border bg-card p-4 shadow-card transition-[transform,box-shadow] duration-(--dur-fast) hover:-translate-y-0.5 hover:shadow-md',
        'before:absolute before:inset-x-0 before:top-0 before:h-[3px]', EDGE[f.temperature], className,
      )}
    >
      <div className="flex items-start gap-3">
        <UserAvatar name={lead.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="flex text-base">{name}</h3>
          <p className="truncate text-meta text-muted-foreground">{meta || t('domain:lead.noRequirement')}</p>
        </div>
        <ScoreRing score={f.score.score} label={t('domain:lead.score')} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <TemperaturePill value={f.temperature} />
        <StagePill stage={lead.stage} />
        {budget && <span className="inline-flex h-5 items-center rounded-full bg-muted px-2 text-meta font-medium tabular-nums">{budget}</span>}
        {lead.isNri && <span className="inline-flex h-5 items-center rounded-full bg-info-soft px-2 text-meta font-medium text-info">{t('domain:lead.nri')}</span>}
      </div>
      {reasonNode && <div className="relative z-[1] min-w-0">{reasonNode}</div>}
      <footer className="flex items-center gap-2 border-t pt-3">
        <LastContactBadge days={f.lastContactDays} breached={f.breached} />
        <span className="flex-1" />
        {f.owner ? <span title={f.owner.name}><UserAvatar name={f.owner.name} size="xs" /></span> : <span className="text-meta text-warning">{t('domain:lead.unassigned')}</span>}
        <div className="relative z-[1] flex items-center opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100 pointer-coarse:opacity-100">
          <ContactActions lead={lead} />
          {more}
        </div>
      </footer>
    </article>
  )
}
