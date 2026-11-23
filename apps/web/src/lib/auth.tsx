import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { can as canDo, type Permission, type Role } from '@estate/shared';
import { api } from './api';

export type User = { id: string; name: string; email: string; phone: string; role: Role; active: boolean; managerId: string | null };
export type AiMode = { mode: 'gemini' | 'offline'; model: string | null };

type AuthValue = {
  user: User | null;
  ai: AiMode | null;
  loading: boolean;
  can: (p: Permission) => boolean;
  refresh: () => void;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<{ user: User; ai: AiMode }>('/auth/me'),
    retry: false,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    const onOut = () => qc.setQueryData(['me'], null);
    window.addEventListener('estate:signed-out', onOut);
    return () => window.removeEventListener('estate:signed-out', onOut);
  }, [qc]);

  const user = me.data?.user ?? null;
  const value: AuthValue = {
    user,
    ai: me.data?.ai ?? null,
    loading: me.isLoading,
    can: (p) => canDo(user?.role, p),
    refresh: () => void qc.invalidateQueries({ queryKey: ['me'] }),
    signOut: async () => {
      await api.post('/auth/logout');
      qc.clear();
      qc.setQueryData(['me'], null);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}

export function useUsers() {
  return useQuery({ queryKey: ['users'], queryFn: () => api.get<{ users: User[] }>('/users'), staleTime: 60_000, select: (d) => d.users });
}
