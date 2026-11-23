/**
 * Screen text lives in one file per language (locales/*.json), never in components.
 * Adding a language = adding one file here. What people type (titles, names, notes) is never translated.
 * Tamil text is drafted by Claude and must be checked by a fluent reviewer before a demo.
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import ta from './locales/ta.json'

export const LANGUAGES = ['en', 'ta'] as const
export type Language = (typeof LANGUAGES)[number]

const STORAGE_KEY = 'realspec-v3-language'

function savedLanguage(): Language {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return (LANGUAGES as readonly string[]).includes(v ?? '') ? (v as Language) : 'en'
  } catch {
    return 'en' // storage blocked (private window, preview): fall back to English
  }
}

export function setLanguage(lang: Language) {
  void i18n.changeLanguage(lang)
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    /* storage blocked: the choice lasts for this visit only */
  }
}

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
})

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ta: { translation: ta } },
  lng: savedLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes
})

document.documentElement.lang = i18n.language

export default i18n
