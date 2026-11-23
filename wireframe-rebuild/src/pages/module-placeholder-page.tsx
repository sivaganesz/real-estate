import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/app/empty-state'
import { Page, PageHeader } from '@/components/app/page-header'
import type { NavItem } from '@/components/layout/nav'

/** Stands in for a section that hasn't been rebuilt in React yet. The current wireframe (spec-system-wireframe/) still has it. */
export function ModulePlaceholderPage({ item }: { item: NavItem }) {
  const { t } = useTranslation()
  return (
    <Page>
      <PageHeader title={t(item.labelKey)} />
      <EmptyState icon={item.icon} title={t('module.soonTitle')}>
        {t('module.soonBody')}
      </EmptyState>
    </Page>
  )
}
