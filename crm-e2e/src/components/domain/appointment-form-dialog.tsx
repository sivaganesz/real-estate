/**
 * Book or edit an appointment (master prompt §16): manual form and paste-and-fill side by side (§12.0: both, always).
 * Smart-required: lead + type + date/time (+ property for a site visit). AI-filled fields are marked and lose the
 * marker when edited. A double booking shows "Vikram already has Rohan Deshpande at 12:30 · Book anyway" and never
 * blocks. "Free slots" suggests the executive's next open times (simulated AI, Demo AI badge). The location defaults
 * to the property's address with a Google Maps link. Booking a site visit moves the lead's stage (E6).
 */
import { useMemo, useState } from 'react'
import { AlertTriangle, MapPin, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { Extraction } from '@/ai/types'
import { AIField, AIFieldMarker } from '@/components/ai/ai-field'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { ModuleAssistant } from '@/components/ai/module-assistant'
import { useAIFields } from '@/components/ai/use-ai-fields'
import { Callout } from '@/components/shared/callout'
import { Chip } from '@/components/shared/chip'
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
import { APPOINTMENT_TYPES, DEFAULT_DURATION_MIN, STAGE_RANK } from '@/domain/catalogue'
import type { Appointment, AppointmentInput, AppointmentType, ID } from '@/domain/types'
import { useDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { localDay } from '@/lib/dates'
import { fmtDateTime, fmtTime } from '@/lib/format'
import { appointmentTypeTone } from '@/lib/tones'
import { ValidationError, type FieldError } from '@/lib/validation'
import { mapsLink, propertyAddress } from '@/lib/whatsapp'
import { createAppointment, findConflicts, rescheduleAppointment, updateAppointment } from '@/services/appointments'
import { nextFreeSlots, suggestSlots } from './appointment-slots'
import { LeadSelect } from './lead-select'
import { PropertyMultiSelect } from './property-multi-select'

const DURATIONS = [15, 30, 45, 60, 90, 120]
const REMINDERS = [0, 15, 30, 60, 120, 1440]

export type AppointmentFormProps = {
  open: boolean
  onOpenChange: (o: boolean) => void
  leadId?: ID
  propertyIds?: ID[]
  type?: AppointmentType
  /** Pre-filled start (a clicked calendar slot). */
  start?: string
  /** Pre-filled executive (a clicked slot in a filtered calendar). */
  ownerId?: ID
  /** Edit an existing appointment instead of booking a new one. */
  appointment?: Appointment
  /** Open with the paste-and-fill box expanded. */
  aiOpen?: boolean
  onSaved?: (id: ID) => void
}

export function AppointmentFormDialog(props: AppointmentFormProps) {
  const { open, onOpenChange } = props
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-xl" data-testid="appointment-form">
        {open && <FormBody {...props} />}
      </DialogContent>
    </Dialog>
  )
}

/** "Vikram Rao already has Rohan Deshpande at 12:30 PM." One line per clash; a warning, never a block. */
export function ConflictNotice({ conflicts, ownerName }: { conflicts: Appointment[]; ownerName: string }) {
  const { t, i18n } = useTranslation('appointments')
  const leads = useDb((db) => db.leads)
  if (!conflicts.length) return null
  return (
    <Callout tone="warning" icon={AlertTriangle} title={t('conflict.title')}>
      <ul className="flex flex-col gap-0.5" data-testid="conflict-warning">
        {conflicts.map((c) => (
          <li key={c.id}>{t('conflict.line', { owner: ownerName, name: leads.find((l) => l.id === c.leadId)?.name ?? t('noLead'), time: fmtTime(c.start, i18n.language) })}</li>
        ))}
      </ul>
      <p className="mt-1 text-meta text-muted-foreground">{t('conflict.hint')}</p>
    </Callout>
  )
}

/** Free-slot chips for an executive (scheduling suggestions, simulated AI). */
export function SlotSuggestions({ ownerId, type, durationMin, day, excludeId, onPick }: {
  ownerId: ID
  type: AppointmentType
  durationMin: number
  day?: string
  excludeId?: ID
  onPick: (iso: string) => void
}) {
  const { t, i18n } = useTranslation('appointments')
  const now = useNow()
  const appointments = useDb((db) => db.appointments)
  const slots = useMemo(() => {
    const today = localDay(now)
    const input = { ownerId, durationMin, type, now, excludeId }
    return day && day >= today ? suggestSlots(appointments, { ...input, day, count: 4 }) : nextFreeSlots(appointments, { ...input, from: today, count: 4 })
  }, [appointments, ownerId, durationMin, type, now, excludeId, day])
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-ai-border bg-ai-soft/30 p-2.5" data-testid="slot-suggestions">
      <div className="flex items-center gap-2">
        <Sparkles className="size-3.5 text-ai" aria-hidden="true" />
        <span className="flex-1 text-meta font-medium">{day ? t('slots.titleDay') : t('slots.title')}</span>
        <DemoAIBadge mode="simulated" />
      </div>
      {slots.length ? (
        <div className="flex flex-wrap gap-1.5">
          {slots.map((s) => (
            <Chip key={s} size="sm" tone="ai" onClick={() => onPick(s)}>
              {day ? fmtTime(s, i18n.language) : fmtDateTime(s, i18n.language)}
            </Chip>
          ))}
        </div>
      ) : (
        <p className="text-meta text-muted-foreground">{t('slots.none')}</p>
      )}
    </div>
  )
}

