import { Bot } from 'lucide-react';
import { TutorAgentCard } from './TutorAgentCard';
import { TutorModeSelector } from './TutorModeSelector';
import type { TutorAgent, TutorConversation, TutorMode } from '../../types/tutor';

interface TutorSidebarProps {
  agents: TutorAgent[];
  conversations: TutorConversation[];
  selectedAgent: TutorAgent | null;
  onAgentSelect: (agent: TutorAgent) => void;
  mode: TutorMode;
  onModeChange: (mode: TutorMode) => void;
  isLoading?: boolean;
}

export const TutorSidebar = ({
  agents,
  conversations,
  selectedAgent,
  onAgentSelect,
  mode,
  onModeChange,
  isLoading = false,
}: TutorSidebarProps) => {
  // Get conversation for each agent
  const getConversationForAgent = (agentId: number) => {
    return conversations.find((c) => c.chatbotId === agentId) || null;
  };

  return (
    <div className="w-72 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">AI Tutors</h2>
            <p className="text-xs text-gray-500">{agents.length} tutors available</p>
          </div>
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
                onClick={() => onAgentSelect(agent)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Bot className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No tutors available</p>
          </div>
        )}
      </div>

      {/* Mode Selector */}
      <TutorModeSelector mode={mode} onModeChange={onModeChange} disabled={isLoading} />
    </div>
  );
};
