import { create } from 'zustand';
import i18n from '../i18n/config';
import { supportedLanguages, SupportedLanguage, isSupportedLanguage } from '../i18n/config';

interface LanguageState {
  language: SupportedLanguage;
  direction: 'ltr' | 'rtl';
  isInitialized: boolean;
  setLanguage: (lang: SupportedLanguage) => void;
  initFromUser: (userLang?: string | null) => void;
}

const applyLanguage = (lang: SupportedLanguage) => {
  const dir = supportedLanguages[lang]?.dir || 'ltr';
  i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
  localStorage.setItem('i18nextLng', lang);
  return dir;
};

export const useLanguageStore = create<LanguageState>((set) => ({
  language: 'en',
  direction: 'ltr',
  isInitialized: false,

  setLanguage: (lang) => {
    const dir = applyLanguage(lang);
    set({ language: lang, direction: dir });
  },

  initFromUser: (userLang) => {
    // Priority: user preference > localStorage > browser language > 'en'
    let lang: SupportedLanguage = 'en';

    if (userLang && isSupportedLanguage(userLang)) {
      lang = userLang;
    } else {
      const storedLang = localStorage.getItem('i18nextLng');
      if (storedLang && isSupportedLanguage(storedLang)) {
        lang = storedLang;
      } else {
        // Try browser language
        const browserLang = navigator.language.split('-')[0];
        if (isSupportedLanguage(browserLang)) {
          lang = browserLang;
        }
      }
    }

    const dir = applyLanguage(lang);
    set({ language: lang, direction: dir, isInitialized: true });
  },
}));
