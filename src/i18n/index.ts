import { createI18n } from 'vue-i18n'
import uz from './locales/uz'
import en from './locales/en'
import ru from './locales/ru'

export type Locale = 'uz' | 'en' | 'ru'

const STORAGE_KEY = 'rivex-locale'

export function getStoredLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'en' || stored === 'ru' || stored === 'uz' ? stored : 'uz'
}

export function setStoredLocale(locale: Locale) {
  localStorage.setItem(STORAGE_KEY, locale)
}

const i18n = createI18n({
  legacy: false,
  locale: getStoredLocale(),
  fallbackLocale: 'uz',
  messages: { uz, en, ru },
})

export default i18n
