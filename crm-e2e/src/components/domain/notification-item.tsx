/**
 * One notification (bell popover and notification centre, DESIGN_SYSTEM §11.1): an icon tile coloured by kind, the
 * sentence (rendered from the `notifications` namespace, with stage / status / amount labels resolved), a relative
 * time and an unread dot. Clicking it marks it read and opens the record; the optional actions toggle read state
 * or remove it. A notification without a record just marks itself read.
 */
import {
  AlarmClock, ArrowRightLeft, Bell, Building2, CalendarPlus, CircleCheck, Copy, Hand, Hourglass, KanbanSquare,
  ListTodo, MailOpen, Plane, Siren, Stamp, Timer, Trash2, Trophy, Upload, UserPlus, UserX, Users, type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { pathFor } from '@/app/paths'
import { IconTile } from '@/components/shared/icon-tile'
import { toastError } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Notification, NotificationKind } from '@/domain/types'
import { fmtRelative } from '@/lib/dates'
import type { Tone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { markRead, markUnread, notificationText } from '@/services/notifications'

const KIND_LOOK: Record<NotificationKind, [LucideIcon, Tone]> = {
  assignment: [UserPlus, 'info'], reassignment: [ArrowRightLeft, 'info'], appointmentCreated: [CalendarPlus, 'primary'],
  appointmentReminder: [AlarmClock, 'warning'], taskOverdue: [ListTodo, 'danger'], slaBreach: [Timer, 'danger'], escalation: [Siren, 'danger'],
  importFinished: [Upload, 'info'], stageChanged: [KanbanSquare, 'primary'], booking: [Stamp, 'success'], propertyUnavailable: [Building2, 'warning'],
  leaveReassign: [Plane, 'warning'], stalledDeal: [Hourglass, 'warning'], deactivatedOwner: [UserX, 'warning'], duplicateFound: [Copy, 'warning'],
  system: [Bell, 'neutral'],
}
const VARIANT_LOOK: Record<string, [LucideIcon, Tone]> = {
  readyToBook: [Trophy, 'success'], assignmentBatch: [Users, 'info'], rescheduled: [CalendarPlus, 'warning'], reassignRequest: [Hand, 'info'], welcome: [CircleCheck, 'primary'],
}

function notificationLook(n: Pick<Notification, 'kind' | 'params'>): [LucideIcon, Tone] {
  const v = typeof n.params.variant === 'string' ? VARIANT_LOOK[n.params.variant] : undefined
  return v ?? KIND_LOOK[n.kind] ?? [Bell, 'neutral']
}

export function NotificationItem({ n, now, onOpened, selectable, selected, onSelect, onDelete, dense, className }: {
  n: Notification
  now: Date
  /** After the click navigated (closes the popover). */
  onOpened?: () => void
  selectable?: boolean
  selected?: boolean
  onSelect?: (on: boolean) => void
  /** Shows a delete action (the centre). */
  onDelete?: () => void
  /** The bell's tighter rows. */
  dense?: boolean
  className?: string
}) {
  const { t, i18n } = useTranslation(['notifications', 'catalogue'])
  const navigate = useNavigate()
  const [Icon, tone] = notificationLook(n)
  const text = notificationText(t, n)
  const unread = !n.readAt

  const open = () => {
    try {
      if (unread) markRead([n.id])
    } catch (e) {
      toastError(e)
    }
    if (n.ref) navigate(pathFor(n.ref))
    onOpened?.()
  }
  const toggleRead = () => {
    try {
      if (unread) markRead([n.id])
      else markUnread(n.id)
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <div
      data-testid="notification-item"
      data-unread={unread || undefined}
      className={cn(
        'group relative flex items-start gap-3 rounded-md transition-colors duration-(--dur-fast) hover:bg-muted/60 focus-within:bg-muted/60',
        dense ? 'px-3 py-2.5' : 'px-3 py-3',
        selected && 'bg-primary-soft/60',
        className,
      )}
    >
      {selectable && (
        <Checkbox
          checked={!!selected} onCheckedChange={(v) => onSelect?.(v === true)} className="mt-2.5"
          aria-label={t('notifications:select', { text })}
        />
      )}
      <IconTile icon={Icon} tone={tone} size={dense ? 'md' : 'lg'} className="mt-0.5" />
      <button
        type="button" onClick={open}
        className="min-w-0 flex-1 rounded-sm text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className={cn('block text-sm', unread ? 'font-medium text-foreground' : 'text-muted-foreground')}>
          {unread && <span className="sr-only">{t('notifications:unreadLabel')}: </span>}
          {text}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-meta text-subtle-foreground">
          <span className="tabular-nums">{fmtRelative(n.at, now, i18n.resolvedLanguage)}</span>
          {n.priority === 'high' && <span className="font-medium text-danger">{t('notifications:priorityHigh')}</span>}
          {n.ref && <span className="text-primary group-hover:underline">{t('notifications:openRecord')}</span>}
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost" size="icon" onClick={toggleRead} className="size-7 opacity-70 hover:opacity-100 focus-visible:opacity-100"
              aria-label={unread ? t('notifications:markRead') : t('notifications:markUnread')} data-testid="notification-toggle-read"
            >
              {unread ? <span aria-hidden="true" className={cn('size-2 rounded-full', n.priority === 'high' ? 'bg-danger' : 'bg-primary')} /> : <MailOpen className="size-3.5" aria-hidden="true" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{unread ? t('notifications:markRead') : t('notifications:markUnread')}</TooltipContent>
        </Tooltip>
        {onDelete && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onDelete} className="size-7 text-muted-foreground hover:text-danger" aria-label={t('notifications:delete')}>
                <Trash2 className="size-3.5" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('notifications:delete')}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
