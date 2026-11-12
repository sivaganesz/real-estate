import { zodResolver } from '@hookform/resolvers/zod';
import {
  ATTRIBUTE_TYPE_LABELS,
  ATTRIBUTE_TYPES,
  newAttributeBodySchema,
  normalizeLabel,
  TYPES_WITH_OPTIONS,
} from '@real-estate/shared';
import type { AttributeType, PlacedAttribute } from '@real-estate/shared';
import { Loader2Icon } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField } from '@/components/forms/FormField';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage } from '@/lib/errors';
import { useSettled } from '@/lib/useSettled';
import type { AttributeTarget } from './api';
import { useAddAttribute, useAttributeSearch, useUpdateAttribute } from './api';

/** A place the attribute can be added to, e.g. "All Residential (common)" or "Villa / House". */
export interface AttributePlace {
  value: string;
  label: string;
  target: AttributeTarget;
  /** Ids already used there (or shown on the same form), so they aren't offered for reuse. */
  attributeIds: string[];
}

export type AttributeSheetMode =
  { kind: 'add'; place: string } | { kind: 'edit'; place: string; attribute: PlacedAttribute };

const TYPE_ITEMS = ATTRIBUTE_TYPES.map((t) => ({ value: t, label: ATTRIBUTE_TYPE_LABELS[t] }));

/** Options typed one per line (commas also separate them). */
const parseOptions = (text: string) =>
  text
    .split(/[\n,]/)
    .map((o) => o.trim())
    .filter(Boolean);

const formSchema = z
  .object({
    place: z.string(),
    label: newAttributeBodySchema.shape.label,
    type: z.enum(ATTRIBUTE_TYPES, 'Choose a value type'),
    unit: z.string().trim().max(20, 'Unit must be at most 20 characters'),
    optionsText: z.string(),
    required: z.boolean(),
    searchFilter: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (!TYPES_WITH_OPTIONS.includes(v.type)) return;
    const options = parseOptions(v.optionsText);
    if (options.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['optionsText'], message: 'Add at least one option' });
      return;
    }
    const lower = options.map((o) => o.toLowerCase());
    const twice = options.find((o, i) => lower.indexOf(o.toLowerCase()) !== i);
    if (twice) {
      ctx.addIssue({
        code: 'custom',
        path: ['optionsText'],
        message: `"${twice}" is listed twice`,
      });
    }
  });
type FormValues = z.infer<typeof formSchema>;

function initialValues(mode: AttributeSheetMode): FormValues {
  if (mode.kind === 'edit') {
    const a = mode.attribute;
    return {
      place: mode.place,
      label: a.label,
      type: a.type,
      unit: a.unit ?? '',
      optionsText: a.options.join('\n'),
      required: a.required,
      searchFilter: a.searchFilter,
    };
  }
  return {
    place: mode.place,
    label: '',
    type: 'text',
    unit: '',
    optionsText: '',
    required: false,
    searchFilter: false,
  };
}

/**
 * Add an attribute (new, or reuse an existing one) or edit one. Name, type and options
 * change the attribute everywhere it is used; "Required" is for this place only.
 */
