import {
  AREA_UNIT_LABELS,
  AREA_UNITS,
  formatPrice,
  groupIndian,
  MAIN_AREA_LABELS,
  pricePerSqft,
  PURPOSE_LABELS,
  PURPOSES,
  ROAD_TYPES,
  toSqft,
} from '@real-estate/shared';
import type { Category, Property } from '@real-estate/shared';
import { ShuffleIcon } from 'lucide-react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { FormField } from '@/components/forms/FormField';
import { NumberedSection } from '@/components/patterns';
import { Button } from '@/components/ui/button';
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
import { AddressSection } from './AddressSection';
import { AttributeField } from './AttributeField';
import type { FormLayout, PropertyFormValues } from './formModel';

const BASIS_ITEMS = [
  { value: 'total', label: 'Total' },
  { value: 'per_sqft', label: 'Per sq.ft' },
  { value: 'per_month', label: 'Per month' },
];
const UNIT_ITEMS = AREA_UNITS.map((u) => ({ value: u, label: AREA_UNIT_LABELS[u] }));
const ROAD_ITEMS = [
  { value: '', label: 'Not recorded' },
  ...ROAD_TYPES.map((r) => ({ value: r, label: r })),
];

/** A small select bound to a form field. */
function FieldSelect({
  name,
  label,
  items,
  className,
}: {
  name: 'priceBasis' | 'areaUnit' | 'location.roadType';
  label: string;
  items: { value: string; label: string }[];
  className?: string;
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
          onValueChange={(v) => v !== null && field.onChange(v)}
        >
          <SelectTrigger
            id={name === 'location.roadType' ? 'pf-road-type' : undefined}
            aria-label={label}
            className={className}
          >
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
      )}
    />
  );
}

