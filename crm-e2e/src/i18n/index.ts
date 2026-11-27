/**
 * Screen text lives in one JSON file per namespace and language: locales/<lang>/<ns>.json.
 * Files are picked up with import.meta.glob, so a module adding a namespace needs no edit here.
 * What people type (names, notes, titles) is never translated. Tamil is drafted and flagged for a fluent review.
 */
import i18n, { type Resource } from 'i18next'
import { initReactI18next } from 'react-i18next'

export const LANGUAGES = ['en', 'ta'] as const
export type Language = (typeof LANGUAGES)[number]
export const LANGUAGE_STORAGE_KEY = 'crm-e2e-lang'

const files = import.meta.glob<Record<string, unknown>>('./locales/*/*.json', { eager: true, import: 'default' })

export function buildResources(entries: Record<string, Record<string, unknown>>): Resource {
  const resources: Resource = {}
  for (const [file, content] of Object.entries(entries)) {
    const m = /\/locales\/([^/]+)\/([^/]+)\.json$/.exec(file)
    if (!m) continue
    const [, lang, ns] = m
    resources[lang] ??= {}
    resources[lang][ns] = content
  }
  return resources
}

export const resources = buildResources(files)
export const NAMESPACES = Object.keys(resources.en ?? {})

function savedLanguage(): Language {
  try {
    const v = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return (LANGUAGES as readonly string[]).includes(v ?? '') ? (v as Language) : 'en'
  } catch {
    return 'en' // storage blocked (private window, tests): English
  }
}

export function setLanguage(lang: Language) {
  void i18n.changeLanguage(lang)
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
  } catch {
    /* storage blocked: the choice lasts for this visit only */
  }
}

const syncHtmlLang = (lng: string) => {
  if (typeof document !== 'undefined') document.documentElement.lang = lng
}
i18n.on('languageChanged', syncHtmlLang)

void i18n.use(initReactI18next).init({
  resources,
  ns: NAMESPACES,
  defaultNS: 'common',
  fallbackNS: 'common',
  lng: savedLanguage(),
  fallbackLng: 'en',
  supportedLngs: [...LANGUAGES],
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
})

syncHtmlLang(i18n.language)

export default i18n
