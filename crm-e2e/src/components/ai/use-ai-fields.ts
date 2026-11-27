/**
 * Which form fields the AI filled (master prompt §12.0: AI-filled values are visibly marked). A form keeps one of these:
 * `apply(extraction.meta)` marks the fields — one after another, 40 ms apart, so the user sees the AI working
 * (DESIGN_SYSTEM §7) — and `clear(path)` removes a marker when the user edits that field by hand.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FieldMeta, FieldMetaMap } from '@/domain/types'
import { useReducedMotion } from '@/hooks/use-reduced-motion'

export const LOW_CONFIDENCE = 0.75

export function useAIFields(initial: FieldMetaMap = {}) {
  const reduced = useReducedMotion()
  const [meta, setMeta] = useState<FieldMetaMap>(initial)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), [])

  const apply = useCallback((next: FieldMetaMap) => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
    const entries = Object.entries(next)
    if (reduced) {
      setMeta((m) => ({ ...m, ...next }))
      return
    }
    entries.forEach(([path, fm], i) => {
      timers.current.push(window.setTimeout(() => setMeta((m) => ({ ...m, [path]: fm })), i * 40))
    })
  }, [reduced])

  const clear = useCallback((path: string) => {
    setMeta((m) => {
      if (!m[path]) return m
      const rest = { ...m }
      delete rest[path]
      return rest
    })
  }, [])

  const reset = useCallback(() => setMeta({}), [])
  const get = useCallback((path: string): FieldMeta | undefined => meta[path], [meta])
  const count = Object.values(meta).filter((m) => m.origin === 'ai').length
  return { meta, apply, clear, reset, get, count }
}
