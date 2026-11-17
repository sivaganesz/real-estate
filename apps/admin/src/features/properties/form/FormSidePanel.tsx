import type { Property } from '@real-estate/shared';
import { CheckCircle2Icon, CircleAlertIcon, HistoryIcon } from 'lucide-react';
import { Controller, useFormContext } from 'react-hook-form';
import { Link } from 'react-router';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { formatDate } from '@/lib/format';
import { StatusBadge } from '../StatusBadge';
import type { PropertyFormValues } from './formModel';

/**
 * Side panel (PROP-62): status and listing date, the featured switch, the "Ready to make
 * Available" checklist, and the change history.
 */
export function FormSidePanel({ property }: { property?: Property }) {
  const form = useFormContext<PropertyFormValues>();
  const { isDirty } = form.formState;
  const issues = property?.publishIssues ?? [];

  return (
    <aside className="grid min-w-0 flex-[1_1_260px] content-start gap-4 lg:sticky lg:top-20">
      <Card className="grid gap-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Status</h2>
          <StatusBadge status={property?.status ?? 'draft'} />
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">
          {property?.publishedAt
            ? `Listed on ${formatDate(property.publishedAt)}`
            : 'Not listed yet. The listing date is set the first time it becomes Available.'}
        </p>
        <Controller
          control={form.control}
          name="isFeatured"
          render={({ field }) => (
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="pf-featured" className="text-sm">
                Featured
              </label>
              <Switch id="pf-featured" checked={field.value} onCheckedChange={field.onChange} />
            </div>
          )}
        />
        <div className="grid gap-2 border-t pt-3">
          <span className="text-sm font-medium">Ready to make Available</span>
          {!property ? (
            <p className="text-sm text-muted-foreground">
              Save the draft, then add at least one photo.
            </p>
          ) : issues.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-tone-green">
              <CheckCircle2Icon className="size-4" /> Everything needed is filled in
            </p>
          ) : (
            <ul className="grid gap-1.5 text-sm">
              {issues.map((i) => (
                <li key={i.path} className="flex items-start gap-2">
                  <CircleAlertIcon className="mt-0.5 size-4 flex-none text-tone-amber" />
                  {i.message}
                </li>
              ))}
            </ul>
          )}
          {property && isDirty && (
            <p className="text-xs text-muted-foreground">Updates when you save.</p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Only Available properties are shown to customers.
        </p>
      </Card>
      {property && (
        <Card className="grid gap-2 p-5 text-sm">
          <h2 className="font-semibold">More</h2>
          <Link
            to={`/properties/${property.id}/history`}
            className="inline-flex items-center gap-2 font-medium hover:underline"
          >
            <HistoryIcon className="size-4" /> View change history
          </Link>
        </Card>
      )}
    </aside>
  );
}
