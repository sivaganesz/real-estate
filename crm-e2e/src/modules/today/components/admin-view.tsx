/**
 * Admin Today (master prompt §6, ROLE_RESEARCH §5.3): KPI cards with sparklines (new leads today, visits, bookings,
 * pipeline value, conversion, inventory), the source funnel (leads → visits → bookings by source), the team snapshot,
 * import activity, system alerts with one-click fixes, and 3–5 AI business insights with drill-down links.
 */
import { useState, type ReactElement } from 'react'
import {
  AlertTriangle, ArrowUpRight, Boxes, CalendarCheck, CopyCheck, FileWarning, Gauge as GaugeIcon, IndianRupee, Inbox,
  Lightbulb, Percent, Trophy, Upload, UserPlus, UserX, Wand2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { paths } from '@/app/paths'
import { AISuggestionChip } from '@/components/ai/ai-suggestion-chip'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { EmptyImport, EmptyTasks } from '@/components/illustrations'
import { ToneBadge } from '@/components/shared/badges'
import { BarSeriesChart } from '@/components/shared/charts/bar-chart'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { IconTile } from '@/components/shared/icon-tile'
import { KpiCard } from '@/components/shared/kpi-card'
import { SectionCard } from '@/components/shared/section-card'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import type { DB, ID } from '@/domain/types'
import { useIsPhone } from '@/hooks/use-media-query'
import { usePermission } from '@/hooks/use-permission'
import { firstName, fmtDate, inrShort } from '@/lib/format'
import { propertyStatusTone, TONE } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { assignLeads } from '@/services/assignments'
import type { ExecRow } from '@/services/queries/stats'
import { adminToday, openLeadIdsOf, type AdminToday, type Insight, type InsightLink } from '@/services/queries/today'
import { adminBrief, greetingKey } from '../lib/brief'
import { splitMins } from '../lib/slots'
import { AIQuickCommand } from './ai-quick-command'
import { TodayHero } from './today-hero'
import { useToday } from './use-today'

function insightPath(l: InsightLink): string {
  switch (l.to) {
    case 'reports': return paths.reports(l.tab)
    case 'leads': return paths.leads({ tab: l.tab })
    case 'pipeline': return paths.pipeline({ stalled: l.stalled ? '1' : undefined })
    case 'properties': return paths.properties({ q: l.locality })
    case 'import': return paths.importHistory()
    case 'lead': return paths.lead(l.id)
    case 'team': return paths.team()
  }
}

export function AdminView() {
  const { t } = useTranslation('today')
  const { data, db, user, now } = useToday(adminToday)
  const phone = useIsPhone()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState<{ ids: ID[]; title: string } | null>(null)
  const a = data.alerts
  const alertCount = (a.unassigned ? 1 : 0) + (a.duplicates.length ? 1 : 0) + (a.deactivatedOwners.length ? 1 : 0) + (a.incompleteProperties.length || a.missingLeadData.length ? 1 : 0)
  const brief = adminBrief({ newLeads: data.kpis.newLeadsToday, visits: data.kpis.visitsToday, bookings: data.kpis.bookingsThisMonth, pipeline: inrShort(data.kpis.pipelineValue), alerts: alertCount })
  const inv = data.inventory
  const invTotal = inv.reduce((n, s) => n + s.count, 0)
  const suggestions = [
    { label: t('assistant.chips.business'), command: 'Business summary for today' },
    { label: t('assistant.chips.lostBudget'), command: 'How many leads did we lose to budget mismatch this month?' },
    { label: t('assistant.chips.unsold'), command: 'Which project has most unsold inventory?' },
    { label: t('assistant.chips.duplicates'), command: 'Find duplicate leads' },
  ]
  const redistribute = (ids: ID[]) => {
    try {
      const { result, undoToken } = assignLeads(ids, 'auto')
      toastUndo(t('toast.autoAssigned', { count: result.filter((r) => r.to).length }), undoToken)
    } catch (e) {
      toastError(e)
    }
  }
  return (
    <div className="flex flex-col gap-6" data-testid="today-admin">
      <TodayHero
        now={now} name={firstName(user.name)} greeting={greetingKey(now)}
        brief={brief.map((p, i) => <span key={p.key}>{i > 0 && ' '}{t(p.key, p.params)}</span>)}
        chips={data.insights.slice(0, 3).map((ins) => (
          <AISuggestionChip key={ins.key} onClick={() => navigate(insightPath(ins.link))}><InsightText insight={ins} short /></AISuggestionChip>
        ))}
        stats={[
          { key: 'alerts', label: t('admin.stats.alerts'), value: alertCount, icon: AlertTriangle, tone: alertCount ? 'danger' : 'neutral', onClick: () => document.getElementById('today-alerts')?.scrollIntoView({ behavior: 'smooth' }) },
          { key: 'unassigned', label: t('admin.stats.unassigned'), value: a.unassigned, icon: Inbox, tone: a.unassigned ? 'warning' : 'neutral' },
          { key: 'imports', label: t('admin.stats.imports'), value: data.importTotals.imported, icon: Upload, tone: 'info' },
          { key: 'drafts', label: t('admin.stats.drafts'), value: a.openDrafts, icon: FileWarning, tone: 'violet', onClick: () => navigate(paths.drafts()) },
        ]}
        assistant={<AIQuickCommand suggestions={suggestions} />}
      />

      <section aria-label={t('admin.kpis')} className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-6" data-testid="admin-kpis">
        <KpiCard label={t('admin.kpi.newLeads')} value={data.kpis.newLeadsToday} icon={UserPlus} tone="info" spark={phone ? undefined : data.series.newLeads} delta={{ value: data.deltas.newLeads, unit: '', caption: t('admin.kpi.vsYesterday') }} to={paths.leads()} />
        <KpiCard label={t('admin.kpi.visits')} value={data.kpis.visitsToday} icon={CalendarCheck} tone="warning" spark={phone ? undefined : data.series.visits} delta={{ value: data.deltas.visits, unit: '', caption: t('admin.kpi.vsYesterday') }} to={paths.appointments({ view: 'day' })} />
        <KpiCard label={t('admin.kpi.bookings')} value={data.kpis.bookingsThisMonth} icon={Trophy} tone="success" spark={phone ? undefined : data.series.bookings} delta={data.deltas.bookings != null ? { value: data.deltas.bookings, caption: t('admin.kpi.vsLastMonth') } : undefined} to={paths.reports('overview')} />
        <KpiCard highlight label={t('admin.kpi.pipeline')} value={inrShort(data.kpis.pipelineValue)} icon={IndianRupee} spark={phone ? undefined : data.series.pipeline} delta={data.deltas.pipeline != null ? { value: data.deltas.pipeline, caption: t('admin.kpi.vs4Weeks') } : undefined} to={paths.pipeline()} />
        <KpiCard label={t('admin.kpi.conversion')} value={`${data.kpis.conversionPct}%`} icon={Percent} tone="primary" spark={phone ? undefined : data.series.conversion} delta={{ value: data.deltas.conversion, unit: t('admin.kpi.pts'), caption: t('admin.kpi.vsLastMonth') }} to={paths.reports('pipeline')} />
        <Link to={paths.properties()} className="block rounded-lg border bg-card p-4 shadow-card transition-[transform,box-shadow] duration-(--dur-fast) hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:p-5" data-testid="kpi-inventory">
          <div className="flex items-center gap-2.5">
            <IconTile icon={Boxes} tone="violet" />
            <span className="text-label font-semibold tracking-[0.04em] text-muted-foreground uppercase [:lang(ta)_&]:normal-case">{t('admin.kpi.inventory')}</span>
          </div>
          <p className="mt-3 text-kpi font-[650] tabular-nums">{data.kpis.availableInventory}<span className="ml-1.5 text-meta font-normal text-muted-foreground">{t('admin.kpi.available')}</span></p>
          <span role="img" aria-label={inv.map((s) => `${t(`catalogue:propertyStatus.${s.status}`)} ${s.count}`).join(', ')} className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted">
            {inv.map((s) => <span key={s.status} className={propertyStatusTone[s.status].solid} style={{ width: `${invTotal ? (s.count / invTotal) * 100 : 0}%` }} />)}
          </span>
          <ul className="mt-2 grid grid-cols-1 gap-y-0.5 text-meta text-muted-foreground">
            {inv.map((s) => <li key={s.status} className="flex items-center gap-1.5"><span aria-hidden="true" className={cn('size-1.5 rounded-full', propertyStatusTone[s.status].solid)} />{t(`catalogue:propertyStatus.${s.status}`)} <span className="ml-auto font-medium text-foreground tabular-nums">{s.count}</span></li>)}
          </ul>
        </Link>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-7">
          <SourceFunnel data={data} />
          <TeamSnapshot rows={data.team} db={db} />
        </div>
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-5">
          <AlertsCard data={data} db={db} onAutoAssign={() => setConfirm({ ids: a.unassignedIds, title: t('admin.alerts.autoTitle', { count: a.unassignedIds.length }) })}
            onRedistribute={(userId, name) => setConfirm({ ids: openLeadIdsOf(db, userId), title: t('admin.alerts.redistributeTitle', { name }) })} />
          <InsightsCard insights={data.insights} />
          <ImportActivity data={data} db={db} />
        </div>
      </div>
      {confirm && (
        <ConfirmDialog open onOpenChange={(o) => { if (!o) setConfirm(null) }} title={confirm.title} description={t('admin.alerts.confirmBody')}
          confirmLabel={t('admin.alerts.confirm', { count: confirm.ids.length })} onConfirm={() => { redistribute(confirm.ids); setConfirm(null) }} />
      )}
    </div>
  )
}

/** One insight sentence with its translated params (sources, reasons) and ₹ values. */
function InsightText({ insight, short }: { insight: Insight; short?: boolean }) {
  const { t } = useTranslation(['today', 'catalogue'])
  const params: Record<string, string | number> = { ...insight.params }
  if (typeof params.value === 'number') params.value = inrShort(params.value)
  for (const [k, key] of Object.entries(insight.tParams ?? {})) params[k] = t(key)
  return <>{t(`today:insight.${short ? 'short.' : ''}${insight.key}`, params)}</>
}

function SourceFunnel({ data }: { data: AdminToday }) {
  const { t } = useTranslation(['today', 'catalogue'])
  const navigate = useNavigate()
  const rows = [...data.sources].sort((a, b) => b.count - a.count).slice(0, 7).map((s) => ({ key: s.source, label: t(`catalogue:source.${s.source}`), leads: s.count, visited: s.visited, booked: s.booked }))
  return (
    <SectionCard title={t('today:admin.sources.title')} description={t('today:admin.sources.subtitle')} data-testid="admin-sources"
      action={<Button asChild size="sm" variant="ghost"><Link to={paths.reports('sources')}>{t('today:admin.sources.report')}<ArrowUpRight /></Link></Button>}
    >
      <BarSeriesChart
        data={rows} xKey="label" horizontal height={Math.max(200, rows.length * 38)} label={t('today:admin.sources.title')}
        series={[{ key: 'leads', label: t('today:admin.sources.leads') }, { key: 'visited', label: t('today:admin.sources.visited') }, { key: 'booked', label: t('today:admin.sources.booked') }]}
        onBarClick={(r) => navigate(paths.leads({ source: r.key }))}
      />
    </SectionCard>
  )
}

function TeamSnapshot({ rows, db }: { rows: ExecRow[]; db: DB }) {
  const { t } = useTranslation(['today', 'common'])
  const navigate = useNavigate()
  const { can } = usePermission()
  const list = rows.filter((r) => r.user.status === 'active' || r.openLeads > 0)
  const cols: Column<ExecRow>[] = [
    { key: 'name', header: t('today:admin.team.exec'), cell: (r) => (
      <span className="flex items-center gap-2">
        <UserAvatar name={r.user.name} size="xs" availability={r.user.status === 'active' ? r.user.availability : undefined} />
        <span className="truncate font-medium">{r.user.name}</span>
        {r.user.status === 'deactivated' && <ToneBadge tone="danger">{t('today:manager.team.deactivated')}</ToneBadge>}
      </span>
    ) },
    { key: 'open', header: t('today:admin.team.open'), align: 'right', cell: (r) => r.openLeads },
    { key: 'calls', header: t('today:admin.team.calls'), align: 'right', hideBelow: 'md', cell: (r) => r.callsToday },
    { key: 'visits', header: t('today:admin.team.visits'), align: 'right', hideBelow: 'md', cell: (r) => r.visitsToday },
    { key: 'overdue', header: t('today:admin.team.overdue'), align: 'right', cell: (r) => <span className={cn(r.overdue && 'font-semibold text-danger')}>{r.overdue}</span> },
    { key: 'conv', header: t('today:admin.team.conversion'), align: 'right', hideBelow: '2xl', cell: (r) => `${r.conversionPct}%` },
  ]
  return (
    <SectionCard title={t('today:admin.team.title')} description={t('today:admin.team.subtitle', { count: db.leads.filter((l) => l.ownerId === null).length })} data-testid="admin-team" bodyClassName="p-0 md:p-0 pt-0 md:pt-0"
      action={can('team.view') ? <Button asChild size="sm" variant="ghost"><Link to={paths.team()}>{t('today:manager.team.view')}<ArrowUpRight /></Link></Button> : undefined}
    >
      <div className="px-4 pb-4 md:px-5 md:pb-5">
        <DataTable rows={list} columns={cols} rowKey={(r) => r.user.id} label={t('today:admin.team.title')} density="compact"
          onRowClick={can('team.view') ? (r) => navigate(paths.teamMember(r.user.id)) : undefined} />
      </div>
    </SectionCard>
  )
}

function AlertsCard({ data, db, onAutoAssign, onRedistribute }: { data: AdminToday; db: DB; onAutoAssign: () => void; onRedistribute: (userId: ID, name: string) => void }) {
  const { t } = useTranslation('today')
  const { can } = usePermission()
  const a = data.alerts
  const age = splitMins(a.oldestUnassignedMins)
  const items: { key: string; icon: typeof Inbox; tone: 'danger' | 'warning' | 'violet' | 'info'; title: string; body?: string; action?: ReactElement }[] = []
  if (a.unassigned) items.push({
    key: 'unassigned', icon: Inbox, tone: 'danger', title: t('admin.alerts.unassigned', { count: a.unassigned }),
    body: t('admin.alerts.oldest', { time: age.d ? t('due.days', { count: age.d }) : age.h ? t('due.hours', { h: age.h, m: age.m }) : t('due.mins', { count: age.m }) }),
    action: can('lead.assign') ? <Button size="sm" variant="secondary" onClick={onAutoAssign} data-testid="admin-auto-assign"><Wand2 />{t('admin.alerts.autoAssign')}</Button> : undefined,
  })
  for (const d of a.deactivatedOwners) items.push({
    key: `deact-${d.user.id}`, icon: UserX, tone: 'warning', title: t('admin.alerts.deactivated', { name: d.user.name, count: d.count }), body: t('admin.alerts.deactivatedBody'),
    action: can('lead.assign') ? <Button size="sm" variant="secondary" onClick={() => onRedistribute(d.user.id, d.user.name)}>{t('admin.alerts.redistribute')}</Button> : undefined,
  })
  if (a.duplicates.length) items.push({ key: 'dupes', icon: CopyCheck, tone: 'violet', title: t('admin.alerts.duplicates', { count: a.duplicates.length }) })
  if (a.missingLeadData.length) items.push({ key: 'missingLeads', icon: FileWarning, tone: 'info', title: t('admin.alerts.missingLeads', { count: a.missingLeadData.length }), body: t('admin.alerts.missingLeadsBody'), action: <Button asChild size="sm" variant="ghost"><Link to={paths.leads()}>{t('admin.alerts.review')}</Link></Button> })
  if (a.incompleteProperties.length) items.push({ key: 'props', icon: FileWarning, tone: 'info', title: t('admin.alerts.properties', { count: a.incompleteProperties.length }), body: a.incompleteProperties.slice(0, 2).map((p) => p.title).join(', '), action: <Button asChild size="sm" variant="ghost"><Link to={paths.properties()}>{t('admin.alerts.review')}</Link></Button> })
  return (
    <SectionCard id="today-alerts" title={t('admin.alerts.title')} icon={AlertTriangle} data-testid="admin-alerts">
      {items.length === 0 ? (
        <EmptyState compact illustration={EmptyTasks} title={t('admin.alerts.emptyTitle')} body={t('admin.alerts.emptyBody')} />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((it) => (
            <li key={it.key} className={cn('rounded-lg border p-3', ALERT_BG[it.tone])}>
              <div className="flex items-start gap-3">
                <IconTile icon={it.icon} tone={it.tone} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{it.title}</p>
                  {it.body && <p className="mt-0.5 text-meta text-muted-foreground">{it.body}</p>}
                  {it.key === 'dupes' && (
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {a.duplicates.slice(0, 3).map((d) => (
                        <li key={d.lead.id} className="text-meta">
                          <Link to={paths.lead(d.lead.id)} className="font-medium hover:underline">{d.lead.name} ({d.lead.id})</Link>
                          <span className="text-muted-foreground"> ↔ </span>
                          <Link to={paths.lead(d.other.id)} className="hover:underline">{d.other.name} ({d.other.id})</Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {it.action && <div className="shrink-0">{it.action}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="sr-only">{db.meta.anchorDate}</p>
    </SectionCard>
  )
}

function InsightsCard({ insights }: { insights: Insight[] }) {
  const { t } = useTranslation('today')
  return (
    <SectionCard title={t('admin.insights.title')} icon={Lightbulb} data-testid="admin-insights" action={<DemoAIBadge mode="simulated" />}>
      {insights.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('admin.insights.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {insights.map((ins) => (
            <li key={ins.key}>
              <Link to={insightPath(ins.link)} className="group flex items-start gap-2.5 rounded-md p-1.5 -m-1.5 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" data-testid="insight">
                <span aria-hidden="true" className={cn('mt-1.5 size-2 shrink-0 rounded-full', TONE[ins.tone].solid)} />
                <span className="flex-1 text-sm"><InsightText insight={ins} /></span>
                <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

function ImportActivity({ data, db }: { data: AdminToday; db: DB }) {
  const { t, i18n } = useTranslation(['today', 'catalogue'])
  const { can } = usePermission()
  const tot = data.importTotals
  return (
    <SectionCard title={t('today:admin.imports.title')} description={t('today:admin.imports.subtitle', { jobs: tot.jobs, rows: tot.imported, dupes: tot.duplicates })} icon={Upload} data-testid="admin-imports"
      action={<Button asChild size="sm" variant="ghost"><Link to={paths.importHistory()}>{t('today:admin.imports.history')}<ArrowUpRight /></Link></Button>}
    >
      {data.imports.length === 0 ? (
        <EmptyState compact illustration={EmptyImport} title={t('today:admin.imports.emptyTitle')}
          primary={can('import.leads') ? <Button asChild size="sm"><Link to={paths.import()}>{t('today:admin.imports.start')}</Link></Button> : undefined} />
      ) : (
        <ul className="flex flex-col divide-y divide-border/70">
          {data.imports.map((j) => {
            const by = db.users.find((u) => u.id === j.createdBy)
            return (
              <li key={j.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <IconTile icon={GaugeIcon} tone={j.status === 'completed' ? 'success' : j.status === 'failed' ? 'danger' : 'warning'} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{j.fileName}</p>
                  <p className="truncate text-meta text-muted-foreground">{[t(`today:admin.imports.kind.${j.kind}`), fmtDate(j.createdAt, i18n.language), by ? firstName(by.name) : null].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="flex flex-col items-end gap-0.5 text-meta tabular-nums">
                  <span className="font-semibold text-success">{t('today:admin.imports.imported', { count: j.counts.imported })}</span>
                  {j.counts.duplicates > 0 && <span className="text-muted-foreground">{t('today:admin.imports.dupes', { count: j.counts.duplicates })}</span>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
}


const ALERT_BG = { danger: 'bg-danger-soft/40', warning: 'bg-warning-soft/40', violet: 'bg-violet-soft/40', info: 'bg-info-soft/40' } as const
