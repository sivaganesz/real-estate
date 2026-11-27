/**
 * Demo AI badge (DESIGN_SYSTEM §11.9, master prompt §12.1): every output of the simulated provider carries it, so a
 * simulated answer is never presented as a live AI result. It reads the result's `mode`; with the live provider it
 * reads "AI" with the gradient border instead.
 */
import { FlaskConical, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { AIMode } from '@/ai/types'
import { cn } from '@/lib/utils'

export function DemoAIBadge({ mode, className }: { mode: AIMode; className?: string }) {
  const { t } = useTranslation('ai')
  const live = mode === 'live'
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          data-testid="demo-ai-badge"
          className={cn(
            'inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-micro font-semibold tracking-wide whitespace-nowrap uppercase focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [:lang(ta)_&]:normal-case',
            live ? 'border border-transparent bg-[linear-gradient(var(--ai-soft),var(--ai-soft))_padding-box,var(--ai-gradient)_border-box] text-ai' : 'border border-ai-border bg-ai-soft text-ai',
            className,
          )}
        >
          {live ? <Sparkles className="size-3" aria-hidden="true" /> : <FlaskConical className="size-3" aria-hidden="true" />}
          {live ? t('liveBadge') : t('demoBadge')}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{live ? t('badge.liveTip') : t('badge.demoTip')}</TooltipContent>
    </Tooltip>
  )
}
