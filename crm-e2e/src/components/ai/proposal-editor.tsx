/**
 * The Edit form of an action proposal: only the values that matter for that change (when, who, which stage, the
 * title, the name and phone). "Apply" rebuilds the proposal (ai/revise.ts); nothing runs until Confirm.
 */
import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { editValues, editableFields, reviseProposal, type ProposalEdits } from '@/ai/revise'
import type { ActionProposal } from '@/ai/types'
import { DateTimeField } from '@/components/shared/date-time-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { APPOINTMENT_TYPES, LOST_REASONS, STAGES } from '@/domain/catalogue'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useDb } from '@/hooks/use-db'

export function ProposalEditor({ proposal, onApply, onCancel }: { proposal: ActionProposal; onApply: (p: ActionProposal) => void; onCancel: () => void }) {
  const { t } = useTranslation(['ai', 'catalogue', 'common'])
  const user = useCurrentUser()
  const users = useDb((db) => db.users)
  const fields = editableFields(proposal)
  const [v, setV] = useState<ProposalEdits>(() => editValues(proposal))
  const people = users.filter((u) => u.role === 'executive' && u.status === 'active' && (user.role === 'admin' || u.managerId === user.id))
  const id = (f: string) => `pe-${proposal.id}-${f}`
  const set = (patch: ProposalEdits) => setV((x) => ({ ...x, ...patch }))

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border bg-card p-3"
      onSubmit={(e) => { e.preventDefault(); onApply(reviseProposal(proposal, v, { users })) }}
      data-testid="proposal-editor"
    >
      {fields.includes('name') && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id('name')}>{t('ai:field.name')}</Label>
          <Input id={id('name')} value={v.name ?? ''} onChange={(e) => set({ name: e.target.value })} />
        </div>
      )}
      {fields.includes('phone') && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id('phone')}>{t('ai:field.phone')}</Label>
          <Input id={id('phone')} inputMode="tel" value={v.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} />
        </div>
      )}
      {fields.includes('title') && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id('title')}>{t('ai:field.title')}</Label>
          <Input id={id('title')} value={v.title ?? ''} onChange={(e) => set({ title: e.target.value })} />
        </div>
      )}
      {fields.includes('type') && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id('type')}>{t('ai:field.type')}</Label>
          <Select value={v.type} onValueChange={(x) => set({ type: x as ProposalEdits['type'] })}>
            <SelectTrigger id={id('type')} className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{APPOINTMENT_TYPES.map((x) => <SelectItem key={x} value={x}>{t(`catalogue:appointmentType.${x}`)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      {(fields.includes('start') || fields.includes('dueAt')) && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id('when')}>{t(fields.includes('start') ? 'ai:field.when' : 'ai:field.due')}</Label>
          <DateTimeField id={id('when')} value={fields.includes('start') ? v.start : v.dueAt} onChange={(iso) => set(fields.includes('start') ? { start: iso } : { dueAt: iso })} />
        </div>
      )}
      {fields.includes('to') && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id('to')}>{t('ai:field.to')}</Label>
          <Select value={v.to} onValueChange={(x) => set({ to: x })}>
            <SelectTrigger id={id('to')} className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">{t('ai:value.auto')}</SelectItem>
              {people.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}{u.availability === 'onLeave' ? ` · ${t('ai:value.onLeave')}` : ''}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      {fields.includes('stage') && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id('stage')}>{t('ai:field.to')}</Label>
          <Select value={v.stage} onValueChange={(x) => set({ stage: x as ProposalEdits['stage'] })}>
            <SelectTrigger id={id('stage')} className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{STAGES.filter((s) => s !== 'booked' && s !== 'converted').map((s) => <SelectItem key={s} value={s}>{t(`catalogue:stage.${s}`)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      {fields.includes('lostReason') && v.stage === 'lost' && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id('reason')}>{t('ai:field.reason')}</Label>
          <Select value={v.lostReason ?? 'other'} onValueChange={(x) => set({ lostReason: x as ProposalEdits['lostReason'] })}>
            <SelectTrigger id={id('reason')} className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{LOST_REASONS.map((r) => <SelectItem key={r} value={r}>{t(`catalogue:lostReason.${r}`)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      {fields.includes('text') && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id('text')}>{t('ai:field.note')}</Label>
          <Input id={id('text')} value={v.text ?? ''} onChange={(e) => set({ text: e.target.value })} />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" variant="secondary" data-testid="proposal-apply-edit"><Check />{t('ai:proposal.applyEdit')}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}><X />{t('common:actions.cancel')}</Button>
      </div>
    </form>
  )
}
