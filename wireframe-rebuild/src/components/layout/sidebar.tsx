import { NavLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useStore } from '@/store/db'
import { NAV, type NavItem } from './nav'

/** The brand block, as in spec-system-wireframe: "RE" logo, RealSpec CRM, Property + Customer specs. */
export function Brand({ compact }: { compact?: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-[30px] shrink-0 place-items-center rounded-lg bg-primary text-[13px] font-bold text-primary-foreground">RE</span>
      <span className={cn('leading-tight', compact && 'max-sm:hidden')}>
        <span className="block font-bold">{t('app.name')}</span>
        {!compact && <span className="block text-[11px] font-normal text-muted-foreground">{t('app.tagline')}</span>}
      </span>
    </div>
  )
}

function Item({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const { t } = useTranslation()
  const { db, user, role } = useStore()
  const locked = item.lockedFor?.includes(role)
  return (
    <NavLink to={item.to} onClick={onNavigate}
      className={({ isActive }) => cn(
        'flex items-center gap-[9px] rounded-lg px-2.5 py-[7px] text-sm font-medium',
        isActive ? 'bg-accent text-primary' : 'text-secondary-foreground hover:bg-muted',
      )}>
      <span className="w-[18px] text-center opacity-80" aria-hidden>{item.icon}</span>
      <span className="truncate">{t(item.labelKey)}</span>
      {locked ? <span className="ml-auto text-[11px]" aria-label={t('nav.restricted')}>🔒</span>
        : item.count && <span className="ml-auto rounded-[10px] bg-muted px-[7px] text-[11px] text-muted-foreground tabular-nums">{item.count(db, user)}</span>}
    </NavLink>
  )
}

/** The navigation list, in the sidebar and in the phone drawer. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('nav.label')} className="flex flex-col">
      {NAV.map((g) => (
        <div key={g.labelKey}>
          <p className="px-2.5 pt-3 pb-1 text-[11px] tracking-[.06em] text-muted-foreground uppercase">{t(g.labelKey)}</p>
          {g.items.map((it) => <Item key={it.to} item={it} onNavigate={onNavigate} />)}
        </div>
      ))}
    </nav>
  )
}

/** Desktop sidebar (lg and up): 236 px, white, sticky. */
export function Sidebar() {
  return (
    <aside className="hidden w-[236px] shrink-0 border-r bg-card lg:block">
      <div className="sticky top-0 h-[calc(100svh-30px)] overflow-y-auto px-2.5 py-3.5">
        <div className="px-2 pt-1 pb-3.5"><Brand /></div>
        <SidebarNav />
      </div>
    </aside>
  )
}
