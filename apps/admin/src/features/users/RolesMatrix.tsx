import type { RoleAccess, RoleInfo } from '@real-estate/shared';
import { CheckIcon, Loader2Icon, MinusIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { errorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { useDeleteRole, useMoveRoleUsers, useRoles } from './api';
import { RoleEditorSheet } from './RoleEditorSheet';

function AccessCell({ access }: { access: RoleAccess | undefined }) {
  switch (access) {
    case 'full':
      return (
        <span className="inline-flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <CheckIcon className="size-4" aria-label="Yes" />
        </span>
      );
    case 'own':
      return <span className="text-sm">Own only</span>;
    case 'view':
      return <span className="text-sm">View</span>;
    default:
      return (
        <span className="inline-flex size-6 items-center justify-center rounded-md border text-muted-foreground">
          <MinusIcon className="size-4" aria-label="No" />
        </span>
      );
  }
}

/**
 * Users & Roles → Roles (PRD §4.2): the three system roles and any custom roles, what
 * each can do, and (Admin only) creating, editing and deleting roles.
 */
export function RolesMatrix() {
  const roles = useRoles();
  const [editing, setEditing] = useState<RoleInfo | 'new' | null>(null);
  const [deleting, setDeleting] = useState<RoleInfo | null>(null);

  if (roles.isPending) return <Skeleton className="h-72 w-full" />;
  if (roles.isError) return <p className="text-sm text-destructive">{errorMessage(roles.error)}</p>;
  const list = roles.data.roles;

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Roles</CardTitle>
            <CardDescription>
              Admin always has every permission. Add a role when people need a different set of
              access.
            </CardDescription>
          </div>
          <Button onClick={() => setEditing('new')}>
            <PlusIcon /> New role
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Role</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead>Last change</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((role) => (
                  <TableRow key={role.key}>
                    <TableCell>
                      <span className="mr-2 font-medium">{role.name}</span>
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {role.system ? 'System' : 'Custom'}
                      </Badge>
                      {role.customised && (
                        <Badge
                          variant="outline"
                          className="ml-1 border-dashed text-[10px] font-normal"
                        >
                          Customised
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-80 text-sm text-muted-foreground">
                      {role.description}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{role.userCount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {role.updatedAt ? formatDate(role.updatedAt) : '—'}
                      {role.updatedBy && ` · ${role.updatedBy.name}`}
                    </TableCell>
                    <TableCell className="text-right">
                      {role.key !== 'admin' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${role.name}`}
                          onClick={() => setEditing(role)}
                        >
                          <PencilIcon />
                        </Button>
                      )}
                      {!role.system && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${role.name}`}
                          onClick={() => setDeleting(role)}
                        >
                          <Trash2Icon />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What each role can do</CardTitle>
          <CardDescription>Modules marked with a release arrive in that release.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table className="min-w-[620px]">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Module</TableHead>
                  {list.map((role) => (
                    <TableHead key={role.key}>{role.name}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.data.matrix.map((row) => (
                  <TableRow key={row.module}>
                    <TableCell
                      className={row.release !== 'R0' ? 'text-muted-foreground' : 'font-medium'}
                    >
                      <span className="mr-2">{row.module}</span>
                      {row.release !== 'R0' && (
                        <Badge variant="outline" className="border-dashed text-[10px] font-normal">
                          {row.release}
                        </Badge>
                      )}
                    </TableCell>
                    {list.map((role) => (
                      <TableCell key={role.key}>
                        <AccessCell access={row.access[role.key]} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {editing && (
        <RoleEditorSheet
          key={editing === 'new' ? 'new' : editing.key}
          role={editing === 'new' ? undefined : editing}
          roles={list}
          open
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}
      {deleting && (
        <DeleteRoleDialog
          role={deleting}
          others={list.filter((r) => r.key !== deleting.key && r.key !== 'admin')}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

/** ROLE-06: delete a custom role; if people still have it, move them first. */
function DeleteRoleDialog({
  role,
  others,
  onClose,
}: {
  role: RoleInfo;
  others: RoleInfo[];
  onClose: () => void;
}) {
  const remove = useDeleteRole();
  const move = useMoveRoleUsers();
  const [target, setTarget] = useState<string | null>(null);
  const inUse = role.userCount > 0;
  const busy = remove.isPending || move.isPending;

  const confirm = async () => {
    try {
      if (inUse) {
        if (!target) return;
        await move.mutateAsync({ from: role.key, to: target });
      }
      await remove.mutateAsync(role.key);
      toast.success(`Role "${role.name}" deleted`);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete the role &quot;{role.name}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            {inUse
              ? `${role.userCount} user(s) have this role. Choose the role to move them to; then the role is deleted.`
              : 'No one has this role. This can’t be undone.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {inUse && (
          <Select
            items={others.map((r) => ({ value: r.key, label: r.name }))}
            value={target}
            onValueChange={(v) => setTarget(v)}
          >
            <SelectTrigger aria-label="Move users to" className="w-full">
              <SelectValue placeholder="Move users to…" />
            </SelectTrigger>
            <SelectContent>
              {others.map((r) => (
                <SelectItem key={r.key} value={r.key}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy || (inUse && !target)}
            onClick={confirm}
          >
            {busy && <Loader2Icon className="animate-spin" />}
            {inUse ? 'Move users and delete' : 'Delete role'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
