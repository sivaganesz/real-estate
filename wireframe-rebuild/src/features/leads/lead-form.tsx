/**
 * Add / Edit lead (old wireframe views-customers.js, "Add customer"): collect only what's needed, say why, and record
 * consent for follow-up. Five short sections — contact, why they're buying, budget, what they want, how ready they are.
 * Required: name, mobile, purpose, maximum budget and at least one city (as before).
 * - A new lead starts at "New enquiry"; with consent its first follow-up is tomorrow, without it none is planned.
 * - A manager picks the owner (or "Auto-assign" to the executive with the fewest open leads); an executive's new lead is theirs.
 * - Editing changes the details only: the stage, consent, visits and timeline are changed on the lead page.
 */
import { useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Check, CornerDownLeft, Lock, Mic, MicOff, ShieldCheck, ShieldX, Sparkles, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AmountInput } from '@/components/app/amount-input'
import { Callout } from '@/components/app/callout'
import { EmptyState } from '@/components/app/empty-state'
import { Page, PageHeader } from '@/components/app/page-header'
import { SectionCard } from '@/components/app/section-card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCrumbs } from '@/components/layout/crumbs'
import { CITIES, FACINGS, TYPE_ORDER, amenityList } from '@/data/catalogue'
import type { BudgetBasis, BuyerPurpose, Facing, Lead, PropertyTypeKey, Requirement } from '@/data/types'
import { type AmountField, fromAmountField, toAmountField } from '@/lib/amount'
import { hasFollowUpConsent } from '@/lib/consent'
import { addDays, fmtDate, inrShort } from '@/lib/format'
import { useLabels } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { useCan, useStore, useVisibleLeads, userName } from '@/store/db'
import { type NewLeadFields, readLeadDetails } from '@/lib/ai/understand'
import { Textarea } from '@/components/ui/textarea'
import { useSpeech } from '../assistant/use-speech'
import { AssistantBox } from '../assistant/assistant-box'
import { isActive } from './lead-list'

const PURPOSES: BuyerPurpose[] = ['ownUse', 'investment', 'rentalIncome', 'businessUse', 'secondHome', 'other']
/** Stored as written (the seed and imports use these words); shown through `leadForm.source.*` when translated. */
const SOURCES = ['Website', 'Walk-in', 'Phone enquiry', 'Referral', 'Property portal', 'Social media', 'Channel partner'] as const
const SOURCE_KEY: Record<string, string> = {
  Website: 'website', 'Walk-in': 'walkIn', 'Phone enquiry': 'phone', Referral: 'referral', 'Property portal': 'portal', 'Social media': 'social', 'Channel partner': 'partner',
}
const CONSENT_VIA = ['whatsapp', 'call', 'inPerson', 'form'] as const
const BHK = ['1 BHK', '2 BHK', '3 BHK', '4 BHK', '5+ BHK']
const Q = {
  need: ['clear', 'partly', 'exploring'],
  timeline: ['m1', 'm1to3', 'm3to6', 'm6to12', 'undecided'],
  authority: ['sole', 'joint', 'needsApproval', 'unknown'],
  funding: ['own', 'loan', 'combination'],
  fundingReady: ['ready', 'arranging', 'undecided'],
} as const
/** Which extra questions each property type asks (the rest of the requirement is common). */
const TYPE_FIELDS: Record<PropertyTypeKey, ('bhk' | 'possession' | 'parking' | 'facing' | 'road' | 'corner' | 'commCategory' | 'occupancy')[]> = {
  plot: ['facing', 'road', 'corner'],
  flat: ['bhk', 'possession', 'parking', 'facing'],
  house: ['bhk', 'possession', 'parking', 'facing'],
  commercial: ['commCategory', 'occupancy', 'parking', 'road'],
  agri: ['road'],
  industrial: ['road'],
}

type Draft = {
  name: string; phone: string; email: string; contactPref: NonNullable<Lead['contactPref']>; source: string; enquiryDate: string; ownerId: string
  purpose?: BuyerPurpose; purposeNote: string
  min: AmountField; preferred: AmountField; max: AmountField; flexPct: string; basis?: BudgetBasis
  q: Lead['qualification']
  type: PropertyTypeKey; cities: string[]; localities: string[]; sizeSqft: string; bhk?: string; possession: NonNullable<Requirement['possession']>
  parking: NonNullable<Requirement['parking']>; facing?: Facing; minRoadFt: string; corner: NonNullable<Requirement['corner']>; commCategory: string
  occupancy: NonNullable<Requirement['occupancy']>; amenities: string[]; approvalRequired: boolean
  consent: boolean; consentVia: (typeof CONSENT_VIA)[number]
}

