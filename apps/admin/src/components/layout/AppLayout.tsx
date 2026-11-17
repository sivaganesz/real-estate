import type { Permission } from '@real-estate/shared';
import {
  BarChart3Icon,
  CalendarDaysIcon,
  ContactIcon,
  HouseIcon,
  KanbanSquareIcon,
  LayoutDashboardIcon,
  LockIcon,
  MenuIcon,
  PlusIcon,
  SettingsIcon,
  ShieldCheckIcon,
  TargetIcon,
  UploadIcon,
  UsersIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { Suspense, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/auth/auth-context';
import { PageHeader } from '@/components/patterns';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useStatusCounts } from '@/features/properties/api';
import { useCompanySettings } from '@/features/settings/api';
import { cn } from '@/lib/utils';
import { BrandMark } from './BrandMark';
import { Breadcrumbs } from './Breadcrumbs';
import { usePageHeading } from './use-page-heading';
import { UserMenu } from './UserMenu';

type Icon = ComponentType<{ className?: string }>;

interface NavLinkItem {
  to: string;
  label: string;
  icon: Icon;
  permission?: Permission;
  /** Count shown at the right (wireframe `.cnt`). */
  count?: 'availableProperties';
}

/** The planned releases (docs/v2/PRD.md §3), named in the badge's tooltip. */
const RELEASES = {
  R3: 'Lead Pipeline',
  R5: 'Matching',
  R6: 'Appointments',
  R7: 'Dashboard & Reports',
  R8: 'HNI assessment',
} as const;
type Release = keyof typeof RELEASES;

/**
 * A module from a later release: shown greyed with its release, so the plan is visible.
 * Not a link: the page does not exist yet.
 */
interface ComingItem {
  label: string;
  icon: Icon;
  release: Release;
  /** Shown with a lock to roles without this permission (wireframe: HNI). */
  restrictedTo?: Permission;
}

type NavItem = NavLinkItem | ComingItem;
const isComing = (item: NavItem): item is ComingItem => 'release' in item;

interface NavSection {
  title: string;
  items: NavItem[];
}

/** Sidebar groups, in the wireframe's order (spec-system-wireframe/app.js NAV). */
const NAV: NavSection[] = [
  {
    title: 'Overview',
    items: [{ label: 'Sales dashboard', icon: LayoutDashboardIcon, release: 'R7' }],
  },
  {
    title: 'Specification data',
    items: [
      {
        to: '/properties',
        label: 'Properties',
        icon: HouseIcon,
        permission: 'properties:read',
        count: 'availableProperties',
      },
      { label: 'Customers', icon: ContactIcon, release: 'R3' },
      { to: '/imports', label: 'Bulk import', icon: UploadIcon, permission: 'imports:run' },
    ],
  },
  {
    title: 'Sales & qualification',
    items: [
      { label: 'Lead pipeline', icon: KanbanSquareIcon, release: 'R3' },
      { label: 'Matching engine', icon: TargetIcon, release: 'R5' },
      { label: 'Appointments', icon: CalendarDaysIcon, release: 'R6' },
      { label: 'Reports', icon: BarChart3Icon, release: 'R7' },
      {
        label: 'HNI qualification',
        icon: ShieldCheckIcon,
        release: 'R8',
        restrictedTo: 'hni:read',
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/users', label: 'Users & Roles', icon: UsersIcon, permission: 'users:manage' },
      { to: '/settings', label: 'Settings', icon: SettingsIcon, permission: 'settings:edit' },
    ],
  },
];

const COLLAPSE_KEY = 're-admin-sidebar-collapsed';
function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Shows a tooltip with the label only when the sidebar is collapsed. */
function WithTip({
  show,
  label,
  children,
}: {
  show: boolean;
  label: string;
  children: React.ReactElement;
}) {
  if (!show) return children;
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function SectionLabel({ collapsed, children }: { collapsed: boolean; children: string }) {
  if (collapsed) return <div className="mx-3 my-2 h-px bg-sidebar-border" aria-hidden />;
  return (
    <div className="px-2.5 pt-3 pb-1 text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
      {children}
    </div>
  );
}

const countClass =
  'ml-auto rounded-full bg-tone-grey-soft px-1.5 text-[11px] leading-[18px] text-muted-foreground tabular-nums';

function Sidebar({
  collapsed,
  onNavigate,
  onToggle,
}: {
  collapsed: boolean;
  onNavigate: () => void;
  /** Desktop only: the logo doubles as the collapse/expand button. */
  onToggle?: () => void;
}) {
  const { user, can } = useAuth();
  const { data: company } = useCompanySettings();
  const showCounts = can('properties:read');
  const counts = useStatusCounts({ enabled: showCounts });
  if (!user) return null;

  const countOf = (key: NavLinkItem['count']) =>
    key === 'availableProperties' ? counts.data?.available : undefined;

  // Wireframe `.nav a` / `.nav a.on`: soft brand background for the current page.
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex h-8 items-center gap-2.5 rounded-lg text-[14px] font-medium transition-colors',
      collapsed ? 'justify-center px-0' : 'px-2.5',
      isActive
        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
        : 'text-sidebar-foreground hover:bg-tone-grey-soft',
    );

  return (
    <nav aria-label="Main" className="flex h-full flex-col gap-0.5 px-2.5 py-3.5">
      <div className={cn('flex h-11 items-center', collapsed ? 'justify-center' : 'px-1')}>
        <BrandMark
          compact={collapsed}
          onToggle={onToggle}
          name={company?.isConfigured ? company.name : null}
          logoUrl={company?.logoUrl}
        />
      </div>

      {NAV.map((section) => {
        const items = section.items.filter(
          (item) => isComing(item) || !item.permission || can(item.permission),
        );
        if (items.length === 0) return null;
        return (
          <div key={section.title} className="grid gap-0.5">
            <SectionLabel collapsed={collapsed}>{section.title}</SectionLabel>
            {items.map((item) => {
              if (isComing(item)) {
                return <ComingNavItem key={item.label} item={item} collapsed={collapsed} />;
              }
              const { to, label, icon: ItemIcon, count } = item;
              const n = count ? countOf(count) : undefined;
              return (
                <WithTip key={to} show={collapsed} label={label}>
                  <NavLink
                    to={to}
                    className={linkClass}
                    onClick={onNavigate}
                    aria-label={collapsed ? label : undefined}
                  >
                    <ItemIcon className="size-4 shrink-0 opacity-80" />
                    {!collapsed && (
                      <>
                        <span data-label className="truncate">
                          {label}
                        </span>
                        {n !== undefined && (
                          <span className={countClass} aria-label={`${n} available`}>
                            {n}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                </WithTip>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

/** A greyed, non-clickable entry for a module of a later release. */
function ComingNavItem({ item, collapsed }: { item: ComingItem; collapsed: boolean }) {
  const { can } = useAuth();
  const { label, icon: ItemIcon, release, restrictedTo } = item;
  const locked = restrictedTo !== undefined && !can(restrictedTo);
  const when = `Coming in release ${release} (${RELEASES[release]})`;
  return (
    <WithTip show={collapsed} label={`${label} · ${when}`}>
      <div
        className={cn(
          'flex h-8 items-center gap-2.5 rounded-lg text-[14px] text-muted-foreground/60',
          collapsed ? 'justify-center' : 'px-2.5',
        )}
        aria-disabled="true"
        aria-label={collapsed ? `${label}, ${when}` : undefined}
        title={collapsed ? undefined : when}
      >
        <ItemIcon className="size-4 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 truncate">{label}</span>
            {locked ? (
              <LockIcon className="size-3.5" aria-label="Restricted" />
            ) : (
              <span className="rounded border border-dashed px-1 text-[10px]">{release}</span>
            )}
          </>
        )}
      </div>
    </WithTip>
  );
}

/** Shown while a page's code loads (pages are split per route). */
function PageLoading() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Loading page">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/** Quick actions in the top bar (wireframe: "＋ Property"; more arrive with later modules). */
function QuickActions() {
  const { can } = useAuth();
  const { pathname } = useLocation();
  // The list and the form have their own Add property button.
  if (!can('properties:write') || pathname === '/properties' || pathname === '/properties/new')
    return null;
  return (
    <Button
      variant="outline"
      size="sm"
      className="hidden sm:inline-flex"
      render={<Link to="/properties/new" />}
    >
      <PlusIcon /> Property
    </Button>
  );
}

/**
 * Signed-in layout from the wireframe: a 236 px sidebar (collapsible on desktop, a drawer
 * on phones), a white top bar with breadcrumbs and quick actions, and content up to 1380 px.
 */
export function AppLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const heading = usePageHeading();

  if (!user) return null;
  const toggleCollapsed = () => {
    setCollapsed((value) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, value ? '0' : '1');
      } catch {
        // Not remembered; still works for this visit.
      }
      return !value;
    });
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden shrink-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:block',
          collapsed ? 'w-[68px]' : 'w-[236px]',
        )}
      >
        <div className="sticky top-0 h-screen overflow-x-hidden overflow-y-auto">
          <Sidebar collapsed={collapsed} onNavigate={() => undefined} onToggle={toggleCollapsed} />
        </div>
      </aside>

      {/* Phone / tablet: the same sidebar in a drawer (focus stays inside; Escape closes). */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[260px] max-w-[85%] gap-0 bg-sidebar p-0 lg:hidden">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="h-full overflow-y-auto">
            <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-[52px] flex-wrap items-center gap-3 border-b bg-card px-4 py-2 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon />
          </Button>
          <Breadcrumbs />
          <div className="ml-auto flex items-center gap-2">
            <QuickActions />
            <UserMenu />
          </div>
        </header>

        <main className="flex-1 px-4 pt-5 pb-14 lg:px-6">
          <div
            key={location.pathname}
            className="w-full max-w-[1380px] animate-in fade-in-0 slide-in-from-bottom-1 duration-200"
          >
            <Suspense fallback={<PageLoading />}>
              {heading && <PageHeader title={heading.title} description={heading.description} />}
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
