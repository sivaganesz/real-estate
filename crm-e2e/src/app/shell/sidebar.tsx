/**
 * Sidebar (DESIGN_SYSTEM §11.1): logo, permission-filtered groups with live count badges, collapse to 64 px icons
 * (with tooltips), and the profile switcher at the bottom. `NavList` is reused by the phone sheet.
 */
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useCurrentUser } from '@/hooks/use-current-user'
import { cn } from '@/lib/utils'
import type { NavCounts } from '@/services/queries/lookups'
import { useSessionStore } from '@/store/session-store'
import { badgeIsAlarm, badgeValue, navFor, type NavItem } from '../nav'
import { ProfileSwitcher } from './profile-switcher'

export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-xs', className)} aria-hidden="true">
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 11.5 12 5l8 6.5" />
        <path d="M7 10v8.5h10V10" />
        <path d="M10.5 18.5v-4h3v4" />
      </svg>
    </span>
  )
}

function CountBadge({ value, alarm, label }: { value: number; alarm: boolean; label: string }) {
  if (!value) return null
  return (
    <span
      title={label}
      className={cn(
        'ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-micro font-semibold tabular-nums',
        alarm ? 'bg-danger-soft text-danger' : 'bg-primary-soft text-primary',
      )}
    >
      {value}
      <span className="sr-only"> {label}</span>
    </span>
  )
}

function NavEntry({ item, counts, collapsed, onNavigate }: { item: NavItem; counts: NavCounts; collapsed: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation('shell')
  const value = badgeValue(counts, item.badge)
  const badgeLabel = item.badge === 'unassigned' ? t('badges.unassigned', { count: value }) : item.badge === 'overdueTasks' ? t('badges.overdue', { count: value }) : t('badges.today', { count: value })
  const link = (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      data-testid={`nav-${item.key}`}
      className={({ isActive }) =>
        cn(
          'group relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-sidebar-foreground transition-colors duration-(--dur-fast)',
          'hover:bg-sidebar-accent/60 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
          collapsed && 'justify-center px-0',
          isActive && 'bg-sidebar-accent text-sidebar-accent-foreground shadow-xs',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r-full bg-primary" aria-hidden="true" />}
          <item.icon className={cn('size-[18px] shrink-0', isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} strokeWidth={1.75} aria-hidden="true" />
          {collapsed ? (
            <>
              <span className="sr-only">{t(item.labelKey)}</span>
              {value > 0 && <span className={cn('absolute top-1.5 right-1.5 size-2 rounded-full', badgeIsAlarm(item.badge) ? 'bg-danger' : 'bg-primary')} aria-hidden="true" />}
            </>
          ) : (
            <>
              <span className="min-w-0 truncate">{t(item.labelKey)}</span>
              <CountBadge value={value} alarm={badgeIsAlarm(item.badge)} label={badgeLabel} />
            </>
          )}
        </>
      )}
    </NavLink>
  )
  if (!collapsed) return link
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">
        {t(item.labelKey)}
        {value > 0 && <span className="tabular-nums"> · {value}</span>}
      </TooltipContent>
    </Tooltip>
  )
}

export function NavList({ counts, collapsed = false, onNavigate }: { counts: NavCounts; collapsed?: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation('shell')
  const user = useCurrentUser()
  return (
    <nav aria-label={t('sidebar.mainNav')} className="flex flex-col gap-5">
      {navFor(user).map(({ group, items }) => (
        <div key={group} className="flex flex-col gap-0.5">
          {collapsed ? (
            <span className="mx-auto mb-1 h-px w-6 bg-sidebar-border" aria-hidden="true" />
          ) : (
            <div className="mb-1 px-2.5 text-caption font-medium tracking-[0.06em] text-subtle-foreground uppercase [:lang(ta)_&]:tracking-normal">{t(`groups.${group}`)}</div>
          )}
          {items.map((item) => (
            <NavEntry key={item.key} item={item} counts={counts} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </nav>
  )
}

export function Sidebar({ counts, collapsed }: { counts: NavCounts; collapsed: boolean }) {
  const { t } = useTranslation(['shell', 'common'])
  const setCollapsed = useSessionStore((s) => s.setSidebarCollapsed)
  return (
    <aside
      data-testid="sidebar"
      className={cn(
        'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-(--dur-slow) ease-in-out md:flex',
        collapsed ? 'w-16' : 'w-[248px]',
      )}
    >
      <div className={cn('flex h-14 items-center gap-2.5 px-4', collapsed && 'justify-center px-0')}>
        <LogoMark />
        {!collapsed && <span className="truncate text-base font-semibold text-foreground">{t('common:appName')}</span>}
      </div>
      <div className={cn('flex-1 overflow-y-auto pb-4', collapsed ? 'px-2' : 'px-3')}>
        <NavList counts={counts} collapsed={collapsed} />
      </div>
      <div className={cn('flex flex-col gap-2 border-t border-sidebar-border', collapsed ? 'p-2' : 'p-3')}>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'hidden h-8 items-center gap-2 rounded-md px-2.5 text-ui text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none lg:flex',
            collapsed && 'justify-center px-0',
          )}
          aria-label={collapsed ? t('shell:sidebar.expand') : t('shell:sidebar.collapse')}
        >
          {collapsed ? <PanelLeftOpen className="size-4" aria-hidden="true" /> : <PanelLeftClose className="size-4" aria-hidden="true" />}
          {!collapsed && <span>{t('shell:sidebar.collapse')}</span>}
        </button>
        <ProfileSwitcher collapsed={collapsed} />
      </div>
    </aside>
  )
}
