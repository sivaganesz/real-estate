import {
  ChevronDownIcon,
  LogOutIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
  UserRoundIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/auth/auth-context';
import { UserAvatar } from '@/components/UserAvatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RoleBadge } from '@/features/users/UserBadges';
import { useTheme } from '@/theme/theme-context';

const ITEM = 'gap-3 px-2.5 py-2 [&_svg]:text-muted-foreground';

/**
 * Top-right account menu: a round avatar + chevron that opens the user's name, email and role,
 * then My Profile, Settings (if allowed), the light/dark switch and Sign out.
 */
export function UserMenu() {
  const { user, can, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  if (!user) return null;
  const isDark = theme === 'dark';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Account menu for ${user.name}`}
            className="group flex items-center gap-1.5 rounded-full border border-transparent p-1 pr-2 transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/15 data-popup-open:border-foreground/30 data-popup-open:bg-background dark:data-popup-open:border-foreground/70 dark:data-popup-open:bg-transparent"
          >
            <UserAvatar name={user.name} className="size-8 rounded-full" />
            <ChevronDownIcon className="size-4 text-muted-foreground transition-transform duration-200 group-data-popup-open:rotate-180" />
          </button>
        }
      />
      <DropdownMenuContent
        side="bottom"
        align="end"
        sideOffset={8}
        className="w-64 rounded-xl p-1.5"
      >
        <div className="px-2.5 pt-2 pb-2.5">
          <div className="truncate text-sm font-semibold">{user.name}</div>
          <div className="truncate text-xs text-muted-foreground">{user.email}</div>
          <RoleBadge role={user.role} className="mt-2" />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem className={ITEM} onClick={() => navigate('/profile')}>
            <UserRoundIcon /> My Profile
          </DropdownMenuItem>
          {can('settings:edit') && (
            <DropdownMenuItem className={ITEM} onClick={() => navigate('/settings')}>
              <SettingsIcon /> Settings
            </DropdownMenuItem>
          )}
          <DropdownMenuItem className={ITEM} closeOnClick={false} onClick={toggleTheme}>
            {isDark ? <SunIcon /> : <MoonIcon />} {isDark ? 'Light mode' : 'Dark mode'}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="gap-3 px-2.5 py-2"
          onClick={() => void logout()}
        >
          <LogOutIcon /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
