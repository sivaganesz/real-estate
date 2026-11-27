/**
 * Properties (master prompt §13, plan §8.3 M3; behaviour ported from wireframe-rebuild properties-page.tsx):
 * KPI strip, plain-words search ("3BHK Whitefield under 1.2 Cr ready to move east facing") read into chips the user
 * can drop, filter pills with counts, status tabs with counts, sort, three views (cards, table, by locality),
 * selection with bulk status change / export / delete (by permission, Undo), and empty / filtered-empty states.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, ArrowDownUp, Building2, CheckCircle2, Download, IndianRupee, LayoutGrid, List, MapPinned, Plus, Sparkles, Trash2, Wand2, X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { paths } from '@/app/paths'
import { PropertyCard } from '@/components/domain/property-card'
import { EmptyProperties } from '@/components/illustrations'
import { BulkBar } from '@/components/shared/bulk-bar'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { FilteredEmpty } from '@/components/shared/filtered-empty'
import { KpiCard } from '@/components/shared/kpi-card'
import { PageHeader } from '@/components/shared/page-header'
import { SearchInput } from '@/components/shared/search-input'
import { Segmented } from '@/components/shared/segmented'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PROPERTY_STATUSES } from '@/domain/catalogue'
import type { PropertyStatus } from '@/domain/types'
import { useWholeDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { localDay } from '@/lib/dates'
import { num } from '@/lib/format'
import { attentionFor, isListed, pricePerSqft } from '@/lib/property'
import { criteriaKeys, criterionLabel, hasPropertyFilters, parsePropertyQuery, relaxFor, type PropertyFilters as Filters, type PropertySort } from '@/lib/search'
import { propertyStatusTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { changePropertiesStatus, deleteProperties } from '@/services/properties'
import { LocalityGroups } from '../components/locality-groups'
import { PropertiesTable } from '../components/properties-table'
import { PropertyFilters } from '../components/property-filters'
import {
  EMPTY_PILLS, EMPTY_PROPERTY_FILTERS, STATUS_TABS, combineFilters, filterList, groupByLocality, inTab, pillCount, propertyCsvColumns, tabCounts, toCsv,
  weeklyAdds, withoutCriterion, type Pills, type StatusTab,
} from '../lib/list'

type View = 'grid' | 'table' | 'locality'
const SORTS: PropertySort[] = ['', 'oldest', 'priceAsc', 'priceDesc', 'areaAsc', 'areaDesc']
const VIEW_KEY = 'crm-e2e-properties-view'

function readView(): View {
  try {
    const v = localStorage.getItem(VIEW_KEY)
    return v === 'table' || v === 'locality' ? v : 'grid'
  } catch {
    return 'grid'
  }
}

function download(name: string, text: string) {
  const blob = new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function PropertiesPage() {
  const { t } = useTranslation(['properties', 'catalogue', 'common'])
  const db = useWholeDb()
  const now = useNow()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { can, explain } = usePermission()
  const [view, setViewState] = useState<View>(readView)
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [parsed, setParsed] = useState<Filters>(() => (params.get('q') ? parsePropertyQuery(params.get('q')!) : EMPTY_PROPERTY_FILTERS))
  const [pills, setPills] = useState<Pills>(EMPTY_PILLS)
  const [tab, setTab] = useState<StatusTab>(() => (STATUS_TABS.includes(params.get('status') as StatusTab) ? (params.get('status') as StatusTab) : 'all'))
  const [sort, setSort] = useState<PropertySort>('')
  const [attention, setAttention] = useState(params.get('attention') === '1')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState(false)

  const setView = (v: View) => {
    setViewState(v)
    try { localStorage.setItem(VIEW_KEY, v) } catch { /* private mode: the view is not remembered */ }
  }
  // read the sentence a moment after typing stops
  useEffect(() => {
    const id = window.setTimeout(() => {
      setParsed(query.trim() ? parsePropertyQuery(query) : EMPTY_PROPERTY_FILTERS)
      const next = new URLSearchParams(params)
      if (query.trim()) next.set('q', query.trim())
      else next.delete('q')
      if (next.toString() !== params.toString()) setParams(next, { replace: true })
    }, 250)
    return () => window.clearTimeout(id)
  }, [query, params, setParams])

  const filters = useMemo(() => combineFilters(pills, parsed, sort), [pills, parsed, sort])
  const attentionMap = useMemo(() => new Map(db.properties.map((p) => [p.id, attentionFor(p, db, now)])), [db, now])
  const base = useMemo(() => (attention ? db.properties.filter((p) => (attentionMap.get(p.id) ?? []).length) : db.properties), [db.properties, attention, attentionMap])
  const { inFilters, shown } = useMemo(() => filterList(base, filters, tab), [base, filters, tab])
  const counts = useMemo(() => tabCounts(inFilters), [inFilters])
  const groups = useMemo(() => (view === 'locality' ? groupByLocality(shown) : []), [view, shown])
  const relax = useMemo(() => (!shown.length && hasPropertyFilters(parsed) ? relaxFor(db.properties.filter((p) => inTab(p, tab)), filters) : null), [shown.length, parsed, filters, db.properties, tab])
  const anyFilter = hasPropertyFilters(parsed) || pillCount(pills) > 0 || attention
  const parsedKeys = criteriaKeys(parsed)

  // KPIs over the whole inventory (not the filters)
  const live = db.properties.filter(isListed)
  const available = live.filter((p) => p.status === 'available')
  const ppsfs = available.map(pricePerSqft).filter((n): n is number => n !== null)
  const avgPpsf = ppsfs.length ? Math.round(ppsfs.reduce((a, b) => a + b, 0) / ppsfs.length) : 0
  const attentionCount = [...attentionMap.values()].filter((a) => a.length).length

  const selectedRows = shown.filter((p) => selected.has(p.id))
  const canEditAll = selectedRows.every((p) => can('property.edit', p))
  const toggle = (id: string, on: boolean) => setSelected((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n })
  const clearAll = () => { setQuery(''); setParsed(EMPTY_PROPERTY_FILTERS); setPills(EMPTY_PILLS); setAttention(false); setTab('all') }

  const bulkStatus = (status: PropertyStatus) => {
    try {
      const { result, undoToken } = changePropertiesStatus(selectedRows.map((p) => p.id), status)
      toastUndo(t('properties:bulk.statusDone', { count: result, status: t(`catalogue:propertyStatus.${status}`) }), undoToken)
      setSelected(new Set())
    } catch (e) { toastError(e) }
  }
  const bulkDelete = () => {
    try {
      const { result, undoToken } = deleteProperties(selectedRows.map((p) => p.id))
      toastUndo(t('properties:bulk.deleted', { count: result }), undoToken)
      setSelected(new Set())
    } catch (e) { toastError(e) }
  }
  const exportCsv = () => {
    const rows = selectedRows.length ? selectedRows : shown
    const csv = toCsv(rows, propertyCsvColumns((k) => t(`properties:csv.${k}`), { type: (p) => t(`catalogue:propertyType.${p.type}`), status: (p) => t(`catalogue:propertyStatus.${p.status}`) }))
    download(`properties-${localDay(now)}.csv`, csv)
    toast.success(t('properties:bulk.exported', { count: rows.length }))
  }
  const tableSort = sort.startsWith('price') ? { key: 'price', dir: sort === 'priceAsc' ? 'asc' as const : 'desc' as const } : sort.startsWith('area') ? { key: 'area', dir: sort === 'areaAsc' ? 'asc' as const : 'desc' as const } : null
  const onTableSort = (key: string) => {
    const asc = key === 'price' ? 'priceAsc' : 'areaAsc'
    const desc = key === 'price' ? 'priceDesc' : 'areaDesc'
    setSort(sort === asc ? desc : asc)
  }

  const emptyAll = !db.properties.length
  const emptyNode = emptyAll ? (
    <EmptyState
      illustration={EmptyProperties} title={t('properties:empty.title')} body={t('properties:empty.body')}
      primary={can('property.create') && <Button asChild><Link to={paths.newProperty()}><Plus />{t('properties:actions.add')}</Link></Button>}
      secondary={can('property.create') && <Button asChild variant="ai"><Link to={`${paths.newProperty()}?paste=1`}><Wand2 />{t('properties:actions.paste')}</Link></Button>}
    />
  ) : (
    <div className="flex flex-col items-center gap-3">
      <FilteredEmpty title={t('properties:empty.filteredTitle')} body={t('properties:empty.filteredBody')} onClear={clearAll} />
      {relax && (
        <Button variant="secondary" size="sm" onClick={() => setParsed(relax.drop.reduce(withoutCriterion, parsed))} data-testid="relax">
          <Sparkles className="text-ai" />{t('properties:search.relax', { list: relax.drop.map((k) => criterionLabel(k, parsed, t)).join(', '), count: relax.n })}
        </Button>
      )}
    </div>
  )

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
      <PageHeader
        title={t('properties:title')}
        subtitle={t('properties:subtitle')}
        actions={(
          <>
            <Segmented
              variant="pill" value={view} onChange={setView} label={t('properties:view.label')}
              segments={[
                { value: 'grid', label: <span className="max-sm:sr-only">{t('properties:view.grid')}</span>, icon: <LayoutGrid aria-hidden="true" /> },
                { value: 'table', label: <span className="max-sm:sr-only">{t('properties:view.table')}</span>, icon: <List aria-hidden="true" /> },
                { value: 'locality', label: <span className="max-sm:sr-only">{t('properties:view.locality')}</span>, icon: <MapPinned aria-hidden="true" /> },
              ]}
            />
            {can('property.create') && (
              <>
                <Button variant="ghost" className="text-ai hover:bg-ai-soft hover:text-ai" onClick={() => navigate(`${paths.newProperty()}?paste=1`)} data-testid="paste-property"><Wand2 />{t('properties:actions.paste')}</Button>
                <Button asChild data-testid="add-property"><Link to={paths.newProperty()}><Plus />{t('properties:actions.add')}</Link></Button>
              </>
            )}
          </>
        )}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label={t('properties:kpi.live')} value={num(live.length)} icon={Building2} tone="primary" spark={weeklyAdds(live, now)} hint={t('properties:kpi.liveHint')} />
        <KpiCard label={t('properties:kpi.available')} value={num(available.length)} icon={CheckCircle2} tone="success" progress={{ value: available.length, max: live.length, caption: t('properties:kpi.availableRing') }} onClick={() => setTab('available')} />
        <KpiCard label={t('properties:kpi.avgPpsf')} value={avgPpsf ? `₹${num(avgPpsf)}` : '–'} icon={IndianRupee} tone="info" hint={t('properties:kpi.avgPpsfHint')} />
        <KpiCard label={t('properties:kpi.attention')} value={num(attentionCount)} icon={AlertTriangle} tone="warning" hint={attention ? t('properties:kpi.attentionOn') : t('properties:kpi.attentionHint')} onClick={() => setAttention((a) => !a)} className={cn(attention && 'ring-2 ring-warning')} />
      </div>

      <div className="flex flex-col gap-3">
        <SearchInput size="lg" value={query} onChange={setQuery} label={t('properties:search.label')} placeholder={t('properties:search.placeholder')} />
        {parsedKeys.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5" aria-live="polite" data-testid="search-reading">
            <span className="inline-flex items-center gap-1 text-meta font-medium text-ai"><Sparkles className="size-3.5" aria-hidden="true" />{t('properties:search.reading')}</span>
            {parsedKeys.map((k) => (
              <span key={k} className="inline-flex h-7 items-center gap-1 rounded-full border border-ai-border bg-ai-soft/50 pr-1 pl-2.5 text-ui text-foreground">
                {criterionLabel(k, parsed, t)}
                <button type="button" onClick={() => setParsed(withoutCriterion(parsed, k))} aria-label={t('properties:search.drop', { what: criterionLabel(k, parsed, t) })} className="flex size-5 items-center justify-center rounded-full hover:bg-ai-soft"><X className="size-3" aria-hidden="true" /></button>
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <PropertyFilters pills={pills} onChange={setPills} all={db.properties} />
          {anyFilter && <Button variant="ghost" size="sm" onClick={clearAll}>{t('properties:filter.clearAll')}</Button>}
          <span className="ml-auto flex items-center gap-2">
            <ArrowDownUp className="size-4 text-muted-foreground" aria-hidden="true" />
            <Select value={sort || 'newest'} onValueChange={(v) => setSort(v === 'newest' ? '' : (v as PropertySort))}>
              <SelectTrigger className="h-8 w-44" aria-label={t('properties:sort.label')}><SelectValue /></SelectTrigger>
              <SelectContent>{SORTS.map((s) => <SelectItem key={s || 'newest'} value={s || 'newest'}>{t(`properties:sort.${s || 'newest'}`)}</SelectItem>)}</SelectContent>
            </Select>
          </span>
        </div>
      </div>

      <Segmented
        value={tab} onChange={setTab} label={t('properties:tabs.label')}
        segments={STATUS_TABS.map((s) => ({ value: s, label: t(`properties:tabs.${s}`), count: counts[s] }))}
      />

      {view === 'table' ? (
        <PropertiesTable rows={shown} selected={selected} onSelectedChange={setSelected} sort={tableSort} onSort={onTableSort} empty={emptyNode} />
      ) : !shown.length ? emptyNode : view === 'locality' ? (
        <LocalityGroups groups={groups} selected={selected} onToggle={toggle} />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5" data-testid="property-grid">
          {shown.map((p) => {
            const att = attentionMap.get(p.id) ?? []
            return (
              <PropertyCard
                key={p.id} property={p} selected={selected.has(p.id)} onSelectedChange={(on) => toggle(p.id, on)}
                more={att.length > 0 ? <span className="inline-flex items-center gap-1 text-meta font-medium text-warning" title={att.map((a) => t(`properties:attention.${a.key}`, { ...a.values, context: a.key === 'price' ? String(a.values?.dir) : undefined })).join(' · ')}><AlertTriangle className="size-3.5" aria-hidden="true" />{t('properties:attention.count', { count: att.length })}</span> : undefined}
              />
            )
          })}
        </div>
      )}
      <p className="text-meta text-muted-foreground tabular-nums">{t('properties:list.showing', { count: shown.length, total: db.properties.length })}</p>

      <BulkBar count={selectedRows.length} onClear={() => setSelected(new Set())}>
        {can('property.edit') && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" disabled={!canEditAll} title={canEditAll ? undefined : t(explain('property.edit').reasonKey, explain('property.edit').params)}>{t('properties:bulk.status')}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuLabel>{t('properties:bulk.statusTo')}</DropdownMenuLabel>
              {PROPERTY_STATUSES.map((s) => (
                <DropdownMenuItem key={s} onSelect={() => bulkStatus(s)}>
                  <span aria-hidden="true" className={cn('size-2 rounded-full', propertyStatusTone[s].solid)} />{t(`catalogue:propertyStatus.${s}`)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {can('export.data') && <Button variant="ghost" size="sm" onClick={exportCsv}><Download />{t('properties:bulk.export')}</Button>}
        {can('property.delete') && <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-soft hover:text-danger" onClick={() => setConfirmDelete(true)}><Trash2 />{t('properties:bulk.delete')}</Button>}
      </BulkBar>
      {can('export.data') && !selectedRows.length && shown.length > 0 && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={exportCsv}><Download />{t('properties:bulk.exportShown', { count: shown.length })}</Button>
        </div>
      )}
      <ConfirmDialog
        open={confirmDelete} onOpenChange={setConfirmDelete} tone="danger"
        title={t('properties:bulk.deleteTitle', { count: selectedRows.length })} description={t('properties:bulk.deleteBody')}
        confirmLabel={t('properties:bulk.deleteConfirm', { count: selectedRows.length })} onConfirm={bulkDelete}
      />
    </div>
  )
}
