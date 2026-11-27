/**
 * /leads/:id/edit — the full form for bigger changes, with the Lead Editing Assistant on top: "change budget to 1.5 Cr
 * and add Hebbal" fills the form (fields marked ✦), the user reviews and saves (Undo 6 s). Owner and stage are changed
 * from the lead page (assign / stage dialogs), not here.
 */
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { paths } from '@/app/paths'
import { NoAccess, NoResults } from '@/components/illustrations'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import type { Lead } from '@/domain/types'
import { useDb } from '@/hooks/use-db'
import { usePermission } from '@/hooks/use-permission'
import { LeadEditorBody, LeadEditorFooter } from '../components/lead-editor'
import { EditWithAI } from '../components/lead-side'
import { useLeadEditor } from '../components/use-lead-editor'

export default function LeadEditPage() {
  const { id = '' } = useParams()
  const { t } = useTranslation('leads')
  const { can } = usePermission()
  const lead = useDb((db) => db.leads.find((l) => l.id === id))
  if (!lead) {
    return <EmptyState illustration={NoResults} title={t('detail.notFound')} body={t('detail.notFoundBody', { id })} primary={<Button asChild variant="secondary"><Link to={paths.leads()}><ArrowLeft />{t('detail.back')}</Link></Button>} />
  }
  if (!can('lead.edit', lead)) {
    return <EmptyState illustration={NoAccess} title={t('detail.cannotEdit')} body={t('detail.cannotEditBody')} primary={<Button asChild variant="secondary"><Link to={paths.lead(lead.id)}><ArrowLeft />{t('detail.backTo', { name: lead.name })}</Link></Button>} />
  }
  // keyed on the id so another lead starts a fresh form
  return <EditForm key={lead.id} lead={lead} />
}

function EditForm({ lead }: { lead: Lead }) {
  const { t } = useTranslation('leads')
  const navigate = useNavigate()
  const ed = useLeadEditor({ lead, onSaved: (id) => navigate(paths.lead(id)) })
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6" data-testid="lead-edit-page">
      <PageHeader
        eyebrow={<Link to={paths.lead(lead.id)} className="inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="size-3.5" aria-hidden="true" />{lead.name}</Link>}
        title={t('edit.title', { name: lead.name })} subtitle={t('edit.subtitle')}
      />
      <EditWithAI
        lead={lead}
        onApply={(changes) => {
          for (const c of changes) ed.set(c.path, c.to)
          ed.ai.apply(Object.fromEntries(changes.map((c) => [c.path, { origin: 'ai' as const, confidence: c.confidence }])))
        }}
      />
      <LeadEditorBody ed={ed} layout="page" />
      <div className="sticky bottom-20 z-10 fab-clear flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-popover/95 p-3 shadow-lg backdrop-blur md:bottom-4">
        <LeadEditorFooter ed={ed} layout="page" onCancel={() => navigate(paths.lead(lead.id))} />
      </div>
    </div>
  )
}
