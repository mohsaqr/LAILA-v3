import { Bot, MessageCircle } from 'lucide-react';
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
  const hasUnread = false; // Placeholder for future notification system
  const messageCount = conversation?.messageCount || 0;

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
      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
        isSelected
          ? 'bg-primary-50 border border-primary-200 shadow-sm'
          : 'hover:bg-gray-50 border border-transparent'
      }`}
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
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-gray-900 truncate">{agent.displayName}</p>
          {hasUnread && (
            <span className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0" />
          )}
        </div>
        <p className="text-xs text-gray-500 truncate">
          {conversation?.lastMessage
            ? conversation.lastMessage.content.slice(0, 30) +
              (conversation.lastMessage.content.length > 30 ? '...' : '')
            : agent.description || 'Start a conversation'}
        </p>
      </div>

      {/* Message count */}
      {messageCount > 0 && (
        <div className="flex items-center gap-1 text-gray-400">
          <MessageCircle className="w-3 h-3" />
          <span className="text-xs">{messageCount}</span>
        </div>
      )}
    </button>
  );
};
