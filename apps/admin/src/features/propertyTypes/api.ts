import type {
  AddAttributeBody,
  AttributeMatch,
  CategoryKey,
  CreateSubcategoryBody,
  PropertyTypes,
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
