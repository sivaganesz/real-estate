/**
 * The lead page's main column, top part: the stage steps (click a step to move; Mark as lost on its own), the Next
 * best action card (AI-worded, one click does it), the quick actions (Call, WhatsApp, Schedule visit, Add follow-up,
 * Match properties, Change stage, Reassign / Request reassignment) and the AI summary with the conversion probability.
 */
import { useState } from 'react'
import {
  ArrowRightLeft, CalendarPlus, Check, Hand, ListPlus, Loader2, MessageCircle, Phone, RefreshCw, RotateCcw, Sparkles, Target, UserPlus, XCircle,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useAI } from '@/ai'
import type { AIText, NextActionSuggestion } from '@/ai/types'
import { paths } from '@/app/paths'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { toastError } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import type { ID, Lead, PipelineStageKey } from '@/domain/types'
import { STAGE_RANK, isOpenStage } from '@/domain/catalogue'
import { usePermission } from '@/hooks/use-permission'
import { useDb } from '@/hooks/use-db'
import { fmtDate } from '@/lib/format'
import type { NextAction } from '@/lib/next-action'
import { stageTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { telLink, waLink } from '@/lib/whatsapp'
import { completeTask } from '@/services/tasks'
import { logContact } from '@/services/activities'
import { useAIResult } from './use-ai-result'
import { useLeadDialogs } from './lead-dialogs-context'

const PATH: PipelineStageKey[] = ['new', 'contacted', 'qualified', 'siteVisitScheduled', 'siteVisitDone', 'negotiation', 'booked', 'converted']

export function StageSteps({ lead }: { lead: Lead }) {
  const { t, i18n } = useTranslation(['leads', 'catalogue'])
  const { can } = usePermission()
  const dialogs = useLeadDialogs()
  const lostReason = lead.lost?.reason
  const move = can('lead.moveStage', lead)
  const rank = STAGE_RANK[lead.stage]
  return (
    <section aria-label={t('leads:detail.stages')} className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-card md:p-5" data-testid="stage-steps">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{t('leads:detail.stages')}</h2>
        <div className="flex gap-2">
          {lead.stage === 'lost' && move && (
            <Button size="sm" variant="secondary" onClick={() => dialogs.open({ kind: 'stage', leadId: lead.id, to: 'contacted' })}><RotateCcw />{t('leads:detail.reopen')}</Button>
          )}
          {isOpenStage(lead.stage) && move && (
            <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft hover:text-danger" onClick={() => dialogs.open({ kind: 'stage', leadId: lead.id, to: 'lost' })} data-testid="mark-lost">
              <XCircle />{t('leads:actions.markLost')}
            </Button>
          )}
        </div>
      </div>
      {lead.stage === 'lost' && (
        <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger" role="status">
          {t('leads:detail.lostBanner', { reason: lostReason ? t(`catalogue:lostReason.${lostReason}`) : '—', date: fmtDate(lead.lost?.at, i18n.language) })}
          {lead.lost?.note && <span className="block text-meta text-foreground/80">“{lead.lost.note}”</span>}
        </p>
      )}
      <ol className="grid grid-cols-4 gap-x-1 gap-y-2 2xl:grid-cols-8">
        {PATH.map((s, i) => {
          const done = lead.stage !== 'lost' && STAGE_RANK[s] < rank
          const cur = s === lead.stage
          const tone = stageTone[s]
          return (
            <li key={s} className="min-w-0">
              <button
                type="button" disabled={!move || cur}
                onClick={() => dialogs.open({ kind: 'stage', leadId: lead.id, to: s })}
                aria-current={cur ? 'step' : undefined}
                title={move && !cur ? t('leads:detail.moveTo', { stage: t(`catalogue:stage.${s}`) }) : undefined}
                className="group flex w-full flex-col gap-1.5 rounded-md p-1 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-default"
              >
                <span className={cn('h-2 rounded-full transition-colors', cur || done ? tone.solid : 'bg-muted group-enabled:group-hover:bg-border-strong', cur && 'ring-2 ring-offset-1 ring-offset-card', cur && tone.ring)} />
                <span className={cn('flex items-center gap-1 text-meta leading-tight', cur ? 'font-semibold text-foreground' : done ? 'text-foreground/80' : 'text-muted-foreground')}>
                  {done && <Check className="size-3 shrink-0 text-success" aria-hidden="true" />}
                  <span className="truncate">{i + 1}. {t(`catalogue:stageShort.${s}`)}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/** The rule-based next step, worded by the AI service (its mode drives the badge); the button does it. */
export function NextActionCard({ lead, next }: { lead: Lead; next: NextAction | null }) {
  const { t } = useTranslation(['leads', 'ai'])
  const { ai, context } = useAI()
  const navigate = useNavigate()
  const dialogs = useLeadDialogs()
  const { can } = usePermission()
  const clientId = useDb((db) => db.clients.find((c) => c.leadId === lead.id)?.id)
  const { data: sug } = useAIResult<NextActionSuggestion>(
    isOpenStage(lead.stage) ? `${lead.id}:${lead.updatedAt}:${next?.key ?? ''}` : null,
    () => ai.suggestNextAction(lead.id, context()),
  )
  if (!next) return null
  // the service returns a full i18n key ('leads:next.x'); the rule-based fallback a short one
  const key = sug?.key && sug.key !== 'ai:next.none' ? sug.key : `leads:next.${next.key}`
  const params = sug?.params ?? next.params ?? {}
  const edit = can('lead.edit', lead)

  const run = () => {
    const target = next.targetId as ID | undefined
    switch (next.action) {
      case 'assignLead': return dialogs.open({ kind: 'assign', leadIds: [lead.id] })
      case 'call':
      case 'postVisitCall':
        window.location.href = telLink(lead.phone)
        return dialogs.open({ kind: 'log', leadId: lead.id, channel: 'call' })
      case 'logOutcome':
      case 'openAppointment':
        return target && navigate(paths.appointment(target))
      case 'completeTask':
        if (!target) return
        try {
          completeTask(target)
          toast.success(t('leads:next.done'))
        } catch (e) { toastError(e) }
        return
      case 'collectDocs': return navigate(clientId ? paths.client(clientId) : paths.clients())
      case 'negotiate': return dialogs.open({ kind: 'stage', leadId: lead.id, to: lead.stage === 'negotiation' ? 'booked' : 'negotiation' })
      case 'scheduleVisit': return dialogs.open({ kind: 'visit', leadId: lead.id, propertyIds: target ? [target] : undefined })
      case 'shareProperties': return navigate(paths.matching({ lead: lead.id }))
      case 'createTask': return dialogs.open({ kind: 'task', leadId: lead.id })
    }
  }
  const needsEdit = next.action !== 'assignLead' && next.action !== 'shareProperties' && next.action !== 'collectDocs' && next.action !== 'openAppointment' && next.action !== 'logOutcome'
  const allowed = next.action === 'assignLead' ? can('lead.assign', lead) : needsEdit ? edit : true
  return (
    <section aria-labelledby="nba-title" className="relative overflow-hidden rounded-lg border border-ai-border/70 bg-card p-4 shadow-card md:p-5" data-testid="next-action">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(420px_circle_at_0_0,color-mix(in_oklch,var(--ai)_10%,transparent),transparent_70%)]" />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-ai-gradient text-ai-foreground"><Sparkles className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 id="nba-title" className="flex flex-wrap items-center gap-2 text-label font-semibold tracking-[0.04em] text-ai uppercase [:lang(ta)_&]:normal-case [:lang(ta)_&]:tracking-normal">
            {t('leads:detail.nextBest')}
            <DemoAIBadge mode={ai.mode} />
          </h2>
          <p className="mt-0.5 text-base font-semibold">{t(key, params)}</p>
        </div>
        {allowed && (
          <Button variant="ai" onClick={run} className="shrink-0" data-testid="next-action-do">
            {t(`leads:next.button.${next.action}`)}
          </Button>
        )}
      </div>
    </section>
  )
}

export function QuickActions({ lead, onMatches }: { lead: Lead; onMatches: () => void }) {
  const { t } = useTranslation('leads')
  const { can, scope } = usePermission()
  const dialogs = useLeadDialogs()
  const edit = can('lead.edit', lead)
  const open = isOpenStage(lead.stage)
  const btn = 'flex-col h-auto gap-1 py-2.5 px-2 text-meta min-w-[84px] [&_svg]:size-5'
  return (
    <nav aria-label={t('detail.quickActions')} className="grid grid-cols-4 gap-1.5 rounded-lg border bg-card p-2 shadow-card sm:flex sm:flex-wrap" data-testid="quick-actions">
      {lead.phone && (
        <Button asChild variant="ghost" className={btn}>
          <a href={telLink(lead.phone)} onClick={() => edit && dialogs.open({ kind: 'log', leadId: lead.id, channel: 'call' })}><Phone className="text-primary" />{t('actions.call')}</a>
        </Button>
      )}
      {lead.phone && (
        <Button asChild variant="ghost" className={btn}>
          <a href={waLink(lead.phone)} target="_blank" rel="noopener noreferrer" onClick={() => { if (edit) logContact(lead.id, { channel: 'whatsapp' }) }}>
            <MessageCircle className="text-success" />{t('actions.whatsapp')}
          </a>
        </Button>
      )}
      {open && scope('appointment.manage') !== false && (
        <Button variant="ghost" className={btn} disabled={!edit} onClick={() => dialogs.open({ kind: 'visit', leadId: lead.id })} data-testid="qa-visit"><CalendarPlus className="text-primary" />{t('actions.scheduleVisitShort')}</Button>
      )}
      {open && scope('task.manage') !== false && (
        <Button variant="ghost" className={btn} disabled={!edit} onClick={() => dialogs.open({ kind: 'task', leadId: lead.id })} data-testid="qa-task"><ListPlus className="text-primary" />{t('actions.followUpShort')}</Button>
      )}
      <Button variant="ghost" className={btn} onClick={onMatches}><Target className="text-primary" />{t('actions.matchShort')}</Button>
      {scope('lead.moveStage') !== false && (
        <Button variant="ghost" className={btn} disabled={!can('lead.moveStage', lead)} onClick={() => dialogs.open({ kind: 'stage', leadId: lead.id })}><ArrowRightLeft className="text-primary" />{t('actions.stageShort')}</Button>
      )}
      {scope('lead.assign') !== false && (
        <Button variant="ghost" className={btn} disabled={!can('lead.assign', lead)} onClick={() => dialogs.open({ kind: 'assign', leadIds: [lead.id] })} data-testid="qa-assign">
          <UserPlus className="text-primary" />{lead.ownerId ? t('actions.reassign') : t('actions.assign')}
        </Button>
      )}
      {scope('lead.requestReassign') !== false && (
        <Button variant="ghost" className={btn} disabled={!can('lead.requestReassign', lead)} onClick={() => dialogs.open({ kind: 'requestReassign', leadId: lead.id })} data-testid="qa-request">
          <Hand className="text-primary" />{t('actions.requestShort')}
        </Button>
      )}
    </nav>
  )
}

/** "Customer summary in 2–3 lines" (master prompt §8 AI Lead Intelligence), refreshed on demand and when the lead changes. */
export function AISummaryCard({ lead }: { lead: Lead }) {
  const { t } = useTranslation(['leads', 'ai'])
  const { ai, context } = useAI()
  const [n, setN] = useState(0)
  const { data: res, loading: busy } = useAIResult<AIText>(`${lead.id}:${lead.updatedAt}:${n}`, () => ai.summarize({ kind: 'lead', id: lead.id }, context()))
  return (
    <section aria-labelledby="ai-sum" className="flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-card md:p-5" data-testid="ai-summary">
      <div className="flex items-center gap-2">
        <h2 id="ai-sum" className="flex flex-1 items-center gap-2 text-base font-semibold"><Sparkles className="size-4 text-ai" aria-hidden="true" />{t('leads:detail.aiSummary')}</h2>
        <DemoAIBadge mode={res?.mode ?? ai.mode} />
        <Button variant="ghost" size="icon-sm" onClick={() => setN((x) => x + 1)} aria-label={t('leads:detail.refresh')} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        </Button>
      </div>
      {busy && !res ? (
        <div className="flex flex-col gap-2" aria-busy="true"><div className="skeleton h-3 w-3/4" /><div className="skeleton h-3 w-2/3" /><div className="skeleton h-3 w-1/2" /></div>
      ) : res ? (
        <div className="text-sm">
          <ul className="flex flex-col gap-1">
            {(res.bullets ?? [res.text]).slice(0, 4).map((b) => <li key={b} className="flex gap-2"><span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-ai" />{b}</li>)}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('leads:detail.aiUnavailable')}</p>
      )}
    </section>
  )
}

