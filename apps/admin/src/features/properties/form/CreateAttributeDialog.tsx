import {
  ATTRIBUTE_TYPE_LABELS,
  ATTRIBUTE_TYPES,
  EXTRA_ATTRIBUTE_TYPES,
  groupIndian,
  normalizeLabel,
  TYPES_WITH_OPTIONS,
} from '@real-estate/shared';
import type {
  AddAttributeBody,
  AttributePreview,
  AttributeType,
  ExtraAttributeType,
} from '@real-estate/shared';
import { Loader2Icon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Note } from '@/components/patterns';
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
import {
  useAddAttribute,
  useAttributeSearch,
  usePreviewAttribute,
} from '@/features/propertyTypes/api';
import { errorMessage } from '@/lib/errors';
import { useSettled } from '@/lib/useSettled';

type Scope = 'property' | 'subcategory';

/** The confirmation summary (PROP-18): one row per fact. */
function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 border-b border-line-soft py-1.5 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

/**
 * "+ Add attribute" on the property form (PROP-16–21):
 * - "Only this property" (default) is added straight to the form and never touches Settings;
 * - "All properties under ‹Category› › ‹Type›" (Settings permission) and "Use for ‹Type›"
 *   first show a confirmation summary with the impact. Nothing is saved until "Confirm and
 *   add to settings"; Cancel goes back with the inputs kept. The attribute is then tagged
 *   "New" in Settings until an admin reviews it.
 */
export function CreateAttributeDialog({
  categoryName,
  subcategory,
  propertyId,
  takenLabels,
  canEditSettings,
  onAddExtra,
  onClose,
}: {
  categoryName: string;
  subcategory: { id: string; name: string };
  /** The property being edited; null while creating one. */
  propertyId: string | null;
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
  const [pending, setPending] = useState<{
    body: AddAttributeBody;
    preview: AttributePreview;
  } | null>(null);
  const add = useAddAttribute();
  const previewer = usePreviewAttribute();
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
  const busy = add.isPending || previewer.isPending;

  /** Step 2: ask the API what will happen (checks duplicates too), then show the summary. */
  const review = async (body: AddAttributeBody) => {
    setProblem(null);
    try {
      setPending({ body, preview: await previewer.mutateAsync({ target, body }) });
    } catch (err) {
      setProblem(errorMessage(err));
    }
  };

  const submit = async () => {
    setProblem(null);
    if (name.length < 2) return setProblem('Attribute name must be at least 2 characters.');
    if (taken) return setProblem(`"${name}" is already on this form.`);
    if (scope === 'property') {
      // PROP-21: this property only, no confirmation, Settings unchanged.
      onAddExtra(name, type as ExtraAttributeType);
      toast.success(`"${name}" added to this property. Fill it in and save.`);
      return onClose();
    }
    if (TYPES_WITH_OPTIONS.includes(type) && options.length === 0)
      return setProblem('Add at least one option.');
    await review({
      source: 'new',
      label: name,
      type,
      options,
      unit: '',
      searchFilter: false,
      required,
      origin: 'property',
      propertyId,
    });
  };

  const confirm = async () => {
    if (!pending) return;
    try {
      await add.mutateAsync({ target, body: { ...pending.body, confirmed: true } });
      toast.success(`"${pending.preview.label}" added to all ${subcategory.name} properties`);
      onClose();
    } catch (err) {
      setPending(null);
      setProblem(errorMessage(err));
    }
  };

  if (pending) {
    const p = pending.preview;
    return (
      <AlertDialog open onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Add “{p.label}” to settings?</AlertDialogTitle>
            <AlertDialogDescription>
              Check the details. Nothing is saved until you confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <dl className="grid text-sm" aria-label="Attribute summary">
            <SummaryRow label="Name">{p.label}</SummaryRow>
            <SummaryRow label="Value type">
              {ATTRIBUTE_TYPE_LABELS[p.type]}
              {p.unit && ` (${p.unit})`}
            </SummaryRow>
            {p.options.length > 0 && (
              <SummaryRow label="Options">{p.options.join(', ')}</SummaryRow>
            )}
            <SummaryRow label="Required">
              {p.required ? 'Yes, needed to make a property Available' : 'No'}
            </SummaryRow>
            <SummaryRow label="Added to">{p.targetName}</SummaryRow>
            {p.usedIn.length > 0 && (
              <SummaryRow label="Already used in">{p.usedIn.join(', ')}</SummaryRow>
            )}
          </dl>
          <Note tone="amber">
            It will appear on every <b>{subcategory.name}</b> property:{' '}
            <b>
              {groupIndian(p.existingProperties)} existing{' '}
              {p.existingProperties === 1 ? 'property' : 'properties'}
            </b>{' '}
            and all new ones. It shows as <b>New</b> in Settings until an admin reviews it.
          </Note>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={add.isPending} onClick={confirm}>
              {add.isPending && <Loader2Icon className="animate-spin" />}
              Confirm and add to settings
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Add attribute</AlertDialogTitle>
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
                onChange={() => setScope('subcategory')}
              />
              <span>
                All properties under {categoryName} › <b>{subcategory.name}</b>
                {!canEditSettings && ' (needs the Settings permission)'}
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
                    placeholder="One per line"
                    value={optionsText}
                    onChange={(e) => setOptionsText(e.target.value)}
                  />
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={required} onCheckedChange={(c) => setRequired(Boolean(c))} />
                Required (must be filled before it can be made Available)
              </label>
            </>
          )}

          {matches.length > 0 && (
            <div
              className="grid gap-2 rounded-lg border border-dashed bg-muted/40 p-3 text-sm"
              aria-live="polite"
            >
              <p className="font-medium">Similar attributes already exist:</p>
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
                      disabled={busy}
                      onClick={() =>
                        review({
                          source: 'existing',
                          attributeId: m.id,
                          required,
                          origin: 'property',
                          propertyId,
                        })
                      }
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
          <Button type="button" disabled={busy} onClick={submit}>
            {busy && <Loader2Icon className="animate-spin" />}
            {scope === 'property' ? 'Add to this property' : 'Review and add…'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
