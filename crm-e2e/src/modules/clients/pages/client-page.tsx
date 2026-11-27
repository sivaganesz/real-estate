/**
 * /clients/:id — one client after booking: the journey stepper (Booked → Agreement → Loan processing → Registered →
 * Converted, one click to the next step, Cancel with confirm + undo), the booking (property, deal value, token),
 * home loan (bank, status, amount), KYC, the documents checklist (pending → received → verified, add the standard
 * list or a custom document, remove with undo), notes, the AI summary and a reminder message (Demo AI), the linked
 * lead's timeline and appointments.
 */
import { useMemo, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Ban, BadgeCheck, Building2, CalendarPlus, Check, FileCheck2, FilePlus2, Landmark, MessageCircle, ListChecks, Loader2, NotebookPen,
  RefreshCw, ShieldCheck, Sparkles, Trash2, UserRound,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { useAI, useAISelection } from '@/ai'
import type { AIText } from '@/ai/types'
import { paths } from '@/app/paths'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { ActivityTimeline } from '@/components/domain/activity-timeline'
import { AppointmentCard } from '@/components/domain/appointment-card'
import { AppointmentFormDialog } from '@/components/domain/appointment-form-dialog'
import { ContactActions } from '@/components/domain/contact-actions'
import { NoAccess, NoResults, EmptyCalendar } from '@/components/illustrations'
import { AmountInput } from '@/components/shared/amount-input'
import { Chip } from '@/components/shared/chip'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { IconTile } from '@/components/shared/icon-tile'
import { KeyValueGrid } from '@/components/shared/key-value-grid'
import { PageHeader } from '@/components/shared/page-header'
import { ProgressRing } from '@/components/shared/progress-ring'
import { SectionCard } from '@/components/shared/section-card'
import { UserAvatar } from '@/components/shared/user-avatar'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { Client } from '@/domain/types'
import { BANKS } from '@/domain/catalogue'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useWholeDb } from '@/hooks/use-db'
import { usePermission } from '@/hooks/use-permission'
import { fmtDate, inr, inrShort } from '@/lib/format'
import { phoneDisplay } from '@/lib/phone'
import { cn } from '@/lib/utils'
import { waLink } from '@/lib/whatsapp'
import { addClientDocuments, changeClientStatus, deleteClient, removeClientDocument, setClientDocument, updateClient } from '@/services/clients'
import { logContact } from '@/services/activities'
import { appointmentsForLead } from '@/services/queries/lookups'
import { ClientStatusPill } from '../components/client-pills'
import { useAIResult } from '../components/use-ai-result'
import { CLIENT_FLOW, DOC_KEY, DOC_STATUSES, LOAN_STATUSES, STANDARD_DOCS, clientTodos, docsProgress, flowStep, missingStandardDocs, nextStatus } from '../lib/client-queries'

export default function ClientPage() {
  const { id = '' } = useParams()
  const { t } = useTranslation(['clients', 'common'])
  const db = useWholeDb()
  const user = useCurrentUser()
  const { can } = usePermission()
  const client = db.clients.find((c) => c.id === id)
  useAISelection(client ? { kind: 'client', id: client.id } : undefined)
  if (!client) {
    return <EmptyState illustration={NoResults} title={t('clients:detail.notFound')} body={t('clients:detail.notFoundBody', { id })} primary={<Button asChild variant="secondary"><Link to={paths.clients()}><ArrowLeft />{t('clients:detail.back')}</Link></Button>} />
  }
  if (!can('client.view', client)) {
    return <EmptyState illustration={NoAccess} title={t('clients:detail.notYours')} body={t('clients:detail.notYoursBody', { role: t(`common:roles.${user.role}`) })} primary={<Button asChild variant="secondary"><Link to={paths.clients()}><ArrowLeft />{t('clients:detail.back')}</Link></Button>} />
  }
  return <ClientView client={client} />
}

