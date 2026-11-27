/**
 * Book an appointment (master prompt §16): manual form and paste-and-fill side by side (§12.0: both, always).
 * Smart-required: lead + type + date/time (+ property for a site visit). AI-filled fields are marked and lose the
 * marker when edited. Saving warns about a double booking but never blocks it.
 */
import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { Extraction } from '@/ai/types'
import { AIField, AIFieldMarker } from '@/components/ai/ai-field'
import { PasteAndFillBox } from '@/components/ai/paste-and-fill-box'
import { useAIFields } from '@/components/ai/use-ai-fields'
import { DateTimeField } from '@/components/shared/date-time-field'
import { FormField } from '@/components/shared/form-field'
import { Segmented } from '@/components/shared/segmented'
import { toastError } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { APPOINTMENT_TYPES, DEFAULT_DURATION_MIN } from '@/domain/catalogue'
import type { AppointmentInput, AppointmentType, ID } from '@/domain/types'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useDb } from '@/hooks/use-db'
import { fmtDateTime } from '@/lib/format'
import { appointmentTypeTone } from '@/lib/tones'
import { ValidationError, type FieldError } from '@/lib/validation'
import { mapsLink, propertyAddress } from '@/lib/whatsapp'
import { createAppointment } from '@/services/appointments'
import { LeadSelect } from './lead-select'
import { PropertyMultiSelect } from './property-multi-select'

const DURATIONS = [15, 30, 45, 60, 90, 120]

