import { Building2Icon } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * The company logo in a rounded tile, or the default building icon when there is no logo
 * (or it fails to load). Size it with `className` (default size-9).
 */
export function CompanyLogo({
  url,
  name,
  className,
}: {
  url?: string | null;
  name?: string;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (url && failedUrl !== url) {
    return (
      <img
        src={url}
        alt={name ? `${name} logo` : 'Company logo'}
        onError={() => setFailedUrl(url)}
        className={cn(
          'size-9 shrink-0 rounded-xl border bg-white object-contain p-0.5 shadow-xs',
          className,
        )}
      />
    );
  }
  return (
    <span
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs',
        className,
      )}
    >
      <Building2Icon className="size-[55%]" aria-hidden />
    </span>
  );
}
