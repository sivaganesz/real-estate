import { MAX_MEDIA_PER_PROPERTY, MEDIA_RULES } from '@real-estate/shared';
import type { MediaKind, Property, PropertyMedia } from '@real-estate/shared';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  FileTextIcon,
  ImageUpIcon,
  Loader2Icon,
  StarIcon,
  Trash2Icon,
  VideoIcon,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { toast } from 'sonner';
import { IconButton } from '@/components/IconButton';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { useDeleteMedia, useReorderMedia, useSetCover, useUploadMedia } from '../api';

interface QueueItem {
  key: string;
  name: string;
  kind: MediaKind;
  progress: number;
  error?: string;
}

const ADD_BUTTONS: { kind: MediaKind; label: string; multiple: boolean }[] = [
  { kind: 'image', label: 'Add photos', multiple: true },
  { kind: 'floor_plan', label: 'Floor plan', multiple: true },
  { kind: 'brochure', label: 'Brochure', multiple: false },
  { kind: 'document', label: 'Document', multiple: true },
  { kind: 'video', label: 'Video', multiple: false },
];

/** Dropped files: images become photos, PDFs documents, videos videos. */
function kindForDrop(file: File): MediaKind | null {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type === 'application/pdf') return 'document';
  if (file.type.startsWith('video/')) return 'video';
  return null;
}

const sizeLabel = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * Photos, floor plans, brochures, documents and videos of a saved property. Uploads go one
 * at a time (with progress); each change is saved straight away.
 */
