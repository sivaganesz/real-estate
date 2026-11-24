import { Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { DEMO_TODAY } from '@/data/seed'
import { fmtDate } from '@/lib/format'
import { useStore } from '@/store/db'
import { CrumbsProvider } from './crumbs'
import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'

/** The dark "WIREFRAME" ribbon across the top, as in spec-system-wireframe. */
function Ribbon() {
  const { t, i18n } = useTranslation()
  const { resetDemo } = useStore()
  return (
    <div className="sticky top-0 z-40 flex min-h-[30px] flex-wrap items-center gap-3.5 bg-ribbon px-4 py-[5px] text-xs text-ribbon-foreground">
      <b className="text-ribbon-strong">{t('shell.wireframe')}</b>
      <span className="max-md:hidden">{t('shell.ribbon')}</span>
      <span className="flex-1" />
      <span>{t('shell.demoDate', { date: fmtDate(DEMO_TODAY, i18n.language) })}</span>
      <button type="button" onClick={() => { resetDemo(); toast.success(t('demo.resetDone')) }}
        className="rounded-md border border-ribbon-border px-2 py-px text-xs hover:border-ribbon-border-hover hover:text-ribbon-strong">{t('demo.reset')}</button>
    </div>
  )
}

/** Ribbon, then sidebar + (top bar and page), as in the current wireframe. */
export function AppShell() {
  return (
    <CrumbsProvider>
      <Ribbon />
      <div className="flex min-h-[calc(100svh-30px)] bg-background">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="flex-1"><Outlet /></main>
        </div>
      </div>
    </CrumbsProvider>
  )
}
