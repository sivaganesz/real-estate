import { useState } from 'react'
import { NavLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useStore } from '@/store/db'
import { NAV, type NavItem } from './nav'

/** The "RE" logo square. */
function Logo() {
  return <span className="grid size-[1.875rem] shrink-0 place-items-center rounded-lg bg-primary text-ui font-bold text-primary-foreground">RE</span>
}

/** The brand block: "RE" logo and RealSpec CRM. */
export function Brand() {
  const { t } = useTranslation()
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Logo />
      <span className="truncate leading-tight font-bold">{t('app.name')}</span>
    </div>
  )
}

function Item({ item, collapsed, onNavigate }: { item: NavItem; collapsed?: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation()
  const { db, user, role } = useStore()
  const locked = item.lockedFor?.includes(role)
  const label = t(item.labelKey)
  const count = !locked && item.count ? item.count(db, user) : undefined
  const link = (
    <NavLink to={item.to} onClick={onNavigate} aria-label={collapsed ? label : undefined}
      className={({ isActive }) => cn(
        'flex items-center rounded-lg py-[0.4375rem] text-sm font-medium',
        collapsed ? 'justify-center px-0' : 'gap-[0.5625rem] px-2.5',
        isActive ? 'bg-accent text-primary' : 'text-secondary-foreground hover:bg-muted',
      )}>
      <span className="w-[1.125rem] text-center opacity-80" aria-hidden>{item.icon}</span>
      {!collapsed && <>
        <span className="truncate">{label}</span>
        {locked ? <span className="ml-auto text-caption" aria-label={t('nav.restricted')}>🔒</span>
          : count !== undefined && <span className="ml-auto rounded-[0.625rem] bg-muted px-[0.4375rem] text-caption text-muted-foreground tabular-nums">{count}</span>}
      </>}
    </NavLink>
  )
  if (!collapsed) return link
  // Collapsed: the icon alone, with its name (and count, or the lock) in a tooltip on hover or keyboard focus.
  return (
    <Tooltip>
      <TooltipTrigger asChild><span className="block">{link}</span></TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {label}
        {locked ? <span aria-label={t('nav.restricted')}>🔒</span> : count !== undefined && <span className="opacity-70 tabular-nums">· {count}</span>}
      </TooltipContent>
    </Tooltip>
  )
}

/** The navigation list, in the sidebar and in the phone drawer. Collapsed, it shows icons only, with a thin line between groups. */
export function SidebarNav({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('nav.label')} className={cn('flex flex-col', collapsed && 'gap-0.5')}>
      {NAV.map((g, i) => (
        <div key={g.labelKey} className={cn(collapsed && 'flex flex-col gap-0.5')}>
          {collapsed
            ? i > 0 && <hr className="mx-2 my-2 border-border" aria-hidden />
            : <p className="px-2.5 pt-3 pb-1 text-caption tracking-[.06em] text-muted-foreground uppercase">{t(g.labelKey)}</p>}
          {g.items.map((it) => <Item key={it.to} item={it} collapsed={collapsed} onNavigate={onNavigate} />)}
        </div>
      ))}
    </nav>
  )
}

const COLLAPSED_KEY = 'realspec-rebuild-sidebar'
function readCollapsed() {
  try { return localStorage.getItem(COLLAPSED_KEY) === 'collapsed' } catch { return false }
}
function saveCollapsed(collapsed: boolean) {
  try { localStorage.setItem(COLLAPSED_KEY, collapsed ? 'collapsed' : 'expanded') } catch { /* storage blocked: the choice lasts until reload */ }
}

/**
 * Desktop sidebar (lg and up): 236 px, white, pinned under the ribbon; it scrolls on its own and never moves with the page.
 * A ‹ button after "RealSpec CRM" collapses it to 64 px (logo and icons). Collapsed, hovering the logo turns it
 * into a › button that expands it again. The choice is remembered in this browser.
 */
export function Sidebar() {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const toggle = (next: boolean) => { setCollapsed(next); saveCollapsed(next) }
  return (
    <aside className={cn('hidden shrink-0 border-r bg-card transition-[width] duration-200 motion-reduce:transition-none lg:block',
      collapsed ? 'w-16' : 'w-[14.75rem]')}>
      <div className="sticky top-0 z-30 h-svh">
        <div className="side-scroll h-full overflow-x-hidden overflow-y-auto overscroll-contain px-2.5 py-3.5">
          {collapsed ? (
            <div className="flex justify-center pt-1 pb-3.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" onClick={() => toggle(false)} aria-label={t('nav.expand')}
                    className="group relative grid size-[1.875rem] place-items-center rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                    <span className="transition-opacity group-hover:opacity-0 group-focus-visible:opacity-0"><Logo /></span>
                    <span className="absolute inset-0 grid place-items-center rounded-lg border bg-card text-primary opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      <ChevronRight className="size-4" aria-hidden />
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>{t('nav.expand')}</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <div className="flex items-center gap-2 pt-1 pb-3.5 pl-2">
              <Brand />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" onClick={() => toggle(true)} aria-label={t('nav.collapse')}
                    className="ml-auto grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                    <ChevronLeft className="size-4" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>{t('nav.collapse')}</TooltipContent>
              </Tooltip>
            </div>
          )}
          <SidebarNav collapsed={collapsed} />
        </div>
      </div>
    </aside>
  )
}
