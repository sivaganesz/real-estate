import { useTranslation } from 'react-i18next'
import { Page, PageHeader } from '@/components/app/page-header'
import { useCrumbs } from '@/components/layout/crumbs'
import { NAV, type NavItem } from '@/components/layout/nav'

/** Stands in for a section that hasn't been rebuilt in React yet. The current wireframe (spec-system-wireframe) still has it. */
export function ModulePlaceholderPage({ item }: { item: NavItem }) {
  const { t } = useTranslation()
  const group = NAV.find((g) => g.items.includes(item))
  useCrumbs([...(group ? [{ label: t(group.labelKey) }] : []), { label: t(item.labelKey) }])
  return (
    <Page>
      <PageHeader title={t(item.labelKey)} />
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-6 py-12 text-center">
        <span className="text-3xl" aria-hidden>{item.icon}</span>
        <p className="font-medium">{t('module.soonTitle')}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{t('module.soonBody')}</p>
      </div>
    </Page>
  )
}
