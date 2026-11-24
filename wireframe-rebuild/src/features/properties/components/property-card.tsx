import { useState } from 'react'
import { Link } from 'react-router'
import { BedDouble, Camera, Layers, MapPin, Maximize2, Ruler, Share2, TriangleAlert, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { UserAvatar } from '@/components/app/user-avatar'
import { inrShort, num } from '@/lib/format'
import { type KeyFact, useLabels } from '@/lib/labels'
import { listingScore, pendingApprovals, photoCount } from '@/lib/property'
import { cn } from '@/lib/utils'
import { useCan } from '@/store/db'
import type { Match } from '@/lib/matching'
import type { Property } from '@/data/types'
import { CompletionPill, PropertyPhoto, PropertyStatusChip, TypeIcon } from './property-bits'
import { SharePanel } from './share-panel'

const FACT_ICON: Record<Exclude<KeyFact['kind'], 'kind'>, typeof Ruler> = { size: Ruler, rooms: BedDouble, floor: Layers, area: Maximize2 }

/**
 * Photo-first card. Top to bottom: the photo (status, share, photo count), the price, the type, title and place,
 * the key facts as small chips, and a footer that says who it's for: the leads that fit (opens Matching buyers)
 * and, for managers, how complete the listing is. The rest of the card opens the property.
 * `compact`: a wider, shorter photo and tighter spacing, so four cards fit in a row on a laptop.
 */
export function PropertyCard({ property: p, matches, attention, compact }: { property: Property; matches: Match[]; attention?: string[]; compact?: boolean }) {
  const { t } = useTranslation()
  const L = useLabels()
  const can = useCan()
  const [sharing, setSharing] = useState(false)
  const photos = photoCount(p)
  const ppsf = p.areaSqft ? Math.round(p.price / p.areaSqft) : 0
  const offered = p.status === 'available' && !p.archived
  const pending = pendingApprovals(p).length > 0

  return (
    <article className="group relative isolate flex w-full flex-col overflow-hidden rounded-2xl border bg-card shadow-card transition-[box-shadow,translate,border-color] duration-200 focus-within:ring-2 focus-within:ring-ring hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="relative overflow-hidden">
        <PropertyPhoto type={p.type} media={p.media.find((m) => m.isCover) ?? p.media[0]} alt={p.title}
          className={cn('w-full rounded-none transition-transform duration-300 group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100', compact ? 'aspect-[2/1]' : 'aspect-[16/10]')} />
        {/* a soft shade at the bottom keeps the photo count readable on light photos */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/35 to-transparent" />
        <PropertyStatusChip property={p} className="absolute top-3 left-3 shadow-sm" />
        {offered && (
          // on the photo: shows on hover or keyboard focus with a mouse; always there on touch screens
          <button type="button" onClick={() => setSharing(true)} aria-label={t('action.shareProperty', { title: p.title })} title={t('action.shareProperty', { title: p.title })}
            className="absolute top-2.5 right-2.5 z-10 grid size-8 place-items-center rounded-full bg-card/90 text-foreground shadow-sm backdrop-blur transition-opacity hover:bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100 md:[@media(hover:none)]:opacity-100">
            <Share2 className="size-4" />
          </button>
        )}
        {photos > 0 && (
          <span className="absolute right-3 bottom-2.5 inline-flex items-center gap-1 text-xs font-medium text-white">
            <Camera className="size-3.5" /> {photos}
          </span>
        )}
      </div>

      <div className={cn('flex flex-1 flex-col', compact ? 'p-3 pb-2.5' : 'p-4 pb-3.5')}>
        <div className="flex items-baseline justify-between gap-2">
          <p className={cn('font-semibold tracking-tight tabular-nums', compact ? 'text-lg' : 'text-xl')}>{inrShort(p.price)}</p>
          {ppsf > 0 && <p className="text-xs text-muted-foreground tabular-nums">{t('card.perSqft', { rate: num(ppsf) })}</p>}
        </div>
        <p className={cn('text-caption font-semibold tracking-wide text-primary uppercase', compact ? 'mt-1' : 'mt-1.5')}>{L.type(p.type)} · {L.purpose(p.purpose)}</p>
        <h3 className={cn('mt-0.5 line-clamp-1 font-semibold', compact && 'text-sm')}>
          <Link to={`/properties/${p.id}`} className="outline-none after:absolute after:inset-0">{p.title}</Link>
        </h3>
        <p className={cn('mt-0.5 flex items-center gap-1 text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
          <MapPin className="size-3.5 shrink-0" /> <span className="truncate">{p.location.locality}, {p.location.city}</span>
        </p>

        <ul className={cn('flex flex-wrap gap-1.5', compact ? 'mt-2' : 'mt-3')} aria-label={t('score.keyDetails')}>
          {L.keyFactItems(p).map((f) => {
            const Icon = f.kind === 'kind' ? null : FACT_ICON[f.kind]
            return (
              <li key={f.kind + f.text} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-secondary-foreground [&_svg]:size-3.5 [&_svg]:text-muted-foreground">
                {Icon ? <Icon aria-hidden /> : <TypeIcon type={p.type} />}{f.text}
              </li>
            )
          })}
        </ul>

        {attention && attention.length > 0 && (
          <p className="mt-3 flex items-start gap-1.5 rounded-md bg-warning-soft px-2 py-1 text-xs text-warning">
            <TriangleAlert className="mt-px size-3.5 shrink-0" /> <span>{attention.join(' · ')}</span>
          </p>
        )}
      </div>

      <div className={cn('mt-auto flex items-center gap-2 border-t', compact ? 'min-h-10 px-3 py-1.5 text-ui' : 'min-h-12 px-4 py-2 text-sm')}>
        {p.status === 'draft' ? (
          <span className="flex-1 text-muted-foreground">{t('props.draftHint')}</span>
        ) : offered && matches.length ? (
          // above the card's own link, so it opens Matching buyers rather than the Overview
          <Link to={`/properties/${p.id}/matching`} title={matches.map((m) => m.lead.name).join(', ')}
            className="relative z-10 -ml-1 flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 pl-1 font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
            <span aria-hidden className="flex -space-x-1">
              {matches.slice(0, 3).map((m) => <UserAvatar key={m.lead.id} name={m.lead.name} size="xs" className="ring-2 ring-card" />)}
            </span>
            <span className="leading-tight">{t('card.leadsFit', { count: matches.length })}</span>
          </Link>
        ) : (
          <span className="flex flex-1 items-center gap-1.5 leading-tight text-muted-foreground">
            <Users className="size-4" /> {offered ? t('card.noLeadsFit') : t('props.notOffered')}
          </span>
        )}
        {pending && !attention && (
          <span title={t('approvalState.pendingHint')} className="text-warning"><TriangleAlert className="size-4" /></span>
        )}
        {can('property.manage') && <CompletionPill score={listingScore(p).score} className="shrink-0" />}
      </div>
      {sharing && <SharePanel property={p} open={sharing} onOpenChange={setSharing} />}
    </article>
  )
}
