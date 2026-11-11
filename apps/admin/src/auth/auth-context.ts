import type { AuthUser, Permission } from '@real-estate/shared';
import { createContext, useContext } from 'react';

export type SignOutReason = 'idle' | 'expired' | null;

export interface AuthContextValue {
  status: 'loading' | 'authenticated' | 'anonymous';
  user: AuthUser | null;
  /** Why the user was signed out automatically (shown on the login page). */
  signOutReason: SignOutReason;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: (reason?: SignOutReason) => Promise<void>;
  can: (permission: Permission) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

/** Where each role lands after signing in (matches the Phase 1 wireframe). */
export function homePathFor(user: AuthUser): string {
  if (user.permissions.includes('users:manage')) return '/users';
  if (user.permissions.includes('settings:edit')) return '/settings/company';
  return '/profile';
}
