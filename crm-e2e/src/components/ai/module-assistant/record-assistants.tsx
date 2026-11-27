/**
 * Assistants that work on one record (master prompt §12.2 / §12.7): Lead editing, Property editing, Lead
 * qualification, Property matching and Follow-up. They read the record, propose changes as cards the user confirms,
 * and show every AI result with the Demo AI badge.
 */
import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, CalendarClock, CircleCheck, CircleDot, ClipboardCheck, Handshake, PencilLine, RefreshCw, Send, Star, Target } from 'lucide-react'
import i18next from 'i18next'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useAI } from '@/ai'
import { aiMeta, propose } from '@/ai/proposals'
import { patchFromPath, purposeForStage, suggestFollowUpTime } from '@/ai/simulated/assist'
import { changeText, fieldLabelKey } from '@/ai/simulated/summaries'
import type { ActionProposal, AIDraft, AIText, CommandPlan, LeadScore, Match, NextActionSuggestion, QualCheckKey, QualificationResult } from '@/ai/types'
import { paths, pathFor } from '@/app/paths'
import { ScoreRing, ProgressRing } from '@/components/shared/progress-ring'
import { Segmented } from '@/components/shared/segmented'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import type { ID, MessagePurpose } from '@/domain/types'
import { useDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { fmtDateTime, inrShort } from '@/lib/format'
import { summaryLine } from '@/lib/matching'
import { cn } from '@/lib/utils'
import { AnswerBody, DraftCard } from '../ai-answer'
import { AISuggestionChip } from '../ai-suggestion-chip'
import { MissingQuestions } from '../missing-questions'
import { AssistantShell, AssistError, AssistInput, ProposalList, Thinking } from './parts'
import { useAssistCall } from './use-assist-call'

function Missing({ what }: { what: 'lead' | 'property' }) {
  const { t } = useTranslation('ai')
  return <p className="rounded-md bg-muted px-2.5 py-2 text-meta text-muted-foreground">{t(`assist.missingRecord.${what}`)}</p>
}

/* ---------- lead / property editing ---------- */

export type RecordEditProps = { leadId?: ID; propertyId?: ID; compact?: boolean; className?: string; defaultText?: string }

export function RecordEditAssistant({ kind, id, compact, className, defaultText }: { kind: 'lead' | 'property'; id?: ID; compact?: boolean; className?: string; defaultText?: string }) {
  const { t } = useTranslation('ai')
  const { ai, context } = useAI()
  const name = useDb((db) => (kind === 'lead' ? db.leads.find((l) => l.id === id)?.name : db.properties.find((p) => p.id === id)?.title))
  const call = useAssistCall<CommandPlan>()
  const key = kind === 'lead' ? 'leadEdit' : 'propertyEdit'
  return (
    <AssistantShell icon={PencilLine} title={t(`assist.${key}.title`)} description={name ? t(`assist.${key}.body`, { name }) : undefined} mode={call.result?.mode ?? ai.mode} compact={compact} className={className} testId={`assistant-${key}`}>
      {!id || !name ? <Missing what={kind} /> : (
        <>
          <AssistInput
            label={t(`assist.${key}.title`)} placeholder={t(`assist.${key}.placeholder`)} submitLabel={t('assist.readChanges')} busy={call.busy} rows={2} defaultText={defaultText}
            onSubmit={(text) => void call.run(() => ai.readUpdate({ kind, id }, text, context()))}
            testId={`assistant-${key}`}
          />
          {call.busy && <Thinking />}
          {call.error && <AssistError onRetry={call.retry} />}
          {call.result && !call.busy && (
            <div className="flex flex-col gap-2 text-sm">
              <AnswerBody plan={call.result} />
              <ProposalList proposals={call.result.proposals} mode={call.result.mode} compact={compact} />
            </div>
          )}
        </>
      )}
    </AssistantShell>
  )
}

/* ---------- qualification ---------- */

const CHECKS: QualCheckKey[] = ['budget', 'authority', 'need', 'timeline']

export function LeadQualifyAssistant({ leadId, compact, className }: { leadId?: ID; compact?: boolean; className?: string }) {
  const { t } = useTranslation(['ai', 'leads', 'catalogue'])
  const { ai, context } = useAI()
  const lead = useDb((db) => db.leads.find((l) => l.id === leadId))
  const { can } = usePermission()
  const call = useAssistCall<QualificationResult>()
  const [answers, setAnswers] = useState<ActionProposal[]>([])
  const [answered, setAnswered] = useState<Set<string>>(new Set())
  const stamp = lead?.updatedAt
  const { run } = call
  // read again whenever the lead changes (an answer was applied)
  useEffect(() => {
    if (leadId && stamp) void run(() => ai.qualifyLead(leadId, context()))
  }, [leadId, stamp, run, ai, context])
  const r = call.result
  const mayEdit = !!lead && can('lead.edit', lead)
  const inferredProposal = useMemo(() => {
    if (!r || !lead || !Object.keys(r.inferred).length) return undefined
    const q = lead.qualification as unknown as Record<string, unknown>
    return propose({
      kind: 'updateLead', permission: 'lead.edit', targets: [{ kind: 'lead', id: lead.id }],
      summary: [{ label: 'ai:field.lead', value: lead.name }, ...Object.entries(r.inferred).map(([k, v]) => ({ label: fieldLabelKey(`qualification.${k}`), value: changeText(`qualification.${k}`, q[k], v) }))],
      payload: { leadId: lead.id, patch: { qualification: r.inferred }, fieldMeta: aiMeta({ qualification: r.inferred }, 0.75) },
    })
  }, [r, lead])
  const answer = (field: string, value: unknown) => {
    if (!lead) return
    const patch = patchFromPath(field, value)
    setAnswered((s) => new Set(s).add(field))
    setAnswers((a) => [...a, propose({
      kind: 'updateLead', permission: 'lead.edit', targets: [{ kind: 'lead', id: lead.id }],
      summary: [{ label: 'ai:field.lead', value: lead.name }, { label: fieldLabelKey(field), value: changeText(field, undefined, value) }],
      payload: { leadId: lead.id, patch },
    })])
  }
  const known = r?.known.length ?? 0
  return (
    <AssistantShell
      icon={ClipboardCheck} title={t('ai:assist.leadQualify.title')} description={lead ? t('ai:assist.leadQualify.body', { name: lead.name }) : undefined}
      mode={r?.mode ?? ai.mode} compact={compact} className={className} testId="assistant-leadQualify"
      action={lead && <Button variant="ghost" size="icon-sm" aria-label={t('ai:assist.refresh')} onClick={() => void call.run(() => ai.qualifyLead(lead.id, context()))}><RefreshCw /></Button>}
    >
      {!lead ? <Missing what="lead" /> : call.busy && !r ? <Thinking /> : call.error ? <AssistError onRetry={call.retry} /> : r && (
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex items-center gap-3">
            <ProgressRing value={(known / 4) * 100} size={52} tone={known === 4 ? 'success' : 'ai'} label={t('ai:assist.leadQualify.ring')}>{`${known}/4`}</ProgressRing>
            <ul className="grid flex-1 grid-cols-2 gap-1.5">
              {CHECKS.map((c) => {
                const ok = r.known.includes(c)
                return (
                  <li key={c} className={cn('flex items-center gap-1.5 rounded-md px-2 py-1 text-meta', ok ? 'bg-success-soft text-success' : 'bg-muted text-muted-foreground')}>
                    {ok ? <CircleCheck className="size-3.5 shrink-0" aria-hidden="true" /> : <CircleDot className="size-3.5 shrink-0" aria-hidden="true" />}
                    <span className="truncate font-medium">{t(`ai:qualCheck.${c}`)}</span>
                    <span className="sr-only">{ok ? t('ai:qualCheck.known') : t('ai:qualCheck.missing')}</span>
                  </li>
                )
              })}
            </ul>
          </div>
          {inferredProposal && mayEdit && (
            <div className="flex flex-col gap-1.5">
              <p className="text-meta font-medium text-ai">{t('ai:assist.leadQualify.inferred')}</p>
              <ProposalList proposals={[inferredProposal]} mode={r.mode} compact />
            </div>
          )}
          {mayEdit && r.questions.length > 0 && <MissingQuestions questions={r.questions} answered={answered} onAnswer={answer} />}
          {answers.length > 0 && <ProposalList proposals={answers} mode={r.mode} compact />}
          {!r.questions.length && !inferredProposal && <p className="flex items-center gap-1.5 text-meta text-success"><BadgeCheck className="size-4" aria-hidden="true" />{t('ai:assist.leadQualify.complete')}</p>}
        </div>
      )}
    </AssistantShell>
  )
}

/* ---------- matching ---------- */

export function PropertyMatchAssistant({ leadId, propertyId, compact, className }: { leadId?: ID; propertyId?: ID; compact?: boolean; className?: string }) {
  const { t } = useTranslation(['ai', 'matching'])
  const { ai, context } = useAI()
  const lead = useDb((db) => db.leads.find((l) => l.id === leadId))
  const property = useDb((db) => db.properties.find((p) => p.id === propertyId))
  const { can } = usePermission()
  const forLead = useAssistCall<{ matches: Match[]; text: AIText }>()
  const forProperty = useAssistCall<CommandPlan>()
  const [picked, setPicked] = useState<Set<ID>>(new Set())
  const [proposals, setProposals] = useState<ActionProposal[]>([])
  const runLead = forLead.run
  const runProperty = forProperty.run
  const propertyTitle = property?.title
  useEffect(() => {
    if (leadId) void runLead(() => ai.matchProperties(leadId, context()))
    else if (propertyId && propertyTitle) void runProperty(() => ai.parseCommand(`Which buyers match ${propertyTitle}?`, { ...context(), selection: { kind: 'property', id: propertyId } }))
  }, [leadId, propertyId, propertyTitle, runLead, runProperty, ai, context])
  const result = forLead.result
  const matches = useMemo(() => result?.matches.slice(0, 5) ?? [], [result])
  // pre-select the top three of each new answer
  const [seen, setSeen] = useState<typeof result>(null)
  if (result && seen !== result) {
    setSeen(result)
    setPicked(new Set(result.matches.slice(0, 3).map((m) => m.property.id)))
  }
  const mayEdit = !!lead && can('lead.edit', lead)
  const act = (kind: 'share' | 'shortlist') => {
    if (!lead) return
    const ids = matches.filter((m) => picked.has(m.property.id)).map((m) => m.property.id)
    if (!ids.length) return
    const titles = matches.filter((m) => picked.has(m.property.id)).map((m) => `${m.property.title} · ${inrShort(m.property.price)}`)
    setProposals(kind === 'share'
      ? [propose({ kind: 'shareProperties', permission: 'lead.edit', targets: [{ kind: 'lead', id: lead.id }], summary: [{ label: 'ai:field.lead', value: lead.name }, { label: 'ai:field.properties', value: titles.join('\n') }, { label: 'ai:field.channel', value: t('ai:channel.whatsapp') }], payload: { leadId: lead.id, propertyIds: ids } })]
      : ids.map((pid, i) => propose({ kind: 'shortlistProperty', permission: 'lead.edit', targets: [{ kind: 'lead', id: lead.id }, { kind: 'property', id: pid }], summary: [{ label: 'ai:field.lead', value: lead.name }, { label: 'ai:field.property', value: titles[i] }], payload: { leadId: lead.id, propertyId: pid } })))
  }
  const busy = forLead.busy || forProperty.busy
  const mode = forLead.result?.text.mode ?? forProperty.result?.mode ?? ai.mode
  return (
    <AssistantShell icon={Target} title={t('ai:assist.propertyMatch.title')} description={lead ? t('ai:assist.propertyMatch.bodyLead', { name: lead.name }) : property ? t('ai:assist.propertyMatch.bodyProperty', { name: property.title }) : undefined} mode={mode} compact={compact} className={className} testId="assistant-propertyMatch">
      {!lead && !property ? <Missing what="lead" /> : busy ? <Thinking /> : forLead.error || forProperty.error ? <AssistError onRetry={lead ? forLead.retry : forProperty.retry} /> : lead ? (
        <div className="flex flex-col gap-2 text-sm">
          <p>{forLead.result?.text.text}</p>
          {matches.length > 0 && (
            <ul className="flex flex-col divide-y rounded-lg border bg-card">
              {matches.map((m) => (
                <li key={m.property.id} className="flex items-start gap-2.5 px-2.5 py-2">
                  {mayEdit && <Checkbox className="mt-1.5" checked={picked.has(m.property.id)} aria-label={t('ai:assist.propertyMatch.pick', { name: m.property.title })} onCheckedChange={(v) => setPicked((s) => { const n = new Set(s); if (v) n.add(m.property.id); else n.delete(m.property.id); return n })} />}
                  <ScoreRing score={m.score} kind="match" size={34} label={t('ai:result.match')} />
                  <span className="min-w-0 flex-1">
                    <Link to={pathFor({ kind: 'property', id: m.property.id })} className="block truncate font-medium hover:underline">{m.property.title}</Link>
                    <span className="block text-meta text-muted-foreground">{m.property.location.locality} · {inrShort(m.property.price)}</span>
                    <span className="mt-0.5 block text-meta text-foreground/80">{summaryLine(m, i18next.t)}</span>
                  </span>
                  {m.memory && <span className="shrink-0 rounded-full bg-muted px-2 text-micro font-semibold text-muted-foreground">{t(`ai:memory.${m.memory}`)}</span>}
                </li>
              ))}
            </ul>
          )}
          {mayEdit && matches.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ai" disabled={!picked.size} onClick={() => act('share')} data-testid="match-share"><Send />{t('ai:assist.propertyMatch.share', { count: picked.size })}</Button>
              <Button size="sm" variant="secondary" disabled={!picked.size} onClick={() => act('shortlist')}><Star />{t('ai:assist.propertyMatch.shortlist', { count: picked.size })}</Button>
              <Button asChild size="sm" variant="ghost"><Link to={paths.matching({ lead: lead.id })}>{t('ai:nav.matching')}</Link></Button>
            </div>
          )}
          {proposals.length > 0 && <ProposalList proposals={proposals} mode={mode} compact />}
        </div>
      ) : forProperty.result && (
        <div className="text-sm"><AnswerBody plan={forProperty.result} /></div>
      )}
    </AssistantShell>
  )
}

