import { canChangeStatus, PROPERTY_STATUS_LABELS, PROPERTY_STATUSES } from '@real-estate/shared';
import type { BulkStatusResult, PropertyStatus, Purpose } from '@real-estate/shared';
import { Loader2Icon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { errorMessage } from '@/lib/errors';
import { useBulkStatus } from './api';

export interface StatusTarget {
  id: string;
  code: string;
  status: PropertyStatus;
  purpose: Purpose;
}

/** Statuses at least one of the selected properties can move to. */
function nextStatuses(targets: StatusTarget[]): PropertyStatus[] {
  return PROPERTY_STATUSES.filter((to) =>
    targets.some((t) => t.status !== to && canChangeStatus(t.status, to, t.purpose)),
  );
}

/**
 * Change the status of one or several properties. Properties that can't change (e.g. not
 * ready to publish) stay as they are, and the dialog lists why.
 */
export function ChangeStatusDialog({
  targets,
  onClose,
}: {
  targets: StatusTarget[];
  onClose: (changed: boolean) => void;
}) {
  const options = nextStatuses(targets);
  const [status, setStatus] = useState<PropertyStatus | ''>(options[0] ?? '');
  const [result, setResult] = useState<BulkStatusResult | null>(null);
  const bulk = useBulkStatus();
  const items = options.map((s) => ({ value: s, label: PROPERTY_STATUS_LABELS[s] }));
  const single = targets.length === 1;

  const submit = () => {
    if (!status) return;
    bulk.mutate(
      { ids: targets.map((t) => t.id), status },
      {
        onSuccess: (res) => {
          if (res.failed.length === 0) {
            toast.success(
              single
                ? `${targets[0]!.code} is now ${PROPERTY_STATUS_LABELS[status]}`
                : `${res.updated.length} properties changed to ${PROPERTY_STATUS_LABELS[status]}`,
            );
            onClose(true);
          } else {
            setResult(res);
          }
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose(Boolean(result?.updated.length))}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {single
              ? `Change status of ${targets[0]!.code}`
              : `Change status of ${targets.length} properties`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Publishing checks each property first: price, area, location, required details and at
            least one photo.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {result ? (
          <div className="grid gap-2 text-sm" role="status">
            {result.updated.length > 0 && (
              <p>
                {result.updated.length} changed to {status && PROPERTY_STATUS_LABELS[status]}.
              </p>
            )}
            <p className="font-medium">{result.failed.length} couldn&apos;t change:</p>
            <ul className="grid max-h-56 gap-1.5 overflow-y-auto rounded-lg border p-3">
              {result.failed.map((f) => (
                <li key={f.id}>
                  <span className="font-medium">{f.code}</span>
                  <span className="text-muted-foreground">: {f.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : options.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {single ? 'This property' : 'These properties'} can&apos;t change status from here.
          </p>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="new-status">New status</Label>
            <Select
              items={items}
              value={status}
              onValueChange={(v) => v && setStatus(v as PropertyStatus)}
            >
              <SelectTrigger id="new-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <AlertDialogFooter>
          {result ? (
            <Button onClick={() => onClose(result.updated.length > 0)}>Done</Button>
          ) : (
            <>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button disabled={!status || bulk.isPending} onClick={submit}>
                {bulk.isPending && <Loader2Icon className="animate-spin" />}
                Change status
              </Button>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
