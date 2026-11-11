import type {
  InviteUserBody,
  ListUsersQuery,
  PageMeta,
  RoleMatrixRow,
  Role,
  UpdateUserBody,
  User,
  UserStats,
} from '@real-estate/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface RolesResponse {
  roles: { role: Role; label: string; description: string }[];
  matrix: RoleMatrixRow[];
}

export const usersKeys = {
  all: ['users'] as const,
  list: (query: Partial<ListUsersQuery>) => ['users', 'list', query] as const,
  stats: ['users', 'stats'] as const,
  detail: (id: string) => ['users', 'detail', id] as const,
  roles: ['roles'] as const,
};

function toQueryString(query: Partial<ListUsersQuery>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useUsers(query: Partial<ListUsersQuery>) {
  return useQuery({
    queryKey: usersKeys.list(query),
    queryFn: () => api.list<User>(`/admin/users${toQueryString(query)}`),
    placeholderData: keepPreviousData,
  });
}

/**
 * One user, used by the edit drawer. Starts from the row the admin clicked (no loading
 * flash) and is kept current by the mutations below.
 */
export function useUser(id: string | null, initial?: User) {
  return useQuery({
    queryKey: usersKeys.detail(id ?? 'none'),
    queryFn: () => api.get<User>(`/admin/users/${id}`),
    enabled: Boolean(id),
    initialData: initial && initial.id === id ? initial : undefined,
  });
}

export function useUserStats() {
  return useQuery({
    queryKey: usersKeys.stats,
    queryFn: () => api.get<UserStats>('/admin/users/stats'),
  });
}

export function useRoles() {
  return useQuery({
    queryKey: usersKeys.roles,
    queryFn: () => api.get<RolesResponse>('/admin/roles'),
    staleTime: Infinity,
  });
}

/** The updated user returned by a mutation, if any (some return { user, emailSent }). */
function updatedUser(result: unknown): User | undefined {
  if (!result || typeof result !== 'object') return undefined;
  if ('user' in result) return (result as { user: User }).user;
  if ('id' in result && 'status' in result) return result as User;
  return undefined;
}

/**
 * Mutations write the updated user into the cache straight away (so an open edit drawer
 * shows the new state immediately), then refresh the list and the counts.
 */
function useUsersMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result) => {
      const user = updatedUser(result);
      if (user) queryClient.setQueryData(usersKeys.detail(user.id), user);
      return queryClient.invalidateQueries({ queryKey: usersKeys.all });
    },
  });
}

export const useInviteUser = () =>
  useUsersMutation((body: InviteUserBody) =>
    api.post<{ user: User; emailSent: boolean }>('/admin/users', body),
  );

export const useUpdateUser = () =>
  useUsersMutation(({ id, body }: { id: string; body: UpdateUserBody }) =>
    api.patch<User>(`/admin/users/${id}`, body),
  );

export const useResendInvite = () =>
  useUsersMutation((id: string) =>
    api.post<{ user: User; emailSent: boolean }>(`/admin/users/${id}/resend-invite`),
  );

export const useDeactivateUser = () =>
  useUsersMutation((id: string) => api.post<User>(`/admin/users/${id}/deactivate`));

export const useReactivateUser = () =>
  useUsersMutation((id: string) => api.post<User>(`/admin/users/${id}/reactivate`));

export const useUnlockUser = () =>
  useUsersMutation((id: string) => api.post<User>(`/admin/users/${id}/unlock`));

export const useSendPasswordReset = () =>
  useUsersMutation((id: string) =>
    api.post<{ emailSent: boolean }>(`/admin/users/${id}/send-password-reset`),
  );

export type { PageMeta };
