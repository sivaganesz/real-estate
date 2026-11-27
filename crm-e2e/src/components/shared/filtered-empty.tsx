/** Filtered-empty state (DESIGN_SYSTEM §11.10): "No leads match these filters" + Clear filters; NoResults at 80 px, no hero. */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NoResults } from '@/components/illustrations'
import { Button } from '@/components/ui/button'
import { EmptyState } from './empty-state'

export function FilteredEmpty({ title, body, onClear, className }: { title?: ReactNode; body?: ReactNode; onClear?: () => void; className?: string }) {
  const { t } = useTranslation('ui')
  return (
    <EmptyState
      compact illustration={NoResults} className={className}
      title={title ?? t('filter.noMatchTitle')}
      body={body ?? t('filter.noMatchBody')}
      primary={onClear && <Button variant="secondary" onClick={onClear}>{t('filter.clearFilters')}</Button>}
    />
  )
}

