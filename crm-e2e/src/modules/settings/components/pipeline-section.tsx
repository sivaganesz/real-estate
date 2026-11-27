/**
 * Pipeline stages and lost reasons (admin, `settings.pipeline`). Each stage can be renamed (a label shown instead of
 * the built-in name), switched off (New, Booked, Converted and Lost always stay on), and given target days (drives the
 * "stalled" colouring) and a win probability (drives the forecast). Lost reasons can be switched on / off and
 * re-ordered; at least one stays on. One Save for the whole card, with Undo.
 */
import { useState } from 'react'
import { ArrowDown, ArrowUp, Lock, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SectionCard } from '@/components/shared/section-card'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DEFAULT_STAGE_DEFS, LOST_REASONS } from '@/domain/catalogue'
import type { LostReason, PipelineStageDef } from '@/domain/types'
import { useDb } from '@/hooks/use-db'
import { stageTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { updateSettings } from '@/services/settings'
import { LOCKED_STAGES, lostReasonRows, moveItem, validateStages } from '../lib/settings-logic'
import { SaveBar } from './save-bar'

export function PipelineSection() {
  const { t } = useTranslation(['settings', 'catalogue'])
  const saved = useDb((db) => db.settings.pipeline)
  const [stages, setStages] = useState<PipelineStageDef[]>(saved.stages)
  const [reasons, setReasons] = useState(() => lostReasonRows(LOST_REASONS, saved.lostReasons))
  const [base, setBase] = useState(saved)
  // a save (or Undo) elsewhere replaces the draft with the stored value
  if (base !== saved) {
    setBase(saved)
    setStages(saved.stages)
    setReasons(lostReasonRows(LOST_REASONS, saved.lostReasons))
  }

  const sorted = [...stages].sort((a, b) => a.order - b.order)
  const errors = validateStages(stages)
  const err = (field: string) => errors.find((e) => e.field === field)
  const enabledReasons = reasons.filter((r) => r.on).map((r) => r.reason)
  const valid = !errors.length && enabledReasons.length > 0
  const dirty = JSON.stringify(stages) !== JSON.stringify(saved.stages) || JSON.stringify(enabledReasons) !== JSON.stringify(saved.lostReasons)
  const patch = (key: PipelineStageDef['key'], p: Partial<PipelineStageDef>) => setStages((list) => list.map((s) => (s.key === key ? { ...s, ...p } : s)))

  const save = () => {
    try {
      const clean = stages.map((s) => ({ ...s, label: s.label?.trim() ? s.label.trim() : undefined }))
      const r = updateSettings('pipeline', { stages: clean, lostReasons: enabledReasons as LostReason[] })
      toastUndo(t('settings:pipeline.saved'), r.undoToken)
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        title={t('settings:pipeline.stagesTitle')} description={t('settings:pipeline.stagesBody')}
        action={<Button variant="ghost" size="sm" onClick={() => setStages(DEFAULT_STAGE_DEFS.map((s) => ({ ...s })))}><RotateCcw aria-hidden="true" />{t('settings:pipeline.defaults')}</Button>}
      >
        <div className="hidden grid-cols-[minmax(10rem,1.4fr)_minmax(8rem,1.4fr)_5rem_6rem_6rem] gap-3 px-1 pb-2 text-label font-semibold tracking-[0.04em] text-muted-foreground uppercase md:grid [:lang(ta)_&]:tracking-normal [:lang(ta)_&]:normal-case">
          <span>{t('settings:pipeline.col.stage')}</span><span>{t('settings:pipeline.col.label')}</span><span>{t('settings:pipeline.col.on')}</span><span>{t('settings:pipeline.col.days')}</span><span>{t('settings:pipeline.col.probability')}</span>
        </div>
        <ol className="flex flex-col divide-y" data-testid="stage-list">
          {sorted.map((s) => {
            const locked = LOCKED_STAGES.includes(s.key)
            const closedEnd = s.key === 'converted' || s.key === 'lost'
            const tone = stageTone[s.key]
            const Icon = tone.icon
            return (
              <li key={s.key} className={cn('grid grid-cols-2 items-center gap-3 py-3 md:grid-cols-[minmax(10rem,1.4fr)_minmax(8rem,1.4fr)_5rem_6rem_6rem]', !s.enabled && 'opacity-60')}>
                <span className="col-span-2 flex items-center gap-2 md:col-span-1">
                  <span aria-hidden="true" className={cn('flex size-7 items-center justify-center rounded-md text-foreground', tone.soft)}>{Icon && <Icon className="size-3.5" />}</span>
                  <span className="text-sm font-medium">{t(`catalogue:stage.${s.key}`)}</span>
                </span>
                <label className="col-span-2 flex flex-col gap-1 md:col-span-1">
                  <span className="text-meta text-muted-foreground md:sr-only">{t('settings:pipeline.col.label')}</span>
                  <Input value={s.label ?? ''} placeholder={t(`catalogue:stage.${s.key}`)} onChange={(e) => patch(s.key, { label: e.target.value })} aria-invalid={!!err(`${s.key}.label`)} maxLength={41} aria-label={t('settings:pipeline.renameAria', { stage: t(`catalogue:stage.${s.key}`) })} />
                </label>
                <span className="flex items-center gap-2">
                  <span className="text-meta text-muted-foreground md:sr-only">{t('settings:pipeline.col.on')}</span>
                  {locked ? (
                    <Tooltip>
                      <TooltipTrigger asChild><span tabIndex={0} className="inline-flex items-center gap-1 text-meta text-muted-foreground"><Lock className="size-3" aria-hidden="true" />{t('settings:pipeline.always')}</span></TooltipTrigger>
                      <TooltipContent>{t('settings:pipeline.lockedTip')}</TooltipContent>
                    </Tooltip>
                  ) : <Switch checked={s.enabled} onCheckedChange={(on) => patch(s.key, { enabled: on })} aria-label={t('settings:pipeline.enableAria', { stage: t(`catalogue:stage.${s.key}`) })} />}
                </span>
                <label className="flex flex-col gap-1">
                  <span className="text-meta text-muted-foreground md:sr-only">{t('settings:pipeline.col.days')}</span>
                  {closedEnd ? <span className="text-meta text-muted-foreground">–</span> : (
                    <Input type="number" inputMode="numeric" min={0} max={365} value={s.targetDays} onChange={(e) => patch(s.key, { targetDays: e.target.value === '' ? 0 : Number(e.target.value) })} aria-invalid={!!err(`${s.key}.targetDays`)} className="w-20" aria-label={t('settings:pipeline.daysAria', { stage: t(`catalogue:stage.${s.key}`) })} />
                  )}
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-meta text-muted-foreground md:sr-only">{t('settings:pipeline.col.probability')}</span>
                  {closedEnd ? <span className="text-meta tabular-nums text-muted-foreground">{Math.round(s.probability * 100)}%</span> : (
                    <span className="flex items-center gap-1">
                      <Input type="number" inputMode="numeric" min={0} max={100} value={Math.round(s.probability * 100)} onChange={(e) => patch(s.key, { probability: e.target.value === '' ? 0 : Number(e.target.value) / 100 })} aria-invalid={!!err(`${s.key}.probability`)} className="w-20" aria-label={t('settings:pipeline.probAria', { stage: t(`catalogue:stage.${s.key}`) })} />
                      <span className="text-meta text-muted-foreground">%</span>
                    </span>
                  )}
                </label>
              </li>
            )
          })}
        </ol>
        {/* probability as a strip so the shape of the funnel is visible at a glance */}
        <div className="mt-4 flex h-2 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={t('settings:pipeline.stripAria')}>
          {sorted.filter((s) => s.enabled && s.key !== 'lost').map((s) => <span key={s.key} className={stageTone[s.key].solid} style={{ flex: Math.max(0.05, s.probability) }} />)}
        </div>
      </SectionCard>

      <SectionCard title={t('settings:pipeline.lostTitle')} description={t('settings:pipeline.lostBody')}>
        <ol className="flex flex-col gap-1.5" data-testid="lost-reasons">
          {reasons.map((r, i) => (
            <li key={r.reason} className={cn('flex items-center gap-3 rounded-md border px-3 py-2', !r.on && 'bg-muted/40 text-muted-foreground')}>
              <Switch
                checked={r.on} aria-label={t(`catalogue:lostReason.${r.reason}`)}
                onCheckedChange={(on) => setReasons((list) => {
                  const next = list.map((x) => (x.reason === r.reason ? { ...x, on } : x))
                  return [...next.filter((x) => x.on), ...next.filter((x) => !x.on)]
                })}
              />
              <span className="flex-1 text-sm">{t(`catalogue:lostReason.${r.reason}`)}</span>
              {r.on && (
                <span className="flex items-center gap-0.5">
                  <Button variant="ghost" size="icon-xs" disabled={i === 0} onClick={() => setReasons((l) => moveItem(l, i, i - 1))} aria-label={t('settings:pipeline.up')}><ArrowUp aria-hidden="true" /></Button>
                  <Button variant="ghost" size="icon-xs" disabled={i === enabledReasons.length - 1} onClick={() => setReasons((l) => moveItem(l, i, i + 1))} aria-label={t('settings:pipeline.down')}><ArrowDown aria-hidden="true" /></Button>
                </span>
              )}
            </li>
          ))}
        </ol>
        {!enabledReasons.length && <p className="mt-2 text-xs text-danger">{t('settings:pipeline.needOneReason')}</p>}
      </SectionCard>

      <SaveBar
        dirty={dirty} valid={valid} onSave={save} testId="pipeline-save" className="sticky bottom-20 z-10 rounded-lg border bg-card/95 p-3 shadow-md backdrop-blur md:bottom-4"
        onDiscard={() => {
          setStages(saved.stages)
          setReasons(lostReasonRows(LOST_REASONS, saved.lostReasons))
        }}
      />
    </div>
  )
}
