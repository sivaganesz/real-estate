/**
 * The report tabs (DESIGN_SYSTEM §10 charts): every chart has tooltips, a legend where it has several series, an
 * empty state, and click-through: clicking a bar, slice, stage or row opens the drill-down drawer with the exact
 * records behind the number.
 */
import { CalendarCheck, Clock, IndianRupee, Percent, Trophy, UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AreaTrendChart } from '@/components/shared/charts/area-chart'
import { BarSeriesChart } from '@/components/shared/charts/bar-chart'
import { DonutChart } from '@/components/shared/charts/donut-chart'
import { FunnelChart } from '@/components/shared/charts/funnel-chart'
import { Heatmap } from '@/components/shared/charts/heatmap'
import { DataTable, type Column } from '@/components/shared/data-table'
import { KpiCard } from '@/components/shared/kpi-card'
import { SectionCard } from '@/components/shared/section-card'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import type { DB, LeadSource, LostReason, PipelineStageKey, PropertyStatus, PropertyType } from '@/domain/types'
import { useIsPhone } from '@/hooks/use-media-query'
import { inrShort } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ExecPerf, StageAging } from '@/services/queries/stats'
import { bucketLabel, type Drill, type ReportData } from '../lib/report-data'
import { ReportSummary } from './report-summary'

type TabProps = { data: ReportData; db: DB; onDrill: (d: Drill) => void }

const STAGE_VAR: Record<PipelineStageKey, string> = {
  new: 'var(--stage-new)', contacted: 'var(--stage-contacted)', qualified: 'var(--stage-qualified)',
  siteVisitScheduled: 'var(--stage-visit-scheduled)', siteVisitDone: 'var(--stage-visit-done)', negotiation: 'var(--stage-negotiation)',
  booked: 'var(--stage-booked)', converted: 'var(--stage-converted)', lost: 'var(--stage-lost)',
}
const STATUS_VAR: Record<PropertyStatus, string> = { available: 'var(--success)', onHold: 'var(--warning)', booked: 'var(--info)', sold: 'var(--neutral)' }

const fmtMins = (m: number | null, t: (k: string, o?: Record<string, unknown>) => string) =>
  m == null ? '—' : m < 60 ? t('reports:mins', { count: m }) : t('reports:hours', { h: Math.floor(m / 60), m: m % 60 })

/* ---------- overview ---------- */

export function OverviewTab({ data, db, onDrill }: TabProps) {
  const { t, i18n } = useTranslation(['reports', 'catalogue'])
  const phone = useIsPhone()
  const k = data.kpis
  const spark = (key: 'leads' | 'visits' | 'bookings' | 'revenue') => (phone ? undefined : data.trend.map((p) => p[key]))
  const delta = (v: number | null) => (v == null ? undefined : { value: v, caption: t('reports:vsPrev') })
  return (
    <div className="flex flex-col gap-6">
      <section aria-label={t('reports:kpis')} className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-6" data-testid="report-kpis">
        <KpiCard label={t('reports:kpi.leads')} value={k.leads} icon={UserPlus} tone="info" spark={spark('leads')} delta={delta(k.leadsDelta)} onClick={() => onDrill({ kind: 'cohort' })} />
        <KpiCard label={t('reports:kpi.visits')} value={k.visits} icon={CalendarCheck} tone="warning" spark={spark('visits')} delta={delta(k.visitsDelta)} />
        <KpiCard label={t('reports:kpi.bookings')} value={k.bookings} icon={Trophy} tone="success" spark={spark('bookings')} delta={delta(k.bookingsDelta)} onClick={() => onDrill({ kind: 'booked' })} />
        <KpiCard highlight label={t('reports:kpi.revenue')} value={inrShort(k.revenue)} icon={IndianRupee} spark={spark('revenue')} delta={delta(k.revenueDelta)} onClick={() => onDrill({ kind: 'booked' })} />
        <KpiCard label={t('reports:kpi.conversion')} value={k.conversion == null ? '—' : `${k.conversion}%`} icon={Percent} tone="primary" hint={t('reports:kpi.conversionHint')} />
        <KpiCard label={t('reports:kpi.tat')} value={fmtMins(k.tat, (key, o) => String(t(key, o ?? {})))} icon={Clock} tone="violet" hint={t('reports:kpi.tatHint')} />
      </section>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <SectionCard className="min-w-0 xl:col-span-8" title={t('reports:trend.title')} description={t(`reports:trend.by.${data.trend[0]?.unit ?? 'month'}`)} data-testid="chart-trend">
          <AreaTrendChart
            data={data.trend} xKey="key" label={t('reports:trend.title')} xFormat={(v) => bucketLabel(String(v), i18n.language)}
            series={[{ key: 'leads', label: t('reports:trend.leads') }, { key: 'visits', label: t('reports:trend.visits') }, { key: 'bookings', label: t('reports:trend.bookings') }]}
            onPointClick={(row) => onDrill({ kind: 'bucket', key: row.key, metric: 'leads' })}
          />
          <p className="mt-2 text-meta text-muted-foreground">{t('reports:clickHint')}</p>
        </SectionCard>
        <div className="min-w-0 xl:col-span-4"><ReportSummary data={data} db={db} onDrill={onDrill} /></div>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <FunnelCard data={data} onDrill={onDrill} />
        <SourcesDonut data={data} onDrill={onDrill} />
      </div>
    </div>
  )
}

