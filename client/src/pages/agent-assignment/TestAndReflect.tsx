/**
 * Test & Reflect Page
 *
 * Dedicated page for testing a submitted agent. Reuses AgentTestTab so all
 * existing chat functionality — conversation history, CSV detection, inline
 * SNA/TNA visualization, reflection prompts — is preserved unchanged.
 *
 * Access is gated: students may only reach this page after submitting their
 * agent (StudentAgentConfig.isDraft === false). Drafts are redirected back
 * to the builder with a toast.
 */

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Bot, Database } from 'lucide-react';
import toast from 'react-hot-toast';
import { agentAssignmentsApi } from '../../api/agentAssignments';
import { resolveFileUrl } from '../../api/client';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { AgentTestTab } from '../../components/agent-assignment/AgentTestTab';
import { AgentDatasetTab } from '../../components/agent-assignment/AgentDatasetTab';
import { canTestAgent } from '../../utils/agentAccess';

export const TestAndReflect = () => {
  const { t } = useTranslation(['teaching', 'common', 'navigation']);
  const { courseId, assignmentId } = useParams<{
    courseId: string;
    assignmentId: string;
  }>();
  const navigate = useNavigate();
  const assId = parseInt(assignmentId!, 10);

  const [showDatasets, setShowDatasets] = useState(false);

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

      {/* Agent header card with Back + Datasets toggle */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {config!.avatarImageUrl ? (
              <img
                src={resolveFileUrl(config!.avatarImageUrl)}
                alt={config!.agentName}
                className="w-10 h-10 rounded-full object-cover shadow-sm flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm flex-shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">
                {config!.agentName}
              </h1>
              {config!.agentTitle && (
                <p className="text-sm text-violet-600 font-medium truncate">
                  {config!.agentTitle}
                </p>
              )}
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                {assignment.title}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(builderPath)}
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              {t('common:back')}
            </Button>
            <Button
              variant={showDatasets ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setShowDatasets((v) => !v)}
              icon={<Database className="w-4 h-4" />}
            >
              {t('datasets')}
            </Button>
          </div>
        </div>
      </div>

      {/* Test & Reflect chat — reuses existing AgentTestTab so all chat
          features (history, CSV detection, inline SNA/TNA viz, reflection)
          keep working unchanged. */}
      <AgentTestTab
        assignmentId={assId}
        config={config}
        reflectionRequirement={assignment.reflectionRequirement}
        chatHeightClass="h-[calc(100vh-380px)] min-h-[420px]"
      />

      {showDatasets && config && (
        <div className="mt-6">
          <AgentDatasetTab assignmentId={assId} config={config} />
        </div>
      )}
    </div>
  );
};
