/**
 * The property's photos (ported from wireframe-rebuild/src/features/properties/components/photo-gallery.tsx): one strip
 * with the cover wider and up to three more ("+N"), an "Add photos" tile for people who may edit, and a full-screen
 * viewer (‹ › or the arrow keys, thumbnails) where editors set the cover or remove a photo. Writes go through
 * updateProperty (media); photos are compressed and capped like in the form (lib/image).
 */
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ImagePlus, Images, Loader2, Star, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EmptyProperties } from '@/components/illustrations'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { Media, Property } from '@/domain/types'
import { useDb } from '@/hooks/use-db'
import { configLabel } from '@/lib/matching'
import { cn } from '@/lib/utils'
import { updateProperty } from '@/services/properties'
import { MAX_FILE_MB, MAX_PHOTOS, addPhotos, checkPhotoBudget, compressImage, mediaBytes, orderedPhotos, removeMedia, setCover } from '../lib/image'

export function Gallery({ p, editable }: { p: Property; editable: boolean }) {
  const { t } = useTranslation('properties')
  const photos = orderedPhotos(p.media)
  const [open, setOpen] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const otherBytes = useDb((db) => db.properties.filter((x) => x.id !== p.id).reduce((n, x) => n + mediaBytes(x.media), 0))

  const add = async (files: FileList) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/') && f.size <= MAX_FILE_MB * 1_048_576)
    if (list.length < files.length) toast.error(t('photos.someSkipped'))
    if (!list.length) return
    setBusy(true)
    try {
      const urls: string[] = []
      for (const f of list) urls.push(await compressImage(f))
      const check = checkPhotoBudget(p.media, urls, otherBytes)
      if (!check.ok) {
        toast.error(check.reason === 'count' ? t('photos.tooMany', { max: MAX_PHOTOS, room: check.room }) : t('photos.storageFull'))
        return
      }
      updateProperty(p.id, { media: addPhotos(p.media, urls, `ph-${Date.now()}`) })
      toast.success(t('photos.added', { count: urls.length }))
    } catch (e) {
      if (e instanceof DOMException || e instanceof TypeError) toast.error(t('photos.cantRead'))
      else toastError(e)
    } finally {
      setBusy(false)
    }
  }
  const picker = (
    <input ref={input} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { if (e.target.files) void add(e.target.files); e.target.value = '' }} />
  )

  if (!photos.length) {
    return (
      <div className="flex h-44 items-center gap-4 overflow-hidden rounded-xl border bg-primary-soft px-6 sm:h-56">
        <EmptyProperties size={120} className="shrink-0 max-sm:hidden" />
        <div className="min-w-0 flex-1">
          {p.configuration && <p className="text-display font-[650] text-primary">{configLabel(p.configuration)}</p>}
          <p className="font-medium">{t('photos.none')}</p>
          <p className="text-sm text-muted-foreground">{t('photos.noneHint')}</p>
        </div>
        {editable && <Button variant="secondary" onClick={() => input.current?.click()} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <ImagePlus />}{t('photos.add')}</Button>}
        {picker}
      </div>
    )
  }

  const shown = photos.slice(0, 4)
  return (
    <section aria-label={t('photos.gallery', { title: p.title })}>
      <div className="flex h-48 gap-2 sm:h-64 xl:h-72">
        {shown.map((m, i) => (
          <button
            key={m.id} type="button" onClick={() => setOpen(i)} aria-label={t('photos.openN', { n: i + 1, count: photos.length })}
            className={cn('group relative min-w-0 overflow-hidden rounded-xl bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none', i === 0 ? 'flex-[2]' : 'flex-1', i >= 2 && 'max-sm:hidden', i >= 1 && 'max-[480px]:hidden')}
          >
            <img src={m.url} alt={t('photos.alt', { n: i + 1 })} className="size-full object-cover transition-transform duration-(--dur-slow) group-hover:scale-[1.03] motion-reduce:transition-none" />
            {i === 3 && photos.length > 4 && <span className="absolute inset-0 flex items-center justify-center bg-[var(--overlay)] text-xl font-semibold text-primary-foreground">+{photos.length - 4}</span>}
          </button>
        ))}
        {editable && photos.length < MAX_PHOTOS && (
          <button type="button" onClick={() => input.current?.click()} disabled={busy} className="flex w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border-strong bg-card text-sm text-muted-foreground hover:bg-primary-soft hover:text-primary max-sm:hidden">
            {busy ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-5" aria-hidden="true" />}{t('photos.add')}
          </button>
        )}
        {picker}
      </div>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t('photos.count', { count: photos.length })}</span>
        <button type="button" onClick={() => setOpen(0)} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          <Images className="size-4" aria-hidden="true" />{t('photos.viewAll', { count: photos.length })}
        </button>
      </div>
      {open !== null && <Viewer p={p} photos={photos} start={open} editable={editable} onClose={() => setOpen(null)} />}
    </section>
  )
}