export function AppointmentFormDialog({ open, onOpenChange, leadId: initialLead, propertyIds: initialProps, type: initialType, onSaved }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  leadId?: ID
  propertyIds?: ID[]
  type?: AppointmentType
  onSaved?: (id: ID) => void
}) {
  const { t, i18n } = useTranslation(['domain', 'common', 'catalogue', 'ai'])
  const user = useCurrentUser()
  const leads = useDb((db) => db.leads)
  const properties = useDb((db) => db.properties)
  const executives = useDb((db) => db.users.filter((u) => u.role === 'executive' && u.status === 'active'))
  const ai = useAIFields()
  const [leadId, setLeadId] = useState<ID | undefined>(initialLead)
  const [type, setType] = useState<AppointmentType>(initialType ?? 'siteVisit')
  const [start, setStart] = useState<string | undefined>()
  const [duration, setDuration] = useState<number>(DEFAULT_DURATION_MIN[initialType ?? 'siteVisit'])
  const [propertyIds, setPropertyIds] = useState<ID[]>(initialProps ?? [])
  const [ownerId, setOwnerId] = useState<ID | undefined>()
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<FieldError[]>([])
  const [aiOpen, setAiOpen] = useState(false)
  const lead = leads.find((l) => l.id === leadId)
  const owner = ownerId ?? lead?.ownerId ?? user.id
  const err = (f: string) => {
    const e = errors.find((x) => x.field === f)
    return e ? t(`common:validation.${e.key}`) : undefined
  }

  const fill = (x: Extraction<AppointmentInput>) => {
    const f = x.fields
    if (f.leadId) setLeadId(f.leadId)
    if (f.type) { setType(f.type); setDuration(f.durationMin ?? DEFAULT_DURATION_MIN[f.type]) }
    if (f.start) setStart(f.start)
    if (f.propertyIds?.length) setPropertyIds(f.propertyIds)
    if (f.location?.text) setLocation(f.location.text)
    if (f.notes) setNotes(f.notes)
    ai.apply(x.meta)
  }

  const save = () => {
    const firstProp = properties.find((p) => p.id === propertyIds[0])
    const loc = location.trim() || (type === 'siteVisit' && firstProp ? propertyAddress(firstProp) : '')
    try {
      const r = createAppointment({
        type, leadId, ownerId: owner, start: start ?? '', durationMin: duration, propertyIds,
        location: loc ? { text: loc, mapUrl: mapsLink(loc) } : undefined, notes: notes.trim() || undefined,
        fieldMeta: Object.keys(ai.meta).length ? ai.meta : undefined,
      }, { via: ai.count ? 'ai' : 'manual' })
      toast.success(t('domain:appointment.saved', { type: t(`catalogue:appointmentType.${type}`), when: fmtDateTime(start, i18n.language) }))
      if (r.conflicts.length) toast.warning(t('domain:appointment.conflict', { count: r.conflicts.length }))
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
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('domain:appointment.newTitle')}</DialogTitle>
          <DialogDescription>{t('domain:appointment.newBody')}</DialogDescription>
        </DialogHeader>
        <Collapsible open={aiOpen} onOpenChange={setAiOpen}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="text-ai hover:bg-ai-soft hover:text-ai"><Sparkles />{t('ai:paste.toggle')}</Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <PasteAndFillBox kind="appointment" onFill={fill} />
          </CollapsibleContent>
        </Collapsible>
        <div className="flex flex-col gap-4">
          <AIField meta={ai.get('leadId')}>
            <FormField label={t('domain:form.lead')} required error={err('leadId')} labelEnd={<AIFieldMarker meta={ai.get('leadId')} />}>
              {({ id, invalid, describedBy }) => <LeadSelect id={id} value={leadId} onChange={(v) => { setLeadId(v); ai.clear('leadId') }} invalid={invalid} describedBy={describedBy} />}
            </FormField>
          </AIField>
          <AIField meta={ai.get('type')}>
            <FormField label={t('domain:form.type')} required labelEnd={<AIFieldMarker meta={ai.get('type')} />}>
              {() => (
                <Segmented
                  variant="pill" value={type} label={t('domain:form.type')} className="flex-wrap"
                  onChange={(v) => { setType(v); setDuration(DEFAULT_DURATION_MIN[v]); ai.clear('type') }}
                  segments={APPOINTMENT_TYPES.map((v) => {
                    const Icon = appointmentTypeTone[v].icon
                    return { value: v, label: t(`catalogue:appointmentType.${v}`), icon: Icon ? <Icon aria-hidden="true" /> : undefined }
                  })}
                />
              )}
            </FormField>
          </AIField>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <AIField meta={ai.get('start')}>
              <FormField label={t('domain:form.when')} required error={err('start')} labelEnd={<AIFieldMarker meta={ai.get('start')} />}>
                {({ id, invalid, describedBy }) => <DateTimeField id={id} value={start} onChange={(v) => { setStart(v); ai.clear('start') }} invalid={invalid} describedBy={describedBy} />}
              </FormField>
            </AIField>
            <FormField label={t('domain:form.duration')}>
              {({ id }) => (
                <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                  <SelectTrigger id={id} className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>{DURATIONS.map((d) => <SelectItem key={d} value={String(d)}>{t('domain:form.minutes', { count: d })}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </FormField>
          </div>
          <AIField meta={ai.get('propertyIds')}>
            <FormField label={t('domain:form.properties')} required={type === 'siteVisit'} optional={type !== 'siteVisit'} error={err('propertyIds')} labelEnd={<AIFieldMarker meta={ai.get('propertyIds')} />}>
              {({ id, invalid }) => <PropertyMultiSelect id={id} value={propertyIds} onChange={(v) => { setPropertyIds(v); ai.clear('propertyIds') }} preferred={lead?.shortlist.map((s) => s.propertyId)} invalid={invalid} />}
            </FormField>
          </AIField>
          {user.role !== 'executive' && (
            <FormField label={t('domain:form.owner')}>
              {({ id }) => (
                <Select value={owner} onValueChange={setOwnerId}>
                  <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[user, ...executives.filter((u) => u.id !== user.id)].map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          )}
          <AIField meta={ai.get('location')}>
            <FormField label={t('domain:form.location')} optional hint={type === 'siteVisit' ? t('domain:form.locationHint') : undefined} labelEnd={<AIFieldMarker meta={ai.get('location')} />}>
              {({ id, describedBy }) => <Input id={id} value={location} onChange={(e) => { setLocation(e.target.value); ai.clear('location') }} aria-describedby={describedBy} />}
            </FormField>
          </AIField>
          <AIField meta={ai.get('notes')}>
            <FormField label={t('domain:form.notes')} optional labelEnd={<AIFieldMarker meta={ai.get('notes')} />}>
              {({ id }) => <Textarea id={id} value={notes} onChange={(e) => { setNotes(e.target.value); ai.clear('notes') }} rows={2} />}
            </FormField>
          </AIField>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>{t('common:actions.cancel')}</Button>
          <Button onClick={save} data-testid="appointment-save">{t('domain:appointment.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
