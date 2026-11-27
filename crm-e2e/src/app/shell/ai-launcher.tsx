/**
 * Mounts the global assistant in the shell: the floating AI button and the AI panel (components/ai). Ctrl/Cmd+K
 * toggles it from anywhere; the topbar "Search or ask AI…" pill opens it too (session store `aiPanelOpen`).
 */
import { useCallback } from 'react'
import { AIFab } from '@/components/ai/ai-fab'
import { AIPanel } from '@/components/ai/ai-panel'
import { useHotkey } from '@/hooks/use-hotkeys'
import { useSessionStore } from '@/store/session-store'

export function AiLauncher({ pageTitle }: { pageTitle?: string }) {
  const open = useSessionStore((s) => s.aiPanelOpen)
  const setOpen = useSessionStore((s) => s.setAiPanelOpen)
  const toggle = useCallback(() => setOpen(!useSessionStore.getState().aiPanelOpen), [setOpen])
  useHotkey('k', toggle)
  return (
    <>
      <AIFab hidden={open} onOpen={() => setOpen(true)} />
      <AIPanel open={open} onClose={() => setOpen(false)} pageTitle={pageTitle} />
    </>
  )
}
