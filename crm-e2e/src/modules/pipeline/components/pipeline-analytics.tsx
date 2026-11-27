/**
 * The analytics strip (master prompt §11 "conversion analytics per stage and stage-wise drop-off"): four KPI cards
 * (open value, the ✦ weighted forecast, stalled deals, win rate) and one tile per stage with the conversion to the next
 * stage, the drop-off and the average days spent there against the stage target.
 */
import { AlertTriangle, ArrowRight, Hourglass, IndianRupee, Sparkles, Trophy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { KpiCard } from '@/components/shared/kpi-card'
import type { AIMode } from '@/ai/types'
import type { PipelineStageKey } from '@/domain/types'
import { inrShort } from '@/lib/format'
import { stageTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import type { PipelineTotals, StageAnalytics } from '../lib/pipeline'

export function PipelineKpis({ totals, spark, mode, stalledOn, onStalled }: {
  totals: PipelineTotals
  spark: { created: number[]; won: number[] }
  mode: AIMode
  stalledOn: boolean
  onStalled: () => void
}) {
  const { t } = useTranslation('pipeline')
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="pipeline-kpis">
      <KpiCard
        highlight icon={IndianRupee} label={t('kpi.open')} value={inrShort(totals.openValue)}
        hint={t('kpi.openHint', { count: totals.openCount })} spark={spark.created}
      />
      <KpiCard
        tone="ai" icon={Sparkles} label={<span className="inline-flex flex-wrap items-center gap-1.5">{t('kpi.forecast')}<DemoAIBadge mode={mode} /></span>}
        value={inrShort(totals.weighted)} hint={t('kpi.forecastHint')}
        ring={{ value: totals.openValue ? Math.round((totals.weighted / totals.openValue) * 100) : 0, label: t('kpi.forecastRing') }}
      />
      <KpiCard
        tone="danger" icon={AlertTriangle} label={t('kpi.stalled')} value={totals.stalled}
        hint={stalledOn ? t('kpi.stalledOn') : t('kpi.stalledHint')} onClick={onStalled}
        className={cn(stalledOn && 'ring-2 ring-danger/40')}
      />
      <KpiCard
        tone="success" icon={Trophy} label={t('kpi.winRate')} value={`${totals.winRate}%`}
        hint={t('kpi.winHint', { won: totals.wonCount, lost: totals.lostCount, value: inrShort(totals.wonValue) })}
        spark={spark.won}
      />
    </div>
  )
}

export function StageAnalyticsStrip({ rows, targets, onPick }: {
  rows: StageAnalytics[]
  targets: Partial<Record<PipelineStageKey, number>>
  onPick: (stage: PipelineStageKey) => void
}) {
  const { t } = useTranslation(['pipeline', 'catalogue'])
  const path = rows.filter((r) => r.stage !== 'lost')
  const lost = rows.find((r) => r.stage === 'lost')
  return (
    <section aria-labelledby="pipeline-analytics-title" className="rounded-lg border bg-card p-4 shadow-card" data-testid="stage-analytics">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="pipeline-analytics-title" className="text-base font-semibold">{t('pipeline:analytics.title')}</h2>
        <p className="text-meta text-muted-foreground">
          {lost ? t('pipeline:analytics.lost', { count: lost.reached }) : null}
        </p>
      </div>
      <ol className="flex gap-2 overflow-x-auto pb-1">
        {path.map((r, i) => {
          const target = targets[r.stage] ?? 0
          const slow = r.avgDays !== null && target > 0 && r.avgDays > target
          return (
            <li key={r.stage} className="flex shrink-0 items-stretch gap-2">
              <button
                type="button"
                onClick={() => onPick(r.stage)}
                className="flex w-40 flex-col gap-1 rounded-md border bg-background/60 p-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label={r.conversionPct == null || r.avgDays == null
                  ? t('pipeline:analytics.tileLabelNoData', { stage: t(`catalogue:stage.${r.stage}`), reached: r.reached })
                  : t('pipeline:analytics.tileLabel', { stage: t(`catalogue:stage.${r.stage}`), reached: r.reached, conv: r.conversionPct, days: r.avgDays })}
              >
                <span className="flex items-center gap-1.5 text-meta font-medium">
                  <span className={cn('size-2 shrink-0 rounded-full', stageTone[r.stage].solid)} aria-hidden="true" />
                  <span className="truncate">{t(`catalogue:stageShort.${r.stage}`)}</span>
                </span>
                <span className="text-lg font-semibold tabular-nums">{r.reached}</span>
                <span className="text-micro text-muted-foreground">{t('pipeline:analytics.reached')}</span>
                {r.conversionPct !== null ? (
                  <span className="mt-1 flex flex-col text-meta tabular-nums">
                    <span className="font-semibold text-success">{t('pipeline:analytics.conv', { pct: r.conversionPct })}</span>
                    <span className="text-danger">{t('pipeline:analytics.drop', { pct: r.dropOffPct })}</span>
                  </span>
                ) : <span className="mt-1 text-meta text-muted-foreground">{t('pipeline:analytics.final')}</span>}
                <span className={cn('flex items-center gap-1 text-meta tabular-nums', slow ? 'text-warning' : 'text-muted-foreground')}>
                  <Hourglass className="size-3" aria-hidden="true" />
                  {r.avgDays !== null ? t('pipeline:analytics.avgDays', { days: r.avgDays, target }) : t('pipeline:analytics.noDays')}
                </span>
              </button>
              {i < path.length - 1 && <ArrowRight className="size-3.5 self-center text-subtle-foreground" aria-hidden="true" />}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
