import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { Permission } from '@estate/shared';
import { useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { PageLoader, EmptyState } from './components/ui';
import { Login } from './pages/Login';
import { Today } from './pages/Today';
import { Settings } from './pages/Settings';
import { Properties } from './pages/Properties';
import { PropertyDetail } from './pages/PropertyDetail';
import { ProjectDetail } from './pages/ProjectDetail';
import { SharePage } from './pages/SharePage';
import { Import } from './pages/Import';
import { Leads } from './pages/Leads';
import { LeadDetail } from './pages/LeadDetail';
import { Calendar } from './pages/Calendar';
import { Deals } from './pages/Deals';

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function Allowed({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { can } = useAuth();
  if (!can(permission)) return <EmptyState title="This page isn't part of your role" body="Ask your manager or an admin if you need access." />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/p/:token" element={<SharePage />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Today />} />
        <Route path="leads" element={<Leads />} />
        <Route path="leads/:id" element={<LeadDetail />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="deals" element={<Deals />} />
        <Route path="properties" element={<Properties />} />
        <Route path="properties/:id" element={<PropertyDetail />} />
        <Route
          path="properties/import"
          element={
            <Allowed permission="property.import">
              <Import />
            </Allowed>
          }
        />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route
          path="settings"
          element={
            <Allowed permission="settings.manage">
              <Settings />
            </Allowed>
          }
        />
        <Route path="*" element={<EmptyState title="Page not found" />} />
      </Route>
    </Routes>
  );
}
