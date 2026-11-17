import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/lib/api';
import { InviteUserSheet } from './InviteUserSheet';

const toastMock = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastMock }));

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function renderSheet() {
  const onOpenChange = vi.fn();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <InviteUserSheet open onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

async function fillForm(email = 'priya@company.com') {
  await userEvent.type(screen.getByLabelText('Full name *'), 'Priya Kumar');
  await userEvent.type(screen.getByLabelText('Email *'), email);
  // Spaces and letters are ignored by the phone field; only digits are kept.
  await userEvent.type(screen.getByLabelText('Phone'), '98765 abc43210');
  await userEvent.click(await screen.findByRole('radio', { name: /Sales Executive/ }));
}

const ROLE_OPTIONS = [
  { key: 'admin', name: 'Admin', description: 'Everything', system: true },
  { key: 'sales_manager', name: 'Sales Manager', description: 'Sales head', system: true },
  { key: 'sales_executive', name: 'Sales Executive', description: 'Own leads', system: true },
];

describe('InviteUserSheet', () => {
  const fetchMock = vi.fn<typeof fetch>();
  /** Responses for /admin/users, in order; role options are always answered. */
  const queue: Response[] = [];
  const respondWith = (res: Response) => queue.push(res);
  const userCalls = () =>
    fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/admin/users'));
  beforeEach(() => {
    queue.length = 0;
    fetchMock.mockImplementation(async (input) =>
      String(input).includes('/admin/roles/options')
        ? json(200, { data: ROLE_OPTIONS })
        : queue.shift()!,
    );
    vi.stubGlobal('fetch', fetchMock);
    tokenStore.set('token');
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('validates the form before calling the API', async () => {
    renderSheet();
    await userEvent.click(screen.getByRole('button', { name: 'Send invite' }));
    expect(await screen.findByText('Name must be at least 2 characters')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Choose a role')).toBeInTheDocument();
    expect(userCalls()).toHaveLength(0);
  });

  it('sends the invite and closes', async () => {
    respondWith(
      json(201, {
        data: {
          emailSent: true,
          user: { id: 'u1', name: 'Priya Kumar', email: 'priya@company.com' },
        },
      }),
    );
    const { onOpenChange } = renderSheet();
    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: 'Send invite' }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    const [url, init] = userCalls()[0]!;
    expect(url).toBe('/api/v1/admin/users');
    expect(JSON.parse(String(init?.body))).toEqual({
      name: 'Priya Kumar',
      email: 'priya@company.com',
      phone: '+919876543210',
      role: 'sales_executive',
    });
    expect(toastMock.success).toHaveBeenCalledWith('Invite sent to priya@company.com');
  });

  it('shows a duplicate email next to the email field', async () => {
    respondWith(
      json(409, {
        error: { code: 'DUPLICATE', message: 'A user with this email already exists.' },
      }),
    );
    const { onOpenChange } = renderSheet();
    await fillForm('owner@company.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send invite' }));

    expect(await screen.findByText('A user with this email already exists.')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
