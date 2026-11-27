/**
 * The global assistant (master prompt §12.5, DESIGN_SYSTEM §11.9): a 440 px right panel, docked (pushing the content)
 * at ≥ 1280 px and overlaying below that. Ctrl/Cmd+K or the floating button opens it. It knows the role, the page and
 * the selected record (context chip), answers with links, proposes changes as cards that run only on Confirm, and
 * refuses what the role may not do, with the reason. Every answer carries the Demo AI badge from its `mode`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, Loader2, Lock, Sparkles, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { selectionLabel, useAI } from '@/ai'
import { useSelectionStore } from '@/ai/context'
import type { ActionProposal, CommandPlan } from '@/ai/types'
import { EntityLink } from '@/components/domain/entity-link'
import { Chip } from '@/components/shared/chip'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useDb } from '@/hooks/use-db'
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'
import { executeProposal } from '@/services/commands'
import { ActionProposalCard, type ProposalState } from './action-proposal-card'
import { DemoAIBadge } from './demo-ai-badge'
import { VoiceButton } from './voice-button'

type Msg = { id: string; role: 'user' | 'assistant'; text?: string; plan?: CommandPlan; error?: boolean }

let n = 0
const msgId = () => `m${Date.now().toString(36)}${(n++).toString(36)}`

/** Suggested prompts per role. The command text stays English (the simulated reader's language); labels translate. */
function useSuggestions(): { label: string; command: string }[] {
  const { t } = useTranslation('ai')
  const user = useCurrentUser()
  const lead = useDb((db) => db.leads.find((l) => (user.role === 'executive' ? l.ownerId === user.id : true) && !['converted', 'lost'].includes(l.stage))?.name)
  const exec = useDb((db) => db.users.find((u) => u.role === 'executive' && u.status === 'active' && u.availability === 'available')?.name)
  const first = lead?.split(' ')[0] ?? ''
  const base = [
    { label: t('prompt.todayTasks'), command: "Show today's pending tasks" },
    { label: t('prompt.priorityLeads'), command: 'My highest-priority leads' },
  ]
  if (lead) base.push({ label: t('prompt.visit', { name: first }), command: `Schedule a site visit with ${lead} tomorrow 11am` })
  if (lead) base.push({ label: t('prompt.matches', { name: first }), command: `Find matching properties for ${lead}` })
  if (user.role !== 'executive' && lead && exec) base.push({ label: t('prompt.assign', { name: first, exec: exec.split(' ')[0] }), command: `Assign ${lead} to ${exec}` })
  base.push(user.role === 'executive'
    ? { label: t('prompt.followUps'), command: 'Leads needing follow-up' }
    : { label: t('prompt.team'), command: "Summarize my team's performance" })
  base.push({ label: t('prompt.addLead'), command: 'Add lead Rahul Verma 9845012345, 3BHK Whitefield, budget 1.2 Cr' })
  return base
}

