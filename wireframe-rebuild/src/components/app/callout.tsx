import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type Tone, toneBorder, toneSoft, toneText } from './tone'

const ICON: Partial<Record<Tone, LucideIcon>> = { success: CircleCheck, warning: TriangleAlert, danger: CircleAlert, info: Info, primary: Info }

/** A short note in the flow of a page: a warning, a hint, a result. Replaces the wireframe's `.note`. */
export function Callout({ tone = 'neutral', title, action, children, className }: {
  tone?: Tone; title?: ReactNode; action?: ReactNode; children?: ReactNode; className?: string
}) {
  const Icon = ICON[tone]
  return (
    <div role={tone === 'danger' || tone === 'warning' ? 'alert' : 'note'}
      className={cn('flex items-start gap-2.5 rounded-lg border-l-[3px] px-3 py-2.5 text-sm', toneSoft[tone], toneBorder[tone], 'text-foreground', className)}>
      {Icon && <Icon className={cn('mt-0.5 size-4 shrink-0', toneText[tone])} />}
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'text-foreground/80')}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
