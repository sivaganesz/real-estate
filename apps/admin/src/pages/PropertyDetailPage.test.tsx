import { effectivePermissions, SYSTEM_ROLES } from '@real-estate/shared';
import type { Permission, Property, PropertyTypes, SystemRoleKey } from '@real-estate/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/auth/auth-context';
import type { AuthContextValue } from '@/auth/auth-context';
import { TooltipProvider } from '@/components/ui/tooltip';
import { tokenStore } from '@/lib/api';
import { PropertyDetailPage } from './PropertyDetailPage';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));
// Leaflet needs a real browser; the map itself is not under test here.
vi.mock('@/features/properties/form/LocationMap', () => ({
  default: () => <div>Map</div>,
}));

const ID = (n: number) => `0192f3a4-7b1c-7e2d-9a3f-${String(n).padStart(12, '0')}`;
const attr = (n: number, key: string, label: string, type: 'number' | 'dropdown' = 'number') => ({
  id: ID(n),
  key,
  label,
  type,
  unit: type === 'number' ? 'ft' : null,
  options: type === 'dropdown' ? ['East', 'West'] : [],
  searchFilter: false,
  required: false,
  usedIn: [],
  review: null,
});

const TYPES: PropertyTypes = {
  coreAttributes: [],
  categories: [
    {
      key: 'residential',
      name: 'Residential',
      isActive: true,
      commonAttributes: [attr(1, 'facing', 'Facing', 'dropdown')],
      subcategories: [
        {
          id: ID(101),
          categoryKey: 'residential',
          name: 'Residential plot',
          codePrefix: 'PLT',
          purposes: ['sale'],
          isActive: true,
          propertyCount: 1,
          prefixLocked: true,
          mainAreaMeaning: 'plot',
          legalChecklist: [],
          attributes: [attr(10, 'length', 'Length'), attr(11, 'width', 'Width')],
        },
      ],
      amenities: [],
    },
  ],
};

