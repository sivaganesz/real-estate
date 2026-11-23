import { NavLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useStore } from '@/store/db'
import { NAV, NAV_FOOTER, type NavItem, visibleFor } from './nav'

/** The brand mark, shared by the sidebar and the phone top bar. */
export function Brand({ compact }: { compact?: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-[13px] font-bold text-primary-foreground">RE</span>
      <span className={cn('leading-tight', compact && 'max-sm:hidden')}>
        <span className="block font-semibold">{t('app.name')}</span>
        {!compact && <span className="block text-[11px] text-muted-foreground">{t('app.tagline')}</span>}
      </span>
    </div>
  )
}

function Item({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const { t } = useTranslation()
  const { db, user } = useStore()
  const Icon = item.icon
  const count = item.count?.(db, user)
  return (
    <NavLink to={item.to} onClick={onNavigate}
      className={({ isActive }) => cn(
        'group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors',
        isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-muted',
      )}>
      <Icon className="size-4 shrink-0 opacity-80" />
      <span className="truncate">{t(item.labelKey)}</span>
      {/* not rebuilt yet: a quiet dot (fits any language), named for screen readers */}
      {!item.ready && (
        <>
          <span className="ml-auto size-1.5 shrink-0 rounded-full bg-muted-foreground/40" title={t('nav.soon')} aria-hidden />
          <span className="sr-only">({t('nav.soon')})</span>
        </>
      )}
      {item.ready && count != null && (
        <span className="ml-auto rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground tabular-nums group-aria-[current=page]:bg-card">{count}</span>
      )}
    </NavLink>
  )
}

/** The navigation list. Used in the desktop sidebar and in the phone drawer. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const { role } = useStore()
  const show = visibleFor(role)
  return (
    <div className="flex h-full flex-col">
      <nav aria-label={t('nav.label')} className="flex flex-1 flex-col gap-4">
        {NAV.map((g, i) => {
          const items = g.items.filter(show)
          if (!items.length) return null
          return (
            <div key={i} className="flex flex-col gap-0.5">
              {g.labelKey && <p className="px-2.5 pb-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">{t(g.labelKey)}</p>}
              {items.map((it) => <Item key={it.to} item={it} onNavigate={onNavigate} />)}
            </div>
          )
        })}
      </nav>
      <div className="mt-4 flex flex-col gap-0.5 border-t pt-3">
        {NAV_FOOTER.filter(show).map((it) => <Item key={it.to} item={it} onNavigate={onNavigate} />)}
      </div>
    </div>
  )
}

/** Desktop sidebar (lg and up). */
export function Sidebar() {
  const { t } = useTranslation()
  return (
    // the outer column carries the background the full height of the page; the inner part stays in view while scrolling
    <aside className="hidden w-60 shrink-0 border-r bg-sidebar lg:block">
      <div className="sticky top-0 flex h-svh flex-col px-3 py-4">
        <div className="px-1.5 pb-5"><Brand /></div>
        <div className="min-h-0 flex-1 overflow-y-auto"><SidebarNav /></div>
        <p className="mt-3 rounded-lg bg-muted px-2.5 py-2 text-[11px] leading-snug text-muted-foreground">{t('shell.wireframeNote')}</p>
      </div>
    </aside>
  )
}
