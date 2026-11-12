import { useNavigate, useSearchParams } from 'react-router';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AmenitiesPanel } from '@/features/propertyTypes/AmenitiesPanel';
import { usePropertyTypes } from '@/features/propertyTypes/api';
import { AttributesPanel } from '@/features/propertyTypes/AttributesPanel';
import { SettingsNav } from '@/features/settings/SettingsNav';
import { errorMessage } from '@/lib/errors';

export type PropertyTypesTab = 'attributes' | 'amenities';
const TAB_PATH: Record<PropertyTypesTab, string> = {
  attributes: '/settings/property-types',
  amenities: '/settings/property-types/amenities',
};

/**
 * Settings → Property types & amenities. Two tabs (from the route): "Categories &
 * attributes" and "Amenities". The chosen category / subcategory is kept in the URL.
 */
export function PropertyTypesPage({ tab }: { tab: PropertyTypesTab }) {
  const { data, isLoading, error } = usePropertyTypes();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const tabs = (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        const category = params.get('category');
        const qs = category ? `?category=${encodeURIComponent(category)}` : '';
        navigate(`${TAB_PATH[value as PropertyTypesTab]}${qs}`);
      }}
      className="mb-5"
    >
      <TabsList variant="line">
        <TabsTrigger value="attributes">Categories &amp; attributes</TabsTrigger>
        <TabsTrigger value="amenities">Amenities</TabsTrigger>
      </TabsList>
    </Tabs>
  );

  if (isLoading) {
    return (
      <>
        <SettingsNav />
        {tabs}
        <div className="grid gap-5">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </>
    );
  }
  if (error || !data) {
    return (
      <>
        <SettingsNav />
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(error)}</AlertDescription>
        </Alert>
      </>
    );
  }

  const active = data.categories.filter((c) => c.isActive);
  const category = active.find((c) => c.key === params.get('category')) ?? active[0];
  if (!category) {
    return (
      <>
        <SettingsNav />
        <p className="text-sm text-muted-foreground">No property categories are set up yet.</p>
      </>
    );
  }

  const select = (next: { category?: string; sub?: string }) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next.category) {
          p.set('category', next.category);
          p.delete('sub');
        }
        if (next.sub) p.set('sub', next.sub);
        return p;
      },
      { replace: true },
    );

  return (
    <>
      <SettingsNav />
      {tabs}
      {tab === 'attributes' ? (
        <AttributesPanel
          categories={data.categories}
          coreAttributes={data.coreAttributes}
          category={category}
          subId={params.get('sub')}
          onSelectCategory={(key) => select({ category: key })}
          onSelectSub={(id) => select({ sub: id })}
        />
      ) : (
        <AmenitiesPanel
          categories={data.categories}
          category={category}
          onSelectCategory={(key) => select({ category: key })}
        />
      )}
    </>
  );
}
