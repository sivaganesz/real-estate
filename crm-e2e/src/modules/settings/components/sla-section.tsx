/**
 * Response times and lead temperature (admin, `settings.matching`). SLA: first call within N minutes (the auto
 * "Call {{name}}" task is due then; a breach notifies the owner), escalate to the manager after N minutes, a lead is
 * stale after N days, a hot lead must be contacted every N days. Scoring: the score at which a lead turns warm and hot,
 * drawn as a 0–100 band. Inline errors; Save with Undo.
 */
import { useState } from 'react'
import { Flame, Snowflake, Thermometer, Timer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SectionCard } from '@/components/shared/section-card'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { Input } from '@/components/ui/input'
import type { Settings } from '@/domain/types'
import { useDb } from '@/hooks/use-db'
import { temperatureTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { updateSettings } from '@/services/settings'
import { validateScoring, validateSla, type SettingError } from '../lib/settings-logic'
import { SaveBar } from './save-bar'

type SlaKey = keyof Settings['sla']
const SLA_FIELDS: { key: SlaKey; unit: 'mins' | 'days' }[] = [
  { key: 'firstResponseMins', unit: 'mins' }, { key: 'escalateAfterMins', unit: 'mins' }, { key: 'staleDays', unit: 'days' }, { key: 'hotNoContactDays', unit: 'days' },
]

export function SlaSection() {
  const { t } = useTranslation(['settings', 'catalogue'])
  const savedSla = useDb((db) => db.settings.sla)
  const savedScoring = useDb((db) => db.settings.scoring)
  const [sla, setSla] = useState(savedSla)
  const [scoring, setScoring] = useState(savedScoring)
  const [baseSla, setBaseSla] = useState(savedSla)
  const [baseScoring, setBaseScoring] = useState(savedScoring)
  // a save (or Undo) elsewhere replaces the draft with the stored value
  if (baseSla !== savedSla) {
    setBaseSla(savedSla)
    setSla(savedSla)
  }
  if (baseScoring !== savedScoring) {
    setBaseScoring(savedScoring)
    setScoring(savedScoring)
  }
  const slaErrors = validateSla(sla)
  const scoreErrors = validateScoring(scoring)
  const msg = (e?: SettingError) => (e ? t(`settings:errors.${e.key}`, e.params ?? {}) : undefined)
  const slaDirty = JSON.stringify(sla) !== JSON.stringify(savedSla)
  const scoreDirty = JSON.stringify(scoring) !== JSON.stringify(savedScoring)
  const num = (v: string) => (v.trim() === '' ? Number.NaN : Number(v))

  const saveSla = () => {
    try {
      const r = updateSettings('sla', sla)
      toastUndo(t('settings:sla.saved'), r.undoToken)
    } catch (e) {
      toastError(e)
    }
  }
  const saveScoring = () => {
    try {
      const r = updateSettings('scoring', scoring)
      toastUndo(t('settings:scoring.saved'), r.undoToken)
    } catch (e) {
      toastError(e)
    }
  }
  const okBand = !scoreErrors.length
  const warm = okBand ? scoring.warmAt : savedScoring.warmAt
  const hot = okBand ? scoring.hotAt : savedScoring.hotAt

  return (
    <div className="flex flex-col gap-6">
      <SectionCard title={t('settings:sla.title')} description={t('settings:sla.body')} icon={Timer}>
        <div className="grid gap-4 sm:grid-cols-2">
          {SLA_FIELDS.map(({ key, unit }) => {
            const e = msg(slaErrors.find((x) => x.field === key))
            return (
              <label key={key} className="flex flex-col gap-1.5 text-sm font-medium">
                {t(`settings:sla.${key}`)}
                <span className="flex items-center gap-2">
                  <Input type="number" inputMode="numeric" value={Number.isNaN(sla[key]) ? '' : sla[key]} onChange={(ev) => setSla({ ...sla, [key]: num(ev.target.value) })} aria-invalid={!!e} className="w-28" data-testid={`sla-${key}`} />
                  <span className="font-normal text-muted-foreground">{t(`settings:sla.unit.${unit}`)}</span>
                </span>
                {e ? <span className="text-xs font-normal text-danger">{e}</span> : <span className="text-xs font-normal text-muted-foreground">{t(`settings:sla.${key}Hint`)}</span>}
              </label>
            )
          })}
        </div>
        <SaveBar dirty={slaDirty} valid={!slaErrors.length} onSave={saveSla} onDiscard={() => setSla(savedSla)} className="mt-4" testId="sla-save" />
      </SectionCard>

      <SectionCard title={t('settings:scoring.title')} description={t('settings:scoring.body')} icon={Thermometer}>
        <div className="flex flex-col gap-5">
          <div>
            <div className="flex h-8 w-full overflow-hidden rounded-md text-meta font-medium" role="img" aria-label={t('settings:scoring.bandAria', { warm, hot })}>
              <span className={cn('flex items-center justify-center gap-1', temperatureTone.cold.soft, temperatureTone.cold.text)} style={{ width: `${warm}%` }}><Snowflake className="size-3.5" aria-hidden="true" />{t('catalogue:temperature.cold')}</span>
              <span className={cn('flex items-center justify-center gap-1', temperatureTone.warm.soft, temperatureTone.warm.text)} style={{ width: `${hot - warm}%` }}><Thermometer className="size-3.5" aria-hidden="true" />{t('catalogue:temperature.warm')}</span>
              <span className={cn('flex items-center justify-center gap-1', temperatureTone.hot.soft, temperatureTone.hot.text)} style={{ width: `${100 - hot}%` }}><Flame className="size-3.5" aria-hidden="true" />{t('catalogue:temperature.hot')}</span>
            </div>
            <div className="mt-1 flex justify-between text-micro text-muted-foreground tabular-nums"><span>0</span><span>100</span></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(['warmAt', 'hotAt'] as const).map((key) => {
              const e = msg(scoreErrors.find((x) => x.field === key))
              return (
                <label key={key} className="flex flex-col gap-1.5 text-sm font-medium">
                  {t(`settings:scoring.${key}`)}
                  <Input type="number" inputMode="numeric" min={1} max={100} value={Number.isNaN(scoring[key]) ? '' : scoring[key]} onChange={(ev) => setScoring({ ...scoring, [key]: num(ev.target.value) })} aria-invalid={!!e} className="w-28" data-testid={`scoring-${key}`} />
                  {e && <span className="text-xs font-normal text-danger">{e}</span>}
                </label>
              )
            })}
          </div>
          <SaveBar dirty={scoreDirty} valid={okBand} onSave={saveScoring} onDiscard={() => setScoring(savedScoring)} testId="scoring-save" />
        </div>
      </SectionCard>
    </div>
  )
}
