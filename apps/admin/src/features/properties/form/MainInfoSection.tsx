import {
  AREA_UNIT_LABELS,
  AREA_UNITS,
  canChangeStatus,
  formatPrice,
  groupIndian,
  MAIN_AREA_LABELS,
  pricePerSqft,
  PROPERTY_STATUS_LABELS,
  PROPERTY_STATUSES,
  PURPOSE_LABELS,
  PURPOSES,
  toSqft,
} from '@real-estate/shared';
import type { Category, Property } from '@real-estate/shared';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { NumberedSection } from '@/components/patterns';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useLocationSuggestions } from '../api';
import { AttributeField } from './AttributeField';
import type { FormLayout, PropertyFormValues } from './formModel';

const BASIS_ITEMS = [
  { value: 'total', label: 'Total' },
  { value: 'per_sqft', label: 'Per sq.ft' },
  { value: 'per_month', label: 'Per month' },
];
const UNIT_ITEMS = AREA_UNITS.map((u) => ({ value: u, label: AREA_UNIT_LABELS[u] }));

/** A wireframe `fld`: label (with * when required), control, then a hint or the error. */
function Fld({
  id,
  label,
  required,
  hint,
  error,
  className,
  action,
  children,
}: {
  id?: string;
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  className?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={cn('grid content-start gap-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-ink-2">
          {label}
          {required && <span className="text-destructive"> *</span>}
        </label>
        {action}
      </div>
      {children}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

/** A select bound to a form field. */
function FieldSelect({
  id,
  name,
  label,
  items,
  className,
  disabled,
}: {
  id?: string;
  name: 'priceBasis' | 'areaUnit' | 'purpose' | 'status';
  label: string;
  items: { value: string; label: string; disabled?: boolean }[];
  className?: string;
  disabled?: boolean;
}) {
  const form = useFormContext<PropertyFormValues>();
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <Select
          items={items}
          value={field.value}
          disabled={disabled}
          onValueChange={(v) => v !== null && field.onChange(v)}
        >
          <SelectTrigger id={id} aria-label={label} className={cn('w-full', className)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((i) => (
              <SelectItem key={i.value} value={i.value} disabled={i.disabled}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}

/**
 * Section 1, "Main property information" (PROP-59), in the wireframe's order: ID and title;
 * type, derived category and purpose; state, city and locality; pincode, facing and area;
 * price, live ₹/sq.ft. and status; listing date. The type picks section 2.
 */
export function MainInfoSection({
  categories,
  property,
  layout,
  onPickType,
  onChangeType,
}: {
  categories: Category[];
  property?: Property;
  layout: FormLayout | null;
  onPickType: (subcategoryId: string) => void;
  onChangeType: () => void;
}) {
  const form = useFormContext<PropertyFormValues>();
  const { errors, isDirty } = form.formState;
  const [subcategoryId, purpose, onRequest, priceAmount, priceBasis, areaValue, areaUnit] =
    useWatch({
      control: form.control,
      name: [
        'subcategoryId',
        'purpose',
        'onRequest',
        'priceAmount',
        'priceBasis',
        'areaValue',
        'areaUnit',
      ],
    });
  const [city, locality, removed] = useWatch({
    control: form.control,
    name: ['location.city', 'location.locality', 'removedAttributeKeys'],
  });
  // Sale prices are a total; rent and lease are per month. Follow the purpose when it changes.
  const lastPurpose = useRef(purpose);
  useEffect(() => {
    if (purpose === lastPurpose.current) return;
    lastPurpose.current = purpose;
    const basis = form.getValues('priceBasis');
    if (purpose !== 'sale' && basis === 'total')
      form.setValue('priceBasis', 'per_month', { shouldDirty: true });
    if (purpose === 'sale' && basis === 'per_month')
      form.setValue('priceBasis', 'total', { shouldDirty: true });
  }, [purpose, form]);
  const cities = useLocationSuggestions('city', city ?? '');
  const localities = useLocationSuggestions('locality', locality ?? '', city || undefined);

  const groups = categories
    .filter((c) => c.isActive)
    .map((c) => ({ ...c, subcategories: c.subcategories.filter((s) => s.isActive) }))
    .filter((c) => c.subcategories.length > 0);
  const typeItems = groups.flatMap((c) =>
    c.subcategories.map((s) => ({ value: s.id, label: s.name })),
  );
  const allowedPurposes = layout?.subcategory.purposes ?? PURPOSES;
  const purposeItems = PURPOSES.map((p) => ({
    value: p,
    label: PURPOSE_LABELS[p],
    disabled: !allowedPurposes.includes(p),
  }));
  // Status: the current one and the moves the rules allow. A new property starts as Draft.
  const statusItems = PROPERTY_STATUSES.filter(
    (s) =>
      s === (property?.status ?? 'draft') ||
      (property && canChangeStatus(property.status, s, property.purpose)),
  ).map((s) => ({ value: s, label: PROPERTY_STATUS_LABELS[s] }));

  const sqft = areaValue && Number(areaValue) > 0 ? toSqft(Number(areaValue), areaUnit) : null;
  const amount = priceAmount && Number(priceAmount) > 0 ? Number(priceAmount) : null;
  const pricePreview =
    amount !== null ? formatPrice({ amount, basis: priceBasis, onRequest: false }) : null;
  const perSqft = onRequest
    ? null
    : pricePerSqft({ purpose, price: { amount, basis: priceBasis }, areaSqft: sqft });
  const areaLabel = layout ? MAIN_AREA_LABELS[layout.subcategory.mainAreaMeaning] : 'Area';
  const facing = layout?.common.find((a) => a.key === 'facing');
  const otherCommon = (layout?.common ?? []).filter(
    (a) => a !== facing && !removed.includes(a.key),
  );
  const code =
    property?.code ??
    (layout ? `Auto: RE-${layout.subcategory.codePrefix}-…` : 'Auto: on first save');

  return (
    <NumberedSection number={1} title="Main property information">
      <div className="grid gap-x-3.5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        <Fld id="pf-code" label="Property ID" hint="Unique; never rely on the title alone">
          <Input id="pf-code" value={code} disabled readOnly />
        </Fld>
        <Fld
          id="pf-title"
          label="Property title"
          required
          error={errors.title?.message}
          className="lg:col-span-2"
        >
          <Input
            id="pf-title"
            placeholder="e.g. Premium residential plot"
            aria-invalid={!!errors.title}
            {...form.register('title')}
          />
        </Fld>

        <Fld
          id="pf-type"
          label="Property type"
          required
          error={errors.subcategoryId?.message}
          action={
            property && (
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
                disabled={isDirty}
                title={isDirty ? 'Save your changes first' : undefined}
                onClick={onChangeType}
              >
                Change type…
              </button>
            )
          }
        >
          <Select
            items={typeItems}
            value={subcategoryId || null}
            disabled={Boolean(property)}
            onValueChange={(v) => v && onPickType(v as string)}
          >
            <SelectTrigger id="pf-type" aria-invalid={!!errors.subcategoryId} className="w-full">
              <SelectValue placeholder="Choose a type" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((c) => (
                <SelectGroup key={c.key}>
                  <SelectLabel>{c.name}</SelectLabel>
                  {c.subcategories.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </Fld>
        <Fld id="pf-category" label="Property category" hint="Derived from type">
          <Input id="pf-category" value={layout?.category.name ?? ''} disabled readOnly />
        </Fld>
        <Fld id="pf-purpose" label="Listing purpose" required error={errors.purpose?.message}>
          <FieldSelect
            id="pf-purpose"
            name="purpose"
            label="Listing purpose"
            items={purposeItems}
          />
        </Fld>

        <Fld id="pf-state" label="State" error={errors.location?.state?.message}>
          <Input id="pf-state" placeholder="e.g. Tamil Nadu" {...form.register('location.state')} />
        </Fld>
        <Fld id="pf-city" label="City / district" required error={errors.location?.city?.message}>
          <Input
            id="pf-city"
            list="pf-city-options"
            autoComplete="off"
            {...form.register('location.city')}
          />
        </Fld>
        <Fld
          id="pf-locality"
          label="Locality"
          required
          hint="Actual locality name"
          error={errors.location?.locality?.message}
        >
          <Input
            id="pf-locality"
            list="pf-locality-options"
            autoComplete="off"
            {...form.register('location.locality')}
          />
        </Fld>
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

        <Fld id="pf-pincode" label="Pincode" required error={errors.location?.pincode?.message}>
          <Input
            id="pf-pincode"
            inputMode="numeric"
            maxLength={6}
            autoComplete="off"
            {...form.register('location.pincode')}
          />
        </Fld>
        {facing && !removed.includes(facing.key) && <AttributeField attribute={facing} />}
        <Fld id="pf-area" label={areaLabel} required error={errors.areaValue?.message}>
          <div className="flex gap-2">
            <Input
              id="pf-area"
              inputMode="decimal"
              aria-invalid={!!errors.areaValue}
              {...form.register('areaValue')}
            />
            <FieldSelect name="areaUnit" label="Area unit" items={UNIT_ITEMS} className="w-24" />
          </div>
          {sqft !== null && areaUnit !== 'sqft' && !errors.areaValue && (
            <p className="text-xs text-muted-foreground">= {groupIndian(sqft)} sq.ft</p>
          )}
        </Fld>

        <Fld
          id="pf-price"
          label={purpose === 'sale' ? 'Asking price (₹)' : 'Monthly rent (₹)'}
          required
          error={errors.priceAmount?.message}
          hint={pricePreview && !onRequest ? `Shows as ${pricePreview}` : undefined}
        >
          <div className="flex gap-2">
            <Input
              id="pf-price"
              inputMode="numeric"
              placeholder="e.g. 4500000"
              disabled={onRequest}
              aria-invalid={!!errors.priceAmount}
              {...form.register('priceAmount')}
            />
            <FieldSelect
              name="priceBasis"
              label="Price basis"
              items={BASIS_ITEMS}
              className="w-28"
            />
          </div>
        </Fld>
        <Fld
          id="pf-ppsf"
          label="Asking price per sq.ft."
          hint={purpose === 'sale' ? 'Total price ÷ area (auto)' : 'For sale prices only'}
        >
          <Input
            id="pf-ppsf"
            value={perSqft === null ? '—' : `₹${groupIndian(perSqft)}`}
            disabled
            readOnly
          />
        </Fld>
        <Fld
          id="pf-status"
          label="Property status"
          hint={!property ? 'Becomes Available after photos are added' : undefined}
        >
          <FieldSelect
            id="pf-status"
            name="status"
            label="Property status"
            items={statusItems}
            disabled={!property}
          />
        </Fld>

        <Fld
          id="pf-listing-date"
          label="Listing date"
          error={errors.listingDate?.message}
          hint={property?.publishedAt ? undefined : 'Set when it first becomes Available'}
        >
          <Input
            id="pf-listing-date"
            type="date"
            disabled={!property?.publishedAt}
            {...form.register('listingDate')}
          />
        </Fld>
        {purpose !== 'sale' && (
          <>
            <Fld id="pf-deposit" label="Security deposit (₹)" error={errors.deposit?.message}>
              <Input id="pf-deposit" inputMode="numeric" {...form.register('deposit')} />
            </Fld>
            <Fld id="pf-lockin" label="Lock-in period (months)" error={errors.lockIn?.message}>
              <Input id="pf-lockin" inputMode="numeric" {...form.register('lockIn')} />
            </Fld>
          </>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 sm:col-span-2 lg:col-span-3">
          {(
            [
              ['negotiable', 'Price negotiable'],
              ['onRequest', 'Price on request'],
              ['isFeatured', 'Featured listing'],
            ] as const
          ).map(([name, text]) => (
            <Controller
              key={name}
              control={form.control}
              name={name}
              render={({ field }) => (
                <label className="inline-flex cursor-pointer items-center gap-[7px] text-[13px]">
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  {text}
                </label>
              )}
            />
          ))}
        </div>

        {/* Other common attributes of the category (e.g. Description) */}
        {otherCommon.map((a) => (
          <AttributeField key={a.id} attribute={a} />
        ))}
      </div>
    </NumberedSection>
  );
}
