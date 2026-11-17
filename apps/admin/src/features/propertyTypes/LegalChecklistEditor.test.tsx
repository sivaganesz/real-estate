import type { LegalChecklistItemInput } from '@real-estate/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/lib/api';
import { CostAssumptionsPage } from '@/pages/CostAssumptionsPage';
import { LegalChecklistEditor } from './LegalChecklistEditor';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function Harness({ onChange }: { onChange: (v: LegalChecklistItemInput[]) => void }) {
  const [value, setValue] = useState<LegalChecklistItemInput[]>([
    { key: 'sale_deed', label: 'Sale deed', verifies: 'Current ownership', mandatory: true },
  ]);
  return (
    <LegalChecklistEditor
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    />
  );
}

describe('LegalChecklistEditor (SET-03)', () => {
  it('adds a standard check, a custom check, toggles mandatory and reorders', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    expect(screen.getByRole('checkbox', { name: 'Sale deed is mandatory' })).toBeChecked();

    await userEvent.click(screen.getByRole('combobox', { name: 'Add a check' }));
    await userEvent.click(
      await screen.findByRole('option', { name: 'Encumbrance Certificate (EC)' }),
    );
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Encumbrance Certificate (EC) is mandatory' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Move Encumbrance Certificate (EC) up' }),
    );

    await userEvent.click(screen.getByRole('combobox', { name: 'Add a check' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Custom check…' }));
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Name of the new check' }),
      'Mutation certificate{Enter}',
    );

    const last = onChange.mock.calls.at(-1)![0] as LegalChecklistItemInput[];
    expect(last.map((c) => [c.key, c.mandatory])).toEqual([
      ['encumbrance_certificate', true],
      ['sale_deed', true],
      ['mutation_certificate', false],
    ]);
  });
});

describe('CostAssumptionsPage (SET-04)', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    tokenStore.set('token');
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('shows the defaults with a worked example and saves with the version it loaded', async () => {
    const loaded = {
      stampDutyPct: 7,
      registrationPct: 4,
      otherPct: 1,
      updatedAt: null,
      version: 3,
    };
    fetchMock.mockImplementation(async (_url, init) =>
      init?.method === 'PUT'
        ? json(200, { data: { ...loaded, registrationPct: 1, version: 4 } })
        : json(200, { data: loaded }),
    );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <CostAssumptionsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const reg = await screen.findByLabelText('Registration fee (%)');
    await waitFor(() => expect(reg).toHaveValue(4));
    // ₹28 L × (1 + 12%) = ₹31,36,000
    expect(screen.getByText('₹31,36,000')).toBeInTheDocument();
    await userEvent.clear(reg);
    await userEvent.type(reg, '1');
    expect(screen.getByText('₹30,52,000')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'PUT')).toBe(true),
    );
    const [, init] = fetchMock.mock.calls.find(([, i]) => i?.method === 'PUT')!;
    expect((init!.headers as Record<string, string>)['if-match']).toBe('"3"');
    expect(JSON.parse(String(init!.body))).toEqual({
      stampDutyPct: 7,
      registrationPct: 1,
      otherPct: 1,
    });
  });
});