/* ---------- follow-up ---------- */

const PURPOSES: MessagePurpose[] = ['intro', 'followUp', 'visitConfirm', 'postVisit', 'offer', 'reminder']

export function FollowUpAssistant({ leadId, compact, className }: { leadId?: ID; compact?: boolean; className?: string }) {
  const { t } = useTranslation(['ai', 'leads', 'catalogue'])
  const { ai, context } = useAI()
  const lead = useDb((db) => db.leads.find((l) => l.id === leadId))
  const { can } = usePermission()
  const [tone, setTone] = useState<'english' | 'hinglish'>('english')
  const [purpose, setPurpose] = useState<MessagePurpose | undefined>()
  const now = useNow()
  const call = useAssistCall<{ next: NextActionSuggestion; score: LeadScore; draft: AIDraft; mode: CommandPlan['mode'] }>()
  const [task, setTask] = useState<ActionProposal[]>([])
  const stamp = lead?.updatedAt
  const stagePurpose = lead ? purposeForStage(lead) : 'followUp'
  const effectivePurpose = purpose ?? stagePurpose
  const { run } = call
  useEffect(() => {
    if (!leadId || !stamp) return
    void run(async () => {
      const ctx = context()
      const [next, score, msg] = await Promise.all([
        ai.suggestNextAction(leadId, ctx),
        ai.scoreLead(leadId, ctx),
        ai.generateMessage({ leadId, purpose: effectivePurpose, channel: 'whatsapp', tone }, ctx),
      ])
      return { next, score, draft: { leadId, channel: 'whatsapp', purpose: effectivePurpose, tone, text: msg.text }, mode: msg.mode }
    })
  }, [leadId, stamp, tone, effectivePurpose, run, ai, context])
  const r = call.result
  const when = r && lead ? suggestFollowUpTime(lead, r.score.temperature, now) : undefined
  const plan = () => {
    if (!lead || !when) return
    const title = t('ai:taskTitle.followUp', { name: lead.name })
    setTask([propose({
      kind: 'createTask', permission: 'task.manage', targets: [{ kind: 'lead', id: lead.id }],
      summary: [{ label: 'ai:field.title', value: title }, { label: 'ai:field.due', value: fmtDateTime(when.at) }, { label: 'ai:field.lead', value: lead.name }],
      payload: { input: { title, type: 'followUp', ownerId: lead.ownerId ?? '', dueAt: when.at, leadId: lead.id, origin: 'ai' } },
    })])
  }
  return (
    <AssistantShell icon={Handshake} title={t('ai:assist.followUp.title')} description={lead ? t('ai:assist.followUp.body', { name: lead.name }) : undefined} mode={r?.mode ?? ai.mode} compact={compact} className={className} testId="assistant-followUp">
      {!lead ? <Missing what="lead" /> : call.error ? <AssistError onRetry={call.retry} /> : !r ? <Thinking /> : (
        <div className="flex flex-col gap-3 text-sm">
          <AISuggestionChip>{t(r.next.key, r.next.params ?? {})}</AISuggestionChip>
          {when && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
              <CalendarClock className="size-4 text-ai" aria-hidden="true" />
              <span className="flex-1"><span className="font-semibold">{fmtDateTime(when.at)}</span> · <span className="text-muted-foreground">{t(when.reasonKey)}</span></span>
              {can('task.manage', { ownerId: lead.ownerId }) && lead.ownerId && <Button size="sm" variant="secondary" onClick={plan} data-testid="followup-plan">{t('ai:assist.followUp.plan')}</Button>}
            </div>
          )}
          {task.length > 0 && <ProposalList proposals={task} mode={r.mode} compact />}
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              value={tone} onChange={(v) => setTone(v)} label={t('ai:assist.followUp.tone')} variant="pill"
              segments={[{ value: 'english', label: t('ai:assist.followUp.english') }, { value: 'hinglish', label: t('ai:assist.followUp.hinglish') }]}
            />
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('ai:assist.followUp.purpose')}>
            {PURPOSES.map((p) => (
              <button
                key={p} type="button" aria-pressed={p === effectivePurpose} onClick={() => setPurpose(p)}
                className={cn('h-6 rounded-full border px-2 text-meta font-medium transition-colors duration-(--dur-fast) focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none', p === effectivePurpose ? 'border-ai bg-ai text-ai-foreground' : 'border-ai-border bg-card text-ai hover:bg-ai-soft')}
              >
                {t(`catalogue:messagePurpose.${p}`)}
              </button>
            ))}
          </div>
          {call.busy ? <Thinking /> : <DraftCard key={`${r.draft.purpose}-${r.draft.tone}-${r.draft.text.length}`} draft={r.draft} mode={r.mode} />}
        </div>
      )}
    </AssistantShell>
  )
}

