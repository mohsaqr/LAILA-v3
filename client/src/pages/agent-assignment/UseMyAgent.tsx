/**
 * Use My Agent Page
 *
 * Allows students to interact with their submitted agent as a personal AI assistant.
 * Only accessible after the agent has been submitted.
 */

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Send,
  Loader2,
  Bot,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { agentAssignmentsApi } from '../../api/agentAssignments';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { AgentTestMessage } from '../../types';

export const UseMyAgent = () => {
  const { courseId, assignmentId } = useParams<{
    courseId: string;
    assignmentId: string;
  }>();
  const navigate = useNavigate();
  const assId = parseInt(assignmentId!, 10);

  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<AgentTestMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch agent config
  const { data, isLoading, error: fetchError } = useQuery({
    queryKey: ['myAgentConfig', assId],
    queryFn: () => agentAssignmentsApi.getMyAgentConfig(assId),
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-start conversation when page loads
  useEffect(() => {
    if (data?.config && !conversationId && !startConversationMutation.isPending) {
      startConversationMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.config]);

  // Start conversation mutation
  const startConversationMutation = useMutation({
    mutationFn: () => {
      if (!data?.config) throw new Error('No agent config');
      return agentAssignmentsApi.startTestConversation(assId, data.config.id);
    },
    onSuccess: (result) => {
      setConversationId(result.conversation.id);
      setMessages([]);
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to start conversation');
      toast.error('Failed to start conversation');
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (message: string) => {
      if (!conversationId) throw new Error('No conversation started');
      return agentAssignmentsApi.sendTestMessage(assId, conversationId, message);
    },
    onSuccess: (result) => {
      const newMessages: AgentTestMessage[] = [
        ...messages,
        {
          id: Date.now(),
          conversationId: conversationId!,
          role: 'user' as const,
          content: result.userMessage.content,
          messageIndex: result.userMessage.messageIndex,
          createdAt: new Date().toISOString(),
        },
        {
          id: result.assistantMessage.id,
          conversationId: conversationId!,
          role: 'assistant' as const,
          content: result.assistantMessage.content,
          messageIndex: result.assistantMessage.messageIndex,
          createdAt: result.assistantMessage.createdAt,
        },
      ];
      setMessages(newMessages);
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to send message');
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate(inputMessage.trim());
    setInputMessage('');
  };

  const handleSuggestedQuestion = (question: string) => {
    if (sendMessageMutation.isPending) return;
    sendMessageMutation.mutate(question);
  };

  const handleNewConversation = () => {
    setConversationId(null);
    setMessages([]);
    setError(null);
    startConversationMutation.mutate();
  };

  if (isLoading) {
    return <Loading fullScreen text="Loading your agent..." />;
  }

  if (fetchError || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Bot className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Agent Not Found</h1>
          <p className="text-gray-600 mb-4">
            {(fetchError as any)?.response?.data?.error || 'Could not load your agent'}
          </p>
          <Button onClick={() => navigate(`/courses/${courseId}`)}>
            Back to Course
          </Button>
        </div>
      </div>
    );
  }

  const { assignment, config } = data;

  // Agent is "built" when submitted OR past due date (auto-submit)
  const isPastDue = Boolean(assignment.dueDate && new Date(assignment.dueDate) < new Date());
  const isBuilt = (config && !config.isDraft) || isPastDue;

  // Check if agent is built
  if (!config || !isBuilt) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <Bot className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Agent Not Ready</h1>
          <p className="text-gray-600 mb-4">
            Your agent will be available after the due date. Continue designing it until then.
          </p>
          <Button
            onClick={() =>
              navigate(`/courses/${courseId}/agent-assignments/${assignmentId}`)
            }
          >
            Go to Agent Builder
          </Button>
        </div>
      </div>
    );
  }

  // Build display messages including welcome message
  const displayMessages: { role: 'user' | 'assistant'; content: string; id: number }[] = [];

  if (config.welcomeMessage && messages.length === 0 && conversationId) {
    displayMessages.push({
      role: 'assistant',
      content: config.welcomeMessage,
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

  const suggestedQuestions = config.suggestedQuestions || [];
  const courseName = assignment.course?.title || 'Course';

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-2">
          {/* Breadcrumb Navigation */}
          <Breadcrumb
            items={[
              { label: 'Courses', href: '/courses' },
              { label: courseName, href: `/courses/${courseId}` },
              { label: config.agentName },
            ]}
            className="mb-3"
          />

          {/* Agent Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {config.avatarImageUrl ? (
                <img
                  src={config.avatarImageUrl}
                  alt={config.agentName}
                  className="w-10 h-10 rounded-full object-cover shadow-sm"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
                  <Bot className="w-5 h-5 text-white" />
                </div>
              )}
              <div>
                <h1 className="font-semibold text-gray-900">{config.agentName}</h1>
                {config.agentTitle && (
                  <p className="text-xs text-violet-600 font-medium">{config.agentTitle}</p>
                )}
              </div>
            </div>
            {conversationId && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleNewConversation}
                icon={<RotateCcw className="w-4 h-4" />}
              >
                New Chat
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* New Session Indicator */}
          <div className="flex justify-center mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-violet-100 text-violet-700 rounded-full text-xs">
              <Sparkles className="w-3 h-3" />
              <span>New conversation session</span>
            </div>
          </div>

          {/* Loading state while starting */}
          {!conversationId && startConversationMutation.isPending && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
            </div>
          )}

          {/* Error state */}
          {error && !conversationId && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-red-500 mb-4">{error}</p>
              <Button size="sm" onClick={() => startConversationMutation.mutate()}>
                Try Again
              </Button>
            </div>
          )}

          {/* Chat messages */}
          {conversationId && (
            <>
              {displayMessages.map((msg, index) => (
                    <div
                      key={msg.id || index}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="flex-shrink-0 mr-2">
                          {config.avatarImageUrl ? (
                            <img
                              src={config.avatarImageUrl}
                              alt={config.agentName}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                              <Bot className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                      )}
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                          msg.role === 'user'
                            ? 'bg-violet-600 text-white rounded-br-md'
                            : 'bg-white shadow-sm border border-gray-100 rounded-bl-md'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}

                  {/* Typing indicator */}
                  {sendMessageMutation.isPending && (
                    <div className="flex justify-start">
                      <div className="flex-shrink-0 mr-2">
                        {config.avatarImageUrl ? (
                          <img
                            src={config.avatarImageUrl}
                            alt={config.agentName}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                            <Bot className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
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
          {error && conversationId && (
            <div className="px-4 py-2 bg-red-50 border-t border-red-100">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Suggested Questions (show at start) */}
          {conversationId && suggestedQuestions.length > 0 && messages.length === 0 && (
            <div className="px-4 py-3 border-t border-gray-200 bg-white/80">
              <p className="text-xs text-gray-500 mb-2">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.slice(0, 4).map((question, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSuggestedQuestion(question)}
                    disabled={sendMessageMutation.isPending}
                    className="text-sm px-4 py-2 bg-white border border-gray-200 rounded-full hover:border-violet-300 hover:bg-violet-50 transition-colors disabled:opacity-50"
                  >
                    {question.length > 50 ? question.substring(0, 50) + '...' : question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input - only show when conversation is active */}
          {conversationId && (
            <div className="p-4 bg-white border-t border-gray-200">
              <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={`Message ${config.agentName}...`}
                  disabled={sendMessageMutation.isPending}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || sendMessageMutation.isPending}
                  className="p-3 bg-violet-600 text-white rounded-full hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </form>
            </div>
          )}
      </main>
    </div>
  );
};
