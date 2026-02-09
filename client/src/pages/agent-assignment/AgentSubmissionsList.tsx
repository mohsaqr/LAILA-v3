import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  User,
  Award,
  Check,
  Clock,
  Bot,
  MessageSquare,
} from 'lucide-react';
import { agentAssignmentsApi } from '../../api/agentAssignments';
import { assignmentsApi } from '../../api/assignments';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';

export const AgentSubmissionsList = () => {
  const { t } = useTranslation(['teaching', 'common']);
  const { id, assignmentId } = useParams<{ id: string; assignmentId: string }>();
  const navigate = useNavigate();

  const courseId = parseInt(id!, 10);
  const assId = parseInt(assignmentId!, 10);

  // Fetch assignment
  const { data: assignment, isLoading: assignmentLoading } = useQuery({
    queryKey: ['assignment', assId],
    queryFn: () => assignmentsApi.getAssignmentById(assId),
  });

  // Fetch submissions
  const { data: submissions = [], isLoading: submissionsLoading } = useQuery({
    queryKey: ['agentSubmissions', assId],
    queryFn: () => agentAssignmentsApi.getAgentSubmissions(assId),
  });

  if (assignmentLoading || submissionsLoading) {
    return <Loading fullScreen text={t('loading_submissions')} />;
  }

  if (!assignment) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('assignment_not_found')}</h1>
        <Button onClick={() => navigate(`/teach/courses/${courseId}/assignments`)}>
          {t('back_to_assignments')}
        </Button>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSubmissionStatus = (config: typeof submissions[0]) => {
    if (config.submission?.status === 'graded') return 'graded';
    if (!config.isDraft) return 'submitted';
    return 'draft';
  };

  const pendingCount = submissions.filter(
    (s) => !s.isDraft && s.submission?.status !== 'graded'
  ).length;
  const gradedCount = submissions.filter(
    (s) => s.submission?.status === 'graded'
  ).length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/teach/courses/${courseId}/assignments`)}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          {t('back_to_assignments')}
        </Button>
      </div>

      {/* Assignment Header */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Bot className="w-5 h-5 text-violet-600" />
                <span className="text-sm font-medium text-violet-600 bg-violet-100 px-2 py-0.5 rounded">
                  {t('ai_agent_assignment')}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{assignment.title}</h1>
              {assignment.description && (
                <p className="text-gray-600 mb-4">{assignment.description}</p>
              )}
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2 text-gray-500">
                  <Award className="w-4 h-4" />
                  <span>{t('x_points', { count: assignment.points })}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <Clock className="w-4 h-4 text-yellow-500" />
                  <span>{t('pending_count', { count: pendingCount })}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>{t('graded_count', { count: gradedCount })}</span>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Submissions List */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">
            {t('submissions_count', { count: submissions.length })}
          </h2>
        </CardHeader>
        <CardBody>
          {submissions.length > 0 ? (
            <div className="space-y-4">
              {submissions.map((config) => (
                <div
                  key={config.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-violet-200 hover:bg-violet-50/30 transition-colors cursor-pointer"
                  onClick={() =>
                    config.submission &&
                    navigate(
                      `/teach/courses/${courseId}/assignments/${assId}/submissions/${config.submission.id}`
                    )
                  }
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-500" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {config.user?.fullname || t('unknown_student')}
                        </h3>
                        <p className="text-sm text-gray-500">{config.user?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={getSubmissionStatus(config)} />
                      {config.submission?.status === 'graded' && (
                        <span className="text-lg font-semibold text-gray-900">
                          {config.submission.grade}/{assignment.points}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Agent Info */}
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <Bot className="w-4 h-4 text-violet-500" />
                      <span className="font-medium">{config.agentName}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-gray-400" />
                      <span>
                        {config._count?.testConversations || 0} {t('test_conversations')}
                      </span>
                    </div>
                    <span className="text-gray-400">•</span>
                    <span>{t('version')} {config.version}</span>
                  </div>

                  {/* Submission date */}
                  {config.submittedAt && (
                    <div className="mt-2 text-xs text-gray-500">
                      {t('submitted')} {formatDate(config.submittedAt)}
                    </div>
                  )}

                  {/* Feedback preview */}
                  {config.submission?.feedback && (
                    <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                      <span className="font-medium">{t('feedback')}: </span>
                      {config.submission.feedback.length > 100
                        ? `${config.submission.feedback.slice(0, 100)}...`
                        : config.submission.feedback}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Bot}
              title={t('no_submissions_yet')}
              description={t('no_submissions_description')}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
};
