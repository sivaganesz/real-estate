import { useTranslation } from 'react-i18next'
import { LANGUAGES, setLanguage } from '@/i18n'
import { cn } from '@/lib/utils'

const SHORT: Record<string, string> = { en: 'EN', ta: 'த' }

/** English | தமிழ் (EN | த on a phone) — remembered in this browser (per user once there is a login). */
export function LanguageSwitch() {
  const { t, i18n } = useTranslation()
  return (
    <div role="group" aria-label={t('language.label')} className="inline-flex rounded-lg border bg-card p-0.5">
      {LANGUAGES.map((lang) => {
        const on = i18n.language === lang
        return (
          <button key={lang} type="button" aria-pressed={on} onClick={() => setLanguage(lang)} lang={lang}
            className={cn('h-7 rounded-md px-2 text-sm font-medium transition-colors sm:px-2.5', on ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            <span className="max-sm:hidden">{t(`language.${lang}`)}</span>
            <span className="sm:hidden" aria-hidden>{SHORT[lang]}</span>
            <span className="sr-only sm:hidden">{t(`language.${lang}`)}</span>
          </button>
        )
      })}
    </div>
  )
}
