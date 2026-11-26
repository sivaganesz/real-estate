/**
 * ✓ Done — and when is the next follow-up? Used on the lead page and in the Leads "Today" list.
 * Without the customer's consent to follow up, only "No follow-up" can be chosen (spec, Module B · A).
 */
import { useState } from 'react'
import { Check, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const WHEN = [[1, 'tomorrow'], [3, 'in3'], [7, 'nextWeek'], [null, 'none']] as const

export function DoneButton({ onDone, canSchedule, className, size = 'sm', variant = 'default', label = true }: {
  /** Days until the next follow-up, or null for none. */
  onDone: (days: number | null) => void
  canSchedule: boolean
  className?: string
  size?: 'sm' | 'default' | 'icon-sm'
  variant?: 'default' | 'outline'
  label?: boolean
}) {
  const { t } = useTranslation()
  // controlled, so picking an option closes the menu
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size={size} variant={variant} className={className} title={t('today.done')}><Check />{label && t('today.done')}</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 rounded-xl p-2">
        <p className="px-2 pt-1 pb-2 text-xs font-medium text-muted-foreground">{t('today.nextWhen')}</p>
        {WHEN.map(([d, k]) => (
          <button key={k} type="button" onClick={() => { setOpen(false); onDone(d) }} disabled={d !== null && !canSchedule}
            className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:pointer-events-none disabled:opacity-50">
            {t(`today.when.${k}`)}
          </button>
        ))}
        {!canSchedule && (
          <p className="flex items-center gap-1.5 px-2 pt-1.5 pb-1 text-xs text-danger"><ShieldCheck className="size-3.5 shrink-0" /> {t('lead.consentFirst')}</p>
        )}
      </PopoverContent>
    </Popover>
  )
}
