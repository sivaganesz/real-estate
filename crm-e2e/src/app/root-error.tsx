/** Last-resort error screen when the shell itself fails (page errors are caught inside the shell). */
import { useTranslation } from 'react-i18next'
import { ErrorState } from '@/components/illustrations'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'

export function RootError() {
  const { t } = useTranslation('common')
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div role="alert" className="w-full max-w-lg rounded-lg border bg-card shadow-card">
        <EmptyState
          illustration={ErrorState}
          title={t('error.title')}
          body={t('error.body')}
          primary={<Button onClick={() => window.location.reload()}>{t('actions.tryAgain')}</Button>}
          secondary={
            <Button variant="secondary" onClick={() => window.location.assign('/today')}>
              {t('actions.goToday')}
            </Button>
          }
        />
      </div>
    </div>
  )
}
