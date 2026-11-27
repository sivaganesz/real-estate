/**
 * Global activity log (master prompt §17; `activity.viewLog`: admin everything, manager their team's work). A day-
 * grouped timeline with the record links of each entry and how it was done (by hand, AI ✦, automation, import),
 * filters for person, record type, kind, time and "how", a search box, KPI tiles, and a simulated "ask in words"
 * reader ("AI changes by Arjun this week") that sets the same filters (Demo AI badge).
 */
import { useCallback, useMemo, useState } from 'react'
import type { TFunction } from 'i18next'
import {
  ArrowRightLeft, Bot, Building2, CalendarCheck, CalendarDays, CalendarX, CheckCircle2, FileText, History, ListPlus, Mail, MessageCircle,
  MessageSquare, Phone, Settings, Share2, Sparkles, Star, Trash2, Upload, UserCog, UserPlus, Users, Wand2, type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getAI } from '@/ai'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { EntityLink } from '@/components/domain/entity-link'
import { EmptyActivity } from '@/components/illustrations'
import { EmptyState } from '@/components/shared/empty-state'
import { FilterBar } from '@/components/shared/filter-bar'
import { FilterPill } from '@/components/shared/filter-pill'
import { FilteredEmpty } from '@/components/shared/filtered-empty'
import { KpiCard } from '@/components/shared/kpi-card'
import { PageHeader } from '@/components/shared/page-header'
import { Timeline, type TimelineItem } from '@/components/shared/timeline'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Activity, ActivityKind, PipelineStageKey } from '@/domain/types'
import { useWholeDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { addDaysToDay, localDay } from '@/lib/dates'
import { fmtDate, fmtTime } from '@/lib/format'
import { appointmentTypeTone, stageTone, type Tone, type ToneClasses } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { selectionLabel } from '@/ai/context'
import { visible } from '@/services/queries/visibility'
import {
  ENTITY_FILTERS, KIND_GROUPS, NO_FILTERS, RANGES, VIA_FILTERS, activeFilterCount, activityStats, actorsIn, dailyCounts, filterActivities,
  readActivityQuery, type ActivityFilters, type KindGroup, type Range,
} from '../lib/activity-filters'

/** Ported from components/domain/activity-timeline.tsx (foundation) so the log can add record links and "how" badges. */
const ICON: Partial<Record<ActivityKind, [LucideIcon, Tone]>> = {
  'lead.created': [UserPlus, 'primary'], 'lead.updated': [FileText, 'neutral'], 'lead.assigned': [Users, 'info'], 'lead.reassigned': [ArrowRightLeft, 'info'],
  'lead.deleted': [Trash2, 'danger'], 'lead.qualified': [CheckCircle2, 'success'], 'lead.merged': [Users, 'neutral'],
  'comm.whatsapp': [MessageCircle, 'success'], 'comm.email': [Mail, 'info'], 'comm.sms': [MessageSquare, 'neutral'], note: [FileText, 'neutral'],
  'appointment.created': [CalendarDays, 'primary'], 'appointment.rescheduled': [CalendarDays, 'warning'], 'appointment.completed': [CalendarCheck, 'success'],
  'appointment.cancelled': [CalendarX, 'neutral'], 'appointment.noShow': [CalendarX, 'danger'],
  'task.created': [ListPlus, 'neutral'], 'task.completed': [CheckCircle2, 'success'], 'task.cancelled': [CalendarX, 'neutral'],
  'property.created': [Building2, 'primary'], 'property.updated': [Building2, 'neutral'], 'property.statusChanged': [Building2, 'warning'],
  'property.deleted': [Trash2, 'danger'], 'property.shared': [Share2, 'success'], 'property.shortlisted': [Star, 'highlight'],
  'client.created': [Users, 'success'], 'client.updated': [Users, 'neutral'], 'import.completed': [Upload, 'info'], 'draft.saved': [FileText, 'neutral'],
  'user.created': [UserPlus, 'violet'], 'user.updated': [UserCog, 'violet'], 'user.deactivated': [UserCog, 'danger'], 'user.activated': [UserCog, 'success'],
  'user.availability': [UserCog, 'warning'], 'settings.changed': [Settings, 'neutral'],
}
const VIA_TONE: Record<Activity['via'], string> = { manual: 'bg-muted text-muted-foreground', ai: 'bg-ai-soft text-ai', automation: 'bg-info-soft text-info', import: 'bg-violet-soft text-violet' }
const PAGE = 60

/** Up to three record links per entry; a visit and its lead share a label, so the duplicate is dropped. */
function uniqueRefs(a: Activity, db: Parameters<typeof selectionLabel>[0]) {
  const seen = new Set<string>()
  return a.refs.filter((r) => {
    if (r.kind === 'settings') return false
    const label = selectionLabel(db, r) ?? r.id
    if (seen.has(label)) return false
    seen.add(label)
    return true
  }).slice(0, 3)
}

/** The sentence for an entry (stage labels, settings section and availability resolved). */
function sentence(t: TFunction, a: Activity): string {
  const p: Record<string, unknown> = { ...a.params }
  if (a.kind === 'lead.stageChanged') {
    p.toLabel = t(`catalogue:stage.${a.params.to as PipelineStageKey}`)
    p.fromLabel = t(`catalogue:stage.${a.params.from as PipelineStageKey}`)
  }
  if (a.kind === 'settings.changed' && typeof a.params.section === 'string') return t('activity:log.settingsChanged', { section: t(`activity:log.section.${a.params.section}`, { defaultValue: a.params.section }) })
  if (a.kind === 'user.availability' && typeof a.params.to === 'string') return t('activity:log.availability', { name: a.params.name, to: t(`common:availability.${a.params.to}`) })
  if ((a.kind === 'user.created' || a.kind === 'user.deactivated' || a.kind === 'user.activated' || a.kind === 'user.updated') && a.params.name) return t(`activity:log.${a.kind.split('.')[1]}`, { name: a.params.name })
  return t(`activity:${a.kind}`, p)
}

export default function ActivityPage() {
  const { t, i18n } = useTranslation(['activity', 'catalogue', 'domain', 'common', 'settings'])
  const db = useWholeDb()
  const now = useNow()
  const { user, scope } = usePermission()
  const [f, setF] = useState<ActivityFilters>(NO_FILTERS)
  const [shown, setShown] = useState(PAGE)
  const [ask, setAsk] = useState('')
  const [understood, setUnderstood] = useState<string[] | null>(null)

  const today = localDay(now)
  const yesterday = addDaysToDay(today, -1)
  const all = useMemo(() => visible.activities(db, user), [db, user])
  const nameOf = useCallback((id: string) => (id === 'system' ? t('activity:log.system') : db.users.find((u) => u.id === id)?.name ?? id), [db.users, t])

  const ctx = useMemo(() => ({
    today, dayOf: (iso: string) => localDay(iso), addDays: addDaysToDay,
    text: (a: Activity) => `${sentence(t, a)} ${nameOf(a.actorId)} ${a.refs.map((r) => selectionLabel(db, r) ?? '').join(' ')}`,
  }), [today, db, t, nameOf])
  const list = useMemo(() => filterActivities(all, f, ctx), [all, f, ctx])
  const stats = useMemo(() => activityStats(list), [list])
  const spark = useMemo(() => dailyCounts(list, today, 14, ctx.dayOf, addDaysToDay), [list, today, ctx])
  const actors = useMemo(() => actorsIn(all), [all])

  const set = (patch: Partial<ActivityFilters>) => {
    setF((x) => ({ ...x, ...patch }))
    setShown(PAGE)
  }
  const read = () => {
    const r = readActivityQuery(ask, db.users)
    setF({ ...NO_FILTERS, ...r.filters })
    setShown(PAGE)
    setUnderstood(r.understood)
  }
  const clear = () => {
    set(NO_FILTERS)
    setUnderstood(null)
    setAsk('')
  }

  const items: TimelineItem[] = list.slice(0, shown).map((a) => {
    const day = localDay(a.at)
    let icon: LucideIcon = ICON[a.kind]?.[0] ?? FileText
    let tone: Tone | undefined = ICON[a.kind]?.[1] ?? 'neutral'
    let classes: ToneClasses | undefined
    if (a.kind === 'lead.stageChanged') {
      const to = a.params.to as PipelineStageKey
      classes = stageTone[to]
      icon = stageTone[to]?.icon ?? icon
      tone = undefined
    }
    if (a.kind === 'comm.call') {
      icon = Phone
      classes = appointmentTypeTone.phoneCall
      tone = undefined
    }
    return {
      id: a.id, day, icon, tone, classes,
      dayLabel: day === today ? t('domain:timeline.today') : day === yesterday ? t('domain:timeline.yesterday') : fmtDate(a.at, i18n.language),
      time: fmtTime(a.at, i18n.language),
      title: sentence(t, a),
      body: a.text,
      actor: nameOf(a.actorId),
      ai: a.via === 'ai',
      action: (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta">
          <span className={cn('inline-flex h-5 items-center rounded-full px-2 text-micro font-semibold', VIA_TONE[a.via])}>{t(`activity:log.via.${a.via}`)}</span>
          {uniqueRefs(a, db).map((r) => <EntityLink key={`${r.kind}:${r.id}`} refTo={r} className="max-w-56" />)}
        </span>
      ),
    }
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('activity:page.title')}
        subtitle={scope('activity.viewLog') === 'all' ? t('activity:page.subtitle') : t('activity:log.subtitleTeam')}
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard label={t('activity:log.kpi.entries')} value={stats.total} icon={History} tone="primary" spark={spark} hint={t('activity:log.kpi.entriesHint')} />
        <KpiCard label={t('activity:log.kpi.ai')} value={stats.ai} icon={Sparkles} tone="ai" hint={t('activity:log.kpi.share', { pct: stats.total ? Math.round((stats.ai / stats.total) * 100) : 0 })} onClick={() => set({ via: ['ai'] })} className="flex flex-col justify-start" />
        <KpiCard label={t('activity:log.kpi.automation')} value={stats.automation + stats.import} icon={Bot} tone="info" hint={t('activity:log.kpi.automationHint', { auto: stats.automation, imported: stats.import })} onClick={() => set({ via: ['automation', 'import'] })} className="flex flex-col justify-start" />
        <KpiCard label={t('activity:log.kpi.top')} value={stats.topActor ? nameOf(stats.topActor) : '–'} icon={Users} tone="success" hint={t('activity:log.kpi.people', { count: stats.people })} onClick={stats.topActor ? () => set({ actors: [stats.topActor as string] }) : undefined} className="flex flex-col justify-start" />
      </div>

      <section className="flex flex-col gap-2 rounded-xl border border-dashed border-ai-border bg-ai-soft/30 p-3 md:p-4" aria-label={t('activity:log.ask.title')}>
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4 text-ai" aria-hidden="true" />{t('activity:log.ask.title')}<DemoAIBadge mode={getAI().mode} />
        </div>
        <form className="flex gap-2" onSubmit={(e) => {
          e.preventDefault()
          if (ask.trim()) read()
        }}>
          <Input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder={t('activity:log.ask.placeholder')} aria-label={t('activity:log.ask.title')} className="bg-card" data-testid="activity-ask" />
          <Button type="submit" variant="ai" disabled={!ask.trim()} data-testid="activity-ask-go"><Wand2 aria-hidden="true" />{t('activity:log.ask.go')}</Button>
        </form>
        {understood && (
          <p className="text-meta text-muted-foreground" role="status">
            {understood.length ? t('activity:log.ask.understood', { list: understood.map((u) => t(`activity:log.ask.part.${u}`)).join(', ') }) : t('activity:log.ask.searchOnly')}
          </p>
        )}
      </section>

      <FilterBar
        search={f.q} onSearch={(q) => set({ q })} placeholder={t('activity:log.search')} searchLabel={t('activity:log.search')}
        activeCount={activeFilterCount(f) - (f.q.trim() ? 1 : 0)} onClearAll={() => set({ ...NO_FILTERS, q: f.q })}
        filters={(
          <>
            <FilterPill label={t('activity:log.filter.who')} selected={f.actors} onChange={(actors) => set({ actors })}
              options={actors.map((id) => ({ value: id, label: nameOf(id), count: all.filter((a) => a.actorId === id).length }))} />
            <FilterPill label={t('activity:log.filter.record')} selected={f.entities} onChange={(v) => set({ entities: v as ActivityFilters['entities'] })}
              options={ENTITY_FILTERS.map((k) => ({ value: k, label: t(`activity:log.entity.${k}`) }))} />
            <FilterPill label={t('activity:log.filter.kind')} selected={f.groups} onChange={(v) => set({ groups: v as KindGroup[] })}
              options={KIND_GROUPS.map((g) => ({ value: g, label: t(`activity:log.group.${g}`) }))} />
            <FilterPill label={t('activity:log.filter.how')} selected={f.via} onChange={(v) => set({ via: v as ActivityFilters['via'] })}
              options={VIA_FILTERS.map((v) => ({ value: v, label: t(`activity:log.via.${v}`), count: all.filter((a) => a.via === v).length }))} />
            <FilterPill single label={t('activity:log.filter.when')} selected={f.range === 'all' ? [] : [f.range]} onChange={(v) => set({ range: (v[0] as Range | undefined) ?? 'all' })}
              options={RANGES.filter((r) => r !== 'all').map((r) => ({ value: r, label: t(`activity:log.range.${r}`) }))} />
          </>
        )}
      />

      <section className="rounded-lg border bg-card p-4 shadow-card md:p-5" aria-label={t('activity:page.title')} data-testid="activity-log">
        {all.length === 0 ? (
          <EmptyState illustration={EmptyActivity} title={t('activity:log.emptyTitle')} body={t('activity:log.emptyBody')} />
        ) : list.length === 0 ? (
          <FilteredEmpty title={t('activity:log.filteredTitle')} body={t('activity:log.filteredBody')} onClear={clear} />
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-meta text-muted-foreground">{t('activity:log.showing', { count: Math.min(shown, list.length), total: list.length })}</p>
            <Timeline items={items} stickyTop="top-14" />
            {shown < list.length && (
              <Button variant="secondary" className="self-center" onClick={() => setShown((n) => n + PAGE)} data-testid="activity-more">
                {t('activity:log.more', { count: Math.min(PAGE, list.length - shown) })}
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
