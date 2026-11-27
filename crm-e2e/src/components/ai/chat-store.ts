/**
 * The global assistant's conversation for this browser tab: it survives closing the panel and moving between pages
 * (not persisted to storage; a reload starts fresh). Sending goes through here, so module assistants and pages can
 * hand the panel a question with `askAssistant(command)` (e.g. "Ask a follow-up" on Dashboard insights): the panel
 * opens and the question is answered with the current user, page and record as context.
 */
import i18next from 'i18next'
import { create } from 'zustand'
import { getAI } from '@/ai'
import { buildAIContext, effectiveSelection, useSelectionStore } from '@/ai/context'
import type { ActionProposal, AIContext, CommandPlan } from '@/ai/types'
import { useDbStore } from '@/store/db-store'
import { resolveSessionUser } from '@/hooks/use-current-user'
import { useSessionStore } from '@/store/session-store'
import type { ProposalState } from './use-proposals'

export type ChatMessage = { id: string; role: 'user' | 'assistant'; text?: string; plan?: CommandPlan; error?: boolean; via?: 'voice' | 'chip' | 'typed' }

type ChatState = {
  messages: ChatMessage[]
  states: Record<string, ProposalState>
  /** The text in the box (kept while the panel is closed). */
  draft: string
  busy: boolean
  tab: 'chat' | 'tools'
  /** Bumped when the box should take focus (after a prefill). */
  focusTick: number
  add: (m: Omit<ChatMessage, 'id'>) => void
  setProposalState: (id: string, s: ProposalState) => void
  reviseProposal: (p: ActionProposal) => void
  clear: () => void
  setDraft: (s: string) => void
  setTab: (t: 'chat' | 'tools') => void
  send: (text: string, ctx: AIContext, via?: ChatMessage['via']) => Promise<void>
}

let n = 0
const msgId = () => `m${Date.now().toString(36)}${(n++).toString(36)}`

export const useChatStore = create<ChatState>()((set, get) => ({
  messages: [],
  states: {},
  draft: '',
  busy: false,
  tab: 'chat',
  focusTick: 0,
  add: (m) => set((s) => ({
    messages: [...s.messages, { ...m, id: msgId() }],
    states: m.plan ? { ...s.states, ...Object.fromEntries(m.plan.proposals.map((p) => [p.id, { status: 'pending' } as ProposalState])) } : s.states,
  })),
  setProposalState: (id, st) => set((s) => ({ states: { ...s.states, [id]: st } })),
  reviseProposal: (p) => set((s) => ({
    messages: s.messages.map((m) => (m.plan?.proposals.some((x) => x.id === p.id) ? { ...m, plan: { ...m.plan, proposals: m.plan.proposals.map((x) => (x.id === p.id ? p : x)) } } : m)),
  })),
  clear: () => set({ messages: [], states: {} }),
  setDraft: (draft) => set({ draft }),
  setTab: (tab) => set({ tab }),
  send: async (raw, ctx, via = 'typed') => {
    const text = raw.trim()
    if (!text || get().busy) return
    set({ tab: 'chat', draft: '', busy: true })
    get().add({ role: 'user', text, via })
    try {
      const plan = await getAI().parseCommand(text, ctx)
      get().add({ role: 'assistant', plan })
    } catch {
      get().add({ role: 'assistant', text: i18next.t('ai:reply.failed'), error: true })
    } finally {
      set((s) => ({ busy: false, focusTick: s.focusTick + 1 }))
    }
  },
}))

/** The assistant's context outside React: the session's user, the current page and its record. */
function contextNow(): AIContext {
  const db = useDbStore.getState().db
  const session = useSessionStore.getState()
  const actor = resolveSessionUser(db.users, session.role, session.userId)
  const { pathname, search } = window.location
  return buildAIContext({ actor, route: pathname, selection: effectiveSelection(useSelectionStore.getState().selection, pathname, search), db: () => useDbStore.getState().db })
}

/** Opens the global assistant and sends `command` (or puts it in the box when `prefill`). */
export function askAssistant(command: string, opts: { prefill?: boolean } = {}) {
  useSessionStore.getState().setAiPanelOpen(true)
  const chat = useChatStore.getState()
  if (opts.prefill || !command.trim()) {
    useChatStore.setState((s) => ({ draft: command, tab: 'chat', focusTick: s.focusTick + 1 }))
    return
  }
  void chat.send(command, contextNow(), 'chip')
}
