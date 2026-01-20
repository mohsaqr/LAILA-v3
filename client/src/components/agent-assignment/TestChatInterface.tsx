import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, MessageCircle, Bot } from 'lucide-react';
import { AgentTestMessage } from '../../types';

interface TestChatInterfaceProps {
  agentName: string;
  avatarImageUrl: string | null;
  welcomeMessage: string | null;
  messages: AgentTestMessage[];
  onSendMessage: (message: string) => void;
  isSending: boolean;
  error?: string | null;
}

export const TestChatInterface = ({
  agentName,
  avatarImageUrl,
  welcomeMessage,
  messages,
  onSendMessage,
  isSending,
  error,
}: TestChatInterfaceProps) => {
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
            <h3 className="font-semibold text-gray-900">{agentName}</h3>
            <p className="text-xs text-gray-500">Testing mode</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 min-h-[300px]">
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
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-primary-600 text-white rounded-br-md'
                      : 'bg-white shadow-sm border border-gray-100 rounded-bl-md'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
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

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-100">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Input */}
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
    </div>
  );
};
