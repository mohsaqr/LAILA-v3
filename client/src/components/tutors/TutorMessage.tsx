import { useTranslation } from 'react-i18next';
import { Bot, User, Info, Users } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import type { TutorMessage as TutorMessageType, RoutingInfo, CollaborativeInfo } from '../../types/tutor';

interface TutorMessageProps {
  message: TutorMessageType;
  agentName?: string;
  routingInfo?: RoutingInfo;
  collaborativeInfo?: CollaborativeInfo;
  showMetadata?: boolean;
}

export const TutorMessage = ({
  message,
  agentName: _agentName,
  routingInfo,
  collaborativeInfo,
  showMetadata = false,
}: TutorMessageProps) => {
  const { t } = useTranslation(['tutors']);
  const { isDark } = useTheme();
  const isUser = message.role === 'user';

  // Theme colors
  const colors = {
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    avatarBg: isDark ? '#374151' : '#e5e7eb',
    avatarIcon: isDark ? '#9ca3af' : '#6b7280',
    messageBubble: isDark ? '#374151' : '#f3f4f6',
    contributionBg: isDark ? '#1f2937' : '#f9fafb',
    contributionBorder: isDark ? '#374151' : '#f3f4f6',
    contributionTitle: isDark ? '#d1d5db' : '#374151',
    contributionText: isDark ? '#9ca3af' : '#6b7280',
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: isUser ? '#3b82f6' : colors.avatarBg,
          color: isUser ? '#ffffff' : colors.avatarIcon,
        }}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Message content */}
      <div className={`max-w-[80%] ${isUser ? 'text-right' : 'text-left'}`}>
        {/* Routing info badge */}
        {routingInfo && !isUser && (
          <div className="flex items-center gap-1 text-xs mb-1" style={{ color: colors.textSecondary }}>
            <Info className="w-3 h-3" />
            <span>{t('routed_to', { name: routingInfo.selectedAgent.displayName })}</span>
            <span style={{ color: colors.textMuted }}>
              ({t('confidence_percent', { percent: Math.round(routingInfo.confidence * 100) })})
            </span>
          </div>
        )}

        {/* Collaborative info badge */}
        {collaborativeInfo && !isUser && (
          <div className="flex items-center gap-1 text-xs mb-1" style={{ color: colors.textSecondary }}>
            <Users className="w-3 h-3" />
            <span>
              {t('team_response_from', { count: collaborativeInfo.agentContributions.length })}
            </span>
          </div>
        )}

        {/* Message bubble */}
        <div
          className={`px-4 py-2 rounded-2xl ${isUser ? 'rounded-br-md' : 'rounded-bl-md'}`}
          style={{
            backgroundColor: isUser ? '#3b82f6' : colors.messageBubble,
            color: isUser ? '#ffffff' : colors.textPrimary,
          }}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Metadata */}
        <div
          className={`flex items-center gap-2 mt-1 text-xs ${
            isUser ? 'justify-end' : 'justify-start'
          }`}
          style={{ color: colors.textMuted }}
        >
          <span>{formatTime(message.createdAt)}</span>
          {showMetadata && message.responseTimeMs && (
            <span>• {(message.responseTimeMs / 1000).toFixed(1)}s</span>
          )}
          {showMetadata && message.aiModel && <span>• {message.aiModel}</span>}
        </div>

        {/* Collaborative contributions (expandable) */}
        {collaborativeInfo && !isUser && (
          <details className="mt-2">
            <summary className="text-xs cursor-pointer" style={{ color: colors.textSecondary }}>
              {t('view_individual_contributions')}
            </summary>
            <div className="mt-2 space-y-2 text-sm">
              {collaborativeInfo.agentContributions.map((contrib, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded-lg border"
                  style={{
                    backgroundColor: colors.contributionBg,
                    borderColor: colors.contributionBorder,
                  }}
                >
                  <p className="text-xs font-medium mb-1" style={{ color: colors.contributionTitle }}>
                    {contrib.agentDisplayName}
                  </p>
                  <p className="text-xs" style={{ color: colors.contributionText }}>{contrib.contribution}</p>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
};
