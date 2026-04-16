import { useState, useRef, useLayoutEffect } from 'react';
import { Send, Loader2, MessageCircle, Bot } from 'lucide-react';
import { AgentTestMessage } from '../../types';
import { ChatMarkdown } from './ChatMarkdown';

interface TestChatInterfaceProps {
  agentName: string;
  agentTitle?: string | null;
  avatarImageUrl: string | null;
  welcomeMessage: string | null;
  messages: AgentTestMessage[];
  onSendMessage: (message: string) => void;
  isSending: boolean;
  error?: string | null;
  suggestedQuestions?: string[];
  /**
   * Optional node rendered as a horizontal bar directly above the input
   * form — used by the agent test chat page to embed the EmotionalPulse
   * widget exactly like the AI Tutors chat does.
   */
  footerSlot?: React.ReactNode;
  /**
   * When true, hides the input form and suggested questions — used by the
   * instructor/admin ConversationReplay view to display an archived chat
   * in read-only mode with the same visual identity as the live test page.
   */
  readOnly?: boolean;
}

export const TestChatInterface = ({
  agentName,
  agentTitle,
  avatarImageUrl,
  welcomeMessage,
  messages,
  onSendMessage,
  isSending,
  error,
  suggestedQuestions = [],
  footerSlot,
  readOnly = false,
}: TestChatInterfaceProps) => {
  const [message, setMessage] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevMessageCountRef = useRef(0);

  // Scroll to bottom when new messages arrive or typing indicator toggles.
  // Uses useLayoutEffect + direct scrollTop to avoid the nested-flex gotchas
  // of scrollIntoView, so the latest message is always visible at the bottom
  // while earlier messages remain reachable by scrolling up.
  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const hadNewMessage = messages.length > prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;
    // Always jump to bottom on first paint / new message / sending state.
    el.scrollTop = el.scrollHeight;
    // Smooth scroll on subsequent new messages for a polished feel.
    if (hadNewMessage) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isSending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isSending) return;
    onSendMessage(message.trim());
    setMessage('');
  };

  // Build display messages including welcome message
  const displayMessages: { role: 'user' | 'assistant'; content: string; id?: number }[] = [];

  if (welcomeMessage && messages.length === 0) {
    displayMessages.push({
      role: 'assistant',
      content: welcomeMessage,
      id: 0,
    });
  }

  messages.forEach((msg) => {
    displayMessages.push({
      role: msg.role,
      content: msg.content,
      id: msg.id,
    });
  });

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-50 to-purple-50 border-b border-violet-100 px-4 py-3">
        <div className="flex items-center gap-3">
          {avatarImageUrl ? (
            <img
              src={avatarImageUrl}
              alt={agentName}
              className="w-10 h-10 rounded-full object-cover shadow-sm"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center shadow-sm">
              <Bot className="w-5 h-5 text-violet-600" />
            </div>
          )}
          <div>
            <div className="flex items-baseline gap-2">
              <h3 className="font-semibold text-gray-900">{agentName}</h3>
              {agentTitle && (
                <span className="text-xs text-violet-600 font-medium">{agentTitle}</span>
              )}
            </div>
            <p className="text-xs text-gray-500">Testing mode</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-gray-50"
      >
        {displayMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <MessageCircle className="w-10 h-10 mb-2 opacity-50" />
            <p className="text-sm">Start a conversation to test your agent!</p>
          </div>
        ) : (
          <>
            {displayMessages.map((msg, index) => (
              <div
                key={msg.id || index}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`rounded-2xl px-4 py-2.5 ${
                    msg.role === 'user'
                      ? 'max-w-[80%] bg-primary-600 text-white rounded-br-md'
                      : 'max-w-[95%] bg-white shadow-sm border border-gray-100 rounded-bl-md'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="text-sm prose prose-sm max-w-none dark:prose-invert prose-pre:bg-gray-50 prose-pre:border prose-pre:border-gray-200 prose-pre:rounded-lg prose-code:text-xs">
                      <ChatMarkdown content={msg.content} />
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator when sending */}
            {isSending && (
              <div className="flex justify-start">
                <div className="bg-white shadow-sm border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-1">
                    <span
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    />
                    <span
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    />
                    <span
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                </div>
              </div>
            )}

          </>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-100">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Suggested Questions */}
      {!readOnly && suggestedQuestions.length > 0 && messages.length === 0 && (
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500 mb-2">Suggested questions:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.slice(0, 4).map((question, index) => (
              <button
                key={index}
                type="button"
                onClick={() => onSendMessage(question)}
                disabled={isSending}
                className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-full hover:border-violet-300 hover:bg-violet-50 transition-colors disabled:opacity-50"
              >
                {question.length > 50 ? question.substring(0, 50) + '...' : question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Footer slot (e.g. emotional pulse horizontal bar) */}
      {!readOnly && footerSlot && (
        <div className="border-t border-gray-200 px-4 py-2 bg-white">
          {footerSlot}
        </div>
      )}

      {readOnly && (
        <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 text-xs text-gray-500 text-center">
          Read-only archive · {messages.length} message{messages.length === 1 ? '' : 's'}
        </div>
      )}

      {/* Input */}
      {!readOnly && (
      <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4 bg-white">
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message to test your agent..."
            disabled={isSending}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!message.trim() || isSending}
            className="p-2.5 bg-violet-500 text-white rounded-full hover:bg-violet-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </form>
      )}
    </div>
  );
};
