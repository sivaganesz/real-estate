/**
 * One person (Team → name): profile and availability, this month's targets, the open load by stage with their open
 * leads (hand them over with the assign dialog), the assignment history (who gave them which lead, when, why and
 * how) and their activity. Managers see only their own team; others get a "not in your team" state.
 */
import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, Inbox, ListTodo, Mail, Percent, Phone, Shuffle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { paths } from '@/app/paths'
import { ActivityTimeline } from '@/components/domain/activity-timeline'
import { AssignDialog } from '@/components/domain/assign-dialog'
import { EntityLink } from '@/components/domain/entity-link'
import { EmptyTeam, NoAccess } from '@/components/illustrations'
import { DotBadge } from '@/components/shared/badges'
import { EmptyState } from '@/components/shared/empty-state'
import { KpiCard } from '@/components/shared/kpi-card'
import { ProgressRing } from '@/components/shared/progress-ring'
import { SectionCard } from '@/components/shared/section-card'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import { OPEN_STAGES } from '@/domain/catalogue'
import type { Assignment } from '@/domain/types'
import { useWholeDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { assigneeStatsFromDb, openLeadsOf } from '@/lib/assignment'
import { fmtDate, fmtDateTime, inrShort } from '@/lib/format'
import { phoneDisplay, telLink } from '@/lib/phone'
import { roleTone, stageTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { targetProgress } from '@/services/queries/stats'
import { AvailabilityControl } from '../components/availability-control'
import { UserActions } from '../components/user-actions'

export default function TeamMemberPage() {
  const { id = '' } = useParams()
  const { t, i18n } = useTranslation(['team', 'common', 'catalogue'])
  const db = useWholeDb()
  const now = useNow()
  const { can } = usePermission()
  const [assignOpen, setAssignOpen] = useState(false)
  const user = db.users.find((u) => u.id === id)

  const stats = useMemo(() => (user ? assigneeStatsFromDb(db, [user.id], now)[user.id] : undefined), [db, user, now])
  const open = useMemo(() => (user ? openLeadsOf(db.leads, user.id) : []), [db.leads, user])
  const history = useMemo(() => db.assignments.filter((a) => a.toUserId === id || a.fromUserId === id).sort((a, b) => b.at.localeCompare(a.at)), [db.assignments, id])
  const activity = useMemo(() => db.activities.filter((a) => a.actorId === id || a.refs.some((r) => r.kind === 'user' && r.id === id)), [db.activities, id])

  const back = <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit"><Link to={paths.team()}><ArrowLeft aria-hidden="true" />{t('team:member.back')}</Link></Button>

  if (!user) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        {/* every page keeps one h1 for screen readers, also when it cannot show the person */}
        <h1 className="sr-only">{t('team:member.notFound')}</h1>
        <section className="rounded-lg border bg-card shadow-card">
          <EmptyState illustration={EmptyTeam} title={t('team:member.notFound')} body={t('team:member.notFoundBody')} primary={<Button asChild><Link to={paths.team()}>{t('team:member.back')}</Link></Button>} />
        </section>
      </div>
    )
  }
  if (!can('team.view', { ownerId: user.id })) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        {/* every page keeps one h1 for screen readers, also when it cannot show the person */}
        <h1 className="sr-only">{t('team:member.notInTeam')}</h1>
        <section className="rounded-lg border bg-card shadow-card">
          <EmptyState illustration={NoAccess} title={t('team:member.notInTeam')} body={t('team:member.notInTeamBody')} primary={<Button asChild><Link to={paths.team()}>{t('team:member.back')}</Link></Button>} />
        </section>
      </div>
    )
  }

  const progress = targetProgress(db, user, now)
  const isExec = user.role === 'executive'
  const byStage = OPEN_STAGES.map((stage) => ({ stage, count: open.filter((l) => l.stage === stage).length })).filter((x) => x.count)
  const maxStage = Math.max(1, ...byStage.map((x) => x.count))

  return (
    <div className="flex flex-col gap-6">
      {back}
      <header className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-card md:flex-row md:items-center md:p-5" data-testid="member-header">
        <UserAvatar name={user.name} size="lg" role={user.role} availability={user.status === 'active' ? user.availability : undefined} className="self-start" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-[650] tracking-[-0.02em] [:lang(ta)_&]:tracking-normal">{user.name}</h1>
            <span className={cn('inline-flex h-6 items-center rounded-full px-2.5 text-meta font-medium', roleTone[user.role].soft, roleTone[user.role].text)}>{t(`common:roles.${user.role}`)}</span>
            {user.status === 'deactivated'
              ? <span className="inline-flex h-6 items-center rounded-full bg-neutral-soft px-2.5 text-meta font-medium text-neutral">{t('team:status.deactivated')}</span>
              : <AvailabilityControl user={user} />}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {user.phone && <a href={telLink(user.phone)} className="inline-flex items-center gap-1 hover:text-primary"><Phone className="size-3.5" aria-hidden="true" />{phoneDisplay(user.phone)}</a>}
            <a href={`mailto:${user.email}`} className="inline-flex items-center gap-1 hover:text-primary"><Mail className="size-3.5" aria-hidden="true" />{user.email}</a>
            <span>{t('team:member.joined', { date: fmtDate(user.joinedAt, i18n.language) })}</span>
            {user.managerId && <span>{t('team:member.reportsTo', { name: db.users.find((u) => u.id === user.managerId)?.name ?? '' })}</span>}
            {user.leaveUntil && user.availability === 'onLeave' && <span>{t('team:availabilityUntil', { until: fmtDate(user.leaveUntil, i18n.language) })}</span>}
          </p>
          <p className="mt-1 text-meta text-muted-foreground">
            {[user.cities.join(', '), user.languages.map((l) => t(`team:language.${l}`, { defaultValue: l })).join(', ')].filter(Boolean).join(' · ')}
          </p>
        </div>
        <UserActions user={user} showProfile={false} />
      </header>

      {stats && (
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          <KpiCard label={t('team:member.kpi.open')} value={stats.active} icon={Inbox} tone="info" hint={t('team:workloadShort', { hot: stats.hot, warm: stats.warm, cold: stats.cold })} />
          <KpiCard label={t('team:member.kpi.followUps')} value={stats.pendingFollowUps} icon={ListTodo} tone={stats.overdue ? 'danger' : 'primary'} hint={t('team:overdue', { count: stats.overdue })} />
          <KpiCard label={t('team:member.kpi.today')} value={stats.todayAppointments} icon={CalendarDays} tone="primary" hint={t('team:member.kpi.visitsMonth', { count: progress.siteVisits.done })} />
          <KpiCard
            label={t('team:member.kpi.conversion')} value={stats.conversionPct === null ? '–' : `${stats.conversionPct}%`} icon={Percent} tone="success"
            ring={{ value: stats.conversionPct ?? 0, label: t('team:member.kpi.conversion') }}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-7">
          <SectionCard title={t('team:member.history')} description={t('team:member.historyHint')} icon={Shuffle}>
            {history.length === 0 ? <p className="text-sm text-muted-foreground">{t('team:member.noHistory')}</p> : (
              <ol className="flex flex-col divide-y" data-testid="assignment-history">
                {history.slice(0, 25).map((a) => <HistoryRow key={a.id} a={a} userId={user.id} />)}
              </ol>
            )}
          </SectionCard>
          <SectionCard title={t('team:member.activity')}>
            <ActivityTimeline activities={activity} limit={30} />
          </SectionCard>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-5">
          {isExec && user.targets && (
            <SectionCard title={t('team:card.targets')} description={t('team:member.targetsHint')}>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                {(['calls', 'siteVisits', 'bookings', 'revenue'] as const).map((k) => (
                  <div key={k} className="flex flex-col items-center gap-1.5 text-center">
                    <ProgressRing value={progress[k].pct} size={56} targetMet={progress[k].target > 0 && progress[k].done >= progress[k].target} label={t(`team:target.${k}`)} />
                    <span className="text-meta font-medium">{t(`team:target.${k}`)}</span>
                    <span className="text-meta text-muted-foreground tabular-nums">
                      {k === 'revenue' ? `${inrShort(progress[k].done)} / ${inrShort(progress[k].target)}` : `${progress[k].done} / ${progress[k].target}`}
                    </span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          <SectionCard
            title={t('team:member.openLeads', { count: open.length })}
            action={can('lead.assign') && open.length > 0 ? <Button size="sm" variant="secondary" onClick={() => setAssignOpen(true)} data-testid="member-reassign">{t('team:member.reassign')}</Button> : undefined}
          >
            {open.length === 0 ? <p className="text-sm text-muted-foreground">{t('team:member.noOpen')}</p> : (
              <div className="flex flex-col gap-4">
                <ul className="flex flex-col gap-2" aria-label={t('team:member.byStage')}>
                  {byStage.map((x) => (
                    <li key={x.stage} className="grid grid-cols-[minmax(7rem,10rem)_1fr_auto] items-center gap-2 text-meta">
                      <DotBadge classes={stageTone[x.stage]}>{t(`catalogue:stage.${x.stage}`)}</DotBadge>
                      <span className="h-2 overflow-hidden rounded-full bg-muted"><span className={cn('block h-full rounded-full', stageTone[x.stage].solid)} style={{ width: `${(x.count / maxStage) * 100}%` }} /></span>
                      <span className="font-semibold tabular-nums">{x.count}</span>
                    </li>
                  ))}
                </ul>
                <ul className="flex flex-col gap-1.5 border-t pt-3 text-sm">
                  {open.slice(0, 10).map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-2">
                      <EntityLink refTo={{ kind: 'lead', id: l.id }} />
                      <span className="shrink-0 text-meta text-muted-foreground">{t(`catalogue:stage.${l.stage}`)}</span>
                    </li>
                  ))}
                  {open.length > 10 && <li className="text-meta text-muted-foreground">{t('team:member.more', { count: open.length - 10 })}</li>}
                </ul>
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {assignOpen && <AssignDialog open={assignOpen} onOpenChange={setAssignOpen} leadIds={open.map((l) => l.id)} />}
    </div>
  )
}

function HistoryRow({ a, userId }: { a: Assignment; userId: string }) {
  const { t, i18n } = useTranslation(['team', 'catalogue'])
  const db = useWholeDb()
  const name = (id: string | null) => (id ? db.users.find((u) => u.id === id)?.name : undefined) ?? t('team:assign.nobody')
  const by = a.by === 'system' ? t('team:member.system') : name(a.by)
  const incoming = a.toUserId === userId
  return (
    <li className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <EntityLink refTo={{ kind: 'lead', id: a.leadId }} />
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          {name(a.fromUserId)} <ArrowRight className="size-3" aria-hidden="true" /> <span className={cn(incoming && 'font-medium text-foreground')}>{name(a.toUserId)}</span>
        </span>
        <span className={cn('ml-auto inline-flex h-5 items-center rounded-full px-2 text-micro font-semibold', a.mode === 'auto' ? 'bg-ai-soft text-ai' : 'bg-muted text-muted-foreground')}>{t(`team:mode.${a.mode}`)}</span>
      </div>
      <p className="text-meta text-muted-foreground">
        {t(`catalogue:assignmentReason.${a.reason.key}`)} · {t('team:member.by', { name: by })} · <span className="tabular-nums">{fmtDateTime(a.at, i18n.language)}</span>
      </p>
      {a.note && <p className="rounded-md bg-muted/60 px-2.5 py-1.5 text-meta">{a.note}</p>}
    </li>
  )
}