function FormBody({ onOpenChange, leadId: initialLead, propertyIds: initialProps, type: initialType, start: initialStart, ownerId: initialOwner, appointment: editing, aiOpen: initialAi, onSaved }: AppointmentFormProps) {
  const { t, i18n } = useTranslation(['domain', 'appointments', 'common', 'catalogue', 'ai'])
  const { user, can, scope } = usePermission()
  const leads = useDb((db) => db.leads)
  const properties = useDb((db) => db.properties)
  const users = useDb((db) => db.users)
  const appointments = useDb((db) => db.appointments)
  const ai = useAIFields()
  const t0 = editing?.type ?? initialType ?? 'siteVisit'
  const [leadId, setLeadId] = useState<ID | undefined>(editing?.leadId ?? initialLead)
  const [type, setType] = useState<AppointmentType>(t0)
  const [start, setStart] = useState<string | undefined>(editing?.start ?? initialStart)
  const [duration, setDuration] = useState<number>(editing?.durationMin ?? DEFAULT_DURATION_MIN[t0])
  const [propertyIds, setPropertyIds] = useState<ID[]>(editing?.propertyIds ?? initialProps ?? [])
  const [ownerId, setOwnerId] = useState<ID | undefined>(editing?.ownerId ?? initialOwner)
  const [location, setLocation] = useState(editing?.location?.text ?? '')
  const [reminder, setReminder] = useState<number>(editing?.reminderMins ?? 60)
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [errors, setErrors] = useState<FieldError[]>([])
  const [aiOpen, setAiOpen] = useState(!!initialAi)
  const lead = leads.find((l) => l.id === leadId)
  const mayPickOwner = scope('appointment.manage') !== 'own'
  const owners = users.filter((u) => u.status === 'active' && can('appointment.manage', { ownerId: u.id }))
  const owner = ownerId ?? (mayPickOwner ? lead?.ownerId ?? user.id : user.id)
  const ownerName = users.find((u) => u.id === owner)?.name ?? ''
  const conflicts = start ? findConflicts({ appointments }, { id: editing?.id, ownerId: owner, start, durationMin: duration }) : []
  const firstProp = properties.find((p) => p.id === propertyIds[0])
  const defaultLocation = type === 'siteVisit' && firstProp ? propertyAddress(firstProp) : ''
  const shownLocation = location.trim() || defaultLocation
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
    const loc = shownLocation
    const locationValue = loc ? { text: loc, mapUrl: mapsLink(loc) } : undefined
    try {
      if (editing) {
        updateAppointment(editing.id, {
          type, leadId, ownerId: owner, durationMin: duration, propertyIds, location: locationValue, reminderMins: reminder, notes: notes.trim() || undefined,
        }, { via: ai.count ? 'ai' : 'manual' })
        if (start && start !== editing.start) rescheduleAppointment(editing.id, start, { durationMin: duration, via: ai.count ? 'ai' : 'manual' })
        toast.success(t('appointments:form.updated'))
        if (conflicts.length) toast.warning(t('domain:appointment.conflict', { count: conflicts.length }))
        onOpenChange(false)
        onSaved?.(editing.id)
        return
      }
      const moves = type === 'siteVisit' && lead && STAGE_RANK[lead.stage] < STAGE_RANK.siteVisitScheduled
      const r = createAppointment({
        type, leadId, ownerId: owner, start: start ?? '', durationMin: duration, propertyIds, reminderMins: reminder,
        location: locationValue, notes: notes.trim() || undefined,
        fieldMeta: Object.keys(ai.meta).length ? ai.meta : undefined,
      }, { via: ai.count ? 'ai' : 'manual' })
      toast.success(t('domain:appointment.saved', { type: t(`catalogue:appointmentType.${type}`), when: fmtDateTime(start, i18n.language) }), {
        description: moves ? t('appointments:form.stageMoved', { name: lead.name, stage: t('catalogue:stage.siteVisitScheduled') }) : undefined,
      })
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
    <>
      <DialogHeader>
        <DialogTitle>{editing ? t('appointments:form.editTitle') : t('domain:appointment.newTitle')}</DialogTitle>
        <DialogDescription>{editing ? t('appointments:form.editBody') : t('domain:appointment.newBody')}</DialogDescription>
      </DialogHeader>
      <Collapsible open={aiOpen} onOpenChange={setAiOpen}>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="text-ai hover:bg-ai-soft hover:text-ai"><Sparkles />{t('ai:paste.toggle')}</Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <ModuleAssistant module="appointmentCreate" onFill={fill} />
        </CollapsibleContent>
      </Collapsible>
      <div className="flex flex-col gap-4">
        <AIField meta={ai.get('leadId')}>
          <FormField label={t('domain:form.lead')} required error={err('leadId')} hint={lead?.clientId ? t('appointments:form.isClient') : undefined} labelEnd={<AIFieldMarker meta={ai.get('leadId')} />}>
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
                <SelectTrigger id={id} className="w-full sm:w-28"><SelectValue /></SelectTrigger>
                <SelectContent>{DURATIONS.map((d) => <SelectItem key={d} value={String(d)}>{t('domain:form.minutes', { count: d })}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </FormField>
        </div>
        <SlotSuggestions ownerId={owner} type={type} durationMin={duration} day={start ? localDay(start) : undefined} excludeId={editing?.id}
          onPick={(iso) => { setStart(iso); ai.apply({ start: { origin: 'ai', confidence: 0.9 } }) }} />
        <ConflictNotice conflicts={conflicts} ownerName={ownerName} />
        <AIField meta={ai.get('propertyIds')}>
          <FormField label={t('domain:form.properties')} required={type === 'siteVisit'} optional={type !== 'siteVisit'} error={err('propertyIds')} labelEnd={<AIFieldMarker meta={ai.get('propertyIds')} />}>
            {({ id, invalid }) => <PropertyMultiSelect id={id} value={propertyIds} onChange={(v) => { setPropertyIds(v); ai.clear('propertyIds') }} preferred={lead?.shortlist.map((s) => s.propertyId)} invalid={invalid} />}
          </FormField>
        </AIField>
        {mayPickOwner && (
          <FormField label={t('domain:form.owner')}>
            {({ id }) => (
              <Select value={owner} onValueChange={setOwnerId}>
                <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {owners.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}{u.availability === 'onLeave' ? ` · ${t('common:availability.onLeave')}` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </FormField>
        )}
        <AIField meta={ai.get('location')}>
          <FormField label={t('domain:form.location')} optional hint={type === 'siteVisit' ? t('domain:form.locationHint') : undefined} labelEnd={<AIFieldMarker meta={ai.get('location')} />}>
            {({ id, describedBy }) => (
              <div className="flex flex-col gap-1.5">
                <Input id={id} value={location} placeholder={defaultLocation} onChange={(e) => { setLocation(e.target.value); ai.clear('location') }} aria-describedby={describedBy} />
                {shownLocation && (
                  <a href={mapsLink(shownLocation)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 self-start text-meta text-primary hover:underline">
                    <MapPin className="size-3.5" aria-hidden="true" />{t('appointments:form.mapPreview')}
                  </a>
                )}
              </div>
            )}
          </FormField>
        </AIField>
        <FormField label={t('appointments:form.reminder')}>
          {({ id }) => (
            <Select value={String(reminder)} onValueChange={(v) => setReminder(Number(v))}>
              <SelectTrigger id={id} className="w-full sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>{REMINDERS.map((m) => <SelectItem key={m} value={String(m)}>{t(`appointments:reminder.m${m}`)}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </FormField>
        <AIField meta={ai.get('notes')}>
          <FormField label={t('domain:form.notes')} optional labelEnd={<AIFieldMarker meta={ai.get('notes')} />}>
            {({ id }) => <Textarea id={id} value={notes} onChange={(e) => { setNotes(e.target.value); ai.clear('notes') }} rows={2} />}
          </FormField>
        </AIField>
      </div>
      <DialogFooter>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>{t('common:actions.cancel')}</Button>
        <Button onClick={save} data-testid="appointment-save">
          {conflicts.length ? t('appointments:conflict.bookAnyway') : editing ? t('appointments:form.saveChanges') : t('domain:appointment.save')}
        </Button>
      </DialogFooter>
    </>
  )
}