function FunnelCard({ data, onDrill }: Pick<TabProps, 'data' | 'onDrill'>) {
  const { t } = useTranslation('reports')
  const first = data.funnel[0]?.count ?? 0
  const won = data.funnel.find((f) => f.stage === 'booked')?.count ?? 0
  return (
    <SectionCard className="min-w-0" title={t('funnel.title')} description={t('funnel.subtitle', { pct: first ? Math.round((won / first) * 100) : 0 })} data-testid="chart-funnel">
      <FunnelChart label={t('funnel.title')} steps={data.funnel} onStageClick={(stage) => onDrill({ kind: 'stage', stage, scope: 'reached' })} />
    </SectionCard>
  )
}

function SourcesDonut({ data, onDrill }: Pick<TabProps, 'data' | 'onDrill'>) {
  const { t } = useTranslation(['reports', 'catalogue'])
  return (
    <SectionCard className="min-w-0" title={t('reports:sources.title')} description={t('reports:sources.subtitle')} data-testid="chart-sources">
      <DonutChart
        label={t('reports:sources.title')} centerLabel={t('reports:sources.center')}
        data={data.sources.map((s) => ({ key: s.source, label: t(`catalogue:source.${s.source}`), value: s.count }))}
        onSliceClick={(key) => onDrill({ kind: 'source', source: key as LeadSource })}
      />
    </SectionCard>
  )
}

/* ---------- pipeline ---------- */

export function PipelineTab({ data, onDrill }: TabProps) {
  const { t } = useTranslation(['reports', 'catalogue'])
  const value = data.pipelineValue.filter((s) => s.count > 0).map((s) => ({ ...s, label: t(`catalogue:stageShort.${s.stage}`) }))
  const lost = data.lost.filter((l) => l.count > 0).map((l) => ({ ...l, label: t(`catalogue:lostReason.${l.reason}`) }))
  const cols: Column<StageAging>[] = [
    { key: 'stage', header: t('reports:aging.stage'), cell: (r) => <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="size-2 rounded-full" style={{ background: STAGE_VAR[r.stage] }} />{t(`catalogue:stage.${r.stage}`)}</span> },
    { key: 'count', header: t('reports:aging.open'), align: 'right', cell: (r) => r.count },
    { key: 'value', header: t('reports:aging.value'), align: 'right', cell: (r) => inrShort(r.value), hideBelow: 'md' },
    { key: 'avg', header: t('reports:aging.avgDays'), align: 'right', cell: (r) => <span className={cn(r.targetDays && r.avgDays > r.targetDays && 'font-semibold text-warning')}>{r.avgDays}</span> },
    { key: 'target', header: t('reports:aging.target'), align: 'right', cell: (r) => r.targetDays, hideBelow: 'lg' },
    { key: 'stalled', header: t('reports:aging.stalled'), align: 'right', cell: (r) => (r.stalled ? <Button size="xs" variant="ghost" className="text-danger" onClick={(e) => { e.stopPropagation(); onDrill({ kind: 'stalled' }) }}>{r.stalled}</Button> : 0) },
  ]
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <FunnelCard data={data} onDrill={onDrill} />
        <SectionCard className="min-w-0" title={t('reports:value.title')} description={t('reports:value.subtitle', { value: inrShort(data.kpis.pipeline) })} data-testid="chart-value">
          <BarSeriesChart data={value} xKey="label" label={t('reports:value.title')} format="inr" series={[{ key: 'value', label: t('reports:value.series') }]}
            colorOf={(r) => STAGE_VAR[r.stage]} onBarClick={(r) => onDrill({ kind: 'stage', stage: r.stage, scope: 'open' })} />
        </SectionCard>
      </div>
      <SectionCard title={t('reports:aging.title')} description={t('reports:aging.subtitle')} data-testid="table-aging">
        <DataTable rows={data.aging} columns={cols} rowKey={(r) => r.stage} label={t('reports:aging.title')} density="compact" onRowClick={(r) => onDrill({ kind: 'stage', stage: r.stage, scope: 'open' })} />
      </SectionCard>
      <SectionCard title={t('reports:lost.title')} description={t('reports:lost.subtitle')} data-testid="chart-lost">
        <BarSeriesChart data={lost} xKey="label" horizontal height={Math.max(160, lost.length * 40)} label={t('reports:lost.title')} series={[{ key: 'count', label: t('reports:lost.series'), color: 'var(--danger)' }]}
          onBarClick={(r) => onDrill({ kind: 'lost', reason: r.reason as LostReason })} />
      </SectionCard>
    </div>
  )
}

