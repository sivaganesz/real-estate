import type { ImportBatchDetail } from '@real-estate/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/lib/api';
import { ImportPage } from './ImportPage';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

const ID = '0192f3a4-7b1c-7e2d-9a3f-000000000777';
const SUB = '0192f3a4-7b1c-7e2d-9a3f-000000000101';
const BATCH: ImportBatchDetail = {
  id: ID,
  subcategoryId: SUB,
  subcategoryName: 'Villa / House',
  fileName: 'villas.xlsx',
  status: 'checked',
  rowCount: 4,
  validCount: 2,
  invalidCount: 1,
  duplicateCount: 1,
  unknownColumns: ['Agent notes'],
  importAs: null,
  duplicates: null,
  result: null,
  createdAt: new Date().toISOString(),
  createdBy: { id: SUB, name: 'Asha' },
  importedAt: null,
  rows: [
    {
      row: 2,
      status: 'valid',
      title: 'Villa one',
      city: 'Chennai',
      locality: 'Tambaram',
      price: 12500000,
      errors: [],
      duplicateOf: null,
      outcome: null,
    },
    {
      row: 3,
      status: 'invalid',
      title: 'Bad villa',
      city: 'Chennai',
      locality: '',
      price: null,
      errors: ['Pincode: Enter a valid 6-digit pincode'],
      duplicateOf: null,
      outcome: null,
    },
    {
      row: 4,
      status: 'duplicate',
      title: 'Villa one',
      city: 'Chennai',
      locality: 'Tambaram',
      price: 12500000,
      errors: [],
      duplicateOf: { id: SUB, code: 'RE-VIL-000009', row: null },
      outcome: null,
    },
    {
      row: 5,
      status: 'valid',
      title: 'Villa two',
      city: 'Chennai',
      locality: 'Tambaram',
      price: 9000000,
      errors: [],
      duplicateOf: null,
      outcome: null,
    },
  ],
};
const DONE: ImportBatchDetail = {
  ...BATCH,
  status: 'imported',
  importAs: 'draft',
  duplicates: 'update',
  result: {
    created: 2,
    updated: 1,
    skipped: 1,
    failed: 0,
    savedAsDraft: 0,
    imagesAdded: 0,
    imagesFailed: 0,
  },
  rows: BATCH.rows.map((r) => ({
    ...r,
    outcome:
      r.status === 'invalid'
        ? 'Not imported: fix the errors and upload again'
        : 'Created RE-VIL-000010',
  })),
};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

describe('ImportPage → review and import', () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    tokenStore.set('token');
    fetchMock.mockImplementation(async (_url, init) =>
      json({ data: init?.method === 'POST' ? DONE : BATCH }),
    );
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('shows the checked rows, then imports with the chosen options', async () => {
    const router = createMemoryRouter(
      [{ path: '/imports/:id', element: <ImportPage tab="batch" /> }],
      { initialEntries: [`/imports/${ID}`] },
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Step 3 · Review')).toBeInTheDocument();
    expect(screen.getByText(/Agent notes/)).toBeInTheDocument();
    // Opens on the invalid rows
    const table = screen.getByRole('table', { name: 'Checked rows' });
    expect(within(table).getByText('Pincode: Enter a valid 6-digit pincode')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /Duplicates/ }));
    expect(within(table).getByText('Already exists as RE-VIL-000009')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Import 2 properties' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /Update the existing properties/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Import 3 properties' }));

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(String(post[0])).toBe(`/api/v1/admin/imports/${ID}/commit`);
    expect(JSON.parse(String(post[1]!.body))).toEqual({ importAs: 'draft', duplicates: 'update' });
    expect(await screen.findByText('Import finished')).toBeInTheDocument();
    expect(screen.getByText(/2 created · 1 updated · 1 skipped/)).toBeInTheDocument();
  });
});
