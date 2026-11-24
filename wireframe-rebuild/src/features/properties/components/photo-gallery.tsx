/**
 * The property's photos at the top of the Overview, in one strip: the cover wider, up to three more ("+N" for the rest),
 * then an "Add photos" tile. Any photo opens the full-screen viewer (‹ › or the arrow keys, thumbnails below). Anyone adds photos (an executive
 * on a site visit too) with a real file picker — resized in the browser and kept with the demo data; managers set the
 * cover or remove a photo in the viewer.
 */
import { useEffect, useRef, useState } from 'react'
import { Camera, ChevronLeft, ChevronRight, ImagePlus, Images, Star, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useCan, useStore } from '@/store/db'
import type { Media, Property } from '@/data/types'
import { PropertyPhoto } from './property-bits'

/** The cover first, then the rest in their order. */
function orderedPhotos(p: Property): Media[] {
  const photos = p.media.filter((m) => m.kind === 'photo')
  const cover = photos.find((m) => m.isCover) ?? photos[0]
  return cover ? [cover, ...photos.filter((m) => m !== cover)] : []
}

/** Shrink a picked image to at most 1200 px wide as a JPEG data URL, so the demo can keep it in the browser. */
async function shrink(file: File): Promise<string> {
  const img = await createImageBitmap(file)
  const scale = Math.min(1, 1200 / img.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.75)
}
/** Browsers keep about 5 MB per site; stay well under it. */
const STORAGE_BUDGET = 4_500_000

/** Add photos with the file picker: `pick()` opens it; render `input` (hidden) anywhere in the component. */
export function usePhotoUpload(p: Property) {
  const { t } = useTranslation()
  const { db, updateProperty } = useStore()
  const ref = useRef<HTMLInputElement>(null)
  const count = p.media.filter((m) => m.kind === 'photo').length

  const add = async (files: FileList | null) => {
    const list = [...(files ?? [])].filter((f) => f.type.startsWith('image/'))
    if (!list.length) return
    let urls: string[]
    try { urls = await Promise.all(list.map(shrink)) } catch { toast.error(t('photos.cantRead')); return }
    if (JSON.stringify(db).length + urls.reduce((n, u) => n + u.length, 0) > STORAGE_BUDGET) { toast.error(t('photos.storageFull')); return }
    updateProperty(p.id, (x) => {
      const hasCover = x.media.some((m) => m.kind === 'photo' && m.isCover)
      urls.forEach((url, i) => x.media.push({ id: `${x.id}-ph${Date.now()}-${i}`, kind: 'photo', url, isCover: !hasCover && i === 0 }))
    }, t('history.photoAdded', { count: count + urls.length }))
    toast.success(t('photos.addedToast', { count: urls.length }))
  }
  const input = (
    <input ref={ref} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden
      onChange={(e) => { void add(e.target.files); e.target.value = '' }} />
  )
  return { pick: () => ref.current?.click(), input }
}

export function PhotoGallery({ p }: { p: Property }) {
  const { t } = useTranslation()
  const can = useCan()
  const canAdd = !p.archived
  const editable = can('property.manage') && !p.archived
  const photos = orderedPhotos(p)
  const [open, setOpen] = useState<number | null>(null)
  const upload = usePhotoUpload(p)

  if (!photos.length) {
    return (
      <div className="flex w-full items-center gap-4 rounded-xl border border-dashed bg-card p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"><Camera className="size-5" /></span>
        <span className="min-w-0 flex-1"><span className="block font-medium">{t('photos.none')}</span><span className="text-sm text-muted-foreground">{t('photos.noneHint')}</span></span>
        {canAdd && <Button size="sm" variant="outline" onClick={upload.pick}><ImagePlus /> {t('photos.add')}</Button>}
        {upload.input}
      </div>
    )
  }

  // one strip, as before: the cover wider, then up to three more ("+N" on the last), then the add tile
  const shown = photos.slice(0, 4)
  return (
    <section aria-label={t('photos.gallery', { title: p.title })}>
      <div className="flex h-44 gap-2 sm:h-52">
        {shown.map((m, i) => (
          <button key={m.id} type="button" onClick={() => setOpen(i)} aria-label={t('photos.openN', { n: i + 1, count: photos.length })}
            className={cn('group relative min-w-0 overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring',
              i === 0 ? 'flex-[1.9]' : 'flex-1', i >= 2 && 'max-sm:hidden')}>
            <PropertyPhoto type={p.type} media={m} alt={t('photos.alt', { n: i + 1, title: p.title })} iconClassName={i === 0 ? 'size-10' : 'size-7'}
              className="size-full transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
            <span className="absolute bottom-2 left-2 rounded bg-card/85 px-1.5 text-caption text-muted-foreground">{i === 0 ? t('photos.cover') : t('photos.photoN', { n: i + 1 })}</span>
            {i === 3 && photos.length > 4 && <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-xl font-semibold text-white">+{photos.length - 4}</span>}
          </button>
        ))}
        {canAdd && (
          <button type="button" onClick={upload.pick}
            className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl border border-dashed bg-card text-sm text-muted-foreground hover:bg-accent/40 hover:text-foreground">
            <ImagePlus className="size-5" /> {t('photos.add')}
          </button>
        )}
        {upload.input}
      </div>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t('photos.count', { count: photos.length })}</span>
        <button type="button" onClick={() => setOpen(0)} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          <Images className="size-4" /> {photos.length > 1 ? t('photos.viewAll', { count: photos.length }) : t('photos.view')}
        </button>
      </div>
      {open !== null && <PhotoViewer p={p} photos={photos} start={open} editable={editable} onClose={() => setOpen(null)} />}
    </section>
  )
}

