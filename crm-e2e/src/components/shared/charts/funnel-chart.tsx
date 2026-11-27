/**
 * Funnel (DESIGN_SYSTEM §10, custom): horizontal bars per stage in the stage colours, width relative to the first
 * stage, the count at the end and the drop-off % between stages. Clicking a stage opens the filtered list.
 */
import { useTranslation } from 'react-i18next'
import type { PipelineStageKey } from '@/domain/types'
import { stageTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { ChartEmpty } from './chart-parts'

export type FunnelStep = { stage: PipelineStageKey; count: number; value?: number; dropOffPct?: number }

export function FunnelChart({ steps, label, onStageClick, valueFormat }: {
  steps: FunnelStep[]
  label: string
  onStageClick?: (stage: PipelineStageKey) => void
  valueFormat?: (v: number) => string
}) {
  const { t } = useTranslation(['ui', 'catalogue'])
  const top = Math.max(1, ...steps.map((s) => s.count))
  if (!steps.some((s) => s.count > 0)) return <ChartEmpty height={200} />
  return (
    <figure aria-label={label} className="flex flex-col">
      <ol className="flex flex-col">
        {steps.map((s, i) => {
          const pct = Math.max(2, (s.count / top) * 100)
          const Row = onStageClick ? 'button' : 'div'
          return (
            <li key={s.stage} className="flex flex-col">
              {i > 0 && s.dropOffPct != null && (
                <span className="ml-[7.5rem] py-0.5 text-micro text-subtle-foreground tabular-nums">↓ {t('ui:chart.dropOff', { pct: Math.round(s.dropOffPct) })}</span>
              )}
              <Row
                {...(onStageClick ? { type: 'button' as const, onClick: () => onStageClick(s.stage) } : {})}
                className={cn('group grid grid-cols-[7rem_1fr] items-center gap-2 rounded-sm text-left', onStageClick && 'hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none')}
              >
                <span className="truncate text-meta text-muted-foreground">{t(`catalogue:stageShort.${s.stage}`)}</span>
                <span className="flex items-center gap-2">
                  <span className={cn('h-6 rounded-xs transition-[width] duration-(--dur-slower) ease-out', stageTone[s.stage].solid)} style={{ width: `${pct}%` }} />
                  <span className="shrink-0 text-meta font-semibold tabular-nums">
                    {s.count}
                    {s.value != null && valueFormat && <span className="ml-1.5 font-normal text-muted-foreground">{valueFormat(s.value)}</span>}
                  </span>
                </span>
              </Row>
            </li>
          )
        })}
      </ol>
    </figure>
  )
}
