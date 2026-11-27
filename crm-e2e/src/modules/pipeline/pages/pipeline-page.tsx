/**
 * /pipeline (master prompt §11, foundation-plan §8.3 M6): the deals board with drag and drop (pointer + keyboard), the
 * list view, filters (executive for managers and admins, source, temperature, value), the stage progress strip, the
 * analytics strip, and the AI row (stalled deals with recommended actions, the pipeline assistant, ✦ predictions).
 * Every move goes through services/leads.changeStage, so the lead, Today, Reports and the timeline update (E5).
 * Lost asks for a reason, Booked for the amount and property, Won for a confirmation; other moves toast with Undo.
 */
import { useCallback, useMemo, useState } from 'react'
import { LayoutGrid, List, Plus, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { paths } from '@/app/paths'
import { getAI } from '@/ai'
import { AppointmentFormDialog } from '@/components/domain/appointment-form-dialog'
import { StageChangeDialog } from '@/components/domain/stage-change-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { FilterBar } from '@/components/shared/filter-bar'
import { FilterPill } from '@/components/shared/filter-pill'
import { FilteredEmpty } from '@/components/shared/filtered-empty'
import { PageHeader } from '@/components/shared/page-header'
import { Segmented } from '@/components/shared/segmented'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { Chip } from '@/components/shared/chip'
import { Button } from '@/components/ui/button'
import { EmptyPipeline } from '@/components/illustrations'
import { LEAD_SOURCES, OPEN_STAGES, TEMPERATURES, UPCOMING_APPOINTMENT_STATUSES } from '@/domain/catalogue'
import type { ID, Lead, PipelineStageKey } from '@/domain/types'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useWholeDb } from '@/hooks/use-db'
import { useIsPhone } from '@/hooks/use-media-query'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { leadScore } from '@/lib/scoring'
import { stalledDeals } from '@/lib/stalled'
import { changeStage } from '@/services/leads'
import { visible } from '@/services/queries/visibility'
import { PipelineAssistant, StalledDealsPanel } from '../components/pipeline-ai'
import { PipelineKpis, StageAnalyticsStrip } from '../components/pipeline-analytics'
import { PipelineBoard } from '../components/pipeline-board'
import { PipelineList } from '../components/pipeline-list'
import { PipelineMobile } from '../components/pipeline-mobile'
import { StageProgressStrip } from '../components/stage-progress-strip'
import {
  activeFilterCount, boardStages, buildDeals, columnSummaries, dealValue, EMPTY_FILTERS, matchesDeal, NEEDS_DIALOG, pipelineFiltersFromParams, pipelineTotals,
  sortDeals, stageAnalytics, UNASSIGNED, VALUE_BANDS, weeklySeries, wonDates, type DealSort, type PipelineFilters, type ValueBand,
} from '../lib/pipeline'

type View = 'board' | 'list'
type StageDialog = { leadId: ID; to: PipelineStageKey; onDone?: () => void }

const AI_OPEN_KEY = 'crm-e2e.pipeline.aiOpen'
/** Open by default on wide screens, folded on phones (it sits above the board); the viewer's choice is remembered. */
const readAiOpen = () => {
  const wide = typeof window === 'undefined' || !window.matchMedia || window.matchMedia('(min-width: 768px)').matches
  try {
    const v = localStorage.getItem(AI_OPEN_KEY)
    return v === null ? wide : v === '1'
  } catch {
    return wide
  }
}