function ClientView({ client: c }: { client: Client }) {
  const { t, i18n } = useTranslation(['clients', 'common', 'leads'])
  const db = useWholeDb()
  const navigate = useNavigate()
  const { can, scope } = usePermission()
  const edit = can('client.edit', c)
  const lead = db.leads.find((l) => l.id === c.leadId)
  const property = db.properties.find((p) => p.id === c.propertyId)
  const owner = db.users.find((u) => u.id === c.ownerId)
  const appts = useMemo(() => (lead ? appointmentsForLead(db, lead.id) : []), [db, lead])
  const [confirm, setConfirm] = useState<'cancel' | 'delete' | null>(null)
  const [visit, setVisit] = useState(false)
  const next = nextStatus(c.status)
  const todos = clientTodos(c)

  const move = (status: Client['status']) => {
    try {
      const r = changeClientStatus(c.id, status)
      toastUndo(t('clients:journey.moved', { status: t(`clients:status.${status}`) }), r.undoToken)
    } catch (e) { toastError(e) }
  }

  return (
    <div className="flex flex-col gap-5" data-testid="client-page">
      <PageHeader
        eyebrow={<Link to={paths.clients()} className="inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="size-3.5" aria-hidden="true" />{t('clients:title')}</Link>}
        title={<span className="flex flex-wrap items-center gap-3">{c.name}<ClientStatusPill status={c.status} /></span>}
        subtitle={t('clients:detail.subtitle', { id: c.id, date: fmtDate(c.bookedAt, i18n.language) })}
        actions={
          <>
            {lead && <ContactActions lead={{ id: lead.id, name: c.name, phone: c.phone, email: c.email, ownerId: lead.ownerId }} labels />}
            {lead && <Button asChild variant="secondary"><Link to={paths.lead(lead.id)}><UserRound />{t('clients:detail.openLead')}</Link></Button>}
            {edit && next && <Button onClick={() => move(next)} data-testid="client-next"><ArrowRight />{t('clients:journey.moveTo', { status: t(`clients:status.${next}`) })}</Button>}
          </>
        }
      />

      <section aria-label={t('clients:journey.title')} className="rounded-lg border bg-card p-4 shadow-card md:p-5" data-testid="client-journey">
        <ol className="flex gap-1 overflow-x-auto">
          {CLIENT_FLOW.map((s, i) => {
            const step = flowStep(c.status)
            const done = c.status !== 'cancelled' && i < step
            const cur = c.status === s
            return (
              <li key={s} className="min-w-[96px] flex-1">
                <button type="button" disabled={!edit || cur} onClick={() => move(s)} aria-current={cur ? 'step' : undefined}
                  className="group flex w-full flex-col items-start gap-1.5 rounded-md p-1 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-default">
                  <span className={cn('flex size-7 items-center justify-center rounded-full border-2 text-meta font-semibold tabular-nums', cur ? 'border-primary bg-primary text-primary-foreground' : done ? 'border-success bg-success-soft text-success' : 'border-border text-muted-foreground group-enabled:group-hover:border-primary/50')}>
                    {done ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
                  </span>
                  <span className={cn('text-meta', cur ? 'font-semibold' : 'text-muted-foreground')}>{t(`clients:status.${s}`)}</span>
                </button>
              </li>
            )
          })}
        </ol>
        {c.status === 'cancelled' && <p className="mt-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{t('clients:journey.cancelled')}</p>}
        {todos.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3">
            <span className="text-meta font-semibold text-muted-foreground">{t('clients:todo.title')}</span>
            {todos.map((x) => <span key={x} className="rounded-full bg-warning-soft px-2 py-0.5 text-meta font-medium text-warning">{t(`clients:todo.${x}`)}</span>)}
          </div>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          <SectionCard title={t('clients:booking.title')} icon={Building2}>
            <KeyValueGrid columns={3} items={[
              { key: 'p', label: t('clients:booking.property'), value: property ? <Link className="font-medium text-primary hover:underline" to={paths.property(property.id)}>{property.title}</Link> : '—' },
              { key: 'v', label: t('clients:booking.value'), value: <span className="font-semibold tabular-nums">{c.dealValue ? inr(c.dealValue) : '—'}</span> },
              { key: 'b', label: t('clients:booking.token'), value: <span className="tabular-nums">{c.bookingAmount ? inr(c.bookingAmount) : '—'}</span> },
              { key: 'd', label: t('clients:booking.date'), value: fmtDate(c.bookedAt, i18n.language) },
              { key: 'o', label: t('clients:booking.owner'), value: owner ? <span className="flex items-center gap-1.5"><UserAvatar name={owner.name} size="xs" />{owner.name}</span> : '—' },
              { key: 'c', label: t('clients:booking.contact'), value: <span className="tabular-nums">{phoneDisplay(c.phone)}{c.email ? <span className="block text-meta text-muted-foreground">{c.email}</span> : null}</span> },
            ]} />
          </SectionCard>
          <DocumentsCard client={c} edit={edit} />
          <SectionCard title={t('clients:timeline.title')} icon={ListChecks} description={lead ? t('clients:timeline.body', { name: lead.name }) : t('clients:timeline.noLead')}>
            {lead ? <ActivityTimeline refTo={{ kind: 'lead', id: lead.id }} limit={40} /> : null}
          </SectionCard>
        </div>
        <aside className="flex flex-col gap-5" aria-label={t('clients:detail.side')}>
          <LoanCard client={c} edit={edit} />
          <KycCard client={c} edit={edit} />
          <ClientAICard client={c} />
          <NotesCard client={c} edit={edit} />
          <SectionCard
            title={t('clients:appointments.title')} icon={CalendarPlus}
            action={lead && scope('appointment.manage') !== false ? <Button size="sm" variant="secondary" disabled={!can('appointment.manage', { ownerId: c.ownerId })} onClick={() => setVisit(true)}><CalendarPlus />{t('clients:appointments.add')}</Button> : undefined}
          >
            {appts.length ? <ul className="flex flex-col gap-2">{appts.slice(0, 6).map((a) => <li key={a.id}><AppointmentCard appointment={a} showDate /></li>)}</ul>
              : <EmptyState compact illustration={EmptyCalendar} title={t('clients:appointments.none')} />}
          </SectionCard>
          {edit && (
            <div className="flex flex-wrap gap-2">
              {c.status !== 'cancelled' && c.status !== 'converted' && <Button variant="secondary" className="text-danger" onClick={() => setConfirm('cancel')}><Ban />{t('clients:journey.cancel')}</Button>}
              {scope('lead.delete') !== false && <Button variant="ghost" className="text-danger hover:bg-danger-soft hover:text-danger" disabled={!can('lead.delete', c)} onClick={() => setConfirm('delete')}><Trash2 />{t('clients:detail.delete')}</Button>}
            </div>
          )}
        </aside>
      </div>
      {lead && visit && <AppointmentFormDialog open onOpenChange={setVisit} leadId={lead.id} type="documentation" propertyIds={c.propertyId ? [c.propertyId] : undefined} />}
      <ConfirmDialog
        open={confirm === 'cancel'} onOpenChange={(o) => !o && setConfirm(null)} tone="danger"
        title={t('clients:journey.cancelTitle', { name: c.name })} description={t('clients:journey.cancelBody')} confirmLabel={t('clients:journey.cancelConfirm')}
        onConfirm={() => { move('cancelled'); setConfirm(null) }}
      />
      <ConfirmDialog
        open={confirm === 'delete'} onOpenChange={(o) => !o && setConfirm(null)} tone="danger"
        title={t('clients:detail.deleteTitle', { name: c.name })} description={t('clients:detail.deleteBody')} confirmLabel={t('clients:detail.delete')}
        onConfirm={() => {
          try {
            const r = deleteClient(c.id)
            toastUndo(t('clients:detail.deleted', { name: c.name }), r.undoToken)
            navigate(paths.clients())
          } catch (e) { toastError(e) }
          setConfirm(null)
        }}
      />
    </div>
  )
}

const DOC_TONE: Record<Client['documents'][number]['status'], string> = {
  pending: 'bg-muted text-muted-foreground', received: 'bg-warning-soft text-warning', verified: 'bg-success-soft text-success',
}

function DocumentsCard({ client: c, edit }: { client: Client; edit: boolean }) {
  const { t } = useTranslation('clients')
  const [name, setName] = useState('')
  const p = docsProgress(c)
  const missing = missingStandardDocs(c)
  const label = (n: string) => (DOC_KEY[n] ? t(`doc.${DOC_KEY[n]}`) : n)
  const set = (n: string, s: Client['documents'][number]['status']) => {
    try { setClientDocument(c.id, n, s); toast.success(t('docs.set', { name: label(n), status: t(`docStatus.${s}`) })) } catch (e) { toastError(e) }
  }
  return (
    <SectionCard
      title={t('docs.title')} icon={FileCheck2} description={t('docs.summary', { verified: p.verified, received: p.received, pending: p.pending })}
      action={<ProgressRing value={p.pct} size={44} tone={p.pending ? 'warning' : 'success'} label={t('docs.title')} />}
    >
      {c.documents.length === 0 && <p className="mb-3 text-sm text-muted-foreground">{t('docs.none')}</p>}
      <ul className="flex flex-col divide-y" data-testid="client-docs">
        {c.documents.map((d) => (
          <li key={d.name} className="flex flex-wrap items-center gap-2 py-2">
            <IconTile icon={d.status === 'verified' ? BadgeCheck : FileCheck2} size="sm" tone={d.status === 'verified' ? 'success' : d.status === 'received' ? 'warning' : 'neutral'} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{label(d.name)}</span>
            {edit ? (
              <div className="flex gap-1" role="group" aria-label={t('docs.statusFor', { name: label(d.name) })}>
                {DOC_STATUSES.map((s) => <Chip key={s} size="sm" pressed={d.status === s} onClick={() => set(d.name, s)}>{t(`docStatus.${s}`)}</Chip>)}
                <Button variant="ghost" size="icon-xs" aria-label={t('docs.remove', { name: label(d.name) })} onClick={() => {
                  try { const r = removeClientDocument(c.id, d.name); toastUndo(t('docs.removed', { name: label(d.name) }), r.undoToken) } catch (e) { toastError(e) }
                }}><Trash2 /></Button>
              </div>
            ) : <span className={cn('rounded-full px-2 py-0.5 text-meta font-medium', DOC_TONE[d.status])}>{t(`docStatus.${d.status}`)}</span>}
          </li>
        ))}
      </ul>
      {edit && (
        <div className="mt-3 flex flex-col gap-2 border-t pt-3">
          {missing.length > 0 && (
            <Button size="sm" variant="secondary" className="self-start" onClick={() => {
              try { const r = addClientDocuments(c.id, missing); toastUndo(t('docs.addedStandard', { count: r.result ?? 0 }), r.undoToken) } catch (e) { toastError(e) }
            }}><ListChecks />{t('docs.addStandard', { count: missing.length })}</Button>
          )}
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { set(name.trim(), 'pending'); setName('') } }}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('docs.customPlaceholder')} aria-label={t('docs.custom')} list="std-docs" />
            <datalist id="std-docs">{STANDARD_DOCS.map((n) => <option key={n} value={n} />)}</datalist>
            <Button type="submit" size="sm" variant="secondary" disabled={!name.trim()}><FilePlus2 />{t('docs.add')}</Button>
          </form>
        </div>
      )}
    </SectionCard>
  )
}

function LoanCard({ client: c, edit }: { client: Client; edit: boolean }) {
  const { t } = useTranslation('clients')
  const loan = c.loan ?? { status: 'notApplied' as const }
  const save = (patch: Partial<NonNullable<Client['loan']>>, msg: string) => {
    try { updateClient(c.id, { loan: { ...loan, ...patch } }); toast.success(msg) } catch (e) { toastError(e) }
  }
  const step = LOAN_STATUSES.indexOf(loan.status)
  return (
    <SectionCard title={t('loan.title')} icon={Landmark}>
      <ol className="mb-3 flex gap-1" aria-label={t('loan.title')}>
        {LOAN_STATUSES.map((s, i) => (
          <li key={s} className="flex-1">
            <span className={cn('block h-1.5 rounded-full', i <= step && step > 0 ? 'bg-primary' : 'bg-muted')} />
            <span className={cn('mt-1 block truncate text-micro', loan.status === s ? 'font-semibold' : 'text-muted-foreground')}>{t(`loan.${s}`)}</span>
          </li>
        ))}
      </ol>
      {edit ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('loan.status')}>
            {LOAN_STATUSES.map((s) => <Chip key={s} size="sm" pressed={loan.status === s} onClick={() => save({ status: s }, t('loan.saved'))}>{t(`loan.${s}`)}</Chip>)}
          </div>
          <label className="flex flex-col gap-1 text-meta font-medium">
            {t('loan.bank')}
            <Select value={loan.bank ?? ''} onValueChange={(v) => save({ bank: v }, t('loan.saved'))}>
              <SelectTrigger className="w-full"><SelectValue placeholder={t('loan.chooseBank')} /></SelectTrigger>
              <SelectContent>{BANKS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <LoanAmount value={loan.amount} onSave={(v) => save({ amount: v }, t('loan.saved'))} />
        </div>
      ) : (
        <p className="text-sm">{t(`loan.${loan.status}`)}{loan.bank ? ` · ${loan.bank}` : ''}{loan.amount ? ` · ${inrShort(loan.amount)}` : ''}</p>
      )}
    </SectionCard>
  )
}

