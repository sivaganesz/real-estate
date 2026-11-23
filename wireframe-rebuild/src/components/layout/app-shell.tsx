import { Outlet } from 'react-router'
import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'

/** Sidebar on desktop; top bar with a drawer menu on phone and tablet. Pages render in the outlet. */
export function AppShell() {
  return (
    <div className="flex min-h-svh bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1"><Outlet /></main>
      </div>
    </div>
  )
}
