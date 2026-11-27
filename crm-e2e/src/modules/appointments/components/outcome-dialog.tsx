/**
 * Complete an appointment with its outcome (master prompt §16; ROLE_RESEARCH §1.3 #5: liked units, objections, decision
 * maker present, next step). Manual form plus "Describe the visit" (type or speak a note, the AI fills the form and marks
 * the fields). The AI suggestion card proposes the next follow-up time and the stage; "Apply" fills those fields, and
 * nothing is saved until Save. Saving completes the appointment and moves the stage in one commit with Undo; the
 * post-visit call task follows from the foundation's E7 effect (due at the chosen follow-up time, or in 24 h).
 */
import { useMemo, useState } from 'react'
import { Check, CircleHelp, Hourglass, Loader2, Sparkles, ThumbsDown, ThumbsUp, Wand2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { paths } from '@/app/paths'
import { AIField, AIFieldMarker } from '@/components/ai/ai-field'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { useAIFields } from '@/components/ai/use-ai-fields'
import { VoiceButton } from '@/components/ai/voice-button'
import { ToneBadge } from '@/components/shared/badges'
import { Chip } from '@/components/shared/chip'
import { DateTimeField } from '@/components/shared/date-time-field'
import { FormField } from '@/components/shared/form-field'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { OPEN_STAGES, STAGE_RANK } from '@/domain/catalogue'
import type { Appointment, PipelineStageKey, VisitOutcome } from '@/domain/types'
import { useDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { fmtDateTime } from '@/lib/format'
import { stageTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { completeAppointmentWithStage } from '@/services/appointments'
import { readOutcomeNotes, suggestAfterOutcome, summaryText, type OutcomeDraft } from '../lib/visit-ai'

type Result = VisitOutcome['result']
const RESULTS: { key: Result; icon: typeof Check; on: string }[] = [
  { key: 'interested', icon: ThumbsUp, on: 'border-success bg-success-soft text-success' },
  { key: 'thinking', icon: Hourglass, on: 'border-warning bg-warning-soft text-warning' },
  { key: 'notInterested', icon: ThumbsDown, on: 'border-danger bg-danger-soft text-danger' },
  { key: 'readyToBook', icon: Check, on: 'border-primary bg-primary-soft text-primary' },
]
const INTEREST = ['high', 'medium', 'low'] as const
const KEEP = 'keep'

export function OutcomeDialog({ appointment: a, open, onOpenChange, onDone }: {
  appointment: Appointment
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone?: () => void
}) {
  const { t, i18n } = useTranslation(['appointments', 'catalogue', 'common', 'ai'])
  const now = useNow()
  const { can } = usePermission()
  const lead = useDb((db) => db.leads.find((l) => l.id === a.leadId))
  const allProps = useDb((db) => db.properties)
  const props = useMemo(() => a.propertyIds.map((id) => allProps.find((p) => p.id === id)).filter((p) => !!p), [a.propertyIds, allProps])
  const ai = useAIFields()
  const [result, setResult] = useState<Result | undefined>()
  const [interest, setInterest] = useState<OutcomeDraft['interest']>()
  const [liked, setLiked] = useState<string[]>([])
  const [objections, setObjections] = useState('')
  const [dm, setDm] = useState<boolean | undefined>()
  const [nextStep, setNextStep] = useState('')
  const [followUpAt, setFollowUpAt] = useState<string | undefined>()
  const [stage, setStage] = useState<string>(KEEP)
  const [summary, setSummary] = useState('')
  const [notes, setNotes] = useState('')
  const [notesOpen, setNotesOpen] = useState(false)
  const [reading, setReading] = useState(false)
  const [missing, setMissing] = useState(false)

  const draft: OutcomeDraft | undefined = result ? { result, interest, likedPropertyIds: liked, objections, decisionMakerPresent: dm, nextStep } : undefined
  const suggestion = draft && lead ? suggestAfterOutcome({ outcome: draft, type: a.type, stage: lead.stage, now }) : undefined
  const mayMove = lead ? can('lead.moveStage', lead) : false
  // Completing a site visit moves an open lead to at least "Site visit done" on its own (E7), so that is what the
  // "no manual pick" option really saves: label it and offer only stages beyond it, never "Keep <current stage>".
  const baseStage: PipelineStageKey | undefined = lead
    ? a.type === 'siteVisit' && OPEN_STAGES.includes(lead.stage) && STAGE_RANK[lead.stage] < STAGE_RANK.siteVisitDone ? 'siteVisitDone' : lead.stage
    : undefined
  const stageOptions = baseStage ? OPEN_STAGES.filter((s) => STAGE_RANK[s] > STAGE_RANK[baseStage] && s !== 'booked') : []

  const applySuggestion = () => {
    if (!suggestion) return
    setFollowUpAt(suggestion.followUpAt)
    const meta: Record<string, { origin: 'ai'; confidence: number }> = { followUpAt: { origin: 'ai', confidence: 0.85 } }
    if (suggestion.stage && mayMove) { setStage(suggestion.stage === baseStage ? KEEP : suggestion.stage); meta.stage = { origin: 'ai', confidence: 0.8 } }
    if (!nextStep.trim()) { setNextStep(t(`appointments:ai.${suggestion.nextStepKey}`)); meta.nextStep = { origin: 'ai', confidence: 0.7 } }
    ai.apply(meta)
  }

  const readNotes = () => {
    setReading(true)
    // A short pause so the user sees the assistant working (the read itself is instant and local).
    window.setTimeout(() => {
      const r = readOutcomeNotes(notes, props)
      const f = r.fields
      if (f.result) setResult(f.result)
      if (f.interest) setInterest(f.interest)
      if (f.likedPropertyIds) setLiked(f.likedPropertyIds)
      if (f.objections) setObjections(f.objections)
      if (f.decisionMakerPresent !== undefined) setDm(f.decisionMakerPresent)
      if (f.nextStep) setNextStep(f.nextStep)
      if (!summary.trim()) setSummary(notes.trim())
      ai.apply(Object.fromEntries(Object.entries(r.confidence).map(([k, c]) => [k, { origin: 'ai' as const, confidence: c }])))
      setReading(false)
      setMissing(!f.result)
    }, 350)
  }

  const writeSummary = () => {
    if (!draft) return
    const titles = liked.map((id) => props.find((p) => p.id === id)?.title).filter((x): x is string => !!x)
    setSummary(summaryText(draft, titles, lead?.name))
    ai.apply({ summary: { origin: 'ai', confidence: 0.9 } })
  }

  const save = () => {
    if (!result) { setMissing(true); return }
    try {
      const r = completeAppointmentWithStage(a.id, {
        result, interest, likedPropertyIds: liked, objections: objections.trim() || undefined, decisionMakerPresent: dm,
        nextStep: nextStep.trim() || undefined, nextFollowUpAt: followUpAt, summary: summary.trim() || undefined,
      }, stage !== KEEP ? (stage as PipelineStageKey) : undefined, { via: ai.count ? 'ai' : 'manual' })
      toastUndo(t('appointments:outcome.saved'), r.undoToken, {
        description: a.type === 'siteVisit' || followUpAt
          ? t('appointments:outcome.followUpCreated', { when: fmtDateTime(followUpAt ?? new Date(now.getTime() + 86_400_000).toISOString(), i18n.language) })
          : undefined,
      })
      onOpenChange(false)
      onDone?.()
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl" data-testid="outcome-dialog">
        <DialogHeader>
          <DialogTitle>{t('appointments:outcome.title')}</DialogTitle>
          <DialogDescription>
            {t('appointments:outcome.body', { type: t(`catalogue:appointmentType.${a.type}`), name: lead?.name ?? t('appointments:noLead'), when: fmtDateTime(a.start, i18n.language) })}
          </DialogDescription>
        </DialogHeader>

        <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="text-ai hover:bg-ai-soft hover:text-ai"><Sparkles />{t('appointments:outcome.describe')}</Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="flex flex-col gap-2 rounded-xl border border-dashed border-ai-border bg-ai-soft/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-meta text-muted-foreground">{t('appointments:outcome.describeHint')}</p>
                <DemoAIBadge mode="simulated" />
              </div>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder={t('appointments:outcome.describePlaceholder')} aria-label={t('appointments:outcome.describe')} />
              <div className="flex items-center gap-2">
                <VoiceButton size="icon-sm" onText={(text, final) => { if (final) setNotes((n) => (n ? `${n} ${text}` : text)) }} />
                <Button type="button" variant="ai" size="sm" onClick={readNotes} disabled={!notes.trim() || reading} aria-busy={reading || undefined} data-testid="outcome-extract">
                  {reading ? <Loader2 className="animate-spin" /> : <Wand2 />}{t('appointments:outcome.extract')}
                </Button>
                {ai.count > 0 && <span className="text-meta text-ai">{t('appointments:outcome.filled', { count: ai.count })}</span>}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="flex flex-col gap-4">
          <AIField meta={ai.get('result')}>
            <FormField label={t('appointments:outcome.result')} required error={missing && !result ? t('appointments:outcome.resultRequired') : undefined} labelEnd={<AIFieldMarker meta={ai.get('result')} />}>
              {({ describedBy }) => (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={t('appointments:outcome.result')} aria-describedby={describedBy}>
                  {RESULTS.map((o) => {
                    const Icon = o.icon
                    return (
                      <button key={o.key} type="button" role="radio" aria-checked={result === o.key} data-testid={`result-${o.key}`}
                        onClick={() => { setResult(o.key); ai.clear('result'); setMissing(false) }}
                        className={cn('flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                          result === o.key ? cn(o.on, 'font-medium') : 'hover:bg-muted')}>
                        <Icon className="size-4" aria-hidden="true" />{t(`appointments:result.${o.key}`)}
                      </button>
                    )
                  })}
                </div>
              )}
            </FormField>
          </AIField>

          <div className="grid gap-4 sm:grid-cols-2">
            <AIField meta={ai.get('interest')}>
              <FormField label={t('appointments:outcome.interest')} optional labelEnd={<AIFieldMarker meta={ai.get('interest')} />}>
                {() => (
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('appointments:outcome.interest')}>
                    {INTEREST.map((k) => <Chip key={k} pressed={interest === k} onClick={() => { setInterest(interest === k ? undefined : k); ai.clear('interest') }}>{t(`appointments:interest.${k}`)}</Chip>)}
                  </div>
                )}
              </FormField>
            </AIField>
            <AIField meta={ai.get('decisionMakerPresent')}>
              <FormField label={t('appointments:outcome.dm')} optional labelEnd={<AIFieldMarker meta={ai.get('decisionMakerPresent')} />}>
                {() => (
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('appointments:outcome.dm')}>
                    <Chip pressed={dm === true} onClick={() => { setDm(dm === true ? undefined : true); ai.clear('decisionMakerPresent') }}>{t('appointments:yes')}</Chip>
                    <Chip pressed={dm === false} onClick={() => { setDm(dm === false ? undefined : false); ai.clear('decisionMakerPresent') }}>{t('appointments:no')}</Chip>
                  </div>
                )}
              </FormField>
            </AIField>
          </div>

          {props.length > 0 && (
            <AIField meta={ai.get('likedPropertyIds')}>
              <FormField label={t('appointments:outcome.liked')} optional labelEnd={<AIFieldMarker meta={ai.get('likedPropertyIds')} />}>
                {() => (
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('appointments:outcome.liked')}>
                    {props.map((p) => (
                      <Chip key={p.id} pressed={liked.includes(p.id)} onClick={() => { setLiked(liked.includes(p.id) ? liked.filter((x) => x !== p.id) : [...liked, p.id]); ai.clear('likedPropertyIds') }}>
                        {p.title}
                      </Chip>
                    ))}
                  </div>
                )}
              </FormField>
            </AIField>
          )}

          <AIField meta={ai.get('objections')}>
            <FormField label={t('appointments:outcome.objections')} optional labelEnd={<AIFieldMarker meta={ai.get('objections')} />}>
              {({ id }) => <Textarea id={id} value={objections} rows={2} onChange={(e) => { setObjections(e.target.value); ai.clear('objections') }} placeholder={t('appointments:outcome.objectionsPlaceholder')} />}
            </FormField>
          </AIField>
          <AIField meta={ai.get('nextStep')}>
            <FormField label={t('appointments:outcome.nextStep')} optional labelEnd={<AIFieldMarker meta={ai.get('nextStep')} />}>
              {({ id }) => <Input id={id} value={nextStep} onChange={(e) => { setNextStep(e.target.value); ai.clear('nextStep') }} />}
            </FormField>
          </AIField>

          {suggestion && (
            <section data-testid="outcome-suggestion" aria-label={t('appointments:outcome.suggestionTitle')} className="flex flex-col gap-2 rounded-xl border border-ai-border bg-ai-soft/40 p-3">
              <header className="flex items-center gap-2">
                <Sparkles className="size-4 text-ai" aria-hidden="true" />
                <h3 className="flex-1 text-sm font-semibold">{t('appointments:outcome.suggestionTitle')}</h3>
                <DemoAIBadge mode="simulated" />
              </header>
              <p className="text-sm">{t(`appointments:ai.${suggestion.reasonKey}`, suggestion.params ?? {})}</p>
              <div className="flex flex-wrap items-center gap-2 text-meta">
                <span className="rounded-md bg-card px-2 py-1 tabular-nums shadow-xs">{t('appointments:outcome.suggestFollowUp', { when: fmtDateTime(suggestion.followUpAt, i18n.language) })}</span>
                {suggestion.stage && (
                  <ToneBadge classes={stageTone[suggestion.stage]} icon={stageTone[suggestion.stage].icon}>{t('appointments:outcome.suggestStage', { stage: t(`catalogue:stage.${suggestion.stage}`) })}</ToneBadge>
                )}
                {suggestion.stage && !mayMove && <span className="text-muted-foreground">{t('appointments:outcome.stageNotAllowed')}</span>}
                <Button type="button" size="sm" variant="ai" className="ml-auto" onClick={applySuggestion} data-testid="apply-suggestion"><Wand2 />{t('appointments:outcome.apply')}</Button>
              </div>
              {result === 'readyToBook' && lead && (
                <p className="flex items-center gap-1.5 text-meta text-muted-foreground">
                  <CircleHelp className="size-3.5" aria-hidden="true" />
                  {t('appointments:outcome.bookHint')} <Link to={paths.lead(lead.id)} className="font-medium text-primary hover:underline">{t('appointments:outcome.openLead')}</Link>
                </p>
              )}
            </section>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <AIField meta={ai.get('followUpAt')}>
              <FormField label={t('appointments:outcome.followUp')} optional hint={a.type === 'siteVisit' ? t('appointments:outcome.followUpHint') : undefined} labelEnd={<AIFieldMarker meta={ai.get('followUpAt')} />}>
                {({ id, describedBy }) => <DateTimeField id={id} value={followUpAt} onChange={(v) => { setFollowUpAt(v); ai.clear('followUpAt') }} describedBy={describedBy} now={now} />}
              </FormField>
            </AIField>
            {lead && baseStage && mayMove && (
              <AIField meta={ai.get('stage')}>
                <FormField label={t('appointments:outcome.stage')} optional labelEnd={<AIFieldMarker meta={ai.get('stage')} />}>
                  {({ id }) => (
                    <Select value={stage} onValueChange={(v) => { setStage(v); ai.clear('stage') }}>
                      <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={KEEP}>
                          {baseStage === lead.stage
                            ? t('appointments:outcome.keepStage', { stage: t(`catalogue:stage.${lead.stage}`) })
                            : t('appointments:outcome.autoStage', { stage: t(`catalogue:stage.${baseStage}`) })}
                        </SelectItem>
                        {stageOptions.map((s) => <SelectItem key={s} value={s}>{t(`catalogue:stage.${s}`)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </FormField>
              </AIField>
            )}
          </div>

          <AIField meta={ai.get('summary')}>
            <FormField label={t('appointments:outcome.summary')} optional labelEnd={
              <span className="ml-auto flex items-center gap-1.5">
                <AIFieldMarker meta={ai.get('summary')} />
                <Button type="button" variant="ghost" size="xs" className="text-ai hover:bg-ai-soft hover:text-ai" disabled={!draft} onClick={writeSummary}><Sparkles />{t('appointments:outcome.writeSummary')}</Button>
              </span>
            }>
              {({ id }) => <Textarea id={id} value={summary} rows={3} onChange={(e) => { setSummary(e.target.value); ai.clear('summary') }} />}
            </FormField>
          </AIField>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>{t('common:actions.cancel')}</Button>
          <Button onClick={save} data-testid="outcome-save"><Check />{t('appointments:outcome.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
