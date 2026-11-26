/**
 * Add lead as a 3-step side sheet (concept C, agreed 27 Nov): it opens over the Focus list instead of a long page.
 * 1 Who · 2 What they want · 3 Money & consent, with a progress bar; big tiles and chips; places that bring their city;
 * the rest under "More details". The assistant sits on top (paste a WhatsApp message or speak) and fills the steps; a live
 * preview shows the lead taking shape, the duplicate check and how many properties already fit.
 * Same rules as the Add lead form: name, a 10-digit mobile, purpose, maximum budget and one city; follow-up only with consent.
 */
import { useMemo, useState, type ReactNode } from 'react'
import {
  Building, Building2, Check, CornerDownLeft, Factory, Home, LandPlot, Mic, MicOff, Plus, Sparkles, Store, Trees, X, type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AmountInput } from '@/components/app/amount-input'
import { UserAvatar } from '@/components/app/user-avatar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { CITIES, TYPE_ORDER, amenityList } from '@/data/catalogue'
import type { BudgetBasis, BuyerPurpose, Lead, PropertyTypeKey } from '@/data/types'
import { understand } from '@/lib/ai/understand'
import { type Place, placesMatching } from '@/lib/places'
import { type AmountField, fromAmountField, toAmountField } from '@/lib/amount'
import { addDays, fmtDate, inrShort } from '@/lib/format'
import { propertiesForLead } from '@/lib/matching'
import { cn } from '@/lib/utils'
import { useCan, useStore, useVisibleLeads, userName } from '@/store/db'
import { useSpeech } from '../assistant/use-speech'
import { isActive } from './lead-list'

const TYPE_ICON: Record<PropertyTypeKey, LucideIcon> = { plot: LandPlot, flat: Building, house: Home, commercial: Store, agri: Trees, industrial: Factory }
const PURPOSES: BuyerPurpose[] = ['ownUse', 'investment', 'rentalIncome', 'businessUse', 'secondHome', 'other']
const BHK = ['1 BHK', '2 BHK', '3 BHK', '4 BHK', '5+ BHK']
const SOURCES = ['Walk-in', 'Phone enquiry', 'Website', 'Referral', 'Property portal', 'Social media', 'Channel partner']
const SOURCE_KEY: Record<string, string> = { Website: 'website', 'Walk-in': 'walkIn', 'Phone enquiry': 'phone', Referral: 'referral', 'Property portal': 'portal', 'Social media': 'social', 'Channel partner': 'partner' }
const VIA = ['whatsapp', 'call', 'inPerson', 'form'] as const
/** Quick budget ranges (min, max in rupees); exact values in lakh / crore below. */
const PRESETS: [number, number][] = [[0, 30e5], [30e5, 60e5], [60e5, 1e7], [1e7, 3e7], [3e7, 0]]

type S = {
  name: string; phone: string; contactPref: NonNullable<Lead['contactPref']>; source: string
  type?: PropertyTypeKey; bhk?: string; cities: string[]; localities: string[]; sizeSqft: string; amenities: string[]
  purpose?: BuyerPurpose; min: AmountField; max: AmountField; basis?: BudgetBasis; funding: Lead['qualification']['funding']
  consent: boolean; consentVia: (typeof VIA)[number]; ownerId: string
}
const EMPTY: S = { name: '', phone: '', contactPref: 'call', source: 'Walk-in', cities: [], localities: [], sizeSqft: '', amenities: [], min: toAmountField(), max: toAmountField(), funding: 'own', consent: false, consentVia: 'call', ownerId: '' }

