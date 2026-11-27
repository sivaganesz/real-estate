/**
 * The app shell (DESIGN_SYSTEM §11.1): fixed sidebar (248 px, 64 px collapsed; icons only on tablets), a sticky
 * topbar, the page in a per-route error boundary and Suspense, the phone tab bar and the floating AI button.
 * The content cross-fades when the profile changes (keyed by user).
 */
import { Search } from 'lucide-react'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useNow } from '@/hooks/use-now'
import { useWholeDb } from '@/hooks/use-db'
import { cn } from '@/lib/utils'
import { navCounts } from '@/services/queries/lookups'
import { useSessionStore } from '@/store/session-store'
import { RouteErrorBoundary } from '../error-boundary'
import { findRoute, titleKeyOf } from '../routes'
import { AiLauncher } from './ai-launcher'
import { BottomTabs, MobileMenuButton, MobileNavSheet, MobileProfileButton } from './mobile-nav'
import { NotificationBell } from './notification-bell'
import { Sidebar } from './sidebar'
import { AskAiBar, Crumbs, LanguageToggle, ThemeToggle } from './topbar-controls'

function PageFallback() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="skeleton h-8 w-56" />
      <div className="skeleton h-4 w-80" />
      <div className="skeleton h-64 w-full rounded-lg" />
    </div>
  )
}

export function AppShell() {
  const { t } = useTranslation(['shell', 'common'])
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const user = useCurrentUser()
  const db = useWholeDb()
  const now = useNow()
  const counts = useMemo(() => navCounts(db, user, now), [db, user, now])
  const storedCollapsed = useSessionStore((s) => s.sidebarCollapsed)
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)')
  const collapsed = storedCollapsed || isTablet
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const setAiOpen = useSessionStore((s) => s.setAiPanelOpen)
  const aiOpen = useSessionStore((s) => s.aiPanelOpen)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Document title follows the page (registry title + product name).
  const found = findRoute(pathname)
  const pageTitle = found ? t(titleKeyOf(found.route, found.params)) : t('common:notFound.title')
  useEffect(() => {
    document.title = `${pageTitle} · ${t('common:appName')}`
  }, [pageTitle, t])

  return (
    <div className="min-h-dvh bg-background">
      <a href="#main" className="sr-only z-50 rounded-md bg-card px-3 py-2 shadow-lg focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        {t('shell:skipToContent')}
      </a>
      <Sidebar counts={counts} collapsed={collapsed} />
      <MobileNavSheet open={menuOpen} onOpenChange={setMenuOpen} counts={counts} />
      <div className={cn('flex min-h-dvh flex-col transition-[padding] duration-(--dur-slow) ease-in-out', collapsed ? 'md:pl-16' : 'md:pl-[248px]', aiOpen && 'min-[1920px]:pr-[440px]')}>
        <header
          data-testid="topbar"
          className={cn(
            'sticky top-0 z-20 flex h-[52px] items-center gap-2 bg-background/80 px-2 backdrop-blur md:h-14 md:gap-3 md:px-6 lg:px-8',
            'border-b transition-colors duration-(--dur-fast)',
            scrolled ? 'border-border' : 'border-transparent',
          )}
        >
          <MobileMenuButton onClick={() => setMenuOpen(true)} />
          <div className="min-w-0 flex-1 md:flex-none md:basis-1/4">
            <Crumbs />
          </div>
          <div className="hidden flex-1 justify-center md:flex">
            <AskAiBar />
          </div>
          <div className="flex items-center gap-0.5 md:gap-1">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setAiOpen(true)} aria-label={t('shell:topbar.search')}>
              <Search className="size-5" aria-hidden="true" />
            </Button>
            <NotificationBell />
            <div className="hidden items-center gap-0.5 md:flex">
              <ThemeToggle />
              <LanguageToggle />
            </div>
            <MobileProfileButton />
          </div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1600px] flex-1 px-4 pt-5 pb-28 outline-none md:px-6 md:pt-6 md:pb-10 lg:px-8">
          <div key={user.id} className="animate-in fade-in duration-200">
            <RouteErrorBoundary key={pathname} onGoHome={() => navigate('/today')}>
              <Suspense fallback={<PageFallback />}>
                <Outlet />
              </Suspense>
            </RouteErrorBoundary>
          </div>
          <div className="mt-10 flex items-center justify-center gap-2 md:hidden">
            <ThemeToggle />
            <LanguageToggle />
          </div>
        </main>
      </div>
      <BottomTabs counts={counts} onMore={() => setMenuOpen(true)} />
      <AiLauncher pageTitle={pageTitle} />
    </div>
  )
}
