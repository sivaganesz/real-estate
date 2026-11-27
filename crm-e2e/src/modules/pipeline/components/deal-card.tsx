/**
 * A deal on the board (DESIGN_SYSTEM §11.5): client with temperature dot, property, ₹ value, the executive's avatar,
 * the days-in-stage badge (muted / warning / "Stalled"), the next follow-up (danger when overdue), the ✦ conversion
 * prediction and the ✦ stalled corner marker. The "Move to…" menu is the no-drag way to change the stage.
 */
import type { ComponentProps, Ref } from 'react'
import { ArrowRightLeft, CalendarClock, ExternalLink, Hourglass, MoreHorizontal, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { paths } from '@/app/paths'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { PipelineStageKey } from '@/domain/types'
import { fmtDate, fmtTime, inrShort } from '@/lib/format'
import { isSameLocalDay } from '@/lib/dates'
import { stageTone, temperatureTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import type { DealItem } from '../lib/pipeline'

export type DealCardProps = {
  deal: DealItem
  now: Date
  stages: PipelineStageKey[]
  canMove: boolean
  onMove: (to: PipelineStageKey) => void
  onOpen: () => void
  /** Phone: a visible "Move to…" button instead of the hover menu. */
  touch?: boolean
  onMoveSheet?: () => void
  /** The lifted copy under the pointer. */
  overlay?: boolean
  /** The card left behind while its copy is dragged. */
  ghost?: boolean
  dragRef?: Ref<HTMLDivElement>
  dragProps?: ComponentProps<'div'>
}

export function DealCard({ deal, now, stages, canMove, onMove, onOpen, touch, onMoveSheet, overlay, ghost, dragRef, dragProps }: DealCardProps) {
  const { t, i18n } = useTranslation(['pipeline', 'catalogue'])
  const { lead } = deal
  const temp = temperatureTone[deal.temperature]
  const overdue = !!deal.nextFollowUpAt && deal.nextFollowUpAt < now.toISOString()
  const followUp = deal.nextFollowUpAt
    ? isSameLocalDay(deal.nextFollowUpAt, now) ? t('pipeline:card.todayAt', { time: fmtTime(deal.nextFollowUpAt, i18n.language) }) : fmtDate(deal.nextFollowUpAt, i18n.language)
    : null
  const agingCls = deal.aging === 'danger' ? 'bg-danger-soft text-danger' : deal.aging === 'warning' ? 'bg-warning-soft text-warning' : 'bg-muted text-muted-foreground'
  const pct = Math.round(deal.probability * 100)

  return (
    <div
      ref={dragRef}
      {...dragProps}
      data-testid="deal-card"
      data-lead={lead.id}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('a,button,[role="menuitem"]')) return
        onOpen()
      }}
      className={cn(
        'group/card relative flex cursor-pointer flex-col gap-2 rounded-lg border bg-card p-3 text-left shadow-card outline-none',
        'transition-[box-shadow,transform,opacity] duration-(--dur-fast) hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring',
        canMove && !touch && 'cursor-grab active:cursor-grabbing',
        overlay && 'scale-[1.02] rotate-[1.5deg] cursor-grabbing shadow-lg motion-reduce:rotate-0 motion-reduce:scale-100',
        ghost && 'opacity-40',
        dragProps?.className,
      )}
    >
      {deal.stalled && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              data-testid="stalled-marker"
              tabIndex={-1}
              aria-label={t('pipeline:card.stalledTip', { days: deal.days, target: deal.target })}
              className="absolute -top-px -right-px inline-flex size-6 items-start justify-end rounded-tr-lg rounded-bl-lg bg-ai-soft p-1 text-ai"
            >
              <Sparkles className="size-3" aria-hidden="true" />
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-60">{t('pipeline:card.stalledTip', { days: deal.days, target: deal.target })}</TooltipContent>
        </Tooltip>
      )}

      <div className="flex min-w-0 items-start gap-2 pr-5">
        <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', temp.solid)} title={t(`catalogue:temperature.${deal.temperature}`)} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <Link
            to={paths.lead(lead.id)}
            className="block truncate text-sm font-semibold text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {lead.name}
          </Link>
          <p className="sr-only">{t(`catalogue:temperature.${deal.temperature}`)}</p>
          <p className="truncate text-meta text-muted-foreground" title={deal.property?.title}>
            {deal.property?.title ?? (lead.requirement.localities[0] ?? lead.requirement.cities[0] ?? t('pipeline:card.noProperty'))}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-semibold tabular-nums" title={t('pipeline:card.valueTip')}>{deal.value ? inrShort(deal.value) : t('pipeline:card.noValue')}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={-1} className="inline-flex items-center gap-1 rounded-md bg-ai-soft px-1.5 py-0.5 text-meta font-semibold text-ai tabular-nums" data-testid="deal-prediction">
              <Sparkles className="size-3" aria-hidden="true" />
              {t('pipeline:card.prediction', { pct })}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-60">{t('pipeline:card.predictionTip', { pct, score: deal.score })}</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {deal.owner ? <UserAvatar name={deal.owner.name} size="xs" /> : <span className="text-meta text-warning">{t('pipeline:card.unassigned')}</span>}
        <span className={cn('inline-flex h-5 items-center gap-1 rounded-full px-1.5 text-meta font-medium tabular-nums', agingCls)} title={t('pipeline:card.daysTip', { days: deal.days, target: deal.target })} data-testid="days-badge">
          <Hourglass className="size-3" aria-hidden="true" />
          {deal.aging === 'danger' ? t('pipeline:card.stalled', { count: deal.days }) : t('pipeline:card.days', { count: deal.days })}
        </span>
        {followUp && (
          <span className={cn('inline-flex items-center gap-1 text-meta tabular-nums', overdue ? 'font-medium text-danger' : 'text-muted-foreground')} title={overdue ? t('pipeline:card.overdue') : t('pipeline:card.nextFollowUp')}>
            <CalendarClock className="size-3.5" aria-hidden="true" />
            {followUp}
            {overdue && <span className="sr-only">{t('pipeline:card.overdue')}</span>}
          </span>
        )}
        {lead.stage === 'lost' && lead.lost && (
          <span className="truncate text-meta text-muted-foreground">{t(`catalogue:lostReason.${lead.lost.reason}`)}</span>
        )}
        {canMove && (touch ? (
          <Button variant="secondary" size="sm" className="ml-auto h-7 px-2 text-meta" onClick={onMoveSheet} data-testid="move-to-button">
            <ArrowRightLeft />{t('pipeline:move.button')}
          </Button>
        ) : !overlay && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost" size="icon-sm" aria-label={t('pipeline:move.menuFor', { name: lead.name })}
                className="ml-auto size-7 opacity-0 group-hover/card:opacity-100 group-focus-within/card:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100"
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                data-testid="deal-menu"
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{t('pipeline:move.title')}</DropdownMenuLabel>
              {stages.filter((s) => s !== lead.stage).map((s) => (
                <DropdownMenuItem key={s} onSelect={() => onMove(s)}>
                  <span aria-hidden="true" className={cn('size-2 rounded-full', stageTone[s].solid)} />
                  {t(`catalogue:stage.${s}`)}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onOpen}><ExternalLink />{t('pipeline:card.open')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
      </div>
    </div>
  )
}
