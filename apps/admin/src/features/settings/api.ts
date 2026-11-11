import type { CompanySettings, UpdateCompanySettingsBody } from '@real-estate/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const companySettingsKey = ['settings', 'company'] as const;
const PATH = '/admin/settings/company';

/** Company info. Every signed-in user can read it (the sidebar shows the logo and name). */
export function useCompanySettings() {
  return useQuery({
    queryKey: companySettingsKey,
    queryFn: () => api.get<CompanySettings>(PATH),
    staleTime: 5 * 60 * 1000,
  });
}

function useSaveToCache() {
  const queryClient = useQueryClient();
  return (settings: CompanySettings) => queryClient.setQueryData(companySettingsKey, settings);
}

export function useUpdateCompanySettings() {
  const save = useSaveToCache();
  return useMutation({
    mutationFn: (body: UpdateCompanySettingsBody) => api.put<CompanySettings>(PATH, body),
    onSuccess: save,
  });
}

export function useUploadLogo() {
  const save = useSaveToCache();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.post<CompanySettings>(`${PATH}/logo`, form);
    },
    onSuccess: save,
  });
}

export function useRemoveLogo() {
  const save = useSaveToCache();
  return useMutation({
    mutationFn: () => api.delete<CompanySettings>(`${PATH}/logo`),
    onSuccess: save,
  });
}
