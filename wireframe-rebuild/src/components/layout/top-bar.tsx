import { Fragment, useState } from 'react'
import { Link } from 'react-router'
import { Menu, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useStore } from '@/store/db'
import type { Role } from '@/data/types'
import { DEMO_TODAY } from '@/data/seed'
import { fmtDate } from '@/lib/format'
import { useCrumbsValue } from './crumbs'
import { Brand, SidebarNav } from './sidebar'

const ROLES: Role[] = ['admin', 'manager', 'executive']

/**
 * The top bar, as in spec-system-wireframe: breadcrumbs on the left; 📝 Public enquiry, ＋ Lead, ＋ Property and
 * "Viewing as" on the right, then "Reset demo data" (it was in the dark WIREFRAME ribbon, removed 26 Nov).
 * (Added for the rebuild: the menu button on phone and tablet. Theme and language are in Settings.)
 */
export function TopBar() {
  const { t, i18n } = useTranslation()
  const { role, setRole, resetDemo } = useStore()
  const crumbs = useCrumbsValue()
  const [menuOpen, setMenuOpen] = useState(false)
  const resetHint = t('demo.resetHint', { date: fmtDate(DEMO_TODAY, i18n.language) })
  const reset = () => { resetDemo(); toast.success(t('demo.resetDone')) }

  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b bg-card px-4 py-2.5 md:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t('shell.openMenu')} onClick={() => setMenuOpen(true)}><Menu /></Button>
      <nav aria-label="Breadcrumb" className="min-w-0 text-ui text-muted-foreground">
        {crumbs.map((c, i) => (
          <Fragment key={i}>
            {i > 0 && ' / '}
            {i === crumbs.length - 1 ? <b className="text-foreground">{c.label}</b>
              : c.to ? <Link to={c.to} className="text-primary hover:underline">{c.label}</Link> : c.label}
          </Fragment>
        ))}
      </nav>
      <span className="flex-1" />
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm" className="max-md:hidden"><Link to="/enquiry">📝 {t('shell.publicEnquiry')}</Link></Button>
        <Button asChild variant="outline" size="sm"><Link to="/leads">＋ {t('shell.lead')}</Link></Button>
        <Button asChild variant="outline" size="sm"><Link to="/properties/new">＋ {t('shell.property')}</Link></Button>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="max-sm:hidden">{t('shell.viewingAs')}</span>
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger size="sm" className="w-auto bg-card text-foreground" aria-label={t('shell.viewingAs')}><SelectValue /></SelectTrigger>
            <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{t(`role.${r}`)}</SelectItem>)}</SelectContent>
          </Select>
        </label>
        {/* the demo's sample data back as it was (the hint says what the demo is and its date); on a phone it's in the ☰ menu */}
        <Button variant="outline" size="sm" className="max-sm:hidden" title={resetHint} onClick={reset}><RotateCcw /> {t('demo.reset')}</Button>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 bg-card p-0">
          <SheetHeader className="border-b px-4 py-3"><SheetTitle asChild><div><Brand /></div></SheetTitle></SheetHeader>
          <div className="side-scroll min-h-0 flex-1 overflow-y-auto px-2.5 pb-4"><SidebarNav onNavigate={() => setMenuOpen(false)} /></div>
          <div className="border-t p-3 sm:hidden">
            <Button variant="outline" size="sm" className="w-full" onClick={() => { reset(); setMenuOpen(false) }}><RotateCcw /> {t('demo.reset')}</Button>
            <p className="mt-1.5 text-meta text-muted-foreground">{resetHint}</p>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
