/**
 * Today's appointments as a vertical timeline (DESIGN_SYSTEM §11.6 colours): the time, a node in the appointment-type
 * colour (or the executive's colour on the manager view), the client, the property and its locality, a map link, the
 * status, a "Now" marker between past and upcoming items, and for the owner "Send confirmation" (WhatsApp template +
 * marks the visit confirmed). A visit whose time has passed without an outcome links to the appointment to record it.
 */
import { useState } from 'react'
import { CalendarPlus, CheckCircle2, MapPin, MessageCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { paths } from '@/app/paths'
import { AppointmentFormDialog } from '@/components/domain/appointment-form-dialog'
import { EmptyCalendar } from '@/components/illustrations'
import { ToneBadge } from '@/components/shared/badges'
import { EmptyState } from '@/components/shared/empty-state'
import { SectionCard } from '@/components/shared/section-card'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import type { Appointment, DB, ID } from '@/domain/types'
import { usePermission } from '@/hooks/use-permission'
import { fmtTime } from '@/lib/format'
import { appointmentStatusTone, appointmentTypeTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { mapsLink, propertyAddress } from '@/lib/whatsapp'
import { useTodayActions } from './use-today-actions'

export function AppointmentsTimeline({ appointments, db, now, ownerColor, title, description, canPlan = true }: {
  appointments: Appointment[]
  db: DB
  now: Date
  /** Manager view: colour each node by executive (index into chart-1…8) and show the owner. */
  ownerColor?: Map<ID, number>
  title: string
  description?: string
  canPlan?: boolean
}) {
  const { t, i18n } = useTranslation(['today', 'catalogue'])
  const { can, user } = usePermission()
  const act = useTodayActions()
  const [planOpen, setPlanOpen] = useState(false)
  const nowIso = now.toISOString()
  const nowIndex = appointments.findIndex((a) => a.start >= nowIso)
  const mayPlan = canPlan && can('appointment.manage', { ownerId: user.id })
  return (
    <SectionCard
      title={title} description={description} data-testid="today-appointments"
      action={mayPlan ? <Button size="sm" variant="secondary" onClick={() => setPlanOpen(true)}><CalendarPlus />{t('today:appointments.plan')}</Button> : undefined}
    >
      {appointments.length === 0 ? (
        <EmptyState
          compact illustration={EmptyCalendar} title={t('today:appointments.emptyTitle')} body={t('today:appointments.emptyBody')}
          primary={<Button asChild size="sm" variant="secondary"><Link to={paths.appointments({ view: 'week' })}>{t('today:appointments.week')}</Link></Button>}
        />
      ) : (
        <ol className="relative flex flex-col">
          {appointments.map((a, i) => {
            const lead = db.leads.find((l) => l.id === a.leadId)
            const property = db.properties.find((p) => p.id === a.propertyIds[0])
            const owner = db.users.find((u) => u.id === a.ownerId)
            const type = appointmentTypeTone[a.type]
            const Icon = type.icon
            const map = a.location?.mapUrl ?? (property ? mapsLink(propertyAddress(property)) : a.location?.text ? mapsLink(a.location.text) : '')
            const past = a.start < nowIso
            const needsOutcome = past && (a.status === 'scheduled' || a.status === 'confirmed' || a.status === 'rescheduled')
            const canConfirm = !past && (a.status === 'scheduled' || a.status === 'rescheduled') && !!lead?.phone && can('appointment.manage', a)
            const color = ownerColor?.get(a.ownerId)
            return (
              <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0" data-testid="timeline-item">
                {i === nowIndex && (
                  <span aria-hidden="true" className="absolute -top-2 right-0 left-14 flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-danger" />
                    <span className="h-px flex-1 bg-danger/60" />
                    <span className="text-micro font-semibold text-danger">{t('today:appointments.now')}</span>
                  </span>
                )}
                <div className={cn('w-12 shrink-0 pt-0.5 text-right text-meta tabular-nums', past ? 'text-subtle-foreground' : 'font-semibold')}>{fmtTime(a.start, i18n.language)}</div>
                <div className="relative flex flex-col items-center">
                  <span
                    aria-hidden="true"
                    className={cn('z-10 mt-1 size-3 rounded-full ring-4 ring-card', color == null && type.solid)}
                    style={color != null ? { background: `var(--chart-${(color % 8) + 1})` } : undefined}
                  />
                  {i < appointments.length - 1 && <span aria-hidden="true" className="absolute top-4 bottom-0 w-px bg-border" />}
                </div>
                <div className={cn('min-w-0 flex-1 rounded-md border p-3', type.soft, a.status === 'completed' && 'opacity-70', a.status === 'noShow' && 'border-dashed border-danger')}>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {Icon && <Icon className="size-3.5" aria-hidden="true" strokeWidth={1.75} />}
                    <span className="text-meta font-medium">{t(`catalogue:appointmentType.${a.type}`)}</span>
                    <ToneBadge classes={appointmentStatusTone[a.status]} icon={appointmentStatusTone[a.status].icon ?? null}>{t(`catalogue:appointmentStatus.${a.status}`)}</ToneBadge>
                    {needsOutcome && <ToneBadge tone="warning">{t('today:appointments.needsOutcome')}</ToneBadge>}
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold">
                    {lead ? <Link to={paths.lead(lead.id)} className="hover:underline">{lead.name}</Link> : t('today:appointments.noLead')}
                  </p>
                  {(property || a.location?.text) && (
                    <p className="truncate text-meta text-muted-foreground">
                      {property ? `${property.title} · ${property.location.locality}` : a.location?.text}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {owner && ownerColor && (
                      <span className="mr-1 inline-flex items-center gap-1.5 text-meta text-muted-foreground"><UserAvatar name={owner.name} size="xs" />{owner.name}</span>
                    )}
                    {map && (
                      <Button asChild size="xs" variant="ghost">
                        <a href={map} target="_blank" rel="noopener noreferrer"><MapPin />{t('today:appointments.map')}</a>
                      </Button>
                    )}
                    {canConfirm && (
                      <Button size="xs" variant="ghost" className="text-success hover:bg-success-soft hover:text-success" onClick={() => act.sendConfirmation(a)} data-testid="send-confirmation">
                        <MessageCircle />{t('today:appointments.confirm')}
                      </Button>
                    )}
                    {a.status === 'confirmed' && !past && (
                      <span className="inline-flex items-center gap-1 text-meta text-success"><CheckCircle2 className="size-3.5" aria-hidden="true" />{t('today:appointments.confirmed')}</span>
                    )}
                    <Button asChild size="xs" variant="ghost">
                      <Link to={paths.appointment(a.id)}>{needsOutcome ? t('today:appointments.recordOutcome') : t('today:appointments.open')}</Link>
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}
      {planOpen && <AppointmentFormDialog open={planOpen} onOpenChange={setPlanOpen} />}
    </SectionCard>
  )
}
