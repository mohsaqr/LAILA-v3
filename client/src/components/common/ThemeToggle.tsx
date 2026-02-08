import { useTranslation } from 'react-i18next';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface ThemeToggleProps {
  showLabel?: boolean;
  className?: string;
}

export const ThemeToggle = ({ showLabel = false, className = '' }: ThemeToggleProps) => {
  const { t } = useTranslation(['common']);
  const { isDark, toggleTheme } = useTheme();

  const label = isDark ? t('theme_dark') : t('theme_light');

  return (
    <button
      onClick={toggleTheme}
      className={`p-2 rounded-lg transition-colors ${className}`}
      style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}
      title={t('theme_label', { theme: label })}
      aria-label={t('theme_aria_label', { theme: label })}
    >
      <span className="flex items-center gap-2">
        {isDark ? (
          <Moon className="w-5 h-5" style={{ color: '#9ca3af' }} />
        ) : (
          <Sun className="w-5 h-5" style={{ color: '#4b5563' }} />
        )}
        {showLabel && <span className="text-sm font-medium">{label}</span>}
      </span>
    </button>
  );
};
