/**
 * Navigation (DESIGN_SYSTEM §11.1): groups Work, Sales, Inventory, Insights, Admin. Items are filtered by permission
 * and empty groups hide. Fixed lucide icons per DESIGN_SYSTEM §8.
 */
import {
  Bell, Building2, CalendarDays, ChartColumn, Contact, History, ListChecks, Settings, SquareKanban, Sun, Target, Upload,
  Users, UsersRound, type LucideIcon,
} from 'lucide-react'
import type { User } from '@/domain/types'
import { can, type Action } from '@/lib/permissions'
import type { NavCounts } from '@/services/queries/lookups'

export type NavGroupKey = 'work' | 'sales' | 'inventory' | 'insights' | 'admin'
export type BadgeKind = 'unassigned' | 'overdueTasks' | 'todayAppointments'

export interface NavItem {
  key: string
  to: string
  icon: LucideIcon
  labelKey: string
  permission: Action | 'any'
  group: NavGroupKey
  badge?: BadgeKind
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'today', to: '/today', icon: Sun, labelKey: 'shell:nav.today', permission: 'any', group: 'work' },
  { key: 'tasks', to: '/tasks', icon: ListChecks, labelKey: 'shell:nav.tasks', permission: 'task.view', group: 'work', badge: 'overdueTasks' },
  { key: 'appointments', to: '/appointments', icon: CalendarDays, labelKey: 'shell:nav.appointments', permission: 'appointment.view', group: 'work', badge: 'todayAppointments' },
  { key: 'leads', to: '/leads', icon: Users, labelKey: 'shell:nav.leads', permission: 'lead.view', group: 'sales', badge: 'unassigned' },
  { key: 'pipeline', to: '/pipeline', icon: SquareKanban, labelKey: 'shell:nav.pipeline', permission: 'lead.view', group: 'sales' },
  { key: 'clients', to: '/clients', icon: Contact, labelKey: 'shell:nav.clients', permission: 'client.view', group: 'sales' },
  { key: 'matching', to: '/matching', icon: Target, labelKey: 'shell:nav.matching', permission: 'matching.run', group: 'sales' },
  { key: 'properties', to: '/properties', icon: Building2, labelKey: 'shell:nav.properties', permission: 'property.view', group: 'inventory' },
  { key: 'import', to: '/import', icon: Upload, labelKey: 'shell:nav.import', permission: 'import.document', group: 'inventory' },
  { key: 'reports', to: '/reports', icon: ChartColumn, labelKey: 'shell:nav.reports', permission: 'report.view', group: 'insights' },
  { key: 'activity', to: '/activity', icon: History, labelKey: 'shell:nav.activity', permission: 'activity.viewLog', group: 'insights' },
  { key: 'team', to: '/team', icon: UsersRound, labelKey: 'shell:nav.team', permission: 'team.view', group: 'admin' },
  { key: 'settings', to: '/settings', icon: Settings, labelKey: 'shell:nav.settings', permission: 'settings.preferences', group: 'admin' },
]

/** Reached from the bell and the More sheet, not from the sidebar. */
export const NOTIFICATIONS_ITEM: NavItem = { key: 'notifications', to: '/notifications', icon: Bell, labelKey: 'shell:nav.notifications', permission: 'any', group: 'work' }

export const NAV_GROUPS: NavGroupKey[] = ['work', 'sales', 'inventory', 'insights', 'admin']

export const allowed = (user: User, permission: Action | 'any') => permission === 'any' || can(user, permission)

export function navFor(user: User): { group: NavGroupKey; items: NavItem[] }[] {
  return NAV_GROUPS.map((group) => ({ group, items: NAV_ITEMS.filter((i) => i.group === group && allowed(user, i.permission)) })).filter(
    (g) => g.items.length > 0,
  )
}

/** Phone tabs per role (DESIGN_SYSTEM §11.1): Today, Leads, Calendar, Pipeline (team leads) or Properties, then More. */
export function bottomTabsFor(user: User): NavItem[] {
  const pick = (key: string) => NAV_ITEMS.find((i) => i.key === key)!
  const fourth = allowed(user, 'team.view') ? pick('pipeline') : pick('properties')
  const calendar = { ...pick('appointments'), labelKey: 'shell:nav.calendar' }
  return [pick('today'), pick('leads'), calendar, fourth].filter((i) => allowed(user, i.permission))
}

export const badgeValue = (counts: NavCounts, kind: BadgeKind | undefined): number =>
  kind === 'unassigned' ? counts.unassigned : kind === 'overdueTasks' ? counts.overdueTasks : kind === 'todayAppointments' ? counts.todayAppointments : 0

/** Overdue and unassigned are alarms (danger); today's appointments are information (primary). */
export const badgeIsAlarm = (kind: BadgeKind | undefined) => kind === 'overdueTasks' || kind === 'unassigned'
