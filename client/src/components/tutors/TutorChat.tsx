import { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Bot, MessageSquare, Sparkles, Users } from 'lucide-react';
import { TutorMessage } from './TutorMessage';
import { TutorTypingIndicator } from './TutorTypingIndicator';
import { Button } from '../common/Button';
import { EmotionalPulseWidget } from '../common/EmotionalPulseWidget';
import { useTheme } from '../../hooks/useTheme';
import type {
  TutorAgent,
  TutorMessage as TutorMessageType,
  TutorMode,
  RoutingInfo,
  CollaborativeInfo,
} from '../../types/tutor';
import type { EmotionType } from '../../types';

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
  conversationId?: number;
  onEmotionalPulse?: (emotion: EmotionType) => void;
}

export const TutorChat = ({
  agent,
  messages,
  onSendMessage,
  onClearConversation,
  isLoading,
  mode,
  conversationId,
  onEmotionalPulse,
}: TutorChatProps) => {
  const { isDark } = useTheme();
  const [input, setInput] = useState('');

  // Theme colors
  const colors = {
    bg: isDark ? '#1f2937' : '#ffffff',
    bgAlt: isDark ? '#111827' : '#f9fafb',
    border: isDark ? '#374151' : '#e5e7eb',
    borderLight: isDark ? '#374151' : '#f3f4f6',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    inputBg: isDark ? '#1f2937' : '#ffffff',
    inputBorder: isDark ? '#4b5563' : '#d1d5db',
    messageBubble: isDark ? '#374151' : '#f3f4f6',
    emptyIcon: isDark ? '#374151' : '#e5e7eb',
    emptyIconInner: isDark ? '#6b7280' : '#9ca3af',
    modeBadgeTealBg: isDark ? 'rgba(8, 143, 143, 0.2)' : '#f0fdfd',
    modeBadgeTealText: isDark ? '#22d3d3' : '#088F8F',
    modeBadgeBlueBg: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff',
    modeBadgeBlueText: isDark ? '#60a5fa' : '#2563eb',
  };
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
          <div
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
            style={{ color: colors.modeBadgeTealText, backgroundColor: colors.modeBadgeTealBg }}
          >
            <Sparkles className="w-3 h-3" />
            <span>Auto-Route</span>
          </div>
        );
      case 'collaborative':
        return (
          <div
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
            style={{ color: colors.modeBadgeBlueText, backgroundColor: colors.modeBadgeBlueBg }}
          >
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
      <div className="flex-1 flex items-center justify-center min-h-0 min-w-0" style={{ backgroundColor: colors.bgAlt }}>
        <div className="text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: colors.emptyIcon }}
          >
            <MessageSquare className="w-8 h-8" style={{ color: colors.emptyIconInner }} />
          </div>
          <h3 className="text-lg font-medium mb-2" style={{ color: colors.textPrimary }}>Select a Tutor</h3>
          <p className="max-w-sm" style={{ color: colors.textSecondary }}>
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
    <div className="flex-1 flex flex-col min-h-0 min-w-0" style={{ backgroundColor: colors.bg }}>
      {/* Chat Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: colors.borderLight }}
      >
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
              <h2 className="font-semibold" style={{ color: colors.textPrimary }}>{agent.displayName}</h2>
              {getModeLabel()}
            </div>
            <p className="text-xs" style={{ color: colors.textSecondary }}>
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
      <div
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {/* Welcome message if no messages */}
        {messages.length === 0 && (
          <div className="flex items-start gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br ${getPersonalityColor()} text-white`}
            >
              <Bot className="w-4 h-4" />
            </div>
            <div
              className="px-4 py-3 rounded-2xl rounded-bl-md max-w-[80%]"
              style={{ backgroundColor: colors.messageBubble }}
            >
              <p className="text-sm" style={{ color: colors.textPrimary }}>
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

      {/* Emotional Pulse Widget */}
      <EmotionalPulseWidget
        context="chatbot"
        contextId={conversationId}
        agentId={agent.id}
        cooldownMs={10000}
        compact
        onPulse={onEmotionalPulse}
      />

      {/* Input Area */}
      <div className="p-4 border-t" style={{ borderColor: colors.borderLight }}>
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agent.displayName}...`}
            className="flex-1 px-4 py-2 border rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            style={{
              backgroundColor: colors.inputBg,
              borderColor: colors.inputBorder,
              color: colors.textPrimary,
            }}
            rows={1}
            disabled={isLoading}
            aria-label={`Message ${agent.displayName}`}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            icon={<Send className="w-4 h-4" />}
            aria-label="Send message"
          >
            Send
          </Button>
        </div>
        <p className="text-xs mt-2" style={{ color: colors.textMuted }}>
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};
