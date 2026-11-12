import { zodResolver } from '@hookform/resolvers/zod';
import {
  AREA_UNIT_LABELS,
  AREA_UNITS,
  canChangeStatus,
  formatPrice,
  PURPOSE_LABELS,
  PURPOSES,
  toSqft,
} from '@real-estate/shared';
import type { Category, ExtraAttributeType, PlacedAttribute, Property } from '@real-estate/shared';
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  HistoryIcon,
  Loader2Icon,
  PlusIcon,
  RotateCcwIcon,
  ShuffleIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import type { Path } from 'react-hook-form';
import { Link, useBlocker, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '@/auth/auth-context';
import { FormField } from '@/components/forms/FormField';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  useChangeStatus,
  useCreateProperty,
  useLocationSuggestions,
  useProperty,
  useUpdateProperty,
} from '@/features/properties/api';
import { AddressSection } from '@/features/properties/form/AddressSection';
import { AttributeInput } from '@/features/properties/form/AttributeInput';
import { ChangeSubcategoryDialog } from '@/features/properties/form/ChangeSubcategoryDialog';
import { CreateAttributeDialog } from '@/features/properties/form/CreateAttributeDialog';
import type { PropertyFormValues } from '@/features/properties/form/formModel';
import {
  bodyFromValues,
  emptyValues,
  layoutFor,
  propertyFormSchema,
  splitErrors,
  valuesFromProperty,
} from '@/features/properties/form/formModel';
import { MediaManager } from '@/features/properties/form/MediaManager';
import { StatusBadge } from '@/features/properties/StatusBadge';
import { AmenityIcon } from '@/features/propertyTypes/AmenityIcon';
import { usePropertyTypes } from '@/features/propertyTypes/api';
import { PickCard } from '@/features/propertyTypes/PickCard';
import { ApiError } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';

const BASIS_ITEMS = [
  { value: 'total', label: 'Total' },
  { value: 'per_sqft', label: 'Per sq.ft' },
  { value: 'per_month', label: 'Per month' },
];
const UNIT_ITEMS = AREA_UNITS.map((u) => ({ value: u, label: AREA_UNIT_LABELS[u] }));

/** Add property (/properties/new) and Edit property (/properties/:id/edit). */
export function PropertyFormPage() {
  const { id } = useParams();
  const types = usePropertyTypes();
  const property = useProperty(id);

  if (types.isPending || (id && property.isPending)) {
    return (
      <div className="grid gap-5">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }
  const error = types.error ?? property.error;
  if (error || !types.data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{errorMessage(error)}</AlertDescription>
      </Alert>
    );
  }
  if (property.data?.status === 'archived') {
    return (
      <Card className="mx-auto grid max-w-lg gap-3 p-6 text-center">
        <p className="font-medium">{property.data.code} is archived</p>
        <p className="text-sm text-muted-foreground">Restore it as a draft first to edit it.</p>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link to={`/properties/${property.data.id}`} />}
        >
          Open the property
        </Button>
      </Card>
    );
  }
  return (
    <PropertyForm
      key={property.data?.id ?? 'new'}
      categories={types.data.categories}
      property={property.data}
    />
  );
}

function SectionTitle({
  n,
  children,
  aside,
}: {
  n: number;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="font-semibold">
        {n} · {children}
      </h2>
      {aside && <span className="text-xs text-muted-foreground">{aside}</span>}
    </div>
  );
}

