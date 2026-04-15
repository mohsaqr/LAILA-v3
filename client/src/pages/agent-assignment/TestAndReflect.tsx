/**
 * Test & Reflect — Launch Page
 *
 * Landing page shown after a student submits their agent. Presents a concise
 * agent summary and a single "Start Test Conversation" CTA that routes the
 * student into a dedicated full-screen chat page (`AgentTestChat`) modelled
 * on the AI Tutors surface. Keeping the launch and chat pages separate makes
 * the breadcrumb hierarchy honest and lets the chat fill the viewport.
 *
 * Access is gated: students may only reach this page after submitting their
 * agent (StudentAgentConfig.isDraft === false). Drafts are redirected back
 * to the builder with a toast.
 */

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Bot, Database, MessageSquare, Play } from 'lucide-react';
import toast from 'react-hot-toast';
import { agentAssignmentsApi } from '../../api/agentAssignments';
import { resolveFileUrl } from '../../api/client';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { canTestAgent } from '../../utils/agentAccess';

export const TestAndReflect = () => {
  const { t } = useTranslation(['teaching', 'common', 'navigation']);
  const { courseId, assignmentId } = useParams<{
    courseId: string;
    assignmentId: string;
  }>();
  const navigate = useNavigate();
  const assId = parseInt(assignmentId!, 10);

  const { data, isLoading, error } = useQuery({
    queryKey: ['myAgentConfig', assId],
    queryFn: () => agentAssignmentsApi.getMyAgentConfig(assId),
  });

  const builderPath = `/courses/${courseId}/agent-assignments/${assignmentId}`;

  // Gate: bounce back to the builder if the agent has not been submitted yet.
  useEffect(() => {
    if (!isLoading && data && !canTestAgent(data.config)) {
      toast.error(t('submit_before_test'));
      navigate(builderPath, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, data]);

  if (isLoading) {
    return <Loading fullScreen text={t('loading_your_agent')} />;
  }

  if (error || !data) {
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
  if (!canTestAgent(config)) {
    // Redirect effect will fire; render nothing in the meantime.
    return null;
  }

  const courseName = assignment.course?.title || 'Course';
  const chatPath = `${builderPath}/test/chat`;
  const avatarUrl = config!.avatarImageUrl
    ? resolveFileUrl(config!.avatarImageUrl)
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Breadcrumb
          items={[
            { label: t('navigation:courses'), href: '/courses' },
            { label: courseName, href: `/courses/${courseId}` },
            { label: t('assignments'), href: `/courses/${courseId}/assignments` },
            { label: assignment.title, href: builderPath },
            { label: t('test_reflect') },
          ]}
        />
      </div>

      {/* Agent launch card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        {/* Agent identity header */}
        <div className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border-b border-violet-100 dark:border-violet-900/40 px-6 py-6">
          <div className="flex items-start gap-4">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={config!.agentName}
                className="w-16 h-16 rounded-full object-cover shadow-md flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md flex-shrink-0">
                <Bot className="w-8 h-8 text-white" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
                {config!.agentName}
              </h1>
              {config!.agentTitle && (
                <p className="text-sm text-violet-700 dark:text-violet-300 font-medium truncate mt-0.5">
                  {config!.agentTitle}
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                {assignment.title}
              </p>
            </div>
          </div>
        </div>

        {/* Body copy + CTA */}
        <div className="px-6 py-6">
          {config!.personaDescription && (
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-6 whitespace-pre-wrap">
              {config!.personaDescription}
            </p>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <MessageSquare className="w-4 h-4 text-violet-500" />
              <span>
                {t('start_test_chat_helper', {
                  defaultValue:
                    'Chat with your agent in a dedicated testing room.',
                })}
              </span>
            </div>
            <Button
              onClick={() => navigate(chatPath)}
              icon={<Play className="w-4 h-4" />}
            >
              {t('start_test_conversation', {
                defaultValue: 'Start Test Conversation',
              })}
            </Button>
          </div>
        </div>

        {/* Secondary actions */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(builderPath)}
            icon={<ArrowLeft className="w-4 h-4" />}
          >
            {t('common:back')}
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
  );
};