function Viewer({ p, photos, start, editable, onClose }: { p: Property; photos: Media[]; start: number; editable: boolean; onClose: () => void }) {
  const { t } = useTranslation('properties')
  const [i, setI] = useState(start)
  const n = photos.length
  const at = Math.min(i, n - 1)
  const m = photos[at]
  const go = (d: number) => setI((x) => (x + d + n) % n)
  const thumbs = useRef<HTMLDivElement>(null)
  useEffect(() => { thumbs.current?.querySelector('[aria-current=true]')?.scrollIntoView({ block: 'nearest', inline: 'center' }) }, [at])
  if (!m) return null
  const makeCover = () => {
    try {
      updateProperty(p.id, { media: setCover(p.media, m.id) })
      toast.success(t('photos.coverSet'))
      setI(0)
    } catch (e) { toastError(e) }
  }
  const remove = () => {
    try {
      const { undoToken } = updateProperty(p.id, { media: removeMedia(p.media, m.id) }, { undoable: true })
      toastUndo(t('photos.removed'), undoToken)
      if (n === 1) onClose()
    } catch (e) { toastError(e) }
  }
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent
        showCloseButton={false}
        onKeyDown={(e) => { if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'ArrowRight') go(1) }}
        className="top-0 left-0 flex h-svh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-[color-mix(in_oklch,var(--foreground)_94%,transparent)] p-0 text-background sm:max-w-none"
      >
        <DialogTitle className="sr-only">{t('photos.gallery', { title: p.title })}</DialogTitle>
        <DialogDescription className="sr-only">{t('photos.ofN', { n: at + 1, count: n })}</DialogDescription>
        <div className="flex items-center gap-2 px-3 py-2.5 sm:px-5">
          <span className="text-sm tabular-nums opacity-80">{t('photos.ofN', { n: at + 1, count: n })}</span>
          {m.isCover && <span className="inline-flex items-center gap-1 rounded-full bg-background/15 px-2 py-0.5 text-xs"><Star className="size-3 fill-current" aria-hidden="true" />{t('photos.cover')}</span>}
          <span className="min-w-0 flex-1 truncate text-center text-sm opacity-80 max-sm:hidden">{p.title}</span>
          {editable && !m.isCover && <Button size="sm" variant="ghost" onClick={makeCover} className="text-background hover:bg-background/15 hover:text-background"><Star /><span className="max-sm:sr-only">{t('photos.makeCover')}</span></Button>}
          {editable && <Button size="sm" variant="ghost" onClick={remove} className="text-background hover:bg-background/15 hover:text-background"><Trash2 /><span className="max-sm:sr-only">{t('photos.remove')}</span></Button>}
          <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label={t('photos.close')} className="text-background hover:bg-background/15 hover:text-background"><X /></Button>
        </div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16">
          <img key={m.id} src={m.url} alt={t('photos.alt', { n: at + 1 })} className="max-h-full max-w-full rounded-md object-contain" />
          {n > 1 && (
            <>
              <button type="button" onClick={() => go(-1)} aria-label={t('photos.prev')} className="absolute left-2 grid size-10 place-items-center rounded-full bg-background/15 hover:bg-background/25 sm:left-4"><ChevronLeft className="size-5" /></button>
              <button type="button" onClick={() => go(1)} aria-label={t('photos.next')} className="absolute right-2 grid size-10 place-items-center rounded-full bg-background/15 hover:bg-background/25 sm:right-4"><ChevronRight className="size-5" /></button>
            </>
          )}
        </div>
        {n > 1 && (
          <div ref={thumbs} className="flex justify-center-safe gap-2 overflow-x-auto px-3 py-3 [scrollbar-width:none]">
            {photos.map((x, k) => (
              <button key={x.id} type="button" onClick={() => setI(k)} aria-current={k === at} aria-label={t('photos.openN', { n: k + 1, count: n })}
                className={cn('h-14 w-20 shrink-0 overflow-hidden rounded-md ring-2 transition-opacity', k === at ? 'opacity-100 ring-background' : 'opacity-55 ring-transparent hover:opacity-90')}>
                <img src={x.url} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
