/** /leads/new — the Add lead form on a full page (all three steps as sections), with paste-and-fill and voice. */
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { paths } from '@/app/paths'
import { PageHeader } from '@/components/shared/page-header'
import { LeadEditorBody, LeadEditorFooter } from '../components/lead-editor'
import { useLeadEditor } from '../components/use-lead-editor'

export default function LeadNewPage() {
  const { t } = useTranslation('leads')
  const navigate = useNavigate()
  const ed = useLeadEditor({ onSaved: (id) => navigate(paths.lead(id)) })
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader title={t('add.title')} subtitle={t('add.pageSubtitle')} />
      <LeadEditorBody ed={ed} layout="page" />
      <div className="sticky bottom-20 z-10 fab-clear flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-popover/95 p-3 shadow-lg backdrop-blur md:bottom-4">
        <LeadEditorFooter ed={ed} layout="page" onCancel={() => navigate(paths.leads())} />
      </div>
    </div>
  )
}
