import { describe, expect, it } from 'vitest'
import type { Media } from '@/domain/types'
import { MAX_PHOTOS, PHOTO_BUDGET_BYTES, addPhotos, checkPhotoBudget, dataUrlBytes, fitWithin, orderedPhotos, removeMedia, setCover } from './image'

const photo = (id: string, isCover = false, url = `/demo-photos/${id}.jpg`): Media => ({ id, kind: 'photo', url, isCover })

describe('property photos', () => {
  it('scales the longer side to 1600 px and never up', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(1200, 4800)).toEqual({ width: 400, height: 1600 })
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
    expect(fitWithin(0, 600)).toEqual({ width: 0, height: 0 })
  })

  it('counts only uploaded (data URL) bytes', () => {
    expect(dataUrlBytes('/demo-photos/a.jpg')).toBe(0)
    expect(dataUrlBytes('data:image/jpeg;base64,AAAA')).toBe(27)
  })

  it('refuses more than 8 photos and more than the storage budget', () => {
    const seven = Array.from({ length: 7 }, (_, i) => photo(`p${i}`))
    expect(checkPhotoBudget(seven, ['data:x'], 0)).toEqual({ ok: true })
    expect(checkPhotoBudget(seven, ['data:x', 'data:y'], 0)).toEqual({ ok: false, reason: 'count', room: MAX_PHOTOS - 7 })
    expect(checkPhotoBudget([], ['data:x'], PHOTO_BUDGET_BYTES)).toEqual({ ok: false, reason: 'storage', room: MAX_PHOTOS })
  })

  it('keeps exactly one cover', () => {
    const added = addPhotos([], ['data:a', 'data:b'], 'new')
    expect(added.filter((m) => m.isCover).map((m) => m.id)).toEqual(['new-0'])
    const covered = setCover(added, 'new-1')
    expect(covered.filter((m) => m.isCover).map((m) => m.id)).toEqual(['new-1'])
    expect(orderedPhotos(covered).map((m) => m.id)).toEqual(['new-1', 'new-0'])
    const removed = removeMedia(covered, 'new-1')
    expect(removed).toHaveLength(1)
    expect(removed[0].isCover).toBe(true)
    expect(addPhotos([photo('a', true)], ['data:z'], 'n')[1].isCover).toBe(false)
  })
})
