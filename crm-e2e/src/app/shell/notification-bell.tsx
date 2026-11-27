/**
 * Bell (DESIGN_SYSTEM §11.1, owned by M8): unread badge that pops on change, and a 380 px popover with All / Unread
 * tabs, the latest notifications for the current user (click opens the record and marks it read; the dot toggles
 * read state), "Mark all read" with Undo-free confirmation by toast, and a link to the notification centre.
 */
import { useMemo, useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Link } from 'react-router'
import { paths } from '@/app/paths'
import { NotificationItem } from '@/components/domain/notification-item'
import { EmptyNotifications } from '@/components/illustrations'
import { EmptyState } from '@/components/shared/empty-state'
import { Segmented } from '@/components/shared/segmented'
import { toastError } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { markAllRead } from '@/services/notifications'

const SHOWN = 8

export function NotificationBell() {
  const { t } = useTranslation(['notifications', 'shell'])
  const now = useNow(15_000)
  const user = useCurrentUser()
  const all = useDb((db) => db.notifications)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'all' | 'unread'>('all')
  const mine = useMemo(() => all.filter((n) => n.userId === user.id).sort((a, b) => b.at.localeCompare(a.at)), [all, user.id])
  const unread = mine.filter((n) => !n.readAt).length
  const list = (tab === 'unread' ? mine.filter((n) => !n.readAt) : mine).slice(0, SHOWN)

  const readAll = () => {
    try {
      markAllRead()
      toast.success(t('notifications:allReadDone', { count: unread }))
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost" size="icon" className="relative" data-testid="bell"
          aria-label={unread ? `${t('notifications:bell.label')} · ${t('notifications:bell.unread', { count: unread })}` : t('notifications:bell.label')}
        >
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
      <PopoverContent align="end" className="w-[380px] max-w-[calc(100vw-1rem)] gap-0 p-0 shadow-lg" data-testid="bell-popover">
        <div className="flex items-center justify-between gap-2 px-4 pt-3">
          <span className="text-sm font-semibold">{t('notifications:bell.label')}</span>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={readAll} className="h-7 px-2 text-meta text-primary" data-testid="bell-mark-all">
              <CheckCheck className="size-3.5" aria-hidden="true" />
              {t('notifications:markAllRead')}
            </Button>
          )}
        </div>
        <Segmented
          value={tab} onChange={setTab} label={t('notifications:bell.tabs')} className="mt-2 px-2"
          segments={[
            { value: 'all', label: t('notifications:tabs.all'), count: mine.length },
            { value: 'unread', label: t('notifications:tabs.unread'), count: unread },
          ]}
        />
        {list.length === 0 ? (
          <EmptyState
            compact illustration={EmptyNotifications}
            title={tab === 'unread' && mine.length ? t('notifications:bell.noneUnread') : t('notifications:bell.empty')}
            body={t('notifications:bell.emptyBody')}
          />
        ) : (
          <ul className="max-h-[min(420px,60vh)] overflow-y-auto p-1">
            {list.map((n) => (
              <li key={n.id}>
                <NotificationItem n={n} now={now} dense onOpened={() => setOpen(false)} />
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center justify-between gap-2 border-t px-4 py-2.5">
          <span className="text-meta text-muted-foreground">{t('notifications:bell.showing', { count: list.length, total: tab === 'unread' ? unread : mine.length })}</span>
          <Link to={paths.notifications()} onClick={() => setOpen(false)} className="text-sm font-medium text-primary hover:underline" data-testid="bell-view-all">
            {t('notifications:bell.viewAll')}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
