import type { Permission, PermissionCatalog, RoleInfo, ScopeLevel } from '@real-estate/shared';
import { Loader2Icon, LockIcon, TriangleAlertIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FormField } from '@/components/forms/FormField';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { useCreateRole, usePermissionCatalog, useResetRole, useUpdateRole } from './api';

type Area = PermissionCatalog['scopedAreas'][number];

const levelOf = (set: Set<Permission>, area: Area): ScopeLevel =>
  area.all.every((p) => set.has(p)) ? 'all' : area.own.every((p) => set.has(p)) ? 'own' : 'none';

/**
 * New role / Edit role (PRD §4.2, ROLE-04/05). Permissions come from the fixed catalogue,
 * grouped by module; leads, appointments and reports use a None / Own / All choice.
 * Reserved permissions (users and roles) are shown locked: they belong to Admin only.
 */
export function RoleEditorSheet({
  role,
  roles,
  open,
  onOpenChange,
}: {
  /** The role to edit; omit to create a new one. */
  role?: RoleInfo;
  /** Every role, for "Start from". */
  roles: RoleInfo[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const catalog = usePermissionCatalog();
  const create = useCreateRole();
  const update = useUpdateRole();
  const reset = useResetRole();
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [selected, setSelected] = useState<Set<Permission>>(() => new Set(role?.permissions));
  const [nameError, setNameError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isSystem = Boolean(role?.system);
  const busy = create.isPending || update.isPending || reset.isPending;
  const error = create.error ?? update.error ?? reset.error;

  const scopedKeys = useMemo(
    () => new Set(catalog.data?.scopedAreas.flatMap((a) => [...a.own, ...a.all]) ?? []),
    [catalog.data],
  );

  const toggle = (p: Permission, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(p);
      else next.delete(p);
      return next;
    });
  const setLevel = (area: Area, level: ScopeLevel) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of [...area.own, ...area.all]) next.delete(p);
      for (const p of level === 'all' ? area.all : level === 'own' ? area.own : []) next.add(p);
      return next;
    });

  const close = () => onOpenChange(false);

  const save = async () => {
    if (name.trim().length < 2) {
      setNameError('Role name must be at least 2 characters');
      return;
    }
    const permissions = [...selected];
    try {
      if (!role) {
        await create.mutateAsync({
          name: name.trim(),
          description: description.trim(),
          permissions,
        });
        toast.success(`Role "${name.trim()}" created`);
      } else {
        await update.mutateAsync({
          key: role.key,
          version: role.version,
          body: isSystem
            ? { permissions }
            : { name: name.trim(), description: description.trim(), permissions },
        });
        toast.success(
          `"${role.name}" saved. Its users have the new access from their next action.`,
        );
      }
      close();
    } catch {
      // Shown in the alert.
    }
  };

  const onSaveClick = () => {
    // ROLE-05: confirm when the change affects people already using the role.
    if (role && role.userCount > 0) setConfirmOpen(true);
    else void save();
  };

  const onReset = async () => {
    if (!role) return;
    try {
      await reset.mutateAsync(role.key);
      toast.success(`"${role.name}" is back to its default permissions`);
      close();
    } catch {
      // Shown in the alert.
    }
  };

  const ticked = (p: Permission) => selected.has(p);
  const sensitiveTicked =
    catalog.data?.permissions.filter((p) => p.sensitive && ticked(p.key)) ?? [];

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
        <SheetContent className="w-full overflow-x-hidden overflow-y-auto data-[side=right]:sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{role ? `Edit ${role.name}` : 'New role'}</SheetTitle>
            <SheetDescription>
              {isSystem
                ? 'A system role: its name stays, but you can change what it can do.'
                : 'Choose what people with this role can see and do.'}
            </SheetDescription>
          </SheetHeader>

          <div className="grid grid-cols-1 gap-5 px-4 pb-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage(error)}</AlertDescription>
              </Alert>
            )}

            <FormField id="role-name" label="Role name *" error={nameError ?? undefined}>
              <Input
                id="role-name"
                value={name}
                disabled={isSystem}
                placeholder="e.g. Office staff"
                aria-invalid={!!nameError}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError(null);
                }}
              />
            </FormField>
            <FormField id="role-description" label="Description">
              <Textarea
                id="role-description"
                value={description}
                disabled={isSystem}
                rows={2}
                maxLength={200}
                placeholder="What this role is for"
                onChange={(e) => setDescription(e.target.value)}
              />
            </FormField>

            {!role && (
              <FormField
                id="role-start"
                label="Start from"
                hint="Copies that role's permissions; adjust them below."
              >
                <Select
                  items={[
                    { value: 'blank', label: 'Blank (no permissions)' },
                    ...roles.map((r) => ({ value: r.key, label: r.name })),
                  ]}
                  defaultValue="blank"
                  onValueChange={(value) => {
                    const from = roles.find((r) => r.key === value);
                    // Reserved permissions never copy over (Admin only).
                    const reserved = new Set(
                      catalog.data?.permissions.filter((p) => p.reserved).map((p) => p.key),
                    );
                    setSelected(new Set(from?.permissions.filter((p) => !reserved.has(p)) ?? []));
                  }}
                >
                  <SelectTrigger id="role-start" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blank">Blank (no permissions)</SelectItem>
                    {roles.map((r) => (
                      <SelectItem key={r.key} value={r.key}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}

            {catalog.isPending ? (
              <Skeleton className="h-80 w-full" />
            ) : catalog.isError ? (
              <p className="text-sm text-destructive">{errorMessage(catalog.error)}</p>
            ) : (
              catalog.data.groups.map((group) => {
                const items = catalog.data.permissions.filter(
                  (p) => p.group === group && !scopedKeys.has(p.key),
                );
                const areas = catalog.data.scopedAreas.filter((a) =>
                  catalog.data.permissions.some((p) => p.group === group && a.all.includes(p.key)),
                );
                return (
                  <section key={group} className="grid gap-2 rounded-lg border p-3">
                    <h3 className="text-sm font-semibold">{group}</h3>
                    {areas.map((area) => (
                      <ScopeChoice
                        key={area.key}
                        area={area}
                        value={levelOf(selected, area)}
                        onChange={(level) => setLevel(area, level)}
                      />
                    ))}
                    {items.map((p) =>
                      p.reserved ? (
                        <div
                          key={p.key}
                          className="flex items-center gap-2 text-sm text-muted-foreground"
                        >
                          <LockIcon className="size-3.5" aria-hidden />
                          {p.label}
                          <Badge variant="outline" className="ml-auto">
                            Admin only
                          </Badge>
                        </div>
                      ) : (
                        <label
                          key={p.key}
                          className="flex cursor-pointer items-center gap-2 text-sm"
                        >
                          <Checkbox
                            checked={ticked(p.key)}
                            onCheckedChange={(on) => toggle(p.key, Boolean(on))}
                            aria-label={p.label}
                          />
                          {p.label}
                          {p.sensitive && (
                            <Badge
                              variant="outline"
                              className="ml-auto border-warning/50 text-warning"
                            >
                              Sensitive
                            </Badge>
                          )}
                        </label>
                      ),
                    )}
                  </section>
                );
              })
            )}

            {sensitiveTicked.length > 0 && (
              <Alert>
                <TriangleAlertIcon />
                <AlertDescription>
                  Sensitive access included: {sensitiveTicked.map((p) => p.label).join(', ')}. Give
                  it only to people who need it.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <SheetFooter className="flex-row flex-wrap justify-end gap-2">
            {isSystem && role?.customised && (
              <Button variant="ghost" className="mr-auto" disabled={busy} onClick={onReset}>
                Reset to defaults
              </Button>
            )}
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={onSaveClick}>
              {busy && <Loader2Icon className="animate-spin" />}
              {role ? 'Save changes' : 'Create role'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change access for {role?.userCount} user(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Everyone with the role &quot;{role?.name}&quot; gets the new permissions from their
              next action. They don&apos;t need to sign in again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                void save();
              }}
            >
              Save changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** None / Own / All for one scoped area, as a small segmented control. */
function ScopeChoice({
  area,
  value,
  onChange,
}: {
  area: Area;
  value: ScopeLevel;
  onChange: (level: ScopeLevel) => void;
}) {
  const options: { level: ScopeLevel; label: string }[] = [
    { level: 'none', label: 'None' },
    { level: 'own', label: 'Own only' },
    { level: 'all', label: 'All' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="min-w-36">{area.label}</span>
      <div
        role="radiogroup"
        aria-label={area.label}
        className="inline-flex rounded-md border p-0.5"
      >
        {options.map((o) => (
          <button
            key={o.level}
            type="button"
            role="radio"
            aria-checked={value === o.level}
            onClick={() => onChange(o.level)}
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium transition-colors',
              value === o.level ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
