/**
 * Creation and extraction assistants (master prompt §12.2 / §12.3): Lead creation, Property creation, Appointment
 * creation and Import / extraction. Inside a form (an `onFill` callback is given) they are the paste-and-fill box that
 * fills and marks the form; on their own (the global panel's Tools, a dashboard) they read the text and propose the
 * record as a card the user confirms. Nothing is saved without a click.
 */
import { useRef } from 'react'
import { Building2, CalendarPlus, FileText, FileUp, UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useAI } from '@/ai'
import { propose } from '@/ai/proposals'
import { classifyImport, propertyInputFrom } from '@/ai/simulated/assist'
import type { CommandPlan, Extraction } from '@/ai/types'
import { paths } from '@/app/paths'
import { Button } from '@/components/ui/button'
import type { AppointmentInput, ColumnMapping, ID, ImportKind, LeadInput, PropertyInput } from '@/domain/types'
import { usePermission } from '@/hooks/use-permission'
import { inrShort, num } from '@/lib/format'
import { cn } from '@/lib/utils'
import { AnswerBody } from '../ai-answer'
import { EffortSaved } from '../effort-saved'
import { PasteAndFillBox } from '../paste-and-fill-box'
import { AssistantShell, AssistError, AssistInput, ProposalList, Thinking } from './parts'
import { useAssistCall } from './use-assist-call'

const MAX_FILE = 200_000

/** "From file" for .txt / .csv (read in the browser). */
function FileButton({ onText, accept = '.txt,.csv,text/plain,text/csv' }: { onText: (s: string) => void; accept?: string }) {
  const { t } = useTranslation('ai')
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => ref.current?.click()}><FileText />{t('assist.fromFile')}</Button>
      <input
        ref={ref} type="file" accept={accept} hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          if (f.size > MAX_FILE) return onText('')
          onText(await f.text())
        }}
      />
    </>
  )
}

const fieldsIn = (p: CommandPlan) => {
  const input = (p.proposals[0]?.payload as { input?: { fieldMeta?: Record<string, unknown> } } | undefined)?.input
  return Object.keys(input?.fieldMeta ?? {}).length
}

/* ---------- lead ---------- */

export type LeadCreateProps = {
  /** Form mode: fill the Add Lead form with the extraction. */
  onFill?: (x: Extraction<LeadInput>) => void
  onAnswer?: (field: string, value: unknown) => void
  answered?: ReadonlySet<string>
  onFocusField?: (field: string) => void
  defaultText?: string
  compact?: boolean
  className?: string
}

export function LeadCreateAssistant({ onFill, onAnswer, answered, onFocusField, defaultText, compact, className }: LeadCreateProps) {
  const { t } = useTranslation('ai')
  const { ai, context } = useAI()
  const call = useAssistCall<CommandPlan>()
  if (onFill) return <PasteAndFillBox kind="lead" onFill={onFill} onAnswer={onAnswer} answered={answered} onFocusField={onFocusField} defaultText={defaultText} className={className} />
  const plan = call.result
  return (
    <AssistantShell icon={UserPlus} title={t('assist.leadCreate.title')} description={t('assist.leadCreate.body')} mode={plan?.mode ?? ai.mode} compact={compact} className={className} testId="assistant-leadCreate">
      <AssistInput
        label={t('assist.leadCreate.title')} placeholder={t('paste.placeholder.lead')} submitLabel={t('paste.extract')} busy={call.busy} defaultText={defaultText}
        onSubmit={(text) => void call.run(() => ai.parseCommand(`Add lead: ${text}`, context()))}
        extra={(setText) => <FileButton onText={setText} />}
        testId="assistant-leadCreate"
      />
      {call.busy && <Thinking />}
      {call.error && <AssistError onRetry={call.retry} />}
      {plan && !call.busy && (
        <div className="flex flex-col gap-2 text-sm">
          {plan.proposals.length > 0 && <EffortSaved count={fieldsIn(plan)} />}
          <AnswerBody plan={plan} />
          <ProposalList proposals={plan.proposals} mode={plan.mode} compact={compact} />
        </div>
      )}
    </AssistantShell>
  )
}

