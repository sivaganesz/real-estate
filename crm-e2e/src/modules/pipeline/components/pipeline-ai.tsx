/**
 * Pipeline AI (master prompt §11 and §12.7 "Pipeline: stalled deals, next actions, conversion prediction").
 *  - StalledDealsPanel: the AI's pipeline summary, the stalled deals worst first, each with its recommended action and
 *    the provider's next best action; "Plan it" turns the advice into a follow-up task proposal that runs only on Confirm.
 *  - PipelineAssistant: type or say a change ("move Priya to negotiation"); the plan is shown as a proposal card and
 *    nothing changes until Confirm. Lost / Booked / Won open the stage dialog so the required details are asked for.
 * Every AI output carries the Demo AI badge.
 */
import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ClipboardList, Lightbulb, Send, ShieldCheck, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useAI, type ActionProposal, type AIText, type CommandPlan, type NextActionSuggestion } from '@/ai'
import { propose } from '@/ai/proposals'
import { ActionProposalCard, type ProposalState } from '@/components/ai/action-proposal-card'
import { AISuggestionChip } from '@/components/ai/ai-suggestion-chip'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { VoiceButton } from '@/components/ai/voice-button'
import { EntityLink } from '@/components/domain/entity-link'
import { StagePill } from '@/components/domain/lead-pills'
import { ErrorState } from '@/components/shared/error-state'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { paths } from '@/app/paths'
import type { ID, PipelineStageKey } from '@/domain/types'
import { usePermission } from '@/hooks/use-permission'
import { fmtDateTime, inrShort } from '@/lib/format'
import type { StalledDeal } from '@/lib/stalled'
import { cn } from '@/lib/utils'
import { executeProposal } from '@/services/commands'
import { NEEDS_DIALOG } from '../lib/pipeline'

const HOUR = 3_600_000

/* ---------- stalled deals ---------- */

