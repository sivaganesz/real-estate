/** Class names for calendar events by type and status (DESIGN_SYSTEM §11.6); tokens only. */
import type { Appointment } from '@/domain/types'
import { cn } from '@/lib/utils'

export const TYPE_BORDER = {
  siteVisit: 'border-l-appt-site-visit', officeMeeting: 'border-l-appt-office', phoneCall: 'border-l-appt-call',
  videoCall: 'border-l-appt-video', documentation: 'border-l-appt-docs',
} as const

export const TYPE_DOT = {
  siteVisit: 'bg-appt-site-visit', officeMeeting: 'bg-appt-office', phoneCall: 'bg-appt-call',
  videoCall: 'bg-appt-video', documentation: 'bg-appt-docs',
} as const

/** Completed ✓ at 70 %, Cancelled muted, No-show dashed danger border. */
export function statusClasses(a: Pick<Appointment, 'status'>) {
  return cn(
    a.status === 'completed' && 'opacity-70',
    a.status === 'cancelled' && 'border-l-stage-lost bg-muted text-muted-foreground opacity-80',
    a.status === 'noShow' && 'border border-dashed border-danger',
  )
}
