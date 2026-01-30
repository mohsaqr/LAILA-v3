import { Bot, X } from 'lucide-react';
import { TutorAgentCard } from './TutorAgentCard';
import { TutorModeSelector } from './TutorModeSelector';
import { useTheme } from '../../hooks/useTheme';
import type { TutorAgent, TutorConversation, TutorMode } from '../../types/tutor';

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
}: TutorSidebarProps) => {
  const { isDark } = useTheme();

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
          fixed inset-y-0 left-0 z-40 w-72 border-r flex flex-col h-full
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0
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
                <h2 className="font-semibold" style={{ color: colors.textPrimary }}>AI Tutors</h2>
                <p className="text-xs" style={{ color: colors.textSecondary }}>{agents.length} tutors available</p>
              </div>
            </div>
            {/* Close button - mobile only */}
            <button
              onClick={onClose}
              className="md:hidden p-2 rounded-lg transition-colors"
              style={{ color: colors.textMuted }}
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Agent List */}
        <div className="flex-1 overflow-y-auto p-2">
          {agents.length > 0 ? (
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
              <p className="text-sm">No tutors available</p>
            </div>
          )}
        </div>

        {/* Mode Selector */}
        <TutorModeSelector mode={mode} onModeChange={onModeChange} disabled={isLoading} />
      </div>
    </>
  );
};
