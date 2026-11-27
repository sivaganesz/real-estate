/** Runs an async AI call with busy / error state and the last call kept for "Try again" (module assistants). */
import { useCallback, useRef, useState } from 'react'

export function useAssistCall<T>() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [result, setResult] = useState<T | null>(null)
  const last = useRef<(() => Promise<T>) | null>(null)
  // stable, so effects can list it as a dependency
  const run = useCallback(async (fn: () => Promise<T>) => {
    last.current = fn
    setBusy(true)
    setError(false)
    try {
      setResult(await fn())
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }, [])
  const retry = useCallback(() => { if (last.current) void run(last.current) }, [run])
  return { busy, error, result, run, retry, setResult }
}
