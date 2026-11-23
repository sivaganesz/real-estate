import { useState } from 'react'
import { Link } from 'react-router'
import { Camera, ListTodo, MapPin, Share2, TriangleAlert, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/property/badges'
import { PropertyPhoto } from '@/components/property/property-photo'
import { ShareSheet } from '@/components/property/share-sheet'
import { inrShort, num } from '@/lib/format'
import { useLabels } from '@/lib/labels'
import { completion, pendingApprovals } from '@/lib/property'
import { useCan } from '@/store/db'
import type { Match } from '@/lib/matching'
import type { Property } from '@/data/types'

/**
 * Photo-first card. One signal at the bottom: the leads that fit (listed properties),
 * or what's left to do (a manager's draft).
 * The whole card opens the property; the Share button sits above the card link.
 */
export function PropertyCard({ property: p, matches }: { property: Property; matches: Match[] }) {
  const { t } = useTranslation()
  const L = useLabels()
  const can = useCan()
  const [sharing, setSharing] = useState(false)
  const photos = p.media.filter((m) => m.kind === 'photo')
  const ppsf = p.areaSqft ? Math.round(p.price / p.areaSqft) : 0
  const isDraft = p.status === 'draft'
  const done = isDraft ? completion(p) : null
  const pending = pendingApprovals(p)

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border bg-card text-card-foreground transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-ring">
      <div className="relative">
        <PropertyPhoto type={p.type} media={photos[0]} alt={p.title} className="aspect-[4/3] w-full" />
        <StatusBadge status={p.status} className="absolute top-2.5 left-2.5 shadow-sm" />
        {photos.length > 0 && (
          <span className="absolute right-2.5 bottom-2.5 inline-flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-xs text-white">
            <Camera className="size-3" /> {photos.length}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-lg font-semibold tracking-tight">{inrShort(p.price)}</p>
          {ppsf > 0 && <p className="text-xs text-muted-foreground">{t('card.perSqft', { rate: num(ppsf) })}</p>}
        </div>
        <h3 className="line-clamp-1 font-medium">
          {/* stretched link: the whole card is clickable */}
          <Link to={`/properties/${p.id}`} className="outline-none after:absolute after:inset-0">{p.title}</Link>
        </h3>
        <p className="line-clamp-1 text-sm text-muted-foreground">{L.keyFacts(p).join(' · ')}</p>
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" /> <span className="truncate">{p.location.locality}, {p.location.city}</span>
        </p>

        <div className="mt-auto flex items-center gap-2 border-t pt-2.5 text-sm">
          {isDraft && done ? (
            <div className="flex flex-1 items-center gap-2">
              <ListTodo className="size-4 text-muted-foreground" />
              <Progress value={done.pct} className="h-1.5 flex-1" aria-label={t('card.complete', { pct: done.pct })} />
              <span className="text-xs text-muted-foreground">{t('card.todo', { count: done.todo.length })}</span>
            </div>
          ) : (
            <span className={matches.length ? 'flex flex-1 items-center gap-1.5 font-medium text-primary' : 'flex flex-1 items-center gap-1.5 text-muted-foreground'}>
              <Users className="size-4" />
              {matches.length ? t('card.leadsFit', { count: matches.length }) : t('card.noLeadsFit')}
            </span>
          )}
          {pending.length > 0 && !isDraft && (
            <span title={t('approvalState.pendingHint')} className="text-amber-600"><TriangleAlert className="size-4" /></span>
          )}
          {!isDraft && !can('property.manage') && (
            <Button variant="outline" size="sm" className="relative z-10" onClick={() => setSharing(true)} aria-label={t('action.shareProperty', { title: p.title })}>
              <Share2 /> {t('action.share')}
            </Button>
          )}
        </div>
      </div>
      {sharing && <ShareSheet property={p} open={sharing} onOpenChange={setSharing} />}
    </article>
  )
}
