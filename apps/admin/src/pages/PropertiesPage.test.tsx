import { hasPermission, permissionsFor } from '@real-estate/shared';
import type {
  Permission,
  Property,
  PropertyListItem,
  PropertyTypes,
  Role,
} from '@real-estate/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/auth/auth-context';
import type { AuthContextValue } from '@/auth/auth-context';
import { TooltipProvider } from '@/components/ui/tooltip';
import { tokenStore } from '@/lib/api';
import { PropertiesPage } from './PropertiesPage';
import { PropertyFormPage } from './PropertyFormPage';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

const ID = (n: number) => `0192f3a4-7b1c-7e2d-9a3f-${String(n).padStart(12, '0')}`;

const TYPES: PropertyTypes = {
  coreAttributes: [],
  categories: [
    {
      key: 'residential',
      name: 'Residential',
      isActive: true,
      commonAttributes: [
        {
          id: ID(1),
          key: 'facing',
          label: 'Facing',
          type: 'dropdown',
          unit: null,
          options: ['East', 'West'],
          searchFilter: true,
          required: false,
          usedIn: [],
        },
      ],
      subcategories: [
        {
          id: ID(101),
          categoryKey: 'residential',
          name: 'Villa / House',
          codePrefix: 'VIL',
          purposes: ['sale', 'rent', 'lease'],
          isActive: true,
          propertyCount: 2,
          prefixLocked: true,
          attributes: [
            {
              id: ID(10),
              key: 'bhk',
              label: 'BHK',
              type: 'dropdown',
              unit: null,
              options: ['2 BHK', '3 BHK'],
              searchFilter: true,
              required: false,
              usedIn: [],
            },
            {
              id: ID(11),
              key: 'floors',
              label: 'Floors',
              type: 'number',
              unit: null,
              options: [],
              searchFilter: false,
              required: false,
              usedIn: [],
            },
          ],
        },
      ],
      amenities: [
        {
          id: ID(201),
          name: 'Gated community',
          icon: 'fence',
          appliesToAll: true,
          subcategoryIds: [],
          isActive: true,
          propertyCount: 0,
        },
      ],
    },
  ],
};

const row = (n: number, extra: Partial<PropertyListItem> = {}): PropertyListItem => ({
  id: ID(300 + n),
  code: `RE-VIL-00000${n}`,
  title: `Villa number ${n}`,
  categoryKey: 'residential',
  subcategoryId: ID(101),
  subcategoryName: 'Villa / House',
  purpose: 'sale',
  price: { amount: 12_500_000, basis: 'total', negotiable: true, onRequest: false },
  area: { value: 2100, unit: 'sqft', sqft: 2100 },
  location: { city: 'Chennai', locality: 'Tambaram', pincode: '600045' },
  coverUrl: null,
  status: 'draft',
  isFeatured: false,
  updatedAt: new Date().toISOString(),
  ...extra,
});

