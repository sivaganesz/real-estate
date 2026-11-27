/**
 * Reschedule: a short list of slots (In 2 hours · Tomorrow 10:00 · Tomorrow 17:00 · In 3 days · Next Monday) plus
 * "Pick a date…", which turns the menu into a calendar (← back to the list). Picking closes the menu and calls
 * `onPick` with the new time; the caller writes it through a service. Ported from
 * wireframe-rebuild/src/features/leads/reschedule-button.tsx and widened with times.
 */
import { useState } from 'react'
import { ArrowLeft, CalendarClock, CalendarDays, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { MiniCalendar } from '@/components/shared/mini-calendar'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { localDay } from '@/lib/dates'
import { fmtDate, fmtTime } from '@/lib/format'
import { dayAt10, rescheduleSlots } from '../lib/slots'

const ITEM = 'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none'

export function RescheduleMenu({ now, onPick, label, iconOnly, current, disabled, disabledReason }: {
  now: Date
  onPick: (iso: string) => void
  label?: string
  iconOnly?: boolean
  current?: string
  disabled?: boolean
  disabledReason?: string
}) {
  const { t, i18n } = useTranslation('today')
  const [open, setOpen] = useState(false)
  const [calendar, setCalendar] = useState(false)
  const text = label ?? t('actions.reschedule')
  const pick = (iso: string) => {
    setOpen(false)
    setCalendar(false)
    onPick(iso)
  }
  const trigger = (
    <Button size={iconOnly ? 'icon-sm' : 'sm'} variant="ghost" disabled={disabled} aria-label={text} data-testid="today-reschedule">
      <CalendarClock />
      {!iconOnly && text}
    </Button>
  )
  if (disabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild><span className="inline-flex">{trigger}</span></TooltipTrigger>
        <TooltipContent>{disabledReason}</TooltipContent>
      </Tooltip>
    )
  }
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setCalendar(false) }}>
      {iconOnly ? (
        <Tooltip>
          <TooltipTrigger asChild><PopoverTrigger asChild>{trigger}</PopoverTrigger></TooltipTrigger>
          <TooltipContent>{text}</TooltipContent>
        </Tooltip>
      ) : <PopoverTrigger asChild>{trigger}</PopoverTrigger>}
      <PopoverContent align="end" className={calendar ? 'w-72 rounded-xl p-3' : 'w-64 rounded-xl p-2'}>
        {calendar ? (
          <>
            <button type="button" onClick={() => setCalendar(false)} className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-3.5" aria-hidden="true" /> {t('reschedule.back')}
            </button>
            <MiniCalendar value={current ? localDay(current) : undefined} today={localDay(now)} min={localDay(now)} onSelect={(day) => pick(dayAt10(day))} />
            <p className="mt-2 text-meta text-muted-foreground">{t('reschedule.at10')}</p>
          </>
        ) : (
          <>
            <p className="px-2 pt-1 pb-2 text-xs font-medium text-muted-foreground">
              {t('reschedule.title')}
              {current && <span className="block font-normal">{t('reschedule.now', { when: `${fmtDate(current, i18n.language)} ${fmtTime(current, i18n.language)}` })}</span>}
            </p>
            {rescheduleSlots(now).map((s) => (
              <button key={s.key} type="button" onClick={() => pick(s.at)} className={ITEM} data-testid={`slot-${s.key}`}>
                <span className="flex-1">{t(`reschedule.slot.${s.key}`)}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {s.key === 'in2h' ? fmtTime(s.at, i18n.language) : fmtDate(s.at, i18n.language).replace(/ \d{4}$/, '')}
                </span>
              </button>
            ))}
            <div className="my-1 border-t" />
            <button type="button" onClick={() => setCalendar(true)} className={ITEM}>
              <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="flex-1">{t('reschedule.pick')}</span>
              <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
