/**
 * The executive's supporting cards: monthly target rings (calls, visits, bookings) with rank, streak and pace; the
 * lead sections (Hot · Overdue · New today · Not contacted in N days); the "Visited, not booked" strip; and the
 * "New matches to send" list, whose Share button sends the property on WhatsApp and records the share (E11).
 */
import { useState } from 'react'
import { ArrowUpRight, Award, Flame, MessageCircle, Phone, Send, Star, Target, Trophy, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { paths } from '@/app/paths'
import { EmptyLeads, EmptyMatches } from '@/components/illustrations'
import { EmptyState } from '@/components/shared/empty-state'
import { Meter } from '@/components/shared/meter'
import { ProgressRing, ScoreRing } from '@/components/shared/progress-ring'
import { SectionCard } from '@/components/shared/section-card'
import { Segmented } from '@/components/shared/segmented'
import { toastError } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import type { DB, Lead, Task } from '@/domain/types'
import { usePermission } from '@/hooks/use-permission'
import { fmtDateTime, firstName, inrShort } from '@/lib/format'
import type { Match } from '@/lib/matching'
import type { LeadScore } from '@/lib/scoring'
import { stageTone, temperatureTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { shareMessage, telLink, waLink } from '@/lib/whatsapp'
import { shareProperties, shortlistProperty } from '@/services/matching'
import type { ExecutiveToday } from '@/services/queries/today'
import { toast } from 'sonner'
import { perDayNeeded } from '../lib/brief'

/* ---------- targets ---------- */

export function TargetsCard({ data, now }: { data: Pick<ExecutiveToday, 'targets' | 'rank' | 'streak' | 'today'>; now: Date }) {
  const { t } = useTranslation('today')
  const rings = [
    { key: 'calls', icon: Phone, ...data.targets.calls },
    { key: 'visits', icon: Target, ...data.targets.siteVisits },
    { key: 'bookings', icon: Trophy, ...data.targets.bookings },
  ] as const
  const rev = data.targets.revenue
  const callsPerDay = perDayNeeded(data.targets.calls.done, data.targets.calls.target, now)
  return (
    <SectionCard title={t('targets.title')} description={t('targets.subtitle')} data-testid="today-targets">
      <ul className="grid grid-cols-3 gap-2">
        {rings.map((r) => (
          <li key={r.key} className="flex flex-col items-center gap-1.5 text-center">
            <ProgressRing value={r.pct} size={64} stroke={6} targetMet={r.target > 0 && r.done >= r.target} label={t(`targets.${r.key}`)}>
              <r.icon className="size-4 text-muted-foreground" aria-hidden="true" />
            </ProgressRing>
            <span className="text-sm font-semibold tabular-nums">{r.done}<span className="font-normal text-muted-foreground"> / {r.target}</span></span>
            <span className="text-meta text-muted-foreground">{t(`targets.${r.key}`)}</span>
          </li>
        ))}
      </ul>
      {rev.target > 0 && (
        <div className="mt-4 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-meta text-muted-foreground">
            <span>{t('targets.revenue')}</span>
            <span className="font-semibold text-foreground tabular-nums">{inrShort(rev.done)} / {inrShort(rev.target)}</span>
          </div>
          <Meter value={rev.pct} targetMet={rev.done >= rev.target} label={t('targets.revenue')} />
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {data.rank && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-highlight-soft px-2.5 py-1 text-meta font-medium text-highlight-foreground" data-testid="today-rank">
            <Award className="size-3.5" aria-hidden="true" />{t('targets.rank', { rank: data.rank.rank, of: data.rank.of })}
          </span>
        )}
        {data.streak > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warm-soft px-2.5 py-1 text-meta font-medium text-warm">
            <Zap className="size-3.5" aria-hidden="true" />{t('targets.streak', { count: data.streak })}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-meta text-muted-foreground">
          <Phone className="size-3.5" aria-hidden="true" />{t('targets.today', { calls: data.today.calls, wa: data.today.whatsapp })}
        </span>
      </div>
      {callsPerDay > 0 && <p className="mt-3 text-meta text-muted-foreground">{t('targets.pace', { count: callsPerDay })}</p>}
    </SectionCard>
  )
}

/* ---------- lead sections ---------- */

type Section = 'hot' | 'overdue' | 'new' | 'idle'

export function LeadSections({ data, db, now }: { data: Pick<ExecutiveToday, 'hot' | 'overdue' | 'newToday' | 'notContacted' | 'notContactedDays' | 'scores'>; db: DB; now: Date }) {
  const { t, i18n } = useTranslation(['today', 'catalogue'])
  const [tab, setTab] = useState<Section>(data.overdue.length ? 'overdue' : 'hot')
  const leadOf = (task: Task) => db.leads.find((l) => l.id === task.leadId)
  const lists: Record<Section, { lead?: Lead; task?: Task }[]> = {
    hot: data.hot.map((lead) => ({ lead })),
    overdue: data.overdue.map((task) => ({ task, lead: leadOf(task) })),
    new: data.newToday.map((lead) => ({ lead })),
    idle: data.notContacted.map((lead) => ({ lead })),
  }
  const rows = lists[tab]
  return (
    <SectionCard title={t('today:sections.title')} data-testid="today-sections" bodyClassName="flex flex-col gap-3">
      <Segmented
        label={t('today:sections.title')} value={tab} onChange={setTab}
        segments={(['hot', 'overdue', 'new', 'idle'] as Section[]).map((s) => ({ value: s, label: t(`today:sections.${s}`, { days: data.notContactedDays }), count: lists[s].length }))}
      />
      {rows.length === 0 ? (
        <EmptyState compact illustration={EmptyLeads} title={t(`today:sections.empty.${tab}`)} body={t('today:sections.emptyBody')} />
      ) : (
        <ul className="flex flex-col divide-y divide-border/70">
          {rows.slice(0, 6).map(({ lead, task }) => {
            const s: LeadScore | undefined = lead ? data.scores.get(lead.id) : undefined
            const temp = lead ? (lead.temperatureOverride ?? s?.temperature) : undefined
            const days = lead ? Math.floor((now.getTime() - new Date(lead.lastContactAt ?? lead.createdAt).getTime()) / 86_400_000) : 0
            return (
              <li key={task?.id ?? lead?.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                {temp && <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', temperatureTone[temp].solid)} />}
                <div className="min-w-0 flex-1">
                  {lead ? <Link to={paths.lead(lead.id)} className="block truncate text-sm font-medium hover:underline">{lead.name}</Link> : <span className="block truncate text-sm font-medium">{task?.title}</span>}
                  <p className="truncate text-meta text-muted-foreground">
                    {task ? t('today:sections.taskLine', { title: task.title, when: fmtDateTime(task.dueAt, i18n.language) })
                      : lead ? [t(`catalogue:stage.${lead.stage}`), lead.requirement.localities[0] ?? lead.requirement.cities[0], lead.requirement.budgetMax ? inrShort(lead.requirement.budgetMax) : null, tab === 'idle' ? t('today:sections.idleDays', { count: days }) : null].filter(Boolean).join(' · ') : ''}
                  </p>
                </div>
                {s && <ScoreRing score={s.score} size={28} label={t('today:priority.score')} />}
                {lead?.phone && (
                  <Button asChild size="icon-sm" variant="ghost" aria-label={t('today:actions.callTip', { name: lead.name })}>
                    <a href={telLink(lead.phone)}><Phone /></a>
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {rows.length > 6 && (
        <Button asChild variant="ghost" size="sm" className="self-start">
          <Link to={tab === 'overdue' ? paths.tasks() : paths.leads()}>{t('today:sections.more', { count: rows.length - 6 })}<ArrowUpRight /></Link>
        </Button>
      )}
    </SectionCard>
  )
}

/* ---------- visited, not booked ---------- */

export function VisitedStrip({ items, db }: { items: ExecutiveToday['visitedNotBooked']; db: DB }) {
  const { t } = useTranslation(['today', 'catalogue'])
  const { can } = usePermission()
  if (!items.length) return null
  const msg = (l: Lead) => {
    const tpl = db.settings.templates.find((x) => x.purpose === 'postVisit' && x.tone === 'english')
    return tpl ? tpl.body.replace('{{firstName}}', firstName(l.name)).replace('{{property}}', db.properties.find((p) => p.id === l.shortlist.find((s) => s.status === 'visited' || s.status === 'liked')?.propertyId)?.title ?? '') : ''
  }
  return (
    <SectionCard title={t('today:visited.title')} description={t('today:visited.subtitle')} icon={Star} data-testid="visited-strip" bodyClassName="pt-3">
      <ul className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
        {items.map(({ lead, days }) => {
          const liked = lead.shortlist.filter((s) => s.status === 'liked').length
          return (
            <li key={lead.id} className="w-64 shrink-0 snap-start rounded-lg border bg-card p-3 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <Link to={paths.lead(lead.id)} className="truncate text-sm font-semibold hover:underline">{lead.name}</Link>
                <span className={cn('inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-micro font-semibold whitespace-nowrap', days <= 7 ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning')}>
                  {days <= 7 ? t('today:visited.week') : t('today:visited.twoWeeks')}
                </span>
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-meta text-muted-foreground">
                <span aria-hidden="true" className={cn('size-1.5 rounded-full', stageTone[lead.stage].solid)} />
                {t(`catalogue:stage.${lead.stage}`)} · {t('today:visited.daysAgo', { count: days })}
              </p>
              {liked > 0 && <p className="mt-0.5 text-meta text-muted-foreground">{t('today:visited.liked', { count: liked })}</p>}
              <div className="mt-2 flex flex-wrap gap-1">
                {lead.phone && <Button asChild size="xs" variant="secondary"><a href={telLink(lead.phone)}><Phone />{t('today:actions.call')}</a></Button>}
                {lead.phone && can('lead.edit', lead) && (
                  <Button asChild size="xs" variant="ghost" className="text-success hover:bg-success-soft hover:text-success">
                    <a href={waLink(lead.phone, msg(lead))} target="_blank" rel="noopener noreferrer"><MessageCircle />{t('today:actions.whatsapp')}</a>
                  </Button>
                )}
                <Button asChild size="xs" variant="ghost"><Link to={paths.matching({ lead: lead.id })}>{t('today:visited.more')}</Link></Button>
              </div>
            </li>
          )
        })}
      </ul>
    </SectionCard>
  )
}

/* ---------- new matches to send ---------- */

export function MatchesCard({ matches, db }: { matches: Match[]; db: DB }) {
  const { t } = useTranslation(['today'])
  const { can, user } = usePermission()
  const share = (m: Match) => {
    const lead = db.leads.find((l) => l.id === m.lead.id)
    const p = db.properties.find((x) => x.id === m.property.id)
    if (!lead || !p) return
    try {
      const text = shareMessage(lead, [p], { templates: db.settings.templates, agent: user.name })
      shareProperties(lead.id, [p.id], { channel: 'whatsapp' })
      const href = waLink(lead.phone, text)
      if (href) window.open(href, '_blank', 'noopener')
      toast.success(t('today:matches.shared', { name: lead.name, property: p.title }))
    } catch (e) {
      toastError(e)
    }
  }
  const shortlist = (m: Match) => {
    try {
      shortlistProperty(m.lead.id, m.property.id)
      toast.success(t('today:matches.shortlisted'))
    } catch (e) {
      toastError(e)
    }
  }
  return (
    <SectionCard title={t('today:matches.title')} description={t('today:matches.subtitle')} icon={Flame} data-testid="today-matches"
      action={<Button asChild size="sm" variant="ghost"><Link to={paths.matching()}>{t('today:matches.all')}<ArrowUpRight /></Link></Button>}
    >
      {matches.length === 0 ? (
        <EmptyState compact illustration={EmptyMatches} title={t('today:matches.emptyTitle')} body={t('today:matches.emptyBody')} />
      ) : (
        <ul className="flex flex-col divide-y divide-border/70">
          {matches.map((m) => {
            const lead = db.leads.find((l) => l.id === m.lead.id)
            const p = db.properties.find((x) => x.id === m.property.id)
            if (!lead || !p) return null
            const cover = p.media.find((x) => x.isCover) ?? p.media[0]
            const mayEdit = can('lead.edit', lead)
            return (
              <li key={`${m.lead.id}-${m.property.id}`} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0" data-testid="match-row">
                {cover ? <img src={cover.url} alt="" className="size-11 shrink-0 rounded-md object-cover" loading="lazy" /> : <span aria-hidden="true" className="size-11 shrink-0 rounded-md bg-primary-soft" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium"><Link to={paths.property(p.id)} className="hover:underline">{p.title}</Link></p>
                  <p className="truncate text-meta text-muted-foreground">{t('today:matches.for', { name: lead.name, price: inrShort(p.price), place: p.location.locality })}</p>
                </div>
                <ScoreRing score={m.score} kind="match" size={36} label={t('today:matches.score')} />
                {mayEdit && (
                  <div className="flex gap-0.5">
                    <Button size="icon-sm" variant="ghost" onClick={() => shortlist(m)} aria-label={t('today:matches.shortlist')} title={t('today:matches.shortlist')}><Star /></Button>
                    <Button size="sm" variant="ghost" className="text-success hover:bg-success-soft hover:text-success" onClick={() => share(m)} data-testid="match-share"><Send /><span className="hidden sm:inline">{t('today:matches.share')}</span></Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
}