/* ---------- property ---------- */

export type PropertyCreateProps = {
  onFill?: (x: Extraction<PropertyInput>) => void
  onAnswer?: (field: string, value: unknown) => void
  answered?: ReadonlySet<string>
  onFocusField?: (field: string) => void
  defaultText?: string
  compact?: boolean
  className?: string
}

/** The listing as a short fact list and, when the essentials are there, an "Add property" proposal. */
export function PropertyExtractionResult({ x, compact }: { x: Extraction<PropertyInput>; compact?: boolean }) {
  const { t } = useTranslation(['ai', 'catalogue'])
  const { can } = usePermission()
  const input = propertyInputFrom(x)
  const f = x.fields
  const facts = [
    f.title && { k: 'ai:field.title', v: f.title },
    f.type && { k: 'ai:field.type', v: t(`catalogue:propertyType.${f.type}`) },
    (f.location?.locality || f.location?.city) && { k: 'ai:field.location', v: [f.location?.locality, f.location?.city].filter(Boolean).join(', ') },
    f.price && { k: 'ai:changeField.price', v: inrShort(f.price) },
    (f.area?.carpet || f.area?.builtUp || f.area?.superBuiltUp || f.area?.plot) && { k: 'ai:changeField.area', v: num(f.area?.carpet ?? f.area?.builtUp ?? f.area?.superBuiltUp ?? f.area?.plot ?? 0) },
    f.facing && { k: 'ai:changeField.facing', v: t(`catalogue:facing.${f.facing}`) },
    f.possession && { k: 'ai:changeField.possession', v: t(`catalogue:possession.${f.possession.status}`) },
  ].filter((v): v is { k: string; v: string } => !!v)
  const proposal = input && can('property.create')
    ? propose({
      kind: 'createProperty', permission: 'property.create',
      summary: facts.map((x2) => ({ label: x2.k, value: x2.v })),
      payload: { input: input as unknown as Record<string, unknown> },
    })
    : undefined
  return (
    <div className="flex flex-col gap-2 text-sm">
      <EffortSaved count={x.filledCount} />
      {!proposal && facts.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border bg-card p-3">
          {facts.map((x2) => (
            <div key={x2.k} className="contents"><dt className="text-muted-foreground">{t(x2.k)}</dt><dd className="font-medium">{x2.v}</dd></div>
          ))}
        </dl>
      )}
      {x.missing.length > 0 && (
        <p className="rounded-md bg-warning-soft px-2.5 py-1.5 text-meta text-warning">
          {t('assist.propertyCreate.missing', { fields: x.missing.map((m) => t(`ai:missingField.${m}`)).join(', ') })}
        </p>
      )}
      {proposal ? <ProposalList proposals={[proposal]} mode={x.mode} compact={compact} /> : can('property.create') && (
        <Button asChild size="sm" variant="secondary" className="self-start"><Link to={paths.newProperty()}>{t('assist.propertyCreate.openForm')}</Link></Button>
      )}
    </div>
  )
}

export function PropertyCreateAssistant({ onFill, onAnswer, answered, onFocusField, defaultText, compact, className }: PropertyCreateProps) {
  const { t } = useTranslation('ai')
  const { ai, context } = useAI()
  const call = useAssistCall<Extraction<PropertyInput>>()
  if (onFill) return <PasteAndFillBox kind="property" onFill={onFill} onAnswer={onAnswer} answered={answered} onFocusField={onFocusField} defaultText={defaultText} className={className} />
  return (
    <AssistantShell icon={Building2} title={t('assist.propertyCreate.title')} description={t('assist.propertyCreate.body')} mode={call.result?.mode ?? ai.mode} compact={compact} className={className} testId="assistant-propertyCreate">
      <AssistInput
        label={t('assist.propertyCreate.title')} placeholder={t('paste.placeholder.property')} submitLabel={t('paste.extract')} busy={call.busy} defaultText={defaultText}
        onSubmit={(text) => void call.run(() => ai.extractProperty(text, context()))}
        extra={(setText) => <FileButton onText={setText} />}
        testId="assistant-propertyCreate"
      />
      {call.busy && <Thinking />}
      {call.error && <AssistError onRetry={call.retry} />}
      {call.result && !call.busy && <PropertyExtractionResult x={call.result} compact={compact} />}
    </AssistantShell>
  )
}

