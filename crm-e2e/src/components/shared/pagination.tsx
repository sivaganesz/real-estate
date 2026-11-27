/** Table pagination (DESIGN_SYSTEM §11.7): "1–25 of 132", a page-size select, previous / next. Lives in the table footer. */
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export function Pagination({ page, pageSize, total, onPage, onPageSize, sizes = [10, 25, 50, 100], className }: {
  /** 0-based */
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
  onPageSize?: (size: number) => void
  sizes?: number[]
  className?: string
}) {
  const { t } = useTranslation('ui')
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total ? page * pageSize + 1 : 0
  const to = Math.min(total, (page + 1) * pageSize)
  return (
    <nav aria-label={t('pagination.label')} className={cn('flex flex-wrap items-center justify-between gap-3 text-meta text-muted-foreground', className)}>
      <span className="tabular-nums" aria-live="polite">{t('pagination.range', { from, to, total })}</span>
      <div className="flex items-center gap-2">
        {onPageSize && (
          <label className="flex items-center gap-2">
            <span className="max-sm:sr-only">{t('pagination.perPage')}</span>
            <Select value={String(pageSize)} onValueChange={(v) => onPageSize(Number(v))}>
              <SelectTrigger size="sm" className="h-8 w-[4.5rem]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {sizes.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
        )}
        <Button variant="secondary" size="icon-sm" disabled={page <= 0} onClick={() => onPage(page - 1)} aria-label={t('pagination.prev')}><ChevronLeft /></Button>
        <span className="tabular-nums">{t('pagination.page', { page: page + 1, pages })}</span>
        <Button variant="secondary" size="icon-sm" disabled={page >= pages - 1} onClick={() => onPage(page + 1)} aria-label={t('pagination.next')}><ChevronRight /></Button>
      </div>
    </nav>
  )
}
