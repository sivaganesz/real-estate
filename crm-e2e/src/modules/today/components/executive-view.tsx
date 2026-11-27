/**
 * Sales Executive Today (master prompt §6, ROLE_RESEARCH §5.1). Layout (DESIGN_SYSTEM §14 rule 4): the hero across
 * the full width, then 12 columns: the priority list and lead sections in 7, the appointments timeline and targets
 * in 5. Below lg it is one column: hero, priorities, appointments, targets, the rest.
 */
import { useTranslation } from 'react-i18next'
import { AlarmClock, Building2, ListChecks, UserPlus } from 'lucide-react'
import { AISuggestionChip } from '@/components/ai/ai-suggestion-chip'
import { executiveBriefFacts, executiveToday } from '@/services/queries/today'
import { executiveBrief, greetingKey } from '../lib/brief'
import { itemKey, reasonParams } from '../lib/slots'
import { AIQuickCommand } from './ai-quick-command'
import { AppointmentsTimeline } from './appointments-timeline'
import { LeadSections, MatchesCard, TargetsCard, VisitedStrip } from './exec-cards'
import { PriorityList } from './priority-list'
import { TodayHero } from './today-hero'
import { useToday } from './use-today'
import { firstName } from '@/lib/format'
import { ModuleAssistant } from '@/components/ai/module-assistant'

/** Scrolls to a priority row and flashes it (the hero's "Start here" chips). */
function focusRow(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.add('ring-2', 'ring-ai', 'rounded-md')
  window.setTimeout(() => el.classList.remove('ring-2', 'ring-ai', 'rounded-md'), 1600)
}

export function ExecutiveView() {
  const { t } = useTranslation('today')
  const { data, db, user, now } = useToday(executiveToday)
  const facts = executiveBriefFacts(data, now)
  const brief = executiveBrief(facts)
  const first = firstName(data.items[0]?.params.name ? String(data.items[0].params.name) : '')
  const suggestions = [
    { label: t('assistant.chips.next'), command: 'Who should I call next?' },
    ...(first ? [{ label: t('assistant.chips.reschedule', { name: first }), command: `Reschedule ${first}'s follow-up to tomorrow 5 PM` }] : []),
    { label: t('assistant.chips.tasks'), command: "Show today's pending tasks" },
    { label: t('assistant.chips.target'), command: "What's left for my target this month?" },
  ]
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return (
    <div className="flex flex-col gap-6" data-testid="today-executive">
      <TodayHero
        now={now} name={firstName(user.name)} greeting={greetingKey(now)}
        brief={<>
          {t(brief.summary.key, {
            ...brief.summary.params,
            visits: t('brief.exec.n.visits', { count: facts.visits }),
            followUps: t('brief.exec.n.followUps', { count: facts.followUps }),
            newLeads: t('brief.exec.n.newLeads', { count: facts.newLeads }),
          })}{' '}
          {brief.start && <strong className="font-semibold">{t(brief.start.key, brief.start.params)}{' '}{t(`reason.${data.items[0].reasonKey}`, reasonParams(data.items[0], (k, p) => t(k, p)))}.</strong>}
        </>}
        chips={data.items.slice(0, 3).map((it) => (
          <AISuggestionChip key={itemKey(it)} onClick={() => focusRow(`today-item-${itemKey(it)}`)}>
            {t('hero.chip', { name: String(it.params.name || it.params.title || ''), reason: t(`reason.${it.reasonKey}`, reasonParams(it, (k, p) => t(k, p))) })}
          </AISuggestionChip>
        ))}
        stats={[
          { key: 'visits', label: t('hero.visits'), value: facts.visits, icon: Building2, tone: 'warning', onClick: () => scrollTo('today-appts') },
          { key: 'followUps', label: t('hero.followUps'), value: facts.followUps, icon: ListChecks, tone: 'primary', onClick: () => scrollTo('today-priorities') },
          { key: 'overdue', label: t('hero.overdue'), value: facts.overdue, icon: AlarmClock, tone: facts.overdue ? 'danger' : 'neutral', onClick: () => scrollTo('today-priorities'), testId: 'hero-overdue' },
          { key: 'new', label: t('hero.newLeads'), value: facts.newLeads, icon: UserPlus, tone: 'info' },
        ]}
        assistant={<AIQuickCommand suggestions={suggestions} />}
      />
      {/* one column below lg in the order hero, priorities, appointments, targets, then the rest (DS §14 rule 4) */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          <PriorityList items={data.items} db={db} scores={data.scores} now={now} />
        </div>
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-5 lg:row-span-2">
          <div id="today-appts" className="scroll-mt-24">
            <AppointmentsTimeline appointments={data.appointments} db={db} now={now} title={t('appointments.title')} description={t('appointments.subtitle', { count: data.appointments.length })} />
          </div>
          <TargetsCard data={data} now={now} />
          <ModuleAssistant module="insights" scope="personal" />
          <MatchesCard matches={data.matches} db={db} />
        </div>
        <div className="min-w-0 lg:col-span-7">
          <LeadSections data={data} db={db} now={now} />
        </div>
      </div>
      <VisitedStrip items={data.visitedNotBooked} db={db} />
    </div>
  )
}
