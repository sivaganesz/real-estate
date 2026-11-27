/**
 * The header progress strip (DESIGN_SYSTEM §11.5): one segmented bar across the page, each segment sized by the deals
 * in that stage and filled with the stage colour. Hover or focus shows the count and ₹ value; a click jumps to the stage.
 */
import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { PipelineStageKey } from '@/domain/types'
import { inrShort } from '@/lib/format'
import { stageTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import type { ColumnSummary } from '../lib/pipeline'

export function StageProgressStrip({ summaries, onPick }: { summaries: ColumnSummary[]; onPick: (stage: PipelineStageKey) => void }) {
  const { t } = useTranslation(['pipeline', 'catalogue'])
  const total = summaries.reduce((n, s) => n + s.count, 0)
  if (!total) return null
  return (
    <div className="flex flex-col gap-2" data-testid="stage-strip">
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full" role="list" aria-label={t('pipeline:strip.label')}>
        {summaries.filter((s) => s.count > 0).map((s) => (
          <Tooltip key={s.stage}>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="listitem"
                onClick={() => onPick(s.stage)}
                aria-label={t('pipeline:strip.segment', { stage: t(`catalogue:stage.${s.stage}`), count: s.count, value: inrShort(s.value) })}
                className={cn('h-full min-w-1.5 transition-[filter] first:rounded-l-full last:rounded-r-full hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none', stageTone[s.stage].solid)}
                style={{ flexGrow: s.count, flexBasis: 0 }}
              />
            </TooltipTrigger>
            <TooltipContent>
              <span className="font-semibold">{t(`catalogue:stage.${s.stage}`)}</span>
              {' · '}
              <span className="tabular-nums">{t('pipeline:strip.tip', { count: s.count, value: inrShort(s.value) })}</span>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <ul className="hidden flex-wrap gap-x-4 gap-y-1 text-meta text-muted-foreground md:flex" aria-hidden="true">
        {summaries.map((s) => (
          <li key={s.stage} className="inline-flex items-center gap-1.5">
            <span className={cn('size-2 rounded-full', stageTone[s.stage].solid)} />
            {t(`catalogue:stageShort.${s.stage}`)}
            <span className="font-semibold text-foreground tabular-nums">{s.count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
