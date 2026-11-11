import { ROLE_LABELS, ROLES } from '@real-estate/shared';

// Placeholder screen. The real layout (sidebar, top bar, routing, shadcn/ui components)
// is built in Phase 1 step 1.8.
export function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
      <div className="w-full max-w-md rounded-lg border border-neutral-300 bg-white p-6">
        <h1 className="text-xl font-bold text-neutral-900">Admin Portal</h1>
        <p className="mt-1 text-sm text-neutral-600">Phase 1 foundation is running.</p>
        <p className="mt-4 text-xs text-neutral-500">
          Roles: {ROLES.map((role) => ROLE_LABELS[role]).join(' · ')}
        </p>
      </div>
    </main>
  );
}
