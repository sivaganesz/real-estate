/**
 * The kanban (DESIGN_SYSTEM §11.5): one column per enabled stage in a horizontally scrolling well. Drag with the
 * pointer, or with the keyboard (Space to lift, ←/→ to change column, Space to drop, Esc to cancel) with spoken
 * announcements. The board never changes data itself: a drop calls `onMove`, and the page decides whether the move
 * needs a dialog (Lost / Booked / Won). Until a move is saved the card stays where it was, so Cancel "returns" it.
 */
import { useMemo, useState, type ReactNode } from 'react'
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, pointerWithin, useDraggable, useDroppable, useSensor, useSensors,
  type Announcements, type CollisionDetection, type DragEndEvent, type DragStartEvent, type KeyboardCoordinateGetter, type UniqueIdentifier,
} from '@dnd-kit/core'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { paths } from '@/app/paths'
import { Button } from '@/components/ui/button'
import type { ID, Lead, PipelineStageKey } from '@/domain/types'
import { usePermission } from '@/hooks/use-permission'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { inrShort } from '@/lib/format'
import { stageTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { sortColumn, type ColumnSummary, type DealItem } from '../lib/pipeline'
import { DealCard } from './deal-card'
import { STAGE_STYLE } from './stage-style'

const ARROWS = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp']

/** Keyboard dragging jumps a whole column per arrow key (the default 25 px steps are useless on a wide board). */
const columnCoordinates: KeyboardCoordinateGetter = (event, { context: { active, droppableRects, droppableContainers, collisionRect } }) => {
  if (!ARROWS.includes(event.code)) return undefined
  event.preventDefault()
  if (!active || !collisionRect) return undefined
  const cols = droppableContainers.getEnabled()
    .map((c) => droppableRects.get(c.id))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .sort((a, b) => a.left - b.left)
  if (!cols.length) return undefined
  const cx = collisionRect.left + collisionRect.width / 2
  let i = cols.findIndex((r) => cx >= r.left && cx <= r.left + r.width)
  if (i < 0) i = cols.reduce((best, r, k) => (Math.abs(r.left - cx) < Math.abs(cols[best].left - cx) ? k : best), 0)
  const step = event.code === 'ArrowRight' || event.code === 'ArrowDown' ? 1 : -1
  const next = cols[Math.max(0, Math.min(cols.length - 1, i + step))]
  return { x: next.left + (next.width - collisionRect.width) / 2, y: next.top + 56 }
}

/** The pointer decides when it is inside a column; the keyboard (no pointer) falls back to the nearest column. */
const collision: CollisionDetection = (args) => {
  const within = pointerWithin(args)
  return within.length ? within : closestCenter(args)
}

export function PipelineBoard({ stages, deals, summaries, now, onMove, onOpen }: {
  stages: PipelineStageKey[]
  deals: DealItem[]
  summaries: ColumnSummary[]
  now: Date
  onMove: (lead: Lead, to: PipelineStageKey) => void
  onOpen: (lead: Lead) => void
}) {
  const { t } = useTranslation(['pipeline', 'catalogue'])
  const { can } = usePermission()
  const reduced = useReducedMotion()
  const [activeId, setActiveId] = useState<ID | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: columnCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  )
  const byId = useMemo(() => new Map(deals.map((d) => [d.lead.id, d])), [deals])
  const byStage = useMemo(() => {
    const m = new Map<PipelineStageKey, DealItem[]>(stages.map((s) => [s, []]))
    for (const d of deals) m.get(d.lead.stage)?.push(d)
    for (const [k, v] of m) m.set(k, sortColumn(v))
    return m
  }, [deals, stages])
  const active = activeId ? byId.get(activeId) : undefined
  const stageName = (id: UniqueIdentifier | undefined) => (id ? t(`catalogue:stage.${String(id)}`) : '')
  const nameOf = (id: UniqueIdentifier) => byId.get(String(id))?.lead.name ?? ''
  const canMove = (lead: Lead) => can('lead.moveStage', lead)

  const announcements: Announcements = {
    onDragStart: ({ active: a }) => t('pipeline:dnd.start', { name: nameOf(a.id), stage: stageName(byId.get(String(a.id))?.lead.stage) }),
    onDragOver: ({ active: a, over }) => (over ? t('pipeline:dnd.over', { name: nameOf(a.id), stage: stageName(over.id) }) : t('pipeline:dnd.outside', { name: nameOf(a.id) })),
    onDragEnd: ({ active: a, over }) => (over ? t('pipeline:dnd.end', { name: nameOf(a.id), stage: stageName(over.id) }) : t('pipeline:dnd.cancel', { name: nameOf(a.id) })),
    onDragCancel: ({ active: a }) => t('pipeline:dnd.cancel', { name: nameOf(a.id) }),
  }

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const d = byId.get(String(e.active.id))
    const to = e.over?.id as PipelineStageKey | undefined
    if (d && to && to !== d.lead.stage) onMove(d.lead, to)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{ announcements, screenReaderInstructions: { draggable: t('pipeline:dnd.instructions') } }}
    >
      <div
        className="-mx-4 overflow-x-auto bg-canvas px-4 pb-4 md:-mx-6 md:px-6"
        role="region"
        aria-label={t('pipeline:board.label')}
        data-testid="pipeline-board"
      >
        <div className="flex min-h-[28rem] gap-3">
          {stages.map((stage) => (
            <Column
              key={stage}
              stage={stage}
              summary={summaries.find((s) => s.stage === stage)}
              deals={byStage.get(stage) ?? []}
              activeId={activeId}
              activeFrom={active?.lead.stage}
              renderCard={(d) => (
                <DraggableCard
                  key={d.lead.id}
                  deal={d}
                  now={now}
                  stages={stages}
                  canMove={canMove(d.lead)}
                  ghost={activeId === d.lead.id}
                  onMove={(to) => onMove(d.lead, to)}
                  onOpen={() => onOpen(d.lead)}
                />
              )}
              showAdd={stage === 'new' && can('lead.create')}
            />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={reduced ? null : { duration: 200, easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)' }}>
        {active ? <DealCard deal={active} now={now} stages={stages} canMove onMove={() => undefined} onOpen={() => undefined} overlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function Column({ stage, summary, deals, renderCard, activeId, activeFrom, showAdd }: {
  stage: PipelineStageKey
  summary?: ColumnSummary
  deals: DealItem[]
  renderCard: (d: DealItem) => ReactNode
  activeId: ID | null
  activeFrom?: PipelineStageKey
  showAdd: boolean
}) {
  const { t } = useTranslation(['pipeline', 'catalogue'])
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const style = STAGE_STYLE[stage]
  const dropTarget = isOver && !!activeId && activeFrom !== stage
  const sharePct = Math.round((summary?.share ?? 0) * 100)
  return (
    <section
      id={`pipeline-col-${stage}`}
      ref={setNodeRef}
      aria-label={t('pipeline:board.column', { stage: t(`catalogue:stage.${stage}`), count: deals.length })}
      data-testid={`pipeline-column-${stage}`}
      className={cn(
        'flex w-[296px] min-w-[272px] shrink-0 flex-col overflow-hidden rounded-xl transition-shadow duration-(--dur-fast)',
        style.wash,
        dropTarget && cn('ring-2', style.dropRing),
      )}
    >
      <div className={cn('h-[3px] w-full', style.bar)} aria-hidden="true" />
      <header className="sticky top-0 flex flex-col gap-1.5 px-3 pt-2.5 pb-2">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', stageTone[stage].solid)} />
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold" title={t(`catalogue:stage.${stage}`)}>{t(`catalogue:stage.${stage}`)}</h2>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-card px-1.5 text-meta font-semibold tabular-nums shadow-xs">{deals.length}</span>
        </div>
        <div className="flex items-center justify-between gap-2 text-meta text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{inrShort(summary?.value ?? 0)}</span>
          {stage !== 'lost' && stage !== 'converted' && <span className="tabular-nums">{t('pipeline:board.share', { pct: sharePct })}</span>}
        </div>
        {stage !== 'lost' && stage !== 'converted' && (
          <div className="h-1 overflow-hidden rounded-full bg-card/80" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={sharePct} aria-label={t('pipeline:board.shareLabel', { pct: sharePct })}>
            <div className={cn('h-full rounded-full transition-[width] duration-(--dur-slow)', style.bar)} style={{ width: `${Math.max(sharePct, sharePct ? 2 : 0)}%` }} />
          </div>
        )}
      </header>
      <div className="flex max-h-[calc(100dvh-16rem)] min-h-24 flex-1 flex-col gap-2 overflow-y-auto p-2 pt-0">
        {dropTarget && <div className={cn('h-20 shrink-0 rounded-lg border-2 border-dashed bg-card/40', style.border)} aria-hidden="true" />}
        {deals.map(renderCard)}
        {!deals.length && !dropTarget && (
          <p className="rounded-lg border border-dashed border-border-strong/70 px-3 py-6 text-center text-meta text-muted-foreground">{t('pipeline:board.dropHere')}</p>
        )}
        {showAdd && (
          <Button asChild variant="ghost" size="sm" className="justify-start text-muted-foreground">
            <Link to={paths.newLead()}><Plus />{t('pipeline:board.addLead')}</Link>
          </Button>
        )}
      </div>
    </section>
  )
}

function DraggableCard(props: Omit<Parameters<typeof DealCard>[0], 'dragRef' | 'dragProps'>) {
  const { t } = useTranslation('pipeline')
  const { attributes, listeners, setNodeRef } = useDraggable({ id: props.deal.lead.id, disabled: !props.canMove })
  return (
    <DealCard
      {...props}
      dragRef={setNodeRef}
      dragProps={{ ...attributes, ...listeners, 'aria-roledescription': t('dnd.roleDescription'), 'aria-label': t('dnd.cardLabel', { name: props.deal.lead.name }) }}
    />
  )
}
