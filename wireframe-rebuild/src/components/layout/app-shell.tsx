import { Outlet } from 'react-router'
import { CrumbsProvider } from './crumbs'
import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'

/** Sidebar + (top bar and page). The demo's "Reset demo data" is in the top bar, after "Viewing as". */
export function AppShell() {
  return (
    <CrumbsProvider>
      <div className="flex min-h-svh bg-background">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="flex-1"><Outlet /></main>
        </div>
      </div>
    </CrumbsProvider>
  )
}
