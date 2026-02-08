import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

export const supportedLanguages = {
  en: { name: 'English', nativeName: 'English', dir: 'ltr' as const },
  fi: { name: 'Finnish', nativeName: 'Suomi', dir: 'ltr' as const },
  es: { name: 'Spanish', nativeName: 'Español', dir: 'ltr' as const },
  ar: { name: 'Arabic', nativeName: 'العربية', dir: 'rtl' as const },
} as const;

export type SupportedLanguage = keyof typeof supportedLanguages;

export const isSupportedLanguage = (lang: string): lang is SupportedLanguage => {
  return lang in supportedLanguages;
};

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: Object.keys(supportedLanguages),
    ns: ['common', 'auth', 'navigation', 'courses', 'teaching', 'admin', 'errors', 'tutors', 'settings'],
    defaultNS: 'common',
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    react: {
      useSuspense: true,
    },
  });

export default i18n;
