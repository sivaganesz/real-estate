import type { PlacedAttribute, PropertyTypes } from '@real-estate/shared';
import { CORE_ATTRIBUTES } from '@real-estate/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/lib/api';
import { PropertyTypesPage } from './PropertyTypesPage';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

const ID = (n: number) => `0192f3a4-7b1c-7e2d-9a3f-${String(n).padStart(12, '0')}`;
const attr = (n: number, label: string, extra: Partial<PlacedAttribute> = {}): PlacedAttribute => ({
  id: ID(n),
  key: label.toLowerCase().replace(/\W+/g, '_'),
  label,
  type: 'text',
  unit: null,
  options: [],
  searchFilter: false,
  required: false,
  usedIn: [],
  ...extra,
});

const bhk = (usedIn: string[]) =>
  attr(20, 'BHK', { type: 'dropdown', options: ['1 BHK', '2 BHK', '3 BHK'], usedIn });

const SETUP: PropertyTypes = {
  coreAttributes: CORE_ATTRIBUTES.map((a) => ({ ...a })),
  categories: [
    {
      key: 'residential',
      name: 'Residential',
      isActive: true,
      commonAttributes: [attr(1, 'Facing', { type: 'dropdown', options: ['East', 'West'] })],
      subcategories: [
        {
          id: ID(101),
          categoryKey: 'residential',
          name: 'Residential Plot',
          codePrefix: 'PLT',
          purposes: ['sale', 'lease'],
          isActive: true,
          propertyCount: 0,
          prefixLocked: false,
          attributes: [
            attr(10, 'Road width', { type: 'number', unit: 'ft', searchFilter: true }),
            attr(11, 'Corner plot', { type: 'yes_no' }),
          ],
        },
        {
          id: ID(102),
          categoryKey: 'residential',
          name: 'Villa / House',
          codePrefix: 'VIL',
          purposes: ['sale', 'rent', 'lease'],
          isActive: true,
          propertyCount: 0,
          prefixLocked: false,
          attributes: [bhk(['Apartment / Flat'])],
        },
      ],
    },
    {
      key: 'commercial',
      name: 'Commercial',
      isActive: false,
      commonAttributes: [],
      subcategories: [],
    },
  ],
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function renderPage(url = '/settings/property-types') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <PropertyTypesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PropertyTypesPage', () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    tokenStore.set('token');
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  const callsTo = (method: string) =>
    fetchMock.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === method);

  it('shows the categories, the common attributes with locked core rows, and the first subcategory', async () => {
    fetchMock.mockResolvedValue(json(200, { data: SETUP }));
    renderPage();

    expect(
      await screen.findByRole('button', { name: /Residential\s*2 subcategories/ }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Commercial\s*Set up later/ })).toBeDisabled();

    const common = screen.getByRole('table', { name: 'Common attributes' });
    expect(within(common).getAllByText('Locked')).toHaveLength(5);
    expect(within(common).getByText('Property name')).toBeInTheDocument();
    expect(within(common).getByText('Facing')).toBeInTheDocument();

    const plot = screen.getByRole('table', { name: 'Residential Plot attributes' });
    expect(within(plot).getByText('Road width')).toBeInTheDocument();
    expect(within(plot).getByText('Search filter')).toBeInTheDocument();
    expect(within(plot).getByText('· ft')).toBeInTheDocument();
    expect(screen.getByText('Code RE-PLT-… · Sale, Lease')).toBeInTheDocument();
  });

  it('switches subcategory when its card is clicked', async () => {
    fetchMock.mockResolvedValue(json(200, { data: SETUP }));
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Villa \/ House/ }));

    const villa = screen.getByRole('table', { name: 'Villa / House attributes' });
    expect(within(villa).getByText('BHK')).toBeInTheDocument();
    expect(within(villa).getByText('Also in Apartment / Flat')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Residential Plot attributes' })).toBeNull();
  });

  it('adds a new dropdown attribute to the selected subcategory', async () => {
    const updated = structuredClone(SETUP);
    updated.categories[0]!.subcategories[0]!.attributes.push(
      attr(12, 'Plot shape', { type: 'dropdown', options: ['Square', 'Rectangle'] }),
    );
    fetchMock.mockImplementation(async (url, init) => {
      if (init?.method === 'POST') return json(201, { data: updated });
      if (String(url).includes('/attributes?q=')) return json(200, { data: [] });
      return json(200, { data: SETUP });
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Add attribute' }));

    await userEvent.type(screen.getByLabelText('Attribute name *'), 'Plot shape');
    await userEvent.click(screen.getByLabelText('Value type *'));
    await userEvent.click(await screen.findByRole('option', { name: 'Dropdown' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create attribute' }));
    expect(await screen.findByText('Add at least one option')).toBeInTheDocument();
    expect(callsTo('POST')).toHaveLength(0);

    await userEvent.type(screen.getByLabelText('Options *'), 'Square{Enter}Rectangle');
    await userEvent.click(screen.getByRole('button', { name: 'Create attribute' }));

    const [url, init] = callsTo('POST')[0]!;
    expect(url).toBe(`/api/v1/admin/property-types/subcategories/${ID(101)}/attributes`);
    expect(JSON.parse(String(init!.body))).toEqual({
      source: 'new',
      label: 'Plot shape',
      type: 'dropdown',
      unit: '',
      options: ['Square', 'Rectangle'],
      searchFilter: false,
      required: false,
    });
    const plot = await screen.findByRole('table', { name: 'Residential Plot attributes' });
    expect(within(plot).getByText('Plot shape')).toBeInTheDocument();
  });

  it('offers to reuse an existing attribute with the same name', async () => {
    const updated = structuredClone(SETUP);
    updated.categories[0]!.subcategories[0]!.attributes.push(bhk(['Villa / House']));
    fetchMock.mockImplementation(async (url, init) => {
      if (init?.method === 'POST') return json(201, { data: updated });
      if (String(url).includes('/attributes?q=')) {
        return json(200, {
          data: [{ id: ID(20), label: 'BHK', type: 'dropdown', usedIn: ['Villa / House'] }],
        });
      }
      return json(200, { data: SETUP });
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Add attribute' }));
    await userEvent.type(screen.getByLabelText('Attribute name *'), 'bhk');

    expect(
      await screen.findByText('An attribute with this name already exists:'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create attribute' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Use it' }));

    const [, init] = callsTo('POST')[0]!;
    expect(JSON.parse(String(init!.body))).toEqual({
      source: 'existing',
      attributeId: ID(20),
      required: false,
    });
  });

  it('edits an attribute and warns that shared changes apply elsewhere', async () => {
    fetchMock.mockImplementation(async (_url, init) =>
      init?.method === 'PATCH' ? json(200, { data: SETUP }) : json(200, { data: SETUP }),
    );
    renderPage(`/settings/property-types?sub=${ID(102)}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit BHK' }));

    expect(screen.getByText(/also apply to/)).toHaveTextContent('Apartment / Flat');
    expect(screen.getByLabelText('Options *')).toHaveValue('1 BHK\n2 BHK\n3 BHK');
    await userEvent.click(screen.getByRole('checkbox', { name: /Required/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save attribute' }));

    const [url, init] = callsTo('PATCH')[0]!;
    expect(url).toBe(`/api/v1/admin/property-types/subcategories/${ID(102)}/attributes/${ID(20)}`);
    expect(JSON.parse(String(init!.body))).toMatchObject({ label: 'BHK', required: true });
  });

  it('deletes an attribute after confirming', async () => {
    fetchMock.mockImplementation(async (_url, init) =>
      json(200, { data: SETUP, method: init?.method }),
    );
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Corner plot' }));
    expect(
      await screen.findByText(/Delete “Corner plot” from Residential Plot\?/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    const [url] = callsTo('DELETE')[0]!;
    expect(url).toBe(`/api/v1/admin/property-types/subcategories/${ID(101)}/attributes/${ID(11)}`);
  });

  it('adds a subcategory and checks its fields first', async () => {
    const updated = structuredClone(SETUP);
    updated.categories[0]!.subcategories.push({
      ...updated.categories[0]!.subcategories[0]!,
      id: ID(103),
      name: 'Farm house',
      codePrefix: 'FRM',
      attributes: [],
    });
    fetchMock.mockImplementation(async (_url, init) =>
      init?.method === 'POST' ? json(201, { data: updated }) : json(200, { data: SETUP }),
    );
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Add subcategory/ }));

    await userEvent.type(screen.getByLabelText('Code prefix *'), 'F1');
    await userEvent.click(screen.getByRole('button', { name: 'Add subcategory' }));
    expect(await screen.findByText('Name must be at least 2 characters')).toBeInTheDocument();
    expect(screen.getByText('Use exactly 3 letters, e.g. FRM')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Subcategory name *'), 'Farm house');
    await userEvent.clear(screen.getByLabelText('Code prefix *'));
    await userEvent.type(screen.getByLabelText('Code prefix *'), 'frm');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Lease' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add subcategory' }));

    const [, init] = callsTo('POST')[0]!;
    expect(JSON.parse(String(init!.body))).toEqual({
      categoryKey: 'residential',
      name: 'Farm house',
      codePrefix: 'FRM',
      purposes: ['sale', 'lease'],
      isActive: true,
    });
    // The new subcategory is selected.
    expect(await screen.findByText('No attributes yet.', { exact: false })).toBeInTheDocument();
  });
});