/* ---------- appointment ---------- */

export type AppointmentCreateProps = {
  /** The lead the appointment is for (a lead page); otherwise the text names the lead. */
  leadId?: ID
  onFill?: (x: Extraction<AppointmentInput>) => void
  onAnswer?: (field: string, value: unknown) => void
  answered?: ReadonlySet<string>
  onFocusField?: (field: string) => void
  defaultText?: string
  compact?: boolean
  className?: string
}

export function AppointmentCreateAssistant({ leadId, onFill, onAnswer, answered, onFocusField, defaultText, compact, className }: AppointmentCreateProps) {
  const { t } = useTranslation('ai')
  const { ai, context } = useAI()
  const call = useAssistCall<CommandPlan>()
  if (onFill) return <PasteAndFillBox kind="appointment" onFill={onFill} onAnswer={onAnswer} answered={answered} onFocusField={onFocusField} defaultText={defaultText} className={className} />
  const plan = call.result
  return (
    <AssistantShell icon={CalendarPlus} title={t('assist.appointmentCreate.title')} description={t('assist.appointmentCreate.body')} mode={plan?.mode ?? ai.mode} compact={compact} className={className} testId="assistant-appointmentCreate">
      <AssistInput
        label={t('assist.appointmentCreate.title')} placeholder={t('paste.placeholder.appointment')} submitLabel={t('assist.appointmentCreate.submit')} busy={call.busy} defaultText={defaultText} rows={2}
        onSubmit={(text) => void call.run(() => {
          const ctx = context()
          return ai.parseCommand(`Schedule appointment: ${text}`, leadId ? { ...ctx, selection: { kind: 'lead', id: leadId } } : ctx)
        })}
        testId="assistant-appointmentCreate"
      />
      {call.busy && <Thinking />}
      {call.error && <AssistError onRetry={call.retry} />}
      {plan && !call.busy && (
        <div className="flex flex-col gap-2 text-sm">
          <AnswerBody plan={plan} />
          <ProposalList proposals={plan.proposals} mode={plan.mode} compact={compact} />
        </div>
      )}
    </AssistantShell>
  )
}

/* ---------- import / extraction ---------- */

export type ImportAssistProps = {
  /** The sheet kind when known (the import wizard); otherwise guessed from the headers. */
  kind?: ImportKind
  /** Wizard mode: hand the suggested mapping back. */
  onMapping?: (m: ColumnMapping[], table: { headers: string[]; rows: string[][] }) => void
  compact?: boolean
  className?: string
}

type ImportResult =
  | { type: 'table'; kind: ImportKind; headers: string[]; rows: string[][]; mapping: ColumnMapping[] }
  | { type: 'lead' | 'appointment'; plan: CommandPlan }
  | { type: 'property'; x: Extraction<PropertyInput> }

