import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { NoResults } from '@/components/illustrations'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'

/** Any URL outside the registry. */
export default function NotFoundPage() {
  const { t } = useTranslation('common')
  return (
    <section data-testid="not-found" className="rounded-lg border bg-card shadow-card">
      <h1 className="sr-only">{t('notFound.title')}</h1>
      <EmptyState
        illustration={NoResults}
        title={t('notFound.title')}
        body={t('notFound.body')}
        primary={
          <Button asChild>
            <Link to="/today">{t('actions.goToday')}</Link>
          </Button>
        }
      />
    </section>
  )
}
