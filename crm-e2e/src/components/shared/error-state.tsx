/** Error state (DESIGN_SYSTEM §11.10): the ErrorState illustration, a human explanation, Try again + Go to Today. */
import type { ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ErrorState as ErrorArt } from '@/components/illustrations'
import { Button } from '@/components/ui/button'
import { EmptyState } from './empty-state'

export function ErrorState({ title, body, onRetry, compact, className }: { title?: ReactNode; body?: ReactNode; onRetry?: () => void; compact?: boolean; className?: string }) {
  const { t } = useTranslation('common')
  return (
    <EmptyState
      illustration={ErrorArt} compact={compact} className={className}
      title={title ?? t('error.title')}
      body={body ?? t('error.body')}
      primary={onRetry && <Button onClick={onRetry}><RotateCcw aria-hidden="true" />{t('actions.tryAgain')}</Button>}
      secondary={<Button asChild variant="secondary"><Link to="/today">{t('actions.goToday')}</Link></Button>}
    />
  )
}