export default function PipelinePage() {
  const { t } = useTranslation(['pipeline', 'catalogue', 'domain', 'common'])
  const db = useWholeDb()
  const user = useCurrentUser()
  const now = useNow()
  const navigate = useNavigate()
  const isPhone = useIsPhone()
  const { can, scope } = usePermission()
  const [params, setParams] = useSearchParams()
  const view: View = params.get('view') === 'list' ? 'list' : 'board'
  const [filters, setFilters] = useState<PipelineFilters>(() => pipelineFiltersFromParams(params))
  // a new click-through link while the board is open replaces the filters, as a fresh visit would
  const linkKey = ['stage', 'source', 'stalled'].map((k) => params.get(k) ?? '').join('|')
  const [seenLink, setSeenLink] = useState(linkKey)
  if (seenLink !== linkKey) {
    setSeenLink(linkKey)
    if (linkKey !== '||') setFilters(pipelineFiltersFromParams(params))
  }
  const [sort, setSort] = useState<DealSort>({ key: 'value', dir: 'desc' })
  const [stageDialog, setStageDialog] = useState<StageDialog | null>(null)
  const [visitFor, setVisitFor] = useState<ID | null>(null)
  const [mobileStage, setMobileStage] = useState<PipelineStageKey | null>(() => filters.stages[0] ?? null)
  const [aiOpen, setAiOpenState] = useState(readAiOpen)
  const setAiOpen = (o: boolean) => {
    setAiOpenState(o)
    try {
      localStorage.setItem(AI_OPEN_KEY, o ? '1' : '0')
    } catch {
      // storage blocked (private mode): the panel just forgets the choice
    }
  }

  const stages = useMemo(() => boardStages(db.settings), [db.settings])
  const leads = useMemo(() => visible.leads(db, user), [db, user])
  const deals = useMemo(() => {
    const ctx = { properties: db.properties, settings: db.settings, now }
    return buildDeals(leads, { properties: db.properties, users: db.users, tasks: db.tasks, settings: db.settings, now, score: (l) => leadScore(l, ctx) })
  }, [leads, db.properties, db.users, db.tasks, db.settings, now])
  const shown = useMemo(() => deals.filter((d) => stages.includes(d.lead.stage) && matchesDeal(d, filters)), [deals, stages, filters])
  const summaries = useMemo(() => columnSummaries(shown, stages), [shown, stages])
  const totals = useMemo(() => pipelineTotals(shown), [shown])
  const analytics = useMemo(() => stageAnalytics(shown.map((d) => d.lead), stages, now), [shown, stages, now])
  const stalled = useMemo(() => stalledDeals(shown.map((d) => d.lead), db.settings, now, dealValue), [shown, db.settings, now])
  const spark = useMemo(() => ({
    created: weeklySeries(shown.map((d) => d.lead.createdAt), now),
    won: weeklySeries(wonDates(shown.map((d) => d.lead)), now),
  }), [shown, now])
  const listRows = useMemo(() => sortDeals(shown, sort, stages), [shown, sort, stages])
  const targets = useMemo(() => Object.fromEntries(db.settings.pipeline.stages.map((s) => [s.key, s.targetDays])), [db.settings])
  const valueOf = useMemo(() => {
    const m = new Map(deals.map((d) => [d.lead.id, d.value]))
    return (id: ID) => m.get(id) ?? 0
  }, [deals])
  const ownerName = useCallback((id: ID | null) => db.users.find((u) => u.id === id)?.name, [db.users])

  const seeTeam = scope('lead.view') !== 'own'
  const ownerOptions = useMemo(() => {
    const ids = new Set(deals.map((d) => d.lead.ownerId ?? UNASSIGNED))
    const opts = db.users.filter((u) => ids.has(u.id)).map((u) => ({ value: u.id, label: u.name, count: deals.filter((d) => d.lead.ownerId === u.id).length }))
    if (ids.has(UNASSIGNED)) opts.push({ value: UNASSIGNED, label: t('pipeline:card.unassigned'), count: deals.filter((d) => !d.lead.ownerId).length })
    return opts
  }, [deals, db.users, t])
  const sourceOptions = useMemo(
    () => LEAD_SOURCES.filter((s) => deals.some((d) => d.lead.source === s)).map((s) => ({ value: s, label: t(`catalogue:source.${s}`), count: deals.filter((d) => d.lead.source === s).length })),
    [deals, t],
  )
  const setF = (patch: Partial<PipelineFilters>) => {
    setFilters((f) => ({ ...f, ...patch }))
    // the URL keeps the owner; click-through params (stage, source, stalled) are dropped once the user edits filters
    setParams((p) => {
      const n = new URLSearchParams(p)
      if (patch.owners) {
        if (patch.owners.length === 1) n.set('owner', patch.owners[0])
        else n.delete('owner')
      }
      for (const k of ['stage', 'source', 'stalled']) n.delete(k)
      return n
    }, { replace: true })
    setSeenLink('||')
  }
  const clearFilters = () => setF({ ...EMPTY_FILTERS })
  const setView = (v: View) => setParams((p) => {
    const n = new URLSearchParams(p)
    if (v === 'list') n.set('view', 'list')
    else n.delete('view')
    return n
  }, { replace: true })

  const openLead = (lead: Lead) => navigate(paths.lead(lead.id))

  const hasUpcomingVisit = (leadId: ID) => db.appointments.some((a) => a.leadId === leadId && a.type === 'siteVisit' && UPCOMING_APPOINTMENT_STATUSES.includes(a.status) && a.start >= now.toISOString())

  /** The one place a move starts (drag, menu, sheet, assistant). */
  const requestMove = (lead: Lead, to: PipelineStageKey, onDone?: () => void) => {
    if (to === lead.stage) return
    const action = to === 'booked' || to === 'converted' ? 'lead.markBooked' : 'lead.moveStage'
    if (!can(action, lead)) {
      toast.error(t('pipeline:move.denied', { name: lead.name }))
      return
    }
    if (NEEDS_DIALOG.includes(to)) {
      setStageDialog({ leadId: lead.id, to, onDone })
      return
    }
    try {
      const r = changeStage(lead.id, to)
      toastUndo(t('domain:stage.done', { name: lead.name, stage: t(`catalogue:stage.${to}`) }), r.undoToken)
      onDone?.()
      afterMove(lead.id, to)
    } catch (e) {
      toastError(e)
    }
  }
  const afterMove = (leadId: ID, to: PipelineStageKey) => {
    // E5: a manual move to "Visit scheduled" with no visit booked opens the appointment form (it never books by itself)
    const lead = db.leads.find((l) => l.id === leadId)
    if (to === 'siteVisitScheduled' && lead && !hasUpcomingVisit(leadId) && can('appointment.manage', lead)) {
      setVisitFor(leadId)
      toast.info(t('pipeline:move.bookVisit', { name: lead.name }))
    }
  }

  const pickStage = (s: PipelineStageKey) => {
    if (isPhone && view === 'board') setMobileStage(s)
    else if (view === 'board') document.getElementById(`pipeline-col-${s}`)?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
  }

  const examples = useMemo(() => {
    const first = stalled[0]?.lead ?? shown.find((d) => OPEN_STAGES.includes(d.lead.stage))?.lead
    const list = [t('pipeline:assistant.exStalled'), t('pipeline:assistant.exConversions')]
    if (first) {
      const i = stages.indexOf(first.stage)
      const next = stages.slice(i + 1).find((s) => s !== 'lost' && !NEEDS_DIALOG.includes(s)) ?? 'negotiation'
      list.unshift(t('pipeline:assistant.exMove', { name: first.name, stage: t(`pipeline:assistant.stageWord.${next}`) }))
    }
    return list
  }, [stalled, shown, stages, t])

  const currentMobileStage = mobileStage ?? summaries.find((s) => s.count > 0 && OPEN_STAGES.includes(s.stage))?.stage ?? stages[0]
  const activeCount = activeFilterCount(filters)
  const nothingAtAll = !deals.length

  const header = (
    <PageHeader
      title={t('pipeline:title')}
      subtitle={t('pipeline:subtitle')}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<View>
            variant="pill" label={t('pipeline:view.label')} value={view} onChange={setView}
            segments={[
              { value: 'board', label: t('pipeline:view.board'), icon: <LayoutGrid aria-hidden="true" /> },
              { value: 'list', label: t('pipeline:view.list'), icon: <List aria-hidden="true" /> },
            ]}
          />
          {can('lead.create') && (
            <Button asChild size="sm"><Link to={paths.newLead()}><Plus />{t('pipeline:addLead')}</Link></Button>
          )}
        </div>
      }
    />
  )

  if (nothingAtAll) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <EmptyState
          illustration={EmptyPipeline}
          title={t('pipeline:empty.title')}
          body={t('pipeline:empty.body')}
          primary={can('lead.create') ? <Button asChild><Link to={paths.newLead()}><Plus />{t('pipeline:addLead')}</Link></Button> : undefined}
          secondary={can('import.leads') ? <Button asChild variant="secondary"><Link to={paths.importKind('leads')}><Upload />{t('pipeline:empty.import')}</Link></Button> : undefined}
        />
      </div>
    )
  }

  const filteredEmpty = <FilteredEmpty title={t('pipeline:filteredEmpty')} onClear={clearFilters} />

  return (
    <div className="flex min-w-0 flex-col gap-5" data-testid="pipeline-page">
      {header}
      <StageProgressStrip summaries={summaries} onPick={pickStage} />
      <PipelineKpis totals={totals} spark={spark} mode={getAI().mode} stalledOn={filters.stalledOnly} onStalled={() => setF({ stalledOnly: !filters.stalledOnly })} />

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <StalledDealsPanel stalled={stalled} now={now} value={valueOf} ownerName={ownerName} open={aiOpen} onOpenChange={setAiOpen} />
        <PipelineAssistant
          examples={examples}
          onNeedDialog={(leadId, to, onDone) => {
            const lead = db.leads.find((l) => l.id === leadId)
            if (lead) requestMove(lead, to, onDone)
          }}
        />
      </div>

      <StageAnalyticsStrip rows={analytics} targets={targets} onPick={pickStage} />

      <FilterBar
        search={filters.q}
        onSearch={(q) => setF({ q })}
        searchLabel={t('pipeline:filters.search')}
        placeholder={t('pipeline:filters.searchPlaceholder')}
        activeCount={activeCount}
        onClearAll={clearFilters}
        filters={
          <>
            {seeTeam && <FilterPill label={t('pipeline:filters.owner')} options={ownerOptions} selected={filters.owners} onChange={(owners) => setF({ owners })} />}
            <FilterPill
              label={t('pipeline:filters.stage')}
              options={stages.map((x) => ({ value: x, label: t(`catalogue:stage.${x}`), count: deals.filter((d) => d.lead.stage === x).length }))}
              selected={filters.stages} onChange={(v) => setF({ stages: v as PipelineStageKey[] })}
            />
            <FilterPill label={t('pipeline:filters.source')} options={sourceOptions} selected={filters.sources} onChange={(v) => setF({ sources: v as PipelineFilters['sources'] })} />
            <FilterPill
              label={t('pipeline:filters.temperature')}
              options={TEMPERATURES.map((x) => ({ value: x, label: t(`catalogue:temperature.${x}`), count: deals.filter((d) => d.temperature === x).length }))}
              selected={filters.temperatures} onChange={(v) => setF({ temperatures: v as PipelineFilters['temperatures'] })}
            />
            <FilterPill
              label={t('pipeline:filters.value')}
              options={VALUE_BANDS.map((b) => ({ value: b, label: t(`pipeline:valueBand.${b}`) }))}
              selected={filters.values} onChange={(v) => setF({ values: v as ValueBand[] })}
            />
            <Chip pressed={filters.stalledOnly} onClick={() => setF({ stalledOnly: !filters.stalledOnly })} data-testid="stalled-only">
              {t('pipeline:filters.stalledOnly')}
            </Chip>
          </>
        }
      />

      {!shown.length ? filteredEmpty : view === 'list' ? (
        <PipelineList
          deals={listRows} stages={stages} now={now} sort={sort}
          onSort={(key) => setSort((s) => ({ key: key as DealSort['key'], dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))}
          onMove={(lead, to) => requestMove(lead, to)} onOpen={openLead} empty={filteredEmpty}
        />
      ) : isPhone ? (
        <PipelineMobile
          stages={stages} summaries={summaries} deals={shown} stage={currentMobileStage} onStage={setMobileStage}
          now={now} onMove={(lead, to) => requestMove(lead, to)} onOpen={openLead}
        />
      ) : (
        <PipelineBoard stages={stages} deals={shown} summaries={summaries} now={now} onMove={(lead, to) => requestMove(lead, to)} onOpen={openLead} />
      )}

      {stageDialog && (
        <StageChangeDialog
          key={`${stageDialog.leadId}-${stageDialog.to}`}
          open
          onOpenChange={(o) => { if (!o) setStageDialog(null) }}
          leadId={stageDialog.leadId}
          to={stageDialog.to}
          onDone={(to) => {
            stageDialog.onDone?.()
            afterMove(stageDialog.leadId, to)
          }}
          onCancel={() => toast(t('pipeline:move.cancelled'))}
        />
      )}
      {visitFor && (
        <AppointmentFormDialog
          open
          onOpenChange={(o) => { if (!o) setVisitFor(null) }}
          leadId={visitFor}
          type="siteVisit"
          onSaved={() => setVisitFor(null)}
        />
      )}
    </div>
  )
}