/* ---------- sources ---------- */

export function SourcesTab({ data, onDrill }: TabProps) {
  const { t } = useTranslation(['reports', 'catalogue'])
  const rows = data.sources.map((s) => ({ ...s, label: t(`catalogue:source.${s.source}`), visitPct: s.count ? Math.round((s.visited / s.count) * 100) : 0, bookPct: s.count ? Math.round((s.booked / s.count) * 100) : 0 }))
  type Row = (typeof rows)[number]
  const cols: Column<Row>[] = [
    { key: 'source', header: t('reports:sources.source'), cell: (r) => r.label },
    { key: 'count', header: t('reports:sources.leads'), align: 'right', cell: (r) => r.count },
    { key: 'visited', header: t('reports:sources.visited'), align: 'right', cell: (r) => r.visited, hideBelow: 'md' },
    { key: 'visitPct', header: t('reports:sources.visitPct'), align: 'right', cell: (r) => `${r.visitPct}%` },
    { key: 'booked', header: t('reports:sources.booked'), align: 'right', cell: (r) => r.booked, hideBelow: 'md' },
    { key: 'bookPct', header: t('reports:sources.bookPct'), align: 'right', cell: (r) => <span className={cn(r.bookPct >= 20 && 'font-semibold text-success')}>{r.bookPct}%</span> },
  ]
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-5"><SourcesDonut data={data} onDrill={onDrill} /></div>
        <SectionCard className="min-w-0 xl:col-span-7" title={t('reports:sources.conversionTitle')} description={t('reports:sources.conversionSubtitle')} data-testid="chart-source-conversion">
          <BarSeriesChart data={rows} xKey="label" horizontal height={Math.max(200, rows.length * 44)} label={t('reports:sources.conversionTitle')}
            series={[{ key: 'count', label: t('reports:sources.leads') }, { key: 'visited', label: t('reports:sources.visited') }, { key: 'booked', label: t('reports:sources.booked') }]}
            onBarClick={(r) => onDrill({ kind: 'source', source: r.source })} />
        </SectionCard>
      </div>
      <SectionCard title={t('reports:sources.tableTitle')} data-testid="table-sources">
        <DataTable rows={rows} columns={cols} rowKey={(r) => r.source} label={t('reports:sources.tableTitle')} density="compact" onRowClick={(r) => onDrill({ kind: 'source', source: r.source })}
          empty={<p className="py-8 text-center text-sm text-muted-foreground">{t('reports:emptyPeriod')}</p>} />
      </SectionCard>
    </div>
  )
}

/* ---------- team ---------- */

export function TeamTab({ data, db, onDrill }: TabProps) {
  const { t } = useTranslation('reports')
  const name = (id: string) => db.users.find((u) => u.id === id)?.name ?? id
  const bars = data.execs.map((e) => ({ ...e, label: name(e.userId).split(' ')[0] }))
  const cols: Column<ExecPerf>[] = [
    { key: 'name', header: t('team.exec'), cell: (r) => <span className="inline-flex items-center gap-2"><UserAvatar name={name(r.userId)} size="xs" />{name(r.userId)}</span> },
    { key: 'newLeads', header: t('team.newLeads'), align: 'right', cell: (r) => r.newLeads, hideBelow: 'md' },
    { key: 'calls', header: t('team.calls'), align: 'right', cell: (r) => r.calls, hideBelow: 'md' },
    { key: 'visits', header: t('team.visits'), align: 'right', cell: (r) => r.visits },
    { key: 'bookings', header: t('team.bookings'), align: 'right', cell: (r) => r.bookings },
    { key: 'revenue', header: t('team.revenue'), align: 'right', cell: (r) => inrShort(r.revenue), hideBelow: 'lg' },
    { key: 'conv', header: t('team.conversion'), align: 'right', cell: (r) => `${r.conversionPct}%`, hideBelow: 'lg' },
    { key: 'tat', header: t('team.tat'), align: 'right', cell: (r) => fmtMins(r.avgFirstContactMins, (key, o) => String(t(key, o ?? {}))), hideBelow: 'xl' },
    { key: 'overdue', header: t('team.overdue'), align: 'right', cell: (r) => <span className={cn(r.overdue && 'font-semibold text-danger')}>{r.overdue}</span> },
  ]
  return (
    <div className="flex flex-col gap-6">
      <SectionCard title={t('team.chartTitle')} description={t('team.chartSubtitle')} data-testid="chart-team">
        <BarSeriesChart data={bars} xKey="label" label={t('team.chartTitle')}
          series={[{ key: 'visits', label: t('team.visits') }, { key: 'bookings', label: t('team.bookings') }, { key: 'newLeads', label: t('team.newLeads') }]}
          onBarClick={(r) => onDrill({ kind: 'owner', userId: r.userId })} />
      </SectionCard>
      <SectionCard title={t('team.tableTitle')} data-testid="table-team">
        <DataTable rows={data.execs} columns={cols} rowKey={(r) => r.userId} label={t('team.tableTitle')} density="compact" onRowClick={(r) => onDrill({ kind: 'owner', userId: r.userId })}
          empty={<p className="py-8 text-center text-sm text-muted-foreground">{t('team.empty')}</p>} />
      </SectionCard>
    </div>
  )
}

