import type { AuthUser } from '@real-estate/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/auth/auth-context';
import type { AuthContextValue } from '@/auth/auth-context';
import { tokenStore } from '@/lib/api';
import { ProfilePage } from './ProfilePage';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

const me: AuthUser = {
  id: '0192f3a4-0000-7000-8000-000000000003',
  name: 'Agent Ravi',
  email: 'ravi@company.com',
  phone: null,
  role: 'sales_agent',
  permissions: [],
};
const profile = { ...me, lastLoginAt: null, createdAt: '2026-11-01T10:00:00.000Z' };

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function renderPage() {
  const auth = {
    user: me,
    updateUser: vi.fn(),
    startSession: vi.fn(),
  } as unknown as AuthContextValue;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <ProfilePage />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return auth;
}

describe('ProfilePage', () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    tokenStore.set('token');
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('shows the profile and checks that the new passwords match before calling the API', async () => {
    fetchMock.mockResolvedValue(json(200, { data: profile }));
    renderPage();
    expect(await screen.findByDisplayValue('Agent Ravi')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Current password *'), 'old-pass-123');
    await userEvent.type(screen.getByLabelText('New password *'), 'brand-new-pass-7');
    await userEvent.type(screen.getByLabelText('Confirm new password *'), 'something-else-8');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1); // only the profile load
  });

  it('shows a wrong current password next to that field', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { data: profile })).mockResolvedValueOnce(
      json(400, {
        error: { code: 'INVALID_CURRENT_PASSWORD', message: 'Your current password is incorrect.' },
      }),
    );
    const auth = renderPage();
    await screen.findByDisplayValue('Agent Ravi');

    await userEvent.type(screen.getByLabelText('Current password *'), 'wrong-pass-123');
    await userEvent.type(screen.getByLabelText('New password *'), 'brand-new-pass-7');
    await userEvent.type(screen.getByLabelText('Confirm new password *'), 'brand-new-pass-7');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByText('Your current password is incorrect.')).toBeInTheDocument();
    expect(auth.startSession).not.toHaveBeenCalled();
  });
});
