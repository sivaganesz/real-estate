/**
 * Property card (DESIGN_SYSTEM §11.4): a 4:3 image with a bottom scrim, the availability pill (top-left), the match ring
 * (top-right, in match context; hover/focus explains the score), the price badge (bottom-left); then locality · city,
 * the title, up to four spec chips (+N), price per sq ft and actions. No photo → a Peacock placeholder with the config.
 * Booked / sold cards render at 70% in match contexts.
 */
import type { ReactNode } from 'react'
import { BedDouble, KeyRound, Ruler, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { paths } from '@/app/paths'
import { EmptyProperties } from '@/components/illustrations'
import { ProgressRing } from '@/components/shared/progress-ring'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import type { Property } from '@/domain/types'
import { inrShort, num } from '@/lib/format'
import { configLabel, type Match } from '@/lib/matching'
import { coverPhoto, pricePerSqft, primaryAreaSqft } from '@/lib/property'
import { matchTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { MatchExplain } from './match-explain'
import { AvailabilityPill, SpecChip } from './property-pills'

export function PropertyCard({ property: p, match, actions, more, className, to }: {
  property: Property
  match?: Match
  /** Footer actions (match context: Shortlist, Share, Schedule visit, Not interested). */
  actions?: ReactNode
  more?: ReactNode
  className?: string
  /** Overrides the link target. */
  to?: string
}) {
  const { t } = useTranslation(['domain', 'catalogue'])
  const cover = coverPhoto(p)
  const area = primaryAreaSqft(p)
  const ppsf = pricePerSqft(p)
  const chips: ReactNode[] = []
  if (p.configuration) chips.push(<SpecChip key="cfg" icon={BedDouble}>{configLabel(p.configuration)}</SpecChip>)
  if (area) chips.push(<SpecChip key="area" icon={Ruler}>{t('domain:property.area', { area: num(area) })}</SpecChip>)
  chips.push(<SpecChip key="pos" icon={KeyRound}>{t(`catalogue:possession.${p.possession.status}`)}</SpecChip>)
  if (p.rera?.number) chips.push(<SpecChip key="rera" icon={ShieldCheck} className={p.rera.verified ? 'text-success' : undefined}>{t('domain:property.rera')}</SpecChip>)
  if (p.facing) chips.push(<SpecChip key="facing">{t(`catalogue:facing.${p.facing}`)}</SpecChip>)
  const shown = chips.slice(0, 4)
  const dim = match && (p.status === 'booked' || p.status === 'sold')
  return (
    <article data-testid="property-card" className={cn('group relative flex flex-col overflow-hidden rounded-lg border bg-card shadow-card transition-[transform,box-shadow] duration-(--dur-fast) hover:-translate-y-0.5 hover:shadow-md', dim && 'opacity-70', className)}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-t-lg bg-primary-soft">
        {cover ? (
          <img src={cover.url} alt="" loading="lazy" className="size-full object-cover transition-transform duration-(--dur-slow) group-hover:scale-[1.03]" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 text-primary">
            <EmptyProperties size={72} />
            {p.configuration && <span className="text-lg font-semibold">{configLabel(p.configuration)}</span>}
          </div>
        )}
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(to_top,var(--overlay),transparent_55%)]" />
        <AvailabilityPill status={p.status} overlay className="absolute top-2.5 left-2.5" />
        {match && (
          <HoverCard openDelay={150}>
            <HoverCardTrigger asChild>
              <button type="button" className="absolute top-2 right-2 z-[2] rounded-full bg-card/90 p-0.5 shadow-sm backdrop-blur focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" aria-label={t('domain:property.whyMatch', { pct: Math.round(match.score) })}>
                <ProgressRing value={match.score} size={44} tone={matchTone(match.score)} />
              </button>
            </HoverCardTrigger>
            <HoverCardContent align="end" className="w-72"><MatchExplain match={match} /></HoverCardContent>
          </HoverCard>
        )}
        <span className="absolute bottom-2.5 left-2.5 rounded-md bg-card/95 px-2 py-1 shadow-sm backdrop-blur">
          <span className="text-base font-[650] tabular-nums">{p.price ? inrShort(p.price) : t('domain:property.onRequest')}</span>
          {p.priceNegotiable && <span className="ml-1 text-micro text-muted-foreground">{t('domain:property.negotiable')}</span>}
          {p.purpose === 'rent' && <span className="ml-1 text-micro text-muted-foreground">{t('domain:property.perMonth')}</span>}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="truncate text-meta text-muted-foreground">{[p.location.locality, p.location.city].filter(Boolean).join(' · ')}</p>
        <h3 className="truncate text-base font-semibold">
          <Link to={to ?? paths.property(p.id)} className="hover:underline focus-visible:underline focus-visible:outline-none after:absolute after:inset-0">{p.title}</Link>
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {shown}
          {chips.length > 4 && <SpecChip>+{chips.length - 4}</SpecChip>}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="text-meta text-muted-foreground tabular-nums">{ppsf ? t('domain:property.perSqft', { price: num(Math.round(ppsf)) }) : ''}</span>
          {more && <div className="relative z-[1]">{more}</div>}
        </div>
        {actions && <div className="relative z-[1] flex flex-wrap gap-1.5 border-t pt-3">{actions}</div>}
      </div>
    </article>
  )
}
