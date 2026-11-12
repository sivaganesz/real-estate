import { permissionsFor } from '@real-estate/shared';
import type { AuthUser, InviteInfo } from '@real-estate/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/auth/auth-context';
import type { AuthContextValue } from '@/auth/auth-context';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { AcceptInvitePage } from './AcceptInvitePage';

const invite: InviteInfo = {
  name: 'Agent Ravi',
  email: 'ravi@company.com',
  role: 'sales_agent',
  invitedBy: 'Owner Sam',
};

const ravi: AuthUser = {
  id: '0192f3a4-0000-7000-8000-000000000009',
  name: 'Agent Ravi',
  email: 'ravi@company.com',
  phone: null,
  role: 'sales_agent',
  permissions: [...permissionsFor('sales_agent')],
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function renderAt(url: string) {
  const startSession = vi.fn(() => ravi);
  const auth = { startSession } as unknown as AuthContextValue;
  const router = createMemoryRouter(
    [
      { path: '/accept-invite', element: <AcceptInvitePage /> },
      { path: '/properties', element: <p>Properties home</p> },
      { path: '/login', element: <p>Sign in page</p> },
    ],
    { initialEntries: [url] },
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <ThemeProvider>
          <TooltipProvider>
            <RouterProvider router={router} />
          </TooltipProvider>
        </ThemeProvider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return { startSession, router };
}

describe('AcceptInvitePage', () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('explains an incomplete link without calling the API', async () => {
    renderAt('/accept-invite');
    expect(await screen.findByText(/This invite link is incomplete/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the API message for an expired or used link', async () => {
    fetchMock.mockResolvedValue(
      json(400, {
        error: { code: 'INVALID_TOKEN', message: 'This invite link has expired.', requestId: 'r1' },
      }),
    );
    renderAt('/accept-invite?token=old-token');
    expect(await screen.findByText('Invite link not valid')).toBeInTheDocument();
    expect(screen.getByText(/This invite link has expired\./)).toBeInTheDocument();
  });

  it('greets the invited user, checks the passwords, then activates and signs in', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, { data: invite }))
      .mockResolvedValueOnce(
        json(200, { data: { accessToken: 'new-access', user: ravi, expiresIn: 900 } }),
      );
    const { startSession, router } = renderAt('/accept-invite?token=good-token');

    expect(await screen.findByText('Welcome, Agent Ravi')).toBeInTheDocument();
    expect(screen.getByText(/Owner Sam invited you/)).toBeInTheDocument();
    expect(screen.getByText('Sales Agent')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('ravi@company.com');

    await userEvent.type(screen.getByLabelText('Password'), 'house123');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'house999');
    await userEvent.click(screen.getByRole('button', { name: 'Activate account' }));
    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await userEvent.clear(screen.getByLabelText('Confirm password'));
    await userEvent.type(screen.getByLabelText('Confirm password'), 'house123');
    await userEvent.click(screen.getByRole('button', { name: 'Activate account' }));

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/properties'));
    expect(startSession).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(String(url)).toContain('/auth/accept-invite');
    expect(JSON.parse(String(init?.body))).toEqual({ token: 'good-token', password: 'house123' });
  });
});
