/**
 * Photos in the property form: pick or drop images, each compressed in the browser to ≤ 1600 px JPEG (lib/image),
 * at most 8 per property and about 4 MB in total (Known limitation K3: refused with a clear message, never silently).
 * The first photo is the cover; any photo can be made the cover or removed. Nothing is saved until the form is saved.
 */
import { useRef, useState, type DragEvent } from 'react'
import { ImagePlus, Loader2, Star, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { Media } from '@/domain/types'
import { cn } from '@/lib/utils'
import { MAX_FILE_MB, MAX_PHOTOS, addPhotos, checkPhotoBudget, compressImage, orderedPhotos, removeMedia, setCover } from '../lib/image'

export function PhotoManager({ media, onChange, otherBytes, disabled }: {
  media: Media[]
  onChange: (media: Media[]) => void
  /** Bytes of uploaded photos already stored on other properties. */
  otherBytes: number
  disabled?: boolean
}) {
  const { t } = useTranslation('properties')
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const photos = orderedPhotos(media)

  const add = async (files: FileList | File[]) => {
    const list = Array.from(files)
    const images = list.filter((f) => f.type.startsWith('image/'))
    if (images.length < list.length) toast.error(t('photos.notImage'))
    const sized = images.filter((f) => f.size <= MAX_FILE_MB * 1_048_576)
    if (sized.length < images.length) toast.error(t('photos.tooBig', { mb: MAX_FILE_MB }))
    if (!sized.length) return
    setBusy(true)
    try {
      const urls: string[] = []
      for (const f of sized) urls.push(await compressImage(f))
      const check = checkPhotoBudget(media, urls, otherBytes)
      if (!check.ok) {
        toast.error(check.reason === 'count' ? t('photos.tooMany', { max: MAX_PHOTOS, room: check.room }) : t('photos.storageFull'))
        return
      }
      onChange(addPhotos(media, urls, `ph-${Date.now()}`))
      toast.success(t('photos.added', { count: urls.length }))
    } catch {
      toast.error(t('photos.cantRead'))
    } finally {
      setBusy(false)
    }
  }
  const drop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    if (!disabled) void add(e.dataTransfer.files)
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => { if (!disabled) { e.preventDefault(); setOver(true) } }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
        className={cn('grid grid-cols-2 gap-2 rounded-lg sm:grid-cols-3 lg:grid-cols-4', over && 'ring-2 ring-primary ring-offset-2 ring-offset-background')}
      >
        {photos.map((m, i) => (
          <figure key={m.id} className="group relative aspect-[4/3] overflow-hidden rounded-lg border bg-muted" data-testid="form-photo">
            <img src={m.url} alt={t('photos.alt', { n: i + 1 })} className="size-full object-cover" />
            {m.isCover && (
              <span className="absolute top-1.5 left-1.5 inline-flex h-6 items-center gap-1 rounded-full bg-card/90 px-2 text-micro font-semibold shadow-sm backdrop-blur">
                <Star className="size-3 fill-highlight text-highlight" aria-hidden="true" />{t('photos.cover')}
              </span>
            )}
            {!disabled && (
              <figcaption className="absolute right-1.5 bottom-1.5 flex gap-1">
                {!m.isCover && (
                  <Button type="button" size="icon-sm" variant="secondary" className="bg-card/90 backdrop-blur" onClick={() => onChange(setCover(media, m.id))} aria-label={t('photos.makeCoverN', { n: i + 1 })} title={t('photos.makeCover')}>
                    <Star />
                  </Button>
                )}
                <Button type="button" size="icon-sm" variant="secondary" className="bg-card/90 text-danger backdrop-blur hover:text-danger" onClick={() => onChange(removeMedia(media, m.id))} aria-label={t('photos.removeN', { n: i + 1 })} title={t('photos.remove')}>
                  <Trash2 />
                </Button>
              </figcaption>
            )}
          </figure>
        ))}
        {!disabled && photos.length < MAX_PHOTOS && (
          <button
            type="button" onClick={() => input.current?.click()} disabled={busy}
            className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-strong bg-card p-3 text-center text-sm text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            data-testid="photo-add"
          >
            {busy ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-5" aria-hidden="true" />}
            <span className="font-medium">{busy ? t('photos.compressing') : t('photos.add')}</span>
            <span className="text-micro">{t('photos.dropHint')}</span>
          </button>
        )}
      </div>
      <p className="text-meta text-muted-foreground">{t('photos.limits', { count: photos.length, max: MAX_PHOTOS })}</p>
      <input
        ref={input} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden="true" data-testid="photo-input"
        onChange={(e) => { if (e.target.files) void add(e.target.files); e.target.value = '' }}
      />
    </div>
  )
}
