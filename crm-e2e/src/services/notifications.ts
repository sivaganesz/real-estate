/**
 * Notification read state. A user only ever changes their own notifications. Nothing here is logged as activity.
 * Rendering rule for the UI: `params.variant` → t(`notifications:system.<variant>`), else t(`notifications:kind.<kind>`).
 */
import type { ID } from '@/domain/types'
import { commit } from './core/commit'

export function markRead(ids: ID[]) {
  return commit('notification.read', (tx) => {
    for (const n of tx.db.notifications) if (ids.includes(n.id) && n.userId === tx.actor.id && !n.readAt) n.readAt = tx.now
  })
}

export function markUnread(id: ID) {
  return commit('notification.unread', (tx) => {
    const n = tx.db.notifications.find((x) => x.id === id && x.userId === tx.actor.id)
    if (n) n.readAt = undefined
  })
}

export function markAllRead() {
  return commit('notification.readAll', (tx) => {
    for (const n of tx.db.notifications) if (n.userId === tx.actor.id && !n.readAt) n.readAt = tx.now
  })
}

export function deleteNotification(id: ID) {
  return commit('notification.delete', (tx) => {
    tx.db.notifications = tx.db.notifications.filter((n) => !(n.id === id && n.userId === tx.actor.id))
  })
}

/** The key to render a notification with (see the file comment). */
export const notificationKey = (n: { kind: string; params: Record<string, string | number> }) =>
  typeof n.params.variant === 'string' && n.params.variant ? `notifications:system.${n.params.variant}` : `notifications:kind.${n.kind}`
