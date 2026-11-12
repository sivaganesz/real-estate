import {
  formatArea,
  formatPrice,
  PROPERTY_STATUS_LABELS,
  PURPOSE_LABELS,
  PURPOSES,
} from '@real-estate/shared';
import type { PropertyListItem, PropertyStatus } from '@real-estate/shared';
import {
  ArchiveIcon,
  CopyIcon,
  EllipsisIcon,
  EyeIcon,
  HouseIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SearchXIcon,
  StarIcon,
  UploadIcon,
  XIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '@/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useDuplicateProperty,
  useLocationSuggestions,
  useProperties,
  useStatusCounts,
} from '@/features/properties/api';
import type { StatusTarget } from '@/features/properties/ChangeStatusDialog';
import { ChangeStatusDialog } from '@/features/properties/ChangeStatusDialog';
import { StatusBadge } from '@/features/properties/StatusBadge';
import { PRICE_RANGES, SORTS, usePropertyFilters } from '@/features/properties/useListFilters';
import { usePropertyTypes } from '@/features/propertyTypes/api';
import { errorMessage } from '@/lib/errors';
import { formatLastSeen } from '@/lib/format';
import { useSettled } from '@/lib/useSettled';

const TABS: (PropertyStatus | 'all')[] = [
  'all',
  'draft',
  'published',
  'unpublished',
  'booked',
  'sold',
  'rented',
  'leased',
  'archived',
];
const toTarget = (p: PropertyListItem): StatusTarget => ({
  id: p.id,
  code: p.code,
  status: p.status,
  purpose: p.purpose,
});

/** A text box that updates the URL filter once typing pauses. */
function useDebouncedFilter(value: string, apply: (v: string | undefined) => void) {
  const [text, setText] = useState(value);
  const settled = useSettled(text, 350);
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (settled !== value) apply(settled.trim() || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);
  return [text, setText] as const;
}

