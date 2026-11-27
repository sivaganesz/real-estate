import { useEffect } from 'react'

/** Ctrl/Cmd + key shortcut (e.g. useHotkey('k', openAssistant)). Ignores repeats. */
export function useHotkey(key: string, handler: () => void, opts: { mod?: boolean } = { mod: true }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (opts.mod && !(e.ctrlKey || e.metaKey)) return
      if (e.key.toLowerCase() !== key.toLowerCase()) return
      e.preventDefault()
      handler()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [key, handler, opts.mod])
}
