/**
 * Lead page tabs (plan §8.3 M2): Activity (a composer — log a call, WhatsApp or note in one line — and the timeline),
 * Matches (ranked properties with Shortlist / Share on WhatsApp / Schedule visit / Not interested), Appointments,
 * Tasks and the Assignment history (who, when, why, auto / manual).
 */
import { useMemo, useState } from 'react'
import { ArrowRight, CalendarPlus, ListPlus, MessageCircle, NotebookPen, Phone, Sparkles, Target } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { paths } from '@/app/paths'
import { ActivityTimeline } from '@/components/domain/activity-timeline'
import { AppointmentCard } from '@/components/domain/appointment-card'
import { MatchList } from '@/components/domain/match-list'
import { TaskRow } from '@/components/domain/task-row'
import { EmptyCalendar, EmptyTasks, EmptyActivity } from '@/components/illustrations'
import { EmptyState } from '@/components/shared/empty-state'
import { Segmented } from '@/components/shared/segmented'
import { UserAvatar } from '@/components/shared/user-avatar'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { Lead, Task } from '@/domain/types'
import { isOpenStage } from '@/domain/catalogue'
import { useWholeDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { fmtDateTime } from '@/lib/format'
import { addNote, logContact } from '@/services/activities'
import { markNotInterested, matchesForLead, shareProperties, shortlistProperty } from '@/services/matching'
import { appointmentsForLead, assignmentsForLead } from '@/services/queries/lookups'
import { useLeadDialogs } from './lead-dialogs-context'

export type LeadTabKey = 'activity' | 'matches' | 'appointments' | 'tasks' | 'assignments'

export function LeadTabs({ lead, tab, onTab }: { lead: Lead; tab: LeadTabKey; onTab: (t: LeadTabKey) => void }) {
  const { t } = useTranslation('leads')
  const db = useWholeDb()
  const now = useNow()
  const { matches } = useMemo(() => matchesForLead(db, lead.id, now), [db, lead.id, now])
  const appts = useMemo(() => appointmentsForLead(db, lead.id), [db, lead.id])
  const tasks = useMemo(() => db.tasks.filter((x) => x.leadId === lead.id).sort((a, b) => (a.status === b.status ? a.dueAt.localeCompare(b.dueAt) : a.status === 'open' ? -1 : 1)), [db.tasks, lead.id])
  const history = useMemo(() => assignmentsForLead(db, lead.id), [db, lead.id])
  const counts: Record<LeadTabKey, number | undefined> = {
    activity: undefined, matches: matches.length, appointments: appts.length, tasks: tasks.filter((x) => x.status === 'open').length, assignments: history.length,
  }
  return (
    <section aria-label={t('detail.tabs')} className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-card md:p-5" id="lead-tabs">
      <Segmented
        // the tabs wrap instead of hiding the last one when the main column is narrow (AI panel docked, 2xl three zones)
        label={t('detail.tabs')} value={tab} onChange={onTab} className="flex-wrap gap-y-1"
        segments={(['activity', 'matches', 'appointments', 'tasks', 'assignments'] as const).map((k) => ({ value: k, label: t(`detail.tab.${k}`), count: counts[k] }))}
      />
      {tab === 'activity' && <ActivityTab lead={lead} />}
      {tab === 'matches' && <MatchesTab lead={lead} matches={matches} />}
      {tab === 'appointments' && <AppointmentsTab lead={lead} appts={appts} />}
      {tab === 'tasks' && <TasksTab lead={lead} tasks={tasks} />}
      {tab === 'assignments' && <AssignmentsTab history={history} />}
    </section>
  )
}

function ActivityTab({ lead }: { lead: Lead }) {
  const { t } = useTranslation('leads')
  const { can } = usePermission()
  const [text, setText] = useState('')
  const edit = can('lead.edit', lead)
  const save = (kind: 'note' | 'call' | 'whatsapp') => {
    try {
      if (kind === 'note') addNote(lead.id, text)
      else logContact(lead.id, { channel: kind, result: kind === 'call' ? 'connected' : undefined, text: text.trim() || undefined })
      toast.success(t(`composer.saved.${kind}`))
      setText('')
    } catch (e) {
      toastError(e)
    }
  }
  return (
    <div className="flex flex-col gap-4">
      {edit && (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3" data-testid="activity-composer">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} className="bg-card" placeholder={t('composer.placeholder')} aria-label={t('composer.label')} />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => save('note')} disabled={!text.trim()} data-testid="composer-note"><NotebookPen />{t('composer.note')}</Button>
            <Button size="sm" variant="secondary" onClick={() => save('call')}><Phone />{t('composer.call')}</Button>
            <Button size="sm" variant="secondary" onClick={() => save('whatsapp')}><MessageCircle className="text-success" />{t('composer.whatsapp')}</Button>
            <span className="flex items-center gap-1 text-meta text-ai"><Sparkles className="size-3.5" aria-hidden="true" />{t('composer.aiHint')}</span>
          </div>
        </div>
      )}
      <ActivityTimeline refTo={{ kind: 'lead', id: lead.id }} limit={80} />
      <EmptyGuard lead={lead} />
    </div>
  )
}

/** The shared timeline renders nothing when empty; say so. */
function EmptyGuard({ lead }: { lead: Lead }) {
  const { t } = useTranslation('leads')
  const has = useWholeDb().activities.some((a) => a.refs.some((r) => r.kind === 'lead' && r.id === lead.id))
  return has ? null : <EmptyState compact illustration={EmptyActivity} title={t('detail.noActivity')} body={t('detail.noActivityBody')} />
}

function MatchesTab({ lead, matches }: { lead: Lead; matches: ReturnType<typeof matchesForLead>['matches'] }) {
  const { t } = useTranslation('leads')
  const { can } = usePermission()
  const dialogs = useLeadDialogs()
  const edit = can('lead.edit', lead) && isOpenStage(lead.stage)
  const act = (fn: () => { undoToken?: string } | void, msg: string) => {
    try {
      const r = fn()
      toastUndo(msg, r && 'undoToken' in r ? r.undoToken : undefined)
    } catch (e) {
      toastError(e)
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-meta text-muted-foreground">{t('detail.matchesHint')}</p>
        <Button asChild variant="secondary" size="sm"><Link to={paths.matching({ lead: lead.id })}><Target />{t('detail.openMatching')}<ArrowRight /></Link></Button>
      </div>
      <MatchList
        matches={matches} limit={8}
        actions={edit ? {
          onShortlist: (m) => act(() => shortlistProperty(lead.id, m.property.id), t('detail.shortlisted', { title: m.property.title })),
          onShare: (m) => {
            try {
              const r = shareProperties(lead.id, [m.property.id])
              window.open(r.link, '_blank', 'noopener,noreferrer')
              toast.success(t('detail.shared', { title: m.property.title }))
            } catch (e) { toastError(e) }
          },
          onSchedule: (m) => dialogs.open({ kind: 'visit', leadId: lead.id, propertyIds: [m.property.id] }),
          onNotInterested: (m) => act(() => markNotInterested(lead.id, m.property.id), t('detail.notInterested', { title: m.property.title })),
        } : {}}
      />
    </div>
  )
}

function AppointmentsTab({ lead, appts }: { lead: Lead; appts: ReturnType<typeof appointmentsForLead> }) {
  const { t } = useTranslation('leads')
  const { can, scope } = usePermission()
  const dialogs = useLeadDialogs()
  return (
    <div className="flex flex-col gap-3">
      {scope('appointment.manage') !== false && isOpenStage(lead.stage) && (
        <Button size="sm" variant="secondary" className="self-start" disabled={!can('lead.edit', lead)} onClick={() => dialogs.open({ kind: 'visit', leadId: lead.id })}><CalendarPlus />{t('actions.scheduleVisit')}</Button>
      )}
      {appts.length ? (
        <ul className="flex flex-col gap-2">{appts.map((a) => <li key={a.id}><AppointmentCard appointment={a} showDate /></li>)}</ul>
      ) : <EmptyState compact illustration={EmptyCalendar} title={t('detail.noAppointments')} body={t('detail.noAppointmentsBody')} />}
    </div>
  )
}

function TasksTab({ lead, tasks }: { lead: Lead; tasks: Task[] }) {
  const { t } = useTranslation('leads')
  const { can, scope } = usePermission()
  const dialogs = useLeadDialogs()
  return (
    <div className="flex flex-col gap-3">
      {scope('task.manage') !== false && isOpenStage(lead.stage) && (
        <Button size="sm" variant="secondary" className="self-start" disabled={!can('lead.edit', lead)} onClick={() => dialogs.open({ kind: 'task', leadId: lead.id })}><ListPlus />{t('actions.addFollowUp')}</Button>
      )}
      {tasks.length ? (
        <ul className="flex flex-col gap-2">{tasks.map((x) => <li key={x.id}><TaskRow task={x} showLead={false} /></li>)}</ul>
      ) : <EmptyState compact illustration={EmptyTasks} title={t('detail.noTasks')} body={t('detail.noTasksBody')} />}
    </div>
  )
}

function AssignmentsTab({ history }: { history: ReturnType<typeof assignmentsForLead> }) {
  const { t, i18n } = useTranslation(['leads', 'catalogue'])
  const users = useWholeDb().users
  const name = (id: string | null) => (id ? users.find((u) => u.id === id)?.name ?? id : t('leads:detail.nobody'))
  if (!history.length) return <EmptyState compact title={t('leads:detail.noAssignments')} body={t('leads:detail.noAssignmentsBody')} />
  return (
    <ol className="relative flex flex-col gap-3 border-l pl-5" data-testid="assignment-history">
      {[...history].reverse().map((a) => (
        <li key={a.id} className="relative">
          <span aria-hidden="true" className="absolute top-1.5 -left-[25px] size-2.5 rounded-full bg-info ring-4 ring-card" />
          <p className="flex flex-wrap items-center gap-1.5 text-sm">
            {a.fromUserId && <><UserAvatar name={name(a.fromUserId)} size="xs" /><span>{name(a.fromUserId)}</span><ArrowRight className="size-3.5 text-muted-foreground" aria-hidden="true" /></>}
            {a.toUserId && <UserAvatar name={name(a.toUserId)} size="xs" />}
            <span className="font-semibold">{name(a.toUserId)}</span>
            <span className={a.mode === 'auto' ? 'rounded-full bg-ai-soft px-2 text-meta font-medium text-ai' : 'rounded-full bg-muted px-2 text-meta font-medium'}>{t(`leads:assignMode.${a.mode}`)}</span>
          </p>
          <p className="text-meta text-muted-foreground">
            {t(`catalogue:assignmentReason.${a.reason.key}`, a.reason.params ?? {})} · {fmtDateTime(a.at, i18n.language)} · {a.by === 'system' ? t('leads:detail.bySystem') : t('leads:detail.by', { name: name(a.by) })}
          </p>
          {a.note && <p className="mt-0.5 text-meta">“{a.note}”</p>}
        </li>
      ))}
    </ol>
  )
}
