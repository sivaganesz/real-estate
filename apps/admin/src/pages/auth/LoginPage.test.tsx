import type { AuthUser } from '@real-estate/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/auth/auth-context';
import type { AuthContextValue } from '@/auth/auth-context';
import { ApiError } from '@/lib/api';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { LoginPage } from './LoginPage';

const admin: AuthUser = {
  id: '0192f3a4-7b1c-7e2d-9a3f-1c2b3d4e5f60',
  name: 'Admin User',
  email: 'admin@company.com',
  phone: null,
  role: 'admin',
  permissions: ['settings:edit', 'properties:read'],
};

function renderLogin(auth: Partial<AuthContextValue> = {}) {
  const value: AuthContextValue = {
    status: 'anonymous',
    user: null,
    signOutReason: null,
    login: vi.fn(),
    startSession: vi.fn(),
    logout: vi.fn(),
    can: () => false,
    ...auth,
  };
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/settings/company', element: <h1>Company settings</h1> },
    ],
    { initialEntries: ['/login'] },
  );
  render(
    <ThemeProvider>
      <AuthContext.Provider value={value}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    </ThemeProvider>,
  );
  return value;
}

describe('LoginPage', () => {
  it('shows validation errors without calling the API', async () => {
    const auth = renderLogin();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it("signs in and goes to the role's home page", async () => {
    const login = vi.fn().mockResolvedValue(admin);
    renderLogin({ login });
    await userEvent.type(screen.getByLabelText('Email'), 'Admin@Company.com');
    await userEvent.type(screen.getByLabelText('Password'), 'secret-pass-1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(login).toHaveBeenCalledWith('admin@company.com', 'secret-pass-1');
    expect(await screen.findByRole('heading', { name: 'Company settings' })).toBeInTheDocument();
  });

  it('shows the API error message (e.g. account locked)', async () => {
    const login = vi
      .fn()
      .mockRejectedValue(
        new ApiError(
          423,
          'ACCOUNT_LOCKED',
          'Account locked after too many failed attempts. Try again in 15 minutes.',
        ),
      );
    renderLogin({ login });
    await userEvent.type(screen.getByLabelText('Email'), 'admin@company.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-pass');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByText(/Account locked/)).toBeInTheDocument());
  });

  it('explains an automatic sign-out after inactivity', () => {
    renderLogin({ signOutReason: 'idle' });
    expect(screen.getByText(/signed out after 30 minutes of inactivity/)).toBeInTheDocument();
  });

  it('lets the user show the password', async () => {
    renderLogin();
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
  });
});
