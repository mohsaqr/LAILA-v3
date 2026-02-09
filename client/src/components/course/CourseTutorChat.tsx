import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Send, ChevronLeft, Bot, Trash2, Plus, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { courseTutorApi, MergedTutorConfig, Conversation, Message } from '../../api/courseTutor';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '../common/Button';
import { Loading } from '../common/Loading';

interface CourseTutorChatProps {
  courseId: number;
  courseTitle: string;
  tutor: MergedTutorConfig;
  onBack: () => void;
  existingConversations: Conversation[];
}

export const CourseTutorChat = ({
  courseId,
  courseTitle,
  tutor,
  onBack,
  existingConversations,
}: CourseTutorChatProps) => {
  const { t } = useTranslation(['courses']);
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const [activeConversationId, setActiveConversationId] = useState<number | null>(
    existingConversations.length > 0 ? existingConversations[0].id : null
  );
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
    userBubble: isDark ? '#4f46e5' : '#4f46e5',
    emptyIcon: isDark ? '#374151' : '#e5e7eb',
    sidebarBg: isDark ? '#111827' : '#f9fafb',
  };

  // Fetch conversation messages
  const { data: conversationData, isLoading: messagesLoading } = useQuery({
    queryKey: ['courseTutorConversation', courseId, activeConversationId],
    queryFn: () =>
      activeConversationId
        ? courseTutorApi.getConversation(courseId, activeConversationId)
        : Promise.resolve(null),
    enabled: !!activeConversationId,
  });

  // Create conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: () => courseTutorApi.createConversation(courseId, tutor.courseTutorId),
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({
        queryKey: ['tutorConversations', courseId, tutor.courseTutorId],
      });
      setActiveConversationId(conversation.id);
    },
    onError: (err: any) => toast.error(err.message || t('failed_to_start_conversation')),
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (message: string) =>
      courseTutorApi.sendMessage(courseId, activeConversationId!, message),
    onMutate: () => {
      setIsTyping(true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['courseTutorConversation', courseId, activeConversationId],
      });
      queryClient.invalidateQueries({
        queryKey: ['tutorConversations', courseId, tutor.courseTutorId],
      });
    },
    onError: (err: any) => toast.error(err.message || t('failed_to_send_message_toast')),
    onSettled: () => {
      setIsTyping(false);
    },
  });

  // Delete conversation mutation
  const deleteConversationMutation = useMutation({
    mutationFn: (convId: number) => courseTutorApi.deleteConversation(courseId, convId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['tutorConversations', courseId, tutor.courseTutorId],
      });
      setActiveConversationId(null);
      toast.success(t('conversation_deleted'));
    },
    onError: (err: any) => toast.error(err.message || t('failed_to_delete_conversation')),
  });

  // Fetch conversations list
  const { data: conversations } = useQuery({
    queryKey: ['tutorConversations', courseId, tutor.courseTutorId],
    queryFn: () => courseTutorApi.getConversations(courseId, tutor.courseTutorId),
    initialData: existingConversations,
  });

  const messages = conversationData?.messages || [];

  // Auto scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, [activeConversationId]);

  const handleSend = async () => {
    if (!input.trim() || sendMessageMutation.isPending) return;

    // If no active conversation, create one first
    if (!activeConversationId) {
      const conversation = await createConversationMutation.mutateAsync();
      // After creation, send the message
      const message = input.trim();
      setInput('');
      await courseTutorApi.sendMessage(courseId, conversation.id, message);
      queryClient.invalidateQueries({
        queryKey: ['courseTutorConversation', courseId, conversation.id],
      });
      return;
    }

    const message = input.trim();
    setInput('');
    await sendMessageMutation.mutateAsync(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewConversation = () => {
    createConversationMutation.mutate();
  };

  const getPersonalityColor = () => {
    switch (tutor.personality) {
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
    <div
      className="flex h-[600px] rounded-xl overflow-hidden border"
      style={{ backgroundColor: colors.bg, borderColor: colors.border }}
    >
      {/* Conversations Sidebar */}
      <div
        className="w-64 flex-shrink-0 flex flex-col border-r"
        style={{ backgroundColor: colors.sidebarBg, borderColor: colors.borderLight }}
      >
        <div className="p-3 border-b" style={{ borderColor: colors.borderLight }}>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            icon={<Plus className="w-4 h-4" />}
            onClick={handleNewConversation}
            loading={createConversationMutation.isPending}
          >
            {t('new_conversation')}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations && conversations.length > 0 ? (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConversationId(conv.id)}
                className={`w-full p-3 text-left flex items-center gap-2 transition-colors ${
                  activeConversationId === conv.id ? 'bg-primary-500/10' : ''
                }`}
                style={{
                  borderBottom: `1px solid ${colors.borderLight}`,
                }}
              >
                <MessageSquare className="w-4 h-4" style={{ color: colors.textMuted }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{ color: colors.textPrimary }}>
                    {conv.title || t('conversation_number', { id: conv.id })}
                  </p>
                  <p className="text-xs" style={{ color: colors.textMuted }}>
                    {new Date(conv.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </button>
            ))
          ) : (
            <p className="p-4 text-sm text-center" style={{ color: colors.textMuted }}>
              {t('no_conversations_yet')}
            </p>
          )}
        </div>

        <div className="p-3 border-t" style={{ borderColor: colors.borderLight }}>
          <Button variant="ghost" size="sm" className="w-full" onClick={onBack}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            {t('back_to_tutors')}
          </Button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: colors.borderLight }}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br ${getPersonalityColor()} text-white`}
            >
              {tutor.avatarUrl ? (
                <img
                  src={tutor.avatarUrl}
                  alt={tutor.displayName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <Bot className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="font-semibold" style={{ color: colors.textPrimary }}>
                {tutor.displayName}
              </h2>
              <p className="text-xs" style={{ color: colors.textSecondary }}>
                {courseTitle}
              </p>
            </div>
          </div>
          {activeConversationId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deleteConversationMutation.mutate(activeConversationId)}
              loading={deleteConversationMutation.isPending}
              icon={<Trash2 className="w-4 h-4" />}
              title={t('delete_conversation')}
            >
              {t('clear')}
            </Button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messagesLoading ? (
            <Loading text={t('loading_messages')} />
          ) : messages.length === 0 ? (
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
                  {tutor.welcomeMessage ||
                    t('tutor_welcome_message', { name: tutor.displayName, course: courseTitle })}
                </p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                tutorName={tutor.displayName}
                tutorAvatar={tutor.avatarUrl}
                personalityColor={getPersonalityColor()}
                colors={colors}
              />
            ))
          )}

          {isTyping && (
            <div className="flex items-start gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br ${getPersonalityColor()} text-white`}
              >
                <Bot className="w-4 h-4" />
              </div>
              <div
                className="px-4 py-3 rounded-2xl rounded-bl-md"
                style={{ backgroundColor: colors.messageBubble }}
              >
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0.1s' }}
                  />
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0.2s' }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t" style={{ borderColor: colors.borderLight }}>
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('message_tutor', { name: tutor.displayName })}
              className="flex-1 px-4 py-2 border rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              style={{
                backgroundColor: colors.inputBg,
                borderColor: colors.inputBorder,
                color: colors.textPrimary,
              }}
              rows={1}
              disabled={sendMessageMutation.isPending}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || sendMessageMutation.isPending}
              loading={sendMessageMutation.isPending}
              icon={<Send className="w-4 h-4" />}
            >
              {t('send')}
            </Button>
          </div>
          <p className="text-xs mt-2" style={{ color: colors.textMuted }}>
            {t('keyboard_hint')}
          </p>
        </div>
      </div>
    </div>
  );
};

interface MessageBubbleProps {
  message: Message;
  tutorName: string;
  tutorAvatar: string | null;
  personalityColor: string;
  colors: Record<string, string>;
}

const MessageBubble = ({
  message,
  tutorName,
  tutorAvatar,
  personalityColor,
  colors,
}: MessageBubbleProps) => {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          className="px-4 py-3 rounded-2xl rounded-br-md max-w-[80%] text-white"
          style={{ backgroundColor: colors.userBubble }}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br ${personalityColor} text-white flex-shrink-0`}
      >
        {tutorAvatar ? (
          <img
            src={tutorAvatar}
            alt={tutorName}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <Bot className="w-4 h-4" />
        )}
      </div>
      <div
        className="px-4 py-3 rounded-2xl rounded-bl-md max-w-[80%]"
        style={{ backgroundColor: colors.messageBubble }}
      >
        <p className="text-sm whitespace-pre-wrap" style={{ color: colors.textPrimary }}>
          {message.content}
        </p>
      </div>
    </div>
  );
};

export default CourseTutorChat;
