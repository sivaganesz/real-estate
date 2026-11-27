/**
 * /import/history — every finished import: file, kind, who, when, what happened to the rows, status. Search and
 * filters (kind, status); a row opens the job in a side panel with its mapping, its error rows (as CSV too), and links
 * to what it created. Removing a job from the history asks first and can be undone (the records stay).
 */
import { useMemo, useState } from 'react'
import { Download, ExternalLink, FileClock, Trash2, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { paths } from '@/app/paths'
import { EmptyImport } from '@/components/illustrations'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { DataTable, type Column } from '@/components/shared/data-table'
import { Drawer } from '@/components/shared/drawer'
import { EmptyState } from '@/components/shared/empty-state'
import { FilterBar } from '@/components/shared/filter-bar'
import { FilterPill } from '@/components/shared/filter-pill'
import { FilteredEmpty } from '@/components/shared/filtered-empty'
import { KeyValueGrid } from '@/components/shared/key-value-grid'
import { PageHeader } from '@/components/shared/page-header'
import { Pagination } from '@/components/shared/pagination'
import { ToneBadge } from '@/components/shared/badges'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import type { ImportJob } from '@/domain/types'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { fmtRelative } from '@/lib/dates'
import { fmtDateTime } from '@/lib/format'
import { removeImportJob } from '@/services/imports'
import { TONE } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { downloadFile } from '../lib/browser'
import { visibleJobs } from '../lib/stats'
import { JobCountsBar, JobStatusBadge } from '../components/job-bits'
import { COUNT_KEYS, COUNT_TONE, FILE_ICON, kindPermission } from '../lib/kinds'

const KINDS: ImportJob['kind'][] = ['leads', 'apartments', 'villas', 'plots', 'commercial', 'document']
const STATUSES: ImportJob['status'][] = ['completed', 'partial', 'failed', 'cancelled']

export default function ImportHistoryPage() {
  const { t, i18n } = useTranslation(['import', 'common'])
  const now = useNow()
  const user = useCurrentUser()
  const { can } = usePermission()
  const all = useDb((db) => db.importJobs)
  const users = useDb((db) => db.users)
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [kinds, setKinds] = useState<string[]>([])
  const [statuses, setStatuses] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(25)
  const [confirm, setConfirm] = useState<ImportJob | null>(null)
  const jobs = useMemo(() => visibleJobs(all, user.id, can('import.properties')).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [all, user.id, can])
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? t('import:someone')
  const list = jobs.filter((j) =>
    (!q.trim() || j.fileName.toLowerCase().includes(q.trim().toLowerCase()) || nameOf(j.createdBy).toLowerCase().includes(q.trim().toLowerCase()))
    && (!kinds.length || kinds.includes(j.kind)) && (!statuses.length || statuses.includes(j.status)))
  const pages = Math.max(1, Math.ceil(list.length / size))
  const shown = list.slice((Math.min(page, pages) - 1) * size, Math.min(page, pages) * size)
  const openId = params.get('job')
  const open = jobs.find((j) => j.id === openId) ?? null
  const active = (kinds.length ? 1 : 0) + (statuses.length ? 1 : 0) + (q ? 1 : 0)
  const clear = () => { setQ(''); setKinds([]); setStatuses([]); setPage(1) }

  const columns: Column<ImportJob>[] = [
    {
      key: 'file', header: t('import:history.col.file'), cell: (j) => {
        const Icon = FILE_ICON[j.fileType]
        return (
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><Icon className="size-4" aria-hidden="true" /></span>
            <span className="min-w-0">
              <span className="block max-w-64 truncate font-medium">{j.fileName}</span>
              <span className="text-meta text-muted-foreground">{t(`import:kind.${j.kind}.short`)} · {t(`import:template.kind.${j.template}`)}</span>
            </span>
          </span>
        )
      },
    },
    { key: 'by', header: t('import:history.col.by'), hideBelow: 'lg', cell: (j) => <span className="flex items-center gap-2"><UserAvatar name={nameOf(j.createdBy)} size="xs" /><span className="truncate">{nameOf(j.createdBy)}</span></span> },
    { key: 'when', header: t('import:history.col.when'), hideBelow: 'md', cell: (j) => <span className="whitespace-nowrap text-muted-foreground" title={fmtDateTime(j.createdAt, i18n.language)}>{fmtRelative(j.createdAt, now, i18n.language)}</span> },
    { key: 'rows', header: t('import:history.col.rows'), hideBelow: 'md', width: 'w-56', cell: (j) => <JobCountsBar counts={j.counts} /> },
    { key: 'status', header: t('import:history.col.status'), cell: (j) => <JobStatusBadge status={j.status} /> },
  ]

  const doRemove = (j: ImportJob) => {
    try {
      const { undoToken } = removeImportJob(j.id)
      setParams({})
      toastUndo(t('import:history.removed', { file: j.fileName }), undoToken)
    } catch (e) { toastError(e) }
  }
  const errorsCsv = (j: ImportJob) => {
    const lines = ['Row,Problems', ...j.errorRows.map((r) => `${r.row},"${r.messages.map((m) => t(`import:issue.${m}`, { value: '' })).join('; ').replace(/"/g, '""')}"`)]
    const name = `${j.fileName.replace(/\.[^.]+$/, '')}-errors.csv`
    downloadFile(name, `﻿${lines.join('\r\n')}\r\n`, 'text/csv;charset=utf-8')
    toast.success(t('import:template.downloaded', { file: name }))
  }

  return (
    <div className="flex flex-col gap-6" data-testid="import-history">
      <PageHeader
        eyebrow={<Link to={paths.import()} className="hover:text-foreground">{t('import:title')}</Link>}
        title={t('import:history.title')} subtitle={t('import:history.subtitle')}
        actions={<Button asChild><Link to={paths.import()}><Upload />{t('import:history.newImport')}</Link></Button>}
      />
      {jobs.length === 0 ? (
        <section className="rounded-lg border bg-card shadow-card">
          <EmptyState illustration={EmptyImport} title={t('import:history.emptyTitle')} body={t('import:history.emptyBody')}
            primary={<Button asChild><Link to={paths.import()}><Upload />{t('import:history.newImport')}</Link></Button>} />
        </section>
      ) : (
        <>
          <FilterBar
            search={q} onSearch={(v) => { setQ(v); setPage(1) }} placeholder={t('import:history.search')} activeCount={active} onClearAll={clear}
            filters={(
              <>
                <FilterPill label={t('import:history.kind')} options={KINDS.map((k) => ({ value: k, label: t(`import:kind.${k}.short`), count: jobs.filter((j) => j.kind === k).length }))} selected={kinds} onChange={(v) => { setKinds(v); setPage(1) }} />
                <FilterPill label={t('import:history.status')} options={STATUSES.map((s) => ({ value: s, label: t(`import:jobStatus.${s}`), count: jobs.filter((j) => j.status === s).length }))} selected={statuses} onChange={(v) => { setStatuses(v); setPage(1) }} />
              </>
            )}
          />
          <DataTable
            rows={shown} columns={columns} rowKey={(j) => j.id} label={t('import:history.title')} onRowClick={(j) => setParams({ job: j.id })}
            rowLabel={(j) => j.fileName}
            empty={<FilteredEmpty onClear={clear} title={t('import:history.filteredTitle')} />}
            footer={list.length > 10 ? <Pagination page={Math.min(page, pages) - 1} pageSize={size} total={list.length} onPage={(p) => setPage(p + 1)} onPageSize={(n) => { setSize(n); setPage(1) }} /> : undefined}
          />
        </>
      )}

      <Drawer
        open={!!open} onOpenChange={(o) => { if (!o) setParams({}) }} size="lg"
        title={open?.fileName ?? ''} subtitle={open ? `${t(`import:kind.${open.kind}.short`)} · ${fmtDateTime(open.createdAt, i18n.language)}` : undefined}
        footer={open && (
          <div className="flex flex-wrap justify-between gap-2">
            {can(kindPermission(open.kind)) && <Button variant="ghost" className="text-danger" onClick={() => setConfirm(open)} data-testid="remove-job"><Trash2 />{t('import:history.remove')}</Button>}
            <Button variant="secondary" onClick={() => setParams({})}>{t('common:actions.close')}</Button>
          </div>
        )}
      >
        {open && (
          <div className="flex flex-col gap-6" data-testid="job-drawer">
            <div className="flex flex-wrap items-center gap-2">
              <JobStatusBadge status={open.status} />
              <ToneBadge tone="neutral">{t(`import:template.kind.${open.template}`)}</ToneBadge>
              <span className="flex items-center gap-1.5 text-meta text-muted-foreground"><UserAvatar name={nameOf(open.createdBy)} size="xs" />{nameOf(open.createdBy)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {(['total', ...COUNT_KEYS, 'skipped'] as const).filter((k, i, a) => a.indexOf(k) === i).map((k) => (
                <div key={k} className="rounded-md border bg-card px-2.5 py-2">
                  <span className="block text-lg font-semibold tabular-nums">{open.counts[k]}</span>
                  <span className="text-caption text-muted-foreground">{t(`import:done.tile.${k}`)}</span>
                  {k !== 'total' && k !== 'skipped' && <span className={cn('mt-1 block h-0.5 w-6 rounded-full', TONE[COUNT_TONE[k]].solid)} aria-hidden="true" />}
                </div>
              ))}
            </div>
            {(open.createdIds.length > 0 || open.draftIds.length > 0) && (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">{t('import:history.created')}</h3>
                <ul className="flex flex-wrap gap-1.5">
                  {open.createdIds.slice(0, 24).map((id) => (
                    <li key={id}><Link to={id.startsWith('LEAD') ? paths.lead(id) : paths.property(id)} className="inline-flex items-center gap-1 rounded-xs bg-muted px-1.5 py-0.5 text-meta hover:bg-primary-soft hover:text-primary"><ExternalLink className="size-3" aria-hidden="true" />{id}</Link></li>
                  ))}
                  {open.createdIds.length > 24 && <li className="text-meta text-muted-foreground">{t('import:history.more', { count: open.createdIds.length - 24 })}</li>}
                  {open.draftIds.map((id) => (
                    <li key={id}><Link to={paths.draft(id)} className="inline-flex items-center gap-1 rounded-xs bg-ai-soft px-1.5 py-0.5 text-meta text-ai"><FileClock className="size-3" aria-hidden="true" />{id}</Link></li>
                  ))}
                </ul>
              </section>
            )}
            {open.mapping && open.mapping.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">{t('import:history.mapping')}</h3>
                <KeyValueGrid columns={2} items={open.mapping.map((m) => ({
                  key: m.column, label: m.column,
                  value: m.field ? <span className="flex items-center gap-1.5">{t(`import:field.${m.field}`)}<span className="text-meta text-muted-foreground tabular-nums">{Math.round(m.confidence * 100)}%</span></span> : <span className="text-muted-foreground">{t('import:history.notMapped')}</span>,
                }))} />
              </section>
            )}
            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{t('import:history.errorRows', { count: open.errorRows.length })}</h3>
                {open.errorRows.length > 0 && <Button size="sm" variant="secondary" onClick={() => errorsCsv(open)}><Download />{t('import:history.errorsCsv')}</Button>}
              </div>
              {open.errorRows.length === 0 ? <p className="text-meta text-muted-foreground">{t('import:history.noErrors')}</p> : (
                <ul className="flex flex-col gap-1">
                  {open.errorRows.map((r) => (
                    <li key={r.row} className="flex gap-2 rounded-md bg-danger-soft/60 px-2.5 py-1.5 text-meta">
                      <span className="w-12 shrink-0 font-medium tabular-nums">#{r.row}</span>
                      <span>{r.messages.map((m) => t(`import:issue.${m}`, { value: '' })).join(' · ')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null) }} tone="danger"
        title={t('import:history.removeTitle', { file: confirm?.fileName ?? '' })} description={t('import:history.removeBody')}
        confirmLabel={t('import:history.remove')} onConfirm={() => { if (confirm) doRemove(confirm); setConfirm(null) }}
      />
    </div>
  )
}
