/**
 * Calendar event pieces (DESIGN_SYSTEM §11.6): the positioned block for the day / week grid and the 20 px chip for the
 * month grid. Colour by type (`bg-appt-x-soft` + 3 px left border in `appt-x`); status modifiers: Completed ✓ at 70 %,
 * Cancelled struck through in muted colours, No-show dashed danger border, Confirmed solid dot; a clash gets the striped
 * danger overlay and a warning badge.
 */
import type { CSSProperties } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { paths } from '@/app/paths'
import type { Appointment } from '@/domain/types'
import { fmtTime } from '@/lib/format'
import { appointmentTypeTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { statusClasses, TYPE_BORDER } from '../lib/event-style'
import type { EventInfo } from './use-event-info'

const CLASH_STYLE: CSSProperties = { backgroundImage: 'repeating-linear-gradient(45deg, var(--danger-soft) 0 6px, transparent 6px 12px)' }

function useLabel(a: Appointment, info: EventInfo | undefined) {
  const { t, i18n } = useTranslation(['appointments', 'catalogue'])
  const who = info?.lead?.name ?? t('appointments:noLead')
  const end = new Date(new Date(a.start).getTime() + a.durationMin * 60_000).toISOString()
  const range = `${fmtTime(a.start, i18n.language)} – ${fmtTime(end, i18n.language)}`
  const aria = t('appointments:event.aria', {
    type: t(`catalogue:appointmentType.${a.type}`), who, range, status: t(`catalogue:appointmentStatus.${a.status}`),
  })
  return { who, range, aria, short: fmtTime(a.start, i18n.language) }
}

export function EventBlock({ a, info, clash, style, compact }: { a: Appointment; info?: EventInfo; clash?: boolean; style?: CSSProperties; compact?: boolean }) {
  const { t } = useTranslation('appointments')
  const { who, range, aria, short } = useLabel(a, info)
  const Icon = appointmentTypeTone[a.type].icon
  // Short blocks (15-minute calls) have room for one line only: the start time and the client.
  const tight = typeof style?.height === 'number' && style.height < 30
  return (
    <Link
      to={paths.appointment(a.id)}
      data-testid="calendar-event"
      aria-label={clash ? `${aria} · ${t('event.clash')}` : aria}
      style={style}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'absolute z-[2] flex flex-col overflow-hidden rounded-md border-l-[3px] px-1.5 text-left text-meta leading-tight shadow-xs outline-none',
        tight ? 'justify-center py-0' : 'py-0.5',
        'transition-shadow hover:z-[3] hover:shadow-md focus-visible:z-[3] focus-visible:ring-2 focus-visible:ring-ring',
        appointmentTypeTone[a.type].soft, TYPE_BORDER[a.type], statusClasses(a),
      )}
    >
      {clash && <span aria-hidden="true" className="pointer-events-none absolute inset-0" style={CLASH_STYLE} />}
      <span className="relative flex items-center gap-1 font-semibold tabular-nums">
        {a.status === 'completed' ? <CheckCircle2 className="size-3 shrink-0 text-success" aria-hidden="true" /> : Icon && <Icon className="size-3 shrink-0" aria-hidden="true" />}
        <span className={tight ? 'shrink-0' : 'truncate'}>{tight ? short : range}</span>
        {tight && <span className={cn('truncate font-medium text-foreground', a.status === 'cancelled' && 'line-through')}>{who}</span>}
        {a.status === 'confirmed' && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-primary" />}
        {clash && <AlertTriangle className="ml-auto size-3 shrink-0 text-danger" aria-hidden="true" />}
      </span>
      {!tight && <span className={cn('relative truncate font-medium text-foreground', a.status === 'cancelled' && 'text-muted-foreground line-through')}>{who}</span>}
      {!compact && info?.place && <span className="relative truncate text-muted-foreground">{info.place}</span>}
    </Link>
  )
}

export function EventChip({ a, info, clash }: { a: Appointment; info?: EventInfo; clash?: boolean }) {
  const { t } = useTranslation('appointments')
  const { who, aria, short } = useLabel(a, info)
  return (
    <Link
      to={paths.appointment(a.id)}
      data-testid="calendar-chip"
      aria-label={clash ? `${aria} · ${t('event.clash')}` : aria}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'relative flex h-5 min-w-0 items-center gap-1 overflow-hidden rounded-xs border-l-[3px] px-1 text-meta outline-none hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring',
        appointmentTypeTone[a.type].soft, TYPE_BORDER[a.type], statusClasses(a),
      )}
    >
      {clash && <span aria-hidden="true" className="pointer-events-none absolute inset-0" style={CLASH_STYLE} />}
      <span className="relative shrink-0 font-semibold tabular-nums">{short}</span>
      <span className={cn('relative truncate text-foreground', a.status === 'cancelled' && 'line-through')}>{who}</span>
    </Link>
  )
}
