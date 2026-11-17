import { MEDIA_RULES } from '@real-estate/shared';
import type { Category, Property } from '@real-estate/shared';
import { FileTextIcon, VideoIcon } from 'lucide-react';
import { useAuth } from '@/auth/auth-context';
import { Timeline } from '@/components/patterns';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { usePropertyHistory } from '../api';
import { ACTION_LABELS, historyFieldLabel, historyValue, namesFrom } from '../display';
import { MediaManager } from '../form/MediaManager';

/**
 * Media tab (PROP-66): photos with the cover, floor plans, brochures, documents and videos.
 * People who can edit upload, reorder and remove here; others see the files.
 */
export function MediaTab({ property: p }: { property: Property }) {
  const { can } = useAuth();
  const editable = can('properties:write') && p.status !== 'archived';
  const photos = p.media.filter((m) => m.kind === 'image');
  const files = p.media.filter((m) => m.kind !== 'image');
  return (
    <Card className="grid gap-4 p-5">
      <h2 className="font-semibold">Images &amp; documents</h2>
      {editable ? (
        <MediaManager property={p} />
      ) : (
        <>
          {photos.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
              {photos.map((m) => (
                <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className="relative">
                  <img
                    src={m.thumbUrl ?? m.url}
                    alt=""
                    className="aspect-[4/3] w-full rounded-lg object-cover"
                  />
                  {m.isCover && (
                    <span className="absolute top-1.5 left-1.5 rounded bg-card/90 px-1.5 text-[11px]">
                      Cover
                    </span>
                  )}
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No images yet.</p>
          )}
          {files.length > 0 && (
            <ul className="grid gap-2 text-sm">
              {files.map((m) => (
                <li key={m.id}>
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 hover:underline"
                  >
                    {m.kind === 'video' ? (
                      <VideoIcon className="size-4" />
                    ) : (
                      <FileTextIcon className="size-4" />
                    )}
                    {m.originalName || MEDIA_RULES[m.kind].label}
                    <span className="text-muted-foreground">({MEDIA_RULES[m.kind].label})</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}

/** History tab (PROP-66): who changed what and when, before → after. */
export function HistoryTab({
  property,
  categories,
}: {
  property: Property;
  categories: Category[];
}) {
  const history = usePropertyHistory(property.id);
  const names = namesFrom(categories);
  if (history.isPending) return <Skeleton className="h-60 rounded-xl" />;
  if (history.error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{errorMessage(history.error)}</AlertDescription>
      </Alert>
    );
  }
  return (
    <Card className="gap-0 p-5">
      <h2 className="mb-3 font-semibold">Change history</h2>
      <Timeline
        label="Change history"
        items={history.data.map((h) => ({
          key: h.id,
          when: `${formatDateTime(h.at)} · ${h.by?.name ?? 'System'}`,
          children: (
            <>
              <div className="text-sm font-medium">{ACTION_LABELS[h.action] ?? h.action}</div>
              {h.changes && h.action !== 'created' && (
                <ul className="mt-0.5 grid gap-0.5 text-[13px] text-muted-foreground">
                  {Object.entries(h.changes).map(([field, [before, after]]) => (
                    <li key={field}>
                      <span className="text-foreground">{historyFieldLabel(field, names)}:</span>{' '}
                      {historyValue(field, before, names)} → {historyValue(field, after, names)}
                    </li>
                  ))}
                </ul>
              )}
              {h.action === 'created' && h.changes?.code && (
                <p className="text-[13px] text-muted-foreground">
                  Code {String(h.changes.code[1])}
                </p>
              )}
            </>
          ),
        }))}
      />
      <p className="mt-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        Every change is recorded with who made it and when.
      </p>
    </Card>
  );
}
