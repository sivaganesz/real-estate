import { useState, type FormEvent } from 'react'
import { BadgeCheck, Camera, Check, Circle, ImagePlus, MapPin, Pencil, Rocket, Save, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PropertyPhoto } from '@/components/property/property-photo'
import { CITIES, PROPERTY_TYPES, PURPOSES, TYPE_ORDER } from '@/data/catalogue'
import { type Draft, type Fact, isSet, missingKeys, requiredKeys } from '@/lib/assistant'
import { inrShort, num } from '@/lib/format'
import { useLabels } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { useFactText } from './use-fact-text'

type Props = {
  draft: Draft
  mode: 'add' | 'edit'
  /** Edit mode: the stored status of each approval, so verified ones show as verified. New ones are pending. */
  approvalStatus?: Record<string, string>
  onFact: (f: Fact) => void
  onAddPhotos: () => void
  onPublish?: () => void
  onSaveDraft?: () => void
  onDone?: () => void
}

/**
 * The listing taking shape: the card as customers will see it, then the required facts.
 * Every fact can be clicked and corrected in place — the assistant and the person fill the same record.
 */
export function PreviewPanel({ draft: d, mode, approvalStatus, onFact, onAddPhotos, onPublish, onSaveDraft, onDone }: Props) {
  const { t } = useTranslation()
  const L = useLabels()
  const ft = useFactText()
  const [editing, setEditing] = useState<string | null>(null)
  const req = requiredKeys(d).concat('title')
  const missing = missingKeys(d)
  const done = req.length - missing.length
  // keyFacts only reads type, specs and area; an unknown area gives '' and is dropped
  const facts = d.type ? L.keyFacts({ type: d.type, specs: d.specs, areaSqft: d.areaSqft } as never).filter(Boolean) : []

  const row = (key: string) => {
    const set = isSet(d, key)
    const raw = key.startsWith('spec:') ? d.specs[key.slice(5)] : key === 'area' ? d.areaSqft : (d as Record<string, unknown>)[key]
    const label = key === 'spec:?' || key === 'spec:??' ? t('assistant.keyDetail') : ft.label(key)
    return (
      <li key={key}>
        {editing === key ? (
          <InlineEdit draft={d} fieldKey={key} label={label} initial={raw} onCancel={() => setEditing(null)} onSave={(f) => { onFact(f); setEditing(null) }} />
        ) : (
          <button type="button" disabled={key.startsWith('spec:?') || (mode === 'edit' && key === 'type')} onClick={() => setEditing(key)}
            className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:pointer-events-none">
            {set ? <Check className="size-4 shrink-0 text-emerald-600" /> : <Circle className="size-4 shrink-0 text-muted-foreground/60" />}
            <span className={cn('w-28 shrink-0', set ? 'text-muted-foreground' : 'font-medium')}>{label}</span>
            <span className="min-w-0 flex-1 truncate">{set ? ft.value(key, raw, d.type) : <span className="text-muted-foreground">—</span>}</span>
            <Pencil className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
          </button>
        )}
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('assistant.previewTitle')}</p>

      {/* the card as customers will see it */}
      <div className="overflow-hidden rounded-xl border bg-card">
        {d.photos > 0 && d.type ? (
          <div className="relative">
            <PropertyPhoto type={d.type} alt={d.title ?? ''} className="aspect-[16/9] w-full" />
            <span className="absolute right-2.5 bottom-2.5 inline-flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-xs text-white"><Camera className="size-3" /> {d.photos}</span>
          </div>
        ) : (
          <button type="button" onClick={onAddPhotos}
            className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-1.5 border-b border-dashed bg-muted/40 text-sm text-muted-foreground hover:bg-muted">
            <ImagePlus className="size-6" /> {t('assistant.dropPhotos')}
          </button>
        )}
        <div className="flex flex-col gap-1 p-3.5">
          <p className={cn('text-xl font-semibold', !d.price && 'text-muted-foreground')}>
            {d.price ? inrShort(d.price) : t('assistant.noPrice')}
            {d.price && d.areaSqft ? <span className="ml-2 text-xs font-normal text-muted-foreground">{t('card.perSqft', { rate: num(Math.round(d.price / d.areaSqft)) })}</span> : null}
          </p>
          <p className={cn('font-medium', !d.title && 'text-muted-foreground')}>{d.title || t('assistant.titleSoon')}</p>
          {facts.length > 0 && <p className="text-sm text-muted-foreground">{[d.type && L.type(d.type), ...facts].filter(Boolean).join(' · ')}</p>}
          {(d.locality || d.city) && (
            <p className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-3.5" /> {[d.locality, d.city].filter(Boolean).join(', ')}</p>
          )}
          {d.approvals.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {d.approvals.map((a) =>
                approvalStatus?.[a] && approvalStatus[a] !== 'pending' ? (
                  <Badge key={a} variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800"><BadgeCheck /> {t(`approval.${a}`)}</Badge>
                ) : (
                  <Badge key={a} variant="outline" className="border-amber-300 bg-amber-50 text-amber-800"><TriangleAlert /> {t(`approval.${a}`)} · {t('approvalState.pending')}</Badge>
                ),
              )}
            </div>
          )}
        </div>
      </div>

      {/* required facts */}
      <div className="rounded-xl border bg-card p-3">
        <div className="mb-2 flex items-center justify-between px-2 text-sm">
          <span className="font-medium">{t('assistant.required')}</span>
          <span className={missing.length ? 'text-muted-foreground' : 'font-medium text-emerald-700'}>{t('assistant.requiredCount', { done, total: req.length })}</span>
        </div>
        <Progress value={(done / req.length) * 100} className="mx-2 mb-2 h-1.5 w-[calc(100%-1rem)]" />
        <ul className="flex flex-col">{req.map(row)}</ul>
        <p className="mt-2 px-2 text-xs text-muted-foreground">{t('assistant.optionalLater')}</p>
      </div>

      {mode === 'add' ? (
        <div className="flex gap-2">
          <Button size="lg" variant="outline" className="flex-1" disabled={!d.type} onClick={onSaveDraft}><Save /> {t('assistant.saveDraft')}</Button>
          <Button size="lg" className="flex-1" disabled={missing.length > 0} onClick={onPublish}><Rocket /> {t('action.publish')}</Button>
        </div>
      ) : (
        <Button size="lg" variant="outline" onClick={onDone}>{t('assistant.backToProperty')}</Button>
      )}
    </div>
  )
}

