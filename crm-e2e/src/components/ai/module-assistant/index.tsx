/**
 * <ModuleAssistant module=…> — the one shared, reusable assistant (master prompt §12.2), configured for the ten module
 * assistants. Module owners mount it where it fits (in a form with `onFill`, on a record page with the record id, on a
 * dashboard) and the global panel's Tools tab shows the ones relevant to the page. Every result carries the Demo AI
 * badge; every change is a proposal the user confirms (and can undo for 10 s).
 *
 *   <ModuleAssistant module="leadCreate" onFill={fillForm} onAnswer={answer} />      // Add Lead form (paste and fill)
 *   <ModuleAssistant module="leadEdit" leadId={lead.id} />                            // "budget now 1.5 Cr, wants 4BHK"
 *   <ModuleAssistant module="leadQualify" leadId={lead.id} />                         // budget / decision maker / need / timeline
 *   <ModuleAssistant module="propertyCreate" onFill={fillForm} />                     // owner's listing message
 *   <ModuleAssistant module="propertyEdit" propertyId={p.id} />                       // "price reduced to 1.15 Cr, on hold"
 *   <ModuleAssistant module="propertyMatch" leadId={lead.id} />  (or propertyId)      // ranked matches → share / shortlist
 *   <ModuleAssistant module="appointmentCreate" leadId={lead.id} />                   // "site visit tomorrow 5pm at Prestige"
 *   <ModuleAssistant module="followUp" leadId={lead.id} />                            // best time + drafted message
 *   <ModuleAssistant module="import" kind="leads" onMapping={useMapping} />           // sheet columns → fields
 *   <ModuleAssistant module="insights" scope="team" />                                // dashboard insights
 */
import { useEffect, useState } from 'react'
import { ChartNoAxesCombined, MessageSquareText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAI } from '@/ai'
import { MODULE_ASSISTANTS, type ModuleAssistantKey } from '@/ai/modules'
import type { CommandPlan } from '@/ai/types'
import { Button } from '@/components/ui/button'
import type { ID } from '@/domain/types'
import { useCurrentUser } from '@/hooks/use-current-user'
import { usePermission } from '@/hooks/use-permission'
import { AnswerBody, FollowUpChips } from '../ai-answer'
import { askAssistant } from '../chat-store'
import {
  AppointmentCreateAssistant, ImportAssistant, LeadCreateAssistant, PropertyCreateAssistant,
  type AppointmentCreateProps, type ImportAssistProps, type LeadCreateProps, type PropertyCreateProps,
} from './create-assistants'
import { AssistantShell, AssistError, Thinking } from './parts'
import { useAssistCall } from './use-assist-call'
import { FollowUpAssistant, LeadQualifyAssistant, PropertyMatchAssistant, RecordEditAssistant } from './record-assistants'

type Common = { compact?: boolean; className?: string }

export type ModuleAssistantProps = Common & (
  | ({ module: 'leadCreate' } & LeadCreateProps)
  | { module: 'leadEdit'; leadId?: ID; defaultText?: string }
  | { module: 'leadQualify'; leadId?: ID }
  | ({ module: 'propertyCreate' } & PropertyCreateProps)
  | { module: 'propertyEdit'; propertyId?: ID; defaultText?: string }
  | { module: 'propertyMatch'; leadId?: ID; propertyId?: ID }
  | ({ module: 'appointmentCreate' } & AppointmentCreateProps)
  | { module: 'followUp'; leadId?: ID }
  | ({ module: 'import' } & ImportAssistProps)
  | { module: 'insights'; scope?: 'personal' | 'team' | 'business' }
)

/** Dashboard / insights: the numbers that matter for the scope, with follow-up questions that open the panel. */
function InsightsAssistant({ scope: scopeProp, compact, className }: { scope?: 'personal' | 'team' | 'business' } & Common) {
  const { t } = useTranslation('ai')
  const { ai, context } = useAI()
  const user = useCurrentUser()
  const { can } = usePermission()
  const scope = scopeProp ?? (user.role === 'admin' ? 'business' : user.role === 'manager' ? 'team' : 'personal')
  const call = useAssistCall<CommandPlan>()
  const { run } = call
  const question = scope === 'business' ? 'Business summary for today' : scope === 'team' && can('team.view') ? 'Summarise team performance this week' : 'How am I doing this month?'
  const [asked, setAsked] = useState(question)
  useEffect(() => {
    void run(() => ai.parseCommand(asked, context()))
  }, [asked, run, ai, context])
  const plan = call.result
  const followUps = [
    ...(plan?.followUps ?? []),
    ...(scope !== 'personal' && can('team.view') ? [{ label: t('followUp.stalled'), command: 'Show stalled deals' }, { label: t('followUp.sources'), command: 'Which source converts best to visits?' }] : []),
    { label: t('followUp.nextCall'), command: 'Who should I call next?' },
  ].filter((f, i, a) => a.findIndex((x) => x.command === f.command) === i).slice(0, 4)
  return (
    <AssistantShell
      icon={ChartNoAxesCombined} title={t('assist.insights.title')} description={t(`assist.insights.body.${scope}`)} mode={plan?.mode ?? ai.mode}
      compact={compact} className={className} testId="assistant-insights"
      action={<Button variant="ghost" size="sm" onClick={() => askAssistant('', { prefill: true })}><MessageSquareText />{t('assist.insights.ask')}</Button>}
    >
      {call.busy && !plan ? <Thinking /> : call.error ? <AssistError onRetry={call.retry} /> : plan && (
        <div className="flex flex-col gap-3 text-sm">
          <AnswerBody plan={plan} />
          <FollowUpChips items={followUps} onPick={(c) => (c === question || c === asked ? setAsked(c) : askAssistant(c))} />
        </div>
      )}
    </AssistantShell>
  )
}

export function ModuleAssistant(props: ModuleAssistantProps) {
  const { can } = usePermission()
  if (!can(MODULE_ASSISTANTS[props.module].permission)) return null
  switch (props.module) {
    case 'leadCreate': return <LeadCreateAssistant {...props} />
    case 'leadEdit': return <RecordEditAssistant kind="lead" id={props.leadId} compact={props.compact} className={props.className} defaultText={props.defaultText} />
    case 'leadQualify': return <LeadQualifyAssistant leadId={props.leadId} compact={props.compact} className={props.className} />
    case 'propertyCreate': return <PropertyCreateAssistant {...props} />
    case 'propertyEdit': return <RecordEditAssistant kind="property" id={props.propertyId} compact={props.compact} className={props.className} defaultText={props.defaultText} />
    case 'propertyMatch': return <PropertyMatchAssistant leadId={props.leadId} propertyId={props.propertyId} compact={props.compact} className={props.className} />
    case 'appointmentCreate': return <AppointmentCreateAssistant {...props} />
    case 'followUp': return <FollowUpAssistant leadId={props.leadId} compact={props.compact} className={props.className} />
    case 'import': return <ImportAssistant {...props} />
    case 'insights': return <InsightsAssistant scope={props.scope} compact={props.compact} className={props.className} />
  }
}

export type { ModuleAssistantKey }
