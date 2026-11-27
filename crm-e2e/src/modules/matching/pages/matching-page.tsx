/**
 * Matching (master prompt §14, plan §8.3 M3): pick a buyer → ranked properties, or pick a property → ranked buyers.
 * Every match shows its percentage, label and plain reasons (✓ fits · ✗ gaps · amber notes); "close on budget" and
 * "not shown, and why" make the cut-off visible. Actions: Shortlist, Share on WhatsApp (logged, E11), Schedule site
 * visit (dialog prefilled), Not interested (never suggested again, Undo). Booked and sold properties never appear.
 * The matching assistant reads requests like "properties within Priya's budget in Whitefield".
 */
import { useMemo, useState } from 'react'
import { Building2, ChevronDown, LayoutGrid, List, MessageCircle, SearchX, Sparkles, Target, UserRound, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { paths } from '@/app/paths'
import { MatchList, useMatchActions } from '@/components/domain/match-list'
import { PropertyCard } from '@/components/domain/property-card'
import { MatchLabelBadge } from '@/components/domain/property-pills'
import { EmptyMatches } from '@/components/illustrations'
import { Chip } from '@/components/shared/chip'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { ScoreRing } from '@/components/shared/progress-ring'
import { SectionCard } from '@/components/shared/section-card'
import { Segmented } from '@/components/shared/segmented'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { OPEN_STAGES } from '@/domain/catalogue'
import type { ID } from '@/domain/types'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useWholeDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { inrShort } from '@/lib/format'
import {
  bestMatchesToday, closeOnBudget, closeOnBudgetForLead, excludedForLead, isMatchableLead, leadsForProperty, propertiesForLead, reasonText, type Match,
} from '@/lib/matching'
import { isMatchable } from '@/lib/property'
import { EMPTY_PROPERTY_FILTERS, criteriaKeys, criterionLabel, propertyMatchesFilters, type PropertyFilters } from '@/lib/search'
import { cn } from '@/lib/utils'
import { visible } from '@/services/queries/visibility'
import { LeadSummary, PropertySummary } from '../components/target-summary'
import { MatchingAssistant } from '../components/matching-assistant'
import { narrowMatches, type MatchingReading } from '../lib/assistant'

type Mode = 'lead' | 'property'

export default function MatchingPage() {
  const { t } = useTranslation(['matching', 'catalogue', 'common'])
  const db = useWholeDb()
  const user = useCurrentUser()
  const now = useNow()
  const { can } = usePermission()
  const [params, setParams] = useSearchParams()
  const { actions, share, dialogs } = useMatchActions()
  const leadId = params.get('lead') ?? undefined
  const propertyId = params.get('property') ?? undefined
  const mode: Mode = propertyId && !leadId ? 'property' : (params.get('mode') as Mode) === 'property' ? 'property' : 'lead'
  const [extra, setExtra] = useState<PropertyFilters>(EMPTY_PROPERTY_FILTERS)
  const [search, setSearch] = useState<PropertyFilters | null>(null)
  const [layout, setLayout] = useState<'cards' | 'list'>('cards')
  const [picked, setPicked] = useState<Set<ID>>(new Set())

  const myLeads = useMemo(() => visible.leads(db, user), [db, user])
  const openLeads = useMemo(() => myLeads.filter((l) => OPEN_STAGES.includes(l.stage)).sort((a, b) => a.name.localeCompare(b.name)), [myLeads])
  const matchable = useMemo(() => db.properties.filter(isMatchable).sort((a, b) => a.title.localeCompare(b.title)), [db.properties])
  const lead = leadId ? myLeads.find((l) => l.id === leadId) : undefined
  const property = propertyId ? db.properties.find((p) => p.id === propertyId) : undefined

  const forLead = useMemo(() => {
    if (!lead) return null
    const all = propertiesForLead(lead, db.properties, db.settings, now)
    return {
      matches: narrowMatches(all, extra),
      total: all.length,
      close: closeOnBudgetForLead(lead, db.properties, db.settings, now),
      notShown: excludedForLead(lead, db.properties, db.settings, now).filter((m) => m.label !== 'budgetMismatch'),
    }
  }, [lead, db.properties, db.settings, now, extra])
  const forProperty = useMemo(() => {
    if (!property) return null
    return { matches: leadsForProperty(property, myLeads, db.settings, now), close: closeOnBudget(property, myLeads, db.settings, now) }
  }, [property, myLeads, db.settings, now])
  const fresh = useMemo(() => bestMatchesToday(db, user, now, 6), [db, user, now])
  const searchResults = useMemo(() => (search ? matchable.filter((p) => propertyMatchesFilters(p, search)) : []), [search, matchable])

  const setTarget = (next: { lead?: ID; property?: ID; mode?: Mode }) => {
    const sp = new URLSearchParams()
    if (next.lead) sp.set('lead', next.lead)
    if (next.property) sp.set('property', next.property)
    if (next.mode === 'property' && !next.property) sp.set('mode', 'property')
    setParams(sp, { replace: false })
    setPicked(new Set())
  }
  const switchMode = (m: Mode) => { setExtra(EMPTY_PROPERTY_FILTERS); setSearch(null); setTarget({ mode: m }) }
  const applyReading = (r: MatchingReading) => {
    if (r.mode === 'lead' && r.leadId) { setSearch(null); setExtra(r.filters); setTarget({ lead: r.leadId }) }
    else if (r.mode === 'property' && r.propertyId) { setSearch(null); setExtra(EMPTY_PROPERTY_FILTERS); setTarget({ property: r.propertyId }) }
    else { setExtra(EMPTY_PROPERTY_FILTERS); setSearch(r.filters); setTarget({ mode: 'lead' }) }
  }
  const examples = useMemo(() => {
    const first = (fresh[0]?.lead ?? openLeads.find(isMatchableLead))?.name.split(' ')[0] ?? 'Priya'
    const loc = (fresh[0]?.lead ?? openLeads.find(isMatchableLead))?.requirement.localities[0] ?? 'Whitefield'
    return [t('assistant.example1', { name: first, locality: loc }), t('assistant.example2'), t('assistant.example3', { id: matchable[0]?.id ?? 'PRP-1001' })]
  }, [fresh, openLeads, matchable, t])

  const extraKeys = criteriaKeys(extra)
  const searchKeys = search ? criteriaKeys(search) : []
  const togglePick = (id: ID, on: boolean) => setPicked((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n })

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
      <PageHeader
        title={t('title')} subtitle={t('subtitle')}
        actions={(
          <Segmented
            variant="pill" value={mode} onChange={switchMode} label={t('mode.label')}
            segments={[
              { value: 'lead', label: t('mode.lead'), icon: <UserRound aria-hidden="true" /> },
              { value: 'property', label: t('mode.property'), icon: <Building2 aria-hidden="true" /> },
            ]}
          />
        )}
      />

      <div className="grid gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <MatchingAssistant leads={openLeads} properties={matchable} onApply={applyReading} examples={examples} />
          <section aria-label={mode === 'lead' ? t('pick.lead') : t('pick.property')} className="flex flex-col gap-2">
            <label htmlFor="match-target" className="text-sm font-medium">{mode === 'lead' ? t('pick.lead') : t('pick.property')}</label>
            {mode === 'lead' ? (
              <Select value={lead?.id ?? ''} onValueChange={(v) => { setExtra(EMPTY_PROPERTY_FILTERS); setSearch(null); setTarget({ lead: v }) }}>
                <SelectTrigger id="match-target" className="w-full" data-testid="match-pick-lead"><SelectValue placeholder={t('pick.leadPlaceholder')} /></SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectGroup>
                    <SelectLabel>{t('pick.openLeads', { count: openLeads.length })}</SelectLabel>
                    {openLeads.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}{l.requirement.localities[0] ? ` · ${l.requirement.localities[0]}` : ''}{l.requirement.budgetMax ? ` · ${inrShort(l.requirement.budgetMax)}` : ''}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            ) : (
              <Select value={property?.id ?? ''} onValueChange={(v) => setTarget({ property: v })}>
                <SelectTrigger id="match-target" className="w-full" data-testid="match-pick-property"><SelectValue placeholder={t('pick.propertyPlaceholder')} /></SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectGroup>
                    <SelectLabel>{t('pick.available', { count: matchable.length })}</SelectLabel>
                    {matchable.map((p) => <SelectItem key={p.id} value={p.id}>{p.title} · {p.price ? inrShort(p.price) : ''}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
            <p className="text-meta text-muted-foreground">{mode === 'lead' ? t('pick.leadHint') : t('pick.propertyHint')}</p>
          </section>
          {mode === 'lead' && lead && <LeadSummary lead={lead} />}
          {mode === 'property' && property && <PropertySummary property={property} />}
          {mode === 'lead' && !lead && fresh.length > 0 && (
            <SectionCard title={t('fresh.title')} icon={Sparkles} description={t('fresh.body')}>
              <ul className="flex flex-col gap-1.5">
                {fresh.map((m) => (
                  <li key={m.lead.id}>
                    <button type="button" onClick={() => setTarget({ lead: m.lead.id })} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors duration-(--dur-fast) hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                      <UserAvatar name={m.lead.name} size="sm" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">{m.lead.name}</span>
                        <span className="flex min-w-0 items-center gap-1 text-meta text-muted-foreground"><Building2 className="size-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{m.property.title}</span></span>
                      </span>
                      <ScoreRing score={m.score} kind="match" size={42} label={t('fresh.title')} />
                    </button>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4" aria-live="polite">
          {/* plain search from the assistant (no buyer named) */}
          {mode === 'lead' && !lead && search && (
            <SectionCard
              title={t('search.title', { count: searchResults.length })} icon={SearchX}
              description={t('search.body')}
              action={<Button variant="ghost" size="sm" onClick={() => setSearch(null)}><X />{t('search.clear')}</Button>}
            >
              <ReadingChips keys={searchKeys} filters={search} />
              {searchResults.length ? (
                <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">{searchResults.map((p) => <PropertyCard key={p.id} property={p} />)}</div>
              ) : <EmptyState compact illustration={EmptyMatches} title={t('search.none')} />}
            </SectionCard>
          )}

          {mode === 'lead' && !lead && !search && (
            <EmptyState illustration={EmptyMatches} title={t('empty.leadTitle')} body={t('empty.leadBody')} className="rounded-lg border bg-card" />
          )}
          {mode === 'lead' && leadId && !lead && <EmptyState compact illustration={EmptyMatches} title={t('empty.noLeadAccess')} body={t('empty.noLeadAccessBody')} className="rounded-lg border bg-card" />}
          {mode === 'property' && !property && (
            <EmptyState illustration={EmptyMatches} title={t('empty.propertyTitle')} body={t('empty.propertyBody')} className="rounded-lg border bg-card" />
          )}

          {mode === 'lead' && lead && forLead && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="flex-1 text-lg font-semibold" data-testid="match-count">{t('results.forLead', { count: forLead.matches.length, name: lead.name })}</h2>
                {picked.size > 0 && can('lead.edit', lead) && (
                  <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" onClick={() => share(lead.id, [...picked])} data-testid="share-selected">
                    <MessageCircle />{t('results.shareSelected', { count: picked.size })}
                  </Button>
                )}
                <Segmented
                  variant="pill" value={layout} onChange={setLayout} label={t('results.layout')}
                  segments={[
                    { value: 'cards', label: <span className="sr-only">{t('results.cards')}</span>, icon: <LayoutGrid aria-hidden="true" />, ariaLabel: t('results.cards') },
                    { value: 'list', label: <span className="sr-only">{t('results.list')}</span>, icon: <List aria-hidden="true" />, ariaLabel: t('results.list') },
                  ]}
                />
              </div>
              {extraKeys.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <ReadingChips keys={extraKeys} filters={extra} />
                  <Button variant="ghost" size="sm" onClick={() => setExtra(EMPTY_PROPERTY_FILTERS)}><X />{t('results.showAll', { count: forLead.total })}</Button>
                </div>
              )}
              {!isMatchableLead(lead) ? (
                <EmptyState compact illustration={EmptyMatches} title={t('empty.thinTitle')} body={t('empty.thinBody')} primary={<Button asChild variant="secondary"><Link to={paths.editLead(lead.id)}>{t('empty.completeRequirement')}</Link></Button>} className="rounded-lg border bg-card" />
              ) : !forLead.matches.length ? (
                <EmptyState compact illustration={EmptyMatches} title={t('empty.noneTitle')} body={t('empty.noneBody')} className="rounded-lg border bg-card" />
              ) : layout === 'cards' ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-4" data-testid="match-grid">
                  {forLead.matches.map((m) => (
                    <PropertyCard
                      key={m.property.id} property={m.property} match={m}
                      selected={picked.has(m.property.id)} onSelectedChange={(on) => togglePick(m.property.id, on)}
                      more={<MatchLabelBadge label={m.label} />}
                      actions={<CardActions m={m} actions={actions} />}
                    />
                  ))}
                </div>
              ) : (
                <MatchList matches={forLead.matches} actions={actions} />
              )}

              {forLead.close.length > 0 && (
                <SectionCard title={t('close.title', { count: forLead.close.length })} description={t('close.bodyLead')} className="border-dashed border-warning/50">
                  <MatchList matches={forLead.close} actions={{ onShare: actions.onShare, onSchedule: actions.onSchedule }} />
                </SectionCard>
              )}
              {forLead.notShown.length > 0 && <NotShown list={forLead.notShown} />}
            </>
          )}

          {mode === 'property' && property && forProperty && (
            <>
              <h2 className="text-lg font-semibold" data-testid="match-count">{t('results.forProperty', { count: forProperty.matches.length, title: property.title })}</h2>
              {!isMatchable(property) ? (
                <EmptyState compact illustration={EmptyMatches} title={t('empty.notOnOffer', { status: t(`catalogue:propertyStatus.${property.status}`) })} body={t('empty.notOnOfferBody')} className="rounded-lg border bg-card" />
              ) : (
                <MatchList
                  matches={forProperty.matches} side="lead" actions={actions}
                  empty={<EmptyState compact illustration={EmptyMatches} title={t('empty.noBuyersTitle')} body={t('empty.noBuyersBody')} />}
                />
              )}
              {forProperty.close.length > 0 && (
                <SectionCard title={t('close.title', { count: forProperty.close.length })} description={t('close.body')} className="border-dashed border-warning/50">
                  <MatchList matches={forProperty.close} side="lead" actions={{ onShare: actions.onShare, onSchedule: actions.onSchedule }} />
                </SectionCard>
              )}
            </>
          )}
        </div>
      </div>
      {dialogs}
    </div>
  )
}

function CardActions({ m, actions }: { m: Match; actions: ReturnType<typeof useMatchActions>['actions'] }) {
  const { t } = useTranslation('domain')
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => actions.onShortlist(m)} disabled={m.memory === 'shortlisted'}>{t('match.shortlist')}</Button>
      <Button variant="ghost" size="sm" className="text-success hover:bg-success-soft hover:text-success" onClick={() => actions.onShare(m)}><MessageCircle />{t('match.share')}</Button>
      <Button variant="ghost" size="sm" onClick={() => actions.onSchedule(m)}>{t('match.schedule')}</Button>
      <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={() => actions.onNotInterested(m)} aria-label={t('match.notInterested')} title={t('match.notInterested')}><X /></Button>
    </>
  )
}

function ReadingChips({ keys, filters }: { keys: string[]; filters: PropertyFilters }) {
  const { t } = useTranslation(['matching', 'properties', 'catalogue'])
  return (
    <span className="flex flex-wrap items-center gap-1.5" data-testid="match-reading">
      <span className="inline-flex items-center gap-1 text-meta font-medium text-ai"><Sparkles className="size-3.5" aria-hidden="true" />{t('matching:assistant.reading')}</span>
      {keys.map((k) => <Chip key={k} size="sm" tone="ai" pressed>{criterionLabel(k, filters, t)}</Chip>)}
    </span>
  )
}

/** "Not shown, and why": every live listing left out for this buyer, with its first reason. */
function NotShown({ list }: { list: Match[] }) {
  const { t } = useTranslation(['matching', 'domain'])
  const [open, setOpen] = useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border bg-card">
      <CollapsibleTrigger asChild>
        <button type="button" className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium" data-testid="not-shown-toggle">
          <Target className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="flex-1">{t('notShown.title', { count: list.length })}</span>
          <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="px-4 text-meta text-muted-foreground">{t('notShown.body')}</p>
        <ul className="flex flex-col divide-y px-4 pb-3">
          {list.map((m) => {
            const why = m.excluded ? m.reasons[0] : m.reasons.find((r) => r.ok === false) ?? m.reasons.find((r) => r.ok === null)
            return (
              <li key={m.property.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <Link to={paths.property(m.property.id)} className="min-w-0 flex-1 truncate font-medium hover:underline">{m.property.title}</Link>
                {m.excluded ? <MatchLabelBadge label="excluded" /> : <span className="text-meta text-muted-foreground tabular-nums">{t('domain:property.matchPct', { pct: Math.round(m.score) })}</span>}
                <span className="w-full text-meta text-muted-foreground sm:w-auto">{why ? reasonText(why, t) : ''}</span>
              </li>
            )
          })}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}
