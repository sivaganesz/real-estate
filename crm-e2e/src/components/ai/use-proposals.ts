/**
 * Running assistant proposals from the UI (master prompt §12.0): nothing changes until the user clicks Confirm; then
 * services/commands.executeProposal runs it (permission re-checked, `via: 'ai'`), an AI-toned toast links to the
 * changed record and offers Undo for the 10 s the store keeps it. Used by the global panel and every module assistant.
 */
import { useCallback, useState } from 'react'
import i18next from 'i18next'
import { createElement } from 'react'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import type { ActionProposal } from '@/ai/types'
import { toastError } from '@/components/shared/undo-toast'
import type { EntityRef } from '@/domain/types'
import { executeProposal } from '@/services/commands'
import { canUndo, undo } from '@/services/core/undo'
import { useSessionStore } from '@/store/session-store'

export type ProposalState = { status: 'pending' | 'running' | 'done' | 'cancelled' | 'error' | 'undone'; links?: EntityRef[]; error?: string; undoToken?: string; count?: number }

const UNDO_TOAST_MS = 10_000

/**
 * While the assistant panel is open its proposal cards sit at the bottom right, right where the app's toasts appear, so
 * the Undo toast would cover the next card's Confirm button. Toast beside the panel instead (phones keep top-center).
 */
function besidePanel(): { position?: 'bottom-center' | 'bottom-left' } {
  if (typeof window === 'undefined' || !useSessionStore.getState().aiPanelOpen) return {}
  if (window.innerWidth >= 1280) return { position: 'bottom-center' }
  return window.innerWidth >= 640 ? { position: 'bottom-left' } : {}
}

/** Runs one proposal and toasts the result. Returns the new state for the card. */
export function runProposal(p: ActionProposal): ProposalState {
  try {
    const out = executeProposal(p)
    const label = i18next.t(`ai:proposal.toast.${p.kind}`, { count: out.count ?? 1 })
    const icon = createElement(Sparkles, { className: 'size-4 text-ai', 'aria-hidden': true })
    if (out.undoToken && canUndo(out.undoToken)) {
      const token = out.undoToken
      toast.success(label, {
        ...besidePanel(), icon, duration: UNDO_TOAST_MS, description: i18next.t('ai:proposal.toastHint'),
        action: { label: i18next.t('common:actions.undo'), onClick: () => (undo(token) ? toast(i18next.t('ui:undo.done'), besidePanel()) : toast.error(i18next.t('ui:undo.expired'), besidePanel())) },
      })
    } else toast.success(label, { ...besidePanel(), icon })
    if (out.waLink) window.open(out.waLink, '_blank', 'noopener')
    return { status: 'done', links: out.links, undoToken: out.undoToken, count: out.count }
  } catch (e) {
    toastError(e)
    const err = e as { reasonKey?: string; params?: Record<string, string>; message?: string }
    return { status: 'error', error: err.reasonKey ? i18next.t(err.reasonKey, err.params ?? {}) : err.message }
  }
}

/** Undo from the card itself (same 10 s window as the toast). */
export function undoProposal(state: ProposalState): ProposalState {
  if (state.undoToken && undo(state.undoToken)) {
    toast(i18next.t('ui:undo.done'), besidePanel())
    return { ...state, status: 'undone', undoToken: undefined }
  }
  toast.error(i18next.t('ui:undo.expired'), besidePanel())
  return { ...state, undoToken: undefined }
}

/** Local proposal states for a list of proposals (module assistants). */
export function useProposalStates() {
  const [states, setStates] = useState<Record<string, ProposalState>>({})
  const confirm = useCallback((p: ActionProposal) => {
    setStates((s) => ({ ...s, [p.id]: { status: 'running' } }))
    const next = runProposal(p)
    setStates((s) => ({ ...s, [p.id]: next }))
  }, [])
  const cancel = useCallback((p: ActionProposal) => setStates((s) => ({ ...s, [p.id]: { status: 'cancelled' } })), [])
  const undoOne = useCallback((p: ActionProposal) => setStates((s) => ({ ...s, [p.id]: undoProposal(s[p.id] ?? { status: 'done' }) })), [])
  const reset = useCallback(() => setStates({}), [])
  return { states, confirm, cancel, undo: undoOne, reset }
}
