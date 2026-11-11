import { createBrowserRouter, Navigate } from 'react-router';
import type { RouteObject } from 'react-router';
import { HomeRedirect, PublicOnly, RequireAuth, RequirePermission } from '@/auth/guards';
import { AppLayout } from '@/components/layout/AppLayout';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { CompanySettingsPage } from '@/pages/CompanySettingsPage';
import { ErrorPage } from '@/pages/ErrorPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ProfilePage } from '@/pages/ProfilePage';
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
        path: 'users',
        element: (
          <RequirePermission permission="users:manage">
            <UsersPage />
          </RequirePermission>
        ),
      },
      { path: 'settings', element: <Navigate to="/settings/company" replace /> },
      {
        path: 'settings/company',
        element: (
          <RequirePermission permission="settings:edit">
            <CompanySettingsPage />
          </RequirePermission>
        ),
      },
      { path: 'profile', element: <ProfilePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter([{ errorElement: <ErrorPage />, children: routes }]);
