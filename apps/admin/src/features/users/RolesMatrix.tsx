import { ROLES } from '@real-estate/shared';
import type { RoleAccess } from '@real-estate/shared';
import { CheckIcon, MinusIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useRoles } from './api';

function AccessCell({ access }: { access: RoleAccess }) {
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

/** Read-only "what each role can do" (roles are fixed in code). */
export function RolesMatrix() {
  const roles = useRoles();

  if (roles.isPending) return <Skeleton className="h-72 w-full" />;
  if (roles.isError) return <p className="text-sm text-destructive">{errorMessage(roles.error)}</p>;

  const labels = Object.fromEntries(roles.data.roles.map((r) => [r.role, r.label]));

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>What each role can do</CardTitle>
            <CardDescription>
              Roles are fixed. Choose a user&apos;s role when inviting or editing them.
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-dashed">
            Read-only
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table className="min-w-[620px]">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Module</TableHead>
                  {ROLES.map((role) => (
                    <TableHead key={role}>{labels[role]}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.data.matrix.map((row) => (
                  <TableRow key={row.module}>
                    <TableCell className={row.phase > 1 ? 'text-muted-foreground' : 'font-medium'}>
                      <span className="mr-2">{row.module}</span>
                      {row.phase > 1 && (
                        <Badge variant="outline" className="border-dashed text-[10px] font-normal">
                          Phase {row.phase}
                        </Badge>
                      )}
                    </TableCell>
                    {ROLES.map((role) => (
                      <TableCell key={role}>
                        <AccessCell access={row.access[role]} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {roles.data.roles.map((role) => (
          <Card key={role.role}>
            <CardHeader>
              <CardTitle className="text-base">{role.label}</CardTitle>
              <CardDescription>{role.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
