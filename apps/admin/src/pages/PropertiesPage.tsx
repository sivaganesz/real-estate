import {
  ARCHIVE_VIEW_LABELS,
  ARCHIVE_VIEWS,
  formatArea,
  formatINR,
  formatPrice,
  groupIndian,
  LEGAL_FILTER_LABELS,
  LEGAL_FILTERS,
  PROPERTY_STATUS_LABELS,
  PROPERTY_STATUSES,
  PURPOSE_LABELS,
  PURPOSES,
} from '@real-estate/shared';
import type { PropertyListItem } from '@real-estate/shared';
import {
  ArchiveIcon,
  CopyIcon,
  EllipsisIcon,
  EyeIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  StarIcon,
  UploadIcon,
  XIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '@/auth/auth-context';
import { EmptyState, PageHeader } from '@/components/patterns';
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
import {
  useDuplicateProperty,
  useLocationSuggestions,
  useProperties,
  useStatusCounts,
} from '@/features/properties/api';
import type { StatusTarget } from '@/features/properties/ChangeStatusDialog';
import { ChangeStatusDialog } from '@/features/properties/ChangeStatusDialog';
import { LegalChip } from '@/features/properties/LegalChip';
import { StatusBadge } from '@/features/properties/StatusBadge';
import { PRICE_RANGES, SORTS, usePropertyFilters } from '@/features/properties/useListFilters';
import { usePropertyTypes } from '@/features/propertyTypes/api';
import { errorMessage } from '@/lib/errors';
import { formatAgo, formatDate } from '@/lib/format';
import { useSettled } from '@/lib/useSettled';

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

/** One filter dropdown; "all" (the first item) means no filter. */
function FilterSelect({
  label,
  value,
  items,
  onChange,
  className = 'w-44',
}: {
  label: string;
  value: string;
  items: { value: string; label: string }[];
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <Select items={items} value={value} onValueChange={(v) => onChange(v as string)}>
      <SelectTrigger aria-label={label} className={className}>
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

/** "₹28 L" with "₹2,333/sq.ft." under it (PROP-54). */
function PriceCell({ property }: { property: PropertyListItem }) {
  const { price, pricePerSqft } = property;
  const short =
    price.basis === 'total' && !price.onRequest && price.amount !== null
      ? formatINR(price.amount)
      : formatPrice(price);
  return (
    <>
      <span className="font-semibold">{short}</span>
      {pricePerSqft !== null && (
        <span className="block text-xs text-muted-foreground">
          ₹{groupIndian(pricePerSqft)}/sq.ft.
        </span>
      )}
    </>
  );
}

/**
 * Properties list in the wireframe layout (PROP-53–58): search and filters kept in the
 * URL, legal checks and status chips, and for writers bulk status changes. Sales
 * Executives see the list and details only.
 */
export function PropertiesPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const canWrite = can('properties:write');
  const filters = usePropertyFilters();
  const list = useProperties(filters.query);
  const counts = useStatusCounts();
  const types = usePropertyTypes();
  const cities = useLocationSuggestions('city', '', undefined, 200);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusTargets, setStatusTargets] = useState<StatusTarget[] | null>(null);
  const [search, setSearch] = useDebouncedFilter(filters.q, (q) => filters.update({ q }));

  const subcategories = (types.data?.categories ?? [])
    .filter((c) => c.isActive)
    .flatMap((c) => c.subcategories);
  const n = (value: number | undefined) => (value === undefined ? '' : ` (${value})`);
  const typeItems = [
    { value: 'all', label: 'All types' },
    ...subcategories.map((s) => ({ value: s.id, label: s.name })),
  ];
  const cityNames = (cities.data ?? []).map((c) => c.value).sort((a, b) => a.localeCompare(b));
  if (filters.city !== 'all' && !cityNames.includes(filters.city)) cityNames.push(filters.city);
  const cityItems = [
    { value: 'all', label: 'All cities' },
    ...cityNames.map((c) => ({ value: c, label: c })),
  ];
  const statusItems = [
    { value: 'all', label: 'Any status' },
    ...PROPERTY_STATUSES.filter((s) => s !== 'archived').map((s) => ({
      value: s,
      label: `${PROPERTY_STATUS_LABELS[s]}${n(counts.data?.[s])}`,
    })),
  ];
  const legalItems = [
    { value: 'all', label: 'Any legal status' },
    ...LEGAL_FILTERS.map((v) => ({ value: v, label: LEGAL_FILTER_LABELS[v] })),
  ];
  const viewItems = [
    { value: 'all', label: 'Active properties' },
    ...ARCHIVE_VIEWS.map((v) => ({ value: v, label: ARCHIVE_VIEW_LABELS[v] })),
  ];
  const purposeItems = [
    { value: 'all', label: 'Sale, rent or lease' },
    ...PURPOSES.map((p) => ({ value: p, label: PURPOSE_LABELS[p] })),
  ];

  const rows = list.data?.items ?? [];
  const meta = list.data?.meta;
  const pageIds = rows.map((r) => r.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const selectedRows = rows.filter((r) => selected.has(r.id));
  const columns = canWrite ? 10 : 9;

  // Selection is per page and filter.
  useEffect(() => setSelected(new Set()), [list.data]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const addButton = (size?: 'sm') =>
    canWrite && (
      <Button size={size} nativeButton={false} render={<Link to="/properties/new" />}>
        <PlusIcon /> Add property
      </Button>
    );

  return (
    <>
      <PageHeader
        title="Property specification database"
        description="Every property has a unique ID and a standard specification. Form fields change by property type."
        actions={
          <>
            {addButton()}
            {can('imports:run') && (
              <Button variant="outline" nativeButton={false} render={<Link to="/imports" />}>
                <UploadIcon /> Bulk import
              </Button>
            )}
          </>
        }
      />

      {/* Filters (wireframe `.filters`) */}
      <div className="mb-4 flex flex-wrap items-center gap-2" role="search">
        <div className="relative min-w-0 flex-[1_1_240px]">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search properties"
            placeholder="Search code, name, locality, city or pincode…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <FilterSelect
          label="Property type"
          value={filters.subcategoryId}
          items={typeItems}
          onChange={(v) => filters.update({ type: v })}
        />
        <FilterSelect
          label="City"
          value={filters.city}
          items={cityItems}
          onChange={(v) => filters.update({ city: v })}
          className="w-40"
        />
        <FilterSelect
          label="Status"
          value={filters.status}
          items={statusItems}
          onChange={(v) => filters.update({ status: v })}
        />
        <FilterSelect
          label="Legal checks"
          value={filters.legal}
          items={legalItems}
          onChange={(v) => filters.update({ legal: v })}
          className="w-52"
        />
        <FilterSelect
          label="Archive view"
          value={filters.view}
          items={viewItems}
          onChange={(v) => filters.update({ view: v })}
        />
        <FilterSelect
          label="Purpose"
          value={filters.purpose}
          items={purposeItems}
          onChange={(v) => filters.update({ purpose: v })}
        />
        <FilterSelect
          label="Price"
          value={filters.price}
          items={[...PRICE_RANGES]}
          onChange={(v) => filters.update({ price: v })}
          className="w-40"
        />
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
        <div className="ml-auto">
          <FilterSelect
            label="Sort by"
            value={filters.sort}
            items={[...SORTS]}
            onChange={(v) => filters.update({ sort: v === SORTS[0].value ? undefined : v })}
          />
        </div>
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

      {/* Table (wireframe `.tbl-wrap`) */}
      <div className="rounded-xl bg-card shadow-card ring-1 ring-foreground/10 dark:shadow-none">
        <Table aria-label="Properties" aria-busy={list.isFetching} className="min-w-[1120px]">
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
              <TableHead>Code</TableHead>
              <TableHead>Property</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Area</TableHead>
              <TableHead className="text-right">Asking price</TableHead>
              <TableHead>Legal checks</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Listed</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isPending &&
              Array.from({ length: 5 }, (_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={columns}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {list.isError && (
              <TableRow>
                <TableCell colSpan={columns} className="py-10 text-center">
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
                <TableCell colSpan={columns}>
                  {filters.hasFilters ? (
                    <EmptyState
                      title="No properties match these filters."
                      action={
                        <Button variant="outline" size="sm" onClick={filters.clear}>
                          Clear filters
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      title="No properties here yet"
                      description="Add one, or bring many in at once with Bulk import."
                      action={addButton('sm')}
                    />
                  )}
                </TableCell>
              </TableRow>
            )}
            {rows.map((p) => {
              const open = () => void navigate(`/properties/${p.id}`);
              return (
                <TableRow
                  key={p.id}
                  data-state={selected.has(p.id) ? 'selected' : undefined}
                  className="cursor-pointer"
                  onClick={(e) => {
                    // Row click opens the detail page (PROP-57), except on its controls.
                    if (!(e.target as HTMLElement).closest('a,button,[role=checkbox],[role=menu]'))
                      open();
                  }}
                >
                  {canWrite && (
                    <TableCell>
                      <Checkbox
                        aria-label={`Select ${p.code}`}
                        checked={selected.has(p.id)}
                        onCheckedChange={() => toggle(p.id)}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-mono text-xs">{p.code}</TableCell>
                  <TableCell className="min-w-72 whitespace-normal">
                    <Link
                      to={`/properties/${p.id}`}
                      className="flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      {p.coverUrl ? (
                        <img
                          src={p.coverUrl}
                          alt=""
                          className="h-10 w-14 flex-none rounded-md object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="flex h-10 w-14 flex-none items-center justify-center rounded-md bg-muted text-[10px] text-muted-foreground">
                          No photo
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 font-semibold hover:underline">
                          <span className="line-clamp-2">{p.title}</span>
                          {p.isFeatured && (
                            <StarIcon
                              className="size-3.5 flex-none fill-tone-amber text-tone-amber"
                              aria-label="Featured"
                            />
                          )}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {p.subcategoryName} · {PURPOSE_LABELS[p.purpose]}
                        </span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    {p.location.locality || '—'}
                    <span className="block text-xs text-muted-foreground">{p.location.city}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.area ? formatArea(p.area.value, p.area.unit) : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <PriceCell property={p} />
                  </TableCell>
                  <TableCell>
                    <LegalChip summary={p.legalSummary} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <span className="block text-foreground">
                      {p.publishedAt ? formatDate(p.publishedAt) : 'Not listed'}
                    </span>
                    Updated {formatAgo(p.updatedAt)}
                  </TableCell>
                  <TableCell>
                    <RowMenu
                      property={p}
                      canWrite={canWrite}
                      onStatus={() => setStatusTargets([toTarget(p)])}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {meta && meta.totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              Page {meta.page} of {meta.totalPages}
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

      {/* Footer count (PROP-56) */}
      {meta && counts.data && (
        <p className="mt-2.5 text-[13px] text-muted-foreground" data-testid="list-footer">
          {meta.total} shown · {counts.data.all} active
          {counts.data.archived > 0 && ` · ${counts.data.archived} archived`}. Legal column counts
          checks <i>verified by an authorised legal professional</i>; uploaded documents alone don’t
          count.
        </p>
      )}

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