export function StalledDealsPanel({ stalled, now, value, ownerName, open, onOpenChange }: {
  stalled: StalledDeal[]
  now: Date
  value: (id: ID) => number
  ownerName: (id: ID | null) => string | undefined
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { t, i18n } = useTranslation(['pipeline', 'ai'])
  const { ai, context } = useAI()
  const { can } = usePermission()
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; summary?: AIText; failed?: boolean; next: Record<ID, NextActionSuggestion> } | null>(null)
  const [plans, setPlans] = useState<Record<ID, { proposal: ActionProposal; state: ProposalState }>>({})
  const top = stalled.slice(0, 3)
  const ids = top.map((s) => `${s.lead.id}:${s.lead.stage}`).join('|')
  const loadKey = `${ids}#${attempt}`

  // The AI reads the pipeline whenever the stalled set changes (or on Try again); stale answers are dropped.
  useEffect(() => {
    if (!open) return undefined
    let alive = true
    const ctx = context()
    const leadIds = ids ? ids.split('|').map((k) => k.split(':')[0]) : []
    Promise.all([
      ai.summarize({ kind: 'pipeline' }, ctx),
      Promise.all(leadIds.map((id) => ai.suggestNextAction(id, ctx).then((s) => [id, s] as const))),
    ]).then(
      ([summary, rows]) => { if (alive) setResult({ key: loadKey, summary, next: Object.fromEntries(rows) }) },
      () => { if (alive) setResult({ key: loadKey, failed: true, next: {} }) },
    )
    return () => { alive = false }
  }, [open, ai, context, ids, loadKey])

  const current = result?.key === loadKey ? result : null
  const summary = current?.summary ?? null
  const failed = !!current?.failed
  const next = current?.next ?? {}
  const load = () => setAttempt((n) => n + 1)

  const plan = (s: StalledDeal) => {
    const ownerId = s.lead.ownerId
    const title = t(`pipeline:adviceTask.${s.advice.key}`, { name: s.lead.name })
    const due = new Date(now.getTime() + s.advice.dueInHours * HOUR).toISOString()
    const proposal = propose({
      kind: 'createTask', permission: 'task.manage', targets: [{ kind: 'lead', id: s.lead.id }],
      summary: [
        { label: 'pipeline:proposal.task', value: title },
        { label: 'pipeline:proposal.due', value: fmtDateTime(due, i18n.language) },
        { label: 'pipeline:proposal.owner', value: ownerName(ownerId) ?? t('pipeline:card.unassigned') },
        { label: 'pipeline:proposal.why', value: t('pipeline:card.stalledTip', { days: s.days, target: s.target }) },
      ],
      payload: { input: { title, type: s.advice.taskType, leadId: s.lead.id, ownerId: ownerId ?? '', dueAt: due, priority: 'high', notes: t(`pipeline:advice.${s.advice.key}`) } },
    })
    setPlans((p) => ({ ...p, [s.lead.id]: { proposal, state: { status: 'pending' } } }))
  }
  const confirm = (id: ID) => {
    const p = plans[id]
    if (!p) return
    try {
      const r = executeProposal(p.proposal)
      setPlans((x) => ({ ...x, [id]: { ...p, state: { status: 'done', links: r.links } } }))
      toastUndo(t('pipeline:ai.planned'), r.undoToken)
    } catch (e) {
      setPlans((x) => ({ ...x, [id]: { ...p, state: { status: 'error' } } }))
      toastError(e)
    }
  }

  return (
    <section
      aria-labelledby="pipeline-ai-title"
      className="rounded-xl border border-ai-border/70 bg-[radial-gradient(500px_circle_at_0_0,color-mix(in_oklch,var(--ai)_8%,transparent),transparent_60%)] bg-card p-4 shadow-card"
      data-testid="stalled-panel"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span aria-hidden="true" className="inline-flex size-8 items-center justify-center rounded-md bg-[image:var(--ai-gradient)] text-primary-foreground">
          <Sparkles className="size-4" />
        </span>
        <h2 id="pipeline-ai-title" className="text-base font-semibold">{t('pipeline:ai.title')}</h2>
        <DemoAIBadge mode={summary?.mode ?? ai.mode} />
        <span className="inline-flex h-5 items-center rounded-full bg-danger-soft px-2 text-meta font-semibold text-danger tabular-nums">{t('pipeline:ai.count', { count: stalled.length })}</span>
        <Button variant="ghost" size="sm" className="ml-auto" aria-expanded={open} aria-controls="pipeline-ai-body" onClick={() => onOpenChange(!open)}>
          <ChevronDown className={cn('transition-transform', open && 'rotate-180')} />{open ? t('pipeline:ai.hide') : t('pipeline:ai.show')}
        </Button>
      </div>
      {open && (
        <div id="pipeline-ai-body" className="mt-3 flex flex-col gap-3">
          {failed ? (
            <ErrorState compact onRetry={load} body={t('pipeline:ai.failed')} />
          ) : summary ? (
            <p className="text-sm text-muted-foreground" data-testid="pipeline-ai-summary">{summary.text}</p>
          ) : (
            <div className="flex flex-col gap-1.5" aria-busy="true" aria-label={t('ai:thinking')}>
              <span className="skeleton h-4 w-2/3 rounded" />
              <span className="skeleton h-4 w-1/3 rounded" />
            </div>
          )}
          {!top.length ? (
            <p className="flex items-center gap-2 rounded-lg bg-success-soft px-3 py-3 text-sm text-success">
              <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />{t('pipeline:ai.none')}
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {top.map((s) => {
                const n = next[s.lead.id]
                const p = plans[s.lead.id]
                return (
                  <li key={s.lead.id} className="flex flex-col gap-2 rounded-lg border bg-card p-3" data-testid="stalled-deal">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <Link to={paths.lead(s.lead.id)} className="block truncate text-sm font-semibold hover:underline">{s.lead.name}</Link>
                        <p className="text-meta text-muted-foreground tabular-nums">
                          {t('pipeline:ai.overdue', { days: s.days, target: s.target })} · {inrShort(value(s.lead.id))}
                        </p>
                      </div>
                      <StagePill stage={s.lead.stage} short />
                    </div>
                    <p className="flex items-start gap-1.5 text-meta">
                      <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-ai" aria-hidden="true" />
                      <span><span className="font-semibold">{t('pipeline:ai.recommend')}</span> {t(`pipeline:advice.${s.advice.key}`)}</span>
                    </p>
                    {n && n.key !== 'ai:next.none' && <AISuggestionChip title={t('pipeline:ai.nextTip')}>{t(n.key, n.params ?? {})}</AISuggestionChip>}
                    {p ? (
                      <ActionProposalCard
                        proposal={p.proposal} mode={ai.mode} state={p.state}
                        onConfirm={() => confirm(s.lead.id)}
                        onCancel={() => setPlans((x) => ({ ...x, [s.lead.id]: { ...p, state: { status: 'cancelled' } } }))}
                      />
                    ) : can('task.manage', s.lead) && s.lead.ownerId ? (
                      <Button variant="ai" size="sm" className="self-start" onClick={() => plan(s)} data-testid="plan-it">
                        <ClipboardList />{t('pipeline:ai.plan')}
                      </Button>
                    ) : !s.lead.ownerId ? <p className="text-meta text-warning">{t('pipeline:ai.needsOwner')}</p> : null}
                  </li>
                )
              })}
            </ul>
          )}
          {stalled.length > top.length && <p className="text-meta text-muted-foreground">{t('pipeline:ai.more', { count: stalled.length - top.length })}</p>}
        </div>
      )}
    </section>
  )
}

/* ---------- assistant ---------- */

