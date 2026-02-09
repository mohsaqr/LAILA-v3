import { useTranslation } from 'react-i18next';
import { Bot, X, Users, MessageCircle } from 'lucide-react';
import { TutorAgentCard } from './TutorAgentCard';
import { TutorModeSelector } from './TutorModeSelector';
import { useTheme } from '../../hooks/useTheme';
import type { TutorAgent, TutorConversation, TutorMode } from '../../types/tutor';

// Virtual "Team Chat" agent for unified conversations
const TEAM_CHAT_AGENT: TutorAgent = {
  id: -1, // Special ID for team chat
  name: 'team-chat',
  displayName: 'Team Chat',
  description: 'Unified conversation with all tutors',
  avatarUrl: null,
  welcomeMessage: 'Welcome to Team Chat! All tutors can participate here.',
  personality: 'collaborative',
  temperature: 0.7,
  systemPrompt: '',
  isActive: true,
};

interface TutorSidebarProps {
  agents: TutorAgent[];
  conversations: TutorConversation[];
  selectedAgent: TutorAgent | null;
  onAgentSelect: (agent: TutorAgent) => void;
  mode: TutorMode;
  onModeChange: (mode: TutorMode) => void;
  isLoading?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  /** Allow students to change routing mode (default: true) */
  allowModeSwitch?: boolean;
}

export const TutorSidebar = ({
  agents,
  conversations,
  selectedAgent,
  onAgentSelect,
  mode,
  onModeChange,
  isLoading = false,
  isOpen = true,
  onClose,
  allowModeSwitch = true,
}: TutorSidebarProps) => {
  const { isDark } = useTheme();
  const { t } = useTranslation(['tutors', 'common']);

  // Theme colors
  const colors = {
    bg: isDark ? '#1f2937' : '#ffffff',
    border: isDark ? '#374151' : '#e5e7eb',
    borderLight: isDark ? '#374151' : '#f3f4f6',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    hoverBg: isDark ? '#374151' : '#f3f4f6',
    emptyIcon: isDark ? '#4b5563' : '#d1d5db',
  };

  // Get conversation for each agent
  const getConversationForAgent = (agentId: number) => {
    return conversations.find((c) => c.chatbotId === agentId) || null;
  };

  const handleAgentSelect = (agent: TutorAgent) => {
    onAgentSelect(agent);
    onClose?.();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed inset-y-0 left-0 z-40 w-72 border-r flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:static lg:translate-x-0 lg:h-full lg:flex-shrink-0
        `}
        style={{
          backgroundColor: colors.bg,
          borderColor: colors.border,
        }}
      >
        {/* Header */}
        <div className="p-4 border-b" style={{ borderColor: colors.borderLight }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold" style={{ color: colors.textPrimary }}>{t('ai_tutors')}</h2>
                <p className="text-xs" style={{ color: colors.textSecondary }}>{t('n_tutors_available_short', { count: agents.length })}</p>
              </div>
            </div>
            {/* Close button - mobile only */}
            <button
              onClick={onClose}
              className="md:hidden p-2 rounded-lg transition-colors"
              style={{ color: colors.textMuted }}
              aria-label={t('close_sidebar')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Agent List */}
        <div className="flex-1 overflow-y-auto p-2">
          {/* Team Chat - shown prominently in collaborative/router modes */}
          {(mode === 'collaborative' || mode === 'router') && (
            <div className="mb-3">
              <button
                onClick={() => handleAgentSelect(agents[0] || TEAM_CHAT_AGENT)}
                className="w-full flex items-center gap-3 p-3 rounded-xl transition-all"
                style={{
                  backgroundColor: selectedAgent?.id === agents[0]?.id || selectedAgent?.id === -1
                    ? (isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff')
                    : colors.hoverBg,
                  border: `2px solid ${selectedAgent?.id === agents[0]?.id || selectedAgent?.id === -1 ? '#3b82f6' : 'transparent'}`,
                }}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white">
                  <Users className="w-6 h-6" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold" style={{ color: colors.textPrimary }}>
                    {t('team_chat')}
                  </p>
                  <p className="text-xs" style={{ color: colors.textSecondary }}>
                    {mode === 'collaborative' ? t('all_tutors_participate') : t('auto_routed_responses')}
                  </p>
                </div>
                <MessageCircle className="w-4 h-4" style={{ color: colors.textMuted }} />
              </button>
              <div className="mt-2 px-2">
                <p className="text-xs" style={{ color: colors.textMuted }}>
                  {t('n_tutors_in_team', { count: agents.length })}
                </p>
              </div>
            </div>
          )}

          {/* Individual agents - always shown in manual mode, collapsed in team modes */}
          {mode === 'manual' ? (
            agents.length > 0 ? (
              <div className="space-y-1">
                {agents.map((agent) => (
                  <TutorAgentCard
                    key={agent.id}
                    agent={agent}
                    conversation={getConversationForAgent(agent.id)}
                    isSelected={selectedAgent?.id === agent.id}
                    onClick={() => handleAgentSelect(agent)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8" style={{ color: colors.textSecondary }}>
                <Bot className="w-12 h-12 mx-auto mb-3" style={{ color: colors.emptyIcon }} />
                <p className="text-sm">{t('no_tutors_available')}</p>
              </div>
            )
          ) : (
            /* In team modes, show participants list with colorful icons */
            <details className="group" open>
              <summary
                className="flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs font-medium"
                style={{ color: colors.textSecondary }}
              >
                <span>{t('team_members', { count: agents.length })}</span>
              </summary>
              <div className="mt-1 space-y-1">
                {agents.map((agent) => {
                  const getPersonalityGradient = () => {
                    switch (agent.personality) {
                      case 'socratic': return 'from-purple-500 to-indigo-500';
                      case 'friendly': return 'from-green-500 to-emerald-500';
                      case 'casual': return 'from-orange-500 to-amber-500';
                      case 'professional': return 'from-blue-500 to-cyan-500';
                      default: return 'from-pink-500 to-rose-500';
                    }
                  };
                  return (
                    <div
                      key={agent.id}
                      className="flex items-center gap-2 p-2 rounded-lg text-sm"
                    >
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getPersonalityGradient()} flex items-center justify-center text-white text-xs`}>
                        {agent.avatarUrl ? (
                          <img src={agent.avatarUrl} alt={agent.displayName} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <Bot className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: colors.textPrimary }}>{agent.displayName}</p>
                        <p className="text-xs truncate" style={{ color: colors.textMuted }}>{agent.personality || t('tutor')}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </div>

        {/* Mode Selector - only if allowed */}
        {allowModeSwitch && (
          <TutorModeSelector mode={mode} onModeChange={onModeChange} disabled={isLoading} />
        )}
      </div>
    </>
  );
};
