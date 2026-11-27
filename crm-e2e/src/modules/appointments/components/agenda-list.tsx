/**
 * List view: appointments grouped by day with sticky day labels ("Today · Fri 27 Nov"), each as an appointment card with
 * its quick actions (Log outcome / Confirm + menu). Also used for the week view on a phone.
 */
import { useTranslation } from 'react-i18next'
import { AppointmentCard } from '@/components/domain/appointment-card'
import { CountBadge } from '@/components/shared/badges'
import type { Appointment, ID } from '@/domain/types'
import { addDaysToDay, localDay, parseLocalDay } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { groupByDay } from '../lib/calendar'
import { AppointmentActions } from './appointment-actions'

export function AgendaList({ items, now, clashes, className }: { items: Appointment[]; now: Date; clashes: Set<ID>; className?: string }) {
  const { t, i18n } = useTranslation('appointments')
  const locale = i18n.language === 'ta' ? 'ta-IN' : 'en-IN'
  const today = localDay(now)
  const groups = groupByDay(items)
  return (
    <div className={cn('flex flex-col gap-5', className)} data-testid="agenda-list">
      {groups.map((g) => {
        const rel = g.day === today ? t('day.today') : g.day === addDaysToDay(today, 1) ? t('day.tomorrow') : g.day === addDaysToDay(today, -1) ? t('day.yesterday') : null
        const date = parseLocalDay(g.day).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
        return (
          <section key={g.day} aria-label={rel ? `${rel} · ${date}` : date}>
            <h3 className="sticky top-14 z-[5] -mx-1 mb-2 flex items-center gap-2 bg-background/90 px-1 py-1 text-ui font-semibold backdrop-blur">
              <span className={cn(g.day === today && 'text-primary')}>{rel ? `${rel} · ${date}` : date}</span>
              <CountBadge count={g.items.length} />
            </h3>
            <div className="flex flex-col gap-2">
              {g.items.map((a) => (
                <div key={a.id} className="relative">
                  <AppointmentCard appointment={a} className={cn(clashes.has(a.id) && 'ring-2 ring-danger/40')} actions={<AppointmentActions appointment={a} variant="menu" />} />
                  {clashes.has(a.id) && <span className="sr-only">{t('event.clash')}</span>}
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