export function ImportAssistant({ kind, onMapping, compact, className }: ImportAssistProps) {
  const { t } = useTranslation(['ai', 'import'])
  const { ai, context } = useAI()
  const { can } = usePermission()
  const call = useAssistCall<ImportResult>()
  const r = call.result
  const read = (text: string) => call.run(async (): Promise<ImportResult> => {
    const ctx = context()
    const c = classifyImport(text, kind)
    if (c.type === 'table') {
      const mapping = await ai.mapColumns(c.headers, c.rows.slice(0, 5), c.kind, ctx)
      return { type: 'table', kind: c.kind, headers: c.headers, rows: c.rows, mapping }
    }
    if (c.type === 'property') return { type: 'property', x: await ai.extractProperty(text, ctx) }
    if (c.type === 'appointment') return { type: 'appointment', plan: await ai.parseCommand(`Schedule appointment: ${text}`, ctx) }
    return { type: 'lead', plan: await ai.parseCommand(`Add lead: ${text}`, ctx) }
  })
  const mapped = r?.type === 'table' ? r.mapping.filter((m) => m.field).length : 0
  const mayBulk = r?.type === 'table' && can(r.kind === 'leads' ? 'import.leads' : 'import.properties')
  return (
    <AssistantShell icon={FileUp} title={t('ai:assist.import.title')} description={t('ai:assist.import.body')} mode={ai.mode} compact={compact} className={className} testId="assistant-import">
      <AssistInput
        label={t('ai:assist.import.title')} placeholder={t('ai:assist.import.placeholder')} submitLabel={t('ai:assist.import.submit')} busy={call.busy} rows={4}
        onSubmit={(text) => void read(text)}
        extra={(setText) => <FileButton onText={setText} />}
        testId="assistant-import"
      />
      {call.busy && <Thinking />}
      {call.error && <AssistError onRetry={call.retry} />}
      {r && !call.busy && r.type === 'table' && (
        <div className="flex flex-col gap-2 text-sm" data-testid="import-mapping">
          <p className="font-medium">{t('ai:assist.import.table', { rows: r.rows.length, columns: r.headers.length, kind: t(`ai:importKind.${r.kind}`) })}</p>
          <EffortSaved count={mapped} className="self-start" />
          <ul className="flex flex-col divide-y rounded-lg border bg-card">
            {r.mapping.map((m) => (
              <li key={m.column} className="flex items-center gap-2 px-2.5 py-1.5 text-meta">
                <span className="w-2/5 truncate font-medium" title={m.column}>{m.column}</span>
                <span aria-hidden="true" className="text-muted-foreground">→</span>
                <span className={cn('flex-1 truncate', !m.field && 'text-muted-foreground italic')}>{m.field ? t(`ai:importField.${m.field.replace('.', '_')}`) : t('ai:assist.import.skip')}</span>
                {m.field && (
                  <span className="flex w-16 items-center gap-1" title={t('ai:assist.import.confidence', { pct: Math.round(m.confidence * 100) })}>
                    <span aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className={cn('block h-full rounded-full', m.confidence >= 0.85 ? 'bg-success' : m.confidence >= 0.7 ? 'bg-primary' : 'bg-warning')} style={{ width: `${Math.round(m.confidence * 100)}%` }} /></span>
                    <span className="tabular-nums text-muted-foreground">{Math.round(m.confidence * 100)}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {onMapping && <Button size="sm" onClick={() => onMapping(r.mapping, { headers: r.headers, rows: r.rows })}>{t('ai:assist.import.useMapping')}</Button>}
            {mayBulk && <Button asChild size="sm" variant="secondary"><Link to={paths.importKind(r.kind)}>{t('ai:assist.import.openImport')}</Link></Button>}
            {!mayBulk && <p className="text-meta text-muted-foreground">{t('ai:assist.import.noBulk')}</p>}
          </div>
        </div>
      )}
      {r && !call.busy && (r.type === 'lead' || r.type === 'appointment') && (
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-meta text-muted-foreground">{t(`ai:assist.import.readAs.${r.type}`)}</p>
          {r.type === 'lead' && r.plan.proposals.length > 0 && <EffortSaved count={fieldsIn(r.plan)} />}
          <AnswerBody plan={r.plan} />
          <ProposalList proposals={r.plan.proposals} mode={r.plan.mode} compact={compact} />
        </div>
      )}
      {r && !call.busy && r.type === 'property' && (
        <div className="flex flex-col gap-2">
          <p className="text-meta text-muted-foreground">{t('ai:assist.import.readAs.property')}</p>
          <PropertyExtractionResult x={r.x} compact={compact} />
        </div>
      )}
      {can('import.document') && (
        <p className="text-meta text-muted-foreground">
          {t('ai:assist.import.documents')}{' '}
          <Link to={paths.import()} className="font-medium text-primary underline-offset-2 hover:underline">{t('ai:nav.import')}</Link>
        </p>
      )}
    </AssistantShell>
  )
}
