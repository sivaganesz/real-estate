/**
 * Action proposal (DESIGN_SYSTEM §11.9): a card in `border-ai-border bg-ai-soft/40` listing the change ("Book
 * appointment · Site visit · Priya Sharma · Sat 11:00 AM") with Confirm (primary), Edit and Cancel. Nothing runs until
 * Confirm. After it runs: a success line with links to the changed records and Undo (10 s). A change the role may not
 * make shows the reason with a lock instead of the buttons.
 */
import { useEffect, useState } from 'react'
import { Check, CircleX, Loader2, Lock, Pencil, Sparkles, Undo2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { editableFields } from '@/ai/revise'
import type { ActionProposal, AIMode } from '@/ai/types'
import { EntityLink } from '@/components/domain/entity-link'
import { Button } from '@/components/ui/button'
import { usePermission } from '@/hooks/use-permission'
import { useDb } from '@/hooks/use-db'
import { UNDO_MS, canUndo } from '@/services/core/undo'
import { cn } from '@/lib/utils'
import { DemoAIBadge } from './demo-ai-badge'
import { ProposalEditor } from './proposal-editor'
import type { ProposalState } from './use-proposals'

export type { ProposalState }

export function ActionProposalCard({ proposal, mode, state, onConfirm, onCancel, onEdit, onRevise, onUndo, onNavigate, compact }: {
  proposal: ActionProposal
  mode: AIMode
  state: ProposalState
  onConfirm: () => void
  onCancel: () => void
  /** Fallback edit for kinds without an edit form (e.g. put the request back in the box to rephrase it). */
  onEdit?: () => void
  /** The proposal after the user edited it in place. */
  onRevise?: (p: ActionProposal) => void
  onUndo?: () => void
  onNavigate?: () => void
  compact?: boolean
}) {
  const { t } = useTranslation(['ai', 'common'])
  const { can, explain } = usePermission()
  const [editing, setEditing] = useState(false)
  const [, setTick] = useState(0)
  // hide Undo when the store's 10 s undo window closes
  useEffect(() => {
    if (state.status !== 'done' || !state.undoToken) return
    const id = window.setTimeout(() => setTick((n) => n + 1), UNDO_MS + 50)
    return () => window.clearTimeout(id)
  }, [state.status, state.undoToken])
  const target = proposal.targets?.find((r) => r.kind === 'lead' || r.kind === 'task' || r.kind === 'appointment' || r.kind === 'property')
  const record = useDb((db) => {
    if (!target) return undefined
    const list = target.kind === 'lead' ? db.leads : target.kind === 'task' ? db.tasks : target.kind === 'appointment' ? db.appointments : db.properties
    const r = (list as { id: string; ownerId?: string | null; createdBy?: string }[]).find((x) => x.id === target.id)
    return r ? { ownerId: r.ownerId, createdBy: r.createdBy } : undefined
  })
  const allowed = can(proposal.permission, proposal.kind.startsWith('create') ? undefined : record)
  const denied = !allowed ? explain(proposal.permission) : null
  const editable = !!onRevise && editableFields(proposal).length > 0
  const undoable = state.status === 'done' && !!state.undoToken && canUndo(state.undoToken) && !!onUndo

  return (
    <article
      data-testid="action-proposal"
      data-kind={proposal.kind}
      aria-label={t(`ai:proposal.kind.${proposal.kind}`)}
      className={cn('flex flex-col gap-3 rounded-xl border', compact ? 'p-2.5' : 'p-3', state.status === 'cancelled' || state.status === 'undone' ? 'border-border bg-muted/40 opacity-75' : 'border-ai-border bg-ai-soft/40')}
    >
      <header className="flex items-center gap-2">
        <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-md bg-ai-soft text-ai"><Sparkles className="size-3.5" /></span>
        <h4 className="flex-1 text-sm font-semibold">{t(`ai:proposal.kind.${proposal.kind}`)}</h4>
        <DemoAIBadge mode={mode} />
      </header>
      {editing ? (
        <ProposalEditor proposal={proposal} onCancel={() => setEditing(false)} onApply={(p) => { setEditing(false); onRevise?.(p) }} />
      ) : (
        <dl className="grid grid-cols-[minmax(4.5rem,auto)_1fr] gap-x-3 gap-y-1 text-sm">
          {proposal.summary.map((s) => (
            <div key={s.label} className="contents">
              <dt className="text-muted-foreground">{t(s.label)}</dt>
              <dd className="min-w-0 font-medium break-words whitespace-pre-line">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {state.status === 'pending' && !editing && (
        denied ? (
          <p data-testid="proposal-denied" className="flex items-center gap-1.5 rounded-md bg-neutral-soft px-2.5 py-1.5 text-meta text-neutral"><Lock className="size-3.5 shrink-0" aria-hidden="true" />{t(denied.reasonKey, denied.params)}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={onConfirm} data-testid="proposal-confirm"><Check />{t('ai:proposal.confirm')}</Button>
            {editable ? (
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)} data-testid="proposal-edit"><Pencil />{t('ai:proposal.edit')}</Button>
            ) : onEdit ? (
              <Button size="sm" variant="secondary" onClick={onEdit} data-testid="proposal-edit"><Pencil />{t('ai:proposal.rephrase')}</Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={onCancel} data-testid="proposal-cancel"><X />{t('common:actions.cancel')}</Button>
          </div>
        )
      )}
      {state.status === 'running' && <p className="flex items-center gap-1.5 text-meta text-muted-foreground"><Loader2 className="size-3.5 animate-spin" aria-hidden="true" />{t('ai:proposal.running')}</p>}
      {state.status === 'cancelled' && <p className="text-meta text-muted-foreground">{t('ai:proposal.cancelled')}</p>}
      {state.status === 'undone' && <p className="flex items-center gap-1.5 text-meta text-muted-foreground"><Undo2 className="size-3.5" aria-hidden="true" />{t('ai:proposal.undone')}</p>}
      {state.status === 'error' && <p role="alert" className="flex items-center gap-1.5 text-meta text-danger"><CircleX className="size-3.5 shrink-0" aria-hidden="true" />{state.error ?? t('ai:proposal.failed')}</p>}
      {state.status === 'done' && (
        <div role="status" data-testid="proposal-done" className="flex flex-col gap-1.5 rounded-md bg-success-soft px-2.5 py-2 text-meta text-success">
          <span className="flex items-center gap-1.5 font-semibold">
            <Check className="size-3.5" aria-hidden="true" />
            <span className="flex-1">{t('ai:proposal.done')}</span>
            {undoable && (
              <Button size="xs" variant="ghost" className="text-foreground" onClick={onUndo} data-testid="proposal-undo"><Undo2 />{t('common:actions.undo')}</Button>
            )}
          </span>
          {!!state.links?.length && (
            <span className="flex flex-wrap gap-x-3 gap-y-1">
              {state.links.map((l) => <EntityLink key={`${l.kind}-${l.id}`} refTo={l} onNavigate={onNavigate} />)}
            </span>
          )}
        </div>
      )}
    </article>
  )
}
