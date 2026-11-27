/**
 * The global assistant (master prompt §12.5, DESIGN_SYSTEM §11.9): a 440 px right panel, docked (pushing the content)
 * at ≥ 1280 px and overlaying below that. Ctrl/Cmd+K, `/` or the floating button opens it. It knows the role, the page
 * and the selected record (context chip), suggests role prompts (ROLE_RESEARCH §5), answers with links, graphics and
 * next-question chips, proposes changes as cards that run only on Confirm (with Edit, Cancel and Undo), and refuses what
 * the role may not do, with the reason. A second tab holds the module assistants that fit the page. Every answer carries
 * the Demo AI badge from its `mode`.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { ArrowUp, Building2, CalendarDays, Contact, FileText, Loader2, Lock, MapPin, MessagesSquare, RotateCcw, Sparkles, User, Users, Wrench, X, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router'
import { rolePrompts, selectionLabel, useAI, useAIContextSelection } from '@/ai'
import { relevantAssistants } from '@/ai/modules'
import type { CommandPlan } from '@/ai/types'
import { Chip } from '@/components/shared/chip'
import { Segmented } from '@/components/shared/segmented'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { EntityKind } from '@/domain/types'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useDb, useWholeDb } from '@/hooks/use-db'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useNow } from '@/hooks/use-now'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'
import { ActionProposalCard } from './action-proposal-card'
import { AnswerBody, DraftCard, FollowUpChips } from './ai-answer'
import { useChatStore, type ChatMessage } from './chat-store'
import { DemoAIBadge } from './demo-ai-badge'
import { EffortStrip } from './effort-saved'
import { ModuleAssistant, type ModuleAssistantProps } from './module-assistant'
import { runProposal, undoProposal } from './use-proposals'
import { VoiceButton } from './voice-button'

const KIND_ICON: Partial<Record<EntityKind, LucideIcon>> = {
  lead: Users, client: Contact, property: Building2, appointment: CalendarDays, user: User, draft: FileText,
}

const isTyping = (el: EventTarget | null) => {
  const e = el as HTMLElement | null
  return !!e && (e.tagName === 'INPUT' || e.tagName === 'TEXTAREA' || e.tagName === 'SELECT' || e.isContentEditable)
}

function AssistantMessage({ m, onPick, onRephrase, onNavigate }: { m: ChatMessage; onPick: (c: string) => void; onRephrase: () => void; onNavigate?: () => void }) {
  const { t } = useTranslation('ai')
  const states = useChatStore((s) => s.states)
  const setState = useChatStore((s) => s.setProposalState)
  const revise = useChatStore((s) => s.reviseProposal)
  const plan = m.plan as CommandPlan | undefined
  return (
    <div className="mr-4 flex flex-col gap-2 sm:mr-6" data-testid="ai-answer">
      <div className={cn('rounded-2xl rounded-bl-sm border bg-card px-3.5 py-2.5 text-sm', m.error && 'border-danger/40', plan?.refusal && 'bg-neutral-soft/40')}>
        {plan?.refusal ? (
          <div data-testid="ai-refusal" className="flex items-start gap-2 text-foreground">
            <span aria-hidden="true" className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-neutral-soft text-neutral"><Lock className="size-3.5" /></span>
            <div className="flex flex-col gap-1">
              <span>{plan.reply.text}</span>
              {!!plan.reply.bullets?.length && <span className="text-meta text-muted-foreground">{plan.reply.bullets.join(' ')}</span>}
            </div>
          </div>
        ) : plan ? <AnswerBody plan={plan} onNavigate={onNavigate} /> : <p>{m.text}</p>}
        {plan && <div className="mt-2 flex justify-end"><DemoAIBadge mode={plan.mode} /></div>}
      </div>
      {plan?.draft && <DraftCard draft={plan.draft} mode={plan.mode} />}
      {plan?.proposals.map((p) => {
        const st = states[p.id] ?? { status: 'pending' as const }
        return (
          <ActionProposalCard
            key={p.id} proposal={p} mode={plan.mode} state={st}
            onConfirm={() => { setState(p.id, { status: 'running' }); setState(p.id, runProposal(p)) }}
            onCancel={() => setState(p.id, { status: 'cancelled' })}
            onRevise={revise}
            onEdit={onRephrase}
            onUndo={() => setState(p.id, undoProposal(st))}
            onNavigate={onNavigate}
          />
        )
      })}
      {!!plan?.followUps?.length && <FollowUpChips items={plan.followUps} onPick={onPick} />}
      {plan && !plan.proposals.length && !plan.followUps?.length && plan.intent === 'unknown' && <p className="text-meta text-muted-foreground">{t('panel.tryChips')}</p>}
    </div>
  )
}

export function AIPanel({ open, onClose, pageTitle }: { open: boolean; onClose: () => void; /** The current page name for the context chip. */ pageTitle?: string }) {
  const { t } = useTranslation(['ai', 'common', 'shell'])
  const { ai, context } = useAI()
  const { pathname } = useLocation()
  const user = useCurrentUser()
  const db = useWholeDb()
  const now = useNow()
  const docked = useMediaQuery('(min-width: 1280px)')
  const selection = useAIContextSelection()
  const selLabel = useDb((d) => selectionLabel(d, selection))
  const messages = useChatStore((s) => s.messages)
  const clear = useChatStore((s) => s.clear)
  const tab = useChatStore((s) => s.tab)
  const setTab = useChatStore((s) => s.setTab)
  const input = useChatStore((s) => s.draft)
  const setInput = useChatStore((s) => s.setDraft)
  const busy = useChatStore((s) => s.busy)
  const focusTick = useChatStore((s) => s.focusTick)
  const sendToStore = useChatStore((s) => s.send)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const voiceBase = useRef('')
  const setOpen = useSessionStore((s) => s.setAiPanelOpen)
  const chips = useMemo(() => rolePrompts(db, user, now, selection), [db, user, now, selection])
  const tools = useMemo(() => relevantAssistants(pathname, selection), [pathname, selection])
  const ContextIcon = selection ? KIND_ICON[selection.kind] ?? MapPin : MapPin
  const where = selection && selLabel ? `${t(`ai:entity.${selection.kind}`)} · ${selLabel}` : pageTitle ?? ''
  const selLeadId = selection?.kind === 'lead' ? selection.id
    : selection?.kind === 'client' ? db.clients.find((c) => c.id === selection.id)?.leadId
      : selection?.kind === 'appointment' ? db.appointments.find((a) => a.id === selection.id)?.leadId : undefined

  // "/" opens the assistant from anywhere (when not typing in a field); Esc closes it unless a dialog is on top
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target)) {
        e.preventDefault()
        setOpen(true)
        setTab('chat')
        window.setTimeout(() => inputRef.current?.focus(), 30)
        return
      }
      if (!open || e.key !== 'Escape' || e.defaultPrevented) return
      if (document.querySelector('[role=dialog],[role=alertdialog],[role=menu],[role=listbox]')) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, setOpen, setTab])
  // focus the box when the panel opens and after each answer or prefill
  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 50)
  }, [open, focusTick])
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messages, busy])

  const send = useCallback((raw?: string, via: ChatMessage['via'] = 'typed') => sendToStore(raw ?? input, context(), via), [sendToStore, input, context])

  const pick = (c: { command: string; prefill?: boolean }) => {
    if (c.prefill) {
      setInput(c.command)
      window.setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.setSelectionRange(c.command.length, c.command.length)
      }, 20)
    } else void send(c.command, 'chip')
  }

  if (!open) return null
  const navigateClose = docked ? undefined : onClose

  return (
    <>
      {!docked && <button type="button" aria-label={t('common:actions.close')} onClick={onClose} className="fixed inset-0 z-40 animate-in bg-[var(--overlay)] backdrop-blur-[2px] fade-in" />}
      <aside
        data-testid="ai-panel"
        aria-label={t('ai:panel.title')}
        className="fixed inset-y-0 right-0 z-50 flex w-full animate-in flex-col border-l bg-popover text-popover-foreground shadow-xl duration-(--dur-slow) slide-in-from-right-6 fade-in sm:w-[440px]"
      >
        <header className="flex flex-col gap-2.5 border-b px-4 pt-3 pb-2.5">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-md bg-ai-gradient text-ai-foreground shadow-sm"><Sparkles className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold">{t('ai:panel.title')} <DemoAIBadge mode={ai.mode} /></h2>
              {where && (
                <p className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full border bg-card px-2 py-0.5 text-meta text-muted-foreground" data-testid="ai-context" title={t('ai:panel.contextTip')}>
                  <ContextIcon className="size-3 shrink-0 text-primary" aria-hidden="true" />
                  <span className="truncate">{t('ai:panel.context', { where })}</span>
                  {/* at phone width the record name matters more; the role still shows above the prompt chips */}
                  <span className="shrink-0 text-subtle-foreground max-sm:hidden">· {t(`common:roles.${user.role}`)}</span>
                </p>
              )}
            </div>
            {messages.length > 0 && (
              <Button variant="ghost" size="icon-sm" onClick={clear} aria-label={t('ai:panel.clear')} title={t('ai:panel.clear')} data-testid="ai-clear"><RotateCcw /></Button>
            )}
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t('common:actions.close')} data-testid="ai-close"><X /></Button>
          </div>
          <Segmented
            value={tab} onChange={setTab} label={t('ai:panel.tabs')} variant="pill"
            segments={[
              { value: 'chat', label: t('ai:panel.chat'), icon: <MessagesSquare className="size-3.5" aria-hidden="true" /> },
              { value: 'tools', label: t('ai:panel.tools'), icon: <Wrench className="size-3.5" aria-hidden="true" />, count: tools.length },
            ]}
          />
        </header>

        {tab === 'tools' ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4" data-testid="ai-tools">
            <p className="text-meta text-muted-foreground">{t('ai:panel.toolsIntro')}</p>
            {tools.map((key) => {
              const props = { module: key, compact: true, leadId: selLeadId, propertyId: selection?.kind === 'property' ? selection.id : undefined } as ModuleAssistantProps
              return <ModuleAssistant key={`${key}-${selection?.id ?? ''}`} {...props} />
            })}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4" aria-live="polite" data-testid="ai-chat">
            {messages.length === 0 && (
              <div className="flex flex-col gap-3">
                <div className="relative overflow-hidden rounded-2xl border bg-card p-4">
                  <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(420px_circle_at_0_0,color-mix(in_oklch,var(--ai)_12%,transparent),transparent_60%)]" />
                  <p className="relative text-sm font-semibold">{t('ai:panel.hello', { name: user.name.split(' ')[0] })}</p>
                  <p className="relative mt-1 text-meta text-muted-foreground">{t('ai:panel.intro')}</p>
                </div>
                <EffortStrip />
                <p className="text-caption font-semibold tracking-[0.06em] text-subtle-foreground uppercase [:lang(ta)_&]:normal-case">{t(`ai:panel.try.${user.role}`)}</p>
                <div className="flex flex-wrap gap-2" data-testid="ai-prompts">
                  {chips.map((c) => (
                    <Chip key={c.id} tone="ai" size="sm" onClick={() => pick(c)} className="h-auto py-1 text-left whitespace-normal" data-testid={`ai-prompt-${c.id}`}>
                      {c.label}{c.prefill ? '…' : ''}
                    </Chip>
                  ))}
                </div>
                <p className="text-meta text-muted-foreground">{t('ai:panel.hinglishHint')}</p>
              </div>
            )}
            {messages.map((m, i) => m.role === 'user' ? (
              <div key={m.id} className="ml-10 self-end rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm whitespace-pre-wrap text-primary-foreground" data-testid="ai-user-message">{m.text}</div>
            ) : (
              <AssistantMessage
                key={m.id} m={m} onNavigate={navigateClose}
                onPick={(c) => void send(c, 'chip')}
                onRephrase={() => { setInput(messages[i - 1]?.text ?? ''); inputRef.current?.focus() }}
              />
            ))}
            {busy && (
              <div className="mr-6 flex items-center gap-2 self-start rounded-2xl rounded-bl-sm border bg-card px-3.5 py-2.5 text-sm text-muted-foreground" role="status">
                <Loader2 className="size-4 animate-spin text-ai" aria-hidden="true" />
                {t('ai:thinking')}
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}

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
              placeholder={t('ai:panel.placeholder')}
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
                  void send(full, 'voice')
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
