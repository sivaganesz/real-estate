import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Building2, Menu, Plus, RotateCcw, Upload, UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { UserAvatar } from '@/components/app/user-avatar'
import { LanguageSwitch } from '@/components/language-switch'
import { useCan, useStore } from '@/store/db'
import type { Role } from '@/data/types'
import { Brand, SidebarNav } from './sidebar'

/**
 * The top bar: menu (phone and tablet), quick "＋ New", language, and the account menu.
 * The account menu also holds the demo controls: switch role, reset the data.
 */
export function TopBar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, role, setRole, resetDemo } = useStore()
  const can = useCan()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card/95 px-3 backdrop-blur md:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t('shell.openMenu')} onClick={() => setMenuOpen(true)}><Menu /></Button>
      <div className="lg:hidden"><Brand compact /></div>

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-1"><Plus /> <span className="max-sm:hidden">{t('shell.new')}</span></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => navigate('/leads')}><UserPlus /> {t('shell.newLead')}</DropdownMenuItem>
            {can('property.manage') && (
              <>
                <DropdownMenuItem onClick={() => navigate('/properties/new')}><Building2 /> {t('shell.newProperty')}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/import')}><Upload /> {t('shell.bulkImport')}</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <LanguageSwitch />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={t('shell.account')} className="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-muted">
              <UserAvatar name={user.name} size="sm" />
              <span className="text-left leading-tight max-md:hidden">
                <span className="block text-sm font-medium">{user.name}</span>
                <span className="block text-[11px] text-muted-foreground">{t(`role.${role}`)}</span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t('demo.switchRole')}</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={role} onValueChange={(v) => setRole(v as Role)}>
              {(['manager', 'executive', 'admin'] as Role[]).map((r) => (
                <DropdownMenuRadioItem key={r} value={r}>{t(`role.${r}`)}</DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { resetDemo(); toast.success(t('demo.resetDone')) }}><RotateCcw /> {t('demo.reset')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0">
          <SheetHeader className="border-b px-4 py-3"><SheetTitle asChild><div><Brand /></div></SheetTitle></SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4"><SidebarNav onNavigate={() => setMenuOpen(false)} /></div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
