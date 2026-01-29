import { Bot } from 'lucide-react';

interface TutorTypingIndicatorProps {
  agentName?: string;
}

export const TutorTypingIndicator = ({ agentName }: TutorTypingIndicatorProps) => {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4 text-gray-600" />
      </div>
      <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        {agentName && (
          <p className="text-xs text-gray-500 mt-1">{agentName} is thinking...</p>
        )}
      </div>
    </div>
  );
};
