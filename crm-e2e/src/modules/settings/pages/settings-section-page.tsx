/**
 * One Settings section: a side nav of the sections this role may use (desktop), a back link (phone), the section's
 * title and its editor. The route already checked the section's permission; an unknown key shows a "not found" state.
 */
import type { ComponentType } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { paths } from '@/app/paths'
import { EmptySettings } from '@/components/illustrations'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { usePermission } from '@/hooks/use-permission'
import { AssignmentSection } from '../components/assignment-section'
import { DemoSection, UsersSection } from '../components/demo-users-sections'
import { MatchingSection } from '../components/matching-section'
import { PipelineSection } from '../components/pipeline-section'
import { ProfileSection } from '../components/profile-section'
import { SettingsNav } from '../components/sections'
import { SlaSection } from '../components/sla-section'
import { TemplatesSection } from '../components/templates-section'
import { SECTIONS, SECTION_ALIASES, type SectionKey } from '../lib/sections'

const BODY: Record<SectionKey, ComponentType> = {
  profile: ProfileSection, assignment: AssignmentSection, pipeline: PipelineSection, templates: TemplatesSection,
  matching: MatchingSection, sla: SlaSection, users: UsersSection, demo: DemoSection,
}

export default function SettingsSectionPage() {
  const { section = '' } = useParams()
  const { t } = useTranslation(['settings', 'common'])
  const { can } = usePermission()
  const key = (SECTION_ALIASES[section] ?? section) as SectionKey
  const meta = SECTIONS.find((s) => s.key === key)
  const allowed = SECTIONS.filter((s) => can(s.permission)).map((s) => s.key)
  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit lg:hidden">
      <Link to={paths.settings()}><ArrowLeft aria-hidden="true" />{t('settings:allSettings')}</Link>
    </Button>
  )

  if (!meta) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <section className="rounded-lg border bg-card shadow-card">
          <EmptyState illustration={EmptySettings} title={t('settings:notFound')} body={t('settings:notFoundBody')}
            primary={<Button asChild><Link to={paths.settings()}>{t('settings:allSettings')}</Link></Button>} />
        </section>
      </div>
    )
  }

  const Body = BODY[key]
  return (
    <div className="flex flex-col gap-4">
      {allowed.length > 1 && back}
      <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
        {allowed.length > 1 && (
          <aside className="hidden lg:block">
            <div className="sticky top-20 flex flex-col gap-2">
              <Link to={paths.settings()} className="px-2.5 text-caption font-semibold tracking-[0.06em] text-subtle-foreground uppercase hover:text-foreground [:lang(ta)_&]:tracking-normal [:lang(ta)_&]:normal-case">{t('settings:title')}</Link>
              <SettingsNav current={key} allowed={allowed} />
            </div>
          </aside>
        )}
        <div className="flex min-w-0 flex-col gap-6 lg:col-start-2">
          <PageHeader title={t(`settings:section.${key}.title`)} subtitle={t(`settings:section.${key}.body`)} />
          <div data-testid={`settings-section-${key}`}><Body /></div>
        </div>
      </div>
    </div>
  )
}
