/**
 * Temporary module page used until a Phase 2 owner replaces it: page header + illustrated "Coming in Phase 2" state.
 * Strings come from the module's own namespace: `<ns>:title`, `<ns>:subtitle`, `<ns>:stub.<view>.title|body`.
 */
import { Construction } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import type { Illustration } from '@/components/illustrations'
import { Button } from '@/components/ui/button'
import { EmptyState } from './empty-state'
import { PageHeader } from './page-header'

export function StubPage({ ns, view = 'index', illustration, titleKey, subtitleKey }: {
  ns: string
  view?: string
  illustration: Illustration
  /** Overrides `<ns>:title` (e.g. 'activity:page.title'). */
  titleKey?: string
  subtitleKey?: string
}) {
  const { t } = useTranslation([ns, 'common'])
  // no "Go to Today" button on Today itself (it would do nothing)
  const onToday = useLocation().pathname === '/today'
  const stubBase = titleKey ? titleKey.replace(/\.title$/, '.stub') : `${ns}:stub`
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t(titleKey ?? `${ns}:title`)} subtitle={t(subtitleKey ?? `${ns}:subtitle`)} />
      <section className="rounded-lg border bg-card shadow-card">
        <EmptyState
          illustration={illustration}
          badge={
            <span className="inline-flex h-5 items-center gap-1 rounded-full bg-warning-soft px-2 text-meta font-medium text-warning">
              <Construction className="size-3" aria-hidden="true" />
              {t('common:comingSoon.badge')}
            </span>
          }
          title={t(`${stubBase}.${view}.title`)}
          body={
            <>
              {t(`${stubBase}.${view}.body`)}
              <span className="mt-2 block text-meta text-subtle-foreground">{t('common:comingSoon.title')} · {t('common:comingSoon.body')}</span>
            </>
          }
          primary={onToday ? undefined : (
            <Button asChild variant="secondary">
              <Link to="/today">{t('common:actions.goToday')}</Link>
            </Button>
          )}
        />
      </section>
    </div>
  )
}
