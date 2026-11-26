/**
 * ✓ Done: the planned follow-up is finished. One click, no menu (agreed 26 Nov):
 * - "Follow-up done" goes on the Activity timeline (the only follow-up button that writes there);
 * - the follow-up date is cleared, so the card shows "No follow-up planned" and the next one is planned with Schedule;
 * - "Responded" is not ticked: whether they answered is recorded in Qualification, so readiness never rises on its own.
 * Shown only while a follow-up is planned. Works without consent too, because it only records what happened. Used on the lead page, the phone bar and the "Today" list.
 */
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { Lead } from '@/data/types'
import { useStore } from '@/store/db'

export function DoneButton({ lead, className, size = 'sm', variant = 'default', label = true }: {
  lead: Lead
  className?: string
  size?: 'sm' | 'default' | 'icon-sm'
  variant?: 'default' | 'outline'
  label?: boolean
}) {
  const { t } = useTranslation()
  const { updateLead } = useStore()
  // nothing planned, nothing to finish: only Schedule is offered (so "Follow-up done" can't be logged twice)
  if (!lead.nextFollowUp) return null
  const done = () => {
    updateLead(lead.id, (x) => { x.nextFollowUp = undefined }, t('today.doneNoteSimple'))
    toast.success(t('today.doneToast', { name: lead.name }))
  }
  return (
    <Button size={size} variant={variant} className={className} title={t('today.done')} onClick={done}>
      <Check />{label && t('today.done')}
    </Button>
  )
}
