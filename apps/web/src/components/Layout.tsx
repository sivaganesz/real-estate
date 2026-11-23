import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import clsx from 'clsx';
import { LogOut, Sparkles, Search } from 'lucide-react';
import { ROLE_LABEL } from '@estate/shared';
import { useAuth } from '../lib/auth';
import { NAV } from '../nav';
import { Avatar } from './ui';
import { AssistantPanel } from '../ai/AssistantPanel';
import { useAssistant } from '../ai/assistant';

export function Layout() {
  const { user, can, signOut, ai } = useAuth();
  const assistant = useAssistant();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  if (!user) return null;
  const items = NAV.filter((n) => !n.permission || can(n.permission));

  return (
    <div className={clsx('min-h-screen transition-[padding]', assistant.open && 'lg:pr-[420px]')}>
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <img src="/favicon.svg" className="h-8 w-8" alt="" />
          <div>
            <p className="text-sm font-bold tracking-tight text-slate-900">EstateOS</p>
            <p className="text-[11px] text-slate-400">Sales & inventory</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                clsx('flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition', isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')
              }
            >
              {n.icon}
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="m-3 rounded-2xl bg-gradient-to-br from-ai-50 to-brand-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-ai-700">
            <Sparkles className="h-3.5 w-3.5" /> Assistant {ai?.mode === 'offline' && <span className="font-normal text-slate-500">(offline)</span>}
          </p>
          <p className="mt-1 text-xs text-slate-600">Ask about leads, properties or your day. Press Ctrl/⌘ K.</p>
        </div>
        <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-3">
          <Avatar name={user.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">{user.name}</p>
            <p className="text-xs text-slate-400">{ROLE_LABEL[user.role]}</p>
          </div>
          <button onClick={() => signOut().then(() => navigate('/login'))} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      <div className="lg:pl-60">
        {/* Top bar: one box to ask or search anything */}
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-slate-50/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
            <img src="/favicon.svg" className="h-7 w-7 lg:hidden" alt="" />
            <form
              className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm focus-within:border-ai-500 focus-within:ring-2 focus-within:ring-ai-100"
              onSubmit={(e) => {
                e.preventDefault();
                if (q.trim()) assistant.ask(q);
                else assistant.setOpen(true);
                setQ('');
              }}
            >
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder='Ask or search — "2 BHK under 70 L in Porur", "leads without follow-ups"'
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
              <kbd className="hidden rounded-md border border-slate-200 px-1.5 text-[10px] text-slate-400 sm:block">Ctrl K</kbd>
            </form>
            <button
              onClick={() => assistant.setOpen(!assistant.open)}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-ai-600 to-brand-600 px-3 py-2 text-sm font-medium text-white shadow-sm"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Assistant</span>
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Bottom bar (phones) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden">
        {items
          .filter((n) => n.mobile)
          .map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => clsx('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-brand-700' : 'text-slate-500')}>
              {n.icon}
              {n.label}
            </NavLink>
          ))}
        <button onClick={() => signOut().then(() => navigate('/login'))} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-slate-500">
          <LogOut className="h-[18px] w-[18px]" />
          Sign out
        </button>
      </nav>

      <AssistantPanel />
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
