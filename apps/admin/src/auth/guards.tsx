import type { Permission } from '@real-estate/shared';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { FullPageSpinner } from '@/components/FullPageSpinner';
import { NoAccessPage } from '@/pages/NoAccessPage';
import { homePathFor, useAuth } from './auth-context';

/** Only for signed-in users; otherwise go to /login and come back afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'anonymous')
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

/** Login and password pages: signed-in users go straight to their home page. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'authenticated' && user) return <Navigate to={homePathFor(user)} replace />;
  return children;
}

/** Shows the 403 page when the user's role doesn't include the permission. */
export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const { can } = useAuth();
  return can(permission) ? children : <NoAccessPage />;
}

/** "/" sends each role to its home page. */
export function HomeRedirect() {
  const { user } = useAuth();
  return user ? <Navigate to={homePathFor(user)} replace /> : null;
}
