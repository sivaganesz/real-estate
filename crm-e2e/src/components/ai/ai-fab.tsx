/**
 * Floating AI button (DESIGN_SYSTEM §11.1): bottom-right, a 48 px `bg-ai-gradient` circle with a white Sparkles icon;
 * hidden while the panel is open; above the bottom tab bar on phones.
 */
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Kbd } from '@/components/shared/kbd'

export function AIFab({ onOpen, hidden }: { onOpen: () => void; hidden?: boolean }) {
  const { t } = useTranslation(['shell', 'ai'])
  if (hidden) return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-testid="ai-fab"
          onClick={onOpen}
          aria-label={t('shell:ai.open')}
          aria-keyshortcuts="Control+K Meta+K"
          className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex size-12 items-center justify-center rounded-full bg-ai-gradient text-ai-foreground shadow-lg transition-transform duration-(--dur-fast) hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none md:right-6 md:bottom-6"
        >
          <Sparkles className="size-5" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="flex items-center gap-2">
        {t('ai:panel.title')}
        <Kbd>{t('shell:topbar.shortcut')}</Kbd>
      </TooltipContent>
    </Tooltip>
  )
}
