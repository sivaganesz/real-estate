import { Navigate, Route, Routes } from 'react-router-dom';
import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import type { Permission } from '@estate/shared';
import { useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { PageLoader, EmptyState } from './components/ui';
import { Login } from './pages/Login';
import { Today } from './pages/Today';

// Pages load when first opened, so the first screen (sign-in, Today) arrives quickly.
const page = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) => lazy(() => load().then((m) => ({ default: m[name] })));
const Settings = page(() => import('./pages/Settings'), 'Settings');
const Properties = page(() => import('./pages/Properties'), 'Properties');
const PropertyDetail = page(() => import('./pages/PropertyDetail'), 'PropertyDetail');
const ProjectDetail = page(() => import('./pages/ProjectDetail'), 'ProjectDetail');
const SharePage = page(() => import('./pages/SharePage'), 'SharePage');
const Import = page(() => import('./pages/Import'), 'Import');
const Leads = page(() => import('./pages/Leads'), 'Leads');
const LeadDetail = page(() => import('./pages/LeadDetail'), 'LeadDetail');
const Calendar = page(() => import('./pages/Calendar'), 'Calendar');
const Deals = page(() => import('./pages/Deals'), 'Deals');
const ProjectWizard = page(() => import('./pages/ProjectWizard'), 'ProjectWizard');
const AssistantPage = page(() => import('./pages/Assistant'), 'AssistantPage');

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
    <Suspense fallback={<PageLoader />}>
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
        <Route path="assistant" element={<AssistantPage />} />
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
        <Route
          path="projects/new"
          element={
            <Allowed permission="project.manage">
              <ProjectWizard />
            </Allowed>
          }
        />
        <Route
          path="projects/:id/edit"
          element={
            <Allowed permission="project.manage">
              <ProjectWizard />
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
    </Suspense>
  );
}
