import type { ReactNode } from 'react';
import { Sun, Settings, Building2, Users } from 'lucide-react';
import type { Permission } from '@estate/shared';

export type NavItem = { to: string; label: string; icon: ReactNode; permission?: Permission; mobile?: boolean };

/** One menu for everyone; each role sees only what its permissions allow. */
export const NAV: NavItem[] = [
  { to: '/', label: 'Today', icon: <Sun className="h-[18px] w-[18px]" />, mobile: true },
  { to: '/leads', label: 'Leads', icon: <Users className="h-[18px] w-[18px]" />, mobile: true },
  { to: '/properties', label: 'Properties', icon: <Building2 className="h-[18px] w-[18px]" />, mobile: true },
  { to: '/settings', label: 'Settings', icon: <Settings className="h-[18px] w-[18px]" />, permission: 'settings.manage' },
];
