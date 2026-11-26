/**
 * Edit in place on the lead's profile (concept D, agreed 27 Nov): click a detail and change it right there — a small
 * editor opens beside it; Enter or Save keeps it, Esc cancels; "Saved" comes with Undo for 10 seconds, and the change
 * goes on the timeline. The full Edit form stays in the ⋯ menu for rare bigger changes.
 */
import { useState, type ReactNode } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AmountInput } from '@/components/app/amount-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CITIES, FACINGS, TYPE_ORDER, amenityList } from '@/data/catalogue'
import type { BudgetBasis, BuyerPurpose, Facing, Lead, PropertyTypeKey, Requirement } from '@/data/types'
import { type AmountField, fromAmountField, toAmountField } from '@/lib/amount'
import { inrShort, num } from '@/lib/format'
import { placesMatching } from '@/lib/places'
import { cn } from '@/lib/utils'
import { useStore } from '@/store/db'

/** Save a change with a timeline note, a "Saved" message and Undo. */
function useSave(l: Lead) {
  const { t } = useTranslation()
  const { updateLead, checkpoint, restore } = useStore()
  return (change: (x: Lead) => void, what: string, from: string, to: string) => {
    if (from === to) return
    const before = checkpoint()
    updateLead(l.id, change, t('inline.note', { what, from, to }))
    toast.success(t('inline.saved', { what }), { duration: 10000, action: { label: t('ai.undo'), onClick: () => { restore(before); toast(t('ai.undone')) } } })
  }
}

/** A detail you can click to change: the value, a pencil on hover, and the editor in a popover. */
export function InlineEdit({ label, children, editor, className }: {
  label: string
  children: ReactNode
  /** The editor; `close` shuts the popover. */
  editor: (close: () => void) => ReactNode
  className?: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/* a focusable "button" that may hold paragraphs (a <button> may not); Enter or Space opens it */}
        <div role="button" tabIndex={0} title={t('inline.edit', { what: label })}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true) } }}
          className={cn('group/edit relative -mx-1.5 block w-[calc(100%+0.75rem)] cursor-pointer rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none',
            open && 'bg-accent/60 ring-1 ring-primary/30', className)}>
          <span className="sr-only">{t('inline.edit', { what: label })}: </span>
          {children}
          <Pencil className="absolute top-1.5 right-1.5 size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/edit:opacity-100 group-focus-visible/edit:opacity-100" aria-hidden />
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" side="left" className="w-80 rounded-xl p-3">
        <p className="mb-2 text-sm font-semibold">{label}</p>
        {open && editor(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  )
}

function Footer({ onCancel, disabled }: { onCancel: () => void; disabled?: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="mt-3 flex items-center gap-2">
      <span className="mr-auto text-xs text-muted-foreground">{t('inline.keys')}</span>
      <Button type="button" size="sm" variant="ghost" onClick={onCancel}>{t('action.cancel')}</Button>
      <Button type="submit" size="sm" disabled={disabled}><Check /> {t('inline.save')}</Button>
    </div>
  )
}
const chip = (on: boolean) => cn('rounded-full border px-2.5 py-1 text-sm', on ? 'border-primary bg-accent font-medium text-primary' : 'hover:bg-muted')

/** Why they're buying: one tap saves. */
export function PurposeEditor({ lead: l, close }: { lead: Lead; close: () => void }) {
  const { t } = useTranslation()
  const save = useSave(l)
  const label = (p?: BuyerPurpose) => (p ? t(`purpose.buyer.${p}`) : '—')
  return (
    <div className="flex flex-wrap gap-1.5">
      {(['ownUse', 'investment', 'rentalIncome', 'businessUse', 'secondHome', 'other'] as const).map((p) => (
        <button key={p} type="button" className={chip(l.purpose === p)} onClick={() => { save((x) => { x.purpose = p }, t('ai.purpose'), label(l.purpose), label(p)); close() }}>{label(p)}</button>
      ))}
    </div>
  )
}

