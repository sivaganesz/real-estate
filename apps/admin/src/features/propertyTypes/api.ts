import type {
  AddAttributeBody,
  AttributeMatch,
  CategoryKey,
  CreateAmenityBody,
  CreateSubcategoryBody,
  PropertyTypes,
  UpdateAmenityBody,
  UpdateAttributeBody,
  UpdateSubcategoryBody,
} from '@real-estate/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const PATH = '/admin/property-types';
export const propertyTypesKey = ['property-types'] as const;

/** Where attributes live: a category's common attributes, or one subcategory. */
export type AttributeTarget =
  { kind: 'category'; key: CategoryKey } | { kind: 'subcategory'; id: string };

const targetPath = (t: AttributeTarget) =>
  t.kind === 'category'
    ? `${PATH}/categories/${t.key}/attributes`
    : `${PATH}/subcategories/${t.id}/attributes`;

export function usePropertyTypes() {
  return useQuery({
    queryKey: propertyTypesKey,
    queryFn: () => api.get<PropertyTypes>(PATH),
  });
}

/** Existing attributes matching a name, so admins reuse them instead of making duplicates. */
export function useAttributeSearch(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: [...propertyTypesKey, 'search', term.toLowerCase()],
    queryFn: () => api.get<AttributeMatch[]>(`${PATH}/attributes?q=${encodeURIComponent(term)}`),
    enabled: term.length >= 2,
    staleTime: 30_000,
  });
}

/** Every change returns the full setup, which replaces the cached copy. */
function useSave<V>(request: (vars: V) => Promise<PropertyTypes>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: (data) => {
      queryClient.setQueryData(propertyTypesKey, data);
      void queryClient.invalidateQueries({ queryKey: [...propertyTypesKey, 'search'] });
    },
  });
}

export const useCreateSubcategory = () =>
  useSave((body: CreateSubcategoryBody) => api.post<PropertyTypes>(`${PATH}/subcategories`, body));

export const useUpdateSubcategory = () =>
  useSave(({ id, body }: { id: string; body: UpdateSubcategoryBody }) =>
    api.patch<PropertyTypes>(`${PATH}/subcategories/${id}`, body),
  );

export const useDeleteSubcategory = () =>
  useSave((id: string) => api.delete<PropertyTypes>(`${PATH}/subcategories/${id}`));

export const useAddAttribute = () =>
  useSave(({ target, body }: { target: AttributeTarget; body: AddAttributeBody }) =>
    api.post<PropertyTypes>(targetPath(target), body),
  );

export const useUpdateAttribute = () =>
  useSave(
    ({ target, id, body }: { target: AttributeTarget; id: string; body: UpdateAttributeBody }) =>
      api.patch<PropertyTypes>(`${targetPath(target)}/${id}`, body),
  );

export const useRemoveAttribute = () =>
  useSave(({ target, id }: { target: AttributeTarget; id: string }) =>
    api.delete<PropertyTypes>(`${targetPath(target)}/${id}`),
  );

export const useCreateAmenity = () =>
  useSave(({ categoryKey, body }: { categoryKey: CategoryKey; body: CreateAmenityBody }) =>
    api.post<PropertyTypes>(`${PATH}/categories/${categoryKey}/amenities`, body),
  );

export const useUpdateAmenity = () =>
  useSave(({ id, body }: { id: string; body: UpdateAmenityBody }) =>
    api.patch<PropertyTypes>(`${PATH}/amenities/${id}`, body),
  );

export const useDeleteAmenity = () =>
  useSave((id: string) => api.delete<PropertyTypes>(`${PATH}/amenities/${id}`));

/** Moves amenities on screen straight away, then saves; goes back if the save fails. */
export function useReorderAmenities() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryKey, ids }: { categoryKey: CategoryKey; ids: string[] }) =>
      api.put<PropertyTypes>(`${PATH}/categories/${categoryKey}/amenities/order`, { ids }),
    onMutate: async ({ categoryKey, ids }) => {
      await queryClient.cancelQueries({ queryKey: propertyTypesKey });
      const previous = queryClient.getQueryData<PropertyTypes>(propertyTypesKey);
      if (previous) {
        queryClient.setQueryData<PropertyTypes>(propertyTypesKey, {
          ...previous,
          categories: previous.categories.map((c) =>
            c.key === categoryKey
              ? {
                  ...c,
                  amenities: ids.flatMap((id) => c.amenities.filter((a) => a.id === id)),
                }
              : c,
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(propertyTypesKey, context.previous);
    },
    onSuccess: (data) => queryClient.setQueryData(propertyTypesKey, data),
  });
}
