import {
  formatArea,
  formatINR,
  MAIN_AREA_LABELS,
  PROPERTY_STATUS_LABELS,
  PURPOSE_LABELS,
} from '@real-estate/shared';
import type { Category, PlacedAttribute, Property, Subcategory } from '@real-estate/shared';
import { PencilIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useAuth } from '@/auth/auth-context';
import { Chip, DescriptionGrid, NotRecorded } from '@/components/patterns';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatDate } from '@/lib/format';
import { formatAttributeValue, formatPriceFull } from '../display';

function CardHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2.5">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </div>
  );
}

const valueOf = (a: PlacedAttribute, p: Property): ReactNode =>
  formatAttributeValue(a, p.attributeValues[a.key]) || <NotRecorded />;

/**
 * Specifications tab (wireframe `propSpecs`): A. main property information, B. the type's
 * own specifications, and features & amenities. Empty values read "Not recorded".
 */
export function SpecificationsTab({
  property: p,
  category,
  subcategory,
}: {
  property: Property;
  category: Category | undefined;
  subcategory: Subcategory | undefined;
}) {
  const { can } = useAuth();
  const common = category?.commonAttributes ?? [];
  const facing = common.find((a) => a.key === 'facing');
  const otherCommon = common.filter((a) => a !== facing && a.type !== 'long_text');
  const longTexts = common.filter((a) => a.type === 'long_text');
  const own = subcategory?.attributes ?? [];
  const amenities = (category?.amenities ?? []).filter((a) => p.amenityIds.includes(a.id));
  const areaLabel = subcategory ? MAIN_AREA_LABELS[subcategory.mainAreaMeaning] : 'Area';
  const price = [
    formatPriceFull(p.price),
    p.price.negotiable && !p.price.onRequest && p.price.amount !== null && '(negotiable)',
  ]
    .filter(Boolean)
    .join(' ');

  const main = [
    { label: 'Property ID', value: p.code },
    { label: 'Property title', value: p.title },
    { label: 'Property category', value: category?.name ?? '—' },
    { label: 'Property type', value: p.subcategoryName },
    { label: 'Listing purpose', value: PURPOSE_LABELS[p.purpose] },
    {
      label: 'Location',
      value: [p.location.city, p.location.state].filter(Boolean).join(', ') || <NotRecorded />,
    },
    { label: 'Locality', value: p.location.locality || <NotRecorded /> },
    { label: 'Pincode', value: p.location.pincode || <NotRecorded /> },
    { label: areaLabel, value: p.area ? formatArea(p.area.value, p.area.unit) : <NotRecorded /> },
    ...(facing ? [{ label: 'Facing', value: valueOf(facing, p) }] : []),
    { label: 'Property status', value: PROPERTY_STATUS_LABELS[p.status] },
    { label: 'Listing date', value: p.publishedAt ? formatDate(p.publishedAt) : <NotRecorded /> },
    { label: 'Asking price', value: price },
    ...(p.rental
      ? [
          {
            label: 'Security deposit',
            value:
              p.rental.securityDeposit != null ? (
                formatINR(p.rental.securityDeposit)
              ) : (
                <NotRecorded />
              ),
          },
          {
            label: 'Lock-in period',
            value:
              p.rental.lockInMonths != null ? `${p.rental.lockInMonths} months` : <NotRecorded />,
          },
        ]
      : []),
    ...otherCommon.map((a) => ({ label: a.label, value: valueOf(a, p) })),
    ...longTexts.map((a) => ({
      label: a.label,
      value: p.attributeValues[a.key] ? (
        <span className="font-normal whitespace-pre-line">{String(p.attributeValues[a.key])}</span>
      ) : (
        <NotRecorded />
      ),
      wide: true,
    })),
  ];

  const specs = [
    ...own
      .filter((a) => !p.removedAttributeKeys.includes(a.key))
      .map((a) => ({ label: a.label, value: valueOf(a, p) })),
    ...p.extraAttributes.map((e) => ({
      label: e.label,
      value: e.type === 'yes_no' ? (e.value ? 'Yes' : 'No') : String(e.value),
    })),
  ];

  return (
    <div className="grid gap-4">
      <Card className="gap-0 p-5">
        <CardHead title="A. Main property information">
          {can('properties:write') && p.status !== 'archived' && (
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              nativeButton={false}
              render={<Link to={`/properties/${p.id}/edit`} />}
            >
              <PencilIcon /> Edit
            </Button>
          )}
        </CardHead>
        <DescriptionGrid items={main} label="Main property information" />
      </Card>

      <Card className="gap-0 p-5">
        <CardHead title={`B. ${p.subcategoryName} specifications`}>
          <Chip tone="blue">type-specific fields</Chip>
        </CardHead>
        {specs.length > 0 ? (
          <DescriptionGrid items={specs} label={`${p.subcategoryName} specifications`} />
        ) : (
          <p className="text-sm text-muted-foreground">No specifications for this type yet.</p>
        )}
        {p.hiddenAttributeKeys.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {p.hiddenAttributeKeys.length} value
            {p.hiddenAttributeKeys.length === 1 ? ' is' : 's are'} kept from an earlier type and not
            shown.
          </p>
        )}
      </Card>

      <Card className="gap-0 p-5">
        <CardHead title="Features & amenities" />
        {amenities.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {amenities.map((a) => (
              <Chip key={a.id} outline>
                {a.name}
              </Chip>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">None recorded</p>
        )}
      </Card>
    </div>
  );
}
