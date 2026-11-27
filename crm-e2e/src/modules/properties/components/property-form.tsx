/**
 * Add / Edit property (master prompt §13, plan §8.3 M3): one dynamic form whose sections follow the property family
 * (flat, house, plot, land, commercial, warehouse) and cover every master prompt field: area triple, plot dimensions,
 * facing, corner, floor, rooms, parking, furnishing, amenities, possession and date, RERA, approvals, khata / patta,
 * bank approvals, owner / builder, commission, family specs, photos. ₹ / sq ft is computed as you type.
 *
 * Manual and AI side by side (§12.0): paste-and-fill or voice fills the same form, marks the AI fields and asks only the
 * missing essentials; nothing is saved until the user clicks Save. Smart required: title or configuration, type,
 * city, locality, price, area. The type's own extras (floor for flats, road width for plots) are recommended, not blocking.
 */
import { memo, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Building2, Camera, CircleAlert, FileCheck2, IndianRupee, Landmark, LayoutGrid, Loader2, MapPin, Plus, Ruler, Sparkles, UserRound, Wand2, X,
} from 'lucide-react'
import type { Extraction } from '@/ai/types'
import { paths } from '@/app/paths'
import { AIField, AIFieldMarker } from '@/components/ai/ai-field'
import { EffortSaved } from '@/components/ai/effort-saved'
import { ModuleAssistant } from '@/components/ai/module-assistant'
import { useAIFields } from '@/components/ai/use-ai-fields'
import { AmountInput } from '@/components/shared/amount-input'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Chip } from '@/components/shared/chip'
import { FormField } from '@/components/shared/form-field'
import { PhoneInput } from '@/components/shared/phone-input'
import { ProgressRing } from '@/components/shared/progress-ring'
import { SectionCard } from '@/components/shared/section-card'
import { Segmented } from '@/components/shared/segmented'
import { toastError } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  AMENITIES, APPROVAL_AUTHORITIES, AREA_UNITS, BANKS, CITIES, CITY_NAMES, CONFIGURATIONS, FACINGS, FURNISHING, LISTING_STATES,
  PROPERTY_FAMILIES, PROPERTY_STATUSES, PROPERTY_TYPES, PROPERTY_TYPE_ORDER, categoryOf, cityOfLocality, type FactDef,
} from '@/domain/catalogue'
import type { FieldMeta, ID, Property, PropertyArea, PropertyInput, PropertyType } from '@/domain/types'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { localDay } from '@/lib/dates'
import { inr, inrShort, num } from '@/lib/format'
import { configLabel } from '@/lib/matching'
import { listingScore, missingRequired } from '@/lib/property'
import { scoreTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { ValidationError, validateProperty, type FieldError } from '@/lib/validation'
import { mapsLink } from '@/lib/whatsapp'
import { createProperty, replaceProperty } from '@/services/properties'
import { mediaBytes } from '../lib/image'
import { cleanForSave, familyShows, formAreaSqft, formPricePerSqft, mergeExtraction, pickExtracted, setPath, suggestTitle, type FormSection } from '../lib/form'
import { PhotoManager } from './photo-manager'

const DOC_STATUSES = ['pending', 'uploaded', 'verified'] as const
const OWNER_KINDS = ['builder', 'owner', 'channelPartner'] as const
const AREA_ICONS: Record<keyof PropertyArea, true | undefined> = { carpet: true, builtUp: true, superBuiltUp: true, plot: true, plotLengthFt: true, plotWidthFt: true, plotUnit: undefined }

/** Label + control + AI marker; defined outside the form so inputs keep focus between renders. */
const PF = memo(function PF({ path, meta, label, required, optional, hint, error, className, children }: {
  path: string
  meta?: FieldMeta
  label: ReactNode
  required?: boolean
  optional?: boolean
  hint?: ReactNode
  error?: string
  className?: string
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
}) {
  return (
    <AIField meta={meta} className={className}>
      <FormField id={`pf-${path}`} label={label} required={required} optional={optional} hint={hint} error={error} labelEnd={<AIFieldMarker meta={meta} />}>
        {children}
      </FormField>
    </AIField>
  )
})

const numOrUndef = (v: string) => (v.trim() === '' ? undefined : Math.max(0, Number(v)))

function NumberInput({ value, onChange, id, describedBy, invalid, suffix, step }: { value: number | undefined; onChange: (v: number | undefined) => void; id: string; describedBy?: string; invalid?: boolean; suffix?: string; step?: string }) {
  return (
    <span className="flex">
      <Input
        id={id} type="number" inputMode="decimal" min={0} step={step ?? 'any'} value={value ?? ''} aria-describedby={describedBy} aria-invalid={invalid || undefined}
        onChange={(e) => onChange(numOrUndef(e.target.value))} className={cn('min-w-0 tabular-nums', suffix && 'rounded-r-none')}
      />
      {suffix && <span className="inline-flex h-9 shrink-0 items-center rounded-r-sm border border-l-0 border-input bg-muted px-2.5 text-meta text-muted-foreground">{suffix}</span>}
    </span>
  )
}

export function PropertyForm({ initial, propertyId, initialMeta }: { initial: PropertyInput; propertyId?: ID; initialMeta?: Property['fieldMeta'] }) {
  const { t } = useTranslation(['properties', 'catalogue', 'common', 'ai'])
  const navigate = useNavigate()
  const user = useCurrentUser()
  const now = useNow()
  const otherBytes = useDb((db) => db.properties.filter((p) => p.id !== propertyId).reduce((n, p) => n + mediaBytes(p.media), 0))
  const ai = useAIFields(initialMeta ? Object.fromEntries(Object.entries(initialMeta).filter(([, m]) => m.origin === 'ai')) : {})
  const [form, setForm] = useState<PropertyInput>(initial)
  const [errors, setErrors] = useState<FieldError[]>([])
  const [answered, setAnswered] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [newApproval, setNewApproval] = useState<string>('')
  const editing = !!propertyId
  const def = PROPERTY_TYPES[form.type]
  const shows = (s: FormSection) => familyShows(form.type, s)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)

  const set = (path: string, value: unknown) => {
    setForm((f) => setPath(f, path, value))
    ai.clear(path)
    if (errors.length) setErrors((e) => e.filter((x) => x.field !== path && !(path.startsWith('area') && x.field === 'area')))
  }
  const err = (...fields: string[]) => {
    const e = errors.find((x) => fields.includes(x.field))
    return e ? t(`common:validation.${e.key}`, e.params ?? {}) : undefined
  }

  const preview = useMemo(() => cleanForSave(form), [form])
  const asProperty: Property = useMemo(() => ({
    ...preview, id: propertyId ?? 'new', category: categoryOf(preview.type), createdBy: user.id, createdAt: now.toISOString(), updatedAt: now.toISOString(),
  }), [preview, propertyId, user.id, now])
  const recommended = missingRequired(asProperty).filter((k) => !['title', 'type', 'city', 'locality', 'price', 'area'].includes(k))
  const score = listingScore(asProperty).score
  const ppsf = formPricePerSqft(form)
  const area = formAreaSqft(form)

  const fill = (x: Extraction<PropertyInput>) => {
    const fields = editing ? pickExtracted(x.fields, x.meta, ['title']) : x.fields
    setForm((f) => mergeExtraction(f, fields))
    ai.apply(editing ? Object.fromEntries(Object.entries(x.meta).filter(([k]) => k !== 'title')) : x.meta)
    setErrors([])
  }
  const answer = (field: string, value: unknown) => {
    setForm((f) => setPath(f, field, value))
    setAnswered((s) => new Set(s).add(field))
  }
  const focusField = (field: string) => {
    const el = document.getElementById(`pf-${field === 'area' ? `area.${def.areaFields[0]}` : field}`)
    el?.focus()
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  const changeType = (type: PropertyType) => {
    setForm((f) => ({ ...f, type }))
    ai.clear('type')
  }
  const changeCity = (city: string) => {
    setForm((f) => ({ ...f, location: { ...f.location, city, locality: CITIES[city]?.includes(f.location.locality) ? f.location.locality : '' } }))
    ai.clear('location.city')
  }
  const changeLocality = (locality: string) => {
    const city = cityOfLocality(locality)
    setForm((f) => ({ ...f, location: { ...f.location, locality, city: city ?? f.location.city } }))
    ai.clear('location.locality')
  }
  const toggleIn = (path: 'amenities' | 'bankApprovals', v: string) => {
    setForm((f) => ({ ...f, [path]: f[path].includes(v) ? f[path].filter((x) => x !== v) : [...f[path], v] }))
    ai.clear(path)
  }

  // closing a listing (Booked / Sold) from the form asks first, as the property page's status control does
  const [confirmClose, setConfirmClose] = useState(false)
  const save = (confirmed = false) => {
    const input = cleanForSave(form)
    const problems = validateProperty(input)
    if (problems.length) {
      setErrors(problems)
      toast.error(t('properties:form.fixErrors', { count: problems.length }))
      focusField(problems[0].field)
      return
    }
    if (editing && !confirmed && (input.status === 'booked' || input.status === 'sold') && input.status !== initial.status) {
      setConfirmClose(true)
      return
    }
    setSaving(true)
    const fieldMeta = Object.fromEntries(Object.entries(ai.meta).filter(([, m]) => m.origin === 'ai'))
    const via = Object.keys(fieldMeta).length ? 'ai' as const : 'manual' as const
    try {
      if (editing) {
        const { result: fields } = replaceProperty(propertyId, input, { via, fieldMeta })
        toast.success(fields.length ? t('properties:form.updated', { title: input.title, count: fields.length }) : t('properties:form.noChanges'))
        navigate(paths.property(propertyId))
      } else {
        const { id } = createProperty({ ...input, fieldMeta: Object.keys(fieldMeta).length ? fieldMeta : undefined }, { via })
        toast.success(t('properties:form.created', { title: input.title }), {
          action: { label: t('properties:form.findBuyers'), onClick: () => navigate(paths.matching({ property: id })) },
        })
        navigate(paths.property(id))
      }
    } catch (e) {
      if (e instanceof ValidationError) setErrors(e.errors)
      else toastError(e)
    } finally {
      setSaving(false)
    }
  }

  const localities = form.location.city ? CITIES[form.location.city] ?? [] : CITY_NAMES.flatMap((c) => CITIES[c])
  const specLabel = (k: string) => t(`catalogue:spec.${k}`)

  const typeSelect = (
    <PF path="type" meta={ai.get('type')} label={t('properties:form.type')} required error={err('type')}>
      {({ id, invalid }) => (
        <Select value={form.type} onValueChange={(v) => changeType(v as PropertyType)}>
          <SelectTrigger id={id} aria-invalid={invalid || undefined} className="w-full" data-testid="pf-type"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PROPERTY_FAMILIES.map((fam) => (
              <SelectGroup key={fam}>
                <SelectLabel>{t(`catalogue:propertyFamily.${fam}`)}</SelectLabel>
                {PROPERTY_TYPE_ORDER.filter((tp) => PROPERTY_TYPES[tp].family === fam).map((tp) => <SelectItem key={tp} value={tp}>{t(`catalogue:propertyType.${tp}`)}</SelectItem>)}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      )}
    </PF>
  )

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-5">
        {/* AI first on small screens: paste a listing or speak it */}
        <div className="xl:hidden">
          <ModuleAssistant module="propertyCreate" onFill={fill} onAnswer={answer} answered={answered} onFocusField={focusField} />
        </div>

        <SectionCard title={t('properties:form.section.basics')} icon={Building2}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('properties:form.family')}>
              {PROPERTY_FAMILIES.map((fam) => {
                const first = PROPERTY_TYPE_ORDER.find((tp) => PROPERTY_TYPES[tp].family === fam)!
                return <Chip key={fam} pressed={def.family === fam} onClick={() => { if (def.family !== fam) changeType(first) }}>{t(`catalogue:propertyFamily.${fam}`)}</Chip>
              })}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {typeSelect}
              <PF path="purpose" meta={ai.get('purpose')} label={t('properties:form.purpose')}>
                {() => (
                  <Segmented variant="pill" value={form.purpose} onChange={(v) => set('purpose', v)} label={t('properties:form.purpose')}
                    segments={(['sale', 'rent', 'lease'] as const).map((v) => ({ value: v, label: t(`catalogue:purpose.${v}`) }))} />
                )}
              </PF>
            </div>
            {shows('configuration') && (
              <PF path="configuration" meta={ai.get('configuration')} label={t('properties:form.configuration')} error={err('configuration')} hint={!form.title.trim() ? t('properties:form.configurationHint') : undefined}>
                {() => (
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('properties:form.configuration')}>
                    {CONFIGURATIONS.map((c) => <Chip key={c} pressed={form.configuration === c} onClick={() => set('configuration', form.configuration === c ? undefined : c)}>{configLabel(c)}</Chip>)}
                  </div>
                )}
              </PF>
            )}
            <PF path="title" meta={ai.get('title')} label={t('properties:form.title')} required={!form.configuration} error={err('title')}>
              {({ id, describedBy, invalid }) => (
                <span className="flex gap-2">
                  <Input id={id} value={form.title} onChange={(e) => set('title', e.target.value)} aria-describedby={describedBy} aria-invalid={invalid || undefined} placeholder={suggestTitle(form) || t('properties:form.titlePlaceholder')} data-testid="pf-title" />
                  <Button type="button" variant="secondary" size="icon" title={t('properties:form.suggestTitle')} aria-label={t('properties:form.suggestTitle')} disabled={!form.configuration && !form.location.locality && !form.location.city} onClick={() => set('title', suggestTitle(form))}>
                    <Wand2 />
                  </Button>
                </span>
              )}
            </PF>
            {shows('project') && (
              <div className="grid gap-4 sm:grid-cols-2">
                <PF path="projectName" meta={ai.get('projectName')} label={t('properties:form.projectName')} optional>
                  {({ id }) => <Input id={id} value={form.projectName ?? ''} onChange={(e) => set('projectName', e.target.value)} />}
                </PF>
                <PF path="builderName" meta={ai.get('builderName')} label={t('properties:form.builderName')} optional>
                  {({ id }) => <Input id={id} value={form.builderName ?? ''} onChange={(e) => set('builderName', e.target.value)} />}
                </PF>
              </div>
            )}
            <PF path="transaction" meta={ai.get('transaction')} label={t('properties:form.transaction')}>
              {() => (
                <Segmented variant="pill" value={form.transaction} onChange={(v) => set('transaction', v)} label={t('properties:form.transaction')}
                  segments={(['newBooking', 'resale'] as const).map((v) => ({ value: v, label: t(`catalogue:transaction.${v}`) }))} />
              )}
            </PF>
            <PF path="description" meta={ai.get('description')} label={t('properties:form.description')} optional hint={t('properties:form.descriptionHint')}>
              {({ id, describedBy }) => <Textarea id={id} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} rows={3} aria-describedby={describedBy} />}
            </PF>
          </div>
        </SectionCard>

        <SectionCard title={t('properties:form.section.location')} icon={MapPin}>
          <div className="grid gap-4 sm:grid-cols-2">
            <PF path="location.city" meta={ai.get('location.city')} label={t('properties:form.city')} required error={err('location.city')}>
              {({ id, invalid }) => (
                <Select value={form.location.city} onValueChange={changeCity}>
                  <SelectTrigger id={id} aria-invalid={invalid || undefined} className="w-full" data-testid="pf-city"><SelectValue placeholder={t('properties:form.chooseCity')} /></SelectTrigger>
                  <SelectContent>{CITY_NAMES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </PF>
            <PF path="location.locality" meta={ai.get('location.locality')} label={t('properties:form.locality')} required error={err('location.locality')} hint={t('properties:form.localityHint')}>
              {({ id, invalid, describedBy }) => (
                <>
                  <Input id={id} list="pf-localities" value={form.location.locality} onChange={(e) => changeLocality(e.target.value)} aria-invalid={invalid || undefined} aria-describedby={describedBy} data-testid="pf-locality" />
                  <datalist id="pf-localities">{localities.map((l) => <option key={l} value={l} />)}</datalist>
                </>
              )}
            </PF>
            <PF path="location.address" meta={ai.get('location.address')} label={t('properties:form.address')} optional className="sm:col-span-2">
              {({ id }) => <Input id={id} value={form.location.address ?? ''} onChange={(e) => set('location.address', e.target.value)} />}
            </PF>
            <PF path="location.landmark" meta={ai.get('location.landmark')} label={t('properties:form.landmark')} optional>
              {({ id }) => <Input id={id} value={form.location.landmark ?? ''} onChange={(e) => set('location.landmark', e.target.value)} />}
            </PF>
            <PF path="location.pincode" meta={ai.get('location.pincode')} label={t('properties:form.pincode')} optional>
              {({ id }) => <Input id={id} inputMode="numeric" maxLength={6} value={form.location.pincode ?? ''} onChange={(e) => set('location.pincode', e.target.value.replace(/\D/g, ''))} />}
            </PF>
          </div>
          {(form.location.locality || form.location.address) && (
            <a href={mapsLink([form.location.address, form.location.locality, form.location.city].filter(Boolean).join(', '))} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-meta font-medium text-primary hover:underline">
              <MapPin className="size-3.5" aria-hidden="true" />{t('properties:form.checkMap')}
            </a>
          )}
        </SectionCard>

        <SectionCard title={t('properties:form.section.priceArea')} icon={IndianRupee}>
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <PF path="price" meta={ai.get('price')} label={form.purpose === 'sale' ? t('properties:form.price') : t('properties:form.rent')} required error={err('price')}>
                {({ id, invalid, describedBy }) => <AmountInput id={id} value={form.price || undefined} onChange={(v) => set('price', v ?? 0)} invalid={invalid} describedBy={describedBy} />}
              </PF>
              <div className="flex flex-col gap-3 sm:pt-7">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={!!form.priceNegotiable} onCheckedChange={(v) => set('priceNegotiable', v)} />
                  {t('properties:form.negotiable')}
                  <AIFieldMarker meta={ai.get('priceNegotiable')} />
                </label>
              </div>
            </div>
            <div className={cn('grid gap-4', def.areaFields.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
              {def.areaFields.filter((k) => AREA_ICONS[k]).map((k) => (
                <PF key={k} path={`area.${k}`} meta={ai.get(`area.${k}`)} label={t(`properties:form.area.${k}`)} error={k === def.areaFields[0] ? err('area', 'area.carpet') : undefined} required={k === def.areaFields[0]}>
                  {({ id, invalid, describedBy }) => k === 'plot' ? (
                    <span className="flex">
                      <Input id={id} type="number" inputMode="decimal" min={0} value={form.area.plot ?? ''} onChange={(e) => set('area.plot', numOrUndef(e.target.value))} aria-invalid={invalid || undefined} aria-describedby={describedBy} className="min-w-0 rounded-r-none tabular-nums" />
                      <Select value={form.area.plotUnit ?? 'sqft'} onValueChange={(v) => set('area.plotUnit', v)}>
                        <SelectTrigger className="w-28 rounded-l-none border-l-0" aria-label={t('properties:form.areaUnit')}><SelectValue /></SelectTrigger>
                        <SelectContent>{AREA_UNITS.map((u) => <SelectItem key={u} value={u}>{t(`catalogue:areaUnit.${u}`)}</SelectItem>)}</SelectContent>
                      </Select>
                    </span>
                  ) : (
                    <NumberInput id={id} value={form.area[k] as number | undefined} onChange={(v) => set(`area.${k}`, v)} invalid={invalid} describedBy={describedBy} suffix={k === 'plotLengthFt' || k === 'plotWidthFt' ? t('properties:form.ft') : t('properties:form.sqft')} />
                  )}
                </PF>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-primary-soft/60 px-4 py-3" aria-live="polite" data-testid="pf-ppsf">
              <span className="flex items-center gap-2 text-sm"><Ruler className="size-4 text-primary" aria-hidden="true" />{area ? t('properties:form.areaComputed', { area: num(area) }) : t('properties:form.areaMissing')}</span>
              <span className="flex items-center gap-2 text-sm font-semibold tabular-nums"><IndianRupee className="size-4 text-primary" aria-hidden="true" />{ppsf ? t('properties:form.ppsf', { price: num(ppsf) }) : t('properties:form.ppsfMissing')}</span>
              {form.price > 0 && <span className="text-meta text-muted-foreground tabular-nums">{inr(form.price)}</span>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {shows('maintenance') && (
                <PF path="maintenancePerMonth" meta={ai.get('maintenancePerMonth')} label={t('properties:form.maintenance')} optional>
                  {({ id }) => <NumberInput id={id} value={form.maintenancePerMonth} onChange={(v) => set('maintenancePerMonth', v)} suffix={t('properties:form.perMonth')} />}
                </PF>
              )}
              <PF path="commissionPct" meta={ai.get('commissionPct')} label={t('properties:form.commission')} optional hint={t('properties:form.commissionHint')}>
                {({ id, describedBy }) => <NumberInput id={id} value={form.commissionPct} onChange={(v) => set('commissionPct', v)} describedBy={describedBy} suffix="%" step="0.25" />}
              </PF>
            </div>
          </div>
        </SectionCard>

        {(shows('rooms') || shows('floor') || shows('facing') || shows('furnishing') || shows('parking')) && (
          <SectionCard title={t('properties:form.section.layout')} icon={LayoutGrid}>
            <div className="flex flex-col gap-4">
              {shows('rooms') && (
                <div className="grid grid-cols-3 gap-4 [&_label]:flex-wrap">
                  {(['bedrooms', 'bathrooms', 'balconies'] as const).map((k) => (
                    <PF key={k} path={k} meta={ai.get(k)} label={t(`properties:form.${k}`)} optional>
                      {({ id }) => <NumberInput id={id} value={form[k]} onChange={(v) => set(k, v)} step="1" />}
                    </PF>
                  ))}
                </div>
              )}
              {shows('floor') && (
                <div className="grid grid-cols-2 gap-4 [&_label]:flex-wrap">
                  <PF path="floor" meta={ai.get('floor')} label={t('properties:form.floor')} error={err('floor')} hint={recommended.includes('floor') ? t('properties:form.recommended') : t('properties:form.floorHint')}>
                    {({ id, invalid, describedBy }) => <NumberInput id={id} value={form.floor} onChange={(v) => set('floor', v)} invalid={invalid} describedBy={describedBy} step="1" />}
                  </PF>
                  <PF path="totalFloors" meta={ai.get('totalFloors')} label={t('properties:form.totalFloors')} optional>
                    {({ id }) => <NumberInput id={id} value={form.totalFloors} onChange={(v) => set('totalFloors', v)} step="1" />}
                  </PF>
                </div>
              )}
              {shows('facing') && (
                <PF path="facing" meta={ai.get('facing')} label={t('properties:form.facing')} optional>
                  {() => (
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('properties:form.facing')}>
                      {FACINGS.map((f) => <Chip key={f} pressed={form.facing === f} onClick={() => set('facing', form.facing === f ? undefined : f)}>{t(`catalogue:facing.${f}`)}</Chip>)}
                    </div>
                  )}
                </PF>
              )}
              {shows('furnishing') && (
                <PF path="furnishing" meta={ai.get('furnishing')} label={t('properties:form.furnishing')} optional>
                  {() => (
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('properties:form.furnishing')}>
                      {FURNISHING.map((f) => <Chip key={f} pressed={form.furnishing === f} onClick={() => set('furnishing', form.furnishing === f ? undefined : f)}>{t(`catalogue:furnishing.${f}`)}</Chip>)}
                    </div>
                  )}
                </PF>
              )}
              {shows('parking') && (
                <AIField meta={ai.get('parking')}>
                  <div className="grid grid-cols-2 gap-4 [&_label]:flex-wrap">
                    <FormField id="pf-parking.covered" label={t('properties:form.parkingCovered')} labelEnd={<AIFieldMarker meta={ai.get('parking')} />}>
                      {({ id }) => <NumberInput id={id} value={form.parking.covered} onChange={(v) => set('parking', { ...form.parking, covered: v ?? 0 })} step="1" />}
                    </FormField>
                    <FormField id="pf-parking.open" label={t('properties:form.parkingOpen')}>
                      {({ id }) => <NumberInput id={id} value={form.parking.open} onChange={(v) => set('parking', { ...form.parking, open: v ?? 0 })} step="1" />}
                    </FormField>
                  </div>
                </AIField>
              )}
              <div className="flex flex-wrap gap-x-6 gap-y-3">
                {shows('corner') && <SwitchRow label={t('properties:form.corner')} checked={!!form.corner} onChange={(v) => set('corner', v)} meta={ai.get('corner')} />}
                {shows('vastu') && <SwitchRow label={t('properties:form.vastu')} checked={!!form.vastuCompliant} onChange={(v) => set('vastuCompliant', v)} meta={ai.get('vastuCompliant')} />}
                {shows('gated') && <SwitchRow label={t('properties:form.gated')} checked={!!form.gatedCommunity} onChange={(v) => set('gatedCommunity', v)} meta={ai.get('gatedCommunity')} />}
              </div>
            </div>
          </SectionCard>
        )}

        <SectionCard title={t('properties:form.section.amenities')} icon={Sparkles} description={t('properties:form.amenitiesCount', { count: form.amenities.length })}>
          <AIField meta={ai.get('amenities')}>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('properties:form.section.amenities')}>
              {AMENITIES.map((a) => <Chip key={a} pressed={form.amenities.includes(a)} onClick={() => toggleIn('amenities', a)}>{t(`catalogue:amenity.${a}`)}</Chip>)}
            </div>
          </AIField>
        </SectionCard>

        <SectionCard title={t('properties:form.section.legal')} icon={FileCheck2}>
          <div className="flex flex-col gap-4">
            {shows('possession') && (
              <div className="grid gap-4 sm:grid-cols-2">
                <PF path="possession.status" meta={ai.get('possession.status')} label={t('properties:form.possession')}>
                  {() => (
                    <Segmented variant="pill" value={form.possession.status} onChange={(v) => set('possession', { ...form.possession, status: v })} label={t('properties:form.possession')}
                      segments={(['ready', 'underConstruction'] as const).map((v) => ({ value: v, label: t(`catalogue:possession.${v}`) }))} />
                  )}
                </PF>
                {form.possession.status === 'underConstruction' && (
                  <PF path="possession.date" meta={ai.get('possession.date')} label={t('properties:form.possessionDate')} optional>
                    {({ id }) => <Input id={id} type="date" min={localDay(now)} value={form.possession.date ?? ''} onChange={(e) => set('possession', { ...form.possession, date: e.target.value || undefined })} />}
                  </PF>
                )}
              </div>
            )}
            {shows('rera') && (
              <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <PF path="rera" meta={ai.get('rera')} label={t('properties:form.rera')} optional>
                  {({ id }) => <Input id={id} value={form.rera?.number ?? ''} onChange={(e) => set('rera', { number: e.target.value.toUpperCase(), verified: form.rera?.verified ?? false })} placeholder="PRM/KA/RERA/…" />}
                </PF>
                <SwitchRow label={t('properties:form.reraVerified')} checked={!!form.rera?.verified} disabled={!form.rera?.number} onChange={(v) => set('rera', { number: form.rera?.number ?? '', verified: v })} />
              </div>
            )}
            <AIField meta={ai.get('approvals')}>
              <div className="flex flex-col gap-2">
                <span className="flex items-center gap-1.5 text-sm font-medium">{t('properties:form.approvals')}<span className="font-normal text-muted-foreground">{t('common:optional')}</span><AIFieldMarker meta={ai.get('approvals')} /></span>
                {form.approvals.length > 0 && (
                  <ul className="flex flex-col gap-2">
                    {form.approvals.map((a, i) => (
                      <li key={a.authority} className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-2">
                        <Landmark className="size-4 text-muted-foreground" aria-hidden="true" />
                        <span className="min-w-0 flex-1 text-sm font-medium">{a.authority}</span>
                        <Select value={a.docStatus} onValueChange={(v) => set('approvals', form.approvals.map((x, j) => (j === i ? { ...x, docStatus: v as typeof a.docStatus } : x)))}>
                          <SelectTrigger className="h-8 w-36" aria-label={t('properties:form.docStatusFor', { authority: a.authority })}><SelectValue /></SelectTrigger>
                          <SelectContent>{DOC_STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`properties:docStatus.${s}`)}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label={t('properties:form.removeApproval', { authority: a.authority })} onClick={() => set('approvals', form.approvals.filter((_, j) => j !== i))}><X /></Button>
                      </li>
                    ))}
                  </ul>
                )}
                <span className="flex flex-wrap gap-2">
                  <Select value={newApproval} onValueChange={setNewApproval}>
                    <SelectTrigger className="w-full sm:w-64" aria-label={t('properties:form.addApproval')}><SelectValue placeholder={t('properties:form.chooseAuthority')} /></SelectTrigger>
                    <SelectContent>{APPROVAL_AUTHORITIES.filter((a) => !form.approvals.some((x) => x.authority === a)).map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button type="button" variant="secondary" disabled={!newApproval} onClick={() => { set('approvals', [...form.approvals, { authority: newApproval, docStatus: 'pending' }]); setNewApproval('') }}><Plus />{t('properties:form.addApproval')}</Button>
                </span>
              </div>
            </AIField>
            <div className="grid gap-4 sm:grid-cols-2">
              {shows('khata') && (
                <PF path="khata" meta={ai.get('khata')} label={t('properties:form.khata')} optional>
                  {({ id }) => (
                    <Select value={form.khata ?? '__unset'} onValueChange={(v) => set('khata', v === '__unset' ? undefined : v)}>
                      <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unset">{t('properties:form.notSet')}</SelectItem>
                        {(['A', 'B', 'E'] as const).map((k) => <SelectItem key={k} value={k}>{t('properties:form.khataValue', { k })}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </PF>
              )}
              {shows('roadWidth') && (
                <PF path="roadWidthFt" meta={ai.get('roadWidthFt')} label={t('properties:form.roadWidth')} hint={recommended.includes('roadWidthFt') ? t('properties:form.recommended') : undefined} optional={!def.required.includes('roadWidthFt')}>
                  {({ id, describedBy }) => <NumberInput id={id} value={form.roadWidthFt} onChange={(v) => set('roadWidthFt', v)} describedBy={describedBy} suffix={t('properties:form.ft')} />}
                </PF>
              )}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {shows('patta') && <SwitchRow label={t('properties:form.patta')} checked={!!form.pattaAvailable} onChange={(v) => set('pattaAvailable', v)} meta={ai.get('pattaAvailable')} />}
              <SwitchRow label={t('properties:form.loanEligible')} checked={!!form.loanEligible} onChange={(v) => set('loanEligible', v)} meta={ai.get('loanEligible')} />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t('properties:form.banks')} <span className="font-normal text-muted-foreground">{t('common:optional')}</span></span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('properties:form.banks')}>
                {BANKS.map((b) => <Chip key={b} pressed={form.bankApprovals.includes(b)} onClick={() => toggleIn('bankApprovals', b)}>{b}</Chip>)}
              </div>
            </div>
          </div>
        </SectionCard>

        {def.specs.length > 0 && (
          <SectionCard title={t('properties:form.section.specs', { family: t(`catalogue:propertyFamily.${def.family}`) })} icon={Ruler} description={t('properties:form.specsHint')}>
            <div className="grid gap-4 sm:grid-cols-2">
              {def.specs.map((s) => <SpecInput key={s.key} def={s} label={specLabel(s.key)} value={form.specs[s.key]} onChange={(v) => setForm((f) => ({ ...f, specs: { ...f.specs, [s.key]: v as string | number | boolean } }))} />)}
            </div>
          </SectionCard>
        )}

        <SectionCard title={t('properties:form.section.photos')} icon={Camera}>
          <PhotoManager media={form.media} onChange={(media) => setForm((f) => ({ ...f, media }))} otherBytes={otherBytes} />
        </SectionCard>

        <SectionCard title={t('properties:form.section.owner')} icon={UserRound}>
          <AIField meta={ai.get('owner')}>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField id="pf-owner.kind" label={t('properties:form.ownerKind')} labelEnd={<AIFieldMarker meta={ai.get('owner')} />}>
                {({ id }) => (
                  <Select value={form.owner?.kind ?? 'owner'} onValueChange={(v) => set('owner', { name: form.owner?.name ?? '', phone: form.owner?.phone ?? '', kind: v })}>
                    <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{OWNER_KINDS.map((k) => <SelectItem key={k} value={k}>{t(`properties:ownerKind.${k}`)}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </FormField>
              <FormField id="pf-owner.name" label={t('properties:form.ownerName')} optional>
                {({ id }) => <Input id={id} value={form.owner?.name ?? ''} onChange={(e) => set('owner', { kind: form.owner?.kind ?? 'owner', phone: form.owner?.phone ?? '', name: e.target.value })} />}
              </FormField>
              <FormField id="pf-owner.phone" label={t('properties:form.ownerPhone')} optional error={err('owner.phone')}>
                {({ id, invalid, describedBy }) => <PhoneInput id={id} value={form.owner?.phone} onChange={(v) => set('owner', { kind: form.owner?.kind ?? 'owner', name: form.owner?.name ?? '', phone: v })} invalid={invalid} describedBy={describedBy} />}
              </FormField>
            </div>
          </AIField>
          <p className="mt-2 text-meta text-muted-foreground">{t('properties:form.ownerPrivate')}</p>
        </SectionCard>

        <SectionCard title={t('properties:form.section.listing')} icon={LayoutGrid}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="pf-status" label={t('properties:form.status')}>
              {({ id }) => (
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as PropertyInput['status'] }))}>
                  <SelectTrigger id={id} className="w-full" data-testid="pf-status"><SelectValue /></SelectTrigger>
                  <SelectContent>{PROPERTY_STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`catalogue:propertyStatus.${s}`)}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </FormField>
            <FormField id="pf-listing" label={t('properties:form.listing')} hint={t(`properties:form.listingHint.${form.listing}`)}>
              {({ id, describedBy }) => (
                <Select value={form.listing} onValueChange={(v) => setForm((f) => ({ ...f, listing: v as PropertyInput['listing'] }))}>
                  <SelectTrigger id={id} className="w-full" aria-describedby={describedBy}><SelectValue /></SelectTrigger>
                  <SelectContent>{LISTING_STATES.map((s) => <SelectItem key={s} value={s}>{t(`catalogue:listing.${s}`)}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </FormField>
            {form.status === 'onHold' && (
              <FormField id="pf-heldUntil" label={t('properties:form.heldUntil')} optional>
                {({ id }) => <Input id={id} type="date" min={localDay(now)} value={form.heldUntil ? localDay(new Date(form.heldUntil)) : ''} onChange={(e) => setForm((f) => ({ ...f, heldUntil: e.target.value ? new Date(`${e.target.value}T18:00:00`).toISOString() : undefined }))} />}
              </FormField>
            )}
          </div>
        </SectionCard>
      </div>

      {/* right rail: AI, live summary, save */}
      <aside className="flex flex-col gap-4 xl:sticky xl:top-20 xl:self-start">
        <div className="max-xl:hidden">
          <ModuleAssistant module="propertyCreate" onFill={fill} onAnswer={answer} answered={answered} onFocusField={focusField} />
        </div>
        <section aria-label={t('properties:form.summary')} className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-card">
          <div className="flex items-center gap-3">
            <ProgressRing value={score} size={52} tone={scoreTone(score)} label={t('properties:form.completeness')} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{preview.title || t('properties:form.untitled')}</p>
              <p className="text-meta text-muted-foreground">{t('properties:form.completenessLine', { score })}</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-meta">
            <div><dt className="text-muted-foreground">{t('properties:form.price')}</dt><dd className="font-semibold tabular-nums">{form.price ? inrShort(form.price) : '–'}</dd></div>
            <div><dt className="text-muted-foreground">{t('properties:form.ppsfShort')}</dt><dd className="font-semibold tabular-nums">{ppsf ? `₹${num(ppsf)}` : '–'}</dd></div>
          </dl>
          {ai.count > 0 && <EffortSaved count={ai.count} />}
          {recommended.length > 0 && (
            <p className="flex items-start gap-1.5 text-meta text-warning"><CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />{t('properties:form.recommendedList', { list: recommended.map((k) => t(`properties:field.${k}`)).join(', ') })}</p>
          )}
          {errors.length > 0 && (
            <ul role="alert" className="flex flex-col gap-1 rounded-md bg-danger-soft px-3 py-2 text-meta text-danger">
              {errors.map((e) => <li key={e.field}><button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => focusField(e.field)}>{t(`properties:field.${e.field.replace('location.', '').replace(/^area\..*/, 'area').replace('owner.phone', 'ownerPhone')}`)}: {t(`common:validation.${e.key}`)}</button></li>)}
            </ul>
          )}
          <div className="flex flex-col gap-2 max-xl:hidden">
            <Button onClick={() => save()} disabled={saving} aria-busy={saving || undefined} data-testid="property-save">
              {saving && <Loader2 className="animate-spin" />}{editing ? t('properties:form.saveChanges') : t('properties:form.save')}
            </Button>
            <Button variant="secondary" onClick={() => navigate(editing ? paths.property(propertyId) : paths.properties())}>{t('common:actions.cancel')}</Button>
          </div>
        </section>
        {editing && dirty && <p className="text-meta text-muted-foreground max-xl:hidden">{t('properties:form.unsaved')}</p>}
      </aside>

      {/* sticky save bar below xl */}
      <div className="sticky bottom-0 z-10 -mx-4 flex gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur xl:hidden md:-mx-6 md:px-6">
        <Button variant="secondary" className="flex-1" onClick={() => navigate(editing ? paths.property(propertyId) : paths.properties())}>{t('common:actions.cancel')}</Button>
        <Button className="flex-1" onClick={() => save()} disabled={saving} aria-busy={saving || undefined} data-testid="property-save-mobile">
          {saving && <Loader2 className="animate-spin" />}{editing ? t('properties:form.saveChanges') : t('properties:form.save')}
        </Button>
      </div>
      <ConfirmDialog
        open={confirmClose} onOpenChange={setConfirmClose}
        title={t('properties:status.confirmTitle', { status: t(`catalogue:propertyStatus.${form.status}`) })}
        description={t('properties:bulk.statusConfirmBody')}
        confirmLabel={t('properties:status.confirm', { status: t(`catalogue:propertyStatus.${form.status}`) })}
        onConfirm={() => { setConfirmClose(false); save(true) }}
      />
    </div>
  )
}

function SwitchRow({ label, checked, onChange, meta, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; meta?: FieldMeta; disabled?: boolean }) {
  return (
    <label className={cn('flex items-center gap-2 text-sm', disabled && 'opacity-60')}>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
      {label}
      <AIFieldMarker meta={meta} />
    </label>
  )
}

function SpecInput({ def, label, value, onChange }: { def: FactDef; label: string; value: unknown; onChange: (v: unknown) => void }) {
  const { t } = useTranslation(['catalogue', 'properties'])
  const id = `pf-spec-${def.key}`
  if (def.kind === 'boolean') return <SwitchRow label={label} checked={value === true} onChange={onChange} />
  return (
    <FormField id={id} label={label} optional hint={def.internal ? t('properties:form.internalHint') : undefined}>
      {({ id: fid, describedBy }) => def.kind === 'select' ? (
        <Select value={typeof value === 'string' ? value : '__unset'} onValueChange={(v) => onChange(v === '__unset' ? undefined : v)}>
          <SelectTrigger id={fid} className="w-full" aria-describedby={describedBy}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__unset">{t('properties:form.notSet')}</SelectItem>
            {def.options?.map((o) => <SelectItem key={o} value={o}>{t(`catalogue:specOption.${o}`)}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : def.kind === 'number' ? (
        <NumberInput id={fid} value={typeof value === 'number' ? value : undefined} onChange={onChange} describedBy={describedBy} suffix={def.money ? '₹' : undefined} />
      ) : (
        <Input id={fid} type={def.kind === 'month' ? 'month' : 'text'} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} aria-describedby={describedBy} />
      )}
    </FormField>
  )
}
