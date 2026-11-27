/**
 * /leads — the Leads list (master prompt §8; plan §8.3 M2 "List"). Header KPIs (click to filter), follow-up tabs with
 * counts (plus Unassigned for managers and admins), search that the AI can read as filters, filter pills, saved views,
 * three views (Today design · Table · Cards), sort, pagination, hover actions and bulk actions. Add lead opens the
 * 3-step sheet; "Paste a message" opens it ready for paste-and-fill.
 */
import { useMemo, useState } from 'react'
import { AlarmClock, Download, Flame, LayoutGrid, ListTodo, Plus, Sparkles, Table2, UserX, Users, Wand2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { EmptyLeads } from '@/components/illustrations'
import type { Density, TableSort } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { FilteredEmpty } from '@/components/shared/filtered-empty'
import { KpiCard } from '@/components/shared/kpi-card'
import { PageHeader } from '@/components/shared/page-header'
import { Pagination } from '@/components/shared/pagination'
import { Segmented } from '@/components/shared/segmented'
import { ColumnMenu, DensityToggle } from '@/components/shared/table-controls'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { usePermission } from '@/hooks/use-permission'
import { useIsPhone } from '@/hooks/use-media-query'
import { LEAD_TABS, filterCount, inTab, isActive, matchesLead, sortLeads, tabCounts, type LeadFilters, type LeadSort, type LeadTab } from '@/lib/lead-queries'
import { AddLeadSheet } from '../components/add-lead-sheet'
import { downloadLeadsCsv } from '../components/export-csv'
import { LeadDialogsProvider } from '../components/lead-dialogs'
import { LeadsBulk } from '../components/leads-bulk'
import { LeadsFilters } from '../components/leads-filters'
import { LeadsTable } from '../components/leads-table'
import { LEAD_COLUMNS } from '../lib/columns'
import { LeadsCards, LeadsFocus } from '../components/leads-views'
import { SavedViewsMenu } from '../components/saved-views-menu'
import { useLeadItems, type LeadRow } from '../components/use-lead-items'
import { headline, weeklyNew } from '../lib/list-stats'

type View = 'focus' | 'table' | 'cards'
type Tab = LeadTab | 'unassigned'
const VIEW_KEY = 'crm-e2e-leads-view'
const readView = (): View | null => {
  try {
    const v = window.localStorage.getItem(VIEW_KEY)
    return v === 'focus' || v === 'table' || v === 'cards' ? v : null
  } catch {
    return null
  }
}
const SORTS: LeadSort[] = ['score', 'followUp', 'newest', 'name']

export default function LeadsPage() {
  const { t } = useTranslation(['leads', 'common'])
  const { can, scope } = usePermission()
  const isPhone = useIsPhone()
  const { rows, now } = useLeadItems()
  const [params, setParams] = useSearchParams()
  const manager = scope('lead.assign') !== false
  const tab = (params.get('tab') as Tab | null) ?? 'all'
  const view: View = (params.get('view') as View | null) ?? readView() ?? (manager ? 'table' : 'focus')
  const [filters, setFilters] = useState<LeadFilters>({ sort: 'score' })
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [density, setDensity] = useState<Density>('comfortable')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(params.get('add') === '1')

  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
    setPage(0)
  }
  const setView = (v: View) => {
    try { window.localStorage.setItem(VIEW_KEY, v) } catch { /* storage blocked: the URL keeps the view */ }
    setParam('view', v)
  }
  const changeFilters = (f: LeadFilters) => { setFilters(f); setPage(0) }

  const counts = useMemo(() => ({ ...tabCounts(rows, now), unassigned: rows.filter((r) => isActive(r.lead) && !r.lead.ownerId).length }), [rows, now])
  const filtered = useMemo(() => {
    const inCurrentTab = (r: LeadRow) => (tab === 'unassigned' ? isActive(r.lead) && !r.lead.ownerId : inTab(r, tab, now))
    const list = rows.filter((r) => inCurrentTab(r) && matchesLead(r, filters, now))
    const sorted = sortLeads(list, filters.sort ?? 'score') as LeadRow[]
    const natural = filters.sort === 'name' || filters.sort === 'followUp' ? 'asc' : 'desc'
    return dir === natural ? sorted : sorted.reverse()
  }, [rows, filters, tab, now, dir])
  const pageRows = view === 'focus' ? filtered : filtered.slice(page * pageSize, (page + 1) * pageSize)
  const h = useMemo(() => headline(rows, now), [rows, now])
  const spark = useMemo(() => weeklyNew(rows.map((r) => r.lead), now), [rows, now])
  const active = filterCount(filters)

  const clearAll = () => { changeFilters({ sort: filters.sort }); setParam('tab', null) }
  const empty = rows.length === 0
    ? (
      <EmptyState
        illustration={EmptyLeads} title={t('leads:empty.title')} body={t('leads:empty.body')}
        primary={can('lead.create') ? <Button onClick={() => setAdding(true)}><Plus />{t('leads:add.cta')}</Button> : undefined}
        secondary={can('lead.create') ? <Button variant="secondary" onClick={() => setAdding(true)}><Wand2 />{t('leads:add.paste')}</Button> : undefined}
      />
    )
    : <FilteredEmpty title={t('leads:empty.filteredTitle')} onClear={clearAll} />

  const tableSort: TableSort = { key: filters.sort ?? 'score', dir }
  const onSort = (key: string) => {
    const s = key as LeadSort
    if (filters.sort === s) setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { changeFilters({ ...filters, sort: s }); setDir(s === 'name' || s === 'followUp' ? 'asc' : 'desc') }
  }
  const footer = view !== 'focus' && filtered.length > 0
    ? <Pagination page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(0) }} />
    : undefined
  const tabs: Tab[] = manager ? [...LEAD_TABS.slice(0, 4), 'unassigned', 'closed'] : [...LEAD_TABS]

  return (
    <LeadDialogsProvider onDeleted={(ids) => setSelected((s) => { const n = new Set(s); ids.forEach((id) => n.delete(id)); return n })}>
      <div className="flex flex-col gap-5" data-testid="leads-page">
        <PageHeader
          title={t('leads:title')}
          subtitle={t('leads:subtitleCount', { count: h.open, week: h.newThisWeek })}
          actions={
            <>
              <Segmented
                variant="pill" label={t('leads:view.label')} value={view} onChange={setView}
                segments={[
                  { value: 'focus', label: <span className="max-sm:sr-only">{t('leads:view.focus')}</span>, icon: <ListTodo />, ariaLabel: t('leads:view.focus') },
                  { value: 'table', label: <span className="max-sm:sr-only">{t('leads:view.table')}</span>, icon: <Table2 />, ariaLabel: t('leads:view.table') },
                  { value: 'cards', label: <span className="max-sm:sr-only">{t('leads:view.cards')}</span>, icon: <LayoutGrid />, ariaLabel: t('leads:view.cards') },
                ]}
              />
              {can('lead.create') && (
                <>
                  <Button variant="secondary" onClick={() => setAdding(true)} data-testid="leads-paste"><Sparkles className="text-ai" />{t('leads:add.paste')}</Button>
                  <Button onClick={() => setAdding(true)} data-testid="leads-add"><Plus />{t('leads:add.cta')}</Button>
                </>
              )}
            </>
          }
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label={t('leads:kpi.open')} value={h.open} icon={Users} spark={isPhone ? undefined : spark} hint={t('leads:kpi.openHint', { count: h.newThisWeek })} onClick={clearAll} />
          <KpiCard label={t('leads:kpi.hot')} value={h.hot} icon={Flame} tone="hot" ring={{ value: h.open ? (h.hot / h.open) * 100 : 0, label: t('leads:kpi.hotShare') }} onClick={() => changeFilters({ ...filters, temperatures: ['hot'] })} hint={t('leads:kpi.hotHint')} />
          <KpiCard label={t('leads:kpi.overdue')} value={h.overdue} icon={AlarmClock} tone={h.overdue ? 'danger' : 'success'} ring={{ value: h.open ? (h.overdue / h.open) * 100 : 0, label: t('leads:kpi.overdueShare') }} onClick={() => setParam('tab', 'overdue')} hint={t('leads:kpi.overdueHint')} />
          {manager
            ? <KpiCard label={t('leads:kpi.unassigned')} value={h.unassigned} icon={UserX} tone={h.unassigned ? 'warning' : 'success'} ring={{ value: h.open ? (h.unassigned / h.open) * 100 : 0, label: t('leads:kpi.unassignedShare') }} onClick={() => setParam('tab', 'unassigned')} hint={t('leads:kpi.slaHint', { count: h.sla })} />
            : <KpiCard label={t('leads:kpi.sla')} value={h.sla} icon={AlarmClock} tone={h.sla ? 'danger' : 'success'} ring={{ value: h.open ? (h.sla / h.open) * 100 : 0, label: t('leads:kpi.slaShare') }} onClick={() => changeFilters({ ...filters, attn: 'uncontacted' })} hint={t('leads:kpi.slaExecHint')} />}
        </div>

        <Segmented
          label={t('leads:tabs.label')} value={tab} onChange={(v) => setParam('tab', v === 'all' ? null : v)}
          segments={tabs.map((k) => ({ value: k, label: t(`leads:tabs.${k}`), count: counts[k] }))}
        />

        <LeadsFilters
          rows={rows} filters={filters} onChange={changeFilters}
          end={
            <>
              <SavedViewsMenu filters={filters} onApply={(f, name) => { changeFilters(f); toast(t('leads:views.applied', { name })) }} />
              <Select value={filters.sort ?? 'score'} onValueChange={(v) => { changeFilters({ ...filters, sort: v as LeadSort }); setDir(v === 'name' || v === 'followUp' ? 'asc' : 'desc') }}>
                <SelectTrigger size="sm" className="h-8 w-auto gap-1" aria-label={t('leads:sort.label')}><SelectValue /></SelectTrigger>
                <SelectContent>{SORTS.map((s) => <SelectItem key={s} value={s}>{t(`leads:sort.${s}`)}</SelectItem>)}</SelectContent>
              </Select>
              {view === 'table' && !isPhone && (
                <>
                  <DensityToggle value={density} onChange={setDensity} />
                  <ColumnMenu columns={LEAD_COLUMNS.map((k) => ({ key: k, label: t(`leads:col.${k}`) }))} hidden={hidden} onChange={setHidden} />
                </>
              )}
              {scope('lead.export') !== false && (
                <Button variant="secondary" size="icon" aria-label={t('leads:bulk.exportAll', { count: filtered.length })} title={t('leads:bulk.exportAll', { count: filtered.length })}
                  disabled={!filtered.length} onClick={() => { downloadLeadsCsv(filtered, t, now); toast.success(t('leads:bulk.exported', { count: filtered.length })) }}>
                  <Download />
                </Button>
              )}
            </>
          }
        />

        {(active > 0 || tab !== 'all') && (
          <p className="-mt-2 text-meta text-muted-foreground" aria-live="polite">{t('leads:list.showing', { count: filtered.length, total: rows.length })}</p>
        )}

        {view === 'focus' && <LeadsFocus rows={pageRows} now={now} empty={empty} />}
        {view === 'table' && (
          <LeadsTable
            rows={pageRows} sort={tableSort} onSort={onSort} selected={selected} onSelectedChange={setSelected}
            density={density} hidden={hidden} empty={empty} footer={footer} now={now}
          />
        )}
        {view === 'cards' && <LeadsCards rows={pageRows} selected={selected} onSelectedChange={setSelected} empty={empty} footer={footer} />}

        <LeadsBulk selected={selected} rows={rows} onClear={() => setSelected(new Set())} />
        <AddLeadSheet open={adding} onOpenChange={(o) => { setAdding(o); if (!o && params.get('add')) setParam('add', null) }} />
      </div>
    </LeadDialogsProvider>
  )
}
