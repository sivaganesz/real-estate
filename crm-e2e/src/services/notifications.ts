/**
 * Notification read state. A user only ever changes their own notifications. Nothing here is logged as activity.
 * Rendering rule for the UI: `params.variant` → t(`notifications:system.<variant>`), else t(`notifications:kind.<kind>`).
 */
import type { TFunction } from 'i18next'
import type { ID, Notification } from '@/domain/types'
import { inrShort } from '@/lib/format'
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

/** Marks several of the user's notifications unread again (the centre's bulk action). */
export function markManyUnread(ids: ID[]) {
  return commit('notification.unreadMany', (tx) => {
    for (const n of tx.db.notifications) if (ids.includes(n.id) && n.userId === tx.actor.id) n.readAt = undefined
  })
}

/** Removes several of the user's notifications; undoable (the centre shows Undo). */
export function deleteNotifications(ids: ID[]) {
  return commit('notification.deleteMany', (tx) => {
    const before = tx.db.notifications.length
    tx.db.notifications = tx.db.notifications.filter((n) => !(ids.includes(n.id) && n.userId === tx.actor.id))
    return before - tx.db.notifications.length
  }, { undoable: true })
}

/** Elapsed minutes as the app reads them elsewhere: "25 min", "20 h 0 min" or "3 days". */
export function durationText(t: TFunction, mins: number): string {
  const total = Math.max(0, Math.round(mins))
  const d = Math.floor(total / 1440)
  const h = Math.floor((total % 1440) / 60)
  if (d) return t('notifications:duration.days', { count: d })
  if (h) return t('notifications:duration.hours', { h, m: total % 60 })
  return t('notifications:duration.mins', { count: total })
}

/** The sentence for a notification, with catalogue labels and ₹ amounts filled in. */
export function notificationText(t: TFunction, n: Pick<Notification, 'kind' | 'params'>): string {
  const p = n.params
  if (p.variant === 'reassignRequest' && typeof p.note === 'string' && p.note.trim()) return t('notifications:system.reassignRequestNote', { ...p, note: p.note.trim() })
  if (typeof p.variant === 'string' && p.variant) return t(`notifications:system.${p.variant}`, p)
  switch (n.kind) {
    case 'escalation':
      if (typeof p.mins === 'number') return t('notifications:text.escalation', { ...p, age: durationText(t, p.mins) })
      break
    case 'slaBreach':
      if (typeof p.count === 'number' && !p.name) return t('notifications:text.slaQueue', p)
      if (p.name) return t('notifications:text.slaNamed', p)
      break
    case 'stageChanged':
      if (typeof p.stage === 'string') return t('notifications:text.stageChanged', { ...p, stageLabel: t(`catalogue:stage.${p.stage}`) })
      break
    case 'propertyUnavailable':
      if (typeof p.status === 'string') return t('notifications:text.propertyUnavailable', { ...p, statusLabel: t(`catalogue:propertyStatus.${p.status}`) })
      break
    case 'booking':
      if (typeof p.amount === 'number' && p.amount > 0) return t('notifications:text.booking', { ...p, amount: inrShort(p.amount) })
      break
    case 'importFinished':
      if (typeof p.imported === 'number') return t('notifications:text.importFinished', p)
      break
    case 'reassignment':
      if (p.to) return t('notifications:text.reassignedAway', p)
      break
  }
  return t(`notifications:kind.${n.kind}`, p)
}
