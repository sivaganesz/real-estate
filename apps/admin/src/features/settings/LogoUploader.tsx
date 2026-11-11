import { LOGO_ACCEPT, LOGO_MAX_BYTES } from '@real-estate/shared';
import { ImageIcon, Loader2Icon } from 'lucide-react';
import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { useRemoveLogo, useUploadLogo } from './api';

const ALLOWED = LOGO_ACCEPT.split(',');

/** Checked again on the server (by file content); this just gives quicker feedback. */
function checkFile(file: File): string | null {
  if (!ALLOWED.includes(file.type)) return 'Choose a PNG, JPG or WebP image.';
  if (file.size > LOGO_MAX_BYTES) return 'The logo must be 2 MB or smaller.';
  return null;
}

/**
 * Logo preview with Upload / Remove under it (wireframe layout). A file can also be dropped
 * on the preview. The logo saves straight away, separately from the form.
 */
export function LogoUploader({ logoUrl, name }: { logoUrl: string | null; name: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadLogo();
  const remove = useRemoveLogo();
  const [dragging, setDragging] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const busy = upload.isPending || remove.isPending;
  const showImage = logoUrl && failedUrl !== logoUrl;

  const send = async (file: File | undefined) => {
    if (!file) return;
    const issue = checkFile(file);
    setProblem(issue);
    if (issue) return;
    try {
      await upload.mutateAsync(file);
      toast.success(logoUrl ? 'Logo replaced' : 'Logo uploaded');
    } catch (err) {
      setProblem(errorMessage(err));
    }
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (!busy) void send(event.dataTransfer.files[0]);
  };

  const onRemove = async () => {
    setProblem(null);
    try {
      await remove.mutateAsync();
      toast.success('Logo removed');
    } catch (err) {
      setProblem(errorMessage(err));
    }
  };

  return (
    <div className="flex w-40 flex-none flex-col items-center gap-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'relative flex size-30 items-center justify-center overflow-hidden rounded-xl border bg-muted/40 transition-colors',
          !showImage && 'border-dashed',
          dragging && 'border-primary bg-primary/5',
        )}
      >
        {showImage ? (
          <img
            src={logoUrl}
            alt={`${name} logo`}
            onError={() => setFailedUrl(logoUrl)}
            className="size-full bg-white object-contain p-2"
          />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
            <ImageIcon className="size-6" aria-hidden />
            No logo yet
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Loader2Icon className="size-5 animate-spin" aria-label="Saving logo" />
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {logoUrl ? 'Replace' : 'Upload'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || !logoUrl}
          onClick={() => void onRemove()}
        >
          Remove
        </Button>
      </div>
      <span className="text-center text-xs text-muted-foreground">PNG, JPG or WebP · max 2 MB</span>
      {problem && (
        <p className="text-center text-xs text-destructive" role="alert">
          {problem}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={LOGO_ACCEPT}
        className="sr-only"
        aria-label="Upload logo"
        tabIndex={-1}
        onChange={(event) => {
          void send(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
    </div>
  );
}
