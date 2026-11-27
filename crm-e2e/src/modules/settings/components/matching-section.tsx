/**
 * Matching weights (admin, `settings.matching`): how much budget, location, size, amenities and preferences count in a
 * match score (M = Σ w·part). Sliders with a live sum that must read 1.00 before saving, "Balance to 1.00" keeps the
 * weight you touched last and scales the rest, a stacked bar shows the mix; plus the minimum score to show a match and
 * the cap per project. Save with Undo.
 */
import { useState } from 'react'
import { Scale } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SectionCard } from '@/components/shared/section-card'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { DEFAULT_SETTINGS } from '@/domain/catalogue'
import type { Settings } from '@/domain/types'
import { useDb } from '@/hooks/use-db'
import { cn } from '@/lib/utils'
import { updateSettings } from '@/services/settings'
import { WEIGHT_KEYS, normaliseWeights, weightsSum, weightsValid, type Weights } from '../lib/settings-logic'
import { SaveBar } from './save-bar'

/** Chart tokens for the mix bar (series order, DESIGN_SYSTEM §10). */
const SEG = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5'] as const

export function MatchingSection() {
  const { t } = useTranslation('settings')
  const saved = useDb((db) => db.settings.matching)
  const [d, setD] = useState<Settings['matching']>(saved)
  const [last, setLast] = useState<keyof Weights>('budget')
  const [base, setBase] = useState(saved)
  // a save (or Undo) elsewhere replaces the draft with the stored value
  if (base !== saved) {
    setBase(saved)
    setD(saved)
  }
  const sum = weightsSum(d.weights)
  const ok = weightsValid(d.weights)
  const minOk = Number.isInteger(d.minScore) && d.minScore >= 0 && d.minScore <= 100
  const capOk = Number.isInteger(d.perProjectCap) && d.perProjectCap >= 1 && d.perProjectCap <= 10
  const dirty = JSON.stringify(d) !== JSON.stringify(saved)
  const setW = (k: keyof Weights, v: number) => {
    setD((x) => ({ ...x, weights: { ...x.weights, [k]: Math.round(v * 100) / 100 } }))
    setLast(k)
  }
  const save = () => {
    try {
      const r = updateSettings('matching', d)
      toastUndo(t('matching.saved'), r.undoToken)
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionCard title={t('matching.weightsTitle')} description={t('matching.weightsBody')} icon={Scale}
        action={<Button variant="ghost" size="sm" onClick={() => setD({ ...d, weights: { ...DEFAULT_SETTINGS.matching.weights } })}>{t('matching.defaults')}</Button>}>
        <div className="flex flex-col gap-5">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={t('matching.mixAria', { list: WEIGHT_KEYS.map((k) => `${t(`matching.w.${k}`)} ${Math.round(d.weights[k] * 100)}%`).join(', ') })}>
            {WEIGHT_KEYS.map((k, i) => <span key={k} className={cn(SEG[i], 'transition-[width] duration-(--dur-base)')} style={{ width: `${(d.weights[k] / Math.max(sum, 1)) * 100}%` }} />)}
          </div>
          <ul className="flex flex-col gap-4">
            {WEIGHT_KEYS.map((k, i) => (
              <li key={k} className="grid grid-cols-[minmax(7rem,10rem)_1fr_3.5rem] items-center gap-3">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span aria-hidden="true" className={cn('size-2.5 rounded-full', SEG[i])} />
                  {t(`matching.w.${k}`)}
                </span>
                <Slider value={[d.weights[k]]} min={0} max={1} step={0.05} onValueChange={([v]) => setW(k, v)} aria-label={t(`matching.w.${k}`)} data-testid={`weight-${k}`} />
                <span className="text-right text-sm font-semibold tabular-nums">{d.weights[k].toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <div className={cn('flex flex-wrap items-center gap-3 rounded-md px-3 py-2', ok ? 'bg-success-soft' : 'bg-danger-soft')} role="status" data-testid="weights-sum">
            <span className={cn('text-sm font-semibold tabular-nums', ok ? 'text-success' : 'text-danger')}>{t('matching.sum', { sum: sum.toFixed(2) })}</span>
            <span className="text-meta text-foreground/80">{ok ? t('matching.sumOk') : t('matching.sumBad')}</span>
            {!ok && <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setD({ ...d, weights: normaliseWeights(d.weights, last) })} data-testid="weights-balance">{t('matching.balance', { name: t(`matching.w.${last}`) })}</Button>}
          </div>
        </div>
      </SectionCard>

      <SectionCard title={t('matching.limitsTitle')} description={t('matching.limitsBody')}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span className="flex items-center justify-between text-sm font-medium">{t('matching.minScore')}<span className="tabular-nums">{d.minScore}%</span></span>
            <Slider value={[d.minScore]} min={0} max={100} step={5} onValueChange={([v]) => setD({ ...d, minScore: v })} aria-label={t('matching.minScore')} />
            <span className="text-meta text-muted-foreground">{t('matching.minScoreHint')}</span>
          </div>
          <label className="flex flex-col gap-2 text-sm font-medium">
            {t('matching.cap')}
            <Input type="number" inputMode="numeric" min={1} max={10} value={d.perProjectCap} onChange={(e) => setD({ ...d, perProjectCap: Number(e.target.value) })} className="w-24" aria-invalid={!capOk} />
            <span className="text-meta font-normal text-muted-foreground">{t('matching.capHint')}</span>
          </label>
        </div>
      </SectionCard>

      <SaveBar
        dirty={dirty} valid={ok && minOk && capOk} invalidText={!ok ? t('matching.sumBad') : t('errors.range', { min: 1, max: 10 })}
        onSave={save} onDiscard={() => setD(saved)} testId="matching-save"
        className="sticky bottom-20 z-10 fab-clear rounded-lg border bg-card/95 p-3 shadow-md backdrop-blur md:bottom-4"
      />
    </div>
  )
}
