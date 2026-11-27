/**
 * Bulk action bar (DESIGN_SYSTEM §11.7): when rows are selected, a floating `shadow-xl rounded-xl bg-popover` bar rises
 * from the bottom centre: "3 selected · Assign · Change stage · Export · Delete" (Delete in the danger tone).
 */
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function BulkBar({ count, onClear, children, className }: { count: number; onClear: () => void; children: ReactNode; className?: string }) {
  const { t } = useTranslation('ui')
  if (!count) return null
  return (
    <div
      role="toolbar"
      aria-label={t('bulk.label')}
      className={cn(
        'fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-max animate-fade-up flex-wrap items-center gap-1 rounded-xl border bg-popover px-2 py-1.5 shadow-xl md:bottom-6',
        className,
      )}
    >
      <span className="px-2 text-sm font-semibold tabular-nums">{t('bulk.selected', { count })}</span>
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
      {children}
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
      <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label={t('bulk.clear')}>
        <X />
      </Button>
    </div>
  )
}
