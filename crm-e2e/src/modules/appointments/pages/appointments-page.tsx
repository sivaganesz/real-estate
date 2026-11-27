/**
 * /appointments (master prompt §16, plan §8.3 M4): KPI strip, "waiting for an outcome" strip, the calendar in day /
 * week / month / list views (`?view=&date=`), type legend chips that filter, executive and status filters (executive
 * only for managers and admins), the current-time line, clash overlays, and click-a-slot-to-book. Book manually or
 * paste a message ("Site visit with Priya tomorrow 11 am at Aranya Greens") into the same form.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { CalendarCheck, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, ClipboardCheck, List, MessageCircleQuestion, Plus, Sparkles, SquareStack } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { AppointmentCard } from '@/components/domain/appointment-card'
import { AppointmentFormDialog } from '@/components/domain/appointment-form-dialog'
import { EmptyCalendar } from '@/components/illustrations'
import { EmptyState } from '@/components/shared/empty-state'
import { FilteredEmpty } from '@/components/shared/filtered-empty'
import { FilterPill } from '@/components/shared/filter-pill'
import { KpiCard } from '@/components/shared/kpi-card'
import { PageHeader } from '@/components/shared/page-header'
import { SectionCard } from '@/components/shared/section-card'
import { Segmented } from '@/components/shared/segmented'
import { Button } from '@/components/ui/button'
import type { AppointmentStatus, AppointmentType, ID, ISODate } from '@/domain/types'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useWholeDb } from '@/hooks/use-db'
import { useIsPhone } from '@/hooks/use-media-query'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { addDaysToDay, localDay, parseLocalDay } from '@/lib/dates'
import { needsOutcome } from '@/lib/next-action'
import { cn } from '@/lib/utils'
import { visible } from '@/services/queries/visibility'
import {
  activeFilterCount, conflictIds, EMPTY_FILTERS, filterAppointments, hourRange, inRange, monthGrid, parseDay, parseView,
  rangeFor, shiftAnchor, typeLegend, weekDays, APPOINTMENT_STATUSES_ORDER, type CalFilters, type CalView,
} from '../lib/calendar'
import { AgendaList } from '../components/agenda-list'
import { AppointmentActions } from '../components/appointment-actions'
import { TYPE_DOT } from '../lib/event-style'
import { MonthGrid } from '../components/month-grid'
import { TimeGrid } from '../components/time-grid'
import { useEventInfo } from '../components/use-event-info'

type Booking = { start?: string; aiOpen?: boolean } | null

export default function AppointmentsPage() {
  const { t, i18n } = useTranslation(['appointments', 'catalogue'])
  const db = useWholeDb()
  const user = useCurrentUser()
  const now = useNow()
  const phone = useIsPhone()
  const { can, scope } = usePermission()
  const [params, setParams] = useSearchParams()
  const today = localDay(now)
  const view = parseView(params.get('view'), phone ? 'day' : 'week')
  const day = parseDay(params.get('date'), today)
  const [filters, setFilters] = useState<CalFilters>(EMPTY_FILTERS)
  const [booking, setBooking] = useState<Booking>(null)
  const locale = i18n.language === 'ta' ? 'ta-IN' : 'en-IN'
  const mayBook = can('appointment.manage')
  const teamScope = scope('appointment.view') !== 'own'

  const go = (next: { view?: CalView; date?: ISODate }) => {
    const p = new URLSearchParams(params)
    if (next.view) p.set('view', next.view)
    if (next.date) p.set('date', next.date)
    setParams(p, { replace: true })
  }

  const all = useMemo(() => visible.appointments(db, user), [db, user])
  const filtered = useMemo(() => filterAppointments(all, filters), [all, filters])
  const range = rangeFor(day, view)
  // a cheap filter over a few dozen records; memoising it would not survive the URL-derived range
  const shown = filtered.filter((a) => inRange(a, range))
  const clashes = useMemo(() => conflictIds(all), [all])
  const info = useEventInfo(shown)
  const pending = useMemo(() => all.filter((a) => needsOutcome(a, now)).sort((a, b) => b.start.localeCompare(a.start)), [all, now])

  // KPI numbers
  const live = all.filter((a) => a.status !== 'cancelled')
  const todayList = live.filter((a) => localDay(a.start) === today)
  const next7 = Array.from({ length: 7 }, (_, i) => live.filter((a) => localDay(a.start) === addDaysToDay(today, i)).length)
  const week = weekDays(today)
  const visitsWeek = live.filter((a) => a.type === 'siteVisit' && localDay(a.start) >= week[0] && localDay(a.start) <= week[6])
  const visitsDone = visitsWeek.filter((a) => a.status === 'completed').length
  const toConfirm = live.filter((a) => a.status === 'scheduled' || a.status === 'rescheduled').filter((a) => a.start > now.toISOString() && new Date(a.start).getTime() - now.getTime() <= 36 * 3_600_000)

  const owners = useMemo(() => db.users.filter((u) => u.status === 'active' && all.some((a) => a.ownerId === u.id)), [db.users, all])
  const legend = typeLegend(filterAppointments(all, { ...filters, types: [] }).filter((a) => inRange(a, range)))
  const toggleType = (tp: AppointmentType) =>
    setFilters((f) => ({ ...f, types: f.types.includes(tp) ? f.types.filter((x) => x !== tp) : [...f.types, tp] }))

  const title = (() => {
    const d = parseLocalDay(day)
    if (view === 'day') return d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    if (view === 'month') return d.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
    const from = parseLocalDay(range.from)
    const to = parseLocalDay(range.to)
    return `${from.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${to.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`
  })()

  const views: { value: CalView; label: string; icon: ReactNode }[] = [
    { value: 'day', label: t('view.day'), icon: <CalendarDays aria-hidden="true" /> },
    { value: 'week', label: t('view.week'), icon: <CalendarRange aria-hidden="true" /> },
    { value: 'month', label: t('view.month'), icon: <SquareStack aria-hidden="true" /> },
    { value: 'list', label: t('view.list'), icon: <List aria-hidden="true" /> },
  ]
  const hours = hourRange(shown)
  const nothingAtAll = all.length === 0
  const filteredEmpty = !nothingAtAll && shown.length === 0 && activeFilterCount(filters) > 0

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5" data-testid="appointments-page">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={mayBook && (
          <>
            <Button variant="ai-outline" onClick={() => setBooking({ aiOpen: true })} data-testid="book-ai"><Sparkles />{t('page.bookAi')}</Button>
            <Button onClick={() => setBooking({})} data-testid="book-appointment"><Plus />{t('page.book')}</Button>
          </>
        )}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard label={t('kpi.today')} value={todayList.length} icon={CalendarDays} tone="primary" spark={phone ? undefined : next7}
          hint={t('kpi.todayHint', { count: todayList.filter((a) => a.start > now.toISOString()).length })} onClick={() => go({ view: 'day', date: today })} />
        <KpiCard label={t('kpi.visitsWeek')} value={visitsWeek.length} icon={CalendarCheck} tone="info"
          ring={visitsWeek.length ? { value: Math.round((visitsDone / visitsWeek.length) * 100), label: t('kpi.visitsDoneRing', { done: visitsDone, total: visitsWeek.length }) } : undefined}
          hint={t('kpi.visitsWeekHint', { done: visitsDone })} onClick={() => { setFilters({ ...EMPTY_FILTERS, types: ['siteVisit'] }); go({ view: phone ? 'list' : 'week', date: today }) }} />
        <KpiCard label={t('kpi.needOutcome')} value={pending.length} icon={ClipboardCheck} tone={pending.length ? 'warning' : 'success'}
          hint={pending.length ? t('kpi.needOutcomeHint') : t('kpi.allLogged')} onClick={() => document.getElementById('pending-outcomes')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
        <KpiCard label={t('kpi.toConfirm')} value={toConfirm.length} icon={MessageCircleQuestion} tone={toConfirm.length ? 'danger' : 'success'}
          hint={t('kpi.toConfirmHint')} onClick={() => { setFilters({ ...EMPTY_FILTERS, statuses: ['scheduled', 'rescheduled'] }); go({ view: 'list', date: today }) }} />
      </div>

      {pending.length > 0 && (
        <SectionCard id="pending-outcomes" icon={ClipboardCheck} title={t('pending.title', { count: pending.length })} description={t('pending.body')} data-testid="pending-outcomes">
          <div className="grid gap-2 lg:grid-cols-2 [&>*]:min-w-0">
            {pending.slice(0, 4).map((a) => <AppointmentCard key={a.id} appointment={a} showDate actions={<AppointmentActions appointment={a} variant="menu" />} />)}
          </div>
          {pending.length > 4 && (
            <Button variant="link" size="sm" className="mt-2 px-0" onClick={() => { setFilters(EMPTY_FILTERS); go({ view: 'list', date: localDay(pending[pending.length - 1].start) }) }}>
              {t('pending.more', { count: pending.length - 4 })}
            </Button>
          )}
        </SectionCard>
      )}

      <section className="flex flex-col gap-3" aria-label={t('calendar')}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => go({ date: today })} disabled={day === today && view !== 'month'}>{t('nav.today')}</Button>
            <span className="flex items-center">
              <Button variant="ghost" size="icon-sm" onClick={() => go({ date: shiftAnchor(day, view, -1) })} aria-label={t('nav.prev')}><ChevronLeft /></Button>
              <Button variant="ghost" size="icon-sm" onClick={() => go({ date: shiftAnchor(day, view, 1) })} aria-label={t('nav.next')}><ChevronRight /></Button>
            </span>
            <h2 className="text-lg font-semibold tabular-nums" aria-live="polite" data-testid="calendar-title">{title}</h2>
          </div>
          <Segmented value={view} onChange={(v) => go({ view: v })} label={t('view.label')} segments={views} />
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('legend.label')}>
          {legend.map(({ type, count }) => {
            const on = filters.types.includes(type)
            return (
              <button key={type} type="button" aria-pressed={on} onClick={() => toggleType(type)} data-testid={`legend-${type}`}
                className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-ui transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  on ? 'border-primary/40 bg-primary-soft font-medium text-primary' : filters.types.length ? 'bg-card text-muted-foreground hover:bg-muted' : 'bg-card hover:bg-muted')}>
                <span aria-hidden="true" className={cn('size-2.5 rounded-full', TYPE_DOT[type])} />
                {t(`catalogue:appointmentType.${type}`)}
                <span className="text-meta text-muted-foreground tabular-nums">{count}</span>
              </button>
            )
          })}
          {teamScope && owners.length > 1 && (
            <FilterPill label={t('filter.executive')} selected={filters.ownerIds} onChange={(v) => setFilters((f) => ({ ...f, ownerIds: v as ID[] }))}
              options={owners.map((u) => ({ value: u.id, label: u.name, count: all.filter((a) => a.ownerId === u.id && inRange(a, range)).length }))} />
          )}
          <FilterPill label={t('filter.status')} selected={filters.statuses} onChange={(v) => setFilters((f) => ({ ...f, statuses: v as AppointmentStatus[] }))}
            options={APPOINTMENT_STATUSES_ORDER.map((s) => ({ value: s, label: t(`catalogue:appointmentStatus.${s}`), count: all.filter((a) => a.status === s && inRange(a, range)).length }))} />
          {activeFilterCount(filters) > 0 && (
            <button type="button" className="rounded-sm px-1 text-ui font-medium text-primary hover:underline" onClick={() => setFilters(EMPTY_FILTERS)}>
              {t('filter.clear', { count: activeFilterCount(filters) })}
            </button>
          )}
        </div>

        {nothingAtAll ? (
          <EmptyState illustration={EmptyCalendar} title={t('empty.title')} body={t('empty.body')}
            primary={mayBook && <Button onClick={() => setBooking({})}><Plus />{t('page.book')}</Button>}
            secondary={mayBook && <Button variant="ai-outline" onClick={() => setBooking({ aiOpen: true })}><Sparkles />{t('page.bookAi')}</Button>} />
        ) : filteredEmpty && view !== 'day' && view !== 'week' ? (
          <FilteredEmpty title={t('empty.filtered')} onClear={() => setFilters(EMPTY_FILTERS)} />
        ) : view === 'month' ? (
          <MonthGrid weeks={monthGrid(day)} month={day.slice(0, 7)} items={shown} now={now} clashes={clashes} info={info}
            onOpenDay={(d) => go({ view: 'day', date: d })} onSlot={(start) => setBooking({ start })} />
        ) : view === 'list' || (view === 'week' && phone) ? (
          shown.length ? <AgendaList items={shown} now={now} clashes={clashes} /> : (
            <EmptyState compact illustration={EmptyCalendar} title={t('empty.range')} body={t('empty.rangeBody')}
              primary={mayBook && <Button onClick={() => setBooking({})}><Plus />{t('page.book')}</Button>} />
          )
        ) : (
          <>
            {filteredEmpty && <FilteredEmpty title={t('empty.filtered')} onClear={() => setFilters(EMPTY_FILTERS)} className="py-4" />}
            <TimeGrid days={view === 'day' ? [day] : weekDays(day)} items={shown} hours={hours} now={now} clashes={clashes} info={info}
              onSlot={(start) => setBooking({ start })} onOpenDay={view === 'week' ? (d) => go({ view: 'day', date: d }) : undefined} />
            {view === 'day' && shown.length === 0 && !filteredEmpty && (
              <p className="text-center text-meta text-muted-foreground">{mayBook ? t('empty.dayHint') : t('empty.dayNone')}</p>
            )}
          </>
        )}
      </section>

      <AppointmentFormDialog open={booking !== null} onOpenChange={(o) => { if (!o) setBooking(null) }} start={booking?.start} aiOpen={booking?.aiOpen}
        ownerId={filters.ownerIds.length === 1 ? filters.ownerIds[0] : undefined} />
    </div>
  )
}
