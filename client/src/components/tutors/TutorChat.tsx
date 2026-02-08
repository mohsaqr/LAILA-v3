import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Trash2, Bot, MessageSquare, Sparkles, Users } from 'lucide-react';
import { TutorMessage } from './TutorMessage';
import { TutorTypingIndicator } from './TutorTypingIndicator';
import { CollaborativePicker } from './CollaborativePicker';
import { CollaborativeResponse } from './CollaborativeResponse';
import { Button } from '../common/Button';
import { EmotionalPulseWidget } from '../common/EmotionalPulseWidget';
import { useTheme } from '../../hooks/useTheme';
import type {
  TutorAgent,
  TutorMessage as TutorMessageType,
  TutorMode,
  RoutingInfo,
  CollaborativeInfo,
  CollaborativeSettings,
} from '../../types/tutor';
import type { EmotionType } from '../../types';

interface MessageWithMeta extends TutorMessageType {
  routingInfo?: RoutingInfo;
  collaborativeInfo?: CollaborativeInfo;
}

interface TutorChatProps {
  agent: TutorAgent | null;
  agents?: TutorAgent[]; // All available agents for collaborative picker
  messages: MessageWithMeta[];
  onSendMessage: (message: string, settings?: CollaborativeSettings) => Promise<void>;
  onClearConversation: () => void;
  onModeChange?: (mode: TutorMode) => void;
  isLoading: boolean;
  mode: TutorMode;
  conversationId?: number;
  onEmotionalPulse?: (emotion: EmotionType) => void;
  /** Allow students to change routing mode (default: true) */
  allowModeSwitch?: boolean;
}

export const TutorChat = ({
  agent,
  agents = [],
  messages,
  onSendMessage,
  onClearConversation,
  onModeChange,
  isLoading,
  mode,
  conversationId,
  onEmotionalPulse,
  allowModeSwitch = true,
}: TutorChatProps) => {
  const { isDark } = useTheme();
  const { t } = useTranslation(['tutors', 'common']);
  const [input, setInput] = useState('');
  const [collaborativeSettings, setCollaborativeSettings] = useState<CollaborativeSettings>({
    style: 'parallel',
  });

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

    // Pass collaborative settings only in collaborative mode
    const settings = mode === 'collaborative' ? collaborativeSettings : undefined;
    await onSendMessage(message, settings);
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
            <span>{t('auto_route')}</span>
          </div>
        );
      case 'collaborative':
        return (
          <div
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
            style={{ color: colors.modeBadgeBlueText, backgroundColor: colors.modeBadgeBlueBg }}
          >
            <Users className="w-3 h-3" />
            <span>{t('team_mode')}</span>
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
          <h3 className="text-lg font-medium mb-2" style={{ color: colors.textPrimary }}>{t('select_a_tutor')}</h3>
          <p className="max-w-sm" style={{ color: colors.textSecondary }}>
            {t('select_tutor_description')}
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
          {/* Show Team Chat avatar/name in collaborative/router mode */}
          {mode === 'collaborative' || mode === 'router' ? (
            <>
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold" style={{ color: colors.textPrimary }}>{t('team_chat')}</h2>
                  {getModeLabel()}
                </div>
                <p className="text-xs" style={{ color: colors.textSecondary }}>
                  {mode === 'collaborative'
                    ? t('n_tutors_available', { count: agents.length })
                    : t('best_tutor_auto_selected')
                  }
                </p>
              </div>
            </>
          ) : (
            <>
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
                  {agent.description || t('ai_tutor')}
                </p>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Mode quick-switch buttons - only if allowed */}
          {allowModeSwitch && (
            <div className="flex items-center gap-1 mr-2">
              <button
                onClick={() => onModeChange?.('manual')}
                disabled={isLoading}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  mode === 'manual' ? 'font-medium' : ''
                }`}
                style={{
                  backgroundColor: mode === 'manual' ? (isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff') : 'transparent',
                  color: mode === 'manual' ? (isDark ? '#60a5fa' : '#2563eb') : colors.textSecondary,
                }}
                title={t('manual_title')}
              >
                {t('manual')}
              </button>
              <button
                onClick={() => onModeChange?.('router')}
                disabled={isLoading}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  mode === 'router' ? 'font-medium' : ''
                }`}
                style={{
                  backgroundColor: mode === 'router' ? (isDark ? 'rgba(8, 143, 143, 0.2)' : '#f0fdfd') : 'transparent',
                  color: mode === 'router' ? (isDark ? '#22d3d3' : '#088F8F') : colors.textSecondary,
                }}
                title={t('auto_title')}
              >
                {t('auto')}
              </button>
              <button
                onClick={() => onModeChange?.('collaborative')}
                disabled={isLoading}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  mode === 'collaborative' ? 'font-medium' : ''
                }`}
                style={{
                  backgroundColor: mode === 'collaborative' ? (isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff') : 'transparent',
                color: mode === 'collaborative' ? (isDark ? '#60a5fa' : '#2563eb') : colors.textSecondary,
              }}
                title={t('team_title')}
              >
                {t('team')}
              </button>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearConversation}
            disabled={isLoading || messages.length === 0}
            icon={<Trash2 className="w-4 h-4" />}
            title={t('clear_conversation')}
          >
            {t('clear')}
          </Button>
        </div>
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
                  t('hello_greeting', { name: agent.displayName })}
              </p>
            </div>
          </div>
        )}

        {/* Conversation messages */}
        {messages.map((message) => {
          // For collaborative responses, show staggered display
          if (message.role === 'assistant' && message.collaborativeInfo?.agentContributions?.length) {
            // Show immediately if message is older than 5 seconds (loaded from history)
            const messageAge = Date.now() - new Date(message.createdAt).getTime();
            const isOldMessage = messageAge > 5000;

            return (
              <div key={message.id}>
                <CollaborativeResponse
                  contributions={message.collaborativeInfo.agentContributions}
                  style={message.collaborativeInfo.style}
                  immediate={isOldMessage}
                />
              </div>
            );
          }

          // Regular message display
          return (
            <TutorMessage
              key={message.id}
              message={message}
              agentName={agent.displayName}
              routingInfo={message.routingInfo}
              collaborativeInfo={message.collaborativeInfo}
              showMetadata={true}
            />
          );
        })}

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

      {/* Collaborative Picker (only in collaborative mode) */}
      {mode === 'collaborative' && agents.length > 0 && (
        <div className="px-4 pt-3">
          <CollaborativePicker
            agents={agents}
            currentSettings={collaborativeSettings}
            onSettingsChange={setCollaborativeSettings}
            disabled={isLoading}
          />
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t" style={{ borderColor: colors.borderLight }}>
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={mode === 'collaborative' ? t('message_team') : t('message_tutor', { name: agent.displayName })}
            className="flex-1 px-4 py-2 border rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            style={{
              backgroundColor: colors.inputBg,
              borderColor: colors.inputBorder,
              color: colors.textPrimary,
            }}
            rows={1}
            disabled={isLoading}
            aria-label={mode === 'collaborative' ? t('message_team') : t('message_tutor', { name: agent.displayName })}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            icon={<Send className="w-4 h-4" />}
            aria-label={t('send_message')}
          >
            {t('send')}
          </Button>
        </div>
        <p className="text-xs mt-2" style={{ color: colors.textMuted }}>
          {t('press_enter_to_send')}
        </p>
      </div>
    </div>
  );
};
