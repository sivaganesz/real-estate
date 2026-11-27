/**
 * Bell (Phase 1 placeholder, owned by M8 from Phase 2): unread badge and a 380 px popover with the latest
 * notifications for the current user and a link to the notification centre. Read state changes arrive with M8.
 */
import { Bell } from 'lucide-react'
import { useMemo } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { EmptyNotifications } from '@/components/illustrations'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Notification } from '@/domain/types'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { fmtRelative } from '@/lib/dates'
import { cn } from '@/lib/utils'

function notificationText(t: TFunction, n: Notification): string {
  if (n.kind === 'system' && typeof n.params.variant === 'string') return t(`notifications:system.${n.params.variant}`, n.params)
  return t(`notifications:kind.${n.kind}`, n.params)
}

export function NotificationBell() {
  const { t, i18n } = useTranslation(['shell', 'notifications'])
  const now = useNow()
  const user = useCurrentUser()
  const all = useDb((db) => db.notifications)
  const mine = useMemo(() => all.filter((n) => n.userId === user.id).sort((a, b) => b.at.localeCompare(a.at)), [all, user.id])
  const unread = mine.filter((n) => !n.readAt).length
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" data-testid="bell" aria-label={unread ? `${t('shell:bell.label')} · ${t('shell:bell.unread', { count: unread })}` : t('shell:bell.label')}>
          <Bell className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
          {unread > 0 && (
            <span
              key={unread}
              className="absolute top-1 right-1 inline-flex h-4 min-w-4 animate-in items-center justify-center rounded-full bg-danger px-1 text-micro font-semibold text-danger-foreground tabular-nums zoom-in-50 ease-(--ease-spring)"
              aria-hidden="true"
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] max-w-[calc(100vw-2rem)] gap-0 p-0 shadow-lg">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">{t('shell:bell.label')}</span>
          {unread > 0 && <span className="rounded-full bg-danger-soft px-2 text-meta font-medium text-danger tabular-nums">{t('shell:bell.unread', { count: unread })}</span>}
        </div>
        {mine.length === 0 ? (
          <EmptyState compact illustration={EmptyNotifications} title={t('shell:bell.empty')} />
        ) : (
          <ul className="max-h-[360px] overflow-y-auto py-1">
            {mine.slice(0, 6).map((n) => (
              <li key={n.id} className="flex items-start gap-3 px-4 py-2.5">
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : n.priority === 'high' ? 'bg-danger' : 'bg-primary')} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm', n.readAt ? 'text-muted-foreground' : 'font-medium text-foreground')}>{notificationText(t, n)}</span>
                  <span className="block text-meta text-subtle-foreground">{fmtRelative(n.at, now, i18n.resolvedLanguage)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-1 border-t px-4 py-3">
          <p className="text-meta text-muted-foreground">{t('shell:bell.soon')}</p>
          <Link to="/notifications" className="text-sm font-medium text-primary hover:underline">{t('shell:bell.viewAll')}</Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
