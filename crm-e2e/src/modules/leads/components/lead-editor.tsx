/**
 * The Add / Edit lead form (master prompt §8, §12.3, §12.6; ported in spirit from wireframe-rebuild's 3-step
 * add-lead-sheet.tsx and lead-form.tsx). Three short steps — 1 Who · 2 What they want · 3 Budget & readiness — with big
 * chips, optional details collapsed under "+ More details (n)", AI-filled fields marked in Iris, the duplicate check,
 * a live "N properties already fit" line and the qualification card filling in as you type.
 * `layout="steps"` shows one step at a time (the sheet); `layout="page"` shows all three as sections.
 */
import { useState, type ReactNode } from 'react'
import { AlertTriangle, Building2, ChevronDown, Home, Sparkles, UserRound, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { paths } from '@/app/paths'
import { AIField, AIFieldMarker } from '@/components/ai/ai-field'
import { ModuleAssistant } from '@/components/ai/module-assistant'
import { AmountInput } from '@/components/shared/amount-input'
import { Chip } from '@/components/shared/chip'
import { FormField } from '@/components/shared/form-field'
import { IconTile } from '@/components/shared/icon-tile'
import { PhoneInput } from '@/components/shared/phone-input'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { Configuration, DecisionMaker, Facing, LeadSource, PropertyType } from '@/domain/types'
import {
  AMENITIES, AUTHORITIES, BUYER_PURPOSES, CITY_NAMES, CONFIGURATIONS, DECISION_MAKERS, FACINGS, FURNISHING, LANGUAGES_SPOKEN, LEAD_SOURCES,
  LOAN_STATUSES, NEEDS, POSSESSION_PREFS, PROPERTY_TYPE_ORDER, TIMELINES,
} from '@/domain/catalogue'
import { useDb, useWholeDb } from '@/hooks/use-db'
import { usePermission } from '@/hooks/use-permission'
import { configLabel } from '@/lib/matching'
import { cn } from '@/lib/utils'
import { assignableUsers } from '@/services/assignments'
import { useCurrentUser } from '@/hooks/use-current-user'
import { localityOptions, moreCount, stepOfField, wantsHomes } from '../lib/lead-form'
import type { LeadEditor } from './use-lead-editor'

const QUICK_SOURCES: LeadSource[] = ['walkIn', 'phone', 'whatsapp', 'website', 'referral', 'acres99', 'magicbricks', 'channelPartner']
const STEP_ICON = [UserRound, Home, Wallet]

/** A row of toggle chips: multi (array value) or single (scalar value, click again clears unless `required`). */
function Chips<T extends string>({ values, value, onChange, label, labelOf, multi, testId }: {
  values: readonly T[]
  value: T | T[] | undefined
  onChange: (v: T | T[] | undefined) => void
  label: string
  labelOf: (v: T) => string
  multi?: boolean
  testId?: string
}) {
  const on = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v)
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label} data-testid={testId}>
      {values.map((v) => (
        <Chip
          key={v} pressed={on(v)}
          onClick={() => {
            if (multi) {
              const cur = Array.isArray(value) ? value : []
              onChange(cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v])
            } else onChange(value === v ? undefined : v)
          }}
        >
          {labelOf(v)}
        </Chip>
      ))}
    </div>
  )
}

function More({ count, children, label }: { count: number; children: ReactNode; label: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-dashed">
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-ui font-medium text-primary hover:bg-primary-soft/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <ChevronDown className={cn('size-4 transition-transform duration-(--dur-base)', open && 'rotate-180')} aria-hidden="true" />
        {label}
        {count > 0 && <span className="rounded-full bg-primary-soft px-1.5 text-meta tabular-nums">{count}</span>}
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-4 px-3 pt-1 pb-4">{children}</CollapsibleContent>
    </Collapsible>
  )
}

