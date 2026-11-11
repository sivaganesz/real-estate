import { ShieldAlertIcon } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';

/** 403: the user's role doesn't include this module. */
export function NoAccessPage() {
  return (
    <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <ShieldAlertIcon className="size-6 text-muted-foreground" />
      </div>
      <h1 className="text-xl font-semibold">You don&apos;t have access to this page</h1>
      <p className="text-sm text-muted-foreground">
        Your role doesn&apos;t include this module. Ask a Super Admin if you need access.
      </p>
      <Button nativeButton={false} render={<Link to="/profile" />}>
        Go to My Profile
      </Button>
    </div>
  );
}