function LoanAmount({ value, onSave }: { value?: number; onSave: (v: number | undefined) => void }) {
  const { t } = useTranslation('clients')
  const [v, setV] = useState(value)
  return (
    <div className="flex items-end gap-2">
      <label className="flex flex-1 flex-col gap-1 text-meta font-medium">{t('loan.amount')}<AmountInput value={v} onChange={setV} /></label>
      <Button size="sm" variant="secondary" disabled={v === value} onClick={() => onSave(v)}>{t('common:actions.save')}</Button>
    </div>
  )
}

function KycCard({ client: c, edit }: { client: Client; edit: boolean }) {
  const { t } = useTranslation('clients')
  return (
    <SectionCard title={t('kyc.title')} icon={ShieldCheck}>
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>{c.kyc === 'done' ? t('kyc.done') : t('kyc.pending')}</span>
        <Switch disabled={!edit} checked={c.kyc === 'done'} aria-label={t('kyc.toggle')} onCheckedChange={(v) => {
          try { updateClient(c.id, { kyc: v ? 'done' : 'pending' }); toast.success(v ? t('kyc.markedDone') : t('kyc.markedPending')) } catch (e) { toastError(e) }
        }} />
      </label>
    </SectionCard>
  )
}

function NotesCard({ client: c, edit }: { client: Client; edit: boolean }) {
  const { t } = useTranslation('clients')
  const [text, setText] = useState(c.notes ?? '')
  return (
    <SectionCard title={t('notes.title')} icon={NotebookPen}>
      {edit ? (
        <div className="flex flex-col gap-2">
          <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('notes.placeholder')} aria-label={t('notes.title')} />
          <Button size="sm" variant="secondary" className="self-end" disabled={text === (c.notes ?? '')} onClick={() => {
            try { updateClient(c.id, { notes: text.trim() || undefined }); toast.success(t('notes.saved')) } catch (e) { toastError(e) }
          }}>{t('common:actions.save')}</Button>
        </div>
      ) : <p className="text-sm whitespace-pre-line">{c.notes || t('notes.none')}</p>}
    </SectionCard>
  )
}

