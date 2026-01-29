import { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Bot, MessageSquare, Sparkles, Users } from 'lucide-react';
import { TutorMessage } from './TutorMessage';
import { TutorTypingIndicator } from './TutorTypingIndicator';
import { Button } from '../common/Button';
import type {
  TutorAgent,
  TutorMessage as TutorMessageType,
  TutorMode,
  RoutingInfo,
  CollaborativeInfo,
} from '../../types/tutor';

interface MessageWithMeta extends TutorMessageType {
  routingInfo?: RoutingInfo;
  collaborativeInfo?: CollaborativeInfo;
}

interface TutorChatProps {
  agent: TutorAgent | null;
  messages: MessageWithMeta[];
  onSendMessage: (message: string) => Promise<void>;
  onClearConversation: () => void;
  isLoading: boolean;
  mode: TutorMode;
}

export const TutorChat = ({
  agent,
  messages,
  onSendMessage,
  onClearConversation,
  isLoading,
  mode,
}: TutorChatProps) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input when agent changes
  useEffect(() => {
    if (agent) {
      inputRef.current?.focus();
    }
  }, [agent?.id]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !agent) return;

    const message = input.trim();
    setInput('');
    await onSendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getModeLabel = () => {
    switch (mode) {
      case 'router':
        return (
          <div className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
            <Sparkles className="w-3 h-3" />
            <span>Auto-Route</span>
          </div>
        );
      case 'collaborative':
        return (
          <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
            <Users className="w-3 h-3" />
            <span>Team Mode</span>
          </div>
        );
      default:
        return null;
    }
  };

  // No agent selected
  if (!agent) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Tutor</h3>
          <p className="text-gray-500 max-w-sm">
            Choose a tutor from the sidebar to start a conversation. Each tutor has a
            unique teaching style.
          </p>
        </div>
      </div>
    );
  }

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
    <div className="flex-1 flex flex-col h-full bg-white">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
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
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-900">{agent.displayName}</h2>
              {getModeLabel()}
            </div>
            <p className="text-xs text-gray-500">
              {agent.description || 'AI Tutor'}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearConversation}
          disabled={isLoading || messages.length === 0}
          icon={<Trash2 className="w-4 h-4" />}
          title="Clear conversation"
        >
          Clear
        </Button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Welcome message if no messages */}
        {messages.length === 0 && (
          <div className="flex items-start gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br ${getPersonalityColor()} text-white`}
            >
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md max-w-[80%]">
              <p className="text-sm text-gray-900">
                {agent.welcomeMessage ||
                  `Hello! I'm ${agent.displayName}. How can I help you today?`}
              </p>
            </div>
          </div>
        )}

        {/* Conversation messages */}
        {messages.map((message) => (
          <TutorMessage
            key={message.id}
            message={message}
            agentName={agent.displayName}
            routingInfo={message.routingInfo}
            collaborativeInfo={message.collaborativeInfo}
            showMetadata={true}
          />
        ))}

        {/* Typing indicator */}
        {isLoading && <TutorTypingIndicator agentName={agent.displayName} />}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agent.displayName}...`}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            rows={1}
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            icon={<Send className="w-4 h-4" />}
          >
            Send
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};
