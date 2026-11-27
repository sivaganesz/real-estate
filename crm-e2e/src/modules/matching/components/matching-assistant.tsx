/**
 * The property-matching assistant (master prompt §12.2): "properties within Rahul's budget in Whitefield",
 * "3 BHK ready to move for Priya under 1.2 Cr", "which leads fit PRP-1004". Typed or spoken (en-IN); the reading is
 * shown as chips with the Demo AI badge and applied to the page (who, plus extra filters). Nothing is written.
 */
import { useState } from 'react'
import { Loader2, Sparkles, Wand2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { VoiceButton } from '@/components/ai/voice-button'
import { Chip } from '@/components/shared/chip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Lead, Property } from '@/domain/types'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { readMatchingRequest, type MatchingReading } from '../lib/assistant'

export function MatchingAssistant({ leads, properties, onApply, examples }: {
  leads: Pick<Lead, 'id' | 'name'>[]
  properties: Pick<Property, 'id' | 'title' | 'projectName'>[]
  onApply: (r: MatchingReading, text: string) => void
  examples: string[]
}) {
  const { t } = useTranslation('matching')
  const reduced = useReducedMotion()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [unknown, setUnknown] = useState(false)

  const ask = (input = text) => {
    const clean = input.trim()
    if (!clean) return
    setBusy(true)
    // rule-based reading; the short pause shows the assistant working like every other AI action
    window.setTimeout(() => {
      const r = readMatchingRequest(clean, leads, properties)
      setUnknown(r.empty)
      if (!r.empty) onApply(r, clean)
      setBusy(false)
    }, reduced ? 0 : 300)
  }

  return (
    <section aria-label={t('assistant.title')} className="flex flex-col gap-3 rounded-xl border border-dashed border-ai-border bg-ai-soft/30 p-4" data-testid="matching-assistant">
      <header className="flex flex-wrap items-center gap-2">
        <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-md bg-ai-gradient text-ai-foreground"><Sparkles className="size-3.5" /></span>
        <h2 className="flex-1 text-sm font-semibold">{t('assistant.title')}</h2>
        <DemoAIBadge mode="simulated" />
      </header>
      <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); ask() }}>
        <Input
          value={text} onChange={(e) => setText(e.target.value)} placeholder={t('assistant.placeholder')} aria-label={t('assistant.title')}
          className="min-w-0 flex-1 bg-card text-prompt" data-testid="matching-ask"
        />
        <VoiceButton onText={(heard, final) => { setText(heard); if (final) ask(heard) }} />
        <Button type="submit" variant="ai" disabled={!text.trim() || busy} aria-busy={busy || undefined}>
          {busy ? <Loader2 className="animate-spin" /> : <Wand2 />}{t('assistant.ask')}
        </Button>
      </form>
      {unknown && <p role="status" className="text-meta text-muted-foreground">{t('assistant.unknown')}</p>}
      <div className="flex flex-wrap gap-1.5">
        {examples.map((ex) => <Chip key={ex} tone="ai" size="sm" onClick={() => { setText(ex); ask(ex) }}>{ex}</Chip>)}
      </div>
    </section>
  )
}
