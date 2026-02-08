import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Loader2, Bot, User } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

interface LectureAIHelperChatProps {
  messages: Message[];
  isLoading: boolean;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
}

export const LectureAIHelperChat = ({
  messages,
  isLoading,
  inputValue,
  onInputChange,
  onSend,
  placeholder,
}: LectureAIHelperChatProps) => {
  const { t } = useTranslation(['teaching']);
  const { isDark } = useTheme();
  const effectivePlaceholder = placeholder || t('ask_about_lecture');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Theme colors
  const colors = {
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    avatarBg: isDark ? '#374151' : '#e5e7eb',
    avatarIcon: isDark ? '#9ca3af' : '#6b7280',
    messageBubble: isDark ? '#374151' : '#f3f4f6',
    userBubble: '#3b82f6',
    inputBg: isDark ? '#374151' : '#f9fafb',
    inputBorder: isDark ? '#4b5563' : '#e5e7eb',
    dot: isDark ? '#6b7280' : '#9ca3af',
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim() && !isLoading) {
        onSend();
      }
    }
  };

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px] max-h-[300px]">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex items-start gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {/* Avatar */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: message.role === 'user' ? colors.userBubble : colors.avatarBg,
                color: message.role === 'user' ? '#ffffff' : colors.avatarIcon,
              }}
            >
              {message.role === 'user' ? (
                <User className="w-4 h-4" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
            </div>

            {/* Message bubble */}
            <div className={`max-w-[80%] ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
              <div
                className={`px-4 py-2 rounded-2xl ${
                  message.role === 'user' ? 'rounded-br-md' : 'rounded-bl-md'
                }`}
                style={{
                  backgroundColor: message.role === 'user' ? colors.userBubble : colors.messageBubble,
                  color: message.role === 'user' ? '#ffffff' : colors.textPrimary,
                }}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
              {message.timestamp && (
                <p
                  className={`text-xs mt-1 ${message.role === 'user' ? 'text-right' : 'text-left'}`}
                  style={{ color: colors.textMuted }}
                >
                  {formatTime(message.timestamp)}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: colors.avatarBg }}
            >
              <Bot className="w-4 h-4" style={{ color: colors.avatarIcon }} />
            </div>
            <div
              className="px-4 py-3 rounded-2xl rounded-bl-md"
              style={{ backgroundColor: colors.messageBubble }}
            >
              <div className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{ backgroundColor: colors.dot, animationDelay: '0ms' }}
                />
                <div
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{ backgroundColor: colors.dot, animationDelay: '150ms' }}
                />
                <div
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{ backgroundColor: colors.dot, animationDelay: '300ms' }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-3 border-t" style={{ borderColor: colors.inputBorder }}>
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={effectivePlaceholder}
            disabled={isLoading}
            rows={1}
            className="flex-1 px-4 py-2.5 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            style={{
              backgroundColor: colors.inputBg,
              border: `1px solid ${colors.inputBorder}`,
              color: colors.textPrimary,
              minHeight: '44px',
              maxHeight: '120px',
            }}
          />
          <button
            onClick={onSend}
            disabled={!inputValue.trim() || isLoading}
            className="p-2.5 rounded-xl bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