const PLOT: Property = {
  id: ID(400),
  code: 'RE-PLT-000001',
  categoryKey: 'residential',
  subcategoryId: ID(101),
  subcategoryName: 'Residential plot',
  title: 'Premium residential plot',
  purpose: 'sale',
  price: { amount: 2_800_000, basis: 'total', negotiable: false, onRequest: false },
  rental: null,
  area: { value: 1200, unit: 'sqft', sqft: 1200 },
  location: {
    state: 'Tamil Nadu',
    city: 'Madurai',
    locality: 'Vilangudi',
    pincode: '625018',
    address: '',
    landmark: '',
    mapPin: null,
    roadType: 'Tar road',
    roadWidthFt: 30,
  },
  attributeValues: { facing: 'East', length: 40 },
  hiddenAttributeKeys: [],
  extraAttributes: [],
  removedAttributeKeys: [],
  amenityIds: [],
  media: [],
  status: 'available',
  isFeatured: false,
  publishIssues: [],
  publishedAt: '2026-11-16T03:30:00.000Z',
  statusChangedAt: '2026-11-16T03:30:00.000Z',
  pricePerSqft: 2333,
  highway: null,
  nearby: [
    {
      id: ID(501),
      category: 'School',
      name: 'Kendriya Vidyalaya',
      distanceKm: 1.2,
      routeChecked: true,
      status: 'existing',
    },
    {
      id: ID(502),
      category: 'Other',
      name: 'Outer ring road',
      distanceKm: 3,
      routeChecked: false,
      status: 'planned',
    },
  ],
  legal: [],
  legalSummary: {
    total: 9,
    verified: 8,
    pending: 1,
    notCollected: 0,
    openMandatory: ['Encumbrance certificate'],
  },
  valuation: { reviewDate: null, valuerReport: '', notes: '', comparables: [] },
  archive: null,
  version: 4,
  createdAt: '2026-11-16T03:30:00.000Z',
  updatedAt: '2026-11-16T03:30:00.000Z',
  createdBy: null,
  updatedBy: null,
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function renderAs(role: SystemRoleKey, path: string) {
  const permissions = effectivePermissions(role, SYSTEM_ROLES[role].permissions);
  const auth = {
    status: 'authenticated',
    user: { id: ID(9), name: 'Asha', role, permissions },
    can: (p: Permission) => permissions.includes(p),
  } as unknown as AuthContextValue;
  const routes = (['', '/location', '/media', '/history'] as const).map((suffix) => ({
    path: `/properties/:id${suffix}`,
    element: (
      <PropertyDetailPage
        tab={suffix === '' ? 'specs' : (suffix.slice(1) as 'location' | 'media' | 'history')}
      />
    ),
  }));
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return router;
}

describe('Property page', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const calls = (method: string, part: string) =>
    fetchMock.mock.calls.filter(
      ([url, init]) => (init?.method ?? 'GET') === method && String(url).includes(part),
    );

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    tokenStore.set('token');
    fetchMock.mockImplementation(async (url, init) => {
      const u = String(url);
      if (u.includes('/property-types')) return json(200, { data: TYPES });
      if (u.includes('/geo/')) return json(200, { data: null });
      if (u.includes('/history')) return json(200, { data: [] });
      if (init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body));
        return json(200, {
          data: {
            ...PLOT,
            version: PLOT.version + 1,
            location: { ...PLOT.location, ...body.location },
            nearby: body.nearby
              ? body.nearby.map((n: object, i: number) => ({ id: ID(600 + i), ...n }))
              : PLOT.nearby,
          },
        });
      }
      return json(200, { data: PLOT });
    });
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('header, banner and tabs as in the wireframe; Specifications shows empty values', async () => {
    renderAs('admin', `/properties/${ID(400)}`);
    expect(
      await screen.findByRole('heading', { name: 'Premium residential plot' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('RE-PLT-000001')).toHaveLength(2); // header chip + details
    expect(screen.getAllByText('₹28,00,000')).toHaveLength(2); // header + Asking price (full, as the wireframe)
    expect(screen.getByText('₹2,333 / sq.ft. (plot / land area)')).toBeInTheDocument();
    expect(
      screen.getByText(/Vilangudi, Madurai, Tamil Nadu · 1,200 sq.ft · East facing · listed/),
    ).toBeInTheDocument();
    expect(screen.getByText('Encumbrance certificate')).toBeInTheDocument();

    const tabs = screen.getByRole('navigation', { name: 'Property sections' });
    expect(within(tabs).getByRole('link', { name: 'Specifications' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    // Legal and Pricing come in later steps: shown, not clickable.
    expect(within(tabs).queryByRole('link', { name: /Legal/ })).toBeNull();
    expect(within(tabs).getByText('8/9')).toBeInTheDocument();

    const main = screen.getByLabelText('Main property information');
    expect(within(main).getByText('Plot / land area')).toBeInTheDocument();
    const b = screen.getByLabelText('Residential plot specifications');
    expect(within(b).getByText('40 ft')).toBeInTheDocument();
    expect(within(b).getByText('Not recorded')).toBeInTheDocument(); // Width
  });

  it('Location tab: a field saves on its own with the version; places add and preview', async () => {
    renderAs('admin', `/properties/${ID(400)}/location`);
    const width = await screen.findByLabelText(/Road width \(ft\)/);
    expect(width).toHaveValue('30');
    await userEvent.clear(width);
    await userEvent.type(width, '40');
    await userEvent.tab();

    await vi.waitFor(() => expect(calls('PATCH', '/location')).toHaveLength(1));
    const [, init] = calls('PATCH', '/location')[0]!;
    expect((init!.headers as Record<string, string>)['if-match']).toBe('"4"');
    expect(JSON.parse(String(init!.body))).toEqual({ location: { roadWidthFt: 40 } });

    // The preview follows the advertising rules (PROP-25/26).
    expect(screen.getByText('OK to advertise')).toBeInTheDocument();
    expect(screen.getByText('Not an existing benefit')).toBeInTheDocument();
    expect(screen.getByText('Kendriya Vidyalaya — 1.2 km')).toBeInTheDocument();
    expect(screen.getByText('Future infrastructure — not yet existing')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Add place' }));
    await vi.waitFor(() => expect(calls('PATCH', '/location')).toHaveLength(2));
    const added = JSON.parse(String(calls('PATCH', '/location')[1]![1]!.body));
    expect(added.nearby).toHaveLength(3);
    expect(added.nearby[2]).toEqual({
      category: 'School',
      name: '',
      distanceKm: null,
      routeChecked: false,
      status: 'existing',
    });
    // A bad value is caught before saving and shown next to the field.
    await userEvent.clear(screen.getByLabelText(/Highway distance/));
    await userEvent.type(screen.getByLabelText(/Highway distance/), 'far');
    await userEvent.tab();
    expect(await screen.findByText('Enter the distance in km')).toBeInTheDocument();
    expect(calls('PATCH', '/location')).toHaveLength(2);
  });

  it('Sales Executives see the Location tab read-only and no status or Edit actions', async () => {
    renderAs('sales_executive', `/properties/${ID(400)}/location`);
    expect(await screen.findByLabelText(/Road width \(ft\)/)).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Add place' })).toBeNull();
    expect(screen.queryByLabelText('Change status')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull();
    expect(screen.getByText('Read only')).toBeInTheDocument();
  });
});
