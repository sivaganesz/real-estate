/** AI suggestion chip (DESIGN_SYSTEM §11.9): `bg-ai-soft text-ai rounded-md px-2 py-1 text-meta` with ✦; clickable. */
import type { ReactNode } from 'react'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export function AISuggestionChip({ children, onClick, className, title }: { children: ReactNode; onClick?: () => void; className?: string; title?: string }) {
  const cls = cn('inline-flex max-w-full items-center gap-1 rounded-md bg-ai-soft px-2 py-1 text-left text-meta font-medium text-ai', className)
  const inner = (
    <>
      <Sparkles className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{children}</span>
    </>
  )
  return onClick ? (
    <button type="button" onClick={onClick} title={title} className={cn(cls, 'hover:bg-[color-mix(in_oklch,var(--ai-soft),var(--ai)_10%)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none')}>{inner}</button>
  ) : (
    <span title={title} className={cls}>{inner}</span>
  )
}
