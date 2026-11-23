/**
 * The navigation, in one place. Grouped by what people do, not by module (CTO review, 20 Nov):
 * Leads come before Properties, the System map is help and sits at the bottom, and each item shows only for the roles that use it.
 * `ready` marks sections already rebuilt in React; the rest open a "moving next" page until they are.
 */
import {
  Building, Building2, CalendarDays, ChartColumn, ClipboardList, LayoutDashboard, Map, Palette, Settings, ShieldCheck, SquareKanban, Target,
  Upload, Users, type LucideIcon,
} from 'lucide-react'
import type { Database, Role, User } from '@/data/types'

export type NavItem = {
  to: string
  labelKey: string
  icon: LucideIcon
  /** Roles that see it; all roles when omitted. */
  roles?: Role[]
  count?: (db: Database, user: User) => number
  ready?: boolean
}
export type NavGroup = { labelKey?: string; items: NavItem[] }

const MANAGERS: Role[] = ['admin', 'manager']
const activeLeads = (db: Database, user: User) =>
  db.leads.filter((l) => l.stage !== 'lost' && l.stage !== 'closed' && (user.role !== 'executive' || l.ownerId === user.id)).length

export const NAV: NavGroup[] = [
  { items: [{ to: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard }] },
  {
    labelKey: 'nav.group.sales',
    items: [
      { to: '/leads', labelKey: 'nav.leads', icon: Users, count: activeLeads },
      { to: '/pipeline', labelKey: 'nav.pipeline', icon: SquareKanban },
      { to: '/appointments', labelKey: 'nav.appointments', icon: CalendarDays },
      { to: '/matching', labelKey: 'nav.matching', icon: Target },
    ],
  },
  {
    labelKey: 'nav.group.inventory',
    items: [
      { to: '/properties', labelKey: 'nav.properties', icon: Building2, count: (db) => db.properties.filter((p) => p.status === 'available').length },
      { to: '/projects', labelKey: 'nav.projects', icon: Building },
      { to: '/import', labelKey: 'nav.import', icon: Upload, roles: MANAGERS },
    ],
  },
  {
    labelKey: 'nav.group.insights',
    items: [
      { to: '/reports', labelKey: 'nav.reports', icon: ChartColumn, roles: MANAGERS },
      { to: '/hni', labelKey: 'nav.hni', icon: ShieldCheck, roles: MANAGERS },
    ],
  },
]

export const NAV_FOOTER: NavItem[] = [
  { to: '/enquiry', labelKey: 'nav.enquiry', icon: ClipboardList },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings, roles: MANAGERS },
  { to: '/system-map', labelKey: 'nav.systemMap', icon: Map },
  /* temporary, for review of the theme and components while the rebuild is under way */
  { to: '/ui-kit', labelKey: 'nav.uiKit', icon: Palette, ready: true },
]

export const visibleFor = (role: Role) => (i: NavItem) => !i.roles || i.roles.includes(role)

/** Every nav item, for routing placeholder pages. */
export const ALL_NAV_ITEMS: NavItem[] = [...NAV.flatMap((g) => g.items), ...NAV_FOOTER]
