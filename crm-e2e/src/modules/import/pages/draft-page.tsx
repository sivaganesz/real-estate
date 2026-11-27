/**
 * /import/drafts/:id — finish a draft (master prompt §15.3): the prefilled form with ✦ AI markers and low-confidence
 * fields highlighted, what is still missing, the source it came from, and paste-and-fill to read more text into it.
 * Save as lead / property creates the record through the services (validated, duplicates warned) and marks the draft
 * saved; Save draft keeps the changes; Discard asks and can be undone. Appointment drafts open the booking form.
 */
import { useMemo, useState } from 'react'
import { ArrowLeft, CalendarPlus, CircleAlert, FileClock, FileImage, FileSpreadsheet, FileText, Save, Sparkles, Trash2, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { pathFor, paths } from '@/app/paths'
import { EmptyImport } from '@/components/illustrations'
import { PasteAndFillBox } from '@/components/ai/paste-and-fill-box'
import { AppointmentFormDialog } from '@/components/domain/appointment-form-dialog'
import { Callout } from '@/components/shared/callout'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { KeyValueGrid } from '@/components/shared/key-value-grid'
import { PageHeader } from '@/components/shared/page-header'
import { ProgressRing } from '@/components/shared/progress-ring'
import { SectionCard } from '@/components/shared/section-card'
import { ToneBadge } from '@/components/shared/badges'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { AppointmentType, Draft, FieldMetaMap, ID } from '@/domain/types'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { fmtRelative } from '@/lib/dates'
import { findDuplicates } from '@/lib/duplicates'
import { fmtDateTime } from '@/lib/format'
import { addNote } from '@/services/activities'
import { discardDraft, markDraftSaved, updateDraft } from '@/services/drafts'
import { createLead } from '@/services/leads'
import { createProperty } from '@/services/properties'
import { checkEntry, entryFromExtraction, type DocEntry } from '../lib/document'
import { payloadToValues } from '../lib/rows'
import { draftConfidence, lowFields, visibleDrafts } from '../lib/stats'
import { RecordForm } from '../components/record-form'

const SOURCE_ICON = { pdf: FileText, image: FileImage, paste: FileText, voice: FileText, import: FileSpreadsheet, assistant: Sparkles } as const

export default function DraftPage() {
  const { id = '' } = useParams()
  const { t } = useTranslation(['import', 'common'])
  const user = useCurrentUser()
  const { can } = usePermission()
  const all = useDb((db) => db.drafts)
  const draft = useMemo(() => visibleDrafts(all, user.id, can('import.leads')).find((d) => d.id === id), [all, user.id, can, id])
  if (!draft) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t('import:draft.notFoundTitle')} />
        <section className="rounded-lg border bg-card shadow-card">
          <EmptyState illustration={EmptyImport} title={t('import:draft.notFoundTitle')} body={t('import:draft.notFoundBody')}
            primary={<Button asChild variant="secondary"><Link to={paths.drafts()}><ArrowLeft />{t('import:draft.backToDrafts')}</Link></Button>} />
        </section>
      </div>
    )
  }
  return <DraftEditor key={draft.id} draft={draft} />
}