export function AddLeadSheet({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const { t } = useTranslation()
  const { db, today, user, addLead } = useStore()
  const can = useCan()
  const manager = can('lead.seeAll')
  const leads = useVisibleLeads()
  const executives = db.users.filter((u) => u.role === 'executive')
  const [s, setS] = useState<S>(EMPTY)
  const [step, setStep] = useState(0)
  const [tried, setTried] = useState<number[]>([])
  const [more, setMore] = useState(false)
  const [place, setPlace] = useState('')
  const [said, setSaid] = useState('')
  const [was, setWas] = useState(false)
  if (open !== was) { setWas(open); if (open) { setS(EMPTY); setStep(0); setTried([]); setMore(false); setPlace(''); setSaid('') } }
  const set = <K extends keyof S>(k: K, v: S[K]) => setS((x) => ({ ...x, [k]: v }))
  const speech = useSpeech((heard, final) => { setSaid(heard); if (final) fill(heard) })

  const max = fromAmountField(s.max), min = fromAmountField(s.min)
  const digits = (s.phone.match(/\d/g) ?? []).length
  const dup = digits >= 10 ? db.leads.find((l) => l.phone.replace(/\D/g, '').endsWith(s.phone.replace(/\D/g, '').slice(-10))) : undefined
  const errs: Record<string, boolean>[] = [
    { name: !s.name.trim(), phone: digits < 10 || !!dup },
    { type: !s.type, cities: !s.cities.length },
    { purpose: !s.purpose, max: !max || (!!min && min > max) },
  ]
  const stepOk = (i: number) => !Object.values(errs[i]).some(Boolean)
  const show = (i: number, k: string) => tried.includes(i) && !!errs[i][k]

  // the live preview: how many properties already fit
  const fits = useMemo(() => {
    if (!s.type || !s.cities.length || !max) return undefined
    const probe = {
      id: '', name: '', phone: '', source: '', enquiryDate: today, ownerId: null, stage: 'new', stageSince: today, recommendedPropertyIds: [], visits: [], activity: [],
      qualification: { need: 'partly', timeline: 'undecided', authority: 'unknown', funding: s.funding, fundingReady: 'undecided' },
      engagement: { responded: false, docsRequested: false, siteVisited: false }, budget: { min: min ?? 0, preferred: max, max, flexPct: 0 },
      requirement: { type: s.type, cities: s.cities, localities: s.localities, amenities: [], approvalRequired: true, ...(s.bhk ? { bhk: s.bhk } : {}) },
    } as Lead
    return propertiesForLead(probe, db.properties.filter((p) => p.status === 'available' && !p.archived), db.settings).length
  }, [s.type, s.cities, s.localities, s.bhk, s.funding, min, max, today, db.properties, db.settings])

  /** The assistant: a pasted message or what was said fills every step it can. */
  function fill(text: string) {
    const r = understand(/\b(new|add)\s+(lead|enquiry|customer)\b/i.test(text) ? text : `new lead ${text}`, { db, today, leads })
    if (r.kind !== 'addLead') { toast(t('ai.unknown')); return }
    const f = r.fields
    setS((x) => ({
      ...x, name: f.name ?? x.name, phone: f.phone ?? x.phone, contactPref: f.contactPref ?? x.contactPref, source: f.source ?? x.source,
      type: f.type ?? x.type, bhk: f.bhk ?? x.bhk, cities: [...new Set([...x.cities, ...f.cities])], localities: [...new Set([...x.localities, ...f.localities])],
      sizeSqft: f.sizeSqft ? String(f.sizeSqft) : x.sizeSqft, purpose: f.purpose ?? x.purpose,
      min: f.min ? toAmountField(f.min, f.min >= 1e7 ? 'Cr' : 'L') : x.min, max: f.max ? toAmountField(f.max, f.max >= 1e7 ? 'Cr' : 'L') : x.max,
      consent: f.consent ?? x.consent, consentVia: f.contactPref === 'whatsapp' ? 'whatsapp' : x.consentVia,
    }))
    setSaid('')
    toast.success(t('addSheet.filled'))
  }
  const addPlace = (p: Place) => {
    setS((x) => ({ ...x, cities: [...new Set([...x.cities, p.city])], localities: p.isCity ? x.localities : [...new Set([...x.localities, p.name])] }))
    setPlace('')
  }
  const suggestions = placesMatching(place)

  const next = () => { setTried((x) => [...new Set([...x, step])]); if (stepOk(step)) setStep(step + 1) }
  const create = () => {
    setTried([0, 1, 2])
    const bad = [0, 1, 2].find((i) => !stepOk(i))
    if (bad !== undefined) { setStep(bad); return }
    const owner = manager ? s.ownerId || [...executives].sort((a, b) =>
      db.leads.filter((l) => l.ownerId === a.id && isActive(l)).length - db.leads.filter((l) => l.ownerId === b.id && isActive(l)).length)[0]?.id || user.id : user.id
    const follow = s.consent ? addDays(today, 1) : undefined
    const note = t('leadForm.noteCreated', { owner: userName(db, owner) }) + ' ' + (follow ? t('leadForm.noteFollow', { date: fmtDate(follow) }) : t('leadForm.noteNoConsent'))
    const id = addLead((nid) => ({
      id: nid, name: s.name.trim(), phone: s.phone.trim(), source: s.source, enquiryDate: today, ownerId: owner, purpose: s.purpose, contactPref: s.contactPref,
      qualification: { need: 'partly', timeline: 'undecided', authority: 'unknown', funding: s.funding, fundingReady: 'undecided' },
      engagement: { responded: false, docsRequested: false, siteVisited: false },
      budget: { min: min ?? 0, preferred: max!, max: max!, flexPct: 0, ...(s.basis ? { basis: s.basis } : {}) },
      requirement: { type: s.type!, cities: s.cities, localities: s.localities, sizeSqft: Number(s.sizeSqft) || undefined, amenities: s.amenities, approvalRequired: true, ...(s.bhk ? { bhk: s.bhk } : {}) },
      stage: 'new', stageSince: today, nextFollowUp: follow, recommendedPropertyIds: [], visits: [], activity: [],
      consent: s.consent ? { followUp: true, at: today, how: s.consentVia } : undefined,
    }), note)
    toast.success(t('leadForm.created', { id }))
    onOpenChange(false)
    onCreated(id)
  }

  const chip = (on: boolean) => cn('rounded-full border px-3 py-1.5 text-sm transition-colors', on ? 'border-primary bg-accent font-medium text-primary' : 'hover:border-primary/40 hover:bg-muted')
  const STEPS = [t('addSheet.step.who'), t('addSheet.step.want'), t('addSheet.step.money')]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 data-[side=right]:sm:max-w-4xl">
        <div className="grid h-full min-h-0 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="flex min-h-0 flex-col">
            {/* title and progress */}
            <div className="border-b px-5 pt-4 pb-3 sm:px-6">
              <SheetTitle className="text-lg">{t('addSheet.title')}</SheetTitle>
              <SheetDescription className="sr-only">{t('addSheet.desc')}</SheetDescription>
              <ol className="mt-3 grid grid-cols-3 gap-2">
                {STEPS.map((label, i) => (
                  <li key={label}>
                    <button type="button" onClick={() => (i < step || stepOk(Math.max(0, i - 1)) ? setStep(i) : undefined)} aria-current={step === i ? 'step' : undefined} className="block w-full text-left">
                      <span className={cn('block h-1 rounded-full', i < step ? 'bg-primary/45' : i === step ? 'bg-primary' : 'bg-muted')} />
                      <span className={cn('mt-1.5 block text-xs', i === step ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{i + 1} · {label}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4 sm:px-6">
              {/* the assistant: paste or speak; it fills the steps */}
              <div className="rounded-2xl border border-violet/20 bg-violet-soft/40 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="size-4 text-violet" /> {t('addSheet.ai')}</p>
                <form onSubmit={(e) => { e.preventDefault(); if (said.trim()) fill(said) }} className="flex items-center gap-2 rounded-xl border bg-card py-1 pr-1 pl-3">
                  <Textarea rows={1} value={said} onChange={(e) => setSaid(e.target.value)} aria-label={t('addSheet.ai')} placeholder={t('addSheet.aiPh')}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (said.trim()) fill(said) } }}
                    className="field-sizing-content max-h-28 min-h-9 flex-1 resize-none border-0 bg-transparent px-0 py-1.5 text-sm shadow-none focus-visible:ring-0 md:text-sm" />
                  {speech.supported && (
                    <Button type="button" size="icon" variant="outline" className={cn('size-8 shrink-0', speech.listening && 'border-danger text-danger')} aria-label={t('ai.speak')}
                      onClick={() => (speech.listening ? speech.stop() : speech.start())}>{speech.listening ? <MicOff /> : <Mic />}</Button>
                  )}
                  <Button type="submit" size="icon" className="size-8 shrink-0" aria-label={t('ai.send')} disabled={!said.trim()}><CornerDownLeft /></Button>
                </form>
              </div>

              {step === 0 && (
                <>
                  <Q label={t('leadForm.name')} error={show(0, 'name') ? t('leadForm.err.name') : undefined}>
                    <Input value={s.name} onChange={(e) => set('name', e.target.value)} aria-label={t('leadForm.name')} autoFocus className="h-10" placeholder={t('addSheet.namePh')} />
                  </Q>
                  <Q label={t('leadForm.phone')} error={show(0, 'phone') && !dup ? t('leadForm.err.phone') : undefined}>
                    <Input value={s.phone} onChange={(e) => set('phone', e.target.value)} aria-label={t('leadForm.phone')} inputMode="tel" placeholder="+91" className={cn('h-10', digits >= 10 && !dup && 'border-success/50')} />
                    {digits >= 10 && (dup
                      ? <p className="mt-1.5 text-xs text-danger">{t('ai.check.dup', { id: dup.id, name: dup.name })}</p>
                      : <p className="mt-1.5 flex items-center gap-1 text-xs text-success"><Check className="size-3.5" /> {t('ai.check.noDup')}</p>)}
                  </Q>
                  <Q label={t('leadForm.contactPref')}>
                    <div className="flex flex-wrap gap-1.5">{(['call', 'whatsapp', 'email'] as const).map((v) => <button key={v} type="button" className={chip(s.contactPref === v)} onClick={() => setS((x) => ({ ...x, contactPref: v, consentVia: v === 'whatsapp' ? 'whatsapp' : 'call' }))}>{t(`leadForm.pref.${v}`)}</button>)}</div>
                  </Q>
                  <Q label={t('leadForm.sourceLabel')}>
                    <div className="flex flex-wrap gap-1.5">{SOURCES.map((v) => <button key={v} type="button" className={chip(s.source === v)} onClick={() => set('source', v)}>{t(`leadForm.source.${SOURCE_KEY[v]}`)}</button>)}</div>
                  </Q>
                </>
              )}

              {step === 1 && (
                <>
                  <Q label={t('addSheet.lookingFor')} error={show(1, 'type') ? t('addSheet.err.type') : undefined}>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {TYPE_ORDER.map((v) => {
                        const Icon = TYPE_ICON[v]
                        return (
                          <button key={v} type="button" onClick={() => set('type', v)} aria-pressed={s.type === v}
                            className={cn('flex items-center gap-2.5 rounded-xl border p-2.5 text-left text-sm font-medium transition-colors', s.type === v ? 'border-primary bg-accent text-primary ring-3 ring-primary/10' : 'hover:border-primary/40 hover:bg-muted')}>
                            <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', s.type === v ? 'bg-card' : 'bg-muted')}><Icon className="size-4" /></span>
                            {t(`typeShort.${v}`)}
                          </button>
                        )
                      })}
                    </div>
                  </Q>
                  {(s.type === 'flat' || s.type === 'house') && (
                    <Q label={t('leadForm.bhk')}><div className="flex flex-wrap gap-1.5">{BHK.map((v) => <button key={v} type="button" className={chip(s.bhk === v)} onClick={() => set('bhk', s.bhk === v ? undefined : v)}>{v}</button>)}</div></Q>
                  )}
                  <Q label={t('addSheet.where')} hint={t('addSheet.whereHint')} error={show(1, 'cities') ? t('leadForm.err.cities') : undefined}>
                    <div className="relative">
                      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border bg-card px-2 py-1.5 focus-within:border-primary/60 focus-within:ring-3 focus-within:ring-ring/15">
                        {[...s.localities, ...s.cities.filter((c) => !s.localities.some((loc) => (CITIES[c] ?? []).includes(loc)))].map((p) => (
                          <span key={p} className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-sm text-primary">
                            {p}
                            <button type="button" aria-label={t('addSheet.remove', { name: p })} onClick={() => setS((x) => (CITIES[p] ? { ...x, cities: x.cities.filter((c) => c !== p), localities: x.localities.filter((loc) => !(CITIES[p] ?? []).includes(loc)) } : { ...x, localities: x.localities.filter((loc) => loc !== p) }))}><X className="size-3" /></button>
                          </span>
                        ))}
                        <input value={place} onChange={(e) => setPlace(e.target.value)} aria-label={t('addSheet.where')} placeholder={t('addSheet.wherePh')}
                          onKeyDown={(e) => { if (e.key === 'Enter' && suggestions[0]) { e.preventDefault(); addPlace(suggestions[0]) } }}
                          className="min-w-32 flex-1 bg-transparent py-1 text-sm outline-none" />
                        {s.cities.length > 0 && <span className="text-xs text-muted-foreground">{s.cities.join(', ')}</span>}
                      </div>
                      {suggestions.length > 0 && (
                        <ul className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border bg-popover shadow-lg">
                          {suggestions.map((p) => (
                            <li key={`${p.city}-${p.name}`}><button type="button" onClick={() => addPlace(p)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted">
                              <span>{p.name}</span><span className="text-xs text-muted-foreground">{p.isCity ? t('addSheet.city') : p.city}</span></button></li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </Q>
                  <button type="button" onClick={() => setMore(!more)} aria-expanded={more} className="flex items-center justify-between rounded-xl border border-dashed px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted/50">
                    <span className="flex items-center gap-1.5"><Plus className={cn('size-4 transition-transform', more && 'rotate-45')} /> {t('addSheet.more')}</span>
                    <span className="text-xs">{t('leadForm.optional')}</span>
                  </button>
                  {more && (
                    <div className="flex flex-col gap-4 rounded-xl bg-muted/30 p-3">
                      <Q label={t('leadForm.size')}><Input inputMode="numeric" value={s.sizeSqft} onChange={(e) => set('sizeSqft', e.target.value.replace(/\D/g, ''))} aria-label={t('leadForm.size')} className="h-9 max-w-40" placeholder="1200" /></Q>
                      <Q label={t('leadForm.amenities')}>
                        <div className="flex flex-wrap gap-1.5">{amenityList(db.settings).map((a) => <button key={a} type="button" className={chip(s.amenities.includes(a))} onClick={() => set('amenities', s.amenities.includes(a) ? s.amenities.filter((y) => y !== a) : [...s.amenities, a])}>{t(`amenity.${a}`, { defaultValue: a })}</button>)}</div>
                      </Q>
                    </div>
                  )}
                </>
              )}

              {step === 2 && (
                <>
                  <Q label={t('leadForm.sec.purpose')} error={show(2, 'purpose') ? t('leadForm.err.purpose') : undefined}>
                    <div className="flex flex-wrap gap-1.5">{PURPOSES.map((v) => <button key={v} type="button" className={chip(s.purpose === v)} onClick={() => set('purpose', v)}>{t(`purpose.buyer.${v}`)}</button>)}</div>
                  </Q>
                  <Q label={t('addSheet.budget')} error={show(2, 'max') ? t('leadForm.err.max') : undefined}>
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {PRESETS.map(([a, b]) => {
                        const on = (min ?? 0) === a && (b ? max === b : !!max && max > a && !min)
                        return <button key={`${a}-${b}`} type="button" className={chip(on)} onClick={() => setS((x) => ({ ...x, min: toAmountField(a || undefined, a >= 1e7 ? 'Cr' : 'L'), max: toAmountField(b || a * 2, (b || a * 2) >= 1e7 ? 'Cr' : 'L') }))}>
                          {!a ? t('addSheet.upTo', { amount: inrShort(b) }) : !b ? t('addSheet.above', { amount: inrShort(a) }) : `${inrShort(a)} – ${inrShort(b)}`}
                        </button>
                      })}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <AmountInput label={t('leadForm.min')} value={s.min} onChange={(v) => set('min', v)} hint={t('leadForm.optional')} />
                      <AmountInput label={t('leadForm.max')} value={s.max} onChange={(v) => set('max', v)} required invalid={show(2, 'max')} />
                    </div>
                  </Q>
                  <Q label={t('leadForm.basis')} hint={t('leadForm.basisHint')}>
                    <div className="flex flex-wrap gap-1.5">{(['none', 'propertyOnly', 'withCosts', 'withLoan'] as const).map((v) => <button key={v} type="button" className={chip((s.basis ?? 'none') === v)} onClick={() => set('basis', v === 'none' ? undefined : v)}>{t(`leadForm.basisOpt.${v}`)}</button>)}</div>
                  </Q>
                  <Q label={t('qual.q.fundingType')}>
                    <div className="flex flex-wrap gap-1.5">{(['own', 'loan', 'combination'] as const).map((v) => <button key={v} type="button" className={chip(s.funding === v)} onClick={() => set('funding', v)}>{t(`qual.answer.fundingType.${v}`)}</button>)}</div>
                  </Q>
                  <div className={cn('rounded-xl border p-3', s.consent ? 'border-success/40 bg-success-soft/40' : '')}>
                    <label className="flex items-start gap-3">
                      <Checkbox checked={s.consent} onCheckedChange={(v) => set('consent', !!v)} className="mt-0.5" />
                      <span className="text-sm"><b className="font-medium">{t('leadForm.consent')}</b><span className="block text-xs text-muted-foreground">{t('leadForm.consentSay')}</span></span>
                    </label>
                    {s.consent && <div className="mt-2 flex flex-wrap gap-1.5 pl-7">{VIA.map((v) => <button key={v} type="button" className={chip(s.consentVia === v)} onClick={() => set('consentVia', v)}>{t(`lead.consent.via.${v}`)}</button>)}</div>}
                  </div>
                  {manager && (
                    <Q label={t('leadForm.owner')}>
                      <div className="flex flex-wrap gap-1.5">
                        <button type="button" className={chip(!s.ownerId)} onClick={() => set('ownerId', '')}>{t('addSheet.auto')}</button>
                        {executives.map((u) => <button key={u.id} type="button" className={cn(chip(s.ownerId === u.id), 'inline-flex items-center gap-1.5 pl-1.5')} onClick={() => set('ownerId', u.id)}><UserAvatar name={u.name} size="xs" className="size-5" />{u.name}</button>)}
                      </div>
                    </Q>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-2 border-t px-5 py-3 sm:px-6">
              {step > 0 ? <Button variant="outline" onClick={() => setStep(step - 1)}>← {t('addSheet.back')}</Button> : <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('action.cancel')}</Button>}
              <span className="flex-1" />
              {step < 2 ? <Button onClick={next}>{t('addSheet.next', { step: STEPS[step + 1] })} →</Button> : <Button onClick={create}><Check /> {t('leadForm.create')}</Button>}
            </div>
          </div>

          {/* the lead taking shape */}
          <aside className="hidden flex-col gap-3 overflow-y-auto border-l bg-muted/30 p-4 lg:flex">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('addSheet.preview')}</p>
            <div className="flex flex-col gap-2.5 rounded-2xl border bg-card p-3.5">
              <div className="flex items-center gap-2.5">
                {s.name.trim() ? <UserAvatar name={s.name} /> : <span className="grid size-9 place-items-center rounded-full bg-muted text-muted-foreground"><Building2 className="size-4" /></span>}
                <div className="min-w-0"><p className="truncate font-semibold">{s.name.trim() || t('addSheet.noName')}</p><p className="truncate text-xs text-muted-foreground">{s.phone || '—'} · {t(`leadForm.pref.${s.contactPref}`)}</p></div>
              </div>
              <Row k={t('today.wants')} v={[s.bhk, s.type && t(`typeShort.${s.type}`)].filter(Boolean).join(' ') || '—'} />
              <Row k={t('ai.where')} v={(s.localities.length ? s.localities : s.cities).join(', ') || '—'} />
              <Row k={t('lead.group.money')} v={max ? `${min ? inrShort(min) + ' – ' : t('ai.upTo') + ' '}${inrShort(max)}` : '—'} />
              <Row k={t('ai.purpose')} v={s.purpose ? t(`purpose.buyer.${s.purpose}`) : '—'} />
            </div>
            <div className="flex flex-col gap-1.5 rounded-2xl border bg-card p-3.5 text-sm">
              {digits >= 10 && (dup ? <p className="text-danger">{t('ai.check.dup', { id: dup.id, name: dup.name })}</p> : <p className="flex items-center gap-1.5 text-success"><Check className="size-4" /> {t('ai.check.noDup')}</p>)}
              {fits !== undefined && <p className="font-medium">{fits ? t('ai.check.fits', { count: fits }) : t('ai.check.noneFits')}</p>}
              <p className={s.consent ? 'text-success' : 'text-muted-foreground'}>{s.consent ? t('ai.check.consent', { date: fmtDate(addDays(today, 1)) }) : t('ai.check.noConsent')}</p>
            </div>
            <p className="text-xs text-muted-foreground">{t('addSheet.previewHint')}</p>
          </aside>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Q({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className={cn('text-sm font-semibold', error && 'text-danger')}>{label}{hint && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{hint}</span>}</p>
      {children}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return <p className="flex justify-between gap-3 text-sm"><span className="text-muted-foreground">{k}</span><span className="truncate text-right font-medium">{v}</span></p>
}
