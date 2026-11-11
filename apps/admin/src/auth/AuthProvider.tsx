import type { AuthUser, Permission, SessionResponse } from '@real-estate/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api, onSessionExpired, refreshSession, tokenStore } from '@/lib/api';
import { AuthContext } from './auth-context';
import type { AuthContextValue, SignOutReason } from './auth-context';

/** Signed out after this much inactivity (the API enforces the same limit). */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'mousemove', 'touchstart'] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [signOutReason, setSignOutReason] = useState<SignOutReason>(null);

  const endSession = useCallback(
    (reason: SignOutReason) => {
      tokenStore.set(null);
      setUser(null);
      setStatus('anonymous');
      setSignOutReason(reason);
      queryClient.clear();
    },
    [queryClient],
  );

  // Restore the session from the refresh cookie when the app opens.
  useEffect(() => {
    let cancelled = false;
    void refreshSession().then((session) => {
      if (cancelled) return;
      if (session) {
        setUser(session.user);
        setStatus('authenticated');
      } else {
        setStatus('anonymous');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The API client calls this when a refresh fails (e.g. the session expired on the server).
  useEffect(() => {
    onSessionExpired(() => endSession('expired'));
    return () => onSessionExpired(null);
  }, [endSession]);

  const startSession = useCallback((session: SessionResponse) => {
    tokenStore.set(session.accessToken);
    setUser(session.user);
    setSignOutReason(null);
    setStatus('authenticated');
    return session.user;
  }, []);

  const updateUser = useCallback((changes: Partial<Pick<AuthUser, 'name' | 'phone'>>) => {
    setUser((current) => (current ? { ...current, ...changes } : current));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const session = await api.post<SessionResponse>(
      '/auth/login',
      { email, password },
      { auth: false },
    );
    tokenStore.set(session.accessToken);
    setUser(session.user);
    setSignOutReason(null);
    setStatus('authenticated');
    return session.user;
  }, []);

  const logout = useCallback(
    async (reason: SignOutReason = null) => {
      try {
        await api.post('/auth/logout', undefined, { auth: false });
      } catch {
        // Signing out locally still works if the request fails.
      }
      endSession(reason);
    },
    [endSession],
  );

  // Idle timeout: sign out after 30 minutes without any activity.
  const logoutRef = useRef(logout);
  logoutRef.current = logout;
  useEffect(() => {
    if (status !== 'authenticated') return;
    let timer = window.setTimeout(() => void logoutRef.current('idle'), IDLE_TIMEOUT_MS);
    let last = Date.now();
    const onActivity = () => {
      const now = Date.now();
      if (now - last < 1000) return; // throttle
      last = now;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void logoutRef.current('idle'), IDLE_TIMEOUT_MS);
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [status]);

  const can = useCallback(
    (permission: Permission) => user?.permissions.includes(permission) ?? false,
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, signOutReason, login, startSession, updateUser, logout, can }),
    [status, user, signOutReason, login, startSession, updateUser, logout, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