export function PipelineAssistant({ examples, onNeedDialog }: {
  examples: { label: string; command: string }[]
  /** Lost / Booked / Won need details: the page opens the stage dialog and calls back when it is saved. */
  onNeedDialog: (leadId: ID, to: PipelineStageKey, onDone: () => void) => void
}) {
  const { t } = useTranslation(['pipeline', 'ai', 'common'])
  const { ai, context } = useAI()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [plan, setPlan] = useState<CommandPlan | null>(null)
  const [failed, setFailed] = useState(false)
  const [states, setStates] = useState<Record<ID, ProposalState>>({})

  const ask = (input = text) => {
    const q = input.trim()
    if (!q) return
    setBusy(true)
    setFailed(false)
    setPlan(null)
    setStates({})
    ai.parseCommand(q, context()).then(
      (p) => { setPlan(p); setBusy(false) },
      () => { setFailed(true); setBusy(false) },
    )
  }

  const setState = (id: ID, s: ProposalState) => setStates((x) => ({ ...x, [id]: s }))
  const confirm = (p: ActionProposal) => {
    const payload = p.payload as { leadId?: ID; to?: PipelineStageKey }
    if (p.kind === 'moveStage' && payload.leadId && payload.to && NEEDS_DIALOG.includes(payload.to)) {
      const leadId = payload.leadId
      onNeedDialog(leadId, payload.to, () => setState(p.id, { status: 'done', links: [{ kind: 'lead', id: leadId }] }))
      return
    }
    setState(p.id, { status: 'running' })
    try {
      const r = executeProposal(p)
      setState(p.id, { status: 'done', links: r.links })
      toastUndo(t('pipeline:assistant.applied'), r.undoToken)
    } catch (e) {
      setState(p.id, { status: 'error' })
      toastError(e)
    }
  }
  const edit = (p: ActionProposal) => {
    const payload = p.payload as { leadId?: ID; to?: PipelineStageKey }
    if (payload.leadId && payload.to) {
      const leadId = payload.leadId
      onNeedDialog(leadId, payload.to, () => setState(p.id, { status: 'done', links: [{ kind: 'lead', id: leadId }] }))
    }
  }
  const results = useMemo(() => plan?.results?.ids.slice(0, 8) ?? [], [plan])
  const resultKind = plan?.results?.kind

  return (
    <section aria-labelledby="pipeline-assistant-title" className="flex flex-col gap-3 rounded-xl border border-dashed border-ai-border bg-ai-soft/30 p-4" data-testid="pipeline-assistant">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="size-4 text-ai" aria-hidden="true" />
        <h2 id="pipeline-assistant-title" className="text-sm font-semibold">{t('pipeline:assistant.title')}</h2>
        <DemoAIBadge mode={plan?.mode ?? ai.mode} />
      </div>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => { e.preventDefault(); ask() }}
      >
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask() } }}
          rows={2}
          aria-label={t('pipeline:assistant.label')}
          placeholder={t('pipeline:assistant.placeholder')}
          className="min-h-16 flex-1 resize-none bg-card text-prompt"
          data-testid="pipeline-assistant-input"
        />
        <div className="flex flex-col gap-1.5">
          <VoiceButton onText={(v) => setText(v)} size="icon-sm" />
          <Button type="submit" size="icon-sm" variant="ai" disabled={!text.trim() || busy} aria-busy={busy} aria-label={t('pipeline:assistant.send')}>
            <Send />
          </Button>
        </div>
      </form>
      {!plan && !busy && !failed && (
        <div className="flex flex-wrap gap-1.5">
          {examples.map((ex) => <AISuggestionChip key={ex.command} onClick={() => { setText(ex.command); ask(ex.command) }}>{ex.label}</AISuggestionChip>)}
        </div>
      )}
      {busy && <p className="flex items-center gap-2 text-meta text-muted-foreground" aria-live="polite"><span className="skeleton h-3 w-24 rounded" />{t('ai:thinking')}</p>}
      {failed && <p role="alert" className="text-meta text-danger">{t('ai:reply.failed')}</p>}
      {plan && (
        <div className="flex flex-col gap-2" aria-live="polite">
          <p className="text-sm">{plan.refusal ? t('ai:reply.refused', { reason: t(plan.refusal.reasonKey, plan.refusal.params ?? {}) }) : plan.reply.text}</p>
          {!!plan.reply.bullets?.length && (
            <ul className="list-disc pl-5 text-meta text-muted-foreground">{plan.reply.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
          )}
          {!!results.length && resultKind && (
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-meta">
              {results.map((id) => <li key={id}><EntityLink refTo={{ kind: resultKind, id }} /></li>)}
            </ul>
          )}
          {plan.proposals.map((p) => (
            <ActionProposalCard
              key={p.id} proposal={p} mode={plan.mode} state={states[p.id] ?? { status: 'pending' }}
              onConfirm={() => confirm(p)}
              onCancel={() => setState(p.id, { status: 'cancelled' })}
              onEdit={p.kind === 'moveStage' ? () => edit(p) : undefined}
            />
          ))}
          <Button variant="ghost" size="sm" className="self-start" onClick={() => { setPlan(null); setText('') }}>{t('pipeline:assistant.again')}</Button>
        </div>
      )}
    </section>
  )
}
