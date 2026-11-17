import {
  canChangeStatus,
  formatArea,
  groupIndian,
  MAIN_AREA_LABELS,
  PROPERTY_STATUS_LABELS,
  PROPERTY_STATUSES,
  PURPOSE_LABELS,
} from '@real-estate/shared';
import type { Property, PropertyStatus, Subcategory } from '@real-estate/shared';
import {
  BriefcaseIcon,
  Building2Icon,
  FactoryIcon,
  HouseIcon,
  LandPlotIcon,
  MapPinIcon,
  PencilIcon,
  StoreIcon,
  WarehouseIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '@/auth/auth-context';
import { Chip } from '@/components/patterns';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { useChangeStatus } from '../api';
import { formatPriceFull } from '../display';
import { StatusBadge } from '../StatusBadge';

const TYPE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  PLT: LandPlotIcon,
  APT: Building2Icon,
  VIL: HouseIcon,
  OFC: BriefcaseIcon,
  SHP: StoreIcon,
  WHS: WarehouseIcon,
  CBD: Building2Icon,
  ISH: FactoryIcon,
};

/** "Change status" as a dropdown (wireframe): only the moves the rules allow. */
function StatusSelect({ property }: { property: Property }) {
  const change = useChangeStatus();
  const options = PROPERTY_STATUSES.filter(
    (s) => s === property.status || canChangeStatus(property.status, s, property.purpose),
  );
  const items = options.map((s) => ({ value: s, label: PROPERTY_STATUS_LABELS[s] }));
  return (
    <Select
      items={items}
      value={property.status}
      disabled={change.isPending}
      onValueChange={(v) => {
        const to = v as PropertyStatus;
        if (!v || to === property.status) return;
        change.mutate(
          { id: property.id, status: to },
          {
            onSuccess: () => toast.success(`${property.code} is now ${PROPERTY_STATUS_LABELS[to]}`),
            onError: (err) =>
              toast.error(errorMessage(err), {
                description:
                  err instanceof ApiError && err.details?.length
                    ? err.details.map((d) => d.message).join(' · ')
                    : undefined,
              }),
          },
        );
      }}
    >
      <SelectTrigger aria-label="Change status" className="w-auto min-w-36">
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

/**
 * Property page header (PROP-64, wireframe `.ent-head`): type icon and name; chips for code,
 * category, type, purpose and status; a location line; the price with ₹/sq.ft. and its
 * basis; and the status dropdown and Edit.
 */
export function PropertyHeader({
  property: p,
  categoryName,
  subcategory,
  facing,
}: {
  property: Property;
  categoryName: string;
  subcategory: Subcategory | undefined;
  facing: string | null;
}) {
  const { can } = useAuth();
  const Icon = TYPE_ICONS[subcategory?.codePrefix ?? ''] ?? HouseIcon;
  const archived = p.status === 'archived';
  const meta = [
    [p.location.locality, p.location.city, p.location.state].filter(Boolean).join(', '),
    p.area && formatArea(p.area.value, p.area.unit),
    facing && `${facing} facing`,
    p.publishedAt && `listed ${formatDate(p.publishedAt)}`,
  ].filter(Boolean);

  return (
    <div className="mb-3.5 flex flex-wrap items-start gap-4">
      <div className="grid size-[52px] flex-none place-items-center rounded-xl bg-primary-soft text-primary">
        <Icon className="size-6" />
      </div>
      <div className="min-w-[260px] flex-1">
        <h1 className="text-xl font-semibold tracking-tight">{p.title}</h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Chip outline className="font-mono">
            {p.code}
          </Chip>
          <Chip>{categoryName}</Chip>
          <Chip tone="blue">{p.subcategoryName}</Chip>
          <Chip>{PURPOSE_LABELS[p.purpose]}</Chip>
          <StatusBadge status={p.status} />
          {p.isFeatured && <Chip tone="amber">Featured</Chip>}
        </div>
        {meta.length > 0 && (
          <p className="mt-1.5 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPinIcon className="size-3.5 flex-none" /> {meta.join(' · ')}
          </p>
        )}
      </div>
      <div className="ml-auto text-right">
        <div className="text-[22px] leading-tight font-bold">{formatPriceFull(p.price)}</div>
        {p.pricePerSqft !== null && subcategory && (
          <div className="text-sm text-muted-foreground">
            ₹{groupIndian(p.pricePerSqft)} / sq.ft. (
            {MAIN_AREA_LABELS[subcategory.mainAreaMeaning].toLowerCase()})
          </div>
        )}
        {can('properties:write') && (
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <StatusSelect property={p} />
            {!archived && (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link to={`/properties/${p.id}/edit`} />}
              >
                <PencilIcon /> Edit
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
