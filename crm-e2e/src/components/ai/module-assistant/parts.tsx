/**
 * Building blocks shared by every module assistant (master prompt §12.2 "one shared, reusable assistant component"):
 * the card shell (DESIGN_SYSTEM §11.9 inline module assistant: dashed Iris border, gradient icon tile, Demo AI badge),
 * the text + voice input, the proposal list with Confirm / Edit / Cancel / Undo, the thinking skeleton and the error.
 */
import { useRef, useState, type ReactNode } from 'react'
import { AlertCircle, Loader2, RotateCcw, Wand2, X, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ActionProposal, AIMode } from '@/ai/types'
import { SkeletonLines } from '@/components/shared/skeletons'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { ActionProposalCard } from '../action-proposal-card'
import { DemoAIBadge } from '../demo-ai-badge'
import { useProposalStates } from '../use-proposals'
import { VoiceButton } from '../voice-button'

export function AssistantShell({ icon: Icon, title, description, mode, children, action, className, compact, testId }: {
  icon: LucideIcon
  title: string
  description?: string
  mode: AIMode
  children: ReactNode
  /** A small action on the right of the header (e.g. "Refresh"). */
  action?: ReactNode
  className?: string
  compact?: boolean
  testId?: string
}) {
  return (
    <section
      aria-label={title}
      data-testid={testId ?? 'module-assistant'}
      className={cn('flex flex-col gap-3 rounded-xl border border-dashed border-ai-border bg-ai-soft/30', compact ? 'p-3' : 'p-4', className)}
    >
      <header className="flex items-start gap-2.5">
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-md bg-ai-gradient text-ai-foreground shadow-xs"><Icon className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">{title}<DemoAIBadge mode={mode} /></h3>
          {description && <p className="mt-0.5 text-meta text-muted-foreground">{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

/** A textarea with voice (en-IN) and a primary AI button; Ctrl/Cmd+Enter submits. */
export function AssistInput({ placeholder, label, submitLabel, busy, onSubmit, rows = 3, defaultText = '', testId, extra }: {
  placeholder: string
  label: string
  submitLabel: string
  busy: boolean
  onSubmit: (text: string) => void
  rows?: number
  defaultText?: string
  testId?: string
  /** More buttons after Voice (e.g. "From .txt file"). */
  extra?: (setText: (s: string) => void) => ReactNode
}) {
  const { t } = useTranslation('ai')
  const [text, setText] = useState(defaultText)
  const base = useRef('')
  const submit = (value = text) => {
    if (value.trim() && !busy) onSubmit(value.trim())
  }
  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit() } }}
        placeholder={placeholder}
        aria-label={label}
        rows={rows}
        className="min-h-20 bg-card text-prompt"
        data-testid={testId ? `${testId}-text` : undefined}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ai" size="sm" onClick={() => submit()} disabled={!text.trim() || busy} aria-busy={busy || undefined} data-testid={testId ? `${testId}-submit` : undefined}>
          {busy ? <Loader2 className="animate-spin" /> : <Wand2 />}
          {busy ? t('thinking') : submitLabel}
        </Button>
        <VoiceButton
          size="icon-sm"
          onText={(heard, final) => {
            if (!base.current && !final) base.current = text ? `${text} ` : ''
            const full = `${base.current}${heard}`
            setText(full)
            if (final) {
              base.current = ''
              submit(full)
            }
          }}
        />
        {extra?.(setText)}
        {text && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setText('')}><X />{t('paste.clear')}</Button>
        )}
      </div>
    </div>
  )
}

/** Proposals with their own Confirm / Edit / Cancel / Undo state. */
export function ProposalList({ proposals: initial, mode, onDone, compact }: { proposals: ActionProposal[]; mode: AIMode; onDone?: (p: ActionProposal) => void; compact?: boolean }) {
  const { states, confirm, cancel, undo } = useProposalStates()
  const [list, setList] = useState(initial)
  const [prevInitial, setPrevInitial] = useState(initial)
  if (initial !== prevInitial) {
    setPrevInitial(initial)
    setList(initial)
  }
  if (!list.length) return null
  return (
    <div className="flex flex-col gap-2">
      {list.map((p) => (
        <ActionProposalCard
          key={p.id} proposal={p} mode={mode} compact={compact} state={states[p.id] ?? { status: 'pending' }}
          onConfirm={() => { confirm(p); onDone?.(p) }}
          onCancel={() => cancel(p)}
          onRevise={(next) => setList((l) => l.map((x) => (x.id === next.id ? next : x)))}
          onUndo={() => undo(p)}
        />
      ))}
    </div>
  )
}

export function Thinking() {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3" aria-busy="true">
      <SkeletonLines lines={3} />
    </div>
  )
}

export function AssistError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation('ai')
  return (
    <p role="alert" className="flex flex-wrap items-center gap-2 rounded-md bg-danger-soft px-2.5 py-2 text-meta text-danger">
      <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="flex-1">{t('reply.failed')}</span>
      <Button size="xs" variant="ghost" className="text-foreground" onClick={onRetry}><RotateCcw />{t('assist.retry')}</Button>
    </p>
  )
}

