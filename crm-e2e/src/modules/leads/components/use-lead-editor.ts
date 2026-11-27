/**
 * State and actions for the Add / Edit lead form, shared by the 3-step sheet and the full page. Holds the draft, the
 * AI field markers, answered questions, the step, the duplicate check and the save (create or update). Nothing is
 * saved until `save()` is called from the Save button.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { Extraction } from '@/ai/types'
import { useAIFields } from '@/components/ai/use-ai-fields'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import type { FieldMetaMap, ID, Lead, LeadInput } from '@/domain/types'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useWholeDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { pickAssignee } from '@/lib/assignment'
import { findDuplicates } from '@/lib/duplicates'
import { propertiesForLead } from '@/lib/matching'
import { qualificationCard } from '@/lib/qualification'
import { addNote } from '@/services/activities'
import { assignLead } from '@/services/assignments'
import { createLead, updateLead } from '@/services/leads'
import {
  answerField, applyExtraction, draftErrors, draftFromLead, draftToInput, emptyDraft, getPath, previewLead, setPath, stepOfField, withPlaces,
  type LeadDraft, type OwnerChoice,
} from '../lib/lead-form'

export type EditorStep = 0 | 1 | 2

export function useLeadEditor({ lead, onSaved }: { lead?: Lead; onSaved?: (id: ID) => void }) {
  const { t } = useTranslation(['leads', 'catalogue', 'common'])
  const db = useWholeDb()
  const user = useCurrentUser()
  const now = useNow()
  const { scope } = usePermission()
  const canAssign = !lead && scope('lead.assign') !== false
  const autoOn = db.settings.assignment.autoAssign
  const [draft, setDraft] = useState<LeadDraft>(() => (lead ? draftFromLead(lead) : emptyDraft(canAssign ? (autoOn ? 'auto' : 'unassigned') : user.id)))
  const ai = useAIFields(lead?.fieldMeta ? Object.fromEntries(Object.entries(lead.fieldMeta).filter(([, m]) => m.origin === 'ai')) : {})
  const [answered, setAnswered] = useState<Set<string>>(new Set())
  const [step, setStep] = useState<EditorStep>(0)
  const [tried, setTried] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [dupAck, setDupAck] = useState(false)
  const [saving, setSaving] = useState(false)

  const errors = useMemo(() => draftErrors(draft), [draft])
  const errorOf = (field: string) => {
    const e = tried ? errors.find((x) => x.field === field) : undefined
    return e ? t(`common:validation.${e.key}`, e.params ?? {}) : undefined
  }

  /** A manual edit: sets the value and drops the AI marker on that path. */
  const set = (path: string, value: unknown) => {
    setDirty(true)
    ai.clear(path)
    if (path === 'requirement.localities') return setDraft((d) => withPlaces(d, { localities: value as string[] }))
    if (path === 'requirement.cities') return setDraft((d) => withPlaces(d, { cities: value as string[] }))
    setDraft((d) => setPath(d, path, value))
  }
  const get = <T>(path: string) => getPath(draft, path) as T

  const fill = (x: Extraction<LeadInput>) => {
    const r = applyExtraction(draft, x)
    setDraft(r.draft)
    ai.apply(r.meta)
    setDirty(true)
    setDupAck(false)
  }
  const answer = (field: string, value: unknown) => {
    setDraft((d) => answerField(d, field, value))
    ai.clear(field)
    setAnswered((s) => new Set(s).add(field))
    setDirty(true)
  }

  const duplicates = useMemo(() => {
    const phone = draft.phone.replace(/\D/g, '').length >= 10 ? draft.phone : undefined
    const email = /@.+\./.test(draft.email) ? draft.email : undefined
    if (!phone && !email && !draft.altPhone) return []
    return findDuplicates(db, { phone, altPhone: draft.altPhone || undefined, email, excludeId: lead?.id })
  }, [db, draft.phone, draft.altPhone, draft.email, lead?.id])

  const preview = useMemo(() => previewLead(draft, now.toISOString(), lead), [draft, now, lead])
  const fits = useMemo(
    () => (draft.requirement.cities.length || draft.requirement.propertyTypes.length || draft.requirement.budgetMax
      ? propertiesForLead(preview, db.properties, db.settings, now) : []),
    [preview, db.properties, db.settings, now, draft.requirement],
  )
  const qual = useMemo(() => qualificationCard(preview), [preview])
  const autoPick = useMemo(() => {
    if (!canAssign || draft.owner !== 'auto' || !autoOn) return null
    return pickAssignee({ lead: preview, users: db.users, leads: db.leads, settings: db.settings.assignment, managerId: user.role === 'manager' ? user.id : undefined })
  }, [canAssign, draft.owner, autoOn, preview, db, user])

  const goTo = (s: EditorStep) => setStep(s)

  const save = (): boolean => {
    setTried(true)
    if (errors.length) {
      setStep(stepOfField(errors[0].field) as EditorStep)
      toast.error(t('leads:form.fixErrors', { count: errors.length }))
      return false
    }
    if (duplicates.length && !dupAck) {
      setStep(0)
      toast.warning(t('leads:dup.confirmFirst'))
      return false
    }
    setSaving(true)
    try {
      const input = draftToInput(draft)
      const fieldMeta: FieldMetaMap = ai.meta
      const consent = draft.consent ? { followUp: true, at: lead?.consent?.at ?? now.toISOString(), how: lead?.consent?.how ?? 'form' } : lead?.consent ? { ...lead.consent, followUp: false } : undefined
      const via = ai.count > 0 ? 'ai' as const : 'manual' as const
      if (lead) {
        const r = updateLead(lead.id, { ...input, consent }, { fieldMeta, via, undoable: true })
        toastUndo(t('leads:form.updated', { name: input.name }), r.undoToken)
        if (draft.notes.trim()) addNote(lead.id, draft.notes)
        setDirty(false)
        onSaved?.(lead.id)
        return true
      }
      const owner: OwnerChoice = draft.owner
      const res = createLead({ ...input, ownerId: canAssign && owner !== 'auto' && owner !== 'unassigned' ? owner : undefined, consent, fieldMeta }, { via })
      if (draft.notes.trim()) addNote(res.id, draft.notes)
      if (duplicates.length) addNote(res.id, t('leads:dup.note', { names: duplicates.map((d) => `${d.lead.name} (${d.lead.id})`).join(', ') }))
      let ownerId = res.ownerId
      let reasonKey = res.reasonKey
      if (canAssign && owner === 'auto' && !autoOn) {
        const a = assignLead(res.id, 'auto')
        ownerId = a.result[0]?.to ?? null
        reasonKey = a.result[0]?.reasonKey
      }
      const ownerName = db.users.find((u) => u.id === ownerId)?.name
      toast.success(t('leads:form.created', { name: input.name }), {
        description: ownerId && ownerId !== user.id
          ? t('leads:form.assignedTo', { name: ownerName, reason: t(`catalogue:assignmentReason.${reasonKey ?? 'manual'}`) })
          : ownerId ? t('leads:form.yours') : t('leads:form.unassigned'),
      })
      setDirty(false)
      onSaved?.(res.id)
      return true
    } catch (e) {
      toastError(e)
      return false
    } finally {
      setSaving(false)
    }
  }

  return {
    lead, draft, set, get, fill, answer, answered, ai, step, goTo, tried, errors, errorOf, duplicates, dupAck, setDupAck, fits, qual, autoPick,
    canAssign, autoOn, dirty, saving, save, isEdit: !!lead,
  }
}

export type LeadEditor = ReturnType<typeof useLeadEditor>
