/**
 * The Leads table (DESIGN_SYSTEM §11.7): lead, stage, temperature + score ring, priority, budget, location, source,
 * executive, next follow-up and aging, with sortable headers, selection for bulk actions and a hover action cluster
 * (Call · WhatsApp · Log · More) that never pushes layout. On phones the rows become stacked lead cards.
 */
import { ClipboardList } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { paths } from '@/app/paths'
import { ContactActions } from '@/components/domain/contact-actions'
import { LeadCard } from '@/components/domain/lead-card'
import { AgingBadge, PriorityPill, SourcePill, StagePill, TemperaturePill } from '@/components/domain/lead-pills'
import { DataTable, type Column, type Density, type TableSort } from '@/components/shared/data-table'
import { ScoreRing } from '@/components/shared/progress-ring'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useIsPhone } from '@/hooks/use-media-query'
import { usePermission } from '@/hooks/use-permission'
import { fmtDate, fmtTime, inrRange } from '@/lib/format'
import { phoneDisplay } from '@/lib/phone'
import { localDay } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'
import { LeadActionsMenu } from './lead-actions-menu'
import { useLeadDialogs } from './lead-dialogs-context'
import type { LeadRow } from './use-lead-items'

export function LeadsTable({ rows, sort, onSort, selected, onSelectedChange, density, hidden, empty, footer, now }: {
  rows: LeadRow[]
  sort: TableSort
  onSort: (key: string) => void
  selected: ReadonlySet<string>
  onSelectedChange?: (s: Set<string>) => void
  density: Density
  hidden: ReadonlySet<string>
  empty: ReactNode
  footer?: ReactNode
  now: Date
}) {
  const { t, i18n } = useTranslation(['leads', 'domain'])
  const navigate = useNavigate()
  const isPhone = useIsPhone()
  const { scope, can } = usePermission()
  const dialogs = useLeadDialogs()
  const today = localDay(now)

  if (isPhone) {
    if (!rows.length) return <div className="rounded-lg border bg-card shadow-card">{empty}</div>
    return (
      <div className="flex flex-col gap-2">
        <ul className="flex flex-col gap-2" aria-label={t('leads:list.label')}>
          {rows.map((r) => (
            <li key={r.lead.id} className="flex items-center gap-2">
              {onSelectedChange && (
                <Checkbox
                  checked={selected.has(r.lead.id)} aria-label={t('leads:list.select', { name: r.lead.name })}
                  onCheckedChange={(v) => { const s = new Set(selected); if (v === true) s.add(r.lead.id); else s.delete(r.lead.id); onSelectedChange(s) }}
                />
              )}
              <LeadCard compact lead={r.lead} className="min-w-0 flex-1" />
            </li>
          ))}
        </ul>
        {footer}
      </div>
    )
  }

  // below 2xl the aging badge sits under the follow-up instead of in its own column, so the table fits a 1440 screen
  const followUp = (r: LeadRow) => (
    <span className="flex flex-col items-start gap-1">
      {followUpText(r)}
      {!hidden.has('aging') && <AgingBadge aging={r.aging} className="2xl:hidden" />}
    </span>
  )
  const followUpText = (r: LeadRow) => {
    if (!r.nextFollowUpAt) return <span className="text-meta text-muted-foreground">{t('leads:list.noFollowUp')}</span>
    const overdue = r.nextFollowUpAt < now.toISOString()
    const isToday = localDay(r.nextFollowUpAt) === today
    return (
      <span className={cn('text-meta tabular-nums', overdue ? 'font-medium text-danger' : isToday ? 'font-medium text-warning' : 'text-muted-foreground')}>
        {overdue ? t('leads:list.overdueSince', { date: fmtDate(r.nextFollowUpAt, i18n.language) }) : isToday ? t('leads:list.todayAt', { time: fmtTime(r.nextFollowUpAt, i18n.language) }) : fmtDate(r.nextFollowUpAt, i18n.language)}
      </span>
    )
  }

  const columns: Column<LeadRow>[] = [
    {
      key: 'name', header: t('leads:col.lead'), sortable: true, className: 'min-w-56',
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <UserAvatar name={r.lead.name} size="sm" />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate font-semibold">
              {r.lead.name}
              {r.lead.isNri && <span className="rounded-full bg-info-soft px-1.5 text-micro font-semibold text-info">{t('domain:lead.nri')}</span>}
            </p>
            <p className="truncate text-meta text-muted-foreground tabular-nums">{r.lead.id} · {phoneDisplay(r.lead.phone) || r.lead.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'stage', header: t('leads:col.stage'), cell: (r) => <StagePill stage={r.lead.stage} /> },
    {
      key: 'score', header: t('leads:col.score'), sortable: true,
      cell: (r) => (
        <span className="flex items-center gap-2">
          <ScoreRing score={r.score} size={32} label={t('domain:lead.score')} />
          <TemperaturePill value={r.temperature} />
        </span>
      ),
    },
    { key: 'priority', header: t('leads:col.priority'), hideBelow: '2xl', cell: (r) => (r.priority ? <PriorityPill value={r.priority} /> : null) },
    {
      key: 'budget', header: t('leads:col.budget'), align: 'right', hideBelow: 'lg',
      cell: (r) => {
        const q = r.lead.requirement
        return q.budgetMax || q.budgetMin ? <span className="whitespace-nowrap">{inrRange(q.budgetMin, q.budgetMax, { upTo: t('domain:lead.upTo'), from: t('domain:lead.from') })}</span> : <span className="text-muted-foreground">—</span>
      },
    },
    {
      key: 'location', header: t('leads:col.location'), hideBelow: 'xl', className: 'max-w-48',
      cell: (r) => <span className="block truncate text-meta">{[...r.lead.requirement.localities, ...(r.lead.requirement.localities.length ? [] : r.lead.requirement.cities)].join(', ') || '—'}</span>,
    },
    { key: 'source', header: t('leads:col.source'), hideBelow: '2xl', cell: (r) => <SourcePill source={r.lead.source} /> },
    ...(scope('lead.view') !== 'own' ? [{
      key: 'owner', header: t('leads:col.owner'), hideBelow: 'xl' as const,
      cell: (r: LeadRow) => (r.ownerName
        ? <span className="flex items-center gap-1.5 text-meta"><UserAvatar name={r.ownerName} size="xs" /><span className="truncate">{r.ownerName}</span></span>
        : <span className="rounded-full bg-warning-soft px-2 py-0.5 text-meta font-medium text-warning">{t('domain:lead.unassigned')}</span>),
    }] : []),
    { key: 'followUp', header: t('leads:col.followUp'), sortable: true, hideBelow: 'md', cell: followUp },
    { key: 'aging', header: t('leads:col.aging'), hideBelow: '2xl', cell: (r) => <AgingBadge aging={r.aging} /> },
  ]

  return (
    <DataTable
      rows={rows} columns={columns} rowKey={(r) => r.lead.id} label={t('leads:list.label')} rowLabel={(r) => r.lead.name}
      onRowClick={(r) => navigate(paths.lead(r.lead.id))}
      sort={sort} onSort={onSort} selected={selected} onSelectedChange={onSelectedChange}
      density={density} hiddenColumns={hidden} empty={empty} footer={footer}
      rowActions={(r) => (
        <>
          <ContactActions lead={r.lead} onCall={() => can('lead.edit', r.lead) && dialogs.open({ kind: 'log', leadId: r.lead.id, channel: 'call' })} />
          {can('lead.edit', r.lead) && (
            <Button variant="ghost" size="icon-sm" aria-label={t('leads:actions.logFor', { name: r.lead.name })} title={t('leads:actions.log')} onClick={() => dialogs.open({ kind: 'log', leadId: r.lead.id })}>
              <ClipboardList />
            </Button>
          )}
          <LeadActionsMenu lead={r.lead} />
        </>
      )}
    />
  )
}
