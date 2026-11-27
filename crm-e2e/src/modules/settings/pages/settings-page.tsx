/**
 * Settings overview (master prompt §16): one tile per section the current role may use, each with a one-line summary
 * of what is set now. A role with only one section (executives: profile) goes straight to it.
 */
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/shared/page-header'
import { UserAvatar } from '@/components/shared/user-avatar'
import { useDb } from '@/hooks/use-db'
import { usePermission } from '@/hooks/use-permission'
import { SectionTile } from '../components/sections'
import { ProfileSection } from '../components/profile-section'
import { SECTIONS, type SectionKey } from '../lib/sections'

export default function SettingsPage() {
  const { t } = useTranslation(['settings', 'common', 'shell'])
  const { can, user } = usePermission()
  const s = useDb((db) => db.settings)
  const users = useDb((db) => db.users)
  const allowed = SECTIONS.filter((x) => can(x.permission)).map((x) => x.key)

  if (allowed.length <= 1) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t('settings:title')} subtitle={t('settings:subtitleProfile')} />
        <div className="max-w-4xl"><ProfileSection /></div>
      </div>
    )
  }

  const enabledStages = s.pipeline.stages.filter((x) => x.enabled).length
  const summary: Record<SectionKey, string> = {
    profile: `${t(`common:roles.${user.role}`)} · ${t(`common:availability.${user.availability}`)}`,
    assignment: `${s.assignment.autoAssign ? t('settings:summary.autoOn') : t('settings:summary.autoOff')} · ${t('settings:summary.rules', { count: s.assignment.rules.filter((r) => r.enabled).length })}`,
    pipeline: `${t('settings:summary.stages', { count: enabledStages })} · ${t('settings:summary.lostReasons', { count: s.pipeline.lostReasons.length })}`,
    templates: t('settings:summary.templates', { count: s.templates.length }),
    matching: t('settings:summary.weights', { list: (['budget', 'location', 'size', 'amenities', 'preferences'] as const).map((k) => s.matching.weights[k].toFixed(2)).join(' / ') }),
    sla: t('settings:summary.sla', { mins: s.sla.firstResponseMins, hot: s.scoring.hotAt }),
    users: t('settings:summary.users', { count: users.filter((u) => u.status === 'active').length }),
    demo: t('settings:summary.demo'),
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('settings:title')} subtitle={t('settings:subtitle')}
        actions={<span className="flex items-center gap-2 text-sm text-muted-foreground"><UserAvatar name={user.name} size="sm" role={user.role} />{user.name} · {t(`common:roles.${user.role}`)}</span>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="settings-tiles">
        {allowed.map((k) => <SectionTile key={k} sectionKey={k} summary={summary[k]} />)}
      </div>
    </div>
  )
}
