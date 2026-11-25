import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Check, ChevronDown, ChevronUp, Crosshair, ExternalLink, MapPin, Plus, Sparkles, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Chip } from '@/components/app/chip'
import { StatusChip } from '@/components/app/status-chip'
import { amenityList, CITIES, FACINGS, PROPERTY_TYPES, PURPOSES, TYPE_ORDER, type FactDef, typeFacts } from '@/data/catalogue'
import type { Category, FactSource, Property } from '@/data/types'
import { CORE_ORDER, type Draft, type Fact, isSet } from '@/lib/assistant'
import { inr, inrShort } from '@/lib/format'
import { useLabels } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { useCan, useStore } from '@/store/db'
import { SourceTag } from './source-tag'
import { useFactText } from './use-fact-text'

export type FormHandlers = {
  /** Set a field, or clear it with undefined. Keys as in the assistant: `price`, `spec:bhk`… */
  onSet: (key: string, value: Fact['value'] | undefined) => void
  onAmenity: (name: string) => void
  onApproval: (id: string) => void
  /** A manager creates a new approval type and ticks it. */
  onNewApproval: (name: string) => void
  /** Set the exact location (from the phone, or a pasted map link), or remove it. */
  onExact: (how: 'gps' | 'link' | null) => void
  /** Set a detail only this property has ("＋ Something else"), or remove it with undefined. */
  onExtraDetail: (label: string, value: string | undefined) => void
}

/** What a summary row's "Add" opens: a field (`price`, `spec:floor`…) or a whole section. */
export type FocusTarget = { target: string; n: number }

type Sec = 'basic' | 'details' | 'amenities' | 'approvals'
const BASIC = ['title', ...CORE_ORDER] as const
const fid = (key: string) => (['details', 'amenities', 'approvals'].includes(key) ? `sec-${key}` : `f-${key.replace(/[^a-zA-Z0-9]+/g, '-')}`)
const sectionOf = (key: string): Sec =>
  key.startsWith('spec:') || key === 'details' || key === 'facing' ? 'details' : key === 'amenities' ? 'amenities' : key === 'approvals' ? 'approvals' : 'basic'

/**
 * The Details tab of the drawer: everything the AI filled in, as a form — four sections joined by a step line,
 * each with its status and a collapse arrow (as in spec-system-wireframe). A tag beside a label says where the value came from.
 */
