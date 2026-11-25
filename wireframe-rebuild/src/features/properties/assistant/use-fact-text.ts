import { useCallback } from 'react'
import { PROPERTY_TYPES } from '@/data/catalogue'
import type { PropertyTypeKey } from '@/data/types'
import type { Fact } from '@/lib/assistant'
import { inrShort, sqft } from '@/lib/format'
import { useLabels } from '@/lib/labels'
import { useStore } from '@/store/db'

const ALL_FACTS = Object.values(PROPERTY_TYPES).flatMap((d) => d.facts)

/** Label and display value for any assistant fact (a core field or `spec:<key>`), in the current language. */
export function useFactText() {
  const L = useLabels()
  const { t } = L
  const { db } = useStore()

  const approval = useCallback(
    (id: string) => t(`approval.${id}`, { defaultValue: db.settings.approvalTypes.find((a) => a.id === id)?.label ?? id }),
    [t, db.settings.approvalTypes],
  )

  /** `type` gives the area its proper name ("Plot area", "Built-up area"). */
  const label = useCallback(
    (key: string, type?: PropertyTypeKey) => {
      if (key.startsWith('spec:')) return L.fact(key.slice(5), db.settings.extraFacts?.find((f) => f.key === key.slice(5))?.label)
      if (key === 'area') return type ? t(`fact.area_${PROPERTY_TYPES[type].areaBasis}`) : t('fact.area')
      if (key === 'type') return t('assistant.field.type')
      if (key === 'exactLocation') return t('assistant.field.exactLocation')
      if (key === 'approvals') return t('assistant.field.approvals')
      if (key === 'amenities') return t('overview.amenities')
      if (key === 'status') return t('table.status')
      if (key === 'description') return t('assistant.field.description')
      return t(`fact.${key}`)
    },
    [L, t, db.settings.extraFacts],
  )

  const value = useCallback(
    (key: string, v: unknown, type?: PropertyTypeKey): string => {
      if (v === undefined || v === null || v === '') return ''
      switch (key) {
        case 'purpose': return L.purpose(v as never)
        case 'type': return L.type(v as never)
        case 'price': return inrShort(v as number)
        case 'area': return sqft(v as number)
        case 'facing': return L.facing(v as never)
        case 'status': return t(`status.${v}`)
        case 'exactLocation': return v ? t('assistant.exactSet') : ''
        case 'approvals': return (v as string[]).map(approval).join(', ')
        case 'amenities': return (v as string[]).map((a) => t(`amenity.${a}`, { defaultValue: a })).join(', ')
      }
      if (key.startsWith('spec:')) {
        const k = key.slice(5)
        const def = (type && PROPERTY_TYPES[type].facts.find((f) => f.key === k)) || ALL_FACTS.find((f) => f.key === k)
        return def ? L.factValue(def, v as never) : String(v)
      }
      return String(v)
    },
    [L, t, approval],
  )

  const note = useCallback((f: Fact) => (f.note ? t(`assistant.note.${f.note.k}`, f.note.v ?? {}) : ''), [t])

  /** "Type, City, Locality and 3 more" */
  const list = useCallback(
    (labels: string[], max = 3) =>
      labels.length <= max ? labels.join(', ') : t('assistant.andMore', { list: labels.slice(0, max).join(', '), count: labels.length - max }),
    [t],
  )

  return { label, value, note, approval, list }
}
