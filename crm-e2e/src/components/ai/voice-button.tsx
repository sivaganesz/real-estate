/**
 * Microphone button (master prompt §12.4, DESIGN_SYSTEM §11.9): Web Speech API in en-IN; while listening it shows a
 * red pulsing ring and "Listening… (en-IN)". Where the browser has no speech recognition the button stays and explains
 * why in a popover (Known limitation K2) instead of disappearing.
 */
import { Mic, MicOff, Square } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useSpeech } from '@/hooks/use-speech'
import { cn } from '@/lib/utils'

export function VoiceButton({ onText, size = 'icon', className, showLabel }: {
  /** Interim text (final false) then the final transcript (final true). */
  onText: (text: string, final: boolean) => void
  size?: 'icon' | 'icon-sm'
  className?: string
  showLabel?: boolean
}) {
  const { t } = useTranslation('ai')
  const { supported, listening, error, start, stop } = useSpeech(onText)
  const [helpOpen, setHelpOpen] = useState(false)

  if (!supported) {
    return (
      <Popover open={helpOpen} onOpenChange={setHelpOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size={size} className={className} aria-label={t('voice.unsupportedLabel')} data-testid="voice-button">
            <MicOff className="text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 text-sm">
          <p className="font-medium">{t('voice.unsupportedTitle')}</p>
          <p className="mt-1 text-muted-foreground">{t('voice.unsupportedBody')}</p>
        </PopoverContent>
      </Popover>
    )
  }
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button" variant={listening ? 'destructive' : 'ghost'} size={size} data-testid="voice-button"
        aria-pressed={listening} aria-label={listening ? t('voice.stop') : t('voice.start')}
        onClick={listening ? stop : start}
        className={cn(listening && 'relative after:absolute after:inset-0 after:animate-ping after:rounded-md after:bg-danger/30', className)}
      >
        {listening ? <Square /> : <Mic />}
      </Button>
      {(listening || showLabel) && (
        <span aria-live="polite" className={cn('text-meta', listening ? 'text-danger' : 'text-muted-foreground')}>
          {listening ? t('voice.listening') : t('voice.hint')}
        </span>
      )}
      {error && !listening && <span role="alert" className="text-meta text-danger">{t(`voice.error.${error}`)}</span>}
    </span>
  )
}