const draftOf = (l: Lead | undefined, today: string, ownerId: string): Draft => {
  const r = l?.requirement, b = l?.budget
  const unit = b && b.max >= 1e7 ? 'Cr' : 'L'
  return {
    name: l?.name ?? '', phone: l?.phone ?? '', email: l?.email ?? '', contactPref: l?.contactPref ?? 'call', source: l?.source ?? 'Walk-in',
    enquiryDate: l?.enquiryDate ?? today, ownerId: l ? l.ownerId ?? '' : ownerId,
    purpose: l?.purpose, purposeNote: l?.purposeNote ?? '',
    min: toAmountField(b?.min, unit), preferred: toAmountField(b?.preferred, unit), max: toAmountField(b?.max, unit), flexPct: b?.flexPct ? String(b.flexPct) : '', basis: b?.basis,
    q: l?.qualification ?? { need: 'partly', timeline: 'undecided', authority: 'unknown', funding: 'own', fundingReady: 'undecided' },
    type: r?.type ?? 'plot', cities: r?.cities ?? [], localities: r?.localities ?? [], sizeSqft: r?.sizeSqft ? String(r.sizeSqft) : '',
    bhk: r?.bhk, possession: r?.possession ?? 'any', parking: r?.parking ?? 'preferred', facing: r?.facing, minRoadFt: r?.minRoadFt ? String(r.minRoadFt) : '',
    corner: r?.corner ?? 'any', commCategory: r?.commCategory ?? '', occupancy: r?.occupancy ?? 'any', amenities: r?.amenities ?? [],
    approvalRequired: r?.approvalRequired ?? true,
    consent: false, consentVia: 'call',
  }
}

/** What the assistant read from a message, filled into the form ("Review all details"); the rest keeps its defaults. */
const withPrefill = (d: Draft, p: NewLeadFields): Draft => {
  const unit = p.max && p.max >= 1e7 ? 'Cr' : 'L'
  return {
    ...d,
    name: p.name ?? d.name, phone: p.phone ?? d.phone, email: p.email ?? d.email, contactPref: p.contactPref ?? d.contactPref, source: p.source ?? d.source,
    purpose: p.purpose ?? d.purpose, type: p.type ?? d.type, bhk: p.bhk ?? d.bhk, cities: p.cities.length ? p.cities : d.cities,
    localities: p.localities.length ? p.localities : d.localities, sizeSqft: p.sizeSqft ? String(p.sizeSqft) : d.sizeSqft,
    min: p.min ? toAmountField(p.min, unit) : d.min, max: p.max ? toAmountField(p.max, unit) : d.max,
    consent: p.consent ?? d.consent, consentVia: p.contactPref === 'whatsapp' ? 'whatsapp' : d.consentVia,
  }
}

export function LeadFormPage() {
  const { id } = useParams()
  const { t } = useTranslation()
  const { db } = useStore()
  const visible = useVisibleLeads()
  const lead = id ? db.leads.find((l) => l.id === id) : undefined
  const location = useLocation()
  const prefill = (location.state as { prefill?: NewLeadFields } | null)?.prefill
  const [manual, setManual] = useState(false)
  useCrumbs([{ label: t('nav.group.specData') }, { label: t('nav.leads'), to: '/leads' }, ...(lead ? [{ label: lead.id, to: `/leads/${lead.id}` }] : []), { label: id ? t('leadForm.editCrumb') : t('leadForm.addCrumb') }])
  if (id && (!lead || !visible.some((l) => l.id === id))) {
    return (
      <Page>
        <EmptyState icon={lead ? Lock : UserRound} title={lead ? t('lead.notYours') : t('lead.notFound')}
          action={<Button asChild variant="outline"><Link to="/leads"><ArrowLeft /> {t('lead.back')}</Link></Button>} />
      </Page>
    )
  }
  // a new lead starts with the assistant (decision 3, 26 Nov); "Review all details" or "Fill in the form" opens the form
  if (!id && !prefill && !manual) return <NewLeadAssistant onForm={() => setManual(true)} />
  return <LeadForm key={`${id ?? 'new'}-${location.key}`} base={lead} prefill={prefill} />
}

/** Add lead, chat first: describe the lead in a message; the assistant fills what it can and asks for the rest. */
function NewLeadAssistant({ onForm }: { onForm: () => void }) {
  const { t } = useTranslation()
  return (
    <Page className="max-w-3xl">
      <PageHeader back={{ to: '/leads', label: t('nav.leads') }} title={t('leadForm.addTitle')} description={t('ai.newLeadIntro')}
        actions={<Button variant="outline" onClick={onForm}>{t('ai.fillForm')}</Button>} />
      <SectionCard>
        <AssistantBox mode="newLead" autoFocus placeholder={t('ai.newLeadPlaceholder')}
          examples={[t('ai.ex.newLead'), t('ai.ex.newLead2')]} />
      </SectionCard>
      <p className="mt-3 text-sm text-muted-foreground">{t('ai.newLeadRules')}</p>
    </Page>
  )
}

