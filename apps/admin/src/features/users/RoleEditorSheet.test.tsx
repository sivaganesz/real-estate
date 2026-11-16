import { PERMISSION_GROUPS, PERMISSION_INFO, PERMISSIONS, SCOPED_AREAS } from '@real-estate/shared';
import type { RoleInfo } from '@real-estate/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/lib/api';
import { RoleEditorSheet } from './RoleEditorSheet';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const CATALOG = {
  groups: [...PERMISSION_GROUPS],
  permissions: PERMISSIONS.map((key) => ({
    key,
    label: PERMISSION_INFO[key].label,
    group: PERMISSION_INFO[key].group,
    sensitive: Boolean(PERMISSION_INFO[key].sensitive),
    reserved: Boolean(PERMISSION_INFO[key].reserved),
  })),
  scopedAreas: SCOPED_AREAS.map((a) => ({ ...a, own: [...a.own], all: [...a.all] })),
};

const salesManager: RoleInfo = {
  key: 'sales_manager',
  name: 'Sales Manager',
  description: 'Sales head',
  system: true,
  permissions: ['properties:read', 'customers:read:all', 'customers:write:all'],
  customised: false,
  userCount: 2,
  updatedAt: null,
  updatedBy: null,
  version: 4,
};

function renderSheet(role?: RoleInfo) {
  const onOpenChange = vi.fn();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RoleEditorSheet role={role} roles={[salesManager]} open onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

describe('RoleEditorSheet (PRD §4.2)', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const writes = () =>
    fetchMock.mock.calls.filter(([, init]) => init?.method && init.method !== 'GET');
  beforeEach(() => {
    fetchMock.mockImplementation(async (input, init) => {
      if (String(input).includes('/admin/permissions')) return json(200, { data: CATALOG });
      return json(init?.method === 'POST' ? 201 : 200, { data: { ...salesManager, key: 'r_x' } });
    });
    vi.stubGlobal('fetch', fetchMock);
    tokenStore.set('token');
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('creates a role with ticked permissions and an Own / All scope; users and roles stay Admin only', async () => {
    const { onOpenChange } = renderSheet();
    await userEvent.type(screen.getByLabelText('Role name *'), 'Office staff');
    await userEvent.click(await screen.findByRole('checkbox', { name: /Add and edit properties/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Bulk import' }));
    // Sensitive permission → warning.
    expect(screen.getByText(/Sensitive access included: Bulk import/)).toBeInTheDocument();
    const leads = screen.getByRole('radiogroup', { name: 'Leads & customers' });
    await userEvent.click(within(leads).getByRole('radio', { name: 'Own only' }));
    // Reserved permissions are shown locked, never as checkboxes.
    expect(screen.queryByRole('checkbox', { name: 'Invite and manage users' })).toBeNull();
    expect(screen.getAllByText('Admin only')).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: 'Create role' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    const [url, init] = writes()[0]!;
    expect(String(url)).toContain('/admin/roles');
    expect(JSON.parse(String(init?.body))).toEqual({
      name: 'Office staff',
      description: '',
      permissions: expect.arrayContaining([
        'properties:write',
        'imports:run',
        'customers:read:own',
        'customers:write:own',
      ]),
    });
  });

  it('editing a system role: name locked, confirms the users affected, sends If-Match', async () => {
    renderSheet(salesManager);
    expect(screen.getByLabelText('Role name *')).toBeDisabled();
    const reports = await screen.findByRole('radiogroup', { name: 'Reports' });
    await userEvent.click(within(reports).getByRole('radio', { name: 'All' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Change access for 2 user(s)?')).toBeInTheDocument();
    expect(writes()).toHaveLength(0);
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Save changes' }),
    );
    await waitFor(() => expect(writes()).toHaveLength(1));
    const [url, init] = writes()[0]!;
    expect(String(url)).toContain('/admin/roles/sales_manager');
    expect((init?.headers as Record<string, string>)['if-match']).toBe('"4"');
    expect(JSON.parse(String(init?.body))).toEqual({
      permissions: expect.arrayContaining(['reports:read:all', 'customers:read:all']),
    });
  });
});
