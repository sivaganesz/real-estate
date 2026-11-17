import {
  ADVERTISING_LABELS,
  advertising,
  customerPreview,
  INFRA_STATUS_LABELS,
  INFRA_STATUSES,
  MAX_NEARBY_PLACES,
  NEARBY_CATEGORIES,
  ROAD_TYPES,
} from '@real-estate/shared';
import type { NearbyInput, Property, UpdateLocationBody } from '@real-estate/shared';
import { CheckIcon, ExternalLinkIcon, Loader2Icon, PlusIcon, XIcon } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/auth/auth-context';
import { Chip, Note } from '@/components/patterns';
import type { Tone } from '@/components/patterns';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { useGeoSearch, useUpdateLocation } from '../api';

const LocationMap = lazy(() => import('../form/LocationMap'));

type Save = (body: UpdateLocationBody) => Promise<unknown>;
type SaveState = { state: 'idle' | 'saving' | 'saved' } | { state: 'error'; message: string };

/** Runs one inline save and reports saving → saved, or the error (edits are kept). */
function useInlineSave(save: Save) {
  const [status, setStatus] = useState<SaveState>({ state: 'idle' });
  const run = async (body: UpdateLocationBody) => {
    setStatus({ state: 'saving' });
    try {
      await save(body);
      setStatus({ state: 'saved' });
    } catch (err) {
      setStatus({ state: 'error', message: errorMessage(err) });
    }
  };
  return { status, run };
}

function SaveHint({ status }: { status: SaveState }) {
  if (status.state === 'saving')
    return (
      <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" aria-label="Saving" />
    );
  if (status.state === 'saved')
    return <CheckIcon className="size-3.5 text-tone-green" aria-label="Saved" />;
  return null;
}

/** A labelled field that saves when it loses focus (PROP-67). */
function InlineField({
  id,
  label,
  value,
  disabled,
  wide,
  inputMode,
  placeholder,
  toBody,
  save,
}: {
  id: string;
  label: string;
  value: string;
  disabled?: boolean;
  wide?: boolean;
  inputMode?: 'decimal' | 'numeric';
  placeholder?: string;
  /** The save for the new text, or an error message to show instead. */
  toBody: (text: string) => UpdateLocationBody | string;
  save: Save;
}) {
  const [text, setText] = useState(value);
  const [problem, setProblem] = useState<string | null>(null);
  const { status, run } = useInlineSave(save);
  useEffect(() => setText(value), [value]);
  const commit = () => {
    setProblem(null);
    if (text.trim() === value.trim()) return;
    const body = toBody(text.trim());
    if (typeof body === 'string') return setProblem(body);
    void run(body);
  };
  const error = problem ?? (status.state === 'error' ? status.message : null);
  return (
    <div className={cn('grid content-start gap-1.5', wide && 'sm:col-span-2 lg:col-span-3')}>
      <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
        {label} <SaveHint status={status} />
      </label>
      <Input
        id={id}
        value={text}
        disabled={disabled}
        inputMode={inputMode}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
      />
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const optionalNumber = (text: string, message: string): number | null | string => {
  if (text === '') return null;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? n : message;
};

function CardHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2.5">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </div>
  );
}

const ADVERTISING_TONES = {
  ok: 'green',
  route_not_checked: 'amber',
  not_existing: 'amber',
} as const;
const CATEGORY_ITEMS = NEARBY_CATEGORIES.map((c) => ({ value: c, label: c }));
const STATUS_ITEMS = INFRA_STATUSES.map((s) => ({ value: s, label: INFRA_STATUS_LABELS[s] }));
const ROAD_ITEMS = [
  { value: '', label: 'Not recorded' },
  ...ROAD_TYPES.map((r) => ({ value: r, label: r })),
];

