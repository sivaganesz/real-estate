import {
  formatArea,
  formatINR,
  formatPrice,
  MEDIA_RULES,
  PURPOSE_LABELS,
} from '@real-estate/shared';
import type { Category, PlacedAttribute, Property } from '@real-estate/shared';
import {
  CopyIcon,
  ExternalLinkIcon,
  FileTextIcon,
  ImageOffIcon,
  PencilIcon,
  RefreshCwIcon,
  StarIcon,
  VideoIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '@/auth/auth-context';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDuplicateProperty, useProperty, usePropertyHistory } from '@/features/properties/api';
import { ChangeStatusDialog } from '@/features/properties/ChangeStatusDialog';
import {
  ACTION_LABELS,
  formatAttributeValue,
  historyFieldLabel,
  historyValue,
  namesFrom,
} from '@/features/properties/display';
import { StatusBadge } from '@/features/properties/StatusBadge';
import { AmenityIcon } from '@/features/propertyTypes/AmenityIcon';
import { usePropertyTypes } from '@/features/propertyTypes/api';
import { errorMessage } from '@/lib/errors';
import { formatDate, formatDateTime } from '@/lib/format';

/** Property detail (/properties/:id) and change history (/properties/:id/history). */
export function PropertyDetailPage({ tab }: { tab: 'details' | 'history' }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const canWrite = can('properties:write');
  const property = useProperty(id);
  const types = usePropertyTypes();
  const duplicate = useDuplicateProperty();
  const [changingStatus, setChangingStatus] = useState(false);

  if (property.isPending || types.isPending) {
    return (
      <div className="grid gap-5">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }
  if (property.error || types.error || !property.data || !types.data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{errorMessage(property.error ?? types.error)}</AlertDescription>
      </Alert>
    );
  }
  const p = property.data;
  const archived = p.status === 'archived';

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        <Tabs
          value={tab}
          onValueChange={(v) =>
            navigate(v === 'history' ? `/properties/${id}/history` : `/properties/${id}`)
          }
        >
          <TabsList variant="line">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="history">Change history</TabsTrigger>
          </TabsList>
        </Tabs>
        {canWrite && (
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setChangingStatus(true)}>
              {archived ? <RefreshCwIcon /> : null}
              {archived ? 'Restore…' : 'Change status…'}
            </Button>
            <Button
              variant="outline"
              disabled={duplicate.isPending}
              onClick={() =>
                duplicate.mutate(p.id, {
                  onSuccess: (copy) => {
                    toast.success(`Copied as ${copy.code} (draft)`);
                    navigate(`/properties/${copy.id}/edit`);
                  },
                  onError: (err) => toast.error(errorMessage(err)),
                })
              }
            >
              <CopyIcon /> Duplicate
            </Button>
            {!archived && (
              <Button nativeButton={false} render={<Link to={`/properties/${p.id}/edit`} />}>
                <PencilIcon /> Edit
              </Button>
            )}
          </div>
        )}
      </div>

      {tab === 'details' ? (
        <Details property={p} categories={types.data.categories} canWrite={canWrite} />
      ) : (
        <History property={p} categories={types.data.categories} />
      )}

      {changingStatus && (
        <ChangeStatusDialog
          targets={[{ id: p.id, code: p.code, status: p.status, purpose: p.purpose }]}
          onClose={() => setChangingStatus(false)}
        />
      )}
    </>
  );
}

