/**
 * The review form shared by inline row fixing, document extraction and drafts: one input per field, as text the
 * import readers understand ("85 L", "1,200 sq ft", "Ground"), so a value typed here is checked exactly like a sheet
 * cell. AI-filled fields carry the ✦ marker (AIField); low-confidence values are highlighted "Please check"; each
 * field shows its own problem from the row check.
 */
import { useId } from 'react'
import { AlertCircle, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AIField, AIFieldMarker } from '@/components/ai/ai-field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { FieldMeta, FieldMetaMap } from '@/domain/types'
import {
  CITIES, CITY_NAMES, CONFIGURATIONS, FACINGS, LEAD_SOURCES, PROPERTY_TYPE_ORDER, TIMELINES,
} from '@/domain/catalogue'
import { inrShort } from '@/lib/format'
import { cn } from '@/lib/utils'
import { LEAD_FORM_FIELDS, fieldDef, propertyFieldsFor } from '../lib/fields'
import type { Issue } from '../lib/rows'
import { LOW_CONFIDENCE } from '../lib/stats'
import { isOk, readArea, readPrice, readPropertyType } from '../lib/values'

const NONE = '__none'
type Choice = { value: string; label: string }

const WIDE = new Set(['notes', 'description', 'title', 'location.address'])

export function RecordForm({ kind, values, onChange, meta = {}, issues = [], fields, className, idPrefix }: {
  kind: 'lead' | 'property'
  values: Record<string, string>
  onChange: (field: string, value: string) => void
  meta?: FieldMetaMap
  issues?: Issue[]
  /** Limit to these fields (inline row fixing shows only the ones with a problem). */
  fields?: string[]
  className?: string
  idPrefix?: string
}) {
  const { t } = useTranslation(['import', 'catalogue'])
  const auto = useId()
  const prefix = idPrefix ?? auto
  const typeRead = readPropertyType(values.type ?? '')
  const type = isOk(typeRead) ? typeRead.ok : undefined
  const list = fields ?? (kind === 'lead' ? [...LEAD_FORM_FIELDS] : propertyFieldsFor(type))
  const city = values['location.city'] || values['requirement.cities']?.split(',')[0]?.trim()

  const choices = (field: string): Choice[] | null => {
    switch (field) {
      case 'source': return LEAD_SOURCES.map((v) => ({ value: v, label: t(`catalogue:source.${v}`) }))
      case 'type': return PROPERTY_TYPE_ORDER.map((v) => ({ value: v, label: t(`catalogue:propertyType.${v}`) }))
      case 'configuration': return CONFIGURATIONS.map((v) => ({ value: v, label: v.replace('BHK', ' BHK') }))
      case 'facing': return FACINGS.map((v) => ({ value: v, label: t(`catalogue:facing.${v}`) }))
      case 'possession.status': return (['ready', 'underConstruction'] as const).map((v) => ({ value: v, label: t(`catalogue:possession.${v}`) }))
      case 'transaction': return (['newBooking', 'resale'] as const).map((v) => ({ value: v, label: t(`catalogue:transaction.${v}`) }))
      case 'qualification.timeline': return TIMELINES.map((v) => ({ value: v, label: t(`catalogue:timeline.${v}`) }))
      default: return null
    }
  }

  return (
    <div className={cn('grid gap-x-4 gap-y-3 sm:grid-cols-2', className)}>
      {list.map((field) => {
        const id = `${prefix}-${field.replace(/\./g, '-')}`
        const m: FieldMeta | undefined = meta[field]
        const low = !!m && m.origin !== 'manual' && (m.confidence ?? 1) < LOW_CONFIDENCE
        const own = issues.filter((i) => i.field === field || (field.startsWith('area.') && i.field === 'area.any'))
        const err = own.find((i) => i.level !== 'warning')
        const warn = own.find((i) => i.level === 'warning')
        const value = values[field] ?? ''
        const opts = choices(field)
        const kindOf = fieldDef(field)?.value
        const hintId = `${id}-hint`
        const set = (v: string) => onChange(field, v)
        let control
        if (opts) {
          // a value the list does not know (an imported spelling) is kept as typed until the user picks one
          const known = opts.some((o) => o.value === value)
          control = (
            <Select value={known ? value : NONE} onValueChange={(v) => set(v === NONE ? '' : v)}>
              <SelectTrigger id={id} aria-invalid={!!err || undefined} aria-describedby={err || warn || low ? hintId : undefined} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{value && !known ? t('import:form.keepTyped', { value }) : t('import:form.notSet')}</SelectItem>
                {opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )
        } else if (field === 'notes' || field === 'description') {
          control = <Textarea id={id} value={value} onChange={(e) => set(e.target.value)} rows={3} aria-describedby={hintId} />
        } else {
          const list = field.endsWith('city') || field === 'requirement.cities' ? `${prefix}-cities` : field.endsWith('ocality') || field === 'requirement.localities' ? `${prefix}-localities` : undefined
          control = (
            <Input
              id={id} value={value} onChange={(e) => set(e.target.value)} list={list} aria-invalid={!!err || undefined}
              aria-describedby={err || warn || low || kindOf === 'price' || kindOf === 'area' ? hintId : undefined}
              placeholder={kindOf === 'price' ? t('import:form.pricePlaceholder') : kindOf === 'area' ? t('import:form.areaPlaceholder') : kindOf === 'phone' ? '98450 12345' : undefined}
              inputMode={kindOf === 'phone' ? 'tel' : undefined}
              className={cn(err && 'border-danger shadow-[0_0_0_3px_var(--danger-soft)]')}
            />
          )
        }
        const price = kindOf === 'price' && value ? readPrice(value) : null
        const area = kindOf === 'area' && value ? readArea(value) : null
        return (
          <AIField key={field} meta={m} className={cn(WIDE.has(field) && 'sm:col-span-2', low && m?.origin !== 'ai' && '-mx-2 rounded-md bg-warning-soft/50 px-2 py-1.5')}>
            <div className="flex flex-col gap-1.5" data-field={field} data-low={low || undefined}>
              <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-medium">
                {t(`import:field.${field}`)}
                {fieldDef(field)?.required && <span className="text-meta font-normal text-muted-foreground">{t('import:form.required')}</span>}
                <AIFieldMarker meta={m} />
              </label>
              {control}
              <p id={hintId} className={cn('min-h-0 text-xs', err ? 'text-danger' : warn || low ? 'text-warning' : 'text-muted-foreground')}>
                {err ? <span className="inline-flex items-center gap-1"><AlertCircle className="size-3" aria-hidden="true" />{t(`import:issue.${err.key}`, err.params ?? {})}</span>
                  : warn ? <span className="inline-flex items-center gap-1"><TriangleAlert className="size-3" aria-hidden="true" />{t(`import:issue.${warn.key}`, warn.params ?? {})}</span>
                    : low ? <span className="inline-flex items-center gap-1"><TriangleAlert className="size-3" aria-hidden="true" />{t('import:form.pleaseCheck', { pct: Math.round((m?.confidence ?? 0) * 100) })}</span>
                      : price && isOk(price) ? t('import:form.reads', { value: inrShort(price.ok) })
                        : area && isOk(area) ? t('import:form.readsArea', { value: area.ok.sqft.toLocaleString('en-IN') }) : null}
              </p>
            </div>
          </AIField>
        )
      })}
      <datalist id={`${prefix}-cities`}>{CITY_NAMES.map((c) => <option key={c} value={c} />)}</datalist>
      <datalist id={`${prefix}-localities`}>{(city && CITIES[city] ? CITIES[city] : Object.values(CITIES).flat()).map((l) => <option key={l} value={l} />)}</datalist>
    </div>
  )
}
