import { describe, expect, it } from 'vitest'
import { DEFAULT_TEMPLATES } from '@/domain/catalogue'
import { shareMessage } from './whatsapp'

const prop = (title: string) => ({ title, price: 12_000_000, location: { locality: 'Whitefield', city: 'Bengaluru' } }) as Parameters<typeof shareMessage>[1][number]

describe('shareMessage', () => {
  it('reads "here is 1 option" for a single property with the stored template', () => {
    const text = shareMessage({ name: 'Rahul Verma' }, [prop('Prestige Lakeside 3BHK')], { templates: DEFAULT_TEMPLATES })
    expect(text).toContain('here is 1 option that')
    expect(text).not.toContain('1 options')
  })
  it('keeps the plural for several properties', () => {
    const text = shareMessage({ name: 'Rahul Verma' }, [prop('A'), prop('B')], { templates: DEFAULT_TEMPLATES })
    expect(text).toContain('here are 2 options')
  })
  it('Hinglish template has no "1 options" either', () => {
    const text = shareMessage({ name: 'Rahul Verma' }, [prop('A')], { templates: DEFAULT_TEMPLATES, tone: 'hinglish' })
    expect(text).toContain('1 option ')
  })
})
