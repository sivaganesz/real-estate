/**
 * Speak instead of typing (master prompt §12.4): the browser's Web Speech API in English (India). Ported from
 * wireframe-rebuild/src/features/assistant/use-speech.ts; it now reports `supported` and an `error`, so the mic button
 * can show a fallback message instead of disappearing (Known limitation K2).
 */
import { useCallback, useEffect, useRef, useState } from 'react'

type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error?: string }) => void) | null
  start: () => void; stop: () => void
}
type RecognitionCtor = new () => Recognition

const ctor = (): RecognitionCtor | undefined => {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export const speechSupported = () => !!ctor()

export type SpeechError = 'notAllowed' | 'noSpeech' | 'network' | 'other'

/** `onText` gets the words heard so far (replacing the previous call's), then the final text with `final` true. */
export function useSpeech(onText: (text: string, final: boolean) => void, lang = 'en-IN') {
  const supported = speechSupported()
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<SpeechError | null>(null)
  const rec = useRef<Recognition | null>(null)
  const cb = useRef(onText)
  useEffect(() => {
    cb.current = onText
  }, [onText])
  useEffect(() => () => rec.current?.stop(), [])

  const start = useCallback(() => {
    const C = ctor()
    if (!C) return
    setError(null)
    const r = new C()
    r.lang = lang
    r.interimResults = true
    r.continuous = false
    r.onresult = (e) => {
      const parts = Array.from(e.results)
      cb.current(parts.map((p) => p[0].transcript).join(' '), parts.every((p) => p.isFinal))
    }
    r.onend = () => setListening(false)
    r.onerror = (e) => {
      setListening(false)
      setError(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'notAllowed' : e.error === 'no-speech' ? 'noSpeech' : e.error === 'network' ? 'network' : 'other')
    }
    rec.current = r
    setListening(true)
    try {
      r.start()
    } catch {
      setListening(false)
      setError('other')
    }
  }, [lang])

  const stop = useCallback(() => {
    rec.current?.stop()
    setListening(false)
  }, [])

  return { supported, listening, error, start, stop }
}
