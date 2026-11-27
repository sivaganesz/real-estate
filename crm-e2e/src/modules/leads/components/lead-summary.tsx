/**
 * Lead page summary rail (DESIGN_SYSTEM §14 three zones): who (contact, source, owner), the score ring with
 * "Why this score?" (the five factors as bars), temperature, priority and conversion probability, and the requirement
 * (budget range, places, configuration, possession) editable in place — click a detail, change it, Save (Undo 6 s).
 * HNI / classification shows "Restricted" to executives (lead.viewHni).
 */
import { useState, type ReactNode } from 'react'
import { Building2, CalendarDays, Gem, HelpCircle, IndianRupee, Lock, Mail, MapPin, Pencil, Phone, Tag, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ContactActions } from '@/components/domain/contact-actions'
import { PriorityPill, SourcePill, StagePill, TemperaturePill } from '@/components/domain/lead-pills'
import { AmountInput } from '@/components/shared/amount-input'
import { Chip } from '@/components/shared/chip'
import { Meter } from '@/components/shared/meter'
import { ScoreRing } from '@/components/shared/progress-ring'
import { UserAvatar } from '@/components/shared/user-avatar'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Classification, Configuration, Lead, Priority, Temperature } from '@/domain/types'
import { CITY_NAMES, CLASSIFICATIONS, CONFIGURATIONS, POSSESSION_PREFS } from '@/domain/catalogue'
import { usePermission } from '@/hooks/use-permission'
import { classificationOf } from '@/lib/classification'
import { fmtDate, inrRange } from '@/lib/format'
import { configLabel } from '@/lib/matching'
import { phoneDisplay } from '@/lib/phone'
import type { LeadScore } from '@/lib/scoring'
import { cn } from '@/lib/utils'
import { setHniStatus, updateLeadFields, type LeadFieldPatch } from '@/services/leads'
import { useWholeDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { localityOptions } from '../lib/lead-form'

export function ScoreWhy({ score, trigger }: { score: LeadScore; trigger?: ReactNode }) {
  const { t } = useTranslation(['leads', 'catalogue'])
  return (
    <Popover>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button variant="link" size="xs" className="h-auto px-0" data-testid="score-why">
            <HelpCircle />{t('leads:score.why')}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <p className="text-sm font-semibold">{t('leads:score.whyTitle', { score: score.score })}</p>
        <p className="mb-3 text-meta text-muted-foreground">{t('leads:score.whyBody')}</p>
        <ul className="flex flex-col gap-2.5">
          {score.factors.map((f) => {
            const p = { ...f.params } as Record<string, string | number>
            if (f.key === 'source' && typeof p.source === 'string') p.source = t(`catalogue:source.${p.source}`)
            return (
              <li key={f.key} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2 text-meta">
                  <span className="font-medium">{t(`leads:score.factor.${f.key}`)}</span>
                  <span className="tabular-nums text-muted-foreground">{f.points} / {f.max}</span>
                </div>
                <Meter value={(f.points / f.max) * 100} size="xs" tone={f.points / f.max >= 0.66 ? 'success' : f.points / f.max >= 0.33 ? 'warning' : 'neutral'} label={t(`leads:score.factor.${f.key}`)} />
                {f.detail && <span className="text-meta text-muted-foreground">{t(`leads:score.detail.${f.detail}`, p)}</span>}
              </li>
            )
          })}
        </ul>
        <p className="mt-3 border-t pt-2 text-meta text-muted-foreground">{t('leads:score.thresholds')}</p>
      </PopoverContent>
    </Popover>
  )
}

function Row({ icon: Icon, label, children }: { icon: typeof Phone; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-meta text-muted-foreground">{label}</p>
        <div className="min-w-0 break-words">{children}</div>
      </div>
    </div>
  )
}

export function LeadHeroCard({ lead, score, temperature, priority, ownerName }: {
  lead: Lead; score: LeadScore; temperature: Temperature; priority: Priority; ownerName?: string
}) {
  const { t, i18n } = useTranslation(['leads', 'catalogue', 'domain'])
  return (
    <section aria-label={t('leads:detail.summary')} className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-card md:p-5">
      <div className="flex items-start gap-3">
        <UserAvatar name={lead.name} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-meta text-muted-foreground tabular-nums">{lead.id}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <TemperaturePill value={temperature} />
            <StagePill stage={lead.stage} />
            <PriorityPill value={priority} />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 rounded-md bg-muted/50 p-3">
        <ScoreRing score={score.score} size={64} label={t('domain:lead.score')} />
        <div className="min-w-0 flex-1">
          <p className="text-label font-semibold tracking-[0.04em] text-muted-foreground uppercase [:lang(ta)_&]:normal-case [:lang(ta)_&]:tracking-normal">{t('leads:score.title')}</p>
          <p className="text-sm">{t('leads:score.probability', { pct: Math.round(score.probability * 100) })}</p>
          <Meter value={score.probability * 100} size="xs" tone="primary" className="mt-1" label={t('leads:score.probabilityLabel')} />
          <ScoreWhy score={score} />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Row icon={Phone} label={t('leads:form.phone')}>
          {lead.phone ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="tabular-nums">{phoneDisplay(lead.phone)}</span>
              <ContactActions lead={lead} />
            </span>
          ) : '—'}
          {lead.altPhone && <span className="block text-meta text-muted-foreground tabular-nums">{phoneDisplay(lead.altPhone)}</span>}
        </Row>
        {lead.email && <Row icon={Mail} label={t('leads:form.email')}><a className="text-primary hover:underline" href={`mailto:${lead.email}`}>{lead.email}</a></Row>}
        <Row icon={Tag} label={t('leads:form.source')}>
          <span className="flex flex-wrap items-center gap-1.5"><SourcePill source={lead.source} />{lead.sourceDetail && <span className="text-meta text-muted-foreground">{lead.sourceDetail}</span>}</span>
        </Row>
        <Row icon={UserRound} label={t('leads:col.owner')}>
          {ownerName ? <span className="flex items-center gap-1.5"><UserAvatar name={ownerName} size="xs" />{ownerName}</span> : <span className="font-medium text-warning">{t('domain:lead.unassigned')}</span>}
        </Row>
        <Row icon={CalendarDays} label={t('leads:detail.created')}>
          {fmtDate(lead.createdAt, i18n.language)}
          {lead.createdVia === 'ai' && <span className="ml-1.5 text-meta text-ai">✦ {t('leads:detail.viaAi')}</span>}
          {lead.createdVia === 'import' && <span className="ml-1.5 text-meta text-muted-foreground">{t('leads:detail.viaImport')}</span>}
        </Row>
        {(lead.isNri || lead.preferredLanguage) && (
          <div className="flex flex-wrap gap-1.5">
            {lead.isNri && <span className="rounded-full bg-info-soft px-2 py-0.5 text-meta font-medium text-info">{t('domain:lead.nri')}{lead.nriCountry ? ` · ${lead.nriCountry}` : ''}</span>}
            {lead.preferredLanguage && <span className="rounded-full bg-muted px-2 py-0.5 text-meta">{lead.preferredLanguage}</span>}
          </div>
        )}
      </div>
    </section>
  )
}

