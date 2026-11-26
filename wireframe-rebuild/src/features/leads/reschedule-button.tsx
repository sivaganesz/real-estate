/**
 * Schedule / Reschedule: plan the next follow-up. "Schedule" when none is planned, "Reschedule" when one is.
 * A short list (Tomorrow · In 3 days · Next week) plus "Pick a date…", which turns the menu into a calendar (← back to the list).
 * Picking closes the menu and only changes the Next step card: planning is not written on the Activity timeline (agreed 26 Nov).
 * Without consent to follow up it's disabled, with the reason on hover (spec, Module B · A).
 */
import { useState } from 'react'
import { ArrowLeft, CalendarClock, CalendarDays, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { MiniCalendar } from '@/components/app/mini-calendar'
import { addDays, fmtDate } from '@/lib/format'

const WHEN = [[1, 'tomorrow'], [3, 'in3'], [7, 'nextWeek']] as const
const ITEM = 'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted'

export function RescheduleButton({ current, today, canSchedule, onPick }: {
  /** The follow-up date it has now, if any. */
  current?: string
  today: string
  canSchedule: boolean
  onPick: (date: string) => void
}) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [calendar, setCalendar] = useState(false)
  const label = current ? t('lead.reschedule') : t('lead.schedule')
  if (!canSchedule) {
    // a disabled button gets no hover events, so the hint sits on a wrapper
    return <span title={t('lead.consentFirst')}><Button size="sm" variant="outline" disabled><CalendarClock /> {label}</Button></span>
  }
  // closing from code doesn't call onOpenChange, so go back to the list here too
  const pick = (date: string) => { setOpen(false); setCalendar(false); onPick(date) }
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setCalendar(false) }}>
      <PopoverTrigger asChild><Button size="sm" variant="outline"><CalendarClock /> {label}</Button></PopoverTrigger>
      <PopoverContent align="end" className={calendar ? 'w-72 rounded-xl p-3' : 'w-56 rounded-xl p-2'}>
        {calendar ? (
          <>
            <button type="button" onClick={() => setCalendar(false)} className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-3.5" /> {t('lead.newDate')}
            </button>
            <MiniCalendar value={current} today={today} min={today} onSelect={pick} />
          </>
        ) : (
          <>
            <p className="px-2 pt-1 pb-2 text-xs font-medium text-muted-foreground">
              {current ? t('lead.rescheduleTo') : t('lead.scheduleFor')}
              {current && <span className="block font-normal">{t('lead.rescheduleNow', { date: fmtDate(current, i18n.language) })}</span>}
            </p>
            {WHEN.map(([d, k]) => {
              const date = addDays(today, d)
              return (
                <button key={k} type="button" onClick={() => pick(date)} className={ITEM}>
                  <span className="flex-1">{t(`today.when.${k}`)}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{fmtDate(date, i18n.language).replace(/ \d{4}$/, '')}</span>
                </button>
              )
            })}
            <div className="my-1 border-t" />
            <button type="button" onClick={() => setCalendar(true)} className={ITEM}>
              <CalendarDays className="size-4 text-muted-foreground" /> <span className="flex-1">{t('lead.pickDate')}</span> <ChevronRight className="size-3.5 text-muted-foreground" />
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
