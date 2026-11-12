import type { AttributeType } from '@real-estate/shared';
import { XIcon } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { FieldValue } from './formModel';

const NONE = '__none';

/** One attribute on the property form, with the control its value type needs. */
export function AttributeInput({
  id,
  label,
  type,
  unit,
  options = [],
  required = false,
  value,
  error,
  onChange,
  onRemove,
  removeLabel = 'Remove from this property',
  badge,
  wide = false,
}: {
  id: string;
  label: string;
  type: AttributeType;
  unit?: string | null;
  options?: string[];
  required?: boolean;
  value: FieldValue | undefined;
  error?: string;
  onChange: (value: FieldValue) => void;
  /** Shows a ✕ next to the label (optional attributes only). */
  onRemove?: () => void;
  removeLabel?: string;
  badge?: React.ReactNode;
  wide?: boolean;
}) {
  const text = typeof value === 'string' ? value : '';
  const list = Array.isArray(value) ? value : [];
  const describedBy = error ? `${id}-error` : undefined;
  const fullLabel = `${label}${unit ? ` (${unit})` : ''}${required ? ' *' : ''}`;
  const selectItems = (choices: { value: string; label: string }[]) => [
    { value: NONE, label: '—' },
    ...choices,
  ];

  let control: React.ReactNode;
  switch (type) {
    case 'long_text':
      control = (
        <Textarea
          id={id}
          rows={3}
          value={text}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    case 'number':
      control = (
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          step="any"
          value={text}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    case 'date':
      control = (
        <Input
          id={id}
          type="date"
          value={text}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    case 'yes_no':
    case 'dropdown': {
      const items = selectItems(
        type === 'yes_no'
          ? [
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ]
          : options.map((o) => ({ value: o, label: o })),
      );
      control = (
        <Select
          items={items}
          value={text || NONE}
          onValueChange={(v) => onChange(v === NONE || !v ? '' : String(v))}
        >
          <SelectTrigger
            id={id}
            className="w-full"
            aria-invalid={!!error}
            aria-describedby={describedBy}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
      break;
    }
    case 'multi_select':
      control = (
        <div
          id={id}
          role="group"
          aria-label={label}
          className="flex flex-wrap gap-x-4 gap-y-2 pt-1"
        >
          {options.map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={list.includes(o)}
                onCheckedChange={(checked) =>
                  onChange(checked ? [...list, o] : list.filter((x) => x !== o))
                }
              />
              {o}
            </label>
          ))}
        </div>
      );
      break;
    default:
      control = (
        <Input
          id={id}
          value={text}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }

  return (
    <div
      className={
        wide || type === 'long_text' || type === 'multi_select'
          ? 'grid gap-2 sm:col-span-2 lg:col-span-3'
          : 'grid gap-2'
      }
    >
      <div className="flex min-h-5 items-center justify-between gap-2">
        <Label htmlFor={id} className="flex flex-wrap items-center gap-1.5">
          {fullLabel}
          {badge}
        </Label>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`${removeLabel}: ${label}`}
            title={removeLabel}
          >
            <XIcon className="size-3.5" />
          </button>
        )}
      </div>
      {control}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
