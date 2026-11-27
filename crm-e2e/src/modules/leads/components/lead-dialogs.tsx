/**
 * One place that opens the lead dialogs (log activity, site visit, follow-up, stage change, assign, request
 * reassignment, delete with undo) so the list rows, cards, the Today design and the lead page share them.
 * Delete always confirms and offers Undo; executives never see it (lead.delete is denied for them).
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AppointmentFormDialog } from '@/components/domain/appointment-form-dialog'
import { AssignDialog } from '@/components/domain/assign-dialog'
import { LogActivityDialog } from '@/components/domain/log-activity-dialog'
import { StageChangeDialog } from '@/components/domain/stage-change-dialog'
import { TaskFormDialog } from '@/components/domain/task-form-dialog'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { ID } from '@/domain/types'
import { useDb } from '@/hooks/use-db'
import { deleteLeads, requestReassign } from '@/services/leads'
import { LeadDialogsContext, type OpenLeadDialog as Open } from './lead-dialogs-context'

export function LeadDialogsProvider({ children, onDeleted }: { children: ReactNode; onDeleted?: (ids: ID[]) => void }) {
  const { t } = useTranslation(['leads', 'common'])
  const [cur, setCur] = useState<Open | null>(null)
  // a stable key per opening so each dialog starts fresh
  const [n, setN] = useState(0)
  const open = useCallback((o: Open) => { setCur(o); setN((x) => x + 1) }, [])
  const close = () => setCur(null)
  const names = useDb((db) => {
    const ids = cur?.kind === 'delete' || cur?.kind === 'assign' ? cur.leadIds : cur ? [cur.leadId] : []
    return ids.map((id) => db.leads.find((l) => l.id === id)?.name ?? id).join(', ')
  })
  const [note, setNote] = useState('')
  const api = useMemo(() => ({ open }), [open])

  const doDelete = (ids: ID[]) => {
    try {
      const r = deleteLeads(ids)
      toastUndo(t('leads:delete.done', { count: ids.length, name: names }), r.undoToken)
      onDeleted?.(ids)
    } catch (e) {
      toastError(e)
    }
    close()
  }

  return (
    <LeadDialogsContext.Provider value={api}>
      {children}
      {cur?.kind === 'log' && <LogActivityDialog key={n} open onOpenChange={(o) => !o && close()} leadId={cur.leadId} channel={cur.channel} />}
      {cur?.kind === 'visit' && <AppointmentFormDialog key={n} open onOpenChange={(o) => !o && close()} leadId={cur.leadId} propertyIds={cur.propertyIds} type="siteVisit" />}
      {cur?.kind === 'task' && <TaskFormDialog key={n} open onOpenChange={(o) => !o && close()} leadId={cur.leadId} />}
      {cur?.kind === 'stage' && <StageChangeDialog key={n} open onOpenChange={(o) => !o && close()} leadId={cur.leadId} to={cur.to} />}
      {cur?.kind === 'assign' && <AssignDialog key={n} open onOpenChange={(o) => !o && close()} leadIds={cur.leadIds} />}
      {cur?.kind === 'requestReassign' && (
        <Dialog open onOpenChange={(o) => !o && close()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('leads:reassign.title', { name: names })}</DialogTitle>
              <DialogDescription>{t('leads:reassign.body')}</DialogDescription>
            </DialogHeader>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder={t('leads:reassign.placeholder')} aria-label={t('leads:reassign.note')} />
            <DialogFooter>
              <Button variant="secondary" onClick={close}>{t('common:actions.cancel')}</Button>
              <Button
                data-testid="request-reassign-send"
                onClick={() => {
                  try {
                    requestReassign(cur.leadId, note.trim() || undefined)
                    toast.success(t('leads:reassign.sent'))
                    setNote('')
                    close()
                  } catch (e) {
                    toastError(e)
                  }
                }}
              >
                {t('leads:reassign.send')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {cur?.kind === 'delete' && (
        <ConfirmDialog
          open onOpenChange={(o) => !o && close()} tone="danger"
          title={t('leads:delete.title', { count: cur.leadIds.length, name: names })}
          description={t('leads:delete.body', { count: cur.leadIds.length })}
          confirmLabel={t('leads:delete.confirm', { count: cur.leadIds.length })}
          onConfirm={() => doDelete(cur.leadIds)}
        />
      )}
    </LeadDialogsContext.Provider>
  )
}