/* ---------- activity ---------- */

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8) // 08:00–21:00, the working day

export function ActivityTab({ data }: TabProps) {
  const { t, i18n } = useTranslation('reports')
  const locale = i18n.language === 'ta' ? 'ta-IN' : 'en-IN'
  const days = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2026, 0, 5 + i))) // 5 Jan 2026 is a Monday
  const cell = new Map(data.heat.map((h) => [`${h.day}:${h.hour}`, h.count]))
  const total = data.activity.reduce((n, a) => n + a.calls + a.whatsapp + a.notes, 0)
  return (
    <div className="flex flex-col gap-6">
      <SectionCard title={t('activity.heatTitle')} description={t('activity.heatSubtitle')} data-testid="chart-heatmap">
        <Heatmap rows={days} columns={HOURS.map((h) => String(h))} value={(r, c) => cell.get(`${r}:${HOURS[c]}`) ?? 0} label={t('activity.heatTitle')}
          cellLabel={(r, c, v) => t('activity.cell', { day: days[r], hour: `${HOURS[c]}:00`, count: v })} />
      </SectionCard>
      <SectionCard title={t('activity.trendTitle')} description={t('activity.trendSubtitle', { count: total })} data-testid="chart-activity">
        <BarSeriesChart data={data.activity} xKey="key" stacked label={t('activity.trendTitle')} xFormat={(v) => bucketLabel(String(v), i18n.language)}
          series={[{ key: 'calls', label: t('activity.calls') }, { key: 'whatsapp', label: t('activity.whatsapp') }, { key: 'notes', label: t('activity.notes') }]} />
      </SectionCard>
    </div>
  )
}

/* ---------- inventory ---------- */

export function InventoryTab({ data, onDrill }: TabProps) {
  const { t } = useTranslation(['reports', 'catalogue'])
  const value = data.inventoryStatus.reduce((n, s) => n + (s.status === 'available' ? s.value : 0), 0)
  const types = data.inventoryType.map((x) => ({ ...x, label: t(`catalogue:propertyType.${x.type}`), other: x.count - x.available }))
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <SectionCard className="min-w-0 xl:col-span-5" title={t('reports:inventory.statusTitle')} description={t('reports:inventory.statusSubtitle', { value: inrShort(value) })} data-testid="chart-inventory-status">
        <DonutChart label={t('reports:inventory.statusTitle')} centerLabel={t('reports:inventory.center')}
          data={data.inventoryStatus.map((s) => ({ key: s.status, label: t(`catalogue:propertyStatus.${s.status}`), value: s.count, color: STATUS_VAR[s.status] }))}
          onSliceClick={(key) => onDrill({ kind: 'propertyStatus', status: key as PropertyStatus })} />
      </SectionCard>
      <SectionCard className="min-w-0 xl:col-span-7" title={t('reports:inventory.typeTitle')} description={t('reports:inventory.typeSubtitle')} data-testid="chart-inventory-type">
        <BarSeriesChart data={types} xKey="label" stacked label={t('reports:inventory.typeTitle')}
          series={[{ key: 'available', label: t('reports:inventory.available'), color: 'var(--success)' }, { key: 'other', label: t('reports:inventory.other'), color: 'var(--neutral)' }]}
          onBarClick={(r) => onDrill({ kind: 'propertyType', type: r.type as PropertyType })} />
      </SectionCard>
    </div>
  )
}

