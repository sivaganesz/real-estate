import type { CompanySettings } from '@real-estate/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/lib/api';
import { CompanySettingsPage } from './CompanySettingsPage';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

const unconfigured: CompanySettings = {
  name: 'Your Company Name',
  shortDescription: '',
  logoUrl: null,
  address: '',
  officeLocation: null,
  phone: null,
  email: null,
  isConfigured: false,
  updatedAt: null,
  updatedBy: null,
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/settings/company']}>
        <CompanySettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CompanySettingsPage', () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    tokenStore.set('token');
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('starts empty before setup and shows errors without calling the API', async () => {
    fetchMock.mockResolvedValue(json(200, { data: unconfigured }));
    renderPage();
    const name = await screen.findByLabelText('Company name *');
    expect(name).toHaveValue('');
    expect(screen.getByText('Not saved yet')).toBeInTheDocument();

    await userEvent.type(name, 'X');
    await userEvent.type(screen.getByLabelText('Latitude'), '12.97');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText('Company name must be at least 2 characters'),
    ).toBeInTheDocument();
    expect(screen.getByText('Enter the office address')).toBeInTheDocument();
    expect(screen.getByText('Enter both latitude and longitude, or neither')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1); // only the initial load
  });

  it('saves the details and shows who updated them', async () => {
    const saved: CompanySettings = {
      ...unconfigured,
      name: 'Skyline Realty',
      address: '12 MG Road, Bengaluru',
      officeLocation: { lat: 12.97, lng: 77.6 },
      phone: '+919876543210',
      email: 'hello@skyline.in',
      isConfigured: true,
      updatedAt: '2026-11-12T08:00:00.000Z',
      updatedBy: { id: '0192f3a4-0000-7000-8000-000000000001', name: 'Asha Admin' },
    };
    fetchMock
      .mockResolvedValueOnce(json(200, { data: unconfigured }))
      .mockResolvedValueOnce(json(200, { data: saved }));
    renderPage();

    await userEvent.type(await screen.findByLabelText('Company name *'), 'Skyline Realty');
    await userEvent.type(screen.getByLabelText('Office address *'), '12 MG Road, Bengaluru');
    await userEvent.type(screen.getByLabelText('Latitude'), '12.97');
    await userEvent.type(screen.getByLabelText('Longitude'), '77.6');
    await userEvent.type(screen.getByLabelText('Phone *'), '9876543210');
    await userEvent.type(screen.getByLabelText('Email *'), 'hello@skyline.in');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText(/Last updated by Asha Admin/)).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(String(url)).toContain('/admin/settings/company');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toMatchObject({
      name: 'Skyline Realty',
      address: '12 MG Road, Bengaluru',
      officeLocation: { lat: 12.97, lng: 77.6 },
      phone: '+919876543210',
      email: 'hello@skyline.in',
    });
  });

  it('checks the logo file before uploading it', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { data: unconfigured }));
    renderPage();
    await screen.findByLabelText('Company name *');
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!;

    await userEvent.upload(input, new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }), {
      applyAccept: false,
    });
    expect(await screen.findByText('Choose a PNG, JPG or WebP image.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(
      json(200, { data: { ...unconfigured, logoUrl: '/uploads/company/logo/abc.png' } }),
    );
    await userEvent.upload(input, new File(['png'], 'logo.png', { type: 'image/png' }));
    expect(await screen.findByRole('button', { name: 'Replace' })).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(String(url)).toContain('/admin/settings/company/logo');
    expect(init?.body).toBeInstanceOf(FormData);
  });
});
