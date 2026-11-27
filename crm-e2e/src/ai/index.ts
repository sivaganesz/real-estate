/**
 * The AI entry point. getAI() picks the provider from the environment once: the simulated one unless
 * VITE_AI_PROVIDER=live AND VITE_AI_ENDPOINT is set (foundation-plan §2.3). useAI() gives a component the service and a
 * context builder for the current user, page and selected record.
 */
import { useCallback, useMemo } from 'react'
import { useLocation } from 'react-router'
import type { EntityRef } from '@/domain/types'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useDbStore } from '@/store/db-store'
import { buildAIContext, effectiveSelection, useSelectionStore } from './context'
import { createLiveProvider } from './live/provider'
import { createSimulatedProvider } from './simulated/provider'
import type { AIContext, AIService } from './types'

export type * from './types'
export { useAISelection, selectionLabel, selectionFromRoute } from './context'
export { MODULE_ASSISTANTS, type ModuleAssistantKey } from './modules'
export { rolePrompts } from './prompts'

let instance: AIService | undefined

export function selectProvider(env: { VITE_AI_PROVIDER?: string; VITE_AI_ENDPOINT?: string; VITE_AI_MODEL?: string }): AIService {
  const simulated = createSimulatedProvider()
  const endpoint = env.VITE_AI_ENDPOINT?.trim()
  if (env.VITE_AI_PROVIDER === 'live' && endpoint) return createLiveProvider(endpoint, simulated, env.VITE_AI_MODEL || undefined)
  return simulated
}

export function getAI(): AIService {
  instance ??= selectProvider(import.meta.env as Record<string, string | undefined>)
  return instance
}

/** The record the assistant treats as selected: the page's useAISelection, else the record in the URL. */
export function useAIContextSelection(): EntityRef | undefined {
  const { pathname, search } = useLocation()
  const explicit = useSelectionStore((s) => s.selection)
  return useMemo(() => effectiveSelection(explicit, pathname, search), [explicit, pathname, search])
}

export function useAI(): { ai: AIService; context: () => AIContext } {
  const actor = useCurrentUser()
  const { pathname } = useLocation()
  const selection = useAIContextSelection()
  const context = useCallback(
    () => buildAIContext({ actor, route: pathname, selection, db: () => useDbStore.getState().db }),
    [actor, pathname, selection],
  )
  return { ai: getAI(), context }
}
