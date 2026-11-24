/**
 * Settings & rules. First section: your own preferences — theme and language — remembered in this browser
 * (per user once there is a login). The business rules below come from spec-system-wireframe (views-tools.js,
 * viewSettings) and are rebuilt with the Settings module; until then they are listed as coming next.
 */
import type { ReactNode } from 'react'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Page, PageHeader } from '@/components/app/page-header'
import { SectionCard } from '@/components/app/section-card'
import { StatusChip } from '@/components/app/status-chip'
import { useCrumbs } from '@/components/layout/crumbs'
import { LANGUAGES, type Language, setLanguage } from '@/i18n'
import { THEMES, type ThemeChoice, useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

const THEME_ICON: Record<ThemeChoice, typeof Sun> = { light: Sun, dark: Moon, system: Monitor }
/** The business-rule sections of the current wireframe's Settings page, rebuilt with the Settings module. */
const RULES = ['matchWeights', 'readiness', 'bands', 'followUp', 'costs', 'executives', 'places', 'approvals', 'demoData'] as const

export function SettingsPage() {
  const { t, i18n } = useTranslation()
  const [theme, setTheme] = useTheme()
  useCrumbs([{ label: t('nav.group.tools') }, { label: t('nav.settingsRules') }])

  return (
    <Page>
      <PageHeader title={t('settings.title')} description={t('settings.subtitle')} />
      <div className="flex flex-col gap-5">
        <SectionCard title={t('settings.prefs.title')} description={t('settings.prefs.body')} bodyClassName="flex flex-col gap-6">
          <Choice label={t('settings.theme.label')} hint={t('settings.theme.hint')} columns={3}>
            {THEMES.map((v) => {
              const Icon = THEME_ICON[v]
              return (
                <Option key={v} on={theme === v} onSelect={() => setTheme(v)} preview={<ThemePreview choice={v} />}
                  title={<><Icon className="size-4" aria-hidden /> {t(`settings.theme.${v}`)}</>} detail={t(`settings.theme.${v}Hint`)} />
              )
            })}
          </Choice>
          <Choice label={t('settings.language.label')} hint={t('settings.language.hint')} columns={2}>
            {LANGUAGES.map((lang) => (
              <Option key={lang} on={i18n.language === lang} onSelect={() => setLanguage(lang)} lang={lang}
                title={t(`language.${lang}`)} detail={<LanguageSample lang={lang} />} />
            ))}
          </Choice>
        </SectionCard>

        <SectionCard title={t('settings.rules.title')} description={t('settings.rules.body')}>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {RULES.map((k) => (
              <li key={k} className="flex items-start gap-3 rounded-lg border border-dashed px-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{t(`settings.rules.${k}`)}</span>
                  <span className="block text-xs text-muted-foreground">{t(`settings.rules.${k}Hint`)}</span>
                </span>
                <StatusChip tone="neutral" className="shrink-0">{t('settings.rules.soon')}</StatusChip>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </Page>
  )
}

/** A labelled group of option cards that behaves as one radio group (arrow keys move between them). */
function Choice({ label, hint, columns, children }: { label: string; hint: string; columns: 2 | 3; children: ReactNode }) {
  return (
    <div>
      <p className="font-medium">{label}</p>
      <p className="mb-2.5 text-sm text-muted-foreground">{hint}</p>
      <div role="radiogroup" aria-label={label}
        onKeyDown={(e) => {
          if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return
          const radios = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role=radio]')]
          const i = radios.indexOf(document.activeElement as HTMLButtonElement)
          const next = radios[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + radios.length) % radios.length]
          e.preventDefault(); next.focus(); next.click()
        }}
        className={cn('grid gap-3', columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:max-w-2xl')}>
        {children}
      </div>
    </div>
  )
}

function Option({ on, onSelect, title, detail, preview, lang }: { on: boolean; onSelect: () => void; title: ReactNode; detail: ReactNode; preview?: ReactNode; lang?: string }) {
  return (
    <button type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} onClick={onSelect} lang={lang}
      className={cn('relative flex flex-col gap-2.5 rounded-xl border bg-card p-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
        on ? 'border-primary ring-1 ring-primary' : 'hover:border-ring/50 hover:bg-muted/40')}>
      {preview}
      <span className="flex items-center gap-2">
        <span className="flex min-w-0 flex-1 items-center gap-1.5 font-medium">{title}</span>
        <span aria-hidden className={cn('grid size-5 shrink-0 place-items-center rounded-full border', on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card')}>
          {on && <Check className="size-3.5" />}
        </span>
      </span>
      <span className="text-sm text-muted-foreground">{detail}</span>
    </button>
  )
}

/** A tiny window drawn with the theme's own colours: `.light` / `.dark` re-scope the tokens for this box. */
function ThemePreview({ choice }: { choice: ThemeChoice }) {
  const pane = (mode: 'light' | 'dark') => (
    <span className={cn(mode, 'flex h-full flex-1 gap-1.5 bg-background p-2')}>
      <span className="flex w-1/4 flex-col gap-1 rounded-sm bg-card p-1">
        <span className="h-1.5 rounded-full bg-primary" />
        <span className="h-1.5 rounded-full bg-muted" />
        <span className="h-1.5 rounded-full bg-muted" />
      </span>
      <span className="flex flex-1 flex-col gap-1 rounded-sm bg-card p-1.5">
        <span className="h-1.5 w-2/3 rounded-full bg-foreground/70" />
        <span className="h-1.5 w-1/2 rounded-full bg-muted-foreground/40" />
        <span className="mt-auto h-2.5 w-1/3 rounded-sm bg-primary" />
      </span>
    </span>
  )
  return (
    <span aria-hidden className="flex h-20 overflow-hidden rounded-lg border">
      {choice === 'system' ? <>{pane('light')}{pane('dark')}</> : pane(choice)}
    </span>
  )
}

/** A few words in the language itself, so people can recognise it whichever language the page is in. */
function LanguageSample({ lang }: { lang: Language }) {
  const { i18n } = useTranslation()
  const t = i18n.getFixedT(lang)
  return <>{t('nav.properties')} · {t('nav.leads')} · {t('nav.appointments')}</>
}
