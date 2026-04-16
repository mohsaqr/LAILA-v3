/**
 * Conversation Replay Page
 *
 * Instructor/admin read-only view of a single test conversation. Mirrors
 * the look-and-feel of `AgentTestChat` (live student testing) but without
 * the input form, emotional pulse, or reset button — it's a faithful
 * replay of an archived chat.
 *
 * Route: /teach/courses/:id/assignments/:assignmentId/agent-submissions/:submissionId/conversations/:conversationId
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Bot, AlertCircle } from 'lucide-react';
import { agentAssignmentsApi } from '../../api/agentAssignments';
import { assignmentsApi } from '../../api/assignments';
import { resolveFileUrl } from '../../api/client';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { TestChatInterface } from '../../components/agent-assignment/TestChatInterface';
import { AgentTestMessage } from '../../types';

export const ConversationReplay = () => {
  const { t } = useTranslation(['teaching', 'common']);
  const { id, assignmentId, submissionId, conversationId } = useParams<{
    id: string;
    assignmentId: string;
    submissionId: string;
    conversationId: string;
  }>();
  const navigate = useNavigate();

  const courseId = parseInt(id!, 10);
  const assId = parseInt(assignmentId!, 10);
  const subId = parseInt(submissionId!, 10);
  const convId = parseInt(conversationId!, 10);

  const reviewPath = `/teach/courses/${courseId}/assignments/${assId}/agent-submissions/${subId}`;

  const { data: assignment, isLoading: assignmentLoading } = useQuery({
    queryKey: ['assignment', assId],
    queryFn: () => assignmentsApi.getAssignmentById(assId),
  });

  const { data: submission, isLoading: submissionLoading } = useQuery({
    queryKey: ['agentSubmission', assId, subId],
    queryFn: () => agentAssignmentsApi.getAgentSubmissionDetail(assId, subId),
  });

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ['agentTestConversations', assId, subId],
    queryFn: () => agentAssignmentsApi.getSubmissionTestConversations(assId, subId),
  });

  const conversation = useMemo(
    () => conversations.find((c) => c.id === convId),
    [conversations, convId]
  );

  const isLoading = assignmentLoading || submissionLoading || conversationsLoading;

  if (isLoading) {
    return <Loading fullScreen text={t('loading_conversation', { defaultValue: 'Loading conversation…' })} />;
  }

  if (!assignment || !submission || !submission.agentConfig || !conversation) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {t('conversation_not_found', { defaultValue: 'Conversation not found' })}
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
  const messages = (conversation.messages || []) as AgentTestMessage[];

  const formatStart = (dateStr: string) =>
    new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

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
            { label: t('test_conversations', { defaultValue: 'Test conversations' }) },
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
                {student?.fullname || t('unknown_student')} ·{' '}
                {formatStart(conversation.startedAt)} · v{conversation.configVersion}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(reviewPath)}
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              {t('common:back')}
            </Button>
          </div>
        </div>
      </div>

      {/* Chat replay */}
      <div style={{ height: 'calc(100vh - 260px)', minHeight: '480px' }}>
        <TestChatInterface
          agentName={config.agentName}
          agentTitle={config.agentTitle}
          avatarImageUrl={avatarUrl}
          welcomeMessage={config.welcomeMessage}
          messages={messages}
          onSendMessage={() => { /* read-only */ }}
          isSending={false}
          readOnly
        />
      </div>
    </div>
  );
};

export default ConversationReplay;
