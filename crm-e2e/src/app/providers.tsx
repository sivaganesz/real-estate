/**
 * App-wide providers: tooltips and toasts (DESIGN_SYSTEM §11.11: bottom-right on desktop, top-centre on phone,
 * at most 3 visible, themed with the app). Later phases add the AI provider and the automation ticker here.
 */
import { useEffect, type ReactNode } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useIsDark } from '@/lib/theme'
import { startAutomation } from '@/services/automation'

export function Providers({ children }: { children: ReactNode }) {
  const phone = !useMediaQuery('(min-width: 768px)')
  const dark = useIsDark()
  // SLA, reminders, overdue and stalled notices: on load, then every minute (foundation-plan §5.3)
  useEffect(() => startAutomation(), [])
  return (
    <TooltipProvider delayDuration={300}>
      {children}
      <Toaster theme={dark ? 'dark' : 'light'} position={phone ? 'top-center' : 'bottom-right'} visibleToasts={3} closeButton />
    </TooltipProvider>
  )
}