export function MediaManager({ property }: { property: Property }) {
  const upload = useUploadMedia();
  const reorder = useReorderMedia();
  const setCover = useSetCover();
  const remove = useDeleteMedia();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const pickers = useRef<Partial<Record<MediaKind, HTMLInputElement | null>>>({});
  const busy = queue.some((q) => !q.error && q.progress < 1);
  const media = property.media;
  const photos = media.filter((m) => m.kind === 'image');
  const files = media.filter((m) => m.kind !== 'image');

  const enqueue = async (items: { file: File; kind: MediaKind }[]) => {
    const room = MAX_MEDIA_PER_PROPERTY - media.length;
    if (items.length > room) toast.warning(`Only ${room} more files fit on one property.`);
    const accepted: (QueueItem & { file: File })[] = [];
    for (const { file, kind } of items.slice(0, Math.max(0, room))) {
      const rule = MEDIA_RULES[kind];
      const key = `${file.name}-${file.size}-${Math.random()}`;
      if (file.size > rule.maxBytes) {
        setQueue((q) => [
          ...q,
          {
            key,
            name: file.name,
            kind,
            progress: 0,
            error: `Too large: a ${rule.label.toLowerCase()} can be up to ${rule.maxBytes / 1024 / 1024} MB`,
          },
        ]);
        continue;
      }
      accepted.push({ key, name: file.name, kind, progress: 0, file });
    }
    setQueue((q) => [...q, ...accepted.map(({ file: _file, ...rest }) => rest)]);
    // One at a time: each answer is the whole property, so the last one is always current.
    for (const item of accepted) {
      try {
        await upload.mutateAsync({
          id: property.id,
          kind: item.kind,
          file: item.file,
          onProgress: (p) =>
            setQueue((q) =>
              q.map((x) => (x.key === item.key ? { ...x, progress: Math.min(p, 0.99) } : x)),
            ),
        });
        setQueue((q) => q.filter((x) => x.key !== item.key));
      } catch (err) {
        setQueue((q) =>
          q.map((x) => (x.key === item.key ? { ...x, error: errorMessage(err) } : x)),
        );
      }
    }
  };

  const onPick = (kind: MediaKind) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    void enqueue(picked.map((file) => ({ file, kind })));
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    const known = dropped.flatMap((file) => {
      const kind = kindForDrop(file);
      return kind ? [{ file, kind }] : [];
    });
    if (known.length < dropped.length)
      toast.error('Some files were skipped: use JPG, PNG, WebP, PDF, MP4 or WebM.');
    void enqueue(known);
  };

  const move = (item: PropertyMedia, by: -1 | 1) => {
    const ids = media.map((m) => m.id);
    const group = (item.kind === 'image' ? photos : files).map((m) => m.id);
    const target = group[group.indexOf(item.id) + by];
    if (!target) return;
    const a = ids.indexOf(item.id);
    const b = ids.indexOf(target);
    [ids[a], ids[b]] = [ids[b]!, ids[a]!];
    reorder.mutate({ id: property.id, ids }, { onError: (err) => toast.error(errorMessage(err)) });
  };

  const onDelete = (item: PropertyMedia) =>
    remove.mutate(
      { id: property.id, mediaId: item.id },
      {
        onSuccess: () => toast.success(`${item.originalName || 'File'} deleted`),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );

  return (
    <div className="grid gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-6 text-center transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'bg-muted/30',
        )}
      >
        <ImageUpIcon className="size-6 text-muted-foreground" />
        <p className="text-sm">Drop photos, PDFs or a video here, or choose what to add:</p>
        <div className="flex flex-wrap justify-center gap-2">
          {ADD_BUTTONS.map((b) => (
            <span key={b.kind}>
              <Button
                type="button"
                size="sm"
                variant={b.kind === 'image' ? 'default' : 'outline'}
                onClick={() => pickers.current[b.kind]?.click()}
              >
                {b.label}
              </Button>
              <input
                ref={(el) => {
                  pickers.current[b.kind] = el;
                }}
                type="file"
                hidden
                multiple={b.multiple}
                accept={MEDIA_RULES[b.kind].accept}
                aria-label={b.label}
                onChange={onPick(b.kind)}
              />
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Photos: JPG, PNG or WebP up to 10 MB (resized automatically) · PDFs up to 20 MB · videos
          up to 50 MB
        </p>
      </div>

      {queue.length > 0 && (
        <ul className="grid gap-2" aria-label="Uploads">
          {queue.map((q) => (
            <li key={q.key} className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
              {q.error ? null : (
                <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1 truncate">{q.name}</span>
              {q.error ? (
                <>
                  <span className="text-destructive">{q.error}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setQueue((all) => all.filter((x) => x.key !== q.key))}
                  >
                    Dismiss
                  </Button>
                </>
              ) : (
                <span className="w-28">
                  <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full bg-primary transition-[width]"
                      style={{ width: `${Math.round(q.progress * 100)}%` }}
                    />
                  </span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Photos">
          {photos.map((m, i) => (
            <li key={m.id} className="overflow-hidden rounded-xl border bg-card">
              <div className="relative aspect-[4/3] bg-muted">
                <img
                  src={m.thumbUrl ?? m.url}
                  alt={m.originalName}
                  className="size-full object-cover"
                  loading="lazy"
                />
                {m.isCover && (
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium">
                    <StarIcon className="size-3 fill-amber-400 text-amber-400" /> Cover
                  </span>
                )}
              </div>
              <div className="flex items-center gap-0.5 p-1.5">
                <IconButton
                  label="Move left"
                  type="button"
                  disabled={i === 0 || reorder.isPending || busy}
                  onClick={() => move(m, -1)}
                >
                  <ArrowLeftIcon />
                </IconButton>
                <IconButton
                  label="Move right"
                  type="button"
                  disabled={i === photos.length - 1 || reorder.isPending || busy}
                  onClick={() => move(m, 1)}
                >
                  <ArrowRightIcon />
                </IconButton>
                {!m.isCover && (
                  <IconButton
                    label="Set as cover"
                    type="button"
                    disabled={setCover.isPending}
                    onClick={() =>
                      setCover.mutate(
                        { id: property.id, mediaId: m.id },
                        { onError: (err) => toast.error(errorMessage(err)) },
                      )
                    }
                  >
                    <StarIcon />
                  </IconButton>
                )}
                <IconButton
                  label={`Delete ${m.originalName}`}
                  type="button"
                  className="ml-auto text-muted-foreground hover:text-destructive"
                  disabled={remove.isPending}
                  onClick={() => onDelete(m)}
                >
                  <Trash2Icon />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul className="grid gap-2" aria-label="Documents and videos">
          {files.map((m, i) => (
            <li key={m.id} className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
              {m.kind === 'video' ? (
                <VideoIcon className="size-4 text-muted-foreground" />
              ) : (
                <FileTextIcon className="size-4 text-muted-foreground" />
              )}
              <a
                href={m.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate font-medium hover:underline"
              >
                {m.originalName || MEDIA_RULES[m.kind].label}
              </a>
              <span className="text-muted-foreground">
                {MEDIA_RULES[m.kind].label} · {sizeLabel(m.sizeBytes)}
              </span>
              <IconButton
                label="Move up"
                type="button"
                disabled={i === 0 || reorder.isPending || busy}
                onClick={() => move(m, -1)}
              >
                <ArrowLeftIcon className="rotate-90" />
              </IconButton>
              <IconButton
                label="Move down"
                type="button"
                disabled={i === files.length - 1 || reorder.isPending || busy}
                onClick={() => move(m, 1)}
              >
                <ArrowRightIcon className="rotate-90" />
              </IconButton>
              <IconButton
                label={`Delete ${m.originalName}`}
                type="button"
                className="text-muted-foreground hover:text-destructive"
                disabled={remove.isPending}
                onClick={() => onDelete(m)}
              >
                <Trash2Icon />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      {media.length === 0 && queue.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No photos yet. At least one photo is needed to publish; the first one becomes the cover.
        </p>
      )}
    </div>
  );
}
