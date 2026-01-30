import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface ThemeToggleProps {
  showLabel?: boolean;
  className?: string;
}

export const ThemeToggle = ({ showLabel = false, className = '' }: ThemeToggleProps) => {
  const { isDark, toggleTheme } = useTheme();

  const label = isDark ? 'Dark' : 'Light';

  return (
    <button
      onClick={toggleTheme}
      className={`p-2 rounded-lg transition-colors ${className}`}
      style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}
      title={`Theme: ${label}`}
      aria-label={`Current theme: ${label}. Click to switch.`}
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
