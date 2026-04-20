/**
 * Instructor Agent Test Chat Page
 *
 * Full-screen instructor-facing chat for testing a student's submitted
 * agent. Mirrors the student test chat (AgentTestChat) visually and
 * structurally, but:
 *  - auto-starts an **instructor** test conversation (separate from the
 *    student's own tests via startInstructorTest)
 *  - uses the instructor/admin breadcrumb path
 *  - no EmotionalPulse widgets (those belong to the student's
 *    testing flow)
 *
 * Route: /teach/courses/:id/assignments/:assignmentId/agent-submissions/:submissionId/test
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Bot, RotateCcw, AlertCircle } from 'lucide-react';
import { agentAssignmentsApi } from '../../api/agentAssignments';
import { assignmentsApi } from '../../api/assignments';
import { resolveFileUrl } from '../../api/client';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { TestChatInterface } from '../../components/agent-assignment/TestChatInterface';
import { AgentTestMessage } from '../../types';
import activityLogger from '../../services/activityLogger';

export const InstructorAgentTestChat = () => {
  const { t } = useTranslation(['teaching', 'common']);
  const { id, assignmentId, submissionId } = useParams<{
    id: string;
    assignmentId: string;
    submissionId: string;
  }>();
  const navigate = useNavigate();

  const courseId = parseInt(id!, 10);
  const assId = parseInt(assignmentId!, 10);
  const subId = parseInt(submissionId!, 10);
  const reviewPath = `/teach/courses/${courseId}/assignments/${assId}/agent-submissions/${subId}`;

  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<AgentTestMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (subId && courseId) {
      activityLogger.logAgentTested(subId, undefined, courseId);
    }
  }, [subId, courseId]);

  const { data: assignment, isLoading: assignmentLoading } = useQuery({
    queryKey: ['assignment', assId],
    queryFn: () => assignmentsApi.getAssignmentById(assId),
  });

  const { data: submission, isLoading: submissionLoading } = useQuery({
    queryKey: ['agentSubmission', assId, subId],
    queryFn: () => agentAssignmentsApi.getAgentSubmissionDetail(assId, subId),
  });

  const startConversationMutation = useMutation({
    mutationFn: () => agentAssignmentsApi.startInstructorTest(assId, subId),
    onSuccess: (data) => {
      setConversationId(data.conversation.id);
      setMessages([]);
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to start conversation');
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: (message: string) => {
      if (!conversationId) throw new Error('No conversation started');
      return agentAssignmentsApi.sendMessage(conversationId, message);
    },
    onSuccess: (resp) => {
      setMessages((prev) => [
        ...prev,
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
      ]);
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to send message');
    },
  });

  // Auto-start the conversation once the submission has loaded.
  useEffect(() => {
    if (
      submission?.agentConfig &&
      !conversationId &&
      !startConversationMutation.isPending
    ) {
      startConversationMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submission?.agentConfig?.id]);

  const handleResetConversation = () => {
    setConversationId(null);
    setMessages([]);
    setError(null);
    startConversationMutation.mutate();
  };

  const isLoading = assignmentLoading || submissionLoading;

  if (isLoading) {
    return <Loading fullScreen text={t('loading_submission')} />;
  }

  if (!assignment || !submission || !submission.agentConfig) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {t('submission_not_found')}
        </h1>
        <Button onClick={() => navigate(reviewPath)} icon={<ArrowLeft className="w-4 h-4" />}>
          {t('common:back')}
        </Button>
      </div>
    );
  }

  const config = submission.agentConfig;
  const student = submission.user;
  const avatarUrl = config.avatarImageUrl ? resolveFileUrl(config.avatarImageUrl) : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Breadcrumb
          items={[
            { label: t('common:teaching', { defaultValue: 'Teaching' }), href: '/teach' },
            {
              label: assignment.course?.title || `Course #${courseId}`,
              href: `/teach/courses/${courseId}`,
            },
            { label: t('assignments'), href: `/teach/courses/${courseId}/assignments` },
            {
              label: assignment.title,
              href: `/teach/courses/${courseId}/assignments/${assId}`,
            },
            {
              label: t('submissions', { defaultValue: 'Submissions' }),
              href: `/teach/courses/${courseId}/assignments/${assId}/submissions`,
            },
            { label: student?.fullname || t('unknown_student'), href: reviewPath },
            { label: t('test_agent', { defaultValue: 'Test Agent' }) },
          ]}
        />
      </div>

      {/* Agent header card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
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
                {student?.fullname || t('unknown_student')} · v{config.version}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(reviewPath)}
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
          </div>
        </div>
      </div>

      {/* Chat */}
      <div style={{ height: 'calc(100vh - 260px)', minHeight: '480px' }}>
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
        />
      </div>
    </div>
  );
};

export default InstructorAgentTestChat;
