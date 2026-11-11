import type { AuthUser, User } from '@real-estate/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/auth/auth-context';
import type { AuthContextValue } from '@/auth/auth-context';
import { TooltipProvider } from '@/components/ui/tooltip';
import { tokenStore } from '@/lib/api';
import { UsersList } from './UsersList';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

const base: Omit<User, 'id' | 'name' | 'email' | 'status'> = {
  phone: null,
  role: 'admin',
  locked: false,
  lockedUntil: null,
  failedLoginCount: 0,
  lastLoginAt: null,
  inviteExpiresAt: null,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
};
const id = (n: number) => `0192f3a4-0000-7000-8000-00000000000${n}`;
const users: User[] = [
  {
    ...base,
    id: id(1),
    name: 'Owner',
    email: 'owner@x.com',
    status: 'active',
    role: 'super_admin',
  },
  {
    ...base,
    id: id(2),
    name: 'Priya',
    email: 'priya@x.com',
    status: 'invited',
    inviteExpiresAt: '2099-01-01T00:00:00.000Z',
  },
  {
    ...base,
    id: id(3),
    name: 'Karthik',
    email: 'karthik@x.com',
    status: 'active',
    locked: true,
    lockedUntil: '2099-01-01T00:00:00.000Z',
  },
  { ...base, id: id(4), name: 'Meena', email: 'meena@x.com', status: 'inactive' },
];
const me: AuthUser = {
  id: id(1),
  name: 'Owner',
  email: 'owner@x.com',
  phone: null,
  role: 'super_admin',
  permissions: ['users:manage'],
};

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function renderList() {
  const router = createMemoryRouter([{ path: '/users', element: <UsersList onEdit={vi.fn()} /> }], {
    initialEntries: ['/users'],
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <AuthContext.Provider value={{ user: me, can: () => true } as unknown as AuthContextValue}>
          <RouterProvider router={router} />
        </AuthContext.Provider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return router;
}

const row = (name: string) => screen.getByText(name).closest('li')!;

describe('UsersList', () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    tokenStore.set('token');
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/admin/users/stats'))
        return json({ data: { active: 2, invited: 1, locked: 1, inactive: 1 } });
      const status = new URL(url, 'http://x').searchParams.get('status');
      const items = status === 'invited' ? users.filter((u) => u.status === 'invited') : users;
      return json({
        data: items,
        meta: { page: 1, limit: 20, total: items.length, totalPages: 1 },
      });
    });
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('shows status and the right quick actions for each user', async () => {
    renderList();
    await screen.findByText('Priya');

    expect(within(row('Priya')).getByText('Invited')).toBeInTheDocument();
    expect(within(row('Priya')).getByRole('button', { name: 'Resend invite' })).toBeInTheDocument();

    expect(within(row('Karthik')).getByText('Locked')).toBeInTheDocument();
    expect(
      within(row('Karthik')).getByRole('button', { name: 'Unlock account' }),
    ).toBeInTheDocument();

    expect(within(row('Meena')).getByRole('button', { name: 'Reactivate' })).toBeInTheDocument();
    expect(
      within(row('Meena')).queryByRole('button', { name: 'Deactivate' }),
    ).not.toBeInTheDocument();

    // Your own row: only Edit (no deactivate / reset).
    expect(within(row('Owner')).getByText('You')).toBeInTheDocument();
    expect(
      within(row('Owner')).queryByRole('button', { name: 'Deactivate' }),
    ).not.toBeInTheDocument();
    expect(within(row('Owner')).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('filters by status when a summary card is clicked', async () => {
    const router = renderList();
    await screen.findByText('Meena');
    expect(screen.getByRole('button', { name: /All users/ })).toHaveTextContent('4');

    await userEvent.click(screen.getByRole('button', { name: /^1\s*Invited/ }));
    await waitFor(() => expect(router.state.location.search).toBe('?status=invited'));
    await waitFor(() => expect(screen.queryByText('Meena')).not.toBeInTheDocument());
    expect(screen.getByText('Priya')).toBeInTheDocument();
  });

  it('opens the deactivate confirmation from the list', async () => {
    renderList();
    await screen.findByText('Karthik');
    await userEvent.click(within(row('Karthik')).getByRole('button', { name: 'Deactivate' }));
    expect(await screen.findByText('Deactivate Karthik?')).toBeInTheDocument();
  });
});
