import { NavLink, Outlet } from 'react-router'
import { Building, RotateCcw, Settings2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LanguageSwitch } from '@/components/language-switch'
import { useStore } from '@/store/db'
import type { Role } from '@/data/types'

/**
 * Temporary shell for the Properties module. The real navigation per role comes with the
 * information-architecture step; the demo menu lets reviewers switch roles and reset the data.
 */
export function AppShell() {
  const { t } = useTranslation()
  const { user, role, setRole, resetDemo } = useStore()
  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-30 h-14 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-full max-w-7xl items-center gap-3 px-4 md:px-6">
          <NavLink to="/properties" className="flex items-center gap-2 font-semibold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Building className="size-4" /></span>
            <span className="max-sm:hidden">{t('app.name')}</span>
          </NavLink>
          <nav className="ml-2 flex items-center gap-1 text-sm">
            <NavLink to="/properties" className={({ isActive }) => `rounded-md px-2.5 py-1.5 ${isActive ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
              {t('nav.properties')}
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitch />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5" aria-label={t('demo.menu')}>
                  <Settings2 /> <span className="max-sm:hidden">{t(`role.${role}`)}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t('demo.viewingAs', { name: user.name })}</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={role} onValueChange={(v) => setRole(v as Role)}>
                  {(['manager', 'executive', 'admin'] as Role[]).map((r) => (
                    <DropdownMenuRadioItem key={r} value={r}>{t(`role.${r}`)}</DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { resetDemo(); toast.success(t('demo.resetDone')) }}>
                  <RotateCcw /> {t('demo.reset')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
