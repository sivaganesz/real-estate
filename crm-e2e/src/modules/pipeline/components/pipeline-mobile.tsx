/**
 * Phone layout (foundation-plan §8.3 M6): stage tabs (dot, short name, count) over one stage's cards, and a
 * "Move to…" bottom sheet instead of dragging. Lost / Booked / Won are marked as asking for details.
 */
import { useEffect, useRef, useState } from 'react'
import { Check, MessageSquareWarning } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { Lead, PipelineStageKey } from '@/domain/types'
import { usePermission } from '@/hooks/use-permission'
import { inrShort } from '@/lib/format'
import { stageTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { NEEDS_DIALOG, sortColumn, type ColumnSummary, type DealItem } from '../lib/pipeline'
import { DealCard } from './deal-card'

export function PipelineMobile({ stages, summaries, deals, stage, onStage, now, onMove, onOpen }: {
  stages: PipelineStageKey[]
  summaries: ColumnSummary[]
  deals: DealItem[]
  stage: PipelineStageKey
  onStage: (s: PipelineStageKey) => void
  now: Date
  onMove: (lead: Lead, to: PipelineStageKey) => void
  onOpen: (lead: Lead) => void
}) {
  const { t } = useTranslation(['pipeline', 'catalogue'])
  const { can } = usePermission()
  const [moving, setMoving] = useState<DealItem | null>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const list = sortColumn(deals.filter((d) => d.lead.stage === stage))
  const sum = summaries.find((s) => s.stage === stage)

  useEffect(() => {
    // centre the active tab by scrolling the strip only (scrollIntoView would also scroll the page down on load)
    const strip = tabsRef.current
    const tab = strip?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (strip && tab) strip.scrollLeft = tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2
  }, [stage])

  return (
    <div className="flex flex-col gap-3" data-testid="pipeline-mobile">
      <div ref={tabsRef} role="tablist" aria-label={t('pipeline:mobile.tabs')} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {stages.map((s) => {
          const count = summaries.find((x) => x.stage === s)?.count ?? 0
          const on = s === stage
          return (
            <button
              key={s} type="button" role="tab" aria-selected={on} aria-controls="pipeline-stage-panel"
              onClick={() => onStage(s)}
              className={cn(
                'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-ui font-medium transition-colors',
                on ? cn('border-transparent text-foreground', stageTone[s].soft) : 'bg-card text-muted-foreground',
              )}
            >
              <span aria-hidden="true" className={cn('size-2 rounded-full', stageTone[s].solid)} />
              {t(`catalogue:stageShort.${s}`)}
              <span className="tabular-nums">{count}</span>
            </button>
          )
        })}
      </div>
      <div id="pipeline-stage-panel" role="tabpanel" aria-label={t(`catalogue:stage.${stage}`)} className="flex flex-col gap-2">
        <p className="flex items-center justify-between text-meta text-muted-foreground">
          <span>{t('pipeline:mobile.summary', { count: sum?.count ?? 0 })}</span>
          <span className="font-semibold text-foreground tabular-nums">{inrShort(sum?.value ?? 0)}</span>
        </p>
        {list.map((d) => (
          <DealCard
            key={d.lead.id} deal={d} now={now} stages={stages} canMove={can('lead.moveStage', d.lead)} touch
            onMove={(to) => onMove(d.lead, to)} onOpen={() => onOpen(d.lead)} onMoveSheet={() => setMoving(d)}
          />
        ))}
        {!list.length && <p className="rounded-lg border border-dashed px-3 py-8 text-center text-meta text-muted-foreground">{t('pipeline:mobile.emptyStage')}</p>}
      </div>
      <MoveToSheet
        deal={moving}
        stages={stages}
        onClose={() => setMoving(null)}
        onPick={(to) => {
          const d = moving
          setMoving(null)
          if (d) onMove(d.lead, to)
        }}
      />
    </div>
  )
}

export function MoveToSheet({ deal, stages, onClose, onPick }: {
  deal: DealItem | null
  stages: PipelineStageKey[]
  onClose: () => void
  onPick: (to: PipelineStageKey) => void
}) {
  const { t } = useTranslation(['pipeline', 'catalogue'])
  return (
    <Sheet open={!!deal} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl" data-testid="move-sheet">
        <SheetHeader>
          <SheetTitle>{t('pipeline:move.sheetTitle', { name: deal?.lead.name ?? '' })}</SheetTitle>
          <SheetDescription>{deal ? t('pipeline:move.from', { stage: t(`catalogue:stage.${deal.lead.stage}`) }) : null}</SheetDescription>
        </SheetHeader>
        <ul className="flex flex-col gap-1 px-4 pb-6">
          {stages.map((s) => {
            const current = s === deal?.lead.stage
            return (
              <li key={s}>
                <button
                  type="button" disabled={current} onClick={() => onPick(s)}
                  className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
                >
                  <span aria-hidden="true" className={cn('size-2.5 rounded-full', stageTone[s].solid)} />
                  <span className="flex-1">{t(`catalogue:stage.${s}`)}</span>
                  {current && <span className="inline-flex items-center gap-1 text-meta text-muted-foreground"><Check className="size-3.5" aria-hidden="true" />{t('pipeline:move.current')}</span>}
                  {!current && NEEDS_DIALOG.includes(s) && (
                    <span className="inline-flex items-center gap-1 text-meta text-muted-foreground"><MessageSquareWarning className="size-3.5" aria-hidden="true" />{t('pipeline:move.asks')}</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </SheetContent>
    </Sheet>
  )
}
