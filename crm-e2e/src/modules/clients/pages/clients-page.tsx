/**
 * /clients — booked and converted buyers (created automatically when a lead is Booked, effect E5). KPI cards (active
 * clients, booking value with a 6-month sparkline, loans in progress, pending documents), status tabs with counts,
 * search, executive and loan filters, sort, a table on desktop and cards on phones, each row showing the journey bar,
 * loan status and the documents progress.
 */
import { useMemo, useState } from 'react'
import { BadgeIndianRupee, FileWarning, Landmark, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { paths } from '@/app/paths'
import { ContactActions } from '@/components/domain/contact-actions'
import { EmptyClients } from '@/components/illustrations'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { FilterBar } from '@/components/shared/filter-bar'
import { FilterPill } from '@/components/shared/filter-pill'
import { FilteredEmpty } from '@/components/shared/filtered-empty'
import { KpiCard } from '@/components/shared/kpi-card'
import { Meter } from '@/components/shared/meter'
import { PageHeader } from '@/components/shared/page-header'
import { Pagination } from '@/components/shared/pagination'
import { Segmented } from '@/components/shared/segmented'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Client } from '@/domain/types'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useWholeDb } from '@/hooks/use-db'
import { useIsPhone } from '@/hooks/use-media-query'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { fmtDate, inrShort } from '@/lib/format'
import { visible } from '@/services/queries/visibility'
import { ClientStatusPill, JourneyBar } from '../components/client-pills'
import {
  CLIENT_STATUSES, LOAN_STATUSES, bookingsByMonth, clientKpis, docsProgress, matchesClient, sortClients, type ClientFilters, type ClientSort, type ClientStatus,
} from '../lib/client-queries'

type Tab = 'all' | ClientStatus

