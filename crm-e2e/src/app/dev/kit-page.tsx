/**
 * /__kit — a dev-only page that shows every shared, AI and domain component once, on real demo data
 * (foundation-plan §9). Not in the route registry or the nav; the router adds it only when import.meta.env.DEV.
 * Removed before delivery.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { CalendarCheck, CalendarPlus, IndianRupee, ListChecks, MessageCircle, MoreHorizontal, Phone, Target, Trash2, UserPlus, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { Extraction } from '@/ai/types'
import { propose } from '@/ai/proposals'
import { ActionProposalCard, type ProposalState } from '@/components/ai/action-proposal-card'
import { AIField, AIFieldMarker } from '@/components/ai/ai-field'
import { AISuggestionChip } from '@/components/ai/ai-suggestion-chip'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { EffortSaved } from '@/components/ai/effort-saved'
import { MissingQuestions } from '@/components/ai/missing-questions'
import { PasteAndFillBox } from '@/components/ai/paste-and-fill-box'
import { useAIFields } from '@/components/ai/use-ai-fields'
import { VoiceButton } from '@/components/ai/voice-button'
import { ActivityTimeline } from '@/components/domain/activity-timeline'
import { AppointmentCard } from '@/components/domain/appointment-card'
import { AppointmentFormDialog } from '@/components/domain/appointment-form-dialog'
import { AssignDialog } from '@/components/domain/assign-dialog'
import { ContactActions } from '@/components/domain/contact-actions'
import { EntityLink } from '@/components/domain/entity-link'
import { LeadCard } from '@/components/domain/lead-card'
import { LastContactBadge, SourcePill, StagePill, TemperaturePill } from '@/components/domain/lead-pills'
import { LogActivityDialog } from '@/components/domain/log-activity-dialog'
import { MatchList } from '@/components/domain/match-list'
import { PropertyCard } from '@/components/domain/property-card'
import { AvailabilityPill, SpecChip } from '@/components/domain/property-pills'
import { StageChangeDialog } from '@/components/domain/stage-change-dialog'
import { TaskFormDialog } from '@/components/domain/task-form-dialog'
import { TaskRow } from '@/components/domain/task-row'
import * as Art from '@/components/illustrations'
import { AmountInput } from '@/components/shared/amount-input'
import { AvatarStack } from '@/components/shared/avatar-stack'
import { CountBadge, DotBadge, StatusDot, ToneBadge } from '@/components/shared/badges'
import { BulkBar } from '@/components/shared/bulk-bar'
import { Callout } from '@/components/shared/callout'
import { AreaTrendChart } from '@/components/shared/charts/area-chart'
import { BarSeriesChart } from '@/components/shared/charts/bar-chart'
import { DonutChart } from '@/components/shared/charts/donut-chart'
import { FunnelChart } from '@/components/shared/charts/funnel-chart'
import { Heatmap } from '@/components/shared/charts/heatmap'
import { Chip } from '@/components/shared/chip'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { DataTable, type Column, type Density, type TableSort } from '@/components/shared/data-table'
import { DateTimeField } from '@/components/shared/date-time-field'
import { Drawer } from '@/components/shared/drawer'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { FileUploader } from '@/components/shared/file-uploader'
import { FilterBar } from '@/components/shared/filter-bar'
import { FilterPill } from '@/components/shared/filter-pill'
import { FilteredEmpty } from '@/components/shared/filtered-empty'
import { FormField } from '@/components/shared/form-field'
import { Gauge } from '@/components/shared/gauge'
import { IconTile } from '@/components/shared/icon-tile'
import { Kbd } from '@/components/shared/kbd'
import { KeyValueGrid } from '@/components/shared/key-value-grid'
import { KpiCard } from '@/components/shared/kpi-card'
import { MappingTable } from '@/components/shared/mapping-table'
import { Meter } from '@/components/shared/meter'
import { PageHeader } from '@/components/shared/page-header'
import { Pagination } from '@/components/shared/pagination'
import { PhoneInput } from '@/components/shared/phone-input'
import { ProgressRing, ScoreRing } from '@/components/shared/progress-ring'
import { SectionCard } from '@/components/shared/section-card'
import { Segmented } from '@/components/shared/segmented'
import { CardSkeleton, ChartBlockSkeleton, TableSkeleton } from '@/components/shared/skeletons'
import { ColumnMenu, DensityToggle } from '@/components/shared/table-controls'
import { toastUndo } from '@/components/shared/undo-toast'
import { UserAvatar } from '@/components/shared/user-avatar'
import { WorkloadBars, WorkloadLegend } from '@/components/shared/workload-bar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { STAGES } from '@/domain/catalogue'
import type { ColumnMapping, Lead, LeadInput } from '@/domain/types'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useWholeDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { configLabel, propertiesForLead } from '@/lib/matching'
import { inrShort } from '@/lib/format'
import { phoneDisplay } from '@/lib/phone'
import { leadScore } from '@/lib/scoring'
import { mapColumnsSim } from '@/ai/simulated/columns'
import { activityHeatmap, funnel, inventoryByStatus, leadsBySource, monthlyTrend } from '@/services/queries/stats'
import { visible } from '@/services/queries/visibility'

const SAMPLE_HEADERS = ['Customer Name', 'Mobile No', 'Locality', 'BHK', 'Budget', 'Remarks']
const SAMPLE_ROWS = [['Priya Nair', '98450 12345', 'Gachibowli', '3 BHK', '1.2 Cr', 'Wants east facing'], ['Anil Rao', '9900112233', 'Kokapet', '2 BHK', '85 L', '']]

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="flex scroll-mt-20 flex-col gap-4">
      <h2 id={`${id}-h`} className="border-b pb-2 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}

export default function KitPage() {
  const { t } = useTranslation(['kit', 'catalogue', 'common', 'ai'])
  const db = useWholeDb()
  const user = useCurrentUser()
  const now = useNow()
  const leads = useMemo(() => visible.leads(db, user), [db, user])
  const lead = leads.find((l) => l.stage === 'qualified' || l.stage === 'siteVisitScheduled') ?? leads[0]
  const matches = useMemo(() => (lead ? propertiesForLead(lead, db.properties, db.settings, now, { limit: 4 }) : []), [lead, db, now])
  const appointments = db.appointments.filter((a) => a.status !== 'cancelled').slice(0, 3)
  const tasks = visible.tasks(db, user).filter((x) => x.status === 'open').slice(0, 3)

  // table state
  const [sort, setSort] = useState<TableSort | null>({ key: 'score', dir: 'desc' })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [density, setDensity] = useState<Density>('comfortable')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(5)
  const [search, setSearch] = useState('')
  const [stages, setStages] = useState<string[]>([])
  const [tableState, setTableState] = useState<'data' | 'loading' | 'empty' | 'error'>('data')
  const scored = useMemo(() => leads.map((l) => ({ l, s: leadScore(l, { properties: db.properties, settings: db.settings, now }) })), [leads, db, now])
  const filtered = scored
    .filter((r) => !search || r.l.name.toLowerCase().includes(search.toLowerCase()))
    .filter((r) => !stages.length || stages.includes(r.l.stage))
    .sort((a, b) => (sort?.key === 'name' ? a.l.name.localeCompare(b.l.name) : a.s.score - b.s.score) * (sort?.dir === 'desc' ? -1 : 1))
  const rows = filtered.slice(page * pageSize, page * pageSize + pageSize)
  const columns: Column<(typeof scored)[number]>[] = [
    { key: 'name', header: t('kit:table.name'), sortable: true, cell: (r) => <span className="flex items-center gap-2.5"><UserAvatar name={r.l.name} size="sm" /><span className="font-medium">{r.l.name}</span></span> },
    { key: 'stage', header: t('kit:table.stage'), cell: (r) => <StagePill stage={r.l.stage} /> },
    { key: 'temp', header: t('kit:table.temperature'), hideBelow: 'md', cell: (r) => <TemperaturePill value={r.s.temperature} /> },
    { key: 'budget', header: t('kit:table.budget'), align: 'right', hideBelow: 'lg', cell: (r) => (r.l.requirement.budgetMax ? inrShort(r.l.requirement.budgetMax) : '') },
    { key: 'score', header: t('kit:table.score'), align: 'right', sortable: true, cell: (r) => <ScoreRing score={r.s.score} size={32} /> },
  ]

  // dialogs and drawers
  const [drawer, setDrawer] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [dialog, setDialog] = useState<'assign' | 'stage' | 'appointment' | 'task' | 'log' | null>(null)

  // forms
  const [amount, setAmount] = useState<number | undefined>(12_000_000)
  const [phone, setPhone] = useState('+919845012345')
  const [when, setWhen] = useState<string | undefined>()
  const [files, setFiles] = useState<File[]>([])
  const [mapping, setMapping] = useState<ColumnMapping[]>(() => mapColumnsSim(SAMPLE_HEADERS, SAMPLE_ROWS, 'leads'))
  const [seg, setSeg] = useState<'all' | 'hot' | 'today'>('all')
  const [view, setView] = useState<'cards' | 'table'>('cards')

  // paste-and-fill demo form
  const aiFields = useAIFields()
  const [form, setForm] = useState<{ name: string; phone: string; budget?: number; config: string; place: string; timeline: string; source: string }>({ name: '', phone: '', config: '', place: '', timeline: '', source: '' })
  const [answered, setAnswered] = useState<Set<string>>(new Set())
  const [extraction, setExtraction] = useState<Extraction<LeadInput> | null>(null)
  const set = (k: keyof typeof form, path: string, v: string | number | undefined) => { setForm((f) => ({ ...f, [k]: v })); aiFields.clear(path) }
  const fill = (x: Extraction<LeadInput>) => {
    const f = x.fields
    setExtraction(x)
    setAnswered(new Set())
    setForm({
      name: f.name ?? '', phone: f.phone ?? '', budget: f.requirement?.budgetMax,
      config: f.requirement?.configurations.map(configLabel).join(', ') ?? '',
      place: (f.requirement?.localities.length ? f.requirement.localities : f.requirement?.cities ?? []).join(', '),
      timeline: f.qualification?.timeline ? t(`catalogue:timeline.${f.qualification.timeline}`) : '',
      source: f.source ? t(`catalogue:source.${f.source}`) : '',
    })
    aiFields.apply(x.meta)
  }
  const answer = (field: string, value: unknown) => {
    setAnswered((s) => new Set(s).add(field))
    if (field === 'source') setForm((f) => ({ ...f, source: t(`catalogue:source.${String(value)}`) }))
    if (field === 'requirement.budgetMax') setForm((f) => ({ ...f, budget: Number(value) }))
    if (field === 'qualification.timeline') setForm((f) => ({ ...f, timeline: t(`catalogue:timeline.${String(value)}`) }))
  }

  // a sample proposal
  const sample = useMemo(() => lead && propose({
    kind: 'createTask', permission: 'task.manage', targets: [{ kind: 'lead', id: lead.id }],
    summary: [{ label: 'ai:field.title', value: `Call ${lead.name}` }, { label: 'ai:field.due', value: t('kit:ai.tomorrow10') }, { label: 'ai:field.lead', value: lead.name }],
    payload: { input: { title: `Call ${lead.name}`, type: 'call', ownerId: lead.ownerId ?? user.id, dueAt: new Date(now.getTime() + 86_400_000).toISOString(), leadId: lead.id, origin: 'ai' } },
  }), [lead, user.id, now, t])
  const [proposalState, setProposalState] = useState<ProposalState>({ status: 'pending' })

  const trend = monthlyTrend(db.leads, now, 6).map((m) => ({ ...m, label: m.month.slice(5) }))
  const sources = leadsBySource(db.leads).slice(0, 6).map((s) => ({ ...s, label: t(`catalogue:source.${s.source}`) }))
  const inventory = inventoryByStatus(db.properties)
  const steps = funnel(db.leads).filter((s) => s.stage !== 'lost').map((s) => ({ stage: s.stage, count: s.reached, dropOffPct: s.dropOffPct }))
  const heat = activityHeatmap(db.activities, now, 30)
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2026, 0, 5 + i).toLocaleDateString('en-IN', { weekday: 'short' }))
  const hours = Array.from({ length: 13 }, (_, i) => String(8 + i))
  const execs = db.users.filter((u) => u.role === 'executive')
  const workload = execs.map((u) => {
    const mine = scored.filter((r) => r.l.ownerId === u.id && !['converted', 'lost'].includes(r.l.stage))
    return { id: u.id, name: u.name, availability: u.availability, hot: mine.filter((r) => r.s.temperature === 'hot').length, warm: mine.filter((r) => r.s.temperature === 'warm').length, cold: mine.filter((r) => r.s.temperature === 'cold').length }
  })

  const toc = ['kpi', 'charts', 'badges', 'table', 'forms', 'states', 'overlays', 'ai', 'domain', 'timeline', 'art']

  return (
    <div className="flex flex-col gap-10" data-testid="kit-page">
      <PageHeader
        eyebrow={<ToneBadge tone="warning">{t('kit:devOnly')}</ToneBadge>}
        title={t('kit:title')}
        subtitle={t('kit:subtitle')}
        actions={<span className="flex items-center gap-1.5 text-meta text-muted-foreground">{t('kit:shortcut')} <Kbd>Ctrl</Kbd><Kbd>K</Kbd></span>}
      />
      <nav aria-label={t('kit:toc')} className="flex flex-wrap gap-1.5">
        {toc.map((id) => <Chip key={id} size="sm" onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })}>{t(`kit:section.${id}`)}</Chip>)}
      </nav>

      <Section id="kpi" title={t('kit:section.kpi')}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard highlight label={t('kit:kpi.pipeline')} value={inrShort(48_500_000)} icon={IndianRupee} delta={{ value: 12, caption: t('kit:kpi.vsLastMonth') }} spark={[12, 18, 15, 22, 26, 24, 31, 35]} />
          <KpiCard label={t('kit:kpi.visits')} value="18" icon={CalendarCheck} tone="primary" delta={{ value: 12, caption: t('kit:kpi.vsLastMonth') }} spark={[4, 6, 5, 8, 7, 9, 12, 18]} to="/appointments" />
          <KpiCard label={t('kit:kpi.calls')} value="142" icon={Phone} tone="success" ring={{ value: 71, label: t('kit:kpi.calls') }} progress={{ value: 142, max: 200, caption: t('kit:kpi.target', { target: 200 }) }} />
          <KpiCard label={t('kit:kpi.overdue')} value="6" icon={ListChecks} tone="danger" delta={{ value: 3, unit: '', goodWhen: 'down', caption: t('kit:kpi.sinceYesterday') }} hint={t('kit:kpi.overdueHint')} />
          <KpiCard label={t('kit:kpi.bookings')} value="5 / 5" icon={Target} tone="highlight" ring={{ value: 100, targetMet: true }} />
          <KpiCard loading label="" value="" />
        </div>
      </Section>

      <Section id="charts" title={t('kit:section.charts')}>
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title={t('kit:chart.trend')}>
            <AreaTrendChart data={trend} xKey="label" label={t('kit:chart.trend')} series={[{ key: 'leads', label: t('kit:chart.leads') }, { key: 'bookings', label: t('kit:chart.bookings') }]} />
          </SectionCard>
          <SectionCard title={t('kit:chart.sources')}>
            <BarSeriesChart data={sources} xKey="label" horizontal label={t('kit:chart.sources')} series={[{ key: 'count', label: t('kit:chart.leads') }, { key: 'visited', label: t('kit:chart.visited') }]} onBarClick={(r) => toast(r.label)} />
          </SectionCard>
          <SectionCard title={t('kit:chart.inventory')}>
            <DonutChart
              label={t('kit:chart.inventory')} centerLabel={t('kit:chart.properties')}
              data={inventory.map((s) => ({ key: s.status, label: t(`catalogue:propertyStatus.${s.status}`), value: s.count, color: `var(--${s.status === 'available' ? 'success' : s.status === 'onHold' ? 'warning' : s.status === 'booked' ? 'info' : 'neutral'})` }))}
            />
          </SectionCard>
          <SectionCard title={t('kit:chart.funnel')}>
            <FunnelChart steps={steps} label={t('kit:chart.funnel')} onStageClick={(s) => toast(t(`catalogue:stage.${s}`))} />
          </SectionCard>
          <SectionCard title={t('kit:chart.heatmap')}>
            <Heatmap rows={weekdays} columns={hours} label={t('kit:chart.heatmap')} value={(r, c) => heat.find((h) => h.day === r && h.hour === 8 + c)?.count ?? 0} />
          </SectionCard>
          <SectionCard title={t('kit:chart.gauge')}>
            <div className="flex flex-wrap items-center justify-around gap-6">
              <Gauge value={1.6} max={2.5} label={t('kit:chart.revenueTarget')} valueLabel={inrShort(16_000_000)} />
              <Gauge value={25} max={25} label={t('kit:chart.visitsTarget')} />
              <div className="flex flex-col gap-3">
                <ProgressRing value={45} size={56} tone="primary" label="45" />
                <AreaTrendChart data={[]} xKey="label" label={t('kit:chart.empty')} height={120} series={[{ key: 'x', label: 'x' }]} />
              </div>
            </div>
          </SectionCard>
        </div>
      </Section>

      <Section id="badges" title={t('kit:section.badges')}>
        <SectionCard>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {(['primary', 'success', 'warning', 'danger', 'info', 'violet', 'neutral', 'ai', 'highlight'] as const).map((tone) => <ToneBadge key={tone} tone={tone}>{tone}</ToneBadge>)}
              <ToneBadge tone="success" variant="outline">{t('kit:badge.outline')}</ToneBadge>
              <ToneBadge tone="danger" variant="dot">{t('kit:badge.dot')}</ToneBadge>
              <CountBadge count={7} tone="danger" /><CountBadge count={128} tone="primary" /><StatusDot tone="success" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(['hot', 'warm', 'cold'] as const).map((x) => <TemperaturePill key={x} value={x} />)}
              {STAGES.map((s) => <StagePill key={s} stage={s} />)}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(['available', 'onHold', 'booked', 'sold'] as const).map((s) => <AvailabilityPill key={s} status={s} />)}
              <SourcePill source="acres99" /><SpecChip>3 BHK</SpecChip><DotBadge classes={{ solid: 'bg-appt-site-visit', soft: 'bg-appt-site-visit-soft', text: 'text-foreground', ring: '' }}>{t('catalogue:appointmentType.siteVisit')}</DotBadge>
              <LastContactBadge days={0} /><LastContactBadge days={4} /><LastContactBadge days={9} />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <UserAvatar name="Arjun Mehta" size="lg" role="executive" availability="available" />
              <UserAvatar name="Rohit Khanna" size="md" role="manager" availability="inVisit" />
              <UserAvatar name="Meera Iyer" size="sm" role="admin" />
              <AvatarStack names={execs.map((u) => u.name)} max={3} />
              <IconTile icon={Users} tone="info" /><IconTile icon={CalendarCheck} tone="success" size="lg" />
              <ScoreRing score={82} /><ScoreRing score={55} /><ScoreRing score={86} kind="match" size={44} />
              <Meter value={64} className="w-40" label={t('kit:badge.meter')} />
            </div>
            <div className="flex flex-col gap-2">
              <WorkloadLegend />
              <WorkloadBars rows={workload} onSelect={(id) => toast(id)} />
            </div>
            <KeyValueGrid items={[{ label: t('kit:kv.phone'), value: phoneDisplay('+919845012345') }, { label: t('kit:kv.budget'), value: inrShort(12_000_000) }, { label: t('kit:kv.empty'), value: '' }, { label: t('kit:kv.config'), value: '3 BHK' }]} />
            <Callout tone="warning" title={t('kit:callout.title')}>{t('kit:callout.body')}</Callout>
          </div>
        </SectionCard>
      </Section>

      <Section id="table" title={t('kit:section.table')}>
        <FilterBar
          search={search} onSearch={(v) => { setSearch(v); setPage(0) }} placeholder={t('kit:table.search')}
          filters={<FilterPill label={t('kit:table.stage')} options={STAGES.map((s) => ({ value: s, label: t(`catalogue:stage.${s}`), count: leads.filter((l) => l.stage === s).length }))} selected={stages} onChange={(v) => { setStages(v); setPage(0) }} />}
          activeCount={stages.length} onClearAll={() => setStages([])}
          end={(
            <>
              <Segmented variant="pill" value={tableState} onChange={setTableState} label={t('kit:table.state')} segments={(['data', 'loading', 'empty', 'error'] as const).map((v) => ({ value: v, label: t(`kit:table.states.${v}`) }))} />
              <DensityToggle value={density} onChange={setDensity} />
              <ColumnMenu columns={columns.map((c) => ({ key: c.key, label: String(c.header), locked: c.key === 'name' }))} hidden={hidden} onChange={setHidden} />
            </>
          )}
        />
        <DataTable
          label={t('kit:section.table')} rows={tableState === 'empty' ? [] : rows} columns={columns} rowKey={(r) => r.l.id} rowLabel={(r) => r.l.name}
          sort={sort} onSort={(k) => setSort((s) => ({ key: k, dir: s?.key === k && s.dir === 'asc' ? 'desc' : 'asc' }))}
          selected={selected} onSelectedChange={setSelected} density={density} hiddenColumns={hidden}
          loading={tableState === 'loading'}
          error={tableState === 'error' ? <ErrorState compact onRetry={() => setTableState('data')} /> : undefined}
          empty={<FilteredEmpty onClear={() => { setStages([]); setSearch(''); setTableState('data') }} />}
          onRowClick={(r) => toast(r.l.name)} maxHeight="420px"
          rowActions={(r) => (
            <>
              <ContactActions lead={r.l} />
              <Button variant="ghost" size="icon-sm" aria-label={t('kit:table.schedule')}><CalendarPlus /></Button>
              <Button variant="ghost" size="icon-sm" aria-label={t('common:actions.more')}><MoreHorizontal /></Button>
            </>
          )}
          footer={<Pagination page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(0) }} sizes={[5, 10, 25]} />}
        />
        <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
          <Button variant="ghost" size="sm" onClick={() => setDialog('assign')}><UserPlus />{t('kit:bulk.assign')}</Button>
          <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => setConfirm(true)}><Trash2 />{t('kit:bulk.delete')}</Button>
        </BulkBar>
      </Section>

      <Section id="forms" title={t('kit:section.forms')}>
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title={t('kit:forms.inputs')}>
            <div className="flex flex-col gap-4">
              <FormField label={t('kit:forms.amount')} hint={t('kit:forms.amountHint')}>{({ id, describedBy }) => <AmountInput id={id} value={amount} onChange={setAmount} describedBy={describedBy} />}</FormField>
              <FormField label={t('kit:forms.phone')} error={phone && !phone.startsWith('+91') ? t('common:validation.invalidPhone') : undefined}>{({ id, invalid }) => <PhoneInput id={id} value={phone} onChange={setPhone} invalid={invalid} />}</FormField>
              <FormField label={t('kit:forms.when')} optional>{({ id }) => <DateTimeField id={id} value={when} onChange={setWhen} />}</FormField>
              <Segmented value={seg} onChange={setSeg} label={t('kit:forms.tabs')} segments={[{ value: 'all', label: t('kit:forms.all'), count: leads.length }, { value: 'hot', label: t('catalogue:temperature.hot'), count: 4 }, { value: 'today', label: t('kit:forms.today'), count: 7 }]} />
              <Segmented variant="pill" value={view} onChange={setView} label={t('kit:forms.view')} segments={[{ value: 'cards', label: t('kit:forms.cards') }, { value: 'table', label: t('kit:forms.tableView') }]} />
            </div>
          </SectionCard>
          <SectionCard title={t('kit:forms.upload')}>
            <div className="flex flex-col gap-4">
              <FileUploader files={files} onFilesChange={setFiles} accept={['.xlsx', '.csv', '.pdf', 'image/*']} maxFiles={3} maxSizeMb={5} />
              <MappingTable mapping={mapping} onChange={setMapping} samples={SAMPLE_HEADERS.map((_, i) => SAMPLE_ROWS.map((r) => r[i]))}
                fields={[{ value: 'name', label: t('kit:map.name'), required: true }, { value: 'phone', label: t('kit:map.phone'), required: true }, { value: 'source', label: t('kit:map.source'), required: true }, { value: 'requirement.localities', label: t('kit:map.locality') }, { value: 'requirement.configurations', label: t('kit:map.config') }, { value: 'requirement.budgetMax', label: t('kit:map.budget') }, { value: 'notes', label: t('kit:map.notes') }]} />
            </div>
          </SectionCard>
        </div>
      </Section>

      <Section id="states" title={t('kit:section.states')}>
        <div className="grid gap-4 lg:grid-cols-3">
          <SectionCard><EmptyState illustration={Art.EmptyLeads} title={t('kit:states.emptyTitle')} body={t('kit:states.emptyBody')} primary={<Button>{t('kit:states.add')}</Button>} secondary={<Button variant="ai">{t('kit:states.paste')}</Button>} /></SectionCard>
          <SectionCard><FilteredEmpty onClear={() => toast(t('kit:states.cleared'))} /></SectionCard>
          <SectionCard><ErrorState compact onRetry={() => toast(t('kit:states.retry'))} /></SectionCard>
          <CardSkeleton />
          <TableSkeleton rows={3} />
          <ChartBlockSkeleton height={180} />
        </div>
      </Section>

      <Section id="overlays" title={t('kit:section.overlays')}>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setDrawer(true)}>{t('kit:overlay.drawer')}</Button>
          <Button variant="destructive" onClick={() => setConfirm(true)}>{t('kit:overlay.confirm')}</Button>
          <Button variant="secondary" onClick={() => toastUndo(t('kit:overlay.undoToast'), undefined)}>{t('kit:overlay.toast')}</Button>
          {lead && <Button variant="secondary" onClick={() => setDialog('assign')}>{t('kit:overlay.assign')}</Button>}
          {lead && <Button variant="secondary" onClick={() => setDialog('stage')}>{t('kit:overlay.stage')}</Button>}
          <Button variant="secondary" onClick={() => setDialog('appointment')}>{t('kit:overlay.appointment')}</Button>
          <Button variant="secondary" onClick={() => setDialog('task')}>{t('kit:overlay.task')}</Button>
          {lead && <Button variant="secondary" onClick={() => setDialog('log')}>{t('kit:overlay.log')}</Button>}
        </div>
        <Drawer
          open={drawer} onOpenChange={(o) => { setDrawer(o); if (!o) setDirty(false) }} title={lead?.name ?? t('kit:overlay.drawer')} subtitle={t('kit:overlay.drawerSub')} dirty={dirty}
          footer={<><Button variant="secondary" onClick={() => setDrawer(false)}>{t('common:actions.cancel')}</Button><Button onClick={() => { setDirty(false); setDrawer(false) }}>{t('common:actions.save')}</Button></>}
        >
          <FormField label={t('kit:overlay.typeToDirty')}>{({ id }) => <Input id={id} onChange={() => setDirty(true)} />}</FormField>
          {lead && <ActivityTimeline refTo={{ kind: 'lead', id: lead.id }} limit={8} />}
        </Drawer>
        <ConfirmDialog
          open={confirm} onOpenChange={setConfirm} tone="danger" title={t('kit:overlay.confirmTitle')} description={t('kit:overlay.confirmBody')} confirmLabel={t('kit:overlay.confirmAction')}
          onConfirm={() => toastUndo(t('kit:overlay.deleted'), undefined)}
        />
        {lead && <AssignDialog open={dialog === 'assign'} onOpenChange={(o) => setDialog(o ? 'assign' : null)} leadIds={selected.size ? [...selected] : [lead.id]} onDone={() => setSelected(new Set())} />}
        {lead && dialog === 'stage' && <StageChangeDialog open onOpenChange={(o) => setDialog(o ? 'stage' : null)} leadId={lead.id} to="negotiation" />}
        {dialog === 'appointment' && <AppointmentFormDialog open onOpenChange={(o) => setDialog(o ? 'appointment' : null)} leadId={lead?.id} />}
        {dialog === 'task' && <TaskFormDialog open onOpenChange={(o) => setDialog(o ? 'task' : null)} leadId={lead?.id} />}
        {lead && dialog === 'log' && <LogActivityDialog open onOpenChange={(o) => setDialog(o ? 'log' : null)} leadId={lead.id} />}
      </Section>

      <Section id="ai" title={t('kit:section.ai')}>
        <div className="flex flex-wrap items-center gap-3">
          <DemoAIBadge mode="simulated" /><DemoAIBadge mode="live" />
          <AISuggestionChip onClick={() => toast(t('kit:ai.suggestion'))}>{t('kit:ai.suggestion')}</AISuggestionChip>
          <EffortSaved count={8} /><EffortSaved count={12} kind="leads" />
          <VoiceButton onText={(x, final) => final && toast(x)} showLabel />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <PasteAndFillBox kind="lead" onFill={fill} defaultText={t('kit:ai.rahul')} />
          <SectionCard title={t('kit:ai.form')} description={aiFields.count ? t('ai:effort.fields', { count: aiFields.count }) : t('kit:ai.formHint')}>
            <div className="flex flex-col gap-3">
              {([['name', 'name', t('kit:ai.name')], ['phone', 'phone', t('kit:ai.phone')], ['config', 'requirement.configurations', t('kit:ai.config')], ['place', 'requirement.localities', t('kit:ai.place')], ['timeline', 'qualification.timeline', t('kit:ai.timeline')], ['source', 'source', t('kit:ai.source')]] as const).map(([k, path, label]) => (
                <AIField key={k} meta={aiFields.get(path)}>
                  <FormField label={label} labelEnd={<AIFieldMarker meta={aiFields.get(path)} />}>
                    {({ id }) => <Input id={id} value={k === 'phone' ? phoneDisplay(form.phone) || form.phone : String(form[k] ?? '')} onChange={(e) => set(k, path, e.target.value)} />}
                  </FormField>
                </AIField>
              ))}
              <AIField meta={aiFields.get('requirement.budgetMax')}>
                <FormField label={t('kit:ai.budget')} labelEnd={<AIFieldMarker meta={aiFields.get('requirement.budgetMax')} />}>
                  {({ id }) => <AmountInput id={id} value={form.budget} onChange={(v) => set('budget', 'requirement.budgetMax', v)} />}
                </FormField>
              </AIField>
              {extraction && <MissingQuestions questions={extraction.questions} answered={answered} onAnswer={answer} />}
            </div>
          </SectionCard>
        </div>
        {sample && (
          <div className="max-w-md">
            <ActionProposalCard
              proposal={sample} mode="simulated" state={proposalState}
              onConfirm={() => setProposalState({ status: 'done', links: sample.targets })}
              onCancel={() => setProposalState({ status: 'cancelled' })}
              onEdit={() => setProposalState({ status: 'pending' })}
            />
          </div>
        )}
      </Section>

      <Section id="domain" title={t('kit:section.domain')}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {leads.slice(0, 3).map((l: Lead) => <LeadCard key={l.id} lead={l} />)}
        </div>
        <div className="flex flex-col gap-2">{leads.slice(3, 6).map((l) => <LeadCard key={l.id} lead={l} compact />)}</div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
          {matches.slice(0, 3).map((m) => (
            <PropertyCard key={m.property.id} property={m.property} match={m}
              actions={<><Button size="sm" variant="secondary">{t('kit:domain.shortlist')}</Button><Button size="sm" variant="ghost" className="text-success hover:text-success"><MessageCircle />{t('kit:domain.share')}</Button></>} />
          ))}
          {db.properties.filter((p) => p.status === 'sold').slice(0, 1).map((p) => <PropertyCard key={p.id} property={p} />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title={t('kit:domain.appointments')}><div className="flex flex-col gap-2">{appointments.map((a) => <AppointmentCard key={a.id} appointment={a} showDate />)}</div></SectionCard>
          <SectionCard title={t('kit:domain.tasks')}><div className="flex flex-col gap-2">{tasks.map((x) => <TaskRow key={x.id} task={x} />)}</div></SectionCard>
        </div>
        {lead && (
          <SectionCard title={t('kit:domain.matches', { name: lead.name })} action={<span className="flex items-center gap-2 text-meta"><EntityLink refTo={{ kind: 'lead', id: lead.id }} /><ContactActions lead={lead} labels showEmail /></span>}>
            <MatchList matches={matches} actions={{ onShortlist: (m) => toast(m.property.title), onShare: (m) => toast(m.property.title), onSchedule: () => setDialog('appointment'), onNotInterested: (m) => toast(m.property.title) }} />
          </SectionCard>
        )}
      </Section>

      <Section id="timeline" title={t('kit:section.timeline')}>
        <SectionCard>{lead && <ActivityTimeline refTo={{ kind: 'lead', id: lead.id }} limit={12} />}</SectionCard>
      </Section>

      <Section id="art" title={t('kit:section.art')}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(Art).filter(([, v]) => typeof v === 'function').map(([name, A]) => {
            const Ill = A as Art.Illustration
            return (
              <figure key={name} className="flex flex-col items-center gap-2 rounded-lg border bg-card p-3 shadow-card">
                <Ill size={80} />
                <figcaption className="text-meta text-muted-foreground">{name}</figcaption>
              </figure>
            )
          })}
        </div>
      </Section>
    </div>
  )
}
