import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/lib/api';
import { AddressSection } from './AddressSection';
import type { PropertyFormValues } from './formModel';
import { emptyValues } from './formModel';

// The real map needs a browser; this stand-in shows the pin and drops one on click.
vi.mock('./LocationMap', () => ({
  default: ({
    pin,
    onPin,
  }: {
    pin: { lat: number; lng: number } | null;
    onPin: (p: { lat: number; lng: number }) => void;
  }) => (
    <div>
      <span>map pin: {pin ? `${pin.lat},${pin.lng}` : 'none'}</span>
      <button type="button" onClick={() => onPin({ lat: 12.9249123, lng: 80.1000456 })}>
        Click the map
      </button>
    </div>
  ),
}));

const PLACE = {
  lat: 12.9249,
  lng: 80.1,
  label: 'Gandhi Street, Tambaram, Chennai, Tamil Nadu, 600045, India',
  locality: 'Tambaram',
  city: 'Chennai',
  state: 'Tamil Nadu',
  pincode: '600045',
};

let latest: PropertyFormValues;
function Harness({ initial }: { initial?: Partial<PropertyFormValues['location']> }) {
  const form = useForm<PropertyFormValues>({
    defaultValues: { ...emptyValues(), location: { ...emptyValues().location, ...initial } },
  });
  latest = form.watch();
  return <AddressSection form={form} />;
}

function renderSection(initial?: Partial<PropertyFormValues['location']>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Harness initial={initial} />
    </QueryClientProvider>,
  );
}

describe('AddressSection', () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    tokenStore.set('token');
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({ data: PLACE }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('opens and closes; closed, it summarises what was entered', async () => {
    renderSection({ city: 'Chennai' });
    await userEvent.click(screen.getByRole('button', { name: /Full address, landmark & map pin/ }));
    expect(screen.getByLabelText('State')).toBeInTheDocument();
    expect(await screen.findByText('map pin: none')).toBeInTheDocument();
    // The typed city is looked up for the map (through our API).
    await waitFor(() =>
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/admin/geo/search?city=Chennai'),
    );
    expect(
      await screen.findByText('Map shows the typed address. Click the exact spot to drop the pin.'),
    ).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Landmark'), 'Railway station');
    await userEvent.click(screen.getByRole('button', { name: /Close/ }));
    expect(screen.queryByLabelText('State')).toBeNull();
    expect(screen.getByText('near Railway station')).toBeInTheDocument();
  });

  it('dropping a pin fills latitude and longitude and shows the nearest address', async () => {
    renderSection();
    await userEvent.click(screen.getByRole('button', { name: /Full address, landmark & map pin/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Click the map' }));

    expect(screen.getByLabelText('Latitude')).toHaveValue('12.924912');
    expect(screen.getByLabelText('Longitude')).toHaveValue('80.100046');
    expect(screen.getByText('Pin: 12.924912, 80.100046')).toBeInTheDocument();
    expect(await screen.findByText(PLACE.label, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain(
      '/admin/geo/reverse?lat=12.92491&lng=80.1',
    );

    await userEvent.click(screen.getByRole('button', { name: /Fill empty fields from pin/ }));
    expect(latest.location).toMatchObject({
      city: 'Chennai',
      locality: 'Tambaram',
      pincode: '600045',
      state: 'Tamil Nadu',
    });

    await userEvent.click(screen.getByRole('button', { name: /Remove pin/ }));
    expect(screen.getByLabelText('Latitude')).toHaveValue('');
  });

  it('Clear takes the section back to empty', async () => {
    renderSection({ state: 'Tamil Nadu', landmark: 'Temple', lat: '12.9', lng: '80.1' });
    // Opens by itself when it already has details.
    expect(screen.getByLabelText('State')).toHaveValue('Tamil Nadu');
    await userEvent.click(screen.getByRole('button', { name: /Clear/ }));
    expect(latest.location).toMatchObject({
      state: '',
      landmark: '',
      address: '',
      lat: '',
      lng: '',
    });
  });
});
