/**
 * The Settings sections, each guarded by the permission that edits it (foundation-plan §3.1): profile for everyone,
 * assignment for admins and managers (team level), pipeline / templates / matching / SLA for admins, users and the
 * demo reset for admins. The nav and the overview read this one list, so a section a role cannot use never shows.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { paths } from '@/app/paths'
import { IconTile } from '@/components/shared/icon-tile'
import { cn } from '@/lib/utils'
import { SECTIONS, type SectionKey } from '../lib/sections'

export function SettingsNav({ current, allowed, className }: { current: SectionKey; allowed: SectionKey[]; className?: string }) {
  const { t } = useTranslation('settings')
  return (
    <nav aria-label={t('nav.label')} className={cn('flex flex-col gap-0.5', className)}>
      {SECTIONS.filter((s) => allowed.includes(s.key)).map((s) => {
        const on = s.key === current
        return (
          <Link
            key={s.key} to={paths.settings(s.key)} aria-current={on ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors duration-(--dur-fast) focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              on ? 'bg-primary-soft font-medium text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <s.icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span className="truncate">{t(`section.${s.key}.title`)}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export function SectionTile({ sectionKey, summary }: { sectionKey: SectionKey; summary?: ReactNode }) {
  const { t } = useTranslation('settings')
  const s = SECTIONS.find((x) => x.key === sectionKey)
  if (!s) return null
  return (
    <Link
      to={paths.settings(s.key)} data-testid={`settings-tile-${s.key}`}
      className="group flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-card transition-[transform,box-shadow] duration-(--dur-fast) hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none md:p-5"
    >
      <div className="flex items-center gap-3">
        <IconTile icon={s.icon} tone={s.tone} size="lg" />
        <h2 className="text-base font-semibold group-hover:text-primary">{t(`section.${s.key}.title`)}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t(`section.${s.key}.body`)}</p>
      {summary && <p className="mt-auto flex flex-wrap items-center gap-1.5 text-meta font-medium text-foreground">{summary}</p>}
    </Link>
  )
}

