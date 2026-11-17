import { LEGAL_CHECK_KEYS, LEGAL_CHECKS } from '@real-estate/shared';
import type { LegalChecklistItemInput } from '@real-estate/shared';
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { Chip } from '@/components/patterns';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Item = LegalChecklistItemInput;
const CUSTOM = '__custom';

/** "Mutation deed" → "mutation_deed". */
const keyFrom = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'check';

/**
 * The legal checklist of a property type (PRD v2 SET-03): which checks every new property of
 * this type gets, in order, and which are mandatory. Pick from the standard checks or add
 * your own.
 */
export function LegalChecklistEditor({
  value,
  onChange,
}: {
  value: Item[];
  onChange: (next: Item[]) => void;
}) {
  const [adding, setAdding] = useState<string | null>(null);
  const [customLabel, setCustomLabel] = useState('');
  const used = new Set(value.map((c) => c.key));
  const available = LEGAL_CHECK_KEYS.filter((k) => !used.has(k));

  const move = (i: number, by: -1 | 1) => {
    const next = [...value];
    const [item] = next.splice(i, 1);
    next.splice(i + by, 0, item!);
    onChange(next);
  };
  const add = (key: string) => {
    if (key === CUSTOM) {
      setAdding(CUSTOM);
      return;
    }
    const check = LEGAL_CHECKS[key as keyof typeof LEGAL_CHECKS];
    onChange([...value, { key, label: check.label, verifies: check.verifies, mandatory: false }]);
    setAdding(null);
  };
  const addCustom = () => {
    const label = customLabel.trim();
    if (label.length < 2) return;
    let key = keyFrom(label);
    while (used.has(key)) key = `${key}_2`;
    onChange([...value, { key, label, verifies: '', mandatory: false }]);
    setCustomLabel('');
    setAdding(null);
  };

  return (
    <div className="grid min-w-0 grid-cols-1 gap-2">
      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          No checks yet. New properties of this type will have an empty legal checklist.
        </p>
      ) : (
        <ol className="grid min-w-0 grid-cols-1 gap-1.5" aria-label="Legal checks">
          {value.map((c, i) => (
            <li
              key={c.key}
              className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{c.label}</div>
                {c.verifies && (
                  <div className="truncate text-xs text-muted-foreground">{c.verifies}</div>
                )}
              </div>
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox
                  checked={c.mandatory ?? false}
                  onCheckedChange={(on) =>
                    onChange(value.map((x, j) => (j === i ? { ...x, mandatory: Boolean(on) } : x)))
                  }
                  aria-label={`${c.label} is mandatory`}
                />
                Mandatory
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={i === 0}
                aria-label={`Move ${c.label} up`}
                onClick={() => move(i, -1)}
              >
                <ArrowUpIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={i === value.length - 1}
                aria-label={`Move ${c.label} down`}
                onClick={() => move(i, 1)}
              >
                <ArrowDownIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={`Remove ${c.label}`}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ol>
      )}

      {adding === CUSTOM ? (
        <div className="flex gap-2">
          <Input
            autoFocus
            value={customLabel}
            placeholder="e.g. Mutation certificate"
            aria-label="Name of the new check"
            onChange={(e) => setCustomLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustom();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addCustom}>
            Add
          </Button>
          <Button type="button" variant="ghost" onClick={() => setAdding(null)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Select
          items={[
            ...available.map((k) => ({ value: k, label: LEGAL_CHECKS[k].label })),
            { value: CUSTOM, label: 'Custom check…' },
          ]}
          value={null}
          onValueChange={(v) => v && add(v)}
        >
          <SelectTrigger className="w-full" aria-label="Add a check">
            <PlusIcon className="size-4 text-muted-foreground" />
            <SelectValue placeholder="Add a check" />
          </SelectTrigger>
          <SelectContent>
            {available.map((k) => (
              <SelectItem key={k} value={k}>
                {LEGAL_CHECKS[k].label}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM}>Custom check…</SelectItem>
          </SelectContent>
        </Select>
      )}
      <p className="text-xs text-muted-foreground">
        <Chip tone="amber" className="mr-1">
          Mandatory
        </Chip>
        checks that are not verified keep a property out of top recommendations. Changes apply to
        new properties; existing properties keep their checks.
      </p>
    </div>
  );
}
