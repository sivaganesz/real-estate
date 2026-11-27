/**
 * Log outcome, in one popover: what happened on the call (Connected · Not reachable · Busy · Wrong number), an optional
 * note and an optional next follow-up. Nothing is written until Save. The caller decides what Save does (complete
 * the task with the result, or log a call on the lead); "Not reachable" and "Busy" create the retry task (E4).
 */
import { useState, type ReactNode } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Chip } from '@/components/shared/chip'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Task } from '@/domain/types'
import { localAt } from '@/lib/dates'

export type CallResult = NonNullable<Task['callResult']>
const RESULTS: CallResult[] = ['connected', 'notReachable', 'busy', 'wrongNumber']
type Follow = 'none' | 'tomorrow' | 'in3days' | 'nextWeek'
const FOLLOWS: Follow[] = ['none', 'tomorrow', 'in3days', 'nextWeek']

export type OutcomeInput = { result: CallResult; note: string; followUpAt?: string }

function followUpAt(f: Follow, now: Date): string | undefined {
  if (f === 'tomorrow') return localAt(now, 1, '10:00')
  if (f === 'in3days') return localAt(now, 3, '10:00')
  if (f === 'nextWeek') return localAt(now, 7, '10:00')
  return undefined
}

export function LogOutcome({ name, now, onSave, open, onOpenChange, iconOnly, trigger }: {
  name: string
  now: Date
  onSave: (o: OutcomeInput) => void
  open: boolean
  onOpenChange: (o: boolean) => void
  iconOnly?: boolean
  trigger?: ReactNode
}) {
  const { t } = useTranslation('today')
  const [result, setResult] = useState<CallResult>('connected')
  const [note, setNote] = useState('')
  const [follow, setFollow] = useState<Follow>('none')
  const reset = () => { setResult('connected'); setNote(''); setFollow('none') }
  const save = () => {
    onSave({ result, note: note.trim(), followUpAt: followUpAt(follow, now) })
    reset()
    onOpenChange(false)
  }
  const btn = trigger ?? (
    <Button size={iconOnly ? 'icon-sm' : 'sm'} variant="ghost" aria-label={t('actions.logOutcome')} data-testid="today-log">
      <ClipboardCheck />
      {!iconOnly && t('actions.logOutcome')}
    </Button>
  )
  return (
    <Popover open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      {iconOnly ? (
        <Tooltip>
          <TooltipTrigger asChild><PopoverTrigger asChild>{btn}</PopoverTrigger></TooltipTrigger>
          <TooltipContent>{t('actions.logOutcome')}</TooltipContent>
        </Tooltip>
      ) : <PopoverTrigger asChild>{btn}</PopoverTrigger>}
      <PopoverContent align="end" className="w-80 rounded-xl p-4" data-testid="log-outcome">
        <p className="text-sm font-semibold">{t('log.title', { name })}</p>
        <fieldset className="mt-3">
          <legend className="mb-1.5 text-meta font-medium text-muted-foreground">{t('log.result')}</legend>
          <div className="flex flex-wrap gap-1.5">
            {RESULTS.map((r) => <Chip key={r} size="sm" pressed={result === r} onClick={() => setResult(r)} data-testid={`result-${r}`}>{t(`log.results.${r}`)}</Chip>)}
          </div>
          {(result === 'notReachable' || result === 'busy') && <p className="mt-1.5 text-meta text-muted-foreground">{t('log.retryHint')}</p>}
        </fieldset>
        <div className="mt-3 flex flex-col gap-1.5">
          <Label htmlFor="today-log-note" className="text-meta text-muted-foreground">{t('log.note')}</Label>
          <Textarea id="today-log-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={t('log.notePlaceholder')} className="min-h-14 text-sm" />
        </div>
        <fieldset className="mt-3">
          <legend className="mb-1.5 text-meta font-medium text-muted-foreground">{t('log.next')}</legend>
          <div className="flex flex-wrap gap-1.5">
            {FOLLOWS.map((f) => <Chip key={f} size="sm" pressed={follow === f} onClick={() => setFollow(f)}>{t(`log.follow.${f}`)}</Chip>)}
          </div>
        </fieldset>
        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>{t('common:actions.cancel')}</Button>
          <Button size="sm" onClick={save} data-testid="log-save">{t('log.save')}</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
