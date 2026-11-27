/**
 * Reports (master prompt §13 Reports, §19.1): scoped to everyone, a team or one person (an executive sees only their
 * own, titled "My performance"), for this week, month, quarter or six months, in six tabs. The numbers are derived
 * from the store on every render, so a stage change anywhere moves the funnel at once. CSV export of the current tab
 * when the role may export data.
 */
import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { paths } from '@/app/paths'
import { EmptyReports } from '@/components/illustrations'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { Segmented } from '@/components/shared/segmented'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { DB } from '@/domain/types'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useWholeDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { REPORT_PERIODS, parseSubject, subjectKey, subjectOptions, type ReportPeriod, type ReportSubject } from '@/services/queries/stats'
import { ActivityTab, InventoryTab, OverviewTab, PipelineTab, SourcesTab, TeamTab } from '../components/report-tabs'
import { downloadText } from '../components/download'
import { DrillDrawer } from '../components/drill-drawer'
import { csvFileName, toCsvSections } from '../lib/csv'
import { bucketLabel, buildReport, isReportTab, REPORT_TABS, type Drill, type ReportData, type ReportTab } from '../lib/report-data'
import { ModuleAssistant } from '@/components/ai/module-assistant'

const isPeriod = (s: string | null): s is ReportPeriod => !!s && (REPORT_PERIODS as string[]).includes(s)

