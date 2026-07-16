import { create } from 'zustand';
import i18n from '../i18n/config';
import { supportedLanguages, SupportedLanguage, isSupportedLanguage } from '../i18n/config';
import { useAuthStore } from './authStore';
import { usersApi } from '../api/users';

interface LanguageState {
  language: SupportedLanguage;
  direction: 'ltr' | 'rtl';
  isInitialized: boolean;
  /**
   * Change the active language. When `persistToServer` is true (default) and a
   * user is logged in, the choice is also saved to their profile so it survives
   * a page refresh — otherwise the stored profile language would override the
   * local selection on the next load.
   */
  setLanguage: (lang: SupportedLanguage, persistToServer?: boolean) => void;
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

  setLanguage: (lang, persistToServer = true) => {
    const dir = applyLanguage(lang);
    set({ language: lang, direction: dir });

    const auth = useAuthStore.getState();
    const user = auth.user;
    if (user) {
      // Keep the persisted auth user in sync. On refresh the app rehydrates the
      // stored user and initFromUser() applies user.language, so without this a
      // switch would revert to the previously stored language on next load.
      if (user.language !== lang) {
        auth.setUser({ ...user, language: lang });
      }
      // Persist to the profile so the choice survives across devices/sessions.
      // Skipped when the caller already handles persistence (e.g. Settings).
      if (persistToServer) {
        usersApi.updateUserSetting(user.id, 'language', lang).catch(() => {});
      }
    }
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
