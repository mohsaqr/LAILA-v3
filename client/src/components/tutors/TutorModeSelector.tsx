import { useTranslation } from 'react-i18next';
import { Radio, Users, Sparkles } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import type { TutorMode } from '../../types/tutor';

interface TutorModeSelectorProps {
  mode: TutorMode;
  onModeChange: (mode: TutorMode) => void;
  disabled?: boolean;
}

export const TutorModeSelector = ({
  mode,
  onModeChange,
  disabled = false,
}: TutorModeSelectorProps) => {
  const { t } = useTranslation(['tutors']);
  const { isDark } = useTheme();

  const modes: { value: TutorMode; label: string; description: string; icon: React.ElementType }[] = [
    {
      value: 'manual',
      label: t('mode_manual'),
      description: t('mode_manual_desc'),
      icon: Radio,
    },
    {
      value: 'router',
      label: t('mode_auto_route'),
      description: t('mode_auto_route_desc'),
      icon: Sparkles,
    },
    {
      value: 'collaborative',
      label: t('mode_team'),
      description: t('mode_team_desc'),
      icon: Users,
    },
  ];

  // Theme colors
  const colors = {
    border: isDark ? '#374151' : '#f3f4f6',
    textLabel: isDark ? '#9ca3af' : '#6b7280',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    hoverBg: isDark ? '#374151' : '#f9fafb',
    selectedBg: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff',
    selectedBorder: isDark ? '#3b82f6' : '#bfdbfe',
    selectedText: isDark ? '#60a5fa' : '#1d4ed8',
    unselectedBg: isDark ? '#4b5563' : '#e5e7eb',
    unselectedText: isDark ? '#9ca3af' : '#6b7280',
  };

  return (
    <div className="p-3 border-t" style={{ borderColor: colors.border }}>
      <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: colors.textLabel }}>
        {t('mode')}
      </p>
      <div className="space-y-1">
        {modes.map((m) => {
          const Icon = m.icon;
          const isSelected = mode === m.value;
          return (
            <button
              key={m.value}
              onClick={() => onModeChange(m.value)}
              disabled={disabled}
              className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors border ${
                disabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              style={{
                backgroundColor: isSelected ? colors.selectedBg : 'transparent',
                borderColor: isSelected ? colors.selectedBorder : 'transparent',
                color: isSelected ? colors.selectedText : colors.textSecondary,
              }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: isSelected ? '#3b82f6' : colors.unselectedBg,
                  color: isSelected ? '#ffffff' : colors.unselectedText,
                }}
              >
                <Icon className="w-3 h-3" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{m.label}</p>
                <p className="text-xs truncate" style={{ color: colors.textSecondary }}>{m.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
