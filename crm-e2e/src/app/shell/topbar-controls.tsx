/** Small topbar controls: theme menu, EN/த toggle, the "Search or ask AI… Ctrl K" pill, and breadcrumbs. */
import { Check, ChevronRight, Monitor, Moon, Sparkles, Sun } from 'lucide-react'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { setLanguage, type Language } from '@/i18n'
import { THEMES, useIsDark, useTheme, type ThemeChoice } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'
import { crumbsFor } from '../routes'

const THEME_ICON: Record<ThemeChoice, typeof Sun> = { light: Sun, dark: Moon, system: Monitor }

export function ThemeToggle() {
  const { t } = useTranslation('shell')
  const [choice, setChoice] = useTheme()
  const dark = useIsDark()
  const Icon = choice === 'system' ? Monitor : dark ? Moon : Sun
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('theme.label')} data-testid="theme-toggle">
          <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{t('theme.label')}</DropdownMenuLabel>
        {THEMES.map((th) => {
          const ThIcon = THEME_ICON[th]
          return (
            <DropdownMenuItem key={th} onSelect={() => setChoice(th)} data-testid={`theme-${th}`}>
              <ThIcon className="size-4" aria-hidden="true" />
              <span className="flex-1">{t(`theme.${th}`)}</span>
              {choice === th && <Check className="size-4 text-primary" aria-hidden="true" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function LanguageToggle() {
  const { t, i18n } = useTranslation('shell')
  const current = (i18n.resolvedLanguage ?? 'en') as Language
  const next: Language = current === 'ta' ? 'en' : 'ta'
  return (
    <Button
      variant="ghost"
      size="sm"
      data-testid="language-toggle"
      onClick={() => setLanguage(next)}
      aria-label={`${t('language.label')}: ${t(`language.${next}`)}`}
      title={t(`language.${next}`)}
      className="min-w-12 gap-0.5 px-2 font-semibold"
    >
      <span className={cn(current === 'en' ? 'text-foreground' : 'text-subtle-foreground')}>{t('language.short_en')}</span>
      <span className="text-subtle-foreground" aria-hidden="true">/</span>
      <span lang="ta" className={cn(current === 'ta' ? 'text-foreground' : 'text-subtle-foreground')}>{t('language.short_ta')}</span>
    </Button>
  )
}

export function AskAiBar() {
  const { t } = useTranslation('shell')
  const setOpen = useSessionStore((s) => s.setAiPanelOpen)
  return (
    <button
      type="button"
      data-testid="ask-ai"
      onClick={() => setOpen(true)}
      className="hidden h-9 w-full max-w-[420px] items-center gap-2 rounded-full bg-muted px-3.5 text-left text-sm text-muted-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_5%)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:flex"
    >
      <Sparkles className="size-4 shrink-0 text-ai" strokeWidth={1.75} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{t('topbar.askAi')}</span>
      <kbd className="rounded-xs border bg-card px-1.5 py-0.5 font-sans text-micro font-semibold text-muted-foreground shadow-xs">{t('topbar.shortcut')}</kbd>
    </button>
  )
}

export function Crumbs({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const trail = crumbsFor(pathname)
  if (trail.length === 0) return null
  return (
    <nav aria-label={t('shell:topbar.breadcrumb')} className={cn('flex min-w-0 items-center gap-1 text-ui', className)}>
      {trail.map((c, i) => {
        const last = i === trail.length - 1
        return (
          <Fragment key={c.to}>
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-subtle-foreground" aria-hidden="true" />}
            {last ? (
              <span aria-current="page" className="truncate font-semibold text-foreground">{t(c.titleKey)}</span>
            ) : (
              <Link to={c.to} className="truncate text-muted-foreground hover:text-foreground">{t(c.titleKey)}</Link>
            )}
          </Fragment>
        )
      })}
    </nav>
  )
}
