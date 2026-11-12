import { createBrowserRouter, Navigate } from 'react-router';
import type { RouteObject } from 'react-router';
import { HomeRedirect, PublicOnly, RequireAuth, RequirePermission } from '@/auth/guards';
import { AppLayout } from '@/components/layout/AppLayout';
import { AcceptInvitePage } from '@/pages/auth/AcceptInvitePage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { CompanySettingsPage } from '@/pages/CompanySettingsPage';
import { ErrorPage } from '@/pages/ErrorPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { PropertiesPage } from '@/pages/PropertiesPage';
import { PropertyDetailPage } from '@/pages/PropertyDetailPage';
import { PropertyFormPage } from '@/pages/PropertyFormPage';
import { PropertyTypesPage } from '@/pages/PropertyTypesPage';
import { UsersPage } from '@/pages/UsersPage';

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
        path: 'properties',
        handle: { breadcrumbs: [{ label: 'Properties' }] },
        element: (
          <RequirePermission permission="properties:read">
            <PropertiesPage />
          </RequirePermission>
        ),
      },
      {
        path: 'properties/new',
        handle: {
          breadcrumbs: [{ label: 'Properties', to: '/properties' }, { label: 'Add property' }],
        },
        element: (
          <RequirePermission permission="properties:write">
            <PropertyFormPage />
          </RequirePermission>
        ),
      },
      {
        path: 'properties/:id',
        handle: {
          breadcrumbs: [{ label: 'Properties', to: '/properties' }, { label: 'Property' }],
        },
        element: (
          <RequirePermission permission="properties:read">
            <PropertyDetailPage tab="details" />
          </RequirePermission>
        ),
      },
      {
        path: 'properties/:id/history',
        handle: {
          breadcrumbs: [{ label: 'Properties', to: '/properties' }, { label: 'Change history' }],
        },
        element: (
          <RequirePermission permission="properties:read">
            <PropertyDetailPage tab="history" />
          </RequirePermission>
        ),
      },
      {
        path: 'properties/:id/edit',
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
        handle: { breadcrumbs: [{ label: 'Users & Roles', to: '/users' }, { label: 'Users' }] },
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
        handle: { breadcrumbs: [{ label: 'Account' }, { label: 'My Profile' }] },
        element: <ProfilePage />,
      },
      { path: '*', handle: { breadcrumbs: [{ label: 'Not found' }] }, element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter([{ errorElement: <ErrorPage />, children: routes }]);
