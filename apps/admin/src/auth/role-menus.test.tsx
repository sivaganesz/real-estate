import { hasPermission, permissionsFor } from '@real-estate/shared';
import type { AuthUser, Permission, Role } from '@real-estate/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { tokenStore } from '@/lib/api';
import { routes } from '@/router';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { AuthContext } from './auth-context';
import type { AuthContextValue } from './auth-context';

const NAMES: Record<Role, string> = {
  super_admin: 'Owner Sam',
  admin: 'Office Asha',
  sales_agent: 'Agent Ravi',
};

function userFor(role: Role): AuthUser {
  return {
    id: '0192f3a4-0000-7000-8000-000000000001',
    name: NAMES[role],
    email: `${role}@company.com`,
    phone: null,
    role,
    permissions: [...permissionsFor(role)],
  };
}

/** Answers every API call with an empty but valid response for the page being shown. */
function fakeApi(url: string) {
  const body = url.includes('/admin/settings/company')
    ? {
        data: {
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
        },
      }
    : url.includes('/admin/users/stats')
      ? { data: { total: 0, active: 0, invited: 0, locked: 0, inactive: 0 } }
      : url.includes('/admin/users')
        ? { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }
        : url.includes('/admin/properties/status-counts')
          ? {
              data: {
                all: 0,
                draft: 0,
                published: 0,
                unpublished: 0,
                booked: 0,
                sold: 0,
                rented: 0,
                leased: 0,
                archived: 0,
              },
            }
          : url.includes('/admin/properties')
            ? { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }
            : url.includes('/admin/property-types')
              ? { data: { coreAttributes: [], categories: [] } }
              : url.includes('/admin/profile')
                ? {
                    data: {
                      ...userFor('sales_agent'),
                      lastLoginAt: null,
                      createdAt: '2026-11-01T00:00:00.000Z',
                    },
                  }
                : { data: null };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function renderAs(role: Role, path: string) {
  const user = userFor(role);
  const auth = {
    status: 'authenticated',
    user,
    signOutReason: null,
    can: (permission: Permission) => hasPermission(role, permission),
    logout: vi.fn(),
    updateUser: vi.fn(),
    startSession: vi.fn(),
    login: vi.fn(),
  } as unknown as AuthContextValue;
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
  return router;
}

const sidebarLinks = () =>
  within(screen.getAllByRole('navigation', { name: 'Main' })[0]!)
    .queryAllByRole('link')
    .map((a) => a.textContent);

describe('role-based menus and pages', () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockImplementation(async (input) => fakeApi(String(input)));
    vi.stubGlobal('fetch', fetchMock);
    tokenStore.set('token');
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it.each([
    ['super_admin', '/users', ['Properties', 'Bulk Import', 'Users & Roles', 'Settings']],
    ['admin', '/properties', ['Properties', 'Bulk Import', 'Settings']],
    ['sales_agent', '/properties', ['Properties']],
  ] as const)('%s: "/" opens %s and the sidebar shows %j', async (role, home, links) => {
    const router = renderAs(role, '/');
    await vi.waitFor(() => expect(router.state.location.pathname).toBe(home));
    expect(sidebarLinks()).toEqual(links);
  });

  it.each([
    ['admin', '/users'],
    ['admin', '/users/roles'],
    ['sales_agent', '/users'],
    ['sales_agent', '/settings/company'],
  ] as const)('%s opening %s directly sees "no access"', async (role, path) => {
    renderAs(role, path);
    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
  });

  it('every role can open My Profile', async () => {
    for (const role of ['super_admin', 'admin', 'sales_agent'] as const) {
      renderAs(role, '/profile');
      expect(await screen.findByText('Personal details')).toBeInTheDocument();
      expect(screen.queryByText("You don't have access to this page")).not.toBeInTheDocument();
      cleanup();
    }
  });
});