/** Mobile, email and how they like to be contacted. */
export function ContactEditor({ lead: l, close }: { lead: Lead; close: () => void }) {
  const { t } = useTranslation()
  const save = useSave(l)
  const [phone, setPhone] = useState(l.phone)
  const [email, setEmail] = useState(l.email ?? '')
  const [pref, setPref] = useState(l.contactPref ?? 'call')
  const ok = (phone.match(/[\dxX]/g) ?? []).length >= 10
  const show = (p: string, e: string, c: string) => [p, e, t(`leadForm.pref.${c}`)].filter(Boolean).join(' · ')
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!ok) return; save((x) => { x.phone = phone.trim(); x.email = email.trim() || undefined; x.contactPref = pref }, t('inline.contact'), show(l.phone, l.email ?? '', l.contactPref ?? 'call'), show(phone.trim(), email.trim(), pref)); close() }}>
      <div className="flex flex-col gap-2">
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} aria-label={t('leadForm.phone')} inputMode="tel" autoFocus aria-invalid={!ok || undefined} />
        <Input value={email} onChange={(e) => setEmail(e.target.value)} aria-label={t('leadForm.email')} placeholder={t('leadForm.email')} type="email" />
        <div className="flex flex-wrap gap-1.5">{(['call', 'whatsapp', 'email'] as const).map((v) => <button key={v} type="button" className={chip(pref === v)} onClick={() => setPref(v)}>{t(`leadForm.pref.${v}`)}</button>)}</div>
      </div>
      <Footer onCancel={close} disabled={!ok} />
    </form>
  )
}

/** What they want: type, bedrooms, size. */
export function WantsEditor({ lead: l, close }: { lead: Lead; close: () => void }) {
  const { t } = useTranslation()
  const save = useSave(l)
  const r = l.requirement
  const [type, setType] = useState<PropertyTypeKey>(r.type)
  const [bhk, setBhk] = useState(r.bhk)
  const [size, setSize] = useState(r.sizeSqft ? String(r.sizeSqft) : '')
  const [facing, setFacing] = useState<Facing | undefined>(r.facing)
  const [corner, setCorner] = useState<NonNullable<Requirement['corner']>>(r.corner ?? 'any')
  const rooms = type === 'flat' || type === 'house'
  const hasFacing = type === 'plot' || rooms
  const isPlot = type === 'plot'
  const show = (ty: PropertyTypeKey, b?: string, s?: string, f?: Facing, c?: string) =>
    [b, t(`typeShort.${ty}`), s && `${num(Number(s))} sq.ft.`, f && t('lead.facingDir', { dir: t(`facing.${f}`) }), c && c !== 'any' && t(`reason.${c}`)].filter(Boolean).join(' · ')
  const label = 'mb-1.5 text-xs font-medium text-muted-foreground'
  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      save((x) => {
        x.requirement.type = type; x.requirement.bhk = rooms ? bhk : undefined; x.requirement.sizeSqft = Number(size) || undefined
        x.requirement.facing = hasFacing ? facing : undefined; x.requirement.corner = isPlot ? corner : undefined
      }, t('today.wants'), show(r.type, r.bhk, r.sizeSqft ? String(r.sizeSqft) : '', r.facing, r.corner), show(type, rooms ? bhk : undefined, size, hasFacing ? facing : undefined, isPlot ? corner : undefined))
      close()
    }}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">{TYPE_ORDER.map((v) => <button key={v} type="button" className={chip(type === v)} onClick={() => setType(v)}>{t(`typeShort.${v}`)}</button>)}</div>
        {rooms && <div className="flex flex-wrap gap-1.5">{['1 BHK', '2 BHK', '3 BHK', '4 BHK', '5+ BHK'].map((v) => <button key={v} type="button" className={chip(bhk === v)} onClick={() => setBhk(bhk === v ? undefined : v)}>{v}</button>)}</div>}
        {/* size, then facing and corner beside it — compact chips, tap again to clear */}
        <label className="flex items-center gap-2 text-sm text-muted-foreground">{t(isPlot ? 'inline.plotArea' : 'leadForm.size')}
          <Input value={size} onChange={(e) => setSize(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="h-8 w-28" placeholder="1200" />
        </label>
        {hasFacing && (
          <div role="group" aria-label={t('leadForm.facing')}>
            <p className={label}>{t('leadForm.facing')}</p>
            <div className="flex flex-wrap gap-1">{FACINGS.map((v) => <button key={v} type="button" title={t(`facing.${v}`)} className={cn(chip(facing === v), 'min-w-8 px-1.5 py-0.5 text-xs')} onClick={() => setFacing(facing === v ? undefined : v)}>{v}</button>)}</div>
          </div>
        )}
        {isPlot && (
          <div role="group" aria-label={t('leadForm.corner')}>
            <p className={label}>{t('leadForm.corner')}</p>
            <div className="flex flex-wrap gap-1">{(['any', 'corner', 'nonCorner'] as const).map((v) => <button key={v} type="button" className={cn(chip(corner === v), 'px-2.5 py-0.5 text-xs')} onClick={() => setCorner(v)}>{t(`leadForm.cornerOpt.${v}`)}</button>)}</div>
          </div>
        )}
      </div>
      <Footer onCancel={close} />
    </form>
  )
}

