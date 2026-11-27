/**
 * Appointment card (DESIGN_SYSTEM §11.6 week/day block, as a list card): `bg-appt-x-soft` with a 3 px left border in the
 * type colour, the time range, type icon and label, the client, the property / locality, the status (Completed ✓ at
 * 70%, Cancelled struck through, No-show dashed danger border, Confirmed solid dot) and the owner. Map link for visits.
 */
import type { ReactNode } from 'react'
import { MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { paths } from '@/app/paths'
import { ToneBadge } from '@/components/shared/badges'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import type { Appointment } from '@/domain/types'
import { useDb } from '@/hooks/use-db'
import { fmtDate, fmtTime } from '@/lib/format'
import { appointmentStatusTone, appointmentTypeTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { mapsLink, propertyAddress } from '@/lib/whatsapp'

const BORDER = {
  siteVisit: 'border-l-appt-site-visit', officeMeeting: 'border-l-appt-office', phoneCall: 'border-l-appt-call',
  videoCall: 'border-l-appt-video', documentation: 'border-l-appt-docs',
} as const

export function AppointmentCard({ appointment: a, showDate, actions, className }: {
  appointment: Appointment
  showDate?: boolean
  actions?: ReactNode
  className?: string
}) {
  const { t, i18n } = useTranslation(['domain', 'catalogue'])
  const lead = useDb((db) => db.leads.find((l) => l.id === a.leadId))
  const owner = useDb((db) => db.users.find((u) => u.id === a.ownerId))
  const property = useDb((db) => db.properties.find((p) => p.id === a.propertyIds[0]))
  const extra = a.propertyIds.length - 1
  const type = appointmentTypeTone[a.type]
  const status = appointmentStatusTone[a.status]
  const Icon = type.icon
  const end = new Date(new Date(a.start).getTime() + a.durationMin * 60_000).toISOString()
  const map = a.location?.mapUrl ?? (property ? mapsLink(propertyAddress(property)) : undefined)
  return (
    <article
      data-testid="appointment-card"
      className={cn(
        'group relative flex min-w-0 flex-wrap items-start gap-x-3 gap-y-2 rounded-md border border-l-[3px] p-3',
        type.soft, BORDER[a.type],
        a.status === 'completed' && 'opacity-70',
        a.status === 'noShow' && 'border-dashed border-danger',
        className,
      )}
    >
      <div className="w-16 shrink-0 text-meta tabular-nums">
        {showDate && <p className="text-muted-foreground">{fmtDate(a.start, i18n.language)}</p>}
        <p className="font-semibold">{fmtTime(a.start, i18n.language)}</p>
        <p className="text-muted-foreground">{fmtTime(end, i18n.language)}</p>
      </div>
      <div className="min-w-0 flex-1 basis-40">
        <p className="flex items-center gap-1.5 text-meta font-medium">
          {Icon && <Icon className="size-3.5" aria-hidden="true" strokeWidth={1.75} />}
          {t(`catalogue:appointmentType.${a.type}`)}
          {a.status === 'confirmed' && <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />}
        </p>
        <h3 className={cn('truncate text-sm font-semibold', a.status === 'cancelled' && 'line-through')}>
          <Link to={paths.appointment(a.id)} className="hover:underline focus-visible:underline focus-visible:outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-background">{lead?.name ?? t('domain:appointment.noLead')}</Link>
        </h3>
        <p className="truncate text-meta text-muted-foreground">
          {property ? `${property.title}${extra > 0 ? ` +${extra}` : ''} · ${property.location.locality}` : a.location?.text}
        </p>
      </div>
      <div className="relative z-[1] flex shrink-0 flex-col items-end gap-1.5">
        <ToneBadge classes={status} icon={status.icon}>{t(`catalogue:appointmentStatus.${a.status}`)}</ToneBadge>
        <span className="flex items-center gap-1">
          {map && a.type === 'siteVisit' && (
            <Button asChild variant="ghost" size="icon-xs"><a href={map} target="_blank" rel="noopener noreferrer" aria-label={t('domain:appointment.map')}><MapPin /></a></Button>
          )}
          {owner && <span title={owner.name}><UserAvatar name={owner.name} size="xs" /></span>}
        </span>
      </div>
      {actions && <div className="relative z-[1] ml-auto flex shrink-0 items-center">{actions}</div>}
    </article>
  )
}
