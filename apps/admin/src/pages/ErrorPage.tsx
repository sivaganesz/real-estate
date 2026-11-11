import { TriangleAlertIcon } from 'lucide-react';
import { useRouteError } from 'react-router';
import { Button } from '@/components/ui/button';

/** Shown when a screen crashes unexpectedly (router error boundary). */
export function ErrorPage() {
  const error = useRouteError();
  if (import.meta.env.DEV) console.error(error);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <TriangleAlertIcon className="size-6 text-muted-foreground" />
      </div>
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        An unexpected error occurred. Please reload the page. If it keeps happening, contact your
        administrator.
      </p>
      <Button onClick={() => window.location.assign('/')}>Reload</Button>
    </div>
  );
}
