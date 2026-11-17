import { Link, useParams } from 'react-router';
import { Chip, Note } from '@/components/patterns';
import type { Tone } from '@/components/patterns';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useProperty } from '@/features/properties/api';
import { LocationTab } from '@/features/properties/detail/LocationTab';
import { formatAttributeValue } from '@/features/properties/display';
import { HistoryTab, MediaTab } from '@/features/properties/detail/MediaAndHistory';
import { PropertyHeader } from '@/features/properties/detail/PropertyHeader';
import { SpecificationsTab } from '@/features/properties/detail/SpecificationsTab';
import { usePropertyTypes } from '@/features/propertyTypes/api';
import { errorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export type PropertyTab = 'specs' | 'location' | 'media' | 'history';

/** Tabs in the wireframe's order; Legal and Pricing arrive in R1.5 and R1.6. */
const TABS: {
  key: PropertyTab | 'legal' | 'pricing';
  label: string;
  path: string;
  soon?: string;
}[] = [
  { key: 'specs', label: 'Specifications', path: '' },
  { key: 'location', label: 'Location', path: '/location' },
  { key: 'legal', label: 'Legal & documents', path: '/legal', soon: 'R1.5' },
  { key: 'pricing', label: 'Pricing & valuation', path: '/pricing', soon: 'R1.6' },
  { key: 'media', label: 'Media', path: '/media' },
  { key: 'history', label: 'History', path: '/history' },
];

/**
 * Property page (PROP-64–66, wireframe `viewProperty`): header, banners, then the tabs
 * Specifications, Location, Legal & documents, Pricing & valuation, Media and History.
 */
export function PropertyDetailPage({ tab }: { tab: PropertyTab }) {
  const { id = '' } = useParams();
  const property = useProperty(id);
  const types = usePropertyTypes();

  if (property.isPending || types.isPending) {
    return (
      <div className="grid gap-5">
        <Skeleton className="h-16 w-full max-w-2xl" />
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
  const category = types.data.categories.find((c) => c.key === p.categoryKey);
  const subcategory = category?.subcategories.find((s) => s.id === p.subcategoryId);
  const facingAttr = category?.commonAttributes.find((a) => a.key === 'facing');
  const facing = facingAttr ? formatAttributeValue(facingAttr, p.attributeValues.facing) : null;
  const legal = p.legalSummary;
  const legalTone: Tone = legal.openMandatory.length > 0 ? 'amber' : 'green';

  return (
    <>
      <PropertyHeader
        property={p}
        categoryName={category?.name ?? ''}
        subcategory={subcategory}
        facing={facing}
      />

      {p.status === 'archived' && (
        <Note className="mb-3">
          <b>Archived</b>
          {p.archive && (
            <>
              {' '}
              on {formatDate(p.archive.at)}
              {p.archive.by && ` by ${p.archive.by.name}`}
              {p.archive.reason && `: ${p.archive.reason}`}
            </>
          )}
          . Hidden from the property list. Its history is kept.
        </Note>
      )}
      {legal.openMandatory.length > 0 && (
        <Note tone="amber" className="mb-3">
          Mandatory checks unresolved: <b>{legal.openMandatory.join(', ')}</b>. Matching will show
          this property only as a <i>Conditional match</i> until they are verified.
        </Note>
      )}

      <nav aria-label="Property sections" className="mb-4 flex gap-0.5 overflow-x-auto border-b">
        {TABS.map((t) =>
          t.soon ? (
            <span
              key={t.key}
              aria-disabled="true"
              title={`Coming in ${t.soon}`}
              className="flex items-center gap-1.5 border-b-2 border-transparent px-3.5 py-2.5 font-medium whitespace-nowrap text-muted-foreground/60"
            >
              {t.label}
              {t.key === 'legal' && legal.total > 0 && (
                <Chip tone={legalTone}>
                  {legal.verified}/{legal.total}
                </Chip>
              )}
            </span>
          ) : (
            <Link
              key={t.key}
              to={`/properties/${p.id}${t.path}`}
              aria-current={tab === t.key ? 'page' : undefined}
              className={cn(
                'border-b-2 px-3.5 py-2.5 font-medium whitespace-nowrap',
                tab === t.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </Link>
          ),
        )}
      </nav>

      {tab === 'specs' && (
        <SpecificationsTab property={p} category={category} subcategory={subcategory} />
      )}
      {tab === 'location' && <LocationTab property={p} />}
      {tab === 'media' && <MediaTab property={p} />}
      {tab === 'history' && <HistoryTab property={p} categories={types.data.categories} />}
    </>
  );
}
