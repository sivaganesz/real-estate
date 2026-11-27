/**
 * Step 3, Check (master prompt §15.1: validation → duplicate detection → row-level errors with inline fixing):
 * status tabs with counts, "set for all" for gaps shared by several rows, one line per row with its problems, an inline
 * fix form that re-checks the row, Skip / Include, the duplicate's link, then the import options and Import (confirmed).
 */
import { useMemo, useState } from 'react'
import { CircleAlert, CircleCheck, Copy, FileClock, Link2, ListChecks, PencilLine, RotateCcw, SkipForward, TriangleAlert, Undo2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { paths } from '@/app/paths'
import { NoResults } from '@/components/illustrations'
import { Callout } from '@/components/shared/callout'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { Pagination } from '@/components/shared/pagination'
import { SectionCard } from '@/components/shared/section-card'
import { Segmented } from '@/components/shared/segmented'
import { ToneBadge } from '@/components/shared/badges'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { useDb } from '@/hooks/use-db'
import { inrShort } from '@/lib/format'
import { phoneDisplay } from '@/lib/phone'
import { TONE, type Tone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import type { SheetKind } from '../lib/fields'
import { commonGaps, statusCounts, type EvaluatedRow, type RowStatus } from '../lib/rows'
import { RecordForm } from './record-form'
import { DefaultInput } from './wizard-bits'

type Filter = 'all' | RowStatus | 'skipped'
const ROW_TONE: Record<RowStatus, Tone> = { ready: 'success', draft: 'ai', duplicate: 'warning', error: 'danger' }
const ROW_ICON = { ready: CircleCheck, draft: FileClock, duplicate: Copy, error: CircleAlert } as const

export function CheckStep({ kind, rows, skipped, setSkipped, onFix, onSetAll, onBack, onImport }: {
  kind: SheetKind
  rows: EvaluatedRow[]
  skipped: Set<number>
  setSkipped: (s: Set<number>) => void
  onFix: (row: number, values: Record<string, string>) => void
  onSetAll: (field: string, value: string, rows: number[]) => void
  onBack: () => void
  onImport: (o: { duplicates: 'skip' | 'update'; publish: boolean }) => void
}) {
  const { t } = useTranslation(['import', 'common'])
  const autoAssign = useDb((db) => db.settings.assignment.autoAssign)
  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(25)
  const [open, setOpen] = useState<number | null>(null)
  const [duplicates, setDuplicates] = useState<'skip' | 'update'>('skip')
  const [publish, setPublish] = useState(true)
  const [confirm, setConfirm] = useState(false)
  const [gapValues, setGapValues] = useState<Record<string, string>>({})
  const counts = statusCounts(rows, skipped)
  const gaps = useMemo(() => commonGaps(rows, skipped).slice(0, 3), [rows, skipped])
  const list = rows.filter((r) => (filter === 'all' ? true : filter === 'skipped' ? skipped.has(r.rowNumber) : !skipped.has(r.rowNumber) && r.status === filter))
  const pages = Math.max(1, Math.ceil(list.length / size))
  const shown = list.slice((Math.min(page, pages) - 1) * size, Math.min(page, pages) * size)
  const crmDupes = rows.filter((r) => !skipped.has(r.rowNumber) && r.status === 'duplicate' && r.duplicate?.kind !== 'row').length
  const toImport = counts.ready + counts.draft + (duplicates === 'update' ? crmDupes : 0)
  const isLeads = kind === 'leads'

  const toggleSkip = (n: number) => {
    const next = new Set(skipped)
    if (next.has(n)) next.delete(n)
    else next.add(n)
    setSkipped(next)
  }

  const segments = (['all', 'ready', 'draft', 'duplicate', 'error', 'skipped'] as const).map((v) => ({
    value: v as Filter, label: t(`check.tab.${v}`), count: v === 'all' ? counts.total : counts[v],
  }))

  return (
    <div className="flex flex-col gap-4" data-testid="check-step">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(['ready', 'draft', 'duplicate', 'error'] as const).map((s) => {
          const Icon = ROW_ICON[s]
          return (
            <button
              key={s} type="button" onClick={() => { setFilter(s); setPage(1) }} aria-pressed={filter === s}
              className={cn('flex items-center gap-3 rounded-lg border bg-card p-3 text-left shadow-card transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none', filter === s && 'ring-2 ring-primary')}
              data-testid={`count-${s}`}
            >
              <span className={cn('flex size-9 items-center justify-center rounded-md', TONE[ROW_TONE[s]].soft, TONE[ROW_TONE[s]].text)}><Icon className="size-4.5" aria-hidden="true" /></span>
              <span>
                <span className="block text-kpi leading-none font-[650] tabular-nums">{counts[s]}</span>
                <span className="text-meta text-muted-foreground">{t(`check.count.${s}`)}</span>
              </span>
            </button>
          )
        })}
      </div>

      {gaps.length > 0 && (
        <SectionCard icon={ListChecks} title={t('check.gapsTitle')} description={t('check.gapsBody')}>
          <ul className="flex flex-col gap-3">
            {gaps.map((g) => (
              <li key={g.field} className="flex flex-wrap items-end gap-3 rounded-md bg-muted/50 p-3">
                <p className="min-w-48 flex-1 text-sm">
                  <span className="font-medium">{t('check.gapRows', { count: g.rows.length })}</span>{' '}
                  {t(`issue.${g.key}`, { value: '' })}
                </p>
                <DefaultInput compact field={g.field} value={gapValues[g.field] ?? ''} onChange={(v) => setGapValues((x) => ({ ...x, [g.field]: v }))} />
                <Button type="button" variant="secondary" size="sm" disabled={!gapValues[g.field]?.trim()} onClick={() => onSetAll(g.field, gapValues[g.field], g.rows)} data-testid={`set-all-${g.field}`}>
                  {t('check.setAll', { count: g.rows.length })}
                </Button>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <div className="rounded-lg border bg-card shadow-card">
        <div className="overflow-x-auto border-b px-2 pt-1 [scrollbar-width:none]">
          <Segmented value={filter} onChange={(v) => { setFilter(v); setPage(1) }} segments={segments} label={t('check.filterLabel')} />
        </div>
        {shown.length === 0 ? (
          <EmptyState compact illustration={NoResults} title={t('check.emptyTitle')} body={t('check.emptyBody')}
            primary={filter !== 'all' ? <Button variant="secondary" onClick={() => setFilter('all')}>{t('check.showAll')}</Button> : undefined} />
        ) : (
          <ul className="divide-y divide-border/70" data-testid="check-rows">
            {shown.map((r) => (
              <RowLine key={r.rowNumber} row={r} kind={kind} skipped={skipped.has(r.rowNumber)} open={open === r.rowNumber}
                onToggle={() => setOpen(open === r.rowNumber ? null : r.rowNumber)} onSkip={() => toggleSkip(r.rowNumber)}
                onFix={(values) => { onFix(r.rowNumber, values); setOpen(null) }} />
            ))}
          </ul>
        )}
        {list.length > 10 && (
          <div className="border-t px-4 py-2.5">
            <Pagination page={Math.min(page, pages) - 1} pageSize={size} total={list.length} onPage={(p) => setPage(p + 1)} onPageSize={(n) => { setSize(n); setPage(1) }} />
          </div>
        )}
      </div>

      <SectionCard title={t('check.optionsTitle')}>
        <div className="grid gap-5 md:grid-cols-2">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t('check.dupTitle', { count: counts.duplicate })}</legend>
            <RadioGroup value={duplicates} onValueChange={(v) => setDuplicates(v as 'skip' | 'update')}>
              {(['skip', 'update'] as const).map((v) => (
                <div key={v} className="flex items-start gap-2">
                  <RadioGroupItem id={`dup-${v}`} value={v} className="mt-0.5" />
                  <Label htmlFor={`dup-${v}`} className="flex flex-col items-start gap-0.5 font-normal">
                    <span className="text-sm font-medium">{t(`check.dup.${v}`)}</span>
                    <span className="text-meta text-muted-foreground">{t(`check.dupHint.${v}`)}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </fieldset>
          {isLeads ? (
            <Callout tone={autoAssign ? 'info' : 'warning'} title={t(autoAssign ? 'check.autoAssignOn' : 'check.autoAssignOff')}>
              {t(autoAssign ? 'check.autoAssignOnBody' : 'check.autoAssignOffBody')}
            </Callout>
          ) : (
            <div className="flex items-start gap-3">
              <Switch id="publish" checked={publish} onCheckedChange={setPublish} />
              <Label htmlFor="publish" className="flex flex-col items-start gap-0.5 font-normal">
                <span className="text-sm font-medium">{t('check.publish')}</span>
                <span className="text-meta text-muted-foreground">{t(publish ? 'check.publishOn' : 'check.publishOff')}</span>
              </Label>
            </div>
          )}
        </div>
        {counts.error > 0 && <Callout className="mt-4" tone="warning">{t('check.errorsLeft', { count: counts.error })}</Callout>}
      </SectionCard>

      <div className="sticky bottom-20 z-10 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-popover/95 p-3 shadow-lg backdrop-blur mr-14 md:bottom-4 md:mr-16">
        <Button type="button" variant="ghost" onClick={onBack}><Undo2 />{t('nav.backColumns')}</Button>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-meta text-muted-foreground max-sm:hidden">{t('check.footer', { ready: counts.ready, drafts: counts.draft, left: counts.error + counts.skipped })}</span>
          <Button type="button" onClick={() => setConfirm(true)} disabled={toImport === 0} data-testid="import-confirm">{t('check.import', { count: toImport })}</Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirm} onOpenChange={setConfirm} title={t('check.confirmTitle', { count: toImport })}
        description={t(isLeads ? 'check.confirmBodyLeads' : 'check.confirmBodyProps')}
        confirmLabel={t('check.import', { count: toImport })}
        onConfirm={() => { setConfirm(false); onImport({ duplicates, publish }) }}
      >
        <ul className="grid grid-cols-2 gap-2 text-sm">
          <li className="rounded-md bg-success-soft px-3 py-2"><b className="tabular-nums">{counts.ready}</b> {t('check.count.ready')}</li>
          <li className="rounded-md bg-ai-soft px-3 py-2"><b className="tabular-nums">{counts.draft}</b> {t('check.willDraft')}</li>
          <li className="rounded-md bg-warning-soft px-3 py-2"><b className="tabular-nums">{counts.duplicate}</b> {t(duplicates === 'update' ? 'check.willUpdate' : 'check.willSkipDup')}</li>
          <li className="rounded-md bg-muted px-3 py-2"><b className="tabular-nums">{counts.error + counts.skipped}</b> {t('check.willLeave')}</li>
        </ul>
      </ConfirmDialog>
    </div>
  )
}

function summary(r: EvaluatedRow, kind: SheetKind): string[] {
  if (kind === 'leads' && r.lead) {
    const q = r.lead.requirement
    return [r.lead.phone ? phoneDisplay(r.lead.phone) : r.values.phone ?? '', q?.configurations.join(', ') ?? '', [q?.localities[0], q?.cities[0]].filter(Boolean).join(', '), q?.budgetMax ? inrShort(q.budgetMax) : ''].filter(Boolean)
  }
  const p = r.property
  if (!p) return []
  const sqft = p.area.superBuiltUp ?? p.area.builtUp ?? p.area.carpet ?? p.area.plot
  return [p.price ? inrShort(p.price) : '', sqft ? `${sqft.toLocaleString('en-IN')} ${p.area.plot && sqft === p.area.plot ? p.area.plotUnit ?? 'sqft' : 'sq ft'}` : '', [p.location.locality, p.location.city].filter(Boolean).join(', ')].filter(Boolean)
}

function RowLine({ row, kind, skipped, open, onToggle, onSkip, onFix }: {
  row: EvaluatedRow; kind: SheetKind; skipped: boolean; open: boolean; onToggle: () => void; onSkip: () => void; onFix: (v: Record<string, string>) => void
}) {
  const { t } = useTranslation('import')
  const [values, setValues] = useState<Record<string, string>>({})
  const problems = row.issues.filter((i) => i.level !== 'warning')
  const warnings = row.issues.filter((i) => i.level === 'warning')
  const fixFields = [...new Set(problems.map((i) => (i.field === 'area.any' ? (kind === 'plots' ? 'area.plot' : kind === 'villas' ? 'area.builtUp' : 'area.carpet') : i.field)))]
  const Icon = ROW_ICON[row.status]
  const d = row.duplicate
  const recordKind = kind === 'leads' ? 'lead' : 'property'
  const fixable = fixFields.length > 0
  return (
    <li className={cn('px-4 py-3 md:px-5', skipped && 'opacity-60')} data-testid={`row-${row.rowNumber}`} data-status={row.status}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <span className="w-10 shrink-0 pt-0.5 text-meta text-muted-foreground tabular-nums">#{row.rowNumber}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{row.label || t('check.noName')}</span>
            {skipped ? <ToneBadge tone="neutral" icon={SkipForward}>{t('check.skippedBadge')}</ToneBadge>
              : <ToneBadge tone={ROW_TONE[row.status]} icon={Icon}>{t(`check.status.${row.status}`)}</ToneBadge>}
          </div>
          <p className="mt-0.5 truncate text-meta text-muted-foreground tabular-nums">{summary(row, kind).join(' · ')}</p>
          {(problems.length > 0 || warnings.length > 0 || d) && (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {problems.map((i, n) => (
                <li key={`p${n}`} className={cn('inline-flex items-center gap-1 rounded-xs px-1.5 py-0.5 text-meta', i.level === 'error' ? 'bg-danger-soft text-danger' : 'bg-ai-soft text-ai')}>
                  <CircleAlert className="size-3" aria-hidden="true" />{t(`field.${i.field}`)}: {t(`issue.${i.key}`, i.params ?? {})}
                </li>
              ))}
              {warnings.map((i, n) => (
                <li key={`w${n}`} className="inline-flex items-center gap-1 rounded-xs bg-warning-soft px-1.5 py-0.5 text-meta text-warning">
                  <TriangleAlert className="size-3" aria-hidden="true" />{t(`issue.${i.key}`, i.params ?? {})}
                </li>
              ))}
              {d && (
                <li className="inline-flex items-center gap-1 rounded-xs bg-warning-soft px-1.5 py-0.5 text-meta text-warning">
                  <Link2 className="size-3" aria-hidden="true" />
                  {d.kind === 'row' ? t('check.sameAsRow', { row: d.row, by: t(`check.by.${d.by}`) }) : (
                    <>
                      {t('check.alreadyIn', { by: t(`check.by.${d.by}`) })}{' '}
                      <Link to={d.kind === 'lead' ? paths.lead(d.id) : paths.property(d.id)} className="font-semibold underline underline-offset-2">{d.name}</Link>
                    </>
                  )}
                </li>
              )}
            </ul>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 max-sm:order-last max-sm:w-full max-sm:justify-end">
          {fixable && !skipped && (
            <Button type="button" size="sm" variant={open ? 'secondary' : 'ghost'} onClick={() => { setValues({}); onToggle() }} aria-expanded={open} data-testid={`fix-${row.rowNumber}`}>
              <PencilLine />{t('check.fix')}
            </Button>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={onSkip} data-testid={`skip-${row.rowNumber}`}>
            {skipped ? <><RotateCcw />{t('check.include')}</> : <><SkipForward />{t('check.skip')}</>}
          </Button>
        </div>
      </div>
      {open && fixable && (
        <form
          className="mt-3 ml-0 rounded-lg border border-dashed bg-muted/30 p-3 sm:ml-13"
          onSubmit={(e) => { e.preventDefault(); onFix(values) }}
        >
          <RecordForm
            kind={recordKind} fields={fixFields} values={{ ...row.values, ...values }} issues={problems} meta={row.meta}
            onChange={(f, v) => setValues((x) => ({ ...x, [f]: v }))} idPrefix={`fix-${row.rowNumber}`}
          />
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onToggle}>{t('common:actions.cancel')}</Button>
            <Button type="submit" size="sm" disabled={!Object.keys(values).length} data-testid={`recheck-${row.rowNumber}`}>{t('check.recheck')}</Button>
          </div>
        </form>
      )}
    </li>
  )
}
