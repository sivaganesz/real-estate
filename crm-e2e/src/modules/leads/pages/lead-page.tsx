/**
 * /leads/:id — the lead page in three zones (DESIGN_SYSTEM §14 rule 3): summary rail (who, score + why, requirement,
 * classification), main (stage steps, next best action, quick actions, AI summary, tabs), related (qualification card,
 * generated messages, edit with AI). Below xl the related zone moves under main; below md everything stacks.
 * Sets the assistant's context to this lead (useAISelection).
 */
import { useState } from 'react'
import { ArrowLeft, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router'
import { useAISelection } from '@/ai'
import { paths } from '@/app/paths'
import { NoAccess, NoResults } from '@/components/illustrations'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useWholeDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { useMemo } from 'react'
import { suggestNext } from '@/lib/next-action'
import { leadScore, priorityFor } from '@/lib/scoring'
import { AgingBadge } from '@/components/domain/lead-pills'
import { contactAging } from '@/lib/lead-queries'
import { LeadActionsMenu } from '../components/lead-actions-menu'
import { LeadDialogsProvider } from '../components/lead-dialogs'
import { AISummaryCard, NextActionCard, QuickActions, StageSteps } from '../components/lead-main'
import { EditWithAI, MessageComposer, QualificationCard } from '../components/lead-side'
import { ClassificationCard, LeadHeroCard, RequirementCard } from '../components/lead-summary'
import { LeadTabs, type LeadTabKey } from '../components/lead-tabs'
import { useNavigate } from 'react-router'
import { ModuleAssistant } from '@/components/ai/module-assistant'

const TABS: LeadTabKey[] = ['activity', 'matches', 'appointments', 'tasks', 'assignments']

export default function LeadPage() {
  const { id = '' } = useParams()
  const { t } = useTranslation(['leads', 'common'])
  const navigate = useNavigate()
  const db = useWholeDb()
  const now = useNow()
  const user = useCurrentUser()
  const { can } = usePermission()
  const lead = db.leads.find((l) => l.id === id)
  useAISelection(lead ? { kind: 'lead', id: lead.id } : undefined)
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab') as LeadTabKey | null
  const [tab, setTabState] = useState<LeadTabKey>(tabParam && TABS.includes(tabParam) ? tabParam : 'activity')
  const setTab = (k: LeadTabKey) => {
    setTabState(k)
    const n = new URLSearchParams(params)
    n.set('tab', k)
    setParams(n, { replace: true })
  }

  const facts = useMemo(() => {
    if (!lead) return null
    const score = leadScore(lead, { properties: db.properties, settings: db.settings, now })
    const temperature = lead.temperatureOverride ?? score.temperature
    return {
      score, temperature,
      priority: priorityFor(lead, temperature, { appointments: db.appointments, tasks: db.tasks, now }),
      next: suggestNext(lead, { appointments: db.appointments, tasks: db.tasks, properties: db.properties, settings: db.settings, now }),
      aging: contactAging(lead, db.settings.sla, now),
      owner: db.users.find((u) => u.id === lead.ownerId)?.name,
    }
  }, [lead, db, now])

  if (!lead || !facts) {
    return (
      <EmptyState
        illustration={NoResults} title={t('leads:detail.notFound')} body={t('leads:detail.notFoundBody', { id })}
        primary={<Button asChild variant="secondary"><Link to={paths.leads()}><ArrowLeft />{t('leads:detail.back')}</Link></Button>}
      />
    )
  }
  if (!can('lead.view', lead)) {
    return (
      <EmptyState
        illustration={NoAccess} title={t('leads:detail.notYours')} body={t('leads:detail.notYoursBody', { role: t(`common:roles.${user.role}`) })}
        primary={<Button asChild variant="secondary"><Link to={paths.leads()}><ArrowLeft />{t('leads:detail.back')}</Link></Button>}
      />
    )
  }

  const goMatches = () => { setTab('matches'); document.getElementById('lead-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }

  return (
    <LeadDialogsProvider onDeleted={() => navigate(paths.leads())}>
      <div className="flex flex-col gap-5" data-testid="lead-page">
        <PageHeader
          eyebrow={<Link to={paths.leads()} className="inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="size-3.5" aria-hidden="true" />{t('leads:title')}</Link>}
          title={<span className="flex flex-wrap items-center gap-x-3 gap-y-1">{lead.name}<AgingBadge aging={facts.aging} className="text-sm" /></span>}
          subtitle={t('leads:detail.subtitle', { id: lead.id })}
          actions={
            <>
              {can('lead.edit', lead) && <Button asChild variant="secondary"><Link to={paths.editLead(lead.id)}><Pencil />{t('leads:actions.edit')}</Link></Button>}
              <LeadActionsMenu lead={lead} hideOpen size="icon" />
            </>
          }
        />
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
          <aside className="flex min-w-0 flex-col gap-4 max-xl:order-1" aria-label={t('leads:detail.summary')}>
            <LeadHeroCard lead={lead} score={facts.score} temperature={facts.temperature} priority={facts.priority} ownerName={facts.owner} />
            <RequirementCard lead={lead} />
            <ClassificationCard lead={lead} />
          </aside>
          <div className="flex min-w-0 flex-col gap-4 max-xl:order-2">
            <StageSteps lead={lead} />
            <NextActionCard lead={lead} next={facts.next} />
            <QuickActions lead={lead} onMatches={goMatches} />
            <AISummaryCard lead={lead} />
            <LeadTabs lead={lead} tab={tab} onTab={setTab} />
          </div>
          <aside className="flex min-w-0 flex-col gap-4 max-xl:order-3 md:max-xl:grid md:max-xl:grid-cols-[repeat(2,minmax(0,1fr))] md:max-xl:items-start" aria-label={t('leads:detail.related')}>
            <QualificationCard lead={lead} />
            <ModuleAssistant module="followUp" leadId={lead.id} />
            <MessageComposer lead={lead} />
            <EditWithAI lead={lead} />
          </aside>
        </div>
      </div>
    </LeadDialogsProvider>
  )
}
