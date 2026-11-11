import { zodResolver } from '@hookform/resolvers/zod';
import { nationalNumber, updateCompanySettingsBodySchema } from '@real-estate/shared';
import type { CompanySettings } from '@real-estate/shared';
import { Loader2Icon, MapPinIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ClipboardEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField } from '@/components/forms/FormField';
import { PhoneInput } from '@/components/forms/PhoneInput';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useCompanySettings, useUpdateCompanySettings } from '@/features/settings/api';
import { LogoUploader } from '@/features/settings/LogoUploader';
import { SettingsNav } from '@/features/settings/SettingsNav';
import { errorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

/** A map-pin coordinate typed as text: empty, or a number within ±limit. */
const coordinate = (limit: number) =>
  z
    .string()
    .trim()
    .refine(
      (text) => text === '' || Math.abs(Number(text)) <= limit,
      `Enter a number between -${limit} and ${limit}`,
    );

type Pin = { latitude?: string; longitude?: string };
const blank = (text?: string) => (text ?? '').trim() === '';
/** "Fill both or neither"; `when` makes it run even while other fields still have errors. */
const bothOrNeither = (field: keyof Pin) => ({
  path: [field],
  message: 'Enter both latitude and longitude, or neither',
  when: () => true,
});

/** Same rules as the API; the map pin is typed as two text fields and checked here. */
const formSchema = updateCompanySettingsBodySchema
  .omit({ officeLocation: true })
  .extend({ latitude: coordinate(90), longitude: coordinate(180) })
  .refine((v: Pin) => !(blank(v.latitude) && !blank(v.longitude)), bothOrNeither('latitude'))
  .refine((v: Pin) => !(blank(v.longitude) && !blank(v.latitude)), bothOrNeither('longitude'));
type FormInput = z.input<typeof formSchema>;

const FORM_ID = 'company-info-form';

const toFormValues = (s: CompanySettings): FormInput => ({
  // Before the first save the name is only a placeholder, so start empty.
  name: s.isConfigured ? s.name : '',
  shortDescription: s.shortDescription,
  address: s.address,
  latitude: s.officeLocation ? String(s.officeLocation.lat) : '',
  longitude: s.officeLocation ? String(s.officeLocation.lng) : '',
  phone: nationalNumber(s.phone),
  email: s.email ?? '',
});

/** The value after it has stopped changing for `ms` (so the map doesn't reload on every key). */
function useSettled<T>(value: T, ms = 600): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/** Map preview of the office pin (OpenStreetMap embed), or a hint when there is no pin. */
function MapPreview({ lat, lng }: { lat: number; lng: number } | { lat?: never; lng?: never }) {
  if (lat === undefined) {
    return (
      <div className="flex h-[170px] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed bg-muted/40 px-4 text-center text-xs text-muted-foreground">
        <MapPinIcon className="size-5" aria-hidden />
        In Google Maps, right-click your office, copy the numbers and paste them below.
      </div>
    );
  }
  const d = 0.004;
  const bbox = [lng - d, lat - d, lng + d, lat + d].join(',');
  return (
    <iframe
      title="Office location map"
      src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`}
      className="h-[170px] w-full rounded-lg border"
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}

function CompanyForm({ settings }: { settings: CompanySettings }) {
  const update = useUpdateCompanySettings();
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: toFormValues(settings),
  });
  const { errors, isSubmitting, isDirty } = form.formState;
  const [name, latitude, longitude] = useWatch({
    control: form.control,
    name: ['name', 'latitude', 'longitude'],
  });

  // Keep unsaved edits when only the logo changes (it saves on its own).
  useEffect(() => {
    if (!form.formState.isDirty) form.reset(toFormValues(settings));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.updatedAt]);

  const onSubmit = form.handleSubmit(async ({ latitude: lat, longitude: lng, ...values }) => {
    try {
      const saved = await update.mutateAsync({
        ...values,
        officeLocation: lat !== '' ? { lat: Number(lat), lng: Number(lng) } : null,
      });
      form.reset(toFormValues(saved));
      toast.success('Company info saved');
    } catch {
      // Shown in the alert below.
    }
  });

  /** Pasting "12.97, 77.59" (as copied from Google Maps) into either field fills both. */
  const onCoordinatesPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const match = event.clipboardData
      .getData('text')
      .match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!match) return;
    event.preventDefault();
    form.setValue('latitude', match[1]!, { shouldDirty: true, shouldValidate: true });
    form.setValue('longitude', match[2]!, { shouldDirty: true, shouldValidate: true });
  };

  const pin = useSettled(
    (() => {
      const lat = Number(latitude);
      const lng = Number(longitude);
      const ok =
        !blank(latitude) && !blank(longitude) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
      return ok ? `${lat},${lng}` : '';
    })(),
  );
  const [pinLat, pinLng] = pin ? pin.split(',').map(Number) : [];
  const pinError = errors.latitude?.message ?? errors.longitude?.message;

  return (
    <>
      <SettingsNav
        actions={
          <>
            <span className="text-xs text-muted-foreground">
              {settings.updatedAt && settings.updatedBy
                ? `Last updated by ${settings.updatedBy.name} · ${formatDateTime(settings.updatedAt)}`
                : 'Not saved yet'}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!isDirty || isSubmitting}
                onClick={() => {
                  form.reset(toFormValues(settings));
                  update.reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" form={FORM_ID} disabled={isSubmitting || !isDirty}>
                {isSubmitting && <Loader2Icon className="animate-spin" />}
                Save changes
              </Button>
            </div>
          </>
        }
      />
      <form id={FORM_ID} onSubmit={onSubmit} className="grid gap-4" noValidate>
        {update.error && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(update.error)}</AlertDescription>
          </Alert>
        )}

        <Card className="gap-4 p-5">
          <h3 className="font-semibold">Brand</h3>
          <div className="flex flex-wrap items-start gap-6">
            <LogoUploader logoUrl={settings.logoUrl} name={name || settings.name} />
            <div className="grid min-w-0 flex-[1_1_320px] gap-4">
              <FormField id="company-name" label="Company name *" error={errors.name?.message}>
                <Input
                  id="company-name"
                  autoComplete="organization"
                  placeholder="[Company] Realty"
                  aria-invalid={!!errors.name}
                  {...form.register('name')}
                />
              </FormField>
              <FormField
                id="company-description"
                label="Short description"
                error={errors.shortDescription?.message}
              >
                <Textarea
                  id="company-description"
                  rows={3}
                  placeholder="2–3 lines about the company (used in emails and, later, the website footer)"
                  aria-invalid={!!errors.shortDescription}
                  {...form.register('shortDescription')}
                />
              </FormField>
            </div>
          </div>
        </Card>

        <Card className="gap-4 p-5">
          <h3 className="font-semibold">Contact details</h3>
          <div className="flex flex-wrap items-start gap-6">
            <div className="grid min-w-0 flex-[2_1_380px] gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FormField
                  id="company-address"
                  label="Office address *"
                  error={errors.address?.message}
                >
                  <Textarea
                    id="company-address"
                    rows={3}
                    autoComplete="street-address"
                    placeholder="No. 12, GST Road, Tambaram, Chennai 600045"
                    aria-invalid={!!errors.address}
                    {...form.register('address')}
                  />
                </FormField>
              </div>
              <FormField id="company-phone" label="Phone *" error={errors.phone?.message}>
                <PhoneInput
                  id="company-phone"
                  aria-invalid={!!errors.phone}
                  {...form.register('phone')}
                />
              </FormField>
              <FormField id="company-email" label="Email *" error={errors.email?.message}>
                <Input
                  id="company-email"
                  type="email"
                  autoComplete="email"
                  placeholder="info@company.com"
                  aria-invalid={!!errors.email}
                  {...form.register('email')}
                />
              </FormField>
            </div>

            <div className="grid min-w-0 flex-[1_1_220px] gap-2">
              <span className="text-sm font-medium">
                Office map pin <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
              {pin ? <MapPreview lat={pinLat!} lng={pinLng!} /> : <MapPreview />}
              <div className="grid grid-cols-2 gap-2">
                <Input
                  id="company-lat"
                  inputMode="decimal"
                  placeholder="Latitude"
                  aria-label="Latitude"
                  aria-invalid={!!errors.latitude}
                  onPaste={onCoordinatesPaste}
                  {...form.register('latitude')}
                />
                <Input
                  id="company-lng"
                  inputMode="decimal"
                  placeholder="Longitude"
                  aria-label="Longitude"
                  aria-invalid={!!errors.longitude}
                  onPaste={onCoordinatesPaste}
                  {...form.register('longitude')}
                />
              </div>
              {pinError && (
                <p className="text-sm text-destructive" role="alert">
                  {pinError}
                </p>
              )}
            </div>
          </div>
        </Card>
      </form>
    </>
  );
}

/**
 * Settings → Company info (PRD ADM-SET-01/02). Needs `settings:edit`. No page title: the
 * sidebar and breadcrumbs already say where you are, so the tabs sit at the top.
 */
export function CompanySettingsPage() {
  const { data, error, isPending, refetch } = useCompanySettings();

  if (data) return <CompanyForm settings={data} />;
  return (
    <>
      <SettingsNav />
      {isPending ? (
        <div className="grid gap-4" aria-label="Loading company info">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            {errorMessage(error)}
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
