/**
 * Labels for catalogue values, always through i18n: `fact.<key>`, `type.<key>`, `status.<key>` …
 * A key missing in a language falls back to the catalogue's English label, so a new fact added in Settings shows at once.
 */
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { PROPERTY_TYPES, type FactDef } from '@/data/catalogue'
import type { Property, SpecValue } from '@/data/types'
import { inr, num, sqft } from './format'

const ALL_FACTS = Object.values(PROPERTY_TYPES).flatMap((d) => d.facts)
const catalogueLabel = (key: string) => ALL_FACTS.find((f) => f.key === key)?.label ?? key

export function useLabels() {
  const { t } = useTranslation()
  const fact = useCallback((key: string, fallback?: string) => t(`fact.${key}`, { defaultValue: fallback ?? catalogueLabel(key) }), [t])
  const factValue = useCallback(
    (def: FactDef, v: SpecValue | undefined): string => {
      if (v === '' || v == null) return ''
      // the unit is part of the label, as in the current wireframe ("Length (ft)" → "50"); rupee fields show as ₹ amounts
      if (def.kind === 'number') return def.money ? inr(Number(v)) : num(Number(v))
      return String(v)
    },
    [],
  )
  /** The one-line summary under a card's price: "2 BHK · 3rd floor · 1,050 sq.ft." */
  const keyFacts = useCallback(
    (p: Property): string[] => {
      const s = p.specs
      const bits: string[] = []
      if (p.type === 'plot' && s.length && s.width) bits.push(`${s.length} × ${s.width} ft`)
      if (p.type === 'flat') {
        if (s.bhk) bits.push(String(s.bhk))
        if (s.floor != null && s.floor !== '') bits.push(t('card.floor', { n: s.floor }))
      }
      if (p.type === 'house') {
        if (s.bedrooms) bits.push(t('card.bedrooms', { n: s.bedrooms }))
        if (s.subType) bits.push(String(s.subType).replace(/\s*\(.*\)/, ''))
      }
      if (p.type === 'commercial' && s.commCategory) bits.push(String(s.commCategory))
      bits.push(sqft(p.areaSqft))
      return bits
    },
    [t],
  )
  return {
    t,
    type: (k: Property['type']) => t(`type.${k}`, { defaultValue: PROPERTY_TYPES[k].label }),
    status: (k: Property['status']) => t(`status.${k}`),
    purpose: (k: Property['purpose']) => t(`purpose.${k}`),
    facing: (k: NonNullable<Property['facing']>) => t(`facing.${k}`),
    fact,
    factValue,
    keyFacts,
  }
}
