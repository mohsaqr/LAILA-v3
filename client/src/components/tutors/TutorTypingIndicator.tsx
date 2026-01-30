import { Bot } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface TutorTypingIndicatorProps {
  agentName?: string;
}

export const TutorTypingIndicator = ({ agentName }: TutorTypingIndicatorProps) => {
  const { isDark } = useTheme();

  // Theme colors
  const colors = {
    avatarBg: isDark ? '#374151' : '#e5e7eb',
    avatarIcon: isDark ? '#9ca3af' : '#6b7280',
    bubbleBg: isDark ? '#374151' : '#f3f4f6',
    dot: isDark ? '#6b7280' : '#9ca3af',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
  };

  return (
    <div className="flex items-start gap-3">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: colors.avatarBg }}
      >
        <Bot className="w-4 h-4" style={{ color: colors.avatarIcon }} />
      </div>
      <div
        className="px-4 py-3 rounded-2xl rounded-bl-md"
        style={{ backgroundColor: colors.bubbleBg }}
      >
        <div className="flex items-center gap-1">
          <div
            className="w-2 h-2 rounded-full animate-bounce"
            style={{ backgroundColor: colors.dot, animationDelay: '0ms' }}
          />
          <div
            className="w-2 h-2 rounded-full animate-bounce"
            style={{ backgroundColor: colors.dot, animationDelay: '150ms' }}
          />
          <div
            className="w-2 h-2 rounded-full animate-bounce"
            style={{ backgroundColor: colors.dot, animationDelay: '300ms' }}
          />
        </div>
        {agentName && (
          <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
            {agentName} is thinking...
          </p>
        )}
      </div>
    </div>
  );
};
