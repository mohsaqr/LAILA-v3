import { Bot, Sparkles } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import type { TutorAgent } from '../../api/forums';

interface ForumAgentSelectorProps {
  agents: TutorAgent[];
  onSelect: (agent: TutorAgent) => void;
  selectedAgent?: TutorAgent | null;
  disabled?: boolean;
  compact?: boolean;
  isLoading?: boolean;
}

export const ForumAgentSelector = ({
  agents,
  onSelect,
  selectedAgent,
  disabled = false,
  compact = false,
  isLoading = false,
}: ForumAgentSelectorProps) => {
  const { isDark } = useTheme();

  const colors = {
    bg: isDark ? '#1f2937' : '#ffffff',
    bgAlt: isDark ? '#374151' : '#f9fafb',
    border: isDark ? '#4b5563' : '#e5e7eb',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    chipBg: isDark ? '#374151' : '#f3f4f6',
    chipBgHover: isDark ? '#4b5563' : '#e5e7eb',
    chipBgSelected: isDark ? '#0891b2' : '#0891b2', // Teal accent
    chipText: isDark ? '#e5e7eb' : '#374151',
    chipTextSelected: '#ffffff',
    chipBgDisabled: isDark ? '#1f2937' : '#f9fafb',
    chipTextDisabled: isDark ? '#4b5563' : '#d1d5db',
    accent: '#0891b2',
  };

  if (agents.length === 0) {
    return null;
  }

  return (
    <div
      className={`${compact ? 'py-2' : 'py-3'}`}
      style={{ backgroundColor: colors.bg }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Bot size={compact ? 14 : 16} style={{ color: colors.accent }} />
        <span
          className={`${compact ? 'text-xs' : 'text-sm'} font-medium`}
          style={{ color: colors.textSecondary }}
        >
          Ask AI Tutor
        </span>
        {isLoading && (
          <span className="animate-pulse text-xs" style={{ color: colors.accent }}>
            Generating response...
          </span>
        )}
      </div>

      {/* Agent Chips */}
      <div className="flex flex-wrap gap-2">
        {agents.map((agent) => {
          const isSelected = selectedAgent?.id === agent.id;
          const chipDisabled = disabled;

          return (
            <button
              key={agent.id}
              onClick={() => !chipDisabled && onSelect(agent)}
              disabled={chipDisabled}
              className={`
                ${compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'}
                rounded-full font-medium transition-all duration-200
                inline-flex items-center gap-1.5
                ${chipDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}
                ${!chipDisabled && !isSelected ? 'hover:scale-105' : ''}
                focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-cyan-500
              `}
              style={{
                backgroundColor: isSelected
                  ? colors.chipBgSelected
                  : chipDisabled
                  ? colors.chipBgDisabled
                  : colors.chipBg,
                color: isSelected
                  ? colors.chipTextSelected
                  : chipDisabled
                  ? colors.chipTextDisabled
                  : colors.chipText,
                border: isSelected
                  ? `2px solid ${colors.chipBgSelected}`
                  : `1px solid ${chipDisabled ? colors.chipBgDisabled : colors.border}`,
                opacity: chipDisabled ? 0.5 : 1,
              }}
              aria-pressed={isSelected}
              aria-disabled={chipDisabled}
              title={agent.description || agent.displayName}
            >
              {agent.avatarUrl ? (
                <img
                  src={agent.avatarUrl}
                  alt={agent.displayName}
                  className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} rounded-full object-cover`}
                />
              ) : (
                <Sparkles size={compact ? 12 : 14} />
              )}
              {agent.displayName}
            </button>
          );
        })}
      </div>
    </div>
  );
};
