import { formatINR } from '@real-estate/shared';
import type { ImportBatchDetail, ImportRowStatus } from '@real-estate/shared';
import { CheckCircle2Icon, DownloadIcon, Loader2Icon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { downloadErrorReport, useCommitImport } from './api';

type Filter = 'all' | ImportRowStatus;

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'good' | 'bad' | 'warn';
}) {
  return (
    <div className="rounded-xl border p-4">
      <div
        className={cn(
          'text-2xl font-semibold',
          tone === 'good' && 'text-emerald-700 dark:text-emerald-400',
          tone === 'bad' && value > 0 && 'text-destructive',
          tone === 'warn' && value > 0 && 'text-amber-600 dark:text-amber-400',
        )}
      >
        {value}
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

/** Step 3 (review) and step 4 (import, then the result) for one checked file. */
export function BatchReview({ batch }: { batch: ImportBatchDetail }) {
  const commit = useCommitImport();
  const [filter, setFilter] = useState<Filter>(
    batch.invalidCount ? 'invalid' : batch.duplicateCount ? 'duplicate' : 'all',
  );
  const [importAs, setImportAs] = useState<'draft' | 'published'>('draft');
  const [duplicates, setDuplicates] = useState<'skip' | 'update'>('skip');
  const [downloading, setDownloading] = useState(false);
  const imported = batch.status === 'imported';
  const rows = batch.rows.filter((r) => filter === 'all' || r.status === filter);
  const updatable = batch.rows.filter((r) => r.status === 'duplicate' && r.duplicateOf?.id).length;
  const toImport = batch.validCount + (duplicates === 'update' ? updatable : 0);
  const needsReport =
    batch.invalidCount + batch.duplicateCount > 0 ||
    (batch.result &&
      batch.result.failed + batch.result.savedAsDraft + batch.result.imagesFailed > 0);

  const report = async () => {
    setDownloading(true);
    try {
      await downloadErrorReport(batch.id);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  const runImport = () =>
    commit.mutate(
      { id: batch.id, body: { importAs, duplicates } },
      {
        onSuccess: (done) => {
          const r = done.result!;
          toast.success(`${r.created + r.updated} properties imported`);
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );

  return (
    <div className="grid gap-5">
      <Card className="grid gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">{imported ? 'Checked rows' : 'Step 3 · Review'}</h2>
            <p className="text-sm text-muted-foreground">
              {batch.fileName} · {batch.subcategoryName}
            </p>
          </div>
          {needsReport && (
            <Button variant="outline" size="sm" disabled={downloading} onClick={report}>
              {downloading ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />} Download
              error report
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Rows" value={batch.rowCount} />
          <Stat label="Valid" value={batch.validCount} tone="good" />
          <Stat label="Invalid (won't import)" value={batch.invalidCount} tone="bad" />
          <Stat label="Duplicates" value={batch.duplicateCount} tone="warn" />
        </div>
        {batch.unknownColumns.length > 0 && (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            These columns aren&apos;t in the template and were ignored:{' '}
            {batch.unknownColumns.join(', ')}.
          </p>
        )}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList variant="line">
            <TabsTrigger value="all">All ({batch.rowCount})</TabsTrigger>
            <TabsTrigger value="invalid">Invalid ({batch.invalidCount})</TabsTrigger>
            <TabsTrigger value="duplicate">Duplicates ({batch.duplicateCount})</TabsTrigger>
            <TabsTrigger value="valid">Valid ({batch.validCount})</TabsTrigger>
          </TabsList>
        </Tabs>
        <Table aria-label="Checked rows" className="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">Row</TableHead>
              <TableHead>Property name</TableHead>
              <TableHead>City / Area</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>{imported ? 'Result' : 'Problem'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  Nothing here.
                </TableCell>
              </TableRow>
            )}
            {rows.slice(0, 500).map((r) => (
              <TableRow key={r.row}>
                <TableCell>{r.row}</TableCell>
                <TableCell className="whitespace-normal">
                  {r.title || <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  {r.city || '—'}
                  {r.locality && <span className="text-muted-foreground"> / {r.locality}</span>}
                </TableCell>
                <TableCell>{r.price !== null ? formatINR(r.price) : '—'}</TableCell>
                <TableCell className="whitespace-normal">
                  {imported && r.outcome ? (
                    <span className={cn(r.outcome.startsWith('Failed') && 'text-destructive')}>
                      {r.outcome}
                    </span>
                  ) : r.status === 'invalid' ? (
                    <ul className="grid gap-0.5 text-destructive">
                      {r.errors.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  ) : r.status === 'duplicate' ? (
                    <span className="text-amber-700 dark:text-amber-400">
                      {r.duplicateOf?.row
                        ? `Same as row ${r.duplicateOf.row} in this file`
                        : `Already exists as ${r.duplicateOf?.code}`}
                    </span>
                  ) : (
                    <span className="text-emerald-700 dark:text-emerald-400">Ready</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows.length > 500 && (
          <p className="text-xs text-muted-foreground">
            Showing the first 500 rows. The error report lists all problems.
          </p>
        )}
        <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          Duplicates are matched within the file and against existing properties: same subcategory,
          area / locality and pincode, and the same plot number (or property name).
        </p>
      </Card>

      {imported && batch.result ? (
        <Card className="grid gap-3 p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <CheckCircle2Icon className="size-5 text-emerald-600" /> Import finished
          </h2>
          <p className="text-sm">
            {batch.result.created} created
            {batch.result.updated > 0 && ` · ${batch.result.updated} updated`} ·{' '}
            {batch.result.skipped} skipped
            {batch.result.failed > 0 && ` · ${batch.result.failed} failed`}
            {batch.result.savedAsDraft > 0 &&
              ` · ${batch.result.savedAsDraft} saved as Draft instead of Published`}
            {batch.result.imagesAdded + batch.result.imagesFailed > 0 &&
              ` · photos: ${batch.result.imagesAdded} added${batch.result.imagesFailed ? `, ${batch.result.imagesFailed} failed` : ''}`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              nativeButton={false}
              render={<Link to={`/properties?type=${batch.subcategoryId}`} />}
            >
              View properties
            </Button>
            <Button variant="outline" nativeButton={false} render={<Link to="/imports" />}>
              Start a new import
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="grid gap-4 p-5">
          <h2 className="font-semibold">Step 4 · Import</h2>
          {commit.error && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(commit.error)}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">Import valid rows as</legend>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="import-as"
                  checked={importAs === 'draft'}
                  onChange={() => setImportAs('draft')}
                  className="mt-1"
                />
                <span>
                  Draft <span className="text-muted-foreground">(review before publishing)</span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="import-as"
                  checked={importAs === 'published'}
                  onChange={() => setImportAs('published')}
                  className="mt-1"
                />
                <span>
                  Published{' '}
                  <span className="text-muted-foreground">
                    (rows missing a photo or required details stay Draft)
                  </span>
                </span>
              </label>
            </fieldset>
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">
                Duplicates of existing properties
              </legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="duplicates"
                  checked={duplicates === 'skip'}
                  onChange={() => setDuplicates('skip')}
                />
                Skip them
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="duplicates"
                  checked={duplicates === 'update'}
                  onChange={() => setDuplicates('update')}
                />
                Update the existing properties ({updatable})
              </label>
            </fieldset>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <span className="text-xs text-muted-foreground">
              Photos from the Image URLs column are downloaded during the import, so it can take a
              little while.
            </span>
            <Button variant="outline" nativeButton={false} render={<Link to="/imports" />}>
              Start over
            </Button>
            <Button disabled={toImport === 0 || commit.isPending} onClick={runImport}>
              {commit.isPending && <Loader2Icon className="animate-spin" />}
              {commit.isPending
                ? 'Importing…'
                : `Import ${toImport} ${toImport === 1 ? 'property' : 'properties'}`}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
