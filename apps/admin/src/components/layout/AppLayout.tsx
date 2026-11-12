import type { Permission } from '@real-estate/shared';
import {
  CalendarDaysIcon,
  ContactIcon,
  HouseIcon,
  MenuIcon,
  MessagesSquareIcon,
  PhoneCallIcon,
  SettingsIcon,
  UploadIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/auth/auth-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCompanySettings } from '@/features/settings/api';
import { cn } from '@/lib/utils';
import { BrandMark } from './BrandMark';
import { Breadcrumbs } from './Breadcrumbs';
import { UserMenu } from './UserMenu';

type Icon = ComponentType<{ className?: string }>;

interface NavItem {
  to: string;
  label: string;
  icon: Icon;
  permission?: Permission;
}

/** Inventory (Phase 2). */
const INVENTORY_NAV: NavItem[] = [
  { to: '/properties', label: 'Properties', icon: HouseIcon, permission: 'properties:read' },
  { to: '/imports', label: 'Bulk Import', icon: UploadIcon, permission: 'imports:run' },
];

/** Administration (shown only to roles that can use them). */
const ADMIN_NAV: NavItem[] = [
  { to: '/users', label: 'Users & Roles', icon: UsersIcon, permission: 'users:manage' },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, permission: 'settings:edit' },
];

/** Later phases, shown greyed out so the team can see what's coming. */
const COMING_NEXT: { label: string; icon: Icon; phase: string }[] = [
  { label: 'Appointments', icon: CalendarDaysIcon, phase: 'Phase 3' },
  { label: 'Leads', icon: ContactIcon, phase: 'Phase 3' },
  { label: 'Conversations', icon: MessagesSquareIcon, phase: 'Phase 3' },
  { label: 'Call Logs', icon: PhoneCallIcon, phase: 'Phase 3' },
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

function GroupLabel({ collapsed, children }: { collapsed: boolean; children: string }) {
  if (collapsed) return <div className="mx-3 my-2 h-px bg-border" aria-hidden />;
  return (
    <div className="px-3 pt-4 pb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase">
      {children}
    </div>
  );
}

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
  if (!user) return null;
  const inventoryItems = INVENTORY_NAV.filter((item) => !item.permission || can(item.permission));
  const adminItems = ADMIN_NAV.filter((item) => !item.permission || can(item.permission));

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'group flex h-9 items-center gap-3 rounded-lg text-sm font-medium transition-colors',
      collapsed ? 'justify-center px-0' : 'px-3',
      isActive
        ? 'bg-primary text-primary-foreground shadow-xs dark:bg-sidebar-accent dark:text-sidebar-accent-foreground dark:shadow-none'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    );

  const renderLinks = (items: NavItem[]) =>
    items.map(({ to, label, icon: ItemIcon }) => (
      <WithTip key={to} show={collapsed} label={label}>
        <NavLink
          to={to}
          className={linkClass}
          onClick={onNavigate}
          aria-label={collapsed ? label : undefined}
        >
          <ItemIcon className="size-4 shrink-0" />
          {!collapsed && <span className="truncate">{label}</span>}
        </NavLink>
      </WithTip>
    ));

  return (
    <nav aria-label="Main" className="flex h-full flex-col gap-0.5 p-3">
      <div className={cn('flex h-11 items-center', collapsed ? 'justify-center' : 'px-1')}>
        <BrandMark
          compact={collapsed}
          onToggle={onToggle}
          name={company?.isConfigured ? company.name : null}
          logoUrl={company?.logoUrl}
        />
      </div>

      {inventoryItems.length > 0 && (
        <>
          <GroupLabel collapsed={collapsed}>Inventory</GroupLabel>
          {renderLinks(inventoryItems)}
        </>
      )}

      {adminItems.length > 0 && (
        <>
          <GroupLabel collapsed={collapsed}>Administration</GroupLabel>
          {renderLinks(adminItems)}
        </>
      )}

      <GroupLabel collapsed={collapsed}>Coming next</GroupLabel>
      {COMING_NEXT.map(({ label, icon: ItemIcon, phase }) => (
        <WithTip key={label} show={collapsed} label={`${label} · ${phase}`}>
          <div
            className={cn(
              'flex h-9 items-center gap-3 rounded-lg text-sm text-muted-foreground/55',
              collapsed ? 'justify-center' : 'px-3',
            )}
            aria-disabled="true"
            aria-label={collapsed ? `${label}, available in ${phase}` : undefined}
            title={collapsed ? undefined : `Available in ${phase}`}
          >
            <ItemIcon className="size-4 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 truncate">{label}</span>
                <Badge
                  variant="outline"
                  className="border-dashed text-[10px] font-normal text-muted-foreground/70"
                >
                  {phase}
                </Badge>
              </>
            )}
          </div>
        </WithTip>
      ))}
    </nav>
  );
}

/** Signed-in layout: collapsible sidebar + top bar with breadcrumbs. */
export function AppLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);

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
    <div className="flex min-h-screen bg-muted/30 dark:bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden shrink-0 border-r bg-background transition-[width] duration-200 lg:block dark:border-sidebar-border dark:bg-sidebar',
          collapsed ? 'w-[68px]' : 'w-64',
        )}
      >
        <div className="sticky top-0 h-screen overflow-y-auto overflow-x-hidden">
          <Sidebar collapsed={collapsed} onNavigate={() => undefined} onToggle={toggleCollapsed} />
        </div>
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40 animate-in fade-in-0 dark:bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative h-full w-72 max-w-[85%] overflow-y-auto bg-background shadow-xl animate-in slide-in-from-left duration-200 dark:bg-sidebar">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 z-10"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            >
              <XIcon />
            </Button>
            <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur-sm lg:px-6 dark:border-sidebar-border">
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
          <div className="ml-auto flex items-center">
            <UserMenu />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div
            key={location.pathname}
            className="mx-auto w-full max-w-6xl animate-in fade-in-0 slide-in-from-bottom-1 duration-200"
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
