import type { Category, Property } from '@real-estate/shared';
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
import { useUpdateProperty } from '../api';

/**
 * Moves a property to another subcategory. The code stays the same; details the new
 * subcategory doesn't have are kept but hidden (changing back shows them again).
 */
export function ChangeSubcategoryDialog({
  property,
  category,
  onClose,
}: {
  property: Property;
  category: Category;
  onClose: (changed: boolean) => void;
}) {
  const options = category.subcategories.filter(
    (s) => s.isActive && s.id !== property.subcategoryId,
  );
  const [target, setTarget] = useState(options[0]?.id ?? '');
  const update = useUpdateProperty();
  const next = options.find((s) => s.id === target);
  const current = category.subcategories.find((s) => s.id === property.subcategoryId);

  // Details with a value that the new subcategory doesn't show.
  const nextKeys = new Set(
    [...category.commonAttributes, ...(next?.attributes ?? [])].map((a) => a.key),
  );
  const hidden = (current?.attributes ?? []).filter(
    (a) => property.attributeValues[a.key] !== undefined && !nextKeys.has(a.key),
  );
  const purposeOk = !next || next.purposes.includes(property.purpose);

  const confirm = () =>
    update.mutate(
      { id: property.id, body: { subcategoryId: target } },
      {
        onSuccess: () => {
          toast.success(`Moved to ${next?.name}`);
          onClose(true);
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );

  const items = options.map((s) => ({ value: s.id, label: s.name }));

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Change the subcategory of {property.code}?</AlertDialogTitle>
          <AlertDialogDescription>The property code stays the same.</AlertDialogDescription>
        </AlertDialogHeader>
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            There is no other active subcategory to move to.
          </p>
        ) : (
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="move-to">New subcategory</Label>
              <Select items={items} value={target} onValueChange={(v) => v && setTarget(String(v))}>
                <SelectTrigger id="move-to" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!purposeOk && next && (
              <p className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
                {next.name} can&apos;t be listed for this purpose. Change the purpose first.
              </p>
            )}
            {hidden.length > 0 && purposeOk && (
              <p className="rounded-lg border border-dashed bg-muted/40 p-3 text-sm">
                <b>
                  {hidden.length} detail{hidden.length === 1 ? '' : 's'} won&apos;t show in{' '}
                  {next?.name}:
                </b>{' '}
                {hidden.map((a) => a.label).join(', ')}. Their values are kept but hidden; changing
                back shows them again.
              </p>
            )}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button disabled={!next || !purposeOk || update.isPending} onClick={confirm}>
            {update.isPending && <Loader2Icon className="animate-spin" />}
            Change subcategory
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