/** A detail you can click to change (ported idea from wireframe-rebuild's inline-edit.tsx). */
function InlineEdit({ label, can, display, editor }: { label: string; can: boolean; display: ReactNode; editor: (close: () => void) => ReactNode }) {
  const { t } = useTranslation('leads')
  const [open, setOpen] = useState(false)
  if (!can) return <div className="rounded-md px-1.5 py-1">{display}</div>
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={t('inline.edit', { what: label })} className={cn('group/edit relative block w-full rounded-md px-1.5 py-1 text-left transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none', open && 'bg-primary-soft/50')}>
          {display}
          <Pencil className="absolute top-1.5 right-1.5 size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/edit:opacity-100 group-focus-visible/edit:opacity-100 pointer-coarse:opacity-60" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <p className="mb-2 text-sm font-semibold">{label}</p>
        {open && editor(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  )
}

function useSaveField(lead: Lead) {
  const { t } = useTranslation('leads')
  return (patch: LeadFieldPatch, what: string, close: () => void) => {
    try {
      const r = updateLeadFields(lead.id, patch, { undoable: true })
      toastUndo(t('inline.saved', { what }), r.undoToken)
      close()
    } catch (e) {
      toastError(e)
    }
  }
}

function EditorButtons({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  const { t } = useTranslation('common')
  return (
    <div className="mt-3 flex justify-end gap-2">
      <Button size="sm" variant="secondary" onClick={onCancel}>{t('actions.cancel')}</Button>
      <Button size="sm" onClick={onSave} data-testid="inline-save">{t('actions.save')}</Button>
    </div>
  )
}

function BudgetEditor({ lead, close }: { lead: Lead; close: () => void }) {
  const { t } = useTranslation('leads')
  const save = useSaveField(lead)
  const r = lead.requirement
  const [v, setV] = useState({ budgetMin: r.budgetMin, budgetPreferred: r.budgetPreferred, budgetMax: r.budgetMax })
  return (
    <div className="flex flex-col gap-2">
      {(['budgetMin', 'budgetPreferred', 'budgetMax'] as const).map((k) => (
        <label key={k} className="flex flex-col gap-1 text-meta font-medium">
          {t(`form.${k}`)}
          <AmountInput value={v[k]} onChange={(n) => setV((x) => ({ ...x, [k]: n }))} />
        </label>
      ))}
      <EditorButtons onCancel={close} onSave={() => save({ requirement: v }, t('detail.budget'), close)} />
    </div>
  )
}

function PlacesEditor({ lead, close }: { lead: Lead; close: () => void }) {
  const { t } = useTranslation('leads')
  const save = useSaveField(lead)
  const [cities, setCities] = useState(lead.requirement.cities)
  const [locs, setLocs] = useState(lead.requirement.localities)
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('form.cities')}>
        {CITY_NAMES.map((c) => <Chip key={c} size="sm" pressed={cities.includes(c)} onClick={() => setCities((x) => toggle(x, c))}>{c}</Chip>)}
      </div>
      <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto" role="group" aria-label={t('form.localities')}>
        {localityOptions(cities).map((l) => <Chip key={l} size="sm" pressed={locs.includes(l)} onClick={() => setLocs((x) => toggle(x, l))}>{l}</Chip>)}
      </div>
      <EditorButtons onCancel={close} onSave={() => save({ requirement: { cities, localities: locs.filter((l) => localityOptions(cities).includes(l)) } }, t('detail.places'), close)} />
    </div>
  )
}

