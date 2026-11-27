/**
 * Team (master prompt §5, §10; ROLE_RESEARCH #12, #13, #15, #21). Admin sees everyone, a manager their own team.
 * KPI strip (people, open load, unassigned queue, conversion, overdue), workload bars, an on-leave hand-over prompt,
 * the simulated team insight (Demo AI), one card per executive (availability, load, follow-ups, visits, conversion,
 * targets) and, for admins, everyone else (managers, admins, deactivated) with add / edit / activate / deactivate.
 */
import { useMemo, useState } from 'react'
import { AlarmClock, Inbox, Loader2, Percent, Plane, Plus, Sparkles, UserPlus, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { useAI } from '@/ai'
import type { AIText } from '@/ai/types'
import { paths } from '@/app/paths'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { AssignDialog } from '@/components/domain/assign-dialog'
import { EntityLink } from '@/components/domain/entity-link'
import { EmptyTeam } from '@/components/illustrations'
import { Callout } from '@/components/shared/callout'
import { EmptyState } from '@/components/shared/empty-state'
import { KpiCard } from '@/components/shared/kpi-card'
import { PageHeader } from '@/components/shared/page-header'
import { SectionCard } from '@/components/shared/section-card'
import { toastError } from '@/components/shared/undo-toast'
import { UserAvatar } from '@/components/shared/user-avatar'
import { WorkloadBars, WorkloadLegend } from '@/components/shared/workload-bar'
import { Button } from '@/components/ui/button'
import type { ID, User } from '@/domain/types'
import { useWholeDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { assigneeStatsFromDb, openLeadsOf } from '@/lib/assignment'
import { addDaysToDay, localDay } from '@/lib/dates'
import { phoneDisplay } from '@/lib/phone'
import { roleTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { unassignedLeadIds } from '@/services/assignments'
import { targetProgress } from '@/services/queries/stats'
import { AvailabilityBadge } from '../components/availability-control'
import { ExecCard } from '../components/exec-card'
import { UserActions } from '../components/user-actions'
import { UserFormDrawer } from '../components/user-form-drawer'

export default function TeamPage() {
  const { t } = useTranslation(['team', 'common'])
  const db = useWholeDb()
  const now = useNow()
  const navigate = useNavigate()
  const { can, user: me } = usePermission()
  const { ai, context } = useAI()
  const [adding, setAdding] = useState(false)
  const [assignIds, setAssignIds] = useState<ID[] | null>(null)
  const [insight, setInsight] = useState<AIText | null>(null)
  const [thinking, setThinking] = useState(false)

  const members = useMemo(() => db.users.filter((u) => can('team.view', { ownerId: u.id })), [db.users, can])
  const execs = useMemo(() => members.filter((u) => u.role === 'executive' && u.status === 'active').sort((a, b) => a.name.localeCompare(b.name)), [members])
  const others = useMemo(() => members.filter((u) => u.role !== 'executive' || u.status !== 'active')
    .sort((a, b) => Number(a.status === 'deactivated') - Number(b.status === 'deactivated') || a.role.localeCompare(b.role) || a.name.localeCompare(b.name)), [members])
  const stats = useMemo(() => assigneeStatsFromDb(db, execs.map((u) => u.id), now), [db, execs, now])
  const top = Math.max(1, ...execs.map((u) => stats[u.id]?.active ?? 0))
  const unassigned = useMemo(() => (can('lead.assign') ? unassignedLeadIds(db, me) : []), [db, me, can])
  const onLeave = execs.filter((u) => u.availability === 'onLeave').map((u) => ({ user: u, leads: openLeadsOf(db.leads, u.id) })).filter((x) => x.leads.length)

  const totals = execs.reduce((acc, u) => {
    const s = stats[u.id]
    if (!s) return acc
    acc.active += s.active
    acc.overdue += s.overdue
    acc.followUps += s.pendingFollowUps
    return acc
  }, { active: 0, overdue: 0, followUps: 0 })
  const teamIds = new Set(execs.map((u) => u.id))
  const closed = db.leads.filter((l) => { const o = l.ownerId ?? l.firstOwnerId; return !!o && teamIds.has(o) && (l.stage === 'booked' || l.stage === 'converted' || l.stage === 'lost') })
  const conversion = closed.length ? Math.round((closed.filter((l) => l.stage !== 'lost').length / closed.length) * 100) : 0
  const today = localDay(now)
  const spark = Array.from({ length: 14 }, (_, i) => {
    const day = addDaysToDay(today, i - 13)
    return db.leads.filter((l) => localDay(l.createdAt) === day && (!l.ownerId || teamIds.has(l.ownerId))).length
  })
  const available = execs.filter((u) => u.availability !== 'onLeave').length

  const askInsight = async () => {
    setThinking(true)
    try {
      setInsight(await ai.insights('team', context()))
    } catch (e) {
      toastError(e)
    } finally {
      setThinking(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('team:title')} subtitle={t('team:subtitle')}
        actions={(
          <>
            <Button variant="ai-outline" onClick={askInsight} disabled={thinking} aria-busy={thinking} data-testid="team-insight">
              {thinking ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
              {t('team:insight.button')}
            </Button>
            {can('user.manage') && (
              <Button onClick={() => setAdding(true)} data-testid="add-user"><UserPlus aria-hidden="true" />{t('team:addUser')}</Button>
            )}
          </>
        )}
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard label={t('team:kpi.people')} value={execs.length} icon={UsersRound} tone="primary" hint={t('team:kpi.peopleHint', { available, onLeave: execs.length - available })} />
        <KpiCard label={t('team:kpi.open')} value={totals.active} icon={Inbox} tone="info" spark={spark} hint={t('team:kpi.openHint')} to={paths.leads()} />
        {can('lead.assign') ? (
          <KpiCard
            label={t('team:kpi.unassigned')} value={unassigned.length} icon={Plus} tone={unassigned.length ? 'warning' : 'success'}
            hint={unassigned.length ? t('team:kpi.unassignedHint') : t('team:kpi.unassignedNone')}
            onClick={unassigned.length ? () => setAssignIds(unassigned) : undefined} className="flex flex-col justify-start"
          />
        ) : (
          <KpiCard label={t('team:kpi.followUps')} value={totals.followUps} icon={AlarmClock} tone="info" />
        )}
        <KpiCard
          label={t('team:kpi.conversion')} value={`${conversion}%`} icon={Percent} tone="success"
          ring={{ value: conversion, label: t('team:kpi.conversion') }} hint={t('team:kpi.overdue', { count: totals.overdue })}
        />
      </div>

      {onLeave.map(({ user, leads }) => (
        <Callout
          key={user.id} tone="warning" icon={Plane}
          title={t('team:leave.title', { name: user.name, count: leads.length })}
          action={can('lead.assign') ? <Button size="sm" variant="secondary" onClick={() => setAssignIds(leads.map((l) => l.id))} data-testid={`leave-reassign-${user.id}`}>{t('team:leave.reassign', { count: leads.length })}</Button> : undefined}
        >
          {t('team:leave.body')}
        </Callout>
      ))}

      {insight && (
        <section className="flex flex-col gap-2 rounded-xl border border-ai-border bg-ai-soft/30 p-4" aria-label={t('team:insight.title')} data-testid="team-insight-card">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex size-7 items-center justify-center rounded-md bg-ai-gradient text-ai-foreground"><Sparkles className="size-4" aria-hidden="true" /></span>
            <h2 className="text-sm font-semibold">{t('team:insight.title')}</h2>
            <DemoAIBadge mode={insight.mode} />
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setInsight(null)}>{t('common:actions.close')}</Button>
          </div>
          <p className="text-sm">{insight.text}</p>
          {insight.bullets && insight.bullets.length > 0 && <ul className="ml-5 list-disc text-sm text-foreground/90">{insight.bullets.map((b) => <li key={b}>{b}</li>)}</ul>}
          {insight.links && insight.links.length > 0 && <p className="flex flex-wrap gap-3 text-sm">{insight.links.map((r) => <EntityLink key={`${r.kind}-${r.id}`} refTo={r} />)}</p>}
        </section>
      )}

      {execs.length === 0 ? (
        <section className="rounded-lg border bg-card shadow-card">
          <EmptyState
            illustration={EmptyTeam} title={t('team:empty.title')} body={t('team:empty.body')}
            primary={can('user.manage') ? <Button onClick={() => setAdding(true)}><UserPlus aria-hidden="true" />{t('team:addUser')}</Button> : undefined}
          />
        </section>
      ) : (
        <>
          <SectionCard title={t('team:workload.title')} description={t('team:workload.subtitle')} action={<WorkloadLegend />}>
            <WorkloadBars
              max={top} onSelect={(id) => navigate(paths.teamMember(id))}
              rows={execs.map((u) => ({
                id: u.id, name: u.name, availability: u.availability, hot: stats[u.id]?.hot ?? 0, warm: stats[u.id]?.warm ?? 0, cold: stats[u.id]?.cold ?? 0,
                extra: (stats[u.id]?.overdue ?? 0) > 0 ? <span className="text-meta font-medium text-danger">{t('team:card.overdueShort', { count: stats[u.id].overdue })}</span> : undefined,
              }))}
            />
          </SectionCard>

          <section aria-label={t('team:execs')} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">{t('team:execs')}</h2>
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {execs.map((u) => <ExecCard key={u.id} user={u} stats={stats[u.id]} progress={targetProgress(db, u, now)} top={top} />)}
            </div>
          </section>
        </>
      )}

      {others.length > 0 && (
        <SectionCard title={t('team:people.title')} description={t('team:people.subtitle')} icon={UsersRound}>
          <ul className="flex flex-col divide-y">
            {others.map((u) => <PersonRow key={u.id} user={u} reports={db.users.filter((x) => x.managerId === u.id && x.status === 'active').length} />)}
          </ul>
        </SectionCard>
      )}

      {adding && <UserFormDrawer open={adding} onOpenChange={setAdding} onSaved={(id) => navigate(paths.teamMember(id))} />}
      {assignIds && <AssignDialog open={!!assignIds} onOpenChange={(o) => !o && setAssignIds(null)} leadIds={assignIds} />}
    </div>
  )
}

function PersonRow({ user, reports }: { user: User; reports: number }) {
  const { t } = useTranslation(['team', 'common'])
  const off = user.status === 'deactivated'
  return (
    <li className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 py-3', off && 'opacity-70')} data-testid={`person-${user.id}`}>
      <UserAvatar name={user.name} size="md" role={user.role} />
      <div className="min-w-40 flex-1">
        <Link to={paths.teamMember(user.id)} className="block truncate text-sm font-medium hover:text-primary hover:underline">{user.name}</Link>
        <p className="truncate text-meta text-muted-foreground">{user.email} · {phoneDisplay(user.phone)}</p>
      </div>
      <span className={cn('inline-flex h-6 items-center rounded-full px-2.5 text-meta font-medium', roleTone[user.role].soft, roleTone[user.role].text)}>{t(`common:roles.${user.role}`)}</span>
      {user.role === 'manager' && <span className="text-meta text-muted-foreground">{t('team:people.reports', { count: reports })}</span>}
      {off ? <span className="inline-flex h-6 items-center rounded-full bg-neutral-soft px-2.5 text-meta font-medium text-neutral">{t('team:status.deactivated')}</span> : <AvailabilityBadge user={user} />}
      <UserActions user={user} />
    </li>
  )
}