function LeadForm({ base, prefill }: { base?: Lead; prefill?: NewLeadFields }) {
  const { t } = useTranslation()
  const L = useLabels()
  const navigate = useNavigate()
  const { db, today, user, addLead, updateLead } = useStore()
  const can = useCan()
  const manager = can('lead.seeAll')
  const executives = db.users.filter((u) => u.role === 'executive')
  const [d, setD] = useState<Draft>(() => { const x = draftOf(base, today, manager ? '' : user.id); return prefill ? withPrefill(x, prefill) : x })
  const [tried, setTried] = useState(false)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))
  const setQ = (k: keyof Lead['qualification'], v: string) => setD((x) => ({ ...x, q: { ...x.q, [k]: v } }))
  const toggle = (k: 'cities' | 'localities' | 'amenities', v: string) => setD((x) => {
    const on = x[k].includes(v)
    const next = { ...x, [k]: on ? x[k].filter((y) => y !== v) : [...x[k], v] }
    // a city taken off takes its localities with it
    if (k === 'cities' && on) next.localities = x.localities.filter((loc) => !(CITIES[v] ?? []).includes(loc))
    return next
  })

  const min = fromAmountField(d.min), pref = fromAmountField(d.preferred), max = fromAmountField(d.max)
  const flex = Math.min(50, Math.max(0, Number(d.flexPct) || 0))
  const errors = {
    // at least 10 digits; the demo's numbers are masked ("+91 98xxxxxx01"), so an x counts as a digit
    name: !d.name.trim(), phone: (d.phone.match(/[\dxX]/g) ?? []).length < 10, purpose: !d.purpose, max: !max, cities: !d.cities.length,
    budgetOrder: !!max && ((!!min && min > max) || (!!pref && pref > max)),
  }
  const invalid = Object.values(errors).some(Boolean)
  const show = (k: keyof typeof errors) => tried && errors[k]
  const fields = TYPE_FIELDS[d.type]

  // the executive with the fewest open leads
  const autoOwner = () => [...executives].sort((a, b) =>
    db.leads.filter((l) => l.ownerId === a.id && isActive(l)).length - db.leads.filter((l) => l.ownerId === b.id && isActive(l)).length)[0]?.id ?? user.id

  const build = (): Pick<Lead, 'name' | 'phone' | 'email' | 'contactPref' | 'source' | 'enquiryDate' | 'purpose' | 'purposeNote' | 'qualification' | 'budget' | 'requirement'> => ({
    name: d.name.trim(), phone: d.phone.trim(), email: d.email.trim() || undefined, contactPref: d.contactPref, source: d.source, enquiryDate: d.enquiryDate,
    purpose: d.purpose, purposeNote: d.purposeNote.trim() || undefined, qualification: d.q,
    budget: { min: min ?? 0, preferred: pref ?? max!, max: max!, flexPct: flex, ...(d.basis ? { basis: d.basis } : {}) },
    requirement: {
      type: d.type, cities: d.cities, localities: d.localities, sizeSqft: Number(d.sizeSqft) || undefined, amenities: d.amenities, approvalRequired: d.approvalRequired,
      ...(fields.includes('bhk') && d.bhk ? { bhk: d.bhk } : {}),
      ...(fields.includes('possession') ? { possession: d.possession } : {}),
      ...(fields.includes('parking') ? { parking: d.parking } : {}),
      ...(fields.includes('facing') && d.facing ? { facing: d.facing } : {}),
      ...(fields.includes('road') && Number(d.minRoadFt) ? { minRoadFt: Number(d.minRoadFt) } : {}),
      ...(fields.includes('corner') ? { corner: d.corner } : {}),
      ...(fields.includes('commCategory') && d.commCategory.trim() ? { commCategory: d.commCategory.trim() } : {}),
      ...(fields.includes('occupancy') ? { occupancy: d.occupancy } : {}),
    },
  })

  const save = () => {
    setTried(true)
    if (invalid) { window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    const fields = build()
    if (base) {
      updateLead(base.id, (x) => {
        Object.assign(x, fields)
        if (manager && d.ownerId && d.ownerId !== x.ownerId) x.ownerId = d.ownerId
      }, t('leadForm.noteUpdated'))
      toast.success(t('leadForm.saved'))
      navigate(`/leads/${base.id}`)
      return
    }
    const ownerId = manager ? d.ownerId || autoOwner() : user.id
    const follow = d.consent ? addDays(today, 1) : undefined
    const note = t('leadForm.noteCreated', { owner: userName(db, ownerId) }) + ' ' + (follow ? t('leadForm.noteFollow', { date: fmtDate(follow) }) : t('leadForm.noteNoConsent'))
    const id = addLead((newId) => ({
      id: newId, ...fields, ownerId, stage: 'new', stageSince: today, nextFollowUp: follow,
      engagement: { responded: false, docsRequested: false, siteVisited: false },
      recommendedPropertyIds: [], visits: [], activity: [],
      consent: d.consent ? { followUp: true, at: today, how: d.consentVia } : undefined,
    }), note)
    toast.success(t('leadForm.created', { id }))
    navigate(`/leads/${id}/matches`)
  }

  const chip = (on: boolean) => cn('rounded-full border px-3 py-1 text-sm transition-colors', on ? 'border-primary bg-accent font-medium text-primary' : 'hover:bg-muted')
  const choose = <T extends string>(options: readonly T[], value: T | undefined, onPick: (v: T) => void, label: (v: T) => string) => (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => <button key={o} type="button" onClick={() => onPick(o)} aria-pressed={value === o} className={chip(value === o)}>{label(o)}</button>)}
    </div>
  )
  const backTo = base ? `/leads/${base.id}` : '/leads'

  return (
    <Page className="max-w-4xl pb-28">
      <PageHeader back={{ to: backTo, label: base ? base.name : t('nav.leads') }}
        title={base ? t('leadForm.editTitle', { name: base.name }) : t('leadForm.addTitle')}
        description={t('leadForm.intro')} />

      {prefill && !tried && <Callout tone="violet" title={t('ai.prefilledTitle')} className="mb-4">{t('ai.prefilled')}</Callout>}
      {/* editing: say what changed, check the changes, fill them into the form */}
      {base && <EditAssistant d={d} onApply={(next, n) => { setD(next); toast.success(t('ai.edit.applied', { count: n })) }} />}
      {tried && invalid && (
        <Callout tone="danger" title={t('leadForm.fixTitle')} className="mb-4">
          {[errors.name && t('leadForm.err.name'), errors.phone && t('leadForm.err.phone'), errors.purpose && t('leadForm.err.purpose'),
            errors.max && t('leadForm.err.max'), errors.budgetOrder && t('leadForm.err.budgetOrder'), errors.cities && t('leadForm.err.cities')].filter(Boolean).join(' · ')}
        </Callout>
      )}

      <form onSubmit={(e) => { e.preventDefault(); save() }} className="flex flex-col gap-4" noValidate>
        {/* A · contact */}
        <SectionCard title={<Num n="A">{t('leadForm.sec.contact')}</Num>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field input label={t('leadForm.name')} required error={show('name')}>
              <Input value={d.name} onChange={(e) => set('name', e.target.value)} aria-invalid={show('name') || undefined} autoComplete="off" />
            </Field>
            <Field input label={t('leadForm.phone')} required error={show('phone')} hint={t('leadForm.phoneHint')}>
              <Input value={d.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91" inputMode="tel" aria-invalid={show('phone') || undefined} />
            </Field>
            <Field input label={t('leadForm.email')} hint={t('leadForm.optional')}>
              <Input type="email" value={d.email} onChange={(e) => set('email', e.target.value)} />
            </Field>
            <Field label={t('leadForm.contactPref')}>
              {choose(['call', 'whatsapp', 'email'] as const, d.contactPref, (v) => setD((x) => ({ ...x, contactPref: v, consentVia: v === 'whatsapp' ? 'whatsapp' : 'call' })), (v) => t(`leadForm.pref.${v}`))}
            </Field>
            <Field input label={t('leadForm.sourceLabel')}>
              <Select value={d.source} onValueChange={(v) => set('source', v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[...new Set([...SOURCES, d.source])].map((s) => <SelectItem key={s} value={s}>{SOURCE_KEY[s] ? t(`leadForm.source.${SOURCE_KEY[s]}`) : s}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field input label={t('leadForm.enquiryDate')}>
              <Input type="date" value={d.enquiryDate} max={today} onChange={(e) => set('enquiryDate', e.target.value)} />
            </Field>
            <Field input label={t('leadForm.owner')} hint={manager ? undefined : t('leadForm.ownerExecHint')}>
              {manager ? (
                <Select value={d.ownerId || 'auto'} onValueChange={(v) => set('ownerId', v === 'auto' ? '' : v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {!base && <SelectItem value="auto">{t('leadForm.autoAssign')}</SelectItem>}
                    {executives.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : <Input value={userName(db, base?.ownerId ?? user.id)} disabled />}
            </Field>
          </div>
          {/* consent: recorded here for a new lead; on an existing lead it is changed from the profile */}
          {base ? (
            <p className={cn('mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm', hasFollowUpConsent(base) ? 'text-success' : 'text-danger')}>
              {hasFollowUpConsent(base) ? <ShieldCheck className="size-4" /> : <ShieldX className="size-4" />}
              {hasFollowUpConsent(base) ? t('lead.consentOk') : t('lead.consentNo')}
              <span className="text-muted-foreground">· {t('leadForm.consentOnProfile')}</span>
            </p>
          ) : (
            <div className={cn('mt-4 rounded-xl border p-3', d.consent ? 'border-success/40 bg-success-soft/40' : 'bg-muted/30')}>
              <label className="flex items-start gap-3">
                <Checkbox checked={d.consent} onCheckedChange={(v) => set('consent', !!v)} className="mt-0.5" />
                <span className="text-sm">
                  <b className="font-medium">{t('leadForm.consent')}</b>
                  <span className="block text-muted-foreground">{t('leadForm.consentSay')}</span>
                </span>
              </label>
              {d.consent ? (
                <div className="mt-3 pl-7">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t('lead.consent.how')}</p>
                  {choose(CONSENT_VIA, d.consentVia, (v) => set('consentVia', v), (v) => t(`lead.consent.via.${v}`))}
                </div>
              ) : <p className="mt-2 pl-7 text-xs text-danger">{t('leadForm.noConsentNote')}</p>}
            </div>
          )}
        </SectionCard>

        {/* B · why they're buying */}
        <SectionCard title={<Num n="B">{t('leadForm.sec.purpose')}</Num>} description={t('leadForm.purposeWhy')}>
          <div className={cn('grid grid-cols-2 gap-2 sm:grid-cols-3', show('purpose') && 'rounded-xl ring-2 ring-danger/40 ring-offset-4')}>
            {PURPOSES.map((p) => (
              <button key={p} type="button" onClick={() => set('purpose', p)} aria-pressed={d.purpose === p}
                className={cn('flex items-start gap-2 rounded-xl border p-3 text-left text-sm transition-colors', d.purpose === p ? 'border-primary bg-accent' : 'hover:bg-muted')}>
                <span className={cn('mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border', d.purpose === p && 'border-primary bg-primary text-primary-foreground')}>
                  {d.purpose === p && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span><b className="block font-medium">{t(`purpose.buyer.${p}`)}</b><span className="text-xs text-muted-foreground">{t(`leadForm.purposeHint.${p}`)}</span></span>
              </button>
            ))}
          </div>
          <Field input label={t('leadForm.purposeNote')} hint={t('leadForm.optional')} className="mt-4">
            <Input value={d.purposeNote} onChange={(e) => set('purposeNote', e.target.value)} placeholder={t('leadForm.purposeNotePh')} />
          </Field>
        </SectionCard>

        {/* C · budget and funding */}
        <SectionCard title={<Num n="C">{t('leadForm.sec.budget')}</Num>} description={t('leadForm.budgetWhy')}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <AmountInput label={t('leadForm.min')} value={d.min} onChange={(v) => set('min', v)} hint={t('leadForm.optional')} />
            <AmountInput label={t('leadForm.preferred')} value={d.preferred} onChange={(v) => set('preferred', v)} hint={t('leadForm.prefHint')} />
            <AmountInput label={t('leadForm.max')} value={d.max} onChange={(v) => set('max', v)} required invalid={show('max') || show('budgetOrder')} />
            <Field input label={t('leadForm.flex')} hint={t('leadForm.flexHint')}>
              <Input inputMode="numeric" value={d.flexPct} onChange={(e) => set('flexPct', e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="0" />
            </Field>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {max ? t('leadForm.budgetLive', { min: inrShort(min ?? 0), max: inrShort(max), pref: inrShort(pref ?? max), ceiling: inrShort(Math.round(max * (1 + flex / 100))) }) : t('leadForm.budgetEmpty')}
          </p>
          {/* what ₹30 L means: property only, all-in, or with a loan — clarify before recommending (old wireframe) */}
          <Field label={t('leadForm.basis')} hint={t('leadForm.basisHint')} className="mt-4">
            {choose(['none', 'propertyOnly', 'withCosts', 'withLoan'] as const, d.basis ?? 'none', (v) => set('basis', v === 'none' ? undefined : v), (v) => t(`leadForm.basisOpt.${v}`))}
          </Field>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label={t('qual.q.fundingType')}>{choose(Q.funding, d.q.funding, (v) => setQ('funding', v), (v) => t(`qual.answer.fundingType.${v}`))}</Field>
            <Field label={t('qual.q.funding')}>{choose(Q.fundingReady, d.q.fundingReady, (v) => setQ('fundingReady', v), (v) => t(`qual.answer.funding.${v}`))}</Field>
          </div>
        </SectionCard>

        {/* D · what they want */}
        <SectionCard title={<Num n="D">{t('leadForm.sec.want')}</Num>}>
          <div className="flex flex-col gap-4">
            <Field label={t('leadForm.type')} required>
              {choose(TYPE_ORDER, d.type, (v) => set('type', v), (v) => L.type(v))}
            </Field>
            <Field label={t('leadForm.cities')} required error={show('cities')}>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(CITIES).map((c) => <button key={c} type="button" onClick={() => toggle('cities', c)} aria-pressed={d.cities.includes(c)} className={chip(d.cities.includes(c))}>{c}</button>)}
              </div>
            </Field>
            {d.cities.length > 0 && (
              <Field label={t('leadForm.localities')} hint={t('leadForm.localitiesHint')}>
                <div className="flex flex-col gap-2">
                  {d.cities.map((c) => (
                    <div key={c} className="flex flex-wrap items-center gap-1.5">
                      <span className="w-full text-xs text-muted-foreground sm:w-28">{c}</span>
                      {(CITIES[c] ?? []).map((loc) => <button key={loc} type="button" onClick={() => toggle('localities', loc)} aria-pressed={d.localities.includes(loc)} className={chip(d.localities.includes(loc))}>{loc}</button>)}
                    </div>
                  ))}
                </div>
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field input label={t('leadForm.size')} hint={t('leadForm.optional')}>
                <Input inputMode="numeric" value={d.sizeSqft} onChange={(e) => set('sizeSqft', e.target.value.replace(/\D/g, ''))} placeholder="1200" />
              </Field>
              {fields.includes('road') && (
                <Field input label={t('leadForm.road')} hint={t('leadForm.optional')}>
                  <Input inputMode="numeric" value={d.minRoadFt} onChange={(e) => set('minRoadFt', e.target.value.replace(/\D/g, ''))} placeholder="30" />
                </Field>
              )}
              {fields.includes('commCategory') && (
                <Field input label={t('leadForm.commCategory')}>
                  <Input value={d.commCategory} onChange={(e) => set('commCategory', e.target.value)} placeholder={t('leadForm.commCategoryPh')} />
                </Field>
              )}
            </div>
            {fields.includes('bhk') && <Field label={t('leadForm.bhk')}>{choose(BHK, d.bhk, (v) => set('bhk', d.bhk === v ? undefined : v), (v) => v)}</Field>}
            {fields.includes('possession') && <Field label={t('leadForm.possession')}>{choose(['any', 'ready', 'underConstruction'] as const, d.possession, (v) => set('possession', v), (v) => t(`leadForm.possessionOpt.${v}`))}</Field>}
            {fields.includes('parking') && <Field label={t('leadForm.parking')}>{choose(['required', 'preferred', 'notNeeded'] as const, d.parking, (v) => set('parking', v), (v) => t(`leadForm.parkingOpt.${v}`))}</Field>}
            {fields.includes('facing') && (
              <Field label={t('leadForm.facing')} hint={t('leadForm.facingHint')}>
                {choose(FACINGS, d.facing, (v) => set('facing', d.facing === v ? undefined : v), (v) => L.facing(v))}
              </Field>
            )}
            {fields.includes('corner') && <Field label={t('leadForm.corner')}>{choose(['any', 'corner', 'nonCorner'] as const, d.corner, (v) => set('corner', v), (v) => t(`leadForm.cornerOpt.${v}`))}</Field>}
            {fields.includes('occupancy') && <Field label={t('leadForm.occupancy')}>{choose(['any', 'vacant', 'tenanted'] as const, d.occupancy, (v) => set('occupancy', v), (v) => t(`leadForm.occupancyOpt.${v}`))}</Field>}
            <Field label={t('leadForm.amenities')} hint={t('leadForm.amenitiesHint')}>
              <div className="flex flex-wrap gap-1.5">
                {amenityList(db.settings).map((a) => <button key={a} type="button" onClick={() => toggle('amenities', a)} aria-pressed={d.amenities.includes(a)} className={chip(d.amenities.includes(a))}>{t(`amenity.${a}`, { defaultValue: a })}</button>)}
              </div>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={d.approvalRequired} onCheckedChange={(v) => set('approvalRequired', !!v)} /> {t('leadForm.approvalRequired')}
            </label>
          </div>
        </SectionCard>

        {/* E · how ready they are */}
        <SectionCard title={<Num n="E">{t('leadForm.sec.ready')}</Num>} description={t('leadForm.readyWhy')}>
          <div className="flex flex-col gap-4">
            <Field label={t('qual.q.need')}>{choose(Q.need, d.q.need, (v) => setQ('need', v), (v) => t(`qual.answer.need.${v}`))}</Field>
            <Field label={t('qual.q.timeline')}>{choose(Q.timeline, d.q.timeline, (v) => setQ('timeline', v), (v) => t(`qual.answer.timeline.${v}`))}</Field>
            <Field label={t('qual.q.authority')}>{choose(Q.authority, d.q.authority, (v) => setQ('authority', v), (v) => t(`qual.answer.authority.${v}`))}</Field>
          </div>
        </SectionCard>

        {/* actions stay in reach while scrolling */}
        <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
          {tried && invalid && <span className="mr-auto text-sm text-danger">{t('leadForm.fixShort')}</span>}
          <Button type="button" variant="outline" asChild><Link to={backTo}>{t('action.cancel')}</Link></Button>
          <Button type="submit">{base ? t('leadForm.saveChanges') : t('leadForm.create')}</Button>
        </div>
      </form>
    </Page>
  )
}

/**
 * Edit lead with the assistant (27 Nov): say what changed; it lists each change as old → new with a tick box, and
 * "Apply to the form" fills the ticked ones in. Nothing is saved until "Save changes" — the form stays the place to check.
 * Places are added to the ones already there; consent is not changed here (it is recorded on the profile).
 */
function EditAssistant({ d, onApply }: { d: Draft; onApply: (next: Draft, n: number) => void }) {
  const { t } = useTranslation()
  const L = useLabels()
  const [text, setText] = useState('')
  const [sent, setSent] = useState('')
  const [off, setOff] = useState<Set<string>>(() => new Set())
  const box = useRef<HTMLTextAreaElement>(null)
  const speech = useSpeech((heard, final) => { setText(heard); if (final && heard.trim()) { setSent(heard.trim()); setOff(new Set()) } })
  const send = () => { const v = text.trim(); if (v) { setSent(v); setOff(new Set()) } }

  type Change = { key: string; label: string; from: string; to: string; apply: (x: Draft) => Draft }
  const changes: Change[] = []
  if (sent) {
    const f = readLeadDetails(sent)
    const money = (a: AmountField) => { const n = fromAmountField(a); return n ? inrShort(n) : '—' }
    const unit = (n: number): 'L' | 'Cr' => (n >= 1e7 ? 'Cr' : 'L')
    if (f.phone && f.phone !== d.phone) changes.push({ key: 'phone', label: t('leadForm.phone'), from: d.phone || '—', to: f.phone, apply: (x) => ({ ...x, phone: f.phone! }) })
    if (f.email && f.email !== d.email) changes.push({ key: 'email', label: t('leadForm.email'), from: d.email || '—', to: f.email, apply: (x) => ({ ...x, email: f.email! }) })
    if (f.contactPref && f.contactPref !== d.contactPref) changes.push({ key: 'pref', label: t('leadForm.contactPref'), from: t(`leadForm.pref.${d.contactPref}`), to: t(`leadForm.pref.${f.contactPref}`), apply: (x) => ({ ...x, contactPref: f.contactPref! }) })
    if (f.purpose && f.purpose !== d.purpose) changes.push({ key: 'purpose', label: t('ai.purpose'), from: d.purpose ? t(`purpose.buyer.${d.purpose}`) : '—', to: t(`purpose.buyer.${f.purpose}`), apply: (x) => ({ ...x, purpose: f.purpose }) })
    if (f.max && f.max !== fromAmountField(d.max)) changes.push({ key: 'max', label: t('leadForm.max'), from: money(d.max), to: inrShort(f.max), apply: (x) => ({ ...x, max: toAmountField(f.max, unit(f.max!)) }) })
    if (f.min && f.min !== fromAmountField(d.min)) changes.push({ key: 'min', label: t('leadForm.min'), from: money(d.min), to: inrShort(f.min), apply: (x) => ({ ...x, min: toAmountField(f.min, unit(f.min!)) }) })
    if (f.type && f.type !== d.type) changes.push({ key: 'type', label: t('leadForm.type'), from: L.type(d.type), to: L.type(f.type), apply: (x) => ({ ...x, type: f.type! }) })
    if (f.bhk && f.bhk !== d.bhk) changes.push({ key: 'bhk', label: t('leadForm.bhk'), from: d.bhk ?? '—', to: f.bhk, apply: (x) => ({ ...x, bhk: f.bhk }) })
    if (f.sizeSqft && String(f.sizeSqft) !== d.sizeSqft) changes.push({ key: 'size', label: t('leadForm.size'), from: d.sizeSqft || '—', to: String(f.sizeSqft), apply: (x) => ({ ...x, sizeSqft: String(f.sizeSqft) }) })
    const newCities = f.cities.filter((c) => !d.cities.includes(c)), newLocs = f.localities.filter((c) => !d.localities.includes(c))
    if (newCities.length || newLocs.length) {
      changes.push({
        key: 'places', label: t('leadForm.localities'), from: [...d.localities, ...(d.localities.length ? [] : d.cities)].join(', ') || '—',
        to: `+ ${[...newLocs, ...newCities].join(', ')}`,
        apply: (x) => ({ ...x, cities: [...new Set([...x.cities, ...f.cities])], localities: [...new Set([...x.localities, ...f.localities])] }),
      })
    }
    if (f.source && f.source !== d.source) changes.push({ key: 'source', label: t('leadForm.sourceLabel'), from: d.source, to: f.source, apply: (x) => ({ ...x, source: f.source! }) })
  }
  const chosen = changes.filter((c) => !off.has(c.key))
  const apply = () => {
    onApply(chosen.reduce((x, c) => c.apply(x), d), chosen.length)
    setText(''); setSent('')
  }

  return (
    <SectionCard className="mb-4 border-violet/25">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="size-4 text-violet" /> {t('ai.edit.title')}</p>
      <form onSubmit={(e) => { e.preventDefault(); send() }}
        className="flex items-center gap-2 rounded-xl border bg-card py-1.5 pr-1.5 pl-3 focus-within:border-primary/60 focus-within:ring-3 focus-within:ring-ring/15">
        <Textarea ref={box} rows={1} value={text} onChange={(e) => setText(e.target.value)} aria-label={t('ai.edit.placeholder')} placeholder={t('ai.edit.placeholder')}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          className="field-sizing-content max-h-32 min-h-9 flex-1 resize-none border-0 bg-transparent px-1 py-1.5 text-sm shadow-none focus-visible:ring-0 md:text-sm" />
        {speech.supported && (
          <Button type="button" variant="outline" size="icon" className={cn('size-9 shrink-0', speech.listening && 'border-danger text-danger')}
            aria-label={speech.listening ? t('ai.stopListening') : t('ai.speak')} onClick={() => (speech.listening ? speech.stop() : speech.start())}>
            {speech.listening ? <MicOff /> : <Mic />}
          </Button>
        )}
        <Button type="submit" size="icon" className="size-9 shrink-0" aria-label={t('ai.send')} disabled={!text.trim()}><CornerDownLeft /></Button>
      </form>
      {!sent && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[t('ai.edit.ex1'), t('ai.edit.ex2')].map((x) => (
            <button key={x} type="button" onClick={() => { setText(x); setSent(x); setOff(new Set()) }} className="rounded-full bg-violet-soft px-2.5 py-1 text-left text-xs text-violet hover:bg-violet-soft/70">{x}</button>
          ))}
        </div>
      )}
      {sent && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border bg-muted/30 p-3 text-sm">
          {changes.length ? (
            <>
              <p className="text-muted-foreground">{t('ai.edit.found', { count: changes.length })}</p>
              <ul className="flex flex-col gap-1.5">
                {changes.map((c) => (
                  <li key={c.key}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 py-2">
                      <Checkbox checked={!off.has(c.key)} onCheckedChange={(v) => setOff((s) => { const n = new Set(s); if (v) n.delete(c.key); else n.add(c.key); return n })} />
                      <span className="w-28 shrink-0 text-muted-foreground">{c.label}</span>
                      <span className="min-w-0"><s className="text-muted-foreground">{c.from}</s> → <b className="font-semibold">{c.to}</b></span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="mr-auto text-xs text-muted-foreground">{t('ai.edit.thenSave')}</span>
                <Button type="button" variant="outline" onClick={() => { setSent(''); box.current?.focus() }}>{t('action.cancel')}</Button>
                <Button type="button" disabled={!chosen.length} onClick={apply}><Check /> {t('ai.edit.apply', { count: chosen.length })}</Button>
              </div>
            </>
          ) : <p>{t('ai.edit.none')}</p>}
        </div>
      )}
    </SectionCard>
  )
}

function Num({ n, children }: { n: string; children: ReactNode }) {
  return <span className="flex items-center gap-2"><span className="grid size-6 place-items-center rounded-md bg-accent text-xs font-bold text-primary">{n}</span>{children}</span>
}

/** One question. `input`: the wrapper is a <label>, so a single text field gets the question as its name; chip groups get a named group. */
function Field({ label, required, hint, error, className, input, children }: { label: string; required?: boolean; hint?: string; error?: boolean; className?: string; input?: boolean; children: ReactNode }) {
  const body = (
    <>
      <span className={cn('text-sm font-medium', error && 'text-danger')}>{label}{required && <span className="text-danger"> *</span>}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </>
  )
  const cls = cn('flex min-w-0 flex-col gap-1.5', className)
  return input ? <label className={cls}>{body}</label> : <div role="group" aria-label={label} className={cls}>{body}</div>
}
