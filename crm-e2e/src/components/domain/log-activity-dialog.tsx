/**
 * Log what happened with a lead (master prompt §17): a call (with its result), WhatsApp, e-mail, SMS or a note, plus an
 * optional next follow-up (Tomorrow / In 3 days / Next week / pick a date) created as a task in the same step.
 * A logged call or message moves New → Contacted and updates the contact dates (effect E4).
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
import { Textarea } from '@/components/ui/textarea'
import type { ID, Task } from '@/domain/types'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { addDaysToDay, localDay } from '@/lib/dates'
import { addNote, logContact } from '@/services/activities'
import { createTask } from '@/services/tasks'
import { LeadSelect } from './lead-select'

type Channel = 'call' | 'whatsapp' | 'email' | 'sms' | 'note'
const CHANNELS: Channel[] = ['call', 'whatsapp', 'email', 'sms', 'note']
const RESULTS: NonNullable<Task['callResult']>[] = ['connected', 'notReachable', 'busy', 'wrongNumber']

export function LogActivityDialog({ open, onOpenChange, leadId: initialLead, channel: initialChannel = 'call', onSaved }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  leadId?: ID
  channel?: Channel
  onSaved?: () => void
}) {
  const { t } = useTranslation(['domain', 'common'])
  const now = useNow()
  const user = useCurrentUser()
  const [leadId, setLeadId] = useState<ID | undefined>(initialLead)
  const [channel, setChannel] = useState<Channel>(initialChannel)
  const [result, setResult] = useState<Task['callResult']>('connected')
  const [text, setText] = useState('')
  const [followUp, setFollowUp] = useState<string | undefined>()
  const lead = useDb((db) => db.leads.find((l) => l.id === leadId))
  const at10 = (days: number) => {
    const [y, m, d] = addDaysToDay(localDay(now), days).split('-').map(Number)
    return new Date(y, m - 1, d, 10, 0).toISOString()
  }
  const save = () => {
    if (!lead) return
    try {
      if (channel === 'note') addNote(lead.id, text)
      else logContact(lead.id, { channel, result: channel === 'call' ? result : undefined, text: text.trim() || undefined })
      if (followUp) createTask({ title: t('domain:task.suggest.followUp', { name: lead.name }), type: 'followUp', leadId: lead.id, dueAt: followUp, ownerId: lead.ownerId ?? user.id })
      toast.success(t('domain:log.saved', { name: lead.name }))
      setText('')
      setFollowUp(undefined)
      onOpenChange(false)
      onSaved?.()
    } catch (e) {
      toastError(e)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{lead ? t('domain:log.titleFor', { name: lead.name }) : t('domain:log.title')}</DialogTitle>
          <DialogDescription>{t('domain:log.body')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {!initialLead && (
            <FormField label={t('domain:form.lead')} required>
              {({ id }) => <LeadSelect id={id} value={leadId} onChange={setLeadId} />}
            </FormField>
          )}
          <FormField label={t('domain:log.what')}>
            {() => (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('domain:log.what')}>
                {CHANNELS.map((c) => <Chip key={c} size="sm" pressed={channel === c} onClick={() => setChannel(c)}>{t(`domain:log.channel.${c}`)}</Chip>)}
              </div>
            )}
          </FormField>
          {channel === 'call' && (
            <FormField label={t('domain:log.result')}>
              {() => (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('domain:log.result')}>
                  {RESULTS.map((r) => <Chip key={r} size="sm" pressed={result === r} onClick={() => setResult(r)}>{t(`domain:log.callResult.${r}`)}</Chip>)}
                </div>
              )}
            </FormField>
          )}
          <FormField label={channel === 'note' ? t('domain:log.note') : t('domain:log.summary')} optional={channel !== 'note'} required={channel === 'note'}>
            {({ id }) => <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={t('domain:log.placeholder')} />}
          </FormField>
          <FormField label={t('domain:log.followUp')} optional>
            {() => (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-1.5">
                  <Chip size="sm" pressed={followUp === at10(1)} onClick={() => setFollowUp(at10(1))}>{t('domain:task.tomorrow')}</Chip>
                  <Chip size="sm" pressed={followUp === at10(3)} onClick={() => setFollowUp(at10(3))}>{t('domain:task.inThreeDays')}</Chip>
                  <Chip size="sm" pressed={followUp === at10(7)} onClick={() => setFollowUp(at10(7))}>{t('domain:task.nextWeek')}</Chip>
                  {followUp && <Chip size="sm" dashed onClick={() => setFollowUp(undefined)}>{t('domain:log.noFollowUp')}</Chip>}
                </div>
                <DateTimeField value={followUp} onChange={setFollowUp} />
              </div>
            )}
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>{t('common:actions.cancel')}</Button>
          <Button onClick={save} disabled={!lead || (channel === 'note' && !text.trim())} data-testid="log-save">{t('domain:log.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
