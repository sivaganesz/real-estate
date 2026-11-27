import { describe, expect, it } from 'vitest'
import { resources } from './index'

type Tree = { [k: string]: string | Tree }
const keys = (o: Tree, prefix = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`)))
const vars = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort().join(',')

describe('locales', () => {
  const en = resources.en as Record<string, Tree>
  const ta = resources.ta as Record<string, Tree>

  it('has the same namespaces in English and Tamil', () => {
    expect(Object.keys(ta).sort()).toEqual(Object.keys(en).sort())
  })

  for (const ns of Object.keys(en)) {
    it(`${ns}: Tamil has every English key with the same placeholders`, () => {
      const enKeys = keys(en[ns])
      expect(keys(ta[ns]).sort()).toEqual([...enKeys].sort())
      const get = (o: Tree, k: string) => k.split('.').reduce<string | Tree>((acc, p) => (acc as Tree)[p], o) as string
      for (const k of enKeys) expect(vars(get(ta[ns], k)), `${ns}:${k}`).toBe(vars(get(en[ns], k)))
    })
  }
})
