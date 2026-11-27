/**
 * Action proposal (DESIGN_SYSTEM §11.9): a card in `border-ai-border bg-ai-soft/40` listing the change ("Create
 * appointment · Site visit · Priya Sharma · Sat 11:00 AM") with Confirm (primary), Edit and Cancel. Nothing runs until
 * Confirm. After it runs, a success line with links to the changed records; a refusal or an error says why.
 */
import { Check, CircleX, Loader2, Lock, Pencil, Sparkles, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ActionProposal, AIMode } from '@/ai/types'
import { EntityLink } from '@/components/domain/entity-link'
import { Button } from '@/components/ui/button'
import type { EntityRef } from '@/domain/types'
import { usePermission } from '@/hooks/use-permission'
import { cn } from '@/lib/utils'
import { DemoAIBadge } from './demo-ai-badge'

export type ProposalState = { status: 'pending' | 'running' | 'done' | 'cancelled' | 'error'; links?: EntityRef[]; error?: string }

export function ActionProposalCard({ proposal, mode, state, onConfirm, onCancel, onEdit, onNavigate }: {
  proposal: ActionProposal
  mode: AIMode
  state: ProposalState
  onConfirm: () => void
  onCancel: () => void
  onEdit?: () => void
  onNavigate?: () => void
}) {
  const { t } = useTranslation(['ai', 'common'])
  const { can, explain } = usePermission()
  const allowed = can(proposal.permission)
  const denied = !allowed ? explain(proposal.permission) : null
  return (
    <article
      data-testid="action-proposal"
      aria-label={t(`ai:proposal.kind.${proposal.kind}`)}
      className={cn('flex flex-col gap-3 rounded-xl border p-3', state.status === 'cancelled' ? 'border-border bg-muted/40 opacity-70' : 'border-ai-border bg-ai-soft/40')}
    >
      <header className="flex items-center gap-2">
        <Sparkles className="size-4 text-ai" aria-hidden="true" />
        <h4 className="flex-1 text-sm font-semibold">{t(`ai:proposal.kind.${proposal.kind}`)}</h4>
        <DemoAIBadge mode={mode} />
      </header>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {proposal.summary.map((s) => (
          <div key={s.label} className="contents">
            <dt className="text-muted-foreground">{t(s.label)}</dt>
            <dd className="min-w-0 font-medium break-words">{s.value}</dd>
          </div>
        ))}
      </dl>
      {state.status === 'pending' && (
        denied ? (
          <p className="flex items-center gap-1.5 rounded-md bg-neutral-soft px-2.5 py-1.5 text-meta text-neutral"><Lock className="size-3.5" aria-hidden="true" />{t(denied.reasonKey, denied.params)}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={onConfirm} data-testid="proposal-confirm"><Check />{t('ai:proposal.confirm')}</Button>
            {onEdit && <Button size="sm" variant="secondary" onClick={onEdit}><Pencil />{t('ai:proposal.edit')}</Button>}
            <Button size="sm" variant="ghost" onClick={onCancel}><X />{t('common:actions.cancel')}</Button>
          </div>
        )
      )}
      {state.status === 'running' && <p className="flex items-center gap-1.5 text-meta text-muted-foreground"><Loader2 className="size-3.5 animate-spin" aria-hidden="true" />{t('ai:proposal.running')}</p>}
      {state.status === 'cancelled' && <p className="text-meta text-muted-foreground">{t('ai:proposal.cancelled')}</p>}
      {state.status === 'error' && <p role="alert" className="flex items-center gap-1.5 text-meta text-danger"><CircleX className="size-3.5" aria-hidden="true" />{state.error ?? t('ai:proposal.failed')}</p>}
      {state.status === 'done' && (
        <div role="status" className="flex flex-col gap-1 rounded-md bg-success-soft px-2.5 py-2 text-meta text-success">
          <span className="flex items-center gap-1.5 font-semibold"><Check className="size-3.5" aria-hidden="true" />{t('ai:proposal.done')}</span>
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
