import { useState } from 'react'
import { Link } from 'react-router'
import { Camera, MapPin, Share2, TriangleAlert, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { inrShort, num } from '@/lib/format'
import { useLabels } from '@/lib/labels'
import { listingScore, pendingApprovals, photoCount } from '@/lib/property'
import { cn } from '@/lib/utils'
import { useCan } from '@/store/db'
import type { Match } from '@/lib/matching'
import type { Property } from '@/data/types'
import { CompletionRing, PropertyPhoto, PropertyStatusChip } from './property-bits'
import { SharePanel } from './share-panel'

/**
 * Photo-first card. The bottom line says who it's for: the leads that fit (matching on top),
 * plus — for managers — how complete the listing is. The whole card opens the property.
 */
export function PropertyCard({ property: p, matches, attention }: { property: Property; matches: Match[]; attention?: string[] }) {
  const { t } = useTranslation()
  const L = useLabels()
  const can = useCan()
  const [sharing, setSharing] = useState(false)
  const photos = photoCount(p)
  const ppsf = p.areaSqft ? Math.round(p.price / p.areaSqft) : 0
  const offered = p.status === 'available' && !p.archived

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-card transition-shadow focus-within:ring-2 focus-within:ring-ring hover:shadow-md">
      <div className="relative">
        <PropertyPhoto type={p.type} media={p.media[0]} alt={p.title} className="aspect-[4/3] w-full" />
        <PropertyStatusChip property={p} className="absolute top-2.5 left-2.5 shadow-sm" />
        {photos > 0 && (
          <span className="absolute right-2.5 bottom-2.5 inline-flex items-center gap-1 rounded-md bg-foreground/60 px-1.5 py-0.5 text-xs text-background">
            <Camera className="size-3" /> {photos}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-lg font-semibold tracking-tight">{inrShort(p.price)}</p>
          {ppsf > 0 && <p className="text-xs text-muted-foreground">{t('card.perSqft', { rate: num(ppsf) })}</p>}
        </div>
        <h3 className="line-clamp-1 font-medium">
          <Link to={`/properties/${p.id}`} className="outline-none after:absolute after:inset-0">{p.title}</Link>
        </h3>
        <p className="line-clamp-1 text-sm text-muted-foreground">{[L.type(p.type), ...L.keyFacts(p)].join(' · ')}</p>
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" /> <span className="truncate">{p.location.locality}, {p.location.city}</span>
        </p>
        {attention && attention.length > 0 && (
          <p className="mt-1 flex items-start gap-1.5 rounded-md bg-warning-soft px-2 py-1 text-xs text-warning">
            <TriangleAlert className="mt-px size-3.5 shrink-0" /> <span>{attention.join(' · ')}</span>
          </p>
        )}

        <div className="mt-auto flex items-center gap-2 border-t pt-2.5 text-sm">
          {p.status === 'draft' ? (
            <span className="flex-1 text-muted-foreground">{t('props.draftHint')}</span>
          ) : (
            <span className={cn('flex flex-1 items-center gap-1.5', offered && matches.length ? 'font-medium text-primary' : 'text-muted-foreground')}>
              <Users className="size-4" />
              {!offered ? t('props.notOffered') : matches.length ? t('card.leadsFit', { count: matches.length }) : t('card.noLeadsFit')}
            </span>
          )}
          {pendingApprovals(p).length > 0 && !attention && (
            <span title={t('approvalState.pendingHint')} className="text-warning"><TriangleAlert className="size-4" /></span>
          )}
          {can('property.manage') && <CompletionRing score={listingScore(p).score} size={30} className="relative z-10" />}
          {offered && (
            <Button variant="outline" size="icon-sm" className="relative z-10" onClick={() => setSharing(true)} aria-label={t('action.shareProperty', { title: p.title })}>
              <Share2 />
            </Button>
          )}
        </div>
      </div>
      {sharing && <SharePanel property={p} open={sharing} onOpenChange={setSharing} />}
    </article>
  )
}