/**
 * Section 1, "Main property information" (PROP-59): what every property has. The type picks
 * the rest of the form; the area label follows the type's main-area meaning, and the price
 * per sq.ft. is worked out as you type.
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
  const [city, locality, pincode, removed] = useWatch({
    control: form.control,
    name: ['location.city', 'location.locality', 'location.pincode', 'removedAttributeKeys'],
  });
  const cities = useLocationSuggestions('city', city ?? '');
  const localities = useLocationSuggestions('locality', locality ?? '', city || undefined);
  const pincodes = useLocationSuggestions('pincode', pincode ?? '', city || undefined);

  const groups = categories
    .filter((c) => c.isActive)
    .map((c) => ({ ...c, subcategories: c.subcategories.filter((s) => s.isActive) }))
    .filter((c) => c.subcategories.length > 0);
  const typeItems = groups.flatMap((c) =>
    c.subcategories.map((s) => ({ value: s.id, label: s.name })),
  );
  const allowedPurposes = layout?.subcategory.purposes ?? PURPOSES;
  const sqft = areaValue && Number(areaValue) > 0 ? toSqft(Number(areaValue), areaUnit) : null;
  const amount = priceAmount && Number(priceAmount) > 0 ? Number(priceAmount) : null;
  const pricePreview =
    amount !== null ? formatPrice({ amount, basis: priceBasis, onRequest: false }) : null;
  const perSqft = onRequest
    ? null
    : pricePerSqft({ purpose, price: { amount, basis: priceBasis }, areaSqft: sqft });
  const areaLabel = layout ? MAIN_AREA_LABELS[layout.subcategory.mainAreaMeaning] : 'Area';
  const code =
    property?.code ??
    (layout ? `Auto: RE-${layout.subcategory.codePrefix}-…` : 'Auto: on first save');

  return (
    <NumberedSection number={1} title="Main property information">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FormField id="pf-code" label="Property code" hint="Unique; never rely on the name alone">
          <Input id="pf-code" value={code} disabled readOnly />
        </FormField>
        <div className="sm:col-span-1 lg:col-span-2">
          <FormField id="pf-title" label="Property name *" error={errors.title?.message}>
            <Input
              id="pf-title"
              placeholder="e.g. Premium residential plot"
              aria-invalid={!!errors.title}
              {...form.register('title')}
            />
          </FormField>
        </div>

        {/* Type → derived category */}
        <div className="grid content-start gap-2">
          <label htmlFor="pf-type" className="text-sm font-medium">
            Property type *
          </label>
          {property ? (
            <div className="flex gap-2">
              <Input id="pf-type" value={layout?.subcategory.name ?? ''} disabled readOnly />
              <Button
                type="button"
                variant="outline"
                disabled={isDirty}
                title={isDirty ? 'Save your changes first' : undefined}
                onClick={onChangeType}
              >
                <ShuffleIcon /> Change…
              </Button>
            </div>
          ) : (
            <Select
              items={typeItems}
              value={subcategoryId || null}
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
          )}
          {errors.subcategoryId && (
            <p className="text-sm text-destructive" role="alert">
              {errors.subcategoryId.message}
            </p>
          )}
        </div>
        <FormField id="pf-category" label="Property category" hint="Derived from the type">
          <Input id="pf-category" value={layout?.category.name ?? '—'} disabled readOnly />
        </FormField>
        <div className="grid content-start gap-2">
          <span className="text-sm font-medium">Listing purpose *</span>
          <Controller
            control={form.control}
            name="purpose"
            render={({ field }) => (
              <div
                className="inline-flex h-8 w-fit overflow-hidden rounded-lg border"
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
                        allowed || !layout
                          ? undefined
                          : `${layout.subcategory.name} can't be listed for ${PURPOSE_LABELS[p]}`
                      }
                      onClick={() => {
                        field.onChange(p);
                        const basis = form.getValues('priceBasis');
                        if (p !== 'sale' && basis === 'total')
                          form.setValue('priceBasis', 'per_month', { shouldDirty: true });
                        if (p === 'sale' && basis === 'per_month')
                          form.setValue('priceBasis', 'total', { shouldDirty: true });
                      }}
                      className={cn(
                        'h-8 border-r px-4 text-sm font-medium last:border-r-0 disabled:cursor-not-allowed disabled:text-muted-foreground/50',
                        field.value === p ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                      )}
                    >
                      {PURPOSE_LABELS[p]}
                    </button>
                  );
                })}
              </div>
            )}
          />
          {errors.purpose && <p className="text-sm text-destructive">{errors.purpose.message}</p>}
        </div>

        {/* Location: state, city, locality, pincode, road (asked once, here) */}
        <FormField id="pf-state" label="State" error={errors.location?.state?.message}>
          <Input id="pf-state" placeholder="e.g. Tamil Nadu" {...form.register('location.state')} />
        </FormField>
        <FormField id="pf-city" label="City / district *" error={errors.location?.city?.message}>
          <Input
            id="pf-city"
            list="pf-city-options"
            autoComplete="off"
            {...form.register('location.city')}
          />
        </FormField>
        <FormField
          id="pf-locality"
          label="Locality *"
          hint="The actual locality name"
          error={errors.location?.locality?.message}
        >
          <Input
            id="pf-locality"
            list="pf-locality-options"
            autoComplete="off"
            {...form.register('location.locality')}
          />
        </FormField>
        <FormField id="pf-pincode" label="Pincode *" error={errors.location?.pincode?.message}>
          <Input
            id="pf-pincode"
            list="pf-pincode-options"
            inputMode="numeric"
            maxLength={6}
            autoComplete="off"
            {...form.register('location.pincode')}
          />
        </FormField>
        <div className="grid content-start gap-2">
          <label htmlFor="pf-road-type" className="text-sm font-medium">
            Road type
          </label>
          <FieldSelect
            name="location.roadType"
            label="Road type"
            items={ROAD_ITEMS}
            className="w-full"
          />
        </div>
        <FormField
          id="pf-road-width"
          label="Road width (ft)"
          error={errors.location?.roadWidthFt?.message}
        >
          <Input
            id="pf-road-width"
            inputMode="decimal"
            placeholder="e.g. 30"
            aria-invalid={!!errors.location?.roadWidthFt}
            {...form.register('location.roadWidthFt')}
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

        {/* Area, price, live price per sq.ft. */}
        <div className="grid content-start gap-2">
          <label htmlFor="pf-area" className="text-sm font-medium">
            {areaLabel} *
          </label>
          <div className="flex gap-2">
            <Input
              id="pf-area"
              inputMode="decimal"
              aria-invalid={!!errors.areaValue}
              {...form.register('areaValue')}
            />
            <FieldSelect
              name="areaUnit"
              label="Area unit"
              items={UNIT_ITEMS}
              className="w-28 flex-none"
            />
          </div>
          {errors.areaValue ? (
            <p className="text-sm text-destructive" role="alert">
              {errors.areaValue.message}
            </p>
          ) : (
            sqft !== null &&
            areaUnit !== 'sqft' && (
              <p className="text-sm text-muted-foreground">= {groupIndian(sqft)} sq.ft</p>
            )
          )}
        </div>
        <div className="grid content-start gap-2">
          <label htmlFor="pf-price" className="text-sm font-medium">
            {purpose === 'sale' ? 'Asking price (₹) *' : 'Monthly rent (₹) *'}
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
            <FieldSelect
              name="priceBasis"
              label="Price basis"
              items={BASIS_ITEMS}
              className="w-32 flex-none"
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
            {(['negotiable', 'onRequest'] as const).map((name) => (
              <Controller
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    {name === 'negotiable' ? 'Negotiable' : 'Price on request'}
                  </label>
                )}
              />
            ))}
          </div>
        </div>
        <FormField
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
        </FormField>

        {purpose !== 'sale' && (
          <>
            <FormField id="pf-deposit" label="Security deposit (₹)" error={errors.deposit?.message}>
              <Input id="pf-deposit" inputMode="numeric" {...form.register('deposit')} />
            </FormField>
            <FormField
              id="pf-lockin"
              label="Lock-in period (months)"
              error={errors.lockIn?.message}
            >
              <Input id="pf-lockin" inputMode="numeric" {...form.register('lockIn')} />
            </FormField>
          </>
        )}

        {/* Common attributes of the category, e.g. facing */}
        {layout?.common
          .filter((a) => !removed.includes(a.key))
          .map((a) => (
            <AttributeField key={a.id} attribute={a} />
          ))}
      </div>
      <div className="mt-4">
        <AddressSection form={form} />
      </div>
    </NumberedSection>
  );
}
