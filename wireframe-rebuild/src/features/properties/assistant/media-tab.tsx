import { useState, type DragEvent } from 'react'
import { Film, ImagePlus, Play, Star, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { SectionCard } from '@/components/app/section-card'
import { StatusChip } from '@/components/app/status-chip'
import type { Property } from '@/data/types'
import { cn } from '@/lib/utils'
import { useStore } from '@/store/db'
import { PropertyPhoto } from '../components/property-bits'
import { usePhotoUpload } from '../components/photo-gallery'

/**
 * The drawer's Media tab: photos (the first is the cover) and videos. Photos are real files, picked or dropped,
 * kept with the demo data as on the property page. A video is simulated.
 */
export function MediaTab({ p, canWrite }: { p: Property; canWrite: boolean }) {
  const { t } = useTranslation()
  const { updateProperty } = useStore()
  const upload = usePhotoUpload(p)
  const [over, setOver] = useState(false)
  const photos = p.media.filter((m) => m.kind === 'photo')
  const videos = p.media.filter((m) => m.kind === 'video')

  const drop = (e: DragEvent) => { e.preventDefault(); setOver(false); if (canWrite) void upload.add(e.dataTransfer.files) }
  const dragOver = (e: DragEvent) => { if (canWrite) { e.preventDefault(); setOver(true) } }
  const remove = (id: string, kind: 'photo' | 'video') => {
    updateProperty(p.id, (x) => {
      const wasCover = x.media.find((m) => m.id === id)?.isCover
      x.media = x.media.filter((m) => m.id !== id)
      const first = x.media.find((m) => m.kind === 'photo')
      if (wasCover && first) first.isCover = true
    }, t(kind === 'photo' ? 'history.photoRemoved' : 'history.videoRemoved'))
    toast.success(t(kind === 'photo' ? 'photos.removedToast' : 'drawer.videoRemoved'))
  }
  const addVideo = () => {
    updateProperty(p.id, (x) => { x.media.push({ id: `${x.id}-vid${Date.now()}`, kind: 'video', url: '' }) }, t('history.videoAdded'))
    toast.success(t('drawer.videoAdded'))
  }
  const cover = photos.find((m) => m.isCover) ?? photos[0]
  const ordered = cover ? [cover, ...photos.filter((m) => m !== cover)] : []

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title={<span className="flex items-center gap-2">{t('drawer.photos')} <StatusChip tone="neutral">{photos.length}</StatusChip></span>}
        action={canWrite && <Button size="sm" variant="outline" onClick={upload.pick}><ImagePlus /> {t('photos.add')}</Button>}>
        {upload.input}
        <div onDragOver={dragOver} onDragLeave={() => setOver(false)} onDrop={drop} className={cn('rounded-lg', over && 'ring-2 ring-primary ring-offset-2')}>
          {ordered.length ? (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ordered.map((m, i) => (
                <li key={m.id} className="group relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                  <PropertyPhoto type={p.type} media={m} alt={t('photos.photoN', { n: i + 1 })} className="size-full" iconClassName="size-7" />
                  <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded bg-card/85 px-1.5 text-caption text-muted-foreground">
                    {i === 0 ? <><Star className="size-3 fill-current" /> {t('photos.cover')}</> : t('photos.photoN', { n: i + 1 })}
                  </span>
                  {canWrite && (
                    <button type="button" onClick={() => remove(m.id, 'photo')} aria-label={t('drawer.removePhoto', { n: i + 1 })} title={t('photos.remove')}
                      className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-card/90 text-muted-foreground shadow-sm hover:text-danger"><X className="size-3.5" /></button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <button type="button" disabled={!canWrite} onClick={upload.pick}
              className="flex min-h-36 w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground hover:bg-accent/40 disabled:cursor-default">
              <ImagePlus className="size-6" />
              <span className="font-medium text-foreground">{t('drawer.drop')}</span>
              <span className="text-meta">{t('drawer.dropHint')}</span>
            </button>
          )}
        </div>
      </SectionCard>

      <SectionCard title={<span className="flex items-center gap-2">{t('drawer.videos')} <StatusChip tone="neutral">{videos.length}</StatusChip></span>}
        action={canWrite && <Button size="sm" variant="outline" onClick={addVideo}><Film /> {t('drawer.addVideo')}</Button>}>
        {videos.length ? (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {videos.map((m, i) => (
              <li key={m.id} className="relative flex aspect-video items-center justify-center gap-1.5 rounded-lg bg-muted text-sm text-muted-foreground">
                <Play className="size-4" /> {t('drawer.video', { n: i + 1 })}
                {canWrite && (
                  <button type="button" onClick={() => remove(m.id, 'video')} aria-label={t('drawer.removeVideo', { n: i + 1 })} title={t('photos.remove')}
                    className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-card/90 shadow-sm hover:text-danger"><X className="size-3.5" /></button>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">{t('drawer.noVideos')}</p>}
      </SectionCard>
    </div>
  )
}
