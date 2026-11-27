/**
 * The Follow-up Assistant (master prompt §12 "suggests timing + drafts messages"): for one task, or for the open
 * follow-ups that need attention most (overdue first, then today), it suggests WHEN to follow up and on WHICH channel
 * with the reason, and drafts the message with the AI service. "Use this time" moves the task (Undo); "Send on
 * WhatsApp" opens wa.me with the draft and logs the contact; "Apply all times" moves every listed task at once.
 * Simulated AI: every suggestion shows the Demo AI badge. Nothing changes until the user clicks.
 */
import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, ChevronDown, Loader2, MessageCircle, Phone, Sparkles, Wand2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useAI } from '@/ai'
import type { AIMode } from '@/ai/types'
import { paths } from '@/app/paths'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { Drawer } from '@/components/shared/drawer'
import { EmptyState } from '@/components/shared/empty-state'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { EmptyTasks } from '@/components/illustrations'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { Lead, Task } from '@/domain/types'
import { useWholeDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { fmtDateTime } from '@/lib/format'
import { leadScore } from '@/lib/scoring'
import { cn } from '@/lib/utils'
import { telLink, waLink } from '@/lib/whatsapp'
import { logContact } from '@/services/activities'
import { rescheduleTasks } from '@/services/tasks'
import { differsFromDue, suggestFollowUp, type FollowUpSuggestion } from '../lib/follow-up'

type Item = { task: Task; lead?: Lead; s: FollowUpSuggestion }

function useFollowUpSuggestions(tasks: Task[]): Item[] {
  const db = useWholeDb()
  const now = useNow()
  return useMemo(() => tasks.map((task) => {
    const lead = db.leads.find((l) => l.id === task.leadId)
    const temperature = lead ? (lead.temperatureOverride ?? leadScore(lead, { properties: db.properties, settings: db.settings, now }).temperature) : undefined
    return { task, lead, s: suggestFollowUp({ task, lead, temperature, tasks: db.tasks, appointments: db.appointments, now }) }
  }), [tasks, db, now])
}

export function FollowUpAssistant({ open, onOpenChange, tasks, focusId }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  /** The open tasks to advise on (already ranked). */
  tasks: Task[]
  /** One task the user asked about: shown alone. */
  focusId?: string
}) {
  const { t, i18n } = useTranslation('tasks')
  const { can } = usePermission()
  const list = focusId ? tasks.filter((x) => x.id === focusId) : tasks.slice(0, 8)
  const items = useFollowUpSuggestions(list)
  const movable = items.filter((i) => can('task.manage', i.task) && differsFromDue(i.s, i.task.dueAt))

  const applyAll = () => {
    try {
      const map = new Map(movable.map((i) => [i.task.id, i.s.at]))
      const r = rescheduleTasks([...map.keys()], (x) => map.get(x.id) ?? x.dueAt, { via: 'ai' })
      toastUndo(t('assistant.appliedAll', { count: r.result }), r.undoToken)
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={<span className="flex items-center gap-2"><Sparkles className="size-4 text-ai" aria-hidden="true" />{t('assistant.title')}</span>}
      subtitle={t('assistant.subtitle')}
      headerActions={<DemoAIBadge mode="simulated" />}
      footer={!focusId && movable.length > 1 ? (
        <>
          <span className="text-meta text-muted-foreground">{t('assistant.applyAllHint', { count: movable.length })}</span>
          <Button variant="ai" onClick={applyAll} data-testid="assistant-apply-all"><Wand2 />{t('assistant.applyAll', { count: movable.length })}</Button>
        </>
      ) : undefined}
    >
      {items.length === 0 ? (
        <EmptyState compact illustration={EmptyTasks} title={t('assistant.emptyTitle')} body={t('assistant.emptyBody')} />
      ) : (
        <ul className="flex flex-col gap-3" data-testid="assistant-list">
          {items.map((i, idx) => <SuggestionCard key={i.task.id} item={i} defaultOpen={idx === 0 || !!focusId} locale={i18n.language} />)}
        </ul>
      )}
    </Drawer>
  )
}

function SuggestionCard({ item: { task, lead, s }, defaultOpen, locale }: { item: Item; defaultOpen: boolean; locale: string }) {
  const { t } = useTranslation(['tasks', 'catalogue'])
  const { ai, context } = useAI()
  const { can } = usePermission()
  const now = useNow()
  const [expanded, setExpanded] = useState(defaultOpen)
  // The draft is keyed by lead + purpose; it is written when the card is first opened and kept while editing.
  const [result, setResult] = useState<{ key: string; text: string; mode: AIMode } | null>(null)
  const [edited, setEdited] = useState<{ key: string; text: string } | null>(null)
  const mayMove = can('task.manage', task)
  const overdue = task.dueAt < now.toISOString()
  const moves = differsFromDue(s, task.dueAt)
  const leadId = lead?.id
  const key = `${leadId ?? ''}|${s.purpose}|${s.appointmentId ?? ''}`
  const loading = expanded && !!leadId && result?.key !== key
  const draft = edited?.key === key ? edited.text : result?.key === key ? result.text : ''
  const mode = result?.mode ?? ai.mode
  const setDraft = (text: string) => setEdited({ key, text })

  useEffect(() => {
    if (!expanded || !leadId) return
    let live = true
    ai.generateMessage({ leadId, purpose: s.purpose, channel: 'whatsapp', tone: 'english', appointmentId: s.appointmentId }, context())
      .then((r) => { if (live) setResult({ key, text: r.text, mode: r.mode }) }, (e: unknown) => { if (live) { setResult({ key, text: '', mode: 'simulated' }); toastError(e) } })
    return () => { live = false }
  }, [expanded, leadId, key, s.purpose, s.appointmentId, ai, context])

  const useTime = () => {
    try {
      const r = rescheduleTasks([task.id], s.at, { via: 'ai' })
      toastUndo(t('assistant.applied', { when: fmtDateTime(s.at, locale) }), r.undoToken)
    } catch (e) {
      toastError(e)
    }
  }
  const sent = () => {
    if (!lead || !can('lead.edit', lead)) return
    try {
      logContact(lead.id, { channel: 'whatsapp', text: draft.slice(0, 280) }, { via: 'ai' })
    } catch (e) {
      toastError(e)
    }
  }
  const ChannelIcon = s.channel === 'whatsapp' ? MessageCircle : Phone

  return (
    <li className={cn('rounded-xl border bg-card shadow-xs', overdue && 'border-l-[3px] border-l-danger')} data-testid="assistant-card">
      <button type="button" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}
        className="flex w-full items-start gap-3 p-3 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md', s.channel === 'whatsapp' ? 'bg-success-soft text-success' : 'bg-primary-soft text-primary')}>
          <ChannelIcon className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{task.title}</span>
          <span className="block text-meta text-muted-foreground">{t('assistant.dueNow', { when: fmtDateTime(task.dueAt, locale) })}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-meta">
            <span className="inline-flex items-center gap-1 rounded-md bg-ai-soft px-2 py-0.5 font-medium text-ai tabular-nums">
              <Sparkles className="size-3" aria-hidden="true" />{t('assistant.suggested', { when: fmtDateTime(s.at, locale) })}
            </span>
            <span className="text-muted-foreground">{t(`assistant.channel.${s.channel}`)}</span>
          </span>
        </span>
        <ChevronDown className={cn('mt-1 size-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
      </button>
      {expanded && (
        <div className="flex flex-col gap-3 border-t px-3 pt-3 pb-3">
          <p className="text-sm">{t(`assistant.reason.${s.reasonKey}`, s.params ?? {})}</p>
          {lead ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-meta font-medium">{t('assistant.draft', { purpose: t(`catalogue:messagePurpose.${s.purpose}`) })}</span>
                <DemoAIBadge mode={mode} />
              </div>
              {loading ? (
                <div className="flex h-20 items-center justify-center gap-2 rounded-md bg-muted/40 text-meta text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />{t('assistant.drafting')}</div>
              ) : (
                <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} className="ai-filled" aria-label={t('assistant.draftLabel')} />
              )}
            </>
          ) : (
            <p className="text-meta text-muted-foreground">{t('assistant.noLeadDraft')}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {mayMove && moves && <Button size="sm" variant="ai" onClick={useTime} data-testid="assistant-use-time"><CalendarClock />{t('assistant.useTime')}</Button>}
            {mayMove && !moves && <span className="self-center text-meta text-success">{t('assistant.alreadyGood')}</span>}
            {lead?.phone && draft && (
              <Button asChild size="sm" className="bg-success text-success-foreground hover:bg-success/90">
                <a href={waLink(lead.phone, draft)} target="_blank" rel="noopener noreferrer" onClick={sent}><MessageCircle />{t('assistant.send')}</a>
              </Button>
            )}
            {lead?.phone && <Button asChild size="sm" variant="secondary"><a href={telLink(lead.phone)}><Phone />{t('assistant.call')}</a></Button>}
            {lead && <Button asChild size="sm" variant="ghost"><Link to={paths.lead(lead.id)}>{t('assistant.openLead')}</Link></Button>}
          </div>
        </div>
      )}
    </li>
  )
}
