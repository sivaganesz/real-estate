import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { LogOut, Search, Sparkles } from 'lucide-react';
import { ROLE_LABEL } from '@estate/shared';
import { useAuth } from '../lib/auth';
import { NAV, TOP_NAV_ROLES, type NavItem } from '../nav';
import { Avatar } from './ui';
import { AssistantPanel } from '../ai/AssistantPanel';
import { useAssistant } from '../ai/assistant';
import { Reminders } from '../features/activities';

/**
 * Two shells, same pages:
 * - executives (few menu items, out in the field) get a slim top navbar;
 * - managers and admins (more sections) get a sidebar.
 * On phones everyone gets the bottom tab bar.
 */
export function Layout() {
  const { user, can } = useAuth();
  const assistant = useAssistant();
  if (!user) return null;
  const items = NAV.filter((n) => !n.permission || can(n.permission));
  const topNav = TOP_NAV_ROLES.includes(user.role);

  return (
    <div className={clsx('min-h-screen transition-[padding]', assistant.open && 'lg:pr-[420px]')}>
      {!topNav && <Sidebar items={items} />}

      <div className={clsx(!topNav && 'lg:pl-60')}>
        {topNav ? <TopNavbar items={items} /> : <TopBar />}
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:pb-10">
          <Outlet />
        </main>
      </div>

      <BottomBar items={items} />
      <AssistantPanel />
    </div>
  );
}

/** Executives on desktop: a light bar — menu words, one "Ask anything" pill, bell and avatar. */
function TopNavbar({ items }: { items: NavItem[] }) {
  const assistant = useAssistant();
  return (
    <header className="sticky top-0 z-30 bg-slate-50/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
        <Brand />
        <nav className="ml-4 hidden items-center gap-0.5 lg:flex" aria-label="Main">
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                clsx('rounded-full px-3.5 py-1.5 text-sm transition', isActive ? 'bg-white font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200/70' : 'text-slate-500 hover:text-slate-900')
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex min-w-0 flex-1 justify-end lg:hidden">
          <AskBox />
        </div>
        <button
          onClick={() => assistant.setOpen(true)}
          className="ml-auto hidden items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200/70 transition hover:text-slate-800 lg:flex"
        >
          <Sparkles className="h-4 w-4 text-ai-600" />
          Ask anything
          <kbd className="hidden text-[10px] text-slate-400 xl:inline">Ctrl K</kbd>
        </button>
        <div className="hidden lg:block">
          <Reminders plain />
        </div>
        <div className="lg:hidden">
          <Reminders />
        </div>
        <div className="lg:hidden">
          <AssistantButton labelFrom="xl" />
        </div>
        <UserMenu />
      </div>
    </header>
  );
}

/** Managers and admins: the sticky bar above the page, next to the sidebar. */
function TopBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-slate-50/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <img src="/favicon.svg" className="h-7 w-7 lg:hidden" alt="" />
        <AskBox />
        <Reminders />
        <AssistantButton labelFrom="sm" />
      </div>
    </header>
  );
}

function Sidebar({ items }: { items: NavItem[] }) {
  const { user, ai, signOut } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="px-5 py-5">
        <Brand withTagline />
      </div>
      <nav className="flex-1 space-y-0.5 px-3" aria-label="Main">
        {items.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) => clsx('flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition', isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')}
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
  );
}

function Brand({ withTagline }: { withTagline?: boolean }) {
  return (
    <NavLink to="/" className="flex shrink-0 items-center gap-2">
      <img src="/favicon.svg" className={withTagline ? 'h-8 w-8' : 'h-7 w-7'} alt="" />
      <span className={clsx(!withTagline && 'hidden sm:block')}>
        <span className="block text-sm font-bold tracking-tight text-slate-900">EstateOS</span>
        {withTagline && <span className="block text-[11px] text-slate-400">Sales & inventory</span>}
      </span>
    </NavLink>
  );
}

/** One box to ask the assistant or search anything. */
function AskBox({ short }: { short?: boolean }) {
  const assistant = useAssistant();
  const [q, setQ] = useState('');
  return (
    <form
      className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm focus-within:border-ai-500 focus-within:ring-2 focus-within:ring-ai-100"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) assistant.ask(q);
        else assistant.setOpen(true);
        setQ('');
      }}
    >
      <Search className="h-4 w-4 shrink-0 text-slate-400" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={short ? 'Ask or search…' : 'Ask or search — "2 BHK under 70 L in Porur", "leads without follow-ups"'}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
      />
      {!short && <kbd className="hidden rounded-md border border-slate-200 px-1.5 text-[10px] text-slate-400 sm:block">Ctrl K</kbd>}
    </form>
  );
}

function AssistantButton({ labelFrom }: { labelFrom: 'sm' | 'xl' }) {
  const assistant = useAssistant();
  const { ai } = useAuth();
  return (
    <button
      onClick={() => assistant.setOpen(!assistant.open)}
      aria-label="Assistant"
      title={ai?.mode === 'offline' ? 'Assistant (offline mode)' : 'Assistant'}
      className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-ai-600 to-brand-600 px-3 py-2 text-sm font-medium text-white shadow-sm"
    >
      <Sparkles className="h-4 w-4" />
      <span className={labelFrom === 'xl' ? 'hidden xl:inline' : 'hidden sm:inline'}>Assistant</span>
    </button>
  );
}

/** Avatar with a small menu: who you are, and sign out. */
function UserMenu() {
  const { user, ai, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  if (!user) return null;
  return (
    <div ref={ref} className="relative hidden shrink-0 lg:block">
      <button onClick={() => setOpen(!open)} className="rounded-full p-0.5 transition hover:ring-2 hover:ring-slate-200" aria-label="Account" aria-expanded={open}>
        <Avatar name={user.name} />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-pop">
          <div className="flex items-center gap-2 px-2 py-2">
            <Avatar name={user.name} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">{user.name}</p>
              <p className="text-xs text-slate-400">{ROLE_LABEL[user.role]}</p>
            </div>
          </div>
          {ai?.mode === 'offline' && <p className="mx-2 mb-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] text-amber-800">Assistant is in offline mode</p>}
          <button onClick={() => signOut().then(() => navigate('/login'))} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">
            <LogOut className="h-4 w-4 text-slate-400" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/** Phones: the main sections as a bottom tab bar, for every role. */
function BottomBar({ items }: { items: NavItem[] }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden" aria-label="Main">
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