export function LeadEditorBody({ ed, layout }: { ed: LeadEditor; layout: 'steps' | 'page' }) {
  const { t } = useTranslation(['leads', 'catalogue', 'ai'])
  const steps = [<WhoStep key="who" ed={ed} />, <WantStep key="want" ed={ed} />, <MoneyStep key="money" ed={ed} />]
  if (layout === 'steps') {
    return (
      <div className="flex flex-col gap-5">
        <StepHeader ed={ed} />
        {steps[ed.step]}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-6">
      {(['who', 'want', 'money'] as const).map((k, i) => (
        <section key={k} aria-labelledby={`sec-${k}`} className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-card md:p-5">
          <h2 id={`sec-${k}`} className="flex items-center gap-2.5 text-base font-semibold">
            <IconTile icon={STEP_ICON[i]} size="sm" />
            {t(`leads:form.step.${k}`)}
          </h2>
          {steps[i]}
        </section>
      ))}
    </div>
  )
}

function StepHeader({ ed }: { ed: LeadEditor }) {
  const { t } = useTranslation('leads')
  const keys = ['who', 'want', 'money'] as const
  return (
    <nav aria-label={t('form.stepsLabel')} className="flex flex-col gap-2">
      <ol className="grid grid-cols-3 gap-1.5">
        {keys.map((k, i) => {
          const errs = ed.tried && ed.errors.some((e) => stepOfField(e.field) === i)
          return (
            <li key={k}>
              <button
                type="button" onClick={() => ed.goTo(i as 0 | 1 | 2)} aria-current={ed.step === i ? 'step' : undefined}
                className={cn('flex w-full flex-col gap-1.5 rounded-md p-1 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none')}
              >
                <span className={cn('h-1.5 rounded-full transition-colors', i <= ed.step ? 'bg-primary' : 'bg-muted', errs && 'bg-danger')} />
                <span className={cn('truncate text-meta', ed.step === i ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{i + 1}. {t(`form.step.${k}`)}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/* ---------- step 1: who ---------- */

function WhoStep({ ed }: { ed: LeadEditor }) {
  const { t } = useTranslation(['leads', 'catalogue', 'common'])
  const { can } = usePermission()
  const d = ed.draft
  const more = moreCount(d)
  return (
    <div className="flex flex-col gap-4">
      {!ed.isEdit && (
        <ModuleAssistant
          module="leadCreate" onFill={ed.fill} onAnswer={ed.answer} answered={ed.answered}
          onFocusField={(f) => document.getElementById(`lf-${f}`)?.focus()}
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <AIField meta={ed.ai.get('name')}>
          <FormField id="lf-name" label={t('leads:form.name')} required error={ed.errorOf('name')} labelEnd={<AIFieldMarker meta={ed.ai.get('name')} />}>
            {({ id, describedBy, invalid }) => <Input id={id} value={d.name} onChange={(e) => ed.set('name', e.target.value)} aria-invalid={invalid || undefined} aria-describedby={describedBy} autoComplete="off" data-testid="lead-name" />}
          </FormField>
        </AIField>
        <AIField meta={ed.ai.get('phone')}>
          <FormField id="lf-phone" label={t('leads:form.phone')} hint={t('leads:form.phoneHint')} error={ed.errorOf('phone')} labelEnd={<AIFieldMarker meta={ed.ai.get('phone')} />}>
            {({ id, describedBy, invalid }) => <PhoneInput id={id} value={d.phone} onChange={(v) => ed.set('phone', v)} invalid={invalid} describedBy={describedBy} />}
          </FormField>
        </AIField>
        <AIField meta={ed.ai.get('email')}>
          <FormField id="lf-email" label={t('leads:form.email')} optional error={ed.errorOf('email')} labelEnd={<AIFieldMarker meta={ed.ai.get('email')} />}>
            {({ id, describedBy, invalid }) => <Input id={id} type="email" value={d.email} onChange={(e) => ed.set('email', e.target.value)} aria-invalid={invalid || undefined} aria-describedby={describedBy} />}
          </FormField>
        </AIField>
        {ed.canAssign && <OwnerField ed={ed} />}
      </div>
      <DuplicateWarning ed={ed} canView={(id) => can('lead.view', ed.duplicates.find((x) => x.lead.id === id)?.lead)} />
      <AIField meta={ed.ai.get('source')}>
        <FormField id="lf-source" label={t('leads:form.source')} required error={ed.errorOf('source')} labelEnd={<AIFieldMarker meta={ed.ai.get('source')} />}>
          {() => (
            <div className="flex flex-col gap-2">
              <Chips values={QUICK_SOURCES} value={d.source} onChange={(v) => ed.set('source', v)} label={t('leads:form.source')} labelOf={(v) => t(`catalogue:source.${v}`)} testId="lead-source" />
              <Select value={d.source && !QUICK_SOURCES.includes(d.source) ? d.source : ''} onValueChange={(v) => ed.set('source', v)}>
                <SelectTrigger className="w-full sm:w-64" aria-label={t('leads:form.otherSource')}><SelectValue placeholder={t('leads:form.otherSource')} /></SelectTrigger>
                <SelectContent>{LEAD_SOURCES.filter((s) => !QUICK_SOURCES.includes(s)).map((s) => <SelectItem key={s} value={s}>{t(`catalogue:source.${s}`)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </FormField>
      </AIField>
      <More count={more.contact} label={t('leads:form.moreContact')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('leads:form.altPhone')} optional error={ed.errorOf('altPhone')}>
            {({ id, describedBy, invalid }) => <PhoneInput id={id} value={d.altPhone} onChange={(v) => ed.set('altPhone', v)} invalid={invalid} describedBy={describedBy} />}
          </FormField>
          <FormField label={t('leads:form.sourceDetail')} optional hint={t('leads:form.sourceDetailHint')}>
            {({ id }) => <Input id={id} value={d.sourceDetail} onChange={(e) => ed.set('sourceDetail', e.target.value)} />}
          </FormField>
          <AIField meta={ed.ai.get('preferredLanguage')}>
            <FormField label={t('leads:form.language')} optional labelEnd={<AIFieldMarker meta={ed.ai.get('preferredLanguage')} />}>
              {({ id }) => (
                <Select value={d.preferredLanguage} onValueChange={(v) => ed.set('preferredLanguage', v)}>
                  <SelectTrigger id={id} className="w-full"><SelectValue placeholder={t('leads:form.choose')} /></SelectTrigger>
                  <SelectContent>{LANGUAGES_SPOKEN.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </FormField>
          </AIField>
          <FormField label={t('leads:form.familySize')} optional>
            {({ id }) => <Input id={id} inputMode="numeric" value={d.familySize ?? ''} onChange={(e) => ed.set('familySize', Number(e.target.value.replace(/\D/g, '')) || undefined)} />}
          </FormField>
        </div>
        <FormField label={t('leads:form.contactPref')} optional>
          {() => <Chips values={['call', 'whatsapp', 'email'] as const} value={d.contactPref} onChange={(v) => ed.set('contactPref', v)} label={t('leads:form.contactPref')} labelOf={(v) => t(`leads:form.pref.${v}`)} />}
        </FormField>
        <AIField meta={ed.ai.get('isNri')}>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Switch checked={d.isNri} onCheckedChange={(v) => ed.set('isNri', v)} />
              {t('leads:form.nri')}
              <AIFieldMarker meta={ed.ai.get('isNri')} />
            </label>
            {d.isNri && <Input className="w-48" value={d.nriCountry} onChange={(e) => ed.set('nriCountry', e.target.value)} placeholder={t('leads:form.nriCountry')} aria-label={t('leads:form.nriCountry')} />}
          </div>
        </AIField>
      </More>
    </div>
  )
}

function OwnerField({ ed }: { ed: LeadEditor }) {
  const { t } = useTranslation(['leads', 'catalogue', 'common'])
  const db = useWholeDb()
  const user = useCurrentUser()
  const people = assignableUsers(db, user)
  const pick = ed.autoPick
  const pickName = pick?.userId ? db.users.find((u) => u.id === pick.userId)?.name : undefined
  return (
    <FormField label={t('leads:form.owner')} hint={
      ed.draft.owner === 'auto'
        ? (ed.autoOn
          ? (pickName ? <span className="text-ai">✦ {t('leads:form.autoPreview', { name: pickName, reason: t(`catalogue:assignmentReason.${pick?.reason.key}`) })}</span> : t('leads:form.autoNobody'))
          : t('leads:form.autoOff'))
        : ed.draft.owner === 'unassigned' ? t('leads:form.unassignedHint') : undefined
    }>
      {({ id, describedBy }) => (
        <Select value={ed.draft.owner} onValueChange={(v) => ed.set('owner', v)}>
          <SelectTrigger id={id} aria-describedby={describedBy} className="w-full" data-testid="lead-owner"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">✦ {ed.autoOn ? t('leads:form.ownerAuto') : t('leads:form.ownerAutoNow')}</SelectItem>
            {!ed.autoOn && <SelectItem value="unassigned">{t('leads:form.ownerNone')}</SelectItem>}
            {people.map((u) => (
              <SelectItem key={u.id} value={u.id} disabled={u.availability === 'onLeave'}>
                {u.name} · {t(`common:availability.${u.availability}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FormField>
  )
}

function DuplicateWarning({ ed, canView }: { ed: LeadEditor; canView: (id: string) => boolean }) {
  const { t } = useTranslation(['leads', 'catalogue'])
  const users = useDb((db) => db.users)
  if (!ed.duplicates.length) return null
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2.5 text-sm" data-testid="duplicate-warning">
      <p className="flex items-center gap-2 font-semibold text-warning"><AlertTriangle className="size-4" aria-hidden="true" />{t('leads:dup.title', { count: ed.duplicates.length })}</p>
      <ul className="flex flex-col gap-1.5">
        {ed.duplicates.slice(0, 3).map(({ lead, by }) => {
          const owner = users.find((u) => u.id === lead.ownerId)?.name
          return (
            <li key={lead.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <UserAvatar name={lead.name} size="xs" />
              <span className="font-medium">{lead.name}</span>
              <span className="text-meta text-muted-foreground">{lead.id} · {t(`leads:dup.by.${by}`)} · {t(`catalogue:stage.${lead.stage}`)} · {owner ? t('leads:dup.owner', { name: owner }) : t('leads:dup.noOwner')}</span>
              {canView(lead.id)
                ? <Button asChild size="xs" variant="secondary"><Link to={paths.lead(lead.id)}>{t('leads:dup.open')}</Link></Button>
                : <span className="text-meta text-muted-foreground">{t('leads:dup.askManager')}</span>}
            </li>
          )
        })}
      </ul>
      <label className="flex items-center gap-2 text-meta font-medium">
        <Checkbox checked={ed.dupAck} onCheckedChange={(v) => ed.setDupAck(v === true)} data-testid="duplicate-ack" />
        {t('leads:dup.saveAnyway')}
      </label>
    </div>
  )
}

/* ---------- step 2: what they want ---------- */

function WantStep({ ed }: { ed: LeadEditor }) {
  const { t } = useTranslation(['leads', 'catalogue'])
  const r = ed.draft.requirement
  const more = moreCount(ed.draft)
  const m = (p: string) => ed.ai.get(`requirement.${p}`)
  const homes = wantsHomes(r)
  return (
    <div className="flex flex-col gap-4">
      <FormField label={t('leads:form.purpose')}>
        {() => <Chips values={['sale', 'rent', 'lease'] as const} value={r.purpose} onChange={(v) => ed.set('requirement.purpose', v ?? 'sale')} label={t('leads:form.purpose')} labelOf={(v) => t(`catalogue:purpose.${v}`)} />}
      </FormField>
      <AIField meta={m('propertyTypes')}>
        <FormField label={t('leads:form.types')} optional labelEnd={<AIFieldMarker meta={m('propertyTypes')} />}>
          {() => <Chips multi values={PROPERTY_TYPE_ORDER} value={r.propertyTypes} onChange={(v) => ed.set('requirement.propertyTypes', (v as PropertyType[]) ?? [])} label={t('leads:form.types')} labelOf={(v) => t(`catalogue:propertyType.${v}`)} />}
        </FormField>
      </AIField>
      {homes && (
        <AIField meta={m('configurations')}>
          <FormField label={t('leads:form.configurations')} optional labelEnd={<AIFieldMarker meta={m('configurations')} />}>
            {() => <Chips multi values={CONFIGURATIONS} value={r.configurations} onChange={(v) => ed.set('requirement.configurations', (v as Configuration[]) ?? [])} label={t('leads:form.configurations')} labelOf={configLabel} testId="lead-configs" />}
          </FormField>
        </AIField>
      )}
      <AIField meta={m('cities')}>
        <FormField label={t('leads:form.cities')} optional labelEnd={<AIFieldMarker meta={m('cities')} />}>
          {() => <Chips multi values={CITY_NAMES} value={r.cities} onChange={(v) => ed.set('requirement.cities', (v as string[]) ?? [])} label={t('leads:form.cities')} labelOf={(v) => v} />}
        </FormField>
      </AIField>
      <AIField meta={m('localities')}>
        <FormField id="lf-requirement.localities" label={t('leads:form.localities')} optional hint={r.cities.length ? undefined : t('leads:form.localitiesHint')} labelEnd={<AIFieldMarker meta={m('localities')} />}>
          {() => (
            <div className="max-h-40 overflow-y-auto">
              <Chips multi values={localityOptions(r.cities)} value={r.localities} onChange={(v) => ed.set('requirement.localities', (v as string[]) ?? [])} label={t('leads:form.localities')} labelOf={(v) => v} testId="lead-localities" />
            </div>
          )}
        </FormField>
      </AIField>
      {homes && (
        <AIField meta={m('possession')}>
          <FormField label={t('leads:form.possession')} labelEnd={<AIFieldMarker meta={m('possession')} />}>
            {() => <Chips values={POSSESSION_PREFS} value={r.possession} onChange={(v) => ed.set('requirement.possession', v ?? 'any')} label={t('leads:form.possession')} labelOf={(v) => t(`catalogue:possession.${v}`)} testId="lead-possession" />}
          </FormField>
        </AIField>
      )}
      <FitLine ed={ed} />
      <More count={more.requirement} label={t('leads:form.moreRequirement')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <AIField meta={m('areaMinSqft')}>
            <FormField label={t('leads:form.areaMin')} optional error={ed.errorOf('requirement.areaMinSqft')} labelEnd={<AIFieldMarker meta={m('areaMinSqft')} />}>
              {({ id }) => <Input id={id} inputMode="numeric" value={r.areaMinSqft ?? ''} onChange={(e) => ed.set('requirement.areaMinSqft', Number(e.target.value.replace(/\D/g, '')) || undefined)} />}
            </FormField>
          </AIField>
          <AIField meta={m('areaMaxSqft')}>
            <FormField label={t('leads:form.areaMax')} optional labelEnd={<AIFieldMarker meta={m('areaMaxSqft')} />}>
              {({ id }) => <Input id={id} inputMode="numeric" value={r.areaMaxSqft ?? ''} onChange={(e) => ed.set('requirement.areaMaxSqft', Number(e.target.value.replace(/\D/g, '')) || undefined)} />}
            </FormField>
          </AIField>
        </div>
        <AIField meta={m('facing')}>
          <FormField label={t('leads:form.facing')} optional labelEnd={<AIFieldMarker meta={m('facing')} />}>
            {() => <Chips multi values={FACINGS} value={r.facing} onChange={(v) => ed.set('requirement.facing', (v as Facing[]) ?? [])} label={t('leads:form.facing')} labelOf={(v) => t(`catalogue:facing.${v}`)} />}
          </FormField>
        </AIField>
        {homes && (
          <AIField meta={m('furnishing')}>
            <FormField label={t('leads:form.furnishing')} optional labelEnd={<AIFieldMarker meta={m('furnishing')} />}>
              {() => <Chips values={[...FURNISHING, 'any'] as const} value={r.furnishing} onChange={(v) => ed.set('requirement.furnishing', v)} label={t('leads:form.furnishing')} labelOf={(v) => t(`catalogue:furnishing.${v}`)} />}
            </FormField>
          </AIField>
        )}
        <FormField label={t('leads:form.parking')} optional>
          {() => <Chips values={['required', 'preferred', 'notNeeded'] as const} value={r.parking} onChange={(v) => ed.set('requirement.parking', v)} label={t('leads:form.parking')} labelOf={(v) => t(`leads:form.parkingOpt.${v}`)} />}
        </FormField>
        <FormField label={t('leads:form.transaction')} optional>
          {() => <Chips values={['newBooking', 'resale', 'any'] as const} value={r.transaction} onChange={(v) => ed.set('requirement.transaction', v)} label={t('leads:form.transaction')} labelOf={(v) => t(`catalogue:transaction.${v}`)} />}
        </FormField>
        <AIField meta={m('amenities')}>
          <FormField label={t('leads:form.amenities')} optional labelEnd={<AIFieldMarker meta={m('amenities')} />}>
            {() => <Chips multi values={AMENITIES} value={r.amenities} onChange={(v) => ed.set('requirement.amenities', (v as string[]) ?? [])} label={t('leads:form.amenities')} labelOf={(v) => t(`catalogue:amenity.${v}`)} />}
          </FormField>
        </AIField>
        <label className="flex items-center gap-2 text-sm font-medium">
          <Switch checked={!!r.vastu} onCheckedChange={(v) => ed.set('requirement.vastu', v || undefined)} />
          {t('leads:form.vastu')}
        </label>
        <FormField label={t('leads:form.mustHaves')} optional hint={t('leads:form.mustHavesHint')}>
          {({ id, describedBy }) => <MustHaves id={id} describedBy={describedBy} value={r.mustHaves} onChange={(v) => ed.set('requirement.mustHaves', v)} />}
        </FormField>
      </More>
    </div>
  )
}

/** Free-text must-haves, comma separated; stored as a list when the field loses focus. */
function MustHaves({ id, describedBy, value, onChange }: { id: string; describedBy?: string; value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(value.join(', '))
  return (
    <Input
      id={id} aria-describedby={describedBy} value={text} onChange={(e) => setText(e.target.value)}
      onBlur={() => onChange(text.split(',').map((x) => x.trim()).filter(Boolean))}
    />
  )
}

function FitLine({ ed }: { ed: LeadEditor }) {
  const { t } = useTranslation('leads')
  const r = ed.draft.requirement
  if (!r.cities.length && !r.propertyTypes.length && !r.budgetMax) return null
  const strong = ed.fits.filter((f) => f.label === 'strong' || f.label === 'good').length
  return (
    <p className="flex items-center gap-2 rounded-md bg-primary-soft/60 px-3 py-2 text-meta text-foreground" aria-live="polite" data-testid="fit-line">
      <Building2 className="size-4 text-primary" aria-hidden="true" />
      {ed.fits.length ? t('leads:form.fits', { count: ed.fits.length, strong }) : t('leads:form.noFits')}
    </p>
  )
}

/* ---------- step 3: budget & readiness ---------- */

function MoneyStep({ ed }: { ed: LeadEditor }) {
  const { t } = useTranslation(['leads', 'catalogue'])
  const r = ed.draft.requirement
  const q = ed.draft.qualification
  const m = (p: string) => ed.ai.get(p)
  const more = moreCount(ed.draft)
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {(['budgetMin', 'budgetPreferred', 'budgetMax'] as const).map((k) => (
          <AIField key={k} meta={m(`requirement.${k}`)}>
            <FormField id={`lf-requirement.${k}`} label={t(`leads:form.${k}`)} optional error={ed.errorOf(`requirement.${k}`)} labelEnd={<AIFieldMarker meta={m(`requirement.${k}`)} />}>
              {({ id, describedBy, invalid }) => <AmountInput id={id} value={r[k]} onChange={(v) => ed.set(`requirement.${k}`, v)} invalid={invalid} describedBy={describedBy} />}
            </FormField>
          </AIField>
        ))}
      </div>
      <FormField label={t('leads:form.budgetBasis')} optional>
        {() => <Chips values={['propertyOnly', 'allIn', 'withLoan'] as const} value={r.budgetBasis} onChange={(v) => ed.set('requirement.budgetBasis', v)} label={t('leads:form.budgetBasis')} labelOf={(v) => t(`leads:form.basis.${v}`)} />}
      </FormField>
      <AIField meta={m('qualification.timeline')}>
        <FormField label={t('leads:form.timeline')} optional labelEnd={<AIFieldMarker meta={m('qualification.timeline')} />}>
          {() => <Chips values={TIMELINES} value={q.timeline} onChange={(v) => ed.set('qualification.timeline', v)} label={t('leads:form.timeline')} labelOf={(v) => t(`catalogue:timeline.${v}`)} testId="lead-timeline" />}
        </FormField>
      </AIField>
      <AIField meta={m('qualification.decisionMakers')}>
        <FormField label={t('leads:form.decisionMakers')} optional labelEnd={<AIFieldMarker meta={m('qualification.decisionMakers')} />}>
          {() => <Chips multi values={DECISION_MAKERS} value={q.decisionMakers} onChange={(v) => ed.set('qualification.decisionMakers', (v as DecisionMaker[]) ?? [])} label={t('leads:form.decisionMakers')} labelOf={(v) => t(`catalogue:decisionMaker.${v}`)} testId="lead-decision" />}
        </FormField>
      </AIField>
      <AIField meta={m('qualification.need')}>
        <FormField label={t('leads:form.need')} optional labelEnd={<AIFieldMarker meta={m('qualification.need')} />}>
          {() => <Chips values={NEEDS} value={q.need} onChange={(v) => ed.set('qualification.need', v)} label={t('leads:form.need')} labelOf={(v) => t(`catalogue:need.${v}`)} />}
        </FormField>
      </AIField>
      <QualPreview ed={ed} />
      <More count={more.qualification} label={t('leads:form.moreReadiness')}>
        <AIField meta={m('qualification.loan')}>
          <FormField label={t('leads:form.loan')} optional labelEnd={<AIFieldMarker meta={m('qualification.loan')} />}>
            {() => <Chips values={LOAN_STATUSES} value={q.loan} onChange={(v) => ed.set('qualification.loan', v ?? 'unknown')} label={t('leads:form.loan')} labelOf={(v) => t(`catalogue:loan.${v}`)} />}
          </FormField>
        </AIField>
        <AIField meta={m('qualification.buyerPurpose')}>
          <FormField label={t('leads:form.buyerPurpose')} optional labelEnd={<AIFieldMarker meta={m('qualification.buyerPurpose')} />}>
            {() => <Chips values={BUYER_PURPOSES} value={q.buyerPurpose} onChange={(v) => ed.set('qualification.buyerPurpose', v)} label={t('leads:form.buyerPurpose')} labelOf={(v) => t(`catalogue:buyerPurpose.${v}`)} />}
          </FormField>
        </AIField>
        <AIField meta={m('qualification.authority')}>
          <FormField label={t('leads:form.authority')} optional labelEnd={<AIFieldMarker meta={m('qualification.authority')} />}>
            {() => <Chips values={AUTHORITIES} value={q.authority} onChange={(v) => ed.set('qualification.authority', v)} label={t('leads:form.authority')} labelOf={(v) => t(`catalogue:authority.${v}`)} />}
          </FormField>
        </AIField>
        <FormField label={t('leads:form.funding')} optional>
          {() => <Chips values={['ready', 'arranging', 'undecided'] as const} value={q.fundingReady} onChange={(v) => ed.set('qualification.fundingReady', v)} label={t('leads:form.funding')} labelOf={(v) => t(`catalogue:funding.${v}`)} />}
        </FormField>
      </More>
      <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
        <Checkbox checked={ed.draft.consent} onCheckedChange={(v) => ed.set('consent', v === true)} className="mt-0.5" />
        <span>
          <span className="font-medium">{t('leads:form.consent')}</span>
          <span className="block text-meta text-muted-foreground">{t('leads:form.consentHint')}</span>
        </span>
      </label>
      <FormField label={ed.isEdit ? t('leads:form.addNote') : t('leads:form.firstNote')} optional>
        {({ id }) => <Textarea id={id} rows={3} value={ed.draft.notes} onChange={(e) => ed.set('notes', e.target.value)} placeholder={t('leads:form.notePlaceholder')} />}
      </FormField>
    </div>
  )
}

function QualPreview({ ed }: { ed: LeadEditor }) {
  const { t } = useTranslation('leads')
  const q = ed.qual
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-meta" aria-live="polite">
      <Sparkles className="size-3.5 text-ai" aria-hidden="true" />
      <span className="font-semibold">{t('qualify.known', { count: q.known.length })}</span>
      {q.checks.map((c) => (
        <span key={c.key} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5', c.known ? 'bg-success-soft text-success' : 'bg-card text-muted-foreground')}>
          {c.known ? '✓' : '?'} {t(`qualify.check.${c.key}`)}
        </span>
      ))}
    </div>
  )
}

/** Footer buttons for the stepped sheet: Back / Next and Save (Save works from any step once required fields are set). */
export function LeadEditorFooter({ ed, onCancel, layout }: { ed: LeadEditor; onCancel: () => void; layout: 'steps' | 'page' }) {
  const { t } = useTranslation(['leads', 'common'])
  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={onCancel}>{t('common:actions.cancel')}</Button>
        {layout === 'steps' && ed.step > 0 && <Button variant="ghost" onClick={() => ed.goTo((ed.step - 1) as 0 | 1)}>{t('leads:form.back')}</Button>}
      </div>
      <div className="flex items-center gap-2">
        {ed.ai.count > 0 && <span className="hidden text-meta text-ai sm:inline">✦ {t('leads:form.aiFilled', { count: ed.ai.count })}</span>}
        {layout === 'steps' && ed.step < 2 && <Button variant="secondary" onClick={() => ed.goTo((ed.step + 1) as 1 | 2)} data-testid="lead-next">{t('leads:form.next')}</Button>}
        <Button onClick={() => ed.save()} disabled={ed.saving} aria-busy={ed.saving || undefined} data-testid="lead-save">
          {ed.isEdit ? t('leads:form.saveChanges') : t('leads:form.save')}
        </Button>
      </div>
    </>
  )
}