/** Where: the places as removable chips, and a box to add one (its city comes with it). */
export function WhereEditor({ lead: l, close }: { lead: Lead; close: () => void }) {
  const { t } = useTranslation()
  const save = useSave(l)
  const [cities, setCities] = useState(l.requirement.cities)
  const [locs, setLocs] = useState(l.requirement.localities)
  const [q, setQ] = useState('')
  const sugg = placesMatching(q, 5)
  const show = (c: string[], lo: string[]) => [...lo, ...c.filter((x) => !lo.some((y) => (CITIES[x] ?? []).includes(y)))].join(', ')
  const shown = [...locs, ...cities.filter((c) => !locs.some((y) => (CITIES[c] ?? []).includes(y)))]
  const remove = (p: string) => { if (CITIES[p]) { setCities(cities.filter((c) => c !== p)); setLocs(locs.filter((y) => !(CITIES[p] ?? []).includes(y))) } else setLocs(locs.filter((y) => y !== p)) }
  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      if (sugg[0] && q.trim()) { const p = sugg[0]; setCities([...new Set([...cities, p.city])]); if (!p.isCity) setLocs([...new Set([...locs, p.name])]); setQ(''); return }
      if (!cities.length) return
      save((x) => { x.requirement.cities = cities; x.requirement.localities = locs }, t('ai.where'), show(l.requirement.cities, l.requirement.localities), show(cities, locs))
      close()
    }}>
      <div className="flex flex-wrap gap-1.5">
        {shown.map((p) => <span key={p} className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-sm text-primary">{p}<button type="button" aria-label={t('addSheet.remove', { name: p })} onClick={() => remove(p)}><X className="size-3" /></button></span>)}
      </div>
      <div className="relative mt-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('addSheet.wherePh')} aria-label={t('ai.where')} autoFocus className="h-8" />
        {sugg.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-lg border bg-popover shadow-md">
            {sugg.map((p) => <li key={`${p.city}-${p.name}`}><button type="button" onClick={() => { setCities([...new Set([...cities, p.city])]); if (!p.isCity) setLocs([...new Set([...locs, p.name])]); setQ('') }}
              className="flex w-full justify-between px-2.5 py-1.5 text-left text-sm hover:bg-muted"><span>{p.name}</span><span className="text-xs text-muted-foreground">{p.isCity ? t('addSheet.city') : p.city}</span></button></li>)}
          </ul>
        )}
      </div>
      {!cities.length && <p className="mt-1.5 text-xs text-danger">{t('leadForm.err.cities')}</p>}
      <Footer onCancel={close} disabled={!cities.length} />
    </form>
  )
}

