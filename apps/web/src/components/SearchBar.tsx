import clsx from 'clsx';
import { Search, Sparkles, X } from 'lucide-react';
import { Button } from './ui';

/**
 * The page search bar, the same on every tab: an icon, the box, a clear
 * button once there is text, and Search. `ai` shows the sparkle for a search
 * that understands plain words. Pages decide what Search and clear do.
 */
export function SearchBar({
  value,
  onChange,
  onSearch,
  onClear,
  placeholder,
  label,
  ai,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onSearch: (v: string) => void;
  onClear: () => void;
  placeholder: string;
  label: string;
  ai?: boolean;
  className?: string;
}) {
  const Icon = ai ? Sparkles : Search;
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(value.trim());
      }}
      className={clsx(
        'flex min-h-[54px] min-w-[260px] flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100',
        className,
      )}
    >
      <Icon className={clsx('h-4 w-4 shrink-0', ai ? 'text-ai-600' : 'text-slate-400')} />
      <input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-sm outline-none focus-visible:ring-0 focus-visible:ring-offset-0" />
      {value && (
        <button type="button" aria-label="Clear search" onClick={onClear} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      )}
      <Button type="submit" size="sm" variant="primary" className="rounded-full">
        Search
      </Button>
    </form>
  );
}
