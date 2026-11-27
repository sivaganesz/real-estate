/**
 * The Today module assistant (master prompt §12.2): type or speak what happened or what you need ("Called Priya, no
 * answer", "Reschedule Rahul's follow-up to tomorrow 5 PM", "Auto-assign the new leads"). The simulated AI reads it
 * against the real data and answers, or proposes changes as cards; nothing changes until the user clicks Confirm, and
 * the change then goes through the same services as the buttons, so the Today lists re-rank at once.
 */
import { useState } from 'react'
import { ArrowUp, Loader2, Lock, MessageSquareText, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAI } from '@/ai'
import type { ActionProposal, CommandPlan } from '@/ai/types'
import { ActionProposalCard, type ProposalState } from '@/components/ai/action-proposal-card'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { VoiceButton } from '@/components/ai/voice-button'
import { EntityLink } from '@/components/domain/entity-link'
import { Chip } from '@/components/shared/chip'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePermission } from '@/hooks/use-permission'
import { executeProposal } from '@/services/commands'
import { useSessionStore } from '@/store/session-store'

export function AIQuickCommand({ suggestions }: { suggestions: { label: string; command: string }[] }) {
  const { t } = useTranslation(['today', 'ai'])
  const { ai, context } = useAI()
  const { can } = usePermission()
  const openPanel = useSessionStore((s) => s.setAiPanelOpen)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [plan, setPlan] = useState<CommandPlan | null>(null)
  const [asked, setAsked] = useState('')
  const [states, setStates] = useState<Record<string, ProposalState>>({})

  if (!can('ai.use')) return null

  const run = async (raw?: string) => {
    const q = (raw ?? text).trim()
    if (!q || busy) return
    setBusy(true)
    setAsked(q)
    setText('')
    try {
      const p = await ai.parseCommand(q, context())
      setPlan(p)
      setStates(Object.fromEntries(p.proposals.map((x) => [x.id, { status: 'pending' } as ProposalState])))
    } catch {
      toast.error(t('ai:reply.failed'))
    } finally {
      setBusy(false)
    }
  }

  const confirm = (p: ActionProposal) => {
    setStates((s) => ({ ...s, [p.id]: { status: 'running' } }))
    try {
      const out = executeProposal(p)
      setStates((s) => ({ ...s, [p.id]: { status: 'done', links: out.links } }))
      const label = t(`ai:proposal.toast.${p.kind}`)
      if (out.undoToken) toastUndo(label, out.undoToken)
      else toast.success(label, { icon: <Sparkles className="size-4 text-ai" aria-hidden="true" /> })
      if (out.waLink) window.open(out.waLink, '_blank', 'noopener')
    } catch (e) {
      setStates((s) => ({ ...s, [p.id]: { status: 'error', error: (e as Error).message } }))
      toastError(e)
    }
  }

  return (
    <div data-testid="today-ai" className="rounded-xl border border-dashed border-ai-border bg-ai-soft/30 p-3 md:p-4">
      <form onSubmit={(e) => { e.preventDefault(); void run() }} className="flex items-center gap-2">
        <span aria-hidden="true" className="hidden size-8 shrink-0 items-center justify-center rounded-md bg-ai-gradient text-ai-foreground sm:inline-flex"><MessageSquareText className="size-4" /></span>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('today:assistant.placeholder')}
          aria-label={t('today:assistant.label')}
          className="h-9 flex-1 bg-card text-prompt"
          data-testid="today-ai-input"
        />
        <VoiceButton size="icon-sm" onText={(heard, final) => { setText(heard); if (final) void run(heard) }} />
        <Button type="submit" size="sm" variant="ai" disabled={!text.trim() || busy} aria-label={t('today:assistant.run')}>
          {busy ? <Loader2 className="animate-spin" /> : <ArrowUp />}
          <span className="hidden sm:inline">{t('today:assistant.run')}</span>
        </Button>
      </form>
      {!plan && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-meta text-muted-foreground">{t('today:assistant.try')}</span>
          {suggestions.map((s) => (
            <Chip key={s.command} tone="ai" size="sm" onClick={() => void run(s.command)} disabled={busy}>{s.label}</Chip>
          ))}
        </div>
      )}
      {plan && (
        <div className="mt-3 flex flex-col gap-2" aria-live="polite">
          <div className="rounded-lg border bg-card px-3 py-2.5 text-sm">
            <p className="mb-1 text-meta text-muted-foreground">{t('today:assistant.youAsked', { text: asked })}</p>
            {plan.refusal ? (
              <p className="flex items-start gap-2"><Lock className="mt-0.5 size-4 shrink-0 text-neutral" aria-hidden="true" />{plan.reply.text}</p>
            ) : <p className="whitespace-pre-wrap">{plan.reply.text}</p>}
            {!!plan.reply.bullets?.length && (
              <ul className="mt-1.5 flex list-disc flex-col gap-0.5 pl-5 marker:text-ai">
                {plan.reply.bullets.slice(0, 6).map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            )}
            {!!plan.reply.links?.length && (
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-meta">
                {plan.reply.links.slice(0, 8).map((l) => <EntityLink key={`${l.kind}-${l.id}`} refTo={l} />)}
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-1.5">
                <Button size="xs" variant="ghost" onClick={() => { setPlan(null); setStates({}) }}>{t('today:assistant.clear')}</Button>
                <Button size="xs" variant="ghost" onClick={() => openPanel(true)}><Sparkles />{t('today:assistant.openPanel')}</Button>
              </div>
              <DemoAIBadge mode={plan.mode} />
            </div>
          </div>
          {plan.proposals.map((p) => (
            <ActionProposalCard
              key={p.id} proposal={p} mode={plan.mode} state={states[p.id] ?? { status: 'pending' }}
              onConfirm={() => confirm(p)}
              onCancel={() => setStates((s) => ({ ...s, [p.id]: { status: 'cancelled' } }))}
              onEdit={() => { setStates((s) => ({ ...s, [p.id]: { status: 'cancelled' } })); setText(asked) }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
