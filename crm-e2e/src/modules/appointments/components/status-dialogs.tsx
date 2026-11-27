/**
 * Reschedule and cancel (master prompt §16 statuses). Reschedule picks a new time with free-slot suggestions and the
 * non-blocking clash warning; the status becomes "rescheduled" and the old time is kept (E9). Cancel asks for a reason
 * (quick chips or free text) and offers Undo; a reschedule task follows from E8.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConflictNotice, SlotSuggestions } from '@/components/domain/appointment-form-dialog'
import { Chip } from '@/components/shared/chip'
import { DateTimeField } from '@/components/shared/date-time-field'
import { FormField } from '@/components/shared/form-field'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import type { Appointment } from '@/domain/types'
import { useDb } from '@/hooks/use-db'
import { localDay } from '@/lib/dates'
import { fmtDateTime } from '@/lib/format'
import { cancelAppointment, findConflicts, rescheduleAppointment } from '@/services/appointments'
import { toast } from 'sonner'

export function RescheduleDialog({ appointment: a, open, onOpenChange }: { appointment: Appointment; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation(['appointments', 'common'])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="reschedule-dialog">
        <DialogHeader>
          <DialogTitle>{t('reschedule.title')}</DialogTitle>
          <DialogDescription>{t('reschedule.body')}</DialogDescription>
        </DialogHeader>
        {open && <RescheduleBody a={a} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function RescheduleBody({ a, onDone }: { a: Appointment; onDone: () => void }) {
  const { t, i18n } = useTranslation(['appointments', 'common'])
  const appointments = useDb((db) => db.appointments)
  const owner = useDb((db) => db.users.find((u) => u.id === a.ownerId))
  const [start, setStart] = useState<string | undefined>()
  const conflicts = start ? findConflicts({ appointments }, { id: a.id, ownerId: a.ownerId, start, durationMin: a.durationMin }) : []
  const save = () => {
    if (!start) return
    try {
      rescheduleAppointment(a.id, start)
      toast.success(t('reschedule.done', { when: fmtDateTime(start, i18n.language) }))
      if (conflicts.length) toast.warning(t('conflict.saved', { count: conflicts.length }))
      onDone()
    } catch (e) {
      toastError(e)
    }
  }
  return (
    <>
      <div className="flex flex-col gap-3">
        <p className="text-meta text-muted-foreground">{t('reschedule.current', { when: fmtDateTime(a.start, i18n.language) })}</p>
        <FormField label={t('reschedule.newTime')} required>
          {({ id }) => <DateTimeField id={id} value={start} onChange={setStart} />}
        </FormField>
        <SlotSuggestions ownerId={a.ownerId} type={a.type} durationMin={a.durationMin} day={start ? localDay(start) : undefined} excludeId={a.id} onPick={setStart} />
        <ConflictNotice conflicts={conflicts} ownerName={owner?.name ?? ''} />
      </div>
      <DialogFooter>
        <Button variant="secondary" onClick={onDone}>{t('common:actions.cancel')}</Button>
        <Button onClick={save} disabled={!start} data-testid="reschedule-save">{conflicts.length ? t('conflict.bookAnyway') : t('reschedule.save')}</Button>
      </DialogFooter>
    </>
  )
}

const REASONS = ['clientBusy', 'clientUnwell', 'propertyUnavailable', 'weather', 'execUnavailable'] as const

export function CancelDialog({ appointment: a, open, onOpenChange }: { appointment: Appointment; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation(['appointments', 'common'])
  const [reason, setReason] = useState('')
  const confirm = () => {
    try {
      const r = cancelAppointment(a.id, reason)
      toastUndo(t('cancel.done'), r.undoToken, { description: t('cancel.taskNote') })
      onOpenChange(false)
      setReason('')
    } catch (e) {
      toastError(e)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="cancel-dialog">
        <DialogHeader>
          <DialogTitle>{t('cancel.title')}</DialogTitle>
          <DialogDescription>{t('cancel.body')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('cancel.reason')}>
            {REASONS.map((r) => {
              const label = t(`cancel.reasons.${r}`)
              return <Chip key={r} size="sm" pressed={reason === label} onClick={() => setReason(reason === label ? '' : label)}>{label}</Chip>
            })}
          </div>
          <FormField label={t('cancel.reason')} optional>
            {({ id }) => <Textarea id={id} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />}
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>{t('cancel.keep')}</Button>
          <Button variant="destructive" onClick={confirm} data-testid="cancel-confirm">{t('cancel.confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