export default function ReportsPage() {
  const { t, i18n } = useTranslation(['reports', 'catalogue'])
  const { tab: rawTab } = useParams()
  const [sp, setSp] = useSearchParams()
  const navigate = useNavigate()
  const db = useWholeDb()
  const user = useCurrentUser()
  const now = useNow()
  const { can, scope } = usePermission()
  const [drill, setDrill] = useState<Drill | null>(null)

  const options = useMemo(() => subjectOptions(db, user), [db, user])
  const asked = parseSubject(sp.get('scope'))
  const subject: ReportSubject | undefined = (asked && options.find((o) => subjectKey(o) === subjectKey(asked))) || options[0]
  const period: ReportPeriod = isPeriod(sp.get('period')) ? (sp.get('period') as ReportPeriod) : 'half'
  const tabs = REPORT_TABS.filter((x) => x !== 'team' || subject?.kind !== 'user')
  const tab: ReportTab = isReportTab(rawTab) && tabs.includes(rawTab) ? rawTab : 'overview'
  const data = useMemo(() => (subject ? buildReport(db, user, subject, period, now) : null), [db, user, subject, period, now])
  const personal = scope('report.view') === 'own'

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(sp)
    next.set(k, v)
    setSp(next, { replace: true })
  }
  const subjectLabel = (s: ReportSubject) => {
    if (s.kind === 'all') return t('reports:scope.all')
    if (s.kind === 'team') return t('reports:scope.team', { name: db.users.find((u) => u.id === s.managerId)?.name ?? '' })
    const u = db.users.find((x) => x.id === s.userId)
    return s.userId === user.id ? t('reports:scope.me') : t('reports:scope.person', { name: u?.name ?? '' }) + (u?.status === 'deactivated' ? ` (${t('reports:scope.inactive')})` : '')
  }

  if (!subject || !data) {
    return <EmptyState illustration={EmptyReports} title={t('reports:noScopeTitle')} body={t('reports:noScopeBody')} />
  }

  const exportCsv = () => {
    downloadText(csvFileName(tab, period, subjectKey(subject), now), csvFor(tab, data, db, (k, o) => String(t(k, o ?? {})), i18n.language))
    toast.success(t('reports:exported'))
  }
  const Tab = { overview: OverviewTab, pipeline: PipelineTab, sources: SourcesTab, team: TeamTab, activity: ActivityTab, inventory: InventoryTab }[tab]

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5" data-testid="reports-page">
      <PageHeader
        title={personal ? t('reports:myTitle') : t('reports:title')}
        subtitle={t('reports:subtitleScoped', { scope: subjectLabel(subject), period: t(`reports:period.${period}`) })}
        actions={<>
          {options.length > 1 && (
            <Select value={subjectKey(subject)} onValueChange={(v) => set('scope', v)}>
              <SelectTrigger className="h-8 w-52" aria-label={t('reports:scope.label')} data-testid="report-scope"><SelectValue /></SelectTrigger>
              <SelectContent>
                {options.map((o) => <SelectItem key={subjectKey(o)} value={subjectKey(o)}>{subjectLabel(o)}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Segmented variant="pill" label={t('reports:period.label')} value={period} onChange={(v) => set('period', v)}
            segments={REPORT_PERIODS.map((p) => ({ value: p, label: t(`reports:period.short.${p}`), ariaLabel: t(`reports:period.${p}`) }))} />
          {can('export.data') && <Button size="sm" variant="secondary" onClick={exportCsv} data-testid="report-export"><Download />{t('reports:export')}</Button>}
        </>}
      />
      <Segmented
        label={t('reports:tabs.label')} value={tab}
        onChange={(v) => navigate({ pathname: paths.reports(v === 'overview' ? undefined : v), search: sp.toString() ? `?${sp.toString()}` : '' })}
        segments={tabs.map((x) => ({ value: x, label: t(`reports:tabs.${x}`) }))}
      />
      <div key={`${tab}-${subjectKey(subject)}-${period}`} className="animate-fade-up">
        <Tab data={data} db={db} onDrill={setDrill} />
      </div>
      <ModuleAssistant module="insights" />
      <DrillDrawer drill={drill} onClose={() => setDrill(null)} data={data} db={db} now={now} />
      <span className="sr-only" aria-live="polite">{t('reports:updated', { when: bucketLabel(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`, i18n.language) })}</span>
    </div>
  )
}

type T = (k: string, o?: Record<string, unknown>) => string

/** The current tab's tables as CSV (translated headers; values as numbers so spreadsheets can sum them). */
function csvFor(tab: ReportTab, d: ReportData, db: DB, t: T, lang: string): string {
  const name = (id: string) => db.users.find((u) => u.id === id)?.name ?? id
  const stage = (s: string) => t(`catalogue:stage.${s}`)
  const trend = { title: t('reports:trend.title'), header: [t('reports:csv.period'), t('reports:trend.leads'), t('reports:trend.visits'), t('reports:trend.bookings'), t('reports:csv.revenue')], rows: d.trend.map((p) => [bucketLabel(p.key, lang), p.leads, p.visits, p.bookings, p.revenue]) }
  const funnel = { title: t('reports:funnel.title'), header: [t('reports:aging.stage'), t('reports:csv.reached'), t('reports:csv.dropOff')], rows: d.funnel.map((f) => [stage(f.stage), f.count, f.dropOffPct ?? '']) }
  const sources = { title: t('reports:sources.tableTitle'), header: [t('reports:sources.source'), t('reports:sources.leads'), t('reports:sources.visited'), t('reports:sources.booked')], rows: d.sources.map((s) => [t(`catalogue:source.${s.source}`), s.count, s.visited, s.booked]) }
  switch (tab) {
    case 'overview': {
      const k = d.kpis
      return toCsvSections([
        { title: t('reports:kpis'), header: [t('reports:csv.metric'), t('reports:csv.value'), t('reports:csv.change')], rows: [
          [t('reports:kpi.leads'), k.leads, k.leadsDelta], [t('reports:kpi.visits'), k.visits, k.visitsDelta], [t('reports:kpi.bookings'), k.bookings, k.bookingsDelta],
          [t('reports:kpi.revenue'), k.revenue, k.revenueDelta], [t('reports:kpi.conversion'), k.conversion, null], [t('reports:kpi.tat'), k.tat, null],
        ] },
        trend, funnel, sources,
      ])
    }
    case 'pipeline': return toCsvSections([
      funnel,
      { title: t('reports:aging.title'), header: [t('reports:aging.stage'), t('reports:aging.open'), t('reports:aging.value'), t('reports:aging.avgDays'), t('reports:aging.target'), t('reports:aging.stalled')], rows: d.aging.map((a) => [stage(a.stage), a.count, a.value, a.avgDays, a.targetDays, a.stalled]) },
      { title: t('reports:lost.title'), header: [t('reports:csv.reason'), t('reports:lost.series')], rows: d.lost.map((l) => [t(`catalogue:lostReason.${l.reason}`), l.count]) },
    ])
    case 'sources': return toCsvSections([sources])
    case 'team': return toCsvSections([{
      title: t('reports:team.tableTitle'),
      header: [t('reports:team.exec'), t('reports:team.newLeads'), t('reports:team.calls'), t('reports:team.visits'), t('reports:team.bookings'), t('reports:csv.revenue'), t('reports:team.conversion'), t('reports:team.tat'), t('reports:team.overdue')],
      rows: d.execs.map((e) => [name(e.userId), e.newLeads, e.calls, e.visits, e.bookings, e.revenue, e.conversionPct, e.avgFirstContactMins, e.overdue]),
    }])
    case 'activity': return toCsvSections([{ title: t('reports:activity.trendTitle'), header: [t('reports:csv.period'), t('reports:activity.calls'), t('reports:activity.whatsapp'), t('reports:activity.notes')], rows: d.activity.map((a) => [bucketLabel(a.key, lang), a.calls, a.whatsapp, a.notes]) }])
    case 'inventory': return toCsvSections([
      { title: t('reports:inventory.statusTitle'), header: [t('reports:csv.status'), t('reports:csv.count'), t('reports:csv.value')], rows: d.inventoryStatus.map((s) => [t(`catalogue:propertyStatus.${s.status}`), s.count, s.value]) },
      { title: t('reports:inventory.typeTitle'), header: [t('reports:csv.type'), t('reports:csv.count'), t('reports:inventory.available')], rows: d.inventoryType.map((x) => [t(`catalogue:propertyType.${x.type}`), x.count, x.available]) },
    ])
  }
}
