/**
 * Bulk actions on selected leads (master prompt §8, DESIGN_SYSTEM §11.7 bulk bar): Assign (managers/admins),
 * Change stage (one undo for all), Export CSV (lead.export) and Delete (confirm + undo; never for executives).
 * Booked / Converted need a property and amount per lead, so they are moved one at a time from the lead page.
 */
import { useState } from 'react'
import { ArrowRightLeft, Download, Trash2, UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { BulkBar } from '@/components/shared/bulk-bar'
import { Chip } from '@/components/shared/chip'
import { FormField } from '@/components/shared/form-field'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import type { ID, LostReason, PipelineStageKey } from '@/domain/types'
import { LOST_REASONS, STAGES } from '@/domain/catalogue'
import { usePermission } from '@/hooks/use-permission'
import { bulkChangeStage } from '@/services/leads'
import { downloadLeadsCsv } from './export-csv'
import { useLeadDialogs } from './lead-dialogs-context'
import type { LeadRow } from './use-lead-items'

const BULK_STAGES = STAGES.filter((s) => s !== 'booked' && s !== 'converted')

export function LeadsBulk({ selected, rows, onClear }: { selected: ReadonlySet<string>; rows: LeadRow[]; onClear: () => void }) {
  const { t } = useTranslation(['leads', 'catalogue', 'common'])
  const { can, scope } = usePermission()
  const dialogs = useLeadDialogs()
  const [stageOpen, setStageOpen] = useState(false)
  const chosen = rows.filter((r) => selected.has(r.lead.id))
  const ids: ID[] = chosen.map((r) => r.lead.id)

  const exportCsv = (list: LeadRow[]) => {
    downloadLeadsCsv(list, t, new Date())
    toast.success(t('leads:bulk.exported', { count: list.length }))
  }

  return (
    <>
      <BulkBar count={ids.length} onClear={onClear}>
        {scope('lead.assign') !== false && (
          <Button variant="ghost" size="sm" disabled={!chosen.every((r) => can('lead.assign', r.lead))} onClick={() => dialogs.open({ kind: 'assign', leadIds: ids })} data-testid="bulk-assign">
            <UserPlus />{t('leads:bulk.assign')}
          </Button>
        )}
        {scope('lead.moveStage') !== false && (
          <Button variant="ghost" size="sm" onClick={() => setStageOpen(true)} data-testid="bulk-stage"><ArrowRightLeft />{t('leads:bulk.stage')}</Button>
        )}
        {scope('lead.export') !== false && (
          <Button variant="ghost" size="sm" onClick={() => exportCsv(chosen)} data-testid="bulk-export"><Download />{t('leads:bulk.export')}</Button>
        )}
        {scope('lead.delete') !== false && (
          <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-soft hover:text-danger" disabled={!chosen.every((r) => can('lead.delete', r.lead))}
            onClick={() => dialogs.open({ kind: 'delete', leadIds: ids })} data-testid="bulk-delete">
            <Trash2 />{t('leads:bulk.delete')}
          </Button>
        )}
      </BulkBar>
      {stageOpen && <BulkStageDialog ids={ids} onClose={(done) => { setStageOpen(false); if (done) onClear() }} />}
    </>
  )
}

function BulkStageDialog({ ids, onClose }: { ids: ID[]; onClose: (done: boolean) => void }) {
  const { t } = useTranslation(['leads', 'catalogue', 'common', 'domain'])
  const [to, setTo] = useState<PipelineStageKey>('contacted')
  const [reason, setReason] = useState<LostReason | undefined>()
  const [note, setNote] = useState('')
  const [forwardOnly, setForwardOnly] = useState(true)
  const submit = () => {
    try {
      const r = bulkChangeStage(ids, to, to === 'lost' ? { lost: { reason: reason as LostReason, note: note.trim() || undefined } } : {}, { forwardOnly: to !== 'lost' && forwardOnly })
      toastUndo(t('leads:bulk.stageDone', { count: r.result, stage: t(`catalogue:stage.${to}`) }), r.undoToken,
        r.result < ids.length ? { description: t('leads:bulk.stageSkipped', { count: ids.length - r.result }) } : {})
      onClose(true)
    } catch (e) {
      toastError(e)
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('leads:bulk.stageTitle', { count: ids.length })}</DialogTitle>
          <DialogDescription>{t('leads:bulk.stageBody')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <FormField label={t('domain:stage.to')}>
            {() => (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('domain:stage.to')}>
                {BULK_STAGES.map((s) => <Chip key={s} size="sm" pressed={to === s} onClick={() => setTo(s)}>{t(`catalogue:stage.${s}`)}</Chip>)}
              </div>
            )}
          </FormField>
          {to === 'lost' ? (
            <>
              <FormField label={t('domain:stage.reason')} required>
                {() => (
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('domain:stage.reason')}>
                    {LOST_REASONS.map((r) => <Chip key={r} size="sm" pressed={reason === r} onClick={() => setReason(r)}>{t(`catalogue:lostReason.${r}`)}</Chip>)}
                  </div>
                )}
              </FormField>
              <FormField label={t('domain:stage.note')} optional>
                {({ id }) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}
              </FormField>
            </>
          ) : (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={forwardOnly} onCheckedChange={(v) => setForwardOnly(v === true)} />
              {t('leads:bulk.forwardOnly')}
            </label>
          )}
          <p className="text-meta text-muted-foreground">{t('leads:bulk.bookedNote')}</p>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onClose(false)}>{t('common:actions.cancel')}</Button>
          <Button onClick={submit} disabled={to === 'lost' && !reason} data-testid="bulk-stage-confirm">{t('leads:bulk.stageConfirm', { count: ids.length })}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
