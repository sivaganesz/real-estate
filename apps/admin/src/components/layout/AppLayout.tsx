import type { Permission } from '@real-estate/shared';
import { ROLE_LABELS } from '@real-estate/shared';
import {
  CalendarDaysIcon,
  ChevronDownIcon,
  ContactIcon,
  HouseIcon,
  LogOutIcon,
  MenuIcon,
  MessagesSquareIcon,
  PhoneCallIcon,
  SettingsIcon,
  UploadIcon,
  UserRoundIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from '@/auth/auth-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { BrandMark } from './BrandMark';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  permission: Permission;
}

/** Phase 1 modules (shown only to roles that can use them). */
const ADMIN_NAV: NavItem[] = [
  { to: '/users', label: 'Users & Roles', icon: UsersIcon, permission: 'users:manage' },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, permission: 'settings:edit' },
];

/** Later phases, shown greyed out so the team can see what's coming. */
const COMING_NEXT = [
  { label: 'Properties', icon: HouseIcon, phase: 'Phase 2' },
  { label: 'Bulk Import', icon: UploadIcon, phase: 'Phase 2' },
  { label: 'Appointments', icon: CalendarDaysIcon, phase: 'Phase 3' },
  { label: 'Leads', icon: ContactIcon, phase: 'Phase 3' },
  { label: 'Conversations', icon: MessagesSquareIcon, phase: 'Phase 3' },
  { label: 'Call Logs', icon: PhoneCallIcon, phase: 'Phase 3' },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
    isActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
  );

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

function Sidebar({ onNavigate, onSignOut }: { onNavigate: () => void; onSignOut: () => void }) {
  const { can } = useAuth();
  const adminItems = ADMIN_NAV.filter((item) => can(item.permission));

  return (
    <nav aria-label="Main" className="flex h-full flex-col gap-1 p-3">
      <div className="px-2 pt-1 pb-4">
        <BrandMark />
      </div>

      {adminItems.length > 0 && (
        <>
          <div className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Administration
          </div>
          {adminItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={navLinkClass} onClick={onNavigate}>
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </>
      )}

      <div className="px-3 pt-4 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Coming next
      </div>
      {COMING_NEXT.map(({ label, icon: Icon, phase }) => (
        <div
          key={label}
          className="flex h-9 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground/70"
          aria-disabled="true"
          title={`Available in ${phase}`}
        >
          <Icon className="size-4" />
          <span className="flex-1">{label}</span>
          <Badge variant="outline" className="border-dashed text-[10px] font-normal">
            {phase}
          </Badge>
        </div>
      ))}

      <div className="mt-auto flex flex-col gap-1 pt-4">
        <NavLink to="/profile" className={navLinkClass} onClick={onNavigate}>
          <UserRoundIcon className="size-4" />
          My Profile
        </NavLink>
        <button
          type="button"
          onClick={onSignOut}
          className="flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium hover:bg-muted"
        >
          <LogOutIcon className="size-4" />
          Sign out
        </button>
      </div>
    </nav>
  );
}

/** Signed-in layout: sidebar + top bar (Phase 1 wireframe). */
export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;
  const signOut = () => void logout();

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r bg-background lg:block">
        <div className="sticky top-0 h-screen overflow-y-auto">
          <Sidebar onNavigate={() => undefined} onSignOut={signOut} />
        </div>
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative h-full w-72 max-w-[85%] overflow-y-auto bg-background shadow-xl">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            >
              <XIcon />
            </Button>
            <Sidebar onNavigate={() => setMobileOpen(false)} onSignOut={signOut} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon />
          </Button>
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" className="h-9 gap-2 pl-1.5">
                    <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                      {initials(user.name)}
                    </span>
                    <span className="hidden text-sm sm:inline">
                      {user.name} · {ROLE_LABELS[user.role]}
                    </span>
                    <ChevronDownIcon className="size-4 text-muted-foreground" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <div className="font-medium text-foreground">{user.name}</div>
                    <div className="text-xs font-normal text-muted-foreground">{user.email}</div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <UserRoundIcon /> My Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut}>
                  <LogOutIcon /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