const savedProperty: Property = {
  id: ID(400),
  code: 'RE-VIL-000003',
  categoryKey: 'residential',
  subcategoryId: ID(101),
  subcategoryName: 'Villa / House',
  title: 'Villa near station',
  purpose: 'sale',
  price: { amount: 9_000_000, basis: 'total', negotiable: false, onRequest: false },
  rental: null,
  area: null,
  location: {
    state: '',
    city: '',
    locality: '',
    pincode: '',
    address: '',
    landmark: '',
    mapPin: null,
  },
  attributeValues: { bhk: '3 BHK' },
  hiddenAttributeKeys: [],
  extraAttributes: [],
  removedAttributeKeys: ['floors'],
  amenityIds: [ID(201)],
  media: [],
  status: 'draft',
  isFeatured: false,
  publishIssues: [{ path: 'media', message: 'Add at least one photo' }],
  publishedAt: null,
  statusChangedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: null,
  updatedBy: null,
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function renderAs(role: Role, path: string) {
  const auth = {
    status: 'authenticated',
    user: {
      id: ID(9),
      name: 'Asha',
      email: 'a@x.com',
      phone: null,
      role,
      permissions: [...permissionsFor(role)],
    },
    can: (p: Permission) => hasPermission(role, p),
  } as unknown as AuthContextValue;
  const router = createMemoryRouter(
    [
      { path: '/properties', element: <PropertiesPage /> },
      { path: '/properties/new', element: <PropertyFormPage /> },
      { path: '/properties/:id/edit', element: <p>Edit page</p> },
      { path: '/properties/:id', element: <p>Detail page</p> },
    ],
    { initialEntries: [path] },
  );
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

describe('Properties pages', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const callsTo = (method: string, part: string) =>
    fetchMock.mock.calls.filter(
      ([url, init]) => (init?.method ?? 'GET') === method && String(url).includes(part),
    );

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    tokenStore.set('token');
    fetchMock.mockImplementation(async (url, init) => {
      const u = String(url);
      if (u.includes('/property-types')) return json(200, { data: TYPES });
      if (u.includes('/status-counts'))
        return json(200, {
          data: {
            all: 2,
            draft: 1,
            published: 1,
            unpublished: 0,
            booked: 0,
            sold: 0,
            rented: 0,
            leased: 0,
            archived: 0,
          },
        });
      if (u.includes('/location-suggestions')) return json(200, { data: [] });
      if (u.includes('/bulk-status')) {
        return json(200, {
          data: {
            updated: [{ id: ID(302), code: 'RE-VIL-000002' }],
            failed: [{ id: ID(301), code: 'RE-VIL-000001', reason: 'Add at least one photo' }],
          },
        });
      }
      if (init?.method === 'POST' && u.endsWith('/admin/properties')) {
        return json(201, { data: savedProperty });
      }
      return json(200, {
        data: [row(1), row(2, { status: 'published', isFeatured: true })],
        meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      });
    });
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('lists properties with status counts, and admins change status in bulk', async () => {
    renderAs('admin', '/properties');
    const table = await screen.findByRole('table', { name: 'Properties' });
    expect(await within(table).findByText('Villa number 1')).toBeInTheDocument();
    expect(within(table).getAllByText('₹1.25 Cr')).toHaveLength(2);
    expect(screen.getByRole('tab', { name: /Draft\s*1/ })).toBeInTheDocument();
    expect(screen.getByText('Add property')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all on this page' }));
    await userEvent.click(
      within(screen.getByRole('region', { name: 'Bulk actions' })).getByRole('button', {
        name: 'Change status…',
      }),
    );
    await userEvent.click(screen.getByLabelText('New status'));
    await userEvent.click(await screen.findByRole('option', { name: 'Published' }));
    await userEvent.click(screen.getByRole('button', { name: 'Change status' }));

    const [, init] = callsTo('POST', '/bulk-status')[0]!;
    expect(JSON.parse(String(init!.body))).toEqual({
      ids: [ID(301), ID(302)],
      status: 'published',
    });
    expect(await screen.findByText("1 couldn't change:")).toBeInTheDocument();
    expect(screen.getByText(': Add at least one photo')).toBeInTheDocument();
  });

  it('Sales Agents see the list without selection, Add or edit actions', async () => {
    renderAs('sales_agent', '/properties');
    expect(await screen.findByText('Villa number 1')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Select all on this page' })).toBeNull();
    expect(screen.queryByText('Add property')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Actions for RE-VIL-000001' }));
    expect(await screen.findByRole('menuitem', { name: 'View' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).toBeNull();
  });

  it('Add property: checks the form, sends the values, and opens the edit page for photos', async () => {
    const router = renderAs('admin', '/properties/new');
    await userEvent.click(await screen.findByRole('button', { name: /Villa \/ House/ }));
    await userEvent.type(screen.getByLabelText('Property name *'), 'Vil');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(
      await screen.findByText('Property name must be at least 5 characters'),
    ).toBeInTheDocument();
    expect(callsTo('POST', '/admin/properties')).toHaveLength(0);

    await userEvent.type(screen.getByLabelText('Property name *'), 'la near station');
    await userEvent.type(screen.getByLabelText('Price (₹) *'), '9000000');
    expect(screen.getByText('₹90 L')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('BHK'));
    await userEvent.click(await screen.findByRole('option', { name: '3 BHK' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove from this property: Floors' }),
    );
    await userEvent.click(screen.getByRole('button', { name: /Gated community/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe(`/properties/${ID(400)}/edit`),
    );
    const [, init] = callsTo('POST', '/admin/properties')[0]!;
    expect(JSON.parse(String(init!.body))).toMatchObject({
      subcategoryId: ID(101),
      title: 'Villa near station',
      purpose: 'sale',
      price: { amount: 9_000_000, basis: 'total', negotiable: false, onRequest: false },
      rental: null,
      area: null,
      attributeValues: { facing: null, bhk: '3 BHK', floors: null },
      removedAttributeKeys: ['floors'],
      amenityIds: [ID(201)],
    });
  });

  it('shows API field errors next to the field', async () => {
    fetchMock.mockImplementation(async (url, init) => {
      const u = String(url);
      if (u.includes('/property-types')) return json(200, { data: TYPES });
      if (u.includes('/location-suggestions')) return json(200, { data: [] });
      if (init?.method === 'POST') {
        return json(400, {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Some fields are invalid',
            details: [{ path: 'body.attributeValues.floors', message: 'Floors: Enter a number' }],
          },
        });
      }
      return json(200, { data: [] });
    });
    renderAs('admin', '/properties/new');
    await userEvent.click(await screen.findByRole('button', { name: /Villa \/ House/ }));
    await userEvent.type(screen.getByLabelText('Property name *'), 'Villa near station');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Floors: Enter a number')).toBeInTheDocument();
  });
});
