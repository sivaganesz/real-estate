/**
 * The list view (DESIGN_SYSTEM §11.7): the same deals in the data table, sortable by value, stage, days in stage,
 * prediction and follow-up. Each row has the "Move to…" menu, so every move the board allows works here too.
 */
import type { ReactNode } from 'react'
import { ArrowRightLeft, CalendarClock, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { StagePill } from '@/components/domain/lead-pills'
import { DataTable, type Column, type TableSort } from '@/components/shared/data-table'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { Lead, PipelineStageKey } from '@/domain/types'
import { usePermission } from '@/hooks/use-permission'
import { fmtDate, inrShort } from '@/lib/format'
import { stageTone, temperatureTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import type { DealItem, DealSort } from '../lib/pipeline'

export function PipelineList({ deals, stages, now, sort, onSort, onMove, onOpen, empty }: {
  deals: DealItem[]
  stages: PipelineStageKey[]
  now: Date
  sort: DealSort
  onSort: (key: string) => void
  onMove: (lead: Lead, to: PipelineStageKey) => void
  onOpen: (lead: Lead) => void
  empty: ReactNode
}) {
  const { t, i18n } = useTranslation(['pipeline', 'catalogue'])
  const { can } = usePermission()
  const nowIso = now.toISOString()
  const columns: Column<DealItem>[] = [
    {
      key: 'name', header: t('pipeline:list.client'), sortable: true,
      cell: (d) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn('size-2 shrink-0 rounded-full', temperatureTone[d.temperature].solid)} title={t(`catalogue:temperature.${d.temperature}`)} aria-hidden="true" />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{d.lead.name}</span>
            <span className="block truncate text-meta text-muted-foreground">{d.property?.title ?? d.lead.id}</span>
          </span>
          {d.stalled && <Sparkles className="size-3.5 shrink-0 text-ai" aria-label={t('pipeline:card.stalledShort')} />}
        </span>
      ),
    },
    { key: 'stage', header: t('pipeline:list.stage'), sortable: true, cell: (d) => <StagePill stage={d.lead.stage} /> },
    { key: 'value', header: t('pipeline:list.value'), sortable: true, align: 'right', cell: (d) => <span className="font-semibold tabular-nums">{d.value ? inrShort(d.value) : '—'}</span> },
    {
      key: 'owner', header: t('pipeline:list.owner'), hideBelow: 'lg',
      cell: (d) => d.owner ? <span className="flex items-center gap-2"><UserAvatar name={d.owner.name} size="xs" /><span className="truncate">{d.owner.name}</span></span> : <span className="text-warning">{t('pipeline:card.unassigned')}</span>,
    },
    {
      key: 'days', header: t('pipeline:list.days'), sortable: true, align: 'right',
      cell: (d) => (
        <span className={cn('tabular-nums', d.aging === 'danger' ? 'font-semibold text-danger' : d.aging === 'warning' ? 'text-warning' : 'text-muted-foreground')}>
          {d.aging === 'danger' ? t('pipeline:card.stalled', { count: d.days }) : t('pipeline:card.days', { count: d.days })}
        </span>
      ),
    },
    {
      key: 'followUp', header: t('pipeline:list.followUp'), sortable: true, hideBelow: 'md',
      cell: (d) => d.nextFollowUpAt
        ? <span className={cn('inline-flex items-center gap-1 tabular-nums', d.nextFollowUpAt < nowIso ? 'text-danger' : 'text-muted-foreground')}><CalendarClock className="size-3.5" aria-hidden="true" />{fmtDate(d.nextFollowUpAt, i18n.language)}</span>
        : <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'probability', header: t('pipeline:list.prediction'), sortable: true, align: 'right', hideBelow: 'md',
      cell: (d) => <span className="inline-flex items-center gap-1 font-semibold text-ai tabular-nums"><Sparkles className="size-3" aria-hidden="true" />{Math.round(d.probability * 100)}%</span>,
    },
  ]
  return (
    <DataTable
      rows={deals}
      columns={columns}
      rowKey={(d) => d.lead.id}
      label={t('pipeline:list.label')}
      onRowClick={(d) => onOpen(d.lead)}
      rowLabel={(d) => d.lead.name}
      sort={sort as TableSort}
      onSort={onSort}
      empty={empty}
      rowActions={(d) => can('lead.moveStage', d.lead) ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" onClick={(e) => e.stopPropagation()} aria-label={t('pipeline:move.menuFor', { name: d.lead.name })}>
              <ArrowRightLeft />{t('pipeline:move.button')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuLabel>{t('pipeline:move.title')}</DropdownMenuLabel>
            {stages.filter((s) => s !== d.lead.stage).map((s) => (
              <DropdownMenuItem key={s} onSelect={() => onMove(d.lead, s)}>
                <span aria-hidden="true" className={cn('size-2 rounded-full', stageTone[s].solid)} />
                {t(`catalogue:stage.${s}`)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    />
  )
}
