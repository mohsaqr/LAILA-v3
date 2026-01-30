import { useThemeStore } from '../store/themeStore';

export const useTheme = () => {
  const { theme, setTheme, toggleTheme } = useThemeStore();

  return {
    theme,
    isDark: theme === 'dark',
    setTheme,
    toggleTheme,
  };
};
