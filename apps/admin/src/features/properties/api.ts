import type {
  BulkStatusResult,
  CreatePropertyBody,
  GeoPlace,
  ListPropertiesQuery,
  LocationSuggestion,
  MediaKind,
  Property,
  PropertyHistoryEntry,
  PropertyListItem,
  PropertyStatus,
  PropertyStatusCounts,
  UpdatePropertyBody,
} from '@real-estate/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, uploadWithProgress } from '@/lib/api';

const PATH = '/admin/properties';

export const propertiesKeys = {
  all: ['properties'] as const,
  list: (query: Partial<ListPropertiesQuery>) => ['properties', 'list', query] as const,
  counts: ['properties', 'counts'] as const,
  detail: (id: string) => ['properties', 'detail', id] as const,
  history: (id: string) => ['properties', 'history', id] as const,
  suggestions: (field: string, q: string, city?: string) =>
    ['properties', 'suggestions', field, q.toLowerCase(), city ?? ''] as const,
};

function toQueryString(query: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '' && value !== null) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useProperties(query: Partial<ListPropertiesQuery>) {
  return useQuery({
    queryKey: propertiesKeys.list(query),
    queryFn: () => api.list<PropertyListItem>(`${PATH}${toQueryString(query)}`),
    placeholderData: keepPreviousData,
  });
}

export function useStatusCounts() {
  return useQuery({
    queryKey: propertiesKeys.counts,
    queryFn: () => api.get<PropertyStatusCounts>(`${PATH}/status-counts`),
  });
}

export function useProperty(id: string | undefined) {
  return useQuery({
    queryKey: propertiesKeys.detail(id ?? 'none'),
    queryFn: () => api.get<Property>(`${PATH}/${id}`),
    enabled: Boolean(id),
  });
}

export function usePropertyHistory(id: string) {
  return useQuery({
    queryKey: propertiesKeys.history(id),
    queryFn: () => api.get<PropertyHistoryEntry[]>(`${PATH}/${id}/history`),
  });
}

/** Values already used for a location field (e.g. cities), most used first. */
export function useLocationSuggestions(
  field: 'state' | 'city' | 'locality' | 'pincode',
  q: string,
  city?: string,
) {
  return useQuery({
    queryKey: propertiesKeys.suggestions(field, q, city),
    queryFn: () =>
      api.get<LocationSuggestion[]>(
        `${PATH}/location-suggestions${toQueryString({ field, q: q.trim(), city })}`,
      ),
    staleTime: 60_000,
  });
}

/** After any change: keep the detail fresh and refetch lists, counts and history. */
function useAfterChange() {
  const queryClient = useQueryClient();
  return (property?: Property) => {
    if (property) queryClient.setQueryData(propertiesKeys.detail(property.id), property);
    void queryClient.invalidateQueries({
      predicate: (q) =>
        q.queryKey[0] === 'properties' &&
        !(property && q.queryKey[1] === 'detail' && q.queryKey[2] === property.id),
    });
    // Property counts are shown in Settings (subcategories, amenities).
    void queryClient.invalidateQueries({ queryKey: ['property-types'] });
  };
}

export function useCreateProperty() {
  const after = useAfterChange();
  return useMutation({
    mutationFn: (body: CreatePropertyBody) => api.post<Property>(PATH, body),
    onSuccess: after,
  });
}

export function useUpdateProperty() {
  const after = useAfterChange();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdatePropertyBody }) =>
      api.patch<Property>(`${PATH}/${id}`, body),
    onSuccess: after,
  });
}

export function useChangeStatus() {
  const after = useAfterChange();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: PropertyStatus }) =>
      api.post<Property>(`${PATH}/${id}/status`, { status }),
    onSuccess: after,
  });
}

export function useBulkStatus() {
  const after = useAfterChange();
  return useMutation({
    mutationFn: (body: { ids: string[]; status: PropertyStatus }) =>
      api.post<BulkStatusResult>(`${PATH}/bulk-status`, body),
    onSuccess: () => after(),
  });
}

export function useDuplicateProperty() {
  const after = useAfterChange();
  return useMutation({
    mutationFn: (id: string) => api.post<Property>(`${PATH}/${id}/duplicate`),
    onSuccess: after,
  });
}

// ------------------------------------------------------------------ media

export function useUploadMedia() {
  const after = useAfterChange();
  return useMutation({
    mutationFn: ({
      id,
      kind,
      file,
      onProgress,
    }: {
      id: string;
      kind: MediaKind;
      file: File;
      onProgress?: (fraction: number) => void;
    }) => {
      const form = new FormData();
      form.append('file', file);
      return uploadWithProgress<Property>(`${PATH}/${id}/media?kind=${kind}`, form, onProgress);
    },
    onSuccess: after,
  });
}

export function useReorderMedia() {
  const after = useAfterChange();
  return useMutation({
    mutationFn: ({ id, ids }: { id: string; ids: string[] }) =>
      api.put<Property>(`${PATH}/${id}/media/order`, { ids }),
    onSuccess: after,
  });
}

export function useSetCover() {
  const after = useAfterChange();
  return useMutation({
    mutationFn: ({ id, mediaId }: { id: string; mediaId: string }) =>
      api.post<Property>(`${PATH}/${id}/media/${mediaId}/cover`),
    onSuccess: after,
  });
}

export function useDeleteMedia() {
  const after = useAfterChange();
  return useMutation({
    mutationFn: ({ id, mediaId }: { id: string; mediaId: string }) =>
      api.delete<Property>(`${PATH}/${id}/media/${mediaId}`),
    onSuccess: after,
  });
}

// ------------------------------------------------------------------ map

/** Where an address is (city, area, pincode, state). Only runs when enabled and something is typed. */
export function useGeoSearch(
  address: { locality: string; city: string; state: string; pincode: string },
  enabled: boolean,
) {
  const query = Object.fromEntries(
    Object.entries(address)
      .map(([k, v]) => [k, v.trim()])
      .filter(([, v]) => v),
  );
  return useQuery({
    queryKey: ['geo', 'search', query],
    queryFn: () => api.get<GeoPlace | null>(`/admin/geo/search${toQueryString(query)}`),
    enabled: enabled && Object.keys(query).length > 0,
    staleTime: Infinity,
    retry: false,
  });
}

/** The nearest address to a map pin. */
export function useGeoReverse(pin: { lat: number; lng: number } | null) {
  const lat = pin ? Number(pin.lat.toFixed(5)) : null;
  const lng = pin ? Number(pin.lng.toFixed(5)) : null;
  return useQuery({
    queryKey: ['geo', 'reverse', lat, lng],
    queryFn: () => api.get<GeoPlace | null>(`/admin/geo/reverse?lat=${lat}&lng=${lng}`),
    enabled: lat !== null && lng !== null,
    staleTime: Infinity,
    retry: false,
  });
}
