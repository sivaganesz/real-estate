import type { Category } from '@real-estate/shared';
import { count } from './format';
import { PickCard } from './PickCard';

/** Category cards. Inactive categories are "set up later" and can't be picked. */
export function CategoryPicker({
  categories,
  selected,
  onSelect,
}: {
  categories: Category[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  return (
    <section className="grid gap-2" aria-labelledby="pt-category">
      <h2 id="pt-category" className="text-sm font-medium">
        Category
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((c) => (
          <PickCard
            key={c.key}
            title={c.name}
            subtitle={
              c.isActive
                ? count(c.subcategories.length, 'subcategory', 'subcategories')
                : 'Set up later'
            }
            selected={c.key === selected}
            disabled={!c.isActive}
            onClick={() => onSelect(c.key)}
          />
        ))}
      </div>
    </section>
  );
}
