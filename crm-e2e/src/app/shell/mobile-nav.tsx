/**
 * Phone navigation (DESIGN_SYSTEM §11.1, §14): a bottom tab bar with the role's four main items plus More, and the
 * full sidebar as a sheet (opened from the hamburger or More). The topbar avatar opens the profile picker as a sheet.
 */
import { ChevronsUpDown, Menu } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useCurrentUser } from '@/hooks/use-current-user'
import { cn } from '@/lib/utils'
import type { NavCounts } from '@/services/queries/lookups'
import { badgeIsAlarm, badgeValue, bottomTabsFor } from '../nav'
import { ProfilePicker } from './profile-switcher'
import { LogoMark, NavList } from './sidebar'

/** The profile area at the foot of the phone menu: a compact row that expands to the picker (state resets on close). */
function SheetProfileFooter({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation(['shell', 'common'])
  const user = useCurrentUser()
  const [pickerOpen, setPickerOpen] = useState(false)
  if (pickerOpen) return <ProfilePicker onDone={onDone} />
  return (
    <button
      type="button"
      onClick={() => setPickerOpen(true)}
      aria-expanded={false}
      className="flex w-full items-center gap-2.5 rounded-lg border bg-card p-2 text-left shadow-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <UserAvatar name={user.name} size="sm" role={user.role} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{user.name}</span>
        <span className="block truncate text-meta text-muted-foreground">{t(`common:roles.${user.role}`)}</span>
      </span>
      <ChevronsUpDown className="size-4 text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">{t('shell:profile.label')}</span>
    </button>
  )
}

export function MobileNavSheet({ open, onOpenChange, counts }: { open: boolean; onOpenChange: (o: boolean) => void; counts: NavCounts }) {
  const { t } = useTranslation(['shell', 'common'])
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[288px] gap-0 bg-sidebar p-0" data-testid="mobile-nav">
        <SheetHeader className="flex-row items-center gap-2.5 border-b border-sidebar-border px-4 py-3">
          <LogoMark />
          <SheetTitle className="text-base font-semibold">{t('common:appName')}</SheetTitle>
          <SheetDescription className="sr-only">{t('shell:sidebar.mainNav')}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavList counts={counts} onNavigate={() => onOpenChange(false)} />
        </div>
        <div className="max-h-[60dvh] overflow-y-auto border-t border-sidebar-border p-3">
          <SheetProfileFooter onDone={() => onOpenChange(false)} />
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation('shell')
  return (
    <Button variant="ghost" size="icon" className="md:hidden" onClick={onClick} aria-label={t('sidebar.openMenu')} data-testid="open-menu">
      <Menu className="size-5" aria-hidden="true" />
    </Button>
  )
}

export function MobileProfileButton() {
  const { t } = useTranslation(['shell', 'common'])
  const user = useCurrentUser()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:hidden" aria-label={t('shell:profile.label')} data-testid="mobile-profile">
        <UserAvatar name={user.name} size="sm" role={user.role} />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-xl px-3 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader className="px-2 py-0">
            <SheetTitle>{t('shell:profile.label')}</SheetTitle>
            <SheetDescription>{t('shell:profile.viewingAs')} {user.name} · {t(`common:roles.${user.role}`)}</SheetDescription>
          </SheetHeader>
          <ProfilePicker onDone={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  )
}

export function BottomTabs({ counts, onMore }: { counts: NavCounts; onMore: () => void }) {
  const { t } = useTranslation('shell')
  const user = useCurrentUser()
  const tabs = bottomTabsFor(user)
  return (
    <nav
      data-testid="bottom-tabs"
      aria-label={t('sidebar.mainNav')}
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {tabs.map((item) => {
          const value = badgeValue(counts, item.badge)
          return (
            <li key={item.key}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn('relative flex h-14 flex-col items-center justify-center gap-0.5 text-micro font-medium', isActive ? 'text-primary' : 'text-muted-foreground')
                }
              >
                <item.icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                <span className="max-w-full truncate px-1">{t(item.labelKey)}</span>
                {value > 0 && (
                  <span className={cn('absolute top-1.5 left-1/2 ml-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-micro tabular-nums', badgeIsAlarm(item.badge) ? 'bg-danger text-danger-foreground' : 'bg-primary text-primary-foreground')}>
                    {value}
                  </span>
                )}
              </NavLink>
            </li>
          )
        })}
        <li className={cn(tabs.length < 4 && 'col-start-5')}>
          <button type="button" onClick={onMore} className="flex h-14 w-full flex-col items-center justify-center gap-0.5 text-micro font-medium text-muted-foreground" data-testid="tab-more">
            <Menu className="size-5" strokeWidth={1.75} aria-hidden="true" />
            <span>{t('nav.more')}</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
