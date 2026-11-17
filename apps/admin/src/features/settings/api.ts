import type {
  CompanySettings,
  UpdateCompanySettingsBody,
  ValuationCosts,
  ValuationCostsBody,
} from '@real-estate/shared';
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
    // `version` is the one on screen: a save based on an outdated copy gets 409.
    mutationFn: ({ version, ...body }: UpdateCompanySettingsBody & { version: number }) =>
      api.put<CompanySettings>(PATH, body, { ifMatch: version }),
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

export const valuationCostsKey = ['settings', 'valuation-costs'] as const;
const COSTS_PATH = '/admin/settings/valuation-costs';

/** Transaction cost assumptions (SET-04): stamp duty, registration, other costs. */
export function useValuationCosts() {
  return useQuery({
    queryKey: valuationCostsKey,
    queryFn: () => api.get<ValuationCosts>(COSTS_PATH),
  });
}

export function useUpdateValuationCosts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ version, ...body }: ValuationCostsBody & { version: number }) =>
      api.put<ValuationCosts>(COSTS_PATH, body, { ifMatch: version }),
    onSuccess: (saved) => queryClient.setQueryData(valuationCostsKey, saved),
  });
}
