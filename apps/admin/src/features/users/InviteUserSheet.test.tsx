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
  await userEvent.type(screen.getByLabelText('Phone'), '98765 43210');
  await userEvent.click(screen.getByRole('radio', { name: /Sales Agent/ }));
}

describe('InviteUserSheet', () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
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
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the invite and closes', async () => {
    fetchMock.mockResolvedValueOnce(
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
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/v1/admin/users');
    expect(JSON.parse(String(init?.body))).toEqual({
      name: 'Priya Kumar',
      email: 'priya@company.com',
      phone: '+919876543210',
      role: 'sales_agent',
    });
    expect(toastMock.success).toHaveBeenCalledWith('Invite sent to priya@company.com');
  });

  it('shows a duplicate email next to the email field', async () => {
    fetchMock.mockResolvedValueOnce(
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
