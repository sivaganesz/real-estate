/**
 * Sales Manager Today (master prompt §6, ROLE_RESEARCH §5.2): the unassigned queue with the AI-suggested executive,
 * per-row assign and Auto-assign all; the team board; needs-attention items (escalations, missed post-visit calls,
 * high-value leads untouched, the on-leave reassign proposal); stalled and negotiation deals; overdue follow-ups by
 * executive; today's team visits coloured by executive; and the team target gauges with the funnel.
 */
import { useMemo, useState, type ReactNode } from 'react'
import {
  AlarmClock, AlertTriangle, ArrowUpRight, Building2, ChevronDown, Crown, Hand, Handshake, Inbox, PhoneMissed, Shuffle,
  Sparkles, UserMinus, Users, Wand2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { paths } from '@/app/paths'
import { AISuggestionChip } from '@/components/ai/ai-suggestion-chip'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { AssignDialog } from '@/components/domain/assign-dialog'
import { EmptyLeads, EmptyPipeline, EmptyTasks } from '@/components/illustrations'
import { DotBadge, ToneBadge } from '@/components/shared/badges'
import { FunnelChart } from '@/components/shared/charts/funnel-chart'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { Gauge } from '@/components/shared/gauge'
import { IconTile } from '@/components/shared/icon-tile'
import { SectionCard } from '@/components/shared/section-card'
import { Segmented } from '@/components/shared/segmented'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { DB, ID, Lead } from '@/domain/types'
import { usePermission } from '@/hooks/use-permission'
import { firstName, fmtDateTime, inrShort } from '@/lib/format'
import { agingOf } from '@/lib/stalled'
import { availabilityTone, stageTone, temperatureTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { assignableUsers, assignLead, assignLeads, previewAuto } from '@/services/assignments'
import { activeLeadCount } from '@/services/queries/lookups'
import { managerToday, openLeadIdsOf, type ManagerToday } from '@/services/queries/today'
import { greetingKey, managerBrief } from '../lib/brief'
import { splitMins } from '../lib/slots'
import { AIQuickCommand } from './ai-quick-command'
import { AppointmentsTimeline } from './appointments-timeline'
import { TodayHero } from './today-hero'
import { useToday } from './use-today'
import { ModuleAssistant } from '@/components/ai/module-assistant'

export function ManagerView() {
  const { t } = useTranslation('today')
  const { data, db, user, now } = useToday(managerToday)
  const [autoOpen, setAutoOpen] = useState(false)
  const ownerColor = useMemo(() => new Map<ID, number>(data.team.map((r, i) => [r.user.id, i])), [data.team])
  const brief = managerBrief({
    unassigned: data.unassigned.length, overdue: data.overdueTasks.length, visits: data.visits.length,
    stalled: data.stalled.length, onLeave: data.attention.onLeave.length, escalations: data.attention.escalations.length,
  })
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const leave = data.attention.onLeave[0]
  const suggestions = [
    { label: t('assistant.chips.assign'), command: 'Auto-assign the new leads' },
    { label: t('assistant.chips.overloaded'), command: 'Who is overloaded today?' },
    ...(leave ? [{ label: t('assistant.chips.reassign', { name: firstName(leave.user.name) }), command: `Reassign ${firstName(leave.user.name)}'s leads, he's on leave` }] : []),
    { label: t('assistant.chips.teamWeek'), command: 'Summarise team performance this week' },
  ]
  return (
    <div className="flex flex-col gap-6" data-testid="today-manager">
      <TodayHero
        now={now} name={firstName(user.name)} greeting={greetingKey(now)}
        brief={brief.map((p, i) => <span key={p.key}>{i > 0 && ' '}{t(p.key, p.params)}</span>)}
        chips={<>
          {data.unassigned.length > 0 && <AISuggestionChip onClick={() => setAutoOpen(true)}>{t('manager.chips.autoAssign', { count: data.unassigned.length })}</AISuggestionChip>}
          {leave && <AISuggestionChip onClick={() => scrollTo('today-attention')}>{t('manager.chips.reassign', { name: firstName(leave.user.name), count: leave.openLeads })}</AISuggestionChip>}
          {data.stalled.length > 0 && <AISuggestionChip onClick={() => scrollTo('today-deals')}>{t('manager.chips.stalled', { count: data.stalled.length })}</AISuggestionChip>}
        </>}
        stats={[
          { key: 'unassigned', label: t('manager.stats.unassigned'), value: data.unassigned.length, icon: Inbox, tone: data.unassigned.length ? 'danger' : 'neutral', onClick: () => scrollTo('today-queue'), testId: 'hero-unassigned' },
          { key: 'overdue', label: t('manager.stats.overdue'), value: data.overdueTasks.length, icon: AlarmClock, tone: data.overdueTasks.length ? 'warning' : 'neutral', onClick: () => scrollTo('today-overdue') },
          { key: 'visits', label: t('manager.stats.visits'), value: data.visits.length, icon: Building2, tone: 'info', onClick: () => scrollTo('today-team-visits') },
          { key: 'calls', label: t('manager.stats.calls'), value: data.teamToday.calls, icon: Users, tone: 'primary' },
        ]}
        assistant={<AIQuickCommand suggestions={suggestions} />}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-7">
          <UnassignedQueue data={data} db={db} onAutoAll={() => setAutoOpen(true)} />
          <AttentionCard data={data} db={db} now={now} />
          <DealsCard data={data} db={db} now={now} />
        </div>
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-5">
          <TeamBoard data={data} db={db} />
          <OverdueByExec data={data} db={db} />
          <div id="today-team-visits" className="scroll-mt-24">
            <AppointmentsTimeline appointments={data.visits} db={db} now={now} ownerColor={ownerColor} canPlan={false} title={t('manager.visits.title')} description={t('manager.visits.subtitle', { count: data.visits.length })} />
          </div>
          <TeamTargets data={data} />
          <ModuleAssistant module="insights" scope="team" />
        </div>
      </div>
      <AutoAssignConfirm open={autoOpen} onOpenChange={setAutoOpen} ids={data.unassigned.map((u) => u.lead.id)} db={db} />
    </div>
  )
}

/* ---------- auto-assign all (preview, confirm, undo) ---------- */

function AutoAssignConfirm({ open, onOpenChange, ids, db }: { open: boolean; onOpenChange: (o: boolean) => void; ids: ID[]; db: DB }) {
  const { t } = useTranslation(['today', 'catalogue'])
  const { user } = usePermission()
  const preview = useMemo(() => (open ? previewAuto(db, ids, user) : []), [open, db, ids, user])
  const run = () => {
    try {
      const { result, undoToken } = assignLeads(ids, 'auto')
      const done = result.filter((r) => r.to).length
      toastUndo(t('today:toast.autoAssigned', { count: done }), undoToken, { description: result.length > done ? t('today:toast.leftUnassigned', { count: result.length - done }) : undefined })
    } catch (e) {
      toastError(e)
    }
  }
  return (
    <ConfirmDialog
      open={open} onOpenChange={onOpenChange} onConfirm={run}
      title={t('today:manager.auto.title', { count: ids.length })}
      description={t('today:manager.auto.body')}
      confirmLabel={t('today:manager.auto.confirm', { count: ids.length })}
    >
      <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto" data-testid="auto-preview">
        {preview.map((p) => {
          const lead = db.leads.find((l) => l.id === p.leadId)
          const to = db.users.find((u) => u.id === p.to)
          return (
            <li key={p.leadId} className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate">{lead?.name}</span>
              <span aria-hidden="true">→</span>
              {to ? <span className="inline-flex items-center gap-1.5"><UserAvatar name={to.name} size="xs" />{firstName(to.name)}</span> : <span className="text-muted-foreground">{t('today:manager.queue.nobody')}</span>}
              <span className="hidden text-meta text-ai sm:inline">{t(`catalogue:assignmentReason.${p.reasonKey}`)}</span>
            </li>
          )
        })}
      </ul>
      <div className="flex justify-end"><DemoAIBadge mode="simulated" /></div>
    </ConfirmDialog>
  )
}

/* ---------- unassigned queue ---------- */

function UnassignedQueue({ data, db, onAutoAll }: { data: ManagerToday; db: DB; onAutoAll: () => void }) {
  const { t } = useTranslation(['today', 'catalogue'])
  const { can, user } = usePermission()
  const pool = useMemo(() => assignableUsers(db, user), [db, user])
  /** A person (picked from the menu, recorded as manual) or 'auto' (the accepted suggestion: the engine runs, so the history keeps its reason). */
  const assign = (lead: Lead, to: ID | 'auto') => {
    try {
      const { result, undoToken } = assignLead(lead.id, to)
      const name = db.users.find((u) => u.id === result[0]?.to)?.name
      if (name) toastUndo(t('today:toast.assigned', { name: lead.name, to: name }), undoToken)
      else toast.message(t('today:toast.leftUnassigned', { count: 1 }))
    } catch (e) {
      toastError(e)
    }
  }
  const mayAssign = can('lead.assign')
  return (
    <SectionCard
      id="today-queue" title={t('today:manager.queue.title')} icon={Inbox} data-testid="unassigned-queue"
      description={t('today:manager.queue.subtitle', { count: data.unassigned.length, auto: data.autoAssignedToday })}
      action={data.unassigned.length > 0 && mayAssign ? <Button size="sm" onClick={onAutoAll} data-testid="auto-assign-all"><Wand2 />{t('today:manager.queue.autoAll')}</Button> : undefined}
    >
      {data.unassigned.length === 0 ? (
        <EmptyState compact illustration={EmptyLeads} title={t('today:manager.queue.emptyTitle')} body={t('today:manager.queue.emptyBody')} />
      ) : (
        <>
          <div className="mb-2 flex items-center justify-end gap-2 text-meta text-muted-foreground"><Sparkles className="size-3.5 text-ai" aria-hidden="true" />{t('today:manager.queue.aiNote')}<DemoAIBadge mode="simulated" /></div>
          <ul className="flex flex-col divide-y divide-border/70">
            {data.unassigned.map(({ lead, suggestion, ageMins, breached }) => {
              const sug = db.users.find((u) => u.id === suggestion?.to)
              const age = splitMins(ageMins)
              return (
                <li key={lead.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 md:flex-row md:items-center md:gap-3" data-testid="queue-row">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={paths.lead(lead.id)} className="truncate text-sm font-semibold hover:underline">{lead.name}</Link>
                      <ToneBadge tone={breached ? 'danger' : 'warning'} icon={AlarmClock}>
                        {age.d ? t('today:due.days', { count: age.d }) : age.h ? t('today:due.hours', { h: age.h, m: age.m }) : t('today:due.mins', { count: age.m })}
                      </ToneBadge>
                    </div>
                    <p className="mt-0.5 truncate text-meta text-muted-foreground">
                      {[t(`catalogue:source.${lead.source}`), lead.requirement.localities[0] ?? lead.requirement.cities[0], lead.requirement.budgetMax ? inrShort(lead.requirement.budgetMax) : null].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {mayAssign && (
                    <div className="flex flex-wrap items-center gap-2">
                      {sug ? (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-ai-soft px-2 py-1 text-meta text-ai" title={t(`catalogue:assignmentReason.${suggestion!.reasonKey}`)}>
                          <Sparkles className="size-3" aria-hidden="true" /><UserAvatar name={sug.name} size="xs" />
                          <span className="font-medium">{firstName(sug.name)}</span>
                          <span className="hidden text-ai/80 xl:inline">· {t(`catalogue:assignmentReason.${suggestion!.reasonKey}`)}</span>
                        </span>
                      ) : <span className="text-meta text-muted-foreground">{t('today:manager.queue.nobody')}</span>}
                      <div className="flex">
                        {sug && <Button size="sm" variant="secondary" className="rounded-r-none" onClick={() => assign(lead, 'auto')} data-testid="assign-suggested">{t('today:manager.queue.assign')}</Button>}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size={sug ? 'icon-sm' : 'sm'} variant="secondary" className={cn('h-8', sug && 'rounded-l-none border-l-0')} aria-label={t('today:manager.queue.choose')}>
                              {!sug && t('today:manager.queue.choose')}<ChevronDown />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-60">
                            <DropdownMenuLabel>{t('today:manager.queue.assignTo')}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {pool.map((u) => (
                              <DropdownMenuItem key={u.id} onSelect={() => assign(lead, u.id)}>
                                <UserAvatar name={u.name} size="xs" availability={u.availability} />
                                <span className="flex-1 truncate">{u.name}</span>
                                <span className="text-meta text-muted-foreground tabular-nums">{t('today:manager.queue.load', { count: activeLeadCount(db, u.id) })}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </SectionCard>
  )
}

/* ---------- team board ---------- */

function TeamBoard({ data, db }: { data: ManagerToday; db: DB }) {
  const { t } = useTranslation(['today', 'common'])
  const { can } = usePermission()
  const top = Math.max(1, ...data.team.map((r) => r.openLeads))
  const temps = (id: ID) => {
    const c = { hot: 0, warm: 0, cold: 0 }
    for (const l of db.leads) if (l.ownerId === id && data.scores.has(l.id)) c[l.temperatureOverride ?? data.scores.get(l.id)!.temperature]++
    return c
  }
  return (
    <SectionCard title={t('today:manager.team.title')} description={t('today:manager.team.subtitle')} icon={Users} data-testid="team-board"
      action={can('team.view') ? <Button asChild size="sm" variant="ghost"><Link to={paths.team()}>{t('today:manager.team.view')}<ArrowUpRight /></Link></Button> : undefined}
    >
      <ul className="flex flex-col gap-4">
        {data.team.filter((r) => r.user.status === 'active' || r.openLeads > 0).map((r) => {
          const c = temps(r.user.id)
          const seg = (n: number) => `${(n / top) * 100}%`
          return (
            <li key={r.user.id} className="flex flex-col gap-2" data-testid="team-row">
              <div className="flex items-center gap-2.5">
                <UserAvatar name={r.user.name} size="sm" availability={r.user.availability} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{can('team.view') ? <Link to={paths.teamMember(r.user.id)} className="hover:underline">{r.user.name}</Link> : r.user.name}</p>
                  <p className="flex items-center gap-1.5 text-meta text-muted-foreground">
                    <span aria-hidden="true" className={cn('size-1.5 rounded-full', r.user.status === 'deactivated' ? 'bg-danger' : availabilityTone[r.user.availability].solid)} />
                    {r.user.status === 'deactivated' ? t('today:manager.team.deactivated') : t(`common:availability.${r.user.availability}`)}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums">{t('today:manager.team.open', { count: r.openLeads })}</span>
              </div>
              <span role="img" aria-label={t('today:manager.team.loadAria', { name: r.user.name, count: r.openLeads })} className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                <span className={temperatureTone.hot.solid} style={{ width: seg(c.hot) }} />
                <span className={temperatureTone.warm.solid} style={{ width: seg(c.warm) }} />
                <span className={temperatureTone.cold.solid} style={{ width: seg(c.cold) }} />
              </span>
              <div className="flex flex-wrap gap-1.5">
                <ToneBadge tone="primary">{t('today:manager.team.calls', { count: r.callsToday })}</ToneBadge>
                <ToneBadge tone="info">{t('today:manager.team.visits', { count: r.visitsToday })}</ToneBadge>
                <ToneBadge tone={r.overdue ? 'danger' : 'neutral'}>{t('today:manager.team.overdue', { count: r.overdue })}</ToneBadge>
                {r.slaBreaches > 0 && <ToneBadge tone="danger" icon={AlertTriangle}>{t('today:manager.team.breaches', { count: r.slaBreaches })}</ToneBadge>}
              </div>
            </li>
          )
        })}
      </ul>
    </SectionCard>
  )
}

/* ---------- needs attention ---------- */

function AttentionCard({ data, db, now }: { data: ManagerToday; db: DB; now: Date }) {
  const { t, i18n } = useTranslation('today')
  const { can } = usePermission()
  const [assignIds, setAssignIds] = useState<ID[] | null>(null)
  const a = data.attention
  const reassignAuto = (userId: ID, name: string) => {
    try {
      const ids = openLeadIdsOf(db, userId)
      const { result, undoToken } = assignLeads(ids, 'auto')
      toastUndo(t('toast.reassigned', { count: result.filter((r) => r.to).length, name }), undoToken)
    } catch (e) {
      toastError(e)
    }
  }
  const owner = (id: ID | null) => db.users.find((u) => u.id === id)?.name ?? ''
  const rows: { key: string; icon: typeof AlarmClock; tone: 'danger' | 'warning' | 'violet' | 'info'; title: string; body: string; lead?: Lead; action?: ReactNode }[] = []
  for (const r of a.reassignRequests) {
    rows.push({ key: `rr-${r.lead.id}`, icon: Hand, tone: 'info', lead: r.lead, title: t('manager.attention.reassignRequest', { name: r.lead.name, owner: r.from }), body: r.note ? t('manager.attention.reassignRequestBody', { note: r.note }) : t('manager.attention.reassignRequestNoNote') })
  }
  for (const l of a.escalations) {
    const mins = Math.floor((now.getTime() - new Date(l.createdAt).getTime()) / 60_000)
    const s = splitMins(mins)
    rows.push({ key: `esc-${l.id}`, icon: PhoneMissed, tone: 'danger', lead: l, title: t('manager.attention.escalation', { name: l.name }), body: t('manager.attention.escalationBody', { owner: owner(l.ownerId), time: s.d ? t('due.days', { count: s.d }) : t('due.hours', { h: s.h, m: s.m }) }) })
  }
  for (const task of a.missedPostVisit) {
    const l = db.leads.find((x) => x.id === task.leadId)
    rows.push({ key: `pv-${task.id}`, icon: AlarmClock, tone: 'warning', lead: l, title: t('manager.attention.postVisit', { name: l?.name ?? task.title }), body: t('manager.attention.postVisitBody', { owner: owner(task.ownerId), when: fmtDateTime(task.dueAt, i18n.language) }) })
  }
  for (const l of a.highValueUntouched) {
    rows.push({ key: `hv-${l.id}`, icon: Crown, tone: 'violet', lead: l, title: t('manager.attention.highValue', { name: l.name, budget: inrShort(l.requirement.budgetMax) }), body: l.ownerId ? t('manager.attention.highValueBody', { owner: owner(l.ownerId) }) : t('manager.attention.highValueQueue') })
  }
  const proposals = [...a.onLeave.map((r) => ({ r, kind: 'leave' as const })), ...a.deactivatedOwners.map((r) => ({ r, kind: 'deactivated' as const }))]
  const empty = !rows.length && !proposals.length
  return (
    <SectionCard id="today-attention" title={t('manager.attention.title')} icon={AlertTriangle} data-testid="attention-card">
      {empty ? (
        <EmptyState compact illustration={EmptyTasks} title={t('manager.attention.emptyTitle')} body={t('manager.attention.emptyBody')} />
      ) : (
        <div className="flex flex-col gap-3">
          {proposals.map(({ r, kind }) => (
            <article key={r.user.id} className="flex flex-col gap-2 rounded-xl border border-ai-border bg-ai-soft/40 p-3 sm:flex-row sm:items-center" data-testid="leave-proposal">
              <IconTile icon={kind === 'leave' ? UserMinus : Shuffle} tone="ai" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t(`manager.attention.${kind}`, { name: r.user.name, count: r.openLeads })}</p>
                <p className="text-meta text-muted-foreground">{t('manager.attention.proposalBody')}</p>
              </div>
              <div className="flex items-center gap-2">
                <DemoAIBadge mode="simulated" />
                {can('lead.assign') && <Button size="sm" variant="ai" onClick={() => reassignAuto(r.user.id, r.user.name)}><Wand2 />{t('manager.attention.reassign')}</Button>}
              </div>
            </article>
          ))}
          {rows.length > 0 && (
            <ul className="flex flex-col divide-y divide-border/70">
              {rows.slice(0, 8).map((row) => (
                <li key={row.key} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <IconTile icon={row.icon} tone={row.tone} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{row.lead ? <Link to={paths.lead(row.lead.id)} className="hover:underline">{row.title}</Link> : row.title}</p>
                    <p className="truncate text-meta text-muted-foreground">{row.body}</p>
                  </div>
                  {row.lead && can('lead.assign', row.lead) && (
                    <Button size="sm" variant="ghost" onClick={() => setAssignIds([row.lead!.id])}>{t(row.lead.ownerId ? 'manager.attention.assign' : 'manager.attention.assignNew')}</Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {assignIds && <AssignDialog open onOpenChange={(o) => { if (!o) setAssignIds(null) }} leadIds={assignIds} />}
    </SectionCard>
  )
}

/* ---------- stalled and negotiation deals ---------- */

function DealsCard({ data, db, now }: { data: ManagerToday; db: DB; now: Date }) {
  const { t } = useTranslation(['today', 'catalogue'])
  const [tab, setTab] = useState<'stalled' | 'negotiation'>(data.stalled.length ? 'stalled' : 'negotiation')
  const list = tab === 'stalled' ? data.stalled : data.negotiation
  const navigate = useNavigate()
  return (
    <SectionCard id="today-deals" title={t('today:manager.deals.title')} icon={Handshake} data-testid="deals-card" bodyClassName="flex flex-col gap-3"
      action={<Button size="sm" variant="ghost" onClick={() => navigate(paths.pipeline())}>{t('today:manager.deals.pipeline')}<ArrowUpRight /></Button>}
    >
      <Segmented label={t('today:manager.deals.title')} value={tab} onChange={setTab} segments={[
        { value: 'stalled', label: t('today:manager.deals.stalled'), count: data.stalled.length },
        { value: 'negotiation', label: t('today:manager.deals.negotiation'), count: data.negotiation.length },
      ]} />
      {list.length === 0 ? (
        <EmptyState compact illustration={EmptyPipeline} title={t(`today:manager.deals.empty.${tab}`)} />
      ) : (
        <ul className="flex flex-col divide-y divide-border/70">
          {list.slice(0, 6).map((l) => {
            const age = agingOf(l, db.settings, now)
            const owner = db.users.find((u) => u.id === l.ownerId)
            return (
              <li key={l.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0" data-testid="deal-row">
                <div className="min-w-0 flex-1">
                  <Link to={paths.lead(l.id)} className="block truncate text-sm font-medium hover:underline">{l.name}</Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <DotBadge classes={stageTone[l.stage]}>{t(`catalogue:stage.${l.stage}`)}</DotBadge>
                    <ToneBadge tone={age.tone === 'danger' ? 'danger' : age.tone === 'warning' ? 'warning' : 'neutral'}>{t('today:manager.deals.days', { count: age.days })}</ToneBadge>
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums">{inrShort(l.deal?.value ?? l.requirement.budgetMax)}</span>
                {owner && <UserAvatar name={owner.name} size="xs" />}
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
}

/* ---------- overdue by executive ---------- */

function OverdueByExec({ data, db }: { data: ManagerToday; db: DB }) {
  const { t, i18n } = useTranslation('today')
  const [open, setOpen] = useState<ID | null>(null)
  const top = Math.max(1, ...data.overdueByExec.map((x) => x.count))
  return (
    <SectionCard id="today-overdue" title={t('manager.overdue.title')} description={t('manager.overdue.subtitle', { count: data.overdueTasks.length })} icon={AlarmClock} data-testid="overdue-by-exec"
      action={<Button asChild size="sm" variant="ghost"><Link to={paths.tasks()}>{t('manager.overdue.all')}<ArrowUpRight /></Link></Button>}
    >
      {data.overdueByExec.length === 0 ? (
        <EmptyState compact illustration={EmptyTasks} title={t('manager.overdue.emptyTitle')} />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.overdueByExec.map((x) => {
            const u = db.users.find((y) => y.id === x.userId)
            const expanded = open === x.userId
            return (
              <li key={x.userId}>
                <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : x.userId)} className="grid w-full grid-cols-[auto_6rem_1fr_auto] items-center gap-2.5 rounded-md p-1 text-left hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                  <UserAvatar name={u?.name ?? ''} size="xs" />
                  <span className="truncate text-sm">{firstName(u?.name ?? '')}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-danger" style={{ width: `${(x.count / top) * 100}%` }} /></span>
                  <span className="flex items-center gap-1 text-sm font-semibold tabular-nums">{x.count}<ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform', expanded && 'rotate-180')} aria-hidden="true" /></span>
                </button>
                {expanded && (
                  <ul className="mt-1 ml-8 flex flex-col gap-1 border-l pl-3">
                    {x.tasks.slice(0, 5).map((task) => {
                      const l = db.leads.find((y) => y.id === task.leadId)
                      return (
                        <li key={task.id} className="text-meta">
                          {l ? <Link to={paths.lead(l.id)} className="font-medium hover:underline">{l.name}</Link> : <span className="font-medium">{task.title}</span>}
                          <span className="text-muted-foreground"> · {task.title} · {fmtDateTime(task.dueAt, i18n.language)}</span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
}

/* ---------- team targets and funnel ---------- */

function TeamTargets({ data }: { data: ManagerToday }) {
  const { t } = useTranslation('today')
  const navigate = useNavigate()
  const b = data.targets.bookings
  const r = data.targets.revenue
  return (
    <SectionCard title={t('manager.targets.title')} description={t('manager.targets.subtitle')} data-testid="team-targets">
      <div className="grid grid-cols-2 place-items-center gap-2">
        <Gauge value={b.done} max={b.target} size={140} label={t('manager.targets.bookings')} valueLabel={`${b.done}/${b.target}`} caption={t('manager.targets.bookings')} />
        <Gauge value={r.done} max={r.target} size={140} label={t('manager.targets.revenue')} valueLabel={inrShort(r.done)} caption={t('manager.targets.revenueOf', { target: inrShort(r.target) })} />
      </div>
      <div className="mt-4 border-t pt-4">
        <p className="mb-2 text-meta font-medium text-muted-foreground">{t('manager.targets.funnel')}</p>
        <FunnelChart
          label={t('manager.targets.funnel')}
          steps={data.funnel.filter((f) => f.stage !== 'converted').map((f, i, all) => ({ stage: f.stage, count: f.reached, dropOffPct: i > 0 ? all[i - 1].dropOffPct : undefined }))}
          onStageClick={(stage) => navigate(paths.pipeline({ stage }))}
        />
      </div>
    </SectionCard>
  )
}