function ConfigEditor({ lead, close }: { lead: Lead; close: () => void }) {
  const { t } = useTranslation(['leads', 'catalogue'])
  const save = useSaveField(lead)
  const [configs, setConfigs] = useState<Configuration[]>(lead.requirement.configurations)
  const [possession, setPossession] = useState(lead.requirement.possession)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('leads:form.configurations')}>
        {CONFIGURATIONS.map((c) => <Chip key={c} size="sm" pressed={configs.includes(c)} onClick={() => setConfigs((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]))}>{configLabel(c)}</Chip>)}
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('leads:form.possession')}>
        {POSSESSION_PREFS.map((p) => <Chip key={p} size="sm" pressed={possession === p} onClick={() => setPossession(p)}>{t(`catalogue:possession.${p}`)}</Chip>)}
      </div>
      <EditorButtons onCancel={close} onSave={() => save({ requirement: { configurations: configs, possession } }, t('leads:detail.config'), close)} />
    </div>
  )
}

export function RequirementCard({ lead }: { lead: Lead }) {
  const { t } = useTranslation(['leads', 'catalogue', 'domain'])
  const { can } = usePermission()
  const edit = can('lead.edit', lead)
  const r = lead.requirement
  const places = r.localities.length ? r.localities : r.cities
  return (
    <section aria-labelledby="req-title" className="flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-card md:p-5">
      <h2 id="req-title" className="flex items-center gap-2 text-base font-semibold"><Building2 className="size-5 text-muted-foreground" aria-hidden="true" />{t('leads:detail.requirement')}</h2>
      <InlineEdit
        label={t('leads:detail.budget')} can={edit}
        display={(
          <span className="flex items-start gap-2.5">
            <IndianRupee className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
            <span>
              <span className="block text-meta text-muted-foreground">{t('leads:detail.budget')}</span>
              <span className="text-base font-semibold tabular-nums">{r.budgetMax || r.budgetMin ? inrRange(r.budgetMin, r.budgetMax, { upTo: t('domain:lead.upTo'), from: t('domain:lead.from') }) : t('leads:detail.notSet')}</span>
              {r.budgetBasis && <span className="block text-meta text-muted-foreground">{t(`leads:form.basis.${r.budgetBasis}`)}</span>}
            </span>
          </span>
        )}
        editor={(close) => <BudgetEditor lead={lead} close={close} />}
      />
      <InlineEdit
        label={t('leads:detail.places')} can={edit}
        display={(
          <span className="flex items-start gap-2.5">
            <MapPin className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-meta text-muted-foreground">{t('leads:detail.places')}</span>
              <span className="flex flex-wrap gap-1">
                {places.length ? places.map((p) => <span key={p} className="rounded-xs bg-muted px-1.5 py-0.5 text-meta">{p}</span>) : <span className="text-sm text-muted-foreground">{t('leads:detail.notSet')}</span>}
                {r.localities.length > 0 && r.cities.map((c) => <span key={c} className="px-0.5 text-meta text-muted-foreground">{c}</span>)}
              </span>
            </span>
          </span>
        )}
        editor={(close) => <PlacesEditor lead={lead} close={close} />}
      />
      <InlineEdit
        label={t('leads:detail.config')} can={edit}
        display={(
          <span className="flex items-start gap-2.5">
            <Building2 className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-meta text-muted-foreground">{t('leads:detail.config')}</span>
              <span className="flex flex-wrap gap-1">
                {r.configurations.map((c) => <span key={c} className="rounded-xs bg-muted px-1.5 py-0.5 text-meta font-medium">{configLabel(c)}</span>)}
                {r.propertyTypes.map((p) => <span key={p} className="rounded-xs bg-muted px-1.5 py-0.5 text-meta">{t(`catalogue:propertyType.${p}`)}</span>)}
                <span className="rounded-xs bg-muted px-1.5 py-0.5 text-meta">{t(`catalogue:possession.${r.possession}`)}</span>
              </span>
            </span>
          </span>
        )}
        editor={(close) => <ConfigEditor lead={lead} close={close} />}
      />
      {(r.areaMinSqft || r.facing.length > 0 || r.amenities.length > 0 || r.mustHaves.length > 0) && (
        <div className="flex flex-wrap gap-1 px-1.5 pt-1">
          {r.areaMinSqft && <span className="rounded-xs bg-muted px-1.5 py-0.5 text-meta tabular-nums">{t('leads:detail.area', { min: r.areaMinSqft, max: r.areaMaxSqft ?? r.areaMinSqft })}</span>}
          {r.facing.map((f) => <span key={f} className="rounded-xs bg-muted px-1.5 py-0.5 text-meta">{t(`catalogue:facing.${f}`)}</span>)}
          {r.amenities.slice(0, 4).map((a) => <span key={a} className="rounded-xs bg-muted px-1.5 py-0.5 text-meta">{t(`catalogue:amenity.${a}`, { defaultValue: a })}</span>)}
          {r.mustHaves.map((m) => <span key={m} className="rounded-xs bg-highlight-soft px-1.5 py-0.5 text-meta">{m}</span>)}
        </div>
      )}
    </section>
  )
}

