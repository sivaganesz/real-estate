/**
 * Runs an AI call for a key (lead id + what changed) and keeps the last answer while a new one loads. The call is an
 * effect event, so a new context object each render does not re-run it; only a new key does.
 */
import { useEffect, useEffectEvent, useState } from 'react'

export function useAIResult<T>(key: string | null, run: () => Promise<T>): { data: T | null; loading: boolean; error: boolean } {
  const [state, setState] = useState<{ key: string; data: T | null; error: boolean } | null>(null)
  const exec = useEffectEvent(run)
  useEffect(() => {
    if (key === null) return
    let live = true
    exec().then(
      (data) => { if (live) setState({ key, data, error: false }) },
      () => { if (live) setState({ key, data: null, error: true }) },
    )
    return () => { live = false }
  }, [key])
  const fresh = state?.key === key
  return { data: state?.data ?? null, loading: key !== null && !fresh, error: fresh && !!state?.error }
}
