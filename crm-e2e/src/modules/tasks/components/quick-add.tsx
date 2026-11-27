/**
 * Quick add (plan §8.3 M4 "quick add: title + due + lead"): one line to type the follow-up, due chips (Later today /
 * Tomorrow / Next week), an optional lead, and Add. "More options" opens the full form with what was typed. The ✦ tab
 * takes plain words instead ("Remind me to call Priya Sharma tomorrow at 5 pm"): the assistant reads them into a task
 * proposal and nothing is created until Confirm.
 */
import { useState } from 'react'
import { Loader2, Plus, SlidersHorizontal, Sparkles, Wand2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAI } from '@/ai'
import type { CommandPlan } from '@/ai/types'
import { ActionProposalCard, type ProposalState } from '@/components/ai/action-proposal-card'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { VoiceButton } from '@/components/ai/voice-button'
import { LeadSelect } from '@/components/domain/lead-select'
import { TaskFormDialog } from '@/components/domain/task-form-dialog'
import { Chip } from '@/components/shared/chip'
import { Segmented } from '@/components/shared/segmented'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { ID } from '@/domain/types'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { fmtDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { executeProposal } from '@/services/commands'
import { createTask } from '@/services/tasks'
import { quickDue } from '../lib/task-lists'

type Preset = 'today' | 'tomorrow' | 'nextWeek'
const PRESETS: Preset[] = ['today', 'tomorrow', 'nextWeek']

export function QuickAdd({ className }: { className?: string }) {
  const { t, i18n } = useTranslation(['tasks', 'domain', 'ai', 'common'])
  const now = useNow()
  const { user, scope } = usePermission()
  const { ai, context } = useAI()
  const [mode, setMode] = useState<'manual' | 'ai'>('manual')
  const [title, setTitle] = useState('')
  const [preset, setPreset] = useState<Preset>('tomorrow')
  const [leadId, setLeadId] = useState<ID | undefined>()
  const [more, setMore] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [plan, setPlan] = useState<CommandPlan | null>(null)
  const [states, setStates] = useState<Record<string, ProposalState>>({})
  if (scope('task.manage') === false) return null
  const due = quickDue(preset, now)

  const add = () => {
    if (!title.trim()) return
    try {
      createTask({ title: title.trim(), type: /^(call|ring|phone)\b/i.test(title.trim()) ? 'call' : /whatsapp/i.test(title) ? 'whatsapp' : 'followUp', dueAt: due, leadId, ownerId: user.id })
      toast.success(t('domain:task.saved', { title: title.trim() }), { description: fmtDateTime(due, i18n.language) })
      setTitle('')
      setLeadId(undefined)
    } catch (e) {
      toastError(e)
    }
  }

  const read = async () => {
    if (!text.trim()) return
    setBusy(true)
    try {
      const r = await ai.parseCommand(text, context())
      setPlan(r)
      setStates(Object.fromEntries(r.proposals.map((p) => [p.id, { status: 'pending' as const }])))
    } catch (e) {
      toastError(e)
    } finally {
      setBusy(false)
    }
  }

  const confirm = (id: string) => {
    const p = plan?.proposals.find((x) => x.id === id)
    if (!p) return
    setStates((s) => ({ ...s, [id]: { status: 'running' } }))
    try {
      const out = executeProposal(p)
      setStates((s) => ({ ...s, [id]: { status: 'done', links: out.links } }))
      toastUndo(t('quick.aiDone'), out.undoToken)
      setText('')
    } catch (e) {
      setStates((s) => ({ ...s, [id]: { status: 'error', error: e instanceof Error ? e.message : String(e) } }))
      toastError(e)
    }
  }

  return (
    <section aria-label={t('quick.label')} className={cn('rounded-xl border bg-card p-3 shadow-card md:p-4', className)} data-testid="quick-add">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t('quick.label')}</h2>
        <Segmented variant="pill" value={mode} onChange={setMode} label={t('quick.mode')}
          segments={[{ value: 'manual', label: t('quick.manual'), icon: <Plus aria-hidden="true" /> }, { value: 'ai', label: t('quick.ai'), icon: <Sparkles aria-hidden="true" /> }]} />
      </div>
      {mode === 'manual' ? (
        <form className="flex flex-col gap-2.5" onSubmit={(e) => { e.preventDefault(); add() }}>
          <div className="flex flex-col gap-2 md:flex-row">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('quick.placeholder')} aria-label={t('quick.title')} className="md:flex-1" data-testid="quick-title" />
            <div className="md:w-64"><LeadSelect value={leadId} onChange={setLeadId} /></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-meta text-muted-foreground">{t('quick.due')}</span>
            {PRESETS.map((p) => <Chip key={p} size="sm" pressed={preset === p} onClick={() => setPreset(p)}>{t(`quick.preset.${p}`)}</Chip>)}
            <span className="text-meta text-muted-foreground tabular-nums">{fmtDateTime(due, i18n.language)}</span>
            <span className="ml-auto flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setMore(true)}><SlidersHorizontal />{t('quick.more')}</Button>
              <Button type="submit" size="sm" disabled={!title.trim()} data-testid="quick-submit"><Plus />{t('quick.add')}</Button>
            </span>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-2.5 rounded-lg border border-dashed border-ai-border bg-ai-soft/30 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-meta text-muted-foreground">{t('quick.aiHint')}</p>
            <DemoAIBadge mode={plan?.mode ?? ai.mode} />
          </div>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder={t('quick.aiPlaceholder')} aria-label={t('quick.ai')} data-testid="quick-ai-text"
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void read() }} />
          <div className="flex items-center gap-2">
            <VoiceButton size="icon-sm" onText={(v, final) => { if (final) setText((x) => (x ? `${x} ${v}` : v)) }} />
            <Button type="button" variant="ai" size="sm" onClick={() => void read()} disabled={!text.trim() || busy} aria-busy={busy || undefined} data-testid="quick-ai-read">
              {busy ? <Loader2 className="animate-spin" /> : <Wand2 />}{t('quick.read')}
            </Button>
          </div>
          {plan && (
            <div className="flex flex-col gap-2">
              {plan.reply.text && <p className="text-sm">{plan.reply.text}</p>}
              {plan.refusal && <p className="text-sm text-muted-foreground">{t(plan.refusal.reasonKey, plan.refusal.params ?? {})}</p>}
              {plan.proposals.map((p) => (
                <ActionProposalCard key={p.id} proposal={p} mode={plan.mode} state={states[p.id] ?? { status: 'pending' }}
                  onConfirm={() => confirm(p.id)} onCancel={() => setStates((s) => ({ ...s, [p.id]: { status: 'cancelled' } }))} />
              ))}
              {!plan.proposals.length && !plan.refusal && <p className="text-meta text-muted-foreground">{t('quick.aiNothing')}</p>}
            </div>
          )}
        </div>
      )}
      <TaskFormDialog open={more} onOpenChange={setMore} leadId={leadId} title={title.trim() || undefined} dueAt={due} onSaved={() => { setTitle(''); setLeadId(undefined) }} />
    </section>
  )
}
