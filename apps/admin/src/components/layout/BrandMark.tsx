import { Building2Icon } from 'lucide-react';

/** Logo + product name. The company logo and name come from Settings → Company info (step 1.7). */
export function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Building2Icon className="size-5" />
      </div>
      <div className="leading-tight">
        <div className="font-semibold">Real Estate</div>
        <div className="text-xs text-muted-foreground">Admin Portal</div>
      </div>
    </div>
  );
}
