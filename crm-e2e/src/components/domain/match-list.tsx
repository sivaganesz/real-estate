/**
 * Match list (master prompt §14, plan §7.7): ranked matches for a lead (or leads for a property) with the percentage
 * ring, the label, the one-line explanation ("Within budget · Whitefield · 3 BHK; missing: covered parking"), memory
 * ("Already shared 3 days ago") and actions: Shortlist, Share (WhatsApp), Schedule visit, Not interested.
 * `side` decides what each row shows: the property (lead → properties) or the lead (property → leads).
 */
import type { ReactNode } from 'react'
import { Bookmark, CalendarPlus, MessageCircle, ThumbsDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { paths } from '@/app/paths'
import { EmptyMatches } from '@/components/illustrations'
import { EmptyState } from '@/components/shared/empty-state'
import { ProgressRing } from '@/components/shared/progress-ring'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { coverPhoto } from '@/lib/property'
import { inrShort } from '@/lib/format'
import { summaryLine, type Match } from '@/lib/matching'
import { matchTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { MatchExplain } from './match-explain'
import { MatchLabelBadge } from './property-pills'

export type MatchActions = {
  onShortlist?: (m: Match) => void
  onShare?: (m: Match) => void
  onSchedule?: (m: Match) => void
  onNotInterested?: (m: Match) => void
}

export function MatchList({ matches, side = 'property', actions = {}, empty, limit, className }: {
  matches: Match[]
  side?: 'property' | 'lead'
  actions?: MatchActions
  empty?: ReactNode
  limit?: number
  className?: string
}) {
  const { t } = useTranslation(['domain', 'matching'])
  const list = limit ? matches.slice(0, limit) : matches
  if (!list.length) return <>{empty ?? <EmptyState compact illustration={EmptyMatches} title={t('domain:match.emptyTitle')} body={t('domain:match.emptyBody')} />}</>
  return (
    <ul className={cn('flex flex-col gap-2', className)} data-testid="match-list">
      {list.map((m) => {
        const p = m.property
        const cover = coverPhoto(p)
        const memory = m.memory === 'shared' ? t('domain:match.memory.shared') : m.memory === 'visited' ? t('domain:match.memory.visited') : m.memory === 'liked' ? t('domain:match.memory.liked') : m.memory === 'shortlisted' ? t('domain:match.memory.shortlisted') : null
        return (
          <li key={`${m.lead.id}-${p.id}`} className="flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-xs sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <HoverCard openDelay={150}>
                <HoverCardTrigger asChild>
                  <button type="button" className="shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" aria-label={t('domain:property.whyMatch', { pct: Math.round(m.score) })}>
                    <ProgressRing value={m.score} size={44} tone={matchTone(m.score)} />
                  </button>
                </HoverCardTrigger>
                <HoverCardContent align="start" className="w-72"><MatchExplain match={m} /></HoverCardContent>
              </HoverCard>
              {side === 'property' ? (
                cover ? <img src={cover.url} alt="" className="size-12 shrink-0 rounded-md object-cover max-sm:hidden" /> : null
              ) : (
                <UserAvatar name={m.lead.name} size="md" />
              )}
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  {side === 'property'
                    ? <Link to={paths.property(p.id)} className="truncate text-sm font-semibold hover:underline">{p.title}</Link>
                    : <Link to={paths.lead(m.lead.id)} className="truncate text-sm font-semibold hover:underline">{m.lead.name}</Link>}
                  <MatchLabelBadge label={m.label} />
                  {memory && <span className="text-meta text-muted-foreground">{memory}</span>}
                </p>
                <p className="truncate text-meta text-muted-foreground">
                  {side === 'property' ? `${p.location.locality} · ${p.price ? inrShort(p.price) : t('domain:property.onRequest')} · ` : ''}
                  {summaryLine(m, t)}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1">
              {actions.onShortlist && <Button variant="ghost" size="sm" onClick={() => actions.onShortlist?.(m)}><Bookmark />{t('domain:match.shortlist')}</Button>}
              {actions.onShare && <Button variant="ghost" size="sm" className="text-success hover:bg-success-soft hover:text-success" onClick={() => actions.onShare?.(m)}><MessageCircle />{t('domain:match.share')}</Button>}
              {actions.onSchedule && <Button variant="ghost" size="sm" onClick={() => actions.onSchedule?.(m)}><CalendarPlus />{t('domain:match.schedule')}</Button>}
              {actions.onNotInterested && <Button variant="ghost" size="icon-sm" onClick={() => actions.onNotInterested?.(m)} aria-label={t('domain:match.notInterested')} title={t('domain:match.notInterested')}><ThumbsDown /></Button>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