export function AttributeSheet({
  mode,
  places,
  onClose,
}: {
  mode: AttributeSheetMode | null;
  places: AttributePlace[];
  onClose: () => void;
}) {
  const add = useAddAttribute();
  const update = useUpdateAttribute();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: mode ? initialValues(mode) : undefined,
  });
  const { errors, isSubmitting } = form.formState;
  const [placeValue, label, type] = useWatch({
    control: form.control,
    name: ['place', 'label', 'type'],
  });

  useEffect(() => {
    if (mode) form.reset(initialValues(mode));
    add.reset();
    update.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const isEdit = mode?.kind === 'edit';
  const place = places.find((p) => p.value === placeValue);
  const searchTerm = useSettled(isEdit ? '' : (label ?? ''), 300);
  const search = useAttributeSearch(searchTerm);
  const matches = (search.data ?? []).filter((m) => !place?.attributeIds.includes(m.id));
  const exact = matches.find((m) => normalizeLabel(m.label) === normalizeLabel(label ?? ''));
  const hasOptions = TYPES_WITH_OPTIONS.includes(type as AttributeType);
  const error = add.error ?? update.error;

  if (!mode) return null;

  const done = (message: string) => {
    toast.success(message);
    onClose();
  };

  const reuse = async (attributeId: string, name: string) => {
    if (!place) return;
    try {
      await add.mutateAsync({
        target: place.target,
        body: { source: 'existing', attributeId, required: form.getValues('required') },
      });
      done(`"${name}" added to ${place.label}`);
    } catch {
      // Shown in the alert.
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    if (!place) return;
    const definition = {
      label: values.label,
      type: values.type,
      unit: values.type === 'number' ? values.unit : '',
      options: TYPES_WITH_OPTIONS.includes(values.type) ? parseOptions(values.optionsText) : [],
      searchFilter: values.searchFilter,
      required: values.required,
    };
    try {
      if (mode.kind === 'edit') {
        await update.mutateAsync({ target: place.target, id: mode.attribute.id, body: definition });
        done('Attribute saved');
      } else {
        await add.mutateAsync({ target: place.target, body: { source: 'new', ...definition } });
        done(`"${values.label}" added to ${place.label}`);
      }
    } catch {
      // Shown in the alert.
    }
  });

  const placeItems = places.map((p) => ({ value: p.value, label: p.label }));
  const usedElsewhere = isEdit ? mode.attribute.usedIn : [];

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b pb-4">
          <SheetTitle>{isEdit ? `Edit ${mode.attribute.label}` : 'Add attribute'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? `In ${place?.label ?? ''}`
              : 'Attributes are optional by default. Reuse an existing one when it fits.'}
          </SheetDescription>
        </SheetHeader>

        <form id="attribute-form" onSubmit={onSubmit} className="grid gap-4 px-4" noValidate>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(error)}</AlertDescription>
            </Alert>
          )}

          {!isEdit && (
            <FormField id="attr-place" label="Add to *">
              <Controller
                control={form.control}
                name="place"
                render={({ field }) => (
                  <Select
                    items={placeItems}
                    value={field.value}
                    onValueChange={(v) => v && field.onChange(v)}
                  >
                    <SelectTrigger id="attr-place" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {placeItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          )}

          <FormField id="attr-label" label="Attribute name *" error={errors.label?.message}>
            <Input
              id="attr-label"
              autoComplete="off"
              placeholder="e.g. Corner plot"
              aria-invalid={!!errors.label}
              {...form.register('label')}
            />
          </FormField>

          {!isEdit && matches.length > 0 && (
            <div
              className="grid gap-2 rounded-lg border border-dashed bg-muted/40 p-3 text-sm"
              aria-live="polite"
            >
              <p className="font-medium">
                {exact
                  ? 'An attribute with this name already exists:'
                  : 'Similar attributes already exist:'}
              </p>
              <ul className="grid gap-1.5">
                {matches.slice(0, 4).map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="font-medium">{m.label}</span>
                      <span className="text-muted-foreground">
                        {' '}
                        · {ATTRIBUTE_TYPE_LABELS[m.type]}
                        {m.usedIn.length > 0 && ` · in ${m.usedIn.join(', ')}`}
                      </span>
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={add.isPending}
                      onClick={() => reuse(m.id, m.label)}
                    >
                      Use it
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={type === 'number' ? 'grid gap-4 sm:grid-cols-2' : 'grid gap-4'}>
            <FormField id="attr-type" label="Value type *" error={errors.type?.message}>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select
                    items={TYPE_ITEMS}
                    value={field.value}
                    onValueChange={(v) => v && field.onChange(v)}
                  >
                    <SelectTrigger id="attr-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPE_ITEMS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            {type === 'number' && (
              <FormField id="attr-unit" label="Unit" error={errors.unit?.message}>
                <Input
                  id="attr-unit"
                  placeholder="e.g. ft, sq.ft, slots"
                  {...form.register('unit')}
                />
              </FormField>
            )}
          </div>

          {hasOptions && (
            <FormField
              id="attr-options"
              label="Options *"
              error={errors.optionsText?.message}
              hint="One per line (or separated by commas)"
            >
              <Textarea
                id="attr-options"
                rows={5}
                placeholder={'DTCP\nCMDA\nPanchayat'}
                aria-invalid={!!errors.optionsText}
                {...form.register('optionsText')}
              />
            </FormField>
          )}

          <div className="grid gap-3">
            <Label className="text-sm font-medium">Rules</Label>
            <Controller
              control={form.control}
              name="required"
              render={({ field }) => (
                <label className="flex items-start gap-2.5 text-sm">
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="mt-0.5"
                  />
                  <span>
                    Required
                    <span className="block text-xs text-muted-foreground">
                      Must be filled before a property can be published
                      {isEdit && place ? ` (only in ${place.label})` : ''}
                    </span>
                  </span>
                </label>
              )}
            />
            <Controller
              control={form.control}
              name="searchFilter"
              render={({ field }) => (
                <label className="flex items-start gap-2.5 text-sm">
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="mt-0.5"
                  />
                  <span>
                    Use as a search filter
                    <span className="block text-xs text-muted-foreground">
                      Buyers and the AI agent can search by it
                    </span>
                  </span>
                </label>
              )}
            />
          </div>

          {usedElsewhere.length > 0 && (
            <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              Changes to the name, value type, options and search filter also apply to{' '}
              <span className="font-medium text-foreground">{usedElsewhere.join(', ')}</span>.
            </p>
          )}
        </form>

        <SheetFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="attribute-form" disabled={isSubmitting || Boolean(exact)}>
            {isSubmitting && <Loader2Icon className="animate-spin" />}
            {isEdit ? 'Save attribute' : 'Create attribute'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
