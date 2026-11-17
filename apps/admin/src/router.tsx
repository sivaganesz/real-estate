import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import type { RouteObject } from 'react-router';
import { HomeRedirect, PublicOnly, RequireAuth, RequirePermission } from '@/auth/guards';
import { AppLayout } from '@/components/layout/AppLayout';
import { AcceptInvitePage } from '@/pages/auth/AcceptInvitePage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { ErrorPage } from '@/pages/ErrorPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

/**
 * Signed-in pages load on demand (code splitting, TRD v2 F1): the first load carries only
 * the shell and the sign-in pages. AppLayout shows a skeleton while a page loads.
 */
const CostAssumptionsPage = lazy(() =>
  import('@/pages/CostAssumptionsPage').then((m) => ({ default: m.CostAssumptionsPage })),
);
const CompanySettingsPage = lazy(() =>
  import('@/pages/CompanySettingsPage').then((m) => ({ default: m.CompanySettingsPage })),
);
const ImportPage = lazy(() =>
  import('@/pages/ImportPage').then((m) => ({ default: m.ImportPage })),
);
const ProfilePage = lazy(() =>
  import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const PropertiesPage = lazy(() =>
  import('@/pages/PropertiesPage').then((m) => ({ default: m.PropertiesPage })),
);
const PropertyDetailPage = lazy(() =>
  import('@/pages/PropertyDetailPage').then((m) => ({ default: m.PropertyDetailPage })),
);
const PropertyFormPage = lazy(() =>
  import('@/pages/PropertyFormPage').then((m) => ({ default: m.PropertyFormPage })),
);
const PropertyTypesPage = lazy(() =>
  import('@/pages/PropertyTypesPage').then((m) => ({ default: m.PropertyTypesPage })),
);
const UsersPage = lazy(() => import('@/pages/UsersPage').then((m) => ({ default: m.UsersPage })));

export const routes: RouteObject[] = [
  {
    path: '/login',
    element: (
      <PublicOnly>
        <LoginPage />
      </PublicOnly>
    ),
  },
  {
    path: '/forgot-password',
    element: (
      <PublicOnly>
        <ForgotPasswordPage />
      </PublicOnly>
    ),
  },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/accept-invite', element: <AcceptInvitePage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomeRedirect /> },
      {
        path: 'imports',
        handle: {
          page: {
            title: 'Bulk import properties',
            description:
              'Add or update many properties at once from a spreadsheet. Every row is checked before anything is saved.',
          },
          breadcrumbs: [{ label: 'Bulk Import' }],
        },
        element: (
          <RequirePermission permission="imports:run">
            <ImportPage tab="new" />
          </RequirePermission>
        ),
      },
      {
        path: 'imports/history',
        handle: {
          page: {
            title: 'Bulk import properties',
            description:
              'Add or update many properties at once from a spreadsheet. Every row is checked before anything is saved.',
          },
          breadcrumbs: [{ label: 'Bulk Import', to: '/imports' }, { label: 'History' }],
        },
        element: (
          <RequirePermission permission="imports:run">
            <ImportPage tab="history" />
          </RequirePermission>
        ),
      },
      {
        path: 'imports/:id',
        handle: {
          page: {
            title: 'Bulk import properties',
            description:
              'Add or update many properties at once from a spreadsheet. Every row is checked before anything is saved.',
          },
          breadcrumbs: [{ label: 'Bulk Import', to: '/imports' }, { label: 'Import' }],
        },
        element: (
          <RequirePermission permission="imports:run">
            <ImportPage tab="batch" />
          </RequirePermission>
        ),
      },
      {
        path: 'properties',
        // The page renders its own header: it carries Add property and Bulk import (PROP-53).
        handle: {
          breadcrumbs: [{ label: 'Properties' }],
        },
        element: (
          <RequirePermission permission="properties:read">
            <PropertiesPage />
          </RequirePermission>
        ),
      },
      {
        path: 'properties/new',
        handle: {
          page: {
            title: 'Add property',
            description:
              'Main information is common to all properties. The specification section below changes with the property type.',
          },
          breadcrumbs: [{ label: 'Properties', to: '/properties' }, { label: 'Add property' }],
        },
        element: (
          <RequirePermission permission="properties:write">
            <PropertyFormPage />
          </RequirePermission>
        ),
      },
      // Property page: one route per tab (PROP-66); the page draws its own header.
      ...(
        [
          ['properties/:id', 'specs', 'Specifications'],
          ['properties/:id/location', 'location', 'Location'],
          ['properties/:id/media', 'media', 'Media'],
        ] as const
      ).map(([path, tab, label]) => ({
        path,
        handle: {
          breadcrumbs: [{ label: 'Properties', to: '/properties' }, { label }],
        },
        element: (
          <RequirePermission permission="properties:read">
            <PropertyDetailPage tab={tab} />
          </RequirePermission>
        ),
      })),
      {
        path: 'properties/:id/history',
        handle: {
          breadcrumbs: [{ label: 'Properties', to: '/properties' }, { label: 'History' }],
        },
        element: (
          <RequirePermission permission="properties:read">
            <PropertyDetailPage tab="history" />
          </RequirePermission>
        ),
      },
      {
        path: 'properties/:id/edit',
        // The page shows "Edit ‹property title›" itself (wireframe).
        handle: {
          breadcrumbs: [{ label: 'Properties', to: '/properties' }, { label: 'Edit property' }],
        },
        element: (
          <RequirePermission permission="properties:write">
            <PropertyFormPage />
          </RequirePermission>
        ),
      },
      {
        path: 'users',
        // No page heading here (owner's choice): the tabs and breadcrumbs say where you are.
        handle: {
          breadcrumbs: [{ label: 'Users & Roles', to: '/users' }, { label: 'Users' }],
        },
        element: (
          <RequirePermission permission="users:manage">
            <UsersPage tab="users" />
          </RequirePermission>
        ),
      },
      {
        path: 'users/roles',
        handle: {
          breadcrumbs: [{ label: 'Users & Roles', to: '/users' }, { label: 'Roles & permissions' }],
        },
        element: (
          <RequirePermission permission="users:manage">
            <UsersPage tab="roles" />
          </RequirePermission>
        ),
      },
      { path: 'settings', element: <Navigate to="/settings/company" replace /> },
      {
        path: 'settings/company',
        // No page heading on Settings (owner's choice): the tabs and breadcrumbs say where you are.
        handle: {
          breadcrumbs: [{ label: 'Settings', to: '/settings' }, { label: 'Company info' }],
        },
        element: (
          <RequirePermission permission="settings:edit">
            <CompanySettingsPage />
          </RequirePermission>
        ),
      },
      {
        path: 'settings/costs',
        handle: {
          breadcrumbs: [{ label: 'Settings', to: '/settings' }, { label: 'Cost assumptions' }],
        },
        element: (
          <RequirePermission permission="settings:edit">
            <CostAssumptionsPage />
          </RequirePermission>
        ),
      },
      {
        path: 'settings/property-types',
        handle: {
          breadcrumbs: [
            { label: 'Settings', to: '/settings' },
            { label: 'Property types & amenities' },
          ],
        },
        element: (
          <RequirePermission permission="settings:edit">
            <PropertyTypesPage tab="attributes" />
          </RequirePermission>
        ),
      },
      {
        path: 'settings/property-types/amenities',
        handle: {
          breadcrumbs: [
            { label: 'Settings', to: '/settings' },
            { label: 'Property types & amenities', to: '/settings/property-types' },
            { label: 'Amenities' },
          ],
        },
        element: (
          <RequirePermission permission="settings:edit">
            <PropertyTypesPage tab="amenities" />
          </RequirePermission>
        ),
      },
      {
        path: 'profile',
        handle: {
          page: { title: 'My Profile', description: 'Your details, password and sign-in history.' },
          breadcrumbs: [{ label: 'Account' }, { label: 'My Profile' }],
        },
        element: <ProfilePage />,
      },
      { path: '*', handle: { breadcrumbs: [{ label: 'Not found' }] }, element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter([{ errorElement: <ErrorPage />, children: routes }]);
