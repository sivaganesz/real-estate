/**
 * Speak instead of typing: the browser's own speech recognition (Chrome, Edge, Safari), English (India) for now.
 * Proper Tamil voice comes with the real AI (step B). Where the browser has none, the mic button isn't shown.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onend: (() => void) | null; onerror: (() => void) | null
  start: () => void; stop: () => void
}
type RecognitionCtor = new () => Recognition

const Ctor = (): RecognitionCtor | undefined => {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

/** `onText` gets the words heard so far (replacing the last call's), then the final text. */
export function useSpeech(onText: (text: string, final: boolean) => void) {
  const supported = !!Ctor()
  const [listening, setListening] = useState(false)
  const rec = useRef<Recognition | null>(null)
  const cb = useRef(onText)
  useEffect(() => { cb.current = onText }, [onText])
  useEffect(() => () => rec.current?.stop(), [])

  const start = useCallback(() => {
    const C = Ctor()
    if (!C) return
    const r = new C()
    r.lang = 'en-IN'
    r.interimResults = true
    r.continuous = false
    r.onresult = (e) => {
      const parts = Array.from(e.results)
      cb.current(parts.map((p) => p[0].transcript).join(' '), parts.every((p) => p.isFinal))
    }
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    rec.current = r
    setListening(true)
    r.start()
  }, [])
  const stop = useCallback(() => { rec.current?.stop(); setListening(false) }, [])
  return { supported, listening, start, stop }
}
