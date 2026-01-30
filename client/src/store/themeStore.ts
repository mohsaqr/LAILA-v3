import { create } from 'zustand';

export type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'laila-theme-preference';

// Get current theme from DOM
const getThemeFromDOM = (): Theme => {
  if (typeof window === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
};

const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  localStorage.setItem(STORAGE_KEY, theme);
};

export const useThemeStore = create<ThemeState>((set) => {
  // Set up MutationObserver to sync store with DOM changes
  if (typeof window !== 'undefined') {
    const observer = new MutationObserver(() => {
      const theme = getThemeFromDOM();
      set({ theme, isDark: theme === 'dark' });
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }

  const initialTheme = getThemeFromDOM();

  return {
    theme: initialTheme,
    isDark: initialTheme === 'dark',
    setTheme: (theme: Theme) => {
      applyTheme(theme);
      set({ theme, isDark: theme === 'dark' });
    },
    toggleTheme: () => {
      const newTheme = getThemeFromDOM() === 'dark' ? 'light' : 'dark';
      applyTheme(newTheme);
      set({ theme: newTheme, isDark: newTheme === 'dark' });
    },
  };
});