/** The lead's AI summary plus a documents-reminder WhatsApp drafted by the AI (Demo AI badge); the user sends it. */
function ClientAICard({ client: c }: { client: Client }) {
  const { t } = useTranslation(['clients', 'leads'])
  const { ai, context } = useAI()
  const { can } = usePermission()
  const lead = useWholeDb().leads.find((l) => l.id === c.leadId)
  const [n, setN] = useState(0)
  const pending = c.documents.filter((d) => d.status === 'pending').map((d) => (DOC_KEY[d.name] ? t(`clients:doc.${DOC_KEY[d.name]}`) : d.name))
  const ai2 = useAIResult<[AIText, AIText]>(lead ? `${lead.id}:${c.updatedAt}:${n}` : null, () => Promise.all([
    ai.summarize({ kind: 'lead', id: c.leadId }, context()),
    ai.generateMessage({ leadId: c.leadId, purpose: 'reminder', channel: 'whatsapp', tone: 'english' }, context()),
  ]))
  const [sum, msg] = ai2.data ?? [null, null]
  const busy = ai2.loading
  if (!lead) return null
  const text = msg ? `${msg.text}${pending.length ? `\n\n${t('clients:ai.pendingDocs', { docs: pending.join(', ') })}` : ''}` : ''
  return (
    <SectionCard title={t('clients:ai.title')} icon={Sparkles} action={<span className="flex items-center gap-1"><DemoAIBadge mode={sum?.mode ?? ai.mode} /><Button variant="ghost" size="icon-sm" onClick={() => setN((x) => x + 1)} aria-label={t('leads:detail.refresh')}>{busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}</Button></span>}>
      {busy && !sum ? <div className="flex flex-col gap-2"><div className="skeleton h-3 w-3/4" /><div className="skeleton h-3 w-1/2" /></div> : (
        <ul className="flex flex-col gap-1 text-sm">
          {(sum?.bullets ?? (sum ? [sum.text] : [])).slice(0, 3).map((b) => <li key={b} className="flex gap-2"><span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-ai" />{b}</li>)}
        </ul>
      )}
      {text && c.phone && (
        <div className="mt-3 flex flex-col gap-2 border-t pt-3">
          <p className="text-meta font-semibold">{t('clients:ai.reminder')}</p>
          <p className="ai-filled rounded-md px-2 py-1.5 text-meta whitespace-pre-line">{text}</p>
          <Button asChild size="sm" className="self-start bg-success text-success-foreground hover:bg-[color-mix(in_oklch,var(--success),var(--foreground)_12%)]">
            <a href={waLink(c.phone, text)} target="_blank" rel="noopener noreferrer" onClick={() => { if (can('lead.edit', lead)) logContact(lead.id, { channel: 'whatsapp', text }) }}>
              <MessageCircle />{t('clients:ai.send')}
            </a>
          </Button>
        </div>
      )}
    </SectionCard>
  )
}