export function DetailsForm({ draft: d, record, canWrite, focus, h }: {
  draft: Draft
  /** The saved draft (for the approval documents' state). */
  record?: Property
  canWrite: boolean
  focus: FocusTarget | null
  h: FormHandlers
}) {
  const { t } = useTranslation()
  const L = useLabels()
  const ft = useFactText()
  const { db } = useStore()
  const can = useCan()
  const dis = !canWrite
  const def = d.type ? PROPERTY_TYPES[d.type] : undefined
  const src = (key: string): FactSource | undefined => d.sources?.[key]

  const [closed, setClosed] = useState<Set<Sec>>(new Set())
  const [cat, setCat] = useState<Category | undefined>(def?.category)
  const [extra, setExtra] = useState<string[]>([]) // details added with "＋ a detail"
  const [adding, setAdding] = useState<null | 'amenity' | 'approval' | 'detail'>(null)
  const [link, setLink] = useState('')
  const category = def?.category ?? cat

  // "Add" on the summary: open the field's section (and show the field), then scroll to it, put the cursor in it and flash it
  const [opened, setOpened] = useState<FocusTarget | null>(null)
  if (focus && focus !== opened) {
    setOpened(focus)
    const sec = sectionOf(focus.target)
    if (closed.has(sec)) setClosed((c) => { const n = new Set(c); n.delete(sec); return n })
    const k = focus.target.startsWith('spec:') ? focus.target.slice(5) : ''
    if (k && !extra.includes(k)) setExtra((x) => [...x, k])
  }
  useEffect(() => {
    if (!focus) return
    const timer = setTimeout(() => {
      const el = document.getElementById(fid(focus.target))
      if (!el) return
      el.scrollIntoView({ block: 'center' })
      const field = el.matches('input, button, [role=combobox]') ? el : el.querySelector<HTMLElement>('input, button, [role=combobox]')
      ;(field ?? el).focus({ preventScroll: true })
      el.animate([{ boxShadow: '0 0 0 3px var(--ring)' }, { boxShadow: '0 0 0 3px transparent' }], { duration: 1400, easing: 'ease-out' })
    }, 300)
    return () => clearTimeout(timer)
  }, [focus])

  const toggle = (s: Sec) => setClosed((c) => { const n = new Set(c); if (n.has(s)) n.delete(s); else n.add(s); return n })
  const pickCategory = (c: Category) => {
    setCat(c)
    if (def && def.category !== c) h.onSet('type', undefined)
  }

  /* ---------- section 1: required details ---------- */
  const basicIn = BASIC.filter((k) => isSet(d, k)).length
  const localities = CITIES[d.city ?? ''] ?? []
  const rate = d.price && d.areaSqft ? ` · ${t('drawer.perSqft', { rate: inr(Math.round(d.price / d.areaSqft)) })}` : ''
  const basic = (
    <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
      <Field id={fid('title')} label={t('drawer.f.title')} req src={src('title')} wide
        hint={d.title ? (src('title') === 'ai' ? <><Sparkles className="inline size-3 text-violet" /> {t('drawer.titleAi')}</> : t('drawer.titleOwn')) : undefined}>
        <TextInput id={fid('title')} value={d.title} disabled={dis} placeholder={t('drawer.titlePh')} onCommit={(v) => h.onSet('title', v || undefined)} />
      </Field>
      <Field id={fid('purpose')} label={t('drawer.f.purpose')} req src={src('purpose')} group>
        <Pills id={fid('purpose')} value={d.purpose} disabled={dis} onPick={(v) => h.onSet('purpose', v)}
          options={(def?.purposes ?? PURPOSES).map((p) => ({ value: p, label: L.purpose(p) }))} />
      </Field>
      <Field id={fid('category')} label={t('drawer.f.category')} req group hint={t('drawer.categoryHint')}>
        <Pills id={fid('category')} value={category} disabled={dis} onPick={(v) => pickCategory(v as Category)}
          options={(['residential', 'commercial'] as const).map((c) => ({ value: c, label: t(`props.category.${c}`) }))} />
      </Field>
      <Field id={fid('type')} label={t('drawer.f.type')} req src={src('type')} wide group>
        {category ? (
          <Pills id={fid('type')} value={d.type} disabled={dis} onPick={(v) => h.onSet('type', v)}
            options={TYPE_ORDER.filter((k) => PROPERTY_TYPES[k].category === category).map((k) => ({ value: k, label: L.type(k) }))} />
        ) : <p id={fid('type')} tabIndex={-1} className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground outline-none">{t('drawer.typeFirst')}</p>}
      </Field>
      <Field id={fid('city')} label={t('drawer.f.city')} req src={src('city')}>
        <Select value={d.city ?? ''} onValueChange={(v) => h.onSet('city', v)} disabled={dis}>
          <SelectTrigger id={fid('city')} className="w-full"><SelectValue placeholder={t('fact.choose')} /></SelectTrigger>
          <SelectContent>{[...new Set([...Object.keys(CITIES), ...(d.city ? [d.city] : [])])].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field id={fid('locality')} label={t('drawer.f.locality')} req src={src('locality')} hint={d.city ? t('drawer.autoFilled', { place: 'Tamil Nadu, India' }) : undefined}>
        <TextInput id={fid('locality')} value={d.locality} disabled={dis} list="drawer-localities"
          placeholder={t('drawer.localityPh', { example: localities[0] ?? 'Anna Nagar' })} onCommit={(v) => h.onSet('locality', v || undefined)} />
        <datalist id="drawer-localities">{localities.map((l) => <option key={l} value={l} />)}</datalist>
      </Field>
      <Field id={fid('exactLocation')} label={<>{t('drawer.f.exact')} <StatusChip tone="neutral" variant="outline">{t('drawer.optional')}</StatusChip></>} wide group>
        {d.exactLocation ? (
          <div id={fid('exactLocation')} tabIndex={-1} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-success-soft px-3 py-2 text-sm outline-none">
            <span className="flex items-center gap-1.5 font-medium text-success"><MapPin className="size-4" /> {t('drawer.exactSet')}</span>
            <span className="flex-1" />
            <a className="inline-flex items-center gap-1 text-primary hover:underline" target="_blank" rel="noopener noreferrer"
              href={`https://www.google.com/maps?q=${encodeURIComponent([d.locality, d.city].filter(Boolean).join(', '))}`}>{t('drawer.viewMap')} <ExternalLink className="size-3.5" /></a>
            {!dis && <button type="button" onClick={() => h.onExact(null)} className="text-danger hover:underline">{t('drawer.remove')}</button>}
          </div>
        ) : (
          <div id={fid('exactLocation')} tabIndex={-1} className="flex flex-col gap-1.5 rounded-lg outline-none">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" disabled={dis} onClick={() => h.onExact('gps')}><Crosshair /> {t('drawer.useHere')}</Button>
              <span className="text-meta text-muted-foreground">{t('drawer.or')}</span>
              <form className="flex w-full min-w-0 gap-2 sm:w-auto sm:min-w-64 sm:flex-1" onSubmit={(e) => { e.preventDefault(); if (link.trim()) { h.onExact('link'); setLink('') } }}>
                <Input value={link} onChange={(e) => setLink(e.target.value)} disabled={dis} placeholder={t('drawer.linkPh')} aria-label={t('drawer.linkPh')} className="h-8 min-w-0 flex-1 sm:min-w-40" />
                <Button type="submit" size="sm" variant="outline" disabled={dis || !link.trim()}>{t('drawer.useLink')}</Button>
              </form>
            </div>
            <p className="text-meta text-muted-foreground">{d.locality ? t('drawer.exactSkip', { locality: d.locality }) : t('drawer.exactSkipNoLoc')}</p>
          </div>
        )}
      </Field>
      <Field id={fid('price')} label={d.purpose === 'rent' ? t('drawer.f.rent') : t('drawer.f.price')} req src={src('price')}
        hint={d.price ? inrShort(d.price) + rate : undefined}>
        <TextInput id={fid('price')} type="number" value={d.price} disabled={dis} onCommit={(v) => h.onSet('price', v ? Number(v) : undefined)} />
      </Field>
      <Field id={fid('area')} label={d.type ? t(`areaLabel.${d.type}`) : t('fact.area')} req src={src('area')}>
        <TextInput id={fid('area')} type="number" value={d.areaSqft} disabled={dis} placeholder={t('drawer.sqft')} onCommit={(v) => h.onSet('area', v ? Number(v) : undefined)} />
      </Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <Checkbox checked={!!d.priceOnRequest} disabled={dis} onCheckedChange={(v) => h.onSet('priceOnRequest', v ? true : undefined)} />
        {t('drawer.hidePrice')}
      </label>
    </div>
  )

  /* ---------- section 2: the type's details ---------- */
  const addDetail = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const label = String(f.get('label') ?? '').trim().replace(/^./, (c) => c.toUpperCase())
    const value = String(f.get('value') ?? '').trim()
    if (label && value) { h.onExtraDetail(label, value); setAdding(null) }
  }
  let details: ReactNode = <p className="text-sm text-muted-foreground">{t('drawer.typeFirstDetails')}</p>
  let detailsStatus = t('drawer.st.typeFirst')
  let detailsDone = false
  if (def) {
    const facts = typeFacts(def.key, db.settings)
    const core = def.core.filter((k) => facts.some((f) => f.key === k))
    const coreIn = core.filter((k) => isSet(d, `spec:${k}`)).length
    const reqIn = def.required.filter((k) => isSet(d, `spec:${k}`)).length
    const shown = facts.filter((f) => def.required.includes(f.key) || core.includes(f.key) || isSet(d, `spec:${f.key}`) || extra.includes(f.key))
      .sort((a, b) => Number(def.required.includes(b.key)) - Number(def.required.includes(a.key)))
    const more = facts.filter((f) => !shown.includes(f))
    detailsDone = reqIn === def.required.length
    detailsStatus = !detailsDone ? t('drawer.st.reqFilled', { n: reqIn, total: def.required.length }) : t('drawer.st.keyDetails', { n: coreIn, total: core.length })
    details = (
      <>
        <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
          {shown.map((f) => {
            const key = `spec:${f.key}`
            const removable = !dis && !def.required.includes(f.key) && !core.includes(f.key)
            return (
              <Field key={f.key} id={fid(key)} label={L.fact(f.key, f.label)} req={def.required.includes(f.key)} src={src(key)} hint={f.hint}
                extra={<>
                  {f.added && <Tag>{t('drawer.newField')}</Tag>}
                  {removable && <RemoveButton name={L.fact(f.key, f.label)} onClick={() => { h.onSet(key, undefined); setExtra((x) => x.filter((k) => k !== f.key)) }} />}
                </>}>
                <FactInput id={fid(key)} def={f} value={d.specs[f.key]} disabled={dis} onSet={(v) => h.onSet(key, v)} />
              </Field>
            )
          })}
          <Field id={fid('facing')} label={t('fact.facing')} src={src('facing')}>
            <Select value={d.facing ?? ''} onValueChange={(v) => h.onSet('facing', v)} disabled={dis}>
              <SelectTrigger id={fid('facing')} className="w-full"><SelectValue placeholder={t('fact.choose')} /></SelectTrigger>
              <SelectContent>{FACINGS.map((f) => <SelectItem key={f} value={f}>{L.facing(f)}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          {(d.extraDetails ?? []).map((x) => {
            const id = fid(`extra:${x.label}`)
            return (
              <Field key={x.label} id={id} label={x.label}
                extra={<><Tag>{t('drawer.onlyHere')}</Tag>{!dis && <RemoveButton name={x.label} onClick={() => h.onExtraDetail(x.label, undefined)} />}</>}>
                <TextInput id={id} value={x.value} disabled={dis} onCommit={(v) => h.onExtraDetail(x.label, v || undefined)} />
              </Field>
            )
          })}
        </div>
        {d.description && (
          <p className="mt-3 text-meta text-muted-foreground"><b className="font-medium text-foreground">{t('assistant.field.description')}</b> <SourceTag source="ai" /> — {d.description}</p>
        )}
        {!dis && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-meta text-muted-foreground">{t('drawer.addDetail')}</span>
            {more.map((f) => (
              <Chip key={f.key} size="sm" dashed onClick={() => setExtra((x) => [...x, f.key])}>
                <Plus className="inline size-3" /> {L.fact(f.key, f.label).replace(/\s*\(.*\)$/, '')}
              </Chip>
            ))}
            <Chip size="sm" dashed className="font-medium" onClick={() => setAdding(adding === 'detail' ? null : 'detail')}>
              <Plus className="inline size-3" /> {t('drawer.somethingElse')}
            </Chip>
          </div>
        )}
        {adding === 'detail' && (
          <form onSubmit={addDetail} className="mt-3 flex flex-wrap gap-2">
            <Input name="label" autoFocus placeholder={t('drawer.detailLabelPh')} aria-label={t('drawer.detailLabel')} className="h-8 min-w-0 flex-1" />
            <Input name="value" placeholder={t('drawer.detailValuePh')} aria-label={t('drawer.detailValue')} className="h-8 min-w-0 flex-1" />
            <Button type="submit" size="sm">{t('action.add')}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setAdding(null)}>{t('action.cancel')}</Button>
          </form>
        )}
      </>
    )
  }

  /* ---------- section 3: amenities ---------- */
  const amenities = [...new Set([...amenityList(db.settings), ...d.amenities])]
  const addAmenity = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const v = String(new FormData(e.currentTarget).get('name') ?? '').trim()
    if (v) { if (!d.amenities.includes(v)) h.onAmenity(v.replace(/^./, (c) => c.toUpperCase())); setAdding(null) }
  }

  /* ---------- section 4: approvals ---------- */
  const docState = (id: string) => record?.approvals.find((a) => a.approvalId === id)?.status ?? 'pending'
  const addApproval = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const v = String(new FormData(e.currentTarget).get('name') ?? '').trim()
    if (v) { h.onNewApproval(v); setAdding(null) }
  }
  const approvalsStatus = d.approvals.map((a) => ft.approval(a) + (docState(a) === 'pending' ? ` · ${t('drawer.docPending')}` : '')).join(', ')

  const addLink = (what: 'amenity' | 'approval', label: string) =>
    !dis && <Button type="button" size="xs" variant="ghost" className="text-primary" onClick={() => setAdding(adding === what ? null : what)}><Plus /> {label}</Button>
  const addRow = (name: string, placeholder: string, onSubmit: (e: FormEvent<HTMLFormElement>) => void) => (
    <form onSubmit={onSubmit} className="mt-3 flex flex-wrap gap-2">
      <Input name="name" autoFocus placeholder={placeholder} aria-label={name} className="h-8 min-w-0 flex-1" />
      <Button type="submit" size="sm">{t('action.add')}</Button>
      <Button type="button" size="sm" variant="outline" onClick={() => setAdding(null)}>{t('action.cancel')}</Button>
    </form>
  )

  const steps: { k: Sec; title: string; req?: boolean; done: boolean; status: string; body: ReactNode; tools?: ReactNode }[] = [
    { k: 'basic', title: t('drawer.sec.basic'), req: true, done: basicIn === BASIC.length,
      status: basicIn === BASIC.length ? t('drawer.st.complete') : t('drawer.st.filled', { n: basicIn, total: BASIC.length }), body: basic },
    { k: 'details', title: def ? t('props.typeDetails', { type: L.type(def.key) }) : t('props.details'), req: true, done: detailsDone, status: detailsStatus, body: details },
    { k: 'amenities', title: t('drawer.sec.amenities'), done: d.amenities.length > 0,
      status: d.amenities.length ? t('drawer.st.selected', { count: d.amenities.length }) : t('drawer.st.none'),
      tools: addLink('amenity', t('drawer.addAmenity')),
      body: (
        <>
          <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            {amenities.map((a) => (
              <label key={a} className="flex items-center gap-2 text-sm">
                <Checkbox checked={d.amenities.includes(a)} disabled={dis} onCheckedChange={() => h.onAmenity(a)} />
                {t(`amenity.${a}`, { defaultValue: a })}
              </label>
            ))}
          </div>
          {adding === 'amenity' && addRow(t('drawer.addAmenity'), t('drawer.amenityPh'), addAmenity)}
        </>
      ) },
    { k: 'approvals', title: t('drawer.sec.approvals'), done: d.approvals.length > 0, status: approvalsStatus || t('drawer.st.noneTicked'),
      tools: can('property.manage') && addLink('approval', t('drawer.addApproval')),
      body: (
        <>
          <p className="mb-2 text-meta text-muted-foreground">{t('drawer.approvalsHint')}</p>
          <div className="flex flex-wrap gap-2">
            {db.settings.approvalTypes.map((a) => {
              const on = d.approvals.includes(a.id)
              const st = docState(a.id)
              return (
                <button key={a.id} type="button" disabled={dis} onClick={() => h.onApproval(a.id)} aria-pressed={on}
                  title={on ? t('drawer.clickRemove') : t('drawer.clickAdd')}
                  className={cn('flex flex-col items-start gap-0.5 rounded-lg border px-3 py-1.5 text-left text-sm font-semibold text-violet disabled:cursor-not-allowed',
                    on ? 'border-violet/50 bg-violet-soft' : 'border-dashed border-violet/40 bg-card hover:bg-violet-soft/60')}>
                  <span className="flex items-center gap-1">{on ? <Check className="size-3.5" /> : <Plus className="size-3.5" />} {ft.approval(a.id)}</span>
                  {on && <small className={cn('text-micro font-medium', st === 'pending' ? 'text-warning' : 'text-muted-foreground')}>{t(`drawer.doc.${st}`)}</small>}
                </button>
              )
            })}
          </div>
          {adding === 'approval' && addRow(t('drawer.addApproval'), t('drawer.approvalPh'), addApproval)}
        </>
      ) },
  ]

  return (
    <ol className="rounded-xl border bg-card p-4 pb-1 shadow-card sm:p-5 sm:pb-2">
      {steps.map((s, i) => {
        const open = !closed.has(s.k)
        return (
          <li key={s.k} id={`sec-${s.k}`} tabIndex={-1} className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-3 pb-5 outline-none">
            {i < steps.length - 1 && <span aria-hidden className="absolute top-9 bottom-1 left-[15px] w-0.5 rounded bg-border" />}
            <span aria-hidden className={cn('relative z-10 flex size-8 items-center justify-center rounded-full border-2 bg-card text-sm font-bold',
              s.done ? 'border-success/60 bg-success-soft text-success' : 'border-primary/30 text-primary')}>
              {s.done ? <Check className="size-4" /> : i + 1}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => toggle(s.k)} aria-expanded={open} aria-controls={`body-${s.k}`}
                  className="-mx-2 flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted">
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 font-semibold">
                    {s.title}
                    {s.req ? <StatusChip tone="danger" variant="outline">{t('drawer.required')}</StatusChip> : <StatusChip tone="neutral" variant="outline">{t('drawer.optional')}</StatusChip>}
                  </span>
                  <span className={cn('max-w-[45%] truncate text-meta', s.done ? 'text-success' : 'text-muted-foreground')}>{s.status}</span>
                  {open ? <ChevronUp className="size-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="size-4 shrink-0 text-muted-foreground" />}
                </button>
              </div>
              {open && (
                <div id={`body-${s.k}`} className="pt-3">
                  {s.tools && <div className="-mt-1 mb-2 flex justify-end">{s.tools}</div>}
                  {s.body}
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/* ---------- fields ---------- */

/** A small tag beside a label: "New field", "This property only". */
function Tag({ children }: { children: ReactNode }) {
  return <span className="inline-flex h-4 items-center rounded bg-violet-soft px-1 text-micro font-medium text-violet">{children}</span>
}

function RemoveButton({ name, onClick }: { name: string; onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <button type="button" onClick={onClick} aria-label={t('drawer.removeField', { name })} title={t('drawer.removeField', { name })}
      className="rounded p-0.5 text-muted-foreground hover:bg-danger-soft hover:text-danger"><X className="size-3" /></button>
  )
}

function Field({ id, label, req, src, hint, wide, group, extra, children }: {
  id: string; label: ReactNode; req?: boolean; src?: FactSource; hint?: ReactNode; wide?: boolean
  /** The control is a group of buttons, not one input: the label names it instead of pointing at it. */
  group?: boolean
  extra?: ReactNode; children: ReactNode
}) {
  const head = (
    <>
      {label}{req && <span aria-hidden className="text-danger">*</span>}<SourceTag source={src} />{extra}
    </>
  )
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', wide && 'sm:col-span-2')} role={group ? 'group' : undefined} aria-labelledby={group ? `${id}-label` : undefined}>
      {group ? <span id={`${id}-label`} className="flex flex-wrap items-center gap-1 text-sm font-medium">{head}</span>
        : <label htmlFor={id} className="flex flex-wrap items-center gap-1 text-sm font-medium">{head}</label>}
      {children}
      {hint && <p className="text-meta text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** A text or number box that saves when you leave it (or press Enter), so typing doesn't write a history line per key. */
function TextInput({ id, value, type = 'text', onCommit, ...rest }: {
  id: string; value?: string | number; type?: 'text' | 'number' | 'month'; onCommit: (v: string) => void
  disabled?: boolean; placeholder?: string; list?: string
}) {
  const current = value === undefined || value === null ? '' : String(value)
  return (
    <Input key={current} id={id} type={type} defaultValue={current} min={type === 'number' ? 0 : undefined} step={type === 'number' ? 'any' : undefined}
      onBlur={(e) => { const v = e.target.value.trim(); if (v !== current) onCommit(v) }}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }} {...rest} />
  )
}

function Pills({ id, value, options, disabled, onPick }: {
  id: string; value?: string; options: { value: string; label: string }[]; disabled: boolean; onPick: (v: string) => void
}) {
  return (
    <div id={id} tabIndex={-1} className="flex flex-wrap gap-1.5 rounded-lg outline-none">
      {options.map((o) => (
        <Chip key={o.value} pressed={value === o.value} disabled={disabled} onClick={() => onPick(o.value)}
          className={cn('h-8 px-3.5 disabled:cursor-not-allowed', value !== o.value && 'text-foreground')}>{o.label}</Chip>
      ))}
    </div>
  )
}

function FactInput({ id, def, value, disabled, onSet }: { id: string; def: FactDef; value?: string | number; disabled: boolean; onSet: (v: string | number | undefined) => void }) {
  const { t } = useTranslation()
  if (def.kind === 'select') {
    return (
      <Select value={value === undefined ? '' : String(value)} onValueChange={(v) => onSet(v)} disabled={disabled}>
        <SelectTrigger id={id} className="w-full"><SelectValue placeholder={t('fact.choose')} /></SelectTrigger>
        <SelectContent>{def.options!.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
      </Select>
    )
  }
  return (
    <TextInput id={id} type={def.kind === 'number' ? 'number' : def.kind === 'month' ? 'month' : 'text'} value={value} disabled={disabled}
      onCommit={(v) => onSet(v === '' ? undefined : def.kind === 'number' ? Number(v) : v)} />
  )
}
