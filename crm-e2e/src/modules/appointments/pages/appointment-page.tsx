/**
 * /appointments/:id (master prompt §16, plan §8.3 M4 "Detail"): what, when, where (map link), who, the properties; the
 * actions (confirm, log outcome, reschedule, cancel with reason, no-show, edit, delete); AI preparation points before
 * the visit, the AI summary after it, and the WhatsApp confirmation with the location link. Related follow-ups and the
 * appointment's activity sit on the side.
 */
import { AlertTriangle, ArrowLeft, Building2, CalendarClock, ClipboardCheck, ClipboardList, History, MapPin, NotebookPen } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { useAISelection } from '@/ai'
import { paths } from '@/app/paths'
import { ActivityTimeline } from '@/components/domain/activity-timeline'
import { ContactActions } from '@/components/domain/contact-actions'
import { StagePill } from '@/components/domain/lead-pills'
import { AvailabilityPill } from '@/components/domain/property-pills'
import { TaskRow } from '@/components/domain/task-row'
import { EmptyCalendar, NoAccess } from '@/components/illustrations'
import { ToneBadge } from '@/components/shared/badges'
import { Callout } from '@/components/shared/callout'
import { EmptyState } from '@/components/shared/empty-state'
import { IconTile } from '@/components/shared/icon-tile'
import { KeyValueGrid } from '@/components/shared/key-value-grid'
import { SectionCard } from '@/components/shared/section-card'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import type { Appointment, Property } from '@/domain/types'
import { useDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { localDay } from '@/lib/dates'
import { fmtDateTime, fmtTime, inrShort } from '@/lib/format'
import { phoneDisplay } from '@/lib/phone'
import { appointmentStatusTone, appointmentTypeTone } from '@/lib/tones'
import { mapsLink, propertyAddress } from '@/lib/whatsapp'
import { findConflicts } from '@/services/appointments'
import { appointmentState } from '../lib/calendar'
import { VisitPrepCard, VisitSummaryCard, WhatsAppConfirmCard } from '../components/ai-cards'
import { AppointmentActions } from '../components/appointment-actions'

export default function AppointmentPage() {
  const { id = '' } = useParams()
  const { t } = useTranslation(['appointments', 'common'])
  const navigate = useNavigate()
  const { can } = usePermission()
  const a = useDb((db) => db.appointments.find((x) => x.id === id))
  useAISelection(a ? { kind: 'appointment', id: a.id } : undefined)

  if (!a) {
    return (
      <EmptyState illustration={EmptyCalendar} title={t('detail.notFound')} body={t('detail.notFoundBody')}
        primary={<Button onClick={() => navigate(paths.appointments())}><ArrowLeft />{t('detail.back')}</Button>} />
    )
  }
  if (!can('appointment.view', a)) {
    return (
      <EmptyState illustration={NoAccess} title={t('detail.noAccess')} body={t('detail.noAccessBody')}
        primary={<Button onClick={() => navigate(paths.appointments())}><ArrowLeft />{t('detail.back')}</Button>} />
    )
  }
  return <Detail a={a} onDeleted={() => navigate(paths.appointments({ view: 'day', date: localDay(a.start) }))} />
}

function Detail({ a, onDeleted }: { a: Appointment; onDeleted: () => void }) {
  const { t, i18n } = useTranslation(['appointments', 'catalogue', 'common'])
  const now = useNow()
  const lead = useDb((db) => db.leads.find((l) => l.id === a.leadId))
  const owner = useDb((db) => db.users.find((u) => u.id === a.ownerId))
  const allProps = useDb((db) => db.properties)
  const appointments = useDb((db) => db.appointments)
  const tasks = useDb((db) => db.tasks)
  const props = useMemo(() => a.propertyIds.map((pid) => allProps.find((p) => p.id === pid)).filter((p): p is Property => !!p), [a.propertyIds, allProps])
  const conflicts = useMemo(() => findConflicts({ appointments }, a), [appointments, a])
  const clashNames = useDb((db) => conflicts.map((c) => db.leads.find((l) => l.id === c.leadId)?.name ?? t('noLead')))
  const related = useMemo(() => tasks
    .filter((x) => x.appointmentId === a.id || (a.leadId && x.leadId === a.leadId && x.status === 'open'))
    .sort((x, y) => x.dueAt.localeCompare(y.dueAt))
    .slice(0, 6), [tasks, a.id, a.leadId])
  const s = appointmentState(a, now)
  const type = appointmentTypeTone[a.type]
  const status = appointmentStatusTone[a.status]
  const end = new Date(new Date(a.start).getTime() + a.durationMin * 60_000).toISOString()
  const map = a.location?.mapUrl ?? (props[0] ? mapsLink(propertyAddress(props[0])) : undefined)
  const typeLabel = t(`catalogue:appointmentType.${a.type}`)

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5" data-testid="appointment-page">
      <Link to={paths.appointments({ view: 'day', date: localDay(a.start) })} className="inline-flex items-center gap-1 self-start text-ui font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />{t('detail.back')}
      </Link>

      <header className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-card md:flex-row md:items-start md:justify-between md:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <IconTile icon={type.icon ?? CalendarClock} classes={type} size="lg" />
          <div className="min-w-0">
            <p className="text-meta font-medium text-muted-foreground">{typeLabel} · {a.id}</p>
            <h1 className="text-2xl font-[650] tracking-[-0.02em] break-words [:lang(ta)_&]:tracking-normal" data-testid="appointment-title">
              {lead ? t('detail.titleWith', { type: typeLabel, name: lead.name }) : typeLabel}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="tabular-nums">{fmtDateTime(a.start, i18n.language)} – {fmtTime(end, i18n.language)}</span>
              {owner && <span className="inline-flex items-center gap-1.5"><UserAvatar name={owner.name} size="xs" />{owner.name}</span>}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <ToneBadge classes={status} icon={status.icon} data-testid="appointment-status">{t(`catalogue:appointmentStatus.${a.status}`)}</ToneBadge>
              {a.rescheduledFrom && <ToneBadge tone="neutral">{t('detail.movedFrom', { when: fmtDateTime(a.rescheduledFrom, i18n.language) })}</ToneBadge>}
              {s.upcoming && conflicts.length > 0 && <ToneBadge tone="danger" icon={AlertTriangle}>{t('detail.clash', { count: conflicts.length })}</ToneBadge>}
            </div>
          </div>
        </div>
        <AppointmentActions appointment={a} onDeleted={onDeleted} className="md:justify-end" />
      </header>

      {s.canComplete && (
        <Callout tone="warning" icon={ClipboardCheck} title={t('detail.outcomeDue')}>{t('detail.outcomeDueBody')}</Callout>
      )}
      {s.upcoming && conflicts.length > 0 && owner && (
        <Callout tone="danger" icon={AlertTriangle} title={t('conflict.title')}>
          {clashNames.map((n, i) => <p key={conflicts[i].id}>{t('conflict.line', { owner: owner.name, name: n, time: fmtTime(conflicts[i].start, i18n.language) })}</p>)}
        </Callout>
      )}

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-8">
          {a.status === 'completed' ? (
            <>
              <VisitSummaryCard appointment={a} lead={lead} />
              {a.outcome && (
                <SectionCard icon={ClipboardList} title={t('detail.outcome')}>
                  <KeyValueGrid items={[
                    { key: 'r', label: t('outcome.result'), value: t(`result.${a.outcome.result}`) },
                    { key: 'i', label: t('outcome.interest'), value: a.outcome.interest ? t(`interest.${a.outcome.interest}`) : '' },
                    { key: 'dm', label: t('outcome.dm'), value: a.outcome.decisionMakerPresent == null ? '' : a.outcome.decisionMakerPresent ? t('yes') : t('no') },
                    { key: 'l', label: t('outcome.liked'), value: a.outcome.likedPropertyIds.map((pid) => allProps.find((p) => p.id === pid)?.title).filter(Boolean).join(', ') },
                    { key: 'o', label: t('outcome.objections'), value: a.outcome.objections ?? '' },
                    { key: 'n', label: t('outcome.nextStep'), value: a.outcome.nextStep ?? '' },
                    { key: 'f', label: t('outcome.followUp'), value: a.outcome.nextFollowUpAt ? fmtDateTime(a.outcome.nextFollowUpAt, i18n.language) : '' },
                    { key: 'at', label: t('detail.loggedAt'), value: fmtDateTime(a.outcome.at, i18n.language) },
                  ]} />
                </SectionCard>
              )}
            </>
          ) : s.upcoming ? (
            <>
              <VisitPrepCard appointment={a} lead={lead} />
              {lead && <WhatsAppConfirmCard appointment={a} lead={lead} properties={props} />}
            </>
          ) : (
            <Callout tone="neutral" title={t(`detail.closed.${a.status}`)}>
              {a.cancelReason ? t('detail.reason', { reason: a.cancelReason }) : t('detail.closedBody')}
            </Callout>
          )}

          <SectionCard icon={NotebookPen} title={t('detail.details')}>
            <KeyValueGrid items={[
              { key: 'when', label: t('detail.when'), value: <span className="tabular-nums">{fmtDateTime(a.start, i18n.language)}</span> },
              { key: 'dur', label: t('detail.duration'), value: t('detail.minutes', { count: a.durationMin }) },
              { key: 'own', label: t('detail.executive'), value: owner?.name ?? '' },
              { key: 'rem', label: t('form.reminder'), value: t(`reminder.m${[0, 15, 30, 60, 120, 1440].includes(a.reminderMins) ? a.reminderMins : 60}`) },
              { key: 'cr', label: t('detail.created'), value: fmtDateTime(a.createdAt, i18n.language) },
              { key: 'cx', label: t('detail.cancelReason'), value: a.cancelReason ?? '' },
            ]} />
            {a.location?.text && (
              <div className="mt-4 flex items-start gap-2 rounded-md bg-muted/50 p-3 text-sm">
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0 flex-1 break-words">{a.location.text}</span>
                {map && <a href={map} target="_blank" rel="noopener noreferrer" className="shrink-0 font-medium text-primary hover:underline" data-testid="map-link">{t('detail.openMap')}</a>}
              </div>
            )}
            {a.notes && <p className="mt-4 rounded-md border-l-2 border-border-strong pl-3 text-sm whitespace-pre-line text-muted-foreground">{a.notes}</p>}
          </SectionCard>

          {props.length > 0 && (
            <SectionCard icon={Building2} title={t('detail.properties', { count: props.length })}>
              <ul className="grid gap-3 sm:grid-cols-2">
                {props.map((p) => {
                  const cover = p.media.find((m) => m.isCover) ?? p.media.find((m) => m.kind === 'photo')
                  return (
                    <li key={p.id} className="flex gap-3 rounded-lg border p-2.5">
                      <div className="size-16 shrink-0 overflow-hidden rounded-md bg-primary-soft">
                        {cover && <img src={cover.url} alt="" className="size-full object-cover" loading="lazy" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link to={paths.property(p.id)} className="block truncate text-sm font-semibold hover:underline">{p.title}</Link>
                        <p className="truncate text-meta text-muted-foreground">{p.location.locality} · {p.location.city}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold tabular-nums">{inrShort(p.price)}</span>
                          <AvailabilityPill status={p.status} />
                          {a.outcome?.likedPropertyIds.includes(p.id) && <ToneBadge tone="success">{t('detail.liked')}</ToneBadge>}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </SectionCard>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-5 xl:col-span-4">
          {lead ? (
            <SectionCard title={t('detail.lead')}>
              <div className="flex items-start gap-3">
                <UserAvatar name={lead.name} size="lg" />
                <div className="min-w-0 flex-1">
                  <Link to={paths.lead(lead.id)} className="block truncate text-base font-semibold hover:underline" data-testid="lead-link">{lead.name}</Link>
                  <p className="text-meta text-muted-foreground tabular-nums">{phoneDisplay(lead.phone)}</p>
                  <StagePill stage={lead.stage} className="mt-1.5" />
                </div>
              </div>
              <ContactActions lead={lead} className="mt-3 flex-wrap" labels />
            </SectionCard>
          ) : (
            <Callout tone="warning">{t('noLead')}</Callout>
          )}
          <SectionCard icon={ClipboardList} title={t('detail.followUps')} action={<Button asChild variant="link" size="sm"><Link to={paths.tasks()}>{t('detail.allTasks')}</Link></Button>}>
            {related.length ? (
              <div className="flex flex-col gap-2">{related.map((x) => <TaskRow key={x.id} task={x} showLead={false} compact />)}</div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('detail.noFollowUps')}</p>
            )}
          </SectionCard>
          <SectionCard icon={History} title={t('detail.activity')}>
            <ActivityTimeline refTo={{ kind: 'appointment', id: a.id }} limit={20} />
          </SectionCard>
        </aside>
      </div>
    </div>
  )
}
