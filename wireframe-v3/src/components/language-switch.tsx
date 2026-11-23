import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { LANGUAGES, setLanguage } from '@/i18n'

/** English | தமிழ் — remembered in this browser (per user once there is a login). */
export function LanguageSwitch() {
  const { t, i18n } = useTranslation()
  return (
    <div role="group" aria-label={t('language.label')} className="inline-flex rounded-lg border p-0.5">
      {LANGUAGES.map((lang) => (
        <Button
          key={lang}
          size="sm"
          variant={i18n.language === lang ? 'default' : 'ghost'}
          aria-pressed={i18n.language === lang}
          onClick={() => setLanguage(lang)}
        >
          {t(`language.${lang}`)}
        </Button>
      ))}
    </div>
  )
}
