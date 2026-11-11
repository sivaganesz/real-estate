import type {
  ChangePasswordBody,
  Profile,
  SessionResponse,
  UpdateProfileBody,
} from '@real-estate/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const profileKey = ['profile'] as const;

export function useProfile() {
  return useQuery({ queryKey: profileKey, queryFn: () => api.get<Profile>('/admin/profile') });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProfileBody) => api.patch<Profile>('/admin/profile', body),
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKey, profile);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: ChangePasswordBody) =>
      api.post<SessionResponse>('/admin/profile/change-password', body),
  });
}
