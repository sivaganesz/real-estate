/**
 * The ranked priority list (ROLE_RESEARCH §5.1): every row answers "why this, now?" with a reason chip, a due time and
 * one-click actions (Call, WhatsApp, Log outcome, Reschedule, Done, Open). Each action writes through a service, the
 * list is derived from the store, so the row leaves or moves the moment the work is done: an inbox to zero.
 */
import { useState } from 'react'
import {
  AlarmClock, ArrowUpRight, Building2, CalendarCheck, Check, Flame, Hourglass, ListChecks, MessageCircle, Phone, PhoneForwarded,
  PhoneIncoming, type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { paths } from '@/app/paths'
import { EmptyTasks } from '@/components/illustrations'
import { EmptyState } from '@/components/shared/empty-state'
import { FilteredEmpty } from '@/components/shared/filtered-empty'
import { IconTile } from '@/components/shared/icon-tile'
import { ScoreRing } from '@/components/shared/progress-ring'
import { Segmented } from '@/components/shared/segmented'
import { SectionCard } from '@/components/shared/section-card'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { DB, Lead } from '@/domain/types'
import { usePermission } from '@/hooks/use-permission'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { fmtTime } from '@/lib/format'
import type { LeadScore } from '@/lib/scoring'
import { TONE, temperatureTone, type Tone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { telLink, waLink } from '@/lib/whatsapp'
import type { TodayItem, TodayKind } from '@/services/queries/today'
import { dueState, filterCounts, filterItems, itemKey, PRIORITY_FILTERS, reasonParams, splitMins, type PriorityFilter } from '../lib/slots'
import { LogOutcome } from './log-outcome'
import { RescheduleMenu } from './reschedule-menu'
import { useTodayActions } from './use-today-actions'

const KIND: Record<TodayKind, { icon: LucideIcon; tone: Tone }> = {
  uncalledNew: { icon: PhoneIncoming, tone: 'info' },
  visitSoon: { icon: Building2, tone: 'warning' },
  overdueTask: { icon: AlarmClock, tone: 'danger' },
  postVisitCall: { icon: PhoneForwarded, tone: 'violet' },
  hotNoContact: { icon: Flame, tone: 'hot' },
  stale: { icon: Hourglass, tone: 'neutral' },
  dueToday: { icon: CalendarCheck, tone: 'primary' },
}
const PAGE = 8

export function PriorityList({ items, db, scores, now }: { items: TodayItem[]; db: DB; scores: Map<string, LeadScore>; now: Date }) {
  const { t } = useTranslation('today')
  const [filter, setFilter] = useState<PriorityFilter>('all')
  const [all, setAll] = useState(false)
  const counts = filterCounts(items)
  const shown = filterItems(items, filter)
  const visibleItems = all ? shown : shown.slice(0, PAGE)
  return (
    <SectionCard
      id="today-priorities"
      title={t('priority.title')}
      description={t('priority.subtitle', { count: items.length })}
      icon={ListChecks}
      data-testid="priority-list"
      bodyClassName="flex flex-col gap-3"
    >
      <Segmented
        variant="tabs" label={t('priority.filter')} value={filter} onChange={(v) => { setFilter(v); setAll(false) }}
        segments={PRIORITY_FILTERS.filter((f) => f === 'all' || counts[f] > 0 || f === filter).map((f) => ({ value: f, label: t(`priority.filters.${f}`), count: counts[f] }))}
      />
      {items.length === 0 ? (
        <EmptyState
          illustration={EmptyTasks} compact title={t('priority.emptyTitle')} body={t('priority.emptyBody')}
          primary={<Button asChild size="sm"><Link to={paths.leads()}>{t('priority.emptyLeads')}</Link></Button>}
          secondary={<Button asChild size="sm" variant="ghost"><Link to={paths.tasks()}>{t('priority.emptyTasks')}</Link></Button>}
        />
      ) : shown.length === 0 ? (
        <FilteredEmpty title={t('priority.filteredEmpty')} onClear={() => setFilter('all')} />
      ) : (
        <ol className="flex flex-col divide-y divide-border/70" aria-label={t('priority.title')}>
          {visibleItems.map((it, i) => (
            <PriorityRow key={itemKey(it)} item={it} index={items.indexOf(it) + 1} stagger={i} lead={db.leads.find((l) => l.id === it.leadId)} score={it.leadId ? scores.get(it.leadId) : undefined} now={now} db={db} />
          ))}
        </ol>
      )}
      {shown.length > PAGE && (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setAll((v) => !v)}>
          {all ? t('priority.showLess') : t('priority.showAll', { count: shown.length })}
        </Button>
      )}
    </SectionCard>
  )
}

function PriorityRow({ item, index, stagger, lead, score, now, db }: { item: TodayItem; index: number; stagger: number; lead?: Lead; score?: LeadScore; now: Date; db: DB }) {
  const { t, i18n } = useTranslation(['today', 'catalogue'])
  const { can, explain } = usePermission()
  const reduced = useReducedMotion()
  const act = useTodayActions()
  const [logOpen, setLogOpen] = useState(false)
  const k = KIND[item.kind]
  const due = dueState(item.dueAt, now)
  const task = item.ref.kind === 'task' ? db.tasks.find((x) => x.id === item.ref.id) : undefined
  const appt = item.ref.kind === 'appointment' ? db.appointments.find((x) => x.id === item.ref.id) : undefined
  const mayEditLead = !!lead && can('lead.edit', lead)
  const mayTask = task ? can('task.manage', task) : appt ? can('appointment.manage', appt) : mayEditLead
  const deniedTip = t(explain(task ? 'task.manage' : 'lead.edit').reasonKey, explain(task ? 'task.manage' : 'lead.edit').params)
  const temp = lead ? (lead.temperatureOverride ?? score?.temperature) : undefined
  const name = String(item.params.name || lead?.name || '')
  const reason = t(`today:reason.${item.reasonKey}`, reasonParams(item, (k, p) => t(k, p)))
  const has = (a: TodayItem['actions'][number]) => item.actions.includes(a)
  const msg = lead ? act.followUpText(lead) : ''
  const d = splitMins(due.mins)
  const dueText = due.state === 'overdue'
    ? t('today:due.overdue', { time: d.d ? t('today:due.days', { count: d.d }) : d.h ? t('today:due.hours', { h: d.h, m: d.m }) : t('today:due.mins', { count: d.m }) })
    : due.state === 'soon' ? t('today:due.inMins', { time: d.h ? t('today:due.hours', { h: d.h, m: d.m }) : t('today:due.mins', { count: d.m }) })
    : due.state === 'today' ? t('today:due.at', { time: fmtTime(item.dueAt, i18n.language) })
    : due.state === 'later' ? t('today:due.later') : ''

  return (
    <li
      id={`today-item-${itemKey(item)}`}
      data-testid="priority-item"
      data-kind={item.kind}
      className={cn('group flex scroll-mt-28 flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-3', !reduced && stagger < 8 && 'animate-fade-up')}
      style={!reduced && stagger < 8 ? { animationDelay: `${stagger * 30}ms`, animationFillMode: 'both' } : undefined}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-1 w-5 shrink-0 text-center text-micro font-semibold text-subtle-foreground tabular-nums" aria-label={t('today:priority.rank', { n: index })}>{index}</span>
        <IconTile icon={k.icon} tone={item.overdue ? 'danger' : k.tone} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            {lead ? (
              <Link to={paths.lead(lead.id)} className="truncate text-sm font-semibold hover:underline">{name}</Link>
            ) : <span className="truncate text-sm font-semibold">{name || String(item.params.title ?? '')}</span>}
            {temp && (
              <span className={cn('inline-flex items-center gap-1 text-meta', TONE[temp].text)}>
                <span aria-hidden="true" className={cn('size-1.5 rounded-full', temperatureTone[temp].solid)} />
                {t(`catalogue:temperature.${temp}`)}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className={cn('inline-flex min-h-5 items-center rounded-full px-2 py-0.5 text-meta leading-tight font-medium', TONE[item.overdue ? 'danger' : k.tone].soft, TONE[item.overdue ? 'danger' : k.tone].text)} data-testid="reason-chip">{reason}</span>
            {/* below sm the due time sits with the reason, so the name keeps the full row width */}
            {dueText && (
              <span className={cn('text-meta font-medium tabular-nums sm:hidden', due.state === 'overdue' ? 'text-danger' : due.state === 'soon' ? 'text-warning' : 'text-muted-foreground')}>{dueText}</span>
            )}
            {item.params.title && item.ref.kind === 'task' && <span className="min-w-0 truncate text-meta text-muted-foreground max-sm:basis-full">{String(item.params.title)}</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 pl-8 sm:justify-end sm:pl-0">
        {dueText && (
          <span className={cn('hidden w-36 shrink-0 text-right text-meta leading-tight font-medium tabular-nums sm:inline', due.state === 'overdue' ? 'text-danger' : due.state === 'soon' ? 'text-warning' : 'text-muted-foreground')}>{dueText}</span>
        )}
        {score && <ScoreRing score={score.score} size={30} label={t('today:priority.score')} />}
        <div className="flex flex-wrap items-center justify-end gap-0.5">
          {has('call') && lead?.phone && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild size="sm" variant="secondary" className="h-8">
                  <a href={telLink(lead.phone)} onClick={() => { if (mayEditLead && has('logOutcome')) window.setTimeout(() => setLogOpen(true), 300) }} data-testid="today-call">
                    <Phone /> <span className="hidden md:inline">{t('today:actions.call')}</span>
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('today:actions.callTip', { name: lead.name })}</TooltipContent>
            </Tooltip>
          )}
          {has('whatsapp') && lead?.phone && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild size="icon-sm" variant="ghost" className="text-success hover:bg-success-soft hover:text-success">
                  <a href={waLink(lead.phone, msg)} target="_blank" rel="noopener noreferrer" aria-label={t('today:actions.whatsapp')} onClick={() => { if (mayEditLead) act.whatsappSent(lead.id, msg) }} data-testid="today-wa">
                    <MessageCircle />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('today:actions.whatsappTip', { name: lead.name })}</TooltipContent>
            </Tooltip>
          )}
          {has('logOutcome') && mayEditLead && (
            <LogOutcome iconOnly name={name} now={now} open={logOpen} onOpenChange={setLogOpen} onSave={(o) => act.logOutcome(item, o)} />
          )}
          {has('reschedule') && (
            <RescheduleMenu iconOnly now={now} current={item.dueAt} disabled={!mayTask} disabledReason={deniedTip} onPick={(at) => act.reschedule(item, at)} />
          )}
          {has('done') && (
            mayTask ? (
              <Button size="sm" variant="ghost" onClick={() => act.done(item)} data-testid="today-done" className="text-success hover:bg-success-soft hover:text-success">
                <Check /> <span className="hidden lg:inline">{t('today:actions.done')}</span>
              </Button>
            ) : null
          )}
          {(has('openLead') || has('openAppointment')) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild size="icon-sm" variant="ghost">
                  <Link to={appt ? paths.appointment(appt.id) : lead ? paths.lead(lead.id) : paths.tasks()} aria-label={t('today:actions.open')}><ArrowUpRight /></Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{appt ? t('today:actions.openAppointment') : t('today:actions.openLead')}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </li>
  )
}
