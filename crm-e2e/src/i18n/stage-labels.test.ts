import { describe, expect, it } from 'vitest'
import i18n, { applyStageLabels } from '@/i18n'

describe('applyStageLabels (Settings → Pipeline renames)', () => {
  it('shows a custom stage name in every language and restores the catalogue name when cleared', () => {
    const before = i18n.t('catalogue:stage.negotiation', { lng: 'en' })
    expect(applyStageLabels([{ key: 'negotiation', label: 'Price talks' }])).toBe(true)
    expect(i18n.t('catalogue:stage.negotiation', { lng: 'en' })).toBe('Price talks')
    expect(i18n.t('catalogue:stageShort.negotiation', { lng: 'ta' })).toBe('Price talks')
    expect(applyStageLabels([{ key: 'negotiation', label: 'Price talks' }])).toBe(false)
    applyStageLabels([{ key: 'negotiation', label: '  ' }])
    expect(i18n.t('catalogue:stage.negotiation', { lng: 'en' })).toBe(before)
  })
})