/** Full-screen photo viewer: ‹ › or the arrow keys, thumbnails below; managers set the cover or remove a photo. */
function PhotoViewer({ p, photos, start, editable, onClose }: { p: Property; photos: Media[]; start: number; editable: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const { updateProperty } = useStore()
  const [i, setI] = useState(start)
  const n = photos.length
  const at = Math.min(i, n - 1)
  const m = photos[at]
  const go = (d: number) => setI((x) => (x + d + n) % n)
  const thumbs = useRef<HTMLDivElement>(null)
  useEffect(() => { thumbs.current?.querySelector('[aria-current=true]')?.scrollIntoView({ block: 'nearest', inline: 'center' }) }, [at])
  if (!m) return null

  const setCover = () => {
    updateProperty(p.id, (x) => { x.media.forEach((y) => { if (y.kind === 'photo') y.isCover = y.id === m.id }) }, t('history.coverChanged'))
    toast.success(t('photos.coverToast'))
    setI(0) // the new cover moves to the front
  }
  const remove = () => {
    const drop = () => updateProperty(p.id, (x) => {
      const wasCover = x.media.find((y) => y.id === m.id)?.isCover
      x.media = x.media.filter((y) => y.id !== m.id)
      const first = x.media.find((y) => y.kind === 'photo')
      if (wasCover && first) first.isCover = true
    }, t('history.photoRemoved'))
    // the last photo: close the viewer first, the normal way, so the page behind it is shown to screen readers again
    if (n === 1) { onClose(); setTimeout(drop, 0) } else drop()
    toast.success(t('photos.removedToast'))
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent showCloseButton={false}
        onKeyDown={(e) => { if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'ArrowRight') go(1) }}
        className="top-0 left-0 flex h-svh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-black/95 p-0 text-white ring-0 sm:max-w-none">
        <DialogTitle className="sr-only">{t('photos.gallery', { title: p.title })}</DialogTitle>
        <DialogDescription className="sr-only">{t('photos.ofN', { n: at + 1, count: n })}</DialogDescription>

        <div className="flex items-center gap-2 px-3 py-2.5 sm:px-5">
          <span className="text-sm tabular-nums text-white/80">{t('photos.ofN', { n: at + 1, count: n })}</span>
          {m.isCover && <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs"><Star className="size-3 fill-current" /> {t('photos.cover')}</span>}
          <span className="min-w-0 flex-1 truncate text-center text-sm text-white/80 max-sm:hidden">{p.title}</span>
          {editable && !m.isCover && (
            <Button size="sm" variant="ghost" onClick={setCover} className="text-white hover:bg-white/15 hover:text-white"><Star /> <span className="max-sm:sr-only">{t('photos.setCover')}</span></Button>
          )}
          {editable && (
            <Button size="sm" variant="ghost" onClick={remove} className="text-white hover:bg-white/15 hover:text-white"><Trash2 /> <span className="max-sm:sr-only">{t('photos.remove')}</span></Button>
          )}
          <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label={t('photos.close')} className="text-white hover:bg-white/15 hover:text-white"><X /></Button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16">
          <PropertyPhoto key={m.id} type={p.type} media={m} alt={t('photos.alt', { n: at + 1, title: p.title })}
            className={m.url ? 'max-h-full max-w-full rounded-md object-contain' : 'size-56 rounded-xl'} iconClassName="size-16" />
          {n > 1 && (
            <>
              <button type="button" onClick={() => go(-1)} aria-label={t('photos.prev')}
                className="absolute left-2 grid size-10 place-items-center rounded-full bg-white/15 hover:bg-white/25 sm:left-4"><ChevronLeft className="size-5" /></button>
              <button type="button" onClick={() => go(1)} aria-label={t('photos.next')}
                className="absolute right-2 grid size-10 place-items-center rounded-full bg-white/15 hover:bg-white/25 sm:right-4"><ChevronRight className="size-5" /></button>
            </>
          )}
        </div>

        {n > 1 && (
          <div ref={thumbs} className="flex justify-center-safe gap-2 overflow-x-auto px-3 py-3 [scrollbar-width:none]">
            {photos.map((x, k) => (
              <button key={x.id} type="button" onClick={() => setI(k)} aria-current={k === at} aria-label={t('photos.openN', { n: k + 1, count: n })}
                className={cn('h-14 w-20 shrink-0 overflow-hidden rounded-md ring-2 transition-opacity', k === at ? 'opacity-100 ring-white' : 'opacity-55 ring-transparent hover:opacity-90')}>
                <PropertyPhoto type={p.type} media={x} alt="" className="size-full" iconClassName="size-5" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
