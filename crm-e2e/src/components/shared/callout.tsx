/** A short note in the flow of a page (warning, hint, result). Ported from the rebuild's callout; tones from lib/tones. */
import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, Lock, Sparkles, TriangleAlert, type LucideIcon } from 'lucide-react'
import { TONE, type Tone } from '@/lib/tones'
import { cn } from '@/lib/utils'

const ICON: Partial<Record<Tone, LucideIcon>> = { success: CircleCheck, warning: TriangleAlert, danger: CircleAlert, info: Info, primary: Info, ai: Sparkles, neutral: Lock }

export function Callout({ tone = 'info', title, action, children, icon, className }: {
  tone?: Tone
  title?: ReactNode
  action?: ReactNode
  children?: ReactNode
  icon?: LucideIcon
  className?: string
}) {
  const Icon = icon ?? ICON[tone]
  return (
    <div role={tone === 'danger' || tone === 'warning' ? 'alert' : 'note'} className={cn('flex items-start gap-2.5 rounded-md px-3 py-2.5 text-sm', TONE[tone].soft, className)}>
      {Icon && <Icon className={cn('mt-0.5 size-4 shrink-0', TONE[tone].text)} aria-hidden="true" />}
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium text-foreground">{title}</p>}
        {children && <div className={cn('text-foreground/85', title && 'mt-0.5')}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