function PropertyForm({ categories, property }: { categories: Category[]; property?: Property }) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const create = useCreateProperty();
  const update = useUpdateProperty();
  const changeStatus = useChangeStatus();
  const [formProblems, setFormProblems] = useState<string[]>([]);
  const [addingAttribute, setAddingAttribute] = useState(false);
  const [changingSubcategory, setChangingSubcategory] = useState(false);
  const leaving = useRef(false);

  const activeCategories = categories.filter((c) => c.isActive);
  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: property
      ? valuesFromProperty(property, layoutFor(categories, property.subcategoryId))
      : emptyValues(),
  });
  const { errors, isDirty, isSubmitting } = form.formState;
  const extras = useFieldArray({ control: form.control, name: 'extraAttributes' });
  const [
    subcategoryId,
    purpose,
    onRequest,
    priceAmount,
    priceBasis,
    areaValue,
    areaUnit,
    removed,
    amenityIds,
    city,
    locality,
    pincode,
  ] = useWatch({
    control: form.control,
    name: [
      'subcategoryId',
      'purpose',
      'onRequest',
      'priceAmount',
      'priceBasis',
      'areaValue',
      'areaUnit',
      'removedAttributeKeys',
      'amenityIds',
      'location.city',
      'location.locality',
      'location.pincode',
    ],
  });
  const layout = layoutFor(categories, subcategoryId);
  const [categoryKey, setCategoryKey] = useState(layout?.category.key ?? activeCategories[0]?.key);
  const category = categories.find((c) => c.key === categoryKey) ?? activeCategories[0];
  const cities = useLocationSuggestions('city', city ?? '');
  const localities = useLocationSuggestions('locality', locality ?? '', city || undefined);
  const pincodes = useLocationSuggestions('pincode', pincode ?? '', city || undefined);

  // After "Change subcategory", show the new subcategory's form.
  useEffect(() => {
    if (property && property.subcategoryId !== form.getValues('subcategoryId')) {
      form.reset(valuesFromProperty(property, layoutFor(categories, property.subcategoryId)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property?.subcategoryId]);

  // Unsaved changes: ask before leaving the page or closing the tab.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !leaving.current &&
      form.formState.isDirty &&
      currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const pickSubcategory = (id: string) => {
    const next = layoutFor(categories, id);
    form.setValue('subcategoryId', id, { shouldDirty: true, shouldValidate: true });
    if (next && !next.subcategory.purposes.includes(form.getValues('purpose'))) {
      form.setValue('purpose', next.subcategory.purposes[0]!, { shouldDirty: true });
    }
    // Amenities the new subcategory doesn't offer are dropped.
    if (next) {
      const offered = new Set(
        next.category.amenities
          .filter((a) => a.appliesToAll || a.subcategoryIds.includes(id))
          .map((a) => a.id),
      );
      form.setValue(
        'amenityIds',
        form.getValues('amenityIds').filter((a) => offered.has(a)),
      );
    }
  };

  const showError = (err: unknown) => {
    if (err instanceof ApiError) {
      if (err.code === 'PUBLISH_BLOCKED') {
        setFormProblems([err.message, ...(err.details ?? []).map((d) => d.message)]);
        return;
      }
      const { fields, other } = splitErrors(err.details);
      for (const f of fields)
        form.setError(f.name as Path<PropertyFormValues>, { message: f.message });
      setFormProblems(fields.length || other.length ? other : [err.message]);
      if (fields.length) toast.error('Some details need fixing');
      return;
    }
    setFormProblems([errorMessage(err)]);
  };

  const save = (then?: 'publish') =>
    form.handleSubmit(async (values) => {
      if (!layout) return;
      setFormProblems([]);
      try {
        const body = bodyFromValues(values, layout);
        const saved = property
          ? await update.mutateAsync({ id: property.id, body })
          : await create.mutateAsync(body);
        form.reset(valuesFromProperty(saved, layoutFor(categories, saved.subcategoryId)));
        if (!property) {
          toast.success(`Saved as draft ${saved.code}. Add photos next.`);
          leaving.current = true;
          navigate(`/properties/${saved.id}/edit#photos`, { replace: true });
          return;
        }
        if (then === 'publish') {
          await changeStatus.mutateAsync({ id: property.id, status: 'published' });
          toast.success(`${saved.code} is published`);
          leaving.current = true;
          navigate(`/properties/${property.id}`);
          return;
        }
        toast.success('Changes saved');
      } catch (err) {
        showError(err);
      }
    })();

  const canPublish =
    property &&
    property.status !== 'published' &&
    canChangeStatus(property.status, 'published', property.purpose);
  const allowedPurposes = layout?.subcategory.purposes ?? PURPOSES;
  const visibleOwn = (layout?.own ?? []).filter((a) => !removed.includes(a.key));
  const visibleCommon = (layout?.common ?? []).filter((a) => !removed.includes(a.key));
  const removedAttrs = [...(layout?.common ?? []), ...(layout?.own ?? [])].filter((a) =>
    removed.includes(a.key),
  );
  const offeredAmenities = (layout?.category.amenities ?? []).filter(
    (a) =>
      (a.appliesToAll || a.subcategoryIds.includes(subcategoryId)) &&
      (a.isActive || amenityIds.includes(a.id)),
  );
  const sqft = areaValue && Number(areaValue) > 0 ? toSqft(Number(areaValue), areaUnit) : null;
  const pricePreview =
    priceAmount && Number(priceAmount) > 0
      ? formatPrice({ amount: Number(priceAmount), basis: priceBasis, onRequest: false })
      : null;

  const attributeField = (a: PlacedAttribute) => (
    <Controller
      key={a.id}
      control={form.control}
      name={`attributeValues.${a.key}` as Path<PropertyFormValues>}
      render={({ field, fieldState }) => (
        <AttributeInput
          id={`attr-${a.key}`}
          label={a.label}
          type={a.type}
          unit={a.unit}
          options={a.options}
          required={a.required}
          value={field.value as string | string[] | undefined}
          error={fieldState.error?.message}
          onChange={field.onChange}
          onRemove={
            a.required
              ? undefined
              : () =>
                  form.setValue('removedAttributeKeys', [...removed, a.key], { shouldDirty: true })
          }
        />
      )}
    />
  );

  const issues = property?.publishIssues ?? [];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      noValidate
    >
      {/* Top row */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {property ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{property.code}</span>
            <StatusBadge status={property.status} />
            {isDirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline" className="border-dashed">
              New property
            </Badge>
            <span className="text-muted-foreground">
              The property code is created when you first save.
            </span>
          </div>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(property ? `/properties/${property.id}` : '/properties')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant={canPublish ? 'outline' : 'default'}
            disabled={isSubmitting || (Boolean(property) && !isDirty)}
          >
            {isSubmitting && !changeStatus.isPending && <Loader2Icon className="animate-spin" />}
            {property ? 'Save changes' : 'Save draft'}
          </Button>
          {canPublish && (
            <Button type="button" disabled={isSubmitting} onClick={() => void save('publish')}>
              {changeStatus.isPending && <Loader2Icon className="animate-spin" />}
              {isDirty ? 'Save & publish' : 'Publish'}
            </Button>
          )}
        </div>
      </div>

      {formProblems.length > 0 && (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>
            <ul className="grid gap-1">
              {formProblems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-start gap-5">
        <div className="grid min-w-0 flex-[3_1_600px] gap-5">
          {/* 1 · Property type */}
          <Card className="grid gap-4 p-5">
            <SectionTitle n={1}>Property type</SectionTitle>
            <div className="grid gap-2">
              <span className="text-sm font-medium">Category *</span>
              <div className="grid gap-3 sm:grid-cols-3">
                {categories.map((c) => (
                  <PickCard
                    key={c.key}
                    title={c.name}
                    subtitle={
                      c.isActive
                        ? c.subcategories.map((s) => s.name.split(' / ')[0]).join(', ')
                        : 'Set up later'
                    }
                    selected={c.key === category?.key}
                    disabled={!c.isActive}
                    onClick={property ? undefined : () => setCategoryKey(c.key)}
                  />
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <span className="text-sm font-medium">Subcategory *</span>
              {property ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-lg border px-3 py-2 text-sm font-medium">
                    {layout?.subcategory.name}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isDirty}
                    title={isDirty ? 'Save your changes first' : undefined}
                    onClick={() => setChangingSubcategory(true)}
                  >
                    <ShuffleIcon /> Change subcategory…
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="Subcategory">
                  {category?.subcategories
                    .filter((s) => s.isActive)
                    .map((s) => (
                      <PickCard
                        key={s.id}
                        title={s.name}
                        subtitle={`${s.attributes.length} attributes`}
                        selected={s.id === subcategoryId}
                        onClick={() => pickSubcategory(s.id)}
                      />
                    ))}
                </div>
              )}
              {errors.subcategoryId && (
                <p className="text-sm text-destructive" role="alert">
                  {errors.subcategoryId.message}
                </p>
              )}
            </div>
          </Card>

          {!layout ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Choose a subcategory to see its details.
            </Card>
          ) : (
            <>
              {/* 2 · Common details */}
              <Card className="grid gap-4 p-5">
                <SectionTitle
                  n={2}
                  aside={`Same for every ${layout.category.name} property · * needed to publish`}
                >
                  Common details
                </SectionTitle>
                <FormField id="pf-title" label="Property name *" error={errors.title?.message}>
                  <Input
                    id="pf-title"
                    placeholder="e.g. 3 BHK independent villa with garden"
                    aria-invalid={!!errors.title}
                    {...form.register('title')}
                  />
                </FormField>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid content-start gap-2">
                    <span className="text-sm font-medium">Purpose *</span>
                    <Controller
                      control={form.control}
                      name="purpose"
                      render={({ field }) => (
                        <div
                          className="inline-flex h-8 w-fit self-start overflow-hidden rounded-lg border"
                          role="radiogroup"
                          aria-label="Purpose"
                        >
                          {PURPOSES.map((p) => {
                            const allowed = allowedPurposes.includes(p);
                            return (
                              <button
                                key={p}
                                type="button"
                                role="radio"
                                aria-checked={field.value === p}
                                disabled={!allowed}
                                title={
                                  allowed
                                    ? undefined
                                    : `${layout.subcategory.name} can't be listed for ${PURPOSE_LABELS[p]}`
                                }
                                onClick={() => {
                                  field.onChange(p);
                                  if (p !== 'sale' && form.getValues('priceBasis') === 'total') {
                                    form.setValue('priceBasis', 'per_month', { shouldDirty: true });
                                  }
                                  if (
                                    p === 'sale' &&
                                    form.getValues('priceBasis') === 'per_month'
                                  ) {
                                    form.setValue('priceBasis', 'total', { shouldDirty: true });
                                  }
                                }}
                                className={cn(
                                  'h-8 border-r px-4 text-sm font-medium last:border-r-0 disabled:cursor-not-allowed disabled:text-muted-foreground/50',
                                  field.value === p
                                    ? 'bg-primary text-primary-foreground'
                                    : 'hover:bg-muted',
                                )}
                              >
                                {PURPOSE_LABELS[p]}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    />
                    {errors.purpose && (
                      <p className="text-sm text-destructive">{errors.purpose.message}</p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <label htmlFor="pf-price" className="text-sm font-medium">
                      {purpose === 'sale' ? 'Price (₹) *' : 'Monthly rent (₹) *'}
                    </label>
                    <div className="flex gap-2">
                      <Input
                        id="pf-price"
                        inputMode="numeric"
                        placeholder="e.g. 4500000"
                        disabled={onRequest}
                        aria-invalid={!!errors.priceAmount}
                        {...form.register('priceAmount')}
                      />
                      <Controller
                        control={form.control}
                        name="priceBasis"
                        render={({ field }) => (
                          <Select
                            items={BASIS_ITEMS}
                            value={field.value}
                            onValueChange={(v) => v && field.onChange(v)}
                          >
                            <SelectTrigger aria-label="Price basis" className="w-32 flex-none">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {BASIS_ITEMS.map((b) => (
                                <SelectItem key={b.value} value={b.value}>
                                  {b.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                    {errors.priceAmount ? (
                      <p className="text-sm text-destructive" role="alert">
                        {errors.priceAmount.message}
                      </p>
                    ) : (
                      pricePreview &&
                      !onRequest && (
                        <p className="text-sm text-muted-foreground">
                          Shows as <b>{pricePreview}</b>
                        </p>
                      )
                    )}
                    <div className="flex flex-wrap gap-x-5 gap-y-2">
                      <Controller
                        control={form.control}
                        name="negotiable"
                        render={({ field }) => (
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />{' '}
                            Negotiable
                          </label>
                        )}
                      />
                      <Controller
                        control={form.control}
                        name="onRequest"
                        render={({ field }) => (
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />{' '}
                            Price on request
                          </label>
                        )}
                      />
                    </div>
                  </div>
                </div>

                {purpose !== 'sale' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      id="pf-deposit"
                      label="Security deposit (₹)"
                      error={errors.deposit?.message}
                    >
                      <Input id="pf-deposit" inputMode="numeric" {...form.register('deposit')} />
                    </FormField>
                    <FormField
                      id="pf-lockin"
                      label="Lock-in period (months)"
                      error={errors.lockIn?.message}
                    >
                      <Input id="pf-lockin" inputMode="numeric" {...form.register('lockIn')} />
                    </FormField>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="grid gap-2">
                    <label htmlFor="pf-area" className="text-sm font-medium">
                      Area *
                    </label>
                    <div className="flex gap-2">
                      <Input
                        id="pf-area"
                        inputMode="decimal"
                        aria-invalid={!!errors.areaValue}
                        {...form.register('areaValue')}
                      />
                      <Controller
                        control={form.control}
                        name="areaUnit"
                        render={({ field }) => (
                          <Select
                            items={UNIT_ITEMS}
                            value={field.value}
                            onValueChange={(v) => v && field.onChange(v)}
                          >
                            <SelectTrigger aria-label="Area unit" className="w-28 flex-none">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {UNIT_ITEMS.map((u) => (
                                <SelectItem key={u.value} value={u.value}>
                                  {u.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                    {errors.areaValue ? (
                      <p className="text-sm text-destructive" role="alert">
                        {errors.areaValue.message}
                      </p>
                    ) : (
                      sqft !== null &&
                      areaUnit !== 'sqft' && (
                        <p className="text-sm text-muted-foreground">
                          = {sqft.toLocaleString('en-IN')} sq.ft
                        </p>
                      )
                    )}
                  </div>
                  {visibleCommon.map(attributeField)}
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField id="pf-city" label="City *" error={errors.location?.city?.message}>
                    <Input
                      id="pf-city"
                      list="pf-city-options"
                      autoComplete="off"
                      {...form.register('location.city')}
                    />
                  </FormField>
                  <FormField
                    id="pf-locality"
                    label="Area / locality *"
                    error={errors.location?.locality?.message}
                  >
                    <Input
                      id="pf-locality"
                      list="pf-locality-options"
                      autoComplete="off"
                      {...form.register('location.locality')}
                    />
                  </FormField>
                  <FormField
                    id="pf-pincode"
                    label="Pincode *"
                    error={errors.location?.pincode?.message}
                  >
                    <Input
                      id="pf-pincode"
                      list="pf-pincode-options"
                      inputMode="numeric"
                      maxLength={6}
                      autoComplete="off"
                      {...form.register('location.pincode')}
                    />
                  </FormField>
                  <datalist id="pf-city-options">
                    {cities.data?.map((s) => (
                      <option key={s.value} value={s.value} />
                    ))}
                  </datalist>
                  <datalist id="pf-locality-options">
                    {localities.data?.map((s) => (
                      <option key={s.value} value={s.value} />
                    ))}
                  </datalist>
                  <datalist id="pf-pincode-options">
                    {pincodes.data?.map((s) => (
                      <option key={s.value} value={s.value} />
                    ))}
                  </datalist>
                </div>
                <AddressSection form={form} />
              </Card>

              {/* 3 · Subcategory details */}
              <Card className="grid gap-4 p-5">
                <SectionTitle
                  n={3}
                  aside="All optional unless marked * · ✕ removes it from this property only"
                >
                  {layout.subcategory.name} details
                </SectionTitle>
                {visibleOwn.length > 0 || extras.fields.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {visibleOwn.map(attributeField)}
                    {extras.fields.map((f, i) => (
                      <Controller
                        key={f.id}
                        control={form.control}
                        name={`extraAttributes.${i}.value`}
                        render={({ field }) => (
                          <AttributeInput
                            id={`extra-${i}`}
                            label={f.label}
                            type={f.type}
                            value={field.value}
                            error={errors.extraAttributes?.[i]?.label?.message}
                            onChange={field.onChange}
                            onRemove={() => extras.remove(i)}
                            removeLabel="Delete this attribute"
                            badge={
                              <Badge variant="outline" className="border-dashed text-[10px]">
                                Only this property
                              </Badge>
                            }
                          />
                        )}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No details for {layout.subcategory.name} yet.
                  </p>
                )}
                {removedAttrs.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Removed from this property:</span>
                    {removedAttrs.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs hover:bg-muted"
                        onClick={() =>
                          form.setValue(
                            'removedAttributeKeys',
                            removed.filter((k) => k !== a.key),
                            { shouldDirty: true },
                          )
                        }
                        aria-label={`Restore ${a.label}`}
                      >
                        <RotateCcwIcon className="size-3" /> {a.label}
                      </button>
                    ))}
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit border-dashed"
                  onClick={() => setAddingAttribute(true)}
                >
                  <PlusIcon /> Add attribute
                </Button>
              </Card>

              {/* 4 · Photos & documents */}
              <Card id="photos" className="grid scroll-mt-20 gap-4 p-5">
                <SectionTitle n={4}>Photos &amp; documents</SectionTitle>
                {property ? (
                  <MediaManager property={property} />
                ) : (
                  <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Save the draft first, then add photos, floor plans and brochures here.
                  </p>
                )}
              </Card>

              {/* 5 · Amenities */}
              <Card className="grid gap-4 p-5">
                <SectionTitle n={5} aside="Tap to select">
                  Amenities
                </SectionTitle>
                {offeredAmenities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No amenities are set up for {layout.subcategory.name}.
                  </p>
                ) : (
                  <Controller
                    control={form.control}
                    name="amenityIds"
                    render={({ field }) => (
                      <div className="flex flex-wrap gap-2" role="group" aria-label="Amenities">
                        {offeredAmenities.map((a) => {
                          const on = field.value.includes(a.id);
                          return (
                            <button
                              key={a.id}
                              type="button"
                              aria-pressed={on}
                              onClick={() =>
                                field.onChange(
                                  on
                                    ? field.value.filter((x) => x !== a.id)
                                    : [...field.value, a.id],
                                )
                              }
                              className={cn(
                                'inline-flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition-colors',
                                on ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-muted',
                              )}
                            >
                              <AmenityIcon icon={a.icon} className="size-6 rounded-full" />
                              {a.name}
                              {!a.isActive && (
                                <span className="text-xs text-muted-foreground">(inactive)</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  />
                )}
              </Card>
            </>
          )}
        </div>

        {/* Side panel */}
        <aside className="grid min-w-0 flex-[1_1_260px] gap-5 lg:sticky lg:top-20">
          <Card className="grid gap-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Status</h2>
              {property ? (
                <StatusBadge status={property.status} />
              ) : (
                <Badge variant="outline" className="border-dashed">
                  Draft
                </Badge>
              )}
            </div>
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
              <span className="text-sm font-medium">Ready to publish</span>
              {!property ? (
                <p className="text-sm text-muted-foreground">
                  Save the draft, then add at least one photo.
                </p>
              ) : issues.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2Icon className="size-4" /> Everything needed is filled in
                </p>
              ) : (
                <ul className="grid gap-1.5 text-sm">
                  {issues.map((i) => (
                    <li key={i.path} className="flex items-start gap-2">
                      <CircleAlertIcon className="mt-0.5 size-4 flex-none text-amber-600" />
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
              Only published properties are visible to the AI agent.
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
      </div>

      {addingAttribute && layout && (
        <CreateAttributeDialog
          categoryName={layout.category.name}
          subcategory={{ id: layout.subcategory.id, name: layout.subcategory.name }}
          takenLabels={[...layout.common, ...layout.own]
            .map((a) => a.label)
            .concat(form.getValues('extraAttributes').map((e) => e.label))}
          canEditSettings={can('settings:edit')}
          onAddExtra={(label, type: ExtraAttributeType) =>
            extras.append({ label, type, value: '' })
          }
          onClose={() => setAddingAttribute(false)}
        />
      )}
      {changingSubcategory && property && layout && (
        <ChangeSubcategoryDialog
          property={property}
          category={layout.category}
          onClose={() => setChangingSubcategory(false)}
        />
      )}

      <AlertDialog open={blocker.state === 'blocked'}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes on this property.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>Keep editing</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => blocker.proceed?.()}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
