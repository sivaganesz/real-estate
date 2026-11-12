import type { CommitImportBody, ImportBatch, ImportBatchDetail } from '@real-estate/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, downloadFile, uploadWithProgress } from '@/lib/api';

const PATH = '/admin/imports';
export const importsKeys = {
  list: (page: number) => ['imports', 'list', page] as const,
  detail: (id: string) => ['imports', 'detail', id] as const,
};

export function useImports(page: number) {
  return useQuery({
    queryKey: importsKeys.list(page),
    queryFn: () => api.list<ImportBatch>(`${PATH}?page=${page}&limit=20`),
    placeholderData: keepPreviousData,
  });
}

export function useImport(id: string | undefined) {
  return useQuery({
    queryKey: importsKeys.detail(id ?? 'none'),
    queryFn: () => api.get<ImportBatchDetail>(`${PATH}/${id}`),
    enabled: Boolean(id),
  });
}

export const downloadTemplate = (subcategoryId: string) =>
  downloadFile(`${PATH}/template?subcategoryId=${subcategoryId}`, 'import-template.xlsx');

export const downloadErrorReport = (id: string) =>
  downloadFile(`${PATH}/${id}/error-report`, 'import-errors.xlsx');

/** Uploads the filled template; the API checks every row (nothing is imported yet). */
export function useCheckImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      subcategoryId,
      file,
      onProgress,
    }: {
      subcategoryId: string;
      file: File;
      onProgress?: (f: number) => void;
    }) => {
      const form = new FormData();
      form.append('file', file);
      return uploadWithProgress<ImportBatchDetail>(
        `${PATH}?subcategoryId=${subcategoryId}`,
        form,
        onProgress,
      );
    },
    onSuccess: (batch) => {
      queryClient.setQueryData(importsKeys.detail(batch.id), batch);
      void queryClient.invalidateQueries({ queryKey: ['imports', 'list'] });
    },
  });
}

export function useCommitImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: CommitImportBody }) =>
      api.post<ImportBatchDetail>(`${PATH}/${id}/commit`, body),
    onSuccess: (batch) => {
      queryClient.setQueryData(importsKeys.detail(batch.id), batch);
      void queryClient.invalidateQueries({ queryKey: ['imports', 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['properties'] });
      void queryClient.invalidateQueries({ queryKey: ['property-types'] });
    },
  });
}
