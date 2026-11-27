/**
 * App-wide providers: tooltips and toasts (DESIGN_SYSTEM §11.11: bottom-right on desktop, top-centre on phone,
 * at most 3 visible, themed with the app). Later phases add the AI provider and the automation ticker here.
 */
import { useEffect, type ReactNode } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useDb } from '@/hooks/use-db'
import { useMediaQuery } from '@/hooks/use-media-query'
import { applyStageLabels } from '@/i18n'
import { useIsDark } from '@/lib/theme'
import { startAutomation } from '@/services/automation'

export function Providers({ children }: { children: ReactNode }) {
  const phone = !useMediaQuery('(min-width: 768px)')
  const dark = useIsDark()
  // SLA, reminders, overdue and stalled notices: on load, then every minute (foundation-plan §5.3)
  useEffect(() => startAutomation(), [])
  // admin-renamed pipeline stages show under their new name on every screen
  const stages = useDb((db) => db.settings.pipeline.stages)
  useEffect(() => { applyStageLabels(stages) }, [stages])
  return (
    <TooltipProvider delayDuration={300}>
      {children}
      {/* desktop: the stack sits beside the floating AI button (right-6 bottom-6, 48 px), never over it, even while sliding in */}
      <Toaster theme={dark ? 'dark' : 'light'} position={phone ? 'top-center' : 'bottom-right'} offset={phone ? undefined : { bottom: 24, right: 84 }} visibleToasts={3} closeButton />
    </TooltipProvider>
  )
}
