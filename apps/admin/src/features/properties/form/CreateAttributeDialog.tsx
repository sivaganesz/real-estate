import {
  ATTRIBUTE_TYPE_LABELS,
  ATTRIBUTE_TYPES,
  EXTRA_ATTRIBUTE_TYPES,
  normalizeLabel,
  TYPES_WITH_OPTIONS,
} from '@real-estate/shared';
import type { AttributeType, ExtraAttributeType } from '@real-estate/shared';
import { Loader2Icon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
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
import { useAddAttribute, useAttributeSearch } from '@/features/propertyTypes/api';
import { errorMessage } from '@/lib/errors';
import { useSettled } from '@/lib/useSettled';

type Scope = 'property' | 'subcategory';

/**
 * "+ Add attribute" on the property form: for this property only, or for every property
 * of the subcategory (added in Settings too, so it can be reused).
 */
export function CreateAttributeDialog({
  categoryName,
  subcategory,
  takenLabels,
  canEditSettings,
  onAddExtra,
  onClose,
}: {
  categoryName: string;
  subcategory: { id: string; name: string };
  /** Names already on the form, to avoid duplicates. */
  takenLabels: string[];
  canEditSettings: boolean;
  onAddExtra: (label: string, type: ExtraAttributeType) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState('');
  const [scope, setScope] = useState<Scope>('property');
  const [type, setType] = useState<AttributeType>('text');
  const [optionsText, setOptionsText] = useState('');
  const [required, setRequired] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const add = useAddAttribute();
  const search = useAttributeSearch(useSettled(label, 300));

  const types = scope === 'property' ? EXTRA_ATTRIBUTE_TYPES : ATTRIBUTE_TYPES;
  const typeItems = types.map((t) => ({ value: t, label: ATTRIBUTE_TYPE_LABELS[t] }));
  const name = label.trim();
  const taken = takenLabels.some((l) => normalizeLabel(l) === normalizeLabel(name));
  const matches = (search.data ?? []).filter(
    (m) => !takenLabels.some((l) => normalizeLabel(l) === normalizeLabel(m.label)),
  );
  const options = optionsText
    .split(/[\n,]/)
    .map((o) => o.trim())
    .filter(Boolean);

  const target = { kind: 'subcategory' as const, id: subcategory.id };
  const done = (message: string) => {
    toast.success(message);
    onClose();
  };

  const submit = async () => {
    setProblem(null);
    if (name.length < 2) return setProblem('Attribute name must be at least 2 characters.');
    if (taken) return setProblem(`"${name}" is already on this form.`);
    if (scope === 'property') {
      onAddExtra(name, type as ExtraAttributeType);
      return done(`"${name}" added to this property. Fill it in and save.`);
    }
    if (TYPES_WITH_OPTIONS.includes(type) && options.length === 0)
      return setProblem('Add at least one option.');
    try {
      await add.mutateAsync({
        target,
        body: {
          source: 'new',
          label: name,
          type,
          options,
          unit: '',
          searchFilter: false,
          required,
        },
      });
      done(`"${name}" added to all ${subcategory.name} properties`);
    } catch (err) {
      setProblem(errorMessage(err));
    }
  };

  const reuse = async (id: string, existing: string) => {
    try {
      await add.mutateAsync({ target, body: { source: 'existing', attributeId: id, required } });
      done(`"${existing}" added to all ${subcategory.name} properties`);
    } catch (err) {
      setProblem(errorMessage(err));
    }
  };

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Create attribute</AlertDialogTitle>
          <AlertDialogDescription>
            Add a detail that isn&apos;t on the form yet.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-4">
          {problem && (
            <Alert variant="destructive">
              <AlertDescription>{problem}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="new-attr-name">Attribute name *</Label>
              <Input
                id="new-attr-name"
                autoComplete="off"
                placeholder="e.g. Servant room"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-attr-type">Value type *</Label>
              <Select
                items={typeItems}
                value={type}
                onValueChange={(v) => v && setType(v as AttributeType)}
              >
                <SelectTrigger id="new-attr-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {typeItems.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Add this attribute to</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="attr-scope"
                checked={scope === 'property'}
                onChange={() => setScope('property')}
              />
              Only this property
            </label>
            <label
              className={`flex items-center gap-2 text-sm ${canEditSettings ? '' : 'text-muted-foreground'}`}
            >
              <input
                type="radio"
                name="attr-scope"
                disabled={!canEditSettings}
                checked={scope === 'subcategory'}
                onChange={() => {
                  setScope('subcategory');
                }}
              />
              <span>
                All properties under {categoryName} › <b>{subcategory.name}</b>
              </span>
            </label>
          </fieldset>

          {scope === 'subcategory' && (
            <>
              {TYPES_WITH_OPTIONS.includes(type) && (
                <div className="grid gap-2">
                  <Label htmlFor="new-attr-options">Options *</Label>
                  <Textarea
                    id="new-attr-options"
                    rows={3}
                    placeholder={'One per line'}
                    value={optionsText}
                    onChange={(e) => setOptionsText(e.target.value)}
                  />
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={required} onCheckedChange={(c) => setRequired(Boolean(c))} />
                Required (must be filled before publishing)
              </label>
            </>
          )}

          {matches.length > 0 && (
            <div
              className="grid gap-2 rounded-lg border border-dashed bg-muted/40 p-3 text-sm"
              aria-live="polite"
            >
              <p className="font-medium">Already exists:</p>
              {matches.slice(0, 3).map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2">
                  <span>
                    <b>{m.label}</b>
                    <span className="text-muted-foreground">
                      {' '}
                      · {ATTRIBUTE_TYPE_LABELS[m.type]}
                      {m.usedIn.length > 0 && ` · in ${m.usedIn.join(', ')}`}
                    </span>
                  </span>
                  {canEditSettings && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={add.isPending}
                      onClick={() => reuse(m.id, m.label)}
                    >
                      Use for {subcategory.name}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button type="button" disabled={add.isPending} onClick={submit}>
            {add.isPending && <Loader2Icon className="animate-spin" />}
            Create attribute
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