function RowMenu({
  property,
  canWrite,
  onStatus,
}: {
  property: PropertyListItem;
  canWrite: boolean;
  onStatus: () => void;
}) {
  const navigate = useNavigate();
  const duplicate = useDuplicateProperty();
  const archived = property.status === 'archived';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${property.code}`}>
            <EllipsisIcon />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => navigate(`/properties/${property.id}`)}>
          <EyeIcon /> View
        </DropdownMenuItem>
        {canWrite && (
          <>
            {!archived && (
              <DropdownMenuItem onClick={() => navigate(`/properties/${property.id}/edit`)}>
                <PencilIcon /> Edit
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() =>
                duplicate.mutate(property.id, {
                  onSuccess: (copy) => {
                    toast.success(`Copied as ${copy.code} (draft)`);
                    navigate(`/properties/${copy.id}/edit`);
                  },
                  onError: (err) => toast.error(errorMessage(err)),
                })
              }
            >
              <CopyIcon /> Duplicate as draft
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onStatus}>
              {archived ? <RefreshCwIcon /> : <ArchiveIcon />}
              {archived ? 'Restore…' : 'Change status…'}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Properties list: status tabs with counts, search and filters (kept in the URL), and for
 * Admins bulk status changes. Sales Agents see the list and details only.
 */
export function PropertiesPage() {
  const { can } = useAuth();
  const canWrite = can('properties:write');
  const filters = usePropertyFilters();
  const list = useProperties(filters.query);
  const counts = useStatusCounts();
  const types = usePropertyTypes();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusTargets, setStatusTargets] = useState<StatusTarget[] | null>(null);
  const [search, setSearch] = useDebouncedFilter(filters.q, (q) => filters.update({ q }));
  const [city, setCity] = useDebouncedFilter(filters.city, (c) => filters.update({ city: c }));
  const cities = useLocationSuggestions('city', city);

  const subcategories = (types.data?.categories ?? [])
    .filter((c) => c.isActive)
    .flatMap((c) => c.subcategories);
  const typeItems = [
    { value: 'all', label: 'All types' },
    ...subcategories.map((s) => ({ value: s.id, label: s.name })),
  ];
  const purposeItems = [
    { value: 'all', label: 'Sale, rent or lease' },
    ...PURPOSES.map((p) => ({ value: p, label: PURPOSE_LABELS[p] })),
  ];
  const rows = list.data?.items ?? [];
  const meta = list.data?.meta;
  const from = meta && meta.total > 0 ? (meta.page - 1) * meta.limit + 1 : 0;
  const to = meta ? Math.min(meta.page * meta.limit, meta.total) : 0;
  const pageIds = rows.map((r) => r.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const selectedRows = rows.filter((r) => selected.has(r.id));

  // Selection is per page and filter.
  useEffect(() => setSelected(new Set()), [list.data]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      {/* Status tabs + Add property */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <Tabs
          value={filters.status}
          onValueChange={(v) => filters.update({ status: v as string })}
          className="min-w-0 flex-[1_1_520px]"
        >
          <TabsList variant="line" className="max-w-full overflow-x-auto">
            {TABS.map((tab) => (
              <TabsTrigger key={tab} value={tab}>
                {tab === 'all' ? 'All' : PROPERTY_STATUS_LABELS[tab]}
                {counts.data && (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    {counts.data[tab]}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {can('imports:run') && (
          <Button
            variant="outline"
            className="ml-auto h-9"
            nativeButton={false}
            render={<Link to="/imports" />}
          >
            <UploadIcon /> Bulk import
          </Button>
        )}
        {canWrite && (
          <Button
            className={can('imports:run') ? 'h-9' : 'ml-auto h-9'}
            nativeButton={false}
            render={<Link to="/properties/new" />}
          >
            <PlusIcon /> Add property
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-[1_1_260px]">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search properties"
            placeholder="Search code, name, area or pincode…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          items={typeItems}
          value={filters.subcategoryId}
          onValueChange={(v) => filters.update({ type: v as string })}
        >
          <SelectTrigger aria-label="Property type" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {typeItems.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={purposeItems}
          value={filters.purpose}
          onValueChange={(v) => filters.update({ purpose: v as string })}
        >
          <SelectTrigger aria-label="Purpose" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {purposeItems.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          aria-label="City"
          placeholder="City"
          className="w-36"
          list="property-city-options"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        <datalist id="property-city-options">
          {cities.data?.map((c) => (
            <option key={c.value} value={c.value} />
          ))}
        </datalist>
        <Select
          items={[...PRICE_RANGES]}
          value={filters.price}
          onValueChange={(v) => filters.update({ price: v as string })}
        >
          <SelectTrigger aria-label="Price" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRICE_RANGES.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={[...SORTS]}
          value={filters.sort}
          onValueChange={(v) =>
            filters.update({ sort: v === SORTS[0].value ? undefined : (v as string) })
          }
        >
          <SelectTrigger aria-label="Sort by" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex h-8 items-center gap-2 px-1 text-sm">
          <Checkbox
            checked={filters.featured}
            onCheckedChange={(c) => filters.update({ featured: c ? '1' : undefined })}
          />
          Featured only
        </label>
        {filters.hasFilters && (
          <Button variant="ghost" size="sm" onClick={filters.clear}>
            <XIcon /> Clear filters
          </Button>
        )}
      </div>

      {/* Bulk actions */}
      {canWrite && selectedRows.length > 0 && (
        <div
          className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed bg-muted/40 px-3 py-2 text-sm"
          role="region"
          aria-label="Bulk actions"
        >
          <span className="font-medium">{selectedRows.length} selected</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setStatusTargets(selectedRows.map(toTarget))}
            >
              Change status…
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear selection
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl bg-card shadow-xs ring-1 ring-foreground/10 dark:shadow-none">
        <Table aria-label="Properties" aria-busy={list.isFetching} className="min-w-[980px]">
          <TableHeader>
            <TableRow>
              {canWrite && (
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Select all on this page"
                    checked={allOnPage}
                    onCheckedChange={(c) => setSelected(c ? new Set(pageIds) : new Set())}
                  />
                </TableHead>
              )}
              <TableHead>Property</TableHead>
              <TableHead>Type · Purpose</TableHead>
              <TableHead>City / Area</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isPending &&
              Array.from({ length: 5 }, (_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={canWrite ? 9 : 8}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {list.isError && (
              <TableRow>
                <TableCell colSpan={canWrite ? 9 : 8} className="py-10 text-center">
                  <p className="text-sm text-destructive">{errorMessage(list.error)}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => void list.refetch()}
                  >
                    Try again
                  </Button>
                </TableCell>
              </TableRow>
            )}
            {list.data && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={canWrite ? 9 : 8} className="py-12">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <span className="flex size-11 items-center justify-center rounded-full bg-muted">
                      {filters.hasFilters ? (
                        <SearchXIcon className="size-5 text-muted-foreground" />
                      ) : (
                        <HouseIcon className="size-5 text-muted-foreground" />
                      )}
                    </span>
                    <p className="font-medium">
                      {filters.hasFilters ? 'No properties match' : 'No properties here yet'}
                    </p>
                    {filters.hasFilters ? (
                      <Button variant="outline" size="sm" onClick={filters.clear}>
                        Clear filters
                      </Button>
                    ) : (
                      canWrite && (
                        <Button
                          size="sm"
                          nativeButton={false}
                          render={<Link to="/properties/new" />}
                        >
                          <PlusIcon /> Add property
                        </Button>
                      )
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
            {rows.map((p) => (
              <TableRow key={p.id} data-state={selected.has(p.id) ? 'selected' : undefined}>
                {canWrite && (
                  <TableCell>
                    <Checkbox
                      aria-label={`Select ${p.code}`}
                      checked={selected.has(p.id)}
                      onCheckedChange={() => toggle(p.id)}
                    />
                  </TableCell>
                )}
                <TableCell className="whitespace-normal">
                  <Link
                    to={`/properties/${p.id}`}
                    className="flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    {p.coverUrl ? (
                      <img
                        src={p.coverUrl}
                        alt=""
                        className="h-11 w-16 flex-none rounded-md object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="flex h-11 w-16 flex-none items-center justify-center rounded-md bg-muted text-[10px] text-muted-foreground">
                        No photo
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-medium hover:underline">
                        <span className="line-clamp-1">{p.title}</span>
                        {p.isFeatured && (
                          <StarIcon
                            className="size-3.5 flex-none fill-amber-400 text-amber-400"
                            aria-label="Featured"
                          />
                        )}
                      </span>
                      <span className="block text-xs text-muted-foreground">{p.code}</span>
                    </span>
                  </Link>
                </TableCell>
                <TableCell>
                  {p.subcategoryName}
                  <span className="block text-xs text-muted-foreground">
                    {PURPOSE_LABELS[p.purpose]}
                  </span>
                </TableCell>
                <TableCell>
                  {p.location.city || '—'}
                  <span className="block text-xs text-muted-foreground">
                    {[p.location.locality, p.location.pincode].filter(Boolean).join(' · ')}
                  </span>
                </TableCell>
                <TableCell className="font-medium">
                  {formatPrice(p.price)}
                  {p.price.negotiable && !p.price.onRequest && p.price.amount !== null && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      Negotiable
                    </span>
                  )}
                </TableCell>
                <TableCell>{p.area ? formatArea(p.area.value, p.area.unit) : '—'}</TableCell>
                <TableCell>
                  <StatusBadge status={p.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatLastSeen(p.updatedAt)}
                </TableCell>
                <TableCell>
                  <RowMenu
                    property={p}
                    canWrite={canWrite}
                    onStatus={() => setStatusTargets([toTarget(p)])}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {meta && meta.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              Showing {from}–{to} of {meta.total}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={meta.page <= 1}
                onClick={() => filters.update({ page: String(meta.page - 1) })}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={meta.page >= meta.totalPages}
                onClick={() => filters.update({ page: String(meta.page + 1) })}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {statusTargets && (
        <ChangeStatusDialog
          targets={statusTargets}
          onClose={(changed) => {
            setStatusTargets(null);
            if (changed) setSelected(new Set());
          }}
        />
      )}
    </>
  );
}
