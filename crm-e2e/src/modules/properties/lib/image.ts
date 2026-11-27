/**
 * Property photos kept with the demo data (Known limitation K3): each picked image is scaled to at most 1600 px on its
 * longer side and stored as a JPEG data URL; at most 8 photos per property and about 4 MB of uploaded photos in total.
 * Ported from wireframe-rebuild/src/features/properties/components/photo-gallery.tsx (`shrink`, storage budget),
 * with the limits of foundation-plan §8.3. `fitWithin`, `dataUrlBytes` and `checkPhotoBudget` are pure and tested.
 */
import type { Media } from '@/domain/types'

export const MAX_PHOTOS = 8
export const MAX_SIDE_PX = 1600
export const JPEG_QUALITY = 0.78
/** Browsers keep about 5 MB per site; uploaded photos stay under 4 MB so the rest of the demo data still fits. */
export const PHOTO_BUDGET_BYTES = 4_000_000
export const MAX_FILE_MB = 15

/** Scales (w, h) down so the longer side is at most `max`; never scales up. */
export function fitWithin(w: number, h: number, max = MAX_SIDE_PX): { width: number; height: number } {
  if (w <= 0 || h <= 0) return { width: 0, height: 0 }
  const scale = Math.min(1, max / Math.max(w, h))
  return { width: Math.round(w * scale), height: Math.round(h * scale) }
}

/** Bytes a data URL takes in storage (its length; base64 is ASCII). Static photos (/demo-photos/…) count 0. */
export const dataUrlBytes = (url: string) => (url.startsWith('data:') ? url.length : 0)

export const mediaBytes = (media: Pick<Media, 'url'>[]) => media.reduce((n, m) => n + dataUrlBytes(m.url), 0)

export type BudgetCheck = { ok: true } | { ok: false; reason: 'count' | 'storage'; room: number }

/**
 * Can these new photos be added? `existing` are the photos already on this property (form state), `otherBytes` the
 * uploaded photos stored on every other property.
 */
export function checkPhotoBudget(existing: Pick<Media, 'url' | 'kind'>[], incomingUrls: string[], otherBytes: number): BudgetCheck {
  const photos = existing.filter((m) => m.kind === 'photo').length
  const room = Math.max(0, MAX_PHOTOS - photos)
  if (incomingUrls.length > room) return { ok: false, reason: 'count', room }
  const total = otherBytes + mediaBytes(existing) + incomingUrls.reduce((n, u) => n + dataUrlBytes(u), 0)
  if (total > PHOTO_BUDGET_BYTES) return { ok: false, reason: 'storage', room }
  return { ok: true }
}

/** Makes `id` the cover (exactly one photo is the cover). */
export function setCover(media: Media[], id: string): Media[] {
  return media.map((m) => (m.kind === 'photo' ? { ...m, isCover: m.id === id } : m))
}

/** Removes a photo; if it was the cover, the next photo becomes the cover. */
export function removeMedia(media: Media[], id: string): Media[] {
  const gone = media.find((m) => m.id === id)
  const rest = media.filter((m) => m.id !== id)
  if (gone?.isCover) {
    const first = rest.find((m) => m.kind === 'photo')
    if (first) return rest.map((m) => (m === first ? { ...m, isCover: true } : m))
  }
  return rest
}

/** Adds photos; the first becomes the cover when there is none yet. */
export function addPhotos(media: Media[], urls: string[], idBase: string): Media[] {
  const hasCover = media.some((m) => m.kind === 'photo' && m.isCover)
  return [...media, ...urls.map((url, i) => ({ id: `${idBase}-${i}`, kind: 'photo' as const, url, isCover: !hasCover && i === 0 }))]
}

/** The cover first, then the other photos in their order. */
export function orderedPhotos(media: Media[]): Media[] {
  const photos = media.filter((m) => m.kind === 'photo')
  const cover = photos.find((m) => m.isCover) ?? photos[0]
  return cover ? [cover, ...photos.filter((m) => m !== cover)] : []
}

/* ---------- browser only ---------- */

/** Reads an image file and returns a compressed JPEG data URL (≤ 1600 px). Throws when the file is not a readable image. */
export async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = fitWithin(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}