function Details({
  property: p,
  categories,
  canWrite,
}: {
  property: Property;
  categories: Category[];
  canWrite: boolean;
}) {
  const category = categories.find((c) => c.key === p.categoryKey);
  const sub = category?.subcategories.find((s) => s.id === p.subcategoryId);
  const placed: PlacedAttribute[] = [
    ...(category?.commonAttributes ?? []),
    ...(sub?.attributes ?? []),
  ];
  const longTexts = placed.filter(
    (a) => a.type === 'long_text' && p.attributeValues[a.key] !== undefined,
  );
  const details = placed
    .filter((a) => a.type !== 'long_text')
    .flatMap((a) => {
      const shown = formatAttributeValue(a, p.attributeValues[a.key]);
      return shown ? [{ label: a.label, value: shown, filter: a.searchFilter }] : [];
    });
  const extras = p.extraAttributes.map((e) => ({
    label: e.label,
    value: e.type === 'yes_no' ? (e.value ? 'Yes' : 'No') : String(e.value),
  }));
  const photos = p.media.filter((m) => m.kind === 'image');
  const cover = photos.find((m) => m.isCover) ?? photos[0];
  const others = photos.filter((m) => m !== cover);
  const files = p.media.filter((m) => m.kind !== 'image');
  const amenities = (category?.amenities ?? []).filter((a) => p.amenityIds.includes(a.id));
  const chips = [
    p.area && formatArea(p.area.value, p.area.unit),
    ...details
      .filter((d) => d.filter)
      .slice(0, 4)
      .map((d) => (d.label === 'BHK' ? d.value : `${d.label}: ${d.value}`)),
  ].filter(Boolean) as string[];
  const pin = p.location.mapPin;
  const address = [
    p.location.address,
    [p.location.locality, p.location.city].filter(Boolean).join(', '),
    [p.location.state, p.location.pincode].filter(Boolean).join(' '),
  ].filter(Boolean);

  return (
    <div className="flex flex-wrap items-start gap-5">
      <div className="grid min-w-0 flex-[3_1_560px] gap-5">
        <Card className="grid gap-4 p-5">
          {cover ? (
            <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
              <a
                href={cover.url}
                target="_blank"
                rel="noreferrer"
                className="overflow-hidden rounded-xl"
              >
                <img
                  src={cover.mediumUrl ?? cover.url}
                  alt={p.title}
                  className="aspect-[4/3] w-full object-cover"
                />
              </a>
              {others.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
                  {others.slice(0, 2).map((m, i) => (
                    <a
                      key={m.id}
                      href={m.url}
                      target="_blank"
                      rel="noreferrer"
                      className="relative overflow-hidden rounded-xl"
                    >
                      <img
                        src={m.thumbUrl ?? m.url}
                        alt=""
                        className="aspect-[4/3] w-full object-cover"
                      />
                      {i === 1 && others.length > 2 && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-medium text-white">
                          +{others.length - 2} more
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex aspect-[3/1] flex-col items-center justify-center gap-2 rounded-xl bg-muted text-sm text-muted-foreground">
              <ImageOffIcon className="size-6" /> No photos yet
            </div>
          )}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold">
                {p.title}
                {p.isFeatured && (
                  <StarIcon
                    className="size-4 fill-amber-400 text-amber-400"
                    aria-label="Featured"
                  />
                )}
              </h1>
              <p className="text-sm text-muted-foreground">
                {p.code} · {category?.name} › {p.subcategoryName} · {PURPOSE_LABELS[p.purpose]}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xl font-semibold">{formatPrice(p.price)}</div>
              {p.price.negotiable && !p.price.onRequest && p.price.amount !== null && (
                <div className="text-sm text-muted-foreground">Negotiable</div>
              )}
            </div>
          </div>
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {chips.map((c) => (
                <Badge key={c} variant="secondary">
                  {c}
                </Badge>
              ))}
            </div>
          )}
          {longTexts.map((a) => (
            <p key={a.key} className="text-sm whitespace-pre-line text-muted-foreground">
              {String(p.attributeValues[a.key])}
            </p>
          ))}
        </Card>

        {(details.length > 0 || extras.length > 0 || p.rental) && (
          <Card className="grid gap-4 p-5">
            <h2 className="font-semibold">{p.subcategoryName} details</h2>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {[...details, ...extras].map((d) => (
                <div key={d.label}>
                  <dt className="text-muted-foreground">{d.label}</dt>
                  <dd className="font-medium">{d.value}</dd>
                </div>
              ))}
              {p.rental?.securityDeposit != null && (
                <div>
                  <dt className="text-muted-foreground">Security deposit</dt>
                  <dd className="font-medium">{formatINR(p.rental.securityDeposit)}</dd>
                </div>
              )}
              {p.rental?.lockInMonths != null && (
                <div>
                  <dt className="text-muted-foreground">Lock-in period</dt>
                  <dd className="font-medium">{p.rental.lockInMonths} months</dd>
                </div>
              )}
            </dl>
            {p.hiddenAttributeKeys.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {p.hiddenAttributeKeys.length} detail
                {p.hiddenAttributeKeys.length === 1 ? ' is' : 's are'} kept from an earlier
                subcategory and not shown.
              </p>
            )}
          </Card>
        )}

        {amenities.length > 0 && (
          <Card className="grid gap-4 p-5">
            <h2 className="font-semibold">Amenities</h2>
            <ul className="flex flex-wrap gap-2">
              {amenities.map((a) => (
                <li
                  key={a.id}
                  className="inline-flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm"
                >
                  <AmenityIcon icon={a.icon} className="size-6 rounded-full" />
                  {a.name}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <aside className="grid min-w-0 flex-[1_1_260px] gap-5">
        <Card className="grid gap-3 p-5 text-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Status</h2>
            <StatusBadge status={p.status} />
          </div>
          <p className="text-muted-foreground">Since {formatDate(p.statusChangedAt)}</p>
          {p.publishedAt && (
            <p className="text-muted-foreground">First published {formatDate(p.publishedAt)}</p>
          )}
          {canWrite &&
            p.status !== 'published' &&
            p.publishIssues.length > 0 &&
            p.status !== 'archived' && (
              <div className="grid gap-1 border-t pt-3">
                <span className="font-medium">Before publishing</span>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {p.publishIssues.map((i) => (
                    <li key={i.path}>{i.message}</li>
                  ))}
                </ul>
              </div>
            )}
        </Card>

        <Card className="grid gap-3 p-5 text-sm">
          <h2 className="font-semibold">Location</h2>
          {address.length > 0 ? (
            <address className="not-italic">
              {address.map((line) => (
                <div key={line}>{line}</div>
              ))}
              {p.location.landmark && (
                <div className="text-muted-foreground">Near {p.location.landmark}</div>
              )}
            </address>
          ) : (
            <p className="text-muted-foreground">Not entered yet.</p>
          )}
          {pin && (
            <>
              <iframe
                title="Map"
                className="h-40 w-full rounded-lg border"
                loading="lazy"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${pin.lng - 0.01},${pin.lat - 0.006},${pin.lng + 0.01},${pin.lat + 0.006}&layer=mapnik&marker=${pin.lat},${pin.lng}`}
              />
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${pin.lat},${pin.lng}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium hover:underline"
              >
                Open in Google Maps <ExternalLinkIcon className="size-3.5" />
              </a>
            </>
          )}
        </Card>

        {files.length > 0 && (
          <Card className="grid gap-2 p-5 text-sm">
            <h2 className="font-semibold">Documents &amp; videos</h2>
            <ul className="grid gap-2">
              {files.map((m) => (
                <li key={m.id}>
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 hover:underline"
                  >
                    {m.kind === 'video' ? (
                      <VideoIcon className="size-4" />
                    ) : (
                      <FileTextIcon className="size-4" />
                    )}
                    {m.originalName || MEDIA_RULES[m.kind].label}
                    <span className="text-muted-foreground">({MEDIA_RULES[m.kind].label})</span>
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </aside>
    </div>
  );
}

function History({ property, categories }: { property: Property; categories: Category[] }) {
  const history = usePropertyHistory(property.id);
  const names = namesFrom(categories);
  if (history.isPending) return <Skeleton className="h-60 rounded-xl" />;
  if (history.error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{errorMessage(history.error)}</AlertDescription>
      </Alert>
    );
  }
  return (
    <Card className="p-5">
      <ol className="grid gap-4" aria-label="Change history">
        {history.data.map((h) => (
          <li key={h.id} className="border-l-2 pl-4">
            <div className="text-sm">
              <span className="font-medium">{ACTION_LABELS[h.action] ?? h.action}</span>
              <span className="text-muted-foreground">
                {' '}
                · {h.by?.name ?? 'System'} · {formatDateTime(h.at)}
              </span>
            </div>
            {h.changes && h.action !== 'created' && (
              <ul className="mt-1 grid gap-0.5 text-sm text-muted-foreground">
                {Object.entries(h.changes).map(([field, [before, after]]) => (
                  <li key={field}>
                    <span className="text-foreground">{historyFieldLabel(field, names)}:</span>{' '}
                    {historyValue(field, before, names)} → {historyValue(field, after, names)}
                  </li>
                ))}
              </ul>
            )}
            {h.action === 'created' && h.changes?.code && (
              <p className="mt-1 text-sm text-muted-foreground">Code {String(h.changes.code[1])}</p>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-5 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        Every change is recorded with who made it and when. Nothing is permanently deleted:
        archiving keeps the property and its history.
      </p>
    </Card>
  );
}