export default function ClientsPage() {
  const { t, i18n } = useTranslation(['clients', 'leads'])
  const db = useWholeDb()
  const user = useCurrentUser()
  const now = useNow()
  const navigate = useNavigate()
  const isPhone = useIsPhone()
  const { scope } = usePermission()
  const [tab, setTab] = useState<Tab>('all')
  const [f, setF] = useState<ClientFilters>({})
  const [sort, setSort] = useState<ClientSort>('recent')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const clients = useMemo(() => visible.clients(db, user), [db, user])
  const prop = (c: Client) => db.properties.find((p) => p.id === c.propertyId)
  const ownerName = (c: Client) => db.users.find((u) => u.id === c.ownerId)?.name
  const rows = useMemo(
    () => sortClients(clients.filter((c) => (tab === 'all' || c.status === tab) && matchesClient(c, f, {
      property: db.properties.find((p) => p.id === c.propertyId), ownerName: db.users.find((u) => u.id === c.ownerId)?.name,
    })), sort),
    [clients, tab, f, sort, db.properties, db.users],
  )
  const k = useMemo(() => clientKpis(clients), [clients])
  const spark = useMemo(() => bookingsByMonth(clients, now), [clients, now])
  const active = (f.q ? 1 : 0) + (f.owners?.length ? 1 : 0) + (f.loan?.length ? 1 : 0)
  const execs = db.users.filter((u) => u.role === 'executive')
  const pageRows = rows.slice(page * pageSize, (page + 1) * pageSize)
  const clear = () => { setF({}); setTab('all'); setPage(0) }

  const empty = clients.length === 0
    ? <EmptyState illustration={EmptyClients} title={t('clients:empty.title')} body={t('clients:empty.body')} primary={<Button asChild variant="secondary"><Link to={paths.pipeline()}>{t('clients:empty.cta')}</Link></Button>} />
    : <FilteredEmpty title={t('clients:empty.filtered')} onClear={clear} />

  const columns: Column<Client>[] = [
    {
      key: 'name', header: t('clients:col.client'), className: 'min-w-52',
      cell: (c) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <UserAvatar name={c.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{c.name}</p>
            <p className="truncate text-meta text-muted-foreground tabular-nums">{c.id}{c.city ? ` · ${c.city}` : ''}</p>
          </div>
        </div>
      ),
    },
    { key: 'property', header: t('clients:col.property'), hideBelow: 'lg', className: 'max-w-56', cell: (c) => <span className="block truncate text-meta">{prop(c)?.title ?? '—'}</span> },
    { key: 'value', header: t('clients:col.value'), align: 'right', cell: (c) => <span className="font-semibold">{c.dealValue ? inrShort(c.dealValue) : '—'}</span> },
    { key: 'status', header: t('clients:col.status'), cell: (c) => <div className="flex w-36 flex-col gap-1.5"><ClientStatusPill status={c.status} className="self-start" /><JourneyBar status={c.status} /></div> },
    { key: 'loan', header: t('clients:col.loan'), hideBelow: 'xl', cell: (c) => <span className="text-meta">{c.loan ? `${t(`clients:loan.${c.loan.status}`)}${c.loan.bank ? ` · ${c.loan.bank}` : ''}` : t('clients:loan.notApplied')}</span> },
    {
      key: 'docs', header: t('clients:col.docs'), hideBelow: 'md',
      cell: (c) => {
        const d = docsProgress(c)
        return <div className="flex w-28 flex-col gap-1"><span className="text-meta tabular-nums">{t('clients:docs.count', { done: d.verified, total: d.total })}</span><Meter value={d.pct} size="xs" tone={d.pending ? 'warning' : 'success'} label={t('clients:col.docs')} /></div>
      },
    },
    ...(scope('client.view') !== 'own' ? [{ key: 'owner', header: t('clients:col.owner'), hideBelow: 'xl' as const, cell: (c: Client) => (ownerName(c) ? <span className="flex items-center gap-1.5 text-meta"><UserAvatar name={ownerName(c)!} size="xs" />{ownerName(c)}</span> : '—') }] : []),
    { key: 'booked', header: t('clients:col.booked'), hideBelow: 'lg', cell: (c) => <span className="text-meta text-muted-foreground tabular-nums">{fmtDate(c.bookedAt, i18n.language)}</span> },
  ]

  return (
    <div className="flex flex-col gap-5" data-testid="clients-page">
      <PageHeader title={t('clients:title')} subtitle={t('clients:subtitle')} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label={t('clients:kpi.active')} value={k.active} icon={UsersRound} hint={t('clients:kpi.total', { count: k.total })} onClick={clear} />
        <KpiCard highlight label={t('clients:kpi.value')} value={inrShort(k.value)} icon={BadgeIndianRupee} spark={isPhone ? undefined : spark} hint={t('clients:kpi.valueHint')} />
        <KpiCard label={t('clients:kpi.loans')} value={k.loanInProgress} icon={Landmark} tone="warning" onClick={() => { setF({ ...f, loan: ['applied', 'sanctioned'] }); setPage(0) }} hint={t('clients:kpi.loansHint')} />
        <KpiCard label={t('clients:kpi.docs')} value={k.pendingDocs} icon={FileWarning} tone={k.pendingDocs ? 'danger' : 'success'} hint={t('clients:kpi.docsHint')} />
      </div>
      <Segmented
        label={t('clients:tabs.label')} value={tab} onChange={(v) => { setTab(v); setPage(0) }}
        segments={[{ value: 'all' as Tab, label: t('clients:tabs.all'), count: k.total }, ...CLIENT_STATUSES.map((s) => ({ value: s as Tab, label: t(`clients:status.${s}`), count: k.byStatus[s] }))]}
      />
      <FilterBar
        search={f.q ?? ''} onSearch={(q) => { setF({ ...f, q }); setPage(0) }} searchLabel={t('clients:search')} placeholder={t('clients:searchPlaceholder')}
        activeCount={active} onClearAll={clear}
        filters={
          <>
            {scope('client.view') !== 'own' && (
              <FilterPill label={t('clients:col.owner')} options={execs.map((u) => ({ value: u.id, label: u.name, count: clients.filter((c) => c.ownerId === u.id).length }))} selected={f.owners ?? []} onChange={(v) => { setF({ ...f, owners: v }); setPage(0) }} />
            )}
            <FilterPill label={t('clients:col.loan')} options={LOAN_STATUSES.map((s) => ({ value: s, label: t(`clients:loan.${s}`), count: clients.filter((c) => (c.loan?.status ?? 'notApplied') === s).length }))} selected={f.loan ?? []} onChange={(v) => { setF({ ...f, loan: v as ClientFilters['loan'] }); setPage(0) }} />
          </>
        }
        end={
          <Select value={sort} onValueChange={(v) => setSort(v as ClientSort)}>
            <SelectTrigger size="sm" className="h-8 w-auto" aria-label={t('clients:sort.label')}><SelectValue /></SelectTrigger>
            <SelectContent>{(['recent', 'value', 'name'] as const).map((s) => <SelectItem key={s} value={s}>{t(`clients:sort.${s}`)}</SelectItem>)}</SelectContent>
          </Select>
        }
      />
      {isPhone ? (
        rows.length ? (
          <ul className="flex flex-col gap-2" aria-label={t('clients:title')}>
            {pageRows.map((c) => {
              const d = docsProgress(c)
              return (
                <li key={c.id} className="relative flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-card">
                  <div className="flex items-center gap-3">
                    <UserAvatar name={c.name} size="md" />
                    <div className="min-w-0 flex-1">
                      <Link to={paths.client(c.id)} className="truncate font-semibold after:absolute after:inset-0">{c.name}</Link>
                      <p className="truncate text-meta text-muted-foreground">{prop(c)?.title ?? c.city}</p>
                    </div>
                    <span className="font-semibold tabular-nums">{c.dealValue ? inrShort(c.dealValue) : '—'}</span>
                  </div>
                  <div className="flex items-center gap-2"><ClientStatusPill status={c.status} /><JourneyBar status={c.status} className="flex-1" /></div>
                  <p className="text-meta text-muted-foreground">{t('clients:docs.count', { done: d.verified, total: d.total })}</p>
                </li>
              )
            })}
          </ul>
        ) : <div className="rounded-lg border bg-card shadow-card">{empty}</div>
      ) : (
        <DataTable
          rows={pageRows} columns={columns} rowKey={(c) => c.id} label={t('clients:title')} onRowClick={(c) => navigate(paths.client(c.id))} empty={empty}
          rowActions={(c) => (db.leads.some((l) => l.id === c.leadId) ? <ContactActions lead={{ id: c.leadId, name: c.name, phone: c.phone, email: c.email, ownerId: c.ownerId }} /> : null)}
          footer={rows.length ? <Pagination page={page} pageSize={pageSize} total={rows.length} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(0) }} /> : undefined}
        />
      )}
      {isPhone && rows.length > pageSize && <Pagination page={page} pageSize={pageSize} total={rows.length} onPage={setPage} />}
    </div>
  )
}
