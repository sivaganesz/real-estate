/**
 * Add a task / follow-up (master prompt §17). Smart-required: title + due date + related lead (the lead is optional
 * for personal to-dos). Type chips suggest a title ("Call Priya Sharma"); priority defaults to medium; managers can
 * give it to an executive.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Chip } from '@/components/shared/chip'
import { DateTimeField } from '@/components/shared/date-time-field'
import { FormField } from '@/components/shared/form-field'
import { toastError } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PRIORITIES, TASK_TYPES } from '@/domain/catalogue'
import type { ID, Priority, TaskType } from '@/domain/types'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useDb } from '@/hooks/use-db'
import { priorityTone } from '@/lib/tones'
import { ValidationError, type FieldError } from '@/lib/validation'
import { createTask } from '@/services/tasks'
import { LeadSelect } from './lead-select'

export function TaskFormDialog({ open, onOpenChange, leadId: initialLead, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; leadId?: ID; onSaved?: (id: ID) => void }) {
  const { t } = useTranslation(['domain', 'common', 'catalogue'])
  const user = useCurrentUser()
  const leads = useDb((db) => db.leads)
  const executives = useDb((db) => db.users.filter((u) => u.role === 'executive' && u.status === 'active'))
  const [leadId, setLeadId] = useState<ID | undefined>(initialLead)
  const [type, setType] = useState<TaskType>('call')
  const [title, setTitle] = useState('')
  const [touched, setTouched] = useState(false)
  const [dueAt, setDueAt] = useState<string | undefined>()
  const [priority, setPriority] = useState<Priority>('medium')
  const [ownerId, setOwnerId] = useState<ID | undefined>()
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<FieldError[]>([])
  const lead = leads.find((l) => l.id === leadId)
  const suggested = lead ? t(`domain:task.suggest.${type}`, { name: lead.name }) : ''
  const shownTitle = touched ? title : title || suggested
  const owner = ownerId ?? (user.role === 'executive' ? user.id : lead?.ownerId ?? user.id)
  const err = (f: string) => {
    const e = errors.find((x) => x.field === f)
    return e ? t(`common:validation.${e.key}`) : undefined
  }
  const save = () => {
    try {
      const r = createTask({ title: shownTitle.trim(), type, leadId, dueAt: dueAt ?? '', priority, ownerId: owner, notes: notes.trim() || undefined })
      toast.success(t('domain:task.saved', { title: shownTitle.trim() }))
      setErrors([])
      onOpenChange(false)
      onSaved?.(r.id)
    } catch (e) {
      if (e instanceof ValidationError) setErrors(e.errors)
      else toastError(e)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('domain:task.newTitle')}</DialogTitle>
          <DialogDescription>{t('domain:task.newBody')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <FormField label={t('domain:form.lead')} optional hint={t('domain:task.leadHint')}>
            {({ id, describedBy }) => <LeadSelect id={id} value={leadId} onChange={setLeadId} describedBy={describedBy} />}
          </FormField>
          <FormField label={t('domain:form.type')}>
            {() => (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('domain:form.type')}>
                {TASK_TYPES.map((v) => <Chip key={v} size="sm" pressed={type === v} onClick={() => setType(v)}>{t(`catalogue:taskType.${v}`)}</Chip>)}
              </div>
            )}
          </FormField>
          <FormField label={t('domain:form.title')} required error={err('title')}>
            {({ id, invalid, describedBy }) => <Input id={id} value={shownTitle} onChange={(e) => { setTitle(e.target.value); setTouched(true) }} aria-invalid={invalid || undefined} aria-describedby={describedBy} />}
          </FormField>
          <FormField label={t('domain:form.due')} required error={err('dueAt')}>
            {({ id, invalid, describedBy }) => <DateTimeField id={id} value={dueAt} onChange={setDueAt} invalid={invalid} describedBy={describedBy} />}
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('domain:form.priority')}>
              {({ id }) => (
                <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                  <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => {
                      const Icon = priorityTone[p].icon
                      return <SelectItem key={p} value={p}>{Icon && <Icon className={priorityTone[p].text} aria-hidden="true" />}{t(`catalogue:priority.${p}`)}</SelectItem>
                    })}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            {user.role !== 'executive' && (
              <FormField label={t('domain:form.owner')}>
                {({ id }) => (
                  <Select value={owner} onValueChange={setOwnerId}>
                    <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{[user, ...executives.filter((u) => u.id !== user.id)].map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </FormField>
            )}
          </div>
          <FormField label={t('domain:form.notes')} optional>
            {({ id }) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />}
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>{t('common:actions.cancel')}</Button>
          <Button onClick={save} data-testid="task-save">{t('domain:task.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
