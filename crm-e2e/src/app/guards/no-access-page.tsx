/**
 * NoAccess (DESIGN_SYSTEM §11.10): the lock illustration, "This area isn't available for {{role}}", the reason,
 * what the role CAN use (its nav items as links), and a Go to Today button.
 */
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { NoAccess } from '@/components/illustrations'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/hooks/use-current-user'
import { explainDenied, type Action } from '@/lib/permissions'
import { navFor } from '../nav'

export function NoAccessPage({ action }: { action: Action }) {
  const { t } = useTranslation(['shell', 'common'])
  const user = useCurrentUser()
  const role = t(`common:roles.${user.role}`)
  const reason = explainDenied(user, action)
  const items = navFor(user).flatMap((g) => g.items)
  return (
    <section data-testid="no-access" className="rounded-lg border bg-card shadow-card">
      <h1 className="sr-only">{t('shell:noAccess.title', { role })}</h1>
      <EmptyState
        illustration={NoAccess}
        title={t('shell:noAccess.title', { role })}
        body={
          <>
            <span className="block">{t(reason.reasonKey, reason.params)}</span>
            <span className="mt-4 block text-meta text-subtle-foreground">{t('shell:noAccess.body')}</span>
            <span role="list" aria-label={t('shell:noAccess.canDo')} className="mt-2 flex max-w-xl flex-wrap justify-center gap-2">
              {items.map((i) => (
                <span role="listitem" key={i.key}>
                  <Link
                    to={i.to}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-card px-3 text-ui text-foreground shadow-xs transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <i.icon className="size-4 text-primary" aria-hidden="true" strokeWidth={1.75} />
                    {t(i.labelKey)}
                  </Link>
                </span>
              ))}
            </span>
          </>
        }
        primary={
          <Button asChild>
            <Link to="/today">{t('common:actions.goToday')}</Link>
          </Button>
        }
      />
    </section>
  )
}