/** Must-have amenities: tap to add or remove. */
export function AmenitiesEditor({ lead: l, close }: { lead: Lead; close: () => void }) {
  const { t } = useTranslation()
  const { db } = useStore()
  const save = useSave(l)
  const [list, setList] = useState(l.requirement.amenities)
  const name = (a: string) => t(`amenity.${a}`, { defaultValue: a })
  const show = (xs: string[]) => xs.map(name).join(', ') || '—'
  return (
    <form onSubmit={(e) => { e.preventDefault(); save((x) => { x.requirement.amenities = list }, t('leadForm.amenities'), show(l.requirement.amenities), show(list)); close() }}>
      <div className="flex flex-wrap gap-1">
        {amenityList(db.settings).map((a) => <button key={a} type="button" className={cn(chip(list.includes(a)), 'px-2.5 py-0.5 text-xs')} onClick={() => setList(list.includes(a) ? list.filter((y) => y !== a) : [...list, a])}>{name(a)}</button>)}
      </div>
      <Footer onCancel={close} />
    </form>
  )
}

/** Money: the budget range, what it includes, and how they'll pay. */
export function MoneyEditor({ lead: l, close }: { lead: Lead; close: () => void }) {
  const { t } = useTranslation()
  const save = useSave(l)
  const b = l.budget
  const unit = b.max >= 1e7 ? 'Cr' : 'L'
  const [min, setMin] = useState<AmountField>(toAmountField(b.min, unit))
  const [max, setMax] = useState<AmountField>(toAmountField(b.max, unit))
  const [basis, setBasis] = useState<BudgetBasis | undefined>(b.basis)
  const [funding, setFunding] = useState(l.qualification.funding)
  const lo = fromAmountField(min) ?? 0, hi = fromAmountField(max)
  const ok = !!hi && lo <= hi
  const show = (a: number, z: number, bs?: BudgetBasis, f?: string) => [`${inrShort(a)} – ${inrShort(z)}`, bs && t(`leadForm.basisOpt.${bs}`), f && t(`qual.answer.fundingType.${f}`)].filter(Boolean).join(' · ')
  return (
    <form onSubmit={(e) => {
      e.preventDefault(); if (!ok) return
      save((x) => { x.budget = { ...x.budget, min: lo, max: hi!, preferred: Math.min(Math.max(x.budget.preferred, lo), hi!), basis }; x.qualification.funding = funding },
        t('lead.group.money'), show(b.min, b.max, b.basis, l.qualification.funding), show(lo, hi!, basis, funding))
      close()
    }}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <AmountInput label={t('leadForm.min')} value={min} onChange={setMin} />
          <AmountInput label={t('leadForm.max')} value={max} onChange={setMax} required invalid={!ok} />
        </div>
        <div role="group" aria-label={t('inline.includes')}>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground" title={t('leadForm.basisHint')}>{t('inline.includes')}</p>
          <div className="flex flex-wrap gap-1.5">{(['none', 'propertyOnly', 'withCosts', 'withLoan'] as const).map((v) => <button key={v} type="button" className={chip((basis ?? 'none') === v)} onClick={() => setBasis(v === 'none' ? undefined : v)}>{t(`leadForm.basisOpt.${v}`)}</button>)}</div>
        </div>
        <div role="group" aria-label={t('qual.q.fundingType')}>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t('qual.q.fundingType')}</p>
          <div className="flex flex-wrap gap-1.5">{(['own', 'loan', 'combination'] as const).map((v) => <button key={v} type="button" className={chip(funding === v)} onClick={() => setFunding(v)}>{t(`qual.answer.fundingType.${v}`)}</button>)}</div>
        </div>
      </div>
      <Footer onCancel={close} disabled={!ok} />
    </form>
  )
}