function SmallSelect({
  label,
  value,
  items,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  items: { value: string; label: string }[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      items={items}
      value={value}
      disabled={disabled}
      onValueChange={(v) => v !== null && v !== value && onChange(v as string)}
    >
      <SelectTrigger aria-label={label} className="w-full">
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
  );
}

/** Nearby places (PROP-24/25): every edit saves the list; the chip says what may be advertised. */
function NearbyTable({
  property: p,
  readOnly,
  save,
}: {
  property: Property;
  readOnly: boolean;
  save: Save;
}) {
  const { status, run } = useInlineSave(save);
  const rows: NearbyInput[] = p.nearby;
  const saveRows = (next: NearbyInput[]) => run({ nearby: next });
  const patchRow = (i: number, change: Partial<NearbyInput>) =>
    saveRows(rows.map((r, j) => (j === i ? { ...r, ...change } : r)));

  return (
    <Card className="gap-0 p-5">
      <CardHead title="Schools, hospitals, transport & infrastructure">
        <SaveHint status={status} />
        {!readOnly && (
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            disabled={rows.length >= MAX_NEARBY_PLACES || status.state === 'saving'}
            onClick={() =>
              saveRows([
                ...rows,
                {
                  category: 'School',
                  name: '',
                  distanceKm: null,
                  routeChecked: false,
                  status: 'existing',
                },
              ])
            }
          >
            <PlusIcon /> Add place
          </Button>
        )}
      </CardHead>
      <p className="-mt-1.5 mb-3 text-[13px] text-muted-foreground">
        Record the <b>measured</b> road distance. Tick “route checked” only after the actual route
        and travel conditions were verified.
      </p>
      {status.state === 'error' && (
        <p className="mb-2 text-sm text-destructive" role="alert">
          {status.message}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <Table aria-label="Nearby places" className="min-w-[720px] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Category</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-24">Distance (km)</TableHead>
              <TableHead className="w-[72px] text-center whitespace-normal">
                Route checked
              </TableHead>
              <TableHead className="w-32">Status</TableHead>
              <TableHead className="w-40">Advertising</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Remove</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                  No places recorded yet.
                </TableCell>
              </TableRow>
            )}
            {rows.map((n, i) => {
              const ad = advertising(n);
              return (
                <TableRow key={n.id ?? i}>
                  <TableCell>
                    <SmallSelect
                      label={`Category, row ${i + 1}`}
                      value={n.category}
                      items={CATEGORY_ITEMS}
                      disabled={readOnly}
                      onChange={(v) => patchRow(i, { category: v as NearbyInput['category'] })}
                    />
                  </TableCell>
                  <TableCell>
                    <CellInput
                      label={`Name, row ${i + 1}`}
                      value={n.name}
                      disabled={readOnly}
                      onCommit={(text) => patchRow(i, { name: text })}
                    />
                  </TableCell>
                  <TableCell>
                    <CellInput
                      label={`Distance, row ${i + 1}`}
                      value={n.distanceKm === null ? '' : String(n.distanceKm)}
                      inputMode="decimal"
                      disabled={readOnly}
                      onCommit={(text) => {
                        const km = optionalNumber(text, 'Enter the distance in km');
                        if (typeof km === 'string') return km;
                        void patchRow(i, { distanceKm: km });
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      aria-label={`Route checked, row ${i + 1}`}
                      checked={n.routeChecked}
                      disabled={readOnly}
                      onCheckedChange={(c) => patchRow(i, { routeChecked: Boolean(c) })}
                    />
                  </TableCell>
                  <TableCell>
                    <SmallSelect
                      label={`Status, row ${i + 1}`}
                      value={n.status}
                      items={STATUS_ITEMS}
                      disabled={readOnly}
                      onChange={(v) => patchRow(i, { status: v as NearbyInput['status'] })}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip tone={ADVERTISING_TONES[ad] as Tone}>{ADVERTISING_LABELS[ad]}</Chip>
                  </TableCell>
                  <TableCell>
                    {!readOnly && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${n.name || `row ${i + 1}`}`}
                        onClick={() => saveRows(rows.filter((_, j) => j !== i))}
                      >
                        <XIcon />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

/** A table cell input that commits on blur; `onCommit` may return an error message. */
function CellInput({
  label,
  value,
  inputMode,
  disabled,
  onCommit,
}: {
  label: string;
  value: string;
  inputMode?: 'decimal';
  disabled?: boolean;
  onCommit: (text: string) => string | void | Promise<unknown>;
}) {
  const [text, setText] = useState(value);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => setText(value), [value]);
  return (
    <>
      <Input
        aria-label={label}
        value={text}
        inputMode={inputMode}
        disabled={disabled}
        aria-invalid={Boolean(problem)}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          setProblem(null);
          if (text.trim() === value) return;
          const result = onCommit(text.trim());
          if (typeof result === 'string') setProblem(result);
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
      />
      {problem && <p className="mt-1 text-xs text-destructive">{problem}</p>}
    </>
  );
}

/**
 * Location tab (PROP-22–27, wireframe `propLocation`). Every field saves on its own when it
 * loses focus; a failed save is shown next to the field and the other edits are kept.
 */
export function LocationTab({ property: p }: { property: Property }) {
  const { can } = useAuth();
  const readOnly = !can('properties:write') || p.status === 'archived';
  const update = useUpdateLocation(p.id);
  const save: Save = (body) => update.mutateAsync(body);
  const pinSave = useInlineSave(save);
  const L = p.location;
  const pin = L.mapPin;
  // Until a pin is dropped, the map shows the typed address (looked up through our API).
  const typed = useGeoSearch(
    { locality: L.locality, city: L.city, state: L.state, pincode: L.pincode },
    !pin,
  );
  const hw = p.highway ?? { name: '', distanceKm: null, routeNote: '' };
  const highwayBody = (change: Partial<typeof hw>): UpdateLocationBody => {
    const next = { ...hw, ...change };
    return { highway: next.name || next.distanceKm !== null || next.routeNote ? next : null };
  };
  const preview = customerPreview(p.nearby);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid min-w-0 gap-4">
        <Card className="gap-0 p-5">
          <CardHead title="C. Location specification">
            <span className="ml-auto text-xs text-muted-foreground">
              {readOnly ? 'Read only' : 'Edits save automatically'}
            </span>
          </CardHead>
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            <InlineField
              id="loc-state"
              label="State"
              value={L.state}
              disabled
              toBody={() => ''}
              save={save}
            />
            <InlineField
              id="loc-city"
              label="District / city"
              value={L.city}
              disabled
              toBody={() => ''}
              save={save}
            />
            {(
              [
                ['locality', 'Locality', undefined],
                ['pincode', 'Pincode', 'numeric'],
                ['landmark', 'Landmark', undefined],
              ] as const
            ).map(([key, label, mode]) => (
              <InlineField
                key={key}
                id={`loc-${key}`}
                label={label}
                value={L[key]}
                disabled={readOnly}
                inputMode={mode}
                toBody={(text) => ({ location: { [key]: text } })}
                save={save}
              />
            ))}
            <InlineField
              id="loc-address"
              label="Full address"
              value={L.address}
              disabled={readOnly}
              placeholder="Door no., street"
              toBody={(text) => ({ location: { address: text } })}
              save={save}
            />
            {(['lat', 'lng'] as const).map((axis) => (
              <InlineField
                key={axis}
                id={`loc-${axis}`}
                label={axis === 'lat' ? 'Latitude' : 'Longitude'}
                value={pin ? String(pin[axis]) : ''}
                disabled={readOnly}
                inputMode="decimal"
                toBody={(text) => {
                  const other = axis === 'lat' ? 'lng' : 'lat';
                  if (text === '') return { location: { mapPin: null } };
                  const n = Number(text);
                  const limit = axis === 'lat' ? 90 : 180;
                  if (!Number.isFinite(n) || Math.abs(n) > limit)
                    return `Enter a number between -${limit} and ${limit}`;
                  if (!pin) return 'Drop the pin on the map, or enter both coordinates';
                  return { location: { mapPin: { ...pin, [axis]: n, [other]: pin[other] } } };
                }}
                save={save}
              />
            ))}
            <div className="grid content-start gap-1.5">
              <span className="text-xs font-medium text-ink-2">Road type</span>
              <SmallSelect
                label="Road type"
                value={L.roadType}
                items={ROAD_ITEMS}
                disabled={readOnly}
                onChange={(v) => void save({ location: { roadType: v as typeof L.roadType } })}
              />
            </div>
            <InlineField
              id="loc-road-width"
              label="Road width (ft)"
              value={L.roadWidthFt === null ? '' : String(L.roadWidthFt)}
              disabled={readOnly}
              inputMode="decimal"
              toBody={(text) => {
                const ft = optionalNumber(text, 'Enter the width in feet');
                return typeof ft === 'string' ? ft : { location: { roadWidthFt: ft } };
              }}
              save={save}
            />
            <InlineField
              id="loc-highway"
              label="Highway access"
              value={hw.name}
              disabled={readOnly}
              placeholder="e.g. NH 44"
              toBody={(text) => highwayBody({ name: text })}
              save={save}
            />
            <InlineField
              id="loc-highway-km"
              label="Highway distance (km, by road)"
              value={hw.distanceKm === null ? '' : String(hw.distanceKm)}
              disabled={readOnly}
              inputMode="decimal"
              toBody={(text) => {
                const km = optionalNumber(text, 'Enter the distance in km');
                return typeof km === 'string' ? km : highwayBody({ distanceKm: km });
              }}
              save={save}
            />
            <InlineField
              id="loc-highway-route"
              label="Highway route — how it was measured"
              value={hw.routeNote}
              disabled={readOnly}
              wide
              placeholder="e.g. Route driven 02 Nov 2026"
              toBody={(text) => highwayBody({ routeNote: text })}
              save={save}
            />
          </div>
        </Card>

        <NearbyTable property={p} readOnly={readOnly} save={save} />
      </div>

      <div className="grid min-w-0 gap-4">
        <Card className="gap-0 p-5">
          <CardHead title="Map">
            <SaveHint status={pinSave.status} />
            {pin && (
              <a
                href={`https://www.google.com/maps?q=${pin.lat},${pin.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                Open in maps <ExternalLinkIcon className="size-3.5" />
              </a>
            )}
          </CardHead>
          <Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
            <div
              className={cn('overflow-hidden rounded-lg border', readOnly && 'pointer-events-none')}
            >
              <LocationMap
                pin={pin}
                focus={
                  pin
                    ? { ...pin, zoom: 15, key: `pin:${pin.lat},${pin.lng}` }
                    : typed.data
                      ? {
                          lat: typed.data.lat,
                          lng: typed.data.lng,
                          zoom: 15,
                          key: typed.data.label,
                        }
                      : null
                }
                onPin={(next) =>
                  void pinSave.run({
                    location: {
                      mapPin: {
                        lat: Number(next.lat.toFixed(6)),
                        lng: Number(next.lng.toFixed(6)),
                      },
                    },
                  })
                }
              />
            </div>
          </Suspense>
          <p className="mt-2 text-xs text-muted-foreground">
            {pin
              ? `${pin.lat}, ${pin.lng}. Drag the pin to adjust.`
              : readOnly
                ? 'No GPS coordinates yet.'
                : 'Click the exact spot to drop the pin.'}
          </p>
          {pinSave.status.state === 'error' && (
            <p className="mt-1 text-xs text-destructive" role="alert">
              {pinSave.status.message}
            </p>
          )}
        </Card>

        <Card className="gap-0 p-5">
          <CardHead title="Customer-facing preview" />
          <p className="-mt-2 mb-2 text-[13px] text-muted-foreground">
            What the listing may claim, generated from the rules above.
          </p>
          <b className="text-[13px]">Nearby (measured by road)</b>
          <ul className="mt-1 list-disc pl-[18px] text-[13px] text-ink-2">
            {preview.verified.map((n) => (
              <li key={n.id}>
                {n.name}
                {n.distanceKm !== null && ` — ${n.distanceKm} km`}
              </li>
            ))}
            {p.highway?.name && (
              <li>
                {p.highway.name}
                {p.highway.distanceKm !== null && ` — ${p.highway.distanceKm} km`}
              </li>
            )}
            {preview.verified.length === 0 && !p.highway?.name && (
              <li className="text-muted-foreground">Nothing verified yet</li>
            )}
          </ul>
          {preview.future.length > 0 && (
            <>
              <b className="mt-3 block text-[13px]">Future infrastructure — not yet existing</b>
              <ul className="mt-1 list-disc pl-[18px] text-[13px] text-ink-2">
                {preview.future.map((n) => (
                  <li key={n.id}>
                    {n.name} <Chip tone="amber">{INFRA_STATUS_LABELS[n.status]}</Chip>
                  </li>
                ))}
              </ul>
            </>
          )}
          {preview.hiddenCount > 0 && (
            <Note tone="amber" className="mt-2">
              {preview.hiddenCount} place{preview.hiddenCount === 1 ? '' : 's'} hidden until the
              route is checked. Never say “5 minutes away” without verifying.
            </Note>
          )}
        </Card>
      </div>
    </div>
  );
}
