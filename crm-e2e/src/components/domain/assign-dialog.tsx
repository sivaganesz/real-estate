/**
 * Assign leads (master prompt §10): "Auto (lowest workload)" with a preview of who gets each lead and why, or a chosen
 * executive (avatar, active leads, availability; on-leave people are shown but disabled). An optional note goes into
 * the assignment history. Confirm → services/assignments → toast with Undo.
 */
import { useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import type { ID } from '@/domain/types'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useWholeDb } from '@/hooks/use-db'
import { cn } from '@/lib/utils'
import { assignableUsers, assignLeads, previewAuto } from '@/services/assignments'
import { activeLeadCount } from '@/services/queries/lookups'

export function AssignDialog({ open, onOpenChange, leadIds, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; leadIds: ID[]; onDone?: () => void }) {
  const { t } = useTranslation(['domain', 'common', 'catalogue'])
  const db = useWholeDb()
  const user = useCurrentUser()
  const [target, setTarget] = useState<string>('auto')
  const [note, setNote] = useState('')
  const people = useMemo(() => assignableUsers(db, user), [db, user])
  const preview = useMemo(() => (open && target === 'auto' ? previewAuto(db, leadIds, user) : []), [open, target, db, leadIds, user])
  const names = (id: ID | null) => db.users.find((u) => u.id === id)?.name ?? t('domain:assign.nobody')
  const leadName = (id: ID) => db.leads.find((l) => l.id === id)?.name ?? id

  const submit = () => {
    try {
      const r = assignLeads(leadIds, target === 'auto' ? 'auto' : target, note.trim() || undefined)
      const to = target === 'auto' ? t('domain:assign.autoShort') : names(target)
      toastUndo(t('domain:assign.done', { count: r.result.length, to }), r.undoToken)
      onOpenChange(false)
      setNote('')
      onDone?.()
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{leadIds.length === 1 ? t('domain:assign.titleOne', { name: leadName(leadIds[0]) }) : t('domain:assign.titleMany', { count: leadIds.length })}</DialogTitle>
          <DialogDescription>{t('domain:assign.body')}</DialogDescription>
        </DialogHeader>
        <RadioGroup value={target} onValueChange={setTarget} className="max-h-[50vh] gap-1.5 overflow-y-auto pr-1">
          <label className={cn('flex cursor-pointer items-center gap-3 rounded-md border p-2.5', target === 'auto' && 'border-ai-border bg-ai-soft/40')}>
            <RadioGroupItem value="auto" />
            <span className="flex size-8 items-center justify-center rounded-full bg-ai-gradient text-ai-foreground"><Sparkles className="size-4" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{t('domain:assign.auto')}</span>
              <span className="block text-meta text-muted-foreground">{t('domain:assign.autoHint')}</span>
            </span>
          </label>
          {people.map((u) => {
            const off = u.availability === 'onLeave'
            return (
              <label key={u.id} className={cn('flex cursor-pointer items-center gap-3 rounded-md border p-2.5', target === u.id && 'border-primary/40 bg-primary-soft/50', off && 'cursor-not-allowed opacity-60')}>
                <RadioGroupItem value={u.id} disabled={off} />
                <UserAvatar name={u.name} size="sm" availability={u.availability} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{u.name}</span>
                  <span className="block text-meta text-muted-foreground">{t('common:availability.' + u.availability)} · {t('domain:assign.active', { count: activeLeadCount(db, u.id) })}</span>
                </span>
              </label>
            )
          })}
        </RadioGroup>
        {target === 'auto' && preview.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-md bg-muted/60 p-2.5 text-meta" aria-label={t('domain:assign.preview')}>
            {preview.slice(0, 6).map((p) => (
              <li key={p.leadId} className="flex items-center justify-between gap-2">
                <span className="truncate">{leadName(p.leadId)} → <strong>{names(p.to)}</strong></span>
                <span className="shrink-0 text-muted-foreground">{t(`catalogue:assignmentReason.${p.reasonKey}`)}</span>
              </li>
            ))}
          </ul>
        )}
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('domain:assign.notePlaceholder')} aria-label={t('domain:assign.note')} rows={2} />
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>{t('common:actions.cancel')}</Button>
          <Button onClick={submit} disabled={!leadIds.length} data-testid="assign-confirm">{t('domain:assign.confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
