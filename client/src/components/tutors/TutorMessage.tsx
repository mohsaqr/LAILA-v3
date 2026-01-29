import { Bot, User, Info, Users } from 'lucide-react';
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
  const isUser = message.role === 'user';

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-600'
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Message content */}
      <div className={`max-w-[80%] ${isUser ? 'text-right' : 'text-left'}`}>
        {/* Routing info badge */}
        {routingInfo && !isUser && (
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
            <Info className="w-3 h-3" />
            <span>Routed to {routingInfo.selectedAgent.displayName}</span>
            <span className="text-gray-400">
              ({Math.round(routingInfo.confidence * 100)}% confidence)
            </span>
          </div>
        )}

        {/* Collaborative info badge */}
        {collaborativeInfo && !isUser && (
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
            <Users className="w-3 h-3" />
            <span>
              Team response from {collaborativeInfo.agentContributions.length} tutors
            </span>
          </div>
        )}

        {/* Message bubble */}
        <div
          className={`px-4 py-2 rounded-2xl ${
            isUser
              ? 'bg-primary-500 text-white rounded-br-md'
              : 'bg-gray-100 text-gray-900 rounded-bl-md'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Metadata */}
        <div
          className={`flex items-center gap-2 mt-1 text-xs text-gray-400 ${
            isUser ? 'justify-end' : 'justify-start'
          }`}
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
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
              View individual contributions
            </summary>
            <div className="mt-2 space-y-2 text-sm">
              {collaborativeInfo.agentContributions.map((contrib, idx) => (
                <div key={idx} className="p-2 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-xs font-medium text-gray-700 mb-1">
                    {contrib.agentDisplayName}
                  </p>
                  <p className="text-gray-600 text-xs">{contrib.contribution}</p>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
};