/** Classification and HNI: managers and admins see and set them; executives see "Restricted" (lead.viewHni). */
export function ClassificationCard({ lead }: { lead: Lead }) {
  const { t } = useTranslation(['leads', 'catalogue'])
  const { can, scope } = usePermission()
  const db = useWholeDb()
  const now = useNow()
  const cls = classificationOf(lead, { properties: db.properties, settings: db.settings, now })
  const seeHni = scope('lead.viewHni') !== false
  const edit = can('lead.edit', lead)
  const hni = cls === 'potentialHni' || cls === 'verifiedHni'
  return (
    <section aria-labelledby="cls-title" className="flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-card md:p-5">
      <h2 id="cls-title" className="flex items-center gap-2 text-base font-semibold"><Gem className="size-5 text-muted-foreground" aria-hidden="true" />{t('leads:detail.classification')}</h2>
      {!seeHni && hni ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="hni-restricted"><Lock className="size-4" aria-hidden="true" />{t('leads:detail.restricted')}</p>
      ) : (
        <>
          <p className="text-sm">
            <span className="font-medium">{t(`catalogue:classification.${seeHni ? cls : hni ? 'highValue' : cls}`)}</span>
            {!lead.classification && <span className="ml-1.5 text-meta text-ai">✦ {t('leads:detail.suggested')}</span>}
          </p>
          {seeHni && edit && (
            <div className="flex flex-wrap items-center gap-2">
              <Select value={lead.classification ?? ''} onValueChange={(v) => {
                try {
                  const r = updateLeadFields(lead.id, { classification: v as Classification }, { undoable: true })
                  toastUndo(t('leads:detail.classSaved'), r.undoToken)
                } catch (e) { toastError(e) }
              }}>
                <SelectTrigger size="sm" className="h-8 w-48" aria-label={t('leads:detail.setClass')}><SelectValue placeholder={t('leads:detail.setClass')} /></SelectTrigger>
                <SelectContent>{CLASSIFICATIONS.map((c) => <SelectItem key={c} value={c}>{t(`catalogue:classification.${c}`)}</SelectItem>)}</SelectContent>
              </Select>
              {hni && (
                <Select value={lead.hni?.status ?? 'notDetermined'} onValueChange={(v) => {
                  try { setHniStatus(lead.id, v as NonNullable<Lead['hni']>['status']); toastUndo(t('leads:detail.hniSaved'), undefined) } catch (e) { toastError(e) }
                }}>
                  <SelectTrigger size="sm" className="h-8 w-48" aria-label={t('leads:detail.hniStatus')}><SelectValue /></SelectTrigger>
                  <SelectContent>{(['notDetermined', 'potential', 'consentInProgress', 'verified', 'declined'] as const).map((s) => <SelectItem key={s} value={s}>{t(`leads:hni.${s}`)}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
          )}
        </>
      )}
      <p className="text-meta text-muted-foreground">
        {lead.consent?.followUp && !lead.consent.withdrawnAt ? t('leads:detail.consentYes', { date: fmtDate(lead.consent.at) }) : t('leads:detail.consentNo')}
      </p>
    </section>
  )
}