/** Correct one fact in place: a choice where the catalogue has options, a box otherwise. */
function InlineEdit({ draft: d, fieldKey, label, initial, onSave, onCancel }: {
  draft: Draft; fieldKey: string; label: string; initial: unknown; onSave: (f: Fact) => void; onCancel: () => void
}) {
  const { t } = useTranslation()
  const L = useLabels()
  const [v, setV] = useState(initial == null ? '' : String(initial))
  const def = fieldKey.startsWith('spec:') && d.type ? PROPERTY_TYPES[d.type].facts.find((f) => f.key === fieldKey.slice(5)) : undefined
  const options: { value: string; label: string }[] | null =
    fieldKey === 'purpose' ? PURPOSES.map((p) => ({ value: p, label: L.purpose(p) }))
      : fieldKey === 'type' ? TYPE_ORDER.map((x) => ({ value: x, label: L.type(x) }))
        : fieldKey === 'city' ? Object.keys(CITIES).map((c) => ({ value: c, label: c }))
          : def?.kind === 'select' ? def.options!.map((o) => ({ value: o, label: o }))
            : null
  const numeric = fieldKey === 'area' || def?.kind === 'number'

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!v.trim()) return
    let value: Fact['value'] = v.trim()
    if (fieldKey === 'price') {
      const m = v.toLowerCase().match(/([\d,.]+)\s*(l|lakh|lakhs|lac|cr|crore|crores|k)?/)
      if (!m) return
      const n = parseFloat(m[1].replace(/,/g, ''))
      value = m[2]?.startsWith('c') ? n * 1e7 : m[2] === 'k' ? n * 1e3 : m[2] || n < 100000 ? n * 1e5 : n
    } else if (numeric) value = Number(v.replace(/,/g, ''))
    onSave({ key: fieldKey, value })
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 rounded-md bg-muted/60 px-2 py-1.5">
      <span className="w-28 shrink-0 text-sm font-medium">{label}</span>
      {options ? (
        <Select value={v} onValueChange={(x) => { setV(x); onSave({ key: fieldKey, value: x }) }}>
          <SelectTrigger size="sm" className="min-w-0 flex-1 bg-background" aria-label={label}><SelectValue placeholder={t('fact.choose')} /></SelectTrigger>
          <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      ) : (
        <Input autoFocus aria-label={label} value={v} onChange={(e) => setV(e.target.value)} inputMode={numeric ? 'decimal' : undefined}
          placeholder={fieldKey === 'price' ? t('assistant.hint.price') : undefined} className="h-7 min-w-0 flex-1 bg-background"
          list={fieldKey === 'locality' ? 'locality-options' : undefined} onKeyDown={(e) => e.key === 'Escape' && onCancel()} />
      )}
      {fieldKey === 'locality' && <datalist id="locality-options">{(CITIES[d.city ?? ''] ?? []).map((l) => <option key={l} value={l} />)}</datalist>}
      {!options && <Button type="submit" size="xs">{t('action.save')}</Button>}
      <Button type="button" size="xs" variant="ghost" onClick={onCancel}>{t('action.cancel')}</Button>
    </form>
  )
}
