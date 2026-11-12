import type { Amenity, Category } from '@real-estate/shared';
import { ArrowDownIcon, ArrowUpIcon, Loader2Icon, PlusIcon, SearchIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { errorMessage } from '@/lib/errors';
import { useDeleteAmenity, useReorderAmenities } from './api';
import { AmenityIcon } from './AmenityIcon';
import { AmenitySheet } from './AmenitySheet';
import { CategoryPicker } from './CategoryPicker';
import { count } from './format';

const ALL = 'all';

/** "Amenities" tab: the category's amenity checklist, in the order shown on the property form. */
export function AmenitiesPanel({
  categories,
  category,
  onSelectCategory,
}: {
  categories: Category[];
  category: Category;
  onSelectCategory: (key: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [subFilter, setSubFilter] = useState<string>(ALL);
  const [sheet, setSheet] = useState<{ edit?: Amenity } | null>(null);
  const [deleting, setDeleting] = useState<Amenity | null>(null);
  const reorder = useReorderAmenities();
  const remove = useDeleteAmenity();

  const subName = new Map(category.subcategories.map((s) => [s.id, s.name]));
  const all = category.amenities;
  const filtering = search.trim() !== '' || subFilter !== ALL;
  const shown = all.filter(
    (a) =>
      a.name.toLowerCase().includes(search.trim().toLowerCase()) &&
      (subFilter === ALL || a.appliesToAll || a.subcategoryIds.includes(subFilter)),
  );
  const subItems = [
    { value: ALL, label: 'All subcategories' },
    ...category.subcategories.map((s) => ({ value: s.id, label: s.name })),
  ];

  const move = (index: number, by: -1 | 1) => {
    const ids = all.map((a) => a.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + by, 0, moved!);
    reorder.mutate(
      { categoryKey: category.key, ids },
      { onError: (err) => toast.error(errorMessage(err)) },
    );
  };

  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(`${deleting.name} deleted`);
        setDeleting(null);
      },
      onError: (err) => {
        toast.error(errorMessage(err));
        setDeleting(null);
      },
    });
  };

  return (
    <>
      <div className="grid gap-5">
        <Card className="p-5">
          <CategoryPicker
            categories={categories}
            selected={category.key}
            onSelect={onSelectCategory}
          />
        </Card>

        <Card className="grid gap-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">{category.name} amenities</h2>
              <p className="text-sm text-muted-foreground">
                A checklist on the property form, in this order. Each one is offered for all
                subcategories or only some.
              </p>
            </div>
            <Button onClick={() => setSheet({})}>
              <PlusIcon /> Add amenity
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-[1_1_240px]">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search amenities"
                placeholder="Search amenities…"
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select items={subItems} value={subFilter} onValueChange={(v) => v && setSubFilter(v)}>
              <SelectTrigger aria-label="Filter by subcategory" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {subItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {shown.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              {all.length === 0
                ? 'No amenities yet. Add the facilities buyers look for, such as a gated community or power backup.'
                : 'No amenities match.'}
            </p>
          ) : (
            <Table aria-label={`${category.name} amenities`} className="min-w-[680px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Order</TableHead>
                  <TableHead>Amenity</TableHead>
                  <TableHead>Offered for</TableHead>
                  <TableHead className="w-32">Used by</TableHead>
                  <TableHead className="w-40">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((a) => {
                  const index = all.indexOf(a);
                  return (
                    <TableRow
                      key={a.id}
                      className={a.isActive ? undefined : 'text-muted-foreground'}
                    >
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Move ${a.name} up`}
                            disabled={filtering || index === 0 || reorder.isPending}
                            onClick={() => move(index, -1)}
                          >
                            <ArrowUpIcon />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Move ${a.name} down`}
                            disabled={filtering || index === all.length - 1 || reorder.isPending}
                            onClick={() => move(index, 1)}
                          >
                            <ArrowDownIcon />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <AmenityIcon icon={a.icon} />
                          <span className="font-medium">{a.name}</span>
                          {!a.isActive && <Badge variant="outline">Inactive</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <div className="flex flex-wrap gap-1">
                          {a.appliesToAll ? (
                            <Badge variant="secondary">All {category.name}</Badge>
                          ) : (
                            a.subcategoryIds.map((id) => (
                              <Badge key={id} variant="outline">
                                {subName.get(id) ?? 'Removed'}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {count(a.propertyCount, 'property', 'properties')}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Edit ${a.name}`}
                            onClick={() => setSheet({ edit: a })}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            aria-label={`Delete ${a.name}`}
                            disabled={a.propertyCount > 0}
                            title={
                              a.propertyCount > 0
                                ? 'Ticked on properties: deactivate it instead'
                                : undefined
                            }
                            onClick={() => setDeleting(a)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {filtering && shown.length > 0 && (
            <p className="text-xs text-muted-foreground">Clear the search and filter to reorder.</p>
          )}
        </Card>

        <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
          The property form shows only the active amenities offered for the property&apos;s
          subcategory. An amenity ticked on properties can&apos;t be deleted: deactivate it instead,
          and those properties keep it.
        </p>
      </div>

      {sheet && (
        <AmenitySheet
          key={sheet.edit?.id ?? 'new'}
          category={category}
          amenity={sheet.edit}
          onClose={() => setSheet(null)}
        />
      )}

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              It is removed from the {category.name} amenity checklist. To hide it for now and keep
              it for later, deactivate it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={confirmDelete}
            >
              {remove.isPending && <Loader2Icon className="animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