export function AIPanel({ open, onClose, pageTitle }: { open: boolean; onClose: () => void; /** The current page name for the context chip. */ pageTitle?: string }) {
  const { t } = useTranslation(['ai', 'common', 'shell'])
  const { ai, context } = useAI()
  const docked = useMediaQuery('(min-width: 1280px)')
  const selection = useSelectionStore((s) => s.selection)
  const selLabel = useDb((db) => selectionLabel(db, selection))
  const where = selection && selLabel ? `${t(`ai:entity.${selection.kind}`)} · ${selLabel}` : pageTitle ?? ''
  const [messages, setMessages] = useState<Msg[]>([])
  const [states, setStates] = useState<Record<string, ProposalState>>({})
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const voiceBase = useRef('')
  const suggestions = useSuggestions()

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])
  // Esc closes the panel from anywhere, unless a dialog or menu is open on top
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (document.querySelector('[role=dialog],[role=alertdialog],[role=menu],[role=listbox]')) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messages, states])

  const send = useCallback(async (raw?: string) => {
    const text = (raw ?? input).trim()
    if (!text || busy) return
    setInput('')
    setMessages((m) => [...m, { id: msgId(), role: 'user', text }])
    setBusy(true)
    try {
      const plan = await ai.parseCommand(text, context())
      setMessages((m) => [...m, { id: msgId(), role: 'assistant', plan }])
      setStates((s) => ({ ...s, ...Object.fromEntries(plan.proposals.map((p) => [p.id, { status: 'pending' } as ProposalState])) }))
    } catch {
      setMessages((m) => [...m, { id: msgId(), role: 'assistant', text: t('ai:reply.failed'), error: true }])
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }, [ai, busy, context, input, t])

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

  const placeholder = useMemo(() => t('ai:panel.placeholder'), [t])
  if (!open) return null

  return (
    <>
      {!docked && <button type="button" aria-label={t('common:actions.close')} onClick={onClose} className="fixed inset-0 z-40 bg-[var(--overlay)] backdrop-blur-[2px] animate-in fade-in" />}
      <aside
        data-testid="ai-panel"
        aria-label={t('ai:panel.title')}
        className="fixed inset-y-0 right-0 z-50 flex w-full animate-in flex-col border-l bg-popover text-popover-foreground shadow-xl duration-(--dur-slow) slide-in-from-right-6 fade-in sm:w-[440px]"
      >
        <header className="flex items-start gap-3 border-b px-4 py-3">
          <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-md bg-ai-gradient text-ai-foreground shadow-sm"><Sparkles className="size-4" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-base font-semibold">{t('ai:panel.title')} <DemoAIBadge mode={ai.mode} /></h2>
            {where && <p className="mt-0.5 truncate text-meta text-muted-foreground" data-testid="ai-context">{t('ai:panel.context', { where })}</p>}
          </div>
          {messages.length > 0 && (
            <Button variant="ghost" size="icon-sm" onClick={() => { setMessages([]); setStates({}) }} aria-label={t('ai:panel.clear')} title={t('ai:panel.clear')}><Trash2 /></Button>
          )}
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t('common:actions.close')}><X /></Button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4" aria-live="polite">
          {messages.length === 0 && (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border bg-card p-4">
                <p className="text-sm font-medium">{t('ai:panel.hello')}</p>
                <p className="mt-1 text-meta text-muted-foreground">{t('ai:panel.intro')}</p>
              </div>
              <p className="text-caption font-semibold tracking-[0.06em] text-subtle-foreground uppercase [:lang(ta)_&]:normal-case">{t('ai:panel.try')}</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => <Chip key={s.command} tone="ai" size="sm" onClick={() => void send(s.command)} className="h-auto py-1 whitespace-normal text-left">{s.label}</Chip>)}
              </div>
            </div>
          )}
          {messages.map((m) => m.role === 'user' ? (
            <div key={m.id} className="ml-10 self-end rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground whitespace-pre-wrap">{m.text}</div>
          ) : (
            <div key={m.id} className="mr-6 flex flex-col gap-2">
              <div className={cn('rounded-2xl rounded-bl-sm border bg-card px-3.5 py-2.5 text-sm', m.error && 'border-danger/40')}>
                {m.plan?.refusal ? (
                  <p data-testid="ai-refusal" className="flex items-start gap-2 text-foreground"><Lock className="mt-0.5 size-4 shrink-0 text-neutral" aria-hidden="true" /><span>{m.plan.reply.text}</span></p>
                ) : (
                  <p className="whitespace-pre-wrap">{m.plan?.reply.text ?? m.text}</p>
                )}
                {!!m.plan?.reply.bullets?.length && (
                  <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-foreground/90 marker:text-ai">
                    {m.plan.reply.bullets.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                )}
                {!!m.plan?.reply.links?.length && (
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-meta">
                    {m.plan.reply.links.map((l) => <EntityLink key={`${l.kind}-${l.id}`} refTo={l} onNavigate={docked ? undefined : onClose} />)}
                  </div>
                )}
                {m.plan && <div className="mt-2 flex justify-end"><DemoAIBadge mode={m.plan.mode} /></div>}
              </div>
              {m.plan?.proposals.map((p) => (
                <ActionProposalCard
                  key={p.id} proposal={p} mode={m.plan!.mode} state={states[p.id] ?? { status: 'pending' }}
                  onConfirm={() => confirm(p)}
                  onCancel={() => setStates((s) => ({ ...s, [p.id]: { status: 'cancelled' } }))}
                  onEdit={() => {
                    const userMsg = messages[messages.indexOf(m) - 1]
                    setStates((s) => ({ ...s, [p.id]: { status: 'cancelled' } }))
                    setInput(userMsg?.text ?? '')
                    inputRef.current?.focus()
                  }}
                  onNavigate={docked ? undefined : onClose}
                />
              ))}
            </div>
          ))}
          {busy && (
            <div className="mr-6 flex items-center gap-2 self-start rounded-2xl rounded-bl-sm border bg-card px-3.5 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-ai" aria-hidden="true" />
              {t('ai:thinking')}
            </div>
          )}
          <div ref={endRef} />
        </div>

        <footer className="border-t p-3">
          <form
            onSubmit={(e) => { e.preventDefault(); void send() }}
            className="flex items-end gap-2 rounded-xl border bg-card p-2 shadow-xs focus-within:border-ring focus-within:shadow-focus"
          >
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
              placeholder={placeholder}
              aria-label={t('ai:panel.inputLabel')}
              rows={1}
              className="max-h-40 min-h-9 flex-1 resize-none border-0 bg-transparent p-1.5 text-prompt shadow-none focus-visible:ring-0 dark:bg-transparent"
              data-testid="ai-input"
            />
            <VoiceButton
              size="icon-sm"
              onText={(heard, final) => {
                if (!voiceBase.current && !final) voiceBase.current = input ? `${input} ` : ''
                const full = `${voiceBase.current}${heard}`
                setInput(full)
                if (final) {
                  voiceBase.current = ''
                  void send(full)
                }
              }}
            />
            <Button type="submit" size="icon-sm" disabled={!input.trim() || busy} aria-label={t('ai:panel.send')} data-testid="ai-send"><ArrowUp /></Button>
          </form>
          <p className="mt-1.5 text-center text-micro text-subtle-foreground">{t('ai:panel.footnote')}</p>
        </footer>
      </aside>
    </>
  )
}
