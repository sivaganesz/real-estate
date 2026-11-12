import { ATTRIBUTE_TYPE_LABELS } from '@real-estate/shared';
import type { CoreAttribute, PlacedAttribute } from '@real-estate/shared';
import { LockIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const MAX_OPTIONS_SHOWN = 4;

/** "Number · ft", "Dropdown · DTCP, CMDA, Panchayat, Unapproved", "Dropdown · 1 RK, 1 BHK, … (6)". */
function describeType(attribute: Pick<PlacedAttribute, 'type' | 'unit' | 'options'>) {
  const { type, unit, options } = attribute;
  let detail = '';
  if (unit) detail = unit;
  if (options.length > 0) {
    detail =
      options.length > MAX_OPTIONS_SHOWN
        ? `${options.slice(0, MAX_OPTIONS_SHOWN).join(', ')}, … (${options.length})`
        : options.join(', ');
  }
  return { label: ATTRIBUTE_TYPE_LABELS[type], detail };
}

function RequiredCell({ required }: { required: boolean }) {
  return required ? (
    <Badge>Required</Badge>
  ) : (
    <span className="text-sm text-muted-foreground">Optional</span>
  );
}

/** Attributes of one place (common or a subcategory), with the locked core rows on top. */
export function AttributesTable({
  label,
  attributes,
  core = [],
  onEdit,
  onDelete,
}: {
  label: string;
  attributes: PlacedAttribute[];
  core?: CoreAttribute[];
  onEdit: (attribute: PlacedAttribute) => void;
  onDelete: (attribute: PlacedAttribute) => void;
}) {
  return (
    <Table aria-label={label} className="min-w-[640px]">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[34%]">Attribute</TableHead>
          <TableHead>Value type</TableHead>
          <TableHead className="w-28">Required</TableHead>
          <TableHead className="w-40">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {core.map((a) => (
          <TableRow key={a.key}>
            <TableCell className="font-medium">{a.label}</TableCell>
            <TableCell>
              {a.valueType}
              {a.detail && <span className="text-muted-foreground"> · {a.detail}</span>}
            </TableCell>
            <TableCell>
              <RequiredCell required />
            </TableCell>
            <TableCell>
              <span
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
                title="Needed to publish a property and for search, so it can't be changed or deleted"
              >
                <LockIcon className="size-3.5" /> Locked
              </span>
            </TableCell>
          </TableRow>
        ))}
        {attributes.map((a) => {
          const type = describeType(a);
          return (
            <TableRow key={a.id}>
              <TableCell className="whitespace-normal">
                <span className="font-medium">{a.label}</span>
                {a.searchFilter && (
                  <Badge variant="outline" className="ml-2 align-middle">
                    Search filter
                  </Badge>
                )}
                {a.usedIn.length > 0 && (
                  <span className="block text-xs text-muted-foreground">
                    Also in {a.usedIn.join(', ')}
                  </span>
                )}
              </TableCell>
              <TableCell className="whitespace-normal">
                {type.label}
                {type.detail && <span className="text-muted-foreground"> · {type.detail}</span>}
              </TableCell>
              <TableCell>
                <RequiredCell required={a.required} />
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(a)}
                    aria-label={`Edit ${a.label}`}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(a)}
                    aria-label={`Delete ${a.label}`}
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
  );
}
