import { IMPORT_MAX_BYTES, IMPORT_MAX_ROWS } from '@real-estate/shared';
import {
  CheckIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  Loader2Icon,
  UploadIcon,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  downloadErrorReport,
  downloadTemplate,
  useCheckImport,
  useImport,
  useImports,
} from '@/features/imports/api';
import { BatchReview } from '@/features/imports/BatchReview';
import { usePropertyTypes } from '@/features/propertyTypes/api';
import { errorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const STEPS = ['Download template', 'Upload file', 'Review', 'Import'];

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="Import steps">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        return (
          <li
            key={label}
            className="flex flex-1 items-center gap-2 text-sm font-medium"
            aria-current={n === current ? 'step' : undefined}
          >
            <span
              className={cn(
                'flex size-7 flex-none items-center justify-center rounded-full border text-xs',
                done || n === current
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'text-muted-foreground',
              )}
            >
              {done ? <CheckIcon className="size-3.5" /> : n}
            </span>
            <span className={n === current ? '' : 'text-muted-foreground'}>{label}</span>
            {n < STEPS.length && <span className="hidden h-px min-w-6 flex-1 bg-border sm:block" />}
          </li>
        );
      })}
    </ol>
  );
}

function Tabbar({ tab }: { tab: 'new' | 'history' }) {
  const navigate = useNavigate();
  return (
    <Tabs
      value={tab}
      onValueChange={(v) => navigate(v === 'history' ? '/imports/history' : '/imports')}
      className="mb-5"
    >
      <TabsList variant="line">
        <TabsTrigger value="new">New import</TabsTrigger>
        <TabsTrigger value="history">Import history</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

/** Bulk Import: /imports (new), /imports/history, and /imports/:id (one checked or imported file). */
export function ImportPage({ tab }: { tab: 'new' | 'history' | 'batch' }) {
  if (tab === 'history') {
    return (
      <>
        <Tabbar tab="history" />
        <ImportHistory />
      </>
    );
  }
  if (tab === 'batch') return <BatchPage />;
  return (
    <>
      <Tabbar tab="new" />
      <NewImport />
    </>
  );
}

function NewImport() {
  const navigate = useNavigate();
  const types = usePropertyTypes();
  const check = useCheckImport();
  const [subcategoryId, setSubcategoryId] = useState('');
  const [downloaded, setDownloaded] = useState(false);
  const [busyTemplate, setBusyTemplate] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const subs = (types.data?.categories ?? [])
    .filter((c) => c.isActive)
    .flatMap((c) => c.subcategories.filter((s) => s.isActive));
  const items = subs.map((s) => ({ value: s.id, label: s.name }));
  const step = !subcategoryId ? 1 : !downloaded ? 1 : 2;

  const getTemplate = async () => {
    setBusyTemplate(true);
    try {
      await downloadTemplate(subcategoryId);
      setDownloaded(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyTemplate(false);
    }
  };

  const send = (file: File | undefined) => {
    if (!file || !subcategoryId) return;
    if (!file.name.toLowerCase().endsWith('.xlsx'))
      return toast.error('Upload the .xlsx template (Excel).');
    if (file.size > IMPORT_MAX_BYTES) return toast.error('The file can be up to 10 MB.');
    setProgress(0);
    check.mutate(
      { subcategoryId, file, onProgress: setProgress },
      { onSuccess: (batch) => navigate(`/imports/${batch.id}`) },
    );
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    send(e.dataTransfer.files[0]);
  };

  return (
    <div className="grid gap-5">
      <Card className="p-5">
        <Stepper current={step} />
      </Card>
      <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
        <Card className="grid content-start gap-4 p-5">
          <h2 className="font-semibold">Step 1 · Choose a subcategory and download its template</h2>
          <div className="grid gap-2">
            <Label htmlFor="import-type">Subcategory</Label>
            {types.isPending ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <Select
                items={items}
                value={subcategoryId || null}
                onValueChange={(v) => {
                  setSubcategoryId(String(v ?? ''));
                  setDownloaded(false);
                }}
              >
                <SelectTrigger id="import-type" className="w-full">
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <Button
            variant="outline"
            className="w-fit"
            disabled={!subcategoryId || busyTemplate}
            onClick={getTemplate}
          >
            {busyTemplate ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />} Download
            Excel template
          </Button>
          <p className="text-xs text-muted-foreground">
            The template has the common columns plus this subcategory&apos;s attributes, dropdowns
            for fixed values, and an Instructions sheet. Already have a filled template? Go straight
            to step 2.
          </p>
        </Card>

        <Card className="grid content-start gap-4 p-5">
          <h2 className="font-semibold">Step 2 · Upload the filled file</h2>
          {check.error && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(check.error)}</AlertDescription>
            </Alert>
          )}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-8 text-center transition-colors',
              dragging ? 'border-primary bg-primary/5' : 'bg-muted/30',
              !subcategoryId && 'opacity-60',
            )}
          >
            <FileSpreadsheetIcon className="size-7 text-muted-foreground" />
            {check.isPending ? (
              <div className="grid w-full max-w-xs gap-2 text-sm">
                <span>{progress < 1 ? 'Uploading…' : 'Checking every row…'}</span>
                <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full bg-primary transition-[width]"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </span>
              </div>
            ) : (
              <>
                <p className="text-sm">
                  {subcategoryId ? 'Drop the filled .xlsx here' : 'Choose a subcategory first'}
                </p>
                <Button disabled={!subcategoryId} onClick={() => picker.current?.click()}>
                  <UploadIcon /> Choose file
                </Button>
              </>
            )}
            <input
              ref={picker}
              type="file"
              hidden
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              aria-label="Filled template"
              onChange={(e) => {
                send(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <p className="text-xs text-muted-foreground">
              Up to {IMPORT_MAX_ROWS.toLocaleString('en-IN')} rows, 10 MB. Every row is checked
              first; nothing is imported until step 4.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function BatchPage() {
  const { id } = useParams();
  const batch = useImport(id);
  return (
    <>
      <Tabbar tab="new" />
      {batch.isPending ? (
        <Skeleton className="h-80 rounded-xl" />
      ) : batch.error || !batch.data ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(batch.error)}</AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-5">
          <Card className="p-5">
            <Stepper current={batch.data.status === 'imported' ? 5 : 3} />
          </Card>
          <BatchReview batch={batch.data} />
        </div>
      )}
    </>
  );
}

function ImportHistory() {
  const [page, setPage] = useState(1);
  const list = useImports(page);
  const meta = list.data?.meta;
  return (
    <Card className="p-0">
      <Table aria-label="Import history" className="min-w-[900px]">
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>By</TableHead>
            <TableHead>Subcategory</TableHead>
            <TableHead>File</TableHead>
            <TableHead>Rows</TableHead>
            <TableHead>Imported</TableHead>
            <TableHead>Duplicates</TableHead>
            <TableHead>Errors</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.isPending && (
            <TableRow>
              <TableCell colSpan={9}>
                <Skeleton className="h-10 w-full" />
              </TableCell>
            </TableRow>
          )}
          {list.data?.items.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                No imports yet.{' '}
                <Link to="/imports" className="font-medium text-foreground underline">
                  Start one
                </Link>
              </TableCell>
            </TableRow>
          )}
          {list.data?.items.map((b) => (
            <TableRow key={b.id}>
              <TableCell>{formatDateTime(b.createdAt)}</TableCell>
              <TableCell>{b.createdBy?.name ?? '—'}</TableCell>
              <TableCell>{b.subcategoryName}</TableCell>
              <TableCell className="max-w-56 truncate">
                <Link to={`/imports/${b.id}`} className="font-medium hover:underline">
                  {b.fileName}
                </Link>
              </TableCell>
              <TableCell>{b.rowCount}</TableCell>
              <TableCell>
                {b.result ? (
                  <>
                    {b.result.created + b.result.updated}
                    <span className="text-muted-foreground">
                      {' '}
                      as {b.importAs === 'published' ? 'Published' : 'Draft'}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Not imported yet</span>
                )}
              </TableCell>
              <TableCell>{b.duplicateCount}</TableCell>
              <TableCell>{b.invalidCount}</TableCell>
              <TableCell>
                {b.invalidCount + b.duplicateCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      downloadErrorReport(b.id).catch((err: unknown) =>
                        toast.error(errorMessage(err)),
                      )
                    }
                  >
                    Error report
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {meta && meta.totalPages > 1 && (
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= meta.totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </Card>
  );
}
