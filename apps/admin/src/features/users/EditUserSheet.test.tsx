import type { AuthUser, User } from '@real-estate/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/auth/auth-context';
import type { AuthContextValue } from '@/auth/auth-context';
import { tokenStore } from '@/lib/api';
import { EditUserSheet } from './EditUserSheet';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

const me: AuthUser = {
  id: '0192f3a4-0000-7000-8000-000000000001',
  name: 'Owner',
  email: 'owner@company.com',
  phone: null,
  role: 'super_admin',
  permissions: ['users:manage'],
};

const priya: User = {
  id: '0192f3a4-0000-7000-8000-000000000002',
  name: 'Priya Kumar',
  email: 'priya@company.com',
  phone: null,
  role: 'admin',
  status: 'inactive',
  locked: false,
  lockedUntil: null,
  failedLoginCount: 0,
  lastLoginAt: null,
  inviteExpiresAt: null,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function renderSheet(initialUser: User) {
  const auth = { user: me, can: () => true } as unknown as AuthContextValue;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <EditUserSheet userId={initialUser.id} initialUser={initialUser} onClose={vi.fn()} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('EditUserSheet', () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    tokenStore.set('token');
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('updates in place after Reactivate (no need to close and reopen)', async () => {
    const reactivated = { ...priya, status: 'active' as const };
    // Reactivate call, then any refetches return the new state.
    fetchMock.mockImplementation(async (input) =>
      String(input).endsWith('/reactivate')
        ? json(200, { data: reactivated })
        : json(200, { data: reactivated }),
    );

    renderSheet(priya);
    await userEvent.click(screen.getByRole('button', { name: 'Reactivate' }));

    expect(await screen.findByRole('button', { name: 'Deactivate' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeInTheDocument();
    // The click on Reactivate must not carry over to the Deactivate button that replaces it.
    expect(screen.queryByText('Deactivate Priya Kumar?')).not.toBeInTheDocument();
  });

  it('updates in place after Unlock', async () => {
    const locked = {
      ...priya,
      status: 'active' as const,
      locked: true,
      lockedUntil: '2099-01-01T00:00:00.000Z',
    };
    fetchMock.mockImplementation(async () =>
      json(200, { data: { ...locked, locked: false, lockedUntil: null } }),
    );

    renderSheet(locked);
    expect(screen.getAllByText('Locked').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Unlock' }));

    await screen.findByRole('button', { name: 'Deactivate' });
    expect(screen.queryByRole('button', { name: 'Unlock' })).not.toBeInTheDocument();
    expect(screen.queryByText('Locked')).not.toBeInTheDocument();
  });
});
