/**
 * The navigation — exactly as spec-system-wireframe (app.js NAV): the same groups, order, names, emoji icons and counts.
 * Sections not rebuilt in React yet open a placeholder page (`ready` marks the rebuilt ones).
 */
import type { Database, Role, User } from '@/data/types'
import { DEMO_TODAY } from '@/data/seed'

export type NavItem = {
  to: string
  labelKey: string
  /** The emoji icon the current wireframe uses. */
  icon: string
  count?: (db: Database, user: User) => number
  /** Shown with a 🔒 to these roles (HNI is restricted). */
  lockedFor?: Role[]
  ready?: boolean
}
export type NavGroup = { labelKey: string; items: NavItem[] }

const activeLeads = (db: Database) => db.leads.filter((l) => l.stage !== 'lost' && l.stage !== 'closed').length
const visitsToday = (db: Database) => db.leads.reduce((n, l) => n + l.visits.filter((v) => v.date === DEMO_TODAY && v.status === 'scheduled').length, 0)

export const NAV: NavGroup[] = [
  { labelKey: 'nav.group.overview', items: [{ to: '/dashboard', labelKey: 'nav.salesDashboard', icon: '📊' }] },
  {
    labelKey: 'nav.group.specData',
    items: [
      { to: '/properties', labelKey: 'nav.properties', icon: '🏠', ready: true, count: (db) => db.properties.filter((p) => p.status === 'available' && !p.archived).length },
      { to: '/projects', labelKey: 'nav.projects', icon: '🏢', count: () => 0 },
      { to: '/leads', labelKey: 'nav.leads', icon: '👤', count: activeLeads },
      { to: '/import', labelKey: 'nav.import', icon: '📥' },
    ],
  },
  {
    labelKey: 'nav.group.salesQual',
    items: [
      { to: '/pipeline', labelKey: 'nav.leadPipeline', icon: '🗂️' },
      { to: '/appointments', labelKey: 'nav.appointments', icon: '📅', count: visitsToday },
      { to: '/matching', labelKey: 'nav.matchingEngine', icon: '🎯' },
      { to: '/hni', labelKey: 'nav.hniQual', icon: '🛡️', lockedFor: ['executive'] },
      { to: '/reports', labelKey: 'nav.reports', icon: '📈' },
    ],
  },
  {
    labelKey: 'nav.group.tools',
    items: [
      { to: '/enquiry', labelKey: 'nav.enquiry', icon: '📝' },
      { to: '/test', labelKey: 'nav.testScenario', icon: '🧪' },
      { to: '/settings', labelKey: 'nav.settingsRules', icon: '⚙️' },
      { to: '/system-map', labelKey: 'nav.systemMap', icon: '🧭' },
    ],
  },
]

/** Every nav item, for routing placeholder pages. */
export const ALL_NAV_ITEMS: NavItem[] = NAV.flatMap((g) => g.items)
