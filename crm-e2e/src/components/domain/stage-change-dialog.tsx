/**
 * Move a lead to a stage (master prompt §11). Lost needs a reason (and an optional note); Booked needs the property
 * and the booking amount (deal value optional). Other stages just confirm. Validation errors show under the fields.
 * Used by the pipeline drag (Cancel returns the card) and the lead page.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AmountInput } from '@/components/shared/amount-input'
import { FormField } from '@/components/shared/form-field'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { LOST_REASONS, STAGES } from '@/domain/catalogue'
import type { ID, LostReason, PipelineStageKey } from '@/domain/types'
import { useDb } from '@/hooks/use-db'
import { usePermission } from '@/hooks/use-permission'
import { inrShort } from '@/lib/format'
import { isMatchable } from '@/lib/property'
import { stageTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { ValidationError, type FieldError } from '@/lib/validation'
import { changeStage } from '@/services/leads'

export function StageChangeDialog({ open, onOpenChange, leadId, to: initialTo, onDone, onCancel }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  leadId: ID
  /** Preselected target (from a drag); the user can still change it. */
  to?: PipelineStageKey
  onDone?: (to: PipelineStageKey) => void
  onCancel?: () => void
}) {
  const { t } = useTranslation(['domain', 'common', 'catalogue', 'pipeline'])
  const lead = useDb((db) => db.leads.find((l) => l.id === leadId))
  const properties = useDb((db) => db.properties)
  const stageDefs = useDb((db) => db.settings.pipeline.stages)
  // stages switched off in Settings → Pipeline are not offered (the lead's own stage stays listed so it reads right)
  const offered = STAGES.filter((s) => s === lead?.stage || s === initialTo || stageDefs.find((d) => d.key === s)?.enabled !== false)
  const { can } = usePermission()
  const [to, setTo] = useState<PipelineStageKey>(initialTo ?? lead?.stage ?? 'contacted')
  const [reason, setReason] = useState<LostReason | undefined>()
  const [note, setNote] = useState('')
  const [propertyId, setPropertyId] = useState<ID | undefined>(lead?.deal?.propertyId)
  const [booking, setBooking] = useState<number | undefined>(lead?.deal?.bookingAmount)
  const [value, setValue] = useState<number | undefined>(lead?.deal?.value)
  const [errors, setErrors] = useState<FieldError[]>([])
  const candidates = useMemo(() => {
    const ids = new Set(lead?.shortlist.map((s) => s.propertyId))
    return properties.filter((p) => isMatchable(p) || p.id === lead?.deal?.propertyId).sort((a, b) => Number(ids.has(b.id)) - Number(ids.has(a.id)))
  }, [properties, lead])
  if (!lead) return null
  const err = (field: string) => {
    const e = errors.find((x) => x.field === field)
    return e ? t(`common:validation.${e.key}`) : undefined
  }
  const allowed = (s: PipelineStageKey) => (s === 'booked' || s === 'converted' ? can('lead.markBooked', lead) : can('lead.moveStage', lead))

  const close = (o: boolean) => {
    if (!o) onCancel?.()
    onOpenChange(o)
  }
  const submit = () => {
    try {
      const extra = to === 'lost'
        ? { lost: { reason: reason as LostReason, note: note.trim() || undefined } }
        : to === 'booked' ? { deal: { propertyId, bookingAmount: booking, value: value ?? properties.find((p) => p.id === propertyId)?.price } } : {}
      const r = changeStage(lead.id, to, extra)
      toastUndo(t('domain:stage.done', { name: lead.name, stage: t(`catalogue:stage.${to}`) }), r.undoToken)
      setErrors([])
      onOpenChange(false)
      onDone?.(to)
    } catch (e) {
      if (e instanceof ValidationError) setErrors(e.errors)
      else toastError(e)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('domain:stage.title', { name: lead.name })}</DialogTitle>
          <DialogDescription>{t('domain:stage.from', { stage: t(`catalogue:stage.${lead.stage}`) })}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <FormField label={t('domain:stage.to')}>
            {({ id }) => (
              <Select value={to} onValueChange={(v) => { setTo(v as PipelineStageKey); setErrors([]) }}>
                <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {offered.map((s) => (
                    <SelectItem key={s} value={s} disabled={!allowed(s) || s === lead.stage}>
                      <span aria-hidden="true" className={cn('size-2 rounded-full', stageTone[s].solid)} />
                      {t(`catalogue:stage.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          {to === 'lost' && (
            <>
              <FormField label={t('domain:stage.reason')} required error={err('lost.reason')}>
                {({ id, invalid }) => (
                  <Select value={reason ?? ''} onValueChange={(v) => setReason(v as LostReason)}>
                    <SelectTrigger id={id} aria-invalid={invalid || undefined} className="w-full"><SelectValue placeholder={t('domain:stage.chooseReason')} /></SelectTrigger>
                    <SelectContent>{LOST_REASONS.map((r) => <SelectItem key={r} value={r}>{t(`catalogue:lostReason.${r}`)}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </FormField>
              <FormField label={t('domain:stage.note')} optional>
                {({ id }) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} rows={2} />}
              </FormField>
            </>
          )}
          {to === 'booked' && (
            <>
              <FormField label={t('domain:stage.property')} required error={err('deal.propertyId')}>
                {({ id, invalid }) => (
                  <Select value={propertyId ?? ''} onValueChange={setPropertyId}>
                    <SelectTrigger id={id} aria-invalid={invalid || undefined} className="w-full"><SelectValue placeholder={t('domain:stage.chooseProperty')} /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {candidates.map((p) => <SelectItem key={p.id} value={p.id}>{p.title} · {inrShort(p.price)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
              <FormField label={t('domain:stage.bookingAmount')} required error={err('deal.bookingAmount')}>
                {({ id, invalid, describedBy }) => <AmountInput id={id} value={booking} onChange={setBooking} invalid={invalid} describedBy={describedBy} />}
              </FormField>
              <FormField label={t('domain:stage.dealValue')} optional hint={t('domain:stage.dealValueHint')}>
                {({ id, describedBy }) => <AmountInput id={id} value={value} onChange={setValue} describedBy={describedBy} />}
              </FormField>
              <p className="text-meta text-muted-foreground">{t('pipeline:dialog.bookedHint')}</p>
            </>
          )}
          {to === 'lost' && <p className="text-meta text-muted-foreground">{t('pipeline:dialog.lostHint')}</p>}
          {to === 'converted' && <p className="text-meta text-muted-foreground" data-testid="converted-hint">{t('pipeline:dialog.convertedHint')}</p>}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => close(false)}>{t('common:actions.cancel')}</Button>
          <Button onClick={submit} disabled={to === lead.stage} data-testid="stage-confirm">{t('domain:stage.confirm', { stage: t(`catalogue:stage.${to}`) })}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
