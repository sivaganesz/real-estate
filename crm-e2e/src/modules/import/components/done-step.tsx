/**
 * Step 4, Done (master prompt §15.1 "import summary"): what happened to every row (counts and a donut), who the new
 * leads went to (auto-assignment, E16), links to the records and drafts, the rows not imported as a CSV with a Problems
 * column, Undo for 10 s, and Import another file.
 */
import { useMemo } from 'react'
import { ArrowRight, CircleCheck, Download, FileClock, History, RotateCcw, Undo2, Upload, UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { paths } from '@/app/paths'
import { EmptyImport } from '@/components/illustrations'
import { DonutChart } from '@/components/shared/charts/donut-chart'
import { EmptyState } from '@/components/shared/empty-state'
import { SectionCard } from '@/components/shared/section-card'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import { useDb } from '@/hooks/use-db'
import { canUndo, undo } from '@/services/core/undo'
import { TONE } from '@/lib/tones'
import { cn } from '@/lib/utils'
import type { SheetKind } from '../lib/fields'
import { failedRowsCsv } from '../lib/plan'
import type { Table } from '../lib/sheet'
import { cellText } from '../lib/values'
import { downloadFile } from '../lib/browser'
import { COUNT_TONE } from '../lib/kinds'
import type { ImportResult } from './sheet-wizard'

export function DoneStep({ kind, result, table, fileName, onAgain }: { kind: SheetKind; result: ImportResult; table: Table; fileName: string; onAgain: () => void }) {
  const { t } = useTranslation(['import', 'common', 'ui'])
  const job = useDb((db) => db.importJobs.find((j) => j.id === result.jobId))
  const leads = useDb((db) => db.leads)
  const users = useDb((db) => db.users)
  const autoAssign = useDb((db) => db.settings.assignment.autoAssign)
  const owners = useMemo(() => {
    if (kind !== 'leads' || !job) return []
    const map = new Map<string, number>()
    for (const l of leads) if (l.importJobId === job.id) map.set(l.ownerId ?? '', (map.get(l.ownerId ?? '') ?? 0) + 1)
    return [...map.entries()].map(([id, count]) => ({ id, count, name: users.find((u) => u.id === id)?.name })).sort((a, b) => b.count - a.count)
  }, [kind, job, leads, users])

  if (!job) {
    return (
      <section className="rounded-lg border bg-card shadow-card">
        <EmptyState illustration={EmptyImport} title={t('import:done.undoneTitle')} body={t('import:done.undoneBody')}
          primary={<Button onClick={onAgain}><RotateCcw />{t('import:done.again')}</Button>} />
      </section>
    )
  }

  const c = job.counts
  const tiles = [
    { key: 'imported', value: c.imported }, { key: 'updated', value: c.updated }, { key: 'drafts', value: c.drafts },
    { key: 'skipped', value: c.skipped }, { key: 'errors', value: c.errors },
  ] as const
  const donut = (['imported', 'updated', 'drafts', 'duplicates', 'errors'] as const)
    .map((k) => ({ key: k, label: t(`import:done.tile.${k}`), value: k === 'duplicates' ? result.plan.failed.filter((f) => f.reason === 'duplicate').length : c[k], color: `var(--${COUNT_TONE[k]})` }))
    .filter((d) => d.value > 0)
  const failed = result.plan.failed
  // nobody got the batch (auto-assignment off, or no executive could take it): the leads wait in the unassigned queue
  const waiting = owners.find((o) => !o.id)?.count ?? 0
  const queued = waiting > 0 && owners.every((o) => !o.id)

  const downloadFailed = () => {
    const cells = new Map(table.rows.map((r) => [r.rowNumber, r.cells.map(cellText)]))
    const csv = failedRowsCsv(table.headers, cells, failed, (i) => `${t(`import:field.${i.field}`)}: ${t(`import:issue.${i.key}`, i.params ?? {})}`, (r) => t(`import:done.reason.${r}`))
    const name = `${fileName.replace(/\.[^.]+$/, '')}-not-imported.csv`
    downloadFile(name, `﻿${csv}`, 'text/csv;charset=utf-8')
    toast.success(t('import:template.downloaded', { file: name }))
  }
  const doUndo = () => {
    if (undo(result.undoToken)) toast(t('ui:undo.done'))
    else toast.error(t('ui:undo.expired'))
  }

  return (
    <div className="flex flex-col gap-4" data-testid="done-step">
      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-card md:flex-row md:items-center">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-success-soft text-success"><CircleCheck className="size-6" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold" data-testid="done-title">{t('import:done.title', { count: c.imported + c.updated })}</h2>
          <p className="text-sm text-muted-foreground">{t('import:done.body', { file: fileName, total: c.total })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canUndo(result.undoToken) && <Button variant="ghost" onClick={doUndo}><Undo2 />{t('import:done.undo')}</Button>}
          <Button variant="secondary" onClick={onAgain}><Upload />{t('import:done.again')}</Button>
          <Button asChild><Link to={kind === 'leads' ? paths.leads() : paths.properties()}>{t(kind === 'leads' ? 'import:done.viewLeads' : 'import:done.viewProps')}<ArrowRight /></Link></Button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-7 lg:grid-cols-3">
          {tiles.map((tile) => (
            <div key={tile.key} className="rounded-lg border bg-card p-4 shadow-card" data-testid={`done-${tile.key}`}>
              <span className={cn('mb-2 block h-1 w-8 rounded-full', TONE[tile.key === 'skipped' ? 'neutral' : COUNT_TONE[tile.key]].solid)} aria-hidden="true" />
              <span className="block text-kpi font-[650] tabular-nums">{tile.value}</span>
              <span className="text-meta text-muted-foreground">{t(`import:done.tile.${tile.key}`)}</span>
            </div>
          ))}
          <div className="col-span-full flex flex-wrap items-center gap-2 rounded-lg border bg-card p-4 shadow-card">
            <span className="mr-auto text-sm font-medium">{t('import:done.next')}</span>
            {c.drafts > 0 && <Button asChild size="sm" variant="ai"><Link to={paths.drafts()}><FileClock />{t('import:done.reviewDrafts', { count: c.drafts })}</Link></Button>}
            {failed.length > 0 && <Button size="sm" variant="secondary" onClick={downloadFailed} data-testid="download-failed"><Download />{t('import:done.failedCsv', { count: failed.length })}</Button>}
            <Button asChild size="sm" variant="ghost"><Link to={`${paths.importHistory()}?job=${job.id}`}><History />{t('import:done.history')}</Link></Button>
          </div>
        </div>
        <SectionCard className="lg:col-span-5" title={t('import:done.chartTitle')}>
          <DonutChart data={donut} centerLabel={t('import:done.rows')} centerValue={String(c.total)} label={t('import:done.chartTitle')} height={180} />
        </SectionCard>
      </div>

      {kind === 'leads' && owners.length > 0 && (
        <SectionCard
          title={t(queued ? 'import:done.queueTitle' : 'import:done.assignedTitle')}
          description={queued ? t(autoAssign ? 'import:done.queueBodyNoOne' : 'import:done.queueBody', { count: waiting }) : t('import:done.assignedBody')}
          action={waiting > 0 && <Button asChild size="sm" variant="secondary"><Link to={paths.leads({ tab: 'unassigned' })} data-testid="done-assign-now"><UserPlus />{t('import:done.assignNow')}</Link></Button>}
        >
          <ul className="flex flex-wrap gap-2" data-testid="done-owners">
            {owners.map((o) => (
              <li key={o.id || 'none'} className="flex items-center gap-2 rounded-full border bg-card py-1 pr-3 pl-1">
                {o.name ? <UserAvatar name={o.name} size="sm" /> : <span className="flex size-8 items-center justify-center rounded-full bg-warning-soft text-meta text-warning">?</span>}
                <span className="text-sm">{o.name ?? t('import:done.unassigned')}</span>
                <span className="rounded-full bg-muted px-1.5 text-meta tabular-nums">{o.count}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  )
}
