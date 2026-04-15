/**
 * Agent Test Chat Page
 *
 * Full-screen chat view for testing a student's submitted agent. Mirrors the
 * look-and-feel of the AI Tutors page (`pages/AITutors.tsx`) but with a
 * single-agent context: no tutor sidebar, no mode selector, only the one
 * agent the student designed. The Emotional Pulse widget is present in the
 * chat footer so research-grade analytics can be captured during testing.
 *
 * Entry: the student clicks "Start Test Conversation" on
 * /courses/:courseId/agent-assignments/:assignmentId/test, which navigates
 * here. A test conversation is auto-started on mount.
 *
 * Access gate: same as TestAndReflect — students may only reach this page
 * after submitting their agent. Drafts are bounced back to the builder.
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Bot, Database, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { agentAssignmentsApi } from '../../api/agentAssignments';
import { resolveFileUrl } from '../../api/client';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { TestChatInterface } from '../../components/agent-assignment/TestChatInterface';
import { EmotionalPulseWidget } from '../../components/common/EmotionalPulseWidget';
import { EmotionalPulseHistory } from '../../components/tutors/EmotionalPulseHistory';
import { canTestAgent } from '../../utils/agentAccess';
import { AgentTestMessage } from '../../types';
import { getDesignLogger, endCurrentDesignSession } from '../../services/agentDesignLogger';
import { useAuthStore } from '../../store/authStore';

export const AgentTestChat = () => {
  const { t } = useTranslation(['teaching', 'common', 'navigation']);
  const { courseId, assignmentId } = useParams<{
    courseId: string;
    assignmentId: string;
  }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const assId = parseInt(assignmentId!, 10);
  const builderPath = `/courses/${courseId}/agent-assignments/${assignmentId}`;
  const launchPath = `${builderPath}/test`;

  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<AgentTestMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Increment whenever the student taps an emotion so the right-rail
  // EmotionalPulseHistory refetches and shows the new entry immediately.
  const [pulseRefreshTrigger, setPulseRefreshTrigger] = useState(0);

  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ['myAgentConfig', assId],
    queryFn: () => agentAssignmentsApi.getMyAgentConfig(assId),
  });

  // Design logger — same subsystem the builder uses, so every message flows
  // into AgentDesignEventLog AND the bridged LearningActivityLog row admins
  // can see in admin/logs/activity.
  const logger = user?.id
    ? getDesignLogger(user.id, assId)
    : null;

  // Gate: bounce drafts back to the builder.
  useEffect(() => {
    if (!isLoading && data && !canTestAgent(data.config)) {
      toast.error(t('submit_before_test'));
      navigate(builderPath, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, data]);

  // Start a design logging sitting for this chat session and end it cleanly
  // when the student navigates away.
  useEffect(() => {
    if (!logger || !data?.config) return;
    logger.setAgentConfigId(data.config.id);
    logger.setVersion(data.config.version);
    logger.setCourseContext((data as any)?.assignment?.course?.id);
    logger.startSession(data.config.id, data.config.version);
    return () => {
      endCurrentDesignSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logger, data?.config?.id]);

  // Start the conversation mutation.
  const startConversationMutation = useMutation({
    mutationFn: () => {
      if (!data?.config) throw new Error('No agent config');
      return agentAssignmentsApi.startTestConversation(assId, data.config.id);
    },
    onSuccess: (startData) => {
      setConversationId(startData.conversation.id);
      setMessages([]);
      setError(null);
      logger?.logTestStarted(startData.conversation.id);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to start conversation');
    },
  });

  // Auto-start a conversation once the config has loaded (first-time only).
  // Subsequent "reset" is driven by the explicit button below.
  useEffect(() => {
    if (
      data?.config &&
      canTestAgent(data.config) &&
      !conversationId &&
      !startConversationMutation.isPending
    ) {
      startConversationMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.config?.id]);

  // Send message mutation (parallel to AgentTestTab's, but rebuilt here so
  // the state stays local to this page).
  const sendMessageMutation = useMutation({
    mutationFn: (message: string) => {
      if (!conversationId) throw new Error('No conversation started');
      return agentAssignmentsApi.sendTestMessage(assId, conversationId, message);
    },
    onSuccess: (resp) => {
      const newMessages: AgentTestMessage[] = [
        ...messages,
        {
          id: Date.now(),
          conversationId: conversationId!,
          role: 'user',
          content: resp.userMessage.content,
          messageIndex: resp.userMessage.messageIndex,
          createdAt: new Date().toISOString(),
        },
        {
          id: resp.assistantMessage.id,
          conversationId: conversationId!,
          role: 'assistant',
          content: resp.assistantMessage.content,
          messageIndex: resp.assistantMessage.messageIndex,
          createdAt: resp.assistantMessage.createdAt,
        },
      ];
      setMessages(newMessages);
      setError(null);

      logger?.logTestMessageSent(conversationId!, newMessages.length - 1, {
        userMessage: resp.userMessage.content,
        aiModel: (resp as any).aiModel,
        aiProvider: (resp as any).aiProvider,
      });
      logger?.logTestResponseReceived(conversationId!, newMessages.length, {
        assistantMessage: resp.assistantMessage.content,
        aiModel: (resp as any).aiModel,
        aiProvider: (resp as any).aiProvider,
        responseTimeMs: (resp as any).responseTimeMs,
        promptTokens: (resp as any).promptTokens,
        completionTokens: (resp as any).completionTokens,
        totalTokens: (resp as any).totalTokens,
      });
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to send message');
    },
  });

  const handleResetConversation = () => {
    setConversationId(null);
    setMessages([]);
    setError(null);
    logger?.logTestReset();
    startConversationMutation.mutate();
  };

  if (isLoading) {
    return <Loading fullScreen text={t('loading_your_agent')} />;
  }

  if (loadError || !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <Bot className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {t('failed_to_load_assignment')}
        </h1>
        <Button onClick={() => navigate(builderPath)}>
          {t('common:back')}
        </Button>
      </div>
    );
  }

  const { assignment, config } = data;
  if (!config || !canTestAgent(config)) {
    return null;
  }

  const courseName = assignment.course?.title || 'Course';
  const avatarUrl = config.avatarImageUrl
    ? resolveFileUrl(config.avatarImageUrl)
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Breadcrumb
          items={[
            { label: t('navigation:courses'), href: '/courses' },
            { label: courseName, href: `/courses/${courseId}` },
            { label: t('assignments'), href: `/courses/${courseId}/assignments` },
            { label: assignment.title, href: builderPath },
            { label: t('test_reflect'), href: launchPath },
            { label: t('common:chat') },
          ]}
        />
      </div>

      {/* Agent header card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={config.agentName}
                className="w-12 h-12 rounded-full object-cover shadow-sm flex-shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm flex-shrink-0">
                <Bot className="w-6 h-6 text-white" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                {config.agentName}
              </h1>
              {config.agentTitle && (
                <p className="text-sm text-violet-600 font-medium truncate">
                  {config.agentTitle}
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                {assignment.title}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(launchPath)}
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              {t('common:back')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleResetConversation}
              icon={<RotateCcw className="w-4 h-4" />}
              disabled={startConversationMutation.isPending}
            >
              {t('reset_conversation', { defaultValue: 'Reset' })}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                navigate(
                  `/courses/${courseId}/agent-assignments/${assignmentId}/datasets`
                )
              }
              icon={<Database className="w-4 h-4" />}
            >
              {t('datasets')}
            </Button>
          </div>
        </div>
      </div>

      {/* Chat + Emotional Journey layout — mirrors AITutors: chat on the
          left with a horizontal EmotionalPulseWidget bar just above the
          textarea, emotional journey history pinned to the right. */}
      <div className="flex gap-4 items-stretch min-h-0" style={{ height: 'calc(100vh - 260px)', minHeight: '480px' }}>
        {/* Chat panel */}
        <div className="flex-1 min-w-0">
          <TestChatInterface
            agentName={config.agentName}
            agentTitle={config.agentTitle}
            avatarImageUrl={avatarUrl}
            welcomeMessage={config.welcomeMessage}
            messages={messages}
            onSendMessage={(msg) => sendMessageMutation.mutate(msg)}
            isSending={sendMessageMutation.isPending || startConversationMutation.isPending}
            error={error}
            suggestedQuestions={config.suggestedQuestions || []}
            footerSlot={
              <EmotionalPulseWidget
                context="chatbot"
                contextId={conversationId ?? undefined}
                agentId={config.id}
                courseId={assignment.course?.id}
                compact
                onPulse={() => setPulseRefreshTrigger((n) => n + 1)}
              />
            }
          />
        </div>

        {/* Emotional Journey right rail */}
        <div className="hidden lg:block flex-shrink-0 w-80">
          <EmotionalPulseHistory
            agentId={config.id}
            agentName={config.agentName}
            isOpen={true}
            onClose={() => { /* always-open on desktop */ }}
            refreshTrigger={pulseRefreshTrigger}
          />
        </div>
      </div>
    </div>
  );
};

export default AgentTestChat;
