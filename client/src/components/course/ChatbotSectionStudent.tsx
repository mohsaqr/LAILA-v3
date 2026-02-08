import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Send, MessageCircle, Loader2, Trash2 } from 'lucide-react';
import { LectureSection, ChatbotConversationMessage } from '../../types';
import { coursesApi } from '../../api/courses';
import { Button } from '../common/Button';
import { Card, CardBody } from '../common/Card';
import analytics from '../../services/analytics';
import activityLogger from '../../services/activityLogger';

interface ChatbotSectionStudentProps {
  section: LectureSection;
  courseId?: number;
}

export const ChatbotSectionStudent = ({ section, courseId }: ChatbotSectionStudentProps) => {
  const { t } = useTranslation(['courses']);
  const [message, setMessage] = useState('');
  const [hasTrackedStart, setHasTrackedStart] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Helper to get chatbot params for logging
  const getChatbotParams = () => ({
    title: section.chatbotTitle,
    intro: section.chatbotIntro,
    imageUrl: section.chatbotImageUrl,
    systemPrompt: section.chatbotSystemPrompt,
    welcomeMessage: section.chatbotWelcome,
  });

  // Fetch conversation history
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['chatbotHistory', section.id],
    queryFn: () => coursesApi.getChatbotHistory(section.id),
  });

  // Track conversation start when component mounts or first message is fetched
  useEffect(() => {
    if (!hasTrackedStart && !isLoading) {
      analytics.trackChatbotInteraction({
        sectionId: section.id,
        eventType: 'conversation_start',
        chatbotParams: getChatbotParams(),
        metadata: {
          hasExistingHistory: history.length > 0,
          messageCount: history.length,
        },
      });
      setHasTrackedStart(true);
    }
  }, [isLoading, hasTrackedStart, section.id, history.length]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (msg: string) => {
      const startTime = performance.now();

      // Track message sent
      analytics.trackChatbotInteraction({
        sectionId: section.id,
        eventType: 'message_sent',
        chatbotParams: getChatbotParams(),
        messageContent: msg,
        metadata: {
          messageLength: msg.length,
          conversationLength: history.length,
        },
      });

      try {
        const result = await coursesApi.sendChatbotMessage(section.id, msg);
        const endTime = performance.now();
        const responseTime = (endTime - startTime) / 1000; // Convert to seconds

        // Track message received with full details
        analytics.trackChatbotInteraction({
          sectionId: section.id,
          eventType: 'message_received',
          chatbotParams: getChatbotParams(),
          messageContent: msg,
          responseContent: result.assistantMessage.content,
          responseTime,
          aiModel: result.model,
          metadata: {
            messageLength: msg.length,
            responseLength: result.assistantMessage.content.length,
            conversationLength: history.length + 2,
          },
        });

        // Log to unified activity logger with message content
        activityLogger.logChatbotMessage(section.id, section.lectureId, courseId, {
          userMessage: msg,
          assistantMessage: result.assistantMessage.content,
          aiModel: result.model,
        }).catch(() => {});

        return result;
      } catch (error) {
        // Track error
        analytics.trackChatbotInteraction({
          sectionId: section.id,
          eventType: 'error',
          chatbotParams: getChatbotParams(),
          messageContent: msg,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          metadata: {
            messageLength: msg.length,
            conversationLength: history.length,
          },
        });
        throw error;
      }
    },
    onSuccess: (data) => {
      // Update the cache with the new messages
      queryClient.setQueryData<ChatbotConversationMessage[]>(
        ['chatbotHistory', section.id],
        (old = []) => [
          ...old,
          { id: Date.now(), role: 'user', content: message, createdAt: new Date().toISOString() },
          data.assistantMessage,
        ]
      );
      setMessage('');
      inputRef.current?.focus();
    },
  });

  // Clear conversation mutation
  const clearConversationMutation = useMutation({
    mutationFn: async () => {
      // Track conversation cleared
      analytics.trackChatbotInteraction({
        sectionId: section.id,
        eventType: 'conversation_cleared',
        chatbotParams: getChatbotParams(),
        metadata: {
          clearedMessageCount: history.length,
        },
      });

      // Log to unified activity logger
      activityLogger.log({
        verb: 'cleared',
        objectType: 'chatbot',
        objectId: section.id,
        sectionId: section.id,
        lectureId: section.lectureId,
        courseId,
      }).catch(() => {});

      return coursesApi.clearChatbotHistory(section.id);
    },
    onSuccess: () => {
      queryClient.setQueryData(['chatbotHistory', section.id], []);
    },
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, sendMessageMutation.isPending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate(message.trim());
  };

  const handleClearConversation = () => {
    if (confirm(t('confirm_clear_conversation'))) {
      clearConversationMutation.mutate();
    }
  };

  // Build display messages including welcome message
  const displayMessages: ChatbotConversationMessage[] = [];

  // Add welcome message if no history yet
  if (section.chatbotWelcome && history.length === 0) {
    displayMessages.push({
      id: 0,
      role: 'assistant',
      content: section.chatbotWelcome,
      createdAt: new Date().toISOString(),
    });
  }

  displayMessages.push(...history);

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100 px-6 py-4">
        <div className="flex items-center gap-4">
          {section.chatbotImageUrl ? (
            <img
              src={section.chatbotImageUrl}
              alt="Chatbot avatar"
              className="w-14 h-14 rounded-full object-cover shadow-md"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center shadow-md">
              <MessageCircle className="w-7 h-7 text-amber-600" />
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">
              {section.chatbotTitle || t('ai_teaching_assistant')}
            </h3>
            {section.chatbotIntro && (
              <p className="text-sm text-gray-600 mt-0.5">{section.chatbotIntro}</p>
            )}
          </div>
          {history.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearConversation}
              disabled={clearConversationMutation.isPending}
              className="text-gray-500 hover:text-red-500"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <CardBody className="p-0">
        <div className="h-80 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
            </div>
          ) : displayMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <MessageCircle className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">{t('start_conversation')}</p>
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
              {sendMessageMutation.isPending && (
                <div className="flex justify-start">
                  <div className="bg-white shadow-sm border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4 bg-white">
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('type_your_message')}
              disabled={sendMessageMutation.isPending}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!message.trim() || sendMessageMutation.isPending}
              className="p-2.5 bg-amber-500 text-white rounded-full hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendMessageMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
          {sendMessageMutation.isError && (
            <p className="mt-2 text-sm text-red-500">
              {t('failed_to_send_message')}
            </p>
          )}
        </form>
      </CardBody>
    </Card>
  );
};