function DraftEditor({ draft }: { draft: Draft }) {
  const { t, i18n } = useTranslation(['import', 'common'])
  const navigate = useNavigate()
  const now = useNow()
  const { can } = usePermission()
  const leads = useDb((db) => db.leads)
  const users = useDb((db) => db.users)
  const job = useDb((db) => (draft.importJobId ? db.importJobs.find((j) => j.id === draft.importJobId) : undefined))
  const recordKind = draft.kind === 'appointment' ? null : draft.kind
  const [entry, setEntry] = useState<DocEntry>(() => ({ label: '', values: recordKind ? payloadToValues(recordKind, draft.payload) : {}, meta: draft.fieldMeta }))
  const [dirty, setDirty] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [bookOpen, setBookOpen] = useState(false)
  const check = useMemo(() => (recordKind ? checkEntry(recordKind, entry) : null), [recordKind, entry])
  const conf = Math.round(draftConfidence(entry.meta) * 100)
  const low = lowFields(entry.meta).filter((f) => entry.values[f])
  const open = draft.status === 'open'
  const SourceIcon = SOURCE_ICON[draft.source.type]
  const creator = users.find((u) => u.id === draft.createdBy)?.name ?? t('import:someone')
  const dupes = recordKind === 'lead' && check?.lead ? findDuplicates({ leads }, { phone: check.lead.phone, email: check.lead.email }) : []

  const edit = (field: string, value: string) => {
    setEntry((e) => ({ ...e, values: { ...e.values, [field]: value }, meta: { ...e.meta, [field]: { origin: 'manual' } } }))
    setDirty(true)
  }
  const fillFromAI = (fields: Record<string, unknown>, meta: FieldMetaMap) => {
    if (!recordKind) return
    const x = entryFromExtraction(recordKind, fields, meta)
    // AI fills what is empty or was AI/import-filled before; what the user typed stays
    setEntry((e) => {
      const values = { ...e.values }
      const m = { ...e.meta }
      for (const [k, v] of Object.entries(x.values)) {
        if (k === 'notes' || e.meta[k]?.origin === 'manual') continue
        values[k] = v
        if (x.meta[k]) m[k] = x.meta[k]
      }
      return { ...e, values, meta: m }
    })
    setDirty(true)
  }

  const saveDraft = () => {
    if (!check) return
    try {
      const payload = (recordKind === 'lead' ? check.lead : check.property) as Record<string, unknown> | undefined
      updateDraft(draft.id, { title: (recordKind === 'lead' ? check.lead?.name : check.property?.title) || draft.title, payload: payload ?? {}, fieldMeta: entry.meta })
      setDirty(false)
      toast.success(t('import:draft.savedDraft'))
    } catch (e) { toastError(e) }
  }

  const saveRecord = () => {
    if (!check || !recordKind) return
    if (!check.complete) { toast.error(t('import:draft.stillMissing', { count: check.blocking.length })); return }
    try {
      let ref: { kind: 'lead' | 'property'; id: ID }
      if (recordKind === 'lead' && check.lead) {
        const { note, ...lead } = check.lead
        const r = createLead({ ...lead, fieldMeta: entry.meta }, { via: 'import' })
        if (note?.trim()) addNote(r.id, note, { via: 'import' })
        ref = { kind: 'lead', id: r.id }
      } else {
        const r = createProperty({ ...check.property!, fieldMeta: entry.meta }, { via: 'import' })
        ref = { kind: 'property', id: r.id }
      }
      markDraftSaved(draft.id, ref)
      toast.success(t(recordKind === 'lead' ? 'import:draft.savedLead' : 'import:draft.savedProperty', { title: draft.title }), {
        action: { label: t('common:actions.open'), onClick: () => navigate(pathFor(ref)) },
      })
      navigate(pathFor(ref))
    } catch (e) { toastError(e) }
  }

  const discard = () => {
    try {
      const { undoToken } = discardDraft(draft.id)
      toastUndo(t('import:drafts.discarded', { title: draft.title }), undoToken)
      navigate(paths.drafts())
    } catch (e) { toastError(e) }
  }

  const appt = draft.kind === 'appointment' ? (draft.payload as { leadId?: ID; propertyIds?: ID[]; type?: AppointmentType; start?: string; notes?: string }) : null

  return (
    <div className="flex flex-col gap-6" data-testid="draft-page">
      <PageHeader
        eyebrow={<Link to={paths.drafts()} className="inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="size-3.5" aria-hidden="true" />{t('import:drafts.title')}</Link>}
        title={draft.title}
        subtitle={t('import:draft.subtitle', { kind: t(`import:drafts.kinds.${draft.kind}`), when: fmtRelative(draft.createdAt, now, i18n.language) })}
        actions={open && (
          <>
            <Button variant="ghost" className="text-danger" onClick={() => setConfirm(true)} data-testid="draft-discard"><Trash2 />{t('import:drafts.discard')}</Button>
            {recordKind && <Button variant="secondary" onClick={saveDraft} disabled={!dirty} data-testid="draft-save-draft"><FileClock />{t('import:draft.saveDraft')}</Button>}
            {recordKind ? (
              <Button onClick={saveRecord} disabled={!check?.complete} data-testid="draft-save"><Save />{t(`import:draft.saveAs.${recordKind}`)}</Button>
            ) : (
              <Button onClick={() => setBookOpen(true)} data-testid="draft-book"><CalendarPlus />{t('import:draft.book')}</Button>
            )}
          </>
        )}
      />

      {draft.status !== 'open' && (
        <Callout tone={draft.status === 'saved' ? 'success' : 'neutral'} title={t(`import:draft.status.${draft.status}`)}
          action={draft.savedAs && <Button asChild size="sm" variant="secondary"><Link to={pathFor(draft.savedAs)}>{t('import:drafts.viewSaved')}</Link></Button>} />
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="flex flex-col gap-4 xl:col-span-8">
          {recordKind && check && (
            <>
              {low.length > 0 && <Callout tone="warning" title={t('import:doc.lowTitle', { count: low.length })}>{t('import:draft.lowBody')}</Callout>}
              {check.blocking.length > 0 && (
                <Callout tone="info" title={t('import:doc.missingTitle', { count: check.blocking.length })}>
                  {check.blocking.map((i) => `${t(`import:field.${i.field}`)}: ${t(`import:issue.${i.key}`, i.params ?? {})}`).join(' · ')}
                </Callout>
              )}
              {dupes.length > 0 && (
                <Callout tone="warning" title={t('import:draft.duplicate', { count: dupes.length })}>
                  {dupes.map((d, i) => <span key={d.lead.id}>{i > 0 && ', '}<Link to={paths.lead(d.lead.id)} className="font-semibold underline underline-offset-2">{d.lead.name}</Link></span>)}
                </Callout>
              )}
              <SectionCard title={t('import:draft.formTitle')} description={t('import:draft.formBody')}>
                <fieldset disabled={!open} className="contents">
                  <RecordForm kind={recordKind} values={entry.values} meta={entry.meta} issues={check.issues} onChange={edit} idPrefix="draft" />
                </fieldset>
              </SectionCard>
              {open && (
                <PasteAndFillBox
                  kind={recordKind} defaultText={draft.source.text ?? ''}
                  onFill={(x) => fillFromAI(x.fields as Record<string, unknown>, x.meta)}
                />
              )}
            </>
          )}
          {appt && (
            <SectionCard title={t('import:draft.apptTitle')} description={t('import:draft.apptBody')}>
              <KeyValueGrid columns={2} items={[
                { label: t('import:draft.appt.lead'), value: leads.find((l) => l.id === appt.leadId)?.name ?? '—' },
                { label: t('import:draft.appt.type'), value: appt.type ? t(`catalogue:appointmentType.${appt.type}`) : '—' },
                { label: t('import:draft.appt.when'), value: appt.start ? fmtDateTime(appt.start, i18n.language) : '—' },
                { label: t('import:draft.appt.properties'), value: String(appt.propertyIds?.length ?? 0) },
              ]} />
            </SectionCard>
          )}
        </div>

        <aside className="flex flex-col gap-4 xl:col-span-4">
          <SectionCard title={t('import:draft.sourceTitle')}>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <ProgressRing value={conf} size={56} tone={conf < 75 ? 'warning' : 'ai'} label={t('import:drafts.confidence', { pct: conf })}>
                  <span className="text-meta font-semibold tabular-nums">{conf}%</span>
                </ProgressRing>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t('import:draft.confidence')}</p>
                  <p className="text-meta text-muted-foreground">{t('import:draft.confidenceBody', { count: low.length })}</p>
                </div>
              </div>
              {low.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {low.map((f) => (
                    <li key={f}>
                      <button type="button" className="inline-flex items-center gap-1 rounded-xs bg-warning-soft px-1.5 py-0.5 text-meta text-warning hover:underline"
                        onClick={() => document.querySelector<HTMLElement>(`[data-field="${f}"] input, [data-field="${f}"] button, [data-field="${f}"] textarea`)?.focus()}>
                        <TriangleAlert className="size-3" aria-hidden="true" />{t(`import:field.${f}`)} · {Math.round((entry.meta[f]?.confidence ?? 0) * 100)}%
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <KeyValueGrid columns={2} items={[
                { label: t('import:draft.source'), value: <span className="inline-flex items-center gap-1.5"><SourceIcon className="size-3.5" aria-hidden="true" />{t(`import:drafts.sources.${draft.source.type}`)}</span> },
                { label: t('import:draft.file'), value: draft.source.fileName ?? '—' },
                { label: t('import:draft.createdBy'), value: <span className="inline-flex items-center gap-1.5"><UserAvatar name={creator} size="xs" />{creator}</span> },
                { label: t('import:draft.created'), value: fmtDateTime(draft.createdAt, i18n.language) },
              ]} />
              {job && can('import.leads') && <Button asChild variant="ghost" size="sm" className="self-start"><Link to={`${paths.importHistory()}?job=${job.id}`}>{t('import:draft.fromJob', { file: job.fileName })}</Link></Button>}
              {draft.source.text && (
                <Collapsible>
                  <CollapsibleTrigger asChild><Button variant="secondary" size="sm">{t('import:draft.showText')}</Button></CollapsibleTrigger>
                  <CollapsibleContent>
                    <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-muted p-3 font-mono text-meta whitespace-pre-wrap">{draft.source.text}</pre>
                  </CollapsibleContent>
                </Collapsible>
              )}
              {recordKind && check && (
                <p className="flex items-center gap-1.5 text-meta">
                  {check.complete ? <ToneBadge tone="success">{t('import:drafts.readyToSave')}</ToneBadge> : <ToneBadge tone="danger" icon={CircleAlert}>{t('import:drafts.missing', { count: check.blocking.length })}</ToneBadge>}
                </p>
              )}
            </div>
          </SectionCard>
        </aside>
      </div>

      <ConfirmDialog open={confirm} onOpenChange={setConfirm} tone="danger" title={t('import:drafts.discardTitle', { title: draft.title })}
        description={t('import:drafts.discardBody')} confirmLabel={t('import:drafts.discard')} onConfirm={() => { setConfirm(false); discard() }} />
      {appt && (
        <AppointmentFormDialog open={bookOpen} onOpenChange={setBookOpen} leadId={appt.leadId} propertyIds={appt.propertyIds} type={appt.type} start={appt.start}
          onSaved={(aid) => { try { markDraftSaved(draft.id, { kind: 'appointment', id: aid }); navigate(paths.appointment(aid)) } catch (e) { toastError(e) } }} />
      )}
    </div>
  )
}
