import { Bot, MessageCircle } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import type { TutorAgent, TutorConversation } from '../../types/tutor';

interface TutorAgentCardProps {
  agent: TutorAgent;
  conversation?: TutorConversation | null;
  isSelected: boolean;
  onClick: () => void;
}

export const TutorAgentCard = ({
  agent,
  conversation,
  isSelected,
  onClick,
}: TutorAgentCardProps) => {
  const { isDark } = useTheme();
  const hasUnread = false; // Placeholder for future notification system
  const messageCount = conversation?.messageCount || 0;

  // Theme colors
  const colors = {
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    hoverBg: isDark ? '#374151' : '#f9fafb',
    selectedBg: isDark ? 'rgba(var(--color-primary-500), 0.2)' : '#eff6ff',
    selectedBorder: isDark ? '#3b82f6' : '#bfdbfe',
    indicatorBorder: isDark ? '#1f2937' : '#ffffff',
  };

  // Get personality color
  const getPersonalityColor = () => {
    switch (agent.personality) {
      case 'socratic':
        return 'from-purple-500 to-indigo-500';
      case 'friendly':
        return 'from-green-500 to-emerald-500';
      case 'casual':
        return 'from-orange-500 to-amber-500';
      case 'professional':
        return 'from-blue-500 to-cyan-500';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all border ${
        isSelected ? 'shadow-sm' : ''
      }`}
      style={{
        backgroundColor: isSelected ? colors.selectedBg : 'transparent',
        borderColor: isSelected ? colors.selectedBorder : 'transparent',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor = colors.hoverBg;
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
    >
      {/* Avatar */}
      <div className="relative">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br ${getPersonalityColor()} text-white`}
        >
          {agent.avatarUrl ? (
            <img
              src={agent.avatarUrl}
              alt={agent.displayName}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <Bot className="w-5 h-5" />
          )}
        </div>
        {/* Online indicator */}
        <div
          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 rounded-full"
          style={{ borderColor: colors.indicatorBorder }}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate" style={{ color: colors.textPrimary }}>{agent.displayName}</p>
          {hasUnread && (
            <span className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0" />
          )}
        </div>
        <p className="text-xs truncate" style={{ color: colors.textSecondary }}>
          {conversation?.lastMessage
            ? conversation.lastMessage.content.slice(0, 30) +
              (conversation.lastMessage.content.length > 30 ? '...' : '')
            : agent.description || 'Start a conversation'}
        </p>
      </div>

      {/* Message count */}
      {messageCount > 0 && (
        <div className="flex items-center gap-1" style={{ color: colors.textMuted }}>
          <MessageCircle className="w-3 h-3" />
          <span className="text-xs">{messageCount}</span>
        </div>
      )}
    </button>
  );
};
