import { effectivePermissions, SYSTEM_ROLES } from '@real-estate/shared';
import type {
  Permission,
  Property,
  PropertyListItem,
  PropertyTypes,
  SystemRoleKey,
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
          review: null,
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
          mainAreaMeaning: 'built_up',
          legalChecklist: [],
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
              review: null,
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
              review: null,
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
  pricePerSqft: 5952,
  legalSummary: { total: 9, verified: 8, pending: 1, notCollected: 0, openMandatory: [] },
  publishedAt: null,
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
    roadType: '',
    roadWidthFt: null,
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
  pricePerSqft: null,
  highway: null,
  nearby: [],
  legal: [],
  legalSummary: { total: 0, verified: 0, pending: 0, notCollected: 0, openMandatory: [] },
  valuation: { reviewDate: null, valuerReport: '', notes: '', comparables: [] },
  archive: null,
  version: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: null,
  updatedBy: null,
};

/** New property: choose "Villa / House" in the grouped type dropdown. */
async function pickType() {
  await userEvent.click(await screen.findByLabelText('Property type *'));
  await userEvent.click(await screen.findByRole('option', { name: 'Villa / House' }));
}

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
    user: {
      id: ID(9),
      name: 'Asha',
      email: 'a@x.com',
      phone: null,
      role,
      roleName: SYSTEM_ROLES[role].name,
      permissions,
    },
    can: (p: Permission) => permissions.includes(p),
  } as unknown as AuthContextValue;
  const router = createMemoryRouter(
    [
      { path: '/properties', element: <PropertiesPage /> },
      { path: '/properties/new', element: <PropertyFormPage /> },
      { path: '/properties/:id/edit', element: <PropertyFormPage /> },
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
            available: 1,
            under_negotiation: 0,
            reserved: 0,
            on_hold: 0,
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
      if (u.endsWith(`/admin/properties/${ID(400)}`)) return json(200, { data: savedProperty });
      return json(200, {
        data: [
          row(1, {
            legalSummary: {
              total: 9,
              verified: 6,
              pending: 2,
              notCollected: 1,
              openMandatory: ['Encumbrance certificate'],
            },
          }),
          row(2, {
            status: 'available',
            isFeatured: true,
            publishedAt: '2026-11-16T03:30:00.000Z',
          }),
        ],
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
    expect(within(table).getAllByText('₹5,952/sq.ft.')).toHaveLength(2);
    // Legal chip: amber with the open mandatory check named, or n/total verified.
    expect(within(table).getByText('6/9 verified').closest('[title]')).toHaveAttribute(
      'title',
      'Mandatory checks unresolved: Encumbrance certificate',
    );
    expect(within(table).getByText('8/9 verified')).toBeInTheDocument();
    expect(within(table).getByText('16 Nov 2026')).toBeInTheDocument();
    expect(within(table).getByText('Not listed')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Property specification database' })).toBeVisible();
    expect(screen.getByText('Add property')).toBeInTheDocument();
    expect(await screen.findByTestId('list-footer')).toHaveTextContent(/^2 shown · 2 active\./);

    // Status is a dropdown with counts (no tab row to overflow); filters go to the URL.
    await userEvent.click(screen.getByLabelText('Status'));
    await userEvent.click(await screen.findByRole('option', { name: 'Draft (1)' }));
    await vi.waitFor(() => expect(callsTo('GET', 'status=draft')).not.toHaveLength(0));
    await userEvent.click(screen.getByLabelText('Legal checks'));
    await userEvent.click(await screen.findByRole('option', { name: 'Mandatory checks open' }));
    await vi.waitFor(() => expect(callsTo('GET', 'legal=open')).not.toHaveLength(0));
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all on this page' }));
    await userEvent.click(
      within(screen.getByRole('region', { name: 'Bulk actions' })).getByRole('button', {
        name: 'Change status…',
      }),
    );
    await userEvent.click(screen.getByLabelText('New status'));
    await userEvent.click(await screen.findByRole('option', { name: 'Available' }));
    await userEvent.click(screen.getByRole('button', { name: 'Change status' }));

    const [, init] = callsTo('POST', '/bulk-status')[0]!;
    expect(JSON.parse(String(init!.body))).toEqual({
      ids: [ID(301), ID(302)],
      status: 'available',
    });
    expect(await screen.findByText("1 couldn't change:")).toBeInTheDocument();
    expect(screen.getByText(': Add at least one photo')).toBeInTheDocument();
  });

  it('Sales Executives see the list without selection, Add or edit actions', async () => {
    renderAs('sales_executive', '/properties');
    expect(await screen.findByText('Villa number 1')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Select all on this page' })).toBeNull();
    expect(screen.queryByText('Add property')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Actions for RE-VIL-000001' }));
    expect(await screen.findByRole('menuitem', { name: 'View' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).toBeNull();
  });

  it('Add property: checks the form, sends the values, and opens the edit page for photos', async () => {
    const router = renderAs('admin', '/properties/new');
    expect(await screen.findByLabelText('Property code')).toHaveValue('Auto: on first save');
    await pickType();
    // The type fills in the derived category, the code prefix and the area label.
    expect(screen.getByLabelText('Property category')).toHaveValue('Residential');
    expect(screen.getByLabelText('Property code')).toHaveValue('Auto: RE-VIL-…');
    expect(screen.getByLabelText('Built-up area *')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Property name *'), 'Vil');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(
      await screen.findByText('Property name must be at least 5 characters'),
    ).toBeInTheDocument();
    expect(callsTo('POST', '/admin/properties')).toHaveLength(0);

    await userEvent.type(screen.getByLabelText('Property name *'), 'la near station');
    await userEvent.type(screen.getByLabelText('Asking price (₹) *'), '9000000');
    expect(screen.getByText('₹90 L')).toBeInTheDocument();
    // Live price per sq.ft. (PROP-59), worked out like the API does.
    expect(screen.getByLabelText('Asking price per sq.ft.')).toHaveValue('—');
    await userEvent.type(screen.getByLabelText('Built-up area *'), '1500');
    expect(screen.getByLabelText('Asking price per sq.ft.')).toHaveValue('₹6,000');
    await userEvent.type(screen.getByLabelText('Road width (ft)'), '30');
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
      area: { value: 1500, unit: 'sqft' },
      location: { roadType: '', roadWidthFt: 30 },
      attributeValues: { facing: null, bhk: '3 BHK', floors: null },
      removedAttributeKeys: ['floors'],
      amenityIds: [ID(201)],
    });
  }, 20_000);

  it('Edit: keeps road details on save, and a 409 shows who changed it', async () => {
    const loaded: Property = {
      ...savedProperty,
      version: 3,
      location: {
        ...savedProperty.location,
        city: 'Madurai',
        locality: 'Vilangudi',
        roadType: 'Tar road',
        roadWidthFt: 30,
      },
    };
    const theirs: Property = {
      ...loaded,
      title: 'Villa near the new station',
      version: 4,
      updatedBy: { id: ID(9), name: 'Priya' },
    };
    let detailCalls = 0;
    fetchMock.mockImplementation(async (url, init) => {
      const u = String(url);
      if (u.includes('/property-types')) return json(200, { data: TYPES });
      if (u.includes('/location-suggestions')) return json(200, { data: [] });
      if (init?.method === 'PATCH') {
        return json(409, {
          error: { code: 'VERSION_CONFLICT', message: 'Changed by someone else' },
        });
      }
      if (u.endsWith(`/admin/properties/${ID(400)}`)) {
        detailCalls += 1;
        return json(200, { data: detailCalls === 1 ? loaded : theirs });
      }
      return json(200, { data: [] });
    });
    renderAs('admin', `/properties/${ID(400)}/edit`);
    expect(await screen.findByLabelText('Road width (ft)')).toHaveValue('30');
    expect(screen.getByLabelText('Property code')).toHaveValue('RE-VIL-000003');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Property name *'), ' (garden)');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    const [, init] = callsTo('PATCH', `/admin/properties/${ID(400)}`)[0]!;
    expect((init!.headers as Record<string, string>)['if-match']).toBe('"3"');
    // The whole location is sent, so the road details must go back unchanged.
    expect(JSON.parse(String(init!.body)).location).toMatchObject({
      roadType: 'Tar road',
      roadWidthFt: 30,
    });
    expect(
      await screen.findByRole('alertdialog', { name: 'RE-VIL-000003 was changed by Priya' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Load their version' }));
    expect(screen.getByLabelText('Property name *')).toHaveValue('Villa near the new station');
  }, 20_000);

  it('Add attribute for the whole type: summary first; Cancel keeps the inputs and saves nothing', async () => {
    fetchMock.mockImplementation(async (url, init) => {
      const u = String(url);
      if (u.endsWith('/attributes/preview')) {
        return json(200, {
          data: {
            label: 'Servant room',
            type: 'yes_no',
            unit: null,
            options: [],
            required: false,
            targetName: 'Residential › Villa / House',
            existingProperties: 2,
            usedIn: [],
          },
        });
      }
      if (u.includes('/property-types/attributes')) return json(200, { data: [] });
      if (u.includes('/property-types'))
        return json(init?.method === 'POST' ? 201 : 200, { data: TYPES });
      if (u.includes('/location-suggestions')) return json(200, { data: [] });
      return json(200, { data: [] });
    });
    renderAs('admin', '/properties/new');
    await pickType();
    await userEvent.click(screen.getByRole('button', { name: 'Add attribute' }));
    await userEvent.type(screen.getByLabelText('Attribute name *'), 'Servant room');
    await userEvent.click(screen.getByLabelText(/All properties under Residential/));
    await userEvent.click(screen.getByRole('button', { name: 'Review and add…' }));

    // The confirmation summary with the impact (PROP-18).
    const summary = await screen.findByRole('alertdialog', {
      name: 'Add “Servant room” to settings?',
    });
    expect(within(summary).getByText('Residential › Villa / House')).toBeInTheDocument();
    expect(within(summary).getByText('2 existing properties')).toBeInTheDocument();
    const added = () =>
      fetchMock.mock.calls.filter(
        ([u, i]) =>
          i?.method === 'POST' && String(u).endsWith(`/subcategories/${ID(101)}/attributes`),
      );

    // Cancel: back to the details, inputs kept, nothing saved.
    await userEvent.click(within(summary).getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByLabelText('Attribute name *')).toHaveValue('Servant room');
    expect(added()).toHaveLength(0);

    // Confirm: saved once, marked as coming from a property form.
    await userEvent.click(screen.getByRole('button', { name: 'Review and add…' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Confirm and add to settings' }),
    );
    await vi.waitFor(() => expect(added()).toHaveLength(1));
    expect(JSON.parse(String(added()[0]![1]!.body))).toMatchObject({
      source: 'new',
      label: 'Servant room',
      type: 'text',
      origin: 'property',
      propertyId: null,
      confirmed: true,
    });
  }, 20_000);

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
    await pickType();
    await userEvent.type(screen.getByLabelText('Property name *'), 'Villa near station');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Floors: Enter a number')).toBeInTheDocument();
  });
});
