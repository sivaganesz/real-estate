import {
  ChevronDownIcon,
  ChevronUpIcon,
  CrosshairIcon,
  EraserIcon,
  Loader2Icon,
  MapPinIcon,
  MapPinOffIcon,
  WandSparklesIcon,
} from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useWatch } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import { FormField } from '@/components/forms/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/errors';
import { useSettled } from '@/lib/useSettled';
import { useGeoReverse, useGeoSearch } from '../api';
import type { PropertyFormValues } from './formModel';
import type { LatLng } from './LocationMap';

const LocationMap = lazy(() => import('./LocationMap'));

const round = (n: number) => Number(n.toFixed(6));
const parsePin = (lat: string, lng: string): LatLng | null => {
  if (lat.trim() === '' || lng.trim() === '') return null;
  const a = Number(lat);
  const b = Number(lng);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180
    ? { lat: a, lng: b }
    : null;
};

/**
 * "Full address, landmark & map pin": opens and closes. Inside, a map follows the typed city,
 * area and pincode; the admin clicks to drop the pin or drags it, and the latitude, longitude
 * and nearest address are shown.
 */
export function AddressSection({ form }: { form: UseFormReturn<PropertyFormValues> }) {
  const { errors } = form.formState;
  const [state, address, landmark, lat, lng, city, locality, pincode] = useWatch({
    control: form.control,
    name: [
      'location.state',
      'location.address',
      'location.landmark',
      'location.lat',
      'location.lng',
      'location.city',
      'location.locality',
      'location.pincode',
    ],
  });
  const hasDetails = Boolean(state || address || landmark || lat || lng);
  const [open, setOpen] = useState(hasDetails);
  const pin = parsePin(lat, lng);

  // Find the typed address on the map once typing pauses. (Text keys keep the values stable.)
  const typedKey = useSettled(JSON.stringify({ city, locality, pincode, state }), 800);
  const typed = useMemo(
    () => JSON.parse(typedKey) as Record<'city' | 'locality' | 'pincode' | 'state', string>,
    [typedKey],
  );
  const search = useGeoSearch(typed, open);
  const found = search.data ?? null;
  const pinKey = useSettled(pin ? `${pin.lat},${pin.lng}` : '', 600);
  const settledPin = useMemo(
    () => (pinKey ? parsePin(...(pinKey.split(',') as [string, string])) : null),
    [pinKey],
  );
  const reverse = useGeoReverse(settledPin);
  const [focus, setFocus] = useState<(LatLng & { zoom?: number; key: string }) | null>(null);
  // A new address result takes over from "Show typed address" / "Go to pin".
  useEffect(() => setFocus(null), [found?.label]);
  // Follow the address until a pin is dropped.
  const addressFocus =
    found && !pin ? { lat: found.lat, lng: found.lng, zoom: 15, key: `addr:${found.label}` } : null;

  const setPin = (p: LatLng | null) => {
    form.setValue('location.lat', p ? String(round(p.lat)) : '', {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue('location.lng', p ? String(round(p.lng)) : '', {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const clearAll = () => {
    for (const name of [
      'location.state',
      'location.address',
      'location.landmark',
      'location.lat',
      'location.lng',
    ] as const) {
      form.setValue(name, '', { shouldDirty: true, shouldValidate: true });
    }
  };

  /** Fills empty address fields from the pin's nearest address. */
  const fillFromPin = () => {
    const r = reverse.data;
    if (!r) return;
    const fill = (
      name: 'location.city' | 'location.locality' | 'location.pincode' | 'location.state',
      value: string | null,
    ) => {
      if (value && !form.getValues(name))
        form.setValue(name, value, { shouldDirty: true, shouldValidate: true });
    };
    fill('location.city', r.city);
    fill('location.locality', r.locality);
    fill('location.pincode', r.pincode && /^[1-9]\d{5}$/.test(r.pincode) ? r.pincode : null);
    fill('location.state', r.state);
  };

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-dashed"
          aria-expanded={false}
          onClick={() => setOpen(true)}
        >
          <MapPinIcon /> Full address, landmark &amp; map pin <ChevronDownIcon />
        </Button>
        {hasDetails && (
          <span className="text-xs text-muted-foreground">
            {[
              pin && `Pin ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`,
              address,
              landmark && `near ${landmark}`,
              state,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        )}
      </div>
    );
  }

  return (
    <section
      className="grid gap-4 rounded-xl border border-dashed p-4"
      aria-label="Full address, landmark and map pin"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <MapPinIcon className="size-4" /> Full address, landmark &amp; map pin
          <span className="font-normal text-muted-foreground">(optional)</span>
        </h3>
        <div className="flex gap-1">
          {hasDetails && (
            <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
              <EraserIcon /> Clear
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded
            onClick={() => setOpen(false)}
          >
            Close <ChevronUpIcon />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="pf-state" label="State" error={errors.location?.state?.message}>
          <Input id="pf-state" placeholder="e.g. Tamil Nadu" {...form.register('location.state')} />
        </FormField>
        <FormField id="pf-landmark" label="Landmark" error={errors.location?.landmark?.message}>
          <Input id="pf-landmark" placeholder="Near…" {...form.register('location.landmark')} />
        </FormField>
        <div className="sm:col-span-2">
          <FormField id="pf-address" label="Full address" error={errors.location?.address?.message}>
            <Input
              id="pf-address"
              placeholder="Door no., street"
              {...form.register('location.address')}
            />
          </FormField>
        </div>
      </div>

      <div className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium">Map pin</span>
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {search.isFetching
              ? 'Finding the address on the map…'
              : search.error
                ? errorMessage(search.error)
                : pin
                  ? 'Drag the pin to adjust it.'
                  : found
                    ? 'Map shows the typed address. Click the exact spot to drop the pin.'
                    : search.isSuccess
                      ? "Couldn't find this address. Zoom in and click to drop the pin."
                      : 'Type the city, area or pincode, or click the map to drop the pin.'}
          </span>
        </div>
        <Suspense fallback={<Skeleton className="h-72 w-full rounded-lg" />}>
          <LocationMap pin={pin} focus={focus ?? addressFocus} onPin={setPin} />
        </Suspense>
        <div className="flex flex-wrap gap-2">
          {found && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setFocus({ lat: found.lat, lng: found.lng, zoom: 15, key: `addr:${Date.now()}` })
              }
            >
              <CrosshairIcon /> Show typed address
            </Button>
          )}
          {found && !pin && (
            <Button type="button" variant="outline" size="sm" onClick={() => setPin(found)}>
              <MapPinIcon /> Drop pin here
            </Button>
          )}
          {pin && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFocus({ ...pin, zoom: 17, key: `pin:${Date.now()}` })}
              >
                <CrosshairIcon /> Go to pin
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPin(null)}>
                <MapPinOffIcon /> Remove pin
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="pf-lat" label="Latitude" error={errors.location?.lat?.message}>
          <Input
            id="pf-lat"
            inputMode="decimal"
            placeholder="e.g. 12.924900"
            {...form.register('location.lat')}
          />
        </FormField>
        <FormField
          id="pf-lng"
          label="Longitude"
          error={errors.location?.lng?.message}
          hint="Set by the pin, or paste from Google Maps"
        >
          <Input
            id="pf-lng"
            inputMode="decimal"
            placeholder="e.g. 80.100000"
            {...form.register('location.lng')}
          />
        </FormField>
      </div>

      {pin && (
        <div
          className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-muted/50 p-3 text-sm"
          aria-live="polite"
        >
          <div className="min-w-0">
            <div className="font-medium">
              Pin: {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}
            </div>
            <div className="text-muted-foreground">
              {reverse.isFetching ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2Icon className="size-3.5 animate-spin" /> Reading the location…
                </span>
              ) : reverse.data ? (
                reverse.data.label
              ) : reverse.error ? (
                errorMessage(reverse.error)
              ) : (
                'No address found at this spot'
              )}
            </div>
          </div>
          {reverse.data && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fillFromPin}
              title="Fills only the empty city, area, pincode and state fields"
            >
              <WandSparklesIcon /> Fill empty fields from pin
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
