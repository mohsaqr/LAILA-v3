import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, Send, Bot, User, Loader2, MessageSquare } from 'lucide-react';
import { chatbotsApi } from '../../api/chat';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { EmptyState } from '../../components/common/EmptyState';
import { Chatbot, ChatMessage } from '../../types';

export const Chatbots = () => {
  const [selectedBot, setSelectedBot] = useState<Chatbot | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: chatbots, isLoading: botsLoading } = useQuery({
    queryKey: ['chatbots'],
    queryFn: () => chatbotsApi.getChatbots(),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectBot = (bot: Chatbot) => {
    setSelectedBot(bot);
    setMessages([
      {
        role: 'assistant',
        content: `Hello! I'm ${bot.displayName}. ${bot.description || 'How can I help you today?'}`,
      },
    ]);
  };

  const handleSend = async () => {
    if (!input.trim() || !selectedBot || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await chatbotsApi.chatWithBot(selectedBot.name, userMessage, sessionId);
      setMessages(prev => [...prev, { role: 'assistant', content: response.reply }]);
    } catch (error) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (botsLoading) {
    return <Loading fullScreen text="Loading chatbots..." />;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link to="/ai-tools">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
            Back to AI Tools
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <Bot className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Chatbots</h1>
          <p className="text-gray-600">Chat with specialized AI assistants</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bot Selection */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-900">Available Assistants</h2>
            </CardHeader>
            <CardBody className="p-2">
              {chatbots && chatbots.length > 0 ? (
                <div className="space-y-2">
                  {chatbots.map(bot => (
                    <button
                      key={bot.id}
                      onClick={() => handleSelectBot(bot)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                        selectedBot?.id === bot.id
                          ? 'bg-primary-50 border border-primary-200'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          selectedBot?.id === bot.id
                            ? 'bg-primary-500 text-white'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        <Bot className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{bot.displayName}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {bot.category || 'General'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Bot}
                  title="No chatbots available"
                  description="Contact an admin to set up chatbots"
                />
              )}
            </CardBody>
          </Card>
        </div>

        {/* Chat Interface */}
        <div className="lg:col-span-2">
          <Card className="h-[600px] flex flex-col">
            {selectedBot ? (
              <>
                {/* Chat Header */}
                <CardHeader className="border-b flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-500 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">{selectedBot.displayName}</h2>
                    <p className="text-xs text-gray-500">{selectedBot.category || 'AI Assistant'}</p>
                  </div>
                </CardHeader>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 ${
                        msg.role === 'user' ? 'flex-row-reverse' : ''
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          msg.role === 'user'
                            ? 'bg-primary-500 text-white'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {msg.role === 'user' ? (
                          <User className="w-4 h-4" />
                        ) : (
                          <Bot className="w-4 h-4" />
                        )}
                      </div>
                      <div
                        className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                          msg.role === 'user'
                            ? 'bg-primary-500 text-white rounded-br-md'
                            : 'bg-gray-100 text-gray-900 rounded-bl-md'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-gray-600" />
                      </div>
                      <div className="bg-gray-100 px-4 py-2 rounded-2xl rounded-bl-md">
                        <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <textarea
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type your message..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                      rows={1}
                    />
                    <Button
                      onClick={handleSend}
                      disabled={!input.trim() || isLoading}
                      icon={<Send className="w-4 h-4" />}
                    >
                      Send
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState
                  icon={MessageSquare}
                  title="Select a chatbot"
                  description="Choose an AI assistant from the list to start chatting"
                />
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
